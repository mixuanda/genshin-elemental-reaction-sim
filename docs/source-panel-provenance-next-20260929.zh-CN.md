# 固定来源面板上游来源与计时窗口边界（2026-09-29）

本说明保留实施前的来源审计与原生时序边界。其“尚未拆开的通用基础面板来源／建议的通用原生回执”已由[固定来源初始基础面板回放](source-base-panel-20260929.zh-CN.md)实现并取代；后续引用以新报告和测量为准。其余关于伤害共享算术及原生计时窗口的历史结论仍仅适用于下文固定样本。

## 已经能复现的命中算术

两条固定来源通道的状态关联捕获分别保存在[classic capture](./validation/status-owner-classic-20260929.capture.json)与[stellar capture](./validation/status-owner-stellar-20260929.capture.json)。该组样本共观察38个已结算命中。命中记录保存原请求、数值输入和回执；保存的 native capture 本身不含共享公式 trace。页面将其送入共享核心时，可以重新构造公式、变量值、代入与中间结果。

例如，行秋 `Guhua Sword: Fatal Rainscreen 0` 在46帧的命中请求 #10（E首击）记录了基础攻击656.1404849、攻击百分比0.24、固定攻击200，缩放攻击力1013.614201276，攻击倍率1.68，基础伤害加成为0。基础面板现在可沿初始构造回执展开为角色201.7773324与武器454.3631525，合计656.1404849；面板合成这一步为：

`656.1404849 × (1 + 0.24) + 200 = 1013.614201276`

请求还记录伤害加成0.2、敌人等级90、抗性0.1、暴击率0.25、暴击伤害0.9及本次实际非暴击结果。`packages/sim-core/src/source-host-formula.ts` 的 `runDamage` 已为缩放属性、天赋基础项、FlatDmg、普通伤害核心和后续乘区生成共享执行轨迹，并核对公式输出与原生记录。因此本次缺口不是这条命中的下游普通伤害代数或数字代入。

此样本的水伤加成0.2也有实际属性读取步骤和公式记录 #9。固定来源角色规则表明确标注行秋 A4 的0.2值；在原生属性回执中能沿 `formulaCalculationIds` 连接到该共享角色公式。它不是本次命中的未解析面板叶值。

## 尚未拆开的通用基础面板来源

本击真正仍未逐项说明的是伤害读取前已聚合的基础面板叶：基础攻击、攻击百分比和固定攻击的各自生产来源。共享核心把它们作为公式输入，能验证最终攻击力，但不能仅凭最终向量还原各项从何而来。不得把已有的精确命中重放称为完整上游面板解释。

固定来源 b4 的 `UpdateBaseStats` 在角色修饰器初始化前，按以下顺序组成基础面板：

1. `CharacterProfile.Stats` 已保存的作者输入加值；
2. `AvatarBaseStat` 根据角色目录行、等级曲线、最大等级对应的晋升属性及默认属性生成的向量；
3. `WeaponBaseStat` 根据武器目录基础属性、武器等级曲线、最大等级对应的晋升属性生成的向量。

之后角色 `Init`、武器 `Init` 和套装初始化才会注册动态修饰器。运行时 `StatsWithProvenance` 会记录真实读取及每项 modifier 返回量、前后值和调用顺序；闭包内部表达式仍需沿对应公式 ID 单独解析，不能用差值猜测。

对应的固定源码文件与入口：

- `pkg/core/player/character/character.go`：`New` 将 `CharacterProfile.Stats` 复制进 `BaseStats`。
- `pkg/core/player/player.go`：`InitializeTeam` 先对全队运行 `UpdateBaseStats`，再初始化角色、武器和套装。
- `pkg/core/player/character/basestat.go`：`UpdateBaseStats`、`AvatarBaseStat`、`WeaponBaseStat`；公式使用角色或武器的等级索引、目录 growth curve 及 `MaxLevel` 命中的 promo row。角色基础 HP/ATK/DEF 为目录基值乘对应等级曲线，EM 与默认 ER/CD/CR 来自角色基行，晋升附加属性再逐项相加；武器每个基础属性为初始值乘曲线值，之后加入晋升属性。
- `pkg/gcs/parser/parseCharacter.go`：`parseCharAddWeapon` 解析武器 key、等级、最大等级和精炼；`parseCharAddStats` 将配置中的数值逐项累计到 profile 向量及标签向量。
- `pkg/core/player/character/stats.go`：`StatsWithProvenance` 实际运行 StatMod 列表，并保存本次 getter 的准确顺序和数值回执。
- Classic 固定来源目录清单见 `apps/web/public/source-host/manifest.json`，其来源 revision 为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；stellar 清单 `apps/web/public/source-host-stellar/manifest.json` 固定到 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。每条回执须引用自身通道的 revision 和执行产物身份，不能跨 revision 借用目录值。

