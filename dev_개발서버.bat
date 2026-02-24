@echo off
cd /d "%~dp0"
title Local Dev Server

echo ============================================
echo   Local Dev Server
echo ============================================
echo.
echo   http://localhost:3100
echo   Stop: Ctrl+C
echo.
echo ============================================
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found! Install Node.js first.
    echo https://nodejs.org/
    pause
    exit /b 1
)

call npm run dev

echo.
echo [Server stopped]
pause
