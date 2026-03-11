use wasm_bindgen::prelude::*;
use kernel_core::{Project, Scene, Layer, GameObjectData};
use kernel_core::ecs::systems::PlaybackState;
use kernel_core::storage::{serialize_project, deserialize_project};

use kernel_core::event::{EventBus, HhEvent, TopicPatternCheck};
use kernel_core::event::types::{
    ProjectEvent, ProjectEventKind,
    SceneEvent, SceneEventKind,
    LayerEvent, LayerEventKind,
    GameObjectEvent, GoEventKind,
    KeyframeEvent, KeyframeEventKind,
    PlaybackEvent, PlaybackEventKind,
};
use kernel_proto::generated::*;
use kernel_proto::convert::proto_keyframe_to_core;
use nanoid::nanoid;

/// The main WASM-exposed kernel API.
///
/// Usage from TypeScript:
/// ```typescript
/// import init, { KernelAPI } from '@huahuo/kernel-wasm';
/// await init();
/// const kernel = new KernelAPI();
/// kernel.dispatch(JSON.stringify({ cmd: 'CreateProject', name: 'My Project', fps: 30, canvas_width: 800, canvas_height: 600 }));
///
/// // Subscribe to events from JS
/// const subId = kernel.subscribe_js("go/ball", (evJson) => {
///     const ev = JSON.parse(evJson);
///     console.log("ball changed:", ev);
/// });
/// kernel.unsubscribe_js(subId);
///
/// // Or poll after each dispatch:
/// const events = JSON.parse(kernel.take_pending_events_json());
/// ```
#[wasm_bindgen]
pub struct KernelAPI {
    project: Option<Project>,
    playback: Option<PlaybackState>,
    bus: EventBus,
    /// JS-side subscribers: (sub_id, pattern, js_callback)
    js_subs: Vec<(u64, String, js_sys::Function)>,
    next_js_sub_id: u64,
}

