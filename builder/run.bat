@echo off
title Gravrust Builder Server
cd /d "%~dp0"
echo ============================================
echo   Gravrust Client Builder (Windows)
echo   Open http://localhost:8477 in your browser
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
