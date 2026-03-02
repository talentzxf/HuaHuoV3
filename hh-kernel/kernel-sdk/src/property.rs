use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single property value - supports all types that can be keyframe-animated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum PropertyValue {
    Float(f64),
    Vec2 { x: f64, y: f64 },
    Vec3 { x: f64, y: f64, z: f64 },
    Color { r: u8, g: u8, b: u8, a: u8 },
    Bool(bool),
    String(String),
    Int(i64),
}

impl PropertyValue {
    /// Linear interpolation between two values (for animation).
    pub fn lerp(&self, other: &PropertyValue, t: f64) -> Option<PropertyValue> {
        match (self, other) {
            (PropertyValue::Float(a), PropertyValue::Float(b)) => {
                Some(PropertyValue::Float(a + (b - a) * t))
            }
            (PropertyValue::Vec2 { x: ax, y: ay }, PropertyValue::Vec2 { x: bx, y: by }) => {
                Some(PropertyValue::Vec2 {
                    x: ax + (bx - ax) * t,
                    y: ay + (by - ay) * t,
                })
            }
            (PropertyValue::Vec3 { x: ax, y: ay, z: az }, PropertyValue::Vec3 { x: bx, y: by, z: bz }) => {
                Some(PropertyValue::Vec3 {
                    x: ax + (bx - ax) * t,
                    y: ay + (by - ay) * t,
                    z: az + (bz - az) * t,
                })
            }
            (
                PropertyValue::Color { r: r1, g: g1, b: b1, a: a1 },
                PropertyValue::Color { r: r2, g: g2, b: b2, a: a2 },
            ) => Some(PropertyValue::Color {
                r: ((*r1 as f64) + ((*r2 as f64) - (*r1 as f64)) * t) as u8,
                g: ((*g1 as f64) + ((*g2 as f64) - (*g1 as f64)) * t) as u8,
                b: ((*b1 as f64) + ((*b2 as f64) - (*b1 as f64)) * t) as u8,
                a: ((*a1 as f64) + ((*a2 as f64) - (*a1 as f64)) * t) as u8,
            }),
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

