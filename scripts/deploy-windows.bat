@echo off
setlocal EnableDelayedExpansion
title Silwane ERP - Windows Auto Deployment
chcp 65001 >nul

:: ============================================================
::  Silwane ERP - Windows Auto Deployment Script
::  Author : Mennouchi Islam Azeddine
::  Version: 4.6
::
::  CHANGELOG v4.6
::  -------------------------------------------------------
::  BUG 6 - Script broken when run from Git Bash (MINGW64)
::    ROOT CAUSE 1: timeout /t /nobreak is intercepted by
::    Git Bash's Linux 'timeout' which rejects /t flag.
::    FIX: All waits replaced with cross-shell Node.js:
::      node -e "setTimeout(function(){},3000);"
::
::    ROOT CAUSE 2: CMD 'for /f' backtick pipe expansion
::    (pm2 jlist | findstr) does not execute in Git Bash -
::    it echoes the JSON as a literal string, findstr never
::    runs, API_ONLINE stays 0 -> false [ERROR] every time.
::    FIX: PM2 status check replaced with a Node.js
::    one-liner that parses pm2 jlist JSON directly and
::    exits 0 (online) or 1 (not online). Works in cmd.exe,
::    PowerShell, and Git Bash identically.
::
::  Steps:
::    1.  Prerequisite checks (Node, npm, Git, psql, server.js)
::    2.  Git pull latest code
::    3.  Generate secure JWT secret
::    4.  Setup backend .env
::    5.  Create PostgreSQL database + run migrations
::    6.  Install backend dependencies
::    7.  Setup frontend .env
::    8.  Install frontend dependencies
::    9.  Build React frontend (production)
::   10.  Create initial admin account
::   11.  Start backend  with PM2 (silwane-erp-api)
::   12.  Start frontend with PM2 + serve (silwane-erp-ui)
::   13.  Full deployment summary + open browser
:: ============================================================

FOR /F "delims=" %%A IN ("%~dp0..") DO SET "APP_DIR=%%~fA"

set "FRONTEND_DIR=%APP_DIR%\frontend"
set "SCRIPTS_DIR=%APP_DIR%\scripts"
set "ENV_FILE=%APP_DIR%\.env"
set "FE_ENV_FILE=%FRONTEND_DIR%\.env"
set "SERVER_JS=%APP_DIR%\server.js"
set "FRONTEND_BUILD=%FRONTEND_DIR%\build"

set "ADMIN_SCRIPT=%SCRIPTS_DIR%\create-admin-user.js"
if not exist "%ADMIN_SCRIPT%" (
    if exist "%SCRIPTS_DIR%\create-admin.js" (
        set "ADMIN_SCRIPT=%SCRIPTS_DIR%\create-admin.js"
    ) else (
        set "ADMIN_SCRIPT="
    )
)

:: Defaults
set "PORT=5000"
set "FE_PORT=3000"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_NAME=silwane_erp"
set "DB_USER=postgres"
set "DB_PASSWORD="
set "JWT_SECRET="
set "API_URL=http://localhost:5000"

:: Status flags
set "GIT_AVAILABLE=0"
set "PSQL_AVAILABLE=0"
set "PM2_AVAILABLE=0"
set "SERVE_AVAILABLE=0"
set "DB_CREATED=0"
set "ENV_CREATED=0"
set "FE_ENV_CREATED=0"
set "FE_BUILT=0"
set "FE_RUNNING=0"
set "ADMIN_CREATED=0"

echo.
echo =====================================================
echo   SILWANE ERP - Windows Auto Deployment v4.6
echo =====================================================
echo   Project root: %APP_DIR%
echo =====================================================
echo.

:: ============================================================
:: STEP 1 - Prerequisite checks
:: ============================================================
echo [1/12] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download: https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo     [OK] Node.js %NODE_VER%

where npm >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] npm not found. & pause & exit /b 1 )
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPM_VER=%%v
echo     [OK] npm v%NPM_VER%

where git >nul 2>&1
if %errorlevel% equ 0 (
    set GIT_AVAILABLE=1
    for /f "tokens=*" %%v in ('git --version 2^>nul') do echo     [OK] %%v
) else ( echo     [WARN] Git not found - skipping pull )

