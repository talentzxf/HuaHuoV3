use serde_json::Value;

#[test]
fn test_merge_keyframes_average() {
    let mut api = kernel_wasm::KernelAPI::new();

    // Create project/scene/layer/go
    let create_project = serde_json::json!({ "cmd": "CreateProject", "name": "test", "fps": 30.0, "canvas_width": 800, "canvas_height": 600 });
    let _ = serde_json::from_str::<Value>(&api.dispatch(&create_project.to_string())).unwrap();

    let create_scene = serde_json::json!({ "cmd": "CreateScene", "name": "s", "fps": 30.0, "duration": 5.0 });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_scene.to_string())).unwrap();
    let scene_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let create_layer = serde_json::json!({ "cmd": "CreateLayer", "scene_id": scene_id, "name": "layer1" });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_layer.to_string())).unwrap();
    let layer_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    let create_go = serde_json::json!({ "cmd": "CreateGameObject", "layer_id": layer_id, "name": "go1", "born_frame": 0 });
    let resp: Value = serde_json::from_str(&api.dispatch(&create_go.to_string())).unwrap();
    let go_id = resp.get("created_id").and_then(Value::as_str).unwrap_or_default().to_string();

    // Set multiple keyframes on Transform.position: frames 10,12,14 with Vec2 values
    let set1 = serde_json::json!({
        "cmd": "SetKeyFrame",
        "game_object_id": go_id,
        "component_type": "Transform",
        "prop_name": "position",
        "keyframe": {
            "frame": 10,
            "value": { "type": "Vec2", "value": { "x": 0.0, "y": 0.0 } },
            "easing": { "easing_type": "Linear" }
        }
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&set1.to_string())).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    let set2 = serde_json::json!({
        "cmd": "SetKeyFrame",
        "game_object_id": go_id,
        "component_type": "Transform",
        "prop_name": "position",
        "keyframe": {
            "frame": 12,
            "value": { "type": "Vec2", "value": { "x": 10.0, "y": 0.0 } },
            "easing": { "easing_type": "Linear" }
        }
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&set2.to_string())).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    let set3 = serde_json::json!({
        "cmd": "SetKeyFrame",
        "game_object_id": go_id,
        "component_type": "Transform",
        "prop_name": "position",
        "keyframe": {
            "frame": 14,
            "value": { "type": "Vec2", "value": { "x": 20.0, "y": 0.0 } },
            "easing": { "easing_type": "Linear" }
        }
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&set3.to_string())).unwrap();
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    // Query before merge
    let props_before = api.get_interpolated_props_json(&go_id, 10);
    println!("props_before: {}", props_before);

    // Merge keyframes from 10 to 14 using average strategy
    let merge = serde_json::json!({
        "cmd": "MergeKeyFrames",
        "game_object_id": go_id,
        "component_type": "Transform",
        "prop_name": "position",
        "start_frame": 10,
        "end_frame": 14,
        "strategy": "average"
    });
    let resp: Value = serde_json::from_str(&api.dispatch(&merge.to_string())).unwrap();
    println!("merge resp: {}", resp);
    assert!(resp.get("ok").and_then(Value::as_bool) == Some(true));

    // After merge, query interpolated props at frame 10 -- should equal average (10,0)
    let props_json = api.get_interpolated_props_json(&go_id, 10);
    println!("props_after: {}", props_json);
    let props: serde_json::Value = serde_json::from_str(&props_json).unwrap();
    let pos = &props["Transform"]["position"];
    // accept array or object
    // Support multiple serialized shapes: Vec2 wrapper, array, or {x,y}
    let mut x = 0.0f64;
    let mut y = 0.0f64;
    if let Some(obj) = pos.as_object() {
        if let Some(v) = obj.get("Vec2") {
            if let Some(arr) = v.as_array() {
                x = arr[0].as_f64().unwrap_or(0.0);
                y = arr[1].as_f64().unwrap_or(0.0);
            }
        } else if let Some(arr) = pos.as_array() {
            x = arr[0].as_f64().unwrap_or(0.0);
            y = arr[1].as_f64().unwrap_or(0.0);
        } else {
            x = pos.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            y = pos.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
        }
    } else if let Some(arr) = pos.as_array() {
        x = arr[0].as_f64().unwrap_or(0.0);
        y = arr[1].as_f64().unwrap_or(0.0);
    }

    assert!((x - 10.0).abs() < 1e-6 && (y - 0.0).abs() < 1e-6, "merged position mismatch: {} {}", x, y);
}
