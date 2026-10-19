# 2026-09-29：状态生命周期与动作语义

本批补上两条固定来源通道的状态实例终态、观察窗结束时仍排队的核心攻击任务，以及桑多涅两类普通冰伤的辉映分支修正。独立单击／单技能计算器继续作为公开功能保留；观察式命中集合仍通过同一个计算核心重放、编辑和保存。完整项目 goal 保持 active。

## 工作基线

继续使用 `/Users/evan/Documents/gidps` 已有工作树，HEAD 为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，保留已有未提交工作。本批未提交、推送、部署、运行远端 CI 或重新抓取游戏数据。原始输入和先前基线审计沿用已有记录；本批以两条通道的不可变 [classic 基线](validation/action-origin-baseline-classic-20260929.capture.json)／[stellar 基线](validation/action-origin-baseline-stellar-20260929.capture.json)核对玩法结果。

## 实际实现

两条通道新增 `092-status-lifecycle-and-pending-attacks.patch`。真实 `AddStatus` 记录初始到期帧与来源库实际返回的覆盖标志；同键替换、显式移除读取被操作的实际 Status 对象。模拟结束后再读取仍保留对象的最终到期帧，因此能保留来源实现中的命中僵直延长，不按初始时长猜测终态。终态分为被替换、已移除、终点时已过期、终点时仍活动，以及未能观察到终态。替换可记录后继实例编号。

“终点时已过期”是最后一次观察的分类，不是精确的自然过期时间。到期恰等于当前帧时，是否有效与是否算覆盖仍分别服从来源的两种判断。创建回调、触发动作、状态激活来源继续分别保存，不借这些关联改写伤害归属。

核心 `QueueAttack` 的延迟快照，以及 `queueDmg` 的延迟应用，这两个真实 `Tasks.Add` 写点现在会登记任务；回调真正开始时移除。观察窗结束时输出剩余任务的阶段编号、排队帧、到期帧、可用攻击编号和来源关联。阶段编号独立于攻击编号，原生 AttackID 的分配时点不变。该账本不是通过“没有命中”推断未来事件。

共享 wire、重执行比较和动作命中集合保存 `lifecycleObservationFrame`、`statusInstances`、`pendingAttackStages`。集合按原生创建／触发／状态来源筛选关联数据，并在 JSON 导出导入中保留。页面同时在来源结果和独立命中集合中展示；没有结算伤害也可查看待处理任务。每类表格最多显示 200 行，完整 JSON 不截断。旧文件没有账本时显示“未记录”，不冒充空账本。

桑多涅 C0 的普通扫射与超载射击不再被辉映状态一概阻塞：固定 Optimizer 源码把它们定义为普通冰伤，辉映替换门针对凝聚光束。实际模式、接触目标、热量与来源分量绑定仍照常参与计算，凝聚光束的特殊替代规则不变；没有补造攻击次数、间隔或完整窗口。来源依据、具体文件与测试见[专门说明](sandrone-radiant-ordinary-20260929.zh-CN.md)。教学示例中原来暗示辉映扫射不支持的文字也已同步修正。

主要代码入口：

- 原生：两通道 `patches/092-status-lifecycle-and-pending-attacks.patch`、`go/pkg/core/sourcehost/{bridge,status_lifecycle,attack_pending}.go`、`go/cmd/sourcehost/main.go`，以及 stellar 补丁列表。
- 共享：`packages/sim-core/src/source-host-action-origin.ts`、`source-host-wire.ts`、`source-host-action-collection.ts`、`source-host-reexecution.ts`。
- 页面：`apps/web/src/source-host-lifecycle-view.ts`、`source-host-origin-panel.ts`、`source-host-action-calculator.ts`、`calculator-observed-composition-examples.ts`。
- 条件计算：`packages/sim-core/src/sandrone-observed-lifecycle.ts`、`packages/game-data/src/character-mappings/optimizer-additional-mappings.ts`。

## 必要检查与测量

本批只运行受改动影响的核心检查、两个原生构建、Web 构建和一个聚合页面用例，没有扩大逐角色测试矩阵。全部实际命令与时间见[总回执](validation/lifecycle-measurements-20260929.json)，页面数值见[页面结果](validation/lifecycle-browser-20260929.result.json)。

