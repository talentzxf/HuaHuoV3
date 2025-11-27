// Core interfaces for the scene system
export interface IComponent {
  readonly type: string;
  enabled: boolean;

  toJSON(): any;
}

export interface ITransform extends IComponent {
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
}

export interface IRenderer extends IComponent {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

