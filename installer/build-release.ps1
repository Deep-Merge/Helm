#Requires -Version 5.1
<#
  Builds installer/dist — run from repo root:
    powershell -ExecutionPolicy Bypass -File installer/build-release.ps1

  Then compile the setup (requires Inno Setup 6):
    ISCC installer\HelmSetup.iss
#>
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$DistRoot = Join-Path $PSScriptRoot "dist"
$ApiSrc = Join-Path $RepoRoot "apps\api"
$DashSrc = Join-Path $RepoRoot "apps\dashboard"

Write-Host "Helm release build" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required on the build machine."
}
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python (py launcher) is required on the build machine."
}

if (Test-Path $DistRoot) {
    Write-Host "Cleaning $DistRoot …"
    Remove-Item $DistRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $DistRoot -Force | Out-Null

# --- API ---
Write-Host "Copying API …"
$ApiDest = Join-Path $DistRoot "api"
New-Item -ItemType Directory -Path $ApiDest -Force | Out-Null

$apiExclude = @("__pycache__", ".env", "data", "venv", ".venv")
Get-ChildItem $ApiSrc -Force | Where-Object {
    $apiExclude -notcontains $_.Name
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $ApiDest -Recurse -Force
}

Write-Host "Creating API venv and installing dependencies …"
py -3 -m venv (Join-Path $ApiDest "venv")
& (Join-Path $ApiDest "venv\Scripts\python.exe") -m pip install --upgrade pip -q
& (Join-Path $ApiDest "venv\Scripts\pip.exe") install -r (Join-Path $ApiDest "requirements.txt") -q

Copy-Item (Join-Path $ApiSrc ".env.example") (Join-Path $ApiDest ".env.example") -Force

# --- Dashboard ---
Write-Host "Building dashboard (production) …"
Push-Location $DashSrc
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Dashboard build failed." }
npm prune --omit=dev
Pop-Location

Write-Host "Copying dashboard …"
$DashDest = Join-Path $DistRoot "dashboard"
New-Item -ItemType Directory -Path $DashDest -Force | Out-Null

$dashInclude = @(
    ".next", "node_modules", "package.json", "package-lock.json",
    "next.config.ts", "public", "postcss.config.mjs"
)
foreach ($item in $dashInclude) {
    $src = Join-Path $DashSrc $item
    if (Test-Path $src) {
        Copy-Item $src -Destination $DashDest -Recurse -Force
    }
}

# --- Scripts ---
Write-Host "Copying installer scripts …"
Copy-Item (Join-Path $PSScriptRoot "scripts") (Join-Path $DistRoot "scripts") -Recurse -Force

# --- Readme ---
@'
Helm — local install
====================

After setup:
  1. Start Menu → Start Helm  (opens http://localhost:3001)
  2. Load the Chrome extension manually (see docs)

Database: PostgreSQL database name "bidautomation" on localhost:5432.
Schema is applied automatically when the API starts.

Prerequisites (install if missing):
  - Start Menu → Install prerequisites
  - Or run scripts\install-prerequisites.bat (Node.js + PostgreSQL via winget)
  - scripts\install-node.bat / install-postgres.bat for individual installs

Support: re-run "Configure Helm" from Start Menu to reset .env files.
'@ | Set-Content (Join-Path $DistRoot "README.txt") -Encoding UTF8

Write-Host ""
Write-Host "Release ready: $DistRoot" -ForegroundColor Green
Write-Host "Next: install Inno Setup 6, then run:" -ForegroundColor Cyan
Write-Host "  ISCC installer\HelmSetup.iss"
Write-Host ""
