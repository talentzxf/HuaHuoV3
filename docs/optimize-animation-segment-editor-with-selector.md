# 优化 AnimationSegmentEditor：使用 Redux Selector 精确监听

## 🐛 原始问题

### 问题 1：监听所有 Engine 变化
```typescript
// ❌ Before: 监听整个 store 的所有变化
const unsubscribe = store.subscribe(() => {
  // 任何 store 变化都会触发
  const currentState = getEngineState();
  // ...检查 keyframes 变化
});
```

**性能问题**：
- ❌ 其他 GameObject 的变化也触发
- ❌ Scene、Layer、Playback 等无关变化也触发
- ❌ 大量不必要的 JSON.stringify 比较

### 问题 2：调用不存在的方法
```typescript
// ❌ timelineComponent 是 ComponentSlice (纯数据)，不是类实例！
if (timelineComponent.collectAnimationSegments) {
  const segments = timelineComponent.collectAnimationSegments();  // ❌ 没有这个方法
}

timelineComponent.setSegmentEasing(...);  // ❌ 也没有这个方法
```

**架构错误**：
- ❌ `timelineComponent` 只是 Redux Store 中的数据（`ComponentSlice`）
- ❌ 不是 `TimelineComponent` 类的实例
- ❌ 数据对象不应该有方法

## ✅ 解决方案

### 1. 使用 Redux Selector 精确监听 + shallowEqual

```typescript
// ✅ After: 只监听当前 GameObject 的 components
// 使用 shallowEqual 避免数组引用变化导致的不必要渲染
const components = useSelector((state: any) => {
  const engineState = state.engine || state;
  const gameObject = engineState.gameObjects.byId[gameObjectId];
  if (!gameObject) return [];

  // 只返回这个 GameObject 的 components
  return gameObject.componentIds
    .map((compId: string) => engineState.components.byId[compId])
    .filter((comp: any) => comp && comp.type !== 'Timeline');
}, shallowEqual); // ⚠️ 重要：使用 shallowEqual 比较数组内容
```

**为什么需要 shallowEqual？**

```typescript
// ❌ 没有 shallowEqual 的问题：
const components = useSelector((state) => {
  return gameObject.componentIds.map(...).filter(...); 
  // 每次都返回新数组引用！
});

// 结果：即使数组内容相同，useSelector 也会认为变化了
// [comp1, comp2] !== [comp1, comp2]  // 不同引用！
// → 触发不必要的重新渲染

// ✅ 使用 shallowEqual：
const components = useSelector((state) => {
  return gameObject.componentIds.map(...).filter(...);
}, shallowEqual);

// shallowEqual 比较数组内容：
// [comp1, comp2] 和 [comp1, comp2]
// → comp1 === comp1 && comp2 === comp2  // 相同！
// → 不触发重新渲染
```

**优势**：
- ✅ **精确监听**：只监听 `gameObjects.byId[gameObjectId].componentIds` 和这些 components 的数据
- ✅ **避免不必要渲染**：使用 `shallowEqual` 比较数组内容，不是引用
- ✅ **性能更好**：不需要手动 `JSON.stringify` 比较
- ✅ **Redux 推荐**：官方推荐的处理数组/对象返回值的方式

### 2. 直接在组件中收集 Segments

```typescript
// ✅ 直接从 components 数据计算 segments
const segments = useMemo((): AnimationSegment[] => {
  const result: AnimationSegment[] = [];

  components.forEach((component: any) => {
    // 遍历所有属性的 keyframes
    for (const propertyName in component.keyFrames) {
      const keyFrames = component.keyFrames[propertyName];
      if (keyFrames.length < 2) continue;

      // 创建段落
      for (let i = 0; i < keyFrames.length - 1; i++) {
        const startFrame = keyFrames[i].frame;
        const endFrame = keyFrames[i + 1].frame;
        const easingType = keyFrames[i + 1].easingType || EasingType.Linear;

        result.push({
          componentId: component.id,
          componentType: component.type,
          propertyName,
          startFrame,
          endFrame,
          easingType
        });
      }
    }
  });

  return result;
}, [components]);
```

**优势**：
- ✅ **逻辑清晰**：直接基于数据计算，不依赖类实例方法
- ✅ **useMemo 优化**：只有 `components` 变化时才重新计算
- ✅ **职责单一**：`AnimationSegmentEditor` 负责收集和展示

### 3. 直接 Dispatch Action

```typescript
const handleEasingChange = (segment: AnimationSegment, newEasing: EasingType) => {
  const store = getEngineStore();
  
  // ✅ 直接 dispatch action
  store.dispatch(setKeyFrameEasing({
    componentId: segment.componentId,
    propName: segment.propertyName,
    frame: segment.endFrame,
    easingType: newEasing
  }));
  
  // ✅ Redux selector 会自动触发重新渲染
};
```

