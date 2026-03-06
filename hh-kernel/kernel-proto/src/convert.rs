//! Conversions between proto types and kernel-core types.

use kernel_core::ecs::components::keyframe::{EasingType, KeyFrame};
use kernel_sdk::property::PropertyValue;
use crate::generated::*;

// ─── PropertyValue ─────────────────────────────────────────────────────────────

pub fn proto_value_to_core(v: &PropertyValueProto) -> PropertyValue {
    match v {
        PropertyValueProto::Float(f) => PropertyValue::Float(*f),
        PropertyValueProto::Vec2(v) => PropertyValue::Vec2(v.x, v.y),
        PropertyValueProto::Color(c) => PropertyValue::Color(c.r as u8, c.g as u8, c.b as u8, c.a as u8),
        PropertyValueProto::Bool(b) => PropertyValue::Bool(*b),
        PropertyValueProto::String(s) => PropertyValue::String(s.clone()),
        PropertyValueProto::Int(i) => PropertyValue::Int(*i),
    }
}

pub fn core_value_to_proto(v: &PropertyValue) -> PropertyValueProto {
    match v {
        PropertyValue::Float(f) => PropertyValueProto::Float(*f),
        PropertyValue::Vec2(x, y) => PropertyValueProto::Vec2(Vec2Proto { x: *x, y: *y }),
        PropertyValue::Color(r, g, b, a) => PropertyValueProto::Color(ColorProto {
            r: *r as u32, g: *g as u32, b: *b as u32, a: *a as u32,
        }),
        PropertyValue::Vec3(x, y, _z) => PropertyValueProto::Vec2(Vec2Proto { x: *x, y: *y }), // flatten z for now
        PropertyValue::Bool(b) => PropertyValueProto::Bool(*b),
        PropertyValue::String(s) => PropertyValueProto::String(s.clone()),
        PropertyValue::Int(i) => PropertyValueProto::Int(*i),
    }
}

// ─── EasingType ────────────────────────────────────────────────────────────────

pub fn proto_easing_to_core(e: &EasingTypeProto) -> EasingType {
    match e {
        EasingTypeProto::Step => EasingType::Step,
        EasingTypeProto::Linear => EasingType::Linear,
        EasingTypeProto::EaseIn => EasingType::EaseIn,
        EasingTypeProto::EaseOut => EasingType::EaseOut,
        EasingTypeProto::EaseInOut => EasingType::EaseInOut,
        EasingTypeProto::Bezier { x1, y1, x2, y2 } => EasingType::Bezier(*x1, *y1, *x2, *y2),
    }
}

// ─── KeyFrame ──────────────────────────────────────────────────────────────────

pub fn proto_keyframe_to_core(kf: &KeyFrameProto) -> KeyFrame {
    KeyFrame {
        frame: kf.frame,
        value: proto_value_to_core(&kf.value),
        easing: proto_easing_to_core(&kf.easing),
    }
}

pub fn core_keyframe_to_proto(kf: &KeyFrame) -> KeyFrameProto {
    KeyFrameProto {
        frame: kf.frame,
        value: core_value_to_proto(&kf.value),
        easing: EasingTypeProto::Linear, // simplified for now
    }
}

