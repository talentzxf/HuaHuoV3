# ShapeRotateHandler 快速参考

## 📁 新增文件
```
hh-ide/src/components/panels/tools/handlers/
  └─ ShapeRotateHandler.ts  (新建，311行)
```

## 📝 修改文件
```
hh-ide/src/components/panels/tools/handlers/
  ├─ index.ts (添加导出)
  └─ TransformHandlerMap.ts (注册 rotation handler)

hh-ide/src/components/panels/tools/
  └─ RotatableSelectionBox.ts (集成 ShapeRotateHandler)
```

## 🎯 核心功能

### 用户操作
1. 选中物体 → 出现选择框和绿色旋转手柄
2. 拖动旋转手柄 → 旋转物体
3. 按住 Shift → 角度吸附到 10° 倍数

### 可视化反馈
- 黄色圆环/扇形：顺时针旋转
- 红色圆环/扇形：逆时针旋转
- 多圈显示：超过 360° 旋转

### 数据同步
- 实时更新 Redux Store
- 自动创建关键帧
- 渲染器自动同步显示

## 🔧 关键代码

### 使用 Handler
```typescript
import { shapeRotateHandler } from './handlers/ShapeRotateHandler';

// 设置目标物体
shapeRotateHandler.setTarget(gameObjectIds);

// 开始旋转
shapeRotateHandler.beginMove({ x, y });

// 拖动
shapeRotateHandler.dragging({ x, y });

// 结束
shapeRotateHandler.endMove();
```

### 注册到 TransformHandlerMap
```typescript
this.registerHandler('rotation', shapeRotateHandler);
```

### 在选择框中使用
```typescript
// onMouseDown
if (this.rotationHandle && this.rotationHandle.contains(event.point)) {
  const gameObjectIds = /* 从选中项获取 */;
  shapeRotateHandler.setTarget(gameObjectIds);
  shapeRotateHandler.beginMove({ x: event.point.x, y: event.point.y });
}

// onMouseDrag
shapeRotateHandler.dragging({ x: event.point.x, y: event.point.y });

// onMouseUp
shapeRotateHandler.endMove();
```

## 🚀 旋转中心

### 当前实现
```typescript
// 使用所有选中物体位置的平均值
this.rotationCenter = {
  x: sumX / count,
  y: sumY / count
};
```

### 未来扩展
```typescript
// 支持自定义旋转中心
const customPivot = this.getCustomPivot(this.targetGameObjects);
if (customPivot) {
  this.rotationCenter = customPivot;
} else {
  this.rotationCenter = this.calculateDefaultCenter();
}
```

## 📊 Redux 数据流
```
ShapeRotateHandler.onDragging()
  ↓
updateComponentPropsWithKeyFrame({
  id: transformComponentId,
  patch: { rotation: newRotation }
})
  ↓
ComponentSlice.updateComponentProps
  ↓
ComponentSlice.setPropertyKeyFrame
  ↓
LayerSlice.addKeyFrame
  ↓
Renderer 监听变化
  ↓
更新 Paper.js 显示
```

## 🎨 可视化指示器

### 绘制方法
```typescript
drawRotationIndicator(center, degrees)
  ├─ drawDonut(position, r1, r2, startAngle, endAngle)
  └─ drawFanShape(position, radius, startAngle, endAngle)
```

### 显示规则
- 完整圆环：每 360° 一个
- 扇形：不足 360° 的部分
- 颜色：正角度黄色，负角度红色
- 半径：递增显示多圈

## ⌨️ 快捷键
- **Shift**：按住时角度吸附到 10° 倍数

## 🧪 测试要点
- [ ] 单物体旋转
- [ ] 多物体旋转
- [ ] Shift 角度吸附
- [ ] 超过 360° 旋转
- [ ] 关键帧创建
- [ ] 时间轴同步

## 📌 注意事项
1. 旋转中心当前使用平均位置，后续支持自定义
2. 每次拖动都创建关键帧
3. 依赖渲染器监听 Redux 变化
4. 记得在合适时机调用 `destroy()` 清理监听器

## 🔗 相关文件
- `TransformHandlerBase.ts` - 基类
- `ShapeTranslateHandler.ts` - 参考实现
- `RotatableSelectionBox.ts` - UI 集成
- `Transform.ts` - 组件定义
- `updateComponentPropsWithKeyFrame` - Redux action

## 📖 详细文档
参见：
- `shape-rotate-handler-implementation.md` - 完整实现文档
- `shape-rotate-handler-summary.md` - 实现总结

