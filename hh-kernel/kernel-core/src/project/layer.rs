use serde::{Deserialize, Serialize};
use crate::project::game_object::TimelineClip;

/// A layer contains game objects and has its own timeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    /// Ordered list of game object IDs in this layer
    pub game_object_ids: Vec<String>,
    /// Timeline clips (merged frame ranges)
    pub clips: Vec<TimelineClip>,
    /// Layer-level keyframes (which game objects exist at each frame)
    pub keyframes: Vec<LayerKeyFrame>,
}

/// Records which game objects are alive at a specific frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerKeyFrame {
    pub frame: u32,
    pub game_object_ids: Vec<String>,
}

impl Layer {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            visible: true,
            locked: false,
            game_object_ids: vec![],
            clips: vec![],
            keyframes: vec![],
        }
    }
}
