# 完全替换 Paper.js 默认选择框为自定义 RotatableSelectionBox

## ✅ 完成的修改

### 核心改动：禁用 Paper.js 默认选择，始终使用自定义选择框

## 📝 关键代码修改

### 1. onMouseDown - 点击物体时

**Before** ❌:
```typescript
// 使用 Paper.js 默认选择
if (!hitResult.item.selected) {
  activeLayer.children.forEach((item: any) => {
    item.selected = false;
  });
  
  hitResult.item.selected = true;  // ❌ Paper.js 默认选择框
  
  // 只有未选中时才显示自定义选择框
  this.rotatableSelection.setSelection([hitResult.item]);
}
```

**After** ✅:
```typescript
// ✅ 完全禁用 Paper.js 默认选择
activeLayer.children.forEach((item: any) => {
  item.selected = false;  // 禁用所有默认选择
});

// ✅ 始终使用自定义选择框
this.rotatableSelection.setSelection([hitResult.item]);
```

### 2. onMouseUp - 拖动框选时

**Before** ❌:
```typescript
activeLayer.children.forEach((item: any) => {
  item.selected = false;
});

// 使用 Paper.js 默认选择
if (item.bounds.intersects(selectionBounds)) {
  item.selected = true;  // ❌ Paper.js 默认选择框
}
```

**After** ✅:
```typescript
// 找到选中的 item
let selectedItem: paper.Item | null = null;

if (item.bounds.intersects(selectionBounds)) {
  if (!selectedItem && item.data?.gameObjectId) {
    selectedItem = item;  // 保存 item 引用
  }
}

// ✅ 使用自定义选择框
if (selectedItem) {
  this.rotatableSelection.setSelection([selectedItem]);
} else {
  this.rotatableSelection.clear();  // 清除选择框
}
```

### 3. onMouseDrag - 移动物体时

**Before** ❌:
```typescript
if (this.transformHandler.getIsDragging()) {
  this.transformHandler.dragging({ x: event.point.x, y: event.point.y });
  // ❌ 选择框不更新，停留在原位
  return;
}
```

**After** ✅:
```typescript
if (this.transformHandler.getIsDragging()) {
  this.transformHandler.dragging({ x: event.point.x, y: event.point.y });
  
  // ✅ 实时更新选择框位置
  if (this.rotatableSelection) {
    const selectedItems = this.rotatableSelection.getSelectedItems();
    if (selectedItems.length > 0) {
      this.rotatableSelection.setSelection(selectedItems);
    }
  }
  return;
}
```

### 4. onMouseUp - Transform 结束时

**Before** ❌:
```typescript
if (this.transformHandler) {
  this.transformHandler.endMove();
  this.transformHandler = null;
  // ❌ 选择框位置不准确
  return;
}
```

**After** ✅:
```typescript
if (this.transformHandler) {
  this.transformHandler.endMove();
  this.transformHandler = null;
  
  // ✅ 更新选择框到最终位置
  if (this.rotatableSelection) {
    const selectedItems = this.rotatableSelection.getSelectedItems();
    if (selectedItems.length > 0) {
      this.rotatableSelection.setSelection(selectedItems);
    }
  }
  
  return;
}
```

## 🎯 现在的行为

### 场景 1：选择物体

```
1. 用户点击 GameObject
   ↓
2. Paper.js 默认选择被禁用 ❌
   activeLayer.children.forEach(item => item.selected = false)
   ↓
3. 显示自定义 RotatableSelectionBox ✅
   this.rotatableSelection.setSelection([hitResult.item])
   ↓
4. 结果：只看到自定义选择框（蓝色边框 + 控制点）
```

### 场景 2：拖动移动物体

```
1. 用户拖动选中的物体
   ↓
2. TransformHandler 移动 Paper.js item
   ↓
3. 每次拖动时更新自定义选择框 ✅
   this.rotatableSelection.setSelection(selectedItems)
   ↓
4. 结果：选择框跟随物体实时移动
```

