# Project 管理系统完整实现

## 🎯 功能概述

实现了完整的 Project 管理系统，包括：
1. ✅ ProjectSlice - 管理项目状态
2. ✅ 在 createNewProject 中创建 Project
3. ✅ 移除所有 hardcode 的 120 帧
4. ✅ 自动计算项目总帧数
5. ✅ Project Settings 对话框
6. ✅ Timeline 结束标记

## 📐 架构设计

### 1. ProjectSlice 数据结构

```typescript
export interface ProjectSlice {
    id: string;
    name: string;
    sceneIds: string[];              // 项目中的所有 Scene
    currentSceneId: string | null;   // 当前激活的 Scene
    totalFrames: number;             // 项目总帧数
    fps: number;                     // 帧率
    canvasWidth: number;             // 画布宽度
    canvasHeight: number;            // 画布高度
    created: number;                 // 创建时间戳
    modified: number;                // 修改时间戳
}

export interface ProjectState {
    current: ProjectSlice | null;    // 当前项目
}
```

### 2. Store 结构

```typescript
engineReducer = {
  project: projectReducer,     // ← 新增
  scenes: sceneReducer,
  layers: layerReducer,
  gameObjects: gameObjectReducer,
  components: componentReducer,
  playback: playbackReducer,
}
```

## 🔄 工作流程

### 创建新项目

```
SDK.initialize()
    ↓
createNewProject()
    ├─> dispatch(createProject('My Animation Project', 30, 800, 600))
    │   → Project { id, name, totalFrames: 120, fps: 30, ... }
    │
    ├─> Scene.createScene('DefaultScene')
    │   → Scene { id, name, ... }
    │
    └─> dispatch(addSceneToProject({ sceneId }))
        → Project.sceneIds = [sceneId]
        → Project.currentSceneId = sceneId
```

### 自动计算总帧数

```
用户添加 Clip 或 KeyFrame
    ↓
dispatch(calculateAndUpdateTotalFrames())
    ├─> 遍历所有 Layer 的 clips
    │   → 找到最后的 clip 结束帧
    │
    ├─> 遍历所有 Layer 的 keyFrames
    │   → 找到最后的 keyframe 帧
    │
    ├─> 遍历所有 Component 的 property keyFrames
    │   → 找到最后的属性关键帧
    │
    ├─> maxFrame = Math.max(所有找到的帧)
    │
    └─> dispatch(updateProjectTotalFrames({ totalFrames: maxFrame + 10 }))
        → Project.totalFrames = maxFrame + 10  // 加10帧作为buffer
```

### 获取项目总帧数

```typescript
// AnimationPlayer
const engineState = getEngineState();
const totalFrames = engineState.project.current?.totalFrames || 120;

// TimelinePanel
const totalFrames = useSelector(
  (state: RootState) => state.engine.project.current?.totalFrames || 120
);
```

## 🎨 UI 实现

### 1. Project Settings 对话框

**位置**: 主菜单栏 "Project" 按钮

**功能**:
- 编辑项目名称
- 设置总帧数（手动）
- 设置 FPS
- 设置画布尺寸
- 显示创建/修改时间

**代码**:
```tsx
// MainMenu.tsx
<Button
  icon={<SettingOutlined />}
  onClick={() => setProjectSettingsOpen(true)}
>
  Project
</Button>

<ProjectSettingsModal 
  open={projectSettingsOpen} 
  onClose={() => setProjectSettingsOpen(false)} 
/>
```

### 2. Timeline 结束标记

**显示**: 红色竖线 + "END" 标签

**位置**: Timeline 顶部标尺，最后一帧的位置

**实现**:
```typescript
// Timeline.tsx - drawFrameHeader()
const endFrameX = TRACK_NAME_WIDTH + (frameCount - 1) * CELL_WIDTH + CELL_WIDTH;

// 红色粗线
ctx.strokeStyle = '#ff4d4f';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(endFrameX, 0);
ctx.lineTo(endFrameX, HEADER_HEIGHT);
ctx.stroke();

// "END" 标签
ctx.fillStyle = '#ff4d4f';
ctx.font = 'bold 10px Arial';
ctx.fillText('END', endFrameX + 2, HEADER_HEIGHT / 2);
```

