import React from 'react';

/**
 * Base class for property builders
 * Each type of selectable object (GameObject, Layer, Vertex, etc.) has its own builder
 */
export abstract class PropertyBuilder {
  /**
   * Check if this builder can handle the given selection type
   */
  abstract canHandle(type: string): boolean;

  /**
   * Build and return the property panel component for the selected object
   */
  abstract buildPropertyPanel(selectedId: string): React.ReactElement;
}

