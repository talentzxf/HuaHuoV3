# Component 创建时自动记录初始 Keyframe 优化

## ✅ 问题分析

### 用户报告的问题
1. GameObject 创建时只记录了 Transform 的 keyframes
2. Visual Component 的 keyframes 没有记录
3. 导致切换帧时 Visual 属性（如 strokeWidth）没有恢复到初始值

### 根本原因
在 `Layer.addGameObject()` 中调用 `recordInitialKeyframes()` 时：
- Transform Component 已经创建并存入 Redux store ✅
- Visual Component 可能还没有完全初始化到 store ❌
- 导致遍历 components 时找不到 Visual Component

## ✅ 解决方案：Component 创建时自动记录

### 核心思想
**在 Component 创建（mount）时自动记录初始 keyframes**，而不是在 GameObject 创建后批量记录。

这样可以确保：
- ✅ 每个 Component 创建后立即记录 keyframes
- ✅ 不会遗漏任何 Component
- ✅ 时机准确（Component 一定已经在 store 中）

## 🔧 实现细节

### 1. 修改 ComponentSlice - createComponent reducer

**Before** ❌:
```typescript
createComponent: {
    reducer(state, action: PayloadAction<{
        id: string;
        type: string;
        parentId: string;
        initialProps: Record<string, any>;
    }>) {
        const { id, type, parentId, initialProps } = action.payload;

        state.byId[id] = {
            id,
            type,
            parentId,
            enabled: true,
            props: { ...initialProps },
            keyFrames: {}  // ❌ 空的 keyframes
        };
    },
    prepare(type: string, parentId: string, initialProps: Record<string, any>) {
        return {
            payload: {
                id: nanoid(),
                type,
                parentId,
                initialProps
            }
        };
    }
}
```

**After** ✅:
```typescript
createComponent: {
    reducer(state, action: PayloadAction<{
        id: string;
        type: string;
        parentId: string;
        initialProps: Record<string, any>;
        currentFrame: number;  // ✅ 新增参数
    }>) {
        const { id, type, parentId, initialProps, currentFrame } = action.payload;

        // ✅ 为所有 properties 自动创建初始 keyframes
        const keyFrames: Record<string, PropertyKeyFrame[]> = {};
        for (const propName in initialProps) {
            keyFrames[propName] = [{
                frame: currentFrame,
                value: initialProps[propName],
                easingType: EasingType.Linear
            }];
        }

        state.byId[id] = {
            id,
            type,
            parentId,
            enabled: true,
            props: { ...initialProps },
            keyFrames  // ✅ 已包含初始 keyframes
        };

        console.log(`[ComponentSlice] ✅ Created component ${type} (${id}) at frame ${currentFrame} with initial keyframes:`, Object.keys(keyFrames));
    },
    prepare(type: string, parentId: string, initialProps: Record<string, any>, currentFrame: number) {
        return {
            payload: {
                id: nanoid(),
                type,
                parentId,
                initialProps,
                currentFrame  // ✅ 传入 currentFrame
            }
        };
    }
}
```

**改进点**：
1. ✅ **添加 currentFrame 参数** - 知道在哪一帧创建
2. ✅ **自动创建 keyframes** - 遍历所有 initialProps
3. ✅ **设置默认 easing** - EasingType.Linear
4. ✅ **添加日志** - 方便调试

### 2. 修改 GameObject.addComponent - 传入 currentFrame

**Before** ❌:
```typescript
// String-based component
const componentAction = getEngineStore().dispatch(
    createComponent(componentType, this.id, config || {})
);

// Class-based component
const componentAction = getEngineStore().dispatch(
    createComponent(componentType, this.id, config || {})
);
```

**After** ✅:
```typescript
// ✅ 获取当前帧
const currentFrame = getEngineState().playback.currentFrame;

// String-based component
const componentAction = getEngineStore().dispatch(
    createComponent(componentType, this.id, config || {}, currentFrame)
);

// Class-based component
const componentAction = getEngineStore().dispatch(
    createComponent(componentType, this.id, config || {}, currentFrame)
);
```

### 3. 移除 Layer.recordInitialKeyframes 方法

**Before** ❌:
```typescript
// Layer.addGameObject
const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () => {
    return this.createGameObjectInstance(gameObjectId, renderItem);
});

// ❌ 手动批量记录 keyframes
this.recordInitialKeyframes(gameObjectId, currentFrame);

return gameObject;
```

**After** ✅:
```typescript
// Layer.addGameObject
// ✅ Components 会在创建时自动记录 keyframes
const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () => {
    return this.createGameObjectInstance(gameObjectId, renderItem);
});

return gameObject;
```

**删除的代码**：
- ❌ 整个 `recordInitialKeyframes` 方法（45 行代码）
- ❌ 手动遍历 components
- ❌ 手动 dispatch setPropertyKeyFrame

## 🔄 工作流程对比

### Before ❌ - 批量记录

```
1. Layer.addGameObject('rectangle', renderItem)
   ↓
2. createGameObject() → Redux
   ↓
3. GameObject.constructor()
   ↓
4. addComponent('Transform')
   - createComponent('Transform', ...) → keyFrames: {}  ❌
   - Transform 存入 store
   ↓
5. addComponent('Timeline')
   - createComponent('Timeline', ...) → keyFrames: {}  ❌
   - Timeline 存入 store
   ↓
6. (稍后) registerComponents() 添加 Visual
   - createComponent('Visual', ...) → keyFrames: {}  ❌
   - Visual 存入 store
   ↓
7. recordInitialKeyframes(gameObjectId, 18)
   - 遍历 gameObject.componentIds
   - 找到 Transform ✅ → 记录 keyframes
   - 找到 Timeline ✅ → 记录 keyframes
   - Visual 可能还没完全初始化 ❌ → 遗漏！
   ↓
8. ❌ Visual 没有初始 keyframes
```

