@echo off
setlocal
cd /d "%~dp0..\.."

echo ============================================
echo   Yearcon Sales Service System - Setup
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Please install Node.js 24 LTS x64 from https://nodejs.org/
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 24 (
  echo [ERROR] Node.js 24 or newer is required.
  node -v
  pause
  exit /b 1
)

if not exist data mkdir data

echo [1/2] Installing dependencies...
call npm ci
if errorlevel 1 (
  echo.
  echo [ERROR] Dependency installation failed. Check your network and retry.
  echo You can also try: npm install
  pause
  exit /b 1
)

echo.
echo [2/2] Building frontend...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Frontend build failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Setup completed.
echo   Start: scripts\windows\start.bat
echo   Open:  http://localhost:3000
echo ============================================
pause
