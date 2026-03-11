# Shape Scale Handler Implementation

## 概述
实现了基于 `TransformHandlerBase` 的缩放处理器系列，参考了旧的 `ShapeScaleHandler`，支持三种缩放模式。

## 实现的文件

### 1. ShapeScaleHandler.ts
新建的缩放处理器家族，包含三个类：

#### ShapeScaleHandler（基类）
- **功能**：统一缩放（uniform scaling），同时缩放 x 和 y 轴
- **用途**：拖动角手柄（corner handles）

#### ShapeHorizontalScaleHandler
- **功能**：水平缩放，只缩放 x 轴，保持 y 轴不变
- **用途**：拖动左右边缘手柄

#### ShapeVerticalScaleHandler
- **功能**：垂直缩放，只缩放 y 轴，保持 x 轴不变
- **用途**：拖动上下边缘手柄

## 核心特性

### 1. 缩放中心计算
```typescript
// 基于所有选中物体的位置平均值
let sumX = 0, sumY = 0, count = 0;
this.targetGameObjects.forEach(gameObjectId => {
  const pos = transformComponent.props.position;
  sumX += pos.x;
  sumY += pos.y;
  count++;
});

this.scaleCenter = { x: sumX / count, y: sumY / count };
```

### 2. 缩放因子计算
```typescript
// 基于从缩放中心到鼠标位置的距离比
const vec1 = startPos - scaleCenter;
const vec2 = currentPos - scaleCenter;
const scaleFactor = length(vec2) / length(vec1);
```

### 3. 三种缩放模式

#### 统一缩放（Uniform）
```typescript
// 角手柄：同时缩放 x 和 y
calculateNewScale(originalScale, scaleFactor) {
  return {
    x: originalScale.x * scaleFactor,
    y: originalScale.y * scaleFactor
  };
}
```

#### 水平缩放（Horizontal）
```typescript
// 左右边缘手柄：只缩放 x
calculateNewScale(originalScale, scaleFactor) {
  return {
    x: originalScale.x * scaleFactor,
    y: originalScale.y  // 保持不变
  };
}
```

#### 垂直缩放（Vertical）
```typescript
// 上下边缘手柄：只缩放 y
calculateNewScale(originalScale, scaleFactor) {
  return {
    x: originalScale.x,  // 保持不变
    y: originalScale.y * scaleFactor
  };
}
```

### 4. Redux 实时同步
```typescript
onDragging(position) {
  // 计算新的缩放值
  const newScale = this.calculateNewScale(originalScale, scaleFactor);
  
  // 更新 Redux Store 并自动创建关键帧
  engineStore.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: { scale: newScale }
  }));
}
```

## 工作流程

### 用户交互流程
1. **选择物体** → 显示选择框和手柄
2. **点击手柄**：
   - 角手柄 → 统一缩放
   - 左/右边缘 → 水平缩放
   - 上/下边缘 → 垂直缩放
3. **拖动鼠标** → 实时缩放并更新 Store
4. **松开鼠标** → 完成缩放

### 数据流
```
RotatableSelectionBox (检测手柄点击)
  ↓
确定缩放类型 (uniform/horizontal/vertical)
  ↓
对应的 ScaleHandler (计算缩放因子)
  ↓
updateComponentPropsWithKeyFrame (Redux)
  ↓
ComponentSlice + LayerSlice (Store 更新)
  ↓
PaperRenderer (更新 Paper.js 显示)
```

## 代码结构

### 文件组织
```
handlers/
  ├─ ShapeScaleHandler.ts           (新建)
  │   ├─ ShapeScaleHandler          (统一缩放)
  │   ├─ ShapeHorizontalScaleHandler (水平缩放)
  │   └─ ShapeVerticalScaleHandler   (垂直缩放)
  ├─ index.ts                        (导出所有 handlers)
  └─ TransformHandlerMap.ts          (注册 handlers)
```

### TransformHandlerMap 注册
```typescript
// 角手柄 → 统一缩放
this.registerHandler('corner', shapeScaleHandler);

// 左右边缘 → 水平缩放
this.registerHandler('edge-horizontal', shapeHorizontalScaleHandler);

// 上下边缘 → 垂直缩放
this.registerHandler('edge-vertical', shapeVerticalScaleHandler);
```

