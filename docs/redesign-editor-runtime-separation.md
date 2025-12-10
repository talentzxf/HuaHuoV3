# 重新设计：编辑时和运行时分离

## 🎯 架构调整

根据你的建议，重新设计了编辑时和运行时的数据流：

**核心理念**：
- ✅ **编辑时**：只操作 Editor State (`components.props`, `gameObjects`, `layers`)
- ✅ **播放时**：按下 Play → 复制 Editor State 到 Runtime State
- ✅ **Runtime State 独立**：播放时的所有操作都在 Runtime 中，不污染 Editor

## 📊 新的数据结构

### Editor State (持久化，保存到文件)

```typescript
{
  components: {
    byId: {
      "comp_123": {
        id: string,
        type: string,
        props: Record<string, any>,      // ← 编辑时的值
        keyFrames: Record<string, PropertyKeyFrame[]>
      }
    }
  },
  gameObjects: { ... },
  layers: { ... }
}
```

### Runtime State (瞬态，不保存)

```typescript
{
  componentRuntime: {
    byId: {
      "comp_123": {
        componentId: string,
        props: Record<string, any>  // ← 播放时的插值结果
      }
    }
  }
  // 未来可以添加:
  // gameObjectRuntime: { ... },
  // layerRuntime: { ... }
}
```

## 🔄 完整数据流

### 编辑时 (Edit Mode)

```
用户在 PropertyPanel 编辑属性
    ↓
dispatch(updateComponentPropsWithKeyFrame({
    id: componentId,
    patch: { position: { x: 100 } }
}))
    ↓
1. dispatch(updateComponentProps({ id, patch }))
   → components.byId[id].props 更新 (编辑器值)
    ↓
2. dispatch(setPropertyKeyFrame({ ... }))
   → components.byId[id].keyFrames 更新 (关键帧)
    ↓
3. dispatch(addKeyFrame({ ... }))
   → layers.byId[layerId].keyFrames 添加标记
    ↓
ReduxAdapter 监听 components.props 变化
    ↓
同步到 Paper.js
    ↓
Canvas 显示更新后的状态
```

**关键点**：
- ❌ 不创建 `componentRuntime`
- ✅ 直接修改 `components.props`
- ✅ ReduxAdapter 监听 `components` 变化

### 播放时 (Playback Mode)

```
用户点击 Play 按钮
    ↓
dispatch(playAnimation())
    ↓
1. dispatch(initializeRuntime())
   → 复制所有 components.props 到 componentRuntime
   → componentRuntime.byId[id].props = { ...components.byId[id].props }
    ↓
2. dispatch(playAction())
   → playback.isPlaying = true
    ↓
3. AnimationPlayer.play()
   → 开始每帧循环
    ↓
每帧：
  AnimationPlayer.onFrame(frame)
      ↓
  读取 components.byId[id].keyFrames
      ↓
  interpolateComponent(component, frame)
      ↓
  计算插值结果: { position: { x: 150 }, ... }
      ↓
  dispatch(updateRuntimeProps({
      componentId: id,
      props: interpolatedProps
  }))
      ↓
  componentRuntime.byId[id].props 更新
      ↓
  ReduxAdapter 监听 componentRuntime 变化
      ↓
  同步到 Paper.js
      ↓
  Canvas 显示动画
```

**关键点**：
- ✅ `initializeRuntime()` 复制 Editor → Runtime
- ✅ 动画插值只更新 `componentRuntime`
- ✅ 不修改 `components.props`（编辑器数据不变）
- ✅ ReduxAdapter 监听 `componentRuntime` 变化

### 停止播放 (Stop)

```
用户点击 Stop 按钮
    ↓
dispatch(stopAnimation())
    ↓
1. dispatch(stopAction())
   → playback.isPlaying = false
   → playback.currentFrame = 0
    ↓
2. dispatch(clearRuntimeComponents())
   → componentRuntime.byId = {}  (清空运行时数据)
    ↓
AnimationPlayer.stop()
    ↓
回到编辑模式
  - PropertyPanel 显示 components.props (编辑器值)
  - ReduxAdapter 监听 components 变化
```

**关键点**：
- ✅ `clearRuntimeComponents()` 清空 Runtime
- ✅ 回到编辑模式，显示原始编辑器数据

## 🛠️ 修改的代码

### 1. ComponentSlice.ts ✅

```typescript
// 恢复 props 字段（编辑器值）
export interface ComponentSlice {
    props: Record<string, any>;  // ← 恢复
    keyFrames: Record<string, PropertyKeyFrame[]>;
}

// 恢复 updateComponentProps
updateComponentProps(state, action) {
    const { id, patch } = action.payload;
    Object.assign(state.byId[id].props, patch);
}

// 恢复 createComponent 的 initialProps 参数
createComponent: {
    prepare(type, parentId, initialProps = {}) {
        return { payload: { id: nanoid(), type, parentId, initialProps } };
    }
}
```

### 2. actions.ts ✅

