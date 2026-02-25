@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Git + Vercel Deploy

echo ============================================
echo   Git Push + Vercel Deploy
echo ============================================
echo.

set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" (
    for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "NOW=%%t"
    set "COMMIT_MSG=auto deploy !NOW!"
)

echo [Changed files]
echo ----------------------------------------
git status --short
echo ----------------------------------------
echo.

echo [1/5] Type check...
call npx tsc --noEmit
if errorlevel 1 (
    echo.
    echo [ERROR] Type check failed!
    exit /b 1
)
echo [1/5] Type check OK

echo.
echo [2/5] Staging files...
git add -A
if errorlevel 1 (
    echo.
    echo [ERROR] git add failed!
    exit /b 1
)
echo [2/5] Staged

git diff --cached --quiet
if errorlevel 1 (
    set "HAS_STAGED_CHANGES=1"
) else (
    set "HAS_STAGED_CHANGES=0"
)

if "!HAS_STAGED_CHANGES!"=="1" (
    echo.
    echo [3/5] Committing...
    git commit -m "!COMMIT_MSG!"
    if errorlevel 1 (
        echo.
        echo [ERROR] Commit failed!
        exit /b 1
    )
    echo [3/5] Committed

    echo.
    for /f %%b in ('git branch --show-current') do set "BRANCH=%%b"
    if not defined BRANCH set "BRANCH=master"
    echo [4/5] Pushing to GitHub... (!BRANCH!)
    call :push_with_retry "!BRANCH!"
    if errorlevel 1 (
        echo.
        echo [ERROR] Push failed after retries.
        exit /b 1
    )
    echo [4/5] Pushed
) else (
    echo.
    echo [3/5] No staged changes. Skipping commit/push.
)

echo.
echo [5/5] Deploying to Vercel...
call :deploy_with_retry
if errorlevel 1 (
    echo.
    echo [ERROR] Deploy failed after retries.
    exit /b 1
)
echo [5/5] Deployed

echo.
echo ============================================
echo   All done!
echo.
echo   GitHub : https://github.com/hankukpol/kpolice-exam-prediction
echo   Vercel : https://police-sandy.vercel.app
echo ============================================
echo.
exit /b 0

:push_with_retry
set "TARGET_BRANCH=%~1"
set "MAX_RETRY=3"
set "RETRY=1"
:push_retry
git push origin "%TARGET_BRANCH%"
if not errorlevel 1 exit /b 0
if !RETRY! geq !MAX_RETRY! exit /b 1
echo [WARN] Push failed. Retrying in 10 seconds... (!RETRY!/^!MAX_RETRY^!)
timeout /t 10 /nobreak >nul
set /a RETRY+=1
goto :push_retry

:deploy_with_retry
set "MAX_RETRY=3"
set "RETRY=1"
:deploy_retry
echo [INFO] Vercel deploy try !RETRY!/!MAX_RETRY!
call npx --yes vercel --prod --yes
if not errorlevel 1 exit /b 0
if !RETRY! geq !MAX_RETRY! exit /b 1
echo [WARN] Deploy failed. Retrying in 10 seconds...
timeout /t 10 /nobreak >nul
set /a RETRY+=1
goto :deploy_retry
