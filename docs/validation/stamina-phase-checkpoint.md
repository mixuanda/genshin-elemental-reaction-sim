# 共享体力完整相位检查点与连续稳态

2026-09-24（香港时间）。本次关闭 [体力运行时首次实现](stamina-runtime.md) 中明确保留的“体力未纳入完整周期检查点”缺口，范围仍是显式选择的 `shared-stamina-v1` 固定来源模型。角色费用、动态减耗、特殊移动等未实现机制不因本次工作升级为完整或官方验证。

## 实際变化

`StaminaRuntime.captureBefore(tick)` 先真实执行严格早于 `tick` 的玩家恢复帧和延迟扣除任务，再返回独立快照；不是从轮转编译器或最终日志拼出体力。该帧本身的恢复、到期扣除、行动输入都尚未执行，符合现有检查点“所有边界事件之前”的约定。

原有 v2 九个状态维度保持兼容；启用体力时添加明确版本 `shared-stamina-state-v1` 的资源子状态。未选择体力模型时，原状态形状没有新体力字段。

- `resourcesAndHp.stamina`：模型版本和来源 profile、上限、实际共享量、距离首次允许恢复的相对帧数、实际恢复基线和已累计恢复帧数。满池时将已无未来影响的旧恢复基线规范为上限和零累计帧，避免仅历史年龄不同阻止等价相位收敛。
- `pendingEvents.stamina`：明确玩家恢复、延迟扣除、输入的顺序，以及全部尚未执行的扣费任务。每项保存距离执行帧数、距离实际输入帧数、费用、角色、实际费用来源、显式零费用调用标志、队列相对顺序和实际接受命令的完整定义。
- 原始运行时快照仍保存输入帧、到期帧、入队顺序、原始命令索引及动作 ID。相位比较去掉只作审计身份的绝对编号，保留命令定义、相对时钟和队列顺序，避免每个周期生成的新编号造成虚假差异。
- 待扣费任务必须能对应本次实际接受的动作及费用声明。没有实际体力状态的独立检查点调用继续保留能力阻塞；没有删除保护后填一个默认空池。
- 连续预热额外尾段计算现在覆盖普通编译动作、技能以及移动声明中的延迟体力扣除。仍要求足够未来输入周期，仍拒绝末尾截断的在途状态。

实际修改文件：`packages/sim-core/src/stamina.ts`、`phase-checkpoint.ts`、`simulator.ts`、`simulation-analysis.ts`；新增 `stamina-phase-checkpoint.test.ts`，并同步旧 `stamina-runtime.test.ts` 一项过时的阻塞原因断言。无需改变既有 JSON 的顶层 schema 版本；执行检查点的九维 JSON 状态原本允许版本化子状态。

## 实测结果

合成夹具仅验证通用体力资源，并非真实角色费用宣称：120 帧周期，初始240体力，每周期第1帧行动，12.5体力延迟150帧扣除；9个真实连续预热周期。扣除间隔120帧，其中90帧不能恢复、30帧恢复，`30 × 25 / 60 = 12.5`，恰好补回一次费用。

- 实际建立周期1。相位边界共享量227.5，下次允许恢复还需2帧，在途扣费还需31帧，来源输入距边界119帧；连续检查点的完整状态相等。
- 两秒观察窗伤害427.5、DPS213.75。手算为 `1000 × 1 × 190/(190+210) × 0.9 = 427.5`，每周期一次命中。
- 将延迟费用改为390帧（超过默认两周期240帧尾段）后仍建立周期1；真实运行长度为 `1080 + 390 = 1470` 帧，观察窗结束仍为1200帧。末预热边界保留三项实际在途扣费，剩余31、151、271帧，对应输入年龄359、239、119帧，相对顺序0、1、2；DPS仍为213.75。
- 相同共享量100，但实际恢复时钟剩21或31帧，不能被当成相同相位。
- 相同共享量 `100 + 29 × 25/60 = 112.08333333333333`，但实际待扣帧不同，不能被当成相同相位。
- `captureBefore(150)` 保留F150尚未发生的恢复和扣除：当前量 `100 + 59 × 25/60`、待扣任务仍在；执行F150后体力112.5，之前取得的快照不被修改。

上述两个“不相同”用例将实际运行时快照的单一资源维度放入真实完整检查点，以隔离比较器敏感性；测试结论明确是“完整状态比较不能忽略该维度”，不将混合后的检查点声称为另一条完整模拟轨迹。正例及长尾例来自真实连续模拟。

## 执行检查（全部退出码0）

| 命令与范围 | 实际结果 | 原始记录 |
|---|---|---|
| `npx vitest run packages/sim-core/src/__tests__/stamina-phase-checkpoint.test.ts` | 新增3项首次全通过；833ms，测试46ms | [日志](stamina-phase-checkpoint-test.log) / [退出码](stamina-phase-checkpoint-test.exit) |
| `npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts -t 'rejects only'` | 1通过、2跳过；900ms，测试103ms | [日志](stamina-phase-checkpoint-existing-followup.log) / [退出码](stamina-phase-checkpoint-existing-followup.exit) |
| `npx vitest run packages/sim-core/src/__tests__/stamina-phase-checkpoint.test.ts -t 'establishes a continuous'` | 补充>两周期长尾分支后仅复验首项；1通过、2跳过；834ms，测试54ms | [日志](stamina-phase-checkpoint-tail-followup.log) / [退出码](stamina-phase-checkpoint-tail-followup.exit) |
| `npx vitest run packages/sim-core/src/__tests__/phase-checkpoint-runtime-state.test.ts -t 'establishes a real legal periodic'` | 旧无体力模型的真实连续召唤/扣能/转换相位回归，1通过、2跳过；832ms，测试89ms | [日志](stamina-phase-checkpoint-legacy-followup.log) / [退出码](stamina-phase-checkpoint-legacy-followup.exit) |

旧耐力测试中的短观察窗依然不能建立完整检查点，原因改为实际的尾段不足；不再错误报告体力本身未导出。没有运行旧测试全集、全局构建、浏览器检查、性能或随机大样本。本次沿用之前已核对的四份固定来源及SHA-256，没有重新整套抓取或声称新增外部 gcsim 结果对照。

## 仍保留的边界

仅可对固定声明费用、确定性执行、完整受支持九维状态及有限提供的周期输入成立。附着/目标时钟私有状态、插件、随机普攻回能、西风随机流等原有阻塞仍存在；随机模拟不能据此用逐周期相等建立稳态。真实角色费用与减耗机制、特殊移动以及外部跨模拟器体力结果对照仍不在这次完成范围。
