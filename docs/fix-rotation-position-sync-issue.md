# 修复旋转后移动物体位置不同步到 Store 的问题

## 问题描述
用户反馈：**旋转物体后再移动，位置没有存入 Store，但 Shape 确实平移了**

### 症状
1. 旋转物体 → 正常工作，Store 更新
2. 移动物体 → **视觉上移动了**，但 **Store 没有更新**
3. 查看 Redux DevTools → position 值没有变化

## 问题分析

### 可能的原因

#### 原因 1: Paper.js 的 `rotation` 属性问题
Paper.js 的 `item.rotation` 是一个**累积属性**，直接设置可能导致内部状态不一致。

```typescript
// PaperRenderer.updateItemTransform
item.rotation = transform.rotation; // ❌ 可能导致问题
```

当 `applyMatrix = false` 时：
- `item.position` - 绝对位置
- `item.rotation` - **相对旋转角度**（相对于上次设置）
- `item.scaling` - 绝对缩放

#### 原因 2: 旋转后 Paper.js item 的坐标系统变化
旋转物体后，Paper.js 的**局部坐标系**发生了变化，但我们在读取 `item.position` 时可能读到的是**错误的坐标系**。

#### 原因 3: ShapeTranslateHandler 读取位置时机错误
在 `onBeginMove` 中，我们从 **Redux Store** 读取初始位置：
```typescript
const currentPos = transformComponent.props.position;
this.initialPositions.set(gameObjectId, {
  x: currentPos.x,
  y: currentPos.y
});
```

但如果 **Paper.js item 的实际位置** 和 **Store 中的位置** 不一致，就会出现问题。

## 调试步骤

### 1. 添加调试日志

已添加日志到以下位置：

**ShapeTranslateHandler.ts:**
```typescript
// onBeginMove
console.log('[ShapeTranslateHandler] onBeginMove - Reading initial positions from Redux Store');
console.log(`GameObject ${gameObjectId} initial position from Store:`, currentPos);

// onDragging
console.log(`[ShapeTranslateHandler] onDragging - delta: (${deltaX}, ${deltaY})`);
console.log(`Updating GameObject ${gameObjectId}: initial -> new position`);
```

**PaperRenderer.ts:**
```typescript
// updateItemTransform
console.log('[PaperRenderer] updateItemTransform:', {
  itemName: item.name,
  gameObjectId: item.data?.gameObjectId,
  oldPosition: item.position,
  newPosition: transform.position,
  oldRotation: item.rotation,
  newRotation: transform.rotation,
  applyMatrix: item.applyMatrix
});
```

### 2. 测试流程

1. 打开浏览器控制台
2. 选中一个物体
3. 旋转物体（拖动绿色手柄）
4. 观察控制台输出
5. 移动物体（拖动物体本身）
6. 观察控制台输出
7. 检查 Redux DevTools 中的 position 值

### 3. 预期日志输出

**正常情况（旋转前移动）：**
```
[ShapeTranslateHandler] onBeginMove - Reading initial positions from Redux Store
[ShapeTranslateHandler] GameObject obj1 initial position from Store: {x: 100, y: 100}
[ShapeTranslateHandler] onDragging - delta: (10.00, 5.00)
[ShapeTranslateHandler] Updating GameObject obj1: initial (100, 100) -> new (110.00, 105.00)
[PaperRenderer] updateItemTransform: {
  oldPosition: {x: 100, y: 100},
  newPosition: {x: 110, y: 105},
  ...
}
```

**问题情况（旋转后移动）：**
```
[ShapeRotateHandler] ... (旋转操作)
[PaperRenderer] updateItemTransform: {rotation: 45, ...}

[ShapeTranslateHandler] onBeginMove - Reading initial positions from Redux Store
[ShapeTranslateHandler] GameObject obj1 initial position from Store: {x: 100, y: 100}  ← Store 中的值
[ShapeTranslateHandler] onDragging - delta: (10.00, 5.00)
[ShapeTranslateHandler] Updating GameObject obj1: initial (100, 100) -> new (110.00, 105.00)
[PaperRenderer] updateItemTransform: {
  oldPosition: {x: 150, y: 120},  ← Paper.js 中的实际位置（不同！）
  newPosition: {x: 110, y: 105},
  ...
}
```

## 可能的解决方案

### 方案 1: 修复 PaperRenderer 的旋转处理

确保旋转是绝对角度，而不是相对旋转：

```typescript
updateItemTransform(item: paper.Item, transform: {...}): void {
  const scope = this.scope!;
  
  // 先重置旋转
  item.rotation = 0;
  
  // 设置新的变换
  item.position = new scope.Point(transform.position.x, transform.position.y);
  item.rotation = transform.rotation; // 现在是绝对角度
  item.scaling = new scope.Point(transform.scale.x, transform.scale.y);
}
```

### 方案 2: 使用 Paper.js 的 matrix 来设置变换

```typescript
updateItemTransform(item: paper.Item, transform: {...}): void {
  const scope = this.scope!;
  
  // 创建一个新的变换矩阵
  const matrix = new scope.Matrix();
  
  // 应用平移
  matrix.translate(transform.position.x, transform.position.y);
  
  // 应用旋转
  matrix.rotate(transform.rotation);
  
  // 应用缩放
  matrix.scale(transform.scale.x, transform.scale.y);
  
  // 设置矩阵
  item.matrix = matrix;
}
```

