# 统一 Timeline 右键菜单

## 🐛 问题

右键点击 Timeline 时，会同时弹出两个框：
1. **Set Animation End** 对话框（来自 CanvasPanel 的 Dropdown 菜单）
2. **Split Clip** 对话框（来自 Timeline 内部）

导致用户体验混乱。

## 🔍 问题原因

### Timeline 的 handleContextMenu 逻辑

```typescript
// Timeline.tsx (修复前 ❌)
const handleContextMenu = (e) => {
  const cell = getCellFromPosition(x, y);
  
  // 1. 调用父组件的回调
  if (onCellRightClick) {
    onCellRightClick(cell.trackId, cell.frame, e.clientX, e.clientY);
    // ↑ 触发 CanvasPanel 显示 "Set Animation End" 菜单
  }
  
  // 2. 检查是否在 clip 中
  const clip = findClipAtFrame(cell.trackId, cell.frame);
  if (clip && cell.frame > clip.startFrame) {
    // 显示 "Split Clip" 对话框
    setShowSplitDialog(true);  // ↑ 同时触发 Timeline 内部对话框
  }
};
```

**结果**：两个 UI 同时出现！

## ✅ 解决方案

### 统一到父组件的右键菜单

将所有右键菜单项都在 **CanvasPanel** 中管理，Timeline 只负责传递信息。

### 1. Timeline 传递 Clip 信息

```typescript
// Timeline.tsx (修复后 ✅)
interface TimelineProps {
  // 更新回调签名，增加 clip 参数
  onCellRightClick?: (
    trackId: string, 
    frameNumber: number, 
    x: number, 
    y: number, 
    clip?: TimelineClip  // ← 传递 clip 信息
  ) => void;
}

const handleContextMenu = (e) => {
  const cell = getCellFromPosition(x, y);
  const clip = findClipAtFrame(cell.trackId, cell.frame);
  
  // 只调用回调，不再自己弹出对话框
  if (onCellRightClick) {
    onCellRightClick(cell.trackId, cell.frame, e.clientX, e.clientY, clip);
  }
  
  // 移除 setShowSplitDialog(true) ← 不再自己处理
};
```

### 2. CanvasPanel 根据 Clip 信息动态生成菜单

```typescript
// CanvasPanel.tsx (修复后 ✅)
const [contextMenu, setContextMenu] = useState<{
  visible: boolean;
  x: number;
  y: number;
  frameNumber: number;
  trackId?: string;
  clip?: { id: string; startFrame: number; length: number };  // ← 存储 clip 信息
} | null>(null);

const handleCellRightClick = (trackId, frameNumber, x, y, clip) => {
  setContextMenu({
    visible: true,
    x,
    y,
    frameNumber,
    trackId,
    clip  // ← 保存 clip 信息
  });
};

// 动态生成菜单项
const contextMenuItems: MenuProps['items'] = [
  {
    key: 'set-animation-end',
    label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
    onClick: handleSetProjectEnd,
  },
  // 条件渲染：只有在 clip 中且不在起始帧时才显示 Split 选项
  ...(contextMenu?.clip && contextMenu.frameNumber > contextMenu.clip.startFrame
    ? [{
        key: 'split-clip',
        label: `Split Clip at Frame ${contextMenu.frameNumber}`,
        onClick: handleSplitClipFromMenu,
      }]
    : []),
];
```

## 🎨 用户体验

### Before ❌

```
用户右键点击 Timeline 中的 Clip
    ↓
[Set Animation End 菜单] 出现在鼠标位置
    ↓
[Split Clip 对话框] 也出现在屏幕中间
    ↓
两个 UI 重叠，用户困惑 😵
```

### After ✅

```
用户右键点击 Timeline 空白处
    ↓
显示菜单：
  • Set Animation End (Frame X)
    
用户右键点击 Timeline 中的 Clip
    ↓
显示菜单：
  • Set Animation End (Frame X)
  • Split Clip at Frame X  ← 条件显示
    ↓
用户选择一个选项
    ↓
只执行选中的操作 ✓
```

## 📊 菜单项逻辑

