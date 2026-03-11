use serde::{Deserialize, Serialize};

/// Playback state for animation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub current_frame: u32,
    pub is_playing: bool,
    pub fps: f64,
    /// If set, stop playback at this frame
    pub end_frame: Option<u32>,
    pub total_frames: u32,
}

impl PlaybackState {
    pub fn new(fps: f64, total_frames: u32) -> Self {
        Self {
            current_frame: 0,
            is_playing: false,
            fps,
            end_frame: None,
            total_frames,
        }
    }

    pub fn play(&mut self) {
        self.is_playing = true;
    }

    pub fn pause(&mut self) {
        self.is_playing = false;
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.current_frame = 0;
    }

    /// Advance by `delta_seconds`. Returns true if we looped back to start.
    pub fn advance(&mut self, delta_seconds: f64) -> bool {
        if !self.is_playing {
            return false;
        }
        let frames_to_advance = (delta_seconds * self.fps) as u32;
        let stop_at = self.end_frame.unwrap_or(self.total_frames);
        self.current_frame += frames_to_advance;

        // NOTE: After advancing the frame, inform any registered runtime component
        // hooks via a global callback if available. We don't add kernel-sdk as a
        // dependency here to avoid cycles; instead, we'll call a weak global
        // function provided by the application layer when available. For the PoC,
        // the application (kernel-cli or kernel-wasm) can set a global hook to be
        // invoked each frame.

        if self.current_frame >= stop_at {
            self.current_frame = 0;
            return true; // looped
        }
        false
    }
}

