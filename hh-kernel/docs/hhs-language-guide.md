# HuaHuo Script (`.hhs`) 语言使用指南

HuaHuo Script 是一个为 `.hhk` 动画项目文件设计的领域特定语言（DSL），
通过 `hhk run`、`hhk dump`、`hhk repl` 命令使用。

---

## 目录

1. [快速开始](#1-快速开始)
2. [基本语法](#2-基本语法)
3. [项目管理](#3-项目管理)
4. [场景管理](#4-场景管理)
5. [图层管理](#5-图层管理)
6. [GameObject 管理](#6-gameobject-管理)
7. [组件与关键帧](#7-组件与关键帧)
8. [Element（可复用动画单元）](#8-element可复用动画单元)
9. [值类型与构造函数](#9-值类型与构造函数)
10. [缓动函数](#10-缓动函数)
11. [内省与调试](#11-内省与调试)
12. [REPL 交互模式](#12-repl-交互模式)
13. [dump 反向导出](#13-dump-反向导出)
14. [CLI 命令完整参考](#14-cli-命令完整参考)
15. [完整示例](#15-完整示例)

---

## 1. 快速开始

```bash
# 安装（从源码编译）
cargo build -p kernel-cli --release
# 可执行文件位于 target/release/hhk.exe (Windows) 或 target/release/hhk (Linux/macOS)

# 创建并运行一个脚本
hhk run my_animation.hhs

# 交互式 REPL
hhk repl

# 加载已有项目进入 REPL
hhk repl --load project.hhk
```

**第一个脚本 `hello.hhs`：**

```hhs
# 创建一个新项目
new_project("Hello", fps=30, w=800, h=600)

# 获取默认场景和图层
let scene = project.scene("DefaultScene")
let layer = scene.layer("drawing")

# 创建一个小球并设置动画
let ball = layer.new_go("ball", born=0)
ball.add_component("Transform")
ball.set_kf("Transform", "position", frame=0,  value=vec2(0, 300))
ball.set_kf("Transform", "position", frame=60, value=vec2(800, 300), easing="ease-in-out")

# 保存
save("hello.hhk")
```

```bash
hhk run hello.hhs
# ✓ Created new project 'Hello'
# ✓ Saved 'hello.hhk' (...)
```

---

## 2. 基本语法

### 注释

```hhs
# 这是注释，# 后面的内容全部忽略
```

### 变量赋值

```hhs
let x = project.scene("DefaultScene")
let layer = x.layer("drawing")
```

变量只能通过 `let` 声明，类型由右侧表达式决定。

### 链式调用

```hhs
# 方法可以直接链式调用，无需中间变量
let ball = project.scene("DefaultScene").layer("drawing").new_go("ball", born=0)

# 也可以分多行（用 \ 续行）
ball.add_component("Transform") \
   .set_kf("Transform", "position", frame=0, value=vec2(100, 200))
```

### 函数调用参数

参数支持**位置参数**和**命名参数**，可以混用：

```hhs
# 位置参数
layer.new_go("ball", 0)

# 命名参数（推荐，更清晰）
layer.new_go("ball", born=0)

# 混用：位置参数在前，命名参数在后
go.set_kf("Transform", "position", frame=30, value=vec2(400, 300), easing="linear")
```

### 空行与分隔

空行被忽略，可以用来分隔逻辑块：

```hhs
let scene = project.scene("DefaultScene")

let layer = scene.layer("drawing")

let ball = layer.new_go("ball", born=0)
```

---

## 3. 项目管理

### 创建新项目

```hhs
new_project("项目名称")
new_project("项目名称", fps=30)
new_project("项目名称", fps=30, w=1920, h=1080)
```

新建项目自动创建一个 `DefaultScene`，其中包含 `background` 和 `drawing` 两个图层。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `fps` | `30` | 帧率 |
| `w` / `width` | `800` | 画布宽度（像素） |
| `h` / `height` | `600` | 画布高度（像素） |

### 加载已有项目

```hhs
load("project.hhk")
```

加载后可以用 `project` 变量访问项目，也可以赋值：

```hhs
load("project.hhk")
project.info()   # 查看项目信息
```

### 保存项目

```hhs
save()                  # 覆盖保存到加载时的文件
save("output.hhk")      # 保存到指定路径
```

> **注意**：如果是 `new_project` 创建的，必须指定路径，否则报错。

### 项目属性

```hhs
project.set_fps(60)
project.set_size(1920, 1080)
project.info()           # 打印项目摘要
project.list_scenes()    # 列出所有场景
```

---

## 4. 场景管理

### 获取场景

```hhs
# 按名称获取（推荐）
let scene = project.scene("DefaultScene")

# 按 ID 获取
let scene = project.scene("abc123xyz")
```

### 创建新场景

```hhs
let scene2 = project.new_scene("Cut02")
let scene3 = project.new_scene("Cut03", fps=24, duration=10)
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `fps` | 继承项目 fps | 该场景的帧率 |
| `duration` | `5.0` | 场景时长（秒） |

### 场景属性

```hhs
scene.set_fps(24)
scene.set_duration(8.0)    # 单位：秒
scene.info()               # 打印场景摘要
scene.list_layers()        # 列出该场景的所有图层
```

---

## 5. 图层管理

### 获取图层

```hhs
let layer = scene.layer("drawing")       # 按名称
let layer = scene.layer("abc123xyz")     # 按 ID
```

### 创建图层

```hhs
let fx    = scene.new_layer("fx")
let bg    = scene.new_layer("background")
```

### 图层属性

```hhs
layer.set_visible(false)   # 隐藏图层
layer.set_locked(true)     # 锁定图层（防止编辑）
layer.info()               # 打印图层摘要
layer.list_gos()           # 列出该图层所有 GameObject
```

---

## 6. GameObject 管理

### 获取 GameObject

```hhs
let ball = layer.go("ball")          # 按名称
let ball = layer.go("abc123xyz")     # 按 ID
```

### 创建 GameObject

```hhs
let ball = layer.new_go("ball")
let ball = layer.new_go("ball", born=10)   # 从第10帧出现
```

`born` 参数表示该 GameObject 从哪一帧起存在（默认 `0`）。

### GameObject 属性

```hhs
go.set_active(false)   # 停用（不参与播放）
go.set_born(5)         # 修改出生帧
go.info()              # 打印摘要（组件数、关键帧总数等）
```

---

## 7. 组件与关键帧

### 添加组件

```hhs
go.add_component("Transform")
go.add_component("Visual")
go.add_component("MyCustomComp")   # 自定义组件
```

内置组件类型：

| 组件名 | 常用属性 | 说明 |
|--------|---------|------|
| `Transform` | `position`, `rotation`, `scale` | 位置/旋转/缩放 |
| `Visual` | `fillColor`, `strokeColor`, `strokeWidth`, `opacity` | 外观 |

### 设置关键帧

```hhs
go.set_kf("组件名", "属性名", frame=帧号, value=值)
go.set_kf("组件名", "属性名", frame=帧号, value=值, easing="缓动函数")
```

**示例：**

```hhs
# 位置动画
go.set_kf("Transform", "position", frame=0,  value=vec2(0, 300))
go.set_kf("Transform", "position", frame=30, value=vec2(400, 300), easing="ease-in-out")
go.set_kf("Transform", "position", frame=60, value=vec2(800, 300))

# 旋转动画（角度）
go.set_kf("Transform", "rotation", frame=0,  value=float(0))
go.set_kf("Transform", "rotation", frame=60, value=float(360))

# 颜色动画
go.set_kf("Visual", "fillColor", frame=0,  value=color(255, 0, 0, 255))    # 红
go.set_kf("Visual", "fillColor", frame=30, value=color(0, 0, 255, 255))    # 蓝

# 透明度
go.set_kf("Visual", "opacity", frame=0,  value=float(1.0))
go.set_kf("Visual", "opacity", frame=30, value=float(0.0))
```

> **注意**：同一帧对同一属性重复 `set_kf` 会**覆盖**原有关键帧。

### 删除关键帧

```hhs
go.rm_kf("Transform", "position", frame=30)
```

### 查看插值结果

`interpolate` 不修改文件，只打印指定帧的插值计算结果，用于调试：

```hhs
go.interpolate(frame=15)
# 输出：
# Interpolated 'ball' @15:
#   Transform.position = Vec2(200.0, 300.0)
#   Transform.rotation = Float(90.0)
#   Visual.fillColor   = Color(127, 0, 127, 255)
```

---

## 8. Element（可复用动画单元）

**Element** 是一个内嵌在项目中、可在多处复用的独立动画单元，类似"元件库"。  
它有自己的图层、GameObject、时间轴（fps / duration），可以被**实例化**到任意场景图层中。

### 概念结构

```
Project
├── elements: { id → ElementDef }   ← 元件库（定义）
└── scenes[]
    └── layers[]
        └── GameObject (ElementInstance 组件)  ← 场景中的实例
```

一个 Element 可以嵌套引用其他 Element（但不允许循环依赖）。

---

### 8.1 定义 Element

```hhs
# 在项目中新建一个元件定义
let coin = project.new_element("Coin")
let coin = project.new_element("Coin", fps=30, duration=1)
let coin = project.new_element("Coin", fps=30, duration=1, w=60, h=60)
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `fps` | 继承项目 fps | 元件自身帧率 |
| `duration` | `2.0` | 元件时长（秒） |
| `w` / `width` | 继承项目宽度 | 元件画布宽度 |
| `h` / `height` | 继承项目高度 | 元件画布高度 |

```hhs
# 设置元件属性
coin.set_description("Spinning gold coin loop")
coin.set_fps(30)
coin.set_duration(1.0)
```

### 8.2 在 Element 内添加图层和 GameObject

操作方式与普通场景完全对称，只是从 `element` 对象开始：

```hhs
# 图层
let coin_layer = coin.new_layer("main")
let coin_layer = coin.layer("main")          # 获取已有图层

# GameObject
let disk = coin_layer.new_go("disk", born=0)
let disk = coin_layer.go("disk")             # 获取已有 GO

# 组件与关键帧（与普通 GO 完全相同）
disk.add_component("Transform")
disk.add_component("Visual")

disk.set_kf("Transform", "rotation", frame=0,  value=float(0))
disk.set_kf("Transform", "rotation", frame=30, value=float(360))
disk.set_kf("Visual", "fillColor",   frame=0,  value=hex("#FFD700"))

disk.interpolate(frame=15)   # 调试插值
disk.list_kf()
```

---

### 8.3 在场景图层中实例化 Element

```hhs
let scene = project.scene("DefaultScene")
let layer = scene.layer("drawing")

# 基本实例化
let c1 = layer.instantiate("Coin", "coin1")
let c1 = layer.instantiate("Coin", "coin1", born=0)

# 带参数的实例化
let c2 = layer.instantiate("Coin", "coin2", born=10,
                            loop_playback=true,
                            time_offset=5,
                            speed_scale=0.5)
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| arg0 | — | Element 名称或 ID |
| arg1 | — | 本实例的 GameObject 名称 |
| `born` | `0` | 从哪一帧起出现 |
| `loop_playback` | `false` | 是否循环播放 |
| `time_offset` | `0.0` | 时间偏移（帧数） |
| `speed_scale` | `1.0` | 播放速度倍率 |

`instantiate` 返回的是一个普通 **GameObject**，可以用 `set_kf`/`set_active` 等方法进一步操作。

---

### 8.4 为实例添加动画

实例的 **位置、旋转、缩放、透明度** 可以独立设置关键帧，  
通过 `"ElementInstance"` 组件名来访问：

```hhs
# 实例位置动画
c1.set_kf("ElementInstance", "position", frame=0,  value=vec2(100, 300))
c1.set_kf("ElementInstance", "position", frame=60, value=vec2(700, 300), easing="ease-in-out")

# 实例旋转
c1.set_kf("ElementInstance", "rotation", frame=0,  value=float(0))
c1.set_kf("ElementInstance", "rotation", frame=30, value=float(45))

# 实例缩放（x/y 分开）
c1.set_kf("ElementInstance", "scale_x", frame=0, value=float(1.0))
c1.set_kf("ElementInstance", "scale_x", frame=30, value=float(2.0))

# 实例透明度（0-1）
c1.set_kf("ElementInstance", "opacity", frame=0,  value=float(1.0))
c1.set_kf("ElementInstance", "opacity", frame=30, value=float(0.0))
```

**ElementInstance 可动画属性总览：**

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `position` | Vec2 | (0, 0) | 场景空间偏移 |
| `rotation` | Float | 0.0 | 旋转角度 |
| `scale_x` | Float | 1.0 | 水平缩放 |
| `scale_y` | Float | 1.0 | 垂直缩放 |
| `opacity` | Float | 1.0 | 整体透明度 0-1 |

---

### 8.5 管理元件库

```hhs
project.list_elements()              # 列出所有元件
project.element("Coin")              # 获取元件（按名或 ID）
project.remove_element("Coin")       # 从库中删除

# 元件信息
coin.info()
coin.list_layers()
```

---

### 8.6 嵌套 Element（Element 内部包含其他 Element）

Element 内部的图层也支持 `instantiate`，从而实现**任意深度的层级嵌套**。

```hhs
# 已有 Petal 元件
let flower = project.new_element("Flower", fps=30, duration=4, w=300, h=300)
let flower_layer = flower.new_layer("petals")

# 在 Flower 内部实例化 6 个 Petal，排列成花形
let p0 = flower_layer.instantiate("Petal", "petal0", born=0)
p0.set_kf("ElementInstance", "position", frame=0, value=vec2(0, -80))
p0.set_kf("ElementInstance", "rotation", frame=0, value=float(0))

let p1 = flower_layer.instantiate("Petal", "petal1", born=0, time_offset=5)
p1.set_kf("ElementInstance", "position", frame=0, value=vec2(69, -40))
p1.set_kf("ElementInstance", "rotation", frame=0, value=float(60))

# ... 共 6 个花瓣

# 继续再嵌一层：Kaleidoscope 包含 8 个 Flower
let kaleido = project.new_element("Kaleidoscope", fps=30, duration=8, w=800, h=800)
let k_layer = kaleido.new_layer("flowers")

let f0 = k_layer.instantiate("Flower", "f0", born=0)
f0.set_kf("ElementInstance", "position", frame=0,   value=vec2(250, 0))
f0.set_kf("ElementInstance", "rotation", frame=0,   value=float(0))
f0.set_kf("ElementInstance", "rotation", frame=240, value=float(360))  # 一圈

# ... 共 8 朵花

# 最后放进场景
let layer = project.scene("DefaultScene").layer("drawing")
let main = layer.instantiate("Kaleidoscope", "main", born=0, loop_playback=true)
main.set_kf("ElementInstance", "position", frame=0, value=vec2(400, 400))
main.set_kf("ElementInstance", "rotation", frame=240, value=float(360))
```

**嵌套层数没有限制**，只要不形成循环依赖。

**循环依赖保护：** 如果 A 包含 B、B 包含 A，会立即报错：
```
instantiate: cycle detected — 'B' transitively references 'A'
```

**`element_layer.instantiate` 参数与 `layer.instantiate` 完全相同：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| arg0 | — | 被嵌套的 Element 名称或 ID |
| arg1 | — | 实例 GO 名称 |
| `born` | `0` | 出现帧 |
| `loop_playback` | `false` | 是否循环 |
| `time_offset` | `0.0` | 时间偏移（帧），可用于错开动画节奏 |
| `speed_scale` | `1.0` | 播放速度倍率 |

返回的是 **ElementGO**，支持 `set_kf("ElementInstance", ...)` 对实例的位置、旋转、缩放、透明度设置关键帧。

---

### 8.7 完整 Element 示例：万花筒（3层嵌套）

```hhs
# kaleidoscope.hhs — Petal → Flower → Kaleidoscope，三层嵌套
new_project("Kaleidoscope", fps=30, w=800, h=800)

# ── 第1层：Petal（单个花瓣）────────────────────────────────────────
let petal = project.new_element("Petal", fps=30, duration=2, w=40, h=120)
let petal_layer = petal.new_layer("shape")
let p = petal_layer.new_go("p", born=0)
p.add_component("Transform")
p.add_component("Visual")
p.set_kf("Transform", "scale_x", frame=0,  value=float(1.0))
p.set_kf("Transform", "scale_x", frame=30, value=float(1.4), easing="ease-in-out")
p.set_kf("Transform", "scale_x", frame=60, value=float(1.0), easing="ease-in-out")
p.set_kf("Visual", "fillColor",  frame=0,  value=color(255, 100, 180, 220))
p.set_kf("Visual", "fillColor",  frame=30, value=color(255, 200, 100, 220))
p.set_kf("Visual", "fillColor",  frame=60, value=color(255, 100, 180, 220))

# ── 第2层：Flower（6个花瓣组成一朵花）──────────────────────────────
let flower = project.new_element("Flower", fps=30, duration=4, w=300, h=300)
let flower_layer = flower.new_layer("petals")

# 6个花瓣，60°间隔，用 time_offset 错开节奏
let p0 = flower_layer.instantiate("Petal", "petal0", born=0)
p0.set_kf("ElementInstance", "position", frame=0, value=vec2(0, -80))
p0.set_kf("ElementInstance", "rotation", frame=0, value=float(0))

let p1 = flower_layer.instantiate("Petal", "petal1", born=0, time_offset=5)
p1.set_kf("ElementInstance", "position", frame=0, value=vec2(69, -40))
p1.set_kf("ElementInstance", "rotation", frame=0, value=float(60))

let p2 = flower_layer.instantiate("Petal", "petal2", born=0, time_offset=10)
p2.set_kf("ElementInstance", "position", frame=0, value=vec2(69, 40))
p2.set_kf("ElementInstance", "rotation", frame=0, value=float(120))

let p3 = flower_layer.instantiate("Petal", "petal3", born=0, time_offset=15)
p3.set_kf("ElementInstance", "position", frame=0, value=vec2(0, 80))
p3.set_kf("ElementInstance", "rotation", frame=0, value=float(180))

let p4 = flower_layer.instantiate("Petal", "petal4", born=0, time_offset=20)
p4.set_kf("ElementInstance", "position", frame=0, value=vec2(-69, 40))
p4.set_kf("ElementInstance", "rotation", frame=0, value=float(240))

let p5 = flower_layer.instantiate("Petal", "petal5", born=0, time_offset=25)
p5.set_kf("ElementInstance", "position", frame=0, value=vec2(-69, -40))
p5.set_kf("ElementInstance", "rotation", frame=0, value=float(300))

# ── 第3层：Kaleidoscope（8朵花组成万花筒）──────────────────────────
let kaleido = project.new_element("Kaleidoscope", fps=30, duration=8, w=800, h=800)
let k_layer = kaleido.new_layer("flowers")

# 8朵花均匀分布，各自慢速旋转
let f0 = k_layer.instantiate("Flower", "f0", born=0)
f0.set_kf("ElementInstance", "position", frame=0, value=vec2(250, 0))
f0.set_kf("ElementInstance", "rotation", frame=0,   value=float(0))
f0.set_kf("ElementInstance", "rotation", frame=240, value=float(360))

let f1 = k_layer.instantiate("Flower", "f1", born=0, time_offset=15)
f1.set_kf("ElementInstance", "position", frame=0, value=vec2(177, 177))
f1.set_kf("ElementInstance", "rotation", frame=0,   value=float(45))
f1.set_kf("ElementInstance", "rotation", frame=240, value=float(405))

let f2 = k_layer.instantiate("Flower", "f2", born=0, time_offset=30)
f2.set_kf("ElementInstance", "position", frame=0, value=vec2(0, 250))

let f3 = k_layer.instantiate("Flower", "f3", born=0, time_offset=45)
f3.set_kf("ElementInstance", "position", frame=0, value=vec2(-177, 177))

let f4 = k_layer.instantiate("Flower", "f4", born=0, time_offset=60)
f4.set_kf("ElementInstance", "position", frame=0, value=vec2(-250, 0))

let f5 = k_layer.instantiate("Flower", "f5", born=0, time_offset=75)
f5.set_kf("ElementInstance", "position", frame=0, value=vec2(-177, -177))

let f6 = k_layer.instantiate("Flower", "f6", born=0, time_offset=90)
f6.set_kf("ElementInstance", "position", frame=0, value=vec2(0, -250))

let f7 = k_layer.instantiate("Flower", "f7", born=0, time_offset=105)
f7.set_kf("ElementInstance", "position", frame=0, value=vec2(177, -177))

# ── 放进场景，整体再旋转一圈 ─────────────────────────────────────
let layer = project.scene("DefaultScene").layer("drawing")
let main = layer.instantiate("Kaleidoscope", "main", born=0, loop_playback=true)
main.set_kf("ElementInstance", "position", frame=0,   value=vec2(400, 400))
main.set_kf("ElementInstance", "rotation", frame=0,   value=float(0))
main.set_kf("ElementInstance", "rotation", frame=240, value=float(360), easing="linear")

project.list_elements()

save("kaleidoscope.hhk")
```

```bash
hhk run kaleidoscope.hhs
hhk dump kaleidoscope.hhk    # 查看三层嵌套如何被反向导出
```

运行后 `project.list_elements()` 输出：
```
Elements (3):
  [...]  'Flower'        300x300 fps=30 duration=4s frames=120 layers=1
  [...]  'Kaleidoscope'  800x800 fps=30 duration=8s frames=240 layers=1
  [...]  'Petal'          40x120 fps=30 duration=2s frames=60  layers=1
```

---

## 9. 值类型与构造函数

| 构造函数 | 示例 | 说明 |
|---------|------|------|
| `float(n)` | `float(1.5)` | 浮点数 |
| `int(n)` | `int(3)` | 整数 |
| `bool(b)` | `bool(true)` | 布尔值 |
| `str("s")` | `str("hello")` | 字符串 |
| `vec2(x, y)` | `vec2(100, 200)` | 二维向量 |
| `vec3(x, y, z)` | `vec3(1, 2, 3)` | 三维向量 |
| `color(r, g, b, a)` | `color(255, 128, 0, 255)` | RGBA 颜色，每通道 0-255 |
| `hex("...")` | `hex("#FF8800")` | 十六进制颜色，支持 `#RRGGBB` 和 `#RRGGBBAA` |

**简写**：裸数字会被自动识别为 `float` 或 `int`：

```hhs
# 以下两行等价
go.set_kf("Transform", "rotation", frame=0, value=float(0))
go.set_kf("Transform", "rotation", frame=0, value=0)         # 自动识别为 float
```

---

## 10. 缓动函数

| 值 | 效果 |
|----|------|
| `"linear"` | 匀速（默认） |
| `"step"` | 阶跃，不插值（直接跳到目标值） |
| `"ease-in"` | 由慢到快 |
| `"ease-out"` | 由快到慢 |
| `"ease-in-out"` | 由慢到快再到慢 |
| `"bezier:x1,y1,x2,y2"` | 自定义三次贝塞尔曲线，参数范围 0-1 |

**贝塞尔示例：**

```hhs
# CSS cubic-bezier(0.42, 0, 0.58, 1) 等价于 ease-in-out
go.set_kf("Transform", "position", frame=30, value=vec2(400, 300),
          easing="bezier:0.42,0,0.58,1")

# 弹性效果
go.set_kf("Transform", "position", frame=60, value=vec2(800, 300),
          easing="bezier:0.34,1.56,0.64,1")
```

---

## 11. 内省与调试

以下方法只打印信息，**不修改项目**：

```hhs
# 项目级别
project.info()           # 名称、fps、画布大小、场景数
project.list_scenes()    # 所有场景列表（含 ID、帧数、图层数）

# 场景级别
scene.info()             # 名称、fps、时长、帧数、图层数
scene.list_layers()      # 所有图层（含 ID、可见性、锁定状态）

# 图层级别
layer.info()             # 名称、可见性、锁定、对象数
layer.list_gos()         # 所有 GameObject（含 ID、组件数、关键帧数）

# GameObject 级别
go.info()                # 名称、active、born、组件数、关键帧总数
go.list_components()     # 所有组件（含属性数、关键帧数）
go.list_kf()             # 所有关键帧（所有组件、所有属性）
go.list_kf("Transform")              # 只看 Transform 组件
go.list_kf("Transform", "position")  # 只看 position 属性

# 插值预览
go.interpolate(frame=15)  # 打印第15帧的插值结果
```

**`list_kf` 输出示例：**

```
Keyframes on 'ball':
  Transform.position (3 keyframes):
    frame=   0  value=Vec2(0.0, 360.0)    easing=Linear
    frame=  30  value=Vec2(640.0, 360.0)  easing=EaseInOut
    frame=  60  value=Vec2(1280.0, 360.0) easing=Linear
  Transform.rotation (2 keyframes):
    frame=   0  value=Float(0.0)   easing=Linear
    frame=  60  value=Float(360.0) easing=Linear
```

---

## 12. REPL 交互模式

```bash
hhk repl                        # 空白 REPL
hhk repl --load project.hhk     # 预加载 .hhk 项目
hhk repl --load setup.hhs       # 预运行 .hhs 脚本后进入交互
```

### REPL 特殊命令

| 命令 | 说明 |
|------|------|
| `help` | 打印快速参考手册 |
| `exit` / `quit` | 退出 REPL |
| Ctrl-D | 退出 REPL |
| 空行 | 手动刷新（执行）未完成的多行缓冲 |
| `\` 行末续行 | 续行符，将多行合并为一条语句 |

### REPL 工作流示例

```
$ hhk repl --load my_project.hhk

HuaHuo Script REPL  (type `exit` or Ctrl-D to quit, `help` for commands)
Loading project 'my_project.hhk'...
✓ Loaded 'my_project.hhk'

hhs> project.list_scenes()
Scenes (2):
  [abc123*] 'DefaultScene' fps=30 duration=5s frames=150 layers=2
  [def456]  'Cut02'        fps=24 duration=8s frames=192 layers=1

hhs> let s = project.scene("DefaultScene")
hhs> let l = s.layer("drawing")
hhs> l.list_gos()
GameObjects in layer 'drawing' (1):
  [xyz789] 'ball' active=true born=0 components=2 keyframes=8

hhs> let ball = l.go("ball")
hhs> ball.list_kf("Transform", "position")
Keyframes on 'ball':
  Transform.position (3 keyframes):
    frame=   0  value=Vec2(0.0, 360.0)    easing=Linear
    frame=  30  value=Vec2(640.0, 360.0)  easing=EaseInOut
    frame=  60  value=Vec2(1280.0, 360.0) easing=Linear

hhs> ball.set_kf("Transform", "position", frame=90, value=vec2(0, 360))
  kf set  go='xyz789' Transform.position @90

hhs> save()
✓ Saved 'my_project.hhk' (...)

hhs> exit
Bye!
```

---

## 13. dump 反向导出

`dump` 将二进制 `.hhk` 文件反向导出为可读的 `.hhs` 脚本，方便查看内容、版本控制、手动修改：

```bash
# 打印到终端
hhk dump project.hhk

# 保存到文件
hhk dump project.hhk -o project_dump.hhs
```

**导出的脚本可以直接执行**，完整支持 round-trip：

```bash
hhk dump project.hhk -o project_dump.hhs
hhk run project_dump.hhs     # 等价于重建项目
```

**输出示例：**

```hhs
# Dumped from: project.hhk
# Project: MyAnim (abc123)

new_project("MyAnim", fps=30, w=1280, h=720)

# ── Scene: DefaultScene ──────────────────────────────────────────
let DefaultScene = project.new_scene("DefaultScene", fps=30, duration=5)
let drawing = DefaultScene.new_layer("drawing")

# go: ball
let ball = drawing.new_go("ball", born=0)
ball.add_component("Transform")
ball.set_kf("Transform", "position", frame=0,  value=vec2(0, 360))
ball.set_kf("Transform", "position", frame=30, value=vec2(640, 360), easing="ease-in-out")
ball.set_kf("Transform", "position", frame=60, value=vec2(1280, 360))

save("project.hhk")
```

---

## 14. CLI 命令完整参考

### `hhk run`

```
hhk run <script.hhs> [--dry-run]
```

| 参数 | 说明 |
|------|------|
| `<script.hhs>` | 要执行的脚本文件路径 |
| `--dry-run` | 解析并执行，但不写入任何文件（`save()` 不生效） |

### `hhk repl`

```
hhk repl [--load <file>]
```

| 参数 | 说明 |
|------|------|
| `--load <file>` | 启动前预加载 `.hhk` 或执行 `.hhs` 文件 |

### `hhk dump`

```
hhk dump <file.hhk> [-o <output.hhs>]
```

| 参数 | 说明 |
|------|------|
| `<file.hhk>` | 要导出的项目文件 |
| `-o <file>` | 输出路径（省略则打印到 stdout） |

### `hhk new`

```
hhk new <name> [-o project.hhk] [--fps 30] [--width 800] [--height 600]
```

不经过脚本，直接在命令行创建一个空白项目文件。

### `hhk info`

```
hhk info <file.hhk>
```

打印项目的层级摘要（场景、图层、GameObject 数量、关键帧总数）。

### `hhk export`

```
hhk export <file.hhk> [-o output] [-f json|binary]
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-f` / `--format` | `json` | 导出格式：`json`（可读）或 `binary`（`.hhk`） |

### `hhk validate`

```
hhk validate <file.hhk>
```

校验文件格式合法性（魔数、版本号、bincode 结构）。

### `hhk scene` / `hhk layer` / `hhk go`

这些是低级子命令，直接操作 `.hhk` 文件，适合在 shell 脚本中使用：

```bash
# 场景
hhk scene add project.hhk "Cut03" --fps 24 --duration 6
hhk scene list project.hhk
hhk scene remove project.hhk <scene_id>
hhk scene set-current project.hhk <scene_id>

# 图层
hhk layer add project.hhk "fx" [--scene-id <id>]
hhk layer list project.hhk
hhk layer remove project.hhk <layer_id>
hhk layer set project.hhk <layer_id> --visible false --locked true

# GameObject
hhk go add project.hhk "ball" <layer_id> [--born-frame 0]
hhk go list project.hhk [--layer-id <id>]
hhk go remove project.hhk <go_id>
hhk go show project.hhk <go_id>
hhk go set-kf project.hhk <go_id> Transform position 0 vec2:100,200 [--easing linear]
hhk go rm-kf project.hhk <go_id> Transform position 0
hhk go interpolate project.hhk <go_id> 15
```

**`go set-kf` 的 value 格式（命令行版）：**

```
float:1.5      int:3      bool:true      string:hello
vec2:x,y       vec3:x,y,z
color:r,g,b,a  （0-255 整数）
```

---

## 15. 完整示例

### 示例一：制作一个弹跳小球

```hhs
# bounce.hhs
new_project("BounceAnim", fps=30, w=800, h=600)

let scene = project.scene("DefaultScene")
let layer = scene.layer("drawing")

let ball = layer.new_go("ball", born=0)
ball.add_component("Transform")
ball.add_component("Visual")

# 垂直弹跳（Y 轴）
ball.set_kf("Transform", "position", frame=0,  value=vec2(400, 50))
ball.set_kf("Transform", "position", frame=15, value=vec2(400, 550), easing="ease-in")
ball.set_kf("Transform", "position", frame=30, value=vec2(400, 50),  easing="ease-out")
ball.set_kf("Transform", "position", frame=45, value=vec2(400, 550), easing="ease-in")
ball.set_kf("Transform", "position", frame=60, value=vec2(400, 50),  easing="ease-out")

# 颜色随时间变化
ball.set_kf("Visual", "fillColor", frame=0,  value=hex("#FF4444"))
ball.set_kf("Visual", "fillColor", frame=30, value=hex("#4444FF"))
ball.set_kf("Visual", "fillColor", frame=60, value=hex("#FF4444"))

# 调试：查看第7帧的插值
ball.interpolate(frame=7)

save("bounce.hhk")
```

### 示例二：多场景项目

```hhs
# multi_scene.hhs
new_project("MultiScene", fps=24, w=1920, h=1080)

# ── 场景一：片头 ──
let intro = project.new_scene("Intro", duration=3)
let title_layer = intro.new_layer("title")
let title = title_layer.new_go("title_text", born=0)
title.add_component("Transform")
title.set_kf("Transform", "position", frame=0,  value=vec2(960, -100))
title.set_kf("Transform", "position", frame=48, value=vec2(960, 540), easing="ease-out")

# ── 场景二：主体内容 ──
let main = project.new_scene("Main", duration=10)
let bg   = main.new_layer("background")
let fg   = main.new_layer("foreground")

let hero = fg.new_go("hero", born=0)
hero.add_component("Transform")
hero.add_component("Visual")
hero.set_kf("Transform", "position", frame=0,   value=vec2(200, 540))
hero.set_kf("Transform", "position", frame=120, value=vec2(1720, 540), easing="linear")
hero.set_kf("Visual", "fillColor",   frame=0,   value=color(100, 200, 255, 255))

# ── 输出 ──
project.list_scenes()
hero.list_kf()

save("multi_scene.hhk")
```

### 示例三：修改已有项目

```hhs
# patch.hhs — 在已有项目上新增关键帧
load("project.hhk")

let scene = project.scene("DefaultScene")
let layer = scene.layer("drawing")
let ball  = layer.go("ball")

# 延伸动画到第90帧
ball.set_kf("Transform", "position", frame=90, value=vec2(0, 360))
ball.set_kf("Visual", "opacity",     frame=60, value=float(1.0))
ball.set_kf("Visual", "opacity",     frame=90, value=float(0.0))

ball.info()

save()   # 覆盖原文件
```

### 示例四：CI/CD 批量处理

```bash
#!/bin/bash
# 批量验证所有项目文件
for f in assets/*.hhk; do
    hhk validate "$f" && echo "OK: $f" || echo "FAIL: $f"
done

# 批量导出为 JSON（用于版本对比）
for f in assets/*.hhk; do
    hhk export "$f" --format json -o "json/$(basename $f .hhk).json"
done

# 用脚本批量添加水印层
for f in assets/*.hhk; do
    hhk run add_watermark.hhs  # 脚本内 load/save 具体文件
done
```

---

## 附录：错误信息速查

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `no project loaded` | 没有调用 `load()` 或 `new_project()` | 在脚本开头添加 `load(...)` 或 `new_project(...)` |
| `scene 'X' not found` | 场景名/ID 不存在 | 用 `project.list_scenes()` 查看所有场景 |
| `layer 'X' not found` | 图层名/ID 不存在 | 用 `scene.list_layers()` 查看所有图层 |
| `game object 'X' not found` | GameObject 名/ID 不存在 | 用 `layer.list_gos()` 查看 |
| `save: no path specified` | `new_project` 后调用 `save()` 没有指定路径 | 改为 `save("output.hhk")` |
| `vec2(x, y) requires exactly 2 arguments` | `vec2` 参数数量错误 | 确保传入恰好 2 个数字 |
| `color requires exactly 4 components` | `color(r,g,b,a)` 参数不足 | 确保传入 4 个 0-255 整数 |
| `unknown easing '...'` | 缓动函数名拼写错误 | 参考[缓动函数表](#9-缓动函数) |
| `undefined variable 'x'` | 使用了未声明的变量 | 检查 `let x = ...` 是否在使用前执行 |

