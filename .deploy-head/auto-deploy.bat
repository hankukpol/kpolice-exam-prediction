@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ONE_CLICK_SCRIPT="
for %%F in ("%~dp0auto-deploy_*.bat") do (
    if /I not "%%~nxF"=="%~nx0" (
        if exist "%%~fF" (
            set "ONE_CLICK_SCRIPT=%%~fF"
            goto :script_found
        )
    )
)

:script_found
if not defined ONE_CLICK_SCRIPT (
    echo [ERROR] Could not find auto-deploy_*.bat
    echo [INFO] Expected location: %~dp0
    goto :fail
)

echo [INFO] Running: !ONE_CLICK_SCRIPT!
call "!ONE_CLICK_SCRIPT!" %*
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
    echo.
    echo [ERROR] Auto deploy failed with exit code %RC%.
    goto :fail
)

exit /b 0

:fail
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
