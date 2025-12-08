# AnimationPlayer 无限循环问题修复

## 🐛 问题

### 1. Maximum call stack size exceeded (堆栈溢出)

**错误信息：**
```
Uncaught RangeError: Maximum call stack size exceeded
    at Object.assign (<anonymous>)
    at updateComponentProps (ComponentSlice.ts:44:1)
```

**原因分析：**

形成了一个无限循环：

```
store.subscribe 回调
    ↓
updateGameObjectVisibility()
    ↓
interpolateGameObjectComponents()
    ↓
dispatch(updateComponentProps(...))  ← 更新 Redux state
    ↓
触发 store.subscribe 回调  ← 回到开始！
    ↓
updateGameObjectVisibility()
    ↓
... 无限循环 ...
```

**问题所在：**
```typescript
start() {
    this.unsubscribe = store.subscribe(() => {
        this.updateGameObjectVisibility(); // ← 每次 state 变化都调用
    });
}

private interpolateGameObjectComponents(gameObjectId, currentFrame) {
    // ...
    store.dispatch(updateComponentProps({ ... }));  // ← 这会触发 state 变化！
}
```

### 2. GameObject 在出身帧前不可见

**问题：**
GameObject 应该在 `currentFrame < bornFrameId` 时不可见。

## ✅ 解决方案

### 1. 添加帧变化检测，避免无限循环

```typescript
export class AnimationPlayer {
    private lastProcessedFrame: number = -1; // ← 新增：追踪上次处理的帧

    start() {
        const store = getEngineStore();

        this.unsubscribe = store.subscribe(() => {
            const state = getEngineState();
            const currentFrame = state.playback.currentFrame;
            
            // ✅ 只有当帧真正变化时才处理
            if (currentFrame !== this.lastProcessedFrame) {
                this.lastProcessedFrame = currentFrame;
                this.updateGameObjectVisibility();
            }
        });

        this.updateGameObjectVisibility();
    }
}
```

**工作原理：**
```
第一次：currentFrame = 0, lastProcessedFrame = -1
    ↓
0 !== -1 → 执行 updateGameObjectVisibility()
    ↓
dispatch(updateComponentProps(...))
    ↓
触发 store.subscribe
    ↓
currentFrame = 0, lastProcessedFrame = 0 (已更新)
    ↓
0 === 0 → 跳过！✓
```

### 2. 添加出身帧前不可见的逻辑

```typescript
private updateGameObjectVisibility() {
    // ...
    layer.gameObjectIds?.forEach((goId: string) => {
        const gameObject = state.gameObjects.byId[goId];
        const bornFrame = gameObject.bornFrameId;

        // ✅ GameObject 应该在出身帧前不可见
        if (currentFrame < bornFrame) {
            if (gameObject.active !== false) {
                store.dispatch(setGameObjectActive({ id: goId, active: false }));
            }
            return; // 跳过插值
        }

        // ... 其他可见性逻辑 ...
    });
}
```

## 🔄 完整的帧变化流程

### 修复前 ❌

```
用户拖动播放头到第 50 帧
    ↓
dispatch(setCurrentFrame(50))
    ↓
触发 store.subscribe
    ↓
updateGameObjectVisibility()
    ├─> dispatch(setGameObjectActive(...))  → 触发 subscribe
    │       ↓
    │   updateGameObjectVisibility() → 再次 dispatch
    │       ↓
    │   updateGameObjectVisibility() → ...
    │       ↓
    │   💥 堆栈溢出！
    │
    └─> dispatch(updateComponentProps(...))  → 触发 subscribe
            ↓
        updateGameObjectVisibility() → 再次 dispatch
            ↓
        updateGameObjectVisibility() → ...
            ↓
        💥 堆栈溢出！
```

### 修复后 ✅

