use wasm_bindgen::prelude::*;
use kernel_core::{Project, Scene, Layer, GameObjectData};
use kernel_core::ecs::systems::PlaybackState;
use kernel_core::storage::{serialize_project, deserialize_project};
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
/// ```
#[wasm_bindgen]
pub struct KernelAPI {
    project: Option<Project>,
    playback: Option<PlaybackState>,
}

#[wasm_bindgen]
impl KernelAPI {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Self {
            project: None,
            playback: None,
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
            pb.advance(delta_seconds);
            pb.current_frame
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
    fn handle_command(&mut self, cmd: CommandEnvelope) -> CommandResponse {
        match cmd {
            CommandEnvelope::CreateProject(c) => {
                let id = nanoid!();
                let mut project = Project::new(id.clone(), c.name, c.fps, c.canvas_width, c.canvas_height);
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
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::LoadProject(c) => {
                if self.load_project_bytes(&c.data) {
                    CommandResponse::ok_empty()
                } else {
                    CommandResponse::err("Failed to load project")
                }
            }

            CommandEnvelope::SaveProject => {
                let bytes = self.save_project_bytes();
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
                let scene = Scene::new(id.clone(), c.name, c.fps, c.duration);
                project.add_scene(scene);
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
                scene.add_layer(Layer::new(id.clone(), c.name));
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
                let go = GameObjectData::new(id.clone(), c.name, c.born_frame);
                scene.add_game_object(&c.layer_id, go);
                CommandResponse::ok_with_id(id)
            }

            CommandEnvelope::DeleteGameObject(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene = match project.current_scene_mut() {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                if scene.game_objects.remove(&c.game_object_id).is_some() {
                    // Also remove from layer
                    for layer in scene.layers.values_mut() {
                        layer.game_object_ids.retain(|id| id != &c.game_object_id);
                    }
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
                let scene = match project.current_scene_mut() {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => { go.active = c.active; CommandResponse::ok_empty() }
                    None => CommandResponse::err("GameObject not found"),
                }
            }

            CommandEnvelope::SetKeyFrame(c) => {
                let project = match &mut self.project {
                    Some(p) => p,
                    None => return CommandResponse::err("No project loaded"),
                };
                let scene = match project.current_scene_mut() {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => {
                        let kf = proto_keyframe_to_core(&c.keyframe);
                        go.set_keyframe(&c.component_type, &c.prop_name, kf);
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
                let scene = match project.current_scene_mut() {
                    Some(s) => s,
                    None => return CommandResponse::err("No current scene"),
                };
                match scene.game_objects.get_mut(&c.game_object_id) {
                    Some(go) => {
                        go.remove_keyframe(&c.component_type, &c.prop_name, c.frame);
                        CommandResponse::ok_empty()
                    }
                    None => CommandResponse::err("GameObject not found"),
                }
            }

            CommandEnvelope::Play => {
                if let Some(pb) = &mut self.playback { pb.play(); }
                CommandResponse::ok_empty()
            }
            CommandEnvelope::Pause => {
                if let Some(pb) = &mut self.playback { pb.pause(); }
                CommandResponse::ok_empty()
            }
            CommandEnvelope::Stop => {
                if let Some(pb) = &mut self.playback { pb.stop(); }
                CommandResponse::ok_empty()
            }

            CommandEnvelope::SetCurrentFrame(c) => {
                if let Some(pb) = &mut self.playback {
                    pb.current_frame = c.frame.min(pb.total_frames);
                }
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