### 方案 3: 旋转后强制同步 Paper.js 位置到 Store

在 `ShapeRotateHandler.onEndMove` 中：

```typescript
protected onEndMove(): void {
  this.clearRotationIndicator();
  
  // ✅ 旋转后，强制同步 Paper.js 的实际位置到 Redux Store
  const engineStore = getEngineStore();
  const renderer = getRenderer(); // 需要获取 renderer
  
  this.targetGameObjects.forEach(gameObjectId => {
    const renderItem = renderer.getRenderItem(gameObjectId);
    if (renderItem) {
      const actualPosition = renderItem.position;
      
      // 更新 Store 中的位置为 Paper.js 的实际位置
      const transformComponentId = this.transformComponentIds.get(gameObjectId);
      if (transformComponentId) {
        engineStore.dispatch(updateComponentPropsWithKeyFrame({
          id: transformComponentId,
          patch: {
            position: {
              x: actualPosition.x,
              y: actualPosition.y
            }
          }
        }));
      }
    }
  });
  
  // Clean up state
  this.initialRotations.clear();
  this.transformComponentIds.clear();
  this.rotationCenter = null;
  this.lastAngle = 0;
  this.totalRotation = 0;
}
```

### 方案 4: ShapeTranslateHandler 从 Paper.js 读取初始位置

修改 `ShapeTranslateHandler.onBeginMove`：

```typescript
protected onBeginMove(position: { x: number; y: number }): void {
  this.initialPositions.clear();
  this.transformComponentIds.clear();

  const engineStore = getEngineStore();
  const state = engineStore.getState();
  const engineState = state.engine || state;
  const renderer = getRenderer(); // 需要获取 renderer

  this.targetGameObjects.forEach(gameObjectId => {
    const gameObject = engineState.gameObjects.byId[gameObjectId];
    if (gameObject && gameObject.componentIds.length > 0) {
      const transformComponentId = gameObject.componentIds[0];
      const transformComponent = engineState.components.byId[transformComponentId];

      if (transformComponent && transformComponent.type === 'Transform') {
        // ✅ 从 Paper.js 读取实际位置，而不是从 Store
        const renderItem = renderer.getRenderItem(gameObjectId);
        const currentPos = renderItem 
          ? { x: renderItem.position.x, y: renderItem.position.y }
          : transformComponent.props.position;
        
        console.log(`[ShapeTranslateHandler] GameObject ${gameObjectId}:
          Store position: ${transformComponent.props.position.x}, ${transformComponent.props.position.y}
          Paper.js position: ${currentPos.x}, ${currentPos.y}
        `);
        
        this.initialPositions.set(gameObjectId, currentPos);
        this.transformComponentIds.set(gameObjectId, transformComponentId);
      }
    }
  });
}
```

## 推荐方案

### 最佳方案：方案 1 + 方案 4

1. **修复 PaperRenderer 的旋转处理**（方案 1）
   - 确保 `item.rotation` 是绝对角度
   
2. **ShapeTranslateHandler 从 Paper.js 读取初始位置**（方案 4）
   - 确保移动时使用的是 Paper.js 的实际位置

这样可以确保：
- ✅ Store 是唯一的数据源
- ✅ Paper.js 的渲染状态与 Store 一致
- ✅ 旋转后移动不会出现位置跳跃

## 实施步骤

### Step 1: 修复 PaperRenderer.updateItemTransform

```typescript
updateItemTransform(
  item: paper.Item,
  transform: {
    position: { x: number; y: number };
    rotation: number;
    scale: { x: number; y: number };
  }
): void {
  const scope = this.scope!;
  
  console.log('[PaperRenderer] updateItemTransform:', {
    itemName: item.name,
    gameObjectId: item.data?.gameObjectId,
    oldPosition: { x: item.position.x, y: item.position.y },
    newPosition: transform.position,
    oldRotation: item.rotation,
    newRotation: transform.rotation,
    applyMatrix: item.applyMatrix
  });
  
  // ✅ 先重置旋转为 0，确保旋转是绝对角度
  const currentRotation = item.rotation;
  item.rotate(-currentRotation); // 重置到 0
  
  // 设置新的变换
  item.position = new scope.Point(transform.position.x, transform.position.y);
  item.rotation = transform.rotation; // 现在是绝对角度
  item.scaling = new scope.Point(transform.scale.x, transform.scale.y);
}
```

### Step 2: 测试

1. 旋转物体
2. 移动物体
3. 检查控制台日志
4. 检查 Redux DevTools

### Step 3: 如果问题仍存在，实施方案 4

修改 `ShapeTranslateHandler` 从 Paper.js 读取初始位置。

## 后续工作

- [ ] 验证修复是否有效
- [ ] 移除调试日志（或改为 debug 级别）
- [ ] 添加单元测试
- [ ] 更新文档

## 注意事项

1. **applyMatrix 的影响**：确保所有 renderItem 都设置了 `applyMatrix = false`
2. **坐标系一致性**：确保 Store 和 Paper.js 使用相同的坐标系
3. **旋转中心**：旋转操作可能改变物体的实际位置（如果旋转中心不是物体中心）

## 相关文件

- `ShapeTranslateHandler.ts` - 移动处理器
- `ShapeRotateHandler.ts` - 旋转处理器
- `PaperRenderer.ts` - Paper.js 渲染器
- `Transform.ts` - Transform 组件
- `ReduxAdapter.ts` - Redux 和渲染器的桥接

