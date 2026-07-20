@echo off
setlocal
title Helm - Install prerequisites (Node.js + PostgreSQL)

:: Request admin (re-launch elevated if needed)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo.
echo  Helm - Install prerequisites
echo  ===========================
echo  - Node.js 20 LTS  (dashboard)
echo  - PostgreSQL 16+  (database: bidautomation)
echo.

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0install-prerequisites.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
pause
exit /b %EXITCODE%
