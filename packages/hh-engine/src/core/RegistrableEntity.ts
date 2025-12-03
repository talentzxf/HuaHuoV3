import {InstanceRegistry} from "./InstanceRegistry";

/**
 * Base class for entities that need to be registered in the InstanceRegistry
 * Automatically handles registration/unregistration
 * All entities (Component, GameObject, Layer, Scene) share the same unified registry
 */
export abstract class RegistrableEntity {
  public readonly id: string;

  constructor(id: string) {
    this.id = id;

    // Register this instance immediately upon creation
    InstanceRegistry.getInstance().register(id, this);
  }

  /**
   * Unregister this instance from the registry
   * Should be called when the entity is destroyed
   */
  protected unregister(): void {
      InstanceRegistry.getInstance().unregister(this.id);
  }
}
