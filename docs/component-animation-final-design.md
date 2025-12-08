# Component 动画插值系统 - 最终设计

## 🎯 设计理念

**原则**: 只插值当前 active 的 GameObject 的 Component，逐个处理，清晰可控。

### 为什么不"一把插值所有Component"？

❌ **问题**:
```typescript
// 一次性插值所有 Component
interpolateAllComponents({ currentFrame, activeGameObjectIds })
```

1. 难以调试 - 不知道哪个 Component 出问题
2. 性能浪费 - 处理了不需要显示的 Component
3. 逻辑不清晰 - 状态管理混乱
4. 容易出 bug - 批量操作难以追踪

✅ **解决方案**:
```typescript
// AnimationPlayer 逐个处理
for (const gameObjectId of activeGameObjectIds) {
    for (const componentId of gameObject.componentIds) {
        const interpolatedProps = interpolateComponent(component, currentFrame);
        dispatch(updateComponentProps({ id: componentId, patch: interpolatedProps }));
    }
}
```

## 📐 架构设计

### 1. 纯函数：interpolateComponent

```typescript
/**
 * 纯函数 - 不修改状态，只计算结果
 * @param component - Component 数据
 * @param currentFrame - 目标帧
 * @returns 插值后的 props（新对象）
 */
export function interpolateComponent(
    component: ComponentSlice, 
    currentFrame: number
): Record<string, any> {
    const interpolatedProps = { ...component.props };

    // 遍历每个有关键帧的属性
    for (const propName in component.keyFrames) {
        const keyFrames = component.keyFrames[propName];
        if (keyFrames.length === 0) continue;

        const interpolatedValue = interpolatePropertyValue(keyFrames, currentFrame);
        if (interpolatedValue !== undefined) {
            interpolatedProps[propName] = interpolatedValue;
        }
    }

    return interpolatedProps;
}
```

**优势**:
- ✅ 纯函数，易于测试
- ✅ 不修改原始数据
- ✅ 可以在任何地方调用
- ✅ 职责单一，只做插值计算

### 2. AnimationPlayer：逐个更新

```typescript
class AnimationPlayer {
    private updateGameObjectVisibility() {
        const state = getEngineState();
        const currentFrame = state.playback.currentFrame;

        // 遍历每个 Layer
        Object.values(state.layers.byId).forEach((layer: any) => {
            // 遍历每个 GameObject
            layer.gameObjectIds?.forEach((goId: string) => {
                const gameObject = state.gameObjects.byId[goId];
                
                // 计算是否应该可见
                const shouldBeVisible = this.calculateVisibility(gameObject, currentFrame, clips);

                // 更新可见性
                if (gameObject.active !== shouldBeVisible) {
                    store.dispatch(setGameObjectActive({ id: goId, active: shouldBeVisible }));
                }

                // 如果可见，插值它的 Components
                if (shouldBeVisible) {
                    this.interpolateGameObjectComponents(goId, currentFrame);
                }
            });
        });
    }

    private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number) {
        const state = getEngineState();
        const gameObject = state.gameObjects.byId[gameObjectId];
        
        if (!gameObject || !gameObject.componentIds) return;

        // 遍历每个 Component
        for (const componentId of gameObject.componentIds) {
            const component = state.components.byId[componentId];
            if (!component) continue;

            // 检查是否有关键帧
            const hasKeyFrames = Object.keys(component.keyFrames).length > 0;
            if (!hasKeyFrames) continue;

            // 调用纯函数计算插值
            const interpolatedProps = interpolateComponent(component, currentFrame);

            // 更新 Redux 状态
            store.dispatch(updateComponentProps({
                id: componentId,
                patch: interpolatedProps
            }));
        }
    }
}
```

**优势**:
- ✅ 逐个处理，清晰可控
- ✅ 只处理 active 的 GameObject
- ✅ 只处理有关键帧的 Component
- ✅ 每次 dispatch 都有明确的对象
- ✅ 易于调试和添加日志

## 🔄 工作流程

```
用户拖动播放头到第 50 帧
    ↓
setCurrentFrameWithInterpolation(50)
    ├─> dispatch(setCurrentFrame(50))  // 更新帧号
    └─> 触发 store.subscribe
        ↓
AnimationPlayer.updateGameObjectVisibility()
    ↓
遍历每个 Layer
    └─> 遍历每个 GameObject
        ├─> 计算可见性（基于 clips 和 bornFrame）
        ├─> 更新 active 状态
        └─> 如果 active === true
            └─> interpolateGameObjectComponents(goId, 50)
                └─> 遍历每个 Component
                    ├─> 检查是否有 keyFrames
                    ├─> 调用 interpolateComponent() 计算插值
                    └─> dispatch updateComponentProps 更新状态
                        ↓
Renderer 读取更新后的 component.props 并渲染
```

## 📊 性能分析

### 场景：场景中有 100 个 GameObject，每个有 3 个 Component

| 情况 | 处理的 Component 数量 | 说明 |
|-----|-------------------|------|
| 全部插值 | 300 个 | 不管是否 active |
| **逐个插值** ✅ | ~30-50 个 | 只插值 active 的 GameObject |

### 优化细节

```typescript
// 1. GameObject 级别过滤
if (!shouldBeVisible) {
    continue; // 跳过这个 GameObject 的所有 Component
}

// 2. Component 级别过滤
const hasKeyFrames = Object.keys(component.keyFrames).length > 0;
if (!hasKeyFrames) {
    continue; // 跳过没有关键帧的 Component
}

// 3. 属性级别过滤
for (const propName in component.keyFrames) {
    const keyFrames = component.keyFrames[propName];
    if (keyFrames.length === 0) continue; // 跳过空的关键帧数组
    // ...
}
```

