//! All event types emitted by the kernel.

use serde::{Deserialize, Serialize};

// ── Top-level event ───────────────────────────────────────────────────────────

/// Every event the kernel can emit.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "category", rename_all = "snake_case")]
pub enum HhEvent {
    Project(ProjectEvent),
    Scene(SceneEvent),
    Layer(LayerEvent),
    GameObject(GameObjectEvent),
    Component(ComponentEvent),
    Keyframe(KeyframeEvent),
    Playback(PlaybackEvent),
    Element(ElementEvent),
}

impl HhEvent {
    /// The top-level category string, used for topic matching.
    pub fn category(&self) -> &'static str {
        match self {
            HhEvent::Project(_)    => "project",
            HhEvent::Scene(_)      => "scene",
            HhEvent::Layer(_)      => "layer",
            HhEvent::GameObject(_) => "go",
            HhEvent::Component(_)  => "component",
            HhEvent::Keyframe(_)   => "keyframe",
            HhEvent::Playback(_)   => "playback",
            HhEvent::Element(_)    => "element",
        }
    }
}

// ── Project ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEvent {
    pub project_id: String,
    pub kind: ProjectEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectEventKind {
    Created,
    Loaded,
    Saved,
    FpsChanged,
    SizeChanged,
    TotalFramesChanged,
}

// ── Scene ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneEvent {
    pub scene_id: String,
    pub scene_name: String,
    pub kind: SceneEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneEventKind {
    Created,
    Removed,
    Renamed,
    FpsChanged,
    DurationChanged,
    BecameCurrent,
}

// ── Layer ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerEvent {
    pub scene_id: String,
    pub layer_id: String,
    pub layer_name: String,
    pub kind: LayerEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LayerEventKind {
    Created,
    Removed,
    Renamed,
    VisibilityChanged,
    LockChanged,
    OrderChanged,
}

// ── GameObject ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameObjectEvent {
    pub scene_id: String,
    pub layer_id: String,
    pub go_id: String,
    pub go_name: String,
    pub kind: GoEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GoEventKind {
    Created,
    Deleted,
    Renamed,
    ActiveChanged,
    BornFrameChanged,
    Moved,          // reparented to another layer
}

// ── Component ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentEvent {
    pub go_id: String,
    pub go_name: String,
    pub comp_type: String,
    pub kind: ComponentEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ComponentEventKind {
    Added,
    Removed,
    EnabledChanged,
}

// ── Keyframe ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyframeEvent {
    pub go_id: String,
    pub go_name: String,
    pub comp_type: String,
    pub prop_name: String,
    pub frame: u32,
    pub kind: KeyframeEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum KeyframeEventKind {
    Set,
    Removed,
}

// ── Playback ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackEvent {
    pub frame: u32,
    pub kind: PlaybackEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlaybackEventKind {
    Started,
    Paused,
    Stopped,
    FrameChanged,
    LoopedBack,
    ReachedEnd,
}

// ── Element ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementEvent {
    pub element_id: String,
    pub element_name: String,
    pub kind: ElementEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ElementEventKind {
    Created,
    Removed,
    Renamed,
    LayerAdded,
    LayerRemoved,
    GoAdded,
    GoRemoved,
    Instantiated,   // an instance was placed in a scene/element
}

