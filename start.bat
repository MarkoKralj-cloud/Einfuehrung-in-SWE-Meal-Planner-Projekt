@echo off
rem Startet den Meal Planner und oeffnet ihn im Browser (Doppelklick genuegt)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist nicht installiert. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)

node src\server\server.js --open
pause
