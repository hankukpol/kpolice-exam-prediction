@echo off
title DB Migration

echo ============================================
echo   DB Migration (Supabase)
echo ============================================
echo.

set /p MIGRATION_NAME=Migration name (ex: add_new_column):

if "%MIGRATION_NAME%"=="" (
    echo.
    echo [ERROR] Please enter a name.
    pause
    exit /b 1
)

echo.
echo [1/2] Running migration...
call npx prisma migrate dev --name %MIGRATION_NAME%
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Migration failed! Check schema.prisma
    pause
    exit /b 1
)
echo [1/2] Migration OK

echo.
echo [2/2] Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Prisma generate failed!
    pause
    exit /b 1
)
echo [2/2] Prisma Client OK

echo.
echo ============================================
echo   Migration complete!
echo   Now run dev.bat to test locally,
echo   then git-deploy.bat to deploy.
echo ============================================
echo.
pause
