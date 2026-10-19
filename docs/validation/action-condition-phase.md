# 动作接受相位与起手生命条件命中组

本增量为真实久岐忍 Q 提供有限的通用声明能力。没有改变未选择相位的旧动作顺序，没有用初始 HP 推测 Q 命中数，也没有增加独立生命池。固定来源仍为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。

## 相位来源及范围

`pkg/core/core.go` 的 `Core.Tick` 依次运行 Combat、Constructs、Player、Tasks；`pkg/simulation/run.go` 随后进入接受并执行动作的阶段。已存在的当帧草轮治疗、收球必须先于 Q 的资格检查、生命取样和快照。`pkg/core/task/task.go` 同时明确标注 delay<=0 的行为尚不一致、不同任务队列有各自顺序；本实现不把一个新优先级宣称为上游所有队列语义的完整复制。

当前版本的每个 `ActionDefinition` / `AbilityDefinition` 可显式选择 `actionPhase: "after-frame-tasks-v1"`。已有当帧事件按原优先级执行，选中的动作在优先级8接受；该动作产生的同帧零延迟事件使用原事件优先级+10，连带的同帧后续事件保持在该相位。未来帧事件恢复原优先级。事件序号继续来自同一个真实队列。因此当帧既有治疗 priority2 与动作自产生命效果 priority12 可以明确区分。未声明的动作仍保持 priority0。

这是一份明确的“已有当帧任务→动作接受→动作自产当帧效果”合同，不是任意 gcsim `AddTask(0)` 复制模式。新相位也没有开启未实现的连续动作、真实死亡或全局来源队列能力。

## 起手条件与解释

`conditionalHitGroups` 的单组声明包含 `id`、`kind: "owner-hp-at-action-v1"`、`comparison: "lte"`、`thresholdRatio`、`hitIds`、`sourceRefs`。条件只控制列出的命中；前七个 Q 命中可以不绑定组，后五个绑定50%阈值。组内命中使用明确的 `snapshot: "action"`。条件只在动作已通过能量资格、被接受后，从共享生命池读取真实 owner HP/maxHP；其自身零延迟生命变化还未执行。判断一次锁定，后续治疗不能增加或撤销该次 Q 的命中。

`action-condition.ts` 通过共享 TraceBuilder 实际计算 `threshold = ownerMaxHp * thresholdRatio`，再执行 `ownerCurrentHp <= threshold ? 1 : 0`。`result.actionConditionLog` 记录实际动作索引、拥有者、条件组、帧／优先级／序号、真实生命输入、选择结果、命中 ID 及 AST。能量失败的动作没有决策日志、命中或扣能。`energyCostFrame: 4` 继续使用已有的接受时预留与第4帧真实扣除。

计算器桥接通过实际 actor/action/cycle 对应的 actionLog 索引关联同一次决策。前七个无条件命中和被选中的后五个命中都会展示同一起手的真实判断 AST；完整捕获文件保留源结果和上下文，UI 不根据当前 HP 重算分支。

Schema 独立读取已审计的 HP 时间线恢复动作前状态，验证条件判断、声明、命中纳入／排除、生命效果、粒子与能量时序。新输入与日志仅属于当前1.53，旧版本拒绝接受；旧未配置结果不新增决策日志。

## 有限验证

只新增并运行 `packages/sim-core/src/__tests__/action-condition-phase.test.ts` 的三个集成用例。上一增量五个核心／来源用例和浏览器不在此重复运行，没有运行全套测试、构建或 Monte Carlo。

1. 真实旧任务在第10帧先治疗4500→6000，并接收一枚同元素微粒使57能量→60。声明后置相位的 Q 在 priority8 接受，锁定条件 false，只安排7击；自身合成耗血仍在同帧 priority12 执行，6000→3500，不回头改变决策。能量接受时预留、第14帧扣60。捕获第一个基础命中在独立计算器差值0，前缀含真实条件两个AST节点，每个AST实际重算等于记录值；完整JSON重跑的条件日志相等。
2. 起手恰好5000/10000时选择 true，12击被锁定；第11帧治疗至6500没有缩短已接受的 Q。末击为第247帧，仍使用 action snapshot。末个条件命中计算器差值0且携带同次5000HP条件；篡改 selected 后结果schema拒绝。
3. 移除 actionPhase 时，原 priority0 的 Q 在同帧收球前仍因57/60能量不足失败，保持旧顺序；显式后置相位但初始能量0时，即使当帧先收3能量也真实失败。两种失败均没有条件决策、Q命中、自耗血或扣能。旧1.52输入以及显式 legacy 秒时钟拒绝新扩展。

首次命令：`npx vitest run packages/sim-core/src/__tests__/action-condition-phase.test.ts`，3例均在配置校验失败：合成fixture遗漏 HP 模型要求的显式定位敌人。耗时880ms、tests22ms，保留 `action-condition-phase-test.log/.exit`。补充 fixture 的 enemy-0 位置后重跑同3个失败例，3例通过，1.07s、tests273ms；`action-condition-phase-test-retry.log/.exit`。没有因首轮失败修改生产实现，也没有扩大测试范围。

来源动作构造器的两例、外部 gcsim 样本、浏览器和统一构建由对应报告记录；本页不能替代那些结果。

## 未实现范围

相位状态和锁定命中组尚未完整导出到 phase checkpoint，本配置明确阻塞稳态证明。原有普通 healthChanges 的确定性检查点支持保持不变。动态最大 HP、生命之契／HPDebt、真正死亡和未声明生命被动继续不支持。久岐忍来源 Q 的系数、有效命中数、冷却、动画与同帧外部对照由来源契约报告单独记录，不能用本合成测试替代。
