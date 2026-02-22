@echo off
chcp 65001 >nul 2>&1
title 서버 종료

echo ============================================
echo   경찰 합격예측 서버 종료
echo ============================================
echo.

taskkill /F /IM mysqld.exe >nul 2>&1
if %ERRORLEVEL%==0 (
    echo [OK] MySQL 서버 종료 완료
) else (
    echo [--] MySQL 서버가 실행 중이 아닙니다
)

taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL%==0 (
    echo [OK] Next.js 서버 종료 완료
) else (
    echo [--] Next.js 서버가 실행 중이 아닙니다
)

echo.
echo 모든 서버가 종료되었습니다.
timeout /t 3
