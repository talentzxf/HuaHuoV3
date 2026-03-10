// Migration modules.
// Each module handles migrating data from version N to the current runtime type.
//
// To add a new migration:
// 1. Create a new module v{N}.rs
// 2. Implement the migration logic
// 3. Register it in deserializer.rs

pub mod v1;

pub use v1::{project_from_v1, ProjectV1Compat};
