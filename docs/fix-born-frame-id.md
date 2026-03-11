# GameObject bornFrameId 修复

## 🐛 问题

在第 18 帧创建 GameObject，但它的 `bornFrameId` 却是 0。

### 问题根源

在 `GameObjectSlice.ts` 中，`createGameObject` 的 reducer 硬编码了 `bornFrameId = 0`：

```typescript
// ❌ 问题代码
state.byId[id] = {
    id,
    name,
    active: true,
    bornFrameId: 0,      // 硬编码为 0！
    parent,
    children: [],
    componentIds: []
};
```

## ✅ 解决方案

### 1. 更新 createGameObject Action

让 `createGameObject` 接受 `bornFrameId` 参数：

```typescript
// GameObjectSlice.ts
createGameObject: {
    reducer(
        state,
        action: PayloadAction<{
            id: string;
            name: string;
            parent: string | null;
            bornFrameId: number;  // ← 新增参数
        }>
    ) {
        const { id, name, parent, bornFrameId } = action.payload;

        state.byId[id] = {
            id,
            name,
            active: true,
            bornFrameId,         // ← 使用传入的值
            parent,
            children: [],
            componentIds: []
        };

        // ...
    },
    prepare(name: string, parent: string | null = null, bornFrameId: number = 0) {
        return {
            payload: {
                id: nanoid(),
                name,
                parent,
                bornFrameId  // ← 传递 bornFrameId
            }
        };
    }
},
```

### 2. 更新 Layer.addGameObject 调用

在创建 GameObject 时传入当前帧：

```typescript
// Layer.ts
addGameObject(name: string, renderItem?: any): IGameObject {
    const uniqueName = this.generateUniqueName(name);
    const store = getEngineStore();
    
    // ✅ 获取当前帧
    const currentFrame = getEngineState().playback.currentFrame;
    
    // ✅ 传入当前帧作为 bornFrameId
    const action = createGameObject(uniqueName, this.id, currentFrame);
    const { id: gameObjectId } = store.dispatch(action).payload;

    // ...
    
    console.debug('[Layer.addGameObject] Creating GameObject:', gameObjectId, 'at frame:', currentFrame);
    
    return ...;
}
```

## 🎯 效果

### 修复前 ❌

```typescript
// 在第 18 帧创建 GameObject
currentFrame = 18
layer.addGameObject('Rectangle')

// GameObject 数据
{
    id: 'go-123',
    name: 'Rectangle',
    bornFrameId: 0,  // ❌ 错误！应该是 18
    // ...
}
```

### 修复后 ✅

```typescript
// 在第 18 帧创建 GameObject
currentFrame = 18
layer.addGameObject('Rectangle')

// GameObject 数据
{
    id: 'go-123',
    name: 'Rectangle',
    bornFrameId: 18,  // ✅ 正确！
    // ...
}
```

## 📊 可见性行为

现在 GameObject 的可见性会正确遵守 `bornFrameId`：

| 当前帧 | GameObject (bornFrameId=18) 可见性 | 说明 |
|-------|----------------------------------|------|
| 0-17 | ❌ 不可见 | currentFrame < bornFrameId |
| 18 | ✅ 可见 | currentFrame === bornFrameId |
| 19+ | ✅ 可见 | 在 clip 内或其他规则 |

## 🔄 完整流程

```
用户在第 18 帧点击创建矩形工具
    ↓
currentFrame = 18
    ↓
layer.addGameObject('Rectangle')
    ├─> 获取 currentFrame = 18
    ├─> dispatch(createGameObject('Rectangle', layerId, 18))
    │       ↓
    │   reducer: bornFrameId = 18 ✓
    │
    ├─> dispatch(addKeyFrame({ frame: 18, ... }))
    └─> 创建 GameObject 实例

AnimationPlayer.updateGameObjects()
    ├─> currentFrame = 18
    ├─> GameObject.bornFrameId = 18
    ├─> 18 < 18? NO
    ├─> 18 === 18? YES ✓
    └─> setGameObjectActive({ active: true })
```

## 🧪 测试场景

### 场景 1: 在第 0 帧创建

```typescript
setCurrentFrame(0);
layer.addGameObject('Object1');

// 结果
gameObject.bornFrameId === 0 ✓
```

### 场景 2: 在第 50 帧创建

```typescript
setCurrentFrame(50);
layer.addGameObject('Object2');

// 结果
gameObject.bornFrameId === 50 ✓

// 可见性
AnimationPlayer.updateGameObjects()
- frame 0-49: active = false (currentFrame < bornFrameId)
- frame 50: active = true (currentFrame === bornFrameId)
- frame 51+: active = true/false (依赖 clips)
```

### 场景 3: 在播放动画时创建

```typescript
// 动画播放到第 30 帧
playback.currentFrame = 30;
playback.isPlaying = true;

// 用户暂停并创建对象
playback.isPlaying = false;
layer.addGameObject('Object3');

// 结果
gameObject.bornFrameId === 30 ✓
```

## 💡 默认值

`prepare` 函数中 `bornFrameId` 有默认值 `0`：

```typescript
prepare(name: string, parent: string | null = null, bornFrameId: number = 0) {
    // ...
}
```

这意味着：
- 如果调用时不传 `bornFrameId`，默认为 0
- 向后兼容：如果有其他地方调用 `createGameObject` 没有传第三个参数，仍然可以工作

## 📝 API 变化

### 修改前

```typescript
createGameObject(name: string, parent: string | null = null)
```

### 修改后

```typescript
createGameObject(
    name: string, 
    parent: string | null = null, 
    bornFrameId: number = 0  // ← 新增参数（可选）
)
```

## 🎉 总结

✅ **修复了 bornFrameId 始终为 0 的问题**
- 现在使用当前帧作为 GameObject 的出生帧
- GameObject 只在出生帧及之后可见

✅ **向后兼容**
- `bornFrameId` 参数有默认值 0
- 不破坏现有代码

✅ **逻辑正确**
- 在第 18 帧创建 → bornFrameId = 18
- 第 0-17 帧不可见
- 第 18+ 帧根据 clips 和其他规则决定可见性

现在 GameObject 的出生帧会正确记录了！🎊