where psql >nul 2>&1
if %errorlevel% equ 0 (
    set PSQL_AVAILABLE=1
    for /f "tokens=*" %%v in ('psql --version 2^>nul') do echo     [OK] %%v
) else ( echo     [WARN] psql not in PATH - DB auto-creation skipped )

if not exist "%SERVER_JS%" (
    echo.
    echo [ERROR] server.js not found at: %SERVER_JS%
    echo         Possible causes:
    echo           1. scripts\ folder moved outside project root
    echo           2. Project cloned into a different directory
    echo           3. server.js was deleted
    echo         Resolved APP_DIR = %APP_DIR%
    echo.
    pause & exit /b 1
)
echo     [OK] server.js found: %SERVER_JS%
echo     [OK] APP_DIR resolved: %APP_DIR%

:: ============================================================
:: STEP 2 - Git pull
:: ============================================================
echo.
echo [2/12] Pulling latest code...
if "%GIT_AVAILABLE%"=="1" (
    cd /d "%APP_DIR%"
    git pull origin main 2>&1
    if !errorlevel! equ 0 ( echo     [OK] Code updated ) else ( echo     [WARN] Git pull failed - using existing code )
) else ( echo     Skipped )

:: ============================================================
:: STEP 3 - Generate JWT secret
:: ============================================================
echo.
echo [3/12] Generating JWT secret...
for /f "tokens=*" %%s in ('node -e "const c=require('crypto');process.stdout.write(c.randomBytes(64).toString('hex'))" 2^>nul') do set JWT_SECRET=%%s
if "%JWT_SECRET%"=="" (
    set JWT_SECRET=CHANGE_THIS_MANUALLY_TO_A_64CHAR_RANDOM_STRING
    echo     [WARN] Auto-generation failed - set JWT_SECRET manually in .env
) else (
    echo     [OK] JWT secret generated ^(256-bit^)
)

:: ============================================================
:: STEP 4 - Backend .env setup
:: ============================================================
echo.
echo [4/12] Setting up backend environment...

if not exist "%ENV_FILE%" (
    set ENV_CREATED=1
    echo.
    echo   --- Backend Configuration ---
    set /p DB_HOST_IN="   DB Host      [localhost]  : "
    if not "!DB_HOST_IN!"=="" set DB_HOST=!DB_HOST_IN!
    set /p DB_PORT_IN="   DB Port      [5432]       : "
    if not "!DB_PORT_IN!"=="" set DB_PORT=!DB_PORT_IN!
    set /p DB_NAME_IN="   DB Name      [silwane_erp]: "
    if not "!DB_NAME_IN!"=="" set DB_NAME=!DB_NAME_IN!
    set /p DB_USER_IN="   DB User      [postgres]   : "
    if not "!DB_USER_IN!"=="" set DB_USER=!DB_USER_IN!
    set /p DB_PASSWORD="   DB Password               : "
    set /p PORT_IN="   Backend Port [5000]       : "
    if not "!PORT_IN!"=="" set PORT=!PORT_IN!
    set API_URL=http://localhost:!PORT!

    (
        echo # Silwane ERP - Backend Environment
        echo # Auto-generated by deploy-windows.bat on %DATE% %TIME%
        echo.
        echo NODE_ENV=production
        echo PORT=!PORT!
        echo.
        echo DB_HOST=!DB_HOST!
        echo DB_PORT=!DB_PORT!
        echo DB_NAME=!DB_NAME!
        echo DB_USER=!DB_USER!
        echo DB_PASSWORD=!DB_PASSWORD!
        echo.
        echo JWT_SECRET=!JWT_SECRET!
        echo JWT_EXPIRES_IN=7d
        echo.
        echo EMAIL_HOST=smtp.gmail.com
        echo EMAIL_PORT=587
        echo EMAIL_USER=
        echo EMAIL_PASS=
    ) > "%ENV_FILE%"
    echo     [OK] Backend .env created
) else (
    echo     [SKIP] Backend .env exists - reading values
    for /f "tokens=1,* delims==" %%a in ('type "%ENV_FILE%" ^| findstr /v "^#" ^| findstr /v "^$"') do (
        if "%%a"=="DB_NAME"     set DB_NAME=%%b
        if "%%a"=="DB_USER"     set DB_USER=%%b
        if "%%a"=="DB_HOST"     set DB_HOST=%%b
        if "%%a"=="DB_PORT"     set DB_PORT=%%b
        if "%%a"=="PORT"        set PORT=%%b
        if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
        if "%%a"=="JWT_SECRET"  set JWT_SECRET=%%b
    )
    set API_URL=http://localhost:!PORT!
)

