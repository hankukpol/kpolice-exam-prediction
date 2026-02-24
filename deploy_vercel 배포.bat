@echo off
title Vercel Deploy

echo ============================================
echo   Vercel Production Deploy
echo ============================================
echo.

echo [1/3] Type check...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Type check failed!
    pause
    exit /b 1
)
echo [1/3] Type check OK

echo.
echo [2/3] Building...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo [2/3] Build OK

echo.
echo [3/3] Deploying to Vercel...
call npx vercel --prod --yes
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deploy failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Deploy complete!
echo   https://police-sandy.vercel.app
echo ============================================
echo.
pause
