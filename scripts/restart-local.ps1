#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$scriptsDir = $PSScriptRoot

Write-Host "Stopping BidAutomation..." -ForegroundColor Cyan
& "$scriptsDir\stop-local.ps1"

Start-Sleep -Seconds 1

Write-Host "Starting BidAutomation..." -ForegroundColor Cyan
& "$scriptsDir\start-local.ps1"
