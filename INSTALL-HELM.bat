@echo off
setlocal
title Helm setup

:: ------------------------------------------------------------------
::  Helm - one-click setup for a new Windows PC.
::  Double-click this file. It asks for Administrator rights, installs
::  everything Helm needs, configures it, and makes it start at sign-in.
::  Safe to run again (e.g. after pulling updates) - it rebuilds and keeps
::  your settings.
:: ------------------------------------------------------------------

:: Re-launch as Administrator if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator rights...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\scripts\setup-new-pc.ps1" %*
set RESULT=%errorlevel%

echo.
if %RESULT% neq 0 (
    echo Setup stopped with an error. Read the red message above,
    echo fix it, then run INSTALL-HELM.bat again. Log: %ProgramData%\Helm\setup.log
) else (
    echo Setup finished.
)
echo.
pause
exit /b %RESULT%