#[wasm_bindgen]
impl KernelAPI {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Self {
            project: None,
            playback: None,
            bus: EventBus::new(),
            js_subs: Vec::new(),
            next_js_sub_id: 1,
        }
    }

    /// Dispatch a JSON-encoded command. Returns a JSON-encoded CommandResponse.
    ///
    /// This is the single entry point for all write operations.
    #[wasm_bindgen]
    pub fn dispatch(&mut self, cmd_json: &str) -> String {
        let cmd: CommandEnvelope = match serde_json::from_str(cmd_json) {
            Ok(c) => c,
            Err(e) => return serde_json::to_string(&CommandResponse::err(format!("Parse error: {}", e))).unwrap(),
        };
        let result = self.handle_command(cmd);
        // Deliver pending events to JS subscribers
        self.deliver_to_js_subs();
        serde_json::to_string(&result).unwrap_or_else(|_| r#"{"ok":false,"error":"serialize error"}"#.to_string())
    }

    /// Execute a JSON-encoded query. Returns a JSON-encoded QueryResponse.
    #[wasm_bindgen]
    pub fn query(&self, query_json: &str) -> String {
        let q: QueryEnvelope = match serde_json::from_str(query_json) {
            Ok(q) => q,
            Err(e) => return serde_json::to_string(&QueryResponse::err(format!("Parse error: {}", e))).unwrap(),
        };
        let result = self.handle_query(q);
        serde_json::to_string(&result).unwrap_or_else(|_| r#"{"ok":false,"error":"serialize error"}"#.to_string())
    }

    // ── Event subscription (JS side) ──────────────────────────────────────────

    /// Subscribe to events from JavaScript.
    ///
    /// `pattern` supports:
    /// - `"*"` — all events
    /// - `"project"`, `"scene"`, `"go"`, `"component"`, `"keyframe"`, `"playback"`, `"element"`
    /// - `"go/<name_or_id>"` — specific GameObject
    /// - `"component/<type>"` — e.g. `"component/Transform"`
    /// - `"keyframe/<go>/<comp>/<prop>"` — e.g. `"keyframe/ball/Transform/position"`
    ///   (use `"*"` for any segment, e.g. `"keyframe/*/Transform/position"`)
    /// - `"scene/<name_or_id>"`
    /// - `"playback/<kind>"` — e.g. `"playback/frame_changed"`
    /// - `"element/<name_or_id>"`
    ///
    /// `callback` receives a single JSON string argument — the serialized `HhEvent`.
    ///
    /// Returns a `sub_id` to pass to `unsubscribe_js()`.
    #[wasm_bindgen]
    pub fn subscribe_js(&mut self, pattern: &str, callback: js_sys::Function) -> u64 {
        let id = self.next_js_sub_id;
        self.next_js_sub_id += 1;
        self.js_subs.push((id, pattern.to_string(), callback));
        id
    }

    /// Unsubscribe a JS callback by its sub_id.
    #[wasm_bindgen]
    pub fn unsubscribe_js(&mut self, sub_id: u64) {
        self.js_subs.retain(|(id, _, _)| *id != sub_id);
    }

    /// Drain and return all pending events as a JSON array string.
    ///
    /// Use this as an alternative to per-subscriber callbacks — poll after each `dispatch()`.
    ///
    /// ```typescript
    /// kernel.dispatch(cmd);
    /// const events = JSON.parse(kernel.take_pending_events_json());
    /// for (const ev of events) { handleEvent(ev); }
    /// ```
    #[wasm_bindgen]
    pub fn take_pending_events_json(&mut self) -> String {
        self.bus.take_pending_events_json()
    }

    /// Returns true if there are events pending (not yet drained).
    #[wasm_bindgen]
    pub fn has_pending_events(&self) -> bool {
        self.bus.has_pending()
    }

    /// Save the current project to binary bytes.
    #[wasm_bindgen]
    pub fn save_project_bytes(&self) -> Vec<u8> {
        match &self.project {
            Some(p) => serialize_project(p).unwrap_or_default(),
            None => vec![],
        }
    }

    /// Load a project from binary bytes.
    #[wasm_bindgen]
    pub fn load_project_bytes(&mut self, data: &[u8]) -> bool {
        match deserialize_project(data) {
            Ok(p) => {
                let fps = p.fps;
                let total = p.effective_total_frames();
                self.playback = Some(PlaybackState::new(fps, total));
                self.project = Some(p);
                true
            }
            Err(_) => false,
        }
    }

    /// Get interpolated props for a game object at a frame as JSON.
    #[wasm_bindgen]
    pub fn get_interpolated_props_json(&self, game_object_id: &str, frame: u32) -> String {
        let project = match &self.project {
            Some(p) => p,
            None => return "{}".to_string(),
        };
        let scene = match project.current_scene() {
            Some(s) => s,
            None => return "{}".to_string(),
        };
        let go = match scene.game_objects.get(game_object_id) {
            Some(g) => g,
            None => return "{}".to_string(),
        };
        let props = kernel_core::interpolate_game_object(go, frame);
        serde_json::to_string(&props).unwrap_or_else(|_| "{}".to_string())
    }

    /// Advance playback by delta_seconds. Returns the new frame number.
    #[wasm_bindgen]
    pub fn tick(&mut self, delta_seconds: f64) -> u32 {
        if let Some(pb) = &mut self.playback {
            let prev_frame = pb.current_frame;
            pb.advance(delta_seconds);
            let new_frame = pb.current_frame;
            if new_frame != prev_frame {
                let kind = if new_frame < prev_frame {
                    PlaybackEventKind::LoopedBack
                } else if !pb.is_playing && new_frame == pb.total_frames {
                    PlaybackEventKind::ReachedEnd
                } else {
                    PlaybackEventKind::FrameChanged
                };
                self.bus.publish(HhEvent::Playback(PlaybackEvent { frame: new_frame, kind }));
                self.deliver_to_js_subs();
            }
            new_frame
        } else {
            0
        }
    }

    /// Get current playback state as JSON.
    #[wasm_bindgen]
    pub fn get_playback_state_json(&self) -> String {
        match &self.playback {
            Some(pb) => serde_json::to_string(pb).unwrap_or_default(),
            None => "null".to_string(),
        }
    }
}

impl KernelAPI {
    /// Deliver all pending events to JS subscribers, then clear the queue.
    fn deliver_to_js_subs(&mut self) {
        if self.js_subs.is_empty() {
            // Still drain so the queue doesn't grow unboundedly
            let _ = self.bus.take_pending_events_json();
            return;
        }
        // Snapshot pending events; take_pending clears them
        let json = self.bus.take_pending_events_json();
        let events: Vec<HhEvent> = match serde_json::from_str(&json) {
            Ok(v) => v,
            Err(_) => return,
        };
        for event in &events {
            let ev_json = match serde_json::to_string(event) {
                Ok(s) => s,
                Err(_) => continue,
            };
            for (_, pattern, cb) in &self.js_subs {
                    if TopicPatternCheck::matches_str(pattern, event) {
                    let this = JsValue::null();
                    let arg = JsValue::from_str(&ev_json);
                    let _ = cb.call1(&this, &arg);
                }
            }
        }
    }

    fn handle_command(&mut self, cmd: CommandEnvelope) -> CommandResponse {
        match cmd {
            CommandEnvelope::CreateProject(c) => {
                let id = nanoid!();
                let mut project = Project::new(id.clone(), c.name.clone(), c.fps, c.canvas_width, c.canvas_height);
                // Create a default scene
                let scene_id = nanoid!();
                let mut scene = Scene::new(scene_id.clone(), "DefaultScene".to_string(), c.fps, 5.0);
                // Add default layers
                scene.add_layer(Layer::new(nanoid!(), "background".to_string()));
                scene.add_layer(Layer::new(nanoid!(), "drawing".to_string()));
                project.add_scene(scene);
                let total = project.effective_total_frames();
                self.playback = Some(PlaybackState::new(c.fps, total));
                self.project = Some(project);
                self.bus.publish(HhEvent::Project(ProjectEvent {
                    project_id: id.clone(),
                    kind: ProjectEventKind::Created,
                }));
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::LoadProject(c) => {
                if self.load_project_bytes(&c.data) {
                    let pid = self.project.as_ref().map(|p| p.id.clone()).unwrap_or_default();
                    self.bus.publish(HhEvent::Project(ProjectEvent {
                        project_id: pid,
                        kind: ProjectEventKind::Loaded,
                    }));
                    CommandResponse::ok_empty()
                } else {
                    CommandResponse::err("Failed to load project")
                }
            }

            CommandEnvelope::SaveProject => {
                let bytes = self.save_project_bytes();
                let pid = self.project.as_ref().map(|p| p.id.clone()).unwrap_or_default();
                self.bus.publish(HhEvent::Project(ProjectEvent {
                    project_id: pid,
                    kind: ProjectEventKind::Saved,
                }));
                CommandResponse {
                    ok: true,
                    error: String::new(),
                    created_id: String::new(),
                    payload: bytes,
                }
            }

            CommandEnvelope::CreateScene(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let id = nanoid!();
                let scene = Scene::new(id.clone(), c.name.clone(), c.fps, c.duration);
                project.add_scene(scene);
                self.bus.publish(HhEvent::Scene(SceneEvent {
                    scene_id: id.clone(),
                    scene_name: c.name,
                    kind: SceneEventKind::Created,
                }));
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::CreateLayer(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene = match project.scenes.get_mut(&c.scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err(format!("Scene not found: {}", c.scene_id)),
                };
                let id = nanoid!();
                let name = c.name.clone();
                scene.add_layer(Layer::new(id.clone(), name.clone()));
                self.bus.publish(HhEvent::Layer(LayerEvent {
                    scene_id: c.scene_id,
                    layer_id: id.clone(),
                    layer_name: name,
                    kind: LayerEventKind::Created,
                }));
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::CreateGameObject(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene_id = match &project.current_scene_id {
                    Some(id) => id.clone(),
                    None => return CommandResponse::err("No current scene"),
                };
                let scene = match project.scenes.get_mut(&scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err("Current scene not found"),
                };
                let id = nanoid!();
                let name = c.name.clone();
                let layer_id = c.layer_id.clone();
                let go = GameObjectData::new(id.clone(), name.clone(), c.born_frame);
                scene.add_game_object(&layer_id, go);
                self.bus.publish(HhEvent::GameObject(GameObjectEvent {
                    scene_id,
                    layer_id,
                    go_id: id.clone(),
                    go_name: name,
                    kind: GoEventKind::Created,
                }));
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::DeleteGameObject(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene_id = project.current_scene_id.clone().unwrap_or_default();
                let scene = match project.scenes.get_mut(&scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                if let Some(go) = scene.game_objects.remove(&c.game_object_id) {
                    let mut found_layer = String::new();
                    for (lid, layer) in scene.layers.iter_mut() {
                        if layer.game_object_ids.contains(&c.game_object_id) {
                            found_layer = lid.clone();
                            layer.game_object_ids.retain(|id| id != &c.game_object_id);
                        }
                    }
                    self.bus.publish(HhEvent::GameObject(GameObjectEvent {
                        scene_id,
                        layer_id: found_layer,
                        go_id: go.id.clone(),
                        go_name: go.name.clone(),
                        kind: GoEventKind::Deleted,
                    }));
                    CommandResponse::ok_empty()
                } else {
                    CommandResponse::err("GameObject not found")
                }
            }

            CommandEnvelope::SetGameObjectActive(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene_id = project.current_scene_id.clone().unwrap_or_default();
                let scene = match project.scenes.get_mut(&scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => {
                        go.active = c.active;
                        let go_name = go.name.clone();
                        let go_id = go.id.clone();
                        let lid = scene.layers.iter()
                            .find(|(_, l)| l.game_object_ids.contains(&go_id))
                            .map(|(lid, _)| lid.clone())
                            .unwrap_or_default();
                        self.bus.publish(HhEvent::GameObject(GameObjectEvent {
                            scene_id,
                            layer_id: lid,
                            go_id,
                            go_name,
                            kind: GoEventKind::ActiveChanged,
                        }));
                        CommandResponse::ok_empty()
                    }
                    None => CommandResponse::err("GameObject not found"),
                }
            }

            CommandEnvelope::SetKeyFrame(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene_id = project.current_scene_id.clone().unwrap_or_default();
                let scene = match project.scenes.get_mut(&scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => {
                        let kf = proto_keyframe_to_core(&c.keyframe);
                        let frame = kf.frame;
                        let go_name = go.name.clone();
                        let go_id = go.id.clone();
                        go.set_keyframe(&c.component_type, &c.prop_name, kf);
                        self.bus.publish(HhEvent::Keyframe(KeyframeEvent {
                            go_id,
                            go_name,
                            comp_type: c.component_type,
                            prop_name: c.prop_name,
                            frame,
                            kind: KeyframeEventKind::Set,
                        }));
                        CommandResponse::ok_empty()
                    }
                    None => CommandResponse::err("GameObject not found"),
                }
            }

            CommandEnvelope::RemoveKeyFrame(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene_id = project.current_scene_id.clone().unwrap_or_default();
                let scene = match project.scenes.get_mut(&scene_id) {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => {
                        let go_name = go.name.clone();
                        let go_id = go.id.clone();
                        go.remove_keyframe(&c.component_type, &c.prop_name, c.frame);
                        self.bus.publish(HhEvent::Keyframe(KeyframeEvent {
                            go_id,
                            go_name,
                            comp_type: c.component_type,
                            prop_name: c.prop_name,
                            frame: c.frame,
                            kind: KeyframeEventKind::Removed,
                        }));
                        CommandResponse::ok_empty()
                    }
                    None => CommandResponse::err("GameObject not found"),
                }
            }

            CommandEnvelope::Play => {
                if let Some(pb) = &mut self.playback { pb.play(); }
                self.bus.publish(HhEvent::Playback(PlaybackEvent {
                    frame: self.playback.as_ref().map(|p| p.current_frame).unwrap_or(0),
                    kind: PlaybackEventKind::Started,
                }));
                CommandResponse::ok_empty()
            }
            CommandEnvelope::Pause => {
                if let Some(pb) = &mut self.playback { pb.pause(); }
                self.bus.publish(HhEvent::Playback(PlaybackEvent {
                    frame: self.playback.as_ref().map(|p| p.current_frame).unwrap_or(0),
                    kind: PlaybackEventKind::Paused,
                }));
                CommandResponse::ok_empty()
            }
            CommandEnvelope::Stop => {
                if let Some(pb) = &mut self.playback { pb.stop(); }
                self.bus.publish(HhEvent::Playback(PlaybackEvent {
                    frame: 0,
                    kind: PlaybackEventKind::Stopped,
                }));
                CommandResponse::ok_empty()
            }

            CommandEnvelope::SetCurrentFrame(c) => {
                if let Some(pb) = &mut self.playback {
                    pb.current_frame = c.frame.min(pb.total_frames);
                }
                self.bus.publish(HhEvent::Playback(PlaybackEvent {
                    frame: c.frame,
                    kind: PlaybackEventKind::FrameChanged,
                }));
                CommandResponse::ok_empty()
            }

            CommandEnvelope::EmbedAnimation(c) => {
                match deserialize_project(&c.sub_project_data) {
                    Ok(sub_project) => {
                        let project = match &mut self.project {
                            Some(p) => p,
                            None => return CommandResponse::err("No project loaded"),
                        };
                        let sub_id = sub_project.id.clone();
                        if !project.embed_sub_project(sub_project, 16) {
                            return CommandResponse::err("Failed to embed (cycle or duplicate ID)");
                        }
                        // Set AnimationRef on the game object
                        let scene = match project.current_scene_mut() {
                            Some(s) => s,
                            None => return CommandResponse::err("No current scene"),
                        };
                        if let Some(go) = scene.game_objects.get_mut(&c.target_game_object_id) {
                            go.animation_ref = Some(kernel_core::ecs::components::builtin::AnimationRef {
                                project_id: sub_id,
                                start_frame: c.start_frame,
                                time_scale: c.time_scale,
                                loop_playback: c.loop_playback,
                            });
                        }
                        CommandResponse::ok_empty()
                    }
                    Err(e) => CommandResponse::err(format!("Failed to deserialize sub-project: {}", e)),
                }
            }
        }
    }

    fn handle_query(&self, q: QueryEnvelope) -> QueryResponse {
        match q {
            QueryEnvelope::GetProject => {
                match &self.project {
                    Some(p) => {
                        let json = serde_json::to_vec(p).unwrap_or_default();
                        QueryResponse::ok(json)
                    }
                    None => QueryResponse::err("No project loaded"),
                }
            }

            QueryEnvelope::GetScene { scene_id } => {
                let project = match &self.project {
                    Some(p) => p,
                    None => return QueryResponse::err("No project loaded"),
                };
                match project.scenes.get(&scene_id) {
                    Some(scene) => {
                        let json = serde_json::to_vec(scene).unwrap_or_default();
                        QueryResponse::ok(json)
                    }
                    None => QueryResponse::err(format!("Scene not found: {}", scene_id)),
                }
            }

            QueryEnvelope::GetGameObject { game_object_id } => {
                let project = match &self.project {
                    Some(p) => p,
                    None => return QueryResponse::err("No project loaded"),
                };
                let scene = match project.current_scene() {
                    Some(s) => s,
                    None => return QueryResponse::err("No current scene"),
                };
                match scene.game_objects.get(&game_object_id) {
                    Some(go) => QueryResponse::ok(serde_json::to_vec(go).unwrap_or_default()),
                    None => QueryResponse::err("GameObject not found"),
                }
            }

            QueryEnvelope::GetInterpolatedProps { game_object_id, frame } => {
                let project = match &self.project {
                    Some(p) => p,
                    None => return QueryResponse::err("No project loaded"),
                };
                let scene = match project.current_scene() {
                    Some(s) => s,
                    None => return QueryResponse::err("No current scene"),
                };
                match scene.game_objects.get(&game_object_id) {
                    Some(go) => {
                        let props = kernel_core::interpolate_game_object(go, frame);
                        QueryResponse::ok(serde_json::to_vec(&props).unwrap_or_default())
                    }
                    None => QueryResponse::err("GameObject not found"),
                }
            }

            QueryEnvelope::GetActiveGameObjects { scene_id, frame } => {
                let project = match &self.project {
                    Some(p) => p,
                    None => return QueryResponse::err("No project loaded"),
                };
                let scene = match project.scenes.get(&scene_id) {
                    Some(s) => s,
                    None => return QueryResponse::err("Scene not found"),
                };
                let ids: Vec<String> = scene.game_objects.values()
                    .filter(|go| go.active && go.born_frame_id <= frame)
                    .map(|go| go.id.clone())
                    .collect();
                QueryResponse::ok(serde_json::to_vec(&ids).unwrap_or_default())
            }

            QueryEnvelope::GetPlaybackState => {
                match &self.playback {
                    Some(pb) => QueryResponse::ok(serde_json::to_vec(pb).unwrap_or_default()),
                    None => QueryResponse::err("No playback state"),
                }
            }
        }
    }
}

