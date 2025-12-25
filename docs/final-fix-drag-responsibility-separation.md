# 最终修复：职责分离 - RotatableSelectionBox 只处理旋转和缩放

## 🎯 核心理解

**RotatableSelectionBox 只负责旋转和缩放手柄，拖动（Drag）由 PointerTool 直接处理！**

## 🔧 关键修改

### 1. RotatableSelectionBox - 移除 Drag 处理

**修改前：**
```typescript
// ❌ 错误：RotatableSelectionBox 试图处理拖动
public onMouseDown(event): 'rotation' | 'scale-*' | 'drag' | null {
  // ... rotation handle ...
  // ... scale handles ...
  
  // ❌ 检查 bounding box，返回 'drag'
  if (this.boundingBox.contains(event.point)) {
    return 'drag';
  }
  
  return null;
}
```

**修改后：**
```typescript
// ✅ 正确：只处理旋转和缩放手柄
public onMouseDown(event): 'rotation' | 'scale-*' | null {
  // ... rotation handle ...
  // ... scale handles ...
  
  // ✅ 不检查 bounding box，不返回 'drag'
  return null;
}
```

### 2. PointerTool - 直接处理 Drag

**修改前：**
```typescript
// ❌ 错误：依赖 RotatableSelectionBox 返回 'drag'
if (this.rotatableSelection) {
  const handleType = this.rotatableSelection.onMouseDown(event);
  if (handleType) {
    // handleType 可能是 'drag'
    this.startHandler(handleType, ...);
    return;
  } else {
    // 没有返回值，不知道怎么处理
    this.currentOperationType = "drag"; // ??? 这是什么鬼
  }
}
```

**修改后：**
```typescript
// ✅ 正确：RotatableSelectionBox 只检查手柄
if (this.rotatableSelection) {
  const handleType = this.rotatableSelection.onMouseDown(event);
  if (handleType) {
    // handleType 只能是 'rotation' 或 'scale-*'
    this.startHandler(handleType, ...);
    return;
  }
  // 如果返回 null，继续检查是否点击了物体
}

// hitTest 检测物体
if (hitResult && hitResult.item) {
  const gameObjectId = hitResult.item.data?.gameObjectId;
  
  // 检查是否已选中
  const isAlreadySelected = ...;
  
  if (isAlreadySelected) {
    // ✅ PointerTool 直接处理拖动！
    this.currentOperationType = 'drag';
    this.startHandler('drag', new Set([gameObjectId]), event.point);
    return;
  }
  
  // 未选中 - 执行选择
  // ...
}
```

## 📊 数据流对比

### 旧流程（错误）
```
点击已选中的物体
  ↓
RotatableSelectionBox.onMouseDown()
  ├─ 检查旋转手柄 → 没有
  ├─ 检查缩放手柄 → 没有
  └─ 检查 boundingBox → ✅ 返回 'drag'
  ↓
PointerTool 收到 'drag'
  ↓
开始拖动

问题：
1. RotatableSelectionBox 承担了不该承担的职责
2. boundingBox 可能不包含点击的物体（扩展了 margin）
3. 逻辑混乱
```

### 新流程（正确）
```
点击已选中的物体
  ↓
RotatableSelectionBox.onMouseDown()
  ├─ 检查旋转手柄 → 没有
  ├─ 检查缩放手柄 → 没有
  └─ 返回 null （不处理其他情况）
  ↓
PointerTool 继续处理
  ↓
hitTest 检测物体 → HIT
  ↓
检查：物体已选中？ → 是
  ↓
PointerTool 直接设置 currentOperationType = 'drag'
  ↓
开始拖动

优势：
1. 职责清晰：RotatableSelectionBox 只处理手柄
2. 逻辑简单：PointerTool 统一管理所有操作
3. 易于维护
```

## 🎨 职责划分

### RotatableSelectionBox（UI 组件）
**只负责：**
- ✅ 绘制选择框（边界、手柄）
- ✅ 检测旋转手柄点击
- ✅ 检测缩放手柄点击
- ✅ 返回手柄类型或 null

**不负责：**
- ❌ 检测物体点击
- ❌ 处理拖动
- ❌ 管理选择状态

