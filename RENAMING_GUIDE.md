# Renaming Instructions

## Manual Steps Required

Since files are currently in use by the IDE, please follow these steps:

### Step 1: Close IDE
Close your IDE (IntelliJ/WebStorm) completely.

### Step 2: Rename Folders

```powershell
# In D:\myprojects\HuaHuoV3\

# Rename HHIDE to hh-ide
Rename-Item -Path "HHIDE" -NewName "hh-ide"

# Rename packages/common to packages/hh-common  
Rename-Item -Path "packages\common" -NewName "hh-common"
```

### Step 3: Reinstall Dependencies

```bash
cd D:\myprojects\HuaHuoV3
pnpm install
```

### Step 4: Build Common Library

```bash
pnpm build:common
```

### Step 5: Build hh-panel

```bash
pnpm --filter @huahuo/hh-panel build
```

### Step 6: Start Development

```bash
pnpm dev
```

## What Has Been Updated

✅ All configuration files updated:
- `package.json` files
- `pnpm-workspace.yaml`
- Import statements in code
- README files

✅ New package created:
- `packages/hh-panel` - Panel component library

## New Package Structure

```
HuaHuoV3/
├── hh-ide/                    # (renamed from HHIDE)
├── packages/
│   ├── hh-common/             # (renamed from common)
│   └── hh-panel/              # (NEW!)
├── package.json
└── pnpm-workspace.yaml
```

