@echo off
setlocal
cd /d "%~dp0"
title Police Local Server

echo ============================================
echo   Police Local Server
echo ============================================
echo.

if not exist package.json (
    echo [ERROR] package.json not found: %CD%
    goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found in PATH. Install Node.js first.
    goto :fail
)

if not exist node_modules (
    echo [ERROR] node_modules not found.
    echo Run "npm install" in this folder first.
    goto :fail
)

echo [INFO] Starting local server...
echo [INFO] URL: http://localhost:3100
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Local server exited with an error.
    goto :fail
)

exit /b 0

:fail
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
