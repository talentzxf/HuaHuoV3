# HuaHuo Project

Monorepo with pnpm workspace.

## Structure

- `hh-ide/` - React IDE application
- `packages/hh-common/` - Shared library (Redux store, utilities)
- `packages/hh-panel/` - Panel component library

## Quick Start

```bash
# Install dependencies
pnpm install

# Build common library (first time only)
pnpm build:common

# Start development (with hot reload and watch mode)
pnpm dev
```

The app will open at http://localhost:3005

## Development Commands

```bash
# Build all packages
pnpm build

# Build common library only
pnpm build:common

# Watch common library (auto-rebuild on changes)
pnpm watch:common

# Start IDE dev server only
pnpm dev:ide

# Start both watch and dev server (recommended)
pnpm dev
```

## Features

- ✅ Hot Module Replacement (HMR) - Changes to hh-ide code reload instantly
- ✅ Watch mode for common library - Changes auto-rebuild
- ✅ Monorepo with workspace dependencies

## Add Dependency

```bash
# Add to specific package
pnpm add <package> --filter hh-ide
pnpm add <package> --filter @huahuo/hh-common
pnpm add <package> --filter @huahuo/hh-panel

# Add workspace dependency
pnpm add @huahuo/hh-common --filter hh-ide --workspace
pnpm add @huahuo/hh-panel --filter hh-ide --workspace
```



