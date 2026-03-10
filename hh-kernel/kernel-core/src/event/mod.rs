//! # HuaHuo Event System (kernel-core::event)
//!
//! A lightweight PubSub bus for both native Rust and WASM contexts.
//!
//! ## Event categories
//!
//! - `Project` — created / loaded / saved / fps-changed / size-changed
//! - `Scene`   — created / removed / renamed / fps-changed / duration-changed
//! - `Layer`   — created / removed / visibility / lock / order
//! - `GameObject` — created / deleted / renamed / active / born-frame / moved
//! - `Component`  — added / removed / enabled-changed
//! - `Keyframe`   — set / removed
//! - `Playback`   — started / paused / stopped / frame-changed / looped / end
//! - `Element`    — created / removed / renamed / layer-added / instantiated
//!
//! ## Topic filter syntax
//!
//! | Pattern | Matches |
//! |---------|---------|
//! | `"*"` | every event |
//! | `"project"` | all Project events |
//! | `"scene"` | all Scene events |
//! | `"scene/<id>"` | specific scene by id or name |
//! | `"layer"` | all Layer events |
//! | `"go"` | all GameObject events |
//! | `"go/<name_or_id>"` | GO by name or id |
//! | `"component"` | all Component events |
//! | `"component/<type>"` | e.g. `"component/Transform"` |
//! | `"keyframe"` | all Keyframe events |
//! | `"keyframe/<go>/<comp>/<prop>"` | specific property (each segment can be `"*"`) |
//! | `"playback"` | all Playback events |
//! | `"playback/<kind>"` | e.g. `"playback/frame_changed"` |
//! | `"element"` | all Element events |
//! | `"element/<name_or_id>"` | specific element |

pub mod bus;
pub mod types;

pub use bus::{EventBus, SubId, TopicPatternCheck};
pub use types::*;

