# 重构：将 Timeline 右键菜单抽离为独立组件

## 🎯 重构目标

将 CanvasPanel 中的右键菜单逻辑抽离成独立的 `TimelineContextMenu` 组件，提高代码的：
- **可读性** - 逻辑更清晰
- **可维护性** - 职责分离
- **可测试性** - 组件独立
- **可复用性** - 可在其他地方使用

## 📁 新文件结构

```
hh-ide/src/components/panels/
├── CanvasPanel.tsx                 (简化后)
├── TimelineContextMenu.tsx         (新增)
├── TimelinePanel.tsx
└── ...
```

## 🆕 TimelineContextMenu 组件

### 接口定义

```typescript
export interface TimelineClip {
  id: string;
  startFrame: number;
  length: number;
}

export interface TimelineContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
  trackId?: string;
  clip?: TimelineClip;
  onSetAnimationEnd: (frameNumber: number) => void;
  onSplitClip: (trackId: string, clipId: string, frameNumber: number) => void;
  onClose: () => void;
}
```

### 核心功能

1. **动态菜单生成**
   - 始终显示：Set Animation End
   - 条件显示：Split Clip（只在 clip 内部且不在起始帧）

2. **事件处理**
   - 点击菜单项后自动关闭
   - 调用父组件回调

3. **位置定位**
   - 使用 fixed 定位在鼠标点击位置

### 实现代码

```typescript
export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  visible,
  x,
  y,
  frameNumber,
  trackId,
  clip,
  onSetAnimationEnd,
  onSplitClip,
  onClose,
}) => {
  // Handle set animation end
  const handleSetAnimationEnd = () => {
    onSetAnimationEnd(frameNumber);
    onClose();  // 自动关闭
  };

  // Handle split clip
  const handleSplitClip = () => {
    if (!clip || !trackId) return;
    onSplitClip(trackId, clip.id, frameNumber);
    onClose();  // 自动关闭
  };

  // Check if split is allowed
  const canSplit = clip && trackId && frameNumber > clip.startFrame;

  // Build menu items
  const menuItems: MenuProps['items'] = [
    {
      key: 'set-animation-end',
      label: `Set Animation End (Frame ${frameNumber})`,
      onClick: handleSetAnimationEnd,
    },
    ...(canSplit ? [{
      key: 'split-clip',
      label: `Split Clip at Frame ${frameNumber}`,
      onClick: handleSplitClip,
    }] : []),
  ];

  if (!visible) return null;

  return (
    <Dropdown menu={{ items: menuItems }} open={visible} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <div style={{
        position: 'fixed',
        left: x,
        top: y,
        width: 1,
        height: 1,
        pointerEvents: 'none',
      }} />
    </Dropdown>
  );
};
```

## 📉 CanvasPanel 简化

### Before (❌ 混杂)

```typescript
// CanvasPanel.tsx (重构前)

// 1. Import 混杂
import { Button, Space, Dropdown } from 'antd';
import type { MenuProps } from 'antd';

// 2. 状态管理
const [contextMenu, setContextMenu] = useState<{...}>(...);

// 3. 多个处理函数
const handleSetProjectEnd = () => {
  if (!contextMenu) return;
  const engineStore = getEngineStore();
  engineStore.dispatch(setAnimationEndFrame({ frame: contextMenu.frameNumber }));
  setContextMenu(null);
};

const handleSplitClipFromMenu = () => {
  if (!contextMenu || !contextMenu.clip || !contextMenu.trackId) return;
  const { trackId, clip, frameNumber } = contextMenu;
  handleSplitClip(trackId, clip.id, frameNumber);
  setContextMenu(null);
};

// 4. 复杂的菜单项生成
const contextMenuItems: MenuProps['items'] = [
  {
    key: 'set-animation-end',
    label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
    onClick: handleSetProjectEnd,
  },
  ...(contextMenu?.clip && contextMenu.frameNumber > contextMenu.clip.startFrame
    ? [{
        key: 'split-clip',
        label: `Split Clip at Frame ${contextMenu.frameNumber}`,
        onClick: handleSplitClipFromMenu,
      }]
    : []),
];

// 5. 复杂的渲染逻辑
{contextMenu && (
  <Dropdown
    menu={{ items: contextMenuItems }}
    open={contextMenu.visible}
    onOpenChange={(visible) => {
      if (!visible) setContextMenu(null);
    }}
  >
    <div style={{...}} />
  </Dropdown>
)}
```

**问题**：
- 60+ 行与 Canvas 无关的菜单代码
- 状态、处理函数、菜单项、渲染逻辑混在一起
- 难以维护和测试

### After (✅ 清晰)

```typescript
// CanvasPanel.tsx (重构后)

// 1. Import 简化
import { TimelineContextMenu } from './TimelineContextMenu';

// 2. 状态管理不变
const [contextMenu, setContextMenu] = useState<{...}>(...);

// 3. 简单的回调函数
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

// 4. 简洁的渲染
<TimelineContextMenu
  visible={contextMenu?.visible ?? false}
  x={contextMenu?.x ?? 0}
  y={contextMenu?.y ?? 0}
  frameNumber={contextMenu?.frameNumber ?? 0}
  trackId={contextMenu?.trackId}
  clip={contextMenu?.clip}
  onSetAnimationEnd={handleSetAnimationEnd}
  onSplitClip={handleSplitClipFromMenu}
  onClose={handleCloseContextMenu}
/>
```

