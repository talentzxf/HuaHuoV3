// Placeholder for protoc-generated code.
// When protoc is available, build.rs will regenerate this.
// These are hand-written stubs that mirror the .proto definitions.

use serde::{Deserialize, Serialize};

// ─── Shared types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Vec2Proto {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ColorProto {
    pub r: u32,
    pub g: u32,
    pub b: u32,
    pub a: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "easing_type")]
pub enum EasingTypeProto {
    Step,
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bezier { x1: f64, y1: f64, x2: f64, y2: f64 },
}

impl Default for EasingTypeProto {
    fn default() -> Self { EasingTypeProto::Linear }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum PropertyValueProto {
    Float(f64),
    Vec2(Vec2Proto),
    Color(ColorProto),
    Bool(bool),
    String(String),
    Int(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFrameProto {
    pub frame: u32,
    pub value: PropertyValueProto,
    pub easing: EasingTypeProto,
}

// ─── Commands ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd")]
pub enum CommandEnvelope {
    CreateProject(CreateProjectCmd),
    LoadProject(LoadProjectCmd),
    SaveProject,
    CreateScene(CreateSceneCmd),
    CreateLayer(CreateLayerCmd),
    CreateGameObject(CreateGameObjectCmd),
    DeleteGameObject(DeleteGameObjectCmd),
    SetGameObjectActive(SetGameObjectActiveCmd),
    SetKeyFrame(SetKeyFrameCmd),
    RemoveKeyFrame(RemoveKeyFrameCmd),
    MergeKeyFrames(MergeKeyFramesCmd),
    Play,
    Pause,
    Stop,
    SetCurrentFrame(SetCurrentFrameCmd),
    EmbedAnimation(EmbedAnimationCmd),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectCmd {
    pub name: String,
    pub fps: f64,
    pub canvas_width: u32,
    pub canvas_height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadProjectCmd {
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSceneCmd {
    pub name: String,
    pub fps: f64,
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLayerCmd {
    pub scene_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGameObjectCmd {
    pub layer_id: String,
    pub name: String,
    pub born_frame: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteGameObjectCmd {
    pub game_object_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetGameObjectActiveCmd {
    pub game_object_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetKeyFrameCmd {
    pub game_object_id: String,
    pub component_type: String,
    pub prop_name: String,
    pub keyframe: KeyFrameProto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveKeyFrameCmd {
    pub game_object_id: String,
    pub component_type: String,
    pub prop_name: String,
    pub frame: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeKeyFramesCmd {
    pub game_object_id: String,
    pub component_type: String,
    pub prop_name: String,
    pub start_frame: u32,
    pub end_frame: u32,
    pub strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetCurrentFrameCmd {
    pub frame: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedAnimationCmd {
    pub target_game_object_id: String,
    pub sub_project_data: Vec<u8>,
    pub start_frame: u32,
    pub time_scale: f64,
    pub loop_playback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    pub ok: bool,
    pub error: String,
    pub created_id: String,
    pub payload: Vec<u8>,
}

impl CommandResponse {
    pub fn ok_empty() -> Self {
        Self { ok: true, error: String::new(), created_id: String::new(), payload: vec![] }
    }
    pub fn ok_with_id(id: String) -> Self {
        Self { ok: true, error: String::new(), created_id: id, payload: vec![] }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, error: msg.into(), created_id: String::new(), payload: vec![] }
    }
}

// ─── Queries ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "query")]
pub enum QueryEnvelope {
    GetProject,
    GetScene { scene_id: String },
    GetGameObject { game_object_id: String },
    GetInterpolatedProps { game_object_id: String, frame: u32 },
    GetActiveGameObjects { scene_id: String, frame: u32 },
    GetPlaybackState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStateResult {
    pub current_frame: u32,
    pub is_playing: bool,
    pub fps: f64,
    pub total_frames: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    pub ok: bool,
    pub error: String,
    pub payload: Vec<u8>,
}

impl QueryResponse {
    pub fn ok(payload: Vec<u8>) -> Self {
        Self { ok: true, error: String::new(), payload }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, error: msg.into(), payload: vec![] }
    }
}

// ─── Events ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event")]
pub enum EventEnvelope {
    ProjectLoaded { project_id: String, project_name: String },
    GameObjectCreated { game_object_id: String, name: String, layer_id: String, born_frame: u32 },
    GameObjectDeleted { game_object_id: String },
    KeyFrameUpdated { game_object_id: String, component_type: String, prop_name: String, frame: u32 },
    FrameAdvanced { frame: u32 },
    PlaybackStarted,
    PlaybackStopped { final_frame: u32 },
}

