@echo off
title UniGenius AI - one-time build
cd /d "%~dp0"
echo.
echo  Building UniGenius AI (takes about 1 minute). You only do this once,
echo  and again after you receive a new update.
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo  The build failed. Copy the red text above and send it to Claude.
  pause
  exit /b 1
)
echo.
echo  DONE! Now double-click  start-unigenius-hidden.vbs  to open the app.
echo.
pause
