# 普通 Aura 的 target-phase-v2 完整检查点增量

本轮在上一层实际 raw Aura / ICD / 伤害组捕获之上，接入 **target-phase-v2 且目标时钟关闭** 的真实运行状态。原生 aura-v8/v9 可以在已验证的普通元素闭合域内参与完整确定性周期检查，不修改其 Aura 版本或同帧调度。

## 实际实现

- 新增 `target-phase-checkpoint.ts`。`captureTargetPhaseV2State()` 只读复制真实 `scheduledTargetDecayKeys`、`completedTargetDecayKeys`、阶段运行态与快照，并读取实际最后处理事件帧。阶段运行态包括 `decayMaterialized`、`hasBeforeReactableInlineDelivery` 及 Aura 的任务前后、Reactable.Tick 前后快照。
- 检查点仍在主队列 `pop` 之前。只要当前边界帧已经执行事件、衰减或帧内交付，就拒绝将其标为“事件前状态”。没有推进 Aura、合成衰减任务或重建第二套队列。
- `normalizeTargetPhaseV2Checkpoint()` 对真实待执行 `targetDecay` 与真实去重键逐项双向匹配；缺任务、重复或越过模拟尾段都不能认证完整。主队列继续保存任务的真实 targetId、相对帧、priority 和 FIFO 顺序。
- 过去的阶段可能继续接收自然消退的审计补录；它们不会重跑过去帧的衰减。仅这些不再影响未来执行的历史阶段、已完成键，以及纯日志 ID / emitted 游标被排除在周期比较之外。未来仍有意义的快照与旗标保留。
- `AuraEngine.captureOrdinaryState()` 追加真实 `reactableTickModel` 和实际生命周期缓存。普通闭合域需要缓存没有特殊反应生命周期；不是因为表层 gauge 为空就假定内部为空。
- 新状态位于 `pendingEvents.targetPhase`，其 model 为 `target-phase-v2`。Aura 状态继续记录原始 mode（例如 `aura-v9`），并带 `cached-boundary-v2` 和真实生命周期缓存。旧 legacy target-task 检查点不添加这个字段。

普通闭合域仍按**全部声明输入**验证：普通持久元素单元素、水火或冰火（可有物理），包括目标初始 Aura、全部未编译能力、所有命中引用、默认属性拥有者元素及休眠附魔。其他反应生命周期、目标时钟、target-phase-v1/v3、特殊反应注入、插件、随机暴击、西风和其他未导出随机状态继续独立阻塞。没有声称所有元素反应均已完成。

## 实测和验证

只新增并执行一次 `packages/sim-core/src/__tests__/ordinary-aura-target-phase-checkpoint.test.ts`：**3 passed / 3，exit 0，总耗时 948 ms，其中测试 114 ms**。日志为 `ordinary-aura-target-phase-checkpoint.log`。没有运行旧全集、构建、类型检查或 Monte Carlo；由主任务统一做集成验证。

1. 原生 **aura-v9 + target-phase-v2 + clock disabled** 合成循环：Hydro@0、Pyro@108，每周期 120 帧；8 周期真实连续预热后，2 秒窗口总伤害 **1250**、DPS **625**、周期 **1**，`checkpointCoverage.complete=true`。结果配置仍为 aura-v9。实际水 gauge 为 `0.8 - 108 × 0.8/570 - 0.5`，物化年龄 12 帧；相位检查点相同。
2. 实际模拟第 29 帧命中前捕获水 gauge 0.8，第 30 帧捕获已经按第 29 帧 Reactable.Tick 衰减并被逆蒸发消耗的 gauge。另用真实 MinHeap 与 raw Aura 捕获构造明确的**合成未来阶段任务**：相同 gauge、不同 FIFO 不会被判同态；缺失目标衰减任务、已经处理当前帧的捕获都被拒绝。这一合成任务仅用于状态相等测试，不是宣称游戏内存在对应动作。
3. 尚未选择的雷能力仍使完整未来输入域阻塞；目标时钟、随机暴击和裁掉延迟任务的尾段继续不能认证稳态。

正常普通循环边界中，输出的 `scheduledDecay/completedDecay/phases` 可以为空：这是读取实际运行状态并排除仅剩的过去历史后的结果。数据不是占位空数组；合成待执行任务用例验证了非空任务和去重状态必须逐项对应。
