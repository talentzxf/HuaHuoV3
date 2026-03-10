use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::project::scene::Scene;
use crate::project::element::{ElementDef, detect_element_cycle};
use crate::project::file_store::{FileEntry, normalize_path, is_direct_child, is_under_dir};

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

    /// Embed a resource file at a **virtual path** inside the project.
    ///
    /// The path is normalized (leading `/` ensured).  Returns the generated
    /// unique id, which can be stored in `PropertyValue::FileRef(id)`.
    ///
    /// If a file already exists at the same path it is **overwritten**.
    pub fn add_file_at(
        &mut self,
        path: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
    ) -> String {
        let path = normalize_path(&path.into());
        // Remove any existing file at this path first
        let old_id = self.files.values()
            .find(|e| e.path == path)
            .map(|e| e.id.clone());
        if let Some(old) = old_id {
            self.files.remove(&old);
        }
        let id = nanoid::nanoid!();
        let entry = FileEntry::new_at_path(id.clone(), path, mime_type, data, chrono_now());
        self.files.insert(id.clone(), entry);
        id
    }

    /// Convenience: embed at root `/name` (backward-compatible with old API).
    pub fn add_file(
        &mut self,
        name: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
    ) -> String {
        let name: String = name.into();
        self.add_file_at(format!("/{}", name), mime_type, data)
    }

    /// Remove a file by id.  Returns the removed entry if it existed.
    pub fn remove_file(&mut self, id: &str) -> Option<FileEntry> {
        self.files.remove(id)
    }

    /// Remove a file by virtual path.  Returns the removed entry if it existed.
    pub fn remove_file_by_path(&mut self, path: &str) -> Option<FileEntry> {
        let path = normalize_path(path);
        let id = self.files.values().find(|e| e.path == path)?.id.clone();
        self.files.remove(&id)
    }

    /// Get a file entry by id.
    pub fn get_file(&self, id: &str) -> Option<&FileEntry> {
        self.files.get(id)
    }

    /// Find a file by its exact virtual path (e.g. `/assets/images/logo.png`).
    pub fn find_file_by_path(&self, path: &str) -> Option<&FileEntry> {
        let path = normalize_path(path);
        self.files.values().find(|e| e.path == path)
    }

    /// Find a file by its original filename.  Returns the first match.
    pub fn find_file_by_name(&self, name: &str) -> Option<&FileEntry> {
        self.files.values().find(|e| e.name == name)
    }

    /// Move (rename) a file to a new virtual path.
    /// Returns `true` on success, `false` if no file with that id exists.
    pub fn move_file(&mut self, id: &str, new_path: impl Into<String>) -> bool {
        let new_path = normalize_path(&new_path.into());
        if let Some(entry) = self.files.get_mut(id) {
            use crate::project::file_store::file_name_from_path;
            entry.name = file_name_from_path(&new_path).to_string();
            entry.path = new_path;
            true
        } else {
            false
        }
    }

    /// List all files directly inside a directory (non-recursive).
    /// Use `"/"` for the root.
    pub fn list_files_in_dir(&self, dir: &str) -> Vec<&FileEntry> {
        let mut entries: Vec<&FileEntry> = self.files.values()
            .filter(|e| is_direct_child(&e.path, dir))
            .collect();
        entries.sort_by_key(|e| &e.path);
        entries
    }

    /// List all files under a directory recursively.
    /// Use `"/"` to list everything.
    pub fn list_files_under(&self, dir: &str) -> Vec<&FileEntry> {
        let mut entries: Vec<&FileEntry> = self.files.values()
            .filter(|e| is_under_dir(&e.path, dir))
            .collect();
        entries.sort_by_key(|e| &e.path);
        entries
    }

    /// Iterate over all embedded file entries sorted by path.
    pub fn list_files(&self) -> Vec<&FileEntry> {
        let mut entries: Vec<&FileEntry> = self.files.values().collect();
        entries.sort_by_key(|e| &e.path);
        entries
    }

    /// Collect all unique directory paths present in the file store, sorted.
    /// Always includes `"/"`.
    pub fn list_dirs(&self) -> Vec<String> {
        let mut dirs = std::collections::BTreeSet::new();
        dirs.insert("/".to_string());
        for entry in self.files.values() {
            // Walk up from the file's path, collecting each parent directory
            let segments: Vec<&str> = entry.path
                .split('/')
                .filter(|s| !s.is_empty())
                .collect();
            // All segments except the last (which is the filename)
            let dir_segments = if segments.is_empty() { &[][..] } else { &segments[..segments.len() - 1] };
            let mut cur = String::new();
            for seg in dir_segments {
                cur.push('/');
                cur.push_str(seg);
                dirs.insert(cur.clone());
            }
        }
        dirs.into_iter().collect()
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

    // ── add_file_at ───────────────────────────────────────────────────────────

    #[test]
    fn test_add_file_at_returns_nonempty_id() {
        let mut p = make_project();
        let id = p.add_file_at("/assets/logo.png", "image/png", vec![1, 2, 3]);
        assert!(!id.is_empty());
    }

    #[test]
    fn test_add_file_at_stores_normalized_path() {
        let mut p = make_project();
        let id = p.add_file_at("assets/images/icon.png", "image/png", vec![0xAA]);
        let entry = p.files.get(&id).unwrap();
        assert_eq!(entry.path, "/assets/images/icon.png");
        assert_eq!(entry.name, "icon.png");
    }

    #[test]
    fn test_add_file_at_overwrites_same_path() {
        let mut p = make_project();
        p.add_file_at("/assets/logo.png", "image/png", vec![1]);
        p.add_file_at("/assets/logo.png", "image/png", vec![2]);
        assert_eq!(p.files.len(), 1);
        let entry = p.find_file_by_path("/assets/logo.png").unwrap();
        assert_eq!(entry.data, vec![2]);
    }

    // ── add_file (root convenience) ───────────────────────────────────────────

    #[test]
    fn test_add_file_places_at_root() {
        let mut p = make_project();
        let id = p.add_file("logo.png", "image/png", vec![1, 2, 3]);
        let entry = p.files.get(&id).unwrap();
        assert_eq!(entry.path, "/logo.png");
        assert_eq!(entry.name, "logo.png");
    }

    #[test]
    fn test_add_multiple_files_have_distinct_ids() {
        let mut p = make_project();
        let id1 = p.add_file_at("/a.png", "image/png", vec![1]);
        let id2 = p.add_file_at("/b.png", "image/png", vec![2]);
        let id3 = p.add_file_at("/c.png", "image/png", vec![3]);
        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
        assert_eq!(p.files.len(), 3);
    }

    // ── remove_file ───────────────────────────────────────────────────────────

    #[test]
    fn test_remove_file_returns_entry() {
        let mut p = make_project();
        let id = p.add_file_at("/audio/sound.mp3", "audio/mpeg", vec![10, 20]);
        let removed = p.remove_file(&id);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "sound.mp3");
        assert!(p.files.is_empty());
    }

    #[test]
    fn test_remove_file_by_path() {
        let mut p = make_project();
        p.add_file_at("/assets/logo.png", "image/png", vec![1]);
        let removed = p.remove_file_by_path("/assets/logo.png");
        assert!(removed.is_some());
        assert!(p.files.is_empty());
    }

    #[test]
    fn test_remove_nonexistent_file_returns_none() {
        let mut p = make_project();
        assert!(p.remove_file("no-such-id").is_none());
        assert!(p.remove_file_by_path("/ghost.png").is_none());
    }

    // ── find_file_by_path ─────────────────────────────────────────────────────

    #[test]
    fn test_find_file_by_path() {
        let mut p = make_project();
        p.add_file_at("/assets/images/logo.png", "image/png", vec![0xFF]);
        assert!(p.find_file_by_path("/assets/images/logo.png").is_some());
        assert!(p.find_file_by_path("/other.png").is_none());
    }

    #[test]
    fn test_find_file_by_path_normalizes_input() {
        let mut p = make_project();
        p.add_file_at("/assets/logo.png", "image/png", vec![1]);
        // Without leading slash should still work
        assert!(p.find_file_by_path("assets/logo.png").is_some());
    }

    // ── find_file_by_name ─────────────────────────────────────────────────────

    #[test]
    fn test_find_file_by_name_finds_correct_entry() {
        let mut p = make_project();
        p.add_file_at("/alpha/a.png", "image/png", vec![1]);
        p.add_file_at("/beta/b.png",  "image/png", vec![2]);
        let found = p.find_file_by_name("b.png").unwrap();
        assert_eq!(found.data, vec![2]);
    }

    // ── move_file ─────────────────────────────────────────────────────────────

    #[test]
    fn test_move_file_updates_path_and_name() {
        let mut p = make_project();
        let id = p.add_file_at("/logo.png", "image/png", vec![1]);
        assert!(p.move_file(&id, "/assets/images/logo.png"));
        let entry = p.get_file(&id).unwrap();
        assert_eq!(entry.path, "/assets/images/logo.png");
        assert_eq!(entry.name, "logo.png");
    }

    #[test]
    fn test_move_file_nonexistent_returns_false() {
        let mut p = make_project();
        assert!(!p.move_file("ghost-id", "/new/path.png"));
    }

    // ── list_files_in_dir ─────────────────────────────────────────────────────

    #[test]
    fn test_list_files_in_dir_direct_only() {
        let mut p = make_project();
        p.add_file_at("/assets/images/logo.png",  "image/png", vec![1]);
        p.add_file_at("/assets/images/icon.png",  "image/png", vec![2]);
        p.add_file_at("/assets/audio/bgm.mp3",    "audio/mpeg", vec![3]);
        p.add_file_at("/logo.png",                "image/png", vec![4]);

        let in_images = p.list_files_in_dir("/assets/images");
        assert_eq!(in_images.len(), 2);

        let in_assets = p.list_files_in_dir("/assets");
        assert_eq!(in_assets.len(), 0, "direct children only; subdirs not counted");

        let in_root = p.list_files_in_dir("/");
        assert_eq!(in_root.len(), 1); // only /logo.png
    }

    // ── list_files_under ─────────────────────────────────────────────────────

    #[test]
    fn test_list_files_under_recursive() {
        let mut p = make_project();
        p.add_file_at("/assets/images/logo.png", "image/png", vec![1]);
        p.add_file_at("/assets/audio/bgm.mp3",   "audio/mpeg", vec![2]);
        p.add_file_at("/other.txt",               "text/plain", vec![3]);

        let under_assets = p.list_files_under("/assets");
        assert_eq!(under_assets.len(), 2);

        let under_root = p.list_files_under("/");
        assert_eq!(under_root.len(), 3);
    }

    // ── list_files ────────────────────────────────────────────────────────────

    #[test]
    fn test_list_files_sorted_by_path() {
        let mut p = make_project();
        p.add_file_at("/z/zebra.png", "image/png", vec![3]);
        p.add_file_at("/a/apple.png", "image/png", vec![1]);
        p.add_file_at("/m/mango.png", "image/png", vec![2]);
        let paths: Vec<&str> = p.list_files().iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, vec!["/a/apple.png", "/m/mango.png", "/z/zebra.png"]);
    }

    // ── list_dirs ─────────────────────────────────────────────────────────────

    #[test]
    fn test_list_dirs_includes_root() {
        let p = make_project();
        assert!(p.list_dirs().contains(&"/".to_string()));
    }

    #[test]
    fn test_list_dirs_discovers_all_directories() {
        let mut p = make_project();
        p.add_file_at("/assets/images/logo.png", "image/png", vec![]);
        p.add_file_at("/assets/audio/bgm.mp3",   "audio/mpeg", vec![]);
        let dirs = p.list_dirs();
        assert!(dirs.contains(&"/".to_string()));
        assert!(dirs.contains(&"/assets".to_string()));
        assert!(dirs.contains(&"/assets/images".to_string()));
        assert!(dirs.contains(&"/assets/audio".to_string()));
    }
}
