@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title One-File Auto Deploy

echo ============================================
echo   One-File Auto Deploy
echo ============================================
echo.
echo Usage:
echo   %~nx0
echo   %~nx0 [migration_name] [commit_message]
echo   %~nx0 --skip-migrate [commit_message]
echo   %~nx0 --force-migrate [migration_name] [commit_message]
echo.

set "SKIP_MIGRATE=0"
set "FORCE_MIGRATE=0"
set "MIGRATION_NAME="
set "COMMIT_MSG="

if /I "%~1"=="--skip-migrate" (
    set "SKIP_MIGRATE=1"
    set "COMMIT_MSG=%~2"
) else if /I "%~1"=="--force-migrate" (
    set "FORCE_MIGRATE=1"
    set "MIGRATION_NAME=%~2"
    set "COMMIT_MSG=%~3"
) else (
    set "MIGRATION_NAME=%~1"
    set "COMMIT_MSG=%~2"
)

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git not found in PATH.
    goto :fail
)

where npx >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npx not found in PATH. Install Node.js.
    goto :fail
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not a git repository: %CD%
    goto :fail
)

if "!SKIP_MIGRATE!"=="1" goto :migrate_skip

set "MIGRATION_REQUIRED=0"
if "!FORCE_MIGRATE!"=="1" set "MIGRATION_REQUIRED=1"
if not "!MIGRATION_NAME!"=="" set "MIGRATION_REQUIRED=1"

if "!MIGRATION_REQUIRED!"=="0" (
    git status --porcelain -- prisma/schema.prisma prisma/migrations | findstr /R /C:".*" >nul
    if not errorlevel 1 set "MIGRATION_REQUIRED=1"
)

if "!MIGRATION_REQUIRED!"=="0" goto :migrate_not_needed

if "!MIGRATION_NAME!"=="" (
    for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "NOW=%%t"
    set "MIGRATION_NAME=auto_schema_!NOW!"
)

echo [1/5] Running DB migration... name=!MIGRATION_NAME!
call npx prisma migrate dev --name "!MIGRATION_NAME!"
if errorlevel 1 (
    echo [ERROR] Migration failed.
    goto :fail
)

echo [INFO] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma generate failed.
    goto :fail
)
goto :typecheck

:migrate_skip
echo [1/5] Skipping DB migration --skip-migrate
goto :typecheck

:migrate_not_needed
echo [1/5] No schema changes. Skipping DB migration.

:typecheck
echo [2/5] Production build check...
call npm run build
if errorlevel 1 (
    echo [ERROR] Production build failed.
    goto :fail
)

echo [3/5] Staging files...
git add -A
if errorlevel 1 (
    echo [ERROR] git add failed.
    goto :fail
)

git diff --cached --quiet
if errorlevel 1 (
    set "HAS_STAGED_CHANGES=1"
) else (
    set "HAS_STAGED_CHANGES=0"
)

if "!HAS_STAGED_CHANGES!"=="1" (
    if "!COMMIT_MSG!"=="" (
        for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "NOW=%%t"
        set "COMMIT_MSG=auto deploy !NOW!"
    )
    echo [4/5] Committing... msg=!COMMIT_MSG!
    git commit -m "!COMMIT_MSG!"
    if errorlevel 1 (
        echo [ERROR] Commit failed.
        goto :fail
    )

    for /f %%b in ('git branch --show-current') do set "BRANCH=%%b"
    if not defined BRANCH set "BRANCH=master"
    echo [4/5] Pushing... branch=!BRANCH!
    call :push_with_retry "!BRANCH!"
    if errorlevel 1 (
        echo [ERROR] Push failed after retries.
        goto :fail
    )
) else (
    echo [4/5] No staged changes. Skipping commit/push.
)

echo [5/5] Deploying to Vercel...
call :deploy_with_retry
if errorlevel 1 (
    echo [ERROR] Deploy failed after retries.
    goto :fail
)

echo.
echo ============================================
echo   All done
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
echo [WARN] Push failed. Retrying in 10 seconds... !RETRY!/!MAX_RETRY!
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

:fail
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
