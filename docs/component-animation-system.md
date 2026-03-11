# Component 动画系统设计文档

## 📐 系统架构

### 核心概念

每个 Component 的每个属性都可以有**关键帧动画**：
- **KeyFrame**: 在特定帧存储的属性值
- **Interpolation**: 在关键帧之间进行线性插值
- **Current Props**: 当前帧的插值结果

### 数据结构

```typescript
export interface PropertyKeyFrame {
    frame: number;      // 关键帧所在的帧号
    value: any;         // 该帧的属性值
}

export interface ComponentSlice {
    id: string;
    type: string;
    parentId: string;
    enabled: boolean;
    props: Record<string, any>;         // 当前插值后的值
    keyFrames: Record<string, PropertyKeyFrame[]>;  // 属性名 -> 关键帧数组
}
```

## 🎬 工作流程

### 1. 设置关键帧

当用户在 PropertyPanel 中修改属性时：

```typescript
// 用户修改 Transform.position.x = 100
store.dispatch(updateComponentPropsWithKeyFrame({
    id: componentId,
    patch: { position: { x: 100, y: 0, z: 0 } }
}));
```

这个 action 会：
1. ✅ 更新 `component.props.position` 为新值
2. ✅ 在当前帧创建关键帧：`setPropertyKeyFrame({ componentId, propName: 'position', frame: currentFrame, value: {x: 100, y: 0, z: 0} })`
3. ✅ 在 Layer 的 timeline 上添加关键帧标记

### 2. 帧变化时插值

当播放头移动到新帧时：

```typescript
// 用户拖动播放头或播放动画
store.dispatch(setCurrentFrameWithInterpolation(newFrame));
```

这个 action 会：
1. ✅ 更新 `playback.currentFrame`
2. ✅ 调用 `interpolateAllComponents({ currentFrame: newFrame })`
3. ✅ 对所有 Component 的所有有关键帧的属性进行插值
4. ✅ 更新 `component.props` 为插值结果

### 3. 渲染系统读取值

渲染系统从 `component.props` 读取当前值：

```typescript
// PaperRenderer 或其他渲染器
const position = component.props.position;
paperItem.position = new paper.Point(position.x, position.y);
```

## 🔄 插值算法

### 线性插值（Lerp）

支持多种数据类型的插值：

#### 1. 数值 (Number)

```typescript
// frame 0: position.x = 0
// frame 100: position.x = 100
// frame 50: position.x = 50 (线性插值)

lerp(0, 100, 0.5) = 50
```

#### 2. 向量 (Vector/Object)

```typescript
// frame 0: position = {x: 0, y: 0, z: 0}
// frame 100: position = {x: 100, y: 50, z: 20}
// frame 50: position = {x: 50, y: 25, z: 10}

lerp({x: 0, y: 0, z: 0}, {x: 100, y: 50, z: 20}, 0.5)
= {x: 50, y: 25, z: 10}
```

#### 3. 数组 (Array)

```typescript
// frame 0: colors = [1, 0, 0]  (red)
// frame 100: colors = [0, 0, 1]  (blue)
// frame 50: colors = [0.5, 0, 0.5]  (purple)

lerp([1, 0, 0], [0, 0, 1], 0.5) = [0.5, 0, 0.5]
```

#### 4. 布尔/字符串 (Boolean/String)

```typescript
// 不支持插值，使用阶跃函数
// t < 0.5: 返回第一个值
// t >= 0.5: 返回第二个值

lerp(true, false, 0.3) = true
lerp(true, false, 0.7) = false
```

### 边界情况处理

```typescript
// 情况 1: 只有一个关键帧
keyFrames = [{ frame: 50, value: 100 }]
currentFrame = 30 → 返回 100
currentFrame = 50 → 返回 100
currentFrame = 70 → 返回 100

// 情况 2: 在第一个关键帧之前
keyFrames = [{ frame: 50, value: 100 }, { frame: 100, value: 200 }]
currentFrame = 30 → 返回 100 (第一个关键帧的值)

// 情况 3: 在最后一个关键帧之后
currentFrame = 120 → 返回 200 (最后一个关键帧的值)

// 情况 4: 精确匹配关键帧
currentFrame = 50 → 返回 100 (精确值，无需插值)

// 情况 5: 在两个关键帧之间
currentFrame = 75 → 插值计算
t = (75 - 50) / (100 - 50) = 0.5
result = lerp(100, 200, 0.5) = 150
```

## 🎯 使用示例

### 示例 1: 创建简单的位移动画

```typescript
// 第 0 帧：设置起始位置
store.dispatch(setCurrentFrameWithInterpolation(0));
store.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: { position: { x: 0, y: 0, z: 0 } }
}));

// 第 100 帧：设置结束位置
store.dispatch(setCurrentFrameWithInterpolation(100));
store.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: { position: { x: 100, y: 50, z: 0 } }
}));

// 播放动画
for (let frame = 0; frame <= 100; frame++) {
    store.dispatch(setCurrentFrameWithInterpolation(frame));
    // position 会自动在 (0,0,0) 和 (100,50,0) 之间插值
}
```

