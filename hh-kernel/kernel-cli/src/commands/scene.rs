use anyhow::{bail, Result};
use kernel_core::storage::{deserialize_project, serialize_project};
use kernel_core::Scene;
use nanoid::nanoid;
use std::fs;

/// Add a new scene to an existing project.
pub fn add(input: String, name: String, fps: Option<f64>, duration: Option<f64>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    let scene_fps = fps.unwrap_or(project.fps);
    let scene_dur = duration.unwrap_or(5.0);
    let scene_id = nanoid!();
    let scene = Scene::new(scene_id.clone(), name.clone(), scene_fps, scene_dur);
    project.add_scene(scene);

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Added scene '{}' (id: {}) to '{}'", name, scene_id, input);
    Ok(())
}

/// List all scenes in a project.
pub fn list(input: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    println!("Scenes in '{}' ({}):", project.name, input);
    if project.scene_ids.is_empty() {
        println!("  (none)");
        return Ok(());
    }
    for id in &project.scene_ids {
        if let Some(s) = project.scenes.get(id) {
            let current = project.current_scene_id.as_deref() == Some(id);
            println!(
                "  [{}{}] name='{}' fps={} duration={}s frames={} layers={}",
                id,
                if current { " *current*" } else { "" },
                s.name,
                s.fps,
                s.duration,
                s.total_frames(),
                s.layers.len(),
            );
        }
    }
    Ok(())
}

/// Set the current scene of a project.
pub fn set_current(input: String, scene_id: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    if !project.scenes.contains_key(&scene_id) {
        bail!("Scene '{}' not found in project", scene_id);
    }
    project.current_scene_id = Some(scene_id.clone());

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Current scene set to '{}'", scene_id);
    Ok(())
}

/// Remove a scene from a project.
pub fn remove(input: String, scene_id: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    let mut project = deserialize_project(&bytes)?;

    if !project.scenes.contains_key(&scene_id) {
        bail!("Scene '{}' not found", scene_id);
    }
    project.scenes.remove(&scene_id);
    project.scene_ids.retain(|id| id != &scene_id);
    if project.current_scene_id.as_deref() == Some(&scene_id) {
        project.current_scene_id = project.scene_ids.first().cloned();
    }

    let out_bytes = serialize_project(&project)?;
    fs::write(&input, &out_bytes)?;
    println!("✓ Removed scene '{}'", scene_id);
    Ok(())
}

