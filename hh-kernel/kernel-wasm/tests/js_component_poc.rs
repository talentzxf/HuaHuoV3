use wasm_bindgen_test::*;
use kernel_wasm::KernelAPI;

wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn smoke() {
    // Basic smoke test: construct KernelAPI and ensure methods are callable.
    let mut k = KernelAPI::new();
    let q = k.get_playback_state_json();
    assert!(q == "null" || q.len() > 0);
}
