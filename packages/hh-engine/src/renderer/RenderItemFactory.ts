import paper from "paper";

/**
 * Factory function type for creating render items
 */
export type RenderItemFactoryFunction = (scope: paper.PaperScope, config: any) => paper.Item;

/**
 * Registry for render item factories
 * Replaces switch-case with a more extensible approach
 */
export class RenderItemFactory {
    private static factories = new Map<string, RenderItemFactoryFunction>();

    /**
     * Register a factory function for a specific render item type
     */
    static register(type: string, factory: RenderItemFactoryFunction): void {
        this.factories.set(type, factory);
    }

    /**
     * Create a render item of the specified type
     */
    static create(type: string, scope: paper.PaperScope, config: any): paper.Item {
        const factory = this.factories.get(type);
        if (!factory) {
            throw new Error(`Unknown render item type: ${type}. Did you forget to register it?`);
        }
        return factory(scope, config);
    }

    /**
     * Check if a type is registered
     */
    static has(type: string): boolean {
        return this.factories.has(type);
    }

    /**
     * Get all registered types
     */
    static getTypes(): string[] {
        return Array.from(this.factories.keys());
    }
}

// Register default render item types
RenderItemFactory.register("circle", (scope: paper.PaperScope, config: any) => {
    const item = new scope.Path.Circle({
        center: new scope.Point(config.x || 0, config.y || 0),
        radius: config.radius || 50,
    });
    return item;
});

RenderItemFactory.register("rectangle", (scope: paper.PaperScope, config: any) => {
    const item = new scope.Path.Rectangle({
        point: new scope.Point(
            (config.x || 0) - (config.width || 100) / 2,
            (config.y || 0) - (config.height || 100) / 2
        ),
        size: new scope.Size(config.width || 100, config.height || 100),
    });
    return item;
});

RenderItemFactory.register("path", (scope: paper.PaperScope, config: any) => {
    const item = new scope.Path(config.points || []);
    return item;
});

RenderItemFactory.register("line", (scope: paper.PaperScope, config: any) => {
    const item = new scope.Path.Line({
        from: new scope.Point(config.x1 || 0, config.y1 || 0),
        to: new scope.Point(config.x2 || 100, config.y2 || 100),
    });
    return item;
});

