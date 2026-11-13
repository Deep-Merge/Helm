#Requires -Version 5.1
$ErrorActionPreference = "SilentlyContinue"

$stateDir = Join-Path $env:ProgramData "BidAutomation"
$pidFile = Join-Path $stateDir "dev-processes.json"

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

if (Test-Path $pidFile) {
    $state = Get-Content $pidFile -Raw | ConvertFrom-Json
    # Stop the supervisor first so it does not restart what we stop below.
    foreach ($name in @("supervisor_pid", "api_pid", "dashboard_pid")) {
        $id = $state.$name
        if ($id) {
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Stop-Port 8000
Stop-Port 3001

Write-Host "BidAutomation stopped." -ForegroundColor Green
