use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::project::scene::Scene;
use crate::project::element::{ElementDef, detect_element_cycle};
use crate::project::file_store::FileEntry;

/// The top-level project container.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub fps: f64,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub total_frames: Option<u32>,
    pub animation_end_frame: Option<u32>,
    pub scene_ids: Vec<String>,
    pub scenes: HashMap<String, Scene>,
    pub current_scene_id: Option<String>,
    /// Reusable animation element library.  Key = ElementDef::id
    pub elements: HashMap<String, ElementDef>,
    pub sub_projects: HashMap<String, Project>,
    /// Embedded resource files (images, audio, fonts, …).  Key = FileEntry::id
    pub files: HashMap<String, FileEntry>,
    pub created_at: i64,
    pub modified_at: i64,
}

impl Project {
    pub fn new(id: String, name: String, fps: f64, canvas_width: u32, canvas_height: u32) -> Self {
        let now = chrono_now();
        Self {
            id, name, fps, canvas_width, canvas_height,
            total_frames: None,
            animation_end_frame: None,
            scene_ids: vec![],
            scenes: HashMap::new(),
            current_scene_id: None,
            elements: HashMap::new(),
            sub_projects: HashMap::new(),
            files: HashMap::new(),
            created_at: now,
            modified_at: now,
        }
    }

    pub fn add_scene(&mut self, scene: Scene) {
        if self.current_scene_id.is_none() {
            self.current_scene_id = Some(scene.id.clone());
        }
        self.scene_ids.push(scene.id.clone());
        self.scenes.insert(scene.id.clone(), scene);
    }

    pub fn current_scene(&self) -> Option<&Scene> {
        self.current_scene_id.as_ref().and_then(|id| self.scenes.get(id))
    }

    pub fn current_scene_mut(&mut self) -> Option<&mut Scene> {
        let id = self.current_scene_id.clone()?;
        self.scenes.get_mut(&id)
    }

    // ── Element library ───────────────────────────────────────────────────────

    /// Add an element to the library.  Returns `Err(cycle_path)` on cycle.
    pub fn add_element(&mut self, element: ElementDef) -> Result<(), Vec<String>> {
        let eid = element.id.clone();
        self.elements.insert(eid.clone(), element);
        if let Err(cycle) = detect_element_cycle(&self.elements, &eid) {
            self.elements.remove(&eid);
            return Err(cycle);
        }
        Ok(())
    }

    pub fn remove_element(&mut self, element_id: &str) -> Option<ElementDef> {
        self.elements.remove(element_id)
    }

    /// Lookup by id or by name.
    pub fn find_element(&self, key: &str) -> Option<&ElementDef> {
        self.elements.get(key)
            .or_else(|| self.elements.values().find(|e| e.name == key))
    }

    pub fn find_element_mut(&mut self, key: &str) -> Option<&mut ElementDef> {
        if self.elements.contains_key(key) {
            return self.elements.get_mut(key);
        }
        let id = self.elements.values().find(|e| e.name == key)?.id.clone();
        self.elements.get_mut(&id)
    }

    // ── Frames ────────────────────────────────────────────────────────────────

    pub fn effective_total_frames(&self) -> u32 {
        if let Some(tf) = self.total_frames { return tf; }
        self.scenes.values().map(|s| s.total_frames()).max().unwrap_or(120)
    }

    // ── Sub-project (legacy) ──────────────────────────────────────────────────

    pub fn embed_sub_project(&mut self, sub: Project, max_depth: usize) -> bool {
        if max_depth == 0 || self.sub_projects.contains_key(&sub.id) { return false; }
        self.sub_projects.insert(sub.id.clone(), sub);
        true
    }

    // ── File store ────────────────────────────────────────────────────────────

    /// Embed a resource file in the project.  Generates a unique id and
    /// returns it so callers can store `PropertyValue::FileRef(id)`.
    pub fn add_file(
        &mut self,
        name: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
    ) -> String {
        let id = nanoid::nanoid!();
        let entry = FileEntry::new(id.clone(), name, mime_type, data, chrono_now());
        self.files.insert(id.clone(), entry);
        id
    }

    /// Remove a file by id.  Returns the removed entry if it existed.
    pub fn remove_file(&mut self, id: &str) -> Option<FileEntry> {
        self.files.remove(id)
    }

    /// Get a file entry by id.
    pub fn get_file(&self, id: &str) -> Option<&FileEntry> {
        self.files.get(id)
    }

