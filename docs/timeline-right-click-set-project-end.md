# Timeline Cell 右键菜单 - 设置动画结束标记

## 🎯 功能说明

在 Timeline 的任意 Cell 上右键点击，可以快速设置该帧为**动画结束标记**。

## 📐 两个概念

### 1. Project Total Frames（项目总帧数）
- **含义**: Timeline 的画布大小，可以显示多少帧
- **设置方式**: Project Settings 对话框
- **标记**: 灰色细线 + "PROJECT END" 标签
- **作用**: 定义项目的时间范围

### 2. Animation End Frame（动画结束帧）
- **含义**: 动画实际结束的位置（只是一个标记）
- **设置方式**: 右键点击 Cell → "Set Animation End"
- **标记**: 红色粗线 + "ANIM END" 标签
- **作用**: 标记动画内容结束的地方

### 区别

```
Timeline (0-119 frames)
┌──────────────────────────────────────────────┐
│ 0   10   20   30   40   50  ...  110  119│PROJECT END│  ← 项目总帧数
│                              ↑                │           │
│                         ANIM END             │           │  ← 动画结束标记（可选）
│                         (Frame 50)            │           │
├──────────────────────────────────────────────┤
│ Layer 1  │░░░░░░░░░░░░░│                    │
│ Layer 2  │     │░░░░░░│                      │
└──────────────────────────────────────────────┘

说明：
- PROJECT END (Frame 119): 项目有 120 帧，Timeline 显示 0-119
- ANIM END (Frame 50): 动画内容到第 50 帧结束，但不删除后面的帧
- Frame 51-119: 仍然存在，可以继续添加内容
```

## 🔧 数据结构

### ProjectSlice

```typescript
export interface ProjectSlice {
    id: string;
    name: string;
    totalFrames: number;           // 项目总帧数（Timeline 画布大小）
    animationEndFrame: number | null;  // 动画结束帧（标记，可以是 null）
    fps: number;
    // ...
}
```

### 示例

```typescript
// 项目有 120 帧
project.totalFrames = 120;

// 用户在 Frame 50 右键设置动画结束
project.animationEndFrame = 50;

// Timeline 显示：
// - 0-119 所有帧都可见和可编辑
// - Frame 50 有红色的 "ANIM END" 标记
// - Frame 119 有灰色的 "PROJECT END" 标记
```

## 🔧 实现细节

### 1. Timeline 组件（独立）

#### 添加 animationEndFrame prop

```typescript
export interface TimelineProps {
  frameCount: number;  // 项目总帧数
  animationEndFrame?: number | null;  // 动画结束帧（可选标记）
  // ...existing props...
  onCellRightClick?: (trackId: string, frameNumber: number, x: number, y: number) => void;
}
```

#### 绘制两个标记

```typescript
const drawFrameHeader = (ctx: CanvasRenderingContext2D, totalWidth: number) => {
  // ...draw frames...

  // 1. 项目结束标记（灰色，细线）
  const projectEndX = TRACK_NAME_WIDTH + (frameCount - 1) * CELL_WIDTH + CELL_WIDTH;
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(projectEndX, 0);
  ctx.lineTo(projectEndX, HEADER_HEIGHT);
  ctx.stroke();
  
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.fillText('PROJECT', projectEndX + 2, HEADER_HEIGHT / 2 - 5);
  ctx.fillText('END', projectEndX + 2, HEADER_HEIGHT / 2 + 5);

  // 2. 动画结束标记（红色，粗线）- 如果设置了
  if (animationEndFrame !== null && animationEndFrame >= 0) {
    const animEndX = TRACK_NAME_WIDTH + animationEndFrame * CELL_WIDTH + CELL_WIDTH;
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(animEndX, 0);
    ctx.lineTo(animEndX, HEADER_HEIGHT);
    ctx.stroke();
    
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 9px Arial';
    ctx.fillText('ANIM', animEndX + 2, HEADER_HEIGHT / 2 - 5);
    ctx.fillText('END', animEndX + 2, HEADER_HEIGHT / 2 + 5);
  }
};
```

