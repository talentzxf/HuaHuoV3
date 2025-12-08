# GameObject 出生帧自动记录初始关键帧

## 🎯 功能说明

当 GameObject 在某一帧出生时，自动记录它所有 Component 的所有属性作为初始关键帧。

## 为什么需要这个功能？

### 问题场景

```typescript
// 第 18 帧：创建一个矩形 GameObject
currentFrame = 18;
const rect = layer.addGameObject('Rectangle');

// Transform Component 的初始值
transform.position = { x: 100, y: 100, z: 0 }
transform.rotation = { x: 0, y: 0, z: 0 }
transform.scale = { x: 1, y: 1, z: 1 }
```

**如果不记录初始关键帧：**
- 第 18 帧：GameObject 可见，但没有关键帧数据
- 第 25 帧：用户修改 position.x = 200，创建关键帧
- 回到第 18 帧：插值系统找不到关键帧，无法正确显示！

**记录初始关键帧后：**
- 第 18 帧：自动记录所有属性的初始值作为关键帧
- 第 25 帧：用户修改 position.x = 200，创建第二个关键帧
- 回到第 18 帧：插值系统在第 18 帧找到关键帧，正确显示 position.x = 100
- 第 18-25 帧之间：插值系统在两个关键帧之间平滑插值 ✓

## 实现

### 1. 在 addGameObject 中调用 recordInitialKeyframes

```typescript
addGameObject(name: string, renderItem?: any): IGameObject {
    const uniqueName = this.generateUniqueName(name);
    const store = getEngineStore();
    const currentFrame = getEngineState().playback.currentFrame;

    // 1. Create GameObject with current frame as bornFrameId
    const action = createGameObject(uniqueName, this.id, currentFrame);
    const { id: gameObjectId } = store.dispatch(action).payload;

    // 2. Add to layer
    store.dispatch(addGameObjectToLayer({ layerId: this.id, gameObjectId }));

    // 3. Add keyframe marker to timeline
    store.dispatch(addKeyFrame({ layerId: this.id, frame: currentFrame, gameObjectId }));

    // 4. Create GameObject instance (this creates components)
    const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () => {
        return this.createGameObjectInstance(gameObjectId, renderItem);
    });

    // 5. ✅ Record initial keyframes for all component properties
    this.recordInitialKeyframes(gameObjectId, currentFrame);

    return gameObject;
}
```

### 2. recordInitialKeyframes 方法

```typescript
/**
 * Record keyframes for all properties of all components at the birth frame
 * This ensures the animation system has correct initial values
 */
private recordInitialKeyframes(gameObjectId: string, frame: number): void {
    const { setPropertyKeyFrame } = require('../store/ComponentSlice');
    const state = getEngineState();
    const gameObject = state.gameObjects.byId[gameObjectId];
    
    if (!gameObject || !gameObject.componentIds) {
        return;
    }

    const store = getEngineStore();

    // Iterate through all components of this GameObject
    for (const componentId of gameObject.componentIds) {
        const component = state.components.byId[componentId];
        if (!component) continue;

        // Record keyframe for each property
        for (const propName in component.props) {
            const propValue = component.props[propName];
            
            store.dispatch(setPropertyKeyFrame({
                componentId: componentId,
                propName: propName,
                frame: frame,
                value: propValue
            }));

            console.debug(`[Layer] Recorded initial keyframe: Component ${component.type}.${propName} =`, propValue, 'at frame', frame);
        }
    }
}
```

## 工作流程

```
用户在第 18 帧创建矩形
    ↓
layer.addGameObject('Rectangle')
    ↓
1. dispatch(createGameObject('Rectangle', layerId, 18))
    → GameObject { bornFrameId: 18, componentIds: [] }
    ↓
2. dispatch(addGameObjectToLayer(...))
    → Layer.gameObjectIds: ['go-123']
    ↓
3. dispatch(addKeyFrame({ frame: 18, gameObjectId: 'go-123' }))
    → Layer.keyFrames: [{ frame: 18, gameObjectIds: ['go-123'] }]
    ↓
4. new GameObject('go-123', ...)
    → 创建 Transform Component
    → Transform { position: {x: 100, y: 100, z: 0}, rotation: ..., scale: ... }
    ↓
5. recordInitialKeyframes('go-123', 18)
    ↓
    遍历所有 Components
    ├─> Transform Component
    │   ├─> setPropertyKeyFrame({ componentId, propName: 'position', frame: 18, value: {x: 100, y: 100, z: 0} })
    │   ├─> setPropertyKeyFrame({ componentId, propName: 'rotation', frame: 18, value: {x: 0, y: 0, z: 0} })
    │   └─> setPropertyKeyFrame({ componentId, propName: 'scale', frame: 18, value: {x: 1, y: 1, z: 1} })
    │
    └─> Visual Component (如果有)
        └─> setPropertyKeyFrame({ ... })
```

## 数据结构示例

### GameObject 创建后的状态

