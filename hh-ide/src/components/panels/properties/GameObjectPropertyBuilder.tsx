import React from 'react';
import { PropertyBuilder } from './PropertyBuilder';
import GameObjectPropertyPanel from './GameObjectPropertyPanel';

/**
 * Property builder for GameObject
 */
export class GameObjectPropertyBuilder extends PropertyBuilder {
  canHandle(type: string): boolean {
    return type === 'gameObject';
  }

  buildPropertyPanel(selectedId: string): React.ReactElement {
    return <GameObjectPropertyPanel key={selectedId} gameObjectId={selectedId} />;
  }
}

