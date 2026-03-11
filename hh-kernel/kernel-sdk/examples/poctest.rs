use kernel_sdk::{ComponentDef, ComponentData, PropertyMap, PropertyValue, PropertyMeta, ComponentRegistry};
use std::collections::HashMap;

struct LoggingComp;
impl ComponentDef for LoggingComp {
    fn type_name(&self) -> &str { "Logging" }
    fn property_metas(&self) -> Vec<PropertyMeta> { vec![] }
    fn default_props(&self) -> PropertyMap { HashMap::new() }
    fn on_add(&self, props: &mut PropertyMap) {
        eprintln!("[PoC] LoggingComp on_add called with props: {:?}", props);
    }
    fn on_tick(&self, props: &mut PropertyMap, frame: u32, dt: f64) {
        eprintln!("[PoC] LoggingComp on_tick frame={} dt={} props={:?}", frame, dt, props);
    }
}

fn main() {
    let mut reg = ComponentRegistry::new();
    reg.register(LoggingComp);
    println!("Registered types: {:?}", reg.type_names());
}
