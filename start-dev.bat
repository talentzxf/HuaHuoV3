@echo off
echo Starting HuaHuo Development Environment...
echo.
echo [1/2] Building common library...
call pnpm build:common
echo.
echo [2/2] Starting dev servers...
echo - Common library: watch mode (auto-rebuild)
echo - IDE: http://localhost:3005 (hot reload enabled)
echo.
call pnpm dev

