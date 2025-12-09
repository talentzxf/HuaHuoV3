# Scene Duration 改变时自动扩展 Project TotalFrames

## 🎯 需求

当 Scene 的 duration 或 fps 改变导致需要更多帧时，Project 的 totalFrames 应该自动扩展；但如果减少，不应该自动缩小（因为可能有其他内容在后面）。

## 📐 行为规则

### 规则 1: 只扩展，不缩小

```
Scene: duration = 10s, fps = 30
需要帧数: 10 × 30 = 300 frames

Project.totalFrames = 120
    ↓
300 > 120 → 自动扩展到 300 ✓

---

Scene: duration = 2s, fps = 30
需要帧数: 2 × 30 = 60 frames

Project.totalFrames = 120
    ↓
60 < 120 → 不缩小，保持 120 ✓
```

### 规则 2: 保护用户内容

```
场景：
- Scene duration: 4s × 30fps = 120 frames
- Project totalFrames: 200 frames
- 用户在 Frame 150-180 有额外内容

如果 Scene duration 改为 2s:
- 需要帧数: 2s × 30fps = 60 frames
- Project totalFrames 保持 200 ✓
- Frame 150-180 的内容不受影响 ✓
```

## 🔧 实现

### 1. Composite Actions

创建两个 thunk actions 来处理 Scene 属性变化并自动扩展 Project：

```typescript
// actions.ts

/**
 * Set Scene duration and auto-expand Project totalFrames if needed
 * Only expands, never shrinks
 */
export const setSceneDurationAndExpandProject = (sceneId: string, duration: number) => {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const engineState = state.engine || state;

        // Get scene
        const scene = engineState.scenes.byId[sceneId];
        if (!scene) return;

        // Calculate required frames
        const requiredFrames = Math.ceil(duration * scene.fps);

        // Update Scene duration
        dispatch(setSceneDuration({ sceneId, duration }));

        // Expand Project totalFrames if needed
        const project = engineState.project.current;
        if (project && requiredFrames > project.totalFrames) {
            console.log(`Expanding Project: ${project.totalFrames} → ${requiredFrames}`);
            dispatch(updateProjectTotalFrames({ totalFrames: requiredFrames }));
        }
    };
};

/**
 * Set Scene fps and auto-expand Project totalFrames if needed
 */
export const setSceneFpsAndExpandProject = (sceneId: string, fps: number) => {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const engineState = state.engine || state;

        const scene = engineState.scenes.byId[sceneId];
        if (!scene) return;

        // Calculate required frames
        const requiredFrames = Math.ceil(scene.duration * fps);

        // Update Scene fps
        dispatch(setSceneFps({ sceneId, fps }));

        // Expand Project totalFrames if needed
        const project = engineState.project.current;
        if (project && requiredFrames > project.totalFrames) {
            console.log(`Expanding Project: ${project.totalFrames} → ${requiredFrames}`);
            dispatch(updateProjectTotalFrames({ totalFrames: requiredFrames }));
        }
    };
};
```

### 2. Scene Setters

更新 Scene.ts 中的 setter 使用新的 composite actions：

```typescript
// Scene.ts

import { setSceneDurationAndExpandProject, setSceneFpsAndExpandProject } from "../store/actions";

class Scene {
    set duration(value: number) {
        const store = getEngineStore();
        // 使用 composite action，自动扩展 Project
        (store.dispatch as any)(setSceneDurationAndExpandProject(this.id, value));
    }

    set fps(value: number) {
        const store = getEngineStore();
        // 使用 composite action，自动扩展 Project
        (store.dispatch as any)(setSceneFpsAndExpandProject(this.id, value));
    }
}
```

## 🔄 完整流程

### 场景 1: 扩展 Scene duration

```
初始状态:
- Scene: duration = 4s, fps = 30
- 需要: 120 frames
- Project.totalFrames = 120

用户修改:
scene.duration = 10;  // 10 秒
    ↓
setSceneDurationAndExpandProject('scene-123', 10)
    ↓
计算需要帧数: 10 × 30 = 300 frames
    ↓
检查: 300 > 120? YES
    ↓
dispatch(setSceneDuration({ sceneId, duration: 10 }))
    → Scene.duration = 10
    ↓
dispatch(updateProjectTotalFrames({ totalFrames: 300 }))
    → Project.totalFrames = 300
    ↓
Timeline 自动扩展，显示 0-299 帧
    ↓
灰色 "PROJECT END" 标记移到 Frame 299
```

### 场景 2: 缩小 Scene duration（不影响 Project）

```
初始状态:
- Scene: duration = 10s, fps = 30
- 需要: 300 frames
- Project.totalFrames = 300

用户修改:
scene.duration = 2;  // 2 秒
    ↓
setSceneDurationAndExpandProject('scene-123', 2)
    ↓
计算需要帧数: 2 × 30 = 60 frames
    ↓
检查: 60 > 300? NO
    ↓
dispatch(setSceneDuration({ sceneId, duration: 2 }))
    → Scene.duration = 2
    ↓
NOT dispatch updateProjectTotalFrames ✓
    → Project.totalFrames 保持 300
    ↓
Timeline 仍然显示 0-299 帧
用户在 Frame 60-299 的内容保留
```

