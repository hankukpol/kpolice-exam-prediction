@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Vercel Deploy

echo ============================================
echo   Vercel Production Deploy
echo ============================================
echo.

echo [1/2] Type check...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Type check failed!
    exit /b 1
)
echo [1/2] Type check OK

echo.
set MAX_RETRY=3
set RETRY=1

:DEPLOY_RETRY
echo [2/2] Deploying to Vercel... (try !RETRY!/!MAX_RETRY!)
call npx --yes vercel --prod --yes
if !errorlevel! equ 0 goto DEPLOY_OK

if !RETRY! geq !MAX_RETRY! (
    echo.
    echo [ERROR] Deploy failed after !MAX_RETRY! attempts!
    exit /b 1
)

echo.
echo [WARN] Deploy failed. Retrying in 10 seconds...
timeout /t 10 /nobreak >nul
set /a RETRY+=1
goto DEPLOY_RETRY

:DEPLOY_OK
echo [2/2] Deployed

echo.
echo ============================================
echo   Deploy complete!
echo   https://police-sandy.vercel.app
echo ============================================
echo.
exit /b 0
