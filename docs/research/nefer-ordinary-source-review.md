# 奈芙尔普通 E／Q 命座取证

本次固定审阅 Genshin Optimizer `180a0a1015cb725c7570cd828eb086749960df98` 的生产角色 sheet、倍率表、英文角色说明及 tooltip。完整 URL、SHA256、字节数、Git blob 身份和本次获取时间保存在 [nefer-ordinary-source.ts](../../packages/game-data/src/character-mappings/nefer-ordinary-source.ts)。本文件不应用计算规则，也不提高资料的验证等级。实现与说明属于同一个仓库，不能计为两个独立来源。

**发现真实的适用范围冲突：普通 E 初始突进不能直接继承有层数的幻戏乘区。** 生产 [sheet 225–230 行](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L225) 将 `a1VeilStacks_pp_mult_` 传入 `skillDmg`；但固定 [tooltip 243–247 行](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/tooltips_gen.json#L243) 把每层 8% 增幅明确限定为幻戏。[236–240 行](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/tooltips_gen.json#L236) 又将幻戏定义为影舞中的替代重击：本体两段、虚影三段。它不是 E 初始突进。C2 的“最高 140%”说明同样只指幻戏。零层时该乘数为 1，不受这个数值冲突影响，但实际 EM、C2 同次施放加层和 C4 减抗的状态仍不能省略。

| 命座 | 对普通 E 突进／Q 两段的影响 | 精确常数与来源位置 |
|---|---|---|
| C0 | E 基础为 ATK、EM 双项；Q 两段也是双项。Q 消耗的帷幕层数通过独立的 `combat3.param5` 加入伤害加成区。满层 EM 必须恢复到实际面板。 | 基础帷幕最多 3 层、每层独立 9 秒；满 3 层或刷新第三层时 +100 EM，持续 8 秒。`skillParam.json:518–536`；sheet `115–188`、`225–231`、`290–300`。帷幕每层 8% 对普通 E 的适用范围存在上述冲突。 |
| C1 | 不直接给普通 E／Q 加伤害项。 | `constellation1[0]=0.6`，仅给幻戏的月绽放基础伤害增加 `0.6×EM`。sheet `195–199`；英文角色说明 `204–208`。 |
| C2 | 改变可用帷幕层数及实际 EM；不能据此把幻戏乘区扩展到普通 E。Q 可消耗的上限由 3 提高到 5。 | `constellation2=[2,5,200]`：E 施放时 +2 层；层数上限 5；持续时间增加 5 秒，变为 14 秒；满 5 层或刷新第五层时改为 +200 EM，持续 8 秒。200 替代 100，不是合计 300。sheet `169–188`；英文说明 `210–215`。 |
| C3 | 改变普通 E 使用的有效天赋等级。 | E 等级 +3，上限 15。sheet `317–325`；英文说明 `217–222`。已经输入有效等级时不得再加一次。 |
| C4 | 普通草伤 E／Q 可以受到实际目标草抗降低的影响；不是固定伤害加成。 | `constellation4=[0.25,4.5,0.2]`，实际草抗修改 `−0.20`。影舞期间附近敌人受到减抗；退出影舞或离开一定距离后，延迟 4.5 秒移除。25% 草露获取加速另外要求奈芙尔在场；减抗句与 sheet 没有增加该在场条件。sheet `201–206`、`328–332`；英文说明 `224–229`。 |
| C5 | 改变 Q 两段基础倍率以及每层帷幕的 Q 伤害加成。 | Q 等级 +3，上限 15；`param1..param5` 都要使用实际有效 Q 等级。sheet `129–131`、`317–325`；英文说明 `231–236`。 |
| C6 | 没有直接改写普通 E 突进或普通 Q 第二段；仍继承前面命座的等级、EM、减抗影响。 | `constellation6=[0.85,1.2,0.15]`：幻戏本体第二段改为 `0.85×EM` 月绽放，幻戏结束额外 `1.2×EM` 月绽放；满辉时月绽放擢升 15%。sheet `240–258` 改的是 `skill.nefer2Dmg`；`290–300` 的 `burst.hit2` 未改。英文说明 `238–244`。 |

sheet 将帷幕相关效果及 EM 门控为“突破至少 1 阶且月兆至少 2”。C2 说明要求先解锁突破天赋。这里只确认来源表达式和条件，不把 UI 的层数选择器当作事件模拟。

当前活动资料是 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`。以下七组向量共 **105 个数值**与固定源码完全相同，未发现倍率变化：

| 当前 catalog 坐标 | 固定源码坐标 | 用途 |
|---|---|---|
| `talent-set:nefer.combat2.param1`、`param2` | `skillParam.skill[0]`、`[1]` | E 突进 ATK、EM 两项 |
| `talent-set:nefer.combat3.param1`、`param2` | `skillParam.burst[0]`、`[1]` | Q 第一段 ATK、EM 两项 |
| `talent-set:nefer.combat3.param3`、`param4` | `skillParam.burst[2]`、`[3]` | Q 第二段 ATK、EM 两项 |
| `talent-set:nefer.combat3.param5` | `skillParam.burst[4]` | 每消耗一层帷幕的 Q 伤害加成 |

例如 Q 有效等级从 10 变为 13 时，第一段两项由 `4.04352 / 8.08704` 变为 `4.7736 / 9.5472`，第二段由 `6.06528 / 12.13056` 变为 `7.1604 / 14.3208`，每层帷幕加成由 `0.40` 变为 `0.49`。这是一组有效等级选择示例，不是额外乘区。

命座当前坐标为 `supplemental.constellationSets[id="constellation-set:12201"].entries[rank=1..6]`，源路径 `data.ChineseSimplified.constellations.nefer`。其中中文常数与本次固定英文说明一致；这些内容仍是描述文本，没有独立的命座数值参数向量。活动资料本身仍标记 `numericEvidenceStatus=unchecked`、`mechanicEvidenceStatus=missing`，本次不擅自修改这些状态。

必须保留以下时序缺口：

- C2 的施 E 加 2 层是否先于同次 E 初始伤害，当前文件没有事件顺序证据。
- 进入影舞及 C4 减抗是否先于该次 E 命中，未确认；附近距离阈值及范围检测节奏也未提供。4.5 秒是离开条件后的尾效时间，不是从施放开始固定持续 4.5 秒。
- 满层 EM 是触发后持续 8 秒的独立效果。Q 消耗帷幕后，不能只因当前层数变为零就抹去已触发的 EM；应恢复命中时实际剩余的 buff 状态，并避免将 100、200 或最终面板重复相加。
- Q 的“本次已消耗层数”与当前帷幕层数是不同上下文。sheet 分开提供两项选择，但没有证明两段伤害的快照、消耗和 buff 过期顺序。

本次仅新增取证模块与说明文件；未修改 schema、映射或生产计算，未运行测试。
