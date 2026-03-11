use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::ecs::components::keyframe::KeyFrame;

/// A timeline clip: a contiguous range of frames on a layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineClip {
    pub id: String,
    pub start_frame: u32,
    pub end_frame: u32,
}

/// Per-property keyframe storage for one component instance.
/// Key = property name (e.g. "position", "rotation").
pub type ComponentKeyFrames = HashMap<String, Vec<KeyFrame>>;

/// A game object in the scene (data layer - no hecs::Entity here for serialization).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameObjectData {
    pub id: String,
    pub name: String,
    pub active: bool,
    pub born_frame_id: u32,
    pub parent_id: Option<String>,
    pub children_ids: Vec<String>,
    /// component_type -> ComponentKeyFrames
    pub components: HashMap<String, ComponentKeyFrames>,
    /// If this object embeds another animation
    pub animation_ref: Option<crate::ecs::components::builtin::AnimationRef>,
}

impl GameObjectData {
    pub fn new(id: String, name: String, born_frame: u32) -> Self {
        Self {
            id,
            name,
            active: true,
            born_frame_id: born_frame,
            parent_id: None,
            children_ids: vec![],
            components: HashMap::new(),
            animation_ref: None,
        }
    }

    /// Add or update a keyframe for a specific component property.
    pub fn set_keyframe(
        &mut self,
        component_type: &str,
        prop_name: &str,
        keyframe: KeyFrame,
    ) {
        let comp_kfs = self.components
            .entry(component_type.to_string())
            .or_default();
        let prop_kfs = comp_kfs
            .entry(prop_name.to_string())
            .or_default();

        // Insert in sorted order by frame
        let pos = prop_kfs.partition_point(|kf| kf.frame < keyframe.frame);
        if pos < prop_kfs.len() && prop_kfs[pos].frame == keyframe.frame {
            prop_kfs[pos] = keyframe; // overwrite
        } else {
            prop_kfs.insert(pos, keyframe);
        }
    }

    /// Remove a keyframe at a specific frame for a component property.
    pub fn remove_keyframe(
        &mut self,
        component_type: &str,
        prop_name: &str,
        frame: u32,
    ) -> bool {
        if let Some(comp_kfs) = self.components.get_mut(component_type) {
            if let Some(prop_kfs) = comp_kfs.get_mut(prop_name) {
                if let Some(pos) = prop_kfs.iter().position(|kf| kf.frame == frame) {
                    prop_kfs.remove(pos);
                    return true;
                }
            }
        }
        false
    }
}

