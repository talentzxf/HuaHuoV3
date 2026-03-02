use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::project::scene::Scene;

/// The top-level project container.
/// A project can embed sub-projects (for self-contained animation elements).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub fps: f64,
    pub canvas_width: u32,
    pub canvas_height: u32,
    /// Total frames override (if None, derived from scenes)
    pub total_frames: Option<u32>,
    /// Frame where animation ends (for playback stopping)
    pub animation_end_frame: Option<u32>,
    /// Ordered scene IDs
    pub scene_ids: Vec<String>,
    pub scenes: HashMap<String, Scene>,
    pub current_scene_id: Option<String>,
    /// Embedded sub-projects (for AnimationRef / self-embedding)
    pub sub_projects: HashMap<String, Project>,
    pub created_at: i64,
    pub modified_at: i64,
}

impl Project {
    pub fn new(id: String, name: String, fps: f64, canvas_width: u32, canvas_height: u32) -> Self {
        let now = chrono_now();
        Self {
            id,
            name,
            fps,
            canvas_width,
            canvas_height,
            total_frames: None,
            animation_end_frame: None,
            scene_ids: vec![],
            scenes: HashMap::new(),
            current_scene_id: None,
            sub_projects: HashMap::new(),
            created_at: now,
            modified_at: now,
        }
    }

    pub fn add_scene(&mut self, scene: Scene) {
        if self.current_scene_id.is_none() {
            self.current_scene_id = Some(scene.id.clone());
        }
        self.scene_ids.push(scene.id.clone());
        self.scenes.insert(scene.id.clone(), scene);
    }

    pub fn current_scene(&self) -> Option<&Scene> {
        self.current_scene_id.as_ref().and_then(|id| self.scenes.get(id))
    }

    pub fn current_scene_mut(&mut self) -> Option<&mut Scene> {
        let id = self.current_scene_id.clone()?;
        self.scenes.get_mut(&id)
    }

    /// Effective total frames: explicit override or derived from all scenes.
    pub fn effective_total_frames(&self) -> u32 {
        if let Some(tf) = self.total_frames {
            return tf;
        }
        self.scenes.values()
            .map(|s| s.total_frames())
            .max()
            .unwrap_or(120)
    }

    /// Embed a sub-project (for AnimationRef).
    /// Returns false if the project_id already exists or would create a cycle.
    pub fn embed_sub_project(&mut self, sub: Project, max_depth: usize) -> bool {
        if max_depth == 0 {
            return false; // cycle protection
        }
        if self.sub_projects.contains_key(&sub.id) {
            return false;
        }
        self.sub_projects.insert(sub.id.clone(), sub);
        true
    }
}

fn chrono_now() -> i64 {
    // Simple timestamp - wall clock in ms
    // In WASM/no-std environments, this will be overridden
    0 // placeholder; actual time provided by host
}

