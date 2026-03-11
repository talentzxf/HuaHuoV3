# 使用 Registry 模式解耦 Component 和 Property Renderer

## 🎯 目标

移除 `GameObjectPropertyPanel` 中的硬编码判断（`if (component.type === 'Timeline')`），使用 Registry 模式实现：
1. ✅ GameObjectPropertyPanel 保持通用性，不依赖具体 Component
2. ✅ Component 可以注册自己的 Property Renderer
3. ✅ 为用户自定义 Component 的 Property 渲染做准备

## 🏗️ 架构设计

### Before ❌ (硬编码耦合)

```typescript
// GameObjectPropertyPanel.tsx
const ComponentPropertiesPanel = ({ component, ... }) => {
  // ❌ 硬编码判断，耦合
  if (component.type === 'Timeline') {
    return <TimelinePropertyRenderer ... />;
  }
  
  // Default rendering
  return <div>...</div>;
};
```

**问题**：
- ❌ GameObjectPropertyPanel 需要知道所有特殊 Component
- ❌ 添加新 Component 需要修改 GameObjectPropertyPanel
- ❌ 紧耦合，不利于扩展

### After ✅ (Registry 模式解耦)

```typescript
// GameObjectPropertyPanel.tsx
const ComponentPropertiesPanel = ({ component, ... }) => {
  // ✅ 通过 Registry 查找
  const registry = ComponentPropertyRendererRegistry.getInstance();
  const customRenderer = registry.getRenderer(component.type);
  
  if (customRenderer) {
    return customRenderer({ component, ... });
  }
  
  // Default rendering
  return <div>...</div>;
};
```

**优势**：
- ✅ GameObjectPropertyPanel 完全通用
- ✅ 添加新 Component 无需修改 GameObjectPropertyPanel
- ✅ 松耦合，易于扩展

## 📦 实现的组件

### 1. PropertyRendererRegistry (Engine 层)

```typescript
// packages/hh-engine/src/core/PropertyRendererRegistry.ts

export type PropertyRendererFunction = (props: {
  component: any;
  gameObjectId: string;
  onPropertyChange: (componentId: string, propName: string, value: any) => void;
}) => any;

class ComponentPropertyRendererRegistry {
  private renderers: Map<string, PropertyRendererFunction>;

  register(componentType: string, renderer: PropertyRendererFunction): void {
    this.renderers.set(componentType, renderer);
  }

  getRenderer(componentType: string): PropertyRendererFunction | undefined {
    return this.renderers.get(componentType);
  }
}
```

**关键设计**：
- 不依赖 React（Engine 层不应依赖 UI 框架）
- 使用 `any` 返回类型，由 IDE 层决定具体类型
- Singleton 模式

### 2. PropertyRenderer Decorator (Engine 层)

```typescript
// packages/hh-engine/src/core/PropertyRendererRegistry.ts

export function PropertyRenderer(rendererComponent: PropertyRendererFunction) {
  return function <T extends { new(...args: any[]): any }>(constructor: T) {
    const instance = new constructor({} as any);
    const componentType = instance.type;

    if (componentType) {
      const registry = ComponentPropertyRendererRegistry.getInstance();
      registry.register(componentType, rendererComponent);
    }

    return constructor;
  };
}
```

**说明**：
- Decorator 模式
- 自动注册 Component 的自定义渲染器
- ⚠️ 但为了避免循环依赖，实际注册在 IDE 层完成

### 3. registerCustomPropertyRenderers (IDE 层)

```typescript
// hh-ide/src/components/panels/properties/registerCustomPropertyRenderers.ts

export function registerCustomPropertyRenderers() {
  const registry = ComponentPropertyRendererRegistry.getInstance();

  // Register Timeline component's custom renderer
  registry.register('Timeline', TimelinePropertyRenderer);

  // Future: Register other custom renderers here
  // registry.register('Physics', PhysicsPropertyRenderer);
  // registry.register('ParticleSystem', ParticleSystemPropertyRenderer);
}
```

**职责**：
- 在 IDE 初始化时调用
- 集中注册所有自定义 Property Renderer
- 易于添加新的自定义渲染器

### 4. GameObjectPropertyPanel (IDE 层)

```typescript
// hh-ide/src/components/panels/properties/GameObjectPropertyPanel.tsx

// 初始化时注册
registerDefaultPropertyRenderers();
registerCustomPropertyRenderers();

// 组件渲染
const ComponentPropertiesPanel = ({ component, ... }) => {
  const rendererRegistry = ComponentPropertyRendererRegistry.getInstance();
  const customRenderer = rendererRegistry.getRenderer(component.type);

  if (customRenderer) {
    return customRenderer({ component, gameObjectId, onPropertyChange });
  }

  // Default rendering
  return <div>...</div>;
};
```

**特点**：
- ✅ 完全通用，不依赖具体 Component
- ✅ 通过 Registry 动态查找渲染器
- ✅ 支持 fallback 到默认渲染

