@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title One-Click Auto Deploy

echo ============================================
echo   One-Click Auto Deploy
echo ============================================
echo.
echo Usage:
echo   %~nx0 [migration_name] [commit_message]
echo   %~nx0 --skip-migrate [commit_message]
echo   %~nx0 --force-migrate [migration_name] [commit_message]
echo.

set "SKIP_MIGRATE=0"
set "FORCE_MIGRATE=0"
set "MIGRATION_NAME=%~1"
set "COMMIT_MSG=%~2"
set "MIGRATE_SCRIPT="
set "DEPLOY_SCRIPT="

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git not found in PATH.
    exit /b 1
)

where npx >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npx not found in PATH. Install Node.js.
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not a git repository: %CD%
    exit /b 1
)

for %%F in ("%~dp0db-migrate_*.bat") do (
    set "MIGRATE_SCRIPT=%%~fF"
    goto :migrate_script_found
)
:migrate_script_found

for %%F in ("%~dp0git-deploy_*.bat") do (
    set "DEPLOY_SCRIPT=%%~fF"
    goto :deploy_script_found
)
:deploy_script_found

if not defined MIGRATE_SCRIPT (
    echo [ERROR] Could not find db-migrate_*.bat
    exit /b 1
)

if not defined DEPLOY_SCRIPT (
    echo [ERROR] Could not find git-deploy_*.bat
    exit /b 1
)

if /I "%~1"=="--skip-migrate" (
    set "SKIP_MIGRATE=1"
    set "MIGRATION_NAME="
    set "COMMIT_MSG=%~2"
)

if /I "%~1"=="--force-migrate" (
    set "FORCE_MIGRATE=1"
    set "MIGRATION_NAME=%~2"
    set "COMMIT_MSG=%~3"
)

if "!SKIP_MIGRATE!"=="0" (
    set "MIGRATION_REQUIRED=0"
    if "!FORCE_MIGRATE!"=="1" set "MIGRATION_REQUIRED=1"
    if not "!MIGRATION_NAME!"=="" set "MIGRATION_REQUIRED=1"

    if "!MIGRATION_REQUIRED!"=="0" (
        git status --porcelain -- prisma/schema.prisma prisma/migrations | findstr /R /C:".*" >nul
        if not errorlevel 1 set "MIGRATION_REQUIRED=1"
    )

    if "!MIGRATION_REQUIRED!"=="1" (
        echo [1/2] Running DB migration...
        if "!MIGRATION_NAME!"=="" (
            call "!MIGRATE_SCRIPT!"
        ) else (
            call "!MIGRATE_SCRIPT!" "!MIGRATION_NAME!"
        )

        if errorlevel 1 (
            echo.
            echo [ERROR] Migration step failed.
            exit /b 1
        )
        echo [1/2] Migration completed
    ) else (
        echo [1/2] No schema changes. Skipping DB migration.
    )
) else (
    echo [1/2] Skipping DB migration --skip-migrate
)

echo.
echo [2/2] Git push + Vercel deploy...
if "%COMMIT_MSG%"=="" (
    call "!DEPLOY_SCRIPT!"
) else (
    call "!DEPLOY_SCRIPT!" "!COMMIT_MSG!"
)

if errorlevel 1 (
    echo.
    echo [ERROR] Deploy step failed.
    exit /b 1
)

echo.
echo ============================================
echo   Auto deploy completed
echo ============================================
echo.
exit /b 0