### RotatableSelectionBox 集成
```typescript
// onMouseDown
for (const handle of this.cornerHandles) {
  if (handle.contains(event.point)) {
    // 角手柄 → 统一缩放
    shapeScaleHandler.setTarget(gameObjectIds);
    shapeScaleHandler.beginMove({ x, y });
  }
}

for (const handle of this.edgeHandles) {
  if (handle.contains(event.point)) {
    const edgeIndex = handle.data.edgeIndex;
    // 0=top, 1=right, 2=bottom, 3=left
    
    if (edgeIndex === 0 || edgeIndex === 2) {
      // 上下边缘 → 垂直缩放
      shapeVerticalScaleHandler.setTarget(gameObjectIds);
      shapeVerticalScaleHandler.beginMove({ x, y });
    } else {
      // 左右边缘 → 水平缩放
      shapeHorizontalScaleHandler.setTarget(gameObjectIds);
      shapeHorizontalScaleHandler.beginMove({ x, y });
    }
  }
}

// onMouseDrag
if (this.isScaling) {
  // 根据 edgeIndex 调用相应的 handler.dragging()
  shapeScaleHandler.dragging({ x, y });
  // 或
  shapeHorizontalScaleHandler.dragging({ x, y });
  // 或
  shapeVerticalScaleHandler.dragging({ x, y });
}

// onMouseUp
if (this.isScaling) {
  // 调用相应的 handler.endMove()
  shapeScaleHandler.endMove();
}
```

## 与旧代码的对比

### 相似之处
- ✅ 缩放因子计算逻辑
- ✅ 基于距离比的缩放
- ✅ 三种缩放模式（uniform/horizontal/vertical）
- ✅ 继承结构（基类 + 两个子类）

### 差异之处
| 特性 | 旧实现 | 新实现 |
|------|--------|--------|
| 基类 | `ShapeTranslateMorphBase` | `TransformHandlerBase` |
| 数据存储 | Paper.js `shape.scaling` | Redux Store |
| 撤销/重做 | `ShapeScaleCommand` + `UndoManager` | Redux + 关键帧 |
| 缩放中心 | `obj.shapePosition` | 计算的平均位置 |
| 存储时机 | `obj.store()` 每次拖动 | `updateComponentPropsWithKeyFrame` |

## 缩放算法详解

### 数学原理
```
给定：
  - P0: 鼠标起始位置
  - P1: 鼠标当前位置
  - C: 缩放中心
  - S0: 原始缩放值

计算：
  vec1 = P0 - C
  vec2 = P1 - C
  ratio = |vec2| / |vec1|
  S1 = S0 × ratio
```

### 示例
```
假设：
  缩放中心 C = (100, 100)
  起始位置 P0 = (200, 200)
  当前位置 P1 = (300, 300)
  原始缩放 S0 = (1, 1)

计算：
  vec1 = (200-100, 200-100) = (100, 100)
  vec2 = (300-100, 300-100) = (200, 200)
  |vec1| = sqrt(100² + 100²) = 141.42
  |vec2| = sqrt(200² + 200²) = 282.84
  ratio = 282.84 / 141.42 = 2.0
  
  统一缩放：S1 = (1×2, 1×2) = (2, 2)
  水平缩放：S1 = (1×2, 1×1) = (2, 1)
  垂直缩放：S1 = (1×1, 1×2) = (1, 2)
```

## 边界情况处理

### 1. 除零保护
```typescript
if (length1 < 0.001) return; // 避免除以零
```

### 2. 最小缩放限制
可以添加：
```typescript
const MIN_SCALE = 0.1;
const MAX_SCALE = 10.0;

const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, calculatedScale));
```

### 3. 负缩放处理
Paper.js 支持负缩放（镜像），但可能需要特殊处理：
```typescript
// 如果不允许镜像
if (scaleFactor < 0) {
  scaleFactor = Math.abs(scaleFactor);
}
```

## 测试要点

