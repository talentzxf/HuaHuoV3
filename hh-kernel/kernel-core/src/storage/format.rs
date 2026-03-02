/// File magic bytes: "HHKV" (HuaHuo Kernel V*)
pub const MAGIC: &[u8; 4] = b"HHKV";

/// Current schema version.
pub const CURRENT_VERSION: u32 = 1;

/// Fixed-size file envelope header (16 bytes).
/// Layout:
///   [0..4]  magic: "HHKV"
///   [4..8]  schema_version: u32 le
///   [8..16] created_at: i64 le (unix ms)
///   Then: bincode-encoded payload
#[derive(Debug, Clone)]
pub struct FileEnvelope {
    pub magic: [u8; 4],
    pub schema_version: u32,
    pub created_at: i64,
}

impl FileEnvelope {
    pub fn new_current(created_at: i64) -> Self {
        Self {
            magic: *MAGIC,
            schema_version: CURRENT_VERSION,
            created_at,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(16);
        buf.extend_from_slice(&self.magic);
        buf.extend_from_slice(&self.schema_version.to_le_bytes());
        buf.extend_from_slice(&self.created_at.to_le_bytes());
        buf
    }

    pub fn decode(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 16 {
            return None;
        }
        let magic: [u8; 4] = bytes[0..4].try_into().ok()?;
        if &magic != MAGIC {
            return None;
        }
        let schema_version = u32::from_le_bytes(bytes[4..8].try_into().ok()?);
        let created_at = i64::from_le_bytes(bytes[8..16].try_into().ok()?);
        Some(Self { magic, schema_version, created_at })
    }
}