## 📝 API 参考

### ProjectSlice Actions

#### createProject
```typescript
createProject(
  name: string, 
  fps: number = 30, 
  canvasWidth: number = 800, 
  canvasHeight: number = 600
)
```
创建新项目，默认 120 帧。

#### addSceneToProject
```typescript
addSceneToProject({ sceneId: string })
```
添加 Scene 到项目。如果是第一个，自动设为当前 Scene。

#### updateProjectName
```typescript
updateProjectName({ name: string })
```
更新项目名称。

#### updateProjectTotalFrames
```typescript
updateProjectTotalFrames({ totalFrames: number })
```
手动设置项目总帧数。

#### updateProjectFps
```typescript
updateProjectFps({ fps: number })
```
更新帧率（1-120）。

#### updateProjectCanvasSize
```typescript
updateProjectCanvasSize({ width: number, height: number })
```
更新画布尺寸。

### Composite Actions

#### calculateAndUpdateTotalFrames
```typescript
calculateAndUpdateTotalFrames()
```
自动计算并更新项目总帧数，基于所有 clips 和 keyframes。

## 🔧 使用示例

### 示例 1: 创建项目

```typescript
import { SDK } from '@huahuo/sdk';

// SDK 初始化时自动创建项目
SDK.initialize(canvas, store, selectEngineState);

// 项目已创建：
// - name: "My Animation Project"
// - totalFrames: 120
// - fps: 30
// - canvasWidth: 800
// - canvasHeight: 600
```

### 示例 2: 获取项目信息

```typescript
import { getEngineState } from '@huahuo/engine';

const state = getEngineState();
const project = state.project.current;

console.log(`Project: ${project.name}`);
console.log(`Duration: ${project.totalFrames} frames (${(project.totalFrames / project.fps).toFixed(2)}s)`);
console.log(`Canvas: ${project.canvasWidth}x${project.canvasHeight}`);
```

### 示例 3: 更新项目设置

```typescript
import { getEngineStore, updateProjectTotalFrames, updateProjectFps } from '@huahuo/engine';

const store = getEngineStore();

// 扩展到 300 帧
store.dispatch(updateProjectTotalFrames({ totalFrames: 300 }));

// 改为 60 FPS
store.dispatch(updateProjectFps({ fps: 60 }));
```

### 示例 4: 自动计算总帧数

```typescript
import { getEngineStore, calculateAndUpdateTotalFrames } from '@huahuo/engine';

const store = getEngineStore();

// 用户添加了新的 clip 或 keyframe 后
// 自动计算并更新项目总帧数
store.dispatch(calculateAndUpdateTotalFrames());

// 项目会自动延长到包含所有内容 + 10 帧buffer
```

### 示例 5: React 组件中使用

```tsx
import { useSelector } from 'react-redux';
import type { RootState } from './store/store';

function MyComponent() {
  const project = useSelector((state: RootState) => state.engine.project.current);
  
  if (!project) {
    return <div>No project loaded</div>;
  }
  
  return (
    <div>
      <h1>{project.name}</h1>
      <p>Total Frames: {project.totalFrames}</p>
      <p>FPS: {project.fps}</p>
      <p>Duration: {(project.totalFrames / project.fps).toFixed(2)}s</p>
    </div>
  );
}
```

## 📊 数据流

### Project 创建流程

```
SDK.initialize()
    ↓
createNewProject()
    ↓
dispatch(createProject(...))
    ↓
ProjectSlice.createProject reducer
    ↓
state.engine.project.current = {
    id: 'proj-123',
    name: 'My Animation Project',
    sceneIds: [],
    currentSceneId: null,
    totalFrames: 120,
    fps: 30,
    canvasWidth: 800,
    canvasHeight: 600,
    created: 1733644800000,
    modified: 1733644800000
}
```

