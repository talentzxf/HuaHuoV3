//! Interpreter for HuaHuo Script.
//!
//! Maintains a runtime environment (variable map → `HhsValue`) and
//! executes each AST statement against a mutable `Project`.

use std::collections::HashMap;
use anyhow::{bail, Result};
use nanoid::nanoid;

use kernel_core::{Project, Scene, Layer};
use kernel_core::project::game_object::GameObjectData;
use kernel_core::ecs::components::keyframe::{EasingType, KeyFrame};
use kernel_core::storage::{deserialize_project, serialize_project};
use kernel_sdk::property::PropertyValue;

use crate::dsl::parser::{Arg, CallChain, Expr, Stmt, Value};

// ── Runtime values ────────────────────────────────────────────────────────────

/// Every "object" in script scope is one of these.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum HhsValue {
    Project,
    Scene(String),
    Layer { scene_id: String, layer_id: String },
    GameObject { scene_id: String, go_id: String },
    /// Points to an element definition by id.
    Element(String),
    /// Points to a layer inside an element definition.
    ElementLayer { element_id: String, layer_id: String },
    /// Points to a game object inside an element definition.
    ElementGO { element_id: String, go_id: String },
    Str(String),
    Null,
}

// ── Interpreter ───────────────────────────────────────────────────────────────

pub struct Interpreter {
    project: Option<Project>,
    loaded_path: Option<String>,
    env: HashMap<String, HhsValue>,
    /// Whether the interpreter is in dry-run mode (no file I/O).
    pub dry_run: bool,
}

impl Interpreter {
    pub fn new() -> Self {
        Self {
            project: None,
            loaded_path: None,
            env: HashMap::new(),
            dry_run: false,
        }
    }

    // ── public API ────────────────────────────────────────────────────────────

    pub fn run_file(&mut self, script_path: &str) -> Result<()> {
        let src = std::fs::read_to_string(script_path)
            .map_err(|e| anyhow::anyhow!("Cannot read script '{}': {}", script_path, e))?;
        self.run_str(&src)
    }

    pub fn run_str(&mut self, src: &str) -> Result<()> {
        use crate::dsl::lexer::Lexer;
        use crate::dsl::parser::Parser;

        let tokens = Lexer::new(src).tokenize()?;
        let stmts  = Parser::new(tokens).parse()?;
        for stmt in stmts {
            self.exec_stmt(stmt)?;
        }
        Ok(())
    }

    // ── statement dispatch ────────────────────────────────────────────────────

    fn exec_stmt(&mut self, stmt: Stmt) -> Result<()> {
        match stmt {
            Stmt::Blank => {}
            Stmt::Let { name, expr } => {
                let val = self.eval_expr(expr)?;
                self.env.insert(name, val);
            }
            Stmt::Expr(expr) => {
                self.eval_expr(expr)?;
            }
        }
        Ok(())
    }

    // ── expression evaluation ─────────────────────────────────────────────────

