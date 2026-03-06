use anyhow::{bail, Result};
use kernel_core::ecs::components::keyframe::{EasingType, KeyFrame};
use kernel_core::project::game_object::GameObjectData;
use kernel_core::storage::{deserialize_project, serialize_project};
use kernel_sdk::property::PropertyValue;
use nanoid::nanoid;
use std::fs;

fn resolve_scene(project: &kernel_core::Project, scene_id: &Option<String>) -> Result<String> {
    if let Some(id) = scene_id {
        if !project.scenes.contains_key(id.as_str()) {
            bail!("Scene '{}' not found", id);
        }
        Ok(id.clone())
    } else {
        project
            .current_scene_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("No current scene. Use --scene-id or set one with `scene set-current`."))
    }
}

/// Add a new game object to a layer.
pub fn add(
    input: String,
    name: String,
    layer_id: String,
    scene_id: Option<String>,
    born_frame: u32,
) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    if !scene.layers.contains_key(&layer_id) {
        bail!("Layer '{}' not found in scene '{}'", layer_id, sid);
    }

    let go_id = nanoid!();
    let go = GameObjectData::new(go_id.clone(), name.clone(), born_frame);
    scene.add_game_object(&layer_id, go);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!(
        "✓ Added game object '{}' (id: {}) to layer '{}' at born_frame={}",
        name, go_id, layer_id, born_frame
    );
    Ok(())
}

/// List game objects in a scene (optionally filtered by layer).
pub fn list(input: String, scene_id: Option<String>, layer_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get(&sid).unwrap();

    let go_ids: Vec<String> = if let Some(ref lid) = layer_id {
        scene
            .layers
            .get(lid)
            .ok_or_else(|| anyhow::anyhow!("Layer '{}' not found", lid))?
            .game_object_ids
            .clone()
    } else {
        scene.game_objects.keys().cloned().collect()
    };

    println!(
        "Game objects in scene '{}'{}:",
        scene.name,
        layer_id.as_deref().map(|l| format!(" / layer '{}'", l)).unwrap_or_default()
    );
    if go_ids.is_empty() {
        println!("  (none)");
        return Ok(());
    }
    for go_id in &go_ids {
        if let Some(go) = scene.game_objects.get(go_id) {
            let kf_total: usize = go
                .components
                .values()
                .flat_map(|c| c.values())
                .map(|kfs| kfs.len())
                .sum();
            println!(
                "  [{}] name='{}' active={} born_frame={} components={} keyframes={}",
                go.id,
                go.name,
                go.active,
                go.born_frame_id,
                go.components.len(),
                kf_total,
            );
        }
    }
    Ok(())
}

/// Remove a game object from a scene.
pub fn remove(input: String, go_id: String, scene_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    if !scene.game_objects.contains_key(&go_id) {
        bail!("Game object '{}' not found in scene '{}'", go_id, sid);
    }
    // Remove from layer references
    for layer in scene.layers.values_mut() {
        layer.game_object_ids.retain(|id| id != &go_id);
    }
    scene.game_objects.remove(&go_id);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Removed game object '{}' from scene '{}'", go_id, sid);
    Ok(())
}

/// Show details (components + keyframes) of a single game object.
pub fn show(input: String, go_id: String, scene_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get(&sid).unwrap();

    let go = scene
        .game_objects
        .get(&go_id)
        .ok_or_else(|| anyhow::anyhow!("Game object '{}' not found", go_id))?;

    println!("GameObject '{}' (id: {})", go.name, go.id);
    println!("  active:     {}", go.active);
    println!("  born_frame: {}", go.born_frame_id);
    println!("  parent:     {}", go.parent_id.as_deref().unwrap_or("(none)"));
    println!("  children:   {}", go.children_ids.len());
    if let Some(ref anim_ref) = go.animation_ref {
        println!("  animation_ref: {:?}", anim_ref);
    }
    println!("  Components ({}):", go.components.len());
    for (comp_type, comp_kfs) in &go.components {
        println!("    [{}]:", comp_type);
        for (prop, kfs) in comp_kfs {
            println!("      {} ({} keyframes):", prop, kfs.len());
            for kf in kfs {
                println!("        frame={} value={:?} easing={:?}", kf.frame, kf.value, kf.easing);
            }
        }
    }
    Ok(())
}

/// Set a keyframe on a game object's component property.
/// Value format: "float:1.5" | "int:3" | "bool:true" | "string:hello" | "vec2:1.0,2.0" | "vec3:1.0,2.0,3.0" | "color:1.0,0.5,0.25,1.0"
pub fn set_keyframe(
    input: String,
    go_id: String,
    component: String,
    property: String,
    frame: u32,
    value: String,
    easing: Option<String>,
    scene_id: Option<String>,
) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    let go = scene
        .game_objects
        .get_mut(&go_id)
        .ok_or_else(|| anyhow::anyhow!("Game object '{}' not found", go_id))?;

    let prop_value = parse_value(&value)?;
    let easing_type = parse_easing(easing.as_deref())?;
    let kf = KeyFrame::new(frame, prop_value).with_easing(easing_type);
    go.set_keyframe(&component, &property, kf);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!(
        "✓ Set keyframe: go='{}' component='{}' property='{}' frame={} value='{}'",
        go_id, component, property, frame, value
    );
    Ok(())
}

