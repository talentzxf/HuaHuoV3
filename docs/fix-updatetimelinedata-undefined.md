# 修复 updateTimelineData 未定义错误

## 🐛 错误

```
Uncaught runtime errors:
ERROR
updateTimelineData is not defined
ReferenceError: updateTimelineData is not defined
    at handleMergeCells (CanvasPanel.tsx:136:9)
```

## 🔍 问题分析

### 代码结构

```typescript
// CanvasPanel.tsx

const CanvasPanel = () => {
  const [tracks, setTracks] = useState([]);
  
  useEffect(() => {
    // updateTimelineData 在 useEffect 内部定义
    const updateTimelineData = () => {
      // ...更新逻辑
    };
    
    SDK.executeAfterInit(() => {
      updateTimelineData();  // ✓ 可以调用
      
      const engineStore = getEngineStore();
      unsubscribe = engineStore.subscribe(() => {
        updateTimelineData();  // ✓ 可以调用（闭包）
      });
    });
  }, []);
  
  // handleMergeCells 在 useEffect 外部定义
  const handleMergeCells = (...) => {
    engineStore.dispatch(addTimelineClip(...));
    updateTimelineData();  // ✗ 错误！无法访问
  };
};
```

### 问题原因

`updateTimelineData` 是在 `useEffect` 内部定义的局部函数，而 `handleMergeCells` 和 `handleSplitClip` 是在外部定义的，无法访问 `useEffect` 内部的函数。

## ✅ 解决方案

### 方案：依赖自动订阅机制

CanvasPanel 已经订阅了 Engine store 的变化：

```typescript
useEffect(() => {
  const updateTimelineData = () => {
    // 更新 Timeline 数据
  };
  
  SDK.executeAfterInit(() => {
    const engineStore = getEngineStore();
    
    // 订阅 store 变化
    unsubscribe = engineStore.subscribe(() => {
      updateTimelineData();  // ← 自动调用
    });
  });
}, []);
```

**关键点**：
- 当 `dispatch(addTimelineClip(...))` 时，Redux store 会更新
- Store 更新后会触发所有订阅者的回调
- 订阅回调中会自动调用 `updateTimelineData()`

**结论**：不需要在 `handleMergeCells` 中手动调用 `updateTimelineData()`！

### 修复代码

**Before ❌**:
```typescript
const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
  const layerId = trackId;
  const length = endFrame - startFrame + 1;
  const engineStore = getEngineStore();
  
  engineStore.dispatch(addTimelineClip(layerId, startFrame, length));
  
  updateTimelineData();  // ✗ 错误：updateTimelineData 未定义
};
```

**After ✅**:
```typescript
const handleMergeCells = (trackId: string, startFrame: number, endFrame: number) => {
  const layerId = trackId;
  const length = endFrame - startFrame + 1;
  const engineStore = getEngineStore();
  
  engineStore.dispatch(addTimelineClip(layerId, startFrame, length));
  
  // ✓ 不需要手动调用 - store 订阅会自动触发 updateTimelineData
};

const handleSplitClip = (trackId: string, clipId: string, splitFrame: number) => {
  const layerId = trackId;
  const engineStore = getEngineStore();
  
  engineStore.dispatch(splitTimelineClip(layerId, clipId, splitFrame));
  
  // ✓ 不需要手动调用 - store 订阅会自动触发 updateTimelineData
};
```

## 🔄 数据流

### 完整流程

```
1. 用户操作
   ↓
2. handleMergeCells() 被调用
   ↓
3. dispatch(addTimelineClip(...))
   ↓
4. Redux store 更新 (layers.byId[layerId].clips)
   ↓
5. Store 触发所有订阅者
   ↓
6. engineStore.subscribe() 回调执行
   ↓
7. updateTimelineData() 自动调用
   ↓
8. setTracks([...]) 更新 state
   ↓
9. Timeline 组件重新渲染
   ↓
10. 显示新的 clip ✓
```

### 为什么自动刷新有效

Redux 的订阅机制保证了：
- **任何 dispatch** 都会触发订阅回调
- **自动同步** state 和 UI
- **不需要手动刷新**

## 💡 其他可能的解决方案（未采用）

### 方案 1: 移到外部（复杂）

```typescript
const CanvasPanel = () => {
  const updateTimelineData = useCallback(() => {
    // ...
  }, [/* 很多依赖 */]);
  
  useEffect(() => {
    SDK.executeAfterInit(() => {
      engineStore.subscribe(() => {
        updateTimelineData();
      });
    });
  }, [updateTimelineData]);
  
  const handleMergeCells = () => {
    dispatch(...);
    updateTimelineData();  // 现在可以访问了
  };
};
```

**问题**:
- 需要 `useCallback` 管理依赖
- 需要正确处理所有依赖项
- 更复杂
- **仍然不需要手动调用**（订阅已经处理了）

### 方案 2: 使用 ref（过度设计）

```typescript
const updateTimelineDataRef = useRef<() => void>();

useEffect(() => {
  const updateTimelineData = () => { ... };
  updateTimelineDataRef.current = updateTimelineData;
  // ...
}, []);

const handleMergeCells = () => {
  dispatch(...);
  updateTimelineDataRef.current?.();
};
```

**问题**:
- 过度复杂
- **仍然不需要**（订阅已经处理了）

## 🎯 最佳实践

### Redux 订阅模式

当使用 Redux 时，依赖订阅机制而不是手动刷新：

```typescript
// ✅ 推荐
useEffect(() => {
  const unsubscribe = store.subscribe(() => {
    // state 变化时自动执行
    updateUI();
  });
  return () => unsubscribe();
}, []);

const handleAction = () => {
  dispatch(someAction());
  // ✓ 不需要手动 updateUI - 订阅会处理
};

// ❌ 不推荐
const handleAction = () => {
  dispatch(someAction());
  updateUI();  // 多余 - 订阅已经会调用
};
```

### 为什么不需要手动刷新

1. **Redux 保证同步**: dispatch 是同步的，state 立即更新
2. **订阅立即触发**: state 更新后立即调用所有订阅者
3. **避免重复更新**: 手动调用会导致两次更新（订阅 + 手动）

## 🎉 总结

修复完成：

✅ **移除手动调用** - 不再调用 `updateTimelineData()`
✅ **依赖订阅机制** - 让 Redux store 订阅自动处理
✅ **简化代码** - 减少不必要的手动同步
✅ **遵循最佳实践** - Redux 标准模式

Merge/Split clip 功能现在正常工作，Canvas 会自动刷新！🚀

