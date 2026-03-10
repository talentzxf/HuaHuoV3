//! Embedded resource file storage for HuaHuo projects.
//!
//! A [`FileEntry`] represents a single resource (image, audio, font, …) embedded
//! inside a `.hhk` project file.  Resources are stored in `Project::files` and
//! referenced from animation properties via `PropertyValue::FileRef(id)`.
//!
//! ## Virtual path system
//!
//! Every file has a **virtual path** (like a Unix filesystem) that lives entirely
//! inside the `.hhk` archive.  Examples:
//! ```text
//! /assets/images/logo.png
//! /assets/audio/bgm.mp3
//! /fonts/NotoSans.ttf
//! ```
//! Paths are Unix-style, always start with `/`, and are case-sensitive.
//! Directories are implicit — there is no separate directory object.
//!
//! ## MIME type conventions
//!
//! Use standard MIME strings, e.g.:
//! * `"image/png"`, `"image/jpeg"`, `"image/svg+xml"`, `"image/webp"`
//! * `"audio/mpeg"`, `"audio/ogg"`, `"audio/wav"`
//! * `"font/ttf"`, `"font/otf"`, `"font/woff2"`
//! * `"application/octet-stream"` for unknown binary data

use serde::{Deserialize, Serialize};

/// A single resource file embedded inside a project.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// Unique identifier (nanoid).  Used as key in `Project::files` and in
    /// `PropertyValue::FileRef(id)`.
    pub id: String,

    /// Virtual path inside the project's file system (e.g. `/assets/images/logo.png`).
    /// Always starts with `/`.  The filename component is the last path segment.
    pub path: String,

    /// Original filename including extension (e.g. `"logo.png"`).
    /// Derived from the last segment of `path`; stored for quick access.
    pub name: String,

    /// MIME type string (e.g. `"image/png"`).
    pub mime_type: String,

    /// Raw file bytes.
    pub data: Vec<u8>,

    /// Byte length of `data`.  Stored explicitly so callers can read metadata
    /// without cloning the data vector.
    pub size: u64,

    /// Unix timestamp (milliseconds) when the file was added to the project.
    pub created_at: i64,
}

impl FileEntry {
    /// Create a new `FileEntry` at a virtual path.
    ///
    /// `path` is normalized (leading `/` ensured, trailing `/` stripped).
    /// `name` is derived from the last path segment.
    /// `size` is computed from `data.len()`.
    pub fn new_at_path(
        id: impl Into<String>,
        path: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
        created_at: i64,
    ) -> Self {
        let path = normalize_path(&path.into());
        let name = file_name_from_path(&path).to_string();
        let size = data.len() as u64;
        Self {
            id: id.into(),
            path,
            name,
            mime_type: mime_type.into(),
            data,
            size,
            created_at,
        }
    }

    /// Convenience constructor that places the file in the root `/` directory.
    /// `name` is the filename (no slashes).
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
        created_at: i64,
    ) -> Self {
        let name_str: String = name.into();
        let path = format!("/{}", name_str);
        let size = data.len() as u64;
        Self {
            id: id.into(),
            path,
            name: name_str,
            mime_type: mime_type.into(),
            data,
            size,
            created_at,
        }
    }

    /// Guess a MIME type from a file extension.  Returns
    /// `"application/octet-stream"` for unrecognised extensions.
    pub fn mime_from_extension(ext: &str) -> &'static str {
        match ext.to_lowercase().as_str() {
            "png"  => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif"  => "image/gif",
            "webp" => "image/webp",
            "svg"  => "image/svg+xml",
            "bmp"  => "image/bmp",
            "ico"  => "image/x-icon",
            "mp3"  => "audio/mpeg",
            "ogg"  => "audio/ogg",
            "wav"  => "audio/wav",
            "flac" => "audio/flac",
            "m4a"  => "audio/mp4",
            "mp4"  => "video/mp4",
            "webm" => "video/webm",
            "ttf"  => "font/ttf",
            "otf"  => "font/otf",
            "woff" => "font/woff",
            "woff2"=> "font/woff2",
            "json" => "application/json",
            "txt"  => "text/plain",
            _      => "application/octet-stream",
        }
    }

    /// Guess MIME type from a full file path or filename (uses the extension).
    pub fn mime_from_path(path: &str) -> &'static str {
        let ext = path.rsplit('.').next().unwrap_or("");
        Self::mime_from_extension(ext)
    }
}

// ── Path utility functions ────────────────────────────────────────────────────

/// Normalize a virtual path:
/// - Ensures it starts with `/`
/// - Collapses consecutive `/` into one
/// - Strips trailing `/` (except the root `/` itself)
pub fn normalize_path(path: &str) -> String {
    let with_slash = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };

    // Collapse multiple consecutive slashes
    let mut result = String::with_capacity(with_slash.len());
    let mut prev_slash = false;
    for ch in with_slash.chars() {
        if ch == '/' {
            if !prev_slash {
                result.push(ch);
            }
            prev_slash = true;
        } else {
            result.push(ch);
            prev_slash = false;
        }
    }

    // Strip trailing slash (unless it's the root)
    if result.len() > 1 && result.ends_with('/') {
        result.pop();
    }

    result
}

