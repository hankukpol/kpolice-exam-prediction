@echo off
cd /d "%~dp0"
title Git + Vercel Deploy

echo ============================================
echo   Git Push + Vercel Deploy
echo ============================================
echo.

echo [Changed files]
echo ----------------------------------------
git status --short
echo ----------------------------------------
echo.

set /p COMMIT_MSG=Commit message:

if "%COMMIT_MSG%"=="" (
    echo.
    echo [ERROR] Please enter a commit message.
    pause
    exit /b 1
)

echo.
echo [1/5] Type check...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Type check failed!
    pause
    exit /b 1
)
echo [1/5] Type check OK

echo.
echo [2/5] Staging files...
git add -A
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] git add failed!
    pause
    exit /b 1
)
echo [2/5] Staged

echo.
echo [3/5] Committing...
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Commit failed!
    pause
    exit /b 1
)
echo [3/5] Committed

echo.
echo [4/5] Pushing to GitHub...
git push origin master
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! Check network.
    pause
    exit /b 1
)
echo [4/5] Pushed

echo.
echo [5/5] Deploying to Vercel...
call npx vercel --prod --yes
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deploy failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   All done!
echo.
echo   GitHub : https://github.com/hankukpol/kpolice-exam-prediction
echo   Vercel : https://police-sandy.vercel.app
echo ============================================
echo.
pause
