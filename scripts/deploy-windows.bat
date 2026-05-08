@echo off
setlocal EnableDelayedExpansion
title Silwane ERP - Windows Auto Deployment
chcp 65001 >nul

:: ============================================================
::  Silwane ERP - Windows Auto Deployment Script
::  Author : Mennouchi Islam Azeddine
::  Version: 4.3
::
::  Steps:
::    1.  Prerequisite checks (Node, npm, Git, psql)
::    2.  Git pull latest code
::    3.  Generate secure JWT secret
::    4.  Setup backend .env
::    5.  Create PostgreSQL database + run migrations
::    6.  Install backend dependencies
::    7.  Setup frontend .env  (REACT_APP_API_URL, etc.)
::    8.  Install frontend dependencies
::    9.  Build frontend (React production build)
::   10.  Create initial admin account
::   11.  Start backend  with PM2 (silwane-erp-api)  [FIXED v4.3]
::   12.  Start frontend with PM2 + serve (silwane-erp-ui)
::   13.  Full deployment summary + open browser
:: ============================================================

set "APP_DIR=%~dp0.."
set "FRONTEND_DIR=%APP_DIR%\frontend"
set "SCRIPTS_DIR=%APP_DIR%\scripts"
set "ENV_FILE=%APP_DIR%\.env"
set "FE_ENV_FILE=%FRONTEND_DIR%\.env"

:: Absolute path to server entry point - avoids PM2 resolving
:: it relative to whatever the current directory happens to be
set "SERVER_JS=%APP_DIR%\server.js"
set "FRONTEND_BUILD=%FRONTEND_DIR%\build"

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
echo   SILWANE ERP - Windows Auto Deployment v4.3
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

:: Verify server.js exists before going further
if not exist "%SERVER_JS%" (
    echo.
    echo [ERROR] server.js not found at: %SERVER_JS%
    echo         Make sure you are running this script from inside the
    echo         silwane-erp\scripts\ folder, and that server.js exists
    echo         in the project root.
    echo.
    pause & exit /b 1
)
echo     [OK] server.js found at %SERVER_JS%

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
echo     [OK] React build complete  =^>  frontend\build\

if exist "%APP_DIR%\public" (
    echo     Syncing build to backend public\ folder...
    xcopy /E /I /Y "%FRONTEND_DIR%\build\*" "%APP_DIR%\public\" >nul 2>&1
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
node "%SCRIPTS_DIR%\create-admin.js"
if %errorlevel% equ 0 (
    set ADMIN_CREATED=1
) else (
    echo     [WARN] Admin setup skipped or failed.
    echo           Run manually: node scripts/create-admin.js
)

:: ============================================================
:: STEP 11 - Start backend with PM2
::
::  FIX v4.3: The previous error was:
::    [PM2][ERROR] Script not found: C:\...\scripts\server.js
::
::  Root cause: PM2 resolves relative paths against the CURRENT
::  WORKING DIRECTORY at the time pm2 start is called, not the
::  script's location. After create-admin.js the CWD was APP_DIR
::  but Windows was still tracking %APP_DIR% as scripts\..\, so
::  PM2 ended up looking inside the scripts\ folder for server.js.
::
::  Fix: Always pass the fully-resolved absolute path %SERVER_JS%
::  (set at the top of the script as %APP_DIR%\server.js) so PM2
::  never has to resolve anything relative.
:: ============================================================
echo.
echo [11/12] Starting backend with PM2...

:: Always cd to APP_DIR before PM2 commands so logs land there
cd /d "%APP_DIR%"

where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo     PM2 not found - installing globally...
    call npm install -g pm2
    if !errorlevel! neq 0 (
        echo     [ERROR] Failed to install PM2.
        echo             Install manually: npm install -g pm2
        pause & exit /b 1
    )
)

