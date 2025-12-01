// Core interfaces for the scene system
export interface IComponent {
  readonly type: string;
  enabled: boolean;

  // Note: toJSON removed - serialization should be handled by Redux Store
  // Components are behavior objects, not data containers
}

export interface ITransform extends IComponent {
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
}


