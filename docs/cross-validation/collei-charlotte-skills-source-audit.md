# 柯莱与夏洛蒂完整 E：固定来源、条件范围与验证

本次继续补足独立单技能计算器的自身后续伤害，不要求组队或轮转。柯莱提供无新叶、两次新叶、四次新叶三个互斥的完整条件分支；夏洛蒂提供点按、长按两个 C0–1 完整条件分支。每个完整动作仍可选择其中一个真实命中计算，命中进入现有同一伤害核心与结构化公式轨迹。

新增 9 个参数映射展开为 26 个条件命中，组成 5 个完整条件动作；替换原来的 5 个 partial 参数映射，不能把旧碎片与新动作重复算作覆盖增长。它们是明确输入条件下的 source-backed provisional 范围，不是无条件承诺角色所有命座和实战机制已完成。

## 固定来源与完整数表

- gcsim 固定提交：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；保留两角色的 `skill.go`、`asc.go`、`cons.go`、初始化和 `zz_*.dm.go`，以及公共 Snapshot、激化实际命中时 EM/反应加成读取链和 LICENSE，共 15 个源文件。
- Optimizer 固定提交：`180a0a1015cb725c7570cd828eb086749960df98`；保留两角色生产 `index.tsx`、`skillParam.json` 与 LICENSE，共 5 个原始文件。每个文件 HTTP 200，并以 Git blob SHA 与固定 tree 核对。
- 原始归档、逐文件 SHA-256、固定 Git blob 与来源字段位于 `packages/game-data/sources/collei-charlotte-skills/`。gcsim 压缩归档 SHA-256：`58bef8853affb1cbf2b8bf1f18c5e64a10a97f15683f2d1d39b4c4d92a7d4f8e`。
- 五条 T1–15 向量共 75 个系数位置，逐项比对 gcsim、活动 catalog 与固定 Optimizer；记录的最大绝对差为 0。另核对新叶固定 40% ATK、C2 持续和延长各 3 秒、夏洛蒂每名非枫丹其他队友 5% 冰伤；这些固定值不随天赋表等级放大。
- 活动数表标识仍为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，没有抓取或合并 preview 数据。活动注册表版本由整体集成统一更新。

主要可审阅来源：[柯莱 E](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/collei/skill.go)、[柯莱 A1](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/collei/asc.go)、[柯莱命座](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/collei/cons.go)、[Optimizer 柯莱](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Collei/index.tsx)；[夏洛蒂 E](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/skill.go)、[夏洛蒂 A4](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/asc.go)、[Optimizer 夏洛蒂](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Charlotte/index.tsx)。

## 柯莱：起手往返快照与回收新叶快照

固定实现中，往返两次飞叶轮伤害共用 E 释放 20 帧时的 Snapshot，回收逻辑在 157 帧重新建立新叶 Snapshot。新叶每击为 `0.4 × 回收时实际 ATK`，不是把起手面板复制给所有伤害。

`gameContext.colleiSkill` 保存回收前草相关反应、持续期间草相关反应、未中断/未额外延长确认以及完整 `sproutSnapshot`。后者包含实际回收时最终 ATK/HP/DEF/EM/暴击/ER、等级/突破、增伤、加算和反应增伤，以及来源说明。既有 `finalSnapshot` 机制将其送入同一个核心，不建另一套 UI 算式，也不从当前装备推测过去装备状态。

新叶基础期限 180 帧，首 tick 在回收后 86 帧，周期 89 帧，故本条件内是 86、175 两次；延长后的 360 帧范围为 86、175、264、353 四次。对应范围：

| 条件 | 完整分支 |
| --- | --- |
| 突破 0，A1 未解锁 | 仅往返两击 |
| C0–1、A1 已解锁，回收前无符合 A1 的草相关反应 | 仅往返两击 |
| C0–1、A1 已解锁，回收前有符合 A1 的草相关反应 | 往返两击 + 两次新叶 |
| C2–5、A1 已解锁，飞行及新叶期间都明确未触发延长 | 往返两击 + 两次新叶 |
| C2–5、A1 已解锁，飞行或新叶期间任一明确触发一次延长 | 往返两击 + 四次新叶 |

