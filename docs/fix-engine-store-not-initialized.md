# 修复 Engine Store 未初始化错误

## 🐛 错误信息

```
EngineGlobals.ts:17 Uncaught Error: Engine store not initialized. 
Make sure Engine is constructed with a store.
    at getEngineStore (EngineGlobals.ts:17:1)
    at eval (App.tsx:16:43)
```

## 🔍 问题原因

### 组件生命周期顺序

```
1. App 组件 mount
    ↓
2. App.useEffect 执行
    ↓
3. 尝试 getEngineStore() ← 💥 错误！Engine 还没初始化
    ↓
4. (稍后) SDK 初始化
    ↓
5. Engine 创建并注册 store
```

### 根本原因

App 组件在 React 应用启动时就 mount 了，但 SDK（包括 Engine）是异步初始化的。

```typescript
// App.tsx (错误的 ❌)
useEffect(() => {
    const engineStore = getEngineStore();  // ← Engine 还没初始化！
    // ...
}, []);
```

## ✅ 解决方案

使用 `SDK.executeAfterInit()` 等待 SDK 初始化后再订阅 Engine store。

### 修复代码

```typescript
// App.tsx (正确的 ✅)
useEffect(() => {
    console.info('🎉 HuaHuo IDE loaded successfully!');

    // Wait for SDK initialization before subscribing to Engine store
    SDK.executeAfterInit(() => {
        console.log('[App] SDK initialized, subscribing to Engine playback state');

        // 现在 Engine 已经初始化，可以安全获取 store
        const engineStore = getEngineStore();
        const unsubscribe = engineStore.subscribe(() => {
            const engineState = getEngineState();
            setIsPlaying(engineState.playback.isPlaying);
        });

        // Get initial state
        const initialState = getEngineState();
        setIsPlaying(initialState.playback.isPlaying);
    });
}, []);
```

## 🔄 正确的生命周期

```
1. App 组件 mount
    ↓
2. App.useEffect 执行
    ↓
3. SDK.executeAfterInit(() => { ... }) 注册回调
    ↓ (等待...)
    ↓
4. SDK 初始化
    ├─> Engine 创建
    ├─> Store 注册
    └─> 触发 executeAfterInit 回调
        ↓
5. getEngineStore() ← ✅ 成功！Engine 已经初始化
    ↓
6. 订阅 playback state
    ↓
7. 获取初始状态
```

## 📝 关键点

### SDK.executeAfterInit()

这个方法确保代码只在 SDK 完全初始化后执行：

```typescript
SDK.executeAfterInit(() => {
    // 这里的代码在 SDK 初始化完成后才执行
    // Engine、Store 都已经准备好
});
```

### 为什么不用 cleanup

```typescript
// 注意：没有返回 unsubscribe
SDK.executeAfterInit(() => {
    const unsubscribe = engineStore.subscribe(() => { ... });
    // 不返回 unsubscribe
});
```

**原因**：
1. `SDK.executeAfterInit` 不支持 cleanup 回调
2. 这个订阅应该持续整个应用生命周期
3. App 组件不会 unmount（它是根组件）

## 🎯 其他需要等待 SDK 的地方

类似的问题可能出现在任何尝试使用 Engine/SDK 功能的地方：

### CanvasPanel

```typescript
// CanvasPanel.tsx ✅ (已正确处理)
useEffect(() => {
    SDK.executeAfterInit(() => {
        // 这里使用 Engine 相关功能
        const animationPlayer = getAnimationPlayer();
        animationPlayer.start();
    });
}, []);
```

### 规则

任何需要使用以下功能的代码都应该在 `SDK.executeAfterInit` 中：

- ❌ 直接调用：`getEngineStore()`
- ❌ 直接调用：`getEngineState()`
- ❌ 直接调用：`getAnimationPlayer()`
- ❌ 直接调用：`SDK.instance.Scene.xxx()`

- ✅ 在回调中：`SDK.executeAfterInit(() => { getEngineStore(); })`

## 🧪 验证

### 检查控制台日志

正确的顺序应该是：

```
🎉 HuaHuo IDE loaded successfully!
Console logs will appear in the Logs panel at the bottom.
[SDK] Initializing...
[Engine] Creating...
[SDK] Initialized successfully
[App] SDK initialized, subscribing to Engine playback state
```

### 不应该看到

```
❌ Uncaught Error: Engine store not initialized
```

## 💡 最佳实践

### 1. 使用 SDK.isInitialized() 检查

```typescript
if (SDK.isInitialized()) {
    // 可以安全使用 Engine
    const store = getEngineStore();
} else {
    // 还没初始化，等待或使用 executeAfterInit
    SDK.executeAfterInit(() => {
        const store = getEngineStore();
    });
}
```

### 2. 组件中使用 executeAfterInit

```typescript
useEffect(() => {
    SDK.executeAfterInit(() => {
        // Engine 相关代码
    });
}, []);
```

### 3. 事件处理器中直接使用

```typescript
// 事件处理器在用户交互时才执行，此时 SDK 肯定已初始化
const handlePlay = () => {
    const engineStore = getEngineStore();  // ✅ 安全
    engineStore.dispatch(playAnimation());
};
```

## 🎉 总结

修复完成！现在：

✅ **App 组件等待 SDK 初始化** - 使用 `SDK.executeAfterInit()`
✅ **不会出现未初始化错误** - Engine store 在使用前已准备好
✅ **正确的生命周期** - 组件 mount → SDK init → 订阅 Engine state
✅ **Play/Pause 按钮状态正常** - 成功订阅到 Engine 的 playback state

应用现在应该能正常启动了！🚀