```typescript
// GameObject
{
    id: 'go-123',
    name: 'Rectangle-1',
    bornFrameId: 18,
    componentIds: ['comp-transform-123', 'comp-visual-456']
}

// Transform Component
{
    id: 'comp-transform-123',
    type: 'Transform',
    parentId: 'go-123',
    props: {
        position: { x: 100, y: 100, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
    },
    keyFrames: {
        position: [
            { frame: 18, value: { x: 100, y: 100, z: 0 } }  // ← 自动记录
        ],
        rotation: [
            { frame: 18, value: { x: 0, y: 0, z: 0 } }      // ← 自动记录
        ],
        scale: [
            { frame: 18, value: { x: 1, y: 1, z: 1 } }      // ← 自动记录
        ]
    }
}

// Visual Component
{
    id: 'comp-visual-456',
    type: 'Visual',
    parentId: 'go-123',
    props: {
        fillColor: '#ff0000',
        strokeColor: '#000000',
        strokeWidth: 2
    },
    keyFrames: {
        fillColor: [
            { frame: 18, value: '#ff0000' }                  // ← 自动记录
        ],
        strokeColor: [
            { frame: 18, value: '#000000' }                  // ← 自动记录
        ],
        strokeWidth: [
            { frame: 18, value: 2 }                          // ← 自动记录
        ]
    }
}
```

## 使用场景

### 场景 1: 创建并移动物体

```typescript
// 第 18 帧：创建矩形
setCurrentFrame(18);
const rect = layer.addGameObject('Rectangle');
// → 自动记录 position: {x: 100, y: 100, z: 0} at frame 18

// 第 50 帧：移动矩形
setCurrentFrame(50);
updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: { position: { x: 300, y: 200, z: 0 } }
});
// → 记录 position: {x: 300, y: 200, z: 0} at frame 50

// 播放动画
for (let frame = 18; frame <= 50; frame++) {
    setCurrentFrame(frame);
    // → AnimationPlayer 自动插值
    // frame 18: position = {x: 100, y: 100, z: 0}
    // frame 34: position = {x: 200, y: 150, z: 0} (插值)
    // frame 50: position = {x: 300, y: 200, z: 0}
}
```

### 场景 2: 多个属性的动画

```typescript
// 第 18 帧：创建圆形
setCurrentFrame(18);
const circle = layer.addGameObject('Circle');
// → 自动记录所有初始值

// 第 30 帧：修改位置
setCurrentFrame(30);
updateComponentPropsWithKeyFrame({
    id: transformId,
    patch: { position: { x: 200, y: 100, z: 0 } }
});

// 第 50 帧：修改缩放
setCurrentFrame(50);
updateComponentPropsWithKeyFrame({
    id: transformId,
    patch: { scale: { x: 2, y: 2, z: 1 } }
});

// 回到第 18 帧查看
setCurrentFrame(18);
// → position = {x: 100, y: 100, z: 0} ✓ (使用初始关键帧)
// → scale = {x: 1, y: 1, z: 1} ✓ (使用初始关键帧)
```

### 场景 3: 在动画中间创建物体

```typescript
// 第 0 帧：空场景

// 第 30 帧：创建第一个物体
setCurrentFrame(30);
const obj1 = layer.addGameObject('Object1');
// → bornFrameId = 30
// → 记录初始关键帧 at frame 30

// 第 60 帧：创建第二个物体
setCurrentFrame(60);
const obj2 = layer.addGameObject('Object2');
// → bornFrameId = 60
// → 记录初始关键帧 at frame 60

// 播放整个动画
for (let frame = 0; frame <= 100; frame++) {
    setCurrentFrame(frame);
    // frame 0-29: 两个物体都不可见
    // frame 30: obj1 可见，使用初始关键帧 ✓
    // frame 31-59: obj1 可见，obj2 不可见
    // frame 60: obj1 和 obj2 都可见，各自使用初始关键帧 ✓
    // frame 61+: 两个物体都可见
}
```

## 调试信息

启用 `console.debug` 可以看到：

```
[Layer.addGameObject] Creating GameObject: go-123 name: Rectangle-1 at frame: 18 with renderItem: true
[Layer] Recorded initial keyframe: Component Transform.position = {x: 100, y: 100, z: 0} at frame 18
[Layer] Recorded initial keyframe: Component Transform.rotation = {x: 0, y: 0, z: 0} at frame 18
[Layer] Recorded initial keyframe: Component Transform.scale = {x: 1, y: 1, z: 1} at frame 18
[Layer] Recorded initial keyframe: Component Visual.fillColor = #ff0000 at frame 18
[Layer] Recorded initial keyframe: Component Visual.strokeColor = #000000 at frame 18
[Layer] Recorded initial keyframe: Component Visual.strokeWidth = 2 at frame 18
```

## 优势

✅ **自动化** - 用户不需要手动记录初始关键帧
✅ **完整性** - 所有 Component 的所有属性都被记录
✅ **正确性** - 确保插值系统有正确的起始值
✅ **一致性** - 每个 GameObject 的出生帧都有完整的状态快照

## 与 AnimationPlayer 的配合

```typescript
// AnimationPlayer
private interpolateGameObjectComponents(gameObjectId: string, currentFrame: number) {
    // ...
    for (const componentId of gameObject.componentIds) {
        const component = state.components.byId[componentId];
        
        // 检查是否有关键帧
        const hasKeyFrames = Object.keys(component.keyFrames).length > 0;
        if (!hasKeyFrames) continue; // 如果没有关键帧，跳过
        
        // ✅ 有初始关键帧，可以正确插值
        const interpolatedProps = interpolateComponent(component, currentFrame);
        store.dispatch(updateComponentProps({ id: componentId, patch: interpolatedProps }));
    }
}
```

## 总结

现在当 GameObject 在任何一帧出生时：

1. ✅ `bornFrameId` 被设置为当前帧
2. ✅ 在 Layer 的 timeline 上添加关键帧标记
3. ✅ **所有 Component 的所有属性自动记录为初始关键帧**
4. ✅ 插值系统可以正确处理从出生帧开始的动画

完整的动画系统准备就绪！🎬

