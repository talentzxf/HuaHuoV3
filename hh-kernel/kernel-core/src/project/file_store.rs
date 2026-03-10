//! Embedded resource file storage for HuaHuo projects.
//!
//! A [`FileEntry`] represents a single resource (image, audio, font, …) embedded
//! inside a `.hhk` project file.  Resources are stored in `Project::files` and
//! referenced from animation properties via `PropertyValue::FileRef(id)`.
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

    /// Original filename including extension (e.g. `"logo.png"`).
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
    /// Create a new `FileEntry`, computing `size` automatically.
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        mime_type: impl Into<String>,
        data: Vec<u8>,
        created_at: i64,
    ) -> Self {
        let size = data.len() as u64;
        Self {
            id: id.into(),
            name: name.into(),
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_entry_size_computed_from_data() {
        let data = vec![1u8, 2, 3, 4];
        let entry = FileEntry::new("id1", "test.png", "image/png", data, 0);
        assert_eq!(entry.size, 4);
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
    fn test_file_entry_serde_roundtrip() {
        let data = b"Hello, HuaHuo!".to_vec();
        let original = FileEntry::new("serde-id", "hello.txt", "text/plain", data, 12345);

        let encoded = bincode::serialize(&original).expect("serialize failed");
        let decoded: FileEntry = bincode::deserialize(&encoded).expect("deserialize failed");

        assert_eq!(decoded.id,        original.id);
        assert_eq!(decoded.name,      original.name);
        assert_eq!(decoded.mime_type, original.mime_type);
        assert_eq!(decoded.data,      original.data);
        assert_eq!(decoded.size,      original.size);
        assert_eq!(decoded.created_at, original.created_at);
    }
}