### 2. CanvasPanel / TimelinePanel（业务逻辑）

#### 添加上下文菜单状态

```typescript
const [contextMenu, setContextMenu] = useState<{
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
} | null>(null);
```

#### 右键点击处理器

```typescript
const handleCellRightClick = (trackId: string, frameNumber: number, x: number, y: number) => {
  console.log('Cell right-clicked:', { trackId, frameNumber, x, y });
  
  // 显示上下文菜单
  setContextMenu({
    visible: true,
    x,  // 屏幕绝对坐标
    y,  // 屏幕绝对坐标
    frameNumber
  });
};
```

#### 设置动画结束标记

```typescript
const handleSetAnimationEnd = () => {
  if (!contextMenu) return;

  const engineStore = getEngineStore();
  
  // 设置动画结束标记（不修改 totalFrames）
  engineStore.dispatch(setAnimationEndFrame({ frame: contextMenu.frameNumber }));
  console.log(`Set animation end to frame ${contextMenu.frameNumber}`);
  
  setContextMenu(null); // 关闭菜单
};
```

#### 菜单项配置

```typescript
const contextMenuItems: MenuProps['items'] = [
  {
    key: 'set-animation-end',
    label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
    onClick: handleSetAnimationEnd,
  },
];
```

#### 渲染上下文菜单

```typescript
{/* Context menu for Timeline */}
{contextMenu && (
  <Dropdown
    menu={{ items: contextMenuItems }}
    open={contextMenu.visible}
    onOpenChange={(visible) => {
      if (!visible) setContextMenu(null);
    }}
  >
    <div
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
        width: 1,
        height: 1,
        pointerEvents: 'none',
      }}
    />
  </Dropdown>
)}
```

#### 传递回调给 Timeline

```tsx
<Timeline
  frameCount={totalFrames}
  fps={fps}
  currentFrame={currentFrame}
  tracks={tracks}
  onCellClick={handleCellClick}
  onCurrentFrameChange={handleCurrentFrameChange}
  onMergeCells={handleMergeCells}
  onSplitClip={handleSplitClip}
  onCellRightClick={handleCellRightClick}  // ← 新增
/>
```

## 🔄 完整流程

```
1. 用户在 Timeline 的 Cell 上右键点击
    ↓
2. Timeline.handleContextMenu 被触发
    ↓
3. Timeline 获取被点击的 Cell 位置
    ├─ trackId: 哪个轨道
    ├─ frameNumber: 哪一帧
    ├─ x, y: 屏幕绝对坐标
    ↓
4. Timeline 调用 onCellRightClick(trackId, frameNumber, x, y)
    ↓
5. CanvasPanel/TimelinePanel.handleCellRightClick 被调用
    ↓
6. 设置 contextMenu state
    ├─ visible: true
    ├─ x, y: 用于定位菜单
    └─ frameNumber: 保存帧号
    ↓
7. Dropdown 组件显示在鼠标位置
    ├─ 菜单项: "Set Project End (Frame X)"
    ↓
8. 用户点击菜单项
    ↓
9. handleSetProjectEnd 被调用
    ↓
10. dispatch(updateProjectTotalFrames({ totalFrames: frameNumber + 1 }))
    ↓
11. ProjectSlice 更新 totalFrames
    ↓
12. Timeline 重新渲染，显示新的结束标记
    ↓
13. 关闭上下文菜单
```

## 🎨 UI 效果

### 右键点击 Cell

```
Timeline (Frame 0-119)
┌─────────────────────────────────────┐
│ 0  5  10  15  20  25  30  35  40    │
├─────────────────────────────────────┤
│ Layer 1  │░░░░░░░░░│     │     │    │
│ Layer 2  │     │░░░░[右键]░░░│     │
└─────────────────────────────────────┘
                    ↓
            弹出上下文菜单
         ┌─────────────────────┐
         │ Set Project End     │
         │ (Frame 25)          │
         └─────────────────────┘
```

### 点击后效果