**优势**：
- 20 行代码（减少 40+ 行）
- 逻辑清晰：CanvasPanel 只负责业务逻辑
- 组件负责 UI 和交互

## 📊 代码行数对比

| 文件 | 重构前 | 重构后 | 减少 |
|-----|-------|--------|------|
| CanvasPanel.tsx | ~560 行 | ~520 行 | -40 行 |
| TimelineContextMenu.tsx | 0 行 | 85 行 | +85 行 |
| **总计** | 560 行 | 605 行 | +45 行 |

虽然总行数略有增加，但代码的**可维护性大幅提升**：
- ✅ 职责分离
- ✅ 更易测试
- ✅ 更易复用

## 💡 设计原则

### 单一职责原则 (SRP)

**TimelineContextMenu**:
- ✓ 负责菜单的显示和交互
- ✓ 处理菜单项的条件显示
- ✓ 管理菜单的打开/关闭

**CanvasPanel**:
- ✓ 负责 Canvas 的业务逻辑
- ✓ 处理 Timeline 事件
- ✓ 调度 Engine 操作

### 依赖倒置原则 (DIP)

TimelineContextMenu 不依赖具体实现，只依赖抽象的回调接口：

```typescript
interface TimelineContextMenuProps {
  // 抽象的回调，不关心具体实现
  onSetAnimationEnd: (frameNumber: number) => void;
  onSplitClip: (trackId: string, clipId: string, frameNumber: number) => void;
  onClose: () => void;
}
```

### 开闭原则 (OCP)

添加新菜单项很容易，不需要修改 CanvasPanel：

```typescript
// TimelineContextMenu.tsx
const menuItems: MenuProps['items'] = [
  {
    key: 'set-animation-end',
    label: `Set Animation End (Frame ${frameNumber})`,
    onClick: handleSetAnimationEnd,
  },
  ...(canSplit ? [{
    key: 'split-clip',
    label: `Split Clip at Frame ${frameNumber}`,
    onClick: handleSplitClip,
  }] : []),
  // 未来可以添加：
  // { key: 'delete-clip', ... },
  // { key: 'duplicate-clip', ... },
];
```

## 🧪 测试优势

### Before (难测试)

```typescript
// 测试 CanvasPanel 需要 mock 整个 Canvas 环境
describe('CanvasPanel context menu', () => {
  it('should show split clip option when clicking inside clip', () => {
    // 需要 mock: Canvas, Paper.js, SDK, Engine, Timeline...
    const wrapper = mount(<CanvasPanel />);
    // ...复杂的测试逻辑
  });
});
```

### After (易测试)

```typescript
// 独立测试 TimelineContextMenu
describe('TimelineContextMenu', () => {
  it('should show split clip option when inside clip', () => {
    const mockOnSplitClip = jest.fn();
    
    const wrapper = mount(
      <TimelineContextMenu
        visible={true}
        x={100}
        y={100}
        frameNumber={50}
        trackId="layer1"
        clip={{ id: 'clip1', startFrame: 40, length: 20 }}
        onSetAnimationEnd={jest.fn()}
        onSplitClip={mockOnSplitClip}
        onClose={jest.fn()}
      />
    );
    
    // 简单直接的测试
    expect(wrapper.find('[key="split-clip"]')).toHaveLength(1);
  });
});
```

## 🔄 数据流

```
用户右键点击 Timeline
    ↓
Timeline → onCellRightClick(trackId, frame, x, y, clip)
    ↓
CanvasPanel.handleCellRightClick()
    ├─> setContextMenu({visible, x, y, frame, trackId, clip})
    └─> 触发 re-render
        ↓
TimelineContextMenu 组件渲染
    ├─> 根据 clip 决定显示哪些菜单项
    └─> 显示在 (x, y) 位置
        ↓
用户点击菜单项
    ├─> "Set Animation End"
    │   → TimelineContextMenu.handleSetAnimationEnd()
    │   → onSetAnimationEnd(frameNumber)
    │   → CanvasPanel.handleSetAnimationEnd(frameNumber)
    │   → dispatch(setAnimationEndFrame(...))
    │
    └─> "Split Clip"
        → TimelineContextMenu.handleSplitClip()
        → onSplitClip(trackId, clipId, frameNumber)
        → CanvasPanel.handleSplitClipFromMenu(...)
        → handleSplitClip(...)
        → dispatch(splitTimelineClip(...))
```

## 🎉 总结

重构完成：

✅ **新增组件** - TimelineContextMenu.tsx
✅ **简化 CanvasPanel** - 减少 40+ 行混杂代码
✅ **职责分离** - UI 和业务逻辑分离
✅ **易于维护** - 代码更清晰
✅ **易于测试** - 独立组件更容易测试
✅ **易于扩展** - 添加新菜单项很简单

代码现在更加清晰和专业！🚀

