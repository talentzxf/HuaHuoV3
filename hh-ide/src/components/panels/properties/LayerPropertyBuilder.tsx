import React from 'react';
import { PropertyBuilder } from './PropertyBuilder';
import LayerPropertyPanel from './LayerPropertyPanel';

/**
 * Property builder for Layer
 */
export class LayerPropertyBuilder extends PropertyBuilder {
  canHandle(type: string): boolean {
    return type === 'layer';
  }

  buildPropertyPanel(selectedId: string): React.ReactElement {
    return <LayerPropertyPanel key={selectedId} layerId={selectedId} />;
  }
}

