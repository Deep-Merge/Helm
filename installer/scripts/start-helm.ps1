#Requires -Version 5.1
param(
    [string]$InstallRoot = (Split-Path $PSScriptRoot -Parent),
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$DashboardPort = 3001

& (Join-Path $PSScriptRoot "check-prerequisites.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

$apiDir = Join-Path $InstallRoot "api"
$dashboardDir = Join-Path $InstallRoot "dashboard"
$stateDir = Join-Path $env:ProgramData "Helm"
$pidFile = Join-Path $stateDir "processes.json"

if (-not (Test-Path (Join-Path $apiDir ".env"))) {
    Write-Host "Helm is not configured. Run Configure Helm from the Start Menu first." -ForegroundColor Red
    exit 1
}

$python = Join-Path $apiDir "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $pyCmd = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCmd) { $python = "py" } else { throw "Python not found and bundled venv missing." }
}

if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }

function Test-PortInUse([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (Test-PortInUse 8000) {
    Write-Host "Port 8000 already in use (API may already be running)." -ForegroundColor Yellow
} else {
    Write-Host "Starting API on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
    $apiArgs = if ($python -eq "py") {
        @("-3", "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000")
    } else {
        @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000")
    }
    $apiProc = Start-Process -FilePath $python -ArgumentList $apiArgs `
        -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru
}

if (Test-PortInUse $DashboardPort) {
    Write-Host "Port $DashboardPort already in use (dashboard may already be running)." -ForegroundColor Yellow
} else {
    Write-Host "Starting dashboard on http://127.0.0.1:$DashboardPort ..." -ForegroundColor Cyan
    $dashProc = Start-Process -FilePath "cmd.exe" -ArgumentList @(
        "/c", "npm run start -- -p $DashboardPort -H 127.0.0.1"
    ) -WorkingDirectory $dashboardDir -WindowStyle Hidden -PassThru
}

$deadline = (Get-Date).AddSeconds(45)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}

if (-not $healthy) {
    Write-Host "API did not become ready in time. Check $apiDir\.env and PostgreSQL." -ForegroundColor Red
    exit 1
}

$deadline = (Get-Date).AddSeconds(60)
$dashReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$DashboardPort" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $dashReady = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}

@{
    api_pid = if ($apiProc) { $apiProc.Id } else { $null }
    dashboard_pid = if ($dashProc) { $dashProc.Id } else { $null }
    started_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Helm is running." -ForegroundColor Green
Write-Host "  Dashboard: http://localhost:$DashboardPort"
Write-Host "  API:       http://127.0.0.1:8000/health"
Write-Host ""

if (-not $NoBrowser) {
    Start-Process "http://localhost:$DashboardPort"
}
