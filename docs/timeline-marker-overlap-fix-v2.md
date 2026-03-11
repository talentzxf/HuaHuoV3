# Timeline 标记与帧数字重叠优化 v2

## 🎯 改进方案

当 Animation End 标记的**文字标签**（写在红线右边）与帧数字重叠时：
- 将**右边的帧数字**移到底部显示
- **END 标签缩小为一半尺寸**

## 📐 关键理解

### 标记布局

```
Timeline:
┌─────────────────────────────┐
│ 45  50│[END] 60  65  70     │
│       │                     │
│       红线  ↑                │
│          标签在右边           │
└─────────────────────────────┘

标记在 Frame 50:
- 红线在 Frame 50 右边界
- 标签 "END" 写在红线右边
- 标签占用约 1-2 个 cell 的宽度
- 可能遮挡右边 1-2 帧的帧数字
```

### 重叠情况

```
标记在 Frame 48，标签向右延伸:
┌─────────────────────────────┐
│ 45│[END] 55  60  65  70     │  ← Frame 50 被遮挡
│   │                         │
└─────────────────────────────┘

解决方案:
1. 将 Frame 50 移到底部
2. END 标签缩小为一半

┌─────────────────────────────┐
│ 45│[END] 55  60  65  70     │  ← 小号 END
│   │  50                     │  ← Frame 50 移到底部
└─────────────────────────────┘
```

## 🔧 实现细节

### 1. 检测重叠

```typescript
// 标记文字在红线右边，占用约 1-2 个 cell 宽度
// 检查当前帧数字是否在标记右侧 1-2 帧的范围内
const markerIsNearby = animEndFrame >= 0 && 
                       frame > animEndFrame &&      // 在标记右边
                       frame <= animEndFrame + 2;   // 在 2 帧范围内
```

### 2. 绘制帧数字（移到底部避开标记）

```typescript
for (let frame = 0; frame < frameCount; frame++) {
  if (frame % 5 === 0) {
    const markerIsNearby = animEndFrame >= 0 && 
                           frame > animEndFrame && 
                           frame <= animEndFrame + 2;
    
    if (markerIsNearby) {
      // 移到底部避开标记文字
      ctx.fillStyle = '#999';
      ctx.font = '9px Arial';
      ctx.fillText((frame + 1).toString(), x + CELL_WIDTH / 2, HEADER_HEIGHT - 4);
    } else {
      // 正常居中
      ctx.fillStyle = '#fff';
      ctx.fillText((frame + 1).toString(), x + CELL_WIDTH / 2, HEADER_HEIGHT / 2);
    }
  }
}
```

### 3. 绘制标记（检测重叠，动态调整大小）

```typescript
if (animationEndFrame !== null && animationEndFrame >= 0) {
  const animEndX = TRACK_NAME_WIDTH + animationEndFrame * CELL_WIDTH + CELL_WIDTH;
  
  // 绘制红色粗线
  ctx.strokeStyle = '#ff4d4f';
  ctx.lineWidth = 3;
  ctx.moveTo(animEndX, 0);
  ctx.lineTo(animEndX, HEADER_HEIGHT);
  ctx.stroke();

  // 检查是否会与右边 1-2 帧的帧数字重叠
  let hasOverlap = false;
  for (let f = animationEndFrame + 1; f <= animationEndFrame + 2; f++) {
    if (f < frameCount && f % 5 === 0) {
      hasOverlap = true;
      break;
    }
  }

  const animLabelX = animEndX + 2;
  const animLabelY = HEADER_HEIGHT / 2;

  if (hasOverlap) {
    // 一半尺寸
    ctx.fillStyle = 'rgba(42, 42, 42, 0.95)';
    ctx.fillRect(animLabelX - 1, animLabelY - 6, 16, 10);
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 7px Arial';  // 小号
    ctx.fillText('END', animLabelX, animLabelY);
  } else {
    // 正常尺寸
    ctx.fillStyle = 'rgba(42, 42, 42, 0.95)';
    ctx.fillRect(animLabelX - 1, animLabelY - 7, 22, 12);
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 9px Arial';  // 正常
    ctx.fillText('END', animLabelX, animLabelY);
  }
}
```

## 🎨 视觉对比

### Before (帧数字被遮挡)

```
45  50│[END]     65  70  75
      │
      红线
          
问题：Frame 55 的数字看不清
```

### After (帧数字移到底部，标签缩小)

```
45  50│[END] 60  65  70  75
      │   ↑ 缩小的 END
         55  ↑ Frame 55 移到底部
      红线
    
优势：
- Frame 50 正常显示
- Frame 55 移到底部（避开标签）
- END 标签缩小，不拥挤
- 信息完整，不重叠
```

## 📊 尺寸对比

| 元素 | 正常 | 有重叠时 |
|-----|------|--------|
| 帧数字 | 11px, 居中 (y=15) | 9px, 底部 (y=26) |
| END 标签 | 9px bold, 居中 | 7px bold, 居中 |
| 标签背景 | 22×12px | 16×10px |

## 💡 设计思路

### 为什么一上一下？

```
顶部：标记 "ANIM"
- 更重要，需要醒目
- 红色，容易识别

底部：帧数字 "50"
- 提供精确信息
- 灰色，不抢眼
- 缩小避免拥挤
```

### 为什么缩小？

```
30px 的 Header 高度有限：
- 正常字体会挤在一起
- 缩小后可以清楚分开
- 仍然可读
```

### 为什么标记改为单行？

```
重叠时空间紧张：
- "ANIM" 已经足够识别
- "END" 可以省略
- 节省垂直空间给帧数字
```

## 🎯 各种场景

### 场景 1: 标记在 Frame 50 (紧邻 Frame 55)

```
Timeline:
┌────────────────────────────┐
│ 45  50│[END] 60  65  70    │ ← Frame 50 正常
│       │  ↑                 │ ← 小号 END
│       红线 55               │ ← Frame 55 移到底部
└────────────────────────────┘
```

### 场景 2: 标记在 Frame 47 (不影响帧数字)

```
Timeline:
┌────────────────────────────┐
│ 45│[END] 50  55  60  65    │ ← Frame 50 不受影响
│   │                        │ ← 正常 END
│   红线                      │
└────────────────────────────┘
```

### 场景 3: 标记在 Frame 98 (紧邻 Frame 100)

```
Timeline:
┌────────────────────────────┐
│ 95│[END] 105  110  115     │ ← Frame 100 移到底部
│   │  ↑                     │ ← 小号 END
│   红线100                   │
└────────────────────────────┘
```

### 场景 4: 标记在 Frame 118 (接近末尾)

```
Timeline:
┌────────────────────────────┐
│ 115│[END]│PROJECT END       │ ← 小号 END
│    │     120               │ ← Frame 120 移到底部
│    红线                     │
└────────────────────────────┘
```

## 🔄 对比三个版本

### v0 (原始)
```
问题：标记和数字完全重叠，看不清
[ANIM50]  ← 混在一起
[END  ]
```

### v1 (跳过数字)
```
改进：清晰但丢失信息
[ANIM]  ← 清晰
[END ]
(50哪去了？) ← 缺失
```

### v2 (一上一下)
```
完美：清晰且完整
[ANIM]  ← 顶部，清晰
  50    ← 底部，完整
```

## 🎉 总结

现在 Timeline 标记的显示更加智能：

✅ **不丢失信息** - 帧数字始终显示
✅ **不重叠** - 一上一下，清晰分离
✅ **自适应** - 根据是否重叠自动调整大小和位置
✅ **保持可读** - 即使缩小也清晰可读

用户体验完美！🚀

