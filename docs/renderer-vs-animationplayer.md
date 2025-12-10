# Renderer vs AnimationPlayer：Canvas 刷新机制

## 🤔 问题

Merge/Split clip 后，最初使用 `renderer.render()` 来刷新 Canvas，但这是**错误的**！

## 🔍 核心区别

### Renderer.render() ❌

```typescript
render(): void {
    if (this.scope) {
        this.scope.view.update();  // 只刷新 Paper.js 视图
    }
}
```

**作用**：
- 只调用 Paper.js 的 `view.update()`
- 重绘 Paper.js 的 canvas
- **不更新 Redux store**
- **不重新计算 GameObject 的可见性**
- **不插值 Component 属性**

**问题**：
- Merge/Split 改变了 clips
- 但 GameObject 的 visibility 没有重新计算
- Redux store 和 Paper.js 不同步

### AnimationPlayer.updateGameObjects() ✅

```typescript
private updateGameObjects() {
    const store = getEngineStore();
    const state = getEngineState();
    const currentFrame = state.playback.currentFrame;

    // 遍历每个有 timeline 的 layer
    Object.values(state.layers.byId).forEach((layer: any) => {
        if (!layer.hasTimeline) return;
        
        const clips = layer.clips || [];  // ← 使用最新的 clips

        // 遍历 layer 中的每个 GameObject
        layer.gameObjectIds?.forEach((goId: string) => {
            const gameObject = state.gameObjects.byId[goId];
            
            // 1. 检查是否在 bornFrame 之前
            if (currentFrame < bornFrame) {
                store.dispatch(setGameObjectActive({ id: goId, active: false }));
                return;
            }

            // 2. 检查当前帧是否在 clip 中
            const currentClip = clips.find((clip: any) => {
                const clipEnd = clip.startFrame + clip.length - 1;
                return currentFrame >= clip.startFrame && currentFrame <= clipEnd;
            });

            // 3. 计算是否应该可见
            let shouldBeVisible = false;
            if (currentClip) {
                shouldBeVisible = bornFrame >= currentClip.startFrame && 
                                 bornFrame <= clipEnd;
            }

            // 4. 更新 visibility
            if (gameObject.active !== shouldBeVisible) {
                store.dispatch(setGameObjectActive({ id: goId, active: shouldBeVisible }));
            }

            // 5. 插值 Component 属性
            if (shouldBeVisible) {
                this.interpolateGameObjectComponents(goId, currentFrame);
            }
        });
    });
}
```

**作用**：
- ✅ 读取最新的 clips 数据
- ✅ 重新计算每个 GameObject 是否在 clip 中
- ✅ 更新 GameObject 的 active 状态（dispatch action）
- ✅ 插值 Component 属性（dispatch action）
- ✅ Redux store 更新后，ReduxAdapter 自动同步到 Paper.js

## 🔄 完整数据流

### 错误的方式 ❌

```
Merge Clip
    ↓
dispatch(addTimelineClip(...))
    ↓
Redux: layers.clips 更新
    ↓
renderer.render()  ← 只刷新 Paper.js
    ↓
Paper.js 重绘
    ✗ GameObject visibility 没有更新
    ✗ Redux 和 Paper.js 不同步
```

### 正确的方式 ✅

```
Merge Clip
    ↓
dispatch(addTimelineClip(...))
    ↓
Redux: layers.clips 更新
    ↓
dispatch(requestCanvasRefresh())
    ↓
IDE store: canvas.needsRefresh = true
    ↓
CanvasPanel useEffect 检测到变化
    ↓
AnimationPlayer.forceUpdate()
    ↓
updateGameObjects()
    ├─> 读取最新的 clips
    ├─> 重新计算 GameObject visibility
    ├─> dispatch(setGameObjectActive(...))
    ├─> 插值 Component 属性
    └─> dispatch(updateComponentProps(...))
        ↓
Redux store 更新
    ↓
ReduxAdapter 监听到变化
    ↓
同步到 Paper.js
    ├─> 更新 Paper.js item 的 visible
    ├─> 更新 Paper.js item 的 position/rotation/scale
    └─> 更新 Paper.js item 的 fillColor/strokeColor
        ↓
Paper.js 自动重绘
    ✓ GameObject visibility 正确
    ✓ Redux 和 Paper.js 同步
```

