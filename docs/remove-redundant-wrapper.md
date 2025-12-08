# 移除多余的 setCurrentFrameWithInterpolation 包装函数

## 问题

之前创建了一个 `setCurrentFrameWithInterpolation` 函数：

```typescript
export const setCurrentFrameWithInterpolation = (frame: number) => {
    return (dispatch: any) => {
        // Just update the current frame
        // AnimationPlayer will handle component interpolation for active GameObjects
        dispatch(setCurrentFrame(frame));
    };
};
```

**问题：这个函数只是简单包装了 `setCurrentFrame`，没有任何额外逻辑！**

## 为什么没有意义？

因为插值逻辑已经完全移到了 `AnimationPlayer` 中：

```typescript
class AnimationPlayer {
    start() {
        // 订阅 store 变化
        this.unsubscribe = store.subscribe(() => {
            this.updateGameObjectVisibility(); // ← 这里处理插值
        });
    }

    private updateGameObjectVisibility() {
        // 当 currentFrame 变化时，自动触发
        const currentFrame = state.playback.currentFrame;
        
        // 遍历 active GameObjects 并插值它们的 Components
        if (shouldBeVisible) {
            this.interpolateGameObjectComponents(goId, currentFrame);
        }
    }
}
```

## 工作流程

### 修改前 ❌

```
用户拖动播放头
    ↓
dispatch(setCurrentFrameWithInterpolation(50))
    ↓
    └─> dispatch(setCurrentFrame(50))  // 包装函数只做这个
        ↓
        currentFrame 状态更新
        ↓
        store.subscribe 触发
        ↓
        AnimationPlayer.updateGameObjectVisibility()
        ↓
        插值 Components
```

**多余的一层包装！**

### 修改后 ✅

```
用户拖动播放头
    ↓
dispatch(setCurrentFrame(50))  // 直接调用
    ↓
    currentFrame 状态更新
    ↓
    store.subscribe 触发
    ↓
    AnimationPlayer.updateGameObjectVisibility()
    ↓
    插值 Components
```

**简洁明了！**

## 修改内容

### 1. 删除包装函数

```typescript
// ❌ 删除这个多余的函数
export const setCurrentFrameWithInterpolation = (frame: number) => {
    return (dispatch: any) => {
        dispatch(setCurrentFrame(frame));
    };
};
```

### 2. 更新所有调用点

**AnimationPlayer.ts**
```typescript
// 修改前
import { setCurrentFrameWithInterpolation } from '../store/actions';
(store.dispatch as any)(setCurrentFrameWithInterpolation(nextFrame % 120));

// 修改后 ✅
import { setCurrentFrame } from '../store/PlaybackSlice';
store.dispatch(setCurrentFrame(nextFrame % 120));
```

**TimelinePanel.tsx**
```typescript
// 修改前
import { setCurrentFrameWithInterpolation } from '@huahuo/engine';
(engineStore.dispatch as any)(setCurrentFrameWithInterpolation(frameNumber));

// 修改后 ✅
import { setCurrentFrame } from '@huahuo/engine';
engineStore.dispatch(setCurrentFrame(frameNumber));
```

**CanvasPanel.tsx**
```typescript
// 修改前
import { setCurrentFrameWithInterpolation } from '@huahuo/engine';

// 修改后 ✅
import { setCurrentFrame as setEngineFrame } from '@huahuo/engine';
```

### 3. 更新导出

**store/index.ts**
```typescript
// 修改前
export { updateComponentPropsWithKeyFrame, setCurrentFrameWithInterpolation } from './actions';

// 修改后 ✅
export { updateComponentPropsWithKeyFrame } from './actions';
```

## 核心原理

插值的触发完全依赖于 **store.subscribe 机制**：

```typescript
class AnimationPlayer {
    start() {
        // 订阅 Redux store 的所有变化
        this.unsubscribe = store.subscribe(() => {
            // 每次 currentFrame 变化，这个回调都会执行
            this.updateGameObjectVisibility();
        });
    }

    private updateGameObjectVisibility() {
        // 读取当前帧
        const currentFrame = state.playback.currentFrame;
        
        // 处理所有 active GameObject 的插值
        Object.values(state.layers.byId).forEach((layer: any) => {
            layer.gameObjectIds?.forEach((goId: string) => {
                const shouldBeVisible = this.calculateVisibility(...);
                
                if (shouldBeVisible) {
                    // 插值这个 GameObject 的所有 Components
                    this.interpolateGameObjectComponents(goId, currentFrame);
                }
            });
        });
    }
}
```

**关键点：**
- `setCurrentFrame` 更新 Redux state
- Redux state 更新触发 `store.subscribe`
- `store.subscribe` 调用 `updateGameObjectVisibility`
- `updateGameObjectVisibility` 插值所有 active GameObject 的 Components

**不需要额外的包装函数！**

## 代码更简洁

### 修改前
- `actions.ts`: 需要维护包装函数
- 调用时需要 `(dispatch as any)` 类型断言（因为 thunk）
- 多一层间接调用

### 修改后 ✅
- 直接使用 Redux 原生的 action
- 不需要类型断言
- 代码路径更清晰

## 调用对比

```typescript
// 修改前 ❌
import { setCurrentFrameWithInterpolation } from '@huahuo/engine';
(store.dispatch as any)(setCurrentFrameWithInterpolation(50));

// 修改后 ✅
import { setCurrentFrame } from '@huahuo/engine';
store.dispatch(setCurrentFrame(50));
```

**更简单、更直观、更符合 Redux 惯例！**

## 总结

移除 `setCurrentFrameWithInterpolation` 的原因：

1. ✅ **职责已分离** - 插值逻辑在 AnimationPlayer 中
2. ✅ **订阅机制完善** - store.subscribe 自动触发插值
3. ✅ **没有额外逻辑** - 包装函数只是简单转发
4. ✅ **代码更清晰** - 减少一层抽象
5. ✅ **符合 Redux 惯例** - 直接使用原生 action

现在的架构更清晰：
- **Redux Actions**: 纯粹的状态更新（setCurrentFrame）
- **AnimationPlayer**: 监听状态变化并处理插值逻辑
- **纯函数**: interpolateComponent 处理插值计算

职责分明，易于理解和维护！🎉

