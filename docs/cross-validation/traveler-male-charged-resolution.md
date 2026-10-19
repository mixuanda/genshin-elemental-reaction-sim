# 空的七元素基础重击：男性专属系数核准

记录日期：2026-09-25。首次来源核准的范围仅为核对与归档，当时未修改映射、计算核心、活动目录或覆盖计数。后续获授权编写的窄范围实现记录在文末；本子任务没有运行测试、构建或游戏实测。

结论：固定 Optimizer 的七个男性专属 `skillParam.json` 可以消除空的基础重击第二段的数值来源冲突。七元素男性第二段完全相同，且与同版本 Optimizer 运行时总表的男性键精确一致；固定 gcsim 的男性向量是这些值保留四位小数的结果。现用 genshin-db 共享天赋表 `combat1.param7` 则在全部 105 个位置对应女性第二段。因此问题是把共享目录参数用于空时丢失性别区分，不是男性重击应改用荧的倍率。

这项核准只允许后续实现为男性建立明确的数值来源。它不自动使七个现存部分动作成为完整动作，也不表示角色已经团队就绪或游戏验证通过。

## 固定来源与身份链

| 来源 | 固定提交 | 本次用途 |
| --- | --- | --- |
| Optimizer | `180a0a1015cb725c7570cd828eb086749960df98` | 男性精确参数、男性 sheet 入口、运行时参数链 |
| gcsim | `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` | 男性身份、两段动作、帧数、快照、合法施放和特殊分支边界 |
| genshin-db | `49a6544a6c6ae36089cb42fa591fc46f01de8bcf` | 核对共享目录实际收录的两段参数；保留差异证据 |

男性身份链在风、岩、雷、草、水、火、冰七个目录分别成立：

1. `libs/gi/sheets/src/Characters/Traveler{Element}M/index.tsx` 将 `key = 'Traveler{Element}M'` 传给 `travelerSheet`。例如[男性风入口](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/TravelerAnemoM/index.tsx)。
2. [公共 travelerSheet](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Traveler/index.tsx) 使用 `allStats.char.skillParam[key]`，将 `auto[5]`、`auto[6]` 分别送入两个 ATK 缩放的 `charged` 伤害公式，`auto[7]` 为体力消耗。
3. 七个 `Data/Characters/Traveler{Element}M/skillParam.json` 的 `auto` 与 `src/allStat_gen.json` 中对应男性键的 `auto` 全部精确一致；比较不是只看文件名推断性别。[男性风参数](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/TravelerAnemoM/skillParam.json)与[运行时总表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/src/allStat_gen.json)均已归档。
4. 男性入口复用位于 `Traveler{Element}F/` 下的元素函数。这些函数接收传入的 `key` 并按该键取参数；目录名中的 `F` 不会将男性调用重定向到女性数值。本次归档这些函数用于说明调用链，没有借用女性 `skillParam.json` 作为男性系数。
5. [参数生成器](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/src/executors/gen-stats/src/characterSkillParam.ts)也按 `characterIdMap` 决定 `F`／`M`，为各元素分别生成性别键。
6. gcsim 的 `internal/characters/traveler/{element}/aether/aether.go` 七个入口均传入 `gender = 0`；对应 `charge.go` 使用 `charge[c.gender]`。例如[空的风入口](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/traveler/anemo/aether/aether.go)与[风重击实现](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/traveler/common/anemo/charge.go)。

## 全部 15 级比较

下表使用 ATK 倍率，`0.60716` 即 `60.716% ATK`。表中向量在七元素分别读取并逐级核对，不是只核一元素后外推。第一段的 Optimizer 男性、gcsim 男性与共享目录三者在全部 105 个位置精确一致。

| 天赋等级 | 男性第一段 | Optimizer 男性第二段 | gcsim 男性第二段 | 共享目录第二段 | 共享目录减男性精确值 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.559 | 0.60716 | 0.6072 | 0.7224 | 0.11524 |
| 2 | 0.6045 | 0.65658 | 0.6566 | 0.7812 | 0.12462 |
| 3 | 0.65 | 0.706 | 0.706 | 0.84 | 0.134 |
| 4 | 0.715 | 0.7766 | 0.7766 | 0.924 | 0.1474 |
| 5 | 0.7605 | 0.82602 | 0.826 | 0.9828 | 0.15678 |
| 6 | 0.8125 | 0.8825 | 0.8825 | 1.05 | 0.1675 |
| 7 | 0.884 | 0.96016 | 0.9602 | 1.1424 | 0.18224 |
| 8 | 0.9555 | 1.03782 | 1.0378 | 1.2348 | 0.19698 |
| 9 | 1.027 | 1.11548 | 1.1155 | 1.3272 | 0.21172 |
| 10 | 1.105 | 1.2002 | 1.2002 | 1.428 | 0.2278 |
| 11 | 1.183 | 1.28492 | 1.2849 | 1.5288 | 0.24388 |
| 12 | 1.261 | 1.36964 | 1.3696 | 1.6296 | 0.25996 |
| 13 | 1.339 | 1.45436 | 1.4544 | 1.7304 | 0.27604 |
| 14 | 1.417 | 1.53908 | 1.5391 | 1.8312 | 0.29212 |
| 15 | 1.495 | 1.6238 | 1.6238 | 1.932 | 0.3082 |

