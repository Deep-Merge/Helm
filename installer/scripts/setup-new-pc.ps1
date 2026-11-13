#Requires -Version 5.1
<#
  Helm - one-shot setup for a brand-new Windows 10/11 PC.
  Started by INSTALL-HELM.bat (repo root), which runs this as Administrator.

  What it does (safe to re-run; finished steps are skipped):
    1. Asks all questions up front (PostgreSQL password, admin login, OpenAI key).
    2. Installs Python 3.12, Node.js LTS, PostgreSQL 16/17 and Google Chrome via winget.
    3. Creates the database "bidautomation".
    4. Writes apps\api\.env and apps\dashboard\.env.local.
    5. Creates the Python venv and installs API requirements.
    6. Installs npm packages, builds the dashboard (production) and the Chrome extension.
    7. Registers the "Helm Auto Start" task (runs at every sign-in, restarts crashed parts).
    8. Adds desktop shortcuts, starts Helm and opens the dashboard.

  Log: %ProgramData%\Helm\setup.log
#>
param(
    [switch]$Reconfigure   # ask the questions again even if .env already exists
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot     = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$apiDir       = Join-Path $repoRoot "apps\api"
$dashboardDir = Join-Path $repoRoot "apps\dashboard"
$extensionDir = Join-Path $repoRoot "apps\extension"
$helmData     = Join-Path $env:ProgramData "Helm"
$legacyState  = Join-Path $env:ProgramData "BidAutomation"
$taskName     = "Helm Auto Start"

# ---------------------------------------------------------------- helpers ----

function Write-Step([string]$Text) { Write-Host ""; Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "    OK  $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "    !!  $Text" -ForegroundColor Yellow }

function Test-IsAdmin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Update-SessionPath {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
}

function Write-TextFile([string]$Path, [string]$Content) {
    # UTF-8 without BOM so python-dotenv / Next.js read the first line correctly
    [IO.File]::WriteAllText($Path, $Content.Trim() + "`r`n", (New-Object Text.UTF8Encoding($false)))
}

function Read-Plain([string]$Prompt, [string]$Default = "") {
    $suffix = if ($Default) { " [$Default]" } else { "" }
    $value = Read-Host "$Prompt$suffix"
    if (-not $value) { return $Default }
    return $value.Trim()
}

function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-NewSecret([string]$Prompt, [int]$MinLength, [string]$ForbiddenPattern = "") {
    while ($true) {
        $a = Read-Secret $Prompt
        if ($a.Length -lt $MinLength) { Write-Warn "Must be at least $MinLength characters."; continue }
        if ($ForbiddenPattern -and $a -match $ForbiddenPattern) { Write-Warn "Do not use spaces, quotes or & | < > ^ characters."; continue }
        $b = Read-Secret "Type it again to confirm"
        if ($a -ne $b) { Write-Warn "The two entries do not match - try again."; continue }
        return $a
    }
}

function New-Secret {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ([Convert]::ToBase64String($bytes) -replace "[+/=]", "x")
}

function Read-DotEnv([string]$Path) {
    $map = @{}
    if (Test-Path $Path) {
        foreach ($line in Get-Content $Path) {
            if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $map[$Matches[1]] = $Matches[2] }
        }
    }
    return $map
}

function Get-WingetExe {
    $cmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $stub = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
    if (Test-Path $stub) { return $stub }
    return $null
}

function Ensure-Winget {
    if (Get-WingetExe) { return }
    Write-Warn "winget not found - registering App Installer ..."
    try {
        Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction Stop
    } catch { }
    Update-SessionPath
    if (-not (Get-WingetExe)) {
        Start-Process "ms-windows-store://pdp/?productid=9NBLGGH4NNS1"
        throw "winget is missing. Install/update 'App Installer' from the Microsoft Store window that just opened, then run INSTALL-HELM.bat again."
    }
}

function Invoke-Winget([string]$Id, [string]$Label, [string]$Override = "") {
    $winget = Get-WingetExe
    $wingetArgs = @("install", "--id", $Id, "-e", "--scope", "machine", "--silent",
                    "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity")
    if ($Override) { $wingetArgs += @("--override", $Override) }
    Write-Host "    installing $Label ($Id) - this can take a few minutes ..."
    & $winget @wingetArgs | Out-Host
    $code = $LASTEXITCODE
    # 0 = ok, -1978335189 = already installed, -1978335135 = no newer version
    if ($code -eq 0 -or $code -eq -1978335189 -or $code -eq -1978335135) { return $true }
    if ($Override -eq "") {
        # some packages have no machine-scope installer; retry without --scope
        $wingetArgs = $wingetArgs | Where-Object { $_ -ne "--scope" -and $_ -ne "machine" }
        & $winget @wingetArgs | Out-Host
        $code = $LASTEXITCODE
        if ($code -eq 0 -or $code -eq -1978335189 -or $code -eq -1978335135) { return $true }
    }
    Write-Warn "winget returned $code for $Label"
    return $false
}

function Find-Python {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Python312\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe")
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        $exe = & $py.Source -3.12 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $exe -and (Test-Path $exe.Trim())) { return $exe.Trim() }
    }
    return $null
}