| 检查 | 结果 |
| --- | --- |
| 命中集合核心测试 | 3/3；测试 258 ms，runner 1.00 s，命令 1.688 s |
| 桑多涅观察式分支测试 | 3/3；runner 10.01 s，命令约 11.32 s；详见专门回执 |
| 经典来源构建 | 通过，14.601 s；WASM 43,485,058 字节 |
| 星辉来源构建 | 通过，15.194 s；WASM 65,604,093 字节 |
| Web 类型检查和构建 | 修正可选属性类型后通过，8.718 s；Vite 1.85 s |
| 一个聚合页面用例 | 通过；用例 9.0 s、runner 10.4 s、命令 11.089 s；`pageErrors=[]` |

首次 Web 构建因 UI helper 的可选字段类型未允许显式 `undefined` 而失败，6.581 s；修正 `exactOptionalPropertyTypes` 对应类型后只做了必要重建。失败日志保留。最终构建仍有原有动态／静态导入和 chunk 大小提示。

两条来源的 12 秒、seed 11 样本各记录 38 次伤害应用；与不可变基线比较，计算数值、命中、能量、治疗、玩家受击／扣血和原生结果保持一致。比较忽略本次新增来源元数据，并仅对 Go map 导出的最终反应状态按语义排序，实际事件数组不重排。

| 实测内容 | 每条通道的结果 |
| --- | --- |
| 生命周期观察帧 | 720 |
| 状态实例 | 22：仍活动 4、被替换 12、终点已过期 6 |
| 12 秒终点仍排队的核心攻击阶段 | 0 |
| 状态关联的 6 击原始公式合计 | 2403.863077651348；共享计算器重放差 0 |
| E 创建链 2 击原始公式合计 | 1966.0871939310314；共享计算器重放差 0 |
| 页面编辑并排除末击后的合计 | 2136.111260020432；JSON 恢复相同 |

另在同一页面用例中把温迪 E 的来源观察窗截断到 0.5 秒。两条通道都在第 30 帧停止、尚无已结算伤害，并留下一个真实 application 任务：阶段编号 1，排队帧 1，到期帧 52，攻击编号 1，创建／触发动作均为 1。页面实际显示此任务，证明当前入口可以区分“窗口内无伤害”和“攻击尚待执行”。没有为此增加独立角色测试矩阵。

完整运行捕获保存为 [classic](validation/lifecycle-classic-20260929.capture.json) 和 [stellar](validation/lifecycle-stellar-20260929.capture.json)。执行产物 SHA-256：

- classic：`ad3b673122ada0e792f060d2482a9a7f74c9a2934b603559ce7191d6140e1dcc`。
- stellar：`7b57fdd9b1e948eee832964ba567a7b283f0c7facf3f8cfac33b6483e24f4025`。

## 当前范围与剩余缺口

任务账本仅覆盖上述两个核心攻击排队点，不盘点所有角色任务、实体、循环回调或攻击机会。pending 为零不能证明完整施放；本批没有抽样显式 removed／unknown 状态分支或正延迟 snapshot 分支，也不声称游戏内验证完成。状态关联命中集合仍是 `observed-action-hits`。

数据指针保持不变：`pointers.json` SHA-256 为 `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`，运行时选择模块为 `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045`。本批不修改活动／preview 选择，不提升 24 个 partial 动作的分类，不增加正式 verified 数量。已有每角色小毕业／大毕业参考配装、武器圣遗物编辑、GOOD／公开展柜导入和可视化轮转继续保留；本批没有重跑这些已交付功能的历史测试。

下一项通用实现已完成只读源码审计：[基础面板来源方案](source-panel-provenance-next-20260929.zh-CN.md)。共享命中公式已能展示实际代入和中间值，但初始面板中作者输入、角色等级曲线／晋升、武器等级曲线／晋升仍需在原生真实构造点发出逐项配方，不能反推来源。该方案当前是待实施项。后续还需补齐更多实体的完整生命周期、剩余条件动作所需的真实观察输入、私有状态解释，以及远端更新运行和独立机制证据；这些缺口保留在总目标中。