两段共核对 210 个男性系数位置。第二段的 105 个 gcsim 数值均等于男性精确值按十进制四位小数舍入后的结果，最大绝对差为 `0.00004`；这是明确识别的源表精度差，不是对旧目录放宽容差。共享目录第二段的 105 个位置全部不同于男性值，并与 gcsim 女性第二段精确一致。活动目录的 `combat1` 全参数与固定 genshin-db `src/data/stats/talents.json` 对应记录精确一致，差异不是本项目生成时损坏所致。

逐元素、逐级原值及差值见 [comparison.json](../../packages/game-data/sources/traveler-male-charged-resolution/comparison.json)。该文件保留男性和女性对照列；女性列仅用于定位共享表的性别，不作为男性计算输入。

## 条件完整动作仍需满足的机制

数值来源核准后，后续实现应保持下列条件；仅补上第二段或把旧 `completeAction` 改为真不足以证明完整施放。

- **动作起点明确。** gcsim 的 `ChargeAttack` 本身只产生两段重击，不包含前置普通攻击。但[共享动作模板](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/template/character/character.go)对单手剑重击要求有效的 `NormalCounter != 0`。必须从合法的普攻后状态进入；从站立开始的 N1＋重击是另一个包含三段伤害的动作组合，不能由这两段冒充。
- **体力与可施放状态明确。** 男性参数的体力消耗 15 级均为 20；`internal/template/character/stam.go` 返回单手剑默认消耗 20，`pkg/core/player/exec.go` 在动作开始检查并扣除经真实体力消耗修正后的值。基础分支可要求体力修正为 1、施放前体力至少 20，并满足当前动作可进入重击的时机；未知状态不能默认通过。
- **两段独立。** 七元素男性 `chargeHitmarks[0]` 均为 `[9, 20]`，单位为 60 FPS 源帧。两次 `QueueAttack` 的快照延迟与命中延迟分别均为 9、20，因此各自在实际命中帧取面板，不能把两段合成两倍第一段或共用未经确认的施放时快照。`pkg/core/attack.go` 保留这一快照与伤害调度语义。
- **完整接触记录。** 两段是候选攻击，不自动保证两段命中同一目标。完整观察至少覆盖第二段，逐段记录命中或未命中，并保留对应时点的攻击者面板及敌人状态；未知接触不能自动填为命中。男性默认动作动画为 55 帧，伤害尾部为第 20 帧；这些是不同概念，不能用末次伤害帧冒充完整循环时长。
- **基础物理分支。** 两段均按男性有效普攻天赋等级读取各自 ATK 倍率，使用重击伤害标签、物理伤害与真实属性；限定 C0、无外部附魔，装备与队友造成的面板变化只计入一次。触发武器、圣遗物、已有技能实体或队友协同产生的独立伤害不在这两个本体伤害事件中。
- **剧情状态明确。** 本基础分支要求 `true_moon_story_buff = 0`，关闭特殊剧情重击。其他剧情属性（例如基础攻击力、元素精通、基础生命值变化）仍须按实际状态计入最终面板；关闭一个开关不表示其余剧情属性自动归零。Optimizer 对应的 `Traveler.lockedPassive` 特殊分支也应关闭。
- **火元素边界。** [火重击实现](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/traveler/common/pyro/charge.go)在 C6 且夜魂加持时会转为火伤并带夜魂标签；该分支不属于此 C0 基础物理重击。
- **冰元素边界。** [冰重击实现](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/traveler/common/cryo/charge.go)、`asc.go`、`skill.go`、`stellar.go` 要求额外审查：基础分支限定 `radianceNone`、无 Polestar Field／`radiance-stellar-swirl`、无生效的 `travelercryo-e`、`trueMoonStacks = 0` 且上述剧情开关关闭。由此排除 A1 转冰及额外 `0.8 ATK`、特殊重击额外 `1.4 ATK`、恒星标签转换和命中后的协同冰晶。仅 C0 不能排除这些效果。

建议的数值接入是对 `aether-{anemo,geo,electro,dendro,hydro,pyro,cryo}` 显式绑定各自固定男性来源的 `auto[5]`／`auto[6]`，保留源提交、参数选择器、向量哈希与两段语义。不要覆盖男女共用的 `combat1.param7`，不要修改荧的合法值，也不要将旧共享目录冲突通过容差隐藏。历史阻塞记录应保留，并由新男性专属来源记录说明其替代关系。

## 来源核准阶段的归档与执行边界

