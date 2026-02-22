@echo off
chcp 65001 >nul 2>&1
title 경찰 합격예측 개발 서버

echo ============================================
echo   경찰 합격예측 개발 서버 시작
echo ============================================
echo.

:: MySQL 서버 시작
echo [1/2] MySQL 서버 시작 중...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I "mysqld.exe" >nul
if %ERRORLEVEL%==0 (
    echo       → MySQL 이미 실행 중입니다.
) else (
    start /B "" "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --datadir="C:\Users\kunry\mysql_data" --port=3306 --console
    echo       → MySQL 서버를 시작했습니다. (포트: 3306)
    timeout /t 5 /nobreak >nul
)
echo.

:: Next.js 개발 서버 시작
echo [2/2] Next.js 개발 서버 시작 중...
echo       → http://localhost:3000 에서 접속하세요.
echo.
echo ============================================
echo   브라우저에서 http://localhost:3000 접속!
echo   종료하려면 이 창에서 Ctrl+C 를 누르세요.
echo ============================================
echo.

cd /d "D:\앱 프로그램\합격예측 프로그램\police"
npm run dev
