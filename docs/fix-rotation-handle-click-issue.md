# 修复旋转手柄无法点击的问题

## 问题描述
用户反馈：**选不中绿色旋转手柄！**

## 问题原因

### 1. 事件处理顺序错误
**原始代码逻辑：**
```typescript
onMouseDown(event) {
  // 1. 先做 hitTest 检测所有物体
  const hitResult = activeLayer.hitTest(event.point);
  
  // 2. 如果命中物体，进入物体处理逻辑
  if (hitResult && hitResult.item) {
    // 3. 才检查是否点击了选择框手柄
    const handleClicked = rotatableSelection.onMouseDown(event);
  }
}
```

**问题：** 旋转手柄会先被 `hitTest` 检测到，导致被当作普通物体处理，永远无法触发手柄的点击逻辑。

### 2. SelectionGroup 被锁定
```typescript
this.selectionGroup.locked = true;
```

**问题：** 锁定的 Group 的所有子元素（包括旋转手柄）都无法响应交互事件，`contains()` 方法会失效。

## 解决方案

### 修复 1: 调整事件处理顺序

**修改文件：** `PointerTool.ts`

**修改前：**
```typescript
onMouseDown(event) {
  // 先检测物体
  const hitResult = activeLayer.hitTest(event.point);
  
  if (hitResult && hitResult.item) {
    // 再检查手柄
    const handleClicked = rotatableSelection.onMouseDown(event);
  }
}
```

**修改后：**
```typescript
onMouseDown(event) {
  // ✅ 先检查选择框手柄
  if (this.rotatableSelection) {
    const handleClicked = this.rotatableSelection.onMouseDown(event);
    if (handleClicked) {
      console.log('[PointerTool] Clicked on selection handle');
      this.startPoint = null;
      return; // 提前返回，不再处理物体点击
    }
  }
  
  // 然后才检测物体
  const hitResult = activeLayer.hitTest(event.point);
  
  if (hitResult && hitResult.item) {
    // 处理物体点击
  }
}
```

### 修复 2: 移除 SelectionGroup 的锁定

**修改文件：** `RotatableSelectionBox.ts`

**修改前：**
```typescript
private setupSelectionGroup(): void {
  this.selectionGroup = new paper.Group();
  this.selectionGroup.locked = true; // ❌ 这会阻止手柄交互
  this.selectionGroup.name = 'selectionGroup';
}
```

**修改后：**
```typescript
private setupSelectionGroup(): void {
  this.selectionGroup = new paper.Group();
  // ✅ 不锁定 Group，允许手柄交互
  this.selectionGroup.name = 'selectionGroup';
  this.selectionGroup.data.isSelectionBox = true; // 标记为选择框 UI
}
```

### 修复 3: 标记选择框元素

为所有选择框元素添加 `isSelectionBox` 标记，防止它们被当作普通物体处理：

**修改文件：** `RotatableSelectionBox.ts`

```typescript
// 边界框
this.boundingBox.data.isSelectionBox = true;

// 角手柄
handle.data.isSelectionBox = true;

// 边手柄
handle.data.isSelectionBox = true;

// 旋转手柄
this.rotationHandle.data.isSelectionBox = true;

// 连接线
connectionLine.data.isSelectionBox = true;
```

### 修复 4: 在 PointerTool 中跳过选择框元素

**修改文件：** `PointerTool.ts`

```typescript
if (hitResult && hitResult.item) {
  // ✅ 跳过选择框 UI 元素
  if (hitResult.item.data?.isSelectionBox) {
    console.log('[PointerTool] Item is selection box UI, skipping');
    return;
  }
  
  // 处理普通物体
}
```

### 修复 5: 添加调试日志

**修改文件：** `RotatableSelectionBox.ts`

```typescript
public onMouseDown(event: paper.ToolEvent): boolean {
  console.log('[RotatableSelectionBox] onMouseDown at:', event.point.toString());
  console.log('[RotatableSelectionBox] rotationHandle exists:', !!this.rotationHandle);
  
  if (this.rotationHandle && this.rotationHandle.contains(event.point)) {
    console.log('[RotatableSelectionBox] ✅ Rotation handle clicked!');
    // ...
  }
}
```

