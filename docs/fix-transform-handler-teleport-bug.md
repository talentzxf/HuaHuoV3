# 修复物体瞬移 Bug - TransformHandler 状态清理问题

## 🐛 问题描述

### 用户报告
> "为什么有时候打击会瞬移？是不是 ShapeTranslateHandler 有什么东西没有清空？导致 mouseup 的时候 shape 瞬移了"

### 症状
- 点击物体后，mouseup 时物体会**突然瞬移**到错误的位置
- 偶尔发生，不是每次都会
- 看起来像是使用了旧的位置数据

## 🔍 根本原因分析

### 问题 1：`onEndMove` 重复更新位置 ❌

**ShapeTranslateHandler.ts**：
```typescript
protected onEndMove(): void {
  if (!this.startPosition) return;

  // ❌ 计算最终 delta 时，如果 currentPosition 为 null，会使用 0
  const finalDeltaX = (this.currentPosition?.x || 0) - this.startPosition.x;
  const finalDeltaY = (this.currentPosition?.y || 0) - this.startPosition.y;

  // ❌ 再次更新位置（已经在 onDragging 中更新过了）
  const finalPosition = {
    x: initialPos.x + finalDeltaX,
    y: initialPos.y + finalDeltaY
  };

  // ❌ 重复 dispatch，导致瞬移
  store.dispatch(updateComponentPropsWithKeyFrame({
    id: transformComponentId,
    patch: { position: finalPosition }
  }));
}
```

**问题**：
1. `currentPosition` 为 `null` 时，`||0` 导致使用 `(0, 0)`
2. 位置已经在 `onDragging` 中更新了，`onEndMove` 再次更新是**重复的**
3. 如果用户只是点击（没有拖动），`onDragging` 没被调用，但 `onEndMove` 会用错误的位置更新

### 问题 2：TransformHandlerBase 没有防止重复调用

**TransformHandlerBase.ts**：
```typescript
endMove(): void {
  this.isDragging = false;
  this.onEndMove();
  this.startPosition = null;  // ❌ 清理在 onEndMove 之后
}
```

**问题**：
- 如果 `endMove` 被多次调用，没有检查
- `startPosition` 在 `onEndMove` 执行时还存在，可能导致错误计算
- `targetGameObjects` 不清理，可能影响下次操作

## ✅ 解决方案

### 修复 1：移除 `onEndMove` 中的重复更新

**Before ❌**：
```typescript
protected onEndMove(): void {
  if (!this.startPosition) return;

  // 计算最终 delta
  const finalDeltaX = (this.currentPosition?.x || 0) - this.startPosition.x;
  const finalDeltaY = (this.currentPosition?.y || 0) - this.startPosition.y;

  // 再次更新位置（重复！）
  this.targetGameObjects.forEach(gameObjectId => {
    // ...
    store.dispatch(updateComponentPropsWithKeyFrame({
      id: transformComponentId,
      patch: { position: finalPosition }
    }));
  });

  // 清理
  this.initialPositions.clear();
  this.transformComponentIds.clear();
  this.currentPosition = null;
}
```

**After ✅**：
```typescript
protected onEndMove(): void {
  // ✅ 只清理状态，不更新位置
  // 位置已经在 onDragging 中实时更新了
  this.initialPositions.clear();
  this.transformComponentIds.clear();
  this.currentPosition = null;
  
  // 注意：不需要再 dispatch updateComponentPropsWithKeyFrame
  // 因为 onDragging 已经在每次鼠标移动时更新了位置
  // 在这里再次更新会导致重复 keyframes 和潜在的瞬移 bug
}
```

### 修复 2：改进 TransformHandlerBase 的状态清理

**Before ❌**：
```typescript
endMove(): void {
  this.isDragging = false;
  this.onEndMove();
  this.startPosition = null;  // 清理在 onEndMove 之后
}
```

**After ✅**：
```typescript
endMove(): void {
  if (!this.isDragging) return; // ✅ 防止重复调用
  
  this.isDragging = false;
  this.onEndMove();
  
  // ✅ 清理状态防止陈旧数据
  this.startPosition = null;
  this.targetGameObjects.clear();
}
```

## 📊 工作流程对比

### Before ❌ - 有 Bug 的流程

```
1. 用户点击物体
   ↓
2. beginMove(position)
   - startPosition = {x: 100, y: 100}
   - currentPosition = {x: 100, y: 100}
   - isDragging = true
   ↓
3. 用户拖动鼠标到 {x: 200, y: 200}
   ↓
4. dragging({x: 200, y: 200})
   - currentPosition = {x: 200, y: 200}
   - dispatch position {x: 200, y: 200} ✅
   ↓
5. 用户释放鼠标
   ↓
6. endMove()
   - isDragging = false
   - onEndMove():
     - deltaX = 200 - 100 = 100
     - deltaY = 200 - 100 = 100
     - finalPosition = initialPos + delta
     - dispatch position AGAIN ❌ (重复更新！)
   - startPosition = null
   ↓
7. 结果：位置被更新了两次，可能导致闪烁或瞬移
```

