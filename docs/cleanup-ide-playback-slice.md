# 清理 IDE 的 Playback Slice

## 🎯 清理内容

删除了 IDE 中冗余的 playback state 管理，统一使用 Engine 的 playback state。

## 📝 删除的文件

```
hh-ide/src/store/features/playback/
└── playbackSlice.ts  ← 删除
```

## 🔧 修改的文件

### 1. App.tsx

**移除**:
```typescript
import { useAppDispatch } from './store/hooks';
const dispatch = useAppDispatch();
```

**保留**:
```typescript
import { getEngineStore, getEngineState } from '@huahuo/engine';
const [isPlaying, setIsPlaying] = useState(false);

// Subscribe to Engine state
useEffect(() => {
  const engineStore = getEngineStore();
  const unsubscribe = engineStore.subscribe(() => {
    const engineState = getEngineState();
    setIsPlaying(engineState.playback.isPlaying);
  });
  return () => unsubscribe();
}, []);
```

### 2. store.ts

**移除**:
```typescript
import playbackReducer from './features/playback/playbackSlice';

export const store = configureStore({
  reducer: {
    playback: playbackReducer,  // ← 删除
    // ...
  }
});
```

**保留**:
```typescript
export const store = configureStore({
  reducer: {
    // IDE-specific reducers
    auth: authSlice.reducer,
    app: appSlice.reducer,
    counter: counterReducer,
    selection: selectionReducer,
    
    // Engine reducer (includes playback state)
    engine: engineReducer,
  }
});
```

## 📊 状态结构对比

### 清理前 ❌

```typescript
// IDE Store
{
  playback: {          // ← 冗余！
    isPlaying: false
  },
  engine: {
    playback: {        // ← 实际使用的
      isPlaying: false,
      currentFrame: 0,
      fps: 30
    }
  }
}
```

### 清理后 ✅

```typescript
// IDE Store
{
  // 没有 playback 了
  engine: {
    playback: {        // ← 唯一的 playback state
      isPlaying: false,
      currentFrame: 0,
      fps: 30
    }
  }
}
```

## 💡 为什么删除

### 1. 重复状态

IDE 和 Engine 各有一个 playback state，容易不同步。

### 2. 单一职责

播放控制是 Engine 的职责，IDE 只需要读取状态显示 UI。

### 3. 简化架构

```
清理前:
UI → IDE state → 显示
User action → 更新 IDE state + Engine state
Animation → Engine state

清理后:
UI → Engine state → 显示
User action → 更新 Engine state
Animation → Engine state
```

## 🎯 影响范围

### 不受影响

- ✅ Play/Pause 按钮功能正常
- ✅ 动画播放控制正常
- ✅ 状态同步更可靠

### 已优化

- ✅ 移除了重复代码
- ✅ 简化了状态管理
- ✅ 减少了维护成本

## 🎉 总结

清理完成！现在：

✅ **单一数据源** - 只有 Engine 的 playback state
✅ **更简洁** - 移除了 IDE 的重复状态
✅ **更可靠** - 不会出现状态不同步的问题
✅ **更易维护** - 减少了代码复杂度

IDE 现在更加精简了！🚀