### 场景 3: 修改 FPS

```
初始状态:
- Scene: duration = 4s, fps = 30
- 需要: 120 frames
- Project.totalFrames = 120

用户修改:
scene.fps = 60;  // 提高到 60 fps
    ↓
setSceneFpsAndExpandProject('scene-123', 60)
    ↓
计算需要帧数: 4 × 60 = 240 frames
    ↓
检查: 240 > 120? YES
    ↓
dispatch(setSceneFps({ sceneId, fps: 60 }))
    → Scene.fps = 60
    ↓
dispatch(updateProjectTotalFrames({ totalFrames: 240 }))
    → Project.totalFrames = 240
    ↓
Timeline 自动扩展，显示 0-239 帧
```

## 💡 设计优势

### 1. 自动化

用户不需要：
- 手动计算需要多少帧
- 打开 Project Settings
- 手动修改 totalFrames

**系统自动处理** ✓

### 2. 非破坏性

```
Scene duration 减少时:
- ❌ 不删除后面的帧
- ❌ 不缩小 Project totalFrames
- ✅ 保留所有用户内容
- ✅ 保留所有标记（animationEndFrame）
```

### 3. 智能扩展

```
只在需要时扩展:
- Scene 需要 300 frames
- Project 只有 120 frames
- → 自动扩展到 300

不在不需要时扩展:
- Scene 需要 60 frames
- Project 有 120 frames
- → 保持 120，不缩小
```

## 🎯 使用示例

### 示例 1: 制作长动画

```typescript
// 创建项目
const project = createProject('Long Animation', 30, 800, 600);
// → totalFrames = 120 (默认 4 秒)

// 创建场景
const scene = SDK.Scene.createScene('Main');
// → duration = 5s, fps = 30 (默认)

// 用户决定做一个 20 秒的动画
scene.duration = 20;
// → 自动计算: 20 × 30 = 600 frames
// → Project.totalFrames 自动扩展到 600
// → Timeline 显示 0-599 帧
```

### 示例 2: 高帧率动画

```typescript
// 初始: 30 fps, 4 秒 = 120 frames
const scene = SDK.Scene.getCurrentScene();

// 改为 60 fps
scene.fps = 60;
// → 计算: 4 × 60 = 240 frames
// → Project.totalFrames 自动扩展到 240
```

### 示例 3: 缩短后又延长

```typescript
// 初始
scene.duration = 10;  // 300 frames
// → Project.totalFrames = 300

// 缩短
scene.duration = 5;   // 150 frames
// → Project.totalFrames 保持 300 (不缩小)

// 延长
scene.duration = 15;  // 450 frames
// → Project.totalFrames 扩展到 450
```

## 🔧 与其他功能的关系

### 与 Animation End Marker 配合

```
Scene: duration = 10s × 30fps = 300 frames
Project.totalFrames = 300
Project.animationEndFrame = 250 (用户设置)

Timeline 显示:
- Frame 0-299: 可见和可编辑
- Frame 250: 红色 "ANIM END" 标记
- Frame 299: 灰色 "PROJECT END" 标记

用户延长 Scene:
scene.duration = 15s → 450 frames
    ↓
Project.totalFrames → 450
animationEndFrame 保持 250 (不受影响)
    ↓
Timeline 显示:
- Frame 0-449: 可见和可编辑
- Frame 250: 红色 "ANIM END" 标记 (位置不变)
- Frame 449: 灰色 "PROJECT END" 标记 (移动了)
```

### 与手动设置 totalFrames

```
用户可以随时通过 Project Settings 手动设置:
- Scene 需要 300 frames
- 用户手动设置 totalFrames = 500
- Scene duration 不变
- Project.totalFrames = 500

之后 Scene duration 增加:
- Scene 改为 600 frames
- Project 自动扩展到 600
```

## 📊 逻辑表

| Scene 需要帧数 | Project 当前帧数 | 操作 | 结果 |
|--------------|----------------|------|------|
| 300 | 120 | 扩展 | 300 |
| 60 | 120 | 不变 | 120 |
| 500 | 300 | 扩展 | 500 |
| 100 | 500 | 不变 | 500 |
| 120 | 120 | 不变 | 120 |

**规则**: `Project.totalFrames = Math.max(Project.totalFrames, Scene.requiredFrames)`

## 🎉 总结

现在系统实现了智能的帧数管理：

✅ **自动扩展** - Scene 需要更多帧时自动扩展 Project
✅ **保护内容** - Scene 缩小时不删除后面的内容
✅ **用户友好** - 无需手动计算和调整
✅ **非破坏性** - 永远不会丢失用户内容

实现完成！🚀

