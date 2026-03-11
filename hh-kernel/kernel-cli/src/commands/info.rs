use anyhow::Result;
use kernel_core::storage::deserialize_project;
use std::fs;

pub fn run(input: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    println!("Project: {}", project.name);
    println!("  ID:           {}", project.id);
    println!("  FPS:          {}", project.fps);
    println!("  Canvas:       {}x{}", project.canvas_width, project.canvas_height);
    println!("  Total Frames: {}", project.effective_total_frames());
    println!("  Scenes:       {}", project.scenes.len());

    for scene_id in &project.scene_ids {
        if let Some(scene) = project.scenes.get(scene_id) {
            let go_count: usize = scene.game_objects.len();
            let kf_count: usize = scene.game_objects.values()
                .flat_map(|go| go.components.values())
                .flat_map(|comp| comp.values())
                .map(|kfs| kfs.len())
                .sum();
            println!(
                "  Scene '{}': {} layers, {} game objects, {} keyframes total",
                scene.name,
                scene.layers.len(),
                go_count,
                kf_count,
            );
        }
    }

    if !project.sub_projects.is_empty() {
        println!("  Embedded sub-projects: {}", project.sub_projects.len());
    }

    Ok(())
}

