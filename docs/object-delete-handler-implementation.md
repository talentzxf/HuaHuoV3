# ObjectDeleteHandler - 统一的删除处理器

## 🎯 目的
创建一个集中的删除处理器，统一管理所有类型对象的删除操作。

## 📦 实现

### 文件位置
```
hh-ide/src/components/panels/tools/handlers/
  └─ ObjectDeleteHandler.ts (新建)
```

### 核心功能

#### 1. deleteSelected() - 删除选中的对象
```typescript
ObjectDeleteHandler.deleteSelected(): boolean
```
- 从 Redux selection state 获取选中对象
- 根据对象类型调用相应的删除方法
- 返回 true 表示删除成功

#### 2. 支持的对象类型
- ✅ **GameObject** - 完全实现
- ⏳ **Layer** - 预留接口（TODO）
- ⏳ **Vertex** - 预留接口（TODO）
- ⏳ **Edge** - 预留接口（TODO）

#### 3. 辅助方法（预留）
- `canDelete()` - 检查是否可以删除
- `getDeleteDescription()` - 获取删除描述

## 🔄 工作流程

### 删除 GameObject 的完整流程
```
用户按 Delete 键
  ↓
CanvasPanel.handleKeyDown()
  ↓
ObjectDeleteHandler.deleteSelected()
  ↓
检查 selection state
  ↓
确定选中类型: 'gameObject'
  ↓
调用 deleteGameObject(id)
  ↓
dispatch deleteGameObject action
  ↓
Redux Store 删除数据
  ↓
dispatch clearSelection()
  ↓
ReduxAdapter 监听变化
  ↓
自动删除 Paper.js item
  ↓
✅ 完成删除
```

## 💻 使用示例

### 在 CanvasPanel 中使用
```typescript
// CanvasPanel.tsx
import { ObjectDeleteHandler } from './tools/handlers';

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const deleted = ObjectDeleteHandler.deleteSelected();
    
    if (deleted) {
      console.log('[CanvasPanel] Object deleted successfully');
    }
  }
};
```

### 在菜单中使用
```typescript
// MainMenu.tsx (示例)
const handleDeleteClick = () => {
  if (ObjectDeleteHandler.canDelete()) {
    const description = ObjectDeleteHandler.getDeleteDescription();
    confirm(`Delete ${description}?`).then(() => {
      ObjectDeleteHandler.deleteSelected();
    });
  }
};
```

## 🎨 代码设计

### 1. 静态类设计
```typescript
export class ObjectDeleteHandler {
  // 所有方法都是静态的，无需实例化
  public static deleteSelected(): boolean { ... }
  private static deleteGameObject(id: string): boolean { ... }
  public static canDelete(): boolean { ... }
  public static getDeleteDescription(): string | null { ... }
}
```

**优势：**
- 不需要创建实例
- 全局唯一的删除逻辑
- 易于使用和维护

### 2. 类型安全的 switch
```typescript
switch (selectedType) {
  case 'gameObject':
    return this.deleteGameObject(selectedId);
  
  case 'layer':
    // TODO
    return false;
  
  case 'vertex':
  case 'edge':
    // TODO
    return false;
  
  default:
    // TypeScript 会提示所有可能的类型
    return false;
}
```

### 3. 错误处理
```typescript
try {
  const engineStore = getEngineStore();
  engineStore.dispatch(deleteGameObject(gameObjectId));
  store.dispatch(clearSelection());
  return true;
} catch (error) {
  console.error('[ObjectDeleteHandler] Failed to delete:', error);
  return false;
}
```

## 🔧 扩展性

### 添加新的删除类型

#### 1. 更新 SelectionType（如需要）
```typescript
// selectionSlice.ts
export type SelectionType = 'gameObject' | 'layer' | 'component' | ...;
```

