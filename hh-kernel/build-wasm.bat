@echo off
echo Building hh-kernel WASM package...

:: Check if wasm-pack is installed
where wasm-pack >nul 2>&1
if %errorlevel% neq 0 (
    echo wasm-pack not found. Installing...
    cargo install wasm-pack
)

:: Build WASM package targeting bundler (for webpack/vite)
wasm-pack build kernel-wasm --target bundler --out-dir kernel-wasm/pkg --out-name hh-kernel

if %errorlevel% neq 0 (
    echo WASM build failed!
    exit /b 1
)

echo.
echo WASM package built successfully at: kernel-wasm/pkg/
echo.
echo To use in hh-ide, run:
echo   pnpm add ./hh-kernel/kernel-wasm/pkg
echo.
echo Or add to hh-ide/package.json:
echo   "@huahuo/kernel-wasm": "file:../hh-kernel/kernel-wasm/pkg"

