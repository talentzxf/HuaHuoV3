use serde_json::Value;

#[test]
fn test_set_keyframe_command_integration() {
    // Use the wasm-exposed KernelAPI in native tests (it is a normal Rust type here).
    let mut api = kernel_wasm::KernelAPI::new();

    let resp: Value = serde_json::from_str(&api.dispatch(r#"{\"CreateProject\":{\"name\":\"test\",\"fps\":30,\"canvas_width\":800,\"canvas_height\":600}}"#)).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let project_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let resp: Value = serde_json::from_str(&api.dispatch(r#"{\"CreateScene\":{\"name\":\"s\",\"fps\":30,\"duration\":5}}"#)).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let scene_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let resp: Value = serde_json::from_str(&api.dispatch(&format!(r#"{{\"CreateLayer\":{{\"scene_id\":\"{}\",\"name\":\"layer1\"}}}}"#, scene_id))).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let layer_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let resp: Value = serde_json::from_str(&api.dispatch(&format!(r#"{{\"CreateGameObject\":{{\"layer_id\":\"{}\",\"name\":\"go1\",\"born_frame\":0}}}}"#, layer_id))).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));
    let go_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    // Set a keyframe
    let setkf = serde_json::json!({
        "SetKeyFrame": {
            "game_object_id": go_id,
            "component_type": "Transform",
            "prop_name": "position",
            "keyframe": { "frame": 10, "value": { "x": 100.0, "y": 200.0 }, "easing": "linear" }
        }
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&setkf.to_string())).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    // Query interpolated props at frame 10
    let query = serde_json::json!({ "GetInterpolatedProps": { "game_object_id": go_id, "frame": 10 } });
    let qres: Value = serde_json::from_str(&api.query(&query.to_string())).unwrap();
    assert!(qres.get("ok").and_then(Value::as_bool) == Some(true));
    let data = qres.get("payload").and_then(Value::as_str).unwrap_or_default();
    // In the wasm API, GetInterpolatedProps returns QueryResponse with payload bytes (Vec<u8>), serialized as base64 in JSON.
    // But kernel-wasm::KernelAPI::query actually returns JSON string of QueryResponse. For simplicity parse via the public helper get_interpolated_props_json.

    let props_json = api.get_interpolated_props_json(&go_id, 10);
    let props: serde_json::Value = serde_json::from_str(&props_json).unwrap();
    // Expect Transform.position to exist
    assert!(props.get("Transform").and_then(|t| t.get("position")).is_some());
    let pos = &props["Transform"]["position"];
    let x = pos.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let y = pos.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
    assert!((x - 100.0).abs() < 1e-6 && (y - 200.0).abs() < 1e-6, "position mismatch: {} {}", x, y);
}
