# 分离动画结束标记和项目总帧数

## 🎯 问题

用户提出：右键设置的应该只是一个**标记**，不应该真的删除后面的帧。

## 💡 解决方案

分离两个概念：

### 1. Project.totalFrames（项目总帧数）
- **作用**: Timeline 的画布大小
- **设置**: Project Settings 对话框
- **标记**: 灰色细线 + "PROJECT END"
- **效果**: 定义可以显示和编辑的帧范围

### 2. Project.animationEndFrame（动画结束标记）
- **作用**: 标记动画实际结束的位置
- **设置**: 右键点击 Cell → "Set Animation End"
- **标记**: 红色粗线 + "ANIM END"
- **效果**: 只是一个视觉标记，不删除后面的帧

## 📊 数据结构变化

### ProjectSlice

```typescript
export interface ProjectSlice {
    id: string;
    name: string;
    totalFrames: number;              // 项目总帧数（画布大小）
    animationEndFrame: number | null; // 动画结束标记（可以是 null）
    fps: number;
    // ...
}
```

### 初始状态

```typescript
// 创建项目时
state.current = {
    id: 'proj-123',
    name: 'My Animation Project',
    totalFrames: 120,           // Timeline 显示 0-119 帧
    animationEndFrame: null,    // 默认没有动画结束标记
    fps: 30,
    // ...
};
```

## 🎨 视觉效果

### Timeline 显示

```
Timeline (0-119 frames, totalFrames = 120)
┌─────────────────────────────────────────────────┐
│ 0    10   20   30   40   50   60  ...  110  119│PROJECT END│
│                          ↑                       │           │
│                     ANIM END                     │           │
│                     (Frame 50)                   │           │
├─────────────────────────────────────────────────┤
│ Layer 1  │░░░░░░░░░░░░░│                        │
│ Layer 2  │     │░░░░░░░░│                       │
└─────────────────────────────────────────────────┘

标记说明：
- 灰色细线 "PROJECT END" at Frame 119 - 项目总帧数
- 红色粗线 "ANIM END" at Frame 50 - 动画结束标记
- Frame 51-119 仍然可见和可编辑
```

### 代码实现

```typescript
// Timeline 组件绘制
const drawFrameHeader = (ctx, totalWidth) => {
  // ...draw frames 0 to frameCount-1...

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
  if (animationEndFrame !== null && animationEndFrame >= 0 && animationEndFrame < frameCount) {
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

## 🔄 用户操作流程

### 设置动画结束标记

```
1. 用户在 Frame 50 上右键点击
    ↓
2. 选择 "Set Animation End (Frame 50)"
    ↓
3. dispatch(setAnimationEndFrame({ frame: 50 }))
    ↓
4. project.animationEndFrame = 50
    ↓
5. Timeline 重新渲染
    ├─ Frame 50 显示红色 "ANIM END" 标记
    ├─ Frame 51-119 仍然可见
    └─ Frame 119 显示灰色 "PROJECT END" 标记
```

### 修改项目总帧数

```
1. 用户打开 Project Settings
    ↓
2. 修改 Total Frames: 120 → 200
    ↓
3. dispatch(updateProjectTotalFrames({ totalFrames: 200 }))
    ↓
4. project.totalFrames = 200
    ↓
5. Timeline 重新渲染
    ├─ 现在显示 0-199 帧
    ├─ 动画结束标记仍在 Frame 50（如果之前设置了）
    └─ 项目结束标记移到 Frame 199
```

## 📝 API 变化

### 新增 Action

```typescript
// ProjectSlice.ts
setAnimationEndFrame(
    state,
    action: PayloadAction<{ frame: number | null }>
) {
    if (state.current) {
        state.current.animationEndFrame = action.payload.frame;
        state.current.modified = Date.now();
    }
}

// 使用
import { setAnimationEndFrame } from '@huahuo/engine';

// 设置动画结束标记
store.dispatch(setAnimationEndFrame({ frame: 50 }));

// 清除动画结束标记
store.dispatch(setAnimationEndFrame({ frame: null }));
```

### Timeline Props 变化

```typescript
// Timeline.tsx
export interface TimelineProps {
  frameCount: number;                   // 项目总帧数
  animationEndFrame?: number | null;    // 动画结束标记（新增）
  // ...
}

// 使用
<Timeline
  frameCount={totalFrames}
  animationEndFrame={animationEndFrame}  // ← 新增
  // ...
/>
```

### 获取数据

```typescript
// CanvasPanel / TimelinePanel
const totalFrames = useSelector(
  (state: RootState) => state.engine.project.current?.totalFrames || 120
);

const animationEndFrame = useSelector(
  (state: RootState) => state.engine.project.current?.animationEndFrame ?? null
);
```

## 🎯 使用场景

### 场景 1: 标记动画实际结束位置

```
用户制作一个 120 帧的项目
    ↓
动画内容到第 80 帧完成
    ↓
在 Frame 80 右键 → "Set Animation End"
    ↓
红色标记出现在 Frame 80
    ↓
Frame 81-119 仍然存在，可以：
- 添加额外的结尾内容
- 作为 buffer
- 稍后继续制作
```

### 场景 2: 临时标记，方便调整

```
初始标记: Frame 60
    ↓
制作中发现需要延长
    ↓
在 Frame 90 右键 → "Set Animation End"
    ↓
标记移动到 Frame 90
    ↓
Frame 60-89 的内容保留
没有任何内容被删除
```

### 场景 3: 导出时使用（未来功能）

```
项目: 200 帧
动画结束标记: Frame 150
    ↓
导出对话框:
  ○ 导出全部 (Frame 0-199)
  ● 导出到动画结束标记 (Frame 0-150) ← 默认选项
    ↓
灵活控制导出范围
```

### 场景 4: 标记多个版本

```
项目: 300 帧

制作过程：
1. 短版本结束于 Frame 120
   → 设置标记，导出
   
2. 继续制作到 Frame 200
   → 移动标记到 Frame 200，导出中等版本
   
3. 最终版本到 Frame 300
   → 移动标记到 Frame 300，导出完整版本

所有内容始终保留在项目中
```

## 💡 设计优势

### 1. 非破坏性

- ✅ 设置标记不会删除任何内容
- ✅ 所有帧始终可访问和编辑
- ✅ 可以随时移动或移除标记

### 2. 灵活性

```typescript
// 可以自由调整标记位置
dispatch(setAnimationEndFrame({ frame: 50 }));  // 设置
dispatch(setAnimationEndFrame({ frame: 80 }));  // 移动
dispatch(setAnimationEndFrame({ frame: null })); // 移除
```

### 3. 清晰的视觉反馈

```
两种颜色、两种样式：
- 灰色细线 = 项目边界
- 红色粗线 = 动画标记

用户一眼就能区分
```

### 4. 未来扩展

```
可以轻松添加：
- 多个标记点（"Version A End", "Version B End"）
- 标记名称自定义
- 标记颜色自定义
- 导出时选择标记
```

## 🎉 总结

现在系统有两个独立的概念：

### Project.totalFrames
- **定义**: Timeline 画布大小
- **修改**: Project Settings
- **效果**: 定义可编辑的帧范围
- **标记**: 灰色 "PROJECT END"

### Project.animationEndFrame
- **定义**: 动画实际结束位置
- **修改**: 右键菜单快速设置
- **效果**: 视觉标记，不删除内容
- **标记**: 红色 "ANIM END"

### 优势
- ✅ 非破坏性工作流
- ✅ 灵活的标记管理
- ✅ 清晰的视觉区分
- ✅ 为导出功能打下基础

完美实现！🚀

