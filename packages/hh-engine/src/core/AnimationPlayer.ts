import { getEngineStore, getEngineState } from '../core/EngineGlobals';
import { setGameObjectActive } from '../store/GameObjectSlice';
import { setCurrentFrame } from '../store/PlaybackSlice';

/**
 * AnimationPlayer - Manages animation playback and GameObject visibility
 * Subscribes to playback state changes and updates GameObject visibility
 * based on timeline clips and bornFrameId
 */
export class AnimationPlayer {
    private unsubscribe: (() => void) | null = null;
    private rafId: number | null = null;
    private lastFrameTime: number = 0;

    /**
     * Start listening to store changes and update GameObject visibility
     */
    start() {
        if (this.unsubscribe) {
            console.warn('AnimationPlayer already started');
            return;
        }

        const store = getEngineStore();

        // Subscribe to store changes
        this.unsubscribe = store.subscribe(() => {
            this.updateGameObjectVisibility();
        });

        // Initial update
        this.updateGameObjectVisibility();

        console.log('AnimationPlayer started');
    }

    /**
     * Stop listening to store changes
     */
    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        console.log('AnimationPlayer stopped');
    }

    /**
     * Play animation (auto-advance frames)
     */
    play() {
        const store = getEngineStore();
        const state = getEngineState();

        if (state.playback.isPlaying) {
            console.warn('Already playing');
            return;
        }

        // Note: play/pause actions should be dispatched from outside
        // This just handles the frame advancement
        this.lastFrameTime = performance.now();
        this.animate();
    }

    /**
     * Animation loop
     */
    private animate = () => {
        const state = getEngineState();

        if (!state.playback.isPlaying) {
            this.rafId = null;
            return;
        }

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        const frameDuration = 1000 / state.playback.fps;

        if (elapsed >= frameDuration) {
            const store = getEngineStore();
            const nextFrame = state.playback.currentFrame + 1;

            // Loop or stop at end (can be configured)
            // For now, just loop
            store.dispatch(setCurrentFrame(nextFrame % 120)); // TODO: get max frames from scene

            this.lastFrameTime = now;
        }

        this.rafId = requestAnimationFrame(this.animate);
    };

    /**
     * Update GameObject visibility based on current frame and clips
     */
    private updateGameObjectVisibility() {
        const store = getEngineStore();
        const state = getEngineState();
        const currentFrame = state.playback.currentFrame;

        // For each layer that has timeline
        Object.values(state.layers.byId).forEach((layer: any) => {
            if (!layer.hasTimeline) return;

            const clips = layer.clips || [];
            const isInClip = this.isFrameInClips(clips, currentFrame);

            // For each GameObject in this layer
            layer.gameObjectIds?.forEach((goId: string) => {
                const gameObject = state.gameObjects.byId[goId];
                if (!gameObject) return;

                // Show GameObject if:
                // 1. Current frame is inside a clip
                // 2. Frame >= bornFrameId
                const shouldBeVisible = isInClip && currentFrame >= gameObject.bornFrameId;

                // Update visibility if it changed
                if (gameObject.active !== shouldBeVisible) {
                    store.dispatch(setGameObjectActive({ id: goId, active: shouldBeVisible }));
                }
            });
        });
    }

    /**
     * Check if frame is inside any clip
     */
    private isFrameInClips(
        clips: Array<{ id: string; startFrame: number; length: number }>,
        frame: number
    ): boolean {
        return clips.some(clip => {
            const clipEnd = clip.startFrame + clip.length - 1;
            return frame >= clip.startFrame && frame <= clipEnd;
        });
    }
}

// Singleton instance
let animationPlayerInstance: AnimationPlayer | null = null;

export function getAnimationPlayer(): AnimationPlayer {
    if (!animationPlayerInstance) {
        animationPlayerInstance = new AnimationPlayer();
    }
    return animationPlayerInstance;
}

