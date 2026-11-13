#Requires -Version 5.1
<#
  Runs Helm in production mode (API + built dashboard) and keeps it running.

  Used by the "Helm Auto Start" scheduled task created by INSTALL-HELM.bat.
  - Waits for PostgreSQL to accept connections (it may still be booting).
  - Starts the API (uvicorn, apps\api\.venv) on 127.0.0.1:8000.
  - Starts the dashboard (next start) on port 3001.
  - With -Supervise, stays running and restarts either process if it dies.

  Logs: %ProgramData%\Helm\logs\
  Stop: scripts\stop-local.ps1 (also stops this supervisor).
#>
param(
    [switch]$Supervise,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $repoRoot "apps\api"
$dashboardDir = Join-Path $repoRoot "apps\dashboard"
$stateDir = Join-Path $env:ProgramData "BidAutomation"
$pidFile = Join-Path $stateDir "dev-processes.json"
$logDir = Join-Path $env:ProgramData "Helm\logs"

$ApiPort = 8000
$DashboardPort = 3001

foreach ($dir in @($stateDir, $logDir)) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path (Join-Path $logDir "run-helm.log") -Value $line -Encoding UTF8
    Write-Host $Message
}

function Test-PortInUse([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-PythonExe {
    $venvPython = Join-Path $apiDir ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) { return $venvPython }
    throw "Python venv missing ($venvPython). Run INSTALL-HELM.bat again."
}

function Get-NpmCmd {
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $default = Join-Path $env:ProgramFiles "nodejs\npm.cmd"
    if (Test-Path $default) { return $default }
    throw "npm not found. Run INSTALL-HELM.bat again."
}

function Wait-Postgres([int]$TimeoutSec = 180) {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($service -and $service.Status -ne "Running") {
        Write-Log "Starting PostgreSQL service $($service.Name) ..."
        try { Start-Service $service.Name -ErrorAction Stop } catch { Write-Log "Could not start PostgreSQL: $($_.Exception.Message)" }
    }
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object Net.Sockets.TcpClient
        try {
            $client.Connect("127.0.0.1", 5432)
            if ($client.Connected) { return $true }
        } catch { Start-Sleep -Seconds 2 }
        finally { $client.Dispose() }
    }
    return $false
}

function Start-Api {
    if (Test-PortInUse $ApiPort) { return $null }
    $python = Get-PythonExe
    Write-Log "Starting API on http://127.0.0.1:$ApiPort ..."
    return Start-Process -FilePath $python `
        -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$ApiPort") `
        -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir "api.out.log") `
        -RedirectStandardError (Join-Path $logDir "api.err.log")
}

function Start-Dashboard {
    if (Test-PortInUse $DashboardPort) { return $null }
    if (-not (Test-Path (Join-Path $dashboardDir ".next\BUILD_ID"))) {
        throw "Dashboard is not built (.next\BUILD_ID missing). Run INSTALL-HELM.bat again."
    }
    $npm = Get-NpmCmd
    Write-Log "Starting dashboard on http://localhost:$DashboardPort ..."
    return Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", "`"$npm`" run start") `
        -WorkingDirectory $dashboardDir -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDir "dashboard.out.log") `
        -RedirectStandardError (Join-Path $logDir "dashboard.err.log")
}

function Save-State($apiProc, $dashProc) {
    $previous = $null
    if (Test-Path $pidFile) {
        try { $previous = Get-Content $pidFile -Raw | ConvertFrom-Json } catch { $previous = $null }
    }
    @{
        api_pid        = if ($apiProc) { $apiProc.Id } elseif ($previous) { $previous.api_pid } else { $null }
        dashboard_pid  = if ($dashProc) { $dashProc.Id } elseif ($previous) { $previous.dashboard_pid } else { $null }
        supervisor_pid = if ($Supervise) { $PID } else { $null }
        started_at     = (Get-Date).ToString("o")
    } | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8
}

function Wait-Url([string]$Url, [int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

Write-Log "---- Helm starting (supervise=$Supervise) ----"

if (-not (Test-Path (Join-Path $apiDir ".env"))) {
    Write-Log "apps\api\.env missing - run INSTALL-HELM.bat first."
    exit 1
}

if (-not (Wait-Postgres)) {
    Write-Log "PostgreSQL is not reachable on port 5432 - starting anyway; the API will retry on restart."
}

$apiProc = Start-Api
$dashProc = Start-Dashboard
Save-State $apiProc $dashProc

$apiOk = Wait-Url "http://127.0.0.1:$ApiPort/health" 90
$dashOk = Wait-Url "http://127.0.0.1:$DashboardPort/login" 120
Write-Log ("API ready: {0}   Dashboard ready: {1}" -f $apiOk, $dashOk)

if (-not $NoBrowser -and $dashOk) {
    Start-Process "http://localhost:$DashboardPort"
}

if (-not $Supervise) { exit 0 }

# Supervisor loop: restart anything that stopped listening.
$failures = @{ api = 0; dashboard = 0 }
while ($true) {
    Start-Sleep -Seconds 30
    try {
        if (-not (Test-PortInUse $ApiPort)) {
            $failures.api++
            Write-Log "API is down (restart #$($failures.api)) - restarting."
            Wait-Postgres 60 | Out-Null
            $apiProc = Start-Api
            Save-State $apiProc $null
        }
        if (-not (Test-PortInUse $DashboardPort)) {
            $failures.dashboard++
            Write-Log "Dashboard is down (restart #$($failures.dashboard)) - restarting."
            $dashProc = Start-Dashboard
            Save-State $null $dashProc
        }
    } catch {
        Write-Log "Supervisor error: $($_.Exception.Message)"
    }
}
