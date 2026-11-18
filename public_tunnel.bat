@echo off
title AgriSmart IoT - Public Global Tunnel Link
color 0B

echo ===================================================================
echo     AgriSmart IoT - Instant Public Internet Access Link
echo ===================================================================
echo.
echo Starting secure tunnel to expose http://localhost:3000 to the world...
echo.
echo NOTE: Make sure your AgriSmart server (start.bat) is running!
echo.

npx localtunnel --port 3000

pause
