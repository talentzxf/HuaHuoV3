# JS Component PoC (WASM)

目标：在浏览器中让用户以 JavaScript 编写组件生命周期钩子（onAdd/onTick/onRemove），并在 kernel-wasm 的播放循环里调用这些钩子。

实现要点

- Rust (wasm) -> JS 边界：在 kernel-wasm 的 tick() 中计算每个活跃 GameObject 的插值属性（InterpolatedProps），并对每个组件类型调用导入的 JS 函数 `hh_call_component_on_tick(typeName, props, goId, frame, dt)`。
- 防止不必要的序列化：在调用前先询问 JS 是否已注册该组件类型（导入函数 `hh_has_component(typeName)`），若未注册则跳过序列化。
- 数据转换：使用 serde_wasm_bindgen 将 Rust 的 PropertyMap 序列化为 JsValue。PropertyValue 已 derive Serialize/Deserialize，因此转换会按下面规则映射到 JS 原生类型：
  - Float -> number
  - Vec2/Vec3 -> { x, y, z }
  - Color -> { r, g, b, a }
  - Bool -> boolean
  - String -> string
  - Int -> number
  - FileRef -> string

代码变更（摘要）

- kernel-wasm/src/lib.rs
  - 在 tick() 中新增对每帧组件钩子的调用逻辑（只对已注册的组件类型进行序列化与调用）。
  - 新增 extern 导入：`hh_call_component_on_tick`, `hh_has_component`。
- kernel-wasm/Cargo.toml
  - 新增依赖：serde_wasm_bindgen = "0.5"。
- kernel-wasm/examples/js_component_poc.html
  - 提供 JS-side 注册与实现：`window.hh_register_component`, `window.hh_call_component_on_tick`, `window.hh_has_component`。

如何运行 PoC

1. 构建 wasm 包（需要已安装 wasm-pack / wasm-bindgen 工具链）：
   - cargo build -p kernel-wasm --target wasm32-unknown-unknown --release
   - 然后运行 wasm-bindgen 生成绑定或使用 wasm-pack
2. 在网页中加载生成的 wasm 绑定 JS（示例 HTML 中有注释说明加载点）。示例 HTML 也可直接用于展示注册与模拟调用。

安全提示

- 当前设计假定 JS 侧脚本由页面所有者托管并可信。若需要提供给第三方用户提交脚本，必须考虑沙箱（例如在 sandboxed iframe 或 Worker 中运行并仅暴露受限 API）。

性能注意

- 每帧为每个活跃对象的每个已注册组件进行序列化与一次 wasm->js 调用。若场景很大可考虑批量调用或限制每帧的回调数量。

下一步建议

- 我可以将改动做成一个本地 git commit 并添加测试（单元测试/集成测试）以及更详细的文档示例。如果同意，我会提交并添加：
  - kernel-wasm/tests/（如果可在 wasm 环境下运行）或使用 headless wasm testing
  - 一个 README demo 脚本说明如何把 wasm + html 一起部署

