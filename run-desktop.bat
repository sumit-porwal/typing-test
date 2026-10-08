@echo off
title KeyVibe Desktop App
echo ========================================================
echo   Launching KeyVibe Desktop Studio
echo ========================================================
cd /d "%~dp0"

REM Ensure cargo is in PATH
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

REM Launch desktop app in development/live mode
npm run tauri:dev
