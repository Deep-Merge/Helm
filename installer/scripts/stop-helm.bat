@echo off
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0stop-helm.ps1"
exit /b %ERRORLEVEL%