## 建议的通用原生回执

由固定来源宿主在 `UpdateBaseStats` 实际执行时发出结构化配方面板回执，并在逐击快照中引用该回执 ID。回执需保存并闭合以下内容：

- 角色与武器身份、profile 中实际使用的等级和最大等级；
- 角色基础目录行、等级索引、HP/ATK/DEF 曲线 key、曲线乘数、逐项乘积、选中的晋升行及加值；
- 武器基础属性行、每项属性的初始值和曲线 key/等级索引/乘数/乘积、选中的晋升行及加值；
- 作者提供的 `add stats` 实际向量与标签来源；对 `add stats random` 保存声明的随机配置、归一化种子/来源 RNG 身份和实际抽得向量，或明确把抽得向量标为外部随机输入；
- 按真实执行顺序的向量等式：`profile stats → 加角色目录贡献 → 加武器目录贡献 → 实际 BaseStats`，每一阶段都给出前值、分量和后值并核对一致；
- 来源 revision、目录行身份、曲线表身份、回执版本与 actor index。

精炼等级应留在 profile 身份中，但基础武器面板公式不应因此臆造精炼属性；精炼影响由其具体武器规则另行说明。用户输入的最终面板不能再次当成配置增量。缺失目录字段或不支持的配置必须以明确的未展开输入保留，不从最终总值反推。

## 解释边界分开报告

全局 `explanationStatus="partial"` 当前在共享来源结果构造处固定写入；通用说明将面板闭包、来源模拟实现的游戏机制置信度及任意帧 checkpoint 缺失合并显示。这些是不同范围：

- **单次算术与数据来源：** 共享核心可完整展示它已收到的实际数值变量和逐步算术。上游面板仍聚合时，只有面板来源这一段是不完整；固定来源 modifier 闭包也可能各自留下具体缺口。
- **游戏机制置信度：** 固定来源 gcsim 实现及其角色逻辑是第三方固定源码，不等于正式服全机制已独立验证；精确重放不能提升此项置信度。
- **执行状态恢复：** 当前 `checkpoint=false`，不代表一次已捕获命中的算术 trace 无法重算；它表示没有通用的任意中途帧完整运行状态恢复。
- **回执身份元数据：** native capture 存的是原请求与值；共享公式 trace 在复算时生成。两者应分别标明“已保存的实际输入”和“由共享核心构造的推导”，不能声称 capture 文件已携带保存的逐步解释。

因此本工作方向仅把精确固定来源基础面板的构造步骤连入现有数值来源图；不据此宣布全角色闭包、完整战斗状态恢复或游戏内验证已完成。

## 原生时长与子窗口帧边界

固定来源 `pkg/simulation/run.go` 的 `nextFrame` 先将 `F` 加一，再运行 `Tick`、能量／受击处理及 `OnTick`，之后才检查停止条件。定时模式在处理 `F == duration × 60` 后结束；结果以该 `F` 作为 duration，原生总伤是执行期间的全部伤害，DPS 为 `total_damage × 60 / F`。因此端帧 `T` 的事件会在停止前结算；如果某次来源初始化在 `F=0` 同步产生伤害，该事件也可能进入总量，而时间分母仍是 `T` 帧间隔。

来源运行结果页面在 `apps/web/src/source-host-panel.ts` 对全部 application 求和并除以 native duration；这与原生汇总口径一致，没有在当前状态关联样本中观察到 `F=0` 命中造成差异。该样本首个命中在20帧。

按前后窗或预热后窗口统计时，`apps/web/src/source-host-energy-analysis.ts` 按原生 `energy_status[F-1]` 定义帧状态，窗口为半开帧区间。例如无预热的全段按 `[1,T+1)` 覆盖 tick 帧1至T；前后窗和预热窗口也由这些相邻边界构造。这些子窗口排除 `F=0`，包含 `F=T`。所以如果其他脚本在初始化帧同步结算命中，页面原生总量仍与 Go 汇总一致，但由 tick 窗累加的分窗伤害不会包含该初始命中；这是指标窗口边界的范围差，不是本次 fixture 已复现的数值错误。展示来源 DPS 时应同时说明总量与帧区间口径，避免把原生整次结果误读成严格的半开 `[0,T)` 事件过滤。
