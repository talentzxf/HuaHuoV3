//! The EventBus: topic-filtered PubSub for both Rust and WASM contexts.
//!
//! # Topic matching rules
//!
//! A subscriber specifies a **topic pattern** string. An event matches if:
//!
//! 1. Pattern is `"*"` → matches everything
//! 2. Pattern == event category (`"project"`, `"scene"`, `"go"`, …) → all events of that category
//! 3. Pattern `"scene/<id>"` → SceneEvent with matching scene_id or scene_name
//! 4. Pattern `"go/<name_or_id>"` → GoEvent with matching go_id or go_name
//! 5. Pattern `"component/<type>"` → ComponentEvent with matching comp_type
//! 6. Pattern `"keyframe/<go>/<comp>/<prop>"` → KeyframeEvent matching all three (each segment
//!    can be `"*"` to wildcard that level)
//! 7. Pattern `"playback/<kind>"` → PlaybackEvent with matching kind string
//! 8. Pattern `"element/<name_or_id>"` → ElementEvent matching element_id or element_name

use std::sync::atomic::{AtomicU64, Ordering};
use super::types::*;

static NEXT_SUB_ID: AtomicU64 = AtomicU64::new(1);

/// A unique subscription ID returned by `subscribe`. Use it to `unsubscribe`.
pub type SubId = u64;

/// A native Rust callback. Receives a reference to the event.
pub type RustCallback = Box<dyn Fn(&HhEvent) + Send + Sync + 'static>;

struct Subscription {
    id: SubId,
    pattern: TopicPattern,
    callback: RustCallback,
}

