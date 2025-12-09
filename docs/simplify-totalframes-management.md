# 简化 Project TotalFrames 管理

## 🎯 修改内容

### 问题
之前的设计过于复杂：
- ❌ 自动计算 totalFrames（从所有 clips 和 keyframes）
- ❌ CanvasPanel 从 Scene 的 `duration × fps` 计算帧数
- ❌ Timeline 使用局部计算的 frameCount

### 解决方案
简化为统一的数据源：
- ✅ Project 有固定的 `totalFrames`
- ✅ 默认值：`fps × duration`（例如 30fps × 4s = 120帧）
- ✅ 用户可以手动修改（通过 Project Settings）
- ✅ 所有组件从 Project 获取 totalFrames

## 📝 具体修改

### 1. 移除自动计算逻辑

#### actions.ts
```typescript
// ❌ 删除
export const calculateAndUpdateTotalFrames = () => {
    // ... 遍历所有 clips、keyframes 自动计算
};

// ✅ 保留手动更新
export const updateComponentPropsWithKeyFrame = (payload) => {
    // 只更新 component props 和 keyframes
    // 不再自动计算 totalFrames
};
```

#### ProjectSlice.ts
```typescript
// ❌ 删除
autoCalculateTotalFrames(state) {
    // ...
}

// ✅ 保留
updateProjectTotalFrames(state, action: PayloadAction<{ totalFrames: number }>) {
    // 用户手动更新
}
```

### 2. 统一数据源

#### CanvasPanel.tsx

**之前 ❌**:
```typescript
// 从 Scene 计算
const [frameCount, setFrameCount] = useState(120);
const [fps, setFps] = useState(30);

const updateTimelineData = () => {
    const scene = SDK.instance.Scene.getCurrentScene();
    const totalFrames = Math.ceil(scene.duration * scene.fps);
    setFrameCount(totalFrames);
    setFps(scene.fps);
};

<Timeline frameCount={frameCount} fps={fps} ... />
```

**之后 ✅**:
```typescript
// 从 Project 获取（Redux）
const totalFrames = useSelector(
    (state: RootState) => state.engine.project.current?.totalFrames || 120
);
const fps = useSelector(
    (state: RootState) => state.engine.project.current?.fps || 30
);

<Timeline frameCount={totalFrames} fps={fps} ... />
```

## 🔄 数据流

### 现在的流程

```
Project 创建
    ↓
totalFrames = fps × duration (默认 30 × 4 = 120帧)
    ↓
用户通过 Project Settings 修改 totalFrames
    ↓
dispatch(updateProjectTotalFrames({ totalFrames: 300 }))
    ↓
project.current.totalFrames = 300
    ↓
CanvasPanel: useSelector 自动获取新值
    ↓
TimelinePanel: useSelector 自动获取新值
    ↓
Timeline 组件重新渲染，显示 300 帧
    ↓
AnimationPlayer: 播放循环使用 totalFrames
```

## 🎨 用户体验

### 默认行为
```typescript
// 创建项目时
createProject('My Animation', 30, 800, 600)
// → totalFrames = 120 (默认 4 秒 × 30fps)
```

### 手动修改
```
用户点击 "Project" 按钮
    ↓
打开 Project Settings 对话框
    ↓
修改 Total Frames: 120 → 300
    ↓
点击 OK
    ↓
Timeline 自动显示 300 帧
    ↓
结束标记移动到第 300 帧
```

### 未来：右键菜单修改（TODO）
```
用户在 Timeline 的某个 Cell 上右键
    ↓
弹出菜单: "Set as Project End"
    ↓
dispatch(updateProjectTotalFrames({ totalFrames: clickedFrame }))
    ↓
项目结束位置更新
```

## 📊 对比

### 之前 ❌

```
数据源混乱：
├─ Scene.duration × Scene.fps → CanvasPanel frameCount
├─ Project.totalFrames → AnimationPlayer loop
└─ 自动计算最大帧 → auto update totalFrames

问题：
- 三个地方管理帧数
- 不知道哪个是权威数据源
- 自动计算可能不符合用户预期
```

### 之后 ✅

```
单一数据源：
Project.totalFrames
    ├─> CanvasPanel (useSelector)
    ├─> TimelinePanel (useSelector)
    ├─> AnimationPlayer (getEngineState)
    └─> Timeline 结束标记

优势：
- 一个地方管理
- 清晰的数据流
- 用户完全控制
```

## 🎯 API 使用

### 获取项目总帧数

```typescript
// React 组件中
const totalFrames = useSelector(
    (state: RootState) => state.engine.project.current?.totalFrames || 120
);

// 非 React 代码中
const engineState = getEngineState();
const totalFrames = engineState.project.current?.totalFrames || 120;
```

### 修改项目总帧数

```typescript
import { getEngineStore, updateProjectTotalFrames } from '@huahuo/engine';

const store = getEngineStore();
store.dispatch(updateProjectTotalFrames({ totalFrames: 300 }));
```

### 创建项目时设置

```typescript
import { createProject } from '@huahuo/engine';

// fps = 30, 默认 duration = 4s
// totalFrames = 120
store.dispatch(createProject('My Project', 30, 800, 600));

// 如果需要不同的 duration，创建后手动修改
store.dispatch(updateProjectTotalFrames({ totalFrames: 600 })); // 20秒
```

## 💡 设计原则

### 1. 单一数据源 (Single Source of Truth)
- 项目总帧数只存在于一个地方：`project.current.totalFrames`

### 2. 用户控制 (User Control)
- 不自动修改用户设置
- 用户通过 UI 明确修改

### 3. 简单清晰 (Simplicity)
- 移除复杂的自动计算逻辑
- 数据流简单直观

## 🔧 未来扩展

### 右键菜单：设置项目结束帧

```typescript
// Timeline 组件
const handleCellRightClick = (trackId: string, frame: number, event: React.MouseEvent) => {
    event.preventDefault();
    
    // 显示上下文菜单
    showContextMenu([
        {
            label: 'Set as Project End',
            onClick: () => {
                store.dispatch(updateProjectTotalFrames({ totalFrames: frame }));
            }
        }
    ]);
};
```

### 智能建议

```typescript
// 在 Project Settings 对话框中
function suggestTotalFrames() {
    const state = getEngineState();
    
    // 找到最后的 content
    let maxFrame = 0;
    // ... 检查 clips 和 keyframes
    
    return maxFrame + 30; // 加 1 秒 buffer
}

// UI: "建议: 180 帧（基于当前内容）"
```

## 🎉 总结

现在的设计更加简单清晰：

✅ **统一的数据源** - Project.totalFrames
✅ **用户控制** - 不自动修改
✅ **简单的逻辑** - 移除复杂的自动计算
✅ **清晰的数据流** - 所有组件从 Project 读取

用户现在可以：
1. 通过 Project Settings 设置项目总帧数
2. Timeline 显示正确的帧范围
3. 看到清晰的结束标记
4. （未来）右键设置结束帧

完成！🚀

