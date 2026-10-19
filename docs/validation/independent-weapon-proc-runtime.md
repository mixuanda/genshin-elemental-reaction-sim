# 三把独立武器追击：普通团队运行时

本增量把钺矛、苍纹角杯和冷寂迸音接入现有普通命中调度、伤害公式、执行审计及计算器捕获入口。不是在宿主命中上增加基础伤害，也不把合成测试角色标为已验证的完整角色。

后续更新（2026-09-24）：这三把的真实冷却、待执行快照及+1帧尾段现已进入确定性相位检查点，有限普通附着支持域已有真实连续周期证据，见 [检查点专项](weapon-proc-phase-checkpoint-core.md)。下文测试及“尚未导出检查点”的边界保留初次接入时点，不代表后续检查点增量仍未完成；无角色卡肉和普通伤害回调范围保持不变。

## 来源与实际规则

固定来源是 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 下的 `internal/weapons/spear/halberd/halberd.go`、`internal/weapons/catalyst/ashgraven/ashgraven.go`、`internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go` 以及状态到期规则。倍率、武器身份、冷却和半径由 `packages/reaction-formulas/src/independent-weapon-proc.ts` 统一提供，独立计算器和团队运行时共享。

- 钺矛只接受持有者明确的 `attackTag: normal`，不从动作名称或产球标签推断。固定源码没有额外前台或非零伤害要求。
- 两把生命值武器接受持有者前台的普通伤害回调，不额外筛选攻击标签或非零伤害。追击取触发时最大生命值。
- 钺矛冷却 600 帧；另外两把 900 帧。`triggerFrame + cooldownFrames` 当帧仍阻塞，下一帧才可再次触发。
- 追击在触发后 1 帧作为新的物理伤害事件执行。钺矛指向原目标；两把生命值武器以触发目标当时的真实位置为圆心，半径 3，用各目标的实际位置与体积判断命中。

配置必须显式声明武器、精炼与物理伤害加成，模式名是 `fixed-source-no-character-hitlag-v1`。`physicalDamageBonus` 仅是物理部分，与触发角色面板中的通用 `dmgBonus` 相加。追击不继承宿主命中的普攻/E/Q加成、暴击覆盖、防御无视覆盖或附魔。

## 实际接线

`IndependentWeaponProcRuntime` 保存每个持有者的真实冷却。模拟器在每次适用普通伤害回调后记录决定，将触发时角色面板和增益列表保存为快照，再使用现有 `scheduleActionHits` 调度独立 action/hit。没有另建伤害计算引擎。

`weaponProcLog` 记录来源、精炼、宿主事件、明确攻击标签、前台角色、冷却前后值和触发/阻塞理由。触发行另有快照、独立 action/hit 身份、落地帧、真实范围，以及关联的命中判断和伤害事件 ID。范围外目标保留 miss 判断，不能凭目标数制造额外伤害。独立伤害事件带 `weaponProcLogId` 和宿主 `parentDamageEventId`，自身暴击、敌人防御与物理抗性仍由普通共享核心结算。

追击也会进入普通伤害回调：钺矛追击因非 normal 标签被阻塞；两把生命值武器的追击因冷却被阻塞。日志保留这些实际决定。触发位于模拟最后一帧时，下一帧追击在观察窗口之外，触发行可以没有已执行子事件，不伪造窗口外伤害。

## 验证记录

仅执行新增 `packages/sim-core/src/__tests__/independent-weapon-proc.test.ts` 的四个用例，没有运行旧全集、类型检查、构建、Monte Carlo 或浏览器批次。

首轮 **4 failed / 4，exit 1**，总耗时 912 ms、测试 74 ms；日志为 `independent-weapon-proc-runtime.log`。四例共同停在原有 `assertTrustedReactionDeliveryResultReferences` 的旧规则：`direct damage events must have a null parentDamageEventId`。这是生产引用校验的漏接入口，不是数值夹具错误。修复保留真实父事件：仅当前版本、实际触发日志与子事件逐项回链成立时允许独立追击父引用，同时把日志纳入模拟器原有裁剪校验输入；完整来源、快照和几何校验继续执行。

修复后只复验这四个失败项：**4 passed / 4，exit 0**，总耗时 **1.11 s**、测试 **290 ms**；日志为 `independent-weapon-proc-runtime.retry.log`。

| 用例 | 实际结果 |
| --- | --- |
| 钺矛 | 动作名字和产球标签不能代替明确 normal。后台的 0 伤害宿主在第 2 帧触发，第 3 帧追击 **2560**；第 602 帧仍冷却，第 603 帧触发、第 604 帧追击 **1280**。第一条追击保留触发时攻击增益；宿主 CR=1、CD=4、防御无视 0.8 不进入追击，追击自身为非暴击。 |
| 苍纹角杯 | 第 0 帧保存最大 HP=20000，第 1 帧在增益已经到期后仍依快照执行。半径 3 选中两个实际目标，伤害为 **6800 / 3400**；第三目标保留 miss，无伤害事件。 |
| 冷寂迸音 | R5 系数 0.8，第 0/901 帧触发，第 1/902 帧各造成 **4000**；第 2 帧后台阻塞，第 900 帧冷却等号边界阻塞。 |
| 捕获与范围 | 实际追击通过完整结果校验后进入计算器，重算差值 **0**；JSON 导出/导入后仍为 0。把父事件改为自身会被拒绝。完整稳态检查点仍阻塞；删除模型后没有 `weaponProcLog` 且只剩宿主命中。 |

另有协作代理独立执行一次固定 gcsim 三武器配置，原始产物与数值在 `docs/cross-validation/weapon-proc-external.md` 和 `docs/cross-validation/weapon-procs/three-procs-reference.reference.json`；该外部证据不替代本地测试，也不表述为当前游戏实测。

## 保留的边界

来源冷却可以受角色卡肉延长；本版本明确使用无角色卡肉条件，不声称覆盖卡肉后的边界。当前只覆盖普通伤害回调，未接入反应伤害回调或月曜/星辉特殊宿主。独立武器的真实冷却和待执行快照尚未导出到完整周期检查点，因此配置这类武器时继续阻塞确定性稳态认证。固定源码一致性也不等同于当前游戏服务器实测认证。
