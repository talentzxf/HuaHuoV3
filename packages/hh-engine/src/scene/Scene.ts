import { getKernel } from "../core/KernelBridge";
import { Layer } from "./Layer";
import { IScene } from "../core/IScene";
import { ILayer } from "../core/ILayer";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";
import { InstanceRegistry } from "../core/InstanceRegistry";

export class Scene extends RegistrableEntity implements IScene {
    private renderer: IRenderer;
    private sceneContext: any;

    constructor(sceneId: string, renderer: IRenderer, sceneContext: any) {
        // Call RegistrableEntity constructor - auto-registers
        super(sceneId);

        this.renderer = renderer;
        this.sceneContext = sceneContext;
    }

    get duration(): number {
        const kernel = getKernel();
        if (!kernel.ready) return 5;
        return kernel.getCurrentScene()?.duration ?? 5;
    }

    set duration(value: number) {
        // TODO: kernel SetSceneDuration command
        console.warn('[Scene] set duration not yet in kernel:', value);
    }

    get fps(): number {
        const kernel = getKernel();
        if (!kernel.ready) return 30;
        return kernel.getCurrentScene()?.fps ?? 30;
    }

    set fps(value: number) {
        // TODO: kernel SetSceneFps command
        console.warn('[Scene] set fps not yet in kernel:', value);
    }

    get name(): string {
        const kernel = getKernel();
        if (!kernel.ready) return '';
        return kernel.getCurrentScene()?.name ?? '';
    }

    set name(_value: string) {
        // TODO: kernel RenameScene command
    }

    get layers(): Layer[] {
        const kernel = getKernel();
        if (!kernel.ready) return [];
        const scene = kernel.getCurrentScene();
        if (!scene) return [];
        return Object.keys(scene.layers ?? {})
            .map((layerId: string) => InstanceRegistry.getInstance().get<Layer>(layerId))
            .filter((layer): layer is Layer => layer !== undefined);
    }

    getLayerByName(name: string): ILayer | undefined {
        const kernel = getKernel();
        if (!kernel.ready) return undefined;
        const scene = kernel.getCurrentScene();
        if (!scene) return undefined;
        const layerId = Object.entries(scene.layers ?? {})
            .find(([, layer]: [string, any]) => layer.name === name)?.[0];
        if (!layerId) return undefined;
        return InstanceRegistry.getInstance().get<Layer>(layerId);
    }

    /** Create a Scene and register it in the kernel + TS registry */
    static create(name: string, renderer: IRenderer, sceneContext: any): Scene {
        const kernel = getKernel();

        // If the kernel already has a scene (created by createProject), reuse its ID
        let sceneId: string;
        if (kernel.ready) {
            const existing = kernel.getCurrentScene();
            if (existing) {
                sceneId = existing.id ?? name;
            } else {
                sceneId = kernel.createScene(name, 30, 5);
            }
        } else {
            // Fallback: generate a random ID for offline/testing
            sceneId = `scene_${Math.random().toString(36).slice(2)}`;
        }

        console.debug('[Scene.create] sceneId:', sceneId);
        return InstanceRegistry.getInstance().getOrCreate<Scene>(sceneId, () =>
            new Scene(sceneId, renderer, sceneContext)
        );
    }

    addLayer(name: string): Layer {
        const kernel = getKernel();
        let layerId: string;

        if (kernel.ready) {
            // Check if the kernel already created this layer (e.g. during createProject)
            const scene = kernel.getCurrentScene();
            const existing = Object.entries(scene?.layers ?? {})
                .find(([, l]: [string, any]) => l.name === name)?.[0];
            layerId = existing ?? kernel.createLayer(this.id, name);
        } else {
            layerId = `layer_${Math.random().toString(36).slice(2)}`;
        }

        // Pass the name to renderer so Paper.js layer also has the name
        const layerContext = this.renderer.createLayerContext(this.sceneContext, name);

        return InstanceRegistry.getInstance().getOrCreate<Layer>(layerId, () =>
            new Layer(layerId, this.renderer, layerContext)
        );
    }

    removeLayer(layer: Layer): void {
        // TODO: Implement layer removal from Redux store
        layer.destroy();
        // Layer will be unregistered in its destroy() method
    }

    destroy(): void {
        throw new Error("Method not implemented.");
    }

    update(deltaTime: number): void {
        // Update all layers and their game objects
        this.layers.forEach(layer => {
            layer.gameObjects.forEach(gameObject => {
                gameObject.update(deltaTime);
            });
        });
    }
}

