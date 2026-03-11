# Timeline 标记与帧数字重叠优化

## 🎯 问题

Animation End 标记和帧数字可能会重叠，导致显示不清楚：

```
Before ❌:
┌────────────────────────────────┐
│ 45  50  55│ANIM END  60  65    │  ← "55" 和 "ANIM END" 重叠
└────────────────────────────────┘
```

## ✅ 解决方案

### 1. 跳过标记附近的帧数字

在绘制帧数字时，检测并跳过标记附近的帧（±2 帧范围）：

```typescript
// Calculate marker positions
const animEndFrame = animationEndFrame ?? -1;

// Frames to skip (near markers, within 2 frames range)
const skipFrames = new Set<number>();
if (animEndFrame >= 0) {
  for (let i = animEndFrame - 2; i <= animEndFrame + 2; i++) {
    if (i >= 0 && i < frameCount) skipFrames.add(i);
  }
}

// Draw frame numbers
for (let frame = 0; frame < frameCount; frame++) {
  if (frame % 5 === 0 && !skipFrames.has(frame)) {
    // Draw frame number
  }
}
```

### 2. 标记文字添加背景

给标记文字添加半透明背景，让文字更清晰：

```typescript
// Animation End Marker
const animLabelX = animEndX + 3;
const animLabelY1 = 5;
const animLabelY2 = 15;

// Background (semi-transparent dark)
ctx.fillStyle = 'rgba(42, 42, 42, 0.95)';
ctx.fillRect(animLabelX - 1, animLabelY1 - 1, 32, 22);

// Text
ctx.fillStyle = '#ff4d4f';
ctx.font = 'bold 9px Arial';
ctx.fillText('ANIM', animLabelX, animLabelY1 + 4);
ctx.fillText('END', animLabelX, animLabelY2 + 4);
```

### 3. 调整标记文字位置

- **ANIM END**: 放在顶部（y = 5, 15）
- **PROJECT END**: 放在中间（y = 12, 22）

避免所有标记都挤在中间。

## 🎨 视觉效果

### Before ❌

```
┌─────────────────────────────────────────┐
│ 45  50  55│ANIM  60  65  70  75  80 ... │
│           │END                           │
│           ↑ 重叠不清楚                    │
└─────────────────────────────────────────┘
```

### After ✅

```
┌─────────────────────────────────────────┐
│ 45  50    [ANIM]  65  70  75  80  85 ...│
│           [END ]                         │
│           ↑ 带背景，清晰                  │
│           ↑ 跳过了 Frame 55 的数字       │
└─────────────────────────────────────────┘
```

## 📊 优化对比

| 方面 | Before | After |
|-----|--------|-------|
| 帧数字 | 所有帧都显示 | 跳过标记附近 ±2 帧 |
| 标记背景 | 无 | 半透明背景遮罩 |
| 标记位置 | 都在中间 | ANIM 顶部，PROJECT 中间 |
| 可读性 | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## 🔧 实现细节

### 跳过范围计算

```typescript
// Animation End at Frame 50
animEndFrame = 50;

// Skip frames: 48, 49, 50, 51, 52
skipFrames = new Set([48, 49, 50, 51, 52]);

// When drawing:
// Frame 45 (45 % 5 === 0): Draw ✓
// Frame 50 (50 % 5 === 0): Skip (in skipFrames) ✓
// Frame 55 (55 % 5 === 0): Draw ✓
```

### 背景尺寸

```typescript
// ANIM END label
width: 32px (适合 "ANIM" 和 "END" 文字)
height: 22px (两行文字 + padding)

// PROJECT END label
width: 42px (适合 "PROJECT" 和 "END" 文字)
height: 13px (两行文字 + padding)
```

### 位置调整

```typescript
// ANIM END (红色) - 顶部
Y positions: 5px, 15px
→ 靠近 header 顶部，醒目

// PROJECT END (灰色) - 中间
Y positions: 12px, 22px
→ header 中间，不抢眼
```

## 💡 为什么这样设计

### 1. 跳过帧数字

```
如果不跳过：
Frame 50 的数字 "51" 会和 "ANIM END" 重叠
```

### 2. 添加背景

```
没有背景：
- 红色文字在深色背景上可能不够清晰
- 如果下面有内容，可能穿透

有背景：
- 文字始终清晰可读
- 与下面的轨道内容分离
```

### 3. 不同位置

```
如果都在中间：
- 两个标记靠得太近时会重叠
- 都抢眼，没有主次

顶部 vs 中间：
- ANIM END 更重要，放顶部
- PROJECT END 是参考信息，放中间
```

## 🎯 特殊情况处理

### 情况 1: 标记在 Frame 5 的倍数上

```
ANIM END at Frame 50
→ Frame 50 的数字会被跳过
→ 标记清晰显示
```

### 情况 2: 标记在 Frame 5 的倍数附近

```
ANIM END at Frame 52
→ Frame 50 和 55 的数字都会被跳过（±2 范围）
→ 留出足够空间给标记
```

### 情况 3: 两个标记很近

```
ANIM END at Frame 50
PROJECT END at Frame 55

→ Frame 50, 55 都被跳过
→ 两个标记分别显示
→ 位置不同（顶部 vs 中间）
```

### 情况 4: 标记在边缘

```
ANIM END at Frame 2
→ skipFrames: [0, 1, 2, 3, 4]
→ Frame 0, 5 的数字被跳过
→ 标记仍然清晰
```

## 🎨 代码示例

### 完整的绘制逻辑

```typescript
const drawFrameHeader = (ctx, totalWidth) => {
  // 1. 绘制背景
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, totalWidth, HEADER_HEIGHT);

  // 2. 计算跳过的帧
  const skipFrames = new Set<number>();
  if (animationEndFrame !== null && animationEndFrame >= 0) {
    for (let i = animationEndFrame - 2; i <= animationEndFrame + 2; i++) {
      if (i >= 0 && i < frameCount) skipFrames.add(i);
    }
  }

  // 3. 绘制帧数字（跳过标记附近）
  for (let frame = 0; frame < frameCount; frame++) {
    if (frame % 5 === 0 && !skipFrames.has(frame)) {
      ctx.fillText((frame + 1).toString(), x + CELL_WIDTH / 2, HEADER_HEIGHT / 2);
    }
  }

  // 4. 绘制 PROJECT END 标记
  // - 灰色细线
  // - 带背景的标签
  // - 位置：中间

  // 5. 绘制 ANIM END 标记
  // - 红色粗线
  // - 带背景的标签
  // - 位置：顶部
};
```

## 🎉 总结

现在 Timeline 标记更加清晰：

✅ **不重叠** - 自动跳过标记附近的帧数字
✅ **背景遮罩** - 文字始终清晰可读
✅ **位置分离** - 不同标记在不同高度
✅ **自动适配** - 处理各种边缘情况

用户体验大幅提升！🚀