:: ============================================================
:: STEP 5 - PostgreSQL database creation + migrations
:: ============================================================
echo.
echo [5/12] Setting up PostgreSQL database...

if "%PSQL_AVAILABLE%"=="1" (

    set "PGPASSWORD=!DB_PASSWORD!"

    echo     Checking if database '!DB_NAME!' exists...
    set "DB_EXISTS="
    for /f "usebackq delims=" %%r in (
        `psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='!DB_NAME!';" 2^>nul`
    ) do set "DB_EXISTS=%%r"

    if "!DB_EXISTS!"=="1" (
        echo     [OK] Database '!DB_NAME!' already exists - skipping creation
    ) else (
        echo     Creating database '!DB_NAME!'...
        psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE !DB_NAME!;"
        if !errorlevel! neq 0 (
            echo.
            echo     [ERROR] Could not create database '!DB_NAME!'.
            echo     Possible reasons:
            echo       1. PostgreSQL service is not running  ^(open services.msc^)
            echo       2. Wrong password for user '!DB_USER!'
            echo       3. User lacks CREATEDB permission:
            echo              psql -U postgres -d postgres -c "ALTER ROLE !DB_USER! CREATEDB;"
            echo       4. Wrong host/port: !DB_HOST!:!DB_PORT!
            echo.
            set "PGPASSWORD="
            pause
            exit /b 1
        )
        echo     [OK] Database '!DB_NAME!' created successfully
        set "DB_CREATED=1"
    )

    if exist "%APP_DIR%\database\schema.sql" (
        echo     Applying schema.sql...
        psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -v ON_ERROR_STOP=1 -f "%APP_DIR%\database\schema.sql"
        if !errorlevel! neq 0 (
            echo     [ERROR] schema.sql failed. Fix the SQL error above and re-run.
            set "PGPASSWORD="
            pause
            exit /b 1
        )
        echo     [OK] Schema applied
    ) else ( echo     [INFO] database\schema.sql not found - skipping )

    if exist "%APP_DIR%\database\seed.sql" (
        echo     Applying seed.sql...
        psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -v ON_ERROR_STOP=1 -f "%APP_DIR%\database\seed.sql"
        if !errorlevel! neq 0 (
            echo     [ERROR] seed.sql failed. Fix the SQL error above and re-run.
            set "PGPASSWORD="
            pause
            exit /b 1
        )
        echo     [OK] Seed data applied
    ) else ( echo     [INFO] database\seed.sql not found - skipping )

    set "PGPASSWORD="

) else (
    echo     [SKIP] psql not available
)

:: ============================================================
:: STEP 6 - Install backend dependencies
:: ============================================================
echo.
echo [6/12] Installing backend dependencies...
cd /d "%APP_DIR%"
call npm install --production
if %errorlevel% neq 0 ( echo [ERROR] Backend npm install failed. & pause & exit /b 1 )
echo     [OK] Backend dependencies installed

:: ============================================================
:: STEP 7 - Frontend .env setup
:: ============================================================
echo.
echo [7/12] Setting up frontend environment...

if not exist "%FRONTEND_DIR%" (
    echo     [SKIP] No frontend\ directory found
    goto :step8
)

