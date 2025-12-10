# 简化 isPlaying 状态管理

## 🐛 问题

1. **重复声明**: App.tsx 中 `handlePause` 函数被声明了两次
2. **不必要的状态管理**: App.tsx 通过 `useState` + `SDK.executeAfterInit` 订阅 Engine store，然后通过 props 传递给 MainMenu
3. **多此一举**: MainMenu 完全可以直接用 Redux selector 读取 Engine 的 playback state

## ✅ 解决方案

### Before (复杂的) ❌

```typescript
// App.tsx
const [isPlaying, setIsPlaying] = useState(false);

useEffect(() => {
  SDK.executeAfterInit(() => {
    const engineStore = getEngineStore();
    const unsubscribe = engineStore.subscribe(() => {
      const engineState = getEngineState();
      setIsPlaying(engineState.playback.isPlaying);  // ← 订阅并同步
    });
  });
}, []);

<MainMenu isPlaying={isPlaying} />  // ← 通过 props 传递

// MainMenu.tsx
interface MainMenuProps {
  isPlaying?: boolean;  // ← 接收 prop
}

const MainMenu = ({ isPlaying = false }) => {
  // 使用 prop
}
```

### After (简洁的) ✅

```typescript
// App.tsx
// 完全不需要 isPlaying state！
<MainMenu
  onPlay={handlePlay}
  onPause={handlePause}
  onStop={handleStop}
/>

// MainMenu.tsx
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

const MainMenu = ({ onPlay, onPause, onStop }) => {
  // 直接从 Redux store 读取
  const isPlaying = useSelector((state: RootState) => 
    state.engine.playback.isPlaying
  );
  
  return (
    <>
      {!isPlaying ? (
        <Button onClick={onPlay}>Play</Button>
      ) : (
        <Space>
          <Button onClick={onPause}>Pause</Button>
          <Button onClick={onStop}>Stop</Button>
        </Space>
      )}
    </>
  );
};
```

## 🎯 优势

### 1. 更简洁
```
Before: 15+ 行代码处理 isPlaying 同步
After: 1 行 useSelector
```

### 2. 更直接
```
Before: Engine Store → Subscribe → setState → Props → MainMenu
After: Engine Store → useSelector → MainMenu
```

### 3. 更标准
```
使用 Redux 推荐的 useSelector 模式
```

### 4. 自动更新
```
Redux 的 useSelector 会自动在 state 变化时触发 re-render
不需要手动订阅和取消订阅
```

## 📊 数据流对比

### Before ❌
```
Engine Store (playback.isPlaying)
    ↓ store.subscribe()
App Component (useState)
    ↓ setIsPlaying()
App Component State
    ↓ props
MainMenu Component
    ↓ 使用 isPlaying prop
显示 Play/Pause/Stop 按钮
```

**问题**:
- 5 个步骤
- 手动订阅管理
- 额外的状态

### After ✅
```
Engine Store (playback.isPlaying)
    ↓ useSelector
MainMenu Component
    ↓ 直接使用
显示 Play/Pause/Stop 按钮
```

**优势**:
- 2 个步骤
- 自动订阅管理
- 无额外状态

## 🔧 完整的文件对比

### App.tsx

**Before**:
```typescript
import React, { useEffect, useState } from 'react';
import { SDK } from '@huahuo/sdk';
import { getEngineStore, getEngineState } from '@huahuo/engine';

const App = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    SDK.executeAfterInit(() => {
      const engineStore = getEngineStore();
      const unsubscribe = engineStore.subscribe(() => {
        const engineState = getEngineState();
        setIsPlaying(engineState.playback.isPlaying);
      });
      const initialState = getEngineState();
      setIsPlaying(initialState.playback.isPlaying);
    });
  }, []);
  
  return <MainMenu isPlaying={isPlaying} />;
};
```

**After**:
```typescript
import React, { useEffect } from 'react';
import { getEngineStore } from '@huahuo/engine';

const App = () => {
  // 不需要 isPlaying state！
  
  return <MainMenu onPlay={...} onPause={...} onStop={...} />;
};
```

### MainMenu.tsx

**Before**:
```typescript
interface MainMenuProps {
  isPlaying?: boolean;
}

const MainMenu = ({ isPlaying = false }) => {
  return (
    <>
      {!isPlaying ? <PlayButton /> : <PauseStopButtons />}
    </>
  );
};
```

**After**:
```typescript
import { useSelector } from 'react-redux';

interface MainMenuProps {
  // 不需要 isPlaying prop
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

const MainMenu = ({ onPlay, onPause, onStop }) => {
  const isPlaying = useSelector((state: RootState) => 
    state.engine.playback.isPlaying
  );
  
  return (
    <>
      {!isPlaying ? <PlayButton /> : <PauseStopButtons />}
    </>
  );
};
```

## 💡 为什么这样更好

### React-Redux 最佳实践

Redux 官方推荐组件直接使用 `useSelector` 读取需要的 state，而不是通过 props 层层传递。

```typescript
// ✅ 推荐
const MyComponent = () => {
  const data = useSelector(state => state.someData);
  return <div>{data}</div>;
};

// ❌ 不推荐（除非有特殊原因）
const Parent = () => {
  const data = useSelector(state => state.someData);
  return <Child data={data} />;
};
const Child = ({ data }) => <div>{data}</div>;
```

### 性能优化

`useSelector` 使用浅比较（shallow equality），只有当选中的 state 片段真正改变时才会触发 re-render。

### 代码可维护性

- 减少 props drilling
- 组件更独立
- 易于测试

## 🎉 总结

修复完成：

✅ **移除重复的 handlePause 声明**
✅ **移除 App.tsx 中不必要的 isPlaying state**
✅ **MainMenu 直接使用 useSelector 读取 Engine store**
✅ **代码更简洁、更标准、更易维护**

现在的实现遵循 React-Redux 最佳实践！🚀

