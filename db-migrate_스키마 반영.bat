@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title DB Migration

echo ============================================
echo   DB Migration (Supabase)
echo ============================================
echo.

set "MIGRATION_NAME=%~1"
if "%MIGRATION_NAME%"=="" (
    for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "NOW=%%t"
    set "MIGRATION_NAME=auto_schema_!NOW!"
)

echo [INFO] Migration name: !MIGRATION_NAME!

echo.
echo [1/2] Running migration...
call npx prisma migrate dev --name "!MIGRATION_NAME!"
if errorlevel 1 (
    echo.
    echo [ERROR] Migration failed! Check schema.prisma / DATABASE_URL / migration history.
    exit /b 1
)
echo [1/2] Migration OK

echo.
echo [2/2] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo.
    echo [ERROR] Prisma generate failed!
    exit /b 1
)
echo [2/2] Prisma Client OK

echo.
echo ============================================
echo   Migration complete!
echo ============================================
echo.
exit /b 0
