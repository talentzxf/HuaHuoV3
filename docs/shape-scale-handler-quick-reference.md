# Shape Scale Handler 快速参考

## 📦 新增文件
```
handlers/
  └─ ShapeScaleHandler.ts (新建，3个类)
     ├─ ShapeScaleHandler (统一缩放)
     ├─ ShapeHorizontalScaleHandler (水平缩放)
     └─ ShapeVerticalScaleHandler (垂直缩放)
```

## 📝 修改文件
```
handlers/
  ├─ index.ts (导出缩放处理器)
  └─ TransformHandlerMap.ts (注册 handlers)

tools/
  └─ RotatableSelectionBox.ts (集成缩放功能)
```

## 🎯 三种缩放模式

### 1. 统一缩放 (Uniform Scaling)
- **触发**：拖动 4 个角手柄
- **效果**：同时缩放 x 和 y 轴
- **Handler**：`shapeScaleHandler`

### 2. 水平缩放 (Horizontal Scaling)
- **触发**：拖动左右边缘手柄
- **效果**：只缩放 x 轴，y 轴保持不变
- **Handler**：`shapeHorizontalScaleHandler`

### 3. 垂直缩放 (Vertical Scaling)
- **触发**：拖动上下边缘手柄
- **效果**：只缩放 y 轴，x 轴保持不变
- **Handler**：`shapeVerticalScaleHandler`

## 🔧 使用方法

### 用户操作
```
选中物体 → 拖动手柄 → 缩放 → 松开鼠标
```

### 手柄映射
```
     [top edge]
         ↑
    ┌────┬────┐
[left] │    │    │ [right]
edge   │ 物体│    │  edge
    └────┴────┘
         ↓
   [bottom edge]
    
角手柄: ● (统一缩放)
边手柄: ■ (方向缩放)
```

## 💻 代码示例

### 基本使用
```typescript
import { 
  shapeScaleHandler,
  shapeHorizontalScaleHandler,
  shapeVerticalScaleHandler 
} from './handlers/ShapeScaleHandler';

// 统一缩放
shapeScaleHandler.setTarget(gameObjectIds);
shapeScaleHandler.beginMove({ x: 100, y: 100 });
shapeScaleHandler.dragging({ x: 150, y: 150 });
shapeScaleHandler.endMove();

// 水平缩放
shapeHorizontalScaleHandler.setTarget(gameObjectIds);
shapeHorizontalScaleHandler.beginMove({ x: 100, y: 100 });
shapeHorizontalScaleHandler.dragging({ x: 150, y: 100 });
shapeHorizontalScaleHandler.endMove();
```

### 集成到选择框
```typescript
// 角手柄点击
if (cornerHandle.contains(event.point)) {
  shapeScaleHandler.setTarget(gameObjectIds);
  shapeScaleHandler.beginMove({ x, y });
}

// 边缘手柄点击
if (edgeHandle.contains(event.point)) {
  const edgeIndex = edgeHandle.data.edgeIndex;
  
  if (edgeIndex === 0 || edgeIndex === 2) {
    // 上/下边缘 → 垂直缩放
    shapeVerticalScaleHandler.setTarget(gameObjectIds);
  } else {
    // 左/右边缘 → 水平缩放
    shapeHorizontalScaleHandler.setTarget(gameObjectIds);
  }
  
  handler.beginMove({ x, y });
}
```

## 🧮 缩放算法

### 缩放因子计算
```typescript
const vec1 = startPos - scaleCenter;
const vec2 = currentPos - scaleCenter;
const scaleFactor = length(vec2) / length(vec1);
```

### 三种模式实现
```typescript
// 统一缩放
newScale = {
  x: originalScale.x * scaleFactor,
  y: originalScale.y * scaleFactor
};

// 水平缩放
newScale = {
  x: originalScale.x * scaleFactor,
  y: originalScale.y  // 不变
};

// 垂直缩放
newScale = {
  x: originalScale.x,  // 不变
  y: originalScale.y * scaleFactor
};
```

## 📊 数据流
```
用户拖动手柄
  ↓
RotatableSelectionBox 识别手柄类型
  ↓
选择对应的 ScaleHandler
  ↓
计算缩放因子
  ↓
updateComponentPropsWithKeyFrame
  ↓
Redux Store 更新
  ↓
PaperRenderer 渲染
```

## 🎨 缩放中心

### 当前实现
```typescript
// 所有选中物体的位置平均值
scaleCenter = {
  x: sumX / count,
  y: sumY / count
};
```

### 未来扩展
- 选择框中心
- 对角手柄点
- 用户自定义点

## ⚠️ 注意事项

### 1. 除零保护
```typescript
if (length1 < 0.001) return;
```

### 2. 缩放限制（可选）
```typescript
const MIN_SCALE = 0.1;
const MAX_SCALE = 10.0;
const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
```

### 3. 负缩放（镜像）
当前允许负缩放，拖过缩放中心会产生镜像效果。

## 🧪 测试清单

- [ ] 角手柄统一缩放
- [ ] 左/右边缘水平缩放
- [ ] 上/下边缘垂直缩放
- [ ] 多物体同时缩放
- [ ] 缩放后移动
- [ ] 缩放后旋转
- [ ] 快速拖动
- [ ] 拖到缩放中心
- [ ] 反向拖动（负缩放）

## 🐛 调试

### 控制台日志
```
[RotatableSelectionBox] Corner handle clicked (uniform scaling)
[ShapeScaleHandler] Scale center: {x: 100, y: 100}
[ShapeScaleHandler] Scale factor: 1.414
```

### 检查 Redux
```javascript
// 在浏览器控制台
const state = store.getState();
const transform = state.engine.components.byId[componentId];
console.log('Scale:', transform.props.scale);
```

## 🔗 相关文件
- `ShapeScaleHandler.ts` - 缩放处理器实现
- `TransformHandlerBase.ts` - 基类
- `RotatableSelectionBox.ts` - UI 集成
- `Transform.ts` - Transform 组件
- `PaperRenderer.ts` - 渲染器

## 📚 详细文档
参见：`shape-scale-handler-implementation.md`

## ✅ 完成状态
- ✅ 统一缩放
- ✅ 水平缩放
- ✅ 垂直缩放
- ✅ Redux 同步
- ✅ 自动创建关键帧
- ✅ 与选择框集成

