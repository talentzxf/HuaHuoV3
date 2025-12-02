import { PropertyBuilder } from './PropertyBuilder';
import { GameObjectPropertyBuilder } from './GameObjectPropertyBuilder';
import { LayerPropertyBuilder } from './LayerPropertyBuilder';

/**
 * Factory for creating property builders
 * Manages registration and retrieval of property builders for different object types
 */
export class PropertyBuilderFactory {
  private static instance: PropertyBuilderFactory;
  private builders: PropertyBuilder[] = [];

  private constructor() {
    // Register built-in builders
    this.registerBuilder(new GameObjectPropertyBuilder());
    this.registerBuilder(new LayerPropertyBuilder());
  }

  static getInstance(): PropertyBuilderFactory {
    if (!PropertyBuilderFactory.instance) {
      PropertyBuilderFactory.instance = new PropertyBuilderFactory();
    }
    return PropertyBuilderFactory.instance;
  }

  /**
   * Register a property builder
   */
  registerBuilder(builder: PropertyBuilder): void {
    this.builders.push(builder);
  }

  /**
   * Get the appropriate builder for the given selection type
   */
  getBuilder(type: string): PropertyBuilder | null {
    return this.builders.find(builder => builder.canHandle(type)) || null;
  }
}

