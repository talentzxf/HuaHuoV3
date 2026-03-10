import { ILayer } from "../core/ILayer";
import { IGameObject } from "../core/IGameObject";
import { GameObject } from "./GameObject";
import { getKernel } from "../core/KernelBridge";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";
import { InstanceRegistry } from "../core/InstanceRegistry";

/**
 * Layer — thin TS class that mirrors a Rust kernel Layer.
 *
 * Data (visibility, lock, hasTimeline, gameObjectIds) lives in the Rust kernel.
 * This class owns the Paper.js layer context and the TS-side GameObject instances.
 */
export class Layer extends RegistrableEntity implements ILayer {
    private renderer: IRenderer;
    private layerContext: any;
    // Track name counters to generate unique names
    private nameCounters: Map<string, number> = new Map();

    constructor(
        layerId: string,
        renderer: IRenderer,
        layerContext: any
    ) {
        // Call RegistrableEntity constructor - auto-registers
        super(layerId);

        this.renderer = renderer;
        this.layerContext = layerContext;
    }

    /**
     * Generate a unique name for GameObject
     * If name already exists, append a number (e.g., Circle-1, Circle-2)
     */
    private generateUniqueName(baseName: string): string {
        // Extract base name without number suffix
        const match = baseName.match(/^(.+?)-(\d+)$/);
        const base = match ? match[1] : baseName;

        // Get current counter for this base name
        const counter = (this.nameCounters.get(base) ?? 0) + 1;
        this.nameCounters.set(base, counter);

        // Generate name with counter
        const newName = `${base}-${counter}`;

        // Check if this name already exists in current gameObjects
        const exists = this.gameObjects.some(go => go.name === newName);
        if (exists) {
            // If it exists, increment and try again
            return this.generateUniqueName(baseName);
        }

        return newName;
    }

    /**
     * Centralized GameObject factory method
     * This ensures all GameObjects are created consistently with proper render item registration
     */
    private createGameObjectInstance(gameObjectId: string, renderItem?: any): GameObject {
        console.log('[Layer] createGameObjectInstance:', gameObjectId, 'renderItem:', !!renderItem);
        const gameObject = new GameObject(gameObjectId, this.renderer, this.layerContext, renderItem);
        console.log('[Layer] GameObject created:', gameObjectId);
        return gameObject;
    }

    get name(): string {
        const kernel = getKernel();
        if (!kernel.ready) return '';
        const scene = kernel.getCurrentScene();
        return scene?.layers?.[this.id]?.name ?? '';
    }

    get gameObjects(): ReadonlyArray<IGameObject> {
        const kernel = getKernel();
        if (!kernel.ready) return [];
        const scene = kernel.getCurrentScene();
        const layer = scene?.layers?.[this.id];
        if (!layer) return [];
        return (layer.game_object_ids ?? [])
            .map((goId: string) => InstanceRegistry.getInstance().get<GameObject>(goId))
            .filter((go: GameObject | undefined): go is GameObject => go !== undefined);
    }

    get visible(): boolean {
        const kernel = getKernel();
        if (!kernel.ready) return true;
        return kernel.getCurrentScene()?.layers?.[this.id]?.visible ?? true;
    }
    set visible(v: boolean) {
        // TODO: kernel SetLayerVisible command
        this.renderer.setLayerVisible(this.layerContext, v);
    }

    get locked(): boolean {
        const kernel = getKernel();
        if (!kernel.ready) return false;
        return kernel.getCurrentScene()?.layers?.[this.id]?.locked ?? false;
    }
    set locked(v: boolean) {
        // TODO: kernel SetLayerLocked command
        this.renderer.setLayerLocked(this.layerContext, v);
    }

    get hasTimeline(): boolean {
        const kernel = getKernel();
        if (!kernel.ready) return true;
        return kernel.getCurrentScene()?.layers?.[this.id]?.has_timeline ?? true;
    }
    set hasTimeline(_v: boolean) {
        // TODO: kernel SetLayerHasTimeline command
    }

    addGameObject(name: string, renderItem?: any): IGameObject {
        // Generate unique name to avoid duplicates
        const uniqueName = this.generateUniqueName(name);

        const kernel = getKernel();
        // Get current frame to set as bornFrameId
        const currentFrame = kernel.ready ? (kernel.getPlaybackState()?.current_frame ?? 0) : 0;

        // Create GO in Rust kernel (gets an ID back)
        const gameObjectId = kernel.createGameObject(this.id, uniqueName, currentFrame);

        // Create / reuse TS-side instance
        const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () =>
            this.createGameObjectInstance(gameObjectId, renderItem)
        );

        return gameObject;
    }

    findGameObject(name: string): IGameObject | undefined {
        return this.gameObjects.find(go => go.name === name);
    }

    removeGameObject(gameObject: IGameObject): void {
        getKernel().deleteGameObject(gameObject.id);
        gameObject.destroy();
    }

    destroy(): void {
        const kernel = getKernel();
        if (kernel.ready) {
            const scene = kernel.getCurrentScene();
            const layer = scene?.layers?.[this.id];
            (layer?.game_object_ids ?? []).forEach((goId: string) => {
                const go = InstanceRegistry.getInstance().get<GameObject>(goId);
                if (go) go.destroy();
            });
        }
        InstanceRegistry.getInstance().unregister(this.id);
    }

    update(deltaTime: number): void {
        this.gameObjects.forEach(go => go.update(deltaTime));
    }

    /**
     * Get the Paper.js layer context
     * Used by Engine for operations like resize
     */
    getLayerContext(): any {
        return this.layerContext;
    }
}
