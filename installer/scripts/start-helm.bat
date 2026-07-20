@echo off
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-helm.ps1" -InstallRoot "%~dp0.."
exit /b %ERRORLEVEL%
