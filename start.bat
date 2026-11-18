@echo off
title AgriSmart IoT - Agriculture Monitoring System
color 0A

echo =======================================================
echo    AgriSmart IoT - Intelligent Agriculture System
echo =======================================================
echo.
echo Starting Web Server on http://localhost:3000 ...
echo.

start "" "http://localhost:3000"
npm start

pause