function Find-Node {
    $default = Join-Path $env:ProgramFiles "nodejs\node.exe"
    if (Test-Path $default) { return $default }
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $root = Join-Path $env:ProgramFiles "PostgreSQL"
    if (Test-Path $root) {
        $found = Get-ChildItem $root -Directory | Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($found) { return $found }
    }
    return $null
}

function Test-PostgresLogin([string]$Psql, [string]$Password) {
    $env:PGPASSWORD = $Password
    try {
        & $Psql -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1" 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

function Invoke-Checked([string]$What, [scriptblock]$Block) {
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE). See the messages above." }
}

function Get-InteractiveUser {
    # The signed-in desktop user (may differ from the elevated admin account)
    $u = (Get-CimInstance Win32_ComputerSystem).UserName
    if ($u) { return $u }
    return "$env:USERDOMAIN\$env:USERNAME"
}

# ------------------------------------------------------------------ start ----

if (-not (Test-IsAdmin)) { throw "Please run INSTALL-HELM.bat (it asks for Administrator rights)." }

New-Item -ItemType Directory -Force -Path $helmData, $legacyState, (Join-Path $helmData "logs") | Out-Null
Start-Transcript -Path (Join-Path $helmData "setup.log") -Append | Out-Null

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    Helm setup - Freelancer bidding assistant" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "  Project folder: $repoRoot"
Write-Host "  Answer the questions below, then setup runs by itself (10-20 min)."

# ------------------------------------------------------- 1. questions -------

Write-Step "1/8  Settings"

$apiEnvPath = Join-Path $apiDir ".env"
$existing = Read-DotEnv $apiEnvPath
$keepConfig = $false
if ((Test-Path $apiEnvPath) -and -not $Reconfigure -and $existing["DATABASE_URL"]) {
    $answer = Read-Plain "Existing settings found in apps\api\.env. Keep them? (Y/n)" "Y"
    $keepConfig = $answer -notmatch '^[nN]'
}

$psql = Find-Psql
$pgPassword = $null
$adminEmail = $null
$adminPassword = $null
$openaiKey = ""

if ($keepConfig) {
    if ($existing["DATABASE_URL"] -match '^postgresql://postgres:([^@]*)@') {
        $pgPassword = [uri]::UnescapeDataString($Matches[1])
    }
    $adminEmail = $existing["ADMIN_EMAIL"]
    $adminPassword = $existing["ADMIN_PASSWORD"]
    $openaiKey = $existing["OPENAI_API_KEY"]
    Write-Ok "Keeping existing settings."
} else {
    if ($psql) {
        Write-Host "    PostgreSQL is already installed on this PC."
        while ($true) {
            $pgPassword = Read-Secret "    Password of the PostgreSQL 'postgres' user"
            if (Test-PostgresLogin $psql $pgPassword) { Write-Ok "PostgreSQL password works."; break }
            Write-Warn "Could not log in with that password (is the PostgreSQL service running?). Try again."
        }
    } else {
        Write-Host "    PostgreSQL will be installed. Choose a password for its 'postgres' user."
        Write-Host "    (Write it down - you need it to back up or move your data.)" -ForegroundColor DarkGray
        $pgPassword = Read-NewSecret "    New PostgreSQL password (min 8 chars)" 8 '[\s"''&|<>^%]'
    }

    while (-not $adminEmail -or $adminEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
        $adminEmail = Read-Plain "    Helm login email (admin account)"
    }
    $adminPassword = Read-NewSecret "    Helm login password (min 8 chars)" 8
    # Read hidden so the key never lands in the setup log
    $openaiKey = (Read-Secret "    OpenAI API key (starts with sk-; press Enter to skip)").Trim()
    if (-not $openaiKey) { Write-Warn "No OpenAI key - proposals will be placeholder text until you add one to apps\api\.env." }
}

# ------------------------------------------------ 2. install software -------

Write-Step "2/8  Installing software (Python, Node.js, PostgreSQL, Chrome)"
Ensure-Winget

if (-not (Find-Python)) {
    Invoke-Winget "Python.Python.3.12" "Python 3.12" | Out-Null
    Update-SessionPath
}
$python = Find-Python
if (-not $python) { throw "Python 3.12 could not be installed. Install it from https://www.python.org/downloads/ and re-run." }
Write-Ok "Python: $python"

$node = Find-Node
$nodeOk = $false
if ($node) { $nodeOk = ([int]((& $node -v) -replace '^v(\d+).*', '$1')) -ge 20 }
if (-not $nodeOk) {
    Invoke-Winget "OpenJS.NodeJS.LTS" "Node.js LTS" | Out-Null
    Update-SessionPath
    $node = Find-Node
}
if (-not $node) { throw "Node.js could not be installed. Install the LTS version from https://nodejs.org/ and re-run." }
$nodeDir = Split-Path $node -Parent
$npm = Join-Path $nodeDir "npm.cmd"
if (-not ($env:Path -split ';' | Where-Object { $_ -eq $nodeDir })) { $env:Path = "$nodeDir;$env:Path" }
Write-Ok "Node.js: $(& $node -v)"

if (-not $psql) {
    $override = "--mode unattended --unattendedmodeui none --superpassword `"$pgPassword`" --servicepassword `"$pgPassword`" --serverport 5432"
    $installed = $false
    foreach ($id in @("PostgreSQL.PostgreSQL.17", "PostgreSQL.PostgreSQL.16")) {
        if (Invoke-Winget $id "PostgreSQL" $override) { $installed = $true; break }
    }
    Update-SessionPath
    $psql = Find-Psql
    if (-not $installed -or -not $psql) {
        throw "PostgreSQL could not be installed automatically. Install it from https://www.postgresql.org/download/windows/ (remember the password), then re-run."
    }
}
Write-Ok "PostgreSQL: $psql"

$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    Set-Service -Name $pgService.Name -StartupType Automatic
    if ($pgService.Status -ne "Running") { Start-Service $pgService.Name }
    Write-Ok "PostgreSQL service '$($pgService.Name)' runs automatically at boot."
}