### 功能测试
- [ ] 角手柄统一缩放
- [ ] 左/右边缘水平缩放
- [ ] 上/下边缘垂直缩放
- [ ] 多物体同时缩放
- [ ] 缩放后移动/旋转

### 边界测试
- [ ] 缩放到非常小（接近 0）
- [ ] 缩放到非常大（> 10）
- [ ] 鼠标拖到缩放中心（除零）
- [ ] 反向拖动（负缩放）

### 性能测试
- [ ] 大量物体同时缩放
- [ ] 快速连续缩放
- [ ] 缩放 + 旋转 + 移动组合

## 已知限制

### 1. 缩放中心固定
当前缩放中心使用平均位置，未来可以改为：
- 选择框中心
- 用户自定义点
- 对角手柄点

### 2. 保持宽高比
目前角手柄是统一缩放，如果需要保持原始宽高比：
```typescript
// 计算 x 和 y 方向的独立缩放因子
const scaleX = vec2.x / vec1.x;
const scaleY = vec2.y / vec1.y;
```

### 3. 负缩放（镜像）
当前允许负缩放，可能需要特殊处理UI反馈。

## 使用示例

### 开发者使用
```typescript
import { shapeScaleHandler } from './handlers/ShapeScaleHandler';

// 设置目标物体
shapeScaleHandler.setTarget(gameObjectIds);

// 开始缩放
shapeScaleHandler.beginMove({ x: 100, y: 100 });

// 拖动缩放
shapeScaleHandler.dragging({ x: 150, y: 150 });

// 结束缩放
shapeScaleHandler.endMove();
```

### 用户使用
1. 选中物体
2. 拖动手柄：
   - **角手柄** → 同时缩放宽度和高度
   - **左/右边缘** → 只缩放宽度
   - **上/下边缘** → 只缩放高度
3. 松开鼠标完成

## 后续增强

### 短期（必需）
1. ✅ 实现基本缩放功能
2. ✅ 三种缩放模式
3. ✅ Redux 同步
4. ⏳ 添加最小/最大缩放限制
5. ⏳ 添加状态栏提示（显示当前缩放比例）

### 中期（增强）
1. ⏳ 支持保持宽高比缩放（按住 Shift）
2. ⏳ 自定义缩放中心
3. ⏳ 缩放时保持物体在视口中心
4. ⏳ 平滑缩放动画

### 长期（优化）
1. ⏳ 撤销/重做优化
2. ⏳ 批量缩放性能优化
3. ⏳ 缩放约束（锁定比例）
4. ⏳ 3D 缩放支持

## 调试信息

控制台日志输出：
```
[RotatableSelectionBox] Corner handle clicked (uniform scaling)
[ShapeScaleHandler] Scale center: {x: 100, y: 100}
[ShapeScaleHandler] Scale factor: 1.414
[RotatableSelectionBox] Edge handle clicked, index: 1
[RotatableSelectionBox] Using horizontal scale handler
[ShapeScaleHandler] Scale operation completed
```

## 常见问题

### Q1: 为什么缩放时物体会移动？
**A:** 缩放中心不是物体中心。确保缩放中心计算正确，或者在缩放后调整位置。

### Q2: 为什么缩放不连续？
**A:** 可能是因为每次都从原始缩放计算，而不是增量缩放。我们的实现是正确的：
```typescript
newScale = originalScale × scaleFactor
```

### Q3: 如何限制最小/最大缩放？
**A:** 在 `calculateNewScale` 中添加限制：
```typescript
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
return {
  x: clamp(originalScale.x * scaleFactor, 0.1, 10),
  y: clamp(originalScale.y * scaleFactor, 0.1, 10)
};
```

## 总结

✅ **实现完成：**
- 统一缩放（角手柄）
- 水平缩放（左右边缘）
- 垂直缩放（上下边缘）
- Redux 实时同步
- 自动创建关键帧

✅ **架构优势：**
- 继承结构清晰（基类 + 两个子类）
- 易于扩展（如添加保持宽高比模式）
- 与旋转/移动处理器一致的接口
- 完全委托，选择框不关心业务逻辑

现在用户可以通过拖动选择框的手柄来缩放物体了！🎉