## 修改总结

### 修改的文件
1. **PointerTool.ts**
   - 调整事件处理顺序：先检查手柄，再检查物体
   - 跳过选择框 UI 元素的 hitTest 处理

2. **RotatableSelectionBox.ts**
   - 移除 `selectionGroup.locked = true`
   - 为所有选择框元素添加 `isSelectionBox` 标记
   - 添加调试日志

### 关键改进点

| 问题 | 解决方案 |
|------|---------|
| 手柄无法响应点击 | 移除 `locked` 属性 |
| 手柄被当作普通物体 | 添加 `isSelectionBox` 标记 + 事件顺序调整 |
| 难以调试 | 添加详细的 console.log |

## 测试方法

### 1. 基础测试
- [ ] 选中一个物体
- [ ] 看到绿色旋转手柄出现在选择框上方
- [ ] 点击绿色旋转手柄
- [ ] 控制台应该输出：
  ```
  [RotatableSelectionBox] onMouseDown at: ...
  [RotatableSelectionBox] rotationHandle exists: true
  [RotatableSelectionBox] ✅ Rotation handle clicked!
  [PointerTool] Clicked on selection handle
  ```
- [ ] 拖动鼠标，物体应该旋转

### 2. 边界情况测试
- [ ] 点击物体（不是手柄）→ 应该开始拖动
- [ ] 点击选择框边界 → 应该开始拖动
- [ ] 点击空白区域 → 应该开始框选

### 3. 调试检查清单
如果还是点不中，检查：
1. 控制台是否输出 `[RotatableSelectionBox] rotationHandle exists: true`
   - 如果是 `false`，说明旋转手柄没有创建
2. 控制台是否输出 `[RotatableSelectionBox] onMouseDown`
   - 如果没有输出，说明事件没有传递到 RotatableSelectionBox
3. 旋转手柄的坐标是否正确
   - 在浏览器 DevTools 中检查 `rotationHandle.position`

## 技术细节

### Paper.js 的 locked 属性
```typescript
item.locked = true;
```
- 锁定的 Item 无法被选中
- 锁定的 Item 的 `contains()` 方法会返回 false
- 锁定的 Group 会影响其所有子元素

### 事件处理优先级
```
用户点击
  ↓
PointerTool.onMouseDown
  ↓
1. 先检查 RotatableSelectionBox 的手柄 ← 优先级最高
  ↓
2. 再检查 hitTest 普通物体
  ↓
3. 最后处理框选
```

### 调试技巧
```typescript
// 检查 rotationHandle 是否存在
console.log(this.rotationHandle);

// 检查 rotationHandle 的位置
console.log(this.rotationHandle?.position);

// 检查点击点是否在 handle 内
console.log(this.rotationHandle?.contains(event.point));

// 检查 handle 是否被锁定
console.log(this.rotationHandle?.locked);
```

## 相关问题

### Q1: 为什么不继续使用 locked？
**A:** `locked` 属性会完全阻止交互，包括程序化的 `contains()` 检测。我们需要手柄可以响应点击，所以不能锁定。

### Q2: 如何防止选择框被选中？
**A:** 通过 `isSelectionBox` 标记 + PointerTool 中的过滤逻辑来跳过选择框元素。

### Q3: 为什么要调整事件处理顺序？
**A:** Paper.js 的 `hitTest` 会检测所有元素，包括选择框手柄。如果先做 hitTest，手柄会被当作普通物体处理。

## 预期效果

修复后，用户应该能够：
1. ✅ 点击绿色旋转手柄
2. ✅ 拖动旋转物体
3. ✅ 看到旋转指示器（黄色/红色扇形）
4. ✅ 按住 Shift 进行角度吸附
5. ✅ 松开鼠标完成旋转

## 后续优化

如果仍有问题，可以考虑：
1. 使用更大的手柄 hitTest tolerance
2. 将手柄放在独立的 Layer 上
3. 使用自定义 hitTest 逻辑（不依赖 Paper.js）

