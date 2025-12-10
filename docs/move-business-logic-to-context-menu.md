# 进一步重构：将业务逻辑移入 TimelineContextMenu

## 🎯 重构目标

将 Timeline 右键菜单的**业务逻辑**也移入 `TimelineContextMenu` 组件，让 CanvasPanel 更专注于 Canvas 相关的职责。

## 🤔 问题分析

### Before (业务逻辑在 CanvasPanel 中) ❌

```typescript
// CanvasPanel.tsx
const handleSetAnimationEnd = (frameNumber: number) => {
  const engineStore = getEngineStore();
  engineStore.dispatch(setAnimationEndFrame({ frame: frameNumber }));
  console.log(`Set animation end to frame ${frameNumber}`);
};

const handleSplitClipFromMenu = (trackId: string, clipId: string, frameNumber: number) => {
  handleSplitClip(trackId, clipId, frameNumber);
  console.log(`Split clip ${clipId} at frame ${frameNumber}`);
};

const handleCloseContextMenu = () => {
  setContextMenu(null);
};

// 使用时传递回调
<TimelineContextMenu
  visible={contextMenu?.visible ?? false}
  x={contextMenu?.x ?? 0}
  y={contextMenu?.y ?? 0}
  frameNumber={contextMenu?.frameNumber ?? 0}
  trackId={contextMenu?.trackId}
  clip={contextMenu?.clip}
  onSetAnimationEnd={handleSetAnimationEnd}        // ← 传递回调
  onSplitClip={handleSplitClipFromMenu}            // ← 传递回调
  onClose={handleCloseContextMenu}
/>
```

**问题**：
- 业务逻辑（设置动画结束帧、分割 clip）与 Canvas 无关
- CanvasPanel 需要知道 Timeline 菜单的业务逻辑细节
- 增加了 CanvasPanel 的复杂度

## ✅ 解决方案

### 将业务逻辑移入 TimelineContextMenu

```typescript
// TimelineContextMenu.tsx
import { getEngineStore, setAnimationEndFrame, splitTimelineClip } from '@huahuo/engine';
import { useDispatch } from 'react-redux';
import { requestCanvasRefresh } from '../../store/features/canvas/canvasSlice';

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  visible,
  x,
  y,
  frameNumber,
  trackId,
  clip,
  onClose,  // 只需要一个 onClose 回调
}) => {
  const dispatch = useDispatch();

  // 业务逻辑：设置动画结束帧
  const handleSetAnimationEnd = () => {
    const engineStore = getEngineStore();
    engineStore.dispatch(setAnimationEndFrame({ frame: frameNumber }));
    console.log(`Set animation end to frame ${frameNumber}`);
    onClose();
  };

  // 业务逻辑：分割 clip
  const handleSplitClip = () => {
    if (!clip || !trackId) return;
    
    const engineStore = getEngineStore();
    const layerId = trackId;
    
    console.log('Split clip requested:', { layerId, clipId: clip.id, splitFrame: frameNumber });
    engineStore.dispatch(splitTimelineClip(layerId, clip.id, frameNumber));
    
    // 请求刷新 Canvas
    dispatch(requestCanvasRefresh());
    
    console.log(`Split clip ${clip.id} at frame ${frameNumber}`);
    onClose();
  };

  // ...菜单项生成
};
```

### CanvasPanel 简化

```typescript
// CanvasPanel.tsx
const handleCellRightClick = (trackId, frameNumber, x, y, clip) => {
  // 只负责显示菜单
  setContextMenu({ visible: true, x, y, frameNumber, trackId, clip });
};

const handleCloseContextMenu = () => {
  setContextMenu(null);
};

// 使用时非常简洁
<TimelineContextMenu
  visible={contextMenu?.visible ?? false}
  x={contextMenu?.x ?? 0}
  y={contextMenu?.y ?? 0}
  frameNumber={contextMenu?.frameNumber ?? 0}
  trackId={contextMenu?.trackId}
  clip={contextMenu?.clip}
  onClose={handleCloseContextMenu}  // 只传递一个回调
/>
```

## 📊 代码对比

### CanvasPanel.tsx

| 项目 | Before | After | 减少 |
|-----|--------|-------|------|
| Handler 函数 | 3 个 | 2 个 | -1 个 |
| 业务逻辑代码 | ~20 行 | 0 行 | -20 行 |
| TimelineContextMenu props | 9 个 | 7 个 | -2 个 |

### TimelineContextMenu.tsx

| 项目 | Before | After | 增加 |
|-----|--------|-------|------|
| Import 依赖 | 2 个 | 5 个 | +3 个 |
| Props 定义 | 2 个回调 | 0 个回调 | -2 个 |
| 业务逻辑代码 | 调用回调 | 完整实现 | ~15 行 |

## 🎯 职责重新划分

