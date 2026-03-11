//! Schema version 1 - the initial stable format.
//! This is a flat serde-serializable mirror of the `kernel-core` data model.
//! Stored as bincode after the 16-byte envelope header.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Keyframe easing type (stable enum - add new variants at end only)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum V1EasingType {
    Step,
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bezier { x1: f64, y1: f64, x2: f64, y2: f64 },
}

/// Property value (stable enum - add new variants at end only)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum V1PropertyValue {
    Float(f64),
    Vec2 { x: f64, y: f64 },
    Vec3 { x: f64, y: f64, z: f64 },
    Color { r: u8, g: u8, b: u8, a: u8 },
    Bool(bool),
    String(String),
    Int(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1KeyFrame {
    pub frame: u32,
    pub value: V1PropertyValue,
    pub easing: V1EasingType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1TimelineClip {
    pub id: String,
    pub start_frame: u32,
    pub end_frame: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1LayerKeyFrame {
    pub frame: u32,
    pub game_object_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1AnimationRef {
    pub project_id: String,
    pub start_frame: u32,
    pub time_scale: f64,
    pub loop_playback: bool,
}

/// Serializable component: type -> prop_name -> keyframes
pub type V1ComponentData = HashMap<String, Vec<V1KeyFrame>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1GameObject {
    pub id: String,
    pub name: String,
    pub active: bool,
    pub born_frame_id: u32,
    pub parent_id: Option<String>,
    pub children_ids: Vec<String>,
    pub components: HashMap<String, V1ComponentData>,
    pub animation_ref: Option<V1AnimationRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1Layer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub game_object_ids: Vec<String>,
    pub clips: Vec<V1TimelineClip>,
    pub keyframes: Vec<V1LayerKeyFrame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V1Scene {
    pub id: String,
    pub name: String,
    pub duration: f64,
    pub fps: f64,
    pub layer_ids: Vec<String>,
    pub layers: HashMap<String, V1Layer>,
    pub game_objects: HashMap<String, V1GameObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaV1Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub fps: f64,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub total_frames: Option<u32>,
    pub animation_end_frame: Option<u32>,
    pub scene_ids: Vec<String>,
    pub scenes: HashMap<String, V1Scene>,
    pub current_scene_id: Option<String>,
    /// Embedded sub-projects (self-nesting for AnimationRef)
    pub sub_projects: HashMap<String, SchemaV1Project>,
    pub created_at: i64,
    pub modified_at: i64,
}

