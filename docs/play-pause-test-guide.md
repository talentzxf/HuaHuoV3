# Play/Pause 功能测试

## ✅ 已完成的修复

1. **移除多余的调试日志** - 代码更清爽
2. **移除 `play()` 方法中的 `isPlaying` 检查** - 避免时序问题
3. **确保正确订阅 Engine playback state** - UI 按钮与实际状态同步

## 🧪 测试步骤

### 1. 打开 Redux DevTools

查看 Engine 的 playback state：

```javascript
engine: {
  playback: {
    isPlaying: false,  // 初始应该是 false
    currentFrame: 0,
    fps: 30
  }
}
```

### 2. 点击 Play 按钮

**预期结果**：
- ✅ 按钮变为 "Pause"
- ✅ Redux DevTools 显示 `isPlaying: true`
- ✅ Redux DevTools 显示 `currentFrame` 开始递增 (0→1→2→3...)
- ✅ Timeline 的播放头开始移动

### 3. 点击 Pause 按钮

**预期结果**：
- ✅ 按钮变为 "Play"
- ✅ Redux DevTools 显示 `isPlaying: false`
- ✅ `currentFrame` 停止递增
- ✅ Timeline 的播放头停止移动

### 4. 再次点击 Play

**预期结果**：
- ✅ 从当前帧继续播放
- ✅ 不是从 0 开始

## 🎯 如果 isPlaying 一直是 true

### 可能的原因

1. **Pause 按钮没有绑定正确的处理器**
   - 检查 MainMenu 是否收到 `onPause` prop
   - 检查 App.tsx 是否传递了 `onPause={handlePause}`

2. **pauseAnimation 没有正确 dispatch**
   - 在 handlePause 中添加临时日志验证
   ```typescript
   const handlePause = () => {
       console.log('Pause clicked');  // ← 临时添加
       const engineStore = getEngineStore();
       (engineStore.dispatch as any)(pauseAnimation());
   };
   ```

3. **pauseAction 没有被导出或导入**
   - 检查 PlaybackSlice.ts 是否导出 `pause`
   - 检查 actions.ts 是否正确导入 `pause as pauseAction`

### 快速验证

在浏览器控制台手动测试：

```javascript
// 获取 Engine store
const engineStore = window.__REDUX_DEVTOOLS_EXTENSION__.getState().engine;

// 查看当前状态
console.log('isPlaying:', engineStore.playback.isPlaying);

// 手动 dispatch pause
const { getEngineStore } = require('@huahuo/engine');
const store = getEngineStore();
store.dispatch({ type: 'playback/pause' });

// 再次查看状态
console.log('isPlaying after pause:', store.getState().playback.isPlaying);
```

## 📝 检查清单

- [ ] Play 按钮点击后，按钮文字变为 "Pause"
- [ ] Pause 按钮点击后，按钮文字变为 "Play"
- [ ] Redux DevTools 显示 `isPlaying` 正确切换
- [ ] Timeline 播放头根据播放/暂停状态移动/停止
- [ ] 控制台没有错误

## 🎉 完成

如果所有测试都通过，Play/Pause 功能就正常工作了！

如果 `isPlaying` 仍然一直是 true，请告诉我：
1. 点击 Pause 按钮后，按钮文字有变化吗？
2. Redux DevTools 中的 actions 列表有 `playback/pause` 吗？
3. 控制台有任何错误吗？

