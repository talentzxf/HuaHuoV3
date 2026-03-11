//! An **Element** is a self-contained, reusable animation unit.
//!
//! Think of it as an "internal sub-project" that lives inside the parent
//! `Project`.  It has its own layers and game objects, its own timeline
//! (duration / fps), and can be **instantiated** at multiple places inside
//! any scene layer via an [`ElementInstance`] component on a `GameObjectData`.
//!
//! ## Structure
//!
//! ```text
//! Project
//! └── elements: HashMap<id, ElementDef>   ← library of reusable elements
//! └── scenes[]
//!     └── layers[]
//!         └── GameObjectData
//!             └── component "ElementInstance" → element_id + overrides
//! ```
//!
//! ## Key design choices
//!
//! * The **definition** (`ElementDef`) stores geometry; instances only store
//!   *overrides* (transform, time-offset, speed scale, …).
//! * An element may itself reference other elements (nesting), but cycles
//!   are forbidden and detected at validation time.
//! * Elements are serialised as part of the parent `Project` (not separate
//!   files), so the whole project remains a single `.hhk` blob.  If you want
//!   a *shareable* element, export the project that contains only that element.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::project::layer::Layer;
use crate::project::game_object::GameObjectData;

// ── Element definition ────────────────────────────────────────────────────────

/// A reusable animation element definition stored in `Project::elements`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementDef {
    pub id: String,
    pub name: String,

    /// Natural size of the element canvas (used for scaling calculations).
    pub width: f64,
    pub height: f64,

    /// Duration of one full playback cycle (seconds).
    pub duration: f64,

    /// Native frame-rate of this element.
    pub fps: f64,

    /// Ordered layer IDs (bottom → top).
    pub layer_ids: Vec<String>,
    pub layers: HashMap<String, Layer>,

    /// All game objects belonging to this element (indexed by id).
    pub game_objects: HashMap<String, GameObjectData>,

    /// Human-readable description / notes.
    pub description: String,
}

impl ElementDef {
    pub fn new(
        id: String,
        name: String,
        width: f64,
        height: f64,
        fps: f64,
        duration: f64,
    ) -> Self {
        Self {
            id,
            name,
            width,
            height,
            duration,
            fps,
            layer_ids: vec![],
            layers: HashMap::new(),
            game_objects: HashMap::new(),
            description: String::new(),
        }
    }

    pub fn total_frames(&self) -> u32 {
        (self.fps * self.duration).round() as u32
    }

    /// Add a layer to this element.
    pub fn add_layer(&mut self, layer: Layer) {
        self.layer_ids.push(layer.id.clone());
        self.layers.insert(layer.id.clone(), layer);
    }

    /// Add a game object to a layer inside this element.
    pub fn add_game_object(&mut self, layer_id: &str, go: GameObjectData) {
        if let Some(layer) = self.layers.get_mut(layer_id) {
            layer.game_object_ids.push(go.id.clone());
        }
        self.game_objects.insert(go.id.clone(), go);
    }
}

// ── Element instance component ────────────────────────────────────────────────

/// Component placed on a `GameObjectData` to make it an *instance* of an
/// `ElementDef`.
///
/// The instance can override the element's intrinsic transform, control
/// playback timing, and pass key-value parameters to the element.
///
/// Because this is just another component type in `GameObjectData::components`,
/// its properties can be keyframe-animated exactly like any other component.
///
/// ### Animatable properties (stored as keyframes in the parent GO)
///
/// | Property key         | Type    | Default   | Description                        |
/// |----------------------|---------|-----------|------------------------------------|
/// | `position`           | Vec2    | (0, 0)    | Instance offset in scene space     |
/// | `rotation`           | Float   | 0.0       | Rotation in degrees                |
/// | `scale_x`            | Float   | 1.0       | Horizontal scale                   |
/// | `scale_y`            | Float   | 1.0       | Vertical scale                     |
/// | `opacity`            | Float   | 1.0       | Overall opacity 0-1                |
/// | `time_offset`        | Float   | 0.0       | Shift element timeline by N frames |
/// | `speed_scale`        | Float   | 1.0       | Playback speed multiplier          |
/// | `loop_playback`      | Bool    | false     | Whether to loop when duration ends |
///
/// ### Non-animatable (static) fields stored here
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementInstance {
    /// ID of the `ElementDef` in `Project::elements`.
    pub element_id: String,

    /// Whether to loop element playback when it reaches its duration.
    pub loop_playback: bool,

    /// Time offset in frames (static default; can be overridden by keyframe).
    pub time_offset: f64,

    /// Speed scale (static default; can be overridden by keyframe).
    pub speed_scale: f64,

    /// Arbitrary key-value parameters passed into the element.
    /// Useful for parameterised / template elements.
    pub params: HashMap<String, String>,
}

impl ElementInstance {
    pub fn new(element_id: String) -> Self {
        Self {
            element_id,
            loop_playback: false,
            time_offset: 0.0,
            speed_scale: 1.0,
            params: HashMap::new(),
        }
    }

    /// The component type string used in `GameObjectData::components`.
    pub const COMPONENT_TYPE: &'static str = "ElementInstance";
}

// ── Cycle detection ───────────────────────────────────────────────────────────

/// Walk the element dependency graph and return `Err(cycle_path)` if a cycle
/// is detected.
///
/// `elements` is the full library.  `root_id` is the element to check.
pub fn detect_element_cycle(
    elements: &HashMap<String, ElementDef>,
    root_id: &str,
) -> Result<(), Vec<String>> {
    let mut visited: Vec<String> = vec![];
    check_cycle(elements, root_id, &mut visited)
}

fn check_cycle(
    elements: &HashMap<String, ElementDef>,
    current_id: &str,
    path: &mut Vec<String>,
) -> Result<(), Vec<String>> {
    if path.contains(&current_id.to_string()) {
        let mut cycle = path.clone();
        cycle.push(current_id.to_string());
        return Err(cycle);
    }

    path.push(current_id.to_string());

    if let Some(elem) = elements.get(current_id) {
        // Collect all element_ids referenced by any game object in this element
        for go in elem.game_objects.values() {
            if let Some(kfs) = go.components.get(ElementInstance::COMPONENT_TYPE) {
                // The element_id is stored in the static `ElementInstance` struct,
                // not in keyframes.  We store the element_id as a special
                // "element_id" pseudo-keyframe with a String value at frame 0
                // so it's accessible here.
                if let Some(frames) = kfs.get("element_id") {
                    if let Some(kf) = frames.first() {
                        if let kernel_sdk::property::PropertyValue::String(ref eid) = kf.value {
                            check_cycle(elements, eid, path)?;
                        }
                    }
                }
            }
        }
    }

    path.pop();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_element_def_total_frames() {
        let e = ElementDef::new("e1".into(), "Test".into(), 100.0, 100.0, 30.0, 2.0);
        assert_eq!(e.total_frames(), 60);
    }

    #[test]
    fn test_element_instance_component_type() {
        assert_eq!(ElementInstance::COMPONENT_TYPE, "ElementInstance");
    }

    #[test]
    fn test_no_cycle() {
        let mut elements = HashMap::new();
        elements.insert("e1".into(), ElementDef::new("e1".into(), "E1".into(), 100.0, 100.0, 30.0, 1.0));
        elements.insert("e2".into(), ElementDef::new("e2".into(), "E2".into(), 100.0, 100.0, 30.0, 1.0));
        assert!(detect_element_cycle(&elements, "e1").is_ok());
    }
}