### Before ❌

```
CanvasPanel:
  - Canvas 相关 ✓
  - Timeline 事件处理 ✓
  - Timeline 菜单业务逻辑 ✗ (不应该在这)

TimelineContextMenu:
  - UI 渲染 ✓
  - 菜单交互 ✓
  - 依赖外部回调 ✗ (应该自己处理)
```

### After ✅

```
CanvasPanel:
  - Canvas 相关 ✓
  - Timeline 事件处理 ✓
  - 显示/隐藏菜单 ✓
  
TimelineContextMenu:
  - UI 渲染 ✓
  - 菜单交互 ✓
  - 业务逻辑处理 ✓ (自己处理，不依赖外部)
```

## 💡 设计原则

### 1. 高内聚

TimelineContextMenu 现在是一个**自包含**的组件：
- 包含 UI
- 包含业务逻辑
- 只需要最少的外部依赖（onClose）

### 2. 低耦合

CanvasPanel 不再需要知道：
- 如何设置动画结束帧
- 如何分割 clip
- 如何触发 canvas 刷新

### 3. 单一职责

**CanvasPanel**:
```typescript
职责：管理 Canvas 和 Timeline 的展示
不负责：Timeline 菜单的具体业务逻辑
```

**TimelineContextMenu**:
```typescript
职责：Timeline 右键菜单的完整功能
不依赖：外部提供业务逻辑回调
```

## 🔄 数据流简化

### Before (复杂) ❌

```
用户点击菜单项
    ↓
TimelineContextMenu.handleSetAnimationEnd()
    ↓
调用 props.onSetAnimationEnd(frameNumber)
    ↓
CanvasPanel.handleSetAnimationEnd(frameNumber)
    ↓
getEngineStore().dispatch(...)
    ↓
关闭菜单

问题：数据流经过太多层
```

### After (简洁) ✅

```
用户点击菜单项
    ↓
TimelineContextMenu.handleSetAnimationEnd()
    ↓
getEngineStore().dispatch(...)
    ↓
props.onClose()
    ↓
关闭菜单

优势：直接处理，不绕弯
```

## 📐 接口简化

### Props 对比

**Before**:
```typescript
interface TimelineContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
  trackId?: string;
  clip?: TimelineClip;
  onSetAnimationEnd: (frameNumber: number) => void;        // ← 业务回调
  onSplitClip: (trackId: string, clipId: string, frameNumber: number) => void;  // ← 业务回调
  onClose: () => void;
}
```

**After**:
```typescript
interface TimelineContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
  trackId?: string;
  clip?: TimelineClip;
  onClose: () => void;  // ← 只需要一个回调
}
```

**优势**：
- 更少的 props
- 更简单的接口
- 更容易使用

## 🧪 测试优势

### Before (需要 mock 回调)

```typescript
describe('TimelineContextMenu', () => {
  it('should call onSetAnimationEnd', () => {
    const mockOnSetAnimationEnd = jest.fn();  // ← 需要 mock
    
    const wrapper = mount(
      <TimelineContextMenu
        visible={true}
        frameNumber={50}
        onSetAnimationEnd={mockOnSetAnimationEnd}  // ← 传入 mock
        onClose={jest.fn()}
      />
    );
    
    // 点击菜单项
    wrapper.find('[key="set-animation-end"]').simulate('click');
    
    // 验证回调被调用
    expect(mockOnSetAnimationEnd).toHaveBeenCalledWith(50);
  });
});
```

### After (测试实际行为)

```typescript
describe('TimelineContextMenu', () => {
  it('should dispatch setAnimationEndFrame', () => {
    const mockDispatch = jest.fn();
    jest.spyOn(engineStore, 'dispatch').mockImplementation(mockDispatch);
    
    const wrapper = mount(
      <TimelineContextMenu
        visible={true}
        frameNumber={50}
        onClose={jest.fn()}  // ← 只需要 onClose
      />
    );
    
    // 点击菜单项
    wrapper.find('[key="set-animation-end"]').simulate('click');
    
    // 验证实际的 action 被 dispatch
    expect(mockDispatch).toHaveBeenCalledWith(
      setAnimationEndFrame({ frame: 50 })
    );
  });
});
```

**优势**：测试实际业务逻辑，而不是测试回调调用

## 🎉 总结

重构完成：

✅ **移除 CanvasPanel 中的业务逻辑** - 减少 20 行代码
✅ **TimelineContextMenu 自包含** - 包含完整的业务逻辑
✅ **接口简化** - 从 3 个回调减少到 1 个
✅ **职责更清晰** - CanvasPanel 只管展示，不管具体操作
✅ **更易维护** - 相关逻辑集中在一个文件
✅ **更易测试** - 测试实际业务行为

现在 CanvasPanel 真正专注于 Canvas 了！🎨

