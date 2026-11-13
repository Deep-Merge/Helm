#Requires -Version 5.1
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $repoRoot "apps\api"
$dashboardDir = Join-Path $repoRoot "apps\dashboard"
$stateDir = Join-Path $env:ProgramData "BidAutomation"
$pidFile = Join-Path $stateDir "dev-processes.json"

if (-not (Test-Path $apiDir)) { throw "API directory not found: $apiDir" }
if (-not (Test-Path $dashboardDir)) { throw "Dashboard directory not found: $dashboardDir" }

if (-not (Test-Path $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
}

function Test-PortInUse([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

$apiProc = $null
$dashProc = $null

if (Test-PortInUse 8000) {
    Write-Host "Port 8000 already in use. API looks already running." -ForegroundColor Yellow
} else {
    Write-Host "Starting API on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
    $apiProc = Start-Process -FilePath "py" -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000") -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru
}

if (Test-PortInUse 3001) {
    Write-Host "Port 3001 already in use. Dashboard looks already running." -ForegroundColor Yellow
} else {
    Write-Host "Starting dashboard on http://localhost:3001 ..." -ForegroundColor Cyan
    $dashProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "npx.cmd next dev --port 3001 --webpack") -WorkingDirectory $dashboardDir -WindowStyle Hidden -PassThru
}

@{
    api_pid = if ($apiProc) { $apiProc.Id } else { $null }
    dashboard_pid = if ($dashProc) { $dashProc.Id } else { $null }
    started_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "BidAutomation is running." -ForegroundColor Green
Write-Host "  Dashboard: http://localhost:3001"
Write-Host "  API:       http://127.0.0.1:8000/health"

if (-not $NoBrowser) {
    Start-Process "http://localhost:3001"
}
