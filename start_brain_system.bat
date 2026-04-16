@echo off
title IntelliAccess AI Brain Auto-Starter
echo ==================================================
echo Starting IntelliAccess AI Brain and Ngrok Tunnel...
echo ==================================================

cd /d "%~dp0"

:: 1. Start the FASTAPI Brain Server minimized in the background
echo Loading YOLO and EasyOCR models (Please wait)...
start /min "IntelliAccess Backend" python backend\brain_server.py

:: 2. Wait exactly 7 seconds for the server to spin up completely
timeout /t 7 >nul

:: 3. Start the secure Ngrok connection
echo Linking Brain Server to Vercel Website via Ngrok...
start /min "IntelliAccess Ngrok" ngrok http --domain=senate-postcard-lugged.ngrok-free.dev 127.0.0.1:8001

echo.
echo ==================================================
echo [SUCCESS] IntelliAccess Brain is now ONLINE!
echo You can safely close THIS window. Everything is running in the background.
echo ==================================================
timeout /t 5 >nul
exit
