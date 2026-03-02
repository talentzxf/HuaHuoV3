use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::project::layer::Layer;
use crate::project::game_object::GameObjectData;

/// A scene contains layers and game objects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub id: String,
    pub name: String,
    /// Duration in seconds
    pub duration: f64,
    /// Frames per second for this scene
    pub fps: f64,
    /// Ordered layer IDs
    pub layer_ids: Vec<String>,
    pub layers: HashMap<String, Layer>,
    pub game_objects: HashMap<String, GameObjectData>,
}

impl Scene {
    pub fn new(id: String, name: String, fps: f64, duration: f64) -> Self {
        Self {
            id,
            name,
            duration,
            fps,
            layer_ids: vec![],
            layers: HashMap::new(),
            game_objects: HashMap::new(),
        }
    }

    pub fn total_frames(&self) -> u32 {
        (self.fps * self.duration).round() as u32
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.layer_ids.push(layer.id.clone());
        self.layers.insert(layer.id.clone(), layer);
    }

    pub fn add_game_object(&mut self, layer_id: &str, go: GameObjectData) {
        if let Some(layer) = self.layers.get_mut(layer_id) {
            layer.game_object_ids.push(go.id.clone());
        }
        self.game_objects.insert(go.id.clone(), go);
    }
}

