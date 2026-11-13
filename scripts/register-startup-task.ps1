#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$taskName = "BidAutomation Auto Start"
$repoRoot = Split-Path $PSScriptRoot -Parent
$startScript = Join-Path $repoRoot "scripts\start-local.ps1"

if (-not (Test-Path $startScript)) {
    throw "Start script not found: $startScript"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`" -NoBrowser"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Enable-ScheduledTask -TaskName $taskName | Out-Null
Write-Host "Registered startup task: $taskName" -ForegroundColor Green
Write-Host "It will start API + dashboard when you sign in to Windows."
