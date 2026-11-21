@echo off
rem Stops the hidden UniGenius AI server (the one listening on port 5000).
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo UniGenius AI server stopped.
timeout /t 2 >nul
