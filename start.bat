@echo off
setlocal enabledelayedexpansion
title Character Image Studio
cd /d "%~dp0"
color 0F

echo.
echo   ========================================
echo       Character Image Studio  -  Launcher
echo   ========================================
echo.

:: ── Check for existing venv ──
if exist "venv\Scripts\python.exe" (
    echo   [OK] Virtual environment found
    goto :check_deps
)

:: ── Find Python on system ──
set "PYTHON="
where python >nul 2>&1 && (
    for /f "delims=" %%i in ('python --version 2^>^&1') do set "PV=%%i"
    echo !PV! | findstr /C:"Python 3" >nul && set "PYTHON=python"
)
if not defined PYTHON (
    where py >nul 2>&1 && (
        for /f "delims=" %%i in ('py -3 --version 2^>^&1') do set "PV=%%i"
        echo !PV! | findstr /C:"Python 3" >nul && set "PYTHON=py -3"
    )
)

if not defined PYTHON (
    echo   [!!] Python 3 not found on your system.
    echo.
    echo   Would you like to install Python automatically?
    echo.
    choice /C YN /M "   Install Python 3.12 now? (Y/N)"
    if errorlevel 2 (
        echo.
        echo   You can install manually from: https://www.python.org/downloads/
        echo   IMPORTANT: Check "Add Python to PATH" during installation!
        echo.
        pause
        exit /b 1
    )

    echo.
    echo   [..] Downloading Python 3.12.8 installer...
    echo.
    set "PY_URL=https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"
    set "PY_INSTALLER=%TEMP%\python-3.12.8-installer.exe"

    :: Try curl first (built into Windows 10+), then PowerShell
    curl -L -o "!PY_INSTALLER!" "!PY_URL!" 2>nul
    if not exist "!PY_INSTALLER!" (
        powershell -Command "Invoke-WebRequest -Uri '!PY_URL!' -OutFile '!PY_INSTALLER!'" 2>nul
    )
    if not exist "!PY_INSTALLER!" (
        echo   [ERROR] Failed to download Python installer.
        echo   Please install manually: https://www.python.org/downloads/
        pause
        exit /b 1
    )

    echo   [OK] Download complete
    echo   [..] Installing Python 3.12 ^(this may take a minute^)...
    echo.
    echo   NOTE: A Windows prompt may ask for admin permissions — click Yes.
    echo.

    "!PY_INSTALLER!" /passive PrependPath=1 Include_pip=1 Include_launcher=1

    if errorlevel 1 (
        echo   [ERROR] Python installation failed.
        echo   Try installing manually: https://www.python.org/downloads/
        del "!PY_INSTALLER!" 2>nul
        pause
        exit /b 1
    )

    del "!PY_INSTALLER!" 2>nul
    echo   [OK] Python installed successfully!
    echo.

    :: Refresh PATH for this session
    set "PATH=%LocalAppData%\Programs\Python\Python312\;%LocalAppData%\Programs\Python\Python312\Scripts\;%PATH%"

    :: Verify installation
    set "PYTHON="
    where python >nul 2>&1 && (
        for /f "delims=" %%i in ('python --version 2^>^&1') do set "PV=%%i"
        echo !PV! | findstr /C:"Python 3" >nul && set "PYTHON=python"
    )
    if not defined PYTHON (
        echo   [!!] Python was installed but PATH needs a restart.
        echo.
        echo   Please CLOSE this window and double-click start.bat again.
        echo.
        pause
        exit /b 0
    )
    echo   [OK] Found: !PV!
)

echo   [OK] Found: !PV!
echo   [..] Creating virtual environment...
!PYTHON! -m venv venv
if errorlevel 1 (
    echo   [ERROR] Failed to create virtual environment
    echo   Try: !PYTHON! -m pip install --user virtualenv
    pause
    exit /b 1
)
echo   [OK] Virtual environment created

:check_deps
:: ── Install / update dependencies ──
echo   [..] Checking dependencies...
venv\Scripts\pip.exe install -q -r requirements.txt 2>nul
if errorlevel 1 (
    echo   [..] Installing dependencies...
    venv\Scripts\pip.exe install flask requests flask-cors
    if errorlevel 1 (
        echo   [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)
echo   [OK] Dependencies ready

:: ── Launch ──
echo.
echo   [>>] Starting Character Image Studio...
echo   [>>] Opening http://localhost:5777
echo.
echo   ----------------------------------------
echo   Press Ctrl+C to stop the server
echo   ----------------------------------------
echo.

venv\Scripts\python.exe app.py
if errorlevel 1 (
    echo.
    echo   [ERROR] Server stopped unexpectedly.
    echo   Check the error above for details.
    echo.
)
pause