if not exist "%FE_ENV_FILE%" (
    set FE_ENV_CREATED=1
    echo.
    echo   --- Frontend Configuration ---
    set /p FE_PORT_IN="   Frontend Port [3000]                       : "
    if not "!FE_PORT_IN!"=="" set FE_PORT=!FE_PORT_IN!
    set /p API_URL_IN="   Backend API URL [http://localhost:%PORT%]: "
    if not "!API_URL_IN!"=="" set API_URL=!API_URL_IN!

    (
        echo # Silwane ERP - Frontend Environment
        echo # Auto-generated by deploy-windows.bat on %DATE% %TIME%
        echo REACT_APP_API_URL=!API_URL!
        echo REACT_APP_NAME=Silwane ERP
        echo REACT_APP_COMPANY=GK PRO STONES
        echo REACT_APP_VERSION=1.0.0
        echo PORT=!FE_PORT!
    ) > "%FE_ENV_FILE%"
    echo     [OK] Frontend .env created
    echo         REACT_APP_API_URL = !API_URL!
    echo         PORT              = !FE_PORT!
) else (
    echo     [SKIP] Frontend .env already exists - reading values
    for /f "tokens=1,* delims==" %%a in ('type "%FE_ENV_FILE%" ^| findstr /v "^#" ^| findstr /v "^$"') do (
        if "%%a"=="PORT"              set FE_PORT=%%b
        if "%%a"=="REACT_APP_API_URL" set API_URL=%%b
    )
    echo         REACT_APP_API_URL = !API_URL!
    echo         PORT              = !FE_PORT!
)

:: ============================================================
:: STEP 8 - Install frontend dependencies
:: ============================================================
:step8
echo.
echo [8/12] Installing frontend dependencies...

if not exist "%FRONTEND_DIR%\package.json" (
    echo     [SKIP] No frontend/package.json
    goto :step9
)

cd /d "%FRONTEND_DIR%"
call npm install
if %errorlevel% neq 0 (
    echo     [ERROR] Frontend npm install failed - skipping build
    goto :step9
)
echo     [OK] Frontend packages installed ^(React, MUI, Recharts, axios...^)

:: ============================================================
:: STEP 9 - Build React frontend for production
:: ============================================================
:step9
echo.
echo [9/12] Building React frontend ^(production^)...

if not exist "%FRONTEND_DIR%\package.json" (
    echo     [SKIP] No frontend to build
    goto :step10
)

cd /d "%FRONTEND_DIR%"
echo     Running: npm run build  ^(may take 1-3 minutes...^)
call npm run build
if %errorlevel% neq 0 (
    echo     [ERROR] React build failed. Check frontend\src for errors.
    goto :step10
)

set FE_BUILT=1
echo     [OK] React build complete  =^>  %FRONTEND_BUILD%

if exist "%APP_DIR%\public" (
    echo     Syncing build to backend public\ folder...
    xcopy /E /I /Y "%FRONTEND_BUILD%\*" "%APP_DIR%\public\" >nul 2>&1
    if !errorlevel! equ 0 (
        echo     [OK] Build synced to public\
    ) else (
        echo     [WARN] xcopy failed - UI will serve on port %FE_PORT% separately
    )
)

:: ============================================================
:: STEP 10 - Create initial admin account
:: ============================================================
:step10
echo.
echo [10/12] Setting up initial admin account...
cd /d "%APP_DIR%"

if "%ADMIN_SCRIPT%"=="" (
    echo     [WARN] No admin creation script found in scripts\
    echo           Expected: scripts\create-admin-user.js
    goto :step11
)

echo     Running: %ADMIN_SCRIPT%
node "%ADMIN_SCRIPT%"
if !errorlevel! equ 0 (
    set ADMIN_CREATED=1
    echo     [OK] Admin account ready
) else (
    echo     [WARN] Admin setup skipped or already exists.
    echo           Re-run manually: node "%ADMIN_SCRIPT%"
)

:: ============================================================
:: STEP 11 - Start backend with PM2
::
::  KEY FIX (v4.6):
::  Two cross-shell compatibility fixes for Git Bash (MINGW64):
::
::  1. WAIT: Use Node.js setTimeout instead of timeout /t
::     node -e "setTimeout(function(){},3000);"
::     Works in cmd.exe, PowerShell, and Git Bash.
::
::  2. STATUS CHECK: Use Node.js to parse pm2 jlist JSON
::     instead of cmd for/f + findstr pipeline which does
::     not work in Git Bash (echoes JSON as literal string).
::     Node script: run pm2 jlist, parse JSON, find process
::     by name, check status === 'online', exit 0 or 1.
::     Script reads !errorlevel! from the node call normally.
:: ============================================================
:step11
echo.
echo [11/12] Starting backend with PM2...
cd /d "%APP_DIR%"

