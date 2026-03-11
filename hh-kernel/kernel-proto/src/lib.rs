//! # kernel-proto
//!
//! Command/Query/Event types for the kernel API.
//! These types are the stable public interface for TypeScript (WASM) and CLI callers.
//!
//! Serialized as JSON over the WASM boundary (for simplicity without protoc dependency).
//! When protoc is available, build.rs compiles the .proto files to binary-compatible structs.

pub mod generated;
pub mod convert;

pub use generated::*;

