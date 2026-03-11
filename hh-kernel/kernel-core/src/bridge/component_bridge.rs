use kernel_sdk::registry::ComponentRegistry;
use kernel_sdk::property::PropertyMap;
use std::sync::Arc;

/// Simple bridge used by application layers (kernel-wasm, kernel-cli) to invoke
/// runtime component hooks for active GameObjects. This module intentionally
/// lives outside of kernel-core's core playback logic to avoid cyclic deps for
/// the PoC.

pub fn call_on_tick_for_go(
    registry: Arc<std::sync::Mutex<ComponentRegistry>>,
    type_name: &str,
    props: &mut PropertyMap,
    frame: u32,
    dt: f64,
) {
    let guard = registry.lock().unwrap();
    if let Some(def) = guard.get(type_name) {
        def.on_tick(props, frame, dt);
    }
}