where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo     PM2 not found - installing globally...
    call npm install -g pm2
    if !errorlevel! neq 0 (
        echo     [ERROR] Failed to install PM2. Install manually: npm install -g pm2
        pause & exit /b 1
    )
)

where pm2 >nul 2>&1
if !errorlevel! equ 0 (
    set PM2_AVAILABLE=1

    pm2 describe silwane-erp-api >nul 2>&1
    if !errorlevel! equ 0 (
        echo     Restarting existing PM2 process...
        pm2 restart silwane-erp-api --update-env >nul 2>&1
    ) else (
        echo     Starting: %SERVER_JS%
        pm2 start "%SERVER_JS%" --name "silwane-erp-api" --cwd "%APP_DIR%" --env production >nul 2>&1
    )

    :: -------------------------------------------------------
    :: Cross-shell wait: node setTimeout works in cmd + Git Bash
    :: -------------------------------------------------------
    echo     Waiting for process to stabilise...
    node -e "setTimeout(function(){},3000);"

    :: -------------------------------------------------------
    :: Cross-shell PM2 status check via Node.js JSON parsing.
    :: Runs pm2 jlist, parses JSON, finds 'silwane-erp-api',
    :: checks status === 'online'. Exits 0 = online, 1 = not.
    :: Works identically in cmd.exe, PowerShell, Git Bash.
    :: -------------------------------------------------------
    node -e "var e=require('child_process').execSync('pm2 jlist',{encoding:'utf8'});var l=JSON.parse(e);var p=l.find(function(x){return x.name==='silwane-erp-api';});process.exit(p&&p.pm2_env&&p.pm2_env.status==='online'?0:1);"
    if !errorlevel! equ 0 (
        set "API_ONLINE=1"
    ) else (
        set "API_ONLINE=0"
    )

    if "!API_ONLINE!"=="1" (
        echo     [OK] Backend is online  ^(silwane-erp-api^)  ->  http://localhost:!PORT!
    ) else (
        echo.
        echo     [ERROR] PM2 process is not online after start.
        echo             Script : %SERVER_JS%
        echo             CWD    : %APP_DIR%
        echo             Check logs: pm2 logs silwane-erp-api
        echo             Try manually: node server.js
        echo.
        pause & exit /b 1
    )

    pm2 save >nul 2>&1

) else (
    echo     [WARN] PM2 still unavailable - starting backend in new CMD window
    start "Silwane ERP API" cmd /k "cd /d "%APP_DIR%" && node server.js"
)

:: ============================================================
:: STEP 12 - Serve frontend with PM2 + 'serve'
:: ============================================================
echo.
echo [12/12] Starting frontend...

if "%FE_BUILT%"=="0" (
    echo     [SKIP] Frontend was not built - skipping serve
    goto :summary
)

where serve >nul 2>&1
if %errorlevel% neq 0 (
    echo     'serve' not found - installing globally...
    call npm install -g serve
)

where serve >nul 2>&1
if !errorlevel! equ 0 (
    set SERVE_AVAILABLE=1

    if "%PM2_AVAILABLE%"=="1" (
        pm2 describe silwane-erp-ui >nul 2>&1
        if !errorlevel! equ 0 (
            pm2 restart silwane-erp-ui --update-env >nul 2>&1
        ) else (
            pm2 start "serve" --name "silwane-erp-ui" -- -s "%FRONTEND_BUILD%" -l %FE_PORT% >nul 2>&1
        )

        :: Cross-shell wait
        node -e "setTimeout(function(){},3000);"

        :: Cross-shell PM2 status check for UI process
        node -e "var e=require('child_process').execSync('pm2 jlist',{encoding:'utf8'});var l=JSON.parse(e);var p=l.find(function(x){return x.name==='silwane-erp-ui';});process.exit(p&&p.pm2_env&&p.pm2_env.status==='online'?0:1);"
        if !errorlevel! equ 0 (
            echo     [OK] Frontend is online  ^(silwane-erp-ui^)  ->  http://localhost:!FE_PORT!
            set FE_RUNNING=1
        ) else (
            echo     [WARN] Frontend PM2 process did not come online.
            echo             Manual: npx serve -s "%FRONTEND_BUILD%" -l %FE_PORT%
        )

        pm2 save >nul 2>&1
        echo     [OK] PM2 process list saved ^(auto-restart on reboot^)

    ) else (
        start "Silwane ERP UI" cmd /k "serve -s "%FRONTEND_BUILD%" -l %FE_PORT%"
        echo     [OK] Frontend serving in new window  ->  http://localhost:%FE_PORT%
        set FE_RUNNING=1
    )

) else (
    echo     [WARN] 'serve' could not be installed.
    echo           Serve manually: npx serve -s "%FRONTEND_BUILD%" -l %FE_PORT%
)

