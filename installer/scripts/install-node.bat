@echo off
setlocal
title Helm - Install Node.js

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0install-prerequisites.ps1" -SkipPostgres
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