### 场景 2：点击没有拖动（最容易出 bug）

```
1. 用户点击物体
   ↓
2. beginMove({x: 100, y: 100})
   - startPosition = {x: 100, y: 100}
   - currentPosition = {x: 100, y: 100}
   ↓
3. 用户立即释放鼠标（没有拖动）
   ↓
4. endMove() (dragging 没有被调用！)
   - isDragging = false
   - onEndMove():
     - currentPosition = null ❌
     - deltaX = (null || 0) - 100 = -100 ❌
     - deltaY = (null || 0) - 100 = -100 ❌
     - dispatch position {x: initialPos.x - 100, y: initialPos.y - 100} ❌
   ↓
5. 结果：物体瞬移到错误位置！💥
```

### After ✅ - 修复后的流程

```
1. 用户点击物体
   ↓
2. beginMove(position)
   - startPosition = {x: 100, y: 100}
   - isDragging = true
   ↓
3. 用户拖动鼠标
   ↓
4. dragging({x: 200, y: 200})
   - dispatch position {x: 200, y: 200} ✅
   ↓
5. 用户释放鼠标
   ↓
6. endMove()
   - check: if (!isDragging) return ✅
   - isDragging = false
   - onEndMove():
     - 只清理状态 ✅
     - 不更新位置 ✅
   - startPosition = null
   - targetGameObjects.clear()
   ↓
7. 结果：位置只更新一次，正确！✅
```

### 场景 2：点击没有拖动（修复后）

```
1. 用户点击物体
   ↓
2. beginMove({x: 100, y: 100})
   - startPosition = {x: 100, y: 100}
   ↓
3. 用户立即释放鼠标（没有拖动）
   ↓
4. endMove()
   - check: if (!isDragging) return ✅
   - isDragging = false
   - onEndMove():
     - 只清理状态 ✅
     - 不更新位置 ✅
   ↓
5. 结果：物体位置不变，正确！✅
```

## 🎯 关键改进

### 1. **移除重复更新**
```typescript
// ❌ Before: onEndMove 中重复更新
onEndMove() {
  store.dispatch(updateComponentPropsWithKeyFrame(...)); // 重复！
}

// ✅ After: 只在 onDragging 中更新
onDragging() {
  store.dispatch(updateComponentPropsWithKeyFrame(...)); // 唯一更新点
}

onEndMove() {
  // 只清理状态，不更新位置
}
```

### 2. **防止空值导致的错误计算**
```typescript
// ❌ Before: 使用 || 0 作为默认值
const deltaX = (this.currentPosition?.x || 0) - this.startPosition.x;
// 如果 currentPosition.x = 0，也会被当作 null！

// ✅ After: 不计算 delta，不更新位置
// 位置已经在 onDragging 中正确更新了
```

### 3. **防止重复调用 endMove**
```typescript
// ✅ 添加检查
endMove(): void {
  if (!this.isDragging) return; // 已经结束，忽略
  // ...
}
```

### 4. **完整清理状态**
```typescript
// ✅ 清理所有状态
endMove(): void {
  this.isDragging = false;
  this.onEndMove();
  this.startPosition = null;
  this.targetGameObjects.clear(); // 新增
}
```

## 📝 测试场景

### 场景 1：正常拖动
- ✅ 点击物体
- ✅ 拖动到新位置
- ✅ 释放鼠标
- ✅ 结果：物体在新位置，没有瞬移

### 场景 2：点击没有拖动
- ✅ 点击物体
- ✅ 立即释放鼠标（没有移动）
- ✅ 结果：物体位置不变，没有瞬移

### 场景 3：快速点击多次
- ✅ 连续快速点击物体多次
- ✅ 结果：没有瞬移，没有错误

### 场景 4：拖动后立即点击其他物体
- ✅ 拖动物体 A
- ✅ 立即点击物体 B
- ✅ 结果：两个物体都正常，没有瞬移

## 🎉 总结

**修复的核心问题**：
1. ❌ **重复更新**：`onDragging` 和 `onEndMove` 都更新位置
2. ❌ **空值处理**：`currentPosition` 为 `null` 时使用 `0` 导致错误计算
3. ❌ **缺少防护**：没有检查 `isDragging` 状态

**修复方案**：
1. ✅ **单一更新点**：只在 `onDragging` 中更新位置
2. ✅ **onEndMove 只清理**：不计算、不更新
3. ✅ **添加防护**：检查 `isDragging` 防止重复调用
4. ✅ **完整清理**：清理所有状态变量

**现在不会再瞬移了！** 🎊

