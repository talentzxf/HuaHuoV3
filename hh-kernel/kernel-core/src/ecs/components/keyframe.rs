use serde::{Deserialize, Serialize};
use kernel_sdk::property::PropertyValue;

/// Easing function type for keyframe interpolation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum EasingType {
    /// Constant (no interpolation - snap to value)
    Step,
    /// Linear interpolation
    Linear,
    /// Ease in (slow start)
    EaseIn,
    /// Ease out (slow end)
    EaseOut,
    /// Ease in-out (slow start and end)
    EaseInOut,
    /// Custom cubic bezier: P1(x1,y1), P2(x2,y2) — stored as (x1, y1, x2, y2)
    Bezier(f64, f64, f64, f64),
}

impl EasingType {
    /// Apply this easing to a normalized t in [0, 1].
    pub fn apply(&self, t: f64) -> f64 {
        match self {
            EasingType::Step => 0.0,
            EasingType::Linear => t,
            EasingType::EaseIn => t * t,
            EasingType::EaseOut => t * (2.0 - t),
            EasingType::EaseInOut => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    -1.0 + (4.0 - 2.0 * t) * t
                }
            }
            EasingType::Bezier(x1, y1, x2, y2) => {
                cubic_bezier_y(t, *x1, *y1, *x2, *y2)
            }
        }
    }
}

impl Default for EasingType {
    fn default() -> Self {
        EasingType::Linear
    }
}

/// A single keyframe storing a property value at a specific frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFrame {
    /// Frame number (0-based)
    pub frame: u32,
    /// Value at this keyframe
    pub value: PropertyValue,
    /// Easing function applied when transitioning FROM this keyframe to the next
    pub easing: EasingType,
}

impl KeyFrame {
    pub fn new(frame: u32, value: PropertyValue) -> Self {
        Self {
            frame,
            value,
            easing: EasingType::Linear,
        }
    }

    pub fn with_easing(mut self, easing: EasingType) -> Self {
        self.easing = easing;
        self
    }
}

/// Interpolate a property value at a given frame from a sorted list of keyframes.
///
/// Returns `None` if the keyframe list is empty.
/// If `frame` is before the first keyframe, returns the first value.
/// If `frame` is after the last keyframe, returns the last value.
pub fn interpolate_keyframes(keyframes: &[KeyFrame], frame: u32) -> Option<PropertyValue> {
    if keyframes.is_empty() {
        return None;
    }

    // Before first keyframe
    if frame <= keyframes[0].frame {
        return Some(keyframes[0].value.clone());
    }

    // After last keyframe
    let last = &keyframes[keyframes.len() - 1];
    if frame >= last.frame {
        return Some(last.value.clone());
    }

    // Binary search for the surrounding keyframes
    let idx = keyframes.partition_point(|kf| kf.frame <= frame);
    let kf_before = &keyframes[idx - 1];
    let kf_after = &keyframes[idx];

    let range = (kf_after.frame - kf_before.frame) as f64;
    let raw_t = (frame - kf_before.frame) as f64 / range;
    let eased_t = kf_before.easing.apply(raw_t);

    kf_before.value.lerp(&kf_after.value, eased_t)
}

/// Cubic bezier solver for custom easing curves.
/// Numerically solves for Y given X using Newton's method.
fn cubic_bezier_y(t_x: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    // Sample x(t) to find t for given t_x, then compute y(t)
    let cx = 3.0 * x1;
    let bx = 3.0 * (x2 - x1) - cx;
    let ax = 1.0 - cx - bx;

    let cy = 3.0 * y1;
    let by = 3.0 * (y2 - y1) - cy;
    let ay = 1.0 - cy - by;

    let sample_x = |t: f64| ((ax * t + bx) * t + cx) * t;
    let sample_dx = |t: f64| (3.0 * ax * t + 2.0 * bx) * t + cx;
    let sample_y = |t: f64| ((ay * t + by) * t + cy) * t;

    // Newton-Raphson to find t for given x
    let mut t = t_x;
    for _ in 0..8 {
        let x_err = sample_x(t) - t_x;
        let dx = sample_dx(t);
        if dx.abs() < 1e-6 {
            break;
        }
        t -= x_err / dx;
    }
    sample_y(t.clamp(0.0, 1.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use kernel_sdk::property::PropertyValue;

    #[test]
    fn test_linear_interpolation() {
        let keyframes = vec![
            KeyFrame::new(0, PropertyValue::Float(0.0)),
            KeyFrame::new(10, PropertyValue::Float(10.0)),
        ];
        let val = interpolate_keyframes(&keyframes, 5).unwrap();
        assert_eq!(val, PropertyValue::Float(5.0));
    }

    #[test]
    fn test_before_first_keyframe() {
        let keyframes = vec![KeyFrame::new(10, PropertyValue::Float(5.0))];
        let val = interpolate_keyframes(&keyframes, 0).unwrap();
        assert_eq!(val, PropertyValue::Float(5.0));
    }

    // ── FileRef keyframe behaviour ─────────────────────────────────────────────

    #[test]
    fn test_file_ref_at_exact_frame_returns_value() {
        let keyframes = vec![KeyFrame::new(0, PropertyValue::FileRef("tex-id".into()))];
        let val = interpolate_keyframes(&keyframes, 0).unwrap();
        assert_eq!(val, PropertyValue::FileRef("tex-id".into()));
    }

    #[test]
    fn test_file_ref_snaps_between_two_keyframes() {
        // Two FileRef keyframes: at frame 0 → "tex-a", frame 10 → "tex-b"
        // At frame 5 (midpoint), result should snap to the first value "tex-a".
        let keyframes = vec![
            KeyFrame::new(0,  PropertyValue::FileRef("tex-a".into())),
            KeyFrame::new(10, PropertyValue::FileRef("tex-b".into())),
        ];
        let val = interpolate_keyframes(&keyframes, 5).unwrap();
        assert_eq!(val, PropertyValue::FileRef("tex-a".into()),
            "FileRef should snap to first keyframe value at mid-point");
    }

    #[test]
    fn test_file_ref_at_last_keyframe() {
        let keyframes = vec![
            KeyFrame::new(0,  PropertyValue::FileRef("tex-a".into())),
            KeyFrame::new(10, PropertyValue::FileRef("tex-b".into())),
        ];
        assert_eq!(
            interpolate_keyframes(&keyframes, 10).unwrap(),
            PropertyValue::FileRef("tex-b".into())
        );
    }

    #[test]
    fn test_file_ref_after_last_keyframe_returns_last() {
        let keyframes = vec![
            KeyFrame::new(0,  PropertyValue::FileRef("tex-a".into())),
            KeyFrame::new(10, PropertyValue::FileRef("tex-b".into())),
        ];
        assert_eq!(
            interpolate_keyframes(&keyframes, 99).unwrap(),
            PropertyValue::FileRef("tex-b".into())
        );
    }
}

