@echo off
title KeyVibe Desktop App - Builder
echo ========================================================
echo   Building KeyVibe Windows Native Application
echo ========================================================
cd /d "%~dp0"

REM Ensure cargo is in PATH
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

echo.
echo Running production build...
npm run tauri:build

echo.
if exist "src-tauri\target\release\keyvibe.exe" (
    echo [SUCCESS] Windows binary created at: src-tauri\target\release\keyvibe.exe
)
if exist "src-tauri\target\release\bundle" (
    echo [SUCCESS] Installers created in: src-tauri\target\release\bundle\
)
echo.
pause
