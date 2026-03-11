use crate::component_def::{BoxedComponentDef, ComponentDef};
use std::collections::HashMap;

/// Global registry of all known component types (built-in + user-defined).
///
/// Use `ComponentRegistry::global()` for the singleton, or create a local
/// registry for testing.
use std::sync::{Arc, Mutex};

pub struct ComponentRegistry {
    defs: HashMap<String, BoxedComponentDef>,
}

impl ComponentRegistry {
    pub fn new() -> Self {
        Self {
            defs: HashMap::new(),
        }
    }

    /// Register a component definition.
    pub fn register<C: ComponentDef>(&mut self, def: C) {
        self.defs.insert(def.type_name().to_string(), Box::new(def));
    }

    /// Look up a component definition by type name.
    pub fn get(&self, type_name: &str) -> Option<&dyn ComponentDef> {
        self.defs.get(type_name).map(|b| b.as_ref())
    }

    /// List all registered type names.
    pub fn type_names(&self) -> Vec<&str> {
        self.defs.keys().map(|s| s.as_str()).collect()
    }

    /// Check if a type is registered.
    pub fn contains(&self, type_name: &str) -> bool {
        self.defs.contains_key(type_name)
    }

    /// Global singleton access. Use ComponentRegistry::global() to get a
    /// shared Arc<Mutex<ComponentRegistry>> for simplicity in PoC; this avoids
    /// complex dependency injection during early prototyping.
    pub fn global() -> Arc<Mutex<ComponentRegistry>> {
        use std::sync::OnceLock;
        static GLOBAL: OnceLock<Arc<Mutex<ComponentRegistry>>> = OnceLock::new();
        GLOBAL.get_or_init(|| Arc::new(Mutex::new(ComponentRegistry::new()))).clone()
    }
}

impl Default for ComponentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