### 示例 2: 多属性动画

```typescript
// 同时动画化 position 和 rotation
store.dispatch(setCurrentFrameWithInterpolation(0));
store.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    }
}));

store.dispatch(setCurrentFrameWithInterpolation(100));
store.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: {
        position: { x: 100, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 360 }
    }
}));
```

### 示例 3: 手动管理关键帧

```typescript
// 设置特定属性的关键帧
store.dispatch(setPropertyKeyFrame({
    componentId: transformComponentId,
    propName: 'position',
    frame: 50,
    value: { x: 50, y: 25, z: 0 }
}));

// 删除关键帧
store.dispatch(removePropertyKeyFrame({
    componentId: transformComponentId,
    propName: 'position',
    frame: 50
}));

// 清除某个属性的所有关键帧
store.dispatch(clearPropertyKeyFrames({
    componentId: transformComponentId,
    propName: 'position'
}));
```

### 示例 4: 插值单个组件

```typescript
// 只插值特定组件（性能优化）
store.dispatch(interpolateComponentProps({
    componentId: transformComponentId,
    currentFrame: 50
}));
```

## 📊 API 参考

### Actions

#### updateComponentPropsWithKeyFrame
```typescript
updateComponentPropsWithKeyFrame({
    id: string;           // Component ID
    patch: Record<string, any>;  // 要更新的属性
})
```
更新组件属性并在当前帧创建关键帧。

#### setPropertyKeyFrame
```typescript
setPropertyKeyFrame({
    componentId: string;
    propName: string;
    frame: number;
    value: any;
})
```
为特定属性在特定帧设置关键帧。

#### removePropertyKeyFrame
```typescript
removePropertyKeyFrame({
    componentId: string;
    propName: string;
    frame: number;
})
```
删除特定帧的关键帧。

#### clearPropertyKeyFrames
```typescript
clearPropertyKeyFrames({
    componentId: string;
    propName: string;
})
```
清除某个属性的所有关键帧。

#### setCurrentFrameWithInterpolation
```typescript
setCurrentFrameWithInterpolation(frame: number)
```
设置当前帧并插值所有组件。

#### interpolateAllComponents
```typescript
interpolateAllComponents({
    currentFrame: number;
})
```
插值所有组件到指定帧。

#### interpolateComponentProps
```typescript
interpolateComponentProps({
    componentId: string;
    currentFrame: number;
})
```
插值单个组件到指定帧。

## 🎨 集成到 UI

### TimelinePanel

播放头移动时：
```typescript
const handleFrameChange = (newFrame: number) => {
    store.dispatch(setCurrentFrameWithInterpolation(newFrame));
};
```

### PropertyPanel

修改属性时：
```typescript
const handlePropertyChange = (componentId: string, propName: string, value: any) => {
    store.dispatch(updateComponentPropsWithKeyFrame({
        id: componentId,
        patch: { [propName]: value }
    }));
};
```

### Renderer

渲染循环中：
```typescript
function render() {
    const state = getEngineState();
    
    // 读取插值后的属性值
    for (const componentId in state.components.byId) {
        const component = state.components.byId[componentId];
        
        // component.props 已经包含了插值后的当前帧值
        const position = component.props.position;
        const rotation = component.props.rotation;
        
        // 渲染...
    }
}
```

## ⚡ 性能优化

### 1. 批量插值

使用 `interpolateAllComponents` 一次性插值所有组件：
```typescript
// ✅ 好
store.dispatch(interpolateAllComponents({ currentFrame: newFrame }));

// ❌ 慢
for (const componentId in components) {
    store.dispatch(interpolateComponentProps({ componentId, currentFrame: newFrame }));
}
```

### 2. 只插值有关键帧的属性

插值函数自动跳过没有关键帧的属性：
```typescript
// 只有 position 有关键帧，rotation 和 scale 不会被处理
component.keyFrames = {
    position: [{ frame: 0, value: {x: 0, y: 0, z: 0} }, ...]
};
```

### 3. 关键帧排序优化

关键帧数组始终保持按帧号排序，插值时可以提前终止查找。

## 🐛 注意事项

1. **属性结构必须一致**: 插值只在两个值结构相同时工作
   ```typescript
   // ✅ 可以插值
   {x: 0, y: 0, z: 0} → {x: 100, y: 50, z: 20}
   
   // ❌ 无法插值（结构不同）
   {x: 0, y: 0} → {x: 100, y: 50, z: 20}
   ```

2. **深度拷贝**: 插值创建新对象，不会修改原关键帧数据

3. **帧号整数**: 建议使用整数帧号，虽然支持浮点数

4. **性能**: 大量组件时，考虑只插值可见的组件

## 🎉 总结

现在你有了一个完整的关键帧动画系统：
- ✅ 每个属性独立的关键帧
- ✅ 自动线性插值
- ✅ 支持多种数据类型
- ✅ 与 Timeline 完全集成
- ✅ 简单易用的 API

开始创建动画吧！🚀

