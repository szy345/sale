@echo off
setlocal
cd /d "%~dp0..\.."

if not exist "public\index.html" (
  echo Frontend build not found. Building now...
  call npm run build
  if errorlevel 1 (
    echo Build failed. Please run scripts\windows\setup.bat first.
    pause
    exit /b 1
  )
)

echo ============================================
echo   Yearcon Sales Service System
echo   Local: http://localhost:3000
echo   Press Ctrl+C to stop
echo ============================================
echo.

node server\index.js
pause
