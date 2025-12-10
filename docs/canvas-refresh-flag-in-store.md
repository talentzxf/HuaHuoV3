# 使用 IDE Store 管理 Canvas 刷新标志

## 🎯 改进目标

将 Canvas 刷新的 dirty flag 从组件本地 state 移到 IDE 的 Redux store，使得：
- ✅ 任何地方都可以触发 Canvas 刷新
- ✅ 状态管理更集中
- ✅ 更容易扩展和维护

## 📁 实现结构

### 1. 创建 Canvas Slice

```typescript
// hh-ide/src/store/features/canvas/canvasSlice.ts

interface CanvasState {
  needsRefresh: boolean;
}

export const canvasSlice = createSlice({
  name: 'canvas',
  initialState: { needsRefresh: false },
  reducers: {
    requestCanvasRefresh: (state) => {
      state.needsRefresh = true;
    },
    clearCanvasRefreshFlag: (state) => {
      state.needsRefresh = false;
    },
  },
});
```

### 2. 注册到 IDE Store

```typescript
// hh-ide/src/store/store.ts

import canvasReducer from './features/canvas/canvasSlice';

export const store = configureStore({
  reducer: {
    // ... other reducers
    canvas: canvasReducer,  // ← 新增
    engine: engineReducer,
  },
});
```

### 3. 在 CanvasPanel 中使用

```typescript
// CanvasPanel.tsx

import { useDispatch, useSelector } from 'react-redux';
import { requestCanvasRefresh, clearCanvasRefreshFlag } from '../../store/features/canvas/canvasSlice';

const CanvasPanel = () => {
  const dispatch = useDispatch();
  
  // 从 Redux store 读取刷新标志
  const needsRefresh = useSelector((state: RootState) => state.canvas.needsRefresh);
  
  // 需要刷新时触发
  const handleMergeCells = (...) => {
    engineStore.dispatch(addTimelineClip(...));
    dispatch(requestCanvasRefresh());  // ← 设置刷新标志
  };
  
  // 监听刷新标志
  useEffect(() => {
    if (!needsRefresh) return;
    
    // 触发 Renderer 刷新
    const renderer = SDK.instance.getRenderer();
    if (renderer) {
      renderer.render();
    }
    
    // 清除标志
    dispatch(clearCanvasRefreshFlag());
  }, [needsRefresh, dispatch]);
};
```

## 🔄 完整数据流

### Before (组件本地 state) ❌

```
handleMergeCells()
    ↓
setNeedsRefresh(true)
    ↓
useEffect 监听 needsRefresh
    ↓
renderer.render()
    ↓
setNeedsRefresh(false)

问题：
- 只能在 CanvasPanel 内部触发
- 其他组件无法触发刷新
```

### After (Redux store) ✅

```
任何地方：
    ↓
dispatch(requestCanvasRefresh())
    ↓
Redux store 更新
    ↓
state.canvas.needsRefresh = true
    ↓
CanvasPanel 的 useSelector 检测到变化
    ↓
useEffect 触发
    ↓
renderer.render()
    ↓
dispatch(clearCanvasRefreshFlag())
    ↓
state.canvas.needsRefresh = false

优势：
- ✅ 全局可用
- ✅ 任何组件都可以触发
- ✅ 状态集中管理
```

## 💡 使用场景

### 场景 1: Merge/Split Clip

```typescript
// CanvasPanel.tsx
const handleMergeCells = (trackId, startFrame, endFrame) => {
  engineStore.dispatch(addTimelineClip(...));
  dispatch(requestCanvasRefresh());  // 触发刷新
};
```

### 场景 2: 从其他组件触发（未来扩展）

```typescript
// PropertyPanel.tsx
const handlePropertyChange = (prop, value) => {
  engineStore.dispatch(updateComponentProps(...));
  
  // 如果需要立即刷新 Canvas
  dispatch(requestCanvasRefresh());
};
```

### 场景 3: 从 Timeline 操作触发

```typescript
// TimelinePanel.tsx
const handleDeleteKeyFrame = (frame) => {
  engineStore.dispatch(removeKeyFrame(...));
  
  // 触发 Canvas 刷新以显示变化
  dispatch(requestCanvasRefresh());
};
```

### 场景 4: 从菜单操作触发

```typescript
// MainMenu.tsx
const handleImport = () => {
  // 导入新资源
  SDK.import(...);
  
  // 刷新 Canvas 显示
  dispatch(requestCanvasRefresh());
};
```

## 🎯 优势对比

| 特性 | 本地 State | Redux Store |
|-----|-----------|-------------|
| 作用域 | 仅组件内部 | 全局可用 ✓ |
| 触发位置 | 仅 CanvasPanel | 任何组件 ✓ |
| 状态管理 | 分散 | 集中 ✓ |
| 调试 | 困难 | Redux DevTools ✓ |
| 扩展性 | 有限 | 优秀 ✓ |
| 代码复用 | 低 | 高 ✓ |

## 📊 Redux State 结构

```typescript
// IDE Store
{
  auth: { ... },
  app: { ... },
  counter: { ... },
  selection: { ... },
  canvas: {                    // ← 新增
    needsRefresh: false
  },
  engine: {
    project: { ... },
    scenes: { ... },
    layers: { ... },
    // ...
  }
}
```

## 🔧 调试

### Redux DevTools 中查看

```javascript
// 触发刷新时
{
  type: 'canvas/requestCanvasRefresh',
  payload: undefined
}

// State 更新
canvas: {
  needsRefresh: true  // ← 变为 true
}

// 清除标志时
{
  type: 'canvas/clearCanvasRefreshFlag',
  payload: undefined
}

// State 更新
canvas: {
  needsRefresh: false  // ← 变回 false
}
```

## 🎉 总结

Canvas 刷新机制现在更加强大：

✅ **全局状态管理** - 使用 Redux store 而不是本地 state
✅ **任何地方可触发** - 不限于 CanvasPanel 内部
✅ **易于调试** - Redux DevTools 可以追踪
✅ **易于扩展** - 未来添加新功能更容易
✅ **代码清晰** - 职责分明，state 管理集中

现在任何组件都可以通过 `dispatch(requestCanvasRefresh())` 来触发 Canvas 刷新！🚀

