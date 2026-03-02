use std::collections::HashMap;
use kernel_sdk::property::PropertyValue;
use crate::ecs::components::keyframe::interpolate_keyframes;
use crate::project::game_object::GameObjectData;

/// Result of interpolating all animatable properties for a game object at a frame.
pub type InterpolatedProps = HashMap<String, HashMap<String, PropertyValue>>;

/// Interpolate all component properties for a `GameObjectData` at `frame`.
///
/// Returns: `component_type` -> `prop_name` -> `PropertyValue`
pub fn interpolate_game_object(go: &GameObjectData, frame: u32) -> InterpolatedProps {
    let mut result: InterpolatedProps = HashMap::new();

    for (component_type, prop_keyframes) in &go.components {
        let mut comp_result = HashMap::new();
        for (prop_name, keyframes) in prop_keyframes {
            if let Some(value) = interpolate_keyframes(keyframes, frame) {
                comp_result.insert(prop_name.clone(), value);
            }
        }
        if !comp_result.is_empty() {
            result.insert(component_type.clone(), comp_result);
        }
    }

    result
}

/// Interpolate all active game objects in a scene at `frame`.
///
/// Returns: `game_object_id` -> `InterpolatedProps`
pub fn interpolate_scene_at_frame(
    game_objects: &HashMap<String, GameObjectData>,
    frame: u32,
) -> HashMap<String, InterpolatedProps> {
    let mut result = HashMap::new();

    for (id, go) in game_objects {
        if go.active && go.born_frame_id <= frame {
            let props = interpolate_game_object(go, frame);
            result.insert(id.clone(), props);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use kernel_sdk::property::PropertyValue;
    use crate::ecs::components::keyframe::KeyFrame;

    #[test]
    fn test_interpolate_game_object() {
        let mut go = GameObjectData::new("go1".to_string(), "TestObj".to_string(), 0);
        go.set_keyframe("Transform", "position.x", KeyFrame::new(0, PropertyValue::Float(0.0)));
        go.set_keyframe("Transform", "position.x", KeyFrame::new(10, PropertyValue::Float(100.0)));

        let props = interpolate_game_object(&go, 5);
        let x = props.get("Transform").and_then(|c| c.get("position.x")).unwrap();
        assert_eq!(*x, PropertyValue::Float(50.0));
    }
}

