use crate::property::{PropertyMap, PropertyMeta};
use serde::{Deserialize, Serialize};

/// Trait that all custom components (built-in and user-defined) must implement.
///
/// # Example (user-defined component)
/// ```rust
/// use kernel_sdk::{ComponentDef, PropertyMeta, PropertyValue, PropertyMap};
///
/// struct MyColorComponent;
///
/// impl ComponentDef for MyColorComponent {
///     fn type_name(&self) -> &str { "MyColor" }
///     fn version(&self) -> u32 { 1 }
///     fn property_metas(&self) -> Vec<PropertyMeta> {
///         vec![
///             PropertyMeta::new("color", "Color", PropertyValue::Color { r: 255, g: 0, b: 0, a: 255 }),
///         ]
///     }
///     fn default_props(&self) -> PropertyMap {
///         let mut m = PropertyMap::new();
///         m.insert("color".into(), PropertyValue::Color { r: 255, g: 0, b: 0, a: 255 });
///         m
///     }
/// }
/// ```
pub trait ComponentDef: Send + Sync + 'static {
    /// Unique type name (must be stable across versions for backward compat).
    fn type_name(&self) -> &str;

    /// Schema version for this component. Increment when adding/removing props.
    fn version(&self) -> u32 {
        1
    }

    /// List of all properties with metadata.
    fn property_metas(&self) -> Vec<PropertyMeta>;

    /// Default property values for a new component instance.
    fn default_props(&self) -> PropertyMap;

    /// Migrate property data from an older version to current.
    /// Override this when bumping `version()`.
    fn migrate(&self, _from_version: u32, props: PropertyMap) -> PropertyMap {
        props // by default, pass through unchanged
    }

    /// Human-readable display name.
    fn display_name(&self) -> &str {
        self.type_name()
    }
}

/// A boxed, type-erased component definition.
pub type BoxedComponentDef = Box<dyn ComponentDef>;

/// Serializable component instance data (stored in the project file).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentData {
    pub type_name: String,
    pub version: u32,
    pub props: PropertyMap,
}

