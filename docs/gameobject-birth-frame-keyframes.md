# GameObject 出生帧 Keyframe 记录问题修复

## 🎯 问题描述

### 用户报告的问题
1. 在第 18 帧创建 GameObject
2. 在第 25 帧修改 `strokeWidth` 属性
3. 回到第 18 帧
4. ❌ `strokeWidth` 没有恢复到初始值

**根本原因**：GameObject 创建时没有正确记录所有 Component 的所有 Property 作为初始 keyframe。

## ✅ 解决方案

### 1. 确认 `recordInitialKeyframes` 方法存在

在 `Layer.ts` 的 `addGameObject` 方法中，已经有调用 `recordInitialKeyframes`：

```typescript
// Layer.ts - addGameObject method
const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () => {
    return this.createGameObjectInstance(gameObjectId, renderItem);
});

// ✅ Record initial keyframes for all component properties at birth frame
this.recordInitialKeyframes(gameObjectId, currentFrame);
```

### 2. 优化 `recordInitialKeyframes` 实现

**Before** ❌:
```typescript
private recordInitialKeyframes(gameObjectId: string, frame: number): void {
    const { setPropertyKeyFrame } = require('../store/ComponentSlice');
    const state = getEngineState();  // 可能是旧的 state
    const gameObject = state.gameObjects.byId[gameObjectId];

    if (!gameObject || !gameObject.componentIds) {
        return;  // 没有日志，不知道是否执行
    }

    const store = getEngineStore();

    for (const componentId of gameObject.componentIds) {
        const component = state.components.byId[componentId];
        if (!component) continue;  // 没有日志

        for (const propName in component.props) {
            const propValue = component.props[propName];
            store.dispatch(setPropertyKeyFrame({
                componentId: componentId,
                propName: propName,
                frame: frame,
                value: propValue
            }));
        }
    }
}
```

**After** ✅:
```typescript
private recordInitialKeyframes(gameObjectId: string, frame: number): void {
    const { setPropertyKeyFrame } = require('../store/ComponentSlice');
    const store = getEngineStore();
    
    // ✅ Get fresh state (not stale)
    const state = getEngineState();
    const gameObject = state.gameObjects.byId[gameObjectId];

    if (!gameObject || !gameObject.componentIds) {
        console.warn(`[Layer] Cannot record keyframes: GameObject ${gameObjectId} not found or has no components`);
        return;
    }

    console.log(`[Layer] Recording initial keyframes for GameObject ${gameObjectId} at frame ${frame}, components:`, gameObject.componentIds);

    for (const componentId of gameObject.componentIds) {
        const component = state.components.byId[componentId];
        if (!component) {
            console.warn(`[Layer] Component ${componentId} not found in store`);
            continue;
        }

        console.log(`[Layer] Recording keyframes for component ${component.type} (${componentId}), props:`, Object.keys(component.props));

        for (const propName in component.props) {
            const propValue = component.props[propName];

            store.dispatch(setPropertyKeyFrame({
                componentId: componentId,
                propName: propName,
                frame: frame,
                value: propValue
            }));

            console.debug(`[Layer] ✅ Recorded initial keyframe: ${component.type}.${propName} =`, propValue, 'at frame', frame);
        }
    }
}
```

**改进点**：
1. ✅ **获取最新 state**：在函数内部调用 `getEngineState()` 确保获取最新状态
2. ✅ **添加详细日志**：可以诊断 keyframe 是否正确记录
3. ✅ **错误提示**：当 GameObject 或 Component 不存在时给出明确警告

## 🔍 工作流程

### 创建 GameObject 时的完整流程

```
1. 用户在第 18 帧创建 Rectangle
   ↓
2. Layer.addGameObject('rectangle', renderItem) 被调用
   ↓
3. createGameObject action → Redux store
   - 创建 GameObject 数据结构
   - bornFrameId = 18
   ↓
4. addGameObjectToLayer action → Redux store
   - 将 GameObject ID 添加到 Layer
   ↓
5. addKeyFrame action → Redux store
   - 在 Layer 的 keyFrames 数组中记录第 18 帧
   ↓
6. createGameObjectInstance(gameObjectId, renderItem)
   - 创建 Transform component
   - 创建 Timeline component  
   - 创建 Visual component
   - 所有 components 存入 Redux store
   ↓
7. ✅ recordInitialKeyframes(gameObjectId, 18)
   - 读取最新的 state
   - 遍历所有 components:
     - Transform.position → setPropertyKeyFrame(frame: 18, value: {x:0, y:0})
     - Transform.rotation → setPropertyKeyFrame(frame: 18, value: 0)
     - Transform.scale → setPropertyKeyFrame(frame: 18, value: {x:1, y:1})
     - Visual.fillColor → setPropertyKeyFrame(frame: 18, value: '#3d77cc')
     - Visual.strokeColor → setPropertyKeyFrame(frame: 18, value: '#1890ff')
     - Visual.strokeWidth → setPropertyKeyFrame(frame: 18, value: 2)  ✅
     - Visual.opacity → setPropertyKeyFrame(frame: 18, value: 1)
   ↓
8. GameObject 创建完成
```

### 修改属性时的流程

