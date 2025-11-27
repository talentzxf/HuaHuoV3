# @huahuo/engine

HuaHuo Game Engine Core - A component-based game engine built on Paper.js

## Architecture

```
Scene
├── Layer (multiple)
│   └── GameObject (multiple)
│       └── Component (multiple)
│           ├── Transform (required)
│           ├── CircleRenderer
│           ├── RectangleRenderer
│           └── Custom Components...
```

## Installation

```bash
pnpm add @huahuo/engine
```

## Usage

### Basic Setup

```typescript
import paper from 'paper';
import { Engine } from '@huahuo/engine';

// Initialize Paper.js
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const scope = new paper.PaperScope();
scope.setup(canvas);

// Create engine
const engine = new Engine(scope);

// Create scene
const scene = engine.createScene('MyScene');
const layer = scene.addLayer('Default');

// Create GameObject
const gameObject = layer.addGameObject('Circle1');
gameObject.transform.position = { x: 100, y: 100 };
gameObject.addComponent('CircleRenderer', {
  radius: 50,
  fillColor: '#ff0000',
  strokeColor: '#000000',
  strokeWidth: 2
});

// Update loop
function gameLoop(deltaTime: number) {
  engine.update(deltaTime);
  requestAnimationFrame(() => gameLoop(16));
}
gameLoop(16);
```

### Custom Components

```typescript
import { Component, IGameObject } from '@huahuo/engine';

class MyCustomComponent extends Component {
  public readonly type = 'MyCustomComponent';
  
  private speed: number = 100;
  
  update(deltaTime: number): void {
    // Move GameObject
    const transform = this.gameObject.transform;
    transform.position = {
      x: transform.position.x + this.speed * deltaTime / 1000,
      y: transform.position.y
    };
  }
}

// Register component
engine.registerComponent('MyCustomComponent', (gameObject, scope, layer, config) => {
  return new MyCustomComponent(gameObject);
});

// Use it
gameObject.addComponent('MyCustomComponent');
```

### Save and Load

```typescript
// Save scene
const sceneData = engine.saveScene();
localStorage.setItem('scene', JSON.stringify(sceneData));

// Load scene
const savedData = JSON.parse(localStorage.getItem('scene') || '{}');
const loadedScene = engine.loadScene(savedData);
```

## API Reference

### Engine

- `createScene(name: string): IScene` - Create a new scene
- `getCurrentScene(): IScene | null` - Get current active scene
- `loadScene(sceneData: any): IScene` - Load scene from JSON
- `saveScene(): any` - Save current scene to JSON
- `registerComponent(type: string, factory: Function)` - Register custom component
- `update(deltaTime: number)` - Update engine (call in game loop)

### Scene

- `addLayer(name: string): ILayer` - Add a new layer
- `removeLayer(layer: ILayer)` - Remove a layer
- `getLayer(name: string): ILayer | undefined` - Find layer by name

### Layer

- `addGameObject(name: string): IGameObject` - Create new GameObject
- `removeGameObject(gameObject: IGameObject)` - Remove GameObject
- `visible: boolean` - Show/hide layer
- `locked: boolean` - Lock/unlock layer

### GameObject

- `transform: ITransform` - Transform component (position, rotation, scale)
- `addComponent<T>(type: string, config?: any): T` - Add component
- `getComponent<T>(type: string): T | undefined` - Get component
- `removeComponent(component: IComponent)` - Remove component
- `active: boolean` - Enable/disable GameObject

### Built-in Components

- **Transform** - Position, rotation, scale (required on all GameObjects)
- **CircleRenderer** - Render circle
- **RectangleRenderer** - Render rectangle

## License

MIT