:: ============================================================
:: DEPLOYMENT SUMMARY
:: ============================================================
:summary
echo.
echo.
echo =====================================================
echo   DEPLOYMENT COMPLETE - FULL SUMMARY  v4.6
echo =====================================================
echo.
echo   PROJECT ROOT
echo   ------------
echo   %APP_DIR%
echo.
echo   BACKEND
echo   -------
echo   Process : silwane-erp-api  ^(PM2^)
echo   Script  : %SERVER_JS%
echo   CWD     : %APP_DIR%
echo   URL     : http://localhost:%PORT%
echo.
echo   FRONTEND  ^(React 18 + MUI + Recharts^)
echo   ----------------------------------
if "%FE_BUILT%"=="1" (
    echo   Build   : %FRONTEND_BUILD%  [READY]
    if "%FE_RUNNING%"=="1" (
        echo   Process : silwane-erp-ui  ^(PM2 + serve^)
        echo   URL     : http://localhost:%FE_PORT%
    ) else (
        echo   Process : NOT STARTED
        echo   Manual  : npx serve -s "%FRONTEND_BUILD%" -l %FE_PORT%
    )
) else (
    echo   Build   : FAILED or SKIPPED
    echo   Action  : Fix errors in frontend\src and re-run
)
echo.
echo   DATABASE
echo   --------
echo   Host    : %DB_HOST%:%DB_PORT%
echo   Name    : %DB_NAME%
echo   User    : %DB_USER%
if "%DB_CREATED%"=="1" ( echo   Status  : NEWLY CREATED ) else ( echo   Status  : Pre-existing )
echo.
echo   SECURITY
echo   --------
set JWT_PREVIEW=%JWT_SECRET:~0,16%
echo   JWT     : %JWT_PREVIEW%...  ^(full value in .env^)
echo   Expires : 7d
echo.
echo   ENV FILES
echo   ---------
if "%ENV_CREATED%"=="1"    ( echo   Backend : CREATED  -  %ENV_FILE% ) else ( echo   Backend : Pre-existing )
if "%FE_ENV_CREATED%"=="1" ( echo   Frontend: CREATED  -  %FE_ENV_FILE% ) else ( echo   Frontend: Pre-existing )
echo.
echo   ADMIN ACCOUNT
echo   -------------
if "%ADMIN_CREATED%"=="1" (
    echo   Status  : Created  ^(credentials shown above^)
) else (
    echo   Status  : Skipped / already existed
    if not "%ADMIN_SCRIPT%"=="" echo   Recreate: node "%ADMIN_SCRIPT%"
)
echo.
echo   PM2 COMMANDS
echo   ------------
echo   pm2 status                     - View all processes
echo   pm2 logs silwane-erp-api       - Backend live logs
echo   pm2 logs silwane-erp-ui        - Frontend live logs
echo   pm2 restart all --update-env   - Restart + reload .env
echo   pm2 stop all                   - Stop everything
echo   pm2 startup                    - Auto-start on Windows boot
echo.
echo   QUICK LINKS
echo   -----------
echo   App      : http://localhost:%FE_PORT%
echo   API      : http://localhost:%PORT%/api
echo   Health   : http://localhost:%PORT%/api/health
echo.
echo =====================================================
echo.

if "%FE_RUNNING%"=="1" (
    echo Opening app in browser...
    node -e "setTimeout(function(){},2000);"
    start http://localhost:%FE_PORT%
) else (
    start http://localhost:%PORT%
)

pause