$chromePaths = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
    Invoke-Winget "Google.Chrome" "Google Chrome" | Out-Null
    $chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if ($chrome) { Write-Ok "Chrome: $chrome" } else { Write-Warn "Chrome not installed - install it manually for the extension." }

# --------------------------------------------------------- 3. database ------

Write-Step "3/8  Database"
$deadline = (Get-Date).AddSeconds(60)
while (-not (Test-PostgresLogin $psql $pgPassword)) {
    if ((Get-Date) -gt $deadline) { throw "Cannot log in to PostgreSQL as 'postgres'. Check the password and that the service is running." }
    Start-Sleep -Seconds 3
}
& (Join-Path $PSScriptRoot "init-database.ps1") -PostgresPassword $pgPassword
Write-Ok "Database 'bidautomation' ready (tables are created when the API first starts)."

# ------------------------------------------------------- 4. config files ----

Write-Step "4/8  Writing configuration"
$authSecret = if ($keepConfig -and $existing["LOCAL_AUTH_SECRET"] -and $existing["LOCAL_AUTH_SECRET"] -ne "change-this-local-auth-secret") {
    $existing["LOCAL_AUTH_SECRET"]
} else { New-Secret }
$databaseUrl = "postgresql://postgres:$([uri]::EscapeDataString($pgPassword))@localhost:5432/bidautomation"