/// The event bus.
/// Cheap to clone (Arc-internally) if you need shared ownership across threads.
/// In WASM the `KernelAPI` owns one directly — no Arc needed.
pub struct EventBus {
    subs: Vec<Subscription>,
    /// Events queued for JS-side delivery (drained by `take_pending_events_json`)
    pending: Vec<HhEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            subs: Vec::new(),
            pending: Vec::new(),
        }
    }

    // ── Rust-side subscribe / unsubscribe ─────────────────────────────────────

    /// Subscribe with a Rust callback. Returns a `SubId` for later unsubscription.
    ///
    /// ```no_run
    /// # let mut bus = kernel_core::EventBus::new();
    /// let id = bus.subscribe("go/ball", |ev| println!("{:?}", ev));
    /// ```
    pub fn subscribe<F>(&mut self, pattern: &str, callback: F) -> SubId
    where
        F: Fn(&HhEvent) + Send + Sync + 'static,
    {
        let id = NEXT_SUB_ID.fetch_add(1, Ordering::Relaxed);
        self.subs.push(Subscription {
            id,
            pattern: TopicPattern::parse(pattern),
            callback: Box::new(callback),
        });
        id
    }

    /// Remove a subscription by its ID.
    pub fn unsubscribe(&mut self, id: SubId) {
        self.subs.retain(|s| s.id != id);
    }

    // ── Publish ───────────────────────────────────────────────────────────────

    /// Publish an event. Immediately invokes all matching Rust callbacks,
    /// and queues the event for JS delivery (via `take_pending_events_json`).
    pub fn publish(&mut self, event: HhEvent) {
        // 1. Rust callbacks
        for sub in &self.subs {
            if sub.pattern.matches(&event) {
                (sub.callback)(&event);
            }
        }
        // 2. Queue for JS/WASM delivery
        self.pending.push(event);
    }

    // ── JS/WASM side: drain the pending queue ─────────────────────────────────

    /// Returns all pending events as a JSON array string, and clears the queue.
    /// Call this from JS after each `dispatch()` to process events.
    ///
    /// ```no_run
    /// // TypeScript (after wasm-bindgen):
    /// // kernel.dispatch(...);
    /// // const events = JSON.parse(kernel.take_pending_events_json());
    /// // for (const ev of events) { ... }
    /// ```
    pub fn take_pending_events_json(&mut self) -> String {
        let events = std::mem::take(&mut self.pending);
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
    }

    /// Returns true if there are events waiting to be drained.
    pub fn has_pending(&self) -> bool {
        !self.pending.is_empty()
    }

    /// Peek at pending events without consuming them.
    pub fn peek_pending(&self) -> &[HhEvent] {
        &self.pending
    }

    // ── Convenience: subscribe returning events by category ──────────────────

    /// Subscribe to all events of a given category.
    pub fn subscribe_all<F>(&mut self, callback: F) -> SubId
    where
        F: Fn(&HhEvent) + Send + Sync + 'static,
    {
        self.subscribe("*", callback)
    }

    pub fn subscribe_project<F>(&mut self, callback: F) -> SubId
    where
        F: Fn(&ProjectEvent) + Send + Sync + 'static,
    {
        self.subscribe("project", move |ev| {
            if let HhEvent::Project(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_scene<F>(&mut self, callback: F) -> SubId
    where
        F: Fn(&SceneEvent) + Send + Sync + 'static,
    {
        self.subscribe("scene", move |ev| {
            if let HhEvent::Scene(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_go<F>(&mut self, callback: F) -> SubId
    where
        F: Fn(&GameObjectEvent) + Send + Sync + 'static,
    {
        self.subscribe("go", move |ev| {
            if let HhEvent::GameObject(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_go_by_name<F>(&mut self, go_name: &str, callback: F) -> SubId
    where
        F: Fn(&GameObjectEvent) + Send + Sync + 'static,
    {
        let pattern = format!("go/{}", go_name);
        self.subscribe(&pattern, move |ev| {
            if let HhEvent::GameObject(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_component_type<F>(&mut self, comp_type: &str, callback: F) -> SubId
    where
        F: Fn(&ComponentEvent) + Send + Sync + 'static,
    {
        let pattern = format!("component/{}", comp_type);
        self.subscribe(&pattern, move |ev| {
            if let HhEvent::Component(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_keyframe<F>(&mut self, go: &str, comp: &str, prop: &str, callback: F) -> SubId
    where
        F: Fn(&KeyframeEvent) + Send + Sync + 'static,
    {
        let pattern = format!("keyframe/{}/{}/{}", go, comp, prop);
        self.subscribe(&pattern, move |ev| {
            if let HhEvent::Keyframe(e) = ev { callback(e); }
        })
    }

    pub fn subscribe_playback<F>(&mut self, callback: F) -> SubId
    where
        F: Fn(&PlaybackEvent) + Send + Sync + 'static,
    {
        self.subscribe("playback", move |ev| {
            if let HhEvent::Playback(e) = ev { callback(e); }
        })
    }
}

impl Default for EventBus {
    fn default() -> Self { Self::new() }
}

// ── Topic pattern ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
enum TopicPattern {
    /// `"*"` — match everything
    Wildcard,
    /// `"<category>"` — all events of that category
    Category(String),
    /// `"scene/<id_or_name>"`
    Scene { key: String },
    /// `"go/<name_or_id>"`
    Go { key: String },
    /// `"component/<type>"` — optionally `"*"` to match all
    Component { comp_type: String },
    /// `"keyframe/<go>/<comp>/<prop>"` — each segment can be `"*"`
    Keyframe { go: String, comp: String, prop: String },
    /// `"playback/<kind>"`
    Playback { kind: String },
    /// `"element/<name_or_id>"`
    Element { key: String },
}

impl TopicPattern {
    fn parse(pattern: &str) -> Self {
        if pattern == "*" {
            return TopicPattern::Wildcard;
        }
        let parts: Vec<&str> = pattern.splitn(5, '/').collect();
        match parts[0] {
            "scene" if parts.len() >= 2 => TopicPattern::Scene { key: parts[1].to_string() },
            "go"    if parts.len() >= 2 => TopicPattern::Go    { key: parts[1].to_string() },
            "component" if parts.len() >= 2 => TopicPattern::Component { comp_type: parts[1].to_string() },
            "keyframe"  if parts.len() >= 4 => TopicPattern::Keyframe {
                go:   parts[1].to_string(),
                comp: parts[2].to_string(),
                prop: parts[3].to_string(),
            },
            "playback" if parts.len() >= 2 => TopicPattern::Playback { kind: parts[1].to_string() },
            "element"  if parts.len() >= 2 => TopicPattern::Element  { key: parts[1].to_string() },
            cat => TopicPattern::Category(cat.to_string()),
        }
    }

    fn seg_match(pattern: &str, value: &str) -> bool {
        pattern == "*" || pattern == value
    }

    fn matches(&self, event: &HhEvent) -> bool {
        match self {
            TopicPattern::Wildcard => true,

            TopicPattern::Category(cat) => event.category() == cat.as_str(),

            TopicPattern::Scene { key } => {
                if let HhEvent::Scene(e) = event {
                    key == "*" || e.scene_id == *key || e.scene_name == *key
                } else { false }
            }

            TopicPattern::Go { key } => {
                if let HhEvent::GameObject(e) = event {
                    key == "*" || e.go_id == *key || e.go_name == *key
                } else { false }
            }

            TopicPattern::Component { comp_type } => {
                if let HhEvent::Component(e) = event {
                    comp_type == "*" || e.comp_type == *comp_type
                } else { false }
            }

            TopicPattern::Keyframe { go, comp, prop } => {
                if let HhEvent::Keyframe(e) = event {
                    (Self::seg_match(go, &e.go_id) || Self::seg_match(go, &e.go_name))
                        && Self::seg_match(comp, &e.comp_type)
                        && Self::seg_match(prop, &e.prop_name)
                } else { false }
            }

            TopicPattern::Playback { kind } => {
                if let HhEvent::Playback(e) = event {
                    if kind == "*" { return true; }
                    let kind_str = match e.kind {
                        PlaybackEventKind::Started      => "started",
                        PlaybackEventKind::Paused       => "paused",
                        PlaybackEventKind::Stopped      => "stopped",
                        PlaybackEventKind::FrameChanged => "frame_changed",
                        PlaybackEventKind::LoopedBack   => "looped_back",
                        PlaybackEventKind::ReachedEnd   => "reached_end",
                    };
                    kind == kind_str
                } else { false }
            }

            TopicPattern::Element { key } => {
                if let HhEvent::Element(e) = event {
                    key == "*" || e.element_id == *key || e.element_name == *key
                } else { false }
            }
        }
    }
}

// ── Public pattern check facade (used by kernel-wasm for JS delivery) ─────────

/// Exposes the topic matching logic for use outside the bus (e.g. WASM layer).
pub struct TopicPatternCheck;

impl TopicPatternCheck {
    /// Returns true if `pattern` matches `event`.
    pub fn matches_str(pattern: &str, event: &HhEvent) -> bool {
        TopicPattern::parse(pattern).matches(event)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    fn make_go_event(go_name: &str) -> HhEvent {
        HhEvent::GameObject(GameObjectEvent {
            scene_id: "s1".into(),
            layer_id: "l1".into(),
            go_id: "go_001".into(),
            go_name: go_name.to_string(),
            kind: GoEventKind::Created,
        })
    }

    fn make_kf_event(go: &str, comp: &str, prop: &str) -> HhEvent {
        HhEvent::Keyframe(KeyframeEvent {
            go_id: "go_001".into(),
            go_name: go.to_string(),
            comp_type: comp.to_string(),
            prop_name: prop.to_string(),
            frame: 0,
            kind: KeyframeEventKind::Set,
        })
    }

    #[test]
    fn wildcard_matches_all() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        bus.subscribe("*", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(make_go_event("ball"));
        bus.publish(HhEvent::Playback(PlaybackEvent { frame: 0, kind: PlaybackEventKind::Started }));
        assert_eq!(*count.lock().unwrap(), 2);
    }

    #[test]
    fn category_filter() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        bus.subscribe("go", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(make_go_event("ball"));
        bus.publish(HhEvent::Playback(PlaybackEvent { frame: 0, kind: PlaybackEventKind::Started }));
        assert_eq!(*count.lock().unwrap(), 1);
    }

    #[test]
    fn go_name_filter() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        bus.subscribe("go/ball", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(make_go_event("ball"));
        bus.publish(make_go_event("rect"));
        assert_eq!(*count.lock().unwrap(), 1);
    }

    #[test]
    fn keyframe_wildcard_go() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        // Subscribe to any GO's Transform.position keyframe changes
        bus.subscribe("keyframe/*/Transform/position", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(make_kf_event("ball", "Transform", "position"));
        bus.publish(make_kf_event("rect", "Transform", "position"));
        bus.publish(make_kf_event("ball", "Visual", "opacity"));
        assert_eq!(*count.lock().unwrap(), 2);
    }

    #[test]
    fn unsubscribe() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        let id = bus.subscribe("*", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(make_go_event("ball"));
        bus.unsubscribe(id);
        bus.publish(make_go_event("ball"));
        assert_eq!(*count.lock().unwrap(), 1);
    }

    #[test]
    fn pending_events_json() {
        let mut bus = EventBus::new();
        bus.publish(make_go_event("ball"));
        bus.publish(make_go_event("rect"));
        let json = bus.take_pending_events_json();
        assert!(json.contains("ball"));
        assert!(json.contains("rect"));
        // After drain, pending is empty
        let json2 = bus.take_pending_events_json();
        assert_eq!(json2, "[]");
    }

    #[test]
    fn playback_kind_filter() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));
        let c = count.clone();
        bus.subscribe("playback/frame_changed", move |_| { *c.lock().unwrap() += 1; });
        bus.publish(HhEvent::Playback(PlaybackEvent { frame: 1, kind: PlaybackEventKind::FrameChanged }));
        bus.publish(HhEvent::Playback(PlaybackEvent { frame: 1, kind: PlaybackEventKind::Started }));
        assert_eq!(*count.lock().unwrap(), 1);
    }
}

