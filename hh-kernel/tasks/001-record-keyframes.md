标题: 在创建/修改 GameObject 时确保在内核中记录初始/更新的 Keyframe

背景和症状
- 在 IDE 中创建新的 GameObject 或以属性修改 GameObject（比如通过拖拽、工具设置初始 Visual/Transform 等）后，前端没有在内核中看到对应的 keyframe 记录，导致 timeline 中无关键帧标记、播放时无法还原初始属性。
- 前端侧已有若干调用点会期望内核接收 SetKeyFrame 等命令（KernelBridge.setKeyframe / 命令名 SetKeyFrame 已存在的接口），但在某些创建/修改路径下并未成功写入或持久化到内核数据结构中。

目标
- 内核应在收到设置 keyframe 的命令时：
  1. 正确将 keyframe 写入对应 GO 的组件属性时间线数据结构中；
  2. 保存（在内存状态与持久化序列化中）以便 save_project_bytes / load_project_bytes 能包含这些 keyframes；
  3. 发布可靠的事件（例如 topic: keyframe/{go_id}/{component}/{prop} 与通用 keyframe 事件），使上层 KernelAdapter/IDE 能收到并在 Paper.js 上显示 keyframe 标记。

需求细节（实现者可直接据此实现）
1. 命令处理
  - 命令名：SetKeyFrame（已有）
  - 请求载荷示例：
    { "SetKeyFrame": { "game_object_id": "go_123", "component_type": "Transform", "prop_name": "position", "keyframe": { "frame": 10, "value": {"x":100,"y":50}, "easing": "linear" } } }
  - 行为：将 keyframe 插入/替换到 go.components[component_type].keyFrames[prop_name] 的有序数组中（按 frame 升序），并返回 ok:true。若无对应 GO 或组件，返回 ok:false 并带错误信息。

2. 事件发布
  - 在写入成功后，内核必须立即发出事件，至少包含两种：
    a) 单点事件： keyframe/{go_id}/{component}/{prop} -> { action: 'set', frame, go_id, component_type, prop_name }
    b) 汇总事件： keyframe -> { action: 'set', go_id, component_type, prop_name }
  - 事件格式应兼容现有 JS stub（kernel-wasm/index.js 中发布模式），以免上层适配器额外改动。

3. 持久化
  - save_project_bytes() 返回的数据必须包含 components 的 keyFrames 字段（现有序列化实现需包含这些字段）。
  - load_project_bytes() 在加载时，正确恢复 keyFrames 数据并发布 'project' 或 'keyframe' 加载事件以触发前端渲染刷新（可在加载结束后发出 project loaded 事件）。

4. 边界与错误处理
  - 重复 keyframe（相同 frame）应覆盖 if payload 中包含 value 或 easing，否则保留已有值。
  - 非法 payload（缺少 go id、component 等）应返回明确的 error 字段并不修改内存状态。

验收标准
- 单元测试：为 SetKeyFrame 命令添加单元测试，覆盖新增、替换、越界 frame、无 GO 情形。
- 集成场景验证：在内存内创建一个 GameObject，调用 SetKeyFrame 后能通过 Query（GetInterpolatedProps/GetCurrentScene）看到 keyframe 生效，并且事件流向订阅者（subscribe_js）能接收到 keyframe 事件。

参考实现线索
- 前端调用点：KernelBridge.setKeyframe, packages/hh-engine/src/core/KernelBridge.ts -> dispatch({ SetKeyFrame: ... })
- JS stub: packages/kernel-wasm/index.js 已实现 SetKeyFrame（可参考逻辑），但 Rust 内核实现需与之保持一致。

优先级: 高
负责人: hh-kernel 团队（或负责内核实现的 AI 任务执行者）

备注: 在实现前，请先查看当前的 kernel-proto/proto/commands.proto 中的 SetKeyFrameCmd 定义，确认字段匹配前端发送的结构。若需要调整字段命名或 payload 形状，请在实现任务中说明向前端的最小变更方案。