@echo off
setlocal
set "BASE=%~dp0"
if exist "%~dp0server\index.js" goto base_ready
if exist "%~dp0..\..\server\index.js" (
  set "BASE=%~dp0..\..\"
  goto base_ready
)
if exist "%~dp0..\server\index.js" (
  set "BASE=%~dp0..\"
  goto base_ready
)

echo [ERROR] Cannot find the application files.
pause
exit /b 1

:base_ready
cd /d "%BASE%"
set "NODE_EXE=%BASE%node\node.exe"
if exist "%NODE_EXE%" goto run

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install Node.js 24 LTS, or put the portable Node.js files in the node folder.
  pause
  exit /b 1
)

set "NODE_EXE=node"

:run
if not exist "public\index.html" (
  echo [ERROR] Frontend build not found in this offline package.
  pause
  exit /b 1
)

echo ============================================
echo   Sales Service System
echo   Local: http://localhost:3000
echo   Press Ctrl+C to stop
echo ============================================
echo.

"%NODE_EXE%" server\index.js
pause