/// Remove a keyframe from a game object's component property.
pub fn remove_keyframe(
    input: String,
    go_id: String,
    component: String,
    property: String,
    frame: u32,
    scene_id: Option<String>,
) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    let go = scene
        .game_objects
        .get_mut(&go_id)
        .ok_or_else(|| anyhow::anyhow!("Game object '{}' not found", go_id))?;

    if go.remove_keyframe(&component, &property, frame) {
        let out_bytes = serialize_project(&project)?;
        fs::write(&input, &out_bytes)?;
        println!(
            "✓ Removed keyframe at frame={} from go='{}' component='{}' property='{}'",
            frame, go_id, component, property
        );
    } else {
        bail!(
            "No keyframe at frame={} for go='{}' component='{}' property='{}'",
            frame, go_id, component, property
        );
    }
    Ok(())
}

/// Interpolate all component properties of a game object at a given frame and print the result.
pub fn interpolate(
    input: String,
    go_id: String,
    frame: u32,
    scene_id: Option<String>,
) -> Result<()> {
    use kernel_core::ecs::systems::interpolate_game_object;

    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let sid = resolve_scene(&project, &scene_id)?;
    let scene = project.scenes.get(&sid).unwrap();

    let go = scene
        .game_objects
        .get(&go_id)
        .ok_or_else(|| anyhow::anyhow!("Game object '{}' not found", go_id))?;

    let props = interpolate_game_object(go, frame);
    println!("Interpolated props for '{}' at frame {}:", go.name, frame);
    if props.is_empty() {
        println!("  (no interpolatable properties)");
        return Ok(());
    }
    for (comp, prop_map) in &props {
        println!("  [{}]:", comp);
        for (prop, val) in prop_map {
            println!("    {} = {:?}", prop, val);
        }
    }
    Ok(())
}

// ── Value parser ─────────────────────────────────────────────────────────────

fn parse_value(s: &str) -> Result<PropertyValue> {
    let (prefix, rest) = s
        .split_once(':')
        .ok_or_else(|| anyhow::anyhow!("Value must be <type>:<data>, e.g. float:1.5 or vec2:1.0,2.0"))?;

    match prefix {
        "float" | "f" => Ok(PropertyValue::Float(rest.parse()?)),
        "int" | "i" => Ok(PropertyValue::Int(rest.parse()?)),
        "bool" | "b" => Ok(PropertyValue::Bool(rest.parse()?)),
        "string" | "s" => Ok(PropertyValue::String(rest.to_string())),
        "vec2" => {
            let parts: Vec<f64> = rest
                .split(',')
                .map(|v| v.parse::<f64>())
                .collect::<std::result::Result<_, _>>()?;
            if parts.len() != 2 {
                bail!("vec2 requires exactly 2 components, e.g. vec2:1.0,2.0");
            }
            Ok(PropertyValue::Vec2(parts[0], parts[1]))
        }
        "vec3" => {
            let parts: Vec<f64> = rest
                .split(',')
                .map(|v| v.parse::<f64>())
                .collect::<std::result::Result<_, _>>()?;
            if parts.len() != 3 {
                bail!("vec3 requires exactly 3 components, e.g. vec3:1.0,2.0,3.0");
            }
            Ok(PropertyValue::Vec3(parts[0], parts[1], parts[2]))
        }
        "color" => {
            // Accept 0-255 integers: color:255,128,64,255
            let parts: Vec<u8> = rest
                .split(',')
                .map(|v| v.parse::<u8>())
                .collect::<std::result::Result<_, _>>()?;
            if parts.len() != 4 {
                bail!("color requires exactly 4 components (r,g,b,a as 0-255), e.g. color:255,128,64,255");
            }
            Ok(PropertyValue::Color(parts[0], parts[1], parts[2], parts[3]))
        }
        other => bail!("Unknown value type '{}'. Use float/int/bool/string/vec2/vec3/color", other),
    }
}

fn parse_easing(s: Option<&str>) -> Result<EasingType> {
    match s.unwrap_or("linear") {
        "linear" => Ok(EasingType::Linear),
        "step" => Ok(EasingType::Step),
        "ease-in" | "easein" => Ok(EasingType::EaseIn),
        "ease-out" | "easeout" => Ok(EasingType::EaseOut),
        "ease-in-out" | "easeinout" => Ok(EasingType::EaseInOut),
        bezier if bezier.starts_with("bezier:") => {
            let nums: Vec<f64> = bezier["bezier:".len()..]
                .split(',')
                .map(|v| v.parse::<f64>())
                .collect::<std::result::Result<_, _>>()?;
            if nums.len() != 4 {
                bail!("bezier easing requires 4 values: bezier:x1,y1,x2,y2");
            }
            Ok(EasingType::Bezier(nums[0], nums[1], nums[2], nums[3]))
        }
        other => bail!(
            "Unknown easing '{}'. Use: linear, step, ease-in, ease-out, ease-in-out, bezier:x1,y1,x2,y2",
            other
        ),
    }
}