```
用户拖动播放头到第 50 帧
    ↓
dispatch(setCurrentFrame(50))
    ↓
触发 store.subscribe
    ↓
currentFrame = 50, lastProcessedFrame = 49
    ↓
50 !== 49 ✓ → 执行 updateGameObjectVisibility()
    ↓
lastProcessedFrame = 50 (更新)
    ├─> dispatch(setGameObjectActive(...))
    │       ↓
    │   触发 store.subscribe
    │       ↓
    │   currentFrame = 50, lastProcessedFrame = 50
    │       ↓
    │   50 === 50 ✗ → 跳过！
    │
    └─> dispatch(updateComponentProps(...))
            ↓
        触发 store.subscribe
            ↓
        currentFrame = 50, lastProcessedFrame = 50
            ↓
        50 === 50 ✗ → 跳过！
            ↓
        ✅ 结束，没有无限循环
```

## 📋 可见性规则

### 完整的可见性判断逻辑

```typescript
// 规则 1: 当前帧 < 出身帧 → 不可见
if (currentFrame < bornFrame) {
    active = false;
    return; // 跳过后续逻辑
}

// 规则 2: 找到包含当前帧的 clip
const currentClip = clips.find(clip => 
    currentFrame >= clip.startFrame && 
    currentFrame <= clip.startFrame + clip.length - 1
);

// 规则 3: 如果有 clip，检查出身帧是否在 clip 内
if (currentClip) {
    const clipEnd = currentClip.startFrame + currentClip.length - 1;
    shouldBeVisible = bornFrame >= currentClip.startFrame && bornFrame <= clipEnd;
}

// 规则 4: 或者当前帧正好是出身帧
shouldBeVisible = shouldBeVisible || (bornFrame === currentFrame);
```

### 示例

假设 GameObject 的 `bornFrame = 10`，Layer 有一个 clip: `[20, 50]`

| currentFrame | 可见性 | 原因 |
|-------------|-------|------|
| 5 | ❌ | currentFrame < bornFrame (规则 1) |
| 10 | ✅ | currentFrame === bornFrame (规则 4) |
| 15 | ❌ | 不在 clip 内 |
| 20 | ✅ | 在 clip [20,50] 内，且 bornFrame(10) < clipStart(20) |
| 30 | ✅ | 在 clip [20,50] 内 |
| 50 | ✅ | 在 clip [20,50] 内 |
| 55 | ❌ | 不在 clip 内 |

## 🧪 测试场景

### 场景 1: 拖动播放头

```typescript
// 第 0 帧
dispatch(setCurrentFrame(0));
// → lastProcessedFrame = 0
// → 处理可见性和插值

// 第 1 帧
dispatch(setCurrentFrame(1));
// → lastProcessedFrame = 1
// → 处理可见性和插值

// 连续拖动 (0 → 50 很快)
for (let i = 0; i <= 50; i++) {
    dispatch(setCurrentFrame(i));
    // 每一帧都正确处理，不会重复
}
```

### 场景 2: 播放动画

```typescript
// AnimationPlayer.animate() 循环
setInterval(() => {
    const nextFrame = currentFrame + 1;
    dispatch(setCurrentFrame(nextFrame));
    // → 只处理一次
    // → 不会因为 updateComponentProps 触发重复处理
}, 1000 / fps);
```

### 场景 3: 出身帧前的 GameObject

```typescript
// GameObject: bornFrame = 10
// currentFrame = 5

updateGameObjectVisibility();
// → currentFrame (5) < bornFrame (10)
// → setGameObjectActive({ active: false })
// → return (跳过插值)
```

## 💡 关键点

1. **帧变化检测** - 使用 `lastProcessedFrame` 避免重复处理同一帧
2. **提前返回** - 出身帧前的 GameObject 直接返回，不执行插值
3. **状态更新不触发重复** - 即使 dispatch 触发 subscribe，也会被过滤掉

## 🎯 总结

修复了两个关键问题：

✅ **无限循环修复**
- 添加 `lastProcessedFrame` 追踪
- 只有帧真正变化时才处理
- 避免 `updateComponentProps` 导致的循环

✅ **出身帧前不可见**
- 检查 `currentFrame < bornFrame`
- 设置 `active = false`
- 跳过插值逻辑

现在 AnimationPlayer 可以正确处理帧变化和 GameObject 可见性了！🎉