### Set Animation End
- **条件**: 始终显示
- **作用**: 设置动画结束标记
- **快捷键**: (未来可以添加)

### Split Clip
- **条件**: 只在以下情况显示
  1. 右键点击在 clip 内部
  2. 不在 clip 的起始帧（起始帧不能 split）
- **作用**: 在当前帧分割 clip
- **逻辑**: `contextMenu.clip && contextMenu.frameNumber > contextMenu.clip.startFrame`

## 🔄 完整数据流

```
用户右键点击
    ↓
Timeline.handleContextMenu()
    ├─> 获取点击位置的 cell
    ├─> 查找该位置的 clip (如果有)
    └─> 调用 onCellRightClick(trackId, frame, x, y, clip)
        ↓
CanvasPanel.handleCellRightClick()
    ├─> 保存 contextMenu state (包含 clip 信息)
    └─> 触发 re-render
        ↓
contextMenuItems 计算
    ├─> 始终包含: Set Animation End
    └─> 条件包含: Split Clip (如果有 clip 且不在起始帧)
        ↓
Dropdown 显示菜单
    ↓
用户点击菜单项
    ├─> handleSetProjectEnd() → dispatch(setAnimationEndFrame(...))
    └─> handleSplitClipFromMenu() → handleSplitClip(...) → dispatch(...)
        ↓
setContextMenu(null) ← 关闭菜单
```

## 💡 设计优势

### 1. 单一职责

- **Timeline**: 渲染 + 传递信息
- **CanvasPanel**: 菜单管理 + 业务逻辑

### 2. 可扩展

添加新的菜单项很容易：

```typescript
const contextMenuItems: MenuProps['items'] = [
  {
    key: 'set-animation-end',
    label: `Set Animation End (Frame ${contextMenu?.frameNumber ?? 0})`,
    onClick: handleSetProjectEnd,
  },
  {
    key: 'split-clip',
    label: `Split Clip at Frame ${contextMenu.frameNumber}`,
    onClick: handleSplitClipFromMenu,
    disabled: !canSplit,  // 条件禁用
  },
  // 未来可以添加：
  {
    key: 'delete-clip',
    label: 'Delete Clip',
    onClick: handleDeleteClip,
    danger: true,  // 危险操作标红
  },
  {
    key: 'copy-clip',
    label: 'Copy Clip',
    onClick: handleCopyClip,
  },
  // ...更多操作
];
```

### 3. 一致性

所有右键菜单使用 Ant Design 的 Dropdown + Menu 组件：
- 统一的样式
- 统一的交互
- 统一的快捷键支持（未来）

### 4. 状态管理清晰

```typescript
// 所有右键菜单相关的状态集中在一个地方
const [contextMenu, setContextMenu] = useState({
  visible: boolean;     // 是否显示
  x: number;            // 位置
  y: number;
  frameNumber: number;  // 帧号
  trackId?: string;     // 轨道 ID
  clip?: TimelineClip;  // Clip 信息（如果有）
});
```

## 🎯 未来扩展

### 可能的菜单项

1. **Delete Clip** - 删除 clip
2. **Duplicate Clip** - 复制 clip
3. **Extend Clip** - 延长 clip
4. **Add Keyframe** - 在当前帧添加关键帧
5. **Delete Keyframe** - 删除当前帧的关键帧
6. **Goto Frame** - 跳转到指定帧
7. **Set Frame Rate** - 设置帧率

### 子菜单支持

Ant Design 的 Menu 支持嵌套：

```typescript
{
  key: 'clip-operations',
  label: 'Clip Operations',
  children: [
    { key: 'split', label: 'Split' },
    { key: 'delete', label: 'Delete' },
    { key: 'duplicate', label: 'Duplicate' },
  ]
}
```

## 🎉 总结

修复完成：

✅ **移除冲突** - 不再同时弹出两个框
✅ **统一管理** - 所有菜单项在 CanvasPanel 中
✅ **条件显示** - Split Clip 只在合适的时候显示
✅ **易于扩展** - 添加新菜单项很简单
✅ **用户体验** - 清晰的右键菜单，操作直观

现在右键点击 Timeline 只会显示一个统一的菜单！🎉

