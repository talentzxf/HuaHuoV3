@echo off
echo ========================================
echo HuaHuo Project - Folder Renaming Script
echo ========================================
echo.
echo This script will rename:
echo   HHIDE         -^> hh-ide
echo   packages/common -^> packages/hh-common
echo.
echo Please close your IDE first!
echo.
pause

echo.
echo [1/2] Renaming HHIDE to hh-ide...
if exist "HHIDE" (
    ren "HHIDE" "hh-ide"
    if %errorlevel% equ 0 (
        echo ✓ Successfully renamed HHIDE to hh-ide
    ) else (
        echo ✗ Failed to rename HHIDE. Is it in use?
        goto :error
    )
) else (
    echo - HHIDE folder not found, skipping...
)

echo.
echo [2/2] Renaming packages/common to packages/hh-common...
cd packages
if exist "common" (
    ren "common" "hh-common"
    if %errorlevel% equ 0 (
        echo ✓ Successfully renamed common to hh-common
    ) else (
        echo ✗ Failed to rename common. Is it in use?
        cd ..
        goto :error
    )
) else (
    echo - common folder not found, skipping...
)
cd ..

echo.
echo ========================================
echo Renaming completed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Run: pnpm install
echo 2. Run: pnpm build:common
echo 3. Run: pnpm dev
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo Error occurred during renaming!
echo ========================================
echo.
echo Please:
echo 1. Close your IDE completely
echo 2. Close any terminal windows in the project
echo 3. Try running this script again
echo.
pause
exit /b 1

