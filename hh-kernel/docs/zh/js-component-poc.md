# JS 组件 PoC（说明）

目标：先做一个原生 PoC，增加组件生命周期钩子（on_add/on_tick/on_remove），为后续支持用户用 JS 编写组件并挂载到 GameObject 做准备。本 PoC 使用 Rust 原生组件实现来验证调用链。

主要改动点

- kernel-sdk/src/component_def.rs：添加生命周期钩子接口（默认空实现）。
- kernel-sdk/examples/poctest.rs：提供一个示例组件 LoggingComp，用于验证注册和钩子调用。

如何运行 PoC

1. 构建 SDK：
   cargo build -p kernel-sdk
2. 运行示例：
   cargo run -p kernel-sdk --example poctest

预期：终端输出注册类型，并在 on_add/on_tick 回调中打印日志。

后续工作

- 在 kernel-core 的播放循环里调用组件钩子以在每帧运行组件逻辑。
- 集成 JS 引擎（rquickjs/quickjs/deno_core）实现 JSComponentDef 并把 JS 调用映射到这些钩子。
- 在 kernel-wasm 中增加前端注册接口，以便在浏览器上直接用 JS 实现组件。
