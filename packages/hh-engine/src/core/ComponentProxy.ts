import { Component } from '../components/Component';

/**
 * Create a proxy for a Component that automatically syncs properties with Redux Store
 *
 * Usage:
 * ```typescript
 * export class Visual extends Component {
 *   public readonly type = 'Visual';
 *
 *   // Declare property types
 *   fillColor?: string;
 *   strokeColor?: string;
 *   strokeWidth?: number;
 *   opacity?: number;
 *
 *   constructor(gameObject: any, config?: any) {
 *     super(gameObject);
 *     return createComponentProxy(this, config);
 *   }
 * }
 * ```
 *
 * Now you can use properties directly:
 * ```typescript
 * visual.fillColor = 'red';  // Automatically calls updateProp
 * console.log(visual.fillColor);  // Automatically calls getProps
 * ```
 */
export function createComponentProxy<T extends Component>(
  component: T,
  initialConfig?: Record<string, any>
): T {
  // Store which properties are component props (vs methods/internal properties)
  const propsKeys = new Set<string>();

  // Initialize props from config
  if (initialConfig) {
    Object.keys(initialConfig).forEach(key => {
      propsKeys.add(key);
    });
  }

  const proxy = new Proxy(component, {
    get(target: any, prop: string | symbol) {
      // Convert symbol to string for checking
      if (typeof prop === 'symbol') {
        return target[prop];
      }

      // Internal properties and methods - access directly
      if (
        prop.startsWith('_') ||
        prop === 'type' ||
        prop === 'enabled' ||
        prop === 'gameObject' ||
        prop === 'componentId' ||
        prop === 'constructor' ||
        typeof target[prop] === 'function'
      ) {
        return target[prop];
      }

      // Check if this is a known component prop
      if (propsKeys.has(prop)) {
        return target.getProps()[prop];
      }

      // Check if property exists on target (methods, etc)
      if (prop in target) {
        return target[prop];
      }

      // Otherwise treat as a component prop
      return target.getProps()[prop];
    },

    set(target: any, prop: string | symbol, value: any) {
      // Convert symbol to string for checking
      if (typeof prop === 'symbol') {
        target[prop] = value;
        return true;
      }

      // Internal properties - set directly
      if (
        prop.startsWith('_') ||
        prop === 'type' ||
        prop === 'enabled' ||
        prop === 'gameObject' ||
        prop === 'componentId'
      ) {
        target[prop] = value;
        return true;
      }

      // Check if this is a method or existing property on the class
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), prop);
      if (descriptor && (descriptor.get || descriptor.set || typeof target[prop] === 'function')) {
        target[prop] = value;
        return true;
      }

      // Otherwise, treat as a component prop and sync to Redux
      propsKeys.add(prop);
      target.updateProp(prop, value);
      return true;
    },

    has(target: any, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return prop in target;
      }
      return prop in target || propsKeys.has(prop) || prop in target.getProps();
    },

    ownKeys(target: any) {
      const props = target.getProps();
      const targetKeys = Reflect.ownKeys(target);
      const propKeys = Object.keys(props);
      return [...new Set([...targetKeys, ...propKeys])];
    },

    getOwnPropertyDescriptor(target: any, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }

      if (prop in target) {
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }

      if (propsKeys.has(prop) || prop in target.getProps()) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
        };
      }

      return undefined;
    }
  });

  return proxy as T;
}

