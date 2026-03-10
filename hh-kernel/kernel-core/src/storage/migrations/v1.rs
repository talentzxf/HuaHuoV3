//! Migration from schema v1 to the current in-memory `Project` type.
//!
//! ## Schema v1 binary format
//!
//! V1 `.hhk` files contain a raw `bincode` serialisation of the *old* `Project`
//! struct.  The old struct **did not** have the `files` field (introduced in v2).
//! All other fields are identical to the current `Project`.
//!
//! To keep bincode happy we deserialise v1 data into [`ProjectV1Compat`] – a
//! replica of the old struct – and then convert it to `Project`.

use std::collections::HashMap;
use serde::Deserialize;

use crate::project::element::ElementDef;
use crate::project::game_object::GameObjectData;
use crate::project::layer::Layer;
use crate::project::scene::Scene;
use crate::project::project::Project;

// ── V1 compat struct ──────────────────────────────────────────────────────────

/// Exact binary-layout replica of the `Project` struct as it existed in schema
/// v1 (before the `files` field was added).  Used only for deserialisation.
#[derive(Debug, Deserialize)]
pub struct ProjectV1Compat {
    pub id: String,
    pub name: String,
    pub fps: f64,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub total_frames: Option<u32>,
    pub animation_end_frame: Option<u32>,
    pub scene_ids: Vec<String>,
    pub scenes: HashMap<String, Scene>,
    pub current_scene_id: Option<String>,
    pub elements: HashMap<String, ElementDef>,
    pub sub_projects: HashMap<String, ProjectV1Compat>,
    pub created_at: i64,
    pub modified_at: i64,
}

// ── Conversion ────────────────────────────────────────────────────────────────

/// Convert a deserialised `ProjectV1Compat` to the current `Project`, adding
/// an empty `files` store.
pub fn project_from_v1(compat: ProjectV1Compat) -> Project {
    let sub_projects: HashMap<String, Project> = compat
        .sub_projects
        .into_iter()
        .map(|(k, sub)| (k, project_from_v1(sub)))
        .collect();

    Project {
        id: compat.id,
        name: compat.name,
        fps: compat.fps,
        canvas_width: compat.canvas_width,
        canvas_height: compat.canvas_height,
        total_frames: compat.total_frames,
        animation_end_frame: compat.animation_end_frame,
        scene_ids: compat.scene_ids,
        scenes: compat.scenes,
        current_scene_id: compat.current_scene_id,
        elements: compat.elements,
        sub_projects,
        files: HashMap::new(),
        created_at: compat.created_at,
        modified_at: compat.modified_at,
    }
}
