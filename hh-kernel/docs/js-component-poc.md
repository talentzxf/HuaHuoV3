# JS Component PoC

目标：在不改变现有数据模型的前提下，增加一个 PoC，让用户可以通过组件生命周期钩子（on_add/on_tick/on_remove）在运行时扩展行为。此 PoC 使用 Rust 原生的 ComponentDef 扩展（未嵌入 JS 引擎），为后续集成 JS 运行时做准备。

主要改动

- kernel-sdk/src/component_def.rs
  - 为 ComponentDef 添加 runtime 钩子：on_add/on_remove/on_tick（均提供默认空实现），以兼容现有实现。

- kernel-core
  - 为播放/推进流程预留钩子调用点（在 PlaybackState.advance 中记录 advance 动作，PoC 主要在 example 中演示注册与调用链）。

PoC 示例

- kernel-sdk/examples/poctest.rs
  - 注册了一个 LoggingComp（实现 on_add/on_tick），在注册时打印注册信息。用于验证 ComponentRegistry 注册流程。

测试方案

1. 本地构建：
   cargo build -p kernel-sdk

2. 运行 PoC example：
   cargo run -p kernel-sdk --example poctest
   - 期望输出显示已注册类型 Logging

3. 后续集成（手动）：
   - 将一个 Logging 类型附加到一个 GameObject，并在 playback tick 时触发 on_tick（需要在 kernel-core 的播放循环里调用 registry 中对应 type 的 on_tick，PoC 将在下一步实现）

中英文用户文档

- 见下面的 README 片段。