where pm2 >nul 2>&1
if !errorlevel! equ 0 (
    set PM2_AVAILABLE=1

    pm2 describe silwane-erp-api >nul 2>&1
    set PM2_API_EXISTS=!errorlevel!

    if !PM2_API_EXISTS! equ 0 (
        :: Process exists - restart and reload .env
        pm2 restart silwane-erp-api --update-env
        if !errorlevel! equ 0 (
            echo     [OK] Backend restarted with updated env  ^(silwane-erp-api^)
        ) else (
            echo     [WARN] Restart failed - deleting and re-starting...
            pm2 delete silwane-erp-api >nul 2>&1
            pm2 start "%SERVER_JS%" --name "silwane-erp-api" --env production
            echo     [OK] Backend started fresh  ^(silwane-erp-api^)
        )
    ) else (
        :: Process does not exist - start fresh using absolute path
        echo     Starting silwane-erp-api from: %SERVER_JS%
        pm2 start "%SERVER_JS%" --name "silwane-erp-api" --env production
        if !errorlevel! equ 0 (
            echo     [OK] Backend started  ^(silwane-erp-api^)  ->  http://localhost:%PORT%
        ) else (
            echo.
            echo     [ERROR] PM2 could not start the backend.
            echo             Script path used: %SERVER_JS%
            echo             Verify that file exists, then run manually:
            echo               node "%SERVER_JS%"
            echo.
            pause & exit /b 1
        )
    )

    pm2 save >nul 2>&1

) else (
    echo     [WARN] PM2 still unavailable - starting backend in new CMD window
    start "Silwane ERP API" cmd /k "node "%SERVER_JS%""
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
        set PM2_UI_EXISTS=!errorlevel!

        if !PM2_UI_EXISTS! equ 0 (
            pm2 restart silwane-erp-ui --update-env
            if !errorlevel! equ 0 (
                echo     [OK] Frontend restarted  ^(silwane-erp-ui^)
            ) else (
                pm2 delete silwane-erp-ui >nul 2>&1
                pm2 start "serve" --name "silwane-erp-ui" -- -s "%FRONTEND_BUILD%" -l %FE_PORT%
                echo     [OK] Frontend started fresh  ^(silwane-erp-ui^)
            )
        ) else (
            pm2 start "serve" --name "silwane-erp-ui" -- -s "%FRONTEND_BUILD%" -l %FE_PORT%
            if !errorlevel! equ 0 (
                echo     [OK] Frontend started  ^(silwane-erp-ui^)  ->  http://localhost:%FE_PORT%
            ) else (
                echo     [ERROR] Could not start frontend via PM2
                echo             Run manually: npx serve -s "%FRONTEND_BUILD%" -l %FE_PORT%
            )
        )

        pm2 save >nul 2>&1
        echo     [OK] PM2 process list saved ^(auto-restart on reboot^)

    ) else (
        start "Silwane ERP UI" cmd /k "serve -s "%FRONTEND_BUILD%" -l %FE_PORT%"
        echo     [OK] Frontend serving in new window  ->  http://localhost:%FE_PORT%
    )

    set FE_RUNNING=1

) else (
    echo     [WARN] 'serve' could not be installed.
    echo           Serve manually: npx serve -s "%FRONTEND_BUILD%" -l %FE_PORT%
)

timeout /t 3 /nobreak >nul

:: ============================================================
:: DEPLOYMENT SUMMARY
:: ============================================================
:summary
echo.
echo.
echo =====================================================
echo   DEPLOYMENT COMPLETE - FULL SUMMARY
echo =====================================================
echo.
echo   BACKEND
echo   -------
echo   Process : silwane-erp-api  ^(PM2^)
echo   Script  : %SERVER_JS%
echo   URL     : http://localhost:%PORT%
echo.
echo   FRONTEND  ^(React 18 + MUI + Recharts^)
echo   ----------------------------------
if "%FE_BUILT%"=="1" (
    echo   Build   : %FRONTEND_BUILD%  [READY]
    if "%FE_RUNNING%"=="1" (
        echo   Process : silwane-erp-ui  ^(PM2 + serve^)
        echo   URL     : http://localhost:%FE_PORT%
        echo   Proxy   : -^> http://localhost:%PORT%  ^(API^)
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
    echo   Recreate: node scripts/create-admin.js
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
    timeout /t 2 /nobreak >nul
    start http://localhost:%FE_PORT%
) else (
    start http://localhost:%PORT%
)

pause
