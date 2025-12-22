# 支持旋转的自定义选择框实现

## ✅ 已完成的工作

### 1. 创建 RotatableSelectionBox 类

**位置**：`hh-ide/src/components/panels/tools/RotatableSelectionBox.ts`

**功能**：
- ✅ 自定义选择框渲染（矩形边框 + 控制点）
- ✅ 8个缩放控制点（4个角 + 4个边）
- ✅ 1个旋转控制点（顶部上方，绿色）
- ✅ 旋转控制线（虚线连接旋转点和顶边）
- ✅ 支持旋转操作
- ✅ 支持拖动移动（TODO: 需要与 Redux 集成）
- ⏳ 缩放操作（预留接口，待实现）

### 2. 集成到 PointerTool

**修改**：`hh-ide/src/components/panels/tools/PointerTool.ts`

**集成点**：
1. ✅ 导入 `RotatableSelectionBox`
2. ✅ 添加私有成员 `rotatableSelection`
3. ✅ `onMouseDown` - 检测选择框控制点点击，更新选择框
4. ✅ `onMouseDrag` - 处理旋转/缩放拖动
5. ✅ `onMouseUp` - 完成旋转/缩放操作

## 🎨 视觉设计

### 选择框外观

```
        🟢 ← 旋转控制点（绿色圆形，较大）
        |  （虚线连接）
    ⚪─────⚪─────⚪
    │             │
    ⚪             ⚪  ← 边缘控制点（白色圆形）
    │             │
    ⚪─────⚪─────⚪
        ↑ 角控制点（白色圆形）
```

**颜色方案**：
- 边框：蓝色 `#3380FF` 虚线
- 角控制点：白色填充 + 蓝色边框
- 边缘控制点：白色填充 + 蓝色边框
- 旋转控制点：绿色填充 `#4DCC66` + 深绿边框
- 旋转连接线：蓝色虚线

**尺寸**：
- 控制点半径：4px
- 旋转控制点半径：5px
- 旋转控制点距离顶边：30px
- 边框宽度：1px

## 🔧 核心功能

### 1. 旋转操作

```typescript
// 用户拖动绿色旋转控制点
handleRotation(point: paper.Point): void {
  // 计算当前角度
  const currentAngle = this.calculateAngle(point);
  const deltaAngle = currentAngle - this.initialRotation;

  // 旋转所有选中的 items
  this.selectedItems.forEach(item => {
    item.rotate(deltaAngle, this.rotationCenter!);
  });

  // 更新选择框
  this.updateSelectionBox();
}
```

**工作原理**：
1. 鼠标按下旋转点时，记录初始角度
2. 鼠标拖动时，计算当前角度
3. 计算角度差值 `deltaAngle`
4. 以选择框中心为旋转中心，旋转所有选中的 items
5. 更新选择框以匹配新的 bounds

### 2. 拖动移动

```typescript
handleDragging(point: paper.Point): void {
  const delta = point.subtract(this.dragStartPoint);

  // 移动所有选中的 items
  this.selectedItems.forEach(item => {
    item.position = item.position.add(delta);
  });

  this.dragStartPoint = point;
  this.updateSelectionBox();
}
```

### 3. 缩放操作（TODO）

```typescript
handleScaling(point: paper.Point): void {
  // TODO: 实现缩放逻辑
  // 需要考虑：
  // 1. 按住 Shift 键等比缩放
  // 2. 从对角点缩放
  // 3. 从边缘中点缩放（单向）
}
```

## 📊 事件流程

### 选择物体流程

```
1. 用户点击 GameObject
   ↓
2. PointerTool.onMouseDown
   ↓
3. hitTest 检测到 item
   ↓
4. 创建/获取 rotatableSelection
   ↓
5. 调用 rotatableSelection.setSelection([item])
   ↓
6. 创建选择框（边框 + 控制点）
   ↓
7. 选择框显示在 item 周围
```

### 旋转流程

```
1. 用户点击旋转控制点（绿色圆圈）
   ↓
2. PointerTool.onMouseDown
   ↓
3. rotatableSelection.onMouseDown(event)
   - 检测到点击在 rotationHandle 上
   - 设置 isRotating = true
   - 记录 initialRotation
   - 返回 true（表示已处理）
   ↓
4. PointerTool 设置 startPoint = null（阻止其他操作）
   ↓
5. 用户拖动鼠标
   ↓
6. PointerTool.onMouseDrag
   ↓
7. rotatableSelection.onMouseDrag(event)
   - 检测到 isRotating = true
   - 调用 handleRotation(event.point)
   - 计算角度变化
   - 旋转所有选中的 items
   - 更新选择框
   - 返回 true
   ↓
8. 用户释放鼠标
   ↓
9. PointerTool.onMouseUp
   ↓
10. rotatableSelection.onMouseUp(event)
    - 设置 isRotating = false
    - 清理状态
    - 返回 true
```

