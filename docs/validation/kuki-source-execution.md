# 久岐忍 E/Q 来源执行校验：失败 Q 不占用后续动作

2026-09-24。此修复对应已确认的前置来源校验路径，不重做上一轮 E/Q 机制测试。

## 问题与最小修复

通用 `simulateLegalTimeline` 原本已逐命令探测能量，并将失败记录传回最终合法轮转编译；失败分支在建立该动作冷却、动画占用、行动状态之前返回。新 E/Q 来源契约却在这个流程前调用不带能量失败记录的全量 `compileLegalTimeline` 来检查换人冷却。因而本该失败的 Q 被先当成成功：例如初能0、Q564、切安柏565，会被错误的 Q 动画占用至626挡住。

现在前置来源校验只核实固定身份、面板、能力与允许的指令；新的 `assertSourceActionExecution(config, execution)` 使用能量处理完成后同一次最终编译的 `TimelineExecution` 验证来源60帧换人冷却。`simulateLegalTimeline` 自动调用该 hook，不新建排期，也不让 UI 自己推断失败动作。真实成功 Q 的取消窗继续由原合法编译器执行。旧 E-only 契约未修改。

公开 API 从 sim-core 导出 `assertSourceActionExecution(SimConfig, TimelineExecution): void`；常规调用者直接使用 `simulate`，不需要额外调用。前置 `validateSourceBackedActionSequence` 的 valid 仅表明静态契约匹配，不代替实际能量与动作时序验证。

## 唯一新增验证

仅新增 `packages/sim-core/src/__tests__/kuki-source-execution.test.ts` 的一个集成用例，执行命令两次：

`npx vitest run packages/sim-core/src/__tests__/kuki-source-execution.test.ts`

- 修复前 red：1失败，842ms，总测试4ms；初能0、Q564后swap565的静态来源判定实际为 invalid。日志 `kuki-source-execution-red.log/.exit`，退出1。
- 修复后 green：1通过，1.13s，总测试336ms。日志 `kuki-source-execution-test.log/.exit`，退出0。

同一用例实测：Q564不足能拒绝后，swap565→566正常执行；Q564/565连续不足能均拒绝、不占冷却，随后swap566→567正常。两种情形无Q条件决策和扣能；第一种完整JSON结果通过schema。初能60的真实成功Q后，swap565仍因动画占用至626而拒绝。初能0的失败Q后，真实swap565→566再在600换回仍因未达到成功换人后的60帧冷却而拒绝。

没有运行旧 E/Q 测试矩阵、全套、构建或 Monte Carlo；UI预览和对应浏览器路径由主任务另行记录。

## 与固定来源的明确差异

固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `Player.ReadyCheck` 先检查能量／冷却／动画；失败不调用 `Burst`，因此不建立Q冷却和动画。`simulation/run.go` 的默认脚本请求会每帧等待直到可执行。本地当前采用明确的一次请求：不足能时记录拒绝并继续后续指令。本次修复保持该本地语义，不把它宣称为 gcsim 的自动等待队列，也不新增等待能量、自动重试或超时策略。
