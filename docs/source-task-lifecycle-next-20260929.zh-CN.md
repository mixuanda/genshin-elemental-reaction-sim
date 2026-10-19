# 原生任务队列生命周期：下一批执行设计（2026-09-29）

> 状态更新：本设计的真实 `Task.Handler` 排队账本已在 [100 批报告](source-task-lifecycle-20260929.zh-CN.md)交付。以下作为实施边界与后续缺口记录，不再表示本批待实施。

## 目标

为固定 b4／a7 来源中的延迟任务补充通用可见性：记录真实排队、开始执行、完成，以及观察窗结束时仍排队的任务。此批解决的是已观察技能后续工作能否追踪的问题，不补角色伤害公式，也不把任务账本直接当成完整施放证明。

## 已有基础与当前限制

088–090 已记录接受动作、攻击来源关系和按 `dispatchId + attackId + targetKey` 关联的逐目标结果；共享层能重放并编辑已记录命中。092 又为核心攻击的延迟 snapshot 与 application 两个 `Tasks.Add` 写点加入 pending 阶段回执。完整单击公式解释与原生执行生命周期是不同层：已有命中的计算可被共享核心重放，但未观察到的后续任务、目标机会和实体结束状态不能由公式解释补出。当前动作集合的 `completeCast` 仍固定为 `false`。

候选实施入口：固定源码 `pkg/core/task/task.go` 的 `Handler.Add`、`Run`；角色队列包装 `pkg/core/player/character/hitlag.go` 的 `QueueCharTask`；敌人队列包装 `pkg/enemy/hitlag.go` 的 `QueueEnemyTask`；来源记录与导出可沿用 `pkg/core/info/sourcehost_origin.go`、`pkg/core/sourcehost/attack_pending.go`、`pkg/core/sourcehost/bridge.go`。工作区已有对应基础见 `packages/source-host/patches/088-action-origin.patch`、`089-attack-observation.patch`、`090-origin-phase-observation.patch`、`092-status-lifecycle-and-pending-attacks.patch`，以及 `packages/sim-core/src/source-host-action-origin.ts`、`source-host-action-collection.ts` 和 `source-host-wire.ts`。

任务队列不是单一全局时间线。core、character、enemy 分别持有队列和本地时钟；调度顺序也各自保留。当前 core 与 character 队列绑定动作来源 tracker，enemy 队列没有该关联。`QueueCharTask` 与 `QueueEnemyTask` 的零延迟分支直接调用回调，不经过 heap；仅盘点 heap 会漏掉同步工作。enemy 死亡后不再 tick，留在其 heap 中的任务仍是 pending。当前没有通用 cancel API：冷却回调运行后发现条件不满足并直接返回，记作 completed，不应伪记为 cancelled。

## 建议批次行为

在每个真实队列边界记录运行内全局 `taskId` 与 `queueId`、队列所有者、父任务、该队列本地排队时钟与到期时钟、已有来源关联，以及 queued、run、completed 或观察终点 pending 状态。`QueueCharTask`／`QueueEnemyTask` 的同步 `delay=0` 分支直接执行且不进入 heap，因此不属本批 Handler 账本；后续若记录，应单独标为同步执行。普通 core `Handler.Add(delay=0)` 仍入 heap并可记录。core、character、enemy时钟分别保存；不能把角色／敌人队列clock强行换算成全局frame，core本样本队列使用全局帧计数。按来源需要的帧映射若不可证实，保留未知。

所有状态均来自实际队列 push、pop 与回调边界。无 cancel API 时不生成 cancelled 状态。只观察到回调开始、没有完整结束回调时，不伪记 completed。enemy 死亡时保留该队列中的实际 pending 任务，并明确其本地时钟已停止推进。既有 AttackID／dispatchID 分配点保持原样；队列 ID 是任务身份，不替代攻击身份。

## 完整性边界

本批先交付“任务确实在队列中、何时运行、窗尾是否仍 pending”的账本可见性。即使三个 heap 都为空，也不能单独把 `completeCast` 提升为 true：来源事件 hook、未排队的同步回调、持续实体、敌人目标机会、窗后触发和尚未绑定动作来源的任务可能仍未闭合。`completeCast` 只能在另有完整机会／实体终止证据、所有相关来源均能归属到动作且观察窗定义充分时，由后续独立逻辑判定；第一批保持 false 是正确行为。

这些记录只证明固定来源执行器本次运行的队列事实，不证明游戏内实际时序。未观测的创建来源、任务后代和实体寿命保持未知，不补帧数、命中次数、完成事件或游戏规则。

## 相关报告

- [原生动作来源链与观察命中集合](source-action-origin-20260929.zh-CN.md)
- [固定来源动作机会与派发关联](source-action-opportunities-20260929.zh-CN.md)
- [状态生命周期与动作语义及 092 当前范围](source-lifecycle-and-action-semantics-20260929.zh-CN.md)
