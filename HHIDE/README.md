# HH IDE

基于 React + Redux + Ant Design 的脚手架项目

## 技术栈

- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Redux Toolkit** - 状态管理
- **Ant Design** - UI 组件库
- **Webpack 5** - 模块打包工具

## 项目结构

```
hh-ide/
├── public/
│   └── index.html          # HTML 模板
├── src/
│   ├── components/         # React 组件
│   │   └── Counter.tsx     # 计数器示例组件
│   ├── store/              # Redux store
│   │   ├── features/       # Redux slices
│   │   │   └── counter/
│   │   │       └── counterSlice.ts
│   │   ├── hooks.ts        # 自定义 Redux hooks
│   │   └── store.ts        # Store 配置
│   ├── App.tsx             # 根组件
│   └── index.tsx           # 入口文件
├── package.json
├── tsconfig.json           # TypeScript 配置
└── webpack.config.js       # Webpack 配置
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm start
```

项目将在 http://localhost:3001 打开

### 生产构建

```bash
npm run build
```

构建文件将输出到 `dist` 目录

## 功能特性

- ✅ React 18 + TypeScript
- ✅ Redux Toolkit 状态管理
- ✅ Ant Design UI 组件
- ✅ Webpack 5 热更新
- ✅ 路径别名 (@/* 映射到 src/*)
- ✅ 中文国际化支持

## 开发说明

### 添加新的 Redux Slice

在 `src/store/features/` 目录下创建新的 slice，然后在 `src/store/store.ts` 中注册。

### 使用 Redux Hooks

```typescript
import { useAppDispatch, useAppSelector } from '@/store/hooks';

// 在组件中使用
const dispatch = useAppDispatch();
const data = useAppSelector((state) => state.counter.value);
```

### 路径别名

可以使用 `@/` 来引用 `src/` 目录下的模块：

```typescript
import { useAppDispatch } from '@/store/hooks';
import Counter from '@/components/Counter';
```

## License

ISC


