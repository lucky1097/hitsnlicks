@echo off
rem Spusti lokalny server prototypu a otvori hru v prehliadaci.
cd /d "%~dp0"
start "Hits & Licks server" powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" -Port 8080
timeout /t 2 /nobreak >nul
start "" http://localhost:8080/