## 💡 Renderer 的真正作用

### Renderer 是什么

Renderer 是 Engine 和 Paper.js 之间的**抽象层**：

```typescript
interface IRenderer {
    initialize(canvas: HTMLCanvasElement): void;
    createRenderItem(layer: paper.Layer, type: string, config: any): paper.Item;
    updateItemTransform(item: paper.Item, transform: {...}): void;
    updateItemVisual(item: paper.Item, visual: {...}): void;
    render(): void;  // 只负责刷新视图
    // ...
}
```

### Renderer 的职责

1. **初始化 Paper.js**
   ```typescript
   initialize(canvas: HTMLCanvasElement): void
   ```

2. **创建 Paper.js 对象**
   ```typescript
   createRenderItem(layer, type, config): paper.Item
   ```

3. **更新 Paper.js 对象属性**
   ```typescript
   updateItemTransform(item, transform)
   updateItemVisual(item, visual)
   ```

4. **管理 GameObject → Paper.js Item 的映射**
   ```typescript
   registerRenderItem(gameObjectId, item)
   getRenderItem(gameObjectId): paper.Item
   ```

5. **刷新视图**（低级操作）
   ```typescript
   render(): void {
       this.scope.view.update();
   }
   ```

### Renderer 不负责

- ❌ 业务逻辑（GameObject visibility 计算）
- ❌ 动画逻辑（插值、关键帧）
- ❌ State 管理（Redux dispatch）

这些是 **AnimationPlayer** 和 **ReduxAdapter** 的职责！

## 🎯 正确的职责划分

### AnimationPlayer
- 管理播放/暂停
- 每帧推进
- **重新计算 GameObject visibility**
- **插值 Component 属性**
- Dispatch Redux actions

### ReduxAdapter
- 监听 Redux store 变化
- **同步 store → Paper.js**
- 调用 Renderer 的 update 方法
- 确保 Paper.js 反映 store 状态

### Renderer
- Paper.js 的低级操作封装
- 创建/更新/删除 Paper.js 对象
- 提供抽象接口（可以替换为其他渲染器）
- **不涉及业务逻辑**

### CanvasPanel（IDE）
- 触发刷新请求
- `dispatch(requestCanvasRefresh())`
- **不直接操作 Paper.js**
- **不直接操作 Renderer**

## 📊 架构图

```
┌─────────────────────────────────────────────────┐
│                  CanvasPanel                    │
│  dispatch(requestCanvasRefresh())               │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│              IDE Store (Redux)                  │
│  canvas: { needsRefresh: true }                 │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│             AnimationPlayer                     │
│  forceUpdate() → updateGameObjects()            │
│    - 读取 layers.clips                          │
│    - 计算 GameObject visibility                 │
│    - 插值 Component 属性                        │
│    - dispatch actions                           │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│            Engine Store (Redux)                 │
│  gameObjects, components, layers                │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│             ReduxAdapter                        │
│  监听 store 变化，同步到 Paper.js                │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│               Renderer                          │
│  updateItemVisual(), updateItemTransform()      │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│              Paper.js                           │
│  Canvas 渲染                                     │
└─────────────────────────────────────────────────┘
```

## 🎉 总结

### renderer.render() 的作用
- 只是低级的 Paper.js 视图刷新
- **不更新业务逻辑**
- 用于性能优化场景（避免完整重绘）

### AnimationPlayer.forceUpdate() 的作用
- **重新计算业务逻辑**
- 更新 GameObject visibility
- 插值 Component 属性
- 通过 Redux 和 ReduxAdapter 同步到 Paper.js

### 什么时候用哪个

| 场景 | 使用 | 原因 |
|-----|------|------|
| Merge/Split clip | `AnimationPlayer.forceUpdate()` ✓ | 需要重新计算 visibility |
| 改变 GameObject props | 不需要手动调用 | ReduxAdapter 自动同步 |
| 改变 Component props | 不需要手动调用 | ReduxAdapter 自动同步 |
| 纯视觉调整（罕见） | `renderer.render()` | 只刷新视图 |
| 帧切换 | 不需要手动调用 | AnimationPlayer 自动处理 |

现在 Merge/Split 后会正确更新 GameObject 的可见性！🚀

