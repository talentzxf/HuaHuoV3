// Converted to a plain Rust unit test so it runs in non-wasm test environments.
use kernel_wasm::KernelAPI;

#[test]
fn smoke() {
    // Basic smoke test: construct KernelAPI and ensure methods are callable.
    let k = KernelAPI::new();
    let q = k.get_playback_state_json();
    assert!(q == "null" || !q.is_empty());
}