[归档 manifest](../../packages/game-data/sources/traveler-male-charged-resolution/manifest.json)共收录 70 份原始文件：Optimizer 29、gcsim 32、genshin-db 9。全部字节的 Git blob SHA-1 与固定提交的树记录、固定 `contents?ref=` 文件记录或本地固定 Git 对象相符；逐文件 SHA-256、固定原始 URL、取得方式及预期／实际 Git blob 均在 manifest 中。Optimizer 与 gcsim 的所选树条目也已保存；所选树文件明确标记为子集，不冒充完整递归树。

活动目录为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，版本 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，目录 SHA-256 为 `3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602`。[目录投影](../../packages/game-data/sources/traveler-male-charged-resolution/catalog-projection.json)保存了核对时的选择器、空／荧身份与七个普攻天赋记录，并记录整份目录哈希。

首次来源核准限于读取固定来源、缺失字节下载、Git blob／SHA-256 核对和一次批量逐级数值比较。该阶段未修改运行时映射、生成覆盖或核心代码；未为七元素分别运行测试，未运行单元测试、浏览器测试、构建或性能检查。

## 后续男性两段条件动作实现

后续授权实现新增 `male-charged-aether-{anemo,geo,electro,dendro,hydro,pyro,cryo}-c0` 七个完整条件分支，各含 `-hit-1`／`-hit-2` 两个来源模板。仅新增以下五个生产文件；全局注册表、模型扩展、分类器调用和 UI 由父任务整合。

- `packages/game-data/src/character-mappings/traveler-male-charged-mappings.ts`：十四个男性模板、七种元素身份、源引用和十四项被替代 ID（七个旧首段映射与七个旧第二段阻塞）。
- `packages/game-data/src/character-mappings/traveler-male-charged-values.ts`：仅为十四个固定新映射提供男性来源向量。入口验证空的 `character:10000005`／`avatarId=10000005`、七元素天赋集合、已核准目录版本、能力身份与全部 `combat1` 参数；第二段只允许精确归档女性向量或精确核准男性向量，其余漂移阻塞。输出的 `coefficientField` 指向真实男性文件的 `auto[5]`／`auto[6]`，不谎称男性数值来自共享 `param7`。
- `packages/sim-core/src/traveler-male-charged-context.ts`：只依赖 Zod 的基础 context、逐击资格和事件 schema，由统一模型附加最终快照 schema。
- `packages/sim-core/src/traveler-male-charged-schedule.ts`：验证合法普攻后状态（计数 1–4）、重击就绪、默认体力 20、完整两段观察及每次接触；在第 9／20 帧分别生成候选与实际命中。伤害尾部为 20 帧，另列未取消动画长度 55 帧。未知不当作成功，明确两次落空不补造命中。
- `packages/sim-core/src/traveler-male-charged-formulas.ts`：每次准备恢复男性精确系数和物理重击身份；显式历史快照优先，完整动作需要逐段快照或确认面板稳定。转换后记录日程身份，改变目标／日程不得沿用旧结算。独立已发生单击只要求本击资格，不要求未来另一段接触、未来观察或完整施放证明。

状态键为 `gameContext.travelerMaleChargedCast`，候选 ID 为 `hit-1`／`hit-2`，快照键为 `sample:9`／`sample:20`。`sharedState` 与按实际 hit ID 保存的 `hitStates` 承载外部附魔、剧情重击和冰形态状态；特殊状态未知或生效时保持阻塞。准备、转换、重新准备及 JSON 共用同一套来源逻辑。

本子任务未运行测试或构建；此处记录的是已编写的实现与接口。实际覆盖数量、统一检查和页面验收结果须由父任务最终记录，不能将来源向量比较当作新实现已通过验收。

## 2026-09-25统一集成记录

公共模型、注册、来源编译、准备／转换／重置、公式AST与正常控件已接入，JSON保留实际事件、逐击状态及权威历史快照。已发生单击只检查所选命中的依赖；未选命中缺少未来记录不会阻塞本击，完整施放仍需全部资格及生命周期观察。

统一数据命令首轮通过，实际`.22`为120身份、1157命中模板、636条件完整动作、34部分动作、11阻塞，自动团队就绪0。本轮四组新增30条件完整动作，替换34旧部分动作并解除7男性来源冲突阻塞。证据见[生成](../validation/lifecycle-maxhp-data-generate.log)、[校验](../validation/lifecycle-maxhp-data-check.log)、[状态](../validation/lifecycle-maxhp-data-status.log)。

唯一新增[核心聚合](../../packages/sim-core/src/lifecycle-source-batch.test.ts)4组用例首轮全部通过（Vitest 3.08秒，墙钟3.533秒），[原始日志](../validation/lifecycle-source-batch.initial.log)和[退出状态](../validation/lifecycle-source-batch.initial.exit)保留。每组一条完整转换／JSON／独立单击链路，其余分支只核对来源排程及必要条件；没有重复旧角色套件或性能基线。运行时验收不能反向提升固定来源为游戏内实测或团队就绪。总记录见[生命周期与最大生命扩展](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。
