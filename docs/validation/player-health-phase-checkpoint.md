# 确定性治疗/生命消耗的完整周期状态

本增量接续 [生命执行报告](player-health-runtime.md)：原先对所有 `healthChanges` 配置的周期证明阻塞，已改为支持其真实完整待执行队列。仍限固定最大生命、明确动作治疗/消耗、无附着/反应私有状态、无随机执行的既有确定性范围。

## 实际变更

`phase-checkpoint.ts` 直接遍历模拟器 `queue.snapshot()`。新增的 `healthChange` 分支使用实际 `actionLogIndex` 找回已接受动作，核对来源角色、完整生命变化定义、优先级 2、实际施放帧与到期帧。检查点记录：

- `type = healthChange`、相对到期帧 `remainingTicks` 与真实队列优先级。
- `sourceActorId`、归一化 `sourceActionId`、相对施放年龄 `actionAgeTicks`。
- 完整 `change`：ID、标签、目标规则、来源、偏移帧、操作、固定/比例基数、数值、治疗加成或最低生命比例。

主队列既有的按帧、优先级、FIFO 序号排序保持不变；`pendingEvents.inFlight` 的数组顺序保留同帧执行先后，相同事件也不会被集合去重。只去除施放次数造成的绝对 `actionLogIndex`、编译命令编号和队列序号；不会把 `active` 目标提前冻结成边界时角色，实际目标仍在事件执行时由已捕获的角色状态决定。

HP 来源仍是实际 `playerHpStateByActorId`，`resourcesAndHp.hp` 保留当前生命、最大生命、角色与既有零生命状态。累计治疗、消耗、伤害和日志计数只影响报表，不决定后续执行，因此不会加入周期状态导致永不收敛。没有第二套 HP 池、重建排期或合成检查点。

`simulation-analysis.ts` 的旧式 rotation 与合法时间线 ability 两条真实启动路径，均把 `healthChanges.frameOffset` 纳入模拟尾段长度。检查点生产器同样把它纳入既有最大延迟完整性检查：若模拟末尾不足以容纳边界前已施放的生命任务，拒绝证明，不能因为主队列在终点截断就认定没有待执行事件。

只有运行时确有已接受动作、HP 状态和完整队列输入时才解除生命动作的能力阻塞。附着引擎、反应/结晶实体、目标局部时钟、插件、随机暴击、普通攻击随机回能和西风私有状态等原有阻塞保留。未使用生命动作的旧检查点结构不新增字段。检查点 schema 仍只验证外形；完整性来自实际 producer 和下述执行证据，不能把 schema 通过当作独立重放证明。

## 实际检查与测量

新增 `player-health-phase-checkpoint.test.ts` 共 3 项；仅另外复验既有生命测试中直接受阻塞原因变化影响的 1 项。

1. `npx vitest run packages/sim-core/src/__tests__/player-health-phase-checkpoint.test.ts packages/sim-core/src/__tests__/player-health-runtime.test.ts -t 'complete deterministic health phase checkpoints|executes delayed healing'`
   - 首次 3 通过、1 失败、2 跳过；总 1.22 s，测试 223 ms。
   - 失败来自新增 Aura 合成 fixture：Aura 模型原本就要求合法时间线，fixture 却使用旧式 rotation。没有进入该断言要观察的检查点。
   - [原始日志](player-health-phase-test.log)，退出码 1。
2. 将 Aura fixture 改为既有合法时间线后，仅运行失败项：`npx vitest run packages/sim-core/src/__tests__/player-health-phase-checkpoint.test.ts -t 'refuses truncated tails'`
   - 1 通过、2 跳过；总 853 ms，测试 83 ms。
   - [定点复验日志](player-health-phase-targeted.log)，退出码 0。

未运行旧全集、构建、浏览器检查或性能基准。本专项不声称父任务的后续构建结果。

实测一：每 120 帧在相位 1 施放一次动作，固定消耗 1000 HP 延迟 390 帧、固定治疗 1000 HP 延迟 391 帧；最大生命 10000、起始 5000。9 个周期预热后，实际连续模拟建立周期 1。观察窗为 `[1080,1200)`，真实模拟终点为 1471（1080 + 391），超过默认两周期尾段。每个所采边界 HP = 5000，完整状态逐项相同。最后边界的真实 pending 队列包含六项：

| 相对到期帧 | 来源动作年龄 | 操作 |
| --- | --- | --- |
| 31 | 359 | 消耗 |
| 32 | 359 | 治疗 |
| 151 | 239 | 消耗 |
| 152 | 239 | 治疗 |
| 271 | 119 | 消耗 |
| 272 | 119 | 治疗 |

合法时间线及旧式重复 rotation 均实际运行并建立相同周期；规范化生命队列一致。观察窗普通物理命中 427.5，周期 DPS 213.75；生命变化未加到敌人伤害。观察窗结束后仍有真实生命事件执行，尾段没有被当作观察窗口伤害。

实测二：两次真实独立模拟只交换同帧消耗与治疗的声明顺序，起始 HP 均为 10000。第 120 帧 HP 相同，但实际队列分别保存“消耗→治疗”和“治疗→消耗”，检查点状态不相等。第 391 帧事件前，两项待执行任务的 `remainingTicks` 均为 0，HP 仍是 10000；之后前者为 10000→9000→10000，后者为 10000→10000→9000。第 480 帧实际状态因此不同。没有篡改快照或拼接合成轨迹来制造差异。

实测三：12 秒模拟在第 600 帧请求边界、仍含最长 391 帧生命延迟时，拒绝输出该检查点并明确指出尾段截断。开启 Aura 的真实配置仍不能建立完整检查点。移除生命动作的实际运行不输出 `playerHealthEvents`，HP/队列检查点保持原有结构。

## 尚未覆盖

这是确定性生命动作队列的完整状态支持，不是所有角色生命机制完成。生命之契、动态最大生命、真正死亡/复活、HP 依赖被动或伤害转换、治疗/消耗触发回调、敌人攻击、角色卡肉重定时和自动技能生命参数仍沿用上一报告的未实现边界。加入附着或随机机制后，不能用本次确定性周期证据提升为完整稳态。该证明也仍是现有有限提供输入范围的周期证明。