```typescript
// 添加 initializeRuntime
export const initializeRuntime = () => {
    return (dispatch, getState) => {
        const state = getState();
        const engineState = state.engine || state;

        // 复制所有 component props 到 componentRuntime
        Object.values(engineState.components.byId).forEach(component => {
            dispatch(updateRuntimeProps({
                componentId: component.id,
                props: { ...component.props }
            }));
        });
    };
};

// 更新 playAnimation
export const playAnimation = () => {
    return (dispatch) => {
        dispatch(initializeRuntime());  // ← 先初始化 Runtime
        dispatch(playAction());
        getAnimationPlayer().play();
    };
};

// 更新 stopAnimation
export const stopAnimation = () => {
    return (dispatch) => {
        dispatch(stopAction());
        dispatch(clearRuntimeComponents());  // ← 清空 Runtime
    };
};

// updateComponentPropsWithKeyFrame 更新 components.props
export const updateComponentPropsWithKeyFrame = (payload) => {
    return (dispatch, getState) => {
        // 更新编辑器 props（不是 runtime）
        dispatch(updateComponentProps({ id, patch }));
        
        // 设置关键帧
        dispatch(setPropertyKeyFrame({ ... }));
        
        // 添加关键帧标记
        dispatch(addKeyFrame({ ... }));
    };
};
```

### 3. GameObject.ts ✅

```typescript
// 使用普通的 createComponent（不初始化 runtime）
const componentAction = getEngineStore().dispatch(
    createComponent(componentType, this.id, config)  // ← 传递 config
);
```

### 4. PropertyPanel ✅

```typescript
// 根据播放状态选择数据源
const updateData = () => {
    const isPlaying = state.playback.isPlaying;
    
    const propsMap = {};
    components.forEach(comp => {
        if (isPlaying) {
            // 播放时：从 componentRuntime 读取
            propsMap[comp.id] = state.componentRuntime.byId[comp.id]?.props || {};
        } else {
            // 编辑时：从 components.props 读取
            propsMap[comp.id] = comp.props || {};
        }
    });
    
    setComponentPropsMap(propsMap);
};
```

### 5. ComponentBase.ts ✅

```typescript
// getProps 返回 components.props（编辑器数据）
protected getProps(): Record<string, any> {
    return state.components.byId[this.componentId]?.props || {};
}

// updateProp 更新 components.props
protected updateProp(key: string, value: any): void {
    dispatch(updateComponentProps({ id, patch: { [key]: value } }));
}
```

### 6. ReduxAdapter.ts ✅

```typescript
// 同时监听 components 和 componentRuntime
handleStateChange(prevState, currState) {
    // 编辑时：监听 components.props 变化
    if (prevState.components !== currState.components) {
        this.handleComponentChanges(...);
    }
    
    // 播放时：监听 componentRuntime.props 变化
    if (prevState.componentRuntime !== currState.componentRuntime) {
        this.handleComponentRuntimeChanges(...);
    }
}
```

### 7. ShapeTranslateHandler ✅

```typescript
// 从 components.props 读取（编辑器数据）
const currentPos = transformComponent.props?.position || { x: 0, y: 0 };
```

## ✅ 验证清单

现在的行为：

### 编辑模式
- ✅ 创建 GameObject → `components.props` 初始化
- ✅ 拖动 GameObject → 更新 `components.props` + `keyFrames`
- ✅ 编辑属性 → 更新 `components.props` + `keyFrames`
- ✅ PropertyPanel 显示 `components.props`
- ✅ `componentRuntime` 为空

### 播放模式
- ✅ 按下 Play → 复制 `components.props` 到 `componentRuntime`
- ✅ 每帧插值 → 更新 `componentRuntime.props`
- ✅ PropertyPanel 显示 `componentRuntime.props`（插值结果）
- ✅ `components.props` 不变（编辑器数据保持原样）

### 停止播放
- ✅ 按下 Stop → 清空 `componentRuntime`
- ✅ 回到编辑模式 → PropertyPanel 显示 `components.props`

## 🎯 未来扩展

按照同样的模式，可以添加：

```typescript
// Runtime State (未来)
{
  componentRuntime: { ... },      // ✅ 已实现
  gameObjectRuntime: {            // 🔜 未来：运行时创建/销毁的对象
    byId: { ... }
  },
  layerRuntime: {                 // 🔜 未来：运行时 layer 状态
    byId: { ... }
  }
}
```

**用途**：
- 粒子系统运行时创建大量 GameObject
- 物理引擎运行时修改对象状态
- AI 系统运行时创建临时对象

这些都不会污染 Editor State！

## 🎉 总结

重新设计完成：

✅ **编辑时**：只操作 `components.props`，不创建 `componentRuntime`
✅ **播放时**：`initializeRuntime()` 复制 Editor → Runtime
✅ **插值时**：只更新 `componentRuntime`，不修改 Editor
✅ **停止时**：`clearRuntimeComponents()` 清空 Runtime
✅ **数据分离**：Editor State 和 Runtime State 完全分离

现在架构更清晰，符合你的设计理念！🚀

