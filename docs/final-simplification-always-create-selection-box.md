# 最终简化：RotatableSelectionBox 初始化时创建，击中就显示

## ✅ 最终方案

### 核心思路
1. **RotatableSelectionBox 在 PointerTool 构造函数中直接创建**
2. **击中任何物体就显示 RotatableSelectionBox**
3. **默认行为：drag**
4. **无需判断 isAlreadySelected**

## 🎯 关键修改

### 1. 构造函数中创建 RotatableSelectionBox

**修改前：**
```typescript
export class PointerTool extends BaseTool {
    private rotatableSelection: RotatableSelectionBox | null = null;
    
    // 需要在使用时检查并创建
    if (!this.rotatableSelection) {
        this.rotatableSelection = new RotatableSelectionBox();
    }
}
```

**修改后：**
```typescript
export class PointerTool extends BaseTool {
    private rotatableSelection: RotatableSelectionBox; // ✅ 不是 null
    
    constructor(color: string) {
        super(color);
        // ✅ 直接创建，不需要延迟
        this.rotatableSelection = new RotatableSelectionBox();
    }
}
```

### 2. 简化 onMouseDown 逻辑

**修改前（复杂）：**
```typescript
onMouseDown(event) {
    // 检查手柄...
    
    // hitTest
    if (hitResult && hitResult.item) {
        const gameObjectId = ...;
        
        // ❌ 需要判断是否已选中
        const isAlreadySelected = 
            selectionState.selectedType === 'gameObject' && 
            selectionState.selectedId === gameObjectId;
        
        if (isAlreadySelected) {
            // 已选中 → drag
            this.currentOperationType = 'drag';
            this.startHandler('drag', ...);
            return;
        }
        
        // 未选中 → 选择
        if (!this.rotatableSelection) {
            this.rotatableSelection = new RotatableSelectionBox();
        }
        store.dispatch(selectObject(...));
        this.rotatableSelection.setSelection([item]);
        
        this.startPoint = null; // 不开始 drag
    }
}
```

**修改后（简单）：**
```typescript
onMouseDown(event) {
    // 检查手柄...
    
    // hitTest
    if (hitResult && hitResult.item) {
        const gameObjectId = ...;
        
        // ✅ 直接选择并显示
        store.dispatch(selectObject({type: 'gameObject', id: gameObjectId}));
        this.rotatableSelection.setSelection([item]);
        
        // ✅ 默认行为：drag
        this.currentOperationType = 'drag';
        this.startHandler('drag', new Set([gameObjectId]), event.point);
        
        // ✅ 保留 startPoint 用于拖动
    }
}
```

### 3. 移除所有 null 检查

**修改前：**
```typescript
if (this.rotatableSelection) {
    this.rotatableSelection.refresh();
}

if (!this.rotatableSelection) {
    this.rotatableSelection = new RotatableSelectionBox();
}
```

**修改后：**
```typescript
// ✅ 直接调用，不需要检查
this.rotatableSelection.refresh();
```

## 📊 逻辑对比

### 旧逻辑（复杂）
```
点击物体
  ↓
检查：物体已选中？
  ├─ 是 → drag
  │   └─ RotatableSelectionBox 保持显示
  └─ 否 → 选择
      ├─ 检查：RotatableSelectionBox 存在？
      │   └─ 否 → 创建
      ├─ 显示 RotatableSelectionBox
      └─ 不开始 drag (startPoint = null)

问题：
1. 需要判断 isAlreadySelected
2. 需要检查 RotatableSelectionBox 是否存在
3. 已选中和未选中走不同分支
4. 首次点击不能拖动
```

### 新逻辑（简单）
```
点击物体
  ↓
显示 RotatableSelectionBox
  ↓
默认开始 drag

优势：
1. 无需判断 isAlreadySelected
2. RotatableSelectionBox 始终存在
3. 所有点击统一处理
4. 首次点击也能拖动 ✅
```

## 🎨 完整流程

### 场景 1：首次点击物体
```
点击物体
  ↓
handleType = null (没有选择框)
  ↓
hitTest → HIT
  ↓
dispatch selectObject()
  ↓
rotatableSelection.setSelection([item])  // 显示选择框
  ↓
currentOperationType = 'drag'
  ↓
startHandler('drag', ...)
  ↓
✅ 可以直接拖动！
```

### 场景 2：再次点击物体
```
点击物体
  ↓
handleType = null (没点手柄)
  ↓
hitTest → HIT
  ↓
dispatch selectObject()  // 重新选择（idempotent）
  ↓
rotatableSelection.setSelection([item])  // 刷新选择框
  ↓
currentOperationType = 'drag'
  ↓
startHandler('drag', ...)
  ↓
✅ 可以拖动！
```

### 场景 3：点击手柄
```
点击旋转/缩放手柄
  ↓
handleType = 'rotation'/'scale-*'
  ↓
currentOperationType = handleType
  ↓
startHandler(handleType, ...)
  ↓
✅ 执行旋转/缩放
```

## ✅ 优势

### 1. 代码简洁
- **减少判断**：无需 isAlreadySelected
- **减少 null 检查**：RotatableSelectionBox 始终存在
- **统一处理**：所有物体点击走相同流程

### 2. 逻辑清晰
```typescript
// 只有 3 步
onMouseDown() {
    // 1. 检查手柄
    if (handleType) { /* 处理手柄 */ }
    
    // 2. 检查物体
    if (hitResult) {
        // 显示选择框 + 默认 drag
    }
}
```

### 3. 用户体验好
- ✅ **首次点击也能拖动**（之前不能）
- ✅ 响应迅速（无需额外判断）
- ✅ 行为一致（每次点击都能拖动）

### 4. 性能好
- 减少条件判断
- 减少对象创建检查
- 代码路径简单

## 🔧 技术细节

### RotatableSelectionBox 生命周期
```typescript
// 创建：PointerTool 构造时
constructor() {
    this.rotatableSelection = new RotatableSelectionBox();
    // 此时隐藏（没有 selectedItems）
}

// 显示：点击物体时
this.rotatableSelection.setSelection([item]);
// 自动显示选择框

// 隐藏：点击空白或其他场景
this.rotatableSelection.clear();
// 自动隐藏选择框
```

### Redux 选择状态
```typescript
// 每次点击物体都 dispatch
store.dispatch(selectObject({type: 'gameObject', id: gameObjectId}));

// Redux 会处理：
// - 如果已经是这个 ID，状态不变（idempotent）
// - 如果是新 ID，更新状态
```

## 📝 代码量对比

### 修改前
- 构造函数：无特殊处理
- onMouseDown：~60 行（包含 isAlreadySelected 判断）
- null 检查：多处

### 修改后
- 构造函数：+3 行（创建 RotatableSelectionBox）
- onMouseDown：~40 行（移除 isAlreadySelected 判断）
- null 检查：0 处

**净减少：约 20 行代码**

## 🎉 总结

### 核心改进
1. **RotatableSelectionBox 在构造函数中创建** - 不是 null，无需检查
2. **击中物体就显示并开始 drag** - 简单直接
3. **移除 isAlreadySelected 判断** - 统一逻辑
4. **首次点击也能拖动** - 更好的用户体验

### 设计原则
- **Keep It Simple** - 简单就是美
- **Uniform Behavior** - 一致的行为
- **Eager Initialization** - 提前创建，减少检查
- **Default to Most Common** - 默认最常用操作（drag）

现在代码又简单又清晰，用户体验也更好了！🎉

