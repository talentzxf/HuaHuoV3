import { getKernel } from './KernelBridge';

/**
 * AnimationPlayer — drives the Rust kernel's tick() each animation frame.
 *
 * All the heavy lifting (frame advance, interpolation, event delivery) is done
 * inside the Rust WASM module.  KernelAdapter listens to the published events
 * and updates Paper.js accordingly.
 *
 * @deprecated  Direct kernel calls (getKernel().play() / pause() / stop()) are
 *              preferred.  This class exists for backward compatibility with
 *              callers that still reference `getAnimationPlayer()`.
 */
export class AnimationPlayer {
    private rafId: number | null = null;
    private lastFrameTime: number = 0;

    start(): void {
        // Nothing to subscribe to — kernel events are delivered via KernelAdapter
        console.log('[AnimationPlayer] start() — kernel drives playback now');
    }

    stop(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        console.log('[AnimationPlayer] stop()');
    }

    play(): void {
        this.lastFrameTime = performance.now();
        this._loop();
    }

    forceUpdate(): void {
        // Nothing to do — KernelAdapter reacts to kernel events automatically
    }

    private _loop = () => {
        const kernel = getKernel();
        if (!kernel.ready) return;

        const pb = kernel.getPlaybackState();
        if (!pb?.is_playing) {
            this.rafId = null;
            return;
        }

        const now = performance.now();
        const delta = (now - this.lastFrameTime) / 1000; // seconds
        kernel.tick(delta);
        this.lastFrameTime = now;

        this.rafId = requestAnimationFrame(this._loop);
    };
}

let _instance: AnimationPlayer | null = null;

export function getAnimationPlayer(): AnimationPlayer {
    if (!_instance) _instance = new AnimationPlayer();
    return _instance;
}
