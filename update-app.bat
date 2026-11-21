@echo off
title UniGenius AI - update
cd /d "%~dp0"
echo.
echo  Step 1 of 2: installing the new PowerPoint package (needs internet)...
echo.
call npm install --prefix server
if errorlevel 1 goto failed
echo.
echo  Step 2 of 2: building the app (about 1 minute)...
echo.
call npm run build
if errorlevel 1 goto failed
echo.
echo  ALL DONE! Close this window and double-click the UniGenius AI icon on your Desktop.
echo.
pause
exit /b 0
:failed
echo.
echo  Something failed. Copy the red text above and send it to Claude.
pause
exit /b 1
