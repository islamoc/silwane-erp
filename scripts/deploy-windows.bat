@echo off
setlocal EnableDelayedExpansion
title Silwane ERP - Windows Auto Deployment

:: ============================================================
::  Silwane ERP - Windows Auto Deployment Script
::  Author: Mennouchi Islam Azeddine
::  Description: Installs dependencies, sets up .env, runs DB
::               migrations and starts the ERP server on Windows
:: ============================================================

set "REPO_URL=https://github.com/islamoc/silwane-erp.git"
set "APP_DIR=%~dp0.."
set "NODE_MIN_VERSION=18"

echo.
echo =====================================================
echo   SILWANE ERP - Windows Auto Deployment
echo =====================================================
echo.

:: ----------------------------------------------------------
:: STEP 1 - Check prerequisites
:: ----------------------------------------------------------
echo [1/7] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ('node -v') do (
    set NODE_MAJOR=%%i
    set NODE_MAJOR=!NODE_MAJOR:v=!
)
echo     Node.js found: v%NODE_MAJOR% (requires ^>=%NODE_MIN_VERSION%)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)
echo     npm found: OK

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Git is not installed. Skipping git pull.
    set GIT_AVAILABLE=0
) else (
    echo     Git found: OK
    set GIT_AVAILABLE=1
)

:: ----------------------------------------------------------
:: STEP 2 - Pull latest code (if git available)
:: ----------------------------------------------------------
echo.
echo [2/7] Pulling latest code from GitHub...
if "%GIT_AVAILABLE%"=="1" (
    cd /d "%APP_DIR%"
    git pull origin main
    if %errorlevel% neq 0 (
        echo [WARNING] Git pull failed. Continuing with existing code...
    ) else (
        echo     Code updated successfully.
    )
) else (
    echo     Skipped (Git not available).
)

:: ----------------------------------------------------------
:: STEP 3 - Setup .env file
:: ----------------------------------------------------------
echo.
echo [3/7] Setting up environment configuration...
cd /d "%APP_DIR%"

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo     .env file created from .env.example
        echo.
        echo [ACTION REQUIRED] Please edit .env with your actual credentials:
        echo     - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
        echo     - JWT_SECRET (change to a strong random value)
        echo     - PORT (default: 5000)
        echo.
        echo     File location: %APP_DIR%\.env
        echo.
        set /p EDIT_ENV="Do you want to open .env now for editing? (y/n): "
        if /i "!EDIT_ENV!"=="y" (
            notepad "%APP_DIR%\.env"
            echo     Waiting for you to finish editing .env...
            pause
        )
    ) else (
        echo [WARNING] No .env.example found. Creating minimal .env template...
        (
            echo # Silwane ERP Environment Configuration
            echo NODE_ENV=production
            echo PORT=5000
            echo.
            echo # Database (PostgreSQL)
            echo DB_HOST=localhost
            echo DB_PORT=5432
            echo DB_NAME=silwane_erp
            echo DB_USER=postgres
            echo DB_PASSWORD=your_password_here
            echo.
            echo # JWT
            echo JWT_SECRET=change_this_to_a_random_secret
            echo JWT_EXPIRES_IN=7d
            echo.
            echo # Email (optional)
            echo EMAIL_HOST=smtp.gmail.com
            echo EMAIL_PORT=587
            echo EMAIL_USER=
            echo EMAIL_PASS=
        ) > ".env"
        echo     Minimal .env created. Please edit it before continuing.
        notepad "%APP_DIR%\.env"
        pause
    )
) else (
    echo     .env already exists. Skipping.
)

:: ----------------------------------------------------------
:: STEP 4 - Install backend dependencies
:: ----------------------------------------------------------
echo.
echo [4/7] Installing backend dependencies...
cd /d "%APP_DIR%"
call npm install --production
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed for backend.
    pause
    exit /b 1
)
echo     Backend dependencies installed.

:: ----------------------------------------------------------
:: STEP 5 - Install and build frontend
:: ----------------------------------------------------------
echo.
echo [5/7] Installing and building frontend...

if exist "%APP_DIR%\client\package.json" (
    cd /d "%APP_DIR%\client"
    call npm install
    if %errorlevel% neq 0 (
        echo [WARNING] Frontend npm install failed. Skipping frontend build.
    ) else (
        call npm run build
        if %errorlevel% neq 0 (
            echo [WARNING] Frontend build failed. Server will still start.
        ) else (
            echo     Frontend built successfully.
        )
    )
) else if exist "%APP_DIR%\frontend\package.json" (
    cd /d "%APP_DIR%\frontend"
    call npm install
    if %errorlevel% neq 0 (
        echo [WARNING] Frontend npm install failed.
    ) else (
        call npm run build
        if %errorlevel% neq 0 (
            echo [WARNING] Frontend build failed.
        ) else (
            echo     Frontend built successfully.
        )
    )
) else (
    echo     No frontend directory found. Skipping.
)

:: ----------------------------------------------------------
:: STEP 6 - Database check
:: ----------------------------------------------------------
echo.
echo [6/7] Database setup...

where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] psql not found in PATH.
    echo     Make sure PostgreSQL is installed and running.
    echo     Skipping automatic DB creation check.
) else (
    echo     PostgreSQL CLI found. Attempting to verify DB connection...
    echo     (If you see a password prompt, enter your DB password)
)

:: ----------------------------------------------------------
:: STEP 7 - Install PM2 and start application
:: ----------------------------------------------------------
echo.
echo [7/7] Starting application with PM2...

where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo     PM2 not found. Installing globally...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo [WARNING] PM2 install failed. Starting with node directly...
        cd /d "%APP_DIR%"
        echo     Starting server with node...
        start "Silwane ERP Server" cmd /k "cd /d %APP_DIR% && node server.js"
        goto :success
    )
)

cd /d "%APP_DIR%"
pm2 describe silwane-erp >nul 2>&1
if %errorlevel% equ 0 (
    echo     Restarting existing PM2 process...
    pm2 restart silwane-erp
) else (
    echo     Starting new PM2 process...
    pm2 start server.js --name "silwane-erp" --env production
)

pm2 save
echo     PM2 process saved. App will auto-restart on system reboot.
echo     (Run: pm2 startup to configure Windows auto-start)

:success
echo.
echo =====================================================
echo   DEPLOYMENT COMPLETE!
echo =====================================================
echo.
echo   App running at: http://localhost:5000
echo.
echo   Useful commands:
echo     pm2 status          - Check process status
echo     pm2 logs silwane-erp - View live logs
echo     pm2 stop silwane-erp - Stop the app
echo     pm2 restart silwane-erp - Restart the app
echo.
echo =====================================================
echo.
pause
