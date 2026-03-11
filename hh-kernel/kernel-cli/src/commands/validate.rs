use anyhow::Result;
use kernel_core::storage::deserialize_project;
use std::fs;

pub fn run(input: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    match deserialize_project(&bytes) {
        Ok(project) => {
            println!("✓ Valid HuaHuo project file");
            println!("  Name: {}", project.name);
            println!("  ID: {}", project.id);
            println!("  Scenes: {}", project.scenes.len());
            println!("  FPS: {}", project.fps);
            println!("  Canvas: {}x{}", project.canvas_width, project.canvas_height);
            Ok(())
        }
        Err(e) => {
            println!("✗ Invalid project file: {}", e);
            std::process::exit(1);
        }
    }
}

