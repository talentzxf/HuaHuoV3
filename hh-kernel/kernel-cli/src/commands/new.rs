use anyhow::Result;
use kernel_core::{Project, Scene, Layer};
use kernel_core::storage::serialize_project;
use nanoid::nanoid;
use std::fs;

pub fn run(name: String, output: String, fps: f64, width: u32, height: u32) -> Result<()> {
    println!("Creating project '{}' ...", name);

    let id = nanoid!();
    let mut project = Project::new(id.clone(), name.clone(), fps, width, height);

    let scene_id = nanoid!();
    let mut scene = Scene::new(scene_id, "DefaultScene".to_string(), fps, 5.0);
    scene.add_layer(Layer::new(nanoid!(), "background".to_string()));
    scene.add_layer(Layer::new(nanoid!(), "drawing".to_string()));
    project.add_scene(scene);

    let bytes = serialize_project(&project)?;
    fs::write(&output, &bytes)?;

    println!(
        "✓ Created project '{}' (id: {})\n  Saved to: {}\n  Size: {} bytes\n  FPS: {}, Canvas: {}x{}",
        name, id, output, bytes.len(), fps, width, height
    );
    Ok(())
}

