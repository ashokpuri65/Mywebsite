@echo off
title RAJPUTI CLOTH STORE - Web & ERP Server
echo =================================================================
echo        RAJPUTI CLOTH STORE - Royal Rajasthani E-Commerce
echo                  Retail Business ERP System
echo =================================================================
echo.

WHERE node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Using system Node.js...
    node server.js
    pause
    exit /b
)

IF EXIST "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
    echo [OK] Starting server using Antigravity Node Runtime...
    set ELECTRON_RUN_AS_NODE=1
    "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" server.js
    pause
    exit /b
)

echo [ERROR] Node.js was not found. Please install Node.js from https://nodejs.org
pause
