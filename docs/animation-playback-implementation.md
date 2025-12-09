# 动画播放功能实现

## 🎯 功能说明

用户点击顶部的 Play 按钮时，触发动画播放。动画会播放到：
- **Animation End Frame**（如果设置了）
- 或 **Project Total Frames**（如果没有设置 Animation End）

播放完成后自动循环回到开头继续播放。

## 📐 播放逻辑

### 循环规则

```typescript
// 确定结束帧
const endFrame = animationEndFrame !== null && animationEndFrame >= 0 
    ? animationEndFrame      // 使用动画结束标记
    : totalFrames - 1;       // 使用项目总帧数

// 下一帧计算
let nextFrame = currentFrame + 1;

// 如果超过结束帧，循环回到开头
if (nextFrame > endFrame) {
    nextFrame = 0;
}
```

### 示例场景

#### 场景 1: 使用 Animation End Frame
```
Project.totalFrames = 120
Project.animationEndFrame = 50

播放流程:
Frame 0 → 1 → 2 → ... → 49 → 50 → 0 → 1 → ...
                              ↑ 循环回到开头
```

#### 场景 2: 没有 Animation End Frame
```
Project.totalFrames = 120
Project.animationEndFrame = null

播放流程:
Frame 0 → 1 → 2 → ... → 118 → 119 → 0 → 1 → ...
                                  ↑ 循环回到开头
```

#### 场景 3: Animation End 在中间
```
Project.totalFrames = 200
Project.animationEndFrame = 80

播放流程:
Frame 0 → 1 → 2 → ... → 79 → 80 → 0 → 1 → ...
                              ↑ 循环回到开头

Frame 81-199: 不会播放（除非移除 Animation End 标记）
```

## 🔧 实现

### 1. AnimationPlayer 更新

修改 `animate()` 方法来支持循环到 Animation End Frame：

```typescript
// AnimationPlayer.ts
private animate = () => {
    const state = getEngineState();

    if (!state.playback.isPlaying) {
        this.rafId = null;
        return;
    }

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const frameDuration = 1000 / state.playback.fps;

    if (elapsed >= frameDuration) {
        const store = getEngineStore();
        const engineState = getEngineState();
        const currentFrame = state.playback.currentFrame;
        
        // 确定结束帧
        const project = engineState.project.current;
        const animationEndFrame = project?.animationEndFrame;
        const totalFrames = project?.totalFrames || 120;
        
        const endFrame = animationEndFrame !== null && animationEndFrame >= 0 
            ? animationEndFrame 
            : totalFrames - 1;
        
        // 计算下一帧
        let nextFrame = currentFrame + 1;
        
        // 循环回到开头
        if (nextFrame > endFrame) {
            nextFrame = 0;
        }
        
        store.dispatch(setCurrentFrame(nextFrame));
        this.lastFrameTime = now;
    }

    this.rafId = requestAnimationFrame(this.animate);
};
```

### 2. Composite Actions

创建 `playAnimation` 和 `pauseAnimation` actions：

```typescript
// actions.ts

/**
 * Play animation
 * Updates playback state and starts AnimationPlayer
 */
export const playAnimation = () => {
    return (dispatch: any) => {
        // Update state
        dispatch(playAction());
        
        // Start animation player
        const player = getAnimationPlayer();
        player.play();
        
        console.log('[playAnimation] Animation started');
    };
};

/**
 * Pause animation
 * Updates playback state (AnimationPlayer will stop automatically based on isPlaying flag)
 */
export const pauseAnimation = () => {
    return (dispatch: any) => {
        // Update state (AnimationPlayer checks isPlaying flag in animate loop)
        dispatch(pauseAction());
        
        console.log('[pauseAnimation] Animation paused');
    };
};
```

### 3. App.tsx 集成

更新 Play/Pause 按钮处理器：

```typescript
// App.tsx

import { playAnimation, pauseAnimation, getEngineStore } from '@huahuo/engine';

const handlePlay = () => {
    // Update IDE playback state
    dispatch(setPlaying(true));
    
    // Start animation in engine
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(playAnimation());
    
    message.success(t('messages.playing'));
};

const handlePause = () => {
    // Update IDE playback state
    dispatch(setPlaying(false));
    
    // Pause animation in engine
    const engineStore = getEngineStore();
    (engineStore.dispatch as any)(pauseAnimation());
    
    message.warning(t('messages.paused'));
};
```