# DEV_MODE=false turns off the allow-any-website CORS rule, so the sites that
# call the API from the browser are listed explicitly: the dashboard and the
# Freelancer pages where the extension's content scripts run.
$apiEnv = @"
# Generated by Helm setup on $(Get-Date -Format "yyyy-MM-dd HH:mm")
OPENAI_API_KEY=$openaiKey
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,https://www.freelancer.com,https://freelancer.com
DEV_MODE=false
ALLOW_DEV_TOKEN=false
LOCAL_AUTH_SECRET=$authSecret
ADMIN_EMAIL=$adminEmail
ADMIN_PASSWORD=$adminPassword
DATABASE_URL=$databaseUrl
MIGRATE_JSON_ON_STARTUP=false
LOCAL_PERSISTENCE=false
LOCAL_DATA_PATH=data/store.json
"@
Write-TextFile $apiEnvPath $apiEnv

$dashEnvPath = Join-Path $dashboardDir ".env.local"
$dashExisting = Read-DotEnv $dashEnvPath
$dashEnv = @"
# Generated by Helm setup. NEXT_PUBLIC_* values are baked in at build time -
# re-run INSTALL-HELM.bat after changing them.
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_EXTENSION_ID=$($dashExisting["NEXT_PUBLIC_EXTENSION_ID"])
"@
Write-TextFile $dashEnvPath $dashEnv
Write-Ok "apps\api\.env and apps\dashboard\.env.local written."

# ---------------------------------------------------------- 5. backend ------

Write-Step "5/8  API (Python packages)"
& (Join-Path $repoRoot "scripts\stop-local.ps1") | Out-Null   # release locked files on re-run
$venv = Join-Path $apiDir ".venv"
$venvPython = Join-Path $venv "Scripts\python.exe"
if (Test-Path $venvPython) {
    # A venv copied from another PC points at that PC's Python and is broken here
    & $venvPython -c "import sys" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Existing venv is broken (copied from another PC?) - recreating."
        Remove-Item $venv -Recurse -Force
    }
}
if (-not (Test-Path $venvPython)) {
    Invoke-Checked "Creating Python venv" { & $python -m venv $venv }
}
Invoke-Checked "Upgrading pip" { & $venvPython -m pip install --upgrade pip --disable-pip-version-check -q }
Invoke-Checked "Installing API requirements" { & $venvPython -m pip install -r (Join-Path $apiDir "requirements.txt") --disable-pip-version-check -q }
Write-Ok "API packages installed in apps\api\.venv"

# --------------------------------------------------------- 6. frontend ------

Write-Step "6/8  Dashboard + Chrome extension (npm install and build)"
Push-Location $repoRoot
try {
    $env:NEXT_TELEMETRY_DISABLED = "1"
    Invoke-Checked "npm ci" { & $npm ci --no-audit --no-fund }
    Invoke-Checked "Dashboard build" { & $npm run build -w "@bidautomation/dashboard" }
    Invoke-Checked "Extension build" { & $npm run build -w "@bidautomation/extension" }
} finally { Pop-Location }
Write-Ok "Dashboard built (production) and extension built to apps\extension\dist"

