# Shape Rotate Handler Implementation

## 概述
实现了基于 `TransformHandlerBase` 的 `ShapeRotateHandler`，参考了原有的旋转处理逻辑，实现用户通过旋转手柄旋转物体的功能。

## 实现的文件

### 1. ShapeRotateHandler.ts
新建的旋转处理器，核心功能：

#### 关键特性
- **旋转中心计算**：基于所有选中物体的位置平均值计算旋转中心（未来可支持用户自定义）
- **实时 Redux 同步**：拖动时实时更新 Redux Store 并自动创建关键帧
- **角度吸附**：按住 Shift 键可按 10° 增量吸附旋转角度
- **可视化反馈**：绘制旋转指示器（扇形/圆环），显示旋转角度和方向
  - 黄色：顺时针旋转
  - 红色：逆时针旋转
  - 多圈显示：支持显示超过 360° 的旋转

#### 核心方法
```typescript
protected onBeginMove(position): void
  - 保存初始旋转角度
  - 计算旋转中心（所有选中物体的中心）
  - 缓存 Transform Component ID

protected onDragging(position): void
  - 计算当前角度和增量旋转
  - 应用角度吸附（如果按 Shift）
  - 更新 Redux Store（通过 updateComponentPropsWithKeyFrame）
  - 绘制旋转指示器

protected onEndMove(): void
  - 清理旋转指示器
  - 清理状态
```

### 2. 更新的文件

#### TransformHandlerMap.ts
```typescript
// 注册旋转处理器
this.registerHandler('rotation', shapeRotateHandler);
```

#### RotatableSelectionBox.ts
修改旋转逻辑，委托给 `ShapeRotateHandler`：

```typescript
// onMouseDown: 点击旋转手柄时
if (this.rotationHandle && this.rotationHandle.contains(event.point)) {
  const gameObjectIds = new Set<string>();
  this.selectedItems.forEach(item => {
    if (item.data?.gameObjectId) {
      gameObjectIds.add(item.data.gameObjectId);
    }
  });
  
  shapeRotateHandler.setTarget(gameObjectIds);
  shapeRotateHandler.beginMove({ x: event.point.x, y: event.point.y });
}

// onMouseDrag: 拖动时
shapeRotateHandler.dragging({ x: event.point.x, y: event.point.y });

// onMouseUp: 松开时
shapeRotateHandler.endMove();
```

删除了旧的 `handleRotation()` 和 `syncRotationToRedux()` 方法。

#### index.ts
```typescript
export { ShapeRotateHandler, shapeRotateHandler } from './ShapeRotateHandler';
```

## 工作流程

### 用户交互流程
1. **选择物体**：用户点击物体，`RotatableSelectionBox` 显示选择框和旋转手柄
2. **开始旋转**：用户点击绿色旋转手柄（位于选择框上方）
   - `RotatableSelectionBox.onMouseDown` 检测到点击
   - 提取选中物体的 `gameObjectId`
   - 调用 `shapeRotateHandler.setTarget()` 和 `beginMove()`
3. **拖动旋转**：用户拖动鼠标
   - `RotatableSelectionBox.onMouseDrag` 调用 `shapeRotateHandler.dragging()`
   - Handler 计算旋转角度增量
   - 更新 Redux Store 中的 `Transform.rotation` 属性
   - 自动创建关键帧（通过 `updateComponentPropsWithKeyFrame`）
   - 绘制可视化旋转指示器
4. **结束旋转**：用户松开鼠标
   - `RotatableSelectionBox.onMouseUp` 调用 `shapeRotateHandler.endMove()`
   - 清理可视化指示器
   - 清理状态

### Redux 数据流
```
用户拖动 
  → ShapeRotateHandler.onDragging
  → updateComponentPropsWithKeyFrame
  → ComponentSlice.updateComponentProps (更新 props.rotation)
  → ComponentSlice.setPropertyKeyFrame (创建关键帧)
  → LayerSlice.addKeyFrame (添加时间轴标记)
  → 渲染器监听 Redux 变化
  → 更新 Paper.js 渲染（Transform.applyToRenderer）
```

## 旋转中心设计

### 当前实现
- 旋转中心 = 所有选中物体的位置平均值
- 在 `onBeginMove` 中计算：
  ```typescript
  sumX += transformComponent.props.position.x;
  sumY += transformComponent.props.position.y;
  count++;
  
  this.rotationCenter = {
    x: sumX / count,
    y: sumY / count
  };
  ```

### 未来扩展
为支持用户移动旋转中心，预留了以下设计：

1. **旋转中心可视化**：在旋转中心位置显示一个可拖动的手柄
2. **存储旋转中心**：在 Redux Store 中为每个物体/选区存储自定义旋转中心
3. **优先级**：自定义旋转中心 > 默认中心（位置平均值）

```typescript
// 未来实现示例
protected onBeginMove(position): void {
  // 优先使用自定义旋转中心
  const customPivot = this.getCustomPivot(this.targetGameObjects);
  if (customPivot) {
    this.rotationCenter = customPivot;
  } else {
    // 使用默认：选中物体的中心
    this.rotationCenter = this.calculateDefaultCenter();
  }
}
```

## 可视化反馈

### 旋转指示器
- **多圈显示**：旋转超过 360° 时显示多个圆环
- **残余角度**：显示不足一圈的扇形
- **颜色编码**：
  - 顺时针（正角度）：黄色
  - 逆时针（负角度）：红色