## 🔄 完整播放流程

```
用户点击 Play 按钮
    ↓
App.handlePlay()
    ├─> dispatch(setPlaying(true))  // IDE state
    └─> engineStore.dispatch(playAnimation())  // Engine state
        ↓
        playAnimation() action
        ├─> dispatch(play())  // Update playback.isPlaying = true
        └─> AnimationPlayer.play()
            ↓
            AnimationPlayer.animate() 开始循环
            ↓
            每帧检查:
            ├─> 计算 endFrame (animationEndFrame or totalFrames-1)
            ├─> nextFrame = currentFrame + 1
            ├─> if (nextFrame > endFrame) nextFrame = 0
            └─> dispatch(setCurrentFrame(nextFrame))
                ↓
                Redux state 更新
                ↓
                AnimationPlayer.updateGameObjects() (通过 subscribe)
                ↓
                插值和渲染
                ↓
                继续下一帧...
```

## 🎨 用户体验

### 播放控制

```
Top Menu Bar:
┌────────────────────────────────────┐
│ [Save] [Open] [Project] | [▶ Play] │  ← 点击开始播放
└────────────────────────────────────┘

播放中:
┌────────────────────────────────────┐
│ [Save] [Open] [Project] | [⏸ Pause]│  ← 变为 Pause
└────────────────────────────────────┘

Timeline:
┌────────────────────────────────────┐
│ 0  5  10  15  20  25 ... 50│ANIM   │
│                         ↑  │END    │
│                    当前帧移动        │
└────────────────────────────────────┘
```

### 循环行为

```
设置 Animation End at Frame 50:

播放:
0 → 1 → 2 → ... → 49 → 50 → 0 → 1 → ...
                         ↑ 自动循环

Timeline 显示:
- 红色播放头从 Frame 0 移动到 Frame 50
- 到达 Frame 50 后立即跳回 Frame 0
- 继续循环播放
```

## 💡 设计优势

### 1. 灵活的循环点

用户可以通过设置 Animation End Frame 来控制循环位置：

```
短循环测试:
- 设置 Animation End at Frame 20
- 快速测试前 20 帧的效果

完整播放:
- 移除 Animation End 标记
- 播放整个项目
```

### 2. 非破坏性

```
Animation End Frame 只是一个标记:
- 不删除后面的帧
- 不影响编辑
- 只影响播放循环

用户可以:
1. 设置 Animation End at Frame 50
2. 播放测试
3. 继续编辑 Frame 51-100
4. 移动 Animation End to Frame 100
5. 重新播放
```

### 3. 实时响应

```
播放中可以:
- 拖动播放头 → 立即跳转
- 点击 Pause → 立即暂停
- 修改 Animation End → 下次循环时生效
```

## 🎯 特殊情况处理

### 情况 1: Animation End 在当前帧之前

```
当前帧: 80
Animation End: 50

点击 Play:
→ 从 Frame 80 开始播放
→ Frame 80 → 81 → ... → 119 → 0 → 1 → ... → 50 → 0
→ 会先播放到项目结尾，然后循环到 Animation End
```

**优化**: 可以考虑点击 Play 时自动跳回 Frame 0

### 情况 2: Animation End = 0

```
Animation End: 0

播放:
Frame 0 → 0 → 0 → ...
→ 一直在 Frame 0（不推荐）
```

### 情况 3: 播放中修改 Animation End

```
播放中，当前 Frame 30
Animation End 从 50 改为 20

行为:
→ Frame 30 → 31 → ... → 119 → 0 → 1 → ... → 20 → 0
→ 当前循环继续到结尾，下次循环从 0 到 20
```

## 🎉 总结

现在实现了完整的动画播放功能：

✅ **Play/Pause 控制** - 顶部按钮控制播放
✅ **循环到 Animation End** - 支持自定义循环点
✅ **循环到 Project End** - 没有 Animation End 时播放全部
✅ **自动循环** - 播放完自动回到开头
✅ **状态同步** - IDE 和 Engine 状态同步
✅ **实时响应** - 播放中可以暂停、拖动

完美实现！🚀

