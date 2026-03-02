use hecs::{Entity, World};
use std::collections::HashMap;
use crate::ecs::components::builtin::{EntityName, BornFrame, Active, Transform, Visual};

/// The central ECS world for a single scene.
/// Wraps `hecs::World` and provides convenience methods aligned
/// with the HuaHuo animation model.
pub struct KernelWorld {
    pub inner: World,
    /// Maps string IDs (from JS/nanoid) to hecs Entity handles
    pub id_to_entity: HashMap<String, Entity>,
    /// Reverse map
    pub entity_to_id: HashMap<Entity, String>,
}

impl KernelWorld {
    pub fn new() -> Self {
        Self {
            inner: World::new(),
            id_to_entity: HashMap::new(),
            entity_to_id: HashMap::new(),
        }
    }

    /// Spawn a new game object entity and register its string ID.
    pub fn spawn_game_object(
        &mut self,
        id: String,
        name: String,
        born_frame: u32,
    ) -> Entity {
        let entity = self.inner.spawn((
            EntityName(name),
            BornFrame(born_frame),
            Active(true),
            Transform::default(),
            Visual::default(),
        ));
        self.id_to_entity.insert(id.clone(), entity);
        self.entity_to_id.insert(entity, id);
        entity
    }

    /// Look up an entity by its string ID.
    pub fn entity_by_id(&self, id: &str) -> Option<Entity> {
        self.id_to_entity.get(id).copied()
    }

    /// Get the string ID for an entity.
    pub fn id_for_entity(&self, entity: Entity) -> Option<&str> {
        self.entity_to_id.get(&entity).map(|s| s.as_str())
    }

    /// Despawn an entity and remove its ID mappings.
    pub fn despawn(&mut self, id: &str) -> bool {
        if let Some(entity) = self.id_to_entity.remove(id) {
            self.entity_to_id.remove(&entity);
            let _ = self.inner.despawn(entity);
            true
        } else {
            false
        }
    }

    /// Return all entity IDs whose `BornFrame` <= `current_frame` and `Active` is true.
    pub fn active_entities_at_frame(&self, current_frame: u32) -> Vec<String> {
        let mut result = Vec::new();
        for (entity, (born, active)) in self.inner.query::<(&BornFrame, &Active)>().iter() {
            if active.0 && born.0 <= current_frame {
                if let Some(id) = self.entity_to_id.get(&entity) {
                    result.push(id.clone());
                }
            }
        }
        result
    }
}

impl Default for KernelWorld {
    fn default() -> Self {
        Self::new()
    }
}

