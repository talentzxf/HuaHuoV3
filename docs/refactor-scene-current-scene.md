# 重构：移除 SceneSlice 的 setCurrentScene 和修复 require 问题

## 🎯 修复的问题

### 1. 移除 SceneSlice 中不必要的 setCurrentScene

**问题**: SceneSlice 有 `currentSceneId` 和 `setCurrentScene`，但"当前场景"应该是 **Project 级别** 的概念，不是 Scene 级别的。

**原因**:
- 一个 Project 可以有多个 Scene
- "当前激活的 Scene" 是项目的属性，不是场景的属性
- ProjectSlice 已经有 `currentSceneId` 和 `setProjectCurrentScene`

### 2. 修复 SDK.ts 中的 require 问题

**问题**: SDK.ts 中使用 `require()` 动态导入，与其他地方的 `import` 风格不一致。

```typescript
// ❌ 之前：使用 require
const { createProject, addSceneToProject } = require('@huahuo/engine');
const store = require('@huahuo/engine').getEngineStore();

// ✅ 之后：使用 import
import { Engine, createProject, addSceneToProject, getEngineStore } from '@huahuo/engine';
```

## 📝 修改内容

### 1. SceneSlice.ts

#### 移除 currentSceneId 状态

```typescript
// 之前 ❌
export interface SceneState {
    byId: Record<string, SceneSlice>;
    currentSceneId: string | null;  // ← 移除
}

const initialState: SceneState = {
    byId: {},
    currentSceneId: null  // ← 移除
}

// 之后 ✅
export interface SceneState {
    byId: Record<string, SceneSlice>;
}

const initialState: SceneState = {
    byId: {}
}
```

#### 移除 setCurrentScene action

```typescript
// 之前 ❌
createScene: {
    reducer(state: SceneState, action: PayloadAction<SceneSlice>) {
        const {id, name, layerIds, duration, fps} = action.payload;
        state.byId[id] = {id, name, layerIds, duration, fps};

        // 自动设置为当前场景
        if (!state.currentSceneId) {
            state.currentSceneId = id;
        }
    },
    // ...
},
setCurrentScene(state: SceneState, action: PayloadAction<string>) {
    state.currentSceneId = action.payload;
},

// 之后 ✅
createScene: {
    reducer(state: SceneState, action: PayloadAction<SceneSlice>) {
        const {id, name, layerIds, duration, fps} = action.payload;
        state.byId[id] = {id, name, layerIds, duration, fps};
        // 不再自动设置 currentSceneId
    },
    // ...
},
// setCurrentScene 已删除
```

#### 更新 exports

```typescript
// 之前 ❌
export const {
    createScene, 
    setCurrentScene,  // ← 移除
    setSceneName, 
    setDuration, 
    setFps, 
    addLayerToScene
} = sceneSlice.actions;

// 之后 ✅
export const {
    createScene, 
    setSceneName, 
    setDuration, 
    setFps, 
    addLayerToScene
} = sceneSlice.actions;
```

### 2. SDK.ts

#### 使用 import 代替 require

```typescript
// 之前 ❌
import { Engine } from '@huahuo/engine';

private createNewProject(): void {
    const { createProject, addSceneToProject } = require('@huahuo/engine');
    const store = require('@huahuo/engine').getEngineStore();
    
    // ...
}

// 之后 ✅
import { 
    Engine, 
    createProject, 
    addSceneToProject, 
    getEngineStore 
} from '@huahuo/engine';

private createNewProject(): void {
    const store = getEngineStore();
    
    const projectAction = createProject('My Animation Project', 30, 800, 600);
    store.dispatch(projectAction);
    
    // ...
}
```

### 3. ProjectSlice.ts (已有，无需修改)

ProjectSlice 已经正确管理当前场景：

```typescript
export interface ProjectSlice {
    id: string;
    name: string;
    sceneIds: string[];
    currentSceneId: string | null;  // ← 正确的位置
    // ...
}

// Action: setProjectCurrentScene
setProjectCurrentScene(
    state,
    action: PayloadAction<{ sceneId: string }>
) {
    if (state.current) {
        const { sceneId } = action.payload;
        if (state.current.sceneIds.includes(sceneId)) {
            state.current.currentSceneId = sceneId;
            state.current.modified = Date.now();
        }
    }
}
```

### 4. Scene.ts

#### 更新 import 和使用

