# 动画播放调试指南

## 🐛 问题：动画没有正常播放

## 🔍 调试步骤

### 1. 打开浏览器控制台

打开 Chrome DevTools (F12) → Console 标签

### 2. 点击 Play 按钮

观察控制台输出，应该看到以下日志序列：

#### 预期的完整日志流程

```
[App] handlePlay called
[App] Engine store: {...}
[App] Dispatching playAnimation...
[playAnimation] Action called
[playAnimation] Dispatching play() action
[playAnimation] Getting AnimationPlayer
[playAnimation] Calling player.play()
[AnimationPlayer.play] Called
[AnimationPlayer.play] Current state: {isPlaying: false, currentFrame: 0, fps: 30}
[AnimationPlayer.play] Starting animation loop
[playAnimation] Animation started
[AnimationPlayer.animate] Loop iteration, isPlaying: true  ← 应该是 true
[AnimationPlayer.animate] Timing: {elapsed: X, frameDuration: 33.33, shouldAdvance: true}
[AnimationPlayer.animate] Advancing frame: {currentFrame: 0, nextFrame: 1, endFrame: 119, totalFrames: 120}
[AnimationPlayer.animate] Loop iteration, isPlaying: true
... (循环继续)
```

## 🎯 常见问题诊断

### 问题 1: isPlaying 始终是 false

**症状**:
```
[AnimationPlayer.animate] Loop iteration, isPlaying: false  ← ❌ 应该是 true
[AnimationPlayer.animate] Stopped - isPlaying is false
```

**原因**: `playAction()` 没有正确更新 state

**检查**:
1. Redux DevTools 中查看 `engine.playback.isPlaying`
2. 检查 PlaybackSlice 的 `play` reducer

**解决**:
```typescript
// PlaybackSlice.ts
play(state) {
    state.isPlaying = true;  // ← 确认这行存在
}
```

### 问题 2: animate 没有被调用

**症状**:
```
[AnimationPlayer.play] Starting animation loop
(之后没有 animate 的日志)
```

**原因**: `isPlaying` 在 `play()` 方法内部检查时仍然是 false

**解决**: 这是因为 `play()` 方法检查的是旧的 state，dispatch 还没生效

**修复**: 移除 `play()` 方法中的 `isPlaying` 检查

### 问题 3: 帧没有前进

**症状**:
```
[AnimationPlayer.animate] Timing: {elapsed: 10, frameDuration: 33.33, shouldAdvance: false}
```

**原因**: `elapsed < frameDuration`，还没到更新下一帧的时间

**正常**: 这是正常的，等待足够时间后会看到 `shouldAdvance: true`

### 问题 4: requestAnimationFrame 没有循环

**症状**:
```
[AnimationPlayer.animate] Loop iteration, isPlaying: true
[AnimationPlayer.animate] Timing: ...
(只出现一次，没有后续循环)
```

**原因**: `requestAnimationFrame` 没有被调用

**检查**: 确认 `this.rafId = requestAnimationFrame(this.animate);` 在最后

## 🔧 可能的修复

### 修复 1: 移除 play() 方法中的 isPlaying 检查

当前的问题可能是：`play()` 方法检查 `isPlaying` 时，`playAction()` 刚 dispatch，state 还没更新。

```typescript
// AnimationPlayer.ts - play() 方法
play() {
    console.log('[AnimationPlayer.play] Called');
    const state = getEngineState();
    
    // ❌ 移除这个检查 - state 可能还没更新
    // if (state.playback.isPlaying) {
    //     console.warn('[AnimationPlayer.play] Already playing');
    //     return;
    // }
    
    this.lastFrameTime = performance.now();
    console.log('[AnimationPlayer.play] Starting animation loop');
    this.animate();
}
```

### 修复 2: 确保 playAction 正确

```typescript
// PlaybackSlice.ts
const playbackSlice = createSlice({
    name: 'playback',
    initialState,
    reducers: {
        play(state) {
            console.log('[PlaybackSlice.play] Setting isPlaying to true');
            state.isPlaying = true;
        },
        // ...
    }
});
```

### 修复 3: 检查 animate 的条件

```typescript
private animate = () => {
    const state = getEngineState();
    
    console.log('[AnimationPlayer.animate] Loop iteration, isPlaying:', state.playback.isPlaying);
    
    // 确保这里读取的是最新的 state
    if (!state.playback.isPlaying) {
        console.log('[AnimationPlayer.animate] Stopped - isPlaying is false');
        this.rafId = null;
        return;
    }
    
    // ... 继续动画逻辑
    
    // 确保最后有这行
    this.rafId = requestAnimationFrame(this.animate);
};
```

## 🧪 测试用例

### 测试 1: 检查 Redux State

打开 Redux DevTools，点击 Play 后查看：

```javascript
// 应该看到这个 action
{
  type: 'playback/play',
  payload: undefined
}

// State 应该更新为
{
  engine: {
    playback: {
      isPlaying: true,  // ← 检查这个
      currentFrame: 0,  // ← 应该递增
      fps: 30
    }
  }
}
```

### 测试 2: 手动调用

在控制台手动测试：

```javascript
// 1. 获取 Engine store
const { getEngineStore, getEngineState } = require('@huahuo/engine');
const store = getEngineStore();

// 2. 查看当前状态
const state = getEngineState();
console.log('Current isPlaying:', state.playback.isPlaying);
console.log('Current frame:', state.playback.currentFrame);

// 3. 手动 dispatch play
store.dispatch({ type: 'playback/play' });

// 4. 再次查看状态
const newState = getEngineState();
console.log('New isPlaying:', newState.playback.isPlaying);
```

## 💡 最可能的问题

基于代码分析，最可能的问题是：

**`play()` 方法在 dispatch `playAction()` 之后立即检查 `isPlaying`，但此时 state 还没更新。**

### 时序问题

```
1. playAnimation() 被调用
2. dispatch(playAction())  ← Redux 异步更新 state
3. player.play()           ← 立即调用
4. 检查 state.isPlaying    ← 仍然是 false（旧值）
5. return (因为检查失败)
6. (Redux state 更新完成，但已经太晚了)
```

### 解决方案

移除 `play()` 方法中的 `isPlaying` 检查，让它无条件启动动画循环。循环内部会检查 `isPlaying` 来决定是否继续。

## 🎉 验证成功

如果修复成功，你应该看到：

```
✅ Console 有完整的日志序列
✅ Redux DevTools 显示 isPlaying: true
✅ Redux DevTools 显示 currentFrame 递增 (0→1→2→3...)
✅ Timeline 的播放头在移动
✅ Canvas 上的 GameObject 在动画
```

## 🔄 下一步

1. 查看控制台日志，找出中断的地方
2. 根据上面的诊断修复问题
3. 重新测试播放功能

让我知道你看到了什么日志输出！

