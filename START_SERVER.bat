@echo off
title Axen Hospitality Server
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

echo Starting Axen Hospitality Backend...
echo.
echo Server URL: http://localhost:5000
echo Mobile App: http://localhost:5000/mobile/
echo Admin App : http://localhost:5000/admin/
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server.
echo.

node server.js

echo.
echo Server stopped. If there is an error above, send me that message.
pause
