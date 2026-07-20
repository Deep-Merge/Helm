#Requires -Version 5.1
<#
  Installs Helm prerequisites on Windows: Node.js LTS and PostgreSQL.

  Uses winget when available; falls back to opening official download pages.

  Run as Administrator (recommended):
    powershell -ExecutionPolicy Bypass -File install-prerequisites.ps1

  Options:
    -SkipNode      Do not install Node.js
    -SkipPostgres  Do not install PostgreSQL
    -Force         Re-run installers even if already detected
#>
param(
    [switch]$SkipNode,
    [switch]$SkipPostgres,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $roots = @("${env:ProgramFiles}\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL")
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($found) { return $found }
    }
    return $null
}

function Test-NodeOk {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return $false }
    $major = [int]((node -v) -replace "^v(\d+).*", '$1')
    return $major -ge 20
}

function Get-WingetExe {
    $cmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $stub = Join-Path ${env:ProgramFiles} "WindowsApps\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\winget.exe"
    if (Test-Path $stub) { return $stub }
    return $null
}

function Get-ChocoExe {
    $cmd = Get-Command choco -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Invoke-WingetInstall {
    param(
        [string]$Id,
        [string]$Label,
        [switch]$Interactive
    )
    $winget = Get-WingetExe
    if (-not $winget) { return $false }

    Write-Host ""
    Write-Host "Installing $Label via winget ($Id) ..." -ForegroundColor Cyan

    $wingetArgs = @(
        "install", "--id", $Id,
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements"
    )
    if ($Interactive) {
        $wingetArgs += "--interactive"
    } else {
        $wingetArgs += "--silent"
    }

    & $winget @wingetArgs
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        # -1978335189 = already installed (winget)
        Write-Host "winget install returned exit code $LASTEXITCODE" -ForegroundColor Yellow
        return $false
    }
    return $true
}

function Invoke-ChocoInstall {
    param([string]$Package, [string]$Label)
    $choco = Get-ChocoExe
    if (-not $choco) { return $false }

    Write-Host ""
    Write-Host "Installing $Label via Chocolatey ($Package) ..." -ForegroundColor Cyan
    & $choco install $Package -y
    return ($LASTEXITCODE -eq 0)
}

function Open-DownloadPage {
    param([string]$Url, [string]$Label)
    Write-Host "Opening $Label download page ..." -ForegroundColor Yellow
    Start-Process $Url
}

function Ensure-Node {
    Refresh-Path
    if (-not $Force -and (Test-NodeOk)) {
        Write-Host "Node.js OK: $(node -v)" -ForegroundColor Green
        return
    }

    $installed = $false
    if (Invoke-WingetInstall -Id "OpenJS.NodeJS.LTS" -Label "Node.js LTS") {
        $installed = $true
    } elseif (Invoke-ChocoInstall -Package "nodejs-lts" -Label "Node.js LTS") {
        $installed = $true
    } else {
        Open-DownloadPage "https://nodejs.org/en/download" "Node.js"
        Write-Host "Install Node.js 20 LTS manually, then re-run this script." -ForegroundColor Yellow
        return
    }

    if ($installed) {
        Refresh-Path
        if (Test-NodeOk) {
            Write-Host "Node.js installed: $(node -v)" -ForegroundColor Green
        } else {
            Write-Host "Node installed - open a new terminal or log out/in, then verify: node -v" -ForegroundColor Yellow
        }
    }
}

function Ensure-PostgresService {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($service -and $service.Status -ne "Running") {
        Write-Host "Starting PostgreSQL service ($($service.Name)) ..." -ForegroundColor Cyan
        Start-Service $service.Name
    }
}

function Ensure-Postgres {
    Refresh-Path
    if (-not $Force -and (Find-Psql)) {
        Write-Host "PostgreSQL OK: $(Find-Psql)" -ForegroundColor Green
        Ensure-PostgresService
        return
    }

    $installed = $false
    # Interactive - user must set postgres password in the installer GUI
    $pgIds = @(
        "PostgreSQL.PostgreSQL.17",
        "PostgreSQL.PostgreSQL.16",
        "PostgreSQL.PostgreSQL"
    )
    foreach ($id in $pgIds) {
        if (Invoke-WingetInstall -Id $id -Label "PostgreSQL" -Interactive) {
            $installed = $true
            break
        }
    }

    if (-not $installed) {
        if (Invoke-ChocoInstall -Package "postgresql16" -Label "PostgreSQL 16") {
            $installed = $true
        }
    }

    if (-not $installed) {
        Open-DownloadPage "https://www.postgresql.org/download/windows/" "PostgreSQL"
        Write-Host ""
        Write-Host "Install PostgreSQL manually:" -ForegroundColor Yellow
        Write-Host "  - Remember the password for user postgres (needed during Helm setup)" -ForegroundColor Yellow
        Write-Host "  - Default port 5432 is fine" -ForegroundColor Yellow
        Write-Host "  - Database bidautomation is created later by Helm Configure" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    Refresh-Path
    Start-Sleep -Seconds 3
    Ensure-PostgresService

    if (Find-Psql) {
        Write-Host "PostgreSQL installed: $(Find-Psql)" -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL installed - open a new terminal if psql is not found yet." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Helm - install prerequisites" -ForegroundColor Cyan
Write-Host "  Node.js 20+ (dashboard)  PostgreSQL 14+ (database: bidautomation)" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-IsAdmin)) {
    Write-Host "Tip: run as Administrator for system-wide installs (right-click -> Run as administrator)." -ForegroundColor Yellow
    Write-Host ""
}

if (-not $SkipNode) { Ensure-Node }
if (-not $SkipPostgres) { Ensure-Postgres }

Write-Host ""
Write-Host "Checking ..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "check-prerequisites.ps1")
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host ""
    Write-Host "All prerequisites ready. Next: run HelmSetup.exe or Configure Helm." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Some prerequisites are still missing. Complete manual installs if prompted, then re-run this script." -ForegroundColor Yellow
}

exit $code
