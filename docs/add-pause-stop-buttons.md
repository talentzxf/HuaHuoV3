# 添加 Pause 和 Stop 按钮

## 🎯 功能说明

播放动画时，顶部菜单栏显示两个按钮：
- **Pause（暂停）**：停留在当前帧
- **Stop（停止）**：停止播放并回到第一帧

## 📐 按钮布局

### 未播放时
```
┌─────────────────────────┐
│   [▶ Play]              │
└─────────────────────────┘
```

### 播放中
```
┌─────────────────────────┐
│   [⏸ Pause]  [⏹ Stop]  │
└─────────────────────────┘
```

## 🔧 实现细节

### 1. Engine Actions

**stopAnimation** - 新增的 composite action：
```typescript
// actions.ts
export const stopAnimation = () => {
    return (dispatch: any) => {
        console.log('[stopAnimation] Stopping and resetting to frame 0');
        dispatch(stopAction());  // PlaybackSlice.stop
    };
};
```

**PlaybackSlice.stop**（已存在）：
```typescript
stop(state) {
    state.isPlaying = false;  // 停止播放
    state.currentFrame = 0;   // 重置到第一帧
}
```

### 2. MainMenu 更新

**图标使用**：
- Pause 按钮：`<PauseOutlined />`（暂停符号）
- Stop 按钮：`<BorderOutlined />`（正方形，播放器标准停止图标）

**新增 props**：
```typescript
interface MainMenuProps {
  // ...existing props...
  onPause?: () => void;
  onStop?: () => void;   // ← 新增
  isPlaying?: boolean;
}
```

**播放中的按钮**：
```tsx
{isPlaying && (
  <Space size="small">
    <Button
      type="default"
      icon={<PauseOutlined />}
      onClick={onPause}
      title="暂停（停留在当前帧）"
    >
      暂停
    </Button>
    <Button
      type="default"
      danger
      icon={<BorderOutlined />}  {/* 使用正方形图标 */}
      onClick={onStop}
      title="停止（回到第一帧）"
    >
      停止
    </Button>
  </Space>
)}
```

### 3. App.tsx 处理

**handleStop**：
```typescript
const handleStop = () => {
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(stopAnimation());
    message.info(t('messages.stopped'));
};
```

**传递给 MainMenu**：
```tsx
<MainMenu
  onPlay={handlePlay}
  onPause={handlePause}
  onStop={handleStop}   // ← 新增
  isPlaying={isPlaying}
/>
```

## 🔄 行为对比

### Pause（暂停）

```
播放中: Frame 0 → 1 → 2 → 3 → 4 → 5 → ...
                              ↑
                         点击 Pause
                              ↓
暂停在: Frame 5
再次 Play: Frame 5 → 6 → 7 → ...
```

**Redux State**:
```javascript
// 点击 Pause 前
{
  playback: {
    isPlaying: true,
    currentFrame: 5,  // 当前帧
    fps: 30
  }
}

// 点击 Pause 后
{
  playback: {
    isPlaying: false,  // ← 变为 false
    currentFrame: 5,   // ← 保持不变
    fps: 30
  }
}
```

### Stop（停止）

```
播放中: Frame 0 → 1 → 2 → 3 → 4 → 5 → ...
                              ↑
                          点击 Stop
                              ↓
停止并重置: Frame 0
再次 Play: Frame 0 → 1 → 2 → ...
```

**Redux State**:
```javascript
// 点击 Stop 前
{
  playback: {
    isPlaying: true,
    currentFrame: 5,  // 当前帧
    fps: 30
  }
}

// 点击 Stop 后
{
  playback: {
    isPlaying: false,  // ← 变为 false
    currentFrame: 0,   // ← 重置为 0
    fps: 30
  }
}
```

## 🎨 UI 设计

### 按钮样式

**Pause 按钮**：
- 类型: `default`
- 图标: `<PauseOutlined />`（两条竖线，标准暂停符号）
- 提示: "暂停（停留在当前帧）"

**Stop 按钮**：
- 类型: `default`
- 颜色: `danger` (红色)
- 图标: `<BorderOutlined />`（正方形，播放器标准停止符号）
- 提示: "停止（回到第一帧）"

### 按钮间距

使用 `<Space size="small">` 包裹两个按钮，保持合适的间距。

## 🔄 其他优化

### Merge Clip 后自动刷新 Canvas

在 `handleMergeCells` 和 `handleSplitClip` 后添加 `updateTimelineData()` 调用：

```typescript
const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
    const layerId = trackId;
    const length = endFrame - startFrame + 1;
    const engineStore = getEngineStore();
    
    engineStore.dispatch(addTimelineClip(layerId, startFrame, length));
    
    // 刷新 Timeline 数据以更新 Canvas
    updateTimelineData();
};

const handleSplitClip = (trackId: string, clipId: string, splitFrame: number) => {
    const layerId = trackId;
    const engineStore = getEngineStore();
    
    engineStore.dispatch(splitTimelineClip(layerId, clipId, splitFrame));
    
    // 刷新 Timeline 数据以更新 Canvas
    updateTimelineData();
};
```

**效果**：
- ✅ Merge clip 后，Timeline 立即显示新的 clip
- ✅ Split clip 后，Timeline 立即显示分割后的 clips
- ✅ Canvas 显示与 Redux state 保持同步

## 🌐 多语言支持

### 英文 (en.json)
```json
{
  "mainMenu": {
    "pause": "Pause",
    "stop": "Stop"
  },
  "messages": {
    "paused": "Paused",
    "stopped": "Stopped"
  },
  "tooltips": {
    "pause": "Pause (stay at current frame)",
    "stop": "Stop (return to first frame)"
  }
}
```

### 中文 (zh.json)
```json
{
  "mainMenu": {
    "pause": "暂停",
    "stop": "停止"
  },
  "messages": {
    "paused": "已暂停",
    "stopped": "已停止"
  },
  "tooltips": {
    "pause": "暂停（停留在当前帧）",
    "stop": "停止（回到第一帧）"
  }
}
```

## 🎯 使用场景

### 场景 1: 检查某一帧

```
用户想查看 Frame 20 的细节
    ↓
播放到 Frame 20
    ↓
点击 Pause（停留在 Frame 20）
    ↓
检查和编辑
    ↓
点击 Play 继续从 Frame 20 播放
```

### 场景 2: 重新开始

```
动画播放到 Frame 50
    ↓
用户想从头开始看
    ↓
点击 Stop（回到 Frame 0）
    ↓
点击 Play 从头开始播放
```

### 场景 3: 调试动画

```
测试动画效果
    ↓
播放 → Pause 检查 → Play 继续
    ↓
发现问题
    ↓
Stop 回到开头
    ↓
修改后重新测试
```

## 🎉 总结

现在播放控制更加完善：

✅ **Play** - 开始播放
✅ **Pause** - 暂停在当前帧（保留进度）
✅ **Stop** - 停止并回到第一帧（重置进度）

三个按钮覆盖了所有播放控制场景！🚀

