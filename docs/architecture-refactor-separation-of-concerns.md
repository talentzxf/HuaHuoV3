# 架构重构：分离 UI 和业务逻辑

## 🎯 问题

之前 `RotatableSelectionBox` 承担了太多职责：
- ❌ 检测用户点击了哪个手柄
- ❌ 提取 gameObjectIds
- ❌ 调用对应的 Handler (translate/rotate/scale)
- ❌ 更新 Redux Store

**违反了单一职责原则！**

## ✅ 解决方案

### 新架构：清晰的职责分离

```
RotatableSelectionBox (纯 UI 组件)
  ↓ 返回操作类型
PointerTool (协调器)
  ↓ 调用对应 Handler
TransformHandlers (业务逻辑)
  ↓ 更新 Redux
Store → Renderer → Paper.js
```

## 📦 重构后的组件

### 1. RotatableSelectionBox (纯 UI)

**职责**：
- ✅ 绘制选择框和手柄
- ✅ 检测用户点击了哪个手柄
- ✅ **返回操作类型**（不调用 Handler）

**API**：
```typescript
// 返回操作类型，不执行业务逻辑
onMouseDown(event): 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag' | null

// 返回当前操作类型
onMouseDrag(event): 'rotation' | 'scale' | 'drag' | null

// 返回结束的操作类型
onMouseUp(event): 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag' | null

// 刷新选择框（Handler 改变位置后调用）
refresh(): void

// 获取选中项（PointerTool 用来提取 gameObjectIds）
getSelectedItems(): paper.Item[]
```

**不再做的事**：
- ❌ 不提取 gameObjectIds
- ❌ 不调用 Handler
- ❌ 不更新 Redux
- ❌ 不 import 任何 Handler

### 2. PointerTool (协调器)

**职责**：
- ✅ 接收 RotatableSelectionBox 返回的操作类型
- ✅ 提取 gameObjectIds
- ✅ 调用对应的 Handler
- ✅ 刷新选择框

**工作流程**：
```typescript
onMouseDown(event) {
  // 1. 询问 RotatableSelectionBox：点击了什么？
  const opType = this.rotatableSelection.onMouseDown(event);
  
  if (opType) {
    // 2. 提取 gameObjectIds
    const gameObjectIds = /* 从 selectedItems 提取 */;
    
    // 3. 调用对应的 Handler
    this.startHandler(opType, gameObjectIds, point);
  }
}

onMouseDrag(event) {
  if (this.currentOperationType) {
    // 调用对应的 Handler
    this.dragHandler(this.currentOperationType, point);
    
    // 刷新选择框
    this.rotatableSelection.refresh();
  }
}

onMouseUp(event) {
  if (this.currentOperationType) {
    // 结束 Handler
    this.endHandler(this.currentOperationType);
    
    // 刷新选择框
    this.rotatableSelection.refresh();
  }
}
```

### 3. TransformHandlers (业务逻辑)

**职责**：
- ✅ 接收目标 gameObjectIds
- ✅ 计算变换（translate/rotate/scale）
- ✅ 更新 Redux Store
- ✅ 创建关键帧

**不变**：
- Handler 完全不知道 UI 的存在
- Handler 只关心数据和业务逻辑

## 🔄 数据流对比

### 旧架构（混乱）
```
RotatableSelectionBox
  ├─ 检测点击
  ├─ 提取 gameObjectIds
  ├─ 调用 shapeRotateHandler.setTarget()
  ├─ 调用 shapeRotateHandler.beginMove()
  └─ 调用 shapeRotateHandler.dragging()
      └─ 更新 Redux
```
**问题**：UI 组件知道太多业务逻辑！

### 新架构（清晰）
```
RotatableSelectionBox (UI 层)
  └─ 返回 'rotation'
      ↓
PointerTool (协调层)
  ├─ 提取 gameObjectIds
  └─ 调用 shapeRotateHandler
      ↓
ShapeRotateHandler (业务层)
  └─ 更新 Redux
```
**优势**：每层只做自己的事！

## 📝 代码示例

