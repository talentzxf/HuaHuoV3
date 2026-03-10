pub mod format;
pub mod serializer;
pub mod deserializer;
pub mod migrations;

pub use serializer::serialize_project;
pub use deserializer::deserialize_project;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::Project;
    use crate::project::scene::Scene;
    use crate::project::game_object::GameObjectData;
    use crate::ecs::components::keyframe::KeyFrame;
    use crate::storage::migrations::v1::{ProjectV1Compat, project_from_v1};
    use crate::storage::format::{FileEnvelope, CURRENT_VERSION};
    use kernel_sdk::property::PropertyValue;
    use std::collections::HashMap;

    fn simple_project() -> Project {
        Project::new("proj-1".into(), "StorageTest".into(), 30.0, 800, 600)
    }

    // ── V2 round-trip (no files) ──────────────────────────────────────────────

    #[test]
    fn test_v2_roundtrip_empty_project() {
        let original = simple_project();
        let bytes = serialize_project(&original).expect("serialize");
        let decoded = deserialize_project(&bytes).expect("deserialize");

        assert_eq!(decoded.id,   original.id);
        assert_eq!(decoded.name, original.name);
        assert_eq!(decoded.fps,  original.fps);
        assert!(decoded.files.is_empty());
    }

    // ── V2 round-trip with embedded files ─────────────────────────────────────

    #[test]
    fn test_v2_roundtrip_preserves_files() {
        let mut p = simple_project();
        let png_data = vec![0x89u8, 0x50, 0x4E, 0x47]; // PNG magic bytes
        let id = p.add_file("sprite.png", "image/png", png_data.clone());

        let bytes    = serialize_project(&p).expect("serialize");
        let decoded  = deserialize_project(&bytes).expect("deserialize");

        assert_eq!(decoded.files.len(), 1);
        let entry = decoded.files.get(&id).expect("file entry missing after roundtrip");
        assert_eq!(entry.name,      "sprite.png");
        assert_eq!(entry.mime_type, "image/png");
        assert_eq!(entry.data,      png_data);
        assert_eq!(entry.size,      4);
    }

    #[test]
    fn test_v2_roundtrip_multiple_files() {
        let mut p = simple_project();
        let id1 = p.add_file("bg.jpg",    "image/jpeg", vec![1, 2, 3]);
        let id2 = p.add_file("theme.ttf", "font/ttf",   vec![4, 5, 6, 7]);
        let id3 = p.add_file("sfx.mp3",   "audio/mpeg", vec![8]);

        let bytes   = serialize_project(&p).expect("serialize");
        let decoded = deserialize_project(&bytes).expect("deserialize");

        assert_eq!(decoded.files.len(), 3);
        assert!(decoded.files.contains_key(&id1));
        assert!(decoded.files.contains_key(&id2));
        assert!(decoded.files.contains_key(&id3));
        assert_eq!(decoded.files[&id2].data, vec![4, 5, 6, 7]);
    }

    // ── File header uses current version ─────────────────────────────────────

    #[test]
    fn test_serialized_header_version_is_current() {
        let p     = simple_project();
        let bytes = serialize_project(&p).expect("serialize");
        let env   = FileEnvelope::decode(&bytes).expect("invalid header");
        assert_eq!(env.schema_version, CURRENT_VERSION);
    }

    // ── V1 migration: ProjectV1Compat → Project ───────────────────────────────

    /// Build a minimal ProjectV1Compat, wrap it in a v1 binary envelope, then
    /// call deserialize_project to exercise the full v1 migration path.
    #[test]
    fn test_v1_migration_produces_empty_files() {
        // Build v1 compat manually
        let compat = ProjectV1Compat {
            id: "v1-id".into(),
            name: "V1 Project".into(),
            fps: 24.0,
            canvas_width: 640,
            canvas_height: 480,
            total_frames: Some(240),
            animation_end_frame: None,
            scene_ids: vec![],
            scenes: HashMap::new(),
            current_scene_id: None,
            elements: HashMap::new(),
            sub_projects: HashMap::new(),
            created_at: 0,
            modified_at: 0,
        };

        // Serialise as v1 binary envelope
        let payload = bincode::serialize(&compat).expect("serialize v1 compat");
        let mut bytes = Vec::new();
        let header = FileEnvelope { magic: *b"HHKV", schema_version: 1, created_at: 0 };
        bytes.extend_from_slice(&header.encode());
        bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&payload);

        // Deserialise via migration path
        let project = deserialize_project(&bytes).expect("deserialize v1");

        assert_eq!(project.id,   "v1-id");
        assert_eq!(project.name, "V1 Project");
        assert_eq!(project.fps,  24.0);
        assert_eq!(project.canvas_width, 640);
        assert!(project.files.is_empty(), "v1 migration must produce empty files");
        assert!(project.elements.is_empty());
    }

    #[test]
    fn test_v1_migration_preserves_total_frames() {
        let compat = ProjectV1Compat {
            id: "v1-frames".into(),
            name: "Frames".into(),
            fps: 30.0,
            canvas_width: 1920,
            canvas_height: 1080,
            total_frames: Some(300),
            animation_end_frame: Some(290),
            scene_ids: vec![],
            scenes: HashMap::new(),
            current_scene_id: None,
            elements: HashMap::new(),
            sub_projects: HashMap::new(),
            created_at: 42,
            modified_at: 99,
        };
        let project = project_from_v1(compat);
        assert_eq!(project.total_frames,       Some(300));
        assert_eq!(project.animation_end_frame, Some(290));
        assert_eq!(project.created_at, 42);
        assert_eq!(project.modified_at, 99);
    }

    // ── FileRef in keyframe survives round-trip ───────────────────────────────

    #[test]
    fn test_fileref_in_keyframe_survives_roundtrip() {
        let mut p    = simple_project();
        let file_id  = p.add_file("tex.png", "image/png", vec![0xFF, 0x00]);

        let mut scene = Scene::new("s1".into(), "Scene".into(), 30.0, 5.0);
        let mut go    = GameObjectData::new("go1".into(), "Sprite".into(), 0);
        go.set_keyframe("Visual", "texture", KeyFrame::new(0, PropertyValue::FileRef(file_id.clone())));
        scene.add_game_object("", go); // layer "" doesn't exist but GO still stored
        p.add_scene(scene);

        let bytes   = serialize_project(&p).expect("serialize");
        let decoded = deserialize_project(&bytes).expect("deserialize");

        let go2 = decoded.scenes["s1"].game_objects.get("go1").unwrap();
        let kf  = &go2.components["Visual"]["texture"][0];
        assert_eq!(kf.value, PropertyValue::FileRef(file_id));
    }

    // ── Unsupported version returns error ─────────────────────────────────────

    #[test]
    fn test_unknown_version_returns_error() {
        let p = simple_project();
        let mut bytes = serialize_project(&p).expect("serialize");
        // Patch version field (bytes 4..8) to 99
        bytes[4..8].copy_from_slice(&99u32.to_le_bytes());
        assert!(deserialize_project(&bytes).is_err());
    }

    // ── Corrupt magic returns error ───────────────────────────────────────────

    #[test]
    fn test_invalid_magic_returns_error() {
        let mut bytes = vec![0u8; 32];
        bytes[0..4].copy_from_slice(b"XXXX");
        assert!(deserialize_project(&bytes).is_err());
    }
}