    fn eval_expr(&mut self, expr: Expr) -> Result<HhsValue> {
        match expr {
            Expr::Ident(name) => {
                self.env.get(&name)
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("undefined variable '{}'", name))
            }
            Expr::Call { name, args } => self.eval_free_call(&name, args),
            Expr::Chain(chain) => self.eval_chain(*chain),
        }
    }

    // ── free-standing calls: load(), save(), new_project() ───────────────────

    fn eval_free_call(&mut self, name: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match name {
            "load" => {
                let path = require_pos_str(&args, 0, "load(path)")?;
                let bytes = std::fs::read(&path)
                    .map_err(|e| anyhow::anyhow!("load: cannot read '{}': {}", path, e))?;
                self.project = Some(deserialize_project(&bytes)?);
                self.loaded_path = Some(path.clone());
                println!("✓ Loaded '{}'", path);
                Ok(HhsValue::Project)
            }

            "new_project" => {
                let proj_name = require_pos_str(&args, 0, "new_project(name, …)")?;
                let fps    = named_f64(&args, "fps").unwrap_or(30.0);
                let width  = named_u32(&args, "w").or_else(|| named_u32(&args, "width")).unwrap_or(800);
                let height = named_u32(&args, "h").or_else(|| named_u32(&args, "height")).unwrap_or(600);

                let mut proj = Project::new(nanoid!(), proj_name.clone(), fps, width, height);
                // default scene + layers
                let mut scene = Scene::new(nanoid!(), "DefaultScene".into(), fps, 5.0);
                scene.add_layer(Layer::new(nanoid!(), "background".into()));
                scene.add_layer(Layer::new(nanoid!(), "drawing".into()));
                proj.add_scene(scene);

                self.project = Some(proj);
                self.loaded_path = None;
                println!("✓ Created new project '{}'", proj_name);
                Ok(HhsValue::Project)
            }

            "save" => {
                let path_arg = get_pos_str(&args, 0);
                let path = path_arg
                    .or_else(|| self.loaded_path.clone())
                    .ok_or_else(|| anyhow::anyhow!("save: no path specified and no file was loaded"))?;

                let dry = self.dry_run;
                let proj = self.require_project()?;
                if !dry {
                    let bytes = serialize_project(proj)?;
                    std::fs::write(&path, &bytes)?;
                    println!("✓ Saved '{}' ({} bytes)", path, bytes.len());
                } else {
                    println!("[dry-run] would save to '{}'", path);
                }
                Ok(HhsValue::Null)
            }

            "print" => {
                let msg = require_pos_str(&args, 0, "print(msg)")?;
                println!("{}", msg);
                Ok(HhsValue::Null)
            }

            other => bail!("unknown function '{}'", other),
        }
    }

    // ── method chains ─────────────────────────────────────────────────────────

    fn eval_chain(&mut self, chain: CallChain) -> Result<HhsValue> {
        // Evaluate the root
        let mut current: HhsValue = match chain.root {
            Expr::Ident(ref n) if n == "project" => HhsValue::Project,
            Expr::Ident(ref n) => {
                self.env.get(n)
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("undefined variable '{}'", n))?
            }
            Expr::Call { ref name, ref args } => {
                self.eval_free_call(name, args.clone())?
            }
            Expr::Chain(inner) => self.eval_chain(*inner)?,
        };

        // Walk each segment
        for seg in chain.chain {
            current = self.eval_method(current, &seg.method, seg.args)?;
        }
        Ok(current)
    }

    fn eval_method(&mut self, receiver: HhsValue, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match receiver {
            HhsValue::Project => self.project_method(method, args),
            HhsValue::Scene(sid) => self.scene_method(sid, method, args),
            HhsValue::Layer { scene_id, layer_id } => self.layer_method(scene_id, layer_id, method, args),
            HhsValue::GameObject { scene_id, go_id } => self.go_method(scene_id, go_id, method, args),
            HhsValue::Element(eid) => self.element_method(eid, method, args),
            HhsValue::ElementLayer { element_id, layer_id } => self.element_layer_method(element_id, layer_id, method, args),
            HhsValue::ElementGO { element_id, go_id } => self.element_go_method(element_id, go_id, method, args),
            other => bail!("cannot call .{}() on {:?}", method, other),
        }
    }

    // ── Project methods ───────────────────────────────────────────────────────

    fn project_method(&mut self, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // project.scene("name_or_id")  or  project.scene(0)
            "scene" => {
                let key = require_pos_str(&args, 0, "project.scene(name_or_id)")?;
                let proj = self.require_project()?;
                let sid = find_scene_id(proj, &key)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' not found", key))?;
                Ok(HhsValue::Scene(sid))
            }
            // project.new_scene("name", fps=24, duration=10)
            "new_scene" => {
                let name = require_pos_str(&args, 0, "project.new_scene(name, …)")?;
                let proj = self.require_project()?;
                let fps  = named_f64(&args, "fps").unwrap_or(proj.fps);
                let dur  = named_f64(&args, "duration").unwrap_or(5.0);
                let sid  = nanoid!();
                let scene = Scene::new(sid.clone(), name.clone(), fps, dur);
                proj.add_scene(scene);
                println!("  + scene '{}' ({})", name, sid);
                Ok(HhsValue::Scene(sid))
            }
            // project.set_fps(60)
            "set_fps" => {
                let fps = require_pos_f64(&args, 0, "project.set_fps(fps)")?;
                self.require_project()?.fps = fps;
                Ok(HhsValue::Project)
            }
            // project.set_size(w, h)
            "set_size" => {
                let w = require_pos_u32(&args, 0, "project.set_size(w, h)")?;
                let h = require_pos_u32(&args, 1, "project.set_size(w, h)")?;
                let proj = self.require_project()?;
                proj.canvas_width  = w;
                proj.canvas_height = h;
                Ok(HhsValue::Project)
            }
            // project.info()
            "info" => {
                let proj = self.require_project()?;
                println!("Project: {} ({})", proj.name, proj.id);
                println!("  fps={} size={}x{} scenes={} elements={}",
                    proj.fps, proj.canvas_width, proj.canvas_height,
                    proj.scenes.len(), proj.elements.len());
                Ok(HhsValue::Project)
            }
            // project.list_scenes()
            "list_scenes" => {
                let proj = self.require_project()?;
                println!("Scenes ({}):", proj.scene_ids.len());
                for sid in &proj.scene_ids.clone() {
                    if let Some(s) = proj.scenes.get(sid) {
                        let cur = proj.current_scene_id.as_deref() == Some(sid);
                        println!("  [{}{}] '{}' fps={} duration={}s frames={} layers={}",
                            sid, if cur { "*" } else { "" },
                            s.name, s.fps, s.duration, s.total_frames(), s.layers.len());
                    }
                }
                Ok(HhsValue::Project)
            }
            // project.new_element("name", w=200, h=200, fps=30, duration=2)
            "new_element" => {
                let name     = require_pos_str(&args, 0, "project.new_element(name, …)")?;
                let proj     = self.require_project()?;
                let fps      = named_f64(&args, "fps").unwrap_or(proj.fps);
                let duration = named_f64(&args, "duration").unwrap_or(2.0);
                let width    = named_f64(&args, "w").or_else(|| named_f64(&args, "width"))
                                 .unwrap_or(proj.canvas_width as f64);
                let height   = named_f64(&args, "h").or_else(|| named_f64(&args, "height"))
                                 .unwrap_or(proj.canvas_height as f64);
                let eid = nanoid!();
                let elem = kernel_core::project::element::ElementDef::new(
                    eid.clone(), name.clone(), width, height, fps, duration,
                );
                proj.add_element(elem).map_err(|cycle|
                    anyhow::anyhow!("new_element: cycle detected: {}", cycle.join(" → "))
                )?;
                println!("  + element '{}' ({})", name, eid);
                Ok(HhsValue::Element(eid))
            }
            // project.element("name_or_id")
            "element" => {
                let key = require_pos_str(&args, 0, "project.element(name_or_id)")?;
                let proj = self.require_project()?;
                let eid = proj.find_element(&key)
                    .map(|e| e.id.clone())
                    .ok_or_else(|| anyhow::anyhow!("element '{}' not found", key))?;
                Ok(HhsValue::Element(eid))
            }
            // project.list_elements()
            "list_elements" => {
                let proj = self.require_project()?;
                println!("Elements ({}):", proj.elements.len());
                let mut names: Vec<(&String, &kernel_core::project::element::ElementDef)> =
                    proj.elements.iter().collect();
                names.sort_by_key(|(_, e)| &e.name);
                for (eid, e) in names {
                    println!("  [{}] '{}' {}x{} fps={} duration={}s frames={} layers={}",
                        eid, e.name, e.width as u32, e.height as u32,
                        e.fps, e.duration, e.total_frames(), e.layers.len());
                }
                Ok(HhsValue::Project)
            }
            // project.remove_element("name_or_id")
            "remove_element" => {
                let key = require_pos_str(&args, 0, "project.remove_element(name_or_id)")?;
                let proj = self.require_project()?;
                let eid = proj.find_element(&key)
                    .map(|e| e.id.clone())
                    .ok_or_else(|| anyhow::anyhow!("element '{}' not found", key))?;
                proj.remove_element(&eid);
                println!("  - removed element '{}'", key);
                Ok(HhsValue::Project)
            }
            other => bail!("project has no method '{}'", other),
        }
    }

    // ── Scene methods ─────────────────────────────────────────────────────────

    fn scene_method(&mut self, sid: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // scene.layer("name_or_id")
            "layer" => {
                let key = require_pos_str(&args, 0, "scene.layer(name_or_id)")?;
                let proj = self.require_project()?;
                let scene = proj.scenes.get(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?;
                let lid = find_layer_id(scene, &key)
                    .ok_or_else(|| anyhow::anyhow!("layer '{}' not found in scene", key))?;
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // scene.new_layer("name")
            "new_layer" => {
                let name = require_pos_str(&args, 0, "scene.new_layer(name)")?;
                let lid  = nanoid!();
                let proj = self.require_project()?;
                let scene = proj.scenes.get_mut(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?;
                scene.add_layer(Layer::new(lid.clone(), name.clone()));
                println!("  + layer '{}' ({})", name, lid);
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // scene.set_fps(fps)
            "set_fps" => {
                let fps = require_pos_f64(&args, 0, "scene.set_fps(fps)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?
                    .fps = fps;
                Ok(HhsValue::Scene(sid))
            }
            // scene.set_duration(secs)
            "set_duration" => {
                let d = require_pos_f64(&args, 0, "scene.set_duration(secs)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?
                    .duration = d;
                Ok(HhsValue::Scene(sid))
            }
            // scene.info()
            "info" => {
                let proj = self.require_project()?;
                let s = proj.scenes.get(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?;
                println!("Scene: {} ({}) fps={} duration={}s frames={} layers={}",
                    s.name, s.id, s.fps, s.duration, s.total_frames(), s.layers.len());
                Ok(HhsValue::Scene(sid))
            }
            // scene.list_layers()
            "list_layers" => {
                let proj = self.require_project()?;
                let s = proj.scenes.get(&sid)
                    .ok_or_else(|| anyhow::anyhow!("scene '{}' missing", sid))?;
                println!("Layers in '{}' ({}):", s.name, s.layer_ids.len());
                for lid in &s.layer_ids.clone() {
                    if let Some(l) = s.layers.get(lid) {
                        println!("  [{}] '{}' visible={} locked={} objects={}",
                            lid, l.name, l.visible, l.locked, l.game_object_ids.len());
                    }
                }
                Ok(HhsValue::Scene(sid))
            }
            other => bail!("scene has no method '{}'", other),
        }
    }

    // ── Layer methods ─────────────────────────────────────────────────────────

    fn layer_method(&mut self, sid: String, lid: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // layer.go("name_or_id")
            "go" => {
                let key = require_pos_str(&args, 0, "layer.go(name_or_id)")?;
                let proj = self.require_project()?;
                let scene = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?;
                let layer = scene.layers.get(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?;
                let go_id = layer.game_object_ids.iter()
                    .find(|id| {
                        scene.game_objects.get(*id)
                            .map(|go| go.name == key || go.id == key)
                            .unwrap_or(false)
                    })
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("game object '{}' not found in layer", key))?;
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            // layer.new_go("name", born=0)
            "new_go" => {
                let name  = require_pos_str(&args, 0, "layer.new_go(name, …)")?;
                let born  = named_u32(&args, "born").unwrap_or(0);
                let go_id = nanoid!();
                let go    = GameObjectData::new(go_id.clone(), name.clone(), born);
                let proj  = self.require_project()?;
                let scene = proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?;
                scene.add_game_object(&lid, go);
                println!("  + go '{}' ({})", name, go_id);
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            // layer.set_visible(bool)
            "set_visible" => {
                let v = require_pos_bool(&args, 0, "layer.set_visible(bool)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .layers.get_mut(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?
                    .visible = v;
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // layer.set_locked(bool)
            "set_locked" => {
                let v = require_pos_bool(&args, 0, "layer.set_locked(bool)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .layers.get_mut(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?
                    .locked = v;
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // layer.info()
            "info" => {
                let proj = self.require_project()?;
                let scene = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?;
                let l = scene.layers.get(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?;
                println!("Layer: {} ({}) visible={} locked={} objects={}",
                    l.name, l.id, l.visible, l.locked, l.game_object_ids.len());
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // layer.list_gos()
            "list_gos" => {
                let proj = self.require_project()?;
                let scene = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?;
                let layer = scene.layers.get(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?;
                println!("GameObjects in layer '{}' ({}):", layer.name, layer.game_object_ids.len());
                for go_id in &layer.game_object_ids.clone() {
                    if let Some(go) = scene.game_objects.get(go_id) {
                        let kf_total: usize = go.components.values()
                            .flat_map(|c| c.values()).map(|v| v.len()).sum();
                        println!("  [{}] '{}' active={} born={} components={} keyframes={}",
                            go.id, go.name, go.active, go.born_frame_id,
                            go.components.len(), kf_total);
                    }
                }
                Ok(HhsValue::Layer { scene_id: sid, layer_id: lid })
            }
            // layer.instantiate("element_name_or_id", "go_name", born=0)
            // Creates a GameObject on this layer that is an ElementInstance
            "instantiate" => {
                let elem_key = require_pos_str(&args, 0, "layer.instantiate(element, name, …)")?;
                let go_name  = require_pos_str(&args, 1, "layer.instantiate(element, name, …)")?;
                let born     = named_u32(&args, "born").unwrap_or(0);
                let loop_pb  = named_bool(&args, "loop_playback").unwrap_or(false);
                let time_off = named_f64(&args, "time_offset").unwrap_or(0.0);
                let speed    = named_f64(&args, "speed_scale").unwrap_or(1.0);

                let proj = self.require_project()?;
                // resolve element
                let eid = proj.find_element(&elem_key)
                    .map(|e| e.id.clone())
                    .ok_or_else(|| anyhow::anyhow!("element '{}' not found — create it with project.new_element() first", elem_key))?;
                let go_id = nanoid!();
                let mut go = kernel_core::project::game_object::GameObjectData::new(
                    go_id.clone(), go_name.clone(), born,
                );
                // Store ElementInstance config as pseudo-keyframes on component "ElementInstance"
                use kernel_core::ecs::components::keyframe::KeyFrame;
                use kernel_sdk::property::PropertyValue;
                let kf_eid = KeyFrame::new(0, PropertyValue::String(eid.clone()));
                let kf_loop = KeyFrame::new(0, PropertyValue::Bool(loop_pb));
                let kf_time = KeyFrame::new(0, PropertyValue::Float(time_off));
                let kf_speed = KeyFrame::new(0, PropertyValue::Float(speed));
                let kf_pos = KeyFrame::new(0, PropertyValue::Vec2(0.0, 0.0));
                let kf_rot = KeyFrame::new(0, PropertyValue::Float(0.0));
                let kf_sx  = KeyFrame::new(0, PropertyValue::Float(1.0));
                let kf_sy  = KeyFrame::new(0, PropertyValue::Float(1.0));
                let kf_op  = KeyFrame::new(0, PropertyValue::Float(1.0));
                go.set_keyframe("ElementInstance", "element_id",    kf_eid);
                go.set_keyframe("ElementInstance", "loop_playback", kf_loop);
                go.set_keyframe("ElementInstance", "time_offset",   kf_time);
                go.set_keyframe("ElementInstance", "speed_scale",   kf_speed);
                go.set_keyframe("ElementInstance", "position",      kf_pos);
                go.set_keyframe("ElementInstance", "rotation",      kf_rot);
                go.set_keyframe("ElementInstance", "scale_x",       kf_sx);
                go.set_keyframe("ElementInstance", "scale_y",       kf_sy);
                go.set_keyframe("ElementInstance", "opacity",       kf_op);

                let scene = proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?;
                scene.add_game_object(&lid, go);
                println!("  + instance '{}' (go={}) of element '{}'", go_name, go_id, elem_key);
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            other => bail!("layer has no method '{}'", other),
        }
    }

    // ── GameObject methods ────────────────────────────────────────────────────

    fn go_method(&mut self, sid: String, go_id: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // go.add_component("Transform")
            "add_component" => {
                let comp_type = require_pos_str(&args, 0, "go.add_component(type)")?;
                let proj = self.require_project()?;
                let go = proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                go.components.entry(comp_type.clone()).or_default();
                println!("  + component '{}' on go '{}'", comp_type, go_id);
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.set_kf("Component", "prop", frame=N, value=..., easing="linear")
            "set_kf" => {
                let comp  = require_pos_str(&args, 0, "go.set_kf(comp, prop, frame=N, value=V)")?;
                let prop  = require_pos_str(&args, 1, "go.set_kf(comp, prop, frame=N, value=V)")?;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("set_kf: missing `frame=` argument"))?;
                let raw_val = named_value(&args, "value")
                    .ok_or_else(|| anyhow::anyhow!("set_kf: missing `value=` argument"))?;
                let prop_val = eval_property_value(&raw_val)?;
                let easing   = named_str(&args, "easing")
                    .as_deref()
                    .map(parse_easing)
                    .transpose()?
                    .unwrap_or(EasingType::Linear);

                let proj = self.require_project()?;
                let go = proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                let kf = KeyFrame::new(frame, prop_val).with_easing(easing);
                go.set_keyframe(&comp, &prop, kf);
                println!("  kf set  go='{}' {}.{} @{}", go_id, comp, prop, frame);
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.rm_kf("Component", "prop", frame=N)
            "rm_kf" => {
                let comp  = require_pos_str(&args, 0, "go.rm_kf(comp, prop, frame=N)")?;
                let prop  = require_pos_str(&args, 1, "go.rm_kf(comp, prop, frame=N)")?;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("rm_kf: missing `frame=` argument"))?;

                let proj = self.require_project()?;
                let go = proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                if go.remove_keyframe(&comp, &prop, frame) {
                    println!("  kf removed  go='{}' {}.{} @{}", go_id, comp, prop, frame);
                } else {
                    println!("  (no keyframe at {}.{} @{})", comp, prop, frame);
                }
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.set_active(bool)
            "set_active" => {
                let v = require_pos_bool(&args, 0, "go.set_active(bool)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?
                    .active = v;
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.set_born(frame)
            "set_born" => {
                let frame = require_pos_u32(&args, 0, "go.set_born(frame)")?;
                let proj = self.require_project()?;
                proj.scenes.get_mut(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?
                    .born_frame_id = frame;
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.interpolate(frame=N)  — read-only, print result
            "interpolate" => {
                use kernel_core::ecs::systems::interpolate_game_object;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("interpolate: missing `frame=` argument"))?;
                let proj = self.require_project()?;
                let go = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                let result = interpolate_game_object(go, frame);
                println!("Interpolated '{}' @{}:", go.name, frame);
                if result.is_empty() {
                    println!("  (no keyframes)");
                } else {
                    for (comp, props) in &result {
                        for (prop, val) in props {
                            println!("  {}.{} = {:?}", comp, prop, val);
                        }
                    }
                }
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }

            // go.info()
            "info" => {
                let proj = self.require_project()?;
                let go = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                let kf_total: usize = go.components.values()
                    .flat_map(|c| c.values()).map(|v| v.len()).sum();
                println!("GO: {} ({}) active={} born={} components={} keyframes={}",
                    go.name, go.id, go.active, go.born_frame_id, go.components.len(), kf_total);
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            // go.list_components()
            "list_components" => {
                let proj = self.require_project()?;
                let go = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                println!("Components on '{}' ({}):", go.name, go.components.len());
                let mut comp_names: Vec<&String> = go.components.keys().collect();
                comp_names.sort();
                for comp in comp_names {
                    let kf_count: usize = go.components[comp].values().map(|v| v.len()).sum();
                    let props: Vec<&String> = go.components[comp].keys().collect();
                    println!("  [{}]  props={} keyframes={}", comp, props.len(), kf_count);
                }
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            // go.list_kf("Component", "prop")  — lists all keyframes for a property
            // go.list_kf("Component")           — lists all properties in component
            // go.list_kf()                       — lists everything
            "list_kf" => {
                let comp_filter = get_pos_str(&args, 0);
                let prop_filter = get_pos_str(&args, 1);
                let proj = self.require_project()?;
                let go = proj.scenes.get(&sid).ok_or_else(|| anyhow::anyhow!("scene missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                println!("Keyframes on '{}':", go.name);
                let mut comp_names: Vec<&String> = go.components.keys().collect();
                comp_names.sort();
                for comp_name in comp_names {
                    if let Some(ref cf) = comp_filter {
                        if comp_name != cf { continue; }
                    }
                    let comp_kfs = &go.components[comp_name];
                    let mut prop_names: Vec<&String> = comp_kfs.keys().collect();
                    prop_names.sort();
                    for prop_name in prop_names {
                        if let Some(ref pf) = prop_filter {
                            if prop_name != pf { continue; }
                        }
                        let kfs = &comp_kfs[prop_name];
                        println!("  {}.{} ({} keyframes):", comp_name, prop_name, kfs.len());
                        for kf in kfs {
                            println!("    frame={:4}  value={:?}  easing={:?}", kf.frame, kf.value, kf.easing);
                        }
                    }
                }
                Ok(HhsValue::GameObject { scene_id: sid, go_id })
            }
            other => bail!("go has no method '{}'", other),
        }
    }

    // ── Element definition methods ────────────────────────────────────────────

    fn element_method(&mut self, eid: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // element.new_layer("name")
            "new_layer" => {
                let name = require_pos_str(&args, 0, "element.new_layer(name)")?;
                let lid  = nanoid!();
                let proj = self.require_project()?;
                let elem = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                elem.add_layer(kernel_core::project::layer::Layer::new(lid.clone(), name.clone()));
                println!("  + element layer '{}' ({})", name, lid);
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element.layer("name_or_id")
            "layer" => {
                let key = require_pos_str(&args, 0, "element.layer(name_or_id)")?;
                let proj = self.require_project()?;
                let elem = proj.elements.get(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                let lid = elem.layer_ids.iter()
                    .find(|id| elem.layers.get(*id).map(|l| l.id == key || l.name == key).unwrap_or(false))
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("layer '{}' not found in element", key))?;
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element.set_fps(fps)
            "set_fps" => {
                let fps = require_pos_f64(&args, 0, "element.set_fps(fps)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .fps = fps;
                Ok(HhsValue::Element(eid))
            }
            // element.set_duration(secs)
            "set_duration" => {
                let d = require_pos_f64(&args, 0, "element.set_duration(secs)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .duration = d;
                Ok(HhsValue::Element(eid))
            }
            // element.set_description("...")
            "set_description" => {
                let desc = require_pos_str(&args, 0, "element.set_description(text)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .description = desc;
                Ok(HhsValue::Element(eid))
            }
            // element.info()
            "info" => {
                let proj = self.require_project()?;
                let e = proj.elements.get(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                println!("Element: '{}' ({}) {}x{} fps={} duration={}s frames={} layers={}",
                    e.name, e.id, e.width as u32, e.height as u32,
                    e.fps, e.duration, e.total_frames(), e.layers.len());
                if !e.description.is_empty() {
                    println!("  description: {}", e.description);
                }
                Ok(HhsValue::Element(eid))
            }
            // element.list_layers()
            "list_layers" => {
                let proj = self.require_project()?;
                let e = proj.elements.get(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                println!("Layers in element '{}' ({}):", e.name, e.layer_ids.len());
                for lid in &e.layer_ids.clone() {
                    if let Some(l) = e.layers.get(lid) {
                        println!("  [{}] '{}' visible={} locked={} objects={}",
                            lid, l.name, l.visible, l.locked, l.game_object_ids.len());
                    }
                }
                Ok(HhsValue::Element(eid))
            }
            other => bail!("element has no method '{}'", other),
        }
    }

    // ── Element layer methods ─────────────────────────────────────────────────

    fn element_layer_method(&mut self, eid: String, lid: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // element_layer.new_go("name", born=0)
            "new_go" => {
                let name = require_pos_str(&args, 0, "element_layer.new_go(name, …)")?;
                let born = named_u32(&args, "born").unwrap_or(0);
                let go_id = nanoid!();
                let go    = kernel_core::project::game_object::GameObjectData::new(
                    go_id.clone(), name.clone(), born,
                );
                let proj = self.require_project()?;
                let elem = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                elem.add_game_object(&lid, go);
                println!("  + element go '{}' ({})", name, go_id);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // element_layer.go("name_or_id")
            "go" => {
                let key = require_pos_str(&args, 0, "element_layer.go(name_or_id)")?;
                let proj = self.require_project()?;
                let elem = proj.elements.get(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                let layer = elem.layers.get(&lid)
                    .ok_or_else(|| anyhow::anyhow!("layer '{}' missing", lid))?;
                let go_id = layer.game_object_ids.iter()
                    .find(|id| elem.game_objects.get(*id)
                        .map(|g| g.id == key || g.name == key)
                        .unwrap_or(false))
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("go '{}' not found in element layer", key))?;
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // element_layer.set_visible(bool)
            "set_visible" => {
                let v = require_pos_bool(&args, 0, "element_layer.set_visible(bool)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .layers.get_mut(&lid)
                    .ok_or_else(|| anyhow::anyhow!("layer missing"))?
                    .visible = v;
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element_layer.set_locked(bool)
            "set_locked" => {
                let v = require_pos_bool(&args, 0, "element_layer.set_locked(bool)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .layers.get_mut(&lid)
                    .ok_or_else(|| anyhow::anyhow!("layer missing"))?
                    .locked = v;
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element_layer.info()
            "info" => {
                let proj = self.require_project()?;
                let elem = proj.elements.get(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?;
                let l = elem.layers.get(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?;
                println!("ElementLayer: '{}' ({}) visible={} locked={} objects={}",
                    l.name, l.id, l.visible, l.locked, l.game_object_ids.len());
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element_layer.list_gos()
            "list_gos" => {
                let proj = self.require_project()?;
                let elem = proj.elements.get(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?;
                let layer = elem.layers.get(&lid).ok_or_else(|| anyhow::anyhow!("layer missing"))?;
                println!("GOs in element layer '{}' ({}):", layer.name, layer.game_object_ids.len());
                for go_id in &layer.game_object_ids.clone() {
                    if let Some(go) = elem.game_objects.get(go_id) {
                        let kf_total: usize = go.components.values()
                            .flat_map(|c| c.values()).map(|v| v.len()).sum();
                        println!("  [{}] '{}' active={} born={} components={} keyframes={}",
                            go.id, go.name, go.active, go.born_frame_id, go.components.len(), kf_total);
                    }
                }
                Ok(HhsValue::ElementLayer { element_id: eid, layer_id: lid })
            }
            // element_layer.instantiate("OtherElement", "go_name", born=0, loop_playback=false, ...)
            // Nests another element inside this element's layer — enabling deep hierarchies.
            "instantiate" => {
                let elem_key = require_pos_str(&args, 0, "element_layer.instantiate(element, name, …)")?;
                let go_name  = require_pos_str(&args, 1, "element_layer.instantiate(element, name, …)")?;
                let born     = named_u32(&args,  "born").unwrap_or(0);
                let loop_pb  = named_bool(&args, "loop_playback").unwrap_or(false);
                let time_off = named_f64(&args,  "time_offset").unwrap_or(0.0);
                let speed    = named_f64(&args,  "speed_scale").unwrap_or(1.0);

                // Resolve the referenced element (must already exist in project.elements)
                let proj = self.require_project()?;
                let ref_eid = proj.find_element(&elem_key)
                    .map(|e| e.id.clone())
                    .ok_or_else(|| anyhow::anyhow!(
                        "element '{}' not found — define it with project.new_element() first", elem_key
                    ))?;

                // Cycle check: make sure ref_eid does not (transitively) reference eid
                {
                    // Temporarily add the would-be edge eid → ref_eid to verify
                    // We do this by checking if ref_eid's subtree contains eid.
                    let mut visited = vec![eid.clone()];
                    fn would_cycle(
                        elements: &std::collections::HashMap<String, kernel_core::project::element::ElementDef>,
                        current: &str,
                        visited: &mut Vec<String>,
                    ) -> bool {
                        if visited.contains(&current.to_string()) { return true; }
                        visited.push(current.to_string());
                        if let Some(elem) = elements.get(current) {
                            for go in elem.game_objects.values() {
                                if let Some(kfs) = go.components.get("ElementInstance") {
                                    if let Some(frames) = kfs.get("element_id") {
                                        if let Some(kf) = frames.first() {
                                            if let kernel_sdk::property::PropertyValue::String(ref child_eid) = kf.value {
                                                if would_cycle(elements, child_eid, visited) { return true; }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        visited.pop();
                        false
                    }
                    if would_cycle(&proj.elements, &ref_eid, &mut visited) {
                        bail!("instantiate: cycle detected — '{}' transitively references '{}'", ref_eid, eid);
                    }
                }

                // Build the instance GO
                let go_id = nanoid!();
                let mut go = kernel_core::project::game_object::GameObjectData::new(
                    go_id.clone(), go_name.clone(), born,
                );
                use kernel_core::ecs::components::keyframe::KeyFrame;
                use kernel_sdk::property::PropertyValue;
                go.set_keyframe("ElementInstance", "element_id",    KeyFrame::new(0, PropertyValue::String(ref_eid.clone())));
                go.set_keyframe("ElementInstance", "loop_playback", KeyFrame::new(0, PropertyValue::Bool(loop_pb)));
                go.set_keyframe("ElementInstance", "time_offset",   KeyFrame::new(0, PropertyValue::Float(time_off)));
                go.set_keyframe("ElementInstance", "speed_scale",   KeyFrame::new(0, PropertyValue::Float(speed)));
                go.set_keyframe("ElementInstance", "position",      KeyFrame::new(0, PropertyValue::Vec2(0.0, 0.0)));
                go.set_keyframe("ElementInstance", "rotation",      KeyFrame::new(0, PropertyValue::Float(0.0)));
                go.set_keyframe("ElementInstance", "scale_x",       KeyFrame::new(0, PropertyValue::Float(1.0)));
                go.set_keyframe("ElementInstance", "scale_y",       KeyFrame::new(0, PropertyValue::Float(1.0)));
                go.set_keyframe("ElementInstance", "opacity",       KeyFrame::new(0, PropertyValue::Float(1.0)));

                let proj = self.require_project()?;
                let elem = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element '{}' missing", eid))?;
                elem.add_game_object(&lid, go);
                println!("  + nested instance '{}' (go={}) of element '{}' inside element '{}'",
                    go_name, go_id, elem_key, eid);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            other => bail!("element layer has no method '{}'", other),
        }
    }

    // ── Element GO methods ────────────────────────────────────────────────────

    fn element_go_method(&mut self, eid: String, go_id: String, method: &str, args: Vec<Arg>) -> Result<HhsValue> {
        match method {
            // ego.add_component("Transform")
            "add_component" => {
                let comp_type = require_pos_str(&args, 0, "ego.add_component(type)")?;
                let proj = self.require_project()?;
                let go = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get_mut(&go_id)
                    .ok_or_else(|| anyhow::anyhow!("go missing"))?;
                go.components.entry(comp_type.clone()).or_default();
                println!("  + component '{}' on element go '{}'", comp_type, go_id);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.set_kf("Component", "prop", frame=N, value=V, easing="...")
            "set_kf" => {
                let comp  = require_pos_str(&args, 0, "ego.set_kf(comp, prop, frame=N, value=V)")?;
                let prop  = require_pos_str(&args, 1, "ego.set_kf(comp, prop, frame=N, value=V)")?;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("set_kf: missing `frame=` argument"))?;
                let raw_val = named_value(&args, "value")
                    .ok_or_else(|| anyhow::anyhow!("set_kf: missing `value=` argument"))?;
                let prop_val = eval_property_value(&raw_val)?;
                let easing = named_str(&args, "easing")
                    .as_deref().map(parse_easing).transpose()?
                    .unwrap_or(EasingType::Linear);
                let kf = KeyFrame::new(frame, prop_val).with_easing(easing);
                let proj = self.require_project()?;
                let go = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get_mut(&go_id)
                    .ok_or_else(|| anyhow::anyhow!("go missing"))?;
                go.set_keyframe(&comp, &prop, kf);
                println!("  kf set  element_go='{}' {}.{} @{}", go_id, comp, prop, frame);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.rm_kf("Component", "prop", frame=N)
            "rm_kf" => {
                let comp  = require_pos_str(&args, 0, "ego.rm_kf(comp, prop, frame=N)")?;
                let prop  = require_pos_str(&args, 1, "ego.rm_kf(comp, prop, frame=N)")?;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("rm_kf: missing `frame=`"))?;
                let proj = self.require_project()?;
                let go = proj.elements.get_mut(&eid)
                    .ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get_mut(&go_id)
                    .ok_or_else(|| anyhow::anyhow!("go missing"))?;
                go.remove_keyframe(&comp, &prop, frame);
                println!("  kf removed  element_go='{}' {}.{} @{}", go_id, comp, prop, frame);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.set_active(bool)
            "set_active" => {
                let v = require_pos_bool(&args, 0, "ego.set_active(bool)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?
                    .active = v;
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.set_born(frame)
            "set_born" => {
                let frame = require_pos_u32(&args, 0, "ego.set_born(frame)")?;
                let proj = self.require_project()?;
                proj.elements.get_mut(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get_mut(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?
                    .born_frame_id = frame;
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.interpolate(frame=N)
            "interpolate" => {
                use kernel_core::ecs::systems::interpolate_game_object;
                let frame = named_u32(&args, "frame")
                    .ok_or_else(|| anyhow::anyhow!("interpolate: missing `frame=`"))?;
                let proj = self.require_project()?;
                let go = proj.elements.get(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                let result = interpolate_game_object(go, frame);
                println!("Interpolated element_go '{}' @{}:", go.name, frame);
                if result.is_empty() {
                    println!("  (no keyframes)");
                } else {
                    for (comp, props) in &result {
                        for (prop, val) in props {
                            println!("  {}.{} = {:?}", comp, prop, val);
                        }
                    }
                }
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.info()
            "info" => {
                let proj = self.require_project()?;
                let go = proj.elements.get(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                let kf_total: usize = go.components.values()
                    .flat_map(|c| c.values()).map(|v| v.len()).sum();
                println!("ElementGO: {} ({}) active={} born={} components={} keyframes={}",
                    go.name, go.id, go.active, go.born_frame_id, go.components.len(), kf_total);
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            // ego.list_kf(...)
            "list_kf" => {
                let comp_filter = get_pos_str(&args, 0);
                let prop_filter = get_pos_str(&args, 1);
                let proj = self.require_project()?;
                let go = proj.elements.get(&eid).ok_or_else(|| anyhow::anyhow!("element missing"))?
                    .game_objects.get(&go_id).ok_or_else(|| anyhow::anyhow!("go missing"))?;
                println!("Keyframes on element_go '{}':", go.name);
                let mut comp_names: Vec<&String> = go.components.keys().collect();
                comp_names.sort();
                for comp_name in comp_names {
                    if let Some(ref cf) = comp_filter { if comp_name != cf { continue; } }
                    let comp_kfs = &go.components[comp_name];
                    let mut prop_names: Vec<&String> = comp_kfs.keys().collect();
                    prop_names.sort();
                    for prop_name in prop_names {
                        if let Some(ref pf) = prop_filter { if prop_name != pf { continue; } }
                        let kfs = &comp_kfs[prop_name];
                        println!("  {}.{} ({} keyframes):", comp_name, prop_name, kfs.len());
                        for kf in kfs {
                            println!("    frame={:4}  value={:?}  easing={:?}", kf.frame, kf.value, kf.easing);
                        }
                    }
                }
                Ok(HhsValue::ElementGO { element_id: eid, go_id })
            }
            other => bail!("element go has no method '{}'", other),
        }
    }

    // ── internal helpers ──────────────────────────────────────────────────────

    fn require_project(&mut self) -> Result<&mut Project> {
        self.project.as_mut().ok_or_else(|| anyhow::anyhow!(
            "no project loaded — call load(\"file.hhk\") or new_project(\"name\") first"
        ))
    }
}

// ── scene / layer lookup helpers ──────────────────────────────────────────────

fn find_scene_id(proj: &Project, key: &str) -> Option<String> {
    // exact id match first
    if proj.scenes.contains_key(key) {
        return Some(key.to_string());
    }
    // then name match (in scene_ids order)
    proj.scene_ids.iter()
        .find(|id| proj.scenes.get(*id).map(|s| s.name == key).unwrap_or(false))
        .cloned()
}

fn find_layer_id(scene: &Scene, key: &str) -> Option<String> {
    if scene.layers.contains_key(key) {
        return Some(key.to_string());
    }
    scene.layer_ids.iter()
        .find(|id| scene.layers.get(*id).map(|l| l.name == key).unwrap_or(false))
        .cloned()
}

// ── argument extraction helpers ───────────────────────────────────────────────

fn get_pos(args: &[Arg], pos: usize) -> Option<&Value> {
    let mut idx = 0;
    for a in args {
        if a.name.is_none() {
            if idx == pos { return Some(&a.value); }
            idx += 1;
        }
    }
    None
}

fn get_pos_str(args: &[Arg], pos: usize) -> Option<String> {
    match get_pos(args, pos)? {
        Value::Str(s) => Some(s.clone()),
        _ => None,
    }
}

fn require_pos_str(args: &[Arg], pos: usize, ctx: &str) -> Result<String> {
    get_pos(args, pos)
        .and_then(|v| if let Value::Str(s) = v { Some(s.clone()) } else { None })
        .ok_or_else(|| anyhow::anyhow!("{}: expected string at positional arg {}", ctx, pos))
}

fn require_pos_f64(args: &[Arg], pos: usize, ctx: &str) -> Result<f64> {
    match get_pos(args, pos) {
        Some(Value::Float(f)) => Ok(*f),
        Some(Value::Int(i))   => Ok(*i as f64),
        _ => bail!("{}: expected number at positional arg {}", ctx, pos),
    }
}

fn require_pos_u32(args: &[Arg], pos: usize, ctx: &str) -> Result<u32> {
    match get_pos(args, pos) {
        Some(Value::Int(i)) => Ok(*i as u32),
        Some(Value::Float(f)) => Ok(*f as u32),
        _ => bail!("{}: expected integer at positional arg {}", ctx, pos),
    }
}

fn require_pos_bool(args: &[Arg], pos: usize, ctx: &str) -> Result<bool> {
    match get_pos(args, pos) {
        Some(Value::Bool(b)) => Ok(*b),
        _ => bail!("{}: expected bool at positional arg {}", ctx, pos),
    }
}

fn named_value<'a>(args: &'a [Arg], name: &str) -> Option<&'a Value> {
    args.iter().find(|a| a.name.as_deref() == Some(name)).map(|a| &a.value)
}

fn named_str(args: &[Arg], name: &str) -> Option<String> {
    match named_value(args, name)? {
        Value::Str(s) => Some(s.clone()),
        _ => None,
    }
}

fn named_f64(args: &[Arg], name: &str) -> Option<f64> {
    match named_value(args, name)? {
        Value::Float(f) => Some(*f),
        Value::Int(i)   => Some(*i as f64),
        _ => None,
    }
}

fn named_u32(args: &[Arg], name: &str) -> Option<u32> {
    match named_value(args, name)? {
        Value::Int(i)   => Some(*i as u32),
        Value::Float(f) => Some(*f as u32),
        _ => None,
    }
}

fn named_bool(args: &[Arg], name: &str) -> Option<bool> {
    match named_value(args, name)? {
        Value::Bool(b) => Some(*b),
        _ => None,
    }
}

// ── value constructors ────────────────────────────────────────────────────────

fn eval_property_value(v: &Value) -> Result<PropertyValue> {
    match v {
        Value::Float(f) => Ok(PropertyValue::Float(*f)),
        Value::Int(i)   => Ok(PropertyValue::Float(*i as f64)),
        Value::Bool(b)  => Ok(PropertyValue::Bool(*b)),
        Value::Str(s)   => Ok(PropertyValue::String(s.clone())),
        Value::Constructor { name, args } => match name.as_str() {
            "float" => {
                let n = args.first().ok_or_else(|| anyhow::anyhow!("float() needs one argument"))?;
                match n { Value::Float(f) => Ok(PropertyValue::Float(*f)),
                          Value::Int(i)   => Ok(PropertyValue::Float(*i as f64)),
                          _ => bail!("float() argument must be numeric") }
            }
            "int" => {
                let n = args.first().ok_or_else(|| anyhow::anyhow!("int() needs one argument"))?;
                match n { Value::Int(i)   => Ok(PropertyValue::Int(*i)),
                          Value::Float(f) => Ok(PropertyValue::Int(*f as i64)),
                          _ => bail!("int() argument must be numeric") }
            }
            "bool" => {
                let b = args.first().ok_or_else(|| anyhow::anyhow!("bool() needs one argument"))?;
                match b { Value::Bool(v) => Ok(PropertyValue::Bool(*v)),
                          _ => bail!("bool() argument must be a boolean") }
            }
            "str" | "string" => {
                let s = args.first().ok_or_else(|| anyhow::anyhow!("str() needs one argument"))?;
                match s { Value::Str(v) => Ok(PropertyValue::String(v.clone())),
                          _ => bail!("str() argument must be a string") }
            }
            "vec2" => {
                if args.len() != 2 { bail!("vec2(x, y) requires exactly 2 arguments"); }
                let x = num_val(&args[0])?;
                let y = num_val(&args[1])?;
                Ok(PropertyValue::Vec2(x, y))
            }
            "vec3" => {
                if args.len() != 3 { bail!("vec3(x, y, z) requires exactly 3 arguments"); }
                let x = num_val(&args[0])?;
                let y = num_val(&args[1])?;
                let z = num_val(&args[2])?;
                Ok(PropertyValue::Vec3(x, y, z))
            }
            "color" => {
                if args.len() != 4 { bail!("color(r, g, b, a) requires 4 arguments (0-255)"); }
                let r = int_val_u8(&args[0])?;
                let g = int_val_u8(&args[1])?;
                let b = int_val_u8(&args[2])?;
                let a = int_val_u8(&args[3])?;
                Ok(PropertyValue::Color(r, g, b, a))
            }
            "hex" => {
                // hex("#FF8800") → Color
                if args.len() != 1 { bail!("hex(\"#RRGGBB\") requires 1 argument"); }
                match &args[0] {
                    Value::Str(s) => {
                        let s = s.trim_start_matches('#');
                        if s.len() != 6 && s.len() != 8 {
                            bail!("hex: expected 6 or 8 hex digits, got '{}'", s);
                        }
                        let r = u8::from_str_radix(&s[0..2], 16)?;
                        let g = u8::from_str_radix(&s[2..4], 16)?;
                        let b = u8::from_str_radix(&s[4..6], 16)?;
                        let a = if s.len() == 8 { u8::from_str_radix(&s[6..8], 16)? } else { 255 };
                        Ok(PropertyValue::Color(r, g, b, a))
                    }
                    _ => bail!("hex() argument must be a string"),
                }
            }
            other => bail!("unknown value constructor '{}'", other),
        },
    }
}

fn num_val(v: &Value) -> Result<f64> {
    match v {
        Value::Float(f) => Ok(*f),
        Value::Int(i)   => Ok(*i as f64),
        _ => bail!("expected number, got {:?}", v),
    }
}

fn int_val_u8(v: &Value) -> Result<u8> {
    match v {
        Value::Int(i) if *i >= 0 && *i <= 255 => Ok(*i as u8),
        Value::Float(f) if *f >= 0.0 && *f <= 255.0 => Ok(*f as u8),
        _ => bail!("expected integer 0-255, got {:?}", v),
    }
}

// ── easing parser ─────────────────────────────────────────────────────────────

fn parse_easing(s: &str) -> Result<EasingType> {
    match s {
        "linear"                  => Ok(EasingType::Linear),
        "step"                    => Ok(EasingType::Step),
        "ease-in"   | "easein"   => Ok(EasingType::EaseIn),
        "ease-out"  | "easeout"  => Ok(EasingType::EaseOut),
        "ease-in-out" | "easeinout" => Ok(EasingType::EaseInOut),
        s if s.starts_with("bezier:") => {
            let nums: Vec<f64> = s["bezier:".len()..]
                .split(',')
                .map(|v| v.parse::<f64>())
                .collect::<std::result::Result<_, _>>()?;
            if nums.len() != 4 { bail!("bezier requires 4 values: bezier:x1,y1,x2,y2"); }
            Ok(EasingType::Bezier(nums[0], nums[1], nums[2], nums[3]))
        }
        other => bail!("unknown easing '{}'. Use: linear step ease-in ease-out ease-in-out bezier:x1,y1,x2,y2", other),
    }
}



