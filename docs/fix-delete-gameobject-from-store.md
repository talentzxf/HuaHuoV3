# 修复删除功能：从 Store 和 Paper.js 中正确删除物体

## 🐛 问题描述
按 Delete 键删除物体时，只删除了 Paper.js 的渲染对象，但没有从 Redux Store 中删除 GameObject 数据。

### 症状
- ✅ 物体从画布上消失（Paper.js item 被删除）
- ❌ GameObject 仍然存在于 Store 中
- ❌ 刷新页面后物体会重新出现
- ❌ GameObject 面板中仍然显示该物体

## 🔍 问题分析

### 旧代码逻辑（错误）
```typescript
// CanvasPanel.tsx - 旧代码
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (scope.project) {
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.selected) {
          item.remove(); // ❌ 只删除 Paper.js item
        }
      });
    }
  }
};
```

**问题：**
1. 只调用 `item.remove()` 删除 Paper.js 渲染对象
2. 没有调用 Redux action 删除 GameObject 数据
3. Store 和视图不一致

### 正确的删除流程
```
用户按 Delete
  ↓
获取选中的 GameObject ID
  ↓
dispatch deleteGameObject(id)
  ↓
Redux Store 删除 GameObject
  ↓
ReduxAdapter 监听到变化
  ↓
自动删除 Paper.js render item
  ↓
清除选择状态
```

## ✅ 解决方案

### 1. 修复 CanvasPanel.tsx - 从 Store 删除 GameObject

**修改前：**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (scope.project) {
      // ❌ 只删除 Paper.js item
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.selected) {
          item.remove();
        }
      });
    }
  }
};
```

**修改后：**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // ✅ 获取选中的 GameObject ID
    const selectionState = store.getState().selection;
    
    if (selectionState.selectedObjectType === 'gameObject' && selectionState.selectedObjectId) {
      const gameObjectId = selectionState.selectedObjectId;
      
      // ✅ 从 Redux Store 删除 GameObject
      const { deleteGameObject } = require('@huahuo/engine');
      const engineStore = getEngineStore();
      engineStore.dispatch(deleteGameObject(gameObjectId));
      
      // ✅ 清除选择状态
      const { clearSelection } = require('../../store/features/selection/selectionSlice');
      store.dispatch(clearSelection());
      
      // ✅ ReduxAdapter 会自动处理 Paper.js item 的删除
    }
  }
};
```

### 2. 增强 ReduxAdapter - 自动删除 Paper.js item

**修改前：**
```typescript
// ReduxAdapter.ts - 旧代码
const removedGameObjectIds = previousGameObjectIds.filter(...);
removedGameObjectIds.forEach((gameObjectId: string) => {
  console.debug(`GameObject removed: ${gameObjectId}`);
  // ❌ 只打印日志，没有实际处理
});
```

**修改后：**
```typescript
// ReduxAdapter.ts - 新代码
const removedGameObjectIds = previousGameObjectIds.filter(...);
removedGameObjectIds.forEach((gameObjectId: string) => {
  console.debug(`GameObject removed: ${gameObjectId}`);
  // ✅ 删除 Paper.js render item
  this.handleGameObjectRemoved(gameObjectId);
});

// ✅ 新增方法
private handleGameObjectRemoved(gameObjectId: string): void {
  const renderItem = (this.renderer as any).getRenderItem?.(gameObjectId);
  if (!renderItem) {
    return;
  }

  // 删除 Paper.js item
  if (renderItem.remove) {
    renderItem.remove();
  }

  // 从渲染器注册表中移除
  if ((this.renderer as any).unregisterRenderItem) {
    (this.renderer as any).unregisterRenderItem(gameObjectId);
  }
}
```

## 🎯 关键改进

### 1. 使用 Redux 作为单一数据源
- ✅ 所有数据操作都通过 Redux
- ✅ Store 是唯一的真实来源
- ✅ Paper.js 只是渲染层

### 2. ReduxAdapter 自动同步
- ✅ 监听 Store 变化
- ✅ 自动更新 Paper.js
- ✅ 保持一致性

### 3. 清晰的职责分离
```
CanvasPanel (UI 层)
  └─ 检测键盘事件
  └─ 获取选中的 GameObject
  └─ dispatch deleteGameObject
      ↓
Redux Store (数据层)
  └─ 删除 GameObject 数据
      ↓
ReduxAdapter (同步层)
  └─ 监听到 GameObject 删除
  └─ 自动删除 Paper.js render item
      ↓
Paper.js (渲染层)
  └─ 物体从画布消失
```

## 📊 数据流对比

### 旧流程（错误）
```
Delete 键按下
  ↓
遍历 Paper.js children
  ↓
删除 selected items
  ↓
❌ Store 中数据仍存在
❌ 刷新后物体重新出现
```

### 新流程（正确）
```
Delete 键按下
  ↓
获取选中 GameObject ID
  ↓
dispatch deleteGameObject
  ↓
Store 删除数据
  ↓
ReduxAdapter 监听变化
  ↓
自动删除 Paper.js item
  ↓
清除选择状态
  ↓
✅ 完全删除
✅ 刷新后不会重现
```

## 🧪 测试验证

### 测试步骤
1. 创建一个物体（矩形/圆形）
2. 选中该物体
3. 按 Delete 或 Backspace 键
4. 检查结果

### 预期结果
- ✅ 物体从画布消失
- ✅ GameObject 从 Store 中删除（Redux DevTools 检查）
- ✅ 选择框消失
- ✅ GameObject 面板中不再显示该物体
- ✅ 刷新页面后物体不会重新出现

### 检查点
1. **Paper.js 层面**
   ```javascript
   // 在控制台检查
   paper.project.activeLayer.children.length
   // 应该减少 1
   ```

2. **Redux Store 层面**
   ```javascript
   // Redux DevTools 或控制台
   store.getState().engine.gameObjects.byId
   // 应该不包含被删除的 GameObject
   ```

3. **选择状态**
   ```javascript
   store.getState().selection
   // 应该被清空：{ selectedObjectType: null, selectedObjectId: null }
   ```

## 🔄 额外功能

### 支持的快捷键
- `Delete` - 删除选中物体
- `Backspace` - 删除选中物体（Mac 兼容）

### 安全检查
- ✅ 只有选中 GameObject 时才删除
- ✅ 没有选中时按 Delete 不会出错
- ✅ 自动清除选择状态

## 📝 相关代码

### 修改的文件
1. **CanvasPanel.tsx** - 修复删除逻辑
   - 从 Store 获取选中的 GameObject
   - dispatch deleteGameObject action
   - 清除选择状态

2. **ReduxAdapter.ts** - 添加自动删除
   - 监听 GameObject 删除事件
   - 自动删除 Paper.js render item
   - 从渲染器注册表中移除

### 使用的 Redux Actions
- `deleteGameObject(gameObjectId)` - 从 @huahuo/engine
- `clearSelection()` - 从 selection slice

## 🎉 总结

### 问题
- ❌ 删除只清除视图，不清除数据
- ❌ Store 和视图不一致

### 解决方案
- ✅ 通过 Redux 删除数据
- ✅ ReduxAdapter 自动同步视图
- ✅ 保持 Store 和视图一致性

### 架构优势
- 单一数据源（Redux）
- 自动同步（ReduxAdapter）
- 职责分离（UI → Store → Renderer）

现在按 Delete 键可以正确地从 Store 和视图中完全删除物体了！🎉

