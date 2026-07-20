#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$PostgresPassword,

    [string]$PostgresUser = "postgres",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432,
    [string]$DatabaseName = "bidautomation"
)

$ErrorActionPreference = "Stop"

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
    throw "psql not found. Install PostgreSQL first."
}

$psql = Find-Psql
$env:PGPASSWORD = $PostgresPassword

Write-Host "Checking PostgreSQL connection..." -ForegroundColor Cyan
& $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -c "SELECT 1" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to PostgreSQL. Check that the service is running and the password is correct."
}

$exists = & $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName'"

if ($exists -match "1") {
    Write-Host "Database '$DatabaseName' already exists." -ForegroundColor Yellow
} else {
    Write-Host "Creating database '$DatabaseName'..." -ForegroundColor Cyan
    & $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -c `
        "CREATE DATABASE $DatabaseName ENCODING 'UTF8'"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create database '$DatabaseName'." }
    Write-Host "Database '$DatabaseName' created." -ForegroundColor Green
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