    /// Find a file by its original filename.  Returns the first match.
    pub fn find_file_by_name(&self, name: &str) -> Option<&FileEntry> {
        self.files.values().find(|e| e.name == name)
    }

    /// Iterate over all embedded file entries in insertion-independent order.
    pub fn list_files(&self) -> Vec<&FileEntry> {
        let mut entries: Vec<&FileEntry> = self.files.values().collect();
        entries.sort_by_key(|e| &e.name);
        entries
    }
}

fn chrono_now() -> i64 { 0 }

#[cfg(test)]
mod tests {
    use super::*;

    fn make_project() -> Project {
        Project::new("p1".into(), "Test".into(), 30.0, 1280, 720)
    }

    // ── new project ───────────────────────────────────────────────────────────

    #[test]
    fn test_new_project_has_empty_files() {
        let p = make_project();
        assert!(p.files.is_empty());
    }

    // ── add_file ──────────────────────────────────────────────────────────────

    #[test]
    fn test_add_file_returns_nonempty_id() {
        let mut p = make_project();
        let id = p.add_file("logo.png", "image/png", vec![1, 2, 3]);
        assert!(!id.is_empty());
    }

    #[test]
    fn test_add_file_stored_in_files_map() {
        let mut p = make_project();
        let data = vec![0xAA, 0xBB];
        let id = p.add_file("icon.png", "image/png", data.clone());

        assert_eq!(p.files.len(), 1);
        let entry = p.files.get(&id).unwrap();
        assert_eq!(entry.name, "icon.png");
        assert_eq!(entry.mime_type, "image/png");
        assert_eq!(entry.data, data);
        assert_eq!(entry.size, 2);
    }

    #[test]
    fn test_add_multiple_files_have_distinct_ids() {
        let mut p = make_project();
        let id1 = p.add_file("a.png", "image/png", vec![1]);
        let id2 = p.add_file("b.png", "image/png", vec![2]);
        let id3 = p.add_file("c.png", "image/png", vec![3]);
        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
        assert_eq!(p.files.len(), 3);
    }

    // ── remove_file ───────────────────────────────────────────────────────────

    #[test]
    fn test_remove_file_returns_entry() {
        let mut p = make_project();
        let id = p.add_file("sound.mp3", "audio/mpeg", vec![10, 20]);
        let removed = p.remove_file(&id);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "sound.mp3");
        assert!(p.files.is_empty());
    }

    #[test]
    fn test_remove_nonexistent_file_returns_none() {
        let mut p = make_project();
        assert!(p.remove_file("no-such-id").is_none());
    }

    // ── get_file ──────────────────────────────────────────────────────────────

    #[test]
    fn test_get_file_by_id() {
        let mut p = make_project();
        let id = p.add_file("font.ttf", "font/ttf", vec![0xFF]);
        let entry = p.get_file(&id).unwrap();
        assert_eq!(entry.name, "font.ttf");
    }

    #[test]
    fn test_get_file_unknown_id_returns_none() {
        let p = make_project();
        assert!(p.get_file("ghost").is_none());
    }

    // ── find_file_by_name ─────────────────────────────────────────────────────

    #[test]
    fn test_find_file_by_name_finds_correct_entry() {
        let mut p = make_project();
        p.add_file("alpha.png", "image/png", vec![1]);
        p.add_file("beta.png",  "image/png", vec![2]);
        let found = p.find_file_by_name("beta.png").unwrap();
        assert_eq!(found.mime_type, "image/png");
        assert_eq!(found.data, vec![2]);
    }

    #[test]
    fn test_find_file_by_name_missing_returns_none() {
        let mut p = make_project();
        p.add_file("exists.png", "image/png", vec![]);
        assert!(p.find_file_by_name("missing.png").is_none());
    }

    // ── list_files ────────────────────────────────────────────────────────────

    #[test]
    fn test_list_files_sorted_by_name() {
        let mut p = make_project();
        p.add_file("zebra.png",  "image/png", vec![3]);
        p.add_file("apple.png",  "image/png", vec![1]);
        p.add_file("mango.png",  "image/png", vec![2]);
        let names: Vec<&str> = p.list_files().iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["apple.png", "mango.png", "zebra.png"]);
    }

    #[test]
    fn test_list_files_empty_project() {
        let p = make_project();
        assert!(p.list_files().is_empty());
    }
}
