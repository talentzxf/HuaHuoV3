# 最终正确理解：RotatableSelectionBox 始终可见

## ✅ 正确理解

### 核心原则
1. **只要物体被选中，就始终显示 RotatableSelectionBox！**
2. **RotatableSelectionBox 只检查旋转/缩放手柄**
3. **如果没有点击手柄（返回 null），PointerTool 默认行为就是 Drag！**

## 📋 完整逻辑

### 场景 1：首次点击物体（选择）
```
点击未选中的物体
  ↓
RotatableSelectionBox.onMouseDown() → null (还没有选择框)
  ↓
hitTest → HIT
  ↓
isAlreadySelected = false
  ↓
执行选择逻辑:
  - dispatch selectObject()
  - rotatableSelection.setSelection([item])  ← 创建并显示选择框
  ↓
✅ 物体被选中，RotatableSelectionBox 显示
```

### 场景 2：点击已选中的物体（拖动）
```
点击已选中的物体
  ↓
RotatableSelectionBox.onMouseDown() → null (没有点击手柄)
  ↓
hitTest → HIT
  ↓
isAlreadySelected = true
  ↓
默认行为 = Drag:
  - currentOperationType = 'drag'
  - startHandler('drag', ...)
  - 保留 startPoint
  ↓
✅ 开始拖动，RotatableSelectionBox 保持显示
  ↓
拖动时:
  - onMouseDrag: dragHandler('drag', ...)
  - rotatableSelection.refresh()  ← 刷新选择框位置
  ↓
✅ 物体拖动，选择框跟随移动
```

### 场景 3：点击旋转手柄
```
点击旋转手柄
  ↓
RotatableSelectionBox.onMouseDown() → 'rotation'  ← 检测到手柄！
  ↓
currentOperationType = 'rotation'
  ↓
startHandler('rotation', ...)
  ↓
✅ 执行旋转，RotatableSelectionBox 保持显示并刷新
```

### 场景 4：点击缩放手柄
```
点击缩放手柄
  ↓
RotatableSelectionBox.onMouseDown() → 'scale-*'  ← 检测到手柄！
  ↓
currentOperationType = 'scale-*'
  ↓
startHandler('scale-*', ...)
  ↓
✅ 执行缩放，RotatableSelectionBox 保持显示并刷新
```

## 🎯 关键点

### RotatableSelectionBox 的职责
- ✅ **始终显示**（只要物体被选中）
- ✅ 检测旋转/缩放手柄点击
- ✅ 返回手柄类型或 null
- ✅ 在变换时自动刷新位置

### PointerTool 的职责
- ✅ 管理 RotatableSelectionBox 的显示（创建/刷新）
- ✅ 检查 RotatableSelectionBox 返回值
- ✅ **如果返回 null，默认行为 = Drag**
- ✅ 如果返回手柄类型，执行对应变换

## 💻 代码流程

### onMouseDown
```typescript
onMouseDown(event) {
  // 1. 先检查是否点击了手柄
  if (this.rotatableSelection) {
    const handleType = this.rotatableSelection.onMouseDown(event);
    if (handleType) {
      // 点击了手柄 → 执行对应变换
      this.currentOperationType = handleType;
      this.startHandler(handleType, ...);
      return;
    }
    // 没有点击手柄 → 继续检查物体
  }
  
  // 2. hitTest 检测物体
  if (hitResult && hitResult.item) {
    if (isAlreadySelected) {
      // ✅ 默认行为 = Drag
      this.currentOperationType = 'drag';
      this.startHandler('drag', ...);
      // ✅ RotatableSelectionBox 保持显示（之前已设置）
      return;
    }
    
    // 未选中 → 选择并显示 RotatableSelectionBox
    this.rotatableSelection.setSelection([item]);
  }
}
```

### onMouseDrag
```typescript
onMouseDrag(event) {
  if (this.currentOperationType) {
    // 执行对应的变换
    this.dragHandler(this.currentOperationType, event.point);
    
    // ✅ 刷新 RotatableSelectionBox 位置
    if (this.rotatableSelection) {
      this.rotatableSelection.refresh();
    }
    return;
  }
  
  // 否则绘制选择矩形...
}
```

### onMouseUp
```typescript
onMouseUp(event) {
  if (this.currentOperationType) {
    // 结束变换
    this.endHandler(this.currentOperationType);
    
    // ✅ 最后一次刷新 RotatableSelectionBox
    if (this.rotatableSelection) {
      this.rotatableSelection.refresh();
    }
    
    this.currentOperationType = null;
    this.startPoint = null;
    return;
  }
  
  // 处理选择矩形或空白点击...
}
```

## ✅ 总结

### 核心理解
1. **RotatableSelectionBox = 选择框，始终显示**
2. **RotatableSelectionBox.onMouseDown() 只检查手柄**
3. **返回 null → PointerTool 默认行为 = Drag**
4. **返回手柄类型 → 执行对应变换**

### 为什么这样设计？
- **简单清晰**：RotatableSelectionBox 只管手柄，不管其他
- **默认行为合理**：点击已选中物体 = 拖动（最常用）
- **职责分离**：UI 组件只负责 UI，逻辑在 PointerTool

### 关键修复
- ✅ RotatableSelectionBox 移除 drag 返回值
- ✅ RotatableSelectionBox 移除 boundingBox 检查
- ✅ PointerTool 在已选中物体时默认 drag
- ✅ RotatableSelectionBox 始终保持显示（直到选择其他物体或取消选择）

现在逻辑完全正确了！🎉