# ------------------------------------------------------ 7. auto start -------

Write-Step "7/8  Auto start at sign-in"
# The scheduled task runs as the signed-in user, so let normal users write logs/state.
foreach ($dir in @($helmData, $legacyState)) {
    & icacls $dir /grant "*S-1-5-32-545:(OI)(CI)M" /T /Q | Out-Null   # BUILTIN\Users: modify
}

foreach ($old in @("BidAutomation Auto Start", $taskName)) {
    if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $old -Confirm:$false
    }
}

$runScript = Join-Path $repoRoot "scripts\run-helm.ps1"
$user = Get-InteractiveUser
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runScript`" -Supervise -NoBrowser" `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = "PT20S"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description "Starts the Helm API + dashboard at sign-in and restarts them if they stop." | Out-Null
Write-Ok "Task '$taskName' registered for $user (starts 20 s after sign-in)."

# Desktop shortcuts
$desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shell = New-Object -ComObject WScript.Shell
$links = @(
    # Start = run the supervised task (same as at sign-in); ignored if already running
    @{ Name = "Start Helm"; Target = "schtasks.exe";   Args = "/Run /TN `"$taskName`"";  Icon = "shell32.dll,137" },
    @{ Name = "Stop Helm";  Target = "powershell.exe"; Args = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $repoRoot 'scripts\stop-local.ps1')`""; Icon = "shell32.dll,131" }
)
foreach ($l in $links) {
    $s = $shell.CreateShortcut((Join-Path $desktop "$($l.Name).lnk"))
    $s.TargetPath = $l.Target; $s.Arguments = $l.Args; $s.WorkingDirectory = $repoRoot
    $s.IconLocation = $l.Icon
    $s.Save()
}
foreach ($old in @("Restart Helm.lnk")) { Remove-Item (Join-Path $desktop $old) -ErrorAction SilentlyContinue }
$urlFile = Join-Path $desktop "Helm Dashboard.url"
Write-TextFile $urlFile "[InternetShortcut]`r`nURL=http://localhost:3001/"
Write-Ok "Desktop shortcuts: Helm Dashboard, Start Helm, Stop Helm"

# ------------------------------------------------------------ 8. start ------

Write-Step "8/8  Starting Helm"
Start-ScheduledTask -TaskName $taskName
$ready = $false
$deadline = (Get-Date).AddSeconds(240)
while ((Get-Date) -lt $deadline) {
    try {
        $h = Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5
        $d = Invoke-WebRequest "http://127.0.0.1:3001/login" -UseBasicParsing -TimeoutSec 5
        if ($h.StatusCode -eq 200 -and $d.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 3 }
}
if ($ready) {
    $health = (Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing).Content | ConvertFrom-Json
    Write-Ok "API running (storage: $($health.storage), AI key set: $($health.ai_configured))"
    Write-Ok "Dashboard running at http://localhost:3001"
} else {
    Write-Warn "Helm did not answer within 4 minutes. Check the logs in $helmData\logs"
}

$extDist = Join-Path $extensionDir "dist"
if ($chrome) {
    Start-Process $chrome -ArgumentList @("http://localhost:3001/login", "chrome://extensions/")
}
Start-Process explorer.exe $extDist

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "    Helm is installed." -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Sign in:  http://localhost:3001   ($adminEmail)"
Write-Host ""
Write-Host "  Last manual step - load the Chrome extension (Chrome does not allow scripts to do this):"
Write-Host "    1. In the chrome://extensions tab, turn on 'Developer mode' (top right)."
Write-Host "    2. Click 'Load unpacked' and choose:  $extDist"
Write-Host "    3. In the dashboard, open 'Connect extension' and click Connect."
Write-Host ""
Write-Host "  Helm now starts by itself every time you sign in to Windows."
Write-Host "  Logs: $helmData\logs      Setup log: $helmData\setup.log"
Write-Host ""

Stop-Transcript | Out-Null
