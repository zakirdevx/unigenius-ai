@echo off
title UniGenius AI launcher
cd /d "%~dp0"
echo Starting UniGenius AI... keep the other black window open while you use the app.
start "UniGenius AI server - do not close" cmd /k npm run dev
timeout /t 15 /nobreak >nul
start "" http://localhost:5173