### 场景 3：旋转物体

```
1. 用户拖动旋转控制点（绿色圆圈）
   ↓
2. RotatableSelectionBox.handleRotation()
   - 旋转 Paper.js item
   - 自动更新选择框
   ↓
3. 结果：物体和选择框一起旋转
```

### 场景 4：框选物体

```
1. 用户拖动创建选择矩形
   ↓
2. 找到第一个相交的 item
   ↓
3. 不使用 Paper.js 默认选择 ❌
   ↓
4. 使用自定义选择框 ✅
   this.rotatableSelection.setSelection([selectedItem])
   ↓
5. 结果：只看到自定义选择框
```

### 场景 5：点击空白处

```
1. 用户点击空白区域
   ↓
2. 清除 Redux 选择
   store.dispatch(clearSelection())
   ↓
3. 清除自定义选择框 ✅
   this.rotatableSelection.clear()
   ↓
4. 结果：选择框消失
```

## 🔧 关键改进

### 1. **完全禁用 Paper.js 默认选择**
```typescript
// 始终执行，确保没有 Paper.js 默认选择框
activeLayer.children.forEach((item: any) => {
  item.selected = false;
});
```

### 2. **始终使用自定义选择框**
```typescript
// 无论是否已选中，都更新自定义选择框
this.rotatableSelection.setSelection([hitResult.item]);
```

### 3. **实时更新选择框位置**
```typescript
// 在 onMouseDrag 中实时更新
if (this.transformHandler.getIsDragging()) {
  this.transformHandler.dragging(...);
  
  // ✅ 每次拖动都更新选择框
  this.rotatableSelection.setSelection(selectedItems);
}
```

### 4. **正确清除选择框**
```typescript
// 点击空白或取消选择时
if (this.rotatableSelection) {
  this.rotatableSelection.clear();
}
```

## 🎨 视觉效果对比

### Before ❌ - Paper.js 默认选择框

```
选中物体时：
┌─────────────┐
│   物体      │  ← Paper.js 默认选择框（忽有忽无）
└─────────────┘
有时有，有时没有，不可控
```

### After ✅ - 自定义 RotatableSelectionBox

```
选中物体时：
        🟢 ← 旋转控制点
        ┊
    ⚪─────⚪─────⚪
    │             │
    ⚪   物体      ⚪  ← 缩放控制点
    │             │
    ⚪─────⚪─────⚪

始终显示，完全可控
```

## 📊 状态管理

### Paper.js 选择状态

```typescript
// ✅ 始终禁用
activeLayer.children.forEach((item: any) => {
  item.selected = false;  // 永远是 false
});
```

### 自定义选择框状态

```typescript
// ✅ 完全由 RotatableSelectionBox 管理
this.rotatableSelection.setSelection([item]);  // 显示
this.rotatableSelection.clear();               // 隐藏
this.rotatableSelection.getSelectedItems();    // 查询
```

### Redux 选择状态

```typescript
// ✅ 继续使用 Redux 管理业务逻辑
store.dispatch(selectObject({ type: 'gameObject', id: gameObjectId }));
store.dispatch(clearSelection());
```

## 🎉 总结

**现在的行为**：
1. ✅ **完全禁用** Paper.js 默认选择框（`item.selected = false`）
2. ✅ **始终使用** 自定义 RotatableSelectionBox
3. ✅ **实时更新** 选择框位置（拖动时跟随）
4. ✅ **正确清除** 选择框（点击空白时）
5. ✅ **支持旋转** 控制点（顶部绿色圆圈）
6. ✅ **预留缩放** 控制点（8个白色圆圈）

**用户体验**：
- 选中物体 → 立即显示自定义选择框
- 拖动物体 → 选择框跟随移动
- 旋转物体 → 选择框一起旋转
- 取消选择 → 选择框消失
- 不再有忽有忽无的默认选择框！✨

现在你的自定义旋转选择框已经完全替换了 Paper.js 的默认选择框！🎊

