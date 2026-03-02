use anyhow::Result;
use crate::project::Project;
use crate::storage::format::FileEnvelope;

/// Serialize a `Project` to a self-contained binary blob.
///
/// Format:
///   [16 bytes envelope header]
///   [bincode-encoded Project]
pub fn serialize_project(project: &Project) -> Result<Vec<u8>> {
    let envelope = FileEnvelope::new_current(project.created_at);
    let header = envelope.encode();

    let payload = bincode::serialize(project)?;

    let mut out = Vec::with_capacity(header.len() + 4 + payload.len());
    out.extend_from_slice(&header);
    // payload length
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(&payload);

    Ok(out)
}

