# 圣遗物预算的显式能量事件表契约

`packages/game-data/src/artifact-budget-energy.ts` 为预算比较提供可选、有限时间窗的能量门禁；`artifact-budget-balance.ts` 导出其 API，并接受 `options.rotationEnergy`。没有为角色预设增加通用 ER 门槛；那维莱特/诺艾尔/久岐忍仍只是单击条件目标，`energyRequirement` 保持未知。

## 输入与实际来源

`ArtifactBudgetEnergyContract` 只对应一个接收角色，显式给出容量、初始能量、非圣遗物总 ER 倍率、结束能量要求和有来源的执行顺序。`nonArtifactEnergyRecharge=1` 表示基础 100% ER；传入配平器的圣遗物 `enerRech_` 是加成，例如 `0.20` 表示另加 20%，不是总 120%。

事件按严格递增的 `(frame, order)` 输入，不会自行排序。`order` 应保留实际同帧执行顺序；不可只按种类排序、使用生成时刻替代粒子到达时刻，或把粒子排到已失败的 Q 之前。

- `particle-arrival.energyAt100PercentER`：实际接收者在 100% ER 下、容量截断前的能量。先用真实元素/同异色、前后台、队伍人数和粒子/晶球规则算出该值，再乘候选总 ER。禁止用面板已经截断的 `energyAfter-energyBefore` 倒推原始能量。随机粒子必须先由实际固定随机分支解析，不使用期望颗数代替一次执行。
- `flat-energy.amount`：实际固定回能，包括已触发的普攻随机回能或被动退款；不乘 ER。不是因为队伍里有某武器就制造退款。
- `burst-reserve`：输入已具备施放资格时占用可用能量，尚不扣除；须给唯一 `reservationId`。
- `burst-spend`：实际扣能。延后扣能必须带匹配的 `reservationId` 与相同费用；没有预留阶段的来源可使用不带 reservation 的同一事件原子检查/扣能。
- `burst-release`：实际取消时释放相应预留，不制造能量。

API 检查来源引用非空，但不认证引用内容本身。调用方负责把原始来源事件及其成本、接收者、顺序和已解析随机结果正确映射进来。记录中如有其他种类能量机制或时变 ER，须先单独解析，不能默默按本契约猜测。

## 输出与拒绝路径

回放给出逐事件前值、请求、实际值、浪费、后值、预留状态和第一失败。所有正向回能均受容量限制，预留不会提前腾出容量。不可支付的 Q 在预留/扣能处阻塞，保持余额并停止，不执行后面的假想动作/回能。结束未清的预留或未达到明确结束能量要求也返回 `unsatisfied`。

一次满能开局且结束为空的动作，可以通过 `minimumEndingEnergy=0` 的有限事件表，但不代表可从相同初始条件无限重复。若需要回到相同能量储备，必须显式填写相应结束要求；不会每轮恢复初始能量。

返回的 `scope` 固定为 `declared-fixed-event-schedule`，`actionAndParticleTiming` 固定为 `requires-candidate-resimulation`。即使能量事件表通过，也不证明动作合法性、冷却、前后台和粒子产生/到达时刻在候选 ER 下保持不变。实际优化轮转需用候选构筑重新执行来源动作模拟，再检查重新产生的事件，不能把旧固定表当作新轮转验证。

## 与合法词条预算结合

配平器先从已有每件身份与档位计算能达到的 ER 上限：只把可转移词条的原始档位给该件已有 ER 副词条，其他三种身份各保留一次、保留最低档；没有 ER 身份就不能造出 ER 副词条。主词条仍固定。该上限是一个合法的实际分配，不是超预算连续面板。

`minimumArtifactEnergyForFixedSchedule` 在此上限内做固定 48 次有界二分，只为本条已声明事件表寻找所需圣遗物 ER 加成。不可达时返回 `null`。配平器优先达到事件表门槛，再在符合门槛的分配中改善目标；因此满足明确的 Q 需求可能牺牲单击伤害。不可达时可把现有 ER 分到真实上限，但最终仍为 `unsatisfied`，并保留失败事件，不把上限称为充能需求。

## 验证证据

聚焦单元直接回放仓库已有 `noelle-q-normal-reference.expected.json`：F1 预留 60、F9 扣 60、固定随机分支在 F240 回 1。ER 改为 300% 仍只回同样的 1；要求结束恢复 60 或直接再施放一次 Q 都失败。测试另覆盖同帧到达顺序、满能浪费、重叠预留、取消释放、结束储备、非法/未知输入、真实主副排斥与离散 ER 上限。

额外对照主线程已完成的实际四人零能量 120 秒原生来源记录：将 102 条实际能量应用映射后，四名接收者的每条前后能量均一致，最大绝对差 `2.85e-14`。两次实际成功的 Q 使用真实接受输入时刻与后续扣能时刻分开检查；实际 F2714/F2731 的能量不足输入在门禁中也分别失败。此为能量账本对照，不是新的队伍/配装或轮转优化结论；私有配置与个人配装没有进入提交。

来源：[KQM TCL Energy](https://library.keqingmains.com/combat-mechanics/energy) 区分粒子 ER、固定回能、前后台与容量；数值交叉核对复用仓库 `calculateParticleEnergy`。实际普通攻击回能及 Noelle 的既有固定源为 [gcsim b4ae769](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541)。公共 Noelle 记录是项目既有条件执行证据，不晋升当前游戏逐帧实测。