## 🔄 数据流

### 注册流程

```
IDE 启动
    ↓
调用 registerCustomPropertyRenderers()
    ↓
registry.register('Timeline', TimelinePropertyRenderer)
    ↓
ComponentPropertyRendererRegistry 存储映射
    ↓
{
  'Timeline': TimelinePropertyRenderer,
  'Physics': PhysicsPropertyRenderer,  // 未来
  'ParticleSystem': ParticleSystemPropertyRenderer  // 未来
}
```

### 渲染流程

```
GameObjectPropertyPanel 渲染 Component
    ↓
ComponentPropertiesPanel({ component })
    ↓
registry.getRenderer(component.type)
    ↓
找到 'Timeline' → TimelinePropertyRenderer
    ↓
调用 TimelinePropertyRenderer({ component, ... })
    ↓
渲染自定义 UI (AnimationSegmentEditor)
```

## 🎨 未来扩展示例

### 添加自定义 Component 的 Property Renderer

```typescript
// 1. 创建自定义渲染器
// hh-ide/src/components/panels/properties/PhysicsPropertyRenderer.tsx
export const PhysicsPropertyRenderer: React.FC<...> = ({ component, ... }) => {
  return (
    <div>
      <h3>Physics Properties</h3>
      <div>Mass: <Slider value={component.props.mass} ... /></div>
      <div>Friction: <Slider value={component.props.friction} ... /></div>
      {/* 自定义 UI */}
    </div>
  );
};

// 2. 注册渲染器
// registerCustomPropertyRenderers.ts
export function registerCustomPropertyRenderers() {
  const registry = ComponentPropertyRendererRegistry.getInstance();
  
  registry.register('Timeline', TimelinePropertyRenderer);
  registry.register('Physics', PhysicsPropertyRenderer);  // ← 添加这一行
}
```

**就这么简单！** 无需修改 `GameObjectPropertyPanel`！

### 用户自定义 Component

```typescript
// 用户代码
import { Component, PropertyConfig } from '@huahuo/engine';
import { ComponentPropertyRendererRegistry } from '@huahuo/engine';

// 1. 创建自定义 Component
@Component
export class MyCustomComponent extends ComponentBase {
  readonly type = 'MyCustomComponent';
  
  @PropertyConfig()
  myProperty!: number;
}

// 2. 创建自定义渲染器
const MyCustomRenderer = ({ component, ... }) => {
  return <div>My Custom UI for {component.type}</div>;
};

// 3. 注册
ComponentPropertyRendererRegistry.getInstance()
  .register('MyCustomComponent', MyCustomRenderer);
```

**完全解耦！用户可以自由扩展！**

## 📋 修改的文件

### Engine 层 (packages/hh-engine)

1. **core/PropertyRendererRegistry.ts** ✅ (新建)
   - ComponentPropertyRendererRegistry 类
   - PropertyRenderer decorator
   - PropertyRendererFunction 类型

2. **index.ts** ✅
   - 导出 PropertyRendererRegistry 和相关类型

### IDE 层 (hh-ide)

3. **properties/registerCustomPropertyRenderers.ts** ✅ (新建)
   - 注册 Timeline 和其他自定义渲染器

4. **properties/GameObjectPropertyPanel.tsx** ✅
   - 导入并调用 `registerCustomPropertyRenderers()`
   - 使用 Registry 查找自定义渲染器
   - 移除硬编码的 `if (component.type === 'Timeline')` 判断

## ✅ 验证清单

- ✅ GameObjectPropertyPanel 完全通用，不依赖具体 Component
- ✅ Timeline 的自定义渲染通过 Registry 注册
- ✅ 添加新 Component 无需修改 GameObjectPropertyPanel
- ✅ Engine 层不依赖 React（架构分层正确）
- ✅ 支持用户自定义 Component 和渲染器

## 🎯 设计原则

### 1. 开闭原则 (Open-Closed Principle)
- ✅ 对扩展开放：可以随意添加新的自定义渲染器
- ✅ 对修改封闭：无需修改 GameObjectPropertyPanel

### 2. 依赖倒置原则 (Dependency Inversion Principle)
- ✅ GameObjectPropertyPanel 依赖抽象（Registry 接口）
- ✅ 具体渲染器实现抽象（PropertyRendererFunction）

### 3. 单一职责原则 (Single Responsibility Principle)
- ✅ GameObjectPropertyPanel：通用组件渲染逻辑
- ✅ TimelinePropertyRenderer：Timeline 特定的 UI
- ✅ Registry：管理渲染器映射

## 🎉 总结

通过 Registry 模式实现了：

✅ **解耦**：GameObjectPropertyPanel 不再依赖具体 Component
✅ **扩展性**：轻松添加新的自定义 Property Renderer
✅ **通用性**：GameObjectPropertyPanel 保持完全通用
✅ **用户友好**：为用户自定义 Component 做好准备

现在架构更清晰，更易于扩展！🚀

