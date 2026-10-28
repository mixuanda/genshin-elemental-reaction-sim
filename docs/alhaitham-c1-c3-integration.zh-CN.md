# /goal 艾尔海森 C1–C3 镜投射增量

基线 `cb9e869`，旧C0入口与公共接线已经完成。本批保持三个skillId、各hitId、`gameContext.alhaithamDamage`和prepare/reset/finalize API不变，只扩展角色独立模块。原先模块范围、公式requirements及公共命座分支都限定C0，复现C0可算而C1/C2/C3被拒的记录在 `/tmp/GIDPS-role-alhaitham-cons-evidence-20261023/before-repro.json`。

新增导出 `ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION = 3`。根唯一需要改的公共命座分支为 `isAlhaithamDamageAction` 允许命座不超过此常量，更新原先只审阅C0的原因；schema聚合已引用本角色schema，因此本批新增字段随其注册。来源、计算、控件与requirement adapter均沿用现有API，不需再建动作或天赋映射。

新增字段均属于 `gameContext.alhaithamDamage`：

| 字段 | 合同与就地控件 |
| --- | --- |
| `c2SnapshotStacks?: number` | 延后快照时实际仍有效的C2层数，0–4整数。必填于C2/C3，永不从1/2/3镜数、历史生成数或导入命座推断；每层8秒独立到期。 |
| `c2SnapshotIncludedStacks?: number` | 本击快照精通输入已含的C2原生50精通份额，0–4整数。fresh equipment与新教学数值可知未含为0；重新导入保持未知。 |
| `c2TriggerMasteryFinal?: boolean` | 仅精通跨阶段变化时，须明确触发输入是已含该时点C2的完整实际最终精通；不会再加快照C2层数。 |
| `hitStates[hitId].c2HitMasteryFinal?: boolean` | 同理，A4已解锁且精通变化时，逐段命中精通必须确认是已含当时C2的完整实际最终值。 |
| `c2OtherSnapshotStatsFinal?: boolean` | **imported-final且实际/已含C2层数不同**时必须为true：用户已填写C2生效后的实际攻击力等其他快照属性，或应改用配装计算。Enka非战斗观察不能证明精通转攻击/双暴。manual-final沿用其明确实际面板合同；若用户明确标为false也拒绝。有相同实际/已含层数、差额0时不追加询问。该select始终挂在C2记账折叠中，缺项收集器按需要求，避免随数字失焦挂载/删除。 |

旧 `masteryStableAcrossStages=true` 仍是用户明确的实际总精通不变声明，不自动设为是。该分支使用**完整重建后的精通**供触发基数和A4；不是把三阶段都随意回填当前裸EM。变化分支继续使用 `triggerMastery` 与逐段 `hitTimeMastery`，两者为各自时点完整实际最终值，其对应的确认字段不产生数值。

快照C2差额为 `50 * (c2SnapshotStacks - c2SnapshotIncludedStacks)`。非零差额写入角色自有 `elementalMasteryAdjustment`，由既有公共EM相位重建器在装备pre-panel和conversion之前处理，所以精通转攻击等已建装备规则会重新计算该快照属性；不是在最终伤害式中塞入一个仅供A4使用的额外EM。差额为0不添加调整；已有C2不再加一次。C2当时实际0、面板已含4时可移除明确已含的200EM份额。外来EM同槽公式遇到非零C2差额会保留原式并拒绝覆盖。

C1在投射命中回调之后按1秒ICD减E冷却1.2秒，不改变所选这一击的倍率或伤害；本模块不模拟该冷却历史。C3由调用方已经给定的独立有效E等级表达，始终不再+3：基础E10加导入明确bonus3得到有效E13时，读取的投射向量正是ATK1.428、EM2.856。

C2生成规则的固定源证据：每次生成镜都会调用 `c2(generated)`，发生在镜上限截断之前，因此溢出生成也可触发；4个循环槽各加50EM、独立480帧含命中停顿时限。本批只接受实际有效层数或对应的完整实际阶段面板，不新造镜生命周期、生成事件、满层或持续覆盖率。

精度限制：当C2精通跨阶段变化，且配装含适用于技能草伤的EM敏感stat conversion、dynamicHitBonus、additive-base或critical公式时，当前单份装备阶段数据没有建立独立触发/快照/命中装备路径，因此明确拒绝。导出 `alhaithamUnstableC2EquipmentRules(document): string[]` 给出实际规则名，控件与requirement adapter链接 `#calc-build-mode` 的“手动最终面板”，要求实际快照攻击/精通及各阶段最终精通。只限普攻等不适用投射的规则不会误阻塞。此路径不修改或放宽公共装备引擎；根浏览器若在阻塞状态下切模式需要转换才能继续，应允许进入明确实际面板录入流程，不能沿用未经验证的自动转换值。

导出 `alhaithamRequiresC2SnapshotStatsConfirmation(document): boolean` 给根/控件复用导入差额门。所有确认仅是用户明确输入，公开展示柜不证明这些战斗事实；重新导入会清除新增状态与逐段确认。fresh equipment只可证明面板已含0，不推断实际有效层数。退回C0/C1时，任何实际或已含C2层数>0都明确拒绝并显示清理控件；高命座true确认本身不加精通。冻结指纹继续覆盖等级、有效天赋、镜状态及完整context，C2快照改层数/已含份额或退回C1均不可复用。

独立手算：角色/敌人90级、ATK2000、敌抗10%、无其他增伤，E10系数1.2096与2.4192。基础EM300、C2实际两层而面板未含，稳定实际EM400：每击非暴 `(2419.2 + 967.68) * 1.4 * .5 * .9 = 2133.7344`。精通变化而触发实际300、命中实际500时，原生基数仍725.76：每击非暴 `(2419.2 + 725.76) * 1.5 * .5 * .9 = 2122.848`。独立装备相位测试另设20%EM转ATK：C2使EM300→400、总ATK2060→2080，证明重建发生在属性相位，不只是给伤害补100EM。

原39个测试保留；将原范围断言调整为C1真实等伤、C2/C3缺状态阻断及C4以上范围拒绝。新增C2 0–4层、过期已含移除、C3有效E13、分阶段取样、未知与非整数、外来同槽、导入差额确认、稳定装备重建、复杂路径拒绝、JSON/转换精确及降命座冻结保护等定向测试。最终测试/定向TypeScript/固定源身份审计记录位于 `/tmp/GIDPS-role-alhaitham-cons-evidence-20261023/`。固定原件沿用已下载的Classic b4ae769与Stellar a7dc4bf目录，重新校验26文件SHA256/Gitblob、完整向量180比较位置，并核对C1/C2/C3常量及溢出调用顺序。

不覆盖C4以上、Q、完整镜生命周期或轮转；未push、未部署，也不重试先前被拒的发布操作。
