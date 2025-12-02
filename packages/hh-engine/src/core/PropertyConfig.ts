/**
 * Property configuration decorator
 * Use this to configure how properties are displayed in the PropertyPanel
 */

export interface PropertyConfigOptions {
    step?: number;        // Step for number inputs (default: 0.1)
    min?: number;         // Minimum value
    max?: number;         // Maximum value
    precision?: number;   // Decimal precision (default: 2)
}

// Use WeakMap to store property configs, keyed by class prototype
const propertyConfigsMap = new WeakMap<any, Map<string, PropertyConfigOptions>>();

function getPropertyConfigs(target: any): Map<string, PropertyConfigOptions> {
    let configs = propertyConfigsMap.get(target);
    if (!configs) {
        configs = new Map<string, PropertyConfigOptions>();
        propertyConfigsMap.set(target, configs);
    }
    return configs;
}

/**
 * PropertyConfig decorator for properties
 * @param options Configuration options for the property
 *
 * @example
 * @Component
 * class Transform {
 *   @PropertyConfig({ step: 1, min: 0, max: 360 })
 *   rotation: number = 0;
 * }
 */
export function PropertyConfig(options: PropertyConfigOptions) {
    return function (target: any, context: any) {
        // TypeScript 5.x Stage 3 decorators: context is an object
        const propertyKey = typeof context === 'object' && context !== null ? context.name : context;

        if (!propertyKey) {
            console.error('[PropertyConfig] Cannot determine property name from context:', context);
            return;
        }

        // Use addInitializer to register after class is constructed
        if (context && typeof context.addInitializer === 'function') {
            context.addInitializer(function(this: any) {
                // 'this' is the class prototype
                const configs = getPropertyConfigs(this.constructor.prototype || this);
                configs.set(propertyKey, options);
                console.debug(`[PropertyConfig] Registered ${propertyKey}:`, options);
            });
        } else {
            // Fallback for old decorator syntax (if target is valid)
            if (target && typeof target === 'object') {
                const configs = getPropertyConfigs(target);
                configs.set(propertyKey, options);
                console.debug(`[PropertyConfig] Registered ${propertyKey}:`, options);
            } else {
                console.error('[PropertyConfig] Invalid target:', target, 'for property:', propertyKey);
            }
        }
    };
}

/**
 * Component decorator - marks a class as having property configurations
 * Apply this to any class that uses @PropertyConfig
 *
 * @example
 * @Component
 * export class Transform extends ComponentBase {
 *   @PropertyConfig({ step: 1 })
 *   rotation: number;
 * }
 */
export function Component<T extends { new(...args: any[]): {} }>(constructor: T) {
    // Defensive check
    if (!constructor || !constructor.prototype) {
        console.error('[Component] Invalid constructor:', constructor);
        return constructor;
    }

    // Store the configs on the constructor for easy access
    const prototypeConfigs = propertyConfigsMap.get(constructor.prototype);
    if (prototypeConfigs) {
        propertyConfigsMap.set(constructor, prototypeConfigs);
        console.debug(`[Component] Registered ${constructor.name} with ${prototypeConfigs.size} properties`);
    }
    return constructor;
}

/**
 * Get property config for a given class constructor and property
 */
export function getPropertyConfigFromClass(classConstructor: any, propertyKey: string): PropertyConfigOptions | undefined {
    // First try to get from constructor
    let configs = propertyConfigsMap.get(classConstructor);
    if (!configs) {
        // Fallback to prototype
        configs = propertyConfigsMap.get(classConstructor.prototype);
    }
    return configs?.get(propertyKey);
}

/**
 * Get all property configs for a given class constructor
 */
export function getAllPropertyConfigsFromClass(classConstructor: any): Map<string, PropertyConfigOptions> {
    let configs = propertyConfigsMap.get(classConstructor);
    if (!configs) {
        configs = propertyConfigsMap.get(classConstructor.prototype);
    }
    return configs || new Map();
}

