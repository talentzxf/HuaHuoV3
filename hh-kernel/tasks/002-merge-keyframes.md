标题: Merge KeyFrame 操作无效果（在 IDE 中合并 keyframes 后内核未进行合并/更新）

背景和症状
- 在 Timeline 面板中选择多个 keyframe 或一个 clip 后点击“Merge KeyFrame”操作，UI 没有观察到 keyframe 合并（timeline 未更新、kernel 状态未改变）。
- 前端发出合并请求的路径可能只是触发了本地 UI 事件或 requestCanvasRefresh()，但没有向内核发送合并命令（例如 MergeKeyFrames / MergeTimelineClips 之类），或内核收到命令后未正确更新 keyframes 数组/触发事件。

目标
- 为 Merge KeyFrame 操作在内核端添加明确命令与实现，使其在接收到合并请求时：
  1. 在指定 layer/GO/component/prop 上合并指定时间范围内的 keyframes 为单一 keyframe（合并策略见下）；
  2. 更新内存状态并持久化；
  3. 发布 keyframe 与 layer 相关事件以触发前端刷新与 timeline 重绘；
  4. 返回命令结果，告知成功或失败信息。

合并策略（建议）
- 输入： layer_id 或 game_object_id、component_type、prop_name、start_frame、end_frame、merge_strategy
- 默认 merge_strategy: 'keep_first'（保留时间范围内的第一个 keyframe），其它可选：'keep_last'、'average'（对数值属性做线性平均）、'custom'（保留 caller 指定的值）。
- 行为：找到所有位于 [start_frame, end_frame] 的 keyframes，计算合并值并替换为单个 keyframe（frame = start_frame 或 caller 指定 frame）。

命令定义
- 名称建议： MergeKeyFrames / MergeTimelineClip
- Payload 示例：
  { "MergeKeyFrames": { "game_object_id": "go_123", "component_type": "Transform", "prop_name": "position", "start_frame": 10, "end_frame": 20, "strategy": "keep_first" } }

实现要点
1. 验证目标存在（GO、组件、prop）
2. 找出 keyframes 数组中匹配时间范围的索引，按策略计算合并值，替换数组片段为单一条目并保持数组按 frame 升序
3. 发布事件： keyframe/{go_id}/{component}/{prop} 与 keyframe
4. 在合并完成后，若合并影响 layer clip（timeline snippet），也发出 layer 变更事件。

验收标准
- 单元测试覆盖：无匹配 keyframe、单个匹配、多重匹配、数值合并策略（average）
- 集成测试：在 IDE 中选择并合并 keyframes 后，subscribe_js 的监听者能收到 keyframe 事件，Timeline UI 更新并显示预期结果

优先级: 高（影响编辑器的核心功能）
负责人: hh-kernel 团队（或负责内核实现的 AI 任务执行者）

备注
- 前端可能需要在调用合并命令后刷新本地视图（目前有 requestCanvasRefresh()）——但首要是让内核实际执行合并并发出事件。