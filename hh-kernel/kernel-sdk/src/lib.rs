//! # kernel-sdk
//!
//! SDK for user-defined custom components.
//! Users implement the `ComponentDef` trait to extend the engine with their own components.

pub mod component_def;
pub mod property;
pub mod registry;

pub use component_def::ComponentDef;
pub use property::{PropertyMeta, PropertyMap, PropertyValue};
pub use registry::ComponentRegistry;

