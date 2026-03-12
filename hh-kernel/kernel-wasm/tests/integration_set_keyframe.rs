use serde_json::Value;

#[test]
fn test_set_keyframe_command_integration() {
    // Use the wasm-exposed KernelAPI in native tests (it is a normal Rust type here).
    let mut api = kernel_wasm::KernelAPI::new();

    // Build commands using the expected serde-internal-tag format: { "cmd": "Variant", ...fields }
    let create_project = serde_json::json!({ "cmd": "CreateProject", "name": "test", "fps": 30.0, "canvas_width": 800, "canvas_height": 600 });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_project.to_string())).unwrap();
    println!("create_project resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    let create_scene = serde_json::json!({ "cmd": "CreateScene", "name": "s", "fps": 30.0, "duration": 5.0 });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_scene.to_string())).unwrap();
    println!("create_scene resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let scene_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let create_layer = serde_json::json!({ "cmd": "CreateLayer", "scene_id": scene_id, "name": "layer1" });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_layer.to_string())).unwrap();
    println!("create_layer resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let layer_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let create_go = serde_json::json!({ "cmd": "CreateGameObject", "layer_id": layer_id, "name": "go1", "born_frame": 0 });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_go.to_string())).unwrap();
    println!("create_go resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let go_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    // Set a keyframe
    let setkf = serde_json::json!({
        "cmd": "SetKeyFrame",
        "game_object_id": go_id,
        "component_type": "Transform",
        "prop_name": "position",
        "keyframe": {
            "frame": 10,
            "value": { "type": "Vec2", "value": { "x": 100.0, "y": 200.0 } },
            "easing": { "easing_type": "Linear" }
        }
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&setkf.to_string())).unwrap();
    println!("setkf resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    // Query interpolated props at frame 10
    let query = serde_json::json!({ "query": "GetInterpolatedProps", "game_object_id": go_id, "frame": 10 });
    let qres: Value = serde_json::from_str(&api.query(&query.to_string())).unwrap();
    println!("query resp: {}", qres);
    assert!(qres.get("ok").and_then(Value::as_bool) == Some(true));

    let props_json = api.get_interpolated_props_json(&go_id, 10);
    let props: serde_json::Value = serde_json::from_str(&props_json).unwrap();
    // Expect Transform.position to exist
    assert!(props.get("Transform").and_then(|t| t.get("position")).is_some());
    let pos = &props["Transform"]["position"];
    // Support multiple serialization shapes: { "x":.., "y":.. } or { "Vec2": [x,y] } or tuple-like array
    let mut x = None::<f64>;
    let mut y = None::<f64>;
    if let Some(px) = pos.get("x").and_then(|v| v.as_f64()) {
        x = Some(px);
        y = pos.get("y").and_then(|v| v.as_f64());
    } else if let Some(arr) = pos.get("Vec2").and_then(|v| v.as_array()) {
        if arr.len() >= 2 {
            x = arr[0].as_f64();
            y = arr[1].as_f64();
        }
    } else if let Some(arr) = pos.as_array() {
        if arr.len() >= 2 {
            x = arr[0].as_f64();
            y = arr[1].as_f64();
        }
    }
    let x = x.unwrap_or(0.0);
    let y = y.unwrap_or(0.0);
    assert!((x - 100.0).abs() < 1e-6 && (y - 200.0).abs() < 1e-6, "position mismatch: {} {}", x, y);
}