### After ✅ - 自动记录

```
1. Layer.addGameObject('rectangle', renderItem)
   ↓
2. createGameObject() → Redux
   ↓
3. GameObject.constructor()
   ↓
4. addComponent('Transform')
   currentFrame = 18
   ↓
   createComponent('Transform', ..., 18)
   ↓
   ComponentSlice.createComponent reducer:
   - 遍历 initialProps: {position, rotation, scale}
   - keyFrames.position = [{frame: 18, value: {...}}]
   - keyFrames.rotation = [{frame: 18, value: 0}]
   - keyFrames.scale = [{frame: 18, value: {...}}]
   ↓
   ✅ Transform 存入 store with keyframes
   ↓
5. addComponent('Timeline')
   currentFrame = 18
   ↓
   createComponent('Timeline', ..., 18)
   ↓
   ✅ Timeline 存入 store with keyframes
   ↓
6. registerComponents() 添加 Visual
   currentFrame = 18
   ↓
   createComponent('Visual', ..., 18)
   ↓
   ComponentSlice.createComponent reducer:
   - 遍历 initialProps: {fillColor, strokeColor, strokeWidth, opacity}
   - keyFrames.fillColor = [{frame: 18, value: '#3d77cc'}]
   - keyFrames.strokeColor = [{frame: 18, value: '#1890ff'}]
   - keyFrames.strokeWidth = [{frame: 18, value: 2}]  ✅
   - keyFrames.opacity = [{frame: 18, value: 1}]
   ↓
   ✅ Visual 存入 store with keyframes
   ↓
7. ✅ 所有 Components 都有初始 keyframes
```

## 📊 优势对比

| 特性 | Before (批量记录) | After (自动记录) |
|------|-----------------|-----------------|
| **时机** | GameObject 创建后统一记录 | Component 创建时立即记录 |
| **可靠性** | ❌ 可能遗漏晚初始化的 Component | ✅ 100% 可靠 |
| **代码复杂度** | ❌ 需要额外的 recordInitialKeyframes 方法 | ✅ 在 reducer 中自动处理 |
| **维护性** | ❌ 需要手动维护两处逻辑 | ✅ 单一职责，易于维护 |
| **扩展性** | ❌ 新增 Component 可能忘记记录 | ✅ 自动支持所有 Component |
| **代码行数** | +45 行（recordInitialKeyframes） | -45 行 ✅ |

## 🎯 关键改进点

### 1. **单一职责**
- Component 创建 = Component 数据初始化 + keyframes 初始化
- 不需要额外的方法来补救

### 2. **时机准确**
- Component 创建时立即记录
- 不依赖于外部调用时机

### 3. **不会遗漏**
- 无论 Component 何时创建（构造函数、registerComponents、动态添加）
- 都会自动记录初始 keyframes

### 4. **代码更简洁**
- 移除了 45 行的 recordInitialKeyframes 方法
- 移除了 Layer.ts 中的调用
- 逻辑集中在 ComponentSlice 中

## 📝 验证方法

### 1. 查看控制台日志

创建 GameObject 时应该看到：

```
[ComponentSlice] ✅ Created component Transform (transform-id) at frame 18 with initial keyframes: ['position', 'rotation', 'scale']
[ComponentSlice] ✅ Created component Timeline (timeline-id) at frame 18 with initial keyframes: []
[ComponentSlice] ✅ Created component Visual (visual-id) at frame 18 with initial keyframes: ['fillColor', 'strokeColor', 'strokeWidth', 'opacity']
```

### 2. 检查 Redux DevTools

在 Redux DevTools 中检查 Component 的 state：

```javascript
{
  components: {
    byId: {
      'visual-id': {
        id: 'visual-id',
        type: 'Visual',
        props: {
          fillColor: '#3d77cc',
          strokeColor: '#1890ff',
          strokeWidth: 2,
          opacity: 1
        },
        keyFrames: {
          fillColor: [{ frame: 18, value: '#3d77cc', easingType: 'linear' }],
          strokeColor: [{ frame: 18, value: '#1890ff', easingType: 'linear' }],
          strokeWidth: [{ frame: 18, value: 2, easingType: 'linear' }],  // ✅
          opacity: [{ frame: 18, value: 1, easingType: 'linear' }]
        }
      }
    }
  }
}
```

### 3. 测试步骤

1. ✅ **创建 GameObject**
   - 在第 18 帧创建 Rectangle
   - 检查控制台，确认所有 Components 的日志
   - 检查 Redux DevTools，确认所有 Components 都有 keyframes

2. ✅ **修改 Visual 属性**
   - 切换到第 25 帧
   - 修改 strokeWidth = 5
   - 检查 Redux，确认有第 25 帧的 keyframe

3. ✅ **验证恢复**
   - 切换回第 18 帧
   - **strokeWidth 应该恢复到 2** ✅

## 🎉 总结

通过将 keyframe 记录逻辑从 Layer.ts 移到 ComponentSlice.ts：

1. ✅ **更可靠** - Component 创建时立即记录，不会遗漏
2. ✅ **更简洁** - 移除了 45 行批量记录代码
3. ✅ **更易维护** - 单一职责，逻辑集中
4. ✅ **更易扩展** - 新增 Component 自动支持

**现在所有 Component 的所有 Property 都会在出生帧正确记录 keyframes！** 🎊