### Project 更新流程

```
User clicks "Project" button in MainMenu
    ↓
ProjectSettingsModal opens
    ↓
User edits totalFrames: 120 → 300
    ↓
User clicks "OK"
    ↓
dispatch(updateProjectTotalFrames({ totalFrames: 300 }))
    ↓
ProjectSlice.updateProjectTotalFrames reducer
    ↓
state.engine.project.current.totalFrames = 300
state.engine.project.current.modified = Date.now()
    ↓
Timeline re-renders with new frameCount
    ↓
AnimationPlayer uses new totalFrames for loop
```

## 🎯 移除的 Hardcode

### 之前 ❌

```typescript
// AnimationPlayer.ts
store.dispatch(setCurrentFrame(nextFrame % 120)); // hardcoded!

// TimelinePanel.tsx
<Timeline frameCount={120} fps={30} ... />  // hardcoded!

// CanvasPanel.tsx
const [frameCount, setFrameCount] = useState(120);  // hardcoded!
```

### 之后 ✅

```typescript
// AnimationPlayer.ts
const totalFrames = engineState.project.current?.totalFrames || 120;
store.dispatch(setCurrentFrame(nextFrame % totalFrames));

// TimelinePanel.tsx
const totalFrames = useSelector(
  (state: RootState) => state.engine.project.current?.totalFrames || 120
);
const fps = useSelector(
  (state: RootState) => state.engine.project.current?.fps || 30
);
<Timeline frameCount={totalFrames} fps={fps} ... />
```

## 🎨 UI 截图描述

### 主菜单栏

```
[Save] [Open] [Preview] | [Project] | [Undo] [Redo]    [Play/Pause]    [Language]
                          ↑
                    新增按钮
```

### Project Settings 对话框

```
┌─────────────────────────────────────┐
│ Project Settings                 ×  │
├─────────────────────────────────────┤
│ Project Name:                       │
│ [My Animation Project            ]  │
│                                     │
│ Total Frames: (Duration: 4000ms)    │
│ [120                             ]  │
│                                     │
│ FPS (Frames Per Second):            │
│ [30                              ]  │
│                                     │
│ Canvas Size:                        │
│ W [800        ] H [600          ]   │
│                                     │
│ Created: 2025/12/8 10:00:00         │
│ Modified: 2025/12/8 10:05:30        │
│                                     │
│              [Cancel]  [OK]         │
└─────────────────────────────────────┘
```

### Timeline 结束标记

```
Frame Header:
┌─────────────────────────────────────────────────────────┐
│ 1    5    10   15   20   25   30  ...  115  120│END    │
│                                                 ↑        │
│                                           红色粗线+标签   │
└─────────────────────────────────────────────────────────┘
```

## ⚡ 性能考虑

### 自动计算总帧数的时机

建议在以下情况调用 `calculateAndUpdateTotalFrames()`:
- 添加新的 Clip
- 添加新的 KeyFrame
- 删除最后的 Clip/KeyFrame
- 用户明确请求

**不推荐**: 每帧都调用（性能开销）

### 优化建议

```typescript
// 使用 debounce 避免频繁计算
import { debounce } from 'lodash';

const debouncedCalculate = debounce(() => {
  store.dispatch(calculateAndUpdateTotalFrames());
}, 500);

// 在 Clip/KeyFrame 添加后调用
debouncedCalculate();
```

## 🎉 总结

现在 HuaHuo 有了完整的 Project 管理系统：

✅ **统一的项目配置** - 所有项目级别的设置集中管理
✅ **动态帧数** - 不再 hardcode 120 帧
✅ **自动计算** - 项目自动适应内容长度
✅ **用户友好** - 简单的 UI 编辑项目设置
✅ **可视化** - Timeline 上清楚标记项目结束

项目管理系统完成！🚀

