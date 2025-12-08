# 智能关键帧管理系统

## 概述
实现了一个智能的关键帧（KeyFrame）管理系统，能够自动追踪GameObject与关键帧的关联关系，并在GameObject被删除或移动时自动清理无效的关键帧。

## 数据结构

### KeyFrameInfo
```typescript
export interface KeyFrameInfo {
    frame: number;              // 帧号
    gameObjectIds: string[];    // 该帧上有关键帧的GameObject ID列表
}
```

### 为什么需要追踪GameObject关联？
1. **自动清理**：当GameObject被删除时，自动移除其相关的关键帧
2. **智能管理**：当某一帧上的所有GameObject都被移除后，该帧的关键帧标记也会自动消失
3. **防止无效标记**：避免timeline上出现不再有意义的关键帧标记

## 核心功能

### 1. 添加关键帧 (addKeyFrame)
```typescript
addKeyFrame({ layerId, frame, gameObjectId })
```
- 在指定帧添加关键帧
- 如果该帧已有关键帧，将GameObject添加到关联列表
- 如果是新帧，创建新的关键帧信息
- 自动保持按帧号排序

**触发时机**：
- 创建新的GameObject时
- 拖动GameObject结束时

### 2. 清理GameObject关键帧 (cleanupGameObjectKeyFrames)
```typescript
cleanupGameObjectKeyFrames({ layerId, gameObjectId })
```
- 从该Layer的所有关键帧中移除指定GameObject
- 自动删除没有关联GameObject的空关键帧

**触发时机**：
- GameObject被删除时（在`Layer.removeGameObject()`中）

### 3. 移动关键帧 (moveGameObjectKeyFrame)
```typescript
moveGameObjectKeyFrame({ layerId, gameObjectId, fromFrame, toFrame })
```
- 将GameObject的关键帧从一帧移动到另一帧
- 自动清理原帧（如果为空）
- 自动合并到目标帧（如果已存在）

**使用场景**：
- 未来实现的时间线编辑功能
- 调整动画时间点

### 4. 从特定帧移除GameObject (removeGameObjectFromKeyFrame)
```typescript
removeGameObjectFromKeyFrame({ layerId, frame, gameObjectId })
```
- 从指定帧的关键帧中移除特定GameObject
- 如果该帧没有其他GameObject，自动删除关键帧

**使用场景**：
- 手动取消某个GameObject在特定帧的关键帧
- 精细化的关键帧编辑

### 5. 删除整个关键帧 (removeKeyFrame)
```typescript
removeKeyFrame({ layerId, frame })
```
- 完全删除指定帧的关键帧（包括所有GameObject关联）

**使用场景**：
- 用户手动删除关键帧标记
- 批量清理操作

## 自动化流程

### 场景1: 创建GameObject
```
用户绘制形状
  → SDK.Scene.createGameObjectFromPaperItem()
    → Layer.addGameObject()
      → dispatch(addKeyFrame({ layerId, frame: currentFrame, gameObjectId }))
        → Timeline显示橙色菱形标记 ◆
```

### 场景2: 拖动GameObject
```
用户拖动形状
  → ShapeTranslateHandler.onDragging() (实时更新Paper.js)
    → ShapeTranslateHandler.onEndMove()
      → dispatch(updateComponentProps({ position }))
      → dispatch(addKeyFrame({ layerId, frame: currentFrame, gameObjectId }))
        → Timeline显示/更新关键帧标记
```

### 场景3: 删除GameObject
```
用户删除形状
  → Layer.removeGameObject(gameObject)
    → dispatch(cleanupGameObjectKeyFrames({ layerId, gameObjectId }))
      ↓
      遍历该Layer所有关键帧
      → 从gameObjectIds列表中移除该GameObject
      → 如果某帧的gameObjectIds变空，删除该关键帧
        → Timeline自动移除空关键帧的标记
```

## 与Timeline组件的集成

### 数据转换
Timeline组件是独立的，只接收简单的frame number数组：

