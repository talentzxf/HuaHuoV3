# GameObjectPropertyPanel 折叠状态保持优化

## ✅ 问题

### Before ❌
```typescript
const updateData = () => {
  // ...
  setComponents(gameObjectComponents);
  
  // ❌ 每次更新都重置为全部展开
  setActiveKeys(gameObjectComponents.map(c => c.id));
};
```

**问题**：
- 用户折叠了某个 Component（如 Transform）
- 移动物体触发 `updateComponentProps` action
- `gameObjectListener` 通知 `GameObjectPropertyPanel`
- `updateData()` 被调用
- `setActiveKeys()` 重置为所有 component IDs
- 所有 Components 重新展开！❌

**用户体验**：
- 😤 用户折叠了 Transform
- 🖱️ 拖动物体
- 😡 Transform 又展开了！

### After ✅
```typescript
const prevComponentIdsRef = React.useRef<string[]>([]);

const updateData = () => {
  // ...
  const newComponentIds = gameObjectComponents.map(c => c.id);
  const oldComponentIds = prevComponentIdsRef.current;
  
  // ✅ 检查 component 列表是否真的变化了
  const componentsChanged = 
    newComponentIds.length !== oldComponentIds.length ||
    newComponentIds.some((id, idx) => id !== oldComponentIds[idx]);
  
  setComponents(gameObjectComponents);
  prevComponentIdsRef.current = newComponentIds;
  
  // ✅ 只在 components 列表变化时才重置 activeKeys
  if (componentsChanged) {
    setActiveKeys(newComponentIds);
  }
  // 否则保持用户的折叠/展开状态
};
```

**用户体验**：
- 😊 用户折叠了 Transform
- 🖱️ 拖动物体
- ✅ Transform 保持折叠状态！

## 🎯 实现原理

### 1. **使用 useRef 跟踪之前的 component IDs**

```typescript
const prevComponentIdsRef = React.useRef<string[]>([]);
```

**为什么用 ref 而不是 state？**
- ref 不会触发重新渲染
- 避免闭包陷阱（在 `updateData` 中访问最新值）
- 更高效

### 2. **比较 component 列表是否变化**

```typescript
const componentsChanged = 
  newComponentIds.length !== oldComponentIds.length ||  // 数量变化
  newComponentIds.some((id, idx) => id !== oldComponentIds[idx]);  // 顺序或内容变化
```

**触发条件**：
- ✅ 添加了新 Component（如添加 Visual）
- ✅ 删除了 Component
- ✅ Component 顺序改变
- ❌ 只是 Component 的 props 变化（如 position 改变）

### 3. **条件性重置 activeKeys**

```typescript
if (componentsChanged) {
  setActiveKeys(newComponentIds);  // 新 Components 默认展开
} else {
  // 不操作，保持用户的折叠状态
}
```

## 📊 场景对比

### 场景 1：移动物体（props 变化）

| 步骤 | Before ❌ | After ✅ |
|------|----------|---------|
| 1. 用户折叠 Transform | activeKeys = ['visual'] | activeKeys = ['visual'] |
| 2. 拖动物体 | updateComponentProps action | updateComponentProps action |
| 3. updateData 检查 | - | componentsChanged = false |
| 4. 更新 activeKeys | setActiveKeys(['transform', 'visual']) | **不更新** |
| 5. 结果 | Transform 展开 ❌ | Transform 保持折叠 ✅ |

### 场景 2：添加新 Component

| 步骤 | Before | After ✅ |
|------|--------|---------|
| 1. 当前状态 | activeKeys = ['visual'] | activeKeys = ['visual'] |
| 2. 添加 BoxCollider | createComponent action | createComponent action |
| 3. updateData 检查 | - | componentsChanged = true |
| 4. 更新 activeKeys | setActiveKeys([...]) | setActiveKeys(['transform', 'visual', 'boxCollider']) |
| 5. 结果 | 全部展开 | 全部展开（包括新的）✅ |

