use anyhow::{bail, Result};
use kernel_core::storage::{deserialize_project, serialize_project};
use kernel_core::Layer;
use nanoid::nanoid;
use std::fs;

fn get_scene_id(project: &kernel_core::Project, scene_id: &Option<String>) -> Result<String> {
    if let Some(id) = scene_id {
        if !project.scenes.contains_key(id.as_str()) {
            bail!("Scene '{}' not found", id);
        }
        Ok(id.clone())
    } else {
        project
            .current_scene_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("No current scene. Use --scene-id or set a current scene first."))
    }
}

/// Add a new layer to a scene.
pub fn add(input: String, name: String, scene_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = get_scene_id(&project, &scene_id)?;
    let layer_id = nanoid!();
    let layer = Layer::new(layer_id.clone(), name.clone());

    let scene = project.scenes.get_mut(&sid).unwrap();
    scene.add_layer(layer);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Added layer '{}' (id: {}) to scene '{}'", name, layer_id, sid);
    Ok(())
}

/// List all layers in a scene.
pub fn list(input: String, scene_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let sid = get_scene_id(&project, &scene_id)?;
    let scene = project.scenes.get(&sid).unwrap();

    println!("Layers in scene '{}' ({}):", scene.name, sid);
    if scene.layer_ids.is_empty() {
        println!("  (none)");
        return Ok(());
    }
    for lid in &scene.layer_ids {
        if let Some(l) = scene.layers.get(lid) {
            println!(
                "  [{}] name='{}' visible={} locked={} objects={} clips={} keyframes={}",
                lid,
                l.name,
                l.visible,
                l.locked,
                l.game_object_ids.len(),
                l.clips.len(),
                l.keyframes.len(),
            );
        }
    }
    Ok(())
}

/// Remove a layer from a scene.
pub fn remove(input: String, layer_id: String, scene_id: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = get_scene_id(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    if !scene.layers.contains_key(&layer_id) {
        bail!("Layer '{}' not found in scene '{}'", layer_id, sid);
    }
    // Remove game objects belonging to this layer
    let go_ids: Vec<String> = scene
        .layers
        .get(&layer_id)
        .map(|l| l.game_object_ids.clone())
        .unwrap_or_default();
    for go_id in go_ids {
        scene.game_objects.remove(&go_id);
    }
    scene.layers.remove(&layer_id);
    scene.layer_ids.retain(|id| id != &layer_id);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Removed layer '{}' from scene '{}'", layer_id, sid);
    Ok(())
}

/// Set layer visibility or lock state.
pub fn set_prop(
    input: String,
    layer_id: String,
    scene_id: Option<String>,
    visible: Option<bool>,
    locked: Option<bool>,
) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let sid = get_scene_id(&project, &scene_id)?;
    let scene = project.scenes.get_mut(&sid).unwrap();

    let layer = scene
        .layers
        .get_mut(&layer_id)
        .ok_or_else(|| anyhow::anyhow!("Layer '{}' not found", layer_id))?;

    if let Some(v) = visible {
        layer.visible = v;
    }
    if let Some(l) = locked {
        layer.locked = l;
    }

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Updated layer '{}' properties", layer_id);
    Ok(())
}

