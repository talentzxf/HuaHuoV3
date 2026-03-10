use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single property value - supports all types that can be keyframe-animated.
///
/// NOTE: Uses tuple variants (not struct variants) for bincode compatibility.
/// Field order: Vec2(x, y)  Vec3(x, y, z)  Color(r, g, b, a)
///
/// **Stability note:** Add new variants at the end only to preserve bincode ordering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PropertyValue {
    Float(f64),
    Vec2(f64, f64),
    Vec3(f64, f64, f64),
    /// (r, g, b, a) in 0-255
    Color(u8, u8, u8, u8),
    Bool(bool),
    String(String),
    Int(i64),
    /// Reference to an embedded resource file by its `FileEntry` id.
    /// Not interpolatable — always snaps to the current value.
    FileRef(String),
}

impl PropertyValue {
    /// Linear interpolation between two values (for animation).
    pub fn lerp(&self, other: &PropertyValue, t: f64) -> Option<PropertyValue> {
        match (self, other) {
            (PropertyValue::Float(a), PropertyValue::Float(b)) => {
                Some(PropertyValue::Float(a + (b - a) * t))
            }
            (PropertyValue::Vec2(ax, ay), PropertyValue::Vec2(bx, by)) => {
                Some(PropertyValue::Vec2(ax + (bx - ax) * t, ay + (by - ay) * t))
            }
            (PropertyValue::Vec3(ax, ay, az), PropertyValue::Vec3(bx, by, bz)) => {
                Some(PropertyValue::Vec3(
                    ax + (bx - ax) * t,
                    ay + (by - ay) * t,
                    az + (bz - az) * t,
                ))
            }
            (PropertyValue::Color(r1, g1, b1, a1), PropertyValue::Color(r2, g2, b2, a2)) => {
                Some(PropertyValue::Color(
                    ((*r1 as f64) + ((*r2 as f64) - (*r1 as f64)) * t) as u8,
                    ((*g1 as f64) + ((*g2 as f64) - (*g1 as f64)) * t) as u8,
                    ((*b1 as f64) + ((*b2 as f64) - (*b1 as f64)) * t) as u8,
                    ((*a1 as f64) + ((*a2 as f64) - (*a1 as f64)) * t) as u8,
                ))
            }
            // Non-interpolatable types: snap to the start value
            _ => Some(self.clone()),
        }
    }
}

/// Metadata describing a single property of a component.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyMeta {
    /// Property name (e.g. "position", "fillColor")
    pub name: String,
    /// Human-readable label
    pub label: String,
    /// Whether this property can be keyframe-animated
    pub animatable: bool,
    /// Default value
    pub default_value: PropertyValue,
    /// Optional min/max for numeric properties
    pub min: Option<f64>,
    pub max: Option<f64>,
    /// Optional step for numeric properties
    pub step: Option<f64>,
}

impl PropertyMeta {
    pub fn new(name: impl Into<String>, label: impl Into<String>, default_value: PropertyValue) -> Self {
        Self {
            name: name.into(),
            label: label.into(),
            animatable: true,
            default_value,
            min: None,
            max: None,
            step: None,
        }
    }

    pub fn not_animatable(mut self) -> Self {
        self.animatable = false;
        self
    }

    pub fn with_range(mut self, min: f64, max: f64) -> Self {
        self.min = Some(min);
        self.max = Some(max);
        self
    }
}

/// Snapshot of all property values for a component instance.
pub type PropertyMap = HashMap<String, PropertyValue>;

#[cfg(test)]
mod tests {
    use super::*;

    // ── FileRef lerp behaviour ─────────────────────────────────────────────────

    #[test]
    fn test_file_ref_lerp_snaps_to_self() {
        let a = PropertyValue::FileRef("file-a".to_string());
        let b = PropertyValue::FileRef("file-b".to_string());

        // At any t, result should always be `a` (the start value).
        for &t in &[0.0_f64, 0.25, 0.5, 0.75, 1.0] {
            assert_eq!(a.lerp(&b, t), Some(a.clone()),
                "FileRef lerp should snap to start at t={}", t);
        }
    }

    #[test]
    fn test_file_ref_lerp_with_different_type_snaps_to_self() {
        let a = PropertyValue::FileRef("id".to_string());
        let b = PropertyValue::Float(1.0);
        assert_eq!(a.lerp(&b, 0.5), Some(a.clone()));
    }

    // ── FileRef is non-interpolatable (unlike Float) ───────────────────────────

    #[test]
    fn test_float_lerp_interpolates() {
        let a = PropertyValue::Float(0.0);
        let b = PropertyValue::Float(10.0);
        assert_eq!(a.lerp(&b, 0.5), Some(PropertyValue::Float(5.0)));
    }

    // ── FileRef equality ──────────────────────────────────────────────────────

    #[test]
    fn test_file_ref_equality() {
        assert_eq!(
            PropertyValue::FileRef("abc".into()),
            PropertyValue::FileRef("abc".into())
        );
        assert_ne!(
            PropertyValue::FileRef("abc".into()),
            PropertyValue::FileRef("xyz".into())
        );
    }

    // ── FileRef bincode round-trip ─────────────────────────────────────────────

    #[test]
    fn test_file_ref_serde_roundtrip() {
        let original = PropertyValue::FileRef("roundtrip-id".to_string());
        let bytes = bincode::serialize(&original).expect("serialize");
        let decoded: PropertyValue = bincode::deserialize(&bytes).expect("deserialize");
        assert_eq!(original, decoded);
    }

    #[test]
    fn test_all_variants_serde_roundtrip() {
        let values = vec![
            PropertyValue::Float(3.14),
            PropertyValue::Vec2(1.0, 2.0),
            PropertyValue::Vec3(1.0, 2.0, 3.0),
            PropertyValue::Color(255, 128, 0, 255),
            PropertyValue::Bool(true),
            PropertyValue::String("hello".into()),
            PropertyValue::Int(-42),
            PropertyValue::FileRef("file-id".into()),
        ];
        for v in &values {
            let bytes = bincode::serialize(v).expect("serialize");
            let decoded: PropertyValue = bincode::deserialize(&bytes).expect("deserialize");
            assert_eq!(*v, decoded, "Round-trip failed for {:?}", v);
        }
    }
}

