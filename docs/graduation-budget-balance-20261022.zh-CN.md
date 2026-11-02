# 流浪者参考配装的预算内配平

基线为 `a3534aa`。本轮仅修复已维护的流浪者直伤参考模板，不扩展全部角色，不把项目的小／大毕业档称为官方标准。

## 入口、输出与原有预算证据

`packages/game-data/src/character-build-presets.ts` 的 `createPreset` 生成输入：基础档来自 `wandererSmallGraduatePieces`，进阶档原先来自 `makePieces`。它们由 `getCharacterBuildPreset` 输出，供 `apps/web/src/build-workshop.ts`、`source-single-skill.ts` 和 `source-team-builder.ts` 使用。`equipmentBuildToSourceTeamMember` 汇总的仍是逐件圣遗物贡献，并非凭空增添最终面板。

旧基础档是五件 +20 五星三词条胚，每件 8 次初始／升级档位，共 40 次；旧进阶档是五件 +20 五星四词条胚，每件 9 次，共 45 次。两者都有四种副词条、主副排斥、真实离散档位，且单种累计不超过三词条胚的 5 次／四词条胚的 6 次。因此本轮没有发现“独立堆高多个面板属性而超出合法预算”。

可复现的问题是原进阶生成器按偏好顺序平均分次数，没有用期望伤害衡量分配；旧档位还把流浪乐章 R1 换成天空之卷 R1、天赋从 9/6/1 改为 10/9/1。圣遗物比较因此混入武器和天赋变化。

## 固定条件与有限修复

两档流浪者现固定为 C0、角色及武器 Lv.90、流浪乐章 R1、天赋 10/9/1；候选武器仍可编辑，天空之卷不再由档位自动切换。两档没有队伍增益、反应、武器及套装被动。它们不要求每轮开 Q，但具体队伍与轮转的充能需求为未知，不能据此声称循环成立。

`artifact-budget-balance.ts` 只在同一件已有的四种副词条之间转移离散档位，每种至少保留一次。每件的套装、槽位、主词条、初始词条数、总次数及档位索引多重集均不变；不增加主词条、第五种副词条或额外 roll 质量。每轮选择严格改善的转移，最多 80 次，并返回是否触及次数限制；初始分配没有更优转移时原样保留。

流浪者调用方使用 `ATK × (1 + clamp(CR,0,1) × CD)`。在固定天赋倍率、增伤、敌人防御与抗性的当前直伤条件下，这与实际期望伤害成正比；其中 ATK 由 `(角色白值 + 武器白值) × (1 + ATK%) + 固定攻击` 取得。它不是最终单次伤害或循环 DPS。有效暴击增益应计入 CR 后再截断；当前模板没有提供队伍，故不虚构任何增益。

进阶档除原有 45 次种子，还保留已配平基础档的完整分配作为候选；同一目标下不能因升级档位而低于基础档。三／四词条胚只描述本次种子，不是档位的机械门槛。

配平器由调用方提供评分函数，没有通用攻击／双暴／精通默认目标。生产调用只限流浪者。HP、DEF、混合倍率及其他角色模板保持原覆盖标记；本轮没有实现它们的角色推荐或激化、超绽放、月反应目标。显式 HP/DEF/混合目标与三精通主词条的测试验证的是预算接口，不代表新增角色机制支持。

## 固定条件下的独立证据

以下“旧”均保留旧圣遗物、统一使用上述同一武器／天赋／等级／命座；不是直接对比旧 UI 中不同武器的结果。

| 项目自定样例 | 合法 roll 总数 | 旧直伤期望因子 | 新直伤期望因子 | 同预算改善 |
| --- | ---: | ---: | ---: | ---: |
| 基础参考 | 40 → 40 | 4129.341424 | 5077.973426 | 22.973% |
| 进阶参考 | 45 → 45 | 5398.012526 | 6153.545649 | 13.997% |

新基础档为 ATK 1826.561125、CR 94.56%、CD 188.248%、ER 105.18%；新进阶档为 ATK 1986.364283、CR 98.07%、CD 213.918%、ER 114.24%。旧进阶相同武器下 ER 为 131.73%；下降来自当前不约束每轮 Q 的直伤目标，不是充能已得到验证。加入班尼特、有效暴击增益、反应或循环需求时应重新按相应目标与条件比较。

`docs/fixtures/wanderer-graduation-budget-20261022.json` 保存旧实际输入、统一条件前值、新输入和审计字段。`scripts/audit-graduation-budget.mjs` 仅读取固定原始 JSON，**不调用生产装备／圣遗物／评分函数**，独立检查逐件合法性、前后档位质量一致、角色白值／武器白值、最终面板与期望因子。聚焦测试还将最终因子与现有实际普通伤害公式交叉核对。

## 来源边界

已阅读原文：[KQM Artifacts Guide](https://keqingmains.com/misc/artifacts/)、[KQM Wanderer Quick Guide](https://keqingmains.com/q/wanderer-quickguide/)、[KQM TCL Damage Formula](https://library.keqingmains.com/combat-mechanics/damage/damage-formula)、[KQM Compendium](https://compendium.keqingmains.com/)。公式的不可变 Git 提交及正文 SHA-256、网页观测哈希在 `graduation-balance-sources-20261022.json`；离散数值表继续使用项目已固定的 GO 提交 `180a0a1015cb725c7570cd828eb086749960df98` 和活动目录快照。

KQMS 2.0.2 的 40 次是 20 固定加 20 分配的平均词条比较标准；它不等于本项目的逐件真实离散 40 次种子，也不定义小／大毕业。这里不套用其平均值、分配上限或 RV 作为毕业线。

## 验证与交接

主线程完整回归结束后，本分支运行了配平器和预设两个聚焦测试文件，12 项全部通过；`tsc --noEmit --incremental false` 通过，上述独立原表审计通过。没有运行全套测试或构建，没有修改界面。

供界面接入的新增可选字段是 `preset.artifactBalance`：`objective`、`initialScore/finalScore`、`moves/termination`、`starterComparisonScore`、`retainedStarterAllocation`、`energyRequirement` 与 `energyConstraint`。当前 `energyRequirement` 明确为 `unknown-without-team-and-rotation`；`energyConstraint.status` 为 `unspecified`。若以后调用方已算出所需总 ER，应先扣去基础 100% 及角色／武器等非圣遗物贡献，再把圣遗物加成下限传给 `minimumArtifactEnergyRechargeBonus`；不满足时会返回 `unsatisfied`，不能显示为循环充能通过。