### PointerTool（协调器）
**负责：**
- ✅ 检测物体点击（hitTest）
- ✅ 管理选择状态
- ✅ 决定操作类型（rotation/scale/drag）
- ✅ 调用对应的 Handler
- ✅ 管理 currentOperationType
- ✅ 刷新 RotatableSelectionBox

### TransformHandlers（业务逻辑）
**负责：**
- ✅ 执行具体的变换
- ✅ 更新 Redux Store
- ✅ 创建关键帧

## 🔄 完整流程

### 场景 1：首次点击物体（选择）
```
点击未选中的物体
  ↓
RotatableSelectionBox.onMouseDown() → null
  ↓
PointerTool.hitTest() → HIT
  ↓
isAlreadySelected = false
  ↓
执行选择逻辑
  ├─ dispatch selectObject()
  └─ rotatableSelection.setSelection()
  ↓
✅ 物体被选中，显示选择框
```

### 场景 2：点击已选中的物体（拖动）
```
点击已选中的物体
  ↓
RotatableSelectionBox.onMouseDown() → null
  ↓
PointerTool.hitTest() → HIT
  ↓
isAlreadySelected = true
  ↓
currentOperationType = 'drag'
  ↓
startHandler('drag', ...)
  ↓
拖动鼠标
  ↓
onMouseDrag: currentOperationType = 'drag'
  ↓
dragHandler('drag', ...)
  ↓
✅ 物体跟随鼠标移动
```

### 场景 3：点击旋转手柄
```
点击旋转手柄
  ↓
RotatableSelectionBox.onMouseDown() → 'rotation'
  ↓
PointerTool 收到 'rotation'
  ↓
currentOperationType = 'rotation'
  ↓
startHandler('rotation', ...)
  ↓
✅ 执行旋转操作
```

### 场景 4：点击缩放手柄
```
点击缩放手柄
  ↓
RotatableSelectionBox.onMouseDown() → 'scale-corner' / 'scale-edge-*'
  ↓
PointerTool 收到缩放类型
  ↓
currentOperationType = 缩放类型
  ↓
startHandler(缩放类型, ...)
  ↓
✅ 执行缩放操作
```

## 💡 为什么这样设计？

### 1. 单一职责原则
- **RotatableSelectionBox**：只负责手柄 UI
- **PointerTool**：负责交互逻辑
- **Handlers**：负责业务逻辑

### 2. 逻辑清晰
```typescript
// PointerTool 的逻辑非常清晰：
if (点击了手柄) {
  // RotatableSelectionBox 告诉我点击了哪个手柄
  开始对应的变换;
} else if (点击了物体) {
  if (物体已选中) {
    开始拖动;
  } else {
    选择物体;
  }
}
```

### 3. 易于扩展
要添加新的手柄类型：
1. 在 RotatableSelectionBox 中添加手柄检测
2. 在 PointerTool 的 switch 中添加对应的 case
3. 实现对应的 Handler

### 4. 避免混乱
- RotatableSelectionBox 不需要知道物体是否选中
- RotatableSelectionBox 不需要调用 hitTest
- PointerTool 完全控制操作流程

## ✅ 最终效果

### 测试场景
1. **点击未选中的物体** → ✅ 选中并显示选择框
2. **点击已选中的物体** → ✅ 直接开始拖动
3. **点击旋转手柄** → ✅ 旋转
4. **点击缩放手柄** → ✅ 缩放
5. **点击空白处** → ✅ 取消选择

### 代码质量
- ✅ 职责分离清晰
- ✅ 逻辑简单易懂
- ✅ 易于维护和扩展
- ✅ 没有循环依赖
- ✅ 类型安全

## 🎉 总结

**核心原则：**
> RotatableSelectionBox 是纯 UI 组件，只负责手柄。
> PointerTool 是协调器，负责所有交互逻辑。
> Drag 不是手柄操作，应该由 PointerTool 处理！

**关键改动：**
1. ✅ RotatableSelectionBox 移除 drag 返回值
2. ✅ PointerTool 在检测到已选中物体时直接开始拖动
3. ✅ 简化 onMouseDrag 和 onMouseUp 逻辑

现在代码架构清晰，功能完整，易于维护！🎉

