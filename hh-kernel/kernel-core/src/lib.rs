//! # kernel-core
//!
//! The ECS core for HuaHuo animation engine.
//! Provides:
//! - ECS world with built-in components (Transform, Visual, Timeline, AnimationRef)
//! - Keyframe storage and interpolation
//! - Project/Scene/Layer/GameObject data model
//! - Binary serialization with versioning

pub mod ecs;
pub mod event;
pub mod project;
pub mod storage;

pub use ecs::{
    components::{builtin::*, keyframe::*},
    systems::{interpolate_game_object, interpolate_scene_at_frame, InterpolatedProps, PlaybackState},
    KernelWorld,
};

// PoC bridge export - application layers can call into these helper functions
pub mod bridge;
pub use bridge::component_bridge::call_on_tick_for_go;

pub use event::{EventBus, HhEvent};
pub use project::{GameObjectData, Layer, Project, Scene, FileEntry};
pub use storage::{deserialize_project, serialize_project};