```typescript
// TimelinePanel.tsx - 数据适配层
{
  id: layer.id,
  name: layer.name,
  clips: layer.clips || [],
  keyFrames: layer.keyFrames.map(kf => kf.frame)  // KeyFrameInfo[] → number[]
}
```

### 显示效果
- **位置**：Track行底部
- **形状**：菱形 (◆)
- **颜色**：橙色 (#ffa940)
- **边框**：深橙色 (#fa8c16)
- **尺寸**：8px × 10px

## 优势

### 1. 智能清理
不需要手动管理关键帧的生命周期，系统会自动处理：
- GameObject删除 → 关联关键帧自动清理
- 所有GameObject移除 → 该帧标记自动消失

### 2. 数据一致性
- 关键帧数据总是与实际GameObject状态同步
- 不会出现"孤儿"关键帧（指向已删除GameObject的关键帧）

### 3. 性能优化
- 关键帧按帧号排序，查找快速
- 批量操作时自动合并
- 避免重复关键帧

### 4. 扩展性强
预留了多个API用于未来功能：
- 手动编辑关键帧
- 关键帧间插值
- 时间线重映射
- 批量调整动画时间

## 未来增强

### 1. 关键帧类型
可以扩展为支持不同类型的关键帧：
```typescript
interface KeyFrameInfo {
    frame: number;
    gameObjectIds: string[];
    type?: 'transform' | 'visual' | 'custom';  // 关键帧类型
    interpolation?: 'linear' | 'ease' | 'step'; // 插值方式
}
```

### 2. UI交互
- 点击关键帧跳转到该帧
- 右键菜单删除/编辑关键帧
- 拖动关键帧改变时间
- 关键帧之间的插值曲线显示

### 3. 批量操作
- 选中多个关键帧批量移动
- 按GameObject筛选关键帧
- 关键帧复制/粘贴

### 4. 动画系统集成
- 关键帧驱动的补间动画
- 自动生成中间帧
- 关键帧预览

## 测试要点

### 基本功能
- [ ] 创建形状时关键帧出现
- [ ] 拖动形状时关键帧更新
- [ ] 删除形状时关键帧消失
- [ ] 同一帧多个GameObject的关键帧合并显示

### 边界情况
- [ ] 删除最后一个GameObject时关键帧消失
- [ ] 在同一帧重复拖动不会创建重复关键帧
- [ ] 切换不同帧操作关键帧正确分布

### 性能
- [ ] 大量GameObject时关键帧管理不卡顿
- [ ] 快速连续操作时UI响应流畅

## 示例代码

### 手动添加关键帧
```typescript
import { addKeyFrame } from '@huahuo/engine';

// 在当前帧为GameObject添加关键帧
const currentFrame = getEngineState().playback.currentFrame;
store.dispatch(addKeyFrame({
  layerId: 'layer-id',
  frame: currentFrame,
  gameObjectId: 'go-id'
}));
```

### 移动关键帧
```typescript
import { moveGameObjectKeyFrame } from '@huahuo/engine';

// 将关键帧从第10帧移动到第20帧
store.dispatch(moveGameObjectKeyFrame({
  layerId: 'layer-id',
  gameObjectId: 'go-id',
  fromFrame: 10,
  toFrame: 20
}));
```

### 清理特定GameObject的所有关键帧
```typescript
import { cleanupGameObjectKeyFrames } from '@huahuo/engine';

store.dispatch(cleanupGameObjectKeyFrames({
  layerId: 'layer-id',
  gameObjectId: 'go-id'
}));
```

## 总结

智能关键帧管理系统提供了：
✅ 自动追踪GameObject与关键帧的关联
✅ 删除GameObject时自动清理关键帧
✅ 空关键帧自动消失
✅ Timeline保持独立性，不依赖Engine内部实现
✅ 为未来动画系统奠定基础

这个系统确保了关键帧数据的一致性和准确性，避免了手动管理的复杂性和错误。