### RotatableSelectionBox (纯 UI)
```typescript
// ❌ 旧代码：混杂业务逻辑
onMouseDown(event) {
  if (this.rotationHandle.contains(event.point)) {
    // ❌ 提取 gameObjectIds
    const gameObjectIds = new Set<string>();
    this.selectedItems.forEach(item => {
      if (item.data?.gameObjectId) {
        gameObjectIds.add(item.data.gameObjectId);
      }
    });
    
    // ❌ 调用 Handler
    shapeRotateHandler.setTarget(gameObjectIds);
    shapeRotateHandler.beginMove({ x, y });
    
    return true;
  }
}

// ✅ 新代码：只返回操作类型
onMouseDown(event) {
  if (this.rotationHandle.contains(event.point)) {
    this.isRotating = true;
    return 'rotation'; // 只返回类型，不做业务逻辑
  }
}
```

### PointerTool (协调器)
```typescript
// ✅ 新代码：处理业务逻辑
onMouseDown(event) {
  const opType = this.rotatableSelection.onMouseDown(event);
  
  if (opType) {
    // 提取 gameObjectIds
    const gameObjectIds = new Set<string>();
    this.rotatableSelection.getSelectedItems().forEach(item => {
      if (item.data?.gameObjectId) {
        gameObjectIds.add(item.data.gameObjectId);
      }
    });
    
    // 调用对应的 Handler
    this.startHandler(opType, gameObjectIds, event.point);
  }
}

private startHandler(opType, gameObjectIds, point) {
  switch (opType) {
    case 'rotation':
      shapeRotateHandler.setTarget(gameObjectIds);
      shapeRotateHandler.beginMove({ x: point.x, y: point.y });
      break;
    case 'drag':
      shapeTranslateHandler.setTarget(gameObjectIds);
      shapeTranslateHandler.beginMove({ x: point.x, y: point.y });
      break;
    // ... 其他类型
  }
}
```

## 🎨 优势

### 1. 单一职责原则
- **RotatableSelectionBox**：只负责 UI
- **PointerTool**：只负责协调
- **Handlers**：只负责业务逻辑

### 2. 可测试性
- UI 组件可以独立测试（不依赖 Handler）
- Handler 可以独立测试（不依赖 UI）
- 协调器可以 mock UI 和 Handler

### 3. 可维护性
- 修改 UI 不影响业务逻辑
- 修改业务逻辑不影响 UI
- 添加新的变换类型只需修改协调器

### 4. 解耦
- RotatableSelectionBox 不 import 任何 Handler
- Handler 不知道 UI 的存在
- 通过操作类型字符串连接

## 🔧 扩展性

### 添加新的变换类型
只需修改 3 个地方：

1. **RotatableSelectionBox**：添加新的返回类型
```typescript
onMouseDown(): '...' | 'new-transform-type' | null
```

2. **PointerTool**：添加新的 case
```typescript
private startHandler(opType, gameObjectIds, point) {
  switch (opType) {
    // ... 现有 case
    case 'new-transform-type':
      newHandler.setTarget(gameObjectIds);
      newHandler.beginMove(point);
      break;
  }
}
```

3. **创建新的 Handler**
```typescript
export class NewTransformHandler extends TransformHandlerBase {
  // 实现业务逻辑
}
```

## 📊 对比表

| 特性 | 旧架构 | 新架构 |
|------|--------|--------|
| **职责分离** | ❌ 混乱 | ✅ 清晰 |
| **耦合度** | ❌ 高 | ✅ 低 |
| **可测试性** | ❌ 差 | ✅ 好 |
| **可维护性** | ❌ 差 | ✅ 好 |
| **扩展性** | ❌ 难 | ✅ 易 |

## 🚀 总结

### 核心理念
> **RotatableSelectionBox 是纯 UI 组件，只返回操作类型，不执行业务逻辑！**

### 职责划分
```
RotatableSelectionBox
  ↓ 返回: 'rotation' | 'scale-corner' | 'drag' | ...
PointerTool
  ↓ 调用: shapeRotateHandler | shapeScaleHandler | shapeTranslateHandler
TransformHandlers
  ↓ 更新: Redux Store
```

### 关键改进
1. ✅ RotatableSelectionBox 不再 import 任何 Handler
2. ✅ RotatableSelectionBox 不再提取 gameObjectIds
3. ✅ RotatableSelectionBox 只返回操作类型字符串
4. ✅ PointerTool 负责协调 UI 和业务逻辑
5. ✅ Handlers 完全独立，不知道 UI 的存在

### 最终效果
- 代码更清晰
- 职责更明确
- 更易测试
- 更易维护
- 更易扩展

**这就是正确的架构！** 🎉