#### 2. 添加删除方法
```typescript
// ObjectDeleteHandler.ts
private static deleteComponent(componentId: string): boolean {
  try {
    const engineStore = getEngineStore();
    engineStore.dispatch(deleteComponent(componentId));
    store.dispatch(clearSelection());
    return true;
  } catch (error) {
    console.error('[ObjectDeleteHandler] Failed to delete Component:', error);
    return false;
  }
}
```

#### 3. 添加到 switch
```typescript
switch (selectedType) {
  case 'gameObject':
    return this.deleteGameObject(selectedId);
  
  case 'component':
    return this.deleteComponent(selectedId);
  
  // ...
}
```

## 📊 与其他代码的集成

### 修改的文件
1. **ObjectDeleteHandler.ts** (新建)
   - 集中的删除逻辑
   - 类型安全的删除操作

2. **handlers/index.ts**
   - 导出 ObjectDeleteHandler

3. **CanvasPanel.tsx**
   - 使用 ObjectDeleteHandler
   - 移除内联的删除代码

## 🎯 优势

### 1. 集中管理
- ✅ 所有删除逻辑在一个地方
- ✅ 易于维护和调试
- ✅ 避免重复代码

### 2. 类型安全
- ✅ TypeScript 类型检查
- ✅ Switch case 覆盖所有类型
- ✅ 编译时错误检测

### 3. 易于扩展
- ✅ 添加新类型只需三步
- ✅ 清晰的扩展点
- ✅ 不影响现有代码

### 4. 职责分离
- ✅ CanvasPanel 只负责 UI 事件
- ✅ ObjectDeleteHandler 负责删除逻辑
- ✅ Redux 负责数据管理

## 🚀 未来增强

### 短期
- [ ] 实现 Layer 删除
- [ ] 实现 Vertex/Edge 删除
- [ ] 添加删除前确认对话框

### 中期
- [ ] 支持批量删除
- [ ] 撤销/重做支持
- [ ] 删除历史记录

### 长期
- [ ] 级联删除（删除父对象时删除子对象）
- [ ] 智能删除（根据依赖关系）
- [ ] 删除权限控制

## 📝 代码对比

### 旧代码（内联在 CanvasPanel）
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete') {
    const selectionState = store.getState().selection;
    if (selectionState.selectedType === 'gameObject' && selectionState.selectedId) {
      const gameObjectId = selectionState.selectedId;
      const { deleteGameObject } = require('@huahuo/engine');
      const engineStore = getEngineStore();
      engineStore.dispatch(deleteGameObject(gameObjectId));
      const { clearSelection } = require('../../store/features/selection/selectionSlice');
      store.dispatch(clearSelection());
    }
  }
};
```

**问题：**
- ❌ 混杂在 UI 组件中
- ❌ 使用 require 导入
- ❌ 难以扩展到其他类型
- ❌ 难以复用

### 新代码（使用 ObjectDeleteHandler）
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const deleted = ObjectDeleteHandler.deleteSelected();
    
    if (deleted) {
      console.log('[CanvasPanel] Object deleted successfully');
    }
  }
};
```

**优势：**
- ✅ UI 代码简洁
- ✅ 删除逻辑集中管理
- ✅ 易于扩展和维护
- ✅ 可在多处复用

## 🎉 总结

### 核心改进
1. **创建了 ObjectDeleteHandler** - 统一的删除处理器
2. **集中管理删除逻辑** - 所有删除操作在一个地方
3. **类型安全** - TypeScript 保证类型正确
4. **易于扩展** - 清晰的扩展点

### 当前支持
- ✅ GameObject 删除（完全实现）
- ⏳ Layer/Vertex/Edge（预留接口）

### 使用方式
```typescript
// 简单使用
ObjectDeleteHandler.deleteSelected();

// 带检查
if (ObjectDeleteHandler.canDelete()) {
  const desc = ObjectDeleteHandler.getDeleteDescription();
  console.log(`Deleting: ${desc}`);
  ObjectDeleteHandler.deleteSelected();
}
```

现在删除功能更加模块化、易于维护和扩展了！🎉

