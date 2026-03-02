use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Vec2 { pub x: f64, pub y: f64 }
impl Vec2 {
    pub fn new(x: f64, y: f64) -> Self { Self { x, y } }
    pub fn lerp(&self, other: &Vec2, t: f64) -> Vec2 {
        Vec2 { x: self.x + (other.x - self.x) * t, y: self.y + (other.y - self.y) * t }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Color { pub r: u8, pub g: u8, pub b: u8, pub a: u8 }
impl Color {
    pub fn rgba(r: u8, g: u8, b: u8, a: u8) -> Self { Self { r, g, b, a } }
    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex = hex.trim_start_matches('#');
        match hex.len() {
            6 => Some(Color { r: u8::from_str_radix(&hex[0..2], 16).ok()?, g: u8::from_str_radix(&hex[2..4], 16).ok()?, b: u8::from_str_radix(&hex[4..6], 16).ok()?, a: 255 }),
            8 => Some(Color { r: u8::from_str_radix(&hex[0..2], 16).ok()?, g: u8::from_str_radix(&hex[2..4], 16).ok()?, b: u8::from_str_radix(&hex[4..6], 16).ok()?, a: u8::from_str_radix(&hex[6..8], 16).ok()? }),
            _ => None,
        }
    }
    pub fn to_hex(&self) -> String { format!("#{:02X}{:02X}{:02X}{:02X}", self.r, self.g, self.b, self.a) }
}
impl Default for Color { fn default() -> Self { Color { r: 255, g: 255, b: 255, a: 255 } } }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform { pub position: Vec2, pub rotation: f64, pub scale: Vec2 }
impl Default for Transform {
    fn default() -> Self { Self { position: Vec2::default(), rotation: 0.0, scale: Vec2::new(1.0, 1.0) } }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visual { pub fill_color: Option<Color>, pub stroke_color: Option<Color>, pub stroke_width: f64, pub opacity: f64 }
impl Default for Visual {
    fn default() -> Self { Self { fill_color: Some(Color::rgba(61, 119, 204, 255)), stroke_color: Some(Color::rgba(24, 144, 255, 255)), stroke_width: 2.0, opacity: 1.0 } }
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct BornFrame(pub u32);
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Active(pub bool);
impl Default for Active { fn default() -> Self { Active(true) } }
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EntityName(pub String);
/// Parent stored as string ID (not hecs::Entity - not serializable).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parent(pub String);
/// Children stored as string IDs (not hecs::Entity - not serializable).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Children(pub Vec<String>);
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationRef { pub project_id: String, pub start_frame: u32, pub time_scale: f64, pub loop_playback: bool }
impl Default for AnimationRef {
    fn default() -> Self { Self { project_id: String::new(), start_frame: 0, time_scale: 1.0, loop_playback: false } }
}
