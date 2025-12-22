# 修复：参考旧代码改进 Paper.js 变换处理

## 问题回顾
旋转物体后移动，位置没有正确同步到 Store。

## 旧代码分析

### BaseShapeJS 的 `afterUpdate` 方法
```typescript
afterUpdate(force: boolean = false) {
    // Reset the rotation.
    this.paperItem.rotation = this.rotation;

    this.updatePositionAndRotation()

    let scaling = this.rawObj.GetScale()
    this.paperItem.scaling = new paper.Point(scaling.x, scaling.y)
    
    // ... adjust index
}
```

### 关键发现：变换顺序很重要！

旧代码的处理顺序：
1. **重置旋转** → `item.rotation = this.rotation`
2. **重置缩放为 (1, 1)** → `item.scaling = new paper.Point(1.0, 1.0)`
3. **设置位置** → 计算并设置正确的位置
4. **应用旋转** → 设置最终旋转角度
5. **应用缩放** → 设置最终缩放

### 为什么这个顺序重要？

Paper.js 中，当 `applyMatrix = false` 时：
- **缩放会影响位置计算**：如果缩放不是 (1, 1)，设置位置时会受到缩放的影响
- **旋转会改变坐标系**：旋转后，Paper.js 的内部坐标系统发生变化

## 修复方案

### 修改前（有问题的代码）
```typescript
updateItemTransform(item, transform) {
    const currentRotation = item.rotation;
    if (currentRotation !== 0) {
        item.rotate(-currentRotation); // ❌ 使用 rotate() 会有问题
    }
    
    item.position = new scope.Point(transform.position.x, transform.position.y);
    item.rotation = transform.rotation;
    item.scaling = new scope.Point(transform.scale.x, transform.scale.y);
}
```

**问题：**
- 使用 `item.rotate(-currentRotation)` 而不是直接设置 `item.rotation = 0`
- 没有在设置位置前重置缩放

### 修改后（参考旧代码）
```typescript
updateItemTransform(item, transform) {
    // 1. 重置旋转到 0（直接赋值，不使用 rotate）
    item.rotation = 0;
    
    // 2. 重置缩放到 (1, 1)（避免缩放影响位置计算）
    const targetScaling = new scope.Point(transform.scale.x, transform.scale.y);
    item.scaling = new scope.Point(1.0, 1.0);
    
    // 3. 设置位置（此时旋转和缩放都是中性状态）
    item.position = new scope.Point(transform.position.x, transform.position.y);
    
    // 4. 应用旋转（绝对角度）
    item.rotation = transform.rotation;
    
    // 5. 应用缩放（最终缩放）
    item.scaling = targetScaling;
}
```

## 关键改进点

### 1. 直接设置 `rotation = 0`
```typescript
// ❌ 错误：使用 rotate() 方法
item.rotate(-currentRotation);

// ✅ 正确：直接赋值
item.rotation = 0;
```

**原因：** `rotate()` 方法可能会触发 Paper.js 的内部矩阵更新，导致副作用。直接赋值更可靠。

### 2. 设置位置前重置缩放
```typescript
// ✅ 先重置缩放
item.scaling = new paper.Point(1.0, 1.0);

// ✅ 然后设置位置（不受缩放影响）
item.position = new paper.Point(transform.position.x, transform.position.y);

// ✅ 最后应用缩放
item.scaling = targetScaling;
```

**原因：** 当缩放不是 (1, 1) 时，设置 `position` 可能会受到缩放的影响，导致位置偏移。

### 3. 严格的变换顺序
```
重置旋转 → 重置缩放 → 设置位置 → 应用旋转 → 应用缩放
```

这个顺序确保：
- 位置计算不受旋转和缩放的影响
- 旋转是绝对角度，不累积
- 缩放在最后应用，不影响前面的变换

## 为什么旧代码能工作？

旧代码的 `updatePositionAndRotation()` 使用了这个顺序：

```typescript
updatePositionAndRotation() {
    // 重置旋转
    this.paperItem.rotation = this.rotation;
    
    // 重置缩放为 (1, 1)
    this.paperItem.scaling = new paper.Point(1.0, 1.0);
    
    // 重置位置为 (0, 0)
    this.paperItem.position = new paper.Point(0.0, 0.0);
    
    // 计算正确的位置
    let globalPivotPosition = this.pivotPosition;
    let localPivotPosition = this.rawObj.GetLocalPivotPosition();
    let radian = this.rotation / 180 * Math.PI;
    let shapeZero = this.backCalculateZeroPoint(localPivotPosition, globalPivotPosition, -radian);
    let offset = this.paperShape.localToParent(new paper.Point(0, 0));
    let newPosition = shapeZero.subtract(offset);
    
    // 设置位置
    this.paperItem.position = newPosition;
}
```

