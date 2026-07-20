#Requires -Version 5.1
$ErrorActionPreference = "SilentlyContinue"

$taskName = "BidAutomation Auto Start"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Removed startup task: $taskName" -ForegroundColor Green