固定草相关事件列表包含月绽放；反应条件不是只看柯莱本人触发。

C2 任一时段明确触发已足够判定四次，无需追问另一个不再影响结果的时段；若两处都未明确且不能确定延长则阻断。声明回收前没有草反应，却给飞叶轮设 Spread，会阻断遗漏新叶/延长的矛盾完整动作。C2 声明两处均无反应却给新叶设 Spread 同样阻断。

另据固定 `pkg/reactable/catalyze.go` 的 `em isn't snapshot` 与 `pkg/core/combat/reaction.go`，Spread 的 EM 和反应加成取实际命中值，不自动随释放/回收 Snapshot 锁定。为保持本次静态范围诚实，只有所选命中含 Spread 才要求 `reactionStatsMatchSnapshots` 明确为 true，即各该命中实际反应 EM/加成等于其所用面板；未知时阻断，不把历史 EM 当成真实命中 EM。无 Spread 时不增加这个依赖。

只有全选整个施放才依赖完整触发和次数条件；单选飞叶轮不依赖未选新叶的历史快照，单选新叶以该次实际发生为前提，仍必须恢复新叶回收快照。直接 JSON 手改某击复制出的快照后，核心入口会按共享角色上下文重新准备，不会悄悄把一次新叶改成数套快照。

C1 的退场 ER 等状态必须在真实快照中明确包含，不默认套到当前在场面板；C3 使用用户实际有效 E 等级，新叶的固定 40% 不变；C4 对其他角色的 Q 精通不混入自身 E。C6 的 200% ATK 额外伤害尚未接入，固定 Optimizer 还保留攻击分类注记，所以完整 C6 明确阻断。

## 夏洛蒂：不同取样时点与地区 A4

点按初击取系数 `param1`，标记每击 `param3`；长按初击 `param2`，标记每击 `param6`。固定实现分别以 `360 + 0.8 × 60 = 408`、`720 + 0.9 × 60 = 774` 帧期限，90 帧周期，得到初击加 4 / 8 次标记。

初击起手快照，标记逐 tick 重新取样。因此完整条件明确要求目标存活、标记未替换/提前结束、没有额外命中停顿延长至新增 tick，并且进攻面板、装备和目标状态稳定。当前没有把一次初击数值直接宣称为任何动态战斗中的完整标记。单选一个实际命中不依赖其后续标记的持续确认。

`gameContext.charlotteSkill` 保存实际非枫丹其他队友人数、A4 是否已含、标记未中断和各次取样状态稳定。突破 4 以上实际人数必须明确为 0–3，未知不能当 0。枫丹其他队友对应治疗加成，不误作冰伤。共享 AST 公式为：

`A4 本次补入冰伤 = 0.05 × 非枫丹其他队友人数 × (1 − 已含份额标志)`

已含表示所填各击增伤已经包含当前人数对应的完整 A4；装备重新生成将记账设 false；导入最终面板时，明确突破 0–3 设 false，突破 4–6 设 true，突破未知保持原记账并由缺失突破检查独立阻断；仍保留实际人数并要求未知人数补齐。核心计算入口和装备转最终面板入口都会重新准备公式，JSON 改写复制公式不能绕过共享条件。变量、实际数值代入和中间值沿用结构化核心轨迹。

C1 仅追加治疗，不新增本次 E 自身伤害。C2 在初击后改变 ATK，C6 添加额外伤害，当前两动作仅 C0–1；C2–6 明确阻断，尚未强标完成。

## 结果边界与剩余缺口

这是固定实现、参数表与同一核心的条件数值一致性工作，没有外部 gcsim 运行或游戏实测。柯莱来源仍保留飞叶轮位置 TODO、附着/ICD 简化，夏洛蒂长按命中框为近似。本功能不认证这些源时点就是所有环境的精确帧，也不运行光环、反应触发时间线、命中几何、能量或队伍循环。

