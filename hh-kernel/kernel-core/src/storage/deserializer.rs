use anyhow::{bail, Result};
use crate::project::Project;
use crate::storage::format::{FileEnvelope, CURRENT_VERSION};

/// Deserialize a `Project` from a binary blob.
/// Routes to the appropriate migration path based on the schema version.
pub fn deserialize_project(bytes: &[u8]) -> Result<Project> {
    let envelope = FileEnvelope::decode(bytes)
        .ok_or_else(|| anyhow::anyhow!("Invalid file format or missing HHKV magic"))?;

    // Payload starts at offset 16 (envelope) + 4 (payload_length field) = 20
    if bytes.len() < 20 {
        bail!("File too short");
    }
    let payload_len = u32::from_le_bytes(bytes[16..20].try_into()?) as usize;
    let payload = &bytes[20..20 + payload_len];

    match envelope.schema_version {
        1 => {
            let project: Project = bincode::deserialize(payload)?;
            Ok(project)
        }
        v => bail!("Unsupported schema version: {}. Current supported: {}", v, CURRENT_VERSION),
    }
}