### 场景 3：删除 Component

| 步骤 | Before | After ✅ |
|------|--------|---------|
| 1. 当前状态 | activeKeys = ['visual'] | activeKeys = ['visual'] |
| 2. 删除 Transform | deleteComponent action | deleteComponent action |
| 3. updateData 检查 | - | componentsChanged = true |
| 4. 更新 activeKeys | setActiveKeys(['visual']) | setActiveKeys(['visual']) |
| 5. 结果 | Visual 保持展开 | Visual 保持展开 ✅ |

## 🔍 边缘情况处理

### 1. **gameObject 不存在**
```typescript
if (!gameObject) {
  setGameObjectData(null);
  setComponents([]);
  setActiveKeys([]);
  prevComponentIdsRef.current = [];  // ✅ 重置 ref
  return;
}
```

### 2. **初始加载**
```typescript
useEffect(() => {
  if (!gameObjectId || !SDK.isInitialized()) {
    // ...
    prevComponentIdsRef.current = [];  // ✅ 初始化 ref
    return;
  }
  // ...
}, [gameObjectId]);
```

### 3. **切换选择的 GameObject**
```typescript
// useEffect 依赖 [gameObjectId]，会重新执行
// prevComponentIdsRef.current 会被重新初始化
// 新的 GameObject 的所有 Components 默认展开
```

## 💡 关键代码片段

### 完整的 updateData 函数

```typescript
const updateData = () => {
  const state = getEngineState();
  const gameObject = state.gameObjects.byId[gameObjectId];

  if (!gameObject) {
    setGameObjectData(null);
    setComponents([]);
    setActiveKeys([]);
    prevComponentIdsRef.current = [];
    return;
  }

  setGameObjectData(gameObject);

  const gameObjectComponents = gameObject.componentIds
    .map((compId: string) => state.components.byId[compId])
    .filter(Boolean);

  // ✅ 智能比较
  const newComponentIds = gameObjectComponents.map((c: ComponentSlice) => c.id);
  const oldComponentIds = prevComponentIdsRef.current;
  
  const componentsChanged = 
    newComponentIds.length !== oldComponentIds.length ||
    newComponentIds.some((id, idx) => id !== oldComponentIds[idx]);

  setComponents(gameObjectComponents);
  prevComponentIdsRef.current = newComponentIds;

  // ✅ 条件性更新
  if (componentsChanged) {
    setActiveKeys(newComponentIds);
  }
};
```

## 🎉 效果

### 用户体验改善

**Before ❌**：
```
1. 折叠 Transform 和 Visual，只展开 Timeline
2. 拖动物体
3. 💥 所有 Components 都展开了！
4. 再次折叠
5. 拖动物体
6. 💥 又展开了！
7. 😡 崩溃...
```

**After ✅**：
```
1. 折叠 Transform 和 Visual，只展开 Timeline
2. 拖动物体
3. ✅ 保持折叠状态
4. 继续工作
5. ✅ 一直保持折叠状态
6. 😊 愉快使用
```

### 性能优势

- ✅ 减少不必要的状态更新
- ✅ 减少 Collapse 组件的重新渲染
- ✅ 保持 UI 稳定性

## 📝 总结

通过使用 `useRef` 跟踪之前的 component IDs，并智能地只在 component 列表**真正变化**时才重置 `activeKeys`，我们实现了：

1. ✅ **保持折叠状态** - 移动物体不会展开折叠的 Components
2. ✅ **正确处理新增** - 添加新 Component 时正确展开
3. ✅ **正确处理删除** - 删除 Component 时保持其他的状态
4. ✅ **无副作用** - 不影响其他功能
5. ✅ **更好的 UX** - 用户不会因为折叠状态丢失而抓狂

现在用户可以安心地折叠不需要看的 Components，专注于编辑需要的属性了！🎊

