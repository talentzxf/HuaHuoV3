import { getEngineStore, getEngineState } from '../core/EngineGlobals';
import { setGameObjectActive } from '../store/GameObjectSlice';
import { setCurrentFrame } from '../store/PlaybackSlice';
import { interpolateComponent, updateComponentProps } from '../store/ComponentSlice';

/**
 * AnimationPlayer - Manages animation playback and GameObject visibility
 * Subscribes to playback state changes and updates GameObject visibility
 * based on timeline clips and bornFrameId
 */
export class AnimationPlayer {
    private unsubscribe: (() => void) | null = null;
    private rafId: number | null = null;
    private lastFrameTime: number = 0;
    private lastProcessedFrame: number = -1; // Track the last frame we processed to avoid infinite loops

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
            const state = getEngineState();
            const currentFrame = state.playback.currentFrame;

            // Only update if frame actually changed (prevent infinite loop)
            if (currentFrame !== this.lastProcessedFrame) {
                this.lastProcessedFrame = currentFrame;
                this.updateGameObjects();
            }
        });

        // Initial update
        this.updateGameObjects();

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
        // Don't check isPlaying here - the dispatch happens before this is called
        // The animate loop will check isPlaying to continue or stop
        this.lastFrameTime = performance.now();
        this.animate();
    }

    /**
     * Force update all GameObjects based on current frame
     * This is useful when clips are merged/split and we need to recalculate visibility
     */
    forceUpdate() {
        console.log('[AnimationPlayer] Force update triggered');
        this.updateGameObjects();
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
            const engineState = getEngineState();
            const currentFrame = state.playback.currentFrame;

            // Determine the end frame: use animationEndFrame if set, otherwise use totalFrames
            const project = engineState.project.current;
            const totalFrames = project?.totalFrames || 120;
            const animationEndFrame = project?.animationEndFrame;

            // End frame is where animation should loop back
            let endFrame = totalFrames - 1;
            if (animationEndFrame !== null && animationEndFrame !== undefined && animationEndFrame >= 0) {
                endFrame = animationEndFrame;
            }

            // Calculate next frame
            let nextFrame = currentFrame + 1;

            // Loop back to start if we reached the end
            if (nextFrame > endFrame) {
                nextFrame = 0;
            }

            store.dispatch(setCurrentFrame(nextFrame));

            this.lastFrameTime = now;
        }

        this.rafId = requestAnimationFrame(this.animate);
    };

    /**
     * Update GameObject visibility and interpolate component properties based on current frame
     */
    private updateGameObjects() {
        const store = getEngineStore();
        const state = getEngineState();
        const currentFrame = state.playback.currentFrame;

        // For each layer that has timeline
        Object.values(state.layers.byId).forEach((layer: any) => {
            if (!layer.hasTimeline) return;

            const clips = layer.clips || [];

            // For each GameObject in this layer
            layer.gameObjectIds?.forEach((goId: string) => {
                const gameObject = state.gameObjects.byId[goId];
                if (!gameObject) return;

                const bornFrame = gameObject.bornFrameId;

                // GameObject should be invisible before its birth frame
                if (currentFrame < bornFrame) {
                    if (gameObject.active !== false) {
                        store.dispatch(setGameObjectActive({ id: goId, active: false }));
                    }
                    return; // Skip interpolation for unborn GameObjects
                }

                // Find the clip that contains current frame
                const currentClip = clips.find((clip: any) => {
                    const clipEnd = clip.startFrame + clip.length - 1;
                    return currentFrame >= clip.startFrame && currentFrame <= clipEnd;
                });

                // Show if: birth frame is in current clip OR birth frame equals current frame
                let shouldBeVisible = false;
                if (currentClip) {
                    const clipEnd = currentClip.startFrame + currentClip.length - 1;
                    shouldBeVisible = bornFrame >= currentClip.startFrame && bornFrame <= clipEnd;
                }
                shouldBeVisible = shouldBeVisible || bornFrame === currentFrame;

                // Update visibility if it changed
                if (gameObject.active !== shouldBeVisible) {
                    store.dispatch(setGameObjectActive({ id: goId, active: shouldBeVisible }));
                }

                // Interpolate components for active GameObjects
                if (shouldBeVisible) {
                    this.interpolateGameObjectComponents(goId, currentFrame);
                }
            });
        });
    }

    /**
     * Interpolate all components of a GameObject
     */
    private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number) {
        const store = getEngineStore();
        const state = getEngineState();
        const gameObject = state.gameObjects.byId[gameObjectId];

        if (!gameObject || !gameObject.componentIds) return;

        // Iterate through each component of this GameObject
        for (const componentId of gameObject.componentIds) {
            const component = state.components.byId[componentId];
            if (!component) continue;

            // Skip Timeline component itself (it's just a UI helper)
            if (component.type === 'Timeline') continue;

            // Check if this component has any keyframes
            const hasKeyFrames = Object.keys(component.keyFrames).length > 0;
            if (!hasKeyFrames) continue;

            // Interpolate the component
            // Easing is read from each keyframe's easingType field
            const interpolatedProps = interpolateComponent(component, currentFrame);

            // Update the component props
            store.dispatch(updateComponentProps({
                id: componentId,
                patch: interpolatedProps
            }));
        }
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