## 🐛 调试优势

### 添加日志很简单

```typescript
private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number) {
    console.log(`[Interpolate] GameObject: ${gameObjectId}, Frame: ${currentFrame}`);
    
    for (const componentId of gameObject.componentIds) {
        const component = state.components.byId[componentId];
        
        const hasKeyFrames = Object.keys(component.keyFrames).length > 0;
        if (!hasKeyFrames) {
            console.log(`  [Skip] Component ${component.type} - no keyframes`);
            continue;
        }

        const interpolatedProps = interpolateComponent(component, currentFrame);
        console.log(`  [Update] Component ${component.type}:`, interpolatedProps);
        
        store.dispatch(updateComponentProps({
            id: componentId,
            patch: interpolatedProps
        }));
    }
}
```

输出示例：
```
[Interpolate] GameObject: go-123, Frame: 50
  [Update] Component Transform: { position: {x: 50, y: 25, z: 0} }
  [Skip] Component Visual - no keyframes
  [Update] Component CustomScript: { speed: 5 }
```

### 错误定位精确

如果某个 Component 插值出错：
- 知道是哪个 GameObject
- 知道是哪个 Component
- 知道是哪个属性
- 知道是哪一帧

## 🧪 测试友好

### 测试纯函数

```typescript
test('interpolateComponent should interpolate position', () => {
    const component: ComponentSlice = {
        id: 'c1',
        type: 'Transform',
        parentId: 'go1',
        enabled: true,
        props: { position: { x: 0, y: 0, z: 0 } },
        keyFrames: {
            position: [
                { frame: 0, value: { x: 0, y: 0, z: 0 } },
                { frame: 100, value: { x: 100, y: 50, z: 0 } }
            ]
        }
    };

    const result = interpolateComponent(component, 50);
    
    expect(result.position).toEqual({ x: 50, y: 25, z: 0 });
});
```

### Mock AnimationPlayer

```typescript
test('AnimationPlayer should only interpolate active GameObjects', () => {
    const mockStore = createMockStore();
    const player = new AnimationPlayer();
    
    // 设置场景：2 个 GameObject，1 个 active，1 个 inactive
    mockStore.gameObjects.byId = {
        'go1': { active: true, componentIds: ['c1'] },
        'go2': { active: false, componentIds: ['c2'] }
    };
    
    player.start();
    
    // 验证只调用了 go1 的 component 更新
    expect(mockStore.dispatch).toHaveBeenCalledWith(
        updateComponentProps({ id: 'c1', ... })
    );
    expect(mockStore.dispatch).not.toHaveBeenCalledWith(
        updateComponentProps({ id: 'c2', ... })
    );
});
```

## 🎯 API 总结

### 核心函数

#### interpolateComponent (纯函数)
```typescript
interpolateComponent(component: ComponentSlice, currentFrame: number): Record<string, any>
```
- 输入：Component 数据 + 目标帧
- 输出：插值后的 props（新对象）
- 副作用：无
- 用途：计算插值结果

#### AnimationPlayer.interpolateGameObjectComponents (私有方法)
```typescript
private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number): void
```
- 输入：GameObject ID + 目标帧
- 输出：无
- 副作用：dispatch updateComponentProps
- 用途：更新一个 GameObject 的所有 Component

### Action

#### updateComponentProps
```typescript
updateComponentProps({ id: string, patch: Record<string, any> })
```
用于更新 Component 的 props。

#### setCurrentFrameWithInterpolation
```typescript
setCurrentFrameWithInterpolation(frame: number)
```
设置当前帧，触发 AnimationPlayer 的插值流程。

## 💡 扩展性

### 添加新的插值算法

```typescript
// 只需修改 interpolateComponent 函数
export function interpolateComponent(
    component: ComponentSlice, 
    currentFrame: number,
    interpolationType: 'linear' | 'bezier' | 'step' = 'linear'  // 新参数
): Record<string, any> {
    // ...
    
    switch (interpolationType) {
        case 'linear':
            interpolatedValue = linearInterpolate(keyFrames, currentFrame);
            break;
        case 'bezier':
            interpolatedValue = bezierInterpolate(keyFrames, currentFrame);
            break;
        case 'step':
            interpolatedValue = stepInterpolate(keyFrames, currentFrame);
            break;
    }
    
    // ...
}
```

### 添加性能监控

```typescript
private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number) {
    const startTime = performance.now();
    
    // ... 插值逻辑 ...
    
    const duration = performance.now() - startTime;
    if (duration > 5) {
        console.warn(`Interpolation took ${duration}ms for GameObject ${gameObjectId}`);
    }
}
```

## 🎉 总结

通过这个设计，我们实现了：

✅ **清晰的职责分离**
- `interpolateComponent`: 纯函数，只计算
- `AnimationPlayer`: 管理流程，逐个更新

✅ **性能优化**
- 只处理 active 的 GameObject
- 只处理有 keyFrames 的 Component
- 三层过滤机制

✅ **易于调试**
- 逐个处理，精确定位
- 可以轻松添加日志
- 易于测试

✅ **可扩展**
- 纯函数易于扩展
- 清晰的插值点
- 易于添加新特性

现在你有一个健壮、清晰、高性能的动画系统！🚀