动态进攻/目标条件下的夏洛蒂逐 tick 独立上下文，以及柯莱 C6、夏洛蒂 C2–6 完整分支仍需独立接入。若新叶/标记被替换、敌人死亡或实际命中数不同，应选择真实单击；不能把未实现状态当作零伤害后仍宣称完整。

## 实际验证记录

本子任务只新增 `packages/game-data/src/character-mappings/collei-charlotte-skill-mappings.test.ts` 四项高信号测试，覆盖完整来源字节与 75 系数、真实目录中五动作、柯莱两套快照与 Spread 实际 EM 条件、C2/C6/突破边界、夏洛蒂 A4、单击选择、JSON 及装备转最终面板。

首次于 **06:05:35** 执行得到 **2 passed / 2 failed**，总 **1.30 s**，测试 **118 ms**，exit 1。来源核对和夏洛蒂全部断言通过；柯莱两项准确发现核心准备器用 `includes("-sprout-")` 判断命中时，动作 ID 本身也含 `sprout`，导致飞叶轮误套新叶 40% 系数。已修正为明确的 `-sprout-instance-` 命中后缀，并保留首跑原始日志，不调整手算期望来迁就错误实现。

修复后仅复验两项失败的柯莱目标，于 **06:06:18** 得到 **2 passed / 2 skipped**，总 **1.23 s**，测试 **85 ms**，exit 0。其余两项已经通过，没有重复执行。新增四项最终均有实际通过证据，不声称最后一次命令运行了四项。

整合时另发现展示柜导入对突破 0–3 也默认标记已含 A4 的入口错误，已按实际突破修正 `resetCharlottePanelAccounting`，并向既有夏洛蒂测试补上低突破、已解锁和未知突破断言。整体集成随后执行 `npx vitest run packages/game-data/src/character-mappings/collei-charlotte-skill-mappings.test.ts -t 'Charlotte'`；过滤匹配包含Charlotte的父级描述，实际4项再次全部通过，总1.55s、测试182ms、exit0。包括新增低突破／未知突破断言，日志为 `docs/validation/collei-charlotte-import-reset.log`。没有将这次描述成只跑一项，也未再次重跑。

原始日志和退出码：`docs/validation/collei-charlotte-skills.log`、`collei-charlotte-skills.exit`、`collei-charlotte-skills-collei-fix.log`、`collei-charlotte-skills-collei-fix.exit`。本子任务没有执行旧测试全集、build、data:status、浏览器或性能测试；整体集成的验证另据实际记录。

独立手算条件：E 释放面板 ATK 1000、CR 0.5、CD 1，角色/敌人均 90 级、抗性 10%。柯莱回收新叶面板另设 ATK 2000、CR 0.2、CD 0.5、增伤 30%；夏洛蒂为 2 名非枫丹其他队友、额外 10% 冰伤。均无反应和其他加算。

| T1 完整条件动作 | 非暴击总伤 | 期望总伤 |
| --- | ---: | ---: |
| 柯莱两次飞叶轮，`2 × 1.512 × 1000 × 0.5 × 0.9` | 1360.8 | 2041.2 |
| 柯莱飞叶轮 + 2 新叶；每次新叶 `0.4 × 2000 × 1.3 × 0.5 × 0.9` | 2296.8 | 3070.8 |
| 柯莱飞叶轮 + 4 新叶 | 3232.8 | 4100.4 |
| 夏洛蒂点按，`(0.672 + 4 × 0.392) × 1000 × 1.1 × 0.5 × 0.9` | 1108.8 | 1663.2 |
| 夏洛蒂长按，`(1.392 + 8 × 0.406) × 1000 × 1.1 × 0.5 × 0.9` | 2296.8 | 3445.2 |

这些数值是给定条件的独立算式参考，非真实角色配装或游戏实测。
