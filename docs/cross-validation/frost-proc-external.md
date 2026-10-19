# 忍冬之果双目标：固定外部与命中后判冰

2026-09-24，一次固定 gcsim CLI 实际验证：夏洛蒂 N1 先对目标 1 附冰，忍冬之果 R5 随后选择 **3.6 ATK**，下一帧追击对带冰目标 1 和无冰目标 2 均造成 **69.76265017880414**。这验证固定实现“按触发目标判条件、整次范围攻击共用倍率”的行为，不认证当前游戏。未重新抽样或运行另外四种武器的外部矩阵。

## 本次来源范围

固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，以及本地已有 Optimizer `180a0a1015cb725c7570cd828eb086749960df98` 的五份生产武器 sheet、活动目录 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`。本次只读复核五种武器，来源路径、字节 SHA、目录原始五个条目在 [source-review.json](frost-proc/source-review.json)；复用 [Optimizer 固定归档清单](../../packages/game-data/sources/weapon-proc-five-optimizer/manifest.json)，没有重复抓取或执行 Optimizer。

| 固定实现 | R1–R5 ATK 倍率 | 概率、触发门及顺序 | ICD / 范围 |
| --- | --- | --- | --- |
| 吃虎鱼刀 | 2.4/2.8/3.2/3.6/4 | 本人、前台、无 ICD；无攻击标签限制；`roll ≤ 0.5` 后检查实际伤害非零；排入追击后设 ICD | 900/840/780/720/660 帧；原目标单体 |
| 试作古华 | 2.4/3/3.6/4.2/4.8 | 本人、前台、无 ICD、Normal/Extra；`roll < 0.5`；无零伤害门；先设 ICD 再排追击 | 900 帧；触发目标中心半径 3 |
| 雪葬的星银、龙脊长枪、忍冬之果 | 普通 0.8/0.95/1.1/1.25/1.4；冰/冻结替换为 2/2.4/2.8/3.2/3.6 | 本人、前台、无 ICD、Normal/Extra；`roll < 0.5 + 0.1R`；无零伤害门；先抽样、设 ICD，才读触发目标冰/冻结 | 600 帧；触发目标中心半径 3 |

五种追击都使用 `AttackTagWeaponSkill`、物理元素、触发时快照、+1 帧攻击；其源 durability=100 不意味着物理追击会附加元素。ICD 使用 source status，expiry 等号仍活跃；本次只观察初次触发，没有实打到期边界。[Fillet 固定代码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/filletblade/filletblade.go#L30-L67)、[Archaic 固定代码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/claymore/prototype/prototype.go#L26-L57)、[Frostbearer 固定代码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/frostbearer/frostbearer.go#L27-L71)。另两份冰霜源文件已列入 source-review。

五份 GO sheet 和目录说明的倍率与上述固定方程一致。GO 冰霜 sheet 只提供“普通”和“受冰影响”两个独立物理伤害结果，没有依附着状态自动选择的事件运行器，不能作为“混合附着 AoE 共用触发目标倍率”的独立验证。Fillet/Archaic sheet 使用 `input.premod.atk`，冰霜 sheet 使用 `input.total.atk`；本次静态无增益样本不能证明一切属性转换情境下两者等价。目录来源仍为 provisional。

## 回调和附着时点

普通攻击先进行 [React](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L118-L125)，再计算伤害。在当帧延后任务中，`applyDamage()` 对未反应元素执行 [AttachOrRefill](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L234-L239)，之后才发送 [OnEnemyDamage](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L60-L78)。因此新施加的冰可被该次命中的武器回调读取，已经被本次反应消耗的元素不能按“命中前附着”继续使用。

冰霜回调的确切顺序为：资格门 → `Rand.Float64() < prob` → 建立 ICD → `AuraContains(Cryo/Frozen)` → 一次选择 `AttackInfo.Mult` → 快照并排程。R5 的概率虽然等于 1，仍调用 RNG；原始日志没有具体 roll 数值，不虚构。`AuraContains` 多参数为 OR，Cryo 查询本身也接受冻结耐久大于 0。[AuraContains L251–263](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go#L251-L263)。

选定倍率随后保留于整个攻击事件，逐目标伤害不会重新按目标 2 的附着切回低倍率。几何中心也在排程时从触发目标位置取得。[QueueAttack](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go#L36-L96)、[NewCircleHitOnTarget](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/hitbox.go#L50-L69)。

生命周期边界没有被隐去：伤害模式的致死宿主命中会在 `applyDamage()` 的死亡分支提前返回，跳过新附着；后续攻击执行也检查目标是否存活。本夹具使用固定时长、存活目标，无击杀、移动、冻结到期、融化、碎冰或其他回调修改，不将这些未采样分支称为完成。

## 唯一外部配置与实际结果

夏洛蒂 C0、Lv1/20、A0、天赋 1/1/1，忍冬之果 R5 Lv1/20，无圣遗物；基础 CR 用 `-0.05` 抵消为 0。显式 `hitlag=false`，两个敌人均 Lv90、全抗性 0.1、半径 0.25，起始无元素。目标 1 `(0,2)` 为主目标；目标 2 `(2.5,2)`。角色仅执行 N1，然后等至第 180 帧。

N1 以主目标为中心半径 1，因此 `2.5 > 1 + 0.25`，目标 2 明确 miss；追击半径 3，因此 `2.5 < 3 + 0.25`，两者都中。两敌人碰撞圆不重叠。本次结果没有 `target_overlap` 提醒。[Charlotte N1 源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/attack.go#L16-L78)。

| 实际帧 | 原始 sample 事件 | 未舍入值 |
| --- | --- | --- |
| 1 | N1 动作起手 | 动画长 32，N1 快照/命中偏移 +13 |
| 14 | N1 快照并只命中目标 1 | 倍率 0.498456，伤害 **9.65933654375722** |
| 14 | 目标 2 的 N1 几何 miss | raw log 14 |
| 14 | 目标 1 附冰 | raw log 15，`after=[cryo:20.000]` |
| 14 | 武器 ICD 建立 | raw log 16，expiry **614** |
| 14 | 忍冬之果追击快照 | raw log 17，倍率 **3.6** |
| 15 | 追击命中目标 1、2 | 每个 **69.76265017880414** |

真实面板：BaseATK=`56.91452`，武器 ATK%=0.09，FlatATK=0，实际 ATK=`62.03682680000001`，HP=`902.6731`，DEF=`45.78`，EM=0，ER=1，CR=0，CD=0.5，通用/物理增伤均 0。追击基础伤害 `62.03682680000001 × 3.6 = 223.33257648000003`；防御乘区 `101/291 = 0.3470790378006873`，抗性乘区 0.9，得到上述每目标伤害。

外部统计总伤及逐行 sample 总伤均为 **149.18463690136548**，二者差 **0**；此处不是本地引擎残差。统计 seed=`12559703451663605485`，独立 debug seed=`9961035442080606728`。CR=0 也不等于源随机流完全不消耗；本次不比较跨引擎同 seed 序列。

## 文件及执行证据

一次 CLI 于 `2026-09-24T01:56:50.136864+00:00` 执行，退出 **0**，耗时 **0.018644000054337084 秒**，无失败或重跑。复用的 binary SHA=`2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`；输出 revision 固定、`modified=false`、build date=`2026-07-25T16:00:55Z`。`hitlag=false` 确实解析为 false；结果的 `enable_hitlag` 因 false/omitempty 省略，不应将单独保留的 `def_halt=true` 误读为卡肉启用。

- [原始配置](frost-proc/charlotte-frostbearer-reference.gcsl)、[原始统计结果](frost-proc/charlotte-frostbearer-reference.result.json)、[不可变 sample](frost-proc/charlotte-frostbearer-reference.sample.json)、[完整命令/时长/产物哈希](frost-proc/charlotte-frostbearer-reference.execution.json)。
- [派生参考 JSON](frost-proc/charlotte-frostbearer-reference.reference.json) 保存三击 calc 全字段、数值快照、实际附着/ICD/命中顺序、几何 miss、来源边界；[提取脚本](frost-proc/extract-reference.py) 不调用模拟器。
- [来源复核记录](frost-proc/source-review.json) 保存固定源 13 份文件 SHA、GO 归档和活动目录身份。共享的 [规范源码清单](../../packages/game-data/sources/weapon-proc-five/manifest.json) 及 [源码字节归档](../../packages/game-data/sources/weapon-proc-five/source.json.gz) 已包含全部 13 份被复核的 gcsim 原文，逐 hash 相同，并包含其他相关源文件、许可证和五个目录条目；压缩归档 SHA 为 `994420b82da7377e3612039c26d588b53257182c4fc8b9e83f8d0811d9a06d1a`。本目录不另复制一份归档。

## 冻结后的唯一一次本地对照

相应运行时、严格结果 schema 和独立计算器条件入口冻结后，执行 [compare-local.mjs](frost-proc/compare-local.mjs)，首轮 **PASS**，退出 **0**，耗时 **1.100659292 秒**。没有本地失败、重复战斗、第二次外部 CLI、全套测试或构建。

脚本从外部真实基础属性恢复 `BaseATK=56.91452`、`ATK%=0.09`，不把最终攻击力再次乘武器副属性。配置从两个无附着目标开始，以合法 N1 指令在第 1 帧起手，第 14 帧通过实际几何只命中目标 1；该击真实附冰后，延后伤害回调读取 `{cryo:true,frozen:false}`，由武器运行时自行选择 3.6 倍率并排入第 15 帧范围追击，没有注入追击、附着状态或日志。

本地独立流 `independent-weapon-proc-v1` 在 R5 概率 1 时仍实际抽样，`roll=0.46866409154608846`，`drawCount 0→1`；没有搜索 seed。触发来源目标为 `enemy-0`，圆心 `(0,2)`、半径 3，武器 ICD expiry=614。两个追击子命中回调因 ICD 被阻挡，不继续抽样。此流与 gcsim 共用 RNG 不同，不能声称同 seed 序列一致。

| 对照项 | 本地实际值 | 外部绝对残差 |
| --- | --- | --- |
| N1，第 14 帧，目标 1 | 9.65933654375722 | 0 |
| 忍冬追击，第 15 帧，目标 1 | 69.76265017880414 | 0 |
| 忍冬追击，第 15 帧，目标 2 | 69.76265017880414 | 0 |
| 总伤 | 149.18463690136548 | 0 |
| 三份 capture→JSON→parse→calculator replay | 三项自身差与外部差均 0 | 0 |
| 两个追击独立 calculator builder | 各 69.76265017880414，JSON 往返总值相等 | 0 |

独立计算器明确输入 `triggeringTargetCryoOrFrozen:true`，表示**原触发目标**的状态，因此目标 2 自身无冰也沿用同一次追击的高档倍率。其倍率与条件由共享来源定义产生，没有手改伤害项。完整实际结果经当前 `simulationResultSchema` 的 JSON 校验通过；运行前后生产来源哈希完全相同。

证据：[实际本地配置](frost-proc/charlotte-frostbearer-reference.local-config.json)、[完整本地结果](frost-proc/charlotte-frostbearer-reference.local-result.json)、[精确指标与源码前后哈希](frost-proc/charlotte-frostbearer-reference.local-metrics.json)、[全部本地及引用产物 SHA](frost-proc/charlotte-frostbearer-reference.local-artifacts.json)。三份命中 capture/replay 和两份追击 calculator/计算结果 JSON 同目录保留。

此样本没有同时排入会改变 Aura 的竞争任务；本次通过不能单独认证所有同帧回调竞争时序，也不扩大为冻结生命周期、击杀、ICD 到期边界、低精炼概率分布或其他四把武器的外部实测。
