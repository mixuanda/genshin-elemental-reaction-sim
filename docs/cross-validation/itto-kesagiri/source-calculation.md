# 一斗荒泷逆袈裟：来源条件单次计算

本实现提供两个独立、完整的单次动作：`aratakiitto-kesagiri-combo`（一次连斩）与 `aratakiitto-kesagiri-finisher`（一次终结）。每个动作只有一个自身伤害实例，单技能结果即该实例；左右连斩共用倍率不表示一次输入造成两次伤害。本实现不把完整持有、整套逆袈裟或 Q 窗口伪称为已完成。

来源固定为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；状态为 **source-backed-provisional**，不是当前官服实测验证。完整数表、活动数据集身份、比较方法及 10 个源文件哈希见 [来源清单](../../../packages/game-data/src/character-mappings/itto-kesagiri-source-manifest.json)。三组 15 级数表以 Decimal 逐项比较，共 45 个系数与活动目录完全一致，最大绝对差为 0；该比较不是测试套件或游戏运行。

| 步骤 | 固定源码证据 | 实际实现 |
| --- | --- | --- |
| 单次连斩/终结 | `charge.go:87–111,214–232,258–260` | Combo 使用 `combat1.param6`；finisher 使用 `param7`；均为 `AttackTagExtra`，在计算器分类为重击。每次源码调用只建立一次伤害。 |
| 分支资格 | `charge.go:87–111,201–203,262–272` | 显式输入 1–5 层怪力及本次 C6 保层判定。连斩要求至少 2 层，或 1 层且 C6 保层成功；终结要求 1 层且未保层。不会抽样或推断整段长度。 |
| A4 附加基数 | `asc.go:63–68` | 突破 4 后加入 `0.35 × 动作起手完整 DEF`；`TotalDef(false)` 包含 Extra DEF。这是附加伤害基数，不是 ATK、天赋倍率或普通增伤。 |
| Q 固定攻击力 | `burst.go:45–65`、`stats.go:122–166` | `历史非 Extra DEF × combat3.param2[独立有效 Q 等级]`，作为 Extra 固定 ATK 加在构筑攻击之后，不再乘 ATK%。不使用当前完整 DEF 或 A4 快照替代它。 |
| Q 附魔 | `itto.go:83–98` | 明确 Q 有效时改为岩伤，重击标签保留。Q 本身没有直接伤害实例；本次不新增虚构的 Q 伤害。 |
| C6 暴伤 | `cons.go:61–72` | 重击专属暴伤 +70%，仅进入本段；C6 保层概率不乘成 1.5 倍伤害。已有 `effectiveCritDamage` 时来源式明确不适用，不重复添加。 |
| C4 攻防 | `cons.go:39–55` | 用户明确声明当前是否有效。有效且使用装备推导时精准阻塞，要求恢复已含 20% ATK/DEF 的最终面板；不把未计入的推导面板当作完整结果。 |

A4 与 Q 的防御是两个不同输入。`actionDefenseSnapshotTotal` 为本次重击动作起手的完整 DEF；不填时，只有明确声明 `actionDefenseStable=true` 才使用面板 DEF，并标注起手到命中保持该值的条件。A4 尚未解锁时，不要求这份快照；突破未知时仍阻止需要 A4 的计算。Q 的 `defenseSnapshotNonExtra` 始终是建立转换时的历史非 Extra DEF。

接口为 `applyIttoChargedContext(document, context)`，从 `apps/web/src/character-calculations.ts` 导出；状态完整保存在 `gameContext.ittoCharged`：

```text
superstrengthStacks: 1..5
c6PreserveStack: boolean
burst: { active, effectiveTalentLevel: 1..15, defenseSnapshotNonExtra?, accounting }
c4BuffActive: boolean
actionDefenseSnapshotTotal?: number
actionDefenseStable: boolean
```

Q 的 `accounting` 为 `add-to-panel` 或 `already-in-final-panel`；已含最终攻击力时不执行旧快照式、不要求其分解。装备转换为最终面板仍保留原构筑基底和逐命中的 Q 调整，不压平不同命中状态。C6 暴伤在最终转换后固化为该命中的最终暴伤，来源公式保留并显示不适用；JSON 往返等值。选中命中的明确 missing 依赖会阻止最终转换，因此 C4 未恢复的装备面板无法借模式切换绕过门控。

所有伤害仍经同一计算器核心；追踪节点包括 `sourceAttackAdjustment`、`hitAttack`、`customAdditiveBase`、`characterCritDamage` 与 `applicableCritDamage`。新来源输入使用稳定 `input.itto*` 本地化键，记录公式、变量、实际代入、结果及固定来源。

## 本轮执行的验证

只执行一次直接相关的新专项，没有运行旧测试集合、完整构建或浏览器：

```text
npx vitest run packages/sim-core/src/__tests__/calculator-itto-kesagiri.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
Start at    22:00:44
Duration    1.18s (transform 793ms, setup 0ms, import 1.06s, tests 58ms)
```

以上为 2026-09-23 工具结果转录，未为生成日志重跑。覆盖注册的实际单次动作、两份防御快照隔离、Q 与普攻天赋独立、C6 分支/暴伤、C4 阻塞、突破依赖、最终面板与 JSON 等值。数值示例：Lv1 连斩系数 0.9116；原 ATK 2000、Q1 非 Extra DEF 快照 1000 时，转换为 576、实际 ATK 为 2576；A4 独立完整 DEF 快照 1500 时，附加基数为 525。将当前 DEF 改为 9000 不会重采这两份明确快照。

## 未实现及来源限制

固定源 `charge.go` 仍有“命中时点未按攻速调整”和“假设 CA 起手快照”的 TODO。Q 起效时点未确认，`660 + 90 + 45` 帧持续是固定实现选择；C1 初始层数约 75 帧及 C2 延迟也有未核实注释。结果不能据此认证这些实战时序。

完整持有的循环、怪力产层/消耗时间线、C6 随机序列、阿丑、取消、卡肉、攻速、目标覆盖、能量与冷却没有在此单次计算里自动模拟。C4 有效的装备属性自动重建尚未接入，本次只允许明确已恢复的最终面板。其他原有一斗动作与全角色机制状态没有因此提升为完整验证。