```
Timeline (Frame 0-25) ← 更新了！
┌────────────────────────┐
│ 0  5  10  15  20  25│END│ ← 结束标记移动
├────────────────────────┤
│ Layer 1  │░░░░░░░░│    │
│ Layer 2  │     │░░░░░│ │
└────────────────────────┘
```

## 💡 设计优势

### 1. 组件解耦

**Timeline 组件**:
- 不知道"设置项目结束"这个业务逻辑
- 只负责通知 caller 发生了右键点击
- 可以被任何应用复用

**CanvasPanel/TimelinePanel**:
- 决定右键菜单的内容
- 处理业务逻辑（更新 Project）
- 可以自定义不同的菜单项

### 2. 灵活扩展

可以轻松添加更多菜单项：

```typescript
const contextMenuItems: MenuProps['items'] = [
  {
    key: 'set-project-end',
    label: `Set Project End (Frame ${contextMenu?.frameNumber ?? 0})`,
    onClick: handleSetProjectEnd,
  },
  {
    type: 'divider',
  },
  {
    key: 'add-keyframe',
    label: 'Add Keyframe',
    onClick: handleAddKeyframe,
  },
  {
    key: 'delete-frame',
    label: 'Delete Frame',
    onClick: handleDeleteFrame,
    danger: true,
  },
];
```

### 3. 职责清晰

```
Timeline: 负责 UI 渲染和用户交互
    ↓ 通过回调通知
Caller: 负责业务逻辑和状态管理
```

## 🔧 技术细节

### Dropdown 定位

使用 `fixed` 定位 + 1x1 像素的 anchor 元素：

```tsx
<Dropdown menu={{ items }} open={true}>
  <div
    style={{
      position: 'fixed',
      left: contextMenu.x,  // 鼠标点击的屏幕绝对坐标
      top: contextMenu.y,   // 鼠标点击的屏幕绝对坐标
      width: 1,
      height: 1,
      pointerEvents: 'none',
    }}
  />
</Dropdown>
```

**为什么这样做？**
- Ant Design 的 Dropdown 需要一个 anchor 元素
- 使用 1x1 像素的不可见元素作为 anchor
- 使用 `fixed` 定位精确放在鼠标点击位置

### Frame Number vs Total Frames

```typescript
// frameNumber 是 0-indexed (0, 1, 2, ..., 119)
// totalFrames 是 count (1, 2, 3, ..., 120)

// 右键点击 frame 25 (第26帧)
const frameNumber = 25;  // 0-indexed
const totalFrames = frameNumber + 1;  // = 26 frames total

// 设置项目结束
dispatch(updateProjectTotalFrames({ totalFrames: 26 }));

// 项目现在有 26 帧: frame 0-25
```

## 🎯 使用示例

### 场景 1: 标记动画结束位置

```
用户有一个 120 帧的项目
    ↓
动画实际只到第 60 帧
    ↓
在 frame 60 上右键
    ↓
选择 "Set Animation End (Frame 60)"
    ↓
红色的 "ANIM END" 标记出现在 Frame 60
    ↓
Frame 61-119 仍然存在，可以继续编辑
```

### 场景 2: 临时标记，稍后调整

```
当前项目: 120 帧
    ↓
用户在 Frame 80 设置动画结束标记
    ↓
继续制作，发现需要延长
    ↓
在 Frame 100 重新设置动画结束标记
    ↓
标记自动移动到 Frame 100
```

### 场景 3: 导出时使用标记

```
项目: 200 帧
动画结束标记: Frame 150
    ↓
导出动画时：
- 可以选择导出全部 200 帧
- 或只导出到动画结束标记 (Frame 150)
    ↓
灵活控制导出范围
```

## 🎉 总结

现在用户可以：

✅ **在 Timeline 的任意 Cell 上右键**
✅ **设置动画结束标记（不删除后面的帧）**
✅ **看到两个标记**：
  - 灰色 "PROJECT END" - 项目总帧数
  - 红色 "ANIM END" - 动画实际结束位置
✅ **灵活管理动画内容**

设计优势：
- 不破坏项目内容（后面的帧保留）
- 可以随时调整标记位置
- 为将来的导出功能提供参考

实现完成！🚀