```typescript
// 之前 ❌
import {addLayerToScene, createScene, setCurrentScene} from "../store/SceneSlice";

static create(name: string, renderer: IRenderer, sceneContext: any): Scene {
    const store = getEngineStore();
    const sceneId = store.dispatch(createScene(name)).payload.id;
    store.dispatch(setCurrentScene(sceneId));  // ← 使用已删除的 action
    // ...
}

// 之后 ✅
import {addLayerToScene, createScene} from "../store/SceneSlice";
import { setProjectCurrentScene } from "../store/ProjectSlice";

static create(name: string, renderer: IRenderer, sceneContext: any): Scene {
    const store = getEngineStore();
    const sceneId = store.dispatch(createScene(name)).payload.id;
    
    // Set as current scene in the project
    store.dispatch(setProjectCurrentScene({ sceneId }));
    // ...
}
```

## 🔄 数据流

### 管理当前场景（正确方式）

```typescript
// 获取当前场景
const project = state.engine.project.current;
const currentSceneId = project?.currentSceneId;
const currentScene = currentSceneId ? state.engine.scenes.byId[currentSceneId] : null;

// 切换场景
store.dispatch(setProjectCurrentScene({ sceneId: 'scene-123' }));
```

### 创建场景并设为当前场景

```typescript
// 1. 创建场景
const sceneAction = createScene('MyScene');
const { id: sceneId } = store.dispatch(sceneAction).payload;

// 2. 添加到项目
store.dispatch(addSceneToProject({ sceneId }));
// ↑ addSceneToProject 会自动将第一个场景设为当前场景
```

## 📊 架构对比

### 之前 ❌

```
SceneSlice {
    byId: {...}
    currentSceneId: 'scene-1'  // ← 错误的位置
}

ProjectSlice {
    current: {
        sceneIds: ['scene-1', 'scene-2']
        currentSceneId: 'scene-1'  // ← 重复！
    }
}
```

**问题**: 两个地方都有 `currentSceneId`，容易不同步

### 之后 ✅

```
SceneSlice {
    byId: {...}
    // 没有 currentSceneId
}

ProjectSlice {
    current: {
        sceneIds: ['scene-1', 'scene-2']
        currentSceneId: 'scene-1'  // ← 唯一的源
    }
}
```

**优势**: 单一数据源，不会不同步

## 💡 设计原则

### 职责分离

- **SceneSlice**: 管理 Scene 数据本身（名称、图层、时长、FPS）
- **ProjectSlice**: 管理项目级别的状态（当前场景、总帧数、画布尺寸）

### 单一数据源 (Single Source of Truth)

"当前场景"的状态只存在于一个地方：`project.current.currentSceneId`

### 层级关系

```
Project (项目)
  ├─ currentSceneId: 'scene-1'  ← 项目级别的状态
  ├─ sceneIds: ['scene-1', 'scene-2']
  └─ totalFrames: 120

Scene (场景)
  ├─ name: 'DefaultScene'
  ├─ layerIds: ['layer-1', 'layer-2']
  └─ fps: 30
```

## 🎯 使用示例

### 获取当前场景

```typescript
import { useSelector } from 'react-redux';
import type { RootState } from './store';

function MyComponent() {
  // 1. 获取当前场景 ID
  const currentSceneId = useSelector(
    (state: RootState) => state.engine.project.current?.currentSceneId
  );

  // 2. 获取场景数据
  const currentScene = useSelector(
    (state: RootState) => 
      currentSceneId ? state.engine.scenes.byId[currentSceneId] : null
  );

  return (
    <div>
      <h1>Current Scene: {currentScene?.name || 'None'}</h1>
    </div>
  );
}
```

### 切换场景

```typescript
import { getEngineStore, setProjectCurrentScene } from '@huahuo/engine';

function switchToScene(sceneId: string) {
  const store = getEngineStore();
  store.dispatch(setProjectCurrentScene({ sceneId }));
}
```

### 创建新场景并切换

```typescript
import { getEngineStore, createScene, addSceneToProject, setProjectCurrentScene } from '@huahuo/engine';

function createAndSwitchScene(name: string) {
  const store = getEngineStore();
  
  // 1. 创建场景
  const action = createScene(name);
  const { id: sceneId } = store.dispatch(action).payload;
  
  // 2. 添加到项目
  store.dispatch(addSceneToProject({ sceneId }));
  
  // 3. 切换到新场景 (如果不是第一个场景)
  store.dispatch(setProjectCurrentScene({ sceneId }));
}
```

## 🎉 总结

### 修复的问题

1. ✅ **移除重复的状态** - SceneSlice 不再管理 currentSceneId
2. ✅ **正确的职责分离** - Project 管理项目级别状态，Scene 管理场景数据
3. ✅ **统一的导入风格** - 全部使用 `import`，不再有 `require`
4. ✅ **解决命名冲突** - 只有一个地方管理当前场景

### 架构改进

- 更清晰的数据流
- 单一数据源
- 符合单一职责原则
- 更容易维护和理解

现在代码更加清晰和一致了！🚀

