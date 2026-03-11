//! # kernel-schema
//!
//! Defines the stable on-disk binary format for HuaHuo project files.
//! Uses a versioned envelope + bincode encoding.
//!
//! The schema is intentionally kept as pure Rust structs with serde derive,
//! making it easy to add migration code when the format changes.

pub mod v1;

pub use v1::SchemaV1Project;