/// Return the directory part of a path (everything before the last `/`).
/// `/assets/images/logo.png` → `/assets/images`
/// `/logo.png`               → `/`
/// `/`                       → `/`
pub fn parent_dir(path: &str) -> &str {
    let path = path.trim_end_matches('/');
    match path.rfind('/') {
        Some(0) => "/",
        Some(pos) => &path[..pos],
        None => "/",
    }
}

/// Return the filename (last segment) of a path.
/// `/assets/images/logo.png` → `"logo.png"`
/// `/`                       → `""`
pub fn file_name_from_path(path: &str) -> &str {
    let path = path.trim_end_matches('/');
    match path.rfind('/') {
        Some(pos) => &path[pos + 1..],
        None => path,
    }
}

/// Return true if `path` is directly inside `dir`.
/// `/assets/images/logo.png` is inside `/assets/images` but NOT `/assets`.
pub fn is_direct_child(path: &str, dir: &str) -> bool {
    let dir = normalize_path(dir);
    let dir = dir.trim_end_matches('/');
    let path = normalize_path(path);
    // path must start with dir + "/"
    let prefix = if dir.is_empty() || dir == "/" {
        "/".to_string()
    } else {
        format!("{}/", dir)
    };
    if !path.starts_with(prefix.as_str()) {
        return false;
    }
    // No further "/" after the dir prefix
    let remainder = &path[prefix.len()..];
    !remainder.contains('/')
}

