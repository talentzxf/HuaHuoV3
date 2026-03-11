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

See **[docs/hhs-language-guide.md](docs/hhs-language-guide.md)** for the full HuaHuo Script language reference.

### Quick Start

```bash
# Create a new project
hhk new "MyAnimation" -o project.hhk --fps 30 --width 1280 --height 720

# Inspect a project
hhk info project.hhk
hhk validate project.hhk

# Export to JSON
hhk export project.hhk --format json -o project.json

# ── HuaHuo Script (.hhs) ──────────────────────────────────────────

# Run a script file
hhk run my_animation.hhs

# Dry-run (no files written)
hhk run my_animation.hhs --dry-run

# Dump a .hhk back to a readable .hhs script
hhk dump project.hhk
hhk dump project.hhk -o project_dump.hhs

# Interactive REPL
hhk repl
hhk repl --load project.hhk     # pre-load a project
hhk repl --load setup.hhs       # pre-run a script, then enter REPL
```

### HuaHuo Script example (`animation.hhs`)

```hhs
# Create project
new_project("MyAnim", fps=30, w=1280, h=720)

# Get default scene & layer
let scene = project.scene("DefaultScene")
let layer = scene.layer("drawing")

# Create a game object
let ball = layer.new_go("ball", born=0)
ball.add_component("Transform")
ball.add_component("Visual")

# Keyframe animation
ball.set_kf("Transform", "position", frame=0,  value=vec2(0, 360))
ball.set_kf("Transform", "position", frame=30, value=vec2(640, 360), easing="ease-in-out")
ball.set_kf("Transform", "position", frame=60, value=vec2(1280, 360))
ball.set_kf("Visual",    "fillColor", frame=0,  value=hex("#FF4444"))
ball.set_kf("Visual",    "fillColor", frame=60, value=hex("#4444FF"))

# Preview interpolation at frame 15
ball.interpolate(frame=15)

# ── Elements (reusable animation units) ─────────────────────────
# Define a reusable element
let coin = project.new_element("Coin", fps=30, duration=1, w=60, h=60)
let coin_layer = coin.new_layer("main")
let disk = coin_layer.new_go("disk", born=0)
disk.add_component("Transform")
disk.set_kf("Transform", "rotation", frame=0,  value=float(0))
disk.set_kf("Transform", "rotation", frame=30, value=float(360))

# Instantiate it in a scene layer (supports loop, time_offset, speed_scale)
let c1 = layer.instantiate("Coin", "coin1", born=0)
let c2 = layer.instantiate("Coin", "coin2", born=10, loop_playback=true)

# Animate instance transform via the "ElementInstance" component
c1.set_kf("ElementInstance", "position", frame=0,  value=vec2(0, 300))
c1.set_kf("ElementInstance", "position", frame=60, value=vec2(800, 300), easing="ease-in-out")

project.list_elements()

# Save
save("my_anim.hhk")
```

### Low-level subcommands (for shell scripts)

```bash
hhk scene add project.hhk "Cut02" --fps 24 --duration 8
hhk scene list project.hhk

hhk layer add project.hhk "fx"
hhk layer list project.hhk

hhk go add project.hhk "hero" <layer_id> --born-frame 0
hhk go list project.hhk
hhk go show project.hhk <go_id>
hhk go set-kf project.hhk <go_id> Transform position 0 vec2:100,200
hhk go interpolate project.hhk <go_id> 15
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