## 🐛 已知问题和 TODO

### 1. ❌ 旋转不会更新 Redux

**问题**：
```typescript
// RotatableSelectionBox.ts
this.selectedItems.forEach(item => {
  item.rotate(deltaAngle, this.rotationCenter!);  // ❌ 只更新了 Paper.js
});
```

**解决方案**：
- 需要在旋转结束时（onMouseUp）将旋转角度同步到 Redux
- 调用 `updateComponentPropsWithKeyFrame` 更新 Transform.rotation

### 2. ⏳ 缩放未实现

**需要实现**：
- 角控制点：对角缩放
- 边缘控制点：单向缩放
- Shift 键：等比缩放
- 同步到 Redux：更新 Transform.scale

### 3. ❌ 移动不会更新 Redux

**问题**：
```typescript
this.selectedItems.forEach(item => {
  item.position = item.position.add(delta);  // ❌ 只更新了 Paper.js
});
```

**解决方案**：
- 移动应该继续使用现有的 `TransformHandler`
- 或者在 onMouseUp 时同步到 Redux

### 4. ⚠️ 多选未实现

**当前**：
- 只支持单个 item 的选择框

**未来**：
- 需要支持多个 items 的组合选择框
- 计算所有 items 的联合 bounds

### 5. ⚠️ 选择框不跟随移动

**问题**：
- 使用 TransformHandler 移动物体时，选择框不会实时更新

**解决方案**：
- 在 TransformHandler 的 dragging 回调中更新选择框
- 或者监听 Redux 的 updateComponentProps action

## 🔄 与现有系统集成

### 与 TransformHandler 的关系

**当前冲突**：
1. RotatableSelectionBox 有自己的拖动逻辑
2. TransformHandler 也有拖动逻辑
3. 两者会冲突

**解决方案**：
```typescript
// 在 PointerTool.onMouseDown 中
if (handleClicked) {
  // 用户点击了选择框控制点（旋转/缩放）
  // 不设置 TransformHandler
  this.startPoint = null;
  return;
}

// 否则，设置 TransformHandler 处理移动
this.setTransformHandler(gameObjectId, event.point, handler);
```

**优先级**：
1. 选择框控制点 > TransformHandler
2. 点击 item 本身 > 使用 TransformHandler 移动

### 与 Redux 的集成（待完成）

**需要添加**：
```typescript
// RotatableSelectionBox.ts
import { getEngineStore } from '@huahuo/engine';
import { updateComponentPropsWithKeyFrame } from '@huahuo/engine';

public onMouseUp(event: paper.ToolEvent): boolean {
  const wasHandled = this.isDragging || this.isRotating || this.isScaling;
  
  if (this.isRotating) {
    // ✅ 同步旋转到 Redux
    this.syncRotationToRedux();
  }
  
  if (this.isScaling) {
    // ✅ 同步缩放到 Redux
    this.syncScaleToRedux();
  }
  
  // 清理状态...
  return wasHandled;
}

private syncRotationToRedux(): void {
  this.selectedItems.forEach(item => {
    const gameObjectId = item.data?.gameObjectId;
    if (!gameObjectId) return;

    // 获取 Transform component
    // 更新 rotation 属性
    // dispatch updateComponentPropsWithKeyFrame
  });
}
```

## 📝 使用方法

### 旋转物体

1. ✅ 选择一个 GameObject
2. ✅ 会出现蓝色选择框和控制点
3. ✅ 顶部上方有绿色旋转控制点
4. ✅ 拖动绿色控制点进行旋转
5. ⏳ 释放鼠标后同步到 Redux（待实现）

### 缩放物体（TODO）

1. ✅ 选择一个 GameObject
2. ✅ 看到 8 个白色控制点
3. ⏳ 拖动角控制点进行对角缩放（待实现）
4. ⏳ 拖动边缘控制点进行单向缩放（待实现）

### 移动物体

1. ✅ 选择一个 GameObject
2. ✅ 点击选择框内部（不是控制点）
3. ✅ 拖动进行移动
4. ⏳ 释放鼠标后同步到 Redux（待实现）
5. 或者使用现有的 TransformHandler（已有 Redux 同步）

## 🎉 总结

**已完成** ✅：
- 自定义选择框 UI
- 旋转控制点和旋转逻辑
- 缩放控制点 UI（功能未实现）
- 基本的事件处理流程
- 与 PointerTool 的集成

**待完成** ⏳：
- 旋转同步到 Redux
- 缩放功能实现
- 缩放同步到 Redux
- 移动同步到 Redux（或使用现有 TransformHandler）
- 多选支持
- 选择框实时更新

**下一步**：
1. 实现 `syncRotationToRedux()` 方法
2. 实现缩放功能
3. 测试旋转是否正确记录 keyframe
4. 优化选择框更新机制

现在你已经有了一个支持旋转的自定义选择框基础！🎊

