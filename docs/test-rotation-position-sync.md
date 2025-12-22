# 测试：旋转后移动物体位置同步问题

## 测试目的
验证旋转物体后移动，位置是否正确同步到 Redux Store。

## 修复内容

### 1. PaperRenderer.updateItemTransform
- ✅ 修复旋转处理：先重置旋转为 0，再设置绝对角度
- ✅ 添加详细日志

### 2. ShapeTranslateHandler
- ✅ 添加详细日志以跟踪位置更新

## 测试步骤

### 准备工作
1. 打开浏览器开发者工具（F12）
2. 打开 Console 标签
3. 打开 Redux DevTools

### 测试场景 1：正常移动（无旋转）

1. 选中一个物体
2. 拖动物体移动一段距离
3. **预期结果：**
   - ✅ 物体视觉上移动
   - ✅ Redux DevTools 中 `Transform.position` 更新
   - ✅ 控制台输出：
     ```
     [ShapeTranslateHandler] onBeginMove - Reading initial positions from Redux Store
     [ShapeTranslateHandler] GameObject xxx initial position from Store: {x: 100, y: 100}
     [ShapeTranslateHandler] onDragging - delta: (50.00, 30.00)
     [ShapeTranslateHandler] Updating GameObject xxx: initial (100, 100) -> new (150.00, 130.00)
     [PaperRenderer] updateItemTransform: {
       oldPosition: {x: 100, y: 100},
       newPosition: {x: 150, y: 130},
       ...
     }
     [PaperRenderer] After update: {actualPosition: {x: 150, y: 130}, ...}
     ```

### 测试场景 2：旋转后移动（重点测试）

1. 选中一个物体
2. 记录当前位置（Redux DevTools → Transform.position）
   - 例如：`{x: 100, y: 100}`
3. 点击绿色旋转手柄，旋转物体（例如旋转 45°）
4. **观察控制台输出：**
   ```
   [ShapeRotateHandler] ...
   [PaperRenderer] updateItemTransform: {
     oldRotation: 0,
     newRotation: 45,
     ...
   }
   [PaperRenderer] After update: {actualRotation: 45}
   ```
5. 检查 Redux DevTools，确认旋转已保存
6. 现在拖动物体移动一段距离
7. **预期结果（修复后）：**
   - ✅ 物体视觉上移动
   - ✅ Redux DevTools 中 `Transform.position` **正确更新**
   - ✅ 控制台输出：
     ```
     [ShapeTranslateHandler] onBeginMove - Reading initial positions from Redux Store
     [ShapeTranslateHandler] GameObject xxx initial position from Store: {x: 100, y: 100}
     [ShapeTranslateHandler] onDragging - delta: (50.00, 30.00)
     [ShapeTranslateHandler] Updating GameObject xxx: initial (100, 100) -> new (150.00, 130.00)
     [PaperRenderer] updateItemTransform: {
       oldPosition: {x: 100, y: 100},  ← 应该和 Store 中的位置一致
       newPosition: {x: 150, y: 130},
       oldRotation: 45,
       newRotation: 45,  ← 旋转保持不变
       ...
     }
     [PaperRenderer] After update: {
       actualPosition: {x: 150, y: 130},
       actualRotation: 45
     }
     ```
   - ✅ Redux DevTools 中位置从 `{x: 100, y: 100}` 变为 `{x: 150, y: 130}`

### 测试场景 3：多次旋转和移动

1. 选中物体
2. 旋转 30°
3. 移动物体
4. 再旋转 60°
5. 再移动物体
6. **预期结果：**
   - ✅ 每次移动后，Store 中的位置都正确更新
   - ✅ 旋转角度累积正确（应该是 90°）

### 测试场景 4：多个物体同时旋转和移动

1. 创建两个物体
2. 选中第一个物体
3. 旋转第一个物体
4. 移动第一个物体
5. 选中第二个物体
6. 旋转第二个物体
7. 移动第二个物体
8. **预期结果：**
   - ✅ 两个物体的位置都正确保存到 Store

## 问题诊断

### 如果位置仍然不同步

#### 检查点 1: 控制台日志
查看 `[PaperRenderer] updateItemTransform` 的输出：
- `oldPosition` 和 `newPosition` 是否合理？
- `oldPosition` 是否和 Store 中的位置一致？

#### 检查点 2: Redux DevTools
- 检查 `components.byId[transformComponentId].props.position`
- 是否有 `updateComponentProps` action 被 dispatch？

#### 检查点 3: applyMatrix 属性
在控制台执行：
```javascript
// 获取选中物体的 Paper.js item
const item = paper.project.activeLayer.children.find(child => child.data?.gameObjectId === 'your-object-id');
console.log('applyMatrix:', item.applyMatrix); // 应该是 false
```

#### 检查点 4: 旋转中心问题
旋转可能改变物体的实际位置（如果旋转中心不是物体中心）。
在控制台检查：
```javascript
console.log('Item position:', item.position);
console.log('Item bounds center:', item.bounds.center);
```

## 常见问题

### Q1: 为什么旋转后位置会变？
**A:** Paper.js 的 `rotate()` 方法会绕指定点旋转。如果旋转中心不是物体中心，旋转会改变物体的 `position`。

### Q2: applyMatrix = false 的作用是什么？
**A:** 
- `applyMatrix = true`：变换会被应用到路径的点，`position`/`rotation`/`scale` 属性会重置
- `applyMatrix = false`：变换不会应用到点，保持 `position`/`rotation`/`scale` 属性

### Q3: 为什么要重置旋转到 0？
**A:** 因为 `item.rotation` 在 Paper.js 中是**累积的**。如果不重置，每次设置都会在当前基础上叠加。

## 成功标准

- ✅ 旋转物体后移动，Redux DevTools 中的 position 正确更新
- ✅ 控制台日志显示 `oldPosition` 和 Store 中的位置一致
- ✅ 物体的视觉位置和 Store 中的位置一致
- ✅ 多次旋转和移动后，位置仍然正确

## 如果问题仍然存在

考虑实施**方案 4**：ShapeTranslateHandler 从 Paper.js 读取初始位置

在 `ShapeTranslateHandler.onBeginMove` 中：
```typescript
// 需要访问 renderer 来获取 Paper.js item
const renderer = getRenderer();
const renderItem = renderer.getRenderItem(gameObjectId);

// 从 Paper.js 读取实际位置
const currentPos = renderItem 
  ? { x: renderItem.position.x, y: renderItem.position.y }
  : transformComponent.props.position;
```

这样可以确保即使 Store 和 Paper.js 不一致，也能正确移动。

## 调试技巧

### 在控制台手动检查
```javascript
// 1. 获取 Store 状态
const state = store.getState();
const components = state.engine.components.byId;

// 2. 找到 Transform 组件
const transformComponent = Object.values(components).find(c => c.type === 'Transform');
console.log('Store position:', transformComponent.props.position);
console.log('Store rotation:', transformComponent.props.rotation);

// 3. 获取 Paper.js item
const item = paper.project.activeLayer.children.find(child => child.data?.gameObjectId);
console.log('Paper.js position:', {x: item.position.x, y: item.position.y});
console.log('Paper.js rotation:', item.rotation);

// 4. 比较是否一致
console.log('Position match:', 
  Math.abs(transformComponent.props.position.x - item.position.x) < 0.01 &&
  Math.abs(transformComponent.props.position.y - item.position.y) < 0.01
);
```

## 相关文档
- `fix-rotation-position-sync-issue.md` - 详细问题分析和解决方案
- `shape-rotate-handler-implementation.md` - 旋转处理器实现
- `shape-rotate-handler-summary.md` - 旋转功能总结