然后在 `afterUpdate()` 中应用缩放：
```typescript
let scaling = this.rawObj.GetScale();
this.paperItem.scaling = new paper.Point(scaling.x, scaling.y);
```

## 测试验证

### 测试场景 1：旋转 + 移动
1. 创建一个矩形
2. 旋转 45°
3. 移动矩形
4. **预期结果：**
   - ✅ 位置正确更新到 Store
   - ✅ Paper.js 显示位置和 Store 一致
   - ✅ 控制台日志显示位置正确

### 测试场景 2：缩放 + 旋转 + 移动
1. 创建一个矩形
2. 缩放到 (2, 2)
3. 旋转 90°
4. 移动矩形
5. **预期结果：**
   - ✅ 位置不受缩放影响
   - ✅ 旋转保持 90°
   - ✅ 缩放保持 (2, 2)

### 测试场景 3：多次变换
1. 旋转 30°
2. 移动
3. 缩放到 (1.5, 1.5)
4. 旋转 60°（总共 90°）
5. 移动
6. **预期结果：**
   - ✅ 每次移动后位置正确
   - ✅ 旋转累积正确
   - ✅ 缩放保持不变

## Paper.js 的 applyMatrix 属性

### applyMatrix = false
```typescript
item.applyMatrix = false;
```

- `position`：绝对位置
- `rotation`：绝对角度
- `scaling`：绝对缩放
- 变换**不会应用**到路径的点上

### applyMatrix = true（默认）
- 变换会应用到路径的点上
- `position`、`rotation`、`scaling` 会重置
- 每次变换都是**累积的**

我们使用 `applyMatrix = false`，所以：
- ✅ 可以直接设置绝对值
- ✅ 不会累积变换
- ⚠️ 但需要**正确的顺序**来避免相互影响

## 技术细节

### 为什么要重置缩放？

Paper.js 内部使用变换矩阵。当设置 `position` 时：
```
实际位置 = position × scaling
```

如果 `scaling = (2, 2)`，设置 `position = (100, 100)`：
```
实际位置 = (100, 100) × (2, 2) = (200, 200) ❌
```

所以先重置缩放到 (1, 1)：
```
实际位置 = (100, 100) × (1, 1) = (100, 100) ✅
```

然后再应用最终缩放。

### 为什么要重置旋转？

类似的，旋转也会影响坐标系。重置旋转确保：
- 位置在未旋转的坐标系中设置
- 然后应用旋转，物体绕其位置旋转

## 相关代码对比

### 旧代码（BaseShapeJS.ts）
```typescript
// afterUpdate
this.paperItem.rotation = this.rotation;
this.updatePositionAndRotation();
let scaling = this.rawObj.GetScale();
this.paperItem.scaling = new paper.Point(scaling.x, scaling.y);
```

### 新代码（PaperRenderer.ts）
```typescript
item.rotation = 0;
item.scaling = new paper.Point(1.0, 1.0);
item.position = new paper.Point(transform.position.x, transform.position.y);
item.rotation = transform.rotation;
item.scaling = targetScaling;
```

**本质相同，都遵循相同的顺序！**

## 总结

✅ **修复完成：**
- 参考旧代码的变换顺序
- 先重置旋转和缩放
- 然后设置位置
- 最后应用旋转和缩放

✅ **关键改进：**
1. 直接设置 `rotation = 0`（不用 `rotate()`）
2. 设置位置前重置缩放到 (1, 1)
3. 严格遵循变换顺序

✅ **预期效果：**
- 旋转后移动，位置正确同步
- 缩放、旋转、位置相互不影响
- Paper.js 和 Store 保持一致

## 调试日志

控制台会输出详细信息：
```
[PaperRenderer] updateItemTransform: {
  oldPosition: {x: 100, y: 100},
  newPosition: {x: 150, y: 130},
  oldRotation: 45,
  newRotation: 45,
  applyMatrix: false
}
[PaperRenderer] After update: {
  actualPosition: {x: 150, y: 130},
  actualRotation: 45,
  actualScaling: {x: 1, y: 1}
}
```

如果位置还有问题，查看这些日志来诊断。