- **半径递增**：每圈的半径递增，清晰区分多圈旋转

### 绘图方法
```typescript
drawRotationIndicator(center, degreesRotated)
  ├─ drawDonut(position, radiusSmall, radiusBig, startAngle, endAngle)
  └─ drawFanShape(position, radius, startAngle, endAngle)
```

## 角度吸附功能

### 实现
- 按住 Shift 键：角度吸附到 10° 的倍数
- 实现方式：
  ```typescript
  if (this.pressingShift) {
    effectiveRotation = Math.round(this.totalRotation / this.SNAP_ANGLE_DEGREE) * this.SNAP_ANGLE_DEGREE;
  }
  ```

### 用户体验
- 精确旋转：按住 Shift 可以快速旋转到常用角度（0°, 90°, 180°, 270° 等）
- 平滑过渡：释放 Shift 后立即恢复自由旋转

## 关键帧自动创建

### 机制
通过 `updateComponentPropsWithKeyFrame` 在每次拖动时自动创建关键帧：
```typescript
(engineStore.dispatch as any)(updateComponentPropsWithKeyFrame({
  id: transformComponentId,
  patch: {
    rotation: newRotation
  }
}));
```

### 优势
1. **实时预览**：拖动时立即看到效果
2. **动画支持**：自动在时间轴当前帧创建关键帧
3. **撤销/重做**：未来可基于关键帧实现撤销功能（目前依赖 Redux 的 time-travel）

## 与原始 ShapeRotateHandler 的对比

### 相似之处
- ✅ 角度计算逻辑
- ✅ 旋转指示器绘制
- ✅ Shift 键角度吸附
- ✅ 旋转中心概念

### 差异之处
| 特性 | 原始实现 | 新实现 |
|------|---------|--------|
| 基类 | `ShapeTranslateMorphBase` | `TransformHandlerBase` |
| 数据存储 | Paper.js item 直接旋转 | Redux Store |
| 撤销/重做 | `ShapeRotateCommand` + `UndoManager` | Redux + 关键帧系统 |
| 旋转点 | `targetShape.pivotPosition` | 计算的中心点（未来可自定义）|
| 提示信息 | `setPrompt(i18n.t(...))` | 待实现 |

### 架构改进
1. **分离关注点**：选择框只负责 UI，Handler 负责业务逻辑
2. **统一数据流**：所有变换都通过 Redux，便于状态管理
3. **扩展性**：易于添加新的变换类型（缩放、斜切等）

## 测试要点

### 功能测试
- [ ] 单个物体旋转
- [ ] 多个物体同时旋转（绕共同中心）
- [ ] 按住 Shift 角度吸附
- [ ] 旋转超过 360° 的可视化
- [ ] 关键帧自动创建
- [ ] 与时间轴同步

### 边界情况
- [ ] 空选择（无物体）
- [ ] 锁定物体（应跳过）
- [ ] 快速拖动（角度突变）
- [ ] 松开 Shift 键时的平滑过渡

### 性能测试
- [ ] 大量物体同时旋转
- [ ] 长时间拖动（内存泄漏）
- [ ] 旋转指示器频繁重绘

## 后续工作

### 短期（必需）
1. ✅ 实现基本旋转功能
2. ✅ 集成到选择框
3. ✅ Redux 同步
4. ⏳ 添加状态栏提示（`setPrompt`）
5. ⏳ 完善错误处理

### 中期（增强）
1. ⏳ 实现自定义旋转中心
2. ⏳ 旋转中心可视化（十字准星）
3. ⏳ 旋转中心拖动功能
4. ⏳ 优化多物体旋转性能
5. ⏳ 添加旋转角度数值输入框

### 长期（优化）
1. ⏳ 撤销/重做系统集成
2. ⏳ 动画曲线支持
3. ⏳ 旋转约束（限制角度范围）
4. ⏳ 3D 旋转支持（如需要）

## 使用示例

### 基本用法
```typescript
// 在 PointerTool 或其他工具中
import { shapeRotateHandler } from './handlers/ShapeRotateHandler';

// 设置目标物体
const gameObjectIds = new Set(['obj1', 'obj2']);
shapeRotateHandler.setTarget(gameObjectIds);

// 开始旋转
shapeRotateHandler.beginMove({ x: 100, y: 100 });

// 拖动中
shapeRotateHandler.dragging({ x: 120, y: 110 });

// 结束旋转
shapeRotateHandler.endMove();
```

### 通过选择框
```typescript
// 用户只需点击绿色旋转手柄即可
// RotatableSelectionBox 自动调用 ShapeRotateHandler
```

## 注意事项

1. **旋转中心**：当前使用平均位置，未来需要支持自定义
2. **Paper.js 同步**：依赖渲染器监听 Redux 变化更新 Paper.js
3. **关键帧管理**：每次拖动都会创建关键帧，可能需要优化（如合并连续帧）
4. **事件监听器**：`destroy()` 方法用于清理事件监听器，但当前未被调用（需要在适当时机调用）

## 总结

成功实现了基于 Redux 的旋转处理器，完整支持：
- ✅ 单/多物体旋转
- ✅ 角度吸附
- ✅ 可视化反馈
- ✅ 关键帧自动创建
- ✅ 与选择框无缝集成

为未来的自定义旋转中心功能预留了扩展空间。

