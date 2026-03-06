use anyhow::Result;
use kernel_core::storage::deserialize_project;
use kernel_core::ecs::components::keyframe::EasingType;
use kernel_sdk::property::PropertyValue;
use std::fs;

/// Dump a `.hhk` project file as a human-readable `.hhs` script.
pub fn run(input: String, output: Option<String>) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let mut lines: Vec<String> = Vec::new();

    lines.push(format!("# Dumped from: {}", input));
    lines.push(format!("# Project: {} ({})", project.name, project.id));
    lines.push(String::new());

    // new_project / load header
    lines.push(format!(
        "new_project(\"{}\", fps={}, w={}, h={})",
        project.name, project.fps, project.canvas_width, project.canvas_height
    ));
    lines.push(String::new());

    for scene_id in &project.scene_ids {
        let scene = match project.scenes.get(scene_id) {
            Some(s) => s,
            None => continue,
        };

        lines.push(format!("# ── Scene: {} ──────────────────────────────────────────", scene.name));
        lines.push(format!(
            "let {} = project.new_scene(\"{}\", fps={}, duration={})",
            sanitize(&scene.name), scene.name, scene.fps, scene.duration
        ));

        for layer_id in &scene.layer_ids {
            let layer = match scene.layers.get(layer_id) {
                Some(l) => l,
                None => continue,
            };

            lines.push(format!(
                "let {} = {}.new_layer(\"{}\")",
                sanitize(&layer.name), sanitize(&scene.name), layer.name
            ));
            if !layer.visible {
                lines.push(format!("{}.set_visible(false)", sanitize(&layer.name)));
            }
            if layer.locked {
                lines.push(format!("{}.set_locked(true)", sanitize(&layer.name)));
            }

            for go_id in &layer.game_object_ids {
                let go = match scene.game_objects.get(go_id) {
                    Some(g) => g,
                    None => continue,
                };

                lines.push(String::new());
                lines.push(format!("# go: {}", go.name));
                lines.push(format!(
                    "let {} = {}.new_go(\"{}\", born={})",
                    sanitize(&go.name), sanitize(&layer.name), go.name, go.born_frame_id
                ));
                if !go.active {
                    lines.push(format!("{}.set_active(false)", sanitize(&go.name)));
                }

                // components & keyframes
                let mut comp_names: Vec<&String> = go.components.keys().collect();
                comp_names.sort();
                for comp_name in comp_names {
                    lines.push(format!("{}.add_component(\"{}\")", sanitize(&go.name), comp_name));
                    let comp_kfs = &go.components[comp_name];
                    let mut prop_names: Vec<&String> = comp_kfs.keys().collect();
                    prop_names.sort();
                    for prop_name in prop_names {
                        let kfs = &comp_kfs[prop_name];
                        for kf in kfs {
                            let val_str = format_value(&kf.value);
                            let easing_str = format_easing(&kf.easing);
                            if easing_str == "linear" {
                                lines.push(format!(
                                    "{}.set_kf(\"{}\", \"{}\", frame={}, value={})",
                                    sanitize(&go.name), comp_name, prop_name, kf.frame, val_str
                                ));
                            } else {
                                lines.push(format!(
                                    "{}.set_kf(\"{}\", \"{}\", frame={}, value={}, easing=\"{}\")",
                                    sanitize(&go.name), comp_name, prop_name, kf.frame, val_str, easing_str
                                ));
                            }
                        }
                    }
                }
            }
            lines.push(String::new());
        }
    }

    lines.push(format!("save(\"{}\")", input));

    let script = lines.join("\n");

    match output {
        Some(ref path) => {
            fs::write(path, &script)?;
            println!("✓ Dumped '{}' → '{}'", input, path);
        }
        None => {
            println!("{}", script);
        }
    }
    Ok(())
}

// ── formatting helpers ────────────────────────────────────────────────────────

/// Turn a display name into a valid script variable identifier.
fn sanitize(name: &str) -> String {
    let s: String = name.chars().map(|c| {
        if c.is_alphanumeric() || c == '_' { c } else { '_' }
    }).collect();
    // Avoid leading digit
    if s.starts_with(|c: char| c.is_ascii_digit()) {
        format!("_{}", s)
    } else {
        s
    }
}

fn format_value(v: &PropertyValue) -> String {
    match v {
        PropertyValue::Float(f)       => format!("float({})", fmt_f(*f)),
        PropertyValue::Int(i)         => format!("int({})", i),
        PropertyValue::Bool(b)        => format!("bool({})", b),
        PropertyValue::String(s)      => format!("str(\"{}\")", s.replace('"', "\\\"")),
        PropertyValue::Vec2(x, y)     => format!("vec2({}, {})", fmt_f(*x), fmt_f(*y)),
        PropertyValue::Vec3(x, y, z)  => format!("vec3({}, {}, {})", fmt_f(*x), fmt_f(*y), fmt_f(*z)),
        PropertyValue::Color(r, g, b, a) => format!("color({}, {}, {}, {})", r, g, b, a),
    }
}

fn format_easing(e: &EasingType) -> String {
    match e {
        EasingType::Linear    => "linear".into(),
        EasingType::Step      => "step".into(),
        EasingType::EaseIn    => "ease-in".into(),
        EasingType::EaseOut   => "ease-out".into(),
        EasingType::EaseInOut => "ease-in-out".into(),
        EasingType::Bezier(x1, y1, x2, y2) =>
            format!("bezier:{},{},{},{}", fmt_f(*x1), fmt_f(*y1), fmt_f(*x2), fmt_f(*y2)),
    }
}

/// Format a float without unnecessary trailing zeros.
fn fmt_f(f: f64) -> String {
    if f == f.floor() && f.abs() < 1e15 {
        format!("{}", f as i64)
    } else {
        // up to 6 sig figs, strip trailing zeros
        let s = format!("{:.6}", f);
        let s = s.trim_end_matches('0');
        let s = s.trim_end_matches('.');
        s.to_string()
    }
}