/// Return true if `path` is anywhere under `dir` (recursively).
pub fn is_under_dir(path: &str, dir: &str) -> bool {
    let dir = normalize_path(dir);
    let path = normalize_path(path);
    if dir == "/" {
        return path != "/";
    }
    path.starts_with(&format!("{}/", dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── FileEntry::new (root placement) ───────────────────────────────────────

    #[test]
    fn test_file_entry_size_computed_from_data() {
        let data = vec![1u8, 2, 3, 4];
        let entry = FileEntry::new("id1", "test.png", "image/png", data, 0);
        assert_eq!(entry.size, 4);
    }

    #[test]
    fn test_file_entry_new_sets_root_path() {
        let entry = FileEntry::new("id1", "logo.png", "image/png", vec![], 0);
        assert_eq!(entry.path, "/logo.png");
        assert_eq!(entry.name, "logo.png");
    }

    #[test]
    fn test_file_entry_fields_stored_correctly() {
        let data = vec![0xDE, 0xAD, 0xBE, 0xEF];
        let entry = FileEntry::new("abc123", "sound.mp3", "audio/mpeg", data.clone(), 999);
        assert_eq!(entry.id, "abc123");
        assert_eq!(entry.name, "sound.mp3");
        assert_eq!(entry.mime_type, "audio/mpeg");
        assert_eq!(entry.data, data);
        assert_eq!(entry.created_at, 999);
    }

    #[test]
    fn test_file_entry_empty_data() {
        let entry = FileEntry::new("e", "empty.bin", "application/octet-stream", vec![], 0);
        assert_eq!(entry.size, 0);
        assert!(entry.data.is_empty());
    }

    // ── FileEntry::new_at_path ────────────────────────────────────────────────

    #[test]
    fn test_new_at_path_sets_path_and_name() {
        let entry = FileEntry::new_at_path("id2", "/assets/images/logo.png", "image/png", vec![1, 2, 3], 0);
        assert_eq!(entry.path, "/assets/images/logo.png");
        assert_eq!(entry.name, "logo.png");
        assert_eq!(entry.size, 3);
    }

    #[test]
    fn test_new_at_path_normalizes_path() {
        let entry = FileEntry::new_at_path("id3", "assets//fonts/NotoSans.ttf", "font/ttf", vec![], 0);
        assert_eq!(entry.path, "/assets/fonts/NotoSans.ttf");
        assert_eq!(entry.name, "NotoSans.ttf");
    }

    // ── MIME helpers ──────────────────────────────────────────────────────────

    #[test]
    fn test_mime_from_extension_images() {
        assert_eq!(FileEntry::mime_from_extension("png"),  "image/png");
        assert_eq!(FileEntry::mime_from_extension("jpg"),  "image/jpeg");
        assert_eq!(FileEntry::mime_from_extension("jpeg"), "image/jpeg");
        assert_eq!(FileEntry::mime_from_extension("gif"),  "image/gif");
        assert_eq!(FileEntry::mime_from_extension("webp"), "image/webp");
        assert_eq!(FileEntry::mime_from_extension("svg"),  "image/svg+xml");
    }

    #[test]
    fn test_mime_from_extension_audio() {
        assert_eq!(FileEntry::mime_from_extension("mp3"),  "audio/mpeg");
        assert_eq!(FileEntry::mime_from_extension("ogg"),  "audio/ogg");
        assert_eq!(FileEntry::mime_from_extension("wav"),  "audio/wav");
    }

    #[test]
    fn test_mime_from_extension_fonts() {
        assert_eq!(FileEntry::mime_from_extension("ttf"),   "font/ttf");
        assert_eq!(FileEntry::mime_from_extension("woff2"), "font/woff2");
    }

    #[test]
    fn test_mime_from_extension_case_insensitive() {
        assert_eq!(FileEntry::mime_from_extension("PNG"), "image/png");
        assert_eq!(FileEntry::mime_from_extension("MP3"), "audio/mpeg");
        assert_eq!(FileEntry::mime_from_extension("TTF"), "font/ttf");
    }

    #[test]
    fn test_mime_from_extension_unknown_returns_octet_stream() {
        assert_eq!(FileEntry::mime_from_extension("xyz"),  "application/octet-stream");
        assert_eq!(FileEntry::mime_from_extension(""),     "application/octet-stream");
        assert_eq!(FileEntry::mime_from_extension("hhk"),  "application/octet-stream");
    }

    #[test]
    fn test_mime_from_path() {
        assert_eq!(FileEntry::mime_from_path("/assets/images/logo.png"), "image/png");
        assert_eq!(FileEntry::mime_from_path("track.mp3"), "audio/mpeg");
        assert_eq!(FileEntry::mime_from_path("file.unknown"), "application/octet-stream");
    }

    // ── normalize_path ────────────────────────────────────────────────────────

    #[test]
    fn test_normalize_path_adds_leading_slash() {
        assert_eq!(normalize_path("assets/logo.png"), "/assets/logo.png");
    }

    #[test]
    fn test_normalize_path_collapses_slashes() {
        assert_eq!(normalize_path("//assets//images//logo.png"), "/assets/images/logo.png");
    }

    #[test]
    fn test_normalize_path_strips_trailing_slash() {
        assert_eq!(normalize_path("/assets/images/"), "/assets/images");
    }

    #[test]
    fn test_normalize_path_root_unchanged() {
        assert_eq!(normalize_path("/"), "/");
    }

    // ── parent_dir ────────────────────────────────────────────────────────────

    #[test]
    fn test_parent_dir_deep() {
        assert_eq!(parent_dir("/assets/images/logo.png"), "/assets/images");
    }

    #[test]
    fn test_parent_dir_root_child() {
        assert_eq!(parent_dir("/logo.png"), "/");
    }

    #[test]
    fn test_parent_dir_of_root() {
        assert_eq!(parent_dir("/"), "/");
    }

    // ── file_name_from_path ───────────────────────────────────────────────────

    #[test]
    fn test_file_name_from_path_deep() {
        assert_eq!(file_name_from_path("/assets/images/logo.png"), "logo.png");
    }

    #[test]
    fn test_file_name_from_path_root() {
        assert_eq!(file_name_from_path("/logo.png"), "logo.png");
    }

    // ── is_direct_child ───────────────────────────────────────────────────────

    #[test]
    fn test_is_direct_child_true() {
        assert!(is_direct_child("/assets/images/logo.png", "/assets/images"));
    }

    #[test]
    fn test_is_direct_child_not_nested() {
        // /assets/images/logo.png is NOT a direct child of /assets
        assert!(!is_direct_child("/assets/images/logo.png", "/assets"));
    }

    #[test]
    fn test_is_direct_child_of_root() {
        assert!(is_direct_child("/logo.png", "/"));
        assert!(!is_direct_child("/assets/logo.png", "/"));
    }

    // ── is_under_dir ─────────────────────────────────────────────────────────

    #[test]
    fn test_is_under_dir_recursive() {
        assert!(is_under_dir("/assets/images/logo.png", "/assets"));
        assert!(is_under_dir("/assets/images/logo.png", "/assets/images"));
    }

    #[test]
    fn test_is_under_dir_different_prefix() {
        assert!(!is_under_dir("/audio/bgm.mp3", "/assets"));
    }

    #[test]
    fn test_is_under_dir_root_contains_everything() {
        assert!(is_under_dir("/anything/here.png", "/"));
        assert!(!is_under_dir("/", "/"));
    }

    // ── serde round-trip ──────────────────────────────────────────────────────

    #[test]
    fn test_file_entry_serde_roundtrip() {
        let data = b"Hello, HuaHuo!".to_vec();
        let original = FileEntry::new_at_path("serde-id", "/texts/hello.txt", "text/plain", data, 12345);

        let encoded = bincode::serialize(&original).expect("serialize failed");
        let decoded: FileEntry = bincode::deserialize(&encoded).expect("deserialize failed");

        assert_eq!(decoded.id,         original.id);
        assert_eq!(decoded.path,       original.path);
        assert_eq!(decoded.name,       original.name);
        assert_eq!(decoded.mime_type,  original.mime_type);
        assert_eq!(decoded.data,       original.data);
        assert_eq!(decoded.size,       original.size);
        assert_eq!(decoded.created_at, original.created_at);
    }
}