**优势**：
- ✅ **直接操作 Store**：不通过类实例的方法
- ✅ **自动更新**：Redux 会通知 `useSelector`，自动重新计算 `segments`
- ✅ **单向数据流**：符合 Redux 架构

## 📊 数据流对比

### Before ❌ (复杂且低效)

```
AnimationSegmentEditor
  ├─ useEffect → store.subscribe → 监听所有变化
  │   └─ JSON.stringify 比较所有 components 的 keyFrames
  │       └─ setUpdateTrigger
  │           └─ 触发另一个 useEffect
  │               └─ 调用 timelineComponent.collectAnimationSegments() ❌ 不存在
  │                   └─ setSegments
  │
  └─ handleEasingChange
      └─ 调用 timelineComponent.setSegmentEasing() ❌ 不存在
          └─ 手动刷新 segments
```

**问题**：
- ❌ 监听粒度太粗（整个 store）
- ❌ 手动 JSON 比较性能差
- ❌ 两个 useEffect 串联，复杂
- ❌ 调用不存在的方法

### After ✅ (简单且高效)

```
AnimationSegmentEditor
  ├─ useSelector → 精确监听当前 GameObject 的 components
  │   └─ Redux 自动浅比较
  │       └─ components 变化时自动触发
  │
  ├─ useMemo(segments, [components])
  │   └─ 直接从 components 计算 segments
  │
  └─ handleEasingChange
      └─ dispatch(setKeyFrameEasing(...))
          └─ Redux 更新 store
              └─ useSelector 自动触发
                  └─ useMemo 自动重新计算
```

**优势**：
- ✅ 监听粒度精确（只监听相关数据）
- ✅ Redux 自动优化比较
- ✅ 单一数据流，简单清晰
- ✅ 没有不存在的方法调用

## 🎯 Redux Selector 的优势

### 精确监听

```typescript
// useSelector 只会在以下情况触发重新渲染：
// 1. gameObjects.byId[gameObjectId] 变化
// 2. gameObjects.byId[gameObjectId].componentIds 变化
// 3. 这些 componentIds 对应的 components 数据变化

// 不会触发的情况：
// ❌ 其他 GameObject 变化
// ❌ Scene/Layer/Playback 变化
// ❌ 其他无关数据变化
```

### 自动优化

```typescript
// Redux useSelector 内部实现：
// 1. 浅比较返回值
// 2. 只有返回值真的变化才触发重新渲染
// 3. 不需要手动 JSON.stringify
```

### 响应式

```typescript
// 任何地方 dispatch action 修改了数据
store.dispatch(setKeyFrameEasing(...));

// ↓ Redux 自动通知

// useSelector 自动重新执行
const components = useSelector(...);  // 获取最新数据

// ↓ components 变化

// useMemo 自动重新计算
const segments = useMemo(...);  // 重新计算 segments

// ↓ segments 变化

// React 自动重新渲染 UI
```

## 📝 修改总结

### AnimationSegmentEditor.tsx

**Before**：
```typescript
- useState, useEffect 手动管理状态和订阅
- store.subscribe() 监听所有变化
- JSON.stringify 手动比较
- 调用 timelineComponent.collectAnimationSegments() ❌
- 调用 timelineComponent.setSegmentEasing() ❌
```

**After**：
```typescript
- useSelector + shallowEqual 精确监听
- useMemo 计算 segments
- 直接 dispatch actions
- 移除 timelineComponent prop（不需要了）
```

### TimelinePropertyRenderer.tsx

**Before**：
```typescript
- useEffect 监听 store 变化
- 传递 component 给子组件
```

**After**：
```typescript
- 纯展示容器，不监听
- 只传递 gameObjectId
```

## ✅ 验证清单

- ✅ 只监听当前 GameObject 的 components（性能优化）
- ✅ 不调用不存在的方法（修复架构错误）
- ✅ 使用 Redux selector 自动响应变化
- ✅ 代码简化（移除手动订阅逻辑）
- ✅ 符合 Redux 最佳实践

## 🎉 结论

通过使用 Redux `useSelector`：
1. ✅ **性能更好**：精确监听，避免不必要的渲染
2. ✅ **代码更简单**：移除手动订阅和状态管理
3. ✅ **架构更正确**：不依赖类实例方法，直接操作 Store
4. ✅ **维护性更好**：符合 Redux 惯例，易于理解

现在 `AnimationSegmentEditor` 是一个标准的 Redux 连接组件，简单、高效、正确！🚀

