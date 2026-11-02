@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