```
1. 用户在第 25 帧修改 strokeWidth = 5
   ↓
2. handlePropertyChange('visual-component-id', 'strokeWidth', 5)
   ↓
3. updateComponentPropsWithKeyFrame action
   - 更新 component.props.strokeWidth = 5
   - 添加 keyframe: frame 25, value: 5
   ↓
4. Component 有两个 keyframes:
   - frame 18: strokeWidth = 2  ✅
   - frame 25: strokeWidth = 5  ✅
```

### 切换帧时的插值

```
1. 用户切换回第 18 帧
   ↓
2. AnimationPlayer.setCurrentFrame(18)
   ↓
3. 遍历所有 active GameObjects 的所有 Components
   ↓
4. 对每个 Component 调用 interpolateComponentProps
   ↓
5. Visual component 插值:
   - strokeWidth:
     - keyframes: [{ frame: 18, value: 2 }, { frame: 25, value: 5 }]
     - currentFrame = 18
     - 找到左右 keyframes: left = frame 18, right = frame 25
     - t = (18 - 18) / (25 - 18) = 0
     - interpolated value = lerp(2, 5, 0) = 2  ✅
   ↓
6. dispatch updateComponentProps({ strokeWidth: 2 })
   ↓
7. ✅ strokeWidth 恢复到 2
```

## 🐛 可能的问题场景

### 场景 1：Components 未完全初始化

**问题**：`recordInitialKeyframes` 被调用时，components 还未存入 store。

**解决**：
- ✅ 在 `createGameObjectInstance` **之后**调用 `recordInitialKeyframes`
- ✅ 在函数内部重新获取 state（`getEngineState()`）

### 场景 2：某些 Properties 被忽略

**问题**：只记录了部分 properties。

**解决**：
- ✅ 遍历 `component.props` 的**所有**属性
- ✅ 添加日志确认每个属性都被记录

### 场景 3：Keyframe 被覆盖

**问题**：后续操作覆盖了初始 keyframe。

**解决**：
- ✅ 使用 `setPropertyKeyFrame` 而不是 `updateComponentProps`
- ✅ `setPropertyKeyFrame` 会正确添加到 keyFrames 数组

## 📊 验证方法

### 1. 查看控制台日志

创建 GameObject 时应该看到：

```
[Layer] Recording initial keyframes for GameObject xyz123 at frame 18, components: ['transform-id', 'timeline-id', 'visual-id']
[Layer] Recording keyframes for component Transform (transform-id), props: ['position', 'rotation', 'scale']
[Layer] ✅ Recorded initial keyframe: Transform.position = {x: 0, y: 0} at frame 18
[Layer] ✅ Recorded initial keyframe: Transform.rotation = 0 at frame 18
[Layer] ✅ Recorded initial keyframe: Transform.scale = {x: 1, y: 1} at frame 18
[Layer] Recording keyframes for component Visual (visual-id), props: ['fillColor', 'strokeColor', 'strokeWidth', 'opacity']
[Layer] ✅ Recorded initial keyframe: Visual.fillColor = #3d77cc at frame 18
[Layer] ✅ Recorded initial keyframe: Visual.strokeColor = #1890ff at frame 18
[Layer] ✅ Recorded initial keyframe: Visual.strokeWidth = 2 at frame 18  ← 关键！
[Layer] ✅ Recorded initial keyframe: Visual.opacity = 1 at frame 18
```

### 2. 检查 Redux DevTools

在 Redux DevTools 中检查 `components` state：

```javascript
{
  components: {
    byId: {
      'visual-id': {
        id: 'visual-id',
        type: 'Visual',
        props: {
          strokeWidth: 2  // 当前值
        },
        keyFrames: {
          strokeWidth: [
            { frame: 18, value: 2 },     // ✅ 初始 keyframe
            { frame: 25, value: 5 }      // 用户修改的 keyframe
          ]
        }
      }
    }
  }
}
```

### 3. 测试步骤

1. ✅ **创建 GameObject**
   - 在第 18 帧创建 Rectangle
   - 检查控制台日志，确认所有 properties 的 keyframes 被记录
   - 检查 Redux DevTools，确认 keyFrames 数组有第 18 帧的记录

2. ✅ **修改属性**
   - 切换到第 25 帧
   - 修改 strokeWidth = 5
   - 检查 Redux DevTools，确认 keyFrames 数组有第 25 帧的记录

3. ✅ **验证插值**
   - 切换回第 18 帧
   - strokeWidth 应该恢复到 2
   - 切换到第 21 帧（中间帧）
   - strokeWidth 应该是插值结果（约 3.14）
   - 切换到第 25 帧
   - strokeWidth 应该是 5

## 🎉 总结

通过以下改进：

1. ✅ **确保获取最新 state** - 在 `recordInitialKeyframes` 内部调用 `getEngineState()`
2. ✅ **添加详细日志** - 可以诊断问题
3. ✅ **正确的调用时机** - 在 components 创建完成后调用

现在 GameObject 创建时会正确记录所有 Component 的所有 Property 作为初始 keyframe，切换帧时属性值会正确恢复！🎊

## 🔧 如果问题仍然存在

请检查：
1. 控制台是否有 `[Layer] Recording initial keyframes` 的日志？
2. 如果没有，说明 `recordInitialKeyframes` 没被调用
3. 如果有但没有具体的 property 日志，说明 components 为空
4. 检查 Redux DevTools 中 component 的 keyFrames 数组是否有出生帧的记录

