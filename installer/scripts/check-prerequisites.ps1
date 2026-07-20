#Requires -Version 5.1
$ErrorActionPreference = "Stop"

function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    )
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

$missing = @()

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $missing += "Node.js 20+ (https://nodejs.org/)"
} else {
    $nodeMajor = [int]((node -v) -replace "^v(\d+).*", '$1')
    if ($nodeMajor -lt 20) {
        $missing += "Node.js 20 or newer (found $(node -v))"
    }
}

if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $PSScriptRoot "..\api\venv\Scripts\python.exe"))) {
    $missing += "Python 3.11+ (https://www.python.org/downloads/) - or reinstall Helm to restore bundled venv"
}

$psql = Find-Psql
if (-not $psql) {
    $missing += "PostgreSQL 14+ with psql (https://www.postgresql.org/download/windows/)"
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Helm - missing prerequisites:" -ForegroundColor Red
    foreach ($item in $missing) { Write-Host "  - $item" }
    Write-Host ""
    Write-Host "Run: scripts\install-prerequisites.bat  (installs Node.js + PostgreSQL)" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "Prerequisites OK." -ForegroundColor Green
exit 0
