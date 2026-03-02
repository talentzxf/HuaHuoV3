# hh-kernel

HuaHuo animation engine storage core, written in Rust.

## Architecture

```
hh-kernel/
├── kernel-sdk/      # Extension SDK - implement ComponentDef trait to add custom components
├── kernel-core/     # ECS world, built-in components, keyframe interpolation, binary storage
├── kernel-schema/   # Versioned on-disk format (v1 stable schema)
├── kernel-proto/    # Command/Query/Event types for TypeScript ↔ Rust interface
├── kernel-wasm/     # WASM bindings (wasm-bindgen) - compiles to @huahuo/kernel-wasm package
└── kernel-cli/      # CLI tool (hhk)
```

## Features

1. **ECS (Entity-Component-System)** - `hecs`-based world with built-in components:
   - `Transform` (position, rotation, scale)
   - `Visual` (fill color, stroke, opacity)
   - `BornFrame`, `Active`, `EntityName`, `Parent`, `Children`
   - `AnimationRef` - embed another animation project inside an entity

2. **Keyframe interpolation** - linear, ease-in/out, step, custom cubic bezier

3. **Self-embedding** - animations can embed other animations (via `AnimationRef`), with cycle detection

4. **Versioned binary storage** - `HHKV` magic header + version routing for forward migration

5. **TypeScript API** (WASM) - single `dispatch(json)` / `query(json)` interface

6. **Extensible SDK** - users implement `ComponentDef` trait to add custom components

## Building

```bash
# Native (CLI + tests)
cargo build
cargo test

# Run CLI
cargo run -p kernel-cli -- new "MyProject" --output project.hhk
cargo run -p kernel-cli -- info project.hhk
cargo run -p kernel-cli -- export project.hhk --format json
cargo run -p kernel-cli -- validate project.hhk

# WASM (requires wasm-pack)
build-wasm.bat
```

## CLI Usage

```
hhk new <name> [--output project.hhk] [--fps 30] [--width 800] [--height 600]
hhk info <file>
hhk validate <file>
hhk export <file> [--output out.json] [--format json|binary]
```

## TypeScript API (WASM)

```typescript
import init, { KernelAPI } from '@huahuo/kernel-wasm';
await init();

const kernel = new KernelAPI();

// Create project
const resp = JSON.parse(kernel.dispatch(JSON.stringify({
  cmd: 'CreateProject',
  name: 'My Animation',
  fps: 30,
  canvas_width: 800,
  canvas_height: 600,
})));
console.log(resp.created_id); // project id

// Create a game object
const goResp = JSON.parse(kernel.dispatch(JSON.stringify({
  cmd: 'CreateGameObject',
  layer_id: '...',
  name: 'Rectangle',
  born_frame: 0,
})));

// Set a keyframe
kernel.dispatch(JSON.stringify({
  cmd: 'SetKeyFrame',
  game_object_id: goResp.created_id,
  component_type: 'Transform',
  prop_name: 'position.x',
  keyframe: { frame: 0, value: { type: 'Float', value: 0 }, easing: 'Linear' },
}));

// Get interpolated props at frame 5
const props = JSON.parse(kernel.get_interpolated_props_json(goResp.created_id, 5));

// Play
kernel.dispatch(JSON.stringify({ cmd: 'Play' }));

// Tick (call on animation frame)
const currentFrame = kernel.tick(1.0 / 30);

// Save/load
const bytes = kernel.save_project_bytes();
kernel.load_project_bytes(bytes);
```

## Custom Components (SDK)

```rust
use kernel_sdk::{ComponentDef, PropertyMeta, PropertyValue, PropertyMap};

struct MyComponent;

impl ComponentDef for MyComponent {
    fn type_name(&self) -> &str { "MyComponent" }
    fn version(&self) -> u32 { 1 }
    fn property_metas(&self) -> Vec<PropertyMeta> {
        vec![
            PropertyMeta::new("speed", "Speed", PropertyValue::Float(1.0))
                .with_range(0.0, 100.0),
        ]
    }
    fn default_props(&self) -> PropertyMap {
        let mut m = PropertyMap::new();
        m.insert("speed".into(), PropertyValue::Float(1.0));
        m
    }
}

// Register with the engine
registry.register(MyComponent);
```

## File Format

```
[4 bytes]  magic: "HHKV"
[4 bytes]  schema_version: u32 LE
[8 bytes]  created_at: i64 LE (unix ms)
[4 bytes]  payload_length: u32 LE
[N bytes]  bincode-encoded Project
```

Migration path: v1 → v2 → v3 (chained, never skip versions).

