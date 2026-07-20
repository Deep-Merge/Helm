#Requires -Version 5.1
$ErrorActionPreference = "SilentlyContinue"

$pidFile = Join-Path $env:ProgramData "Helm\processes.json"

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

if (Test-Path $pidFile) {
    $state = Get-Content $pidFile -Raw | ConvertFrom-Json
    foreach ($name in @("api_pid", "dashboard_pid")) {
        $id = $state.$name
        if ($id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item $pidFile -Force
}

Stop-Port 8000
Stop-Port 3001

Write-Host "Helm stopped." -ForegroundColor Green
