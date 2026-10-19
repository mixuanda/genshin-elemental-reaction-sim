# 固定来源宿主的属性贡献导出方案

2026-09-25后续实施说明：通用属性读取、snapshot、攻击增量及TS逐项重算已按限定范围交付，实际范围和验收见[来源宿主增量报告](source-host-lunar-provenance-20260925.zh-CN.md)。下文保留提出设计时尚未实施的原始时点；未落地的ReactBonus／抗防分项、跨角色关联及闭包内部推导不因设计存在而计作完成。

本文先记录对实际 Go 数据流的只读设计，不是已交付报告。后续获准实施的最小范围见末节；未运行构建或测试。目标是在原来的那一次求值中记录真实贡献，不为了导出再次调用 `Stats`、`Stat`、`NonExtraStat`、`SelectStat`、`Amount`、`ReactBonus`、`Snapshot` 或 RNG。

源码基准为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，本地原树 `/tmp/gidps-gcsim-b4ae769`。下文未加前缀的 Go 路径和行号均指该固定原树；`packages/source-host/...` 指本仓库当前覆盖文件，行号可能随并行月曜接线变化。实现应匹配函数锚点，不依赖临时目录或行号执行补丁。

## 1. 最小交付边界

先做一份 `stat-provenance-v1` 数值贡献图：每次真实读取的基础向量、每个实际调用的 modifier 返回量、逐步累计值、取样帧、原始 key、当时 expiry、筛选条件及父子读取关系；将它随真实快照和命中请求带入同一共享 AST。

这能把“最终 ATK/EM/增伤是多少”推进到“哪个实际 modifier 在哪一帧贡献多少，如何累加成最终值”。通用 hook 无法恢复任意 Go 闭包内部的代数表达式、捕获变量、触发历史或消耗规则。因此 `fullModifierDerivation` 仍为 `false`，整体解释仍允许 `partial`；数值贡献的完整性与闭包公式的完整性应分开表述。

## 2. 实际求值顺序与精确 hook

| 固定文件与行 | 真实行为 | 插入位置与记录内容 |
| --- | --- | --- |
| `pkg/core/player/character/stats.go:18` | `Stats()` 复制 `BaseStats` | 读取起点：复制原始基础向量，不调用任何 getter。 |
| 同文件 `:32`、`:36–40`、`:69` | 按列表顺序检查 expiry；调用一次 `Amount()`；逐项相加；最后清理过期 modifier | 在原分支记录 `expired`；在原 `Amount()` 前记录元信息与累计量，返回后立即复制返回切片，完成原加法后记录累计结果。保持原列表遍历和清理位置。 |
| 同文件 `:75`、`:82–88` | `Stat(s)` 按 `AffectedStat` 筛选，只累加一个属性 | 记录实际 selector、mismatch/expiry 分支和原返回切片中的 `amt[s]`，不能把一次 scalar read 冒充全属性读取。 |
| 同文件 `:97`、`:104–114` | `NonExtraStat(s)` 还排除 `Extra` | 额外记录 `extra-excluded`；不能用 `Stats()` 最终值倒推出非额外属性。 |
| 同文件 `:124–146` | `SelectStat(nonExtra, stat...)` 按原 selector 顺序累加 | 保留 selector 原顺序与重复项语义；每个 modifier 仍只调用一次 `Amount()`，只记录实际参与加法的槽位。 |
| 同文件 `:154–166` | `MaxHP/TotalAtk/TotalDef` 调用 `SelectStat` 后执行纯计算 | 将该次 SelectStat 读取关联到其纯属性公式；不再读取角色属性。 |
| `internal/template/character/character.go:56–96`，关键 `:76` | 真正生成 snapshot；只调用一次 `c.Stats()`；随后可能附魔 | 用显式采样 scope 包围 `:76`，将该 scope 的根 Stats read ID 保存到返回的 `info.Snapshot`，同时保留 `SourceFrame`。 |
| `pkg/core/attack.go:85–86` | 调用具体角色的 `Snapshot` 实现，可能在通用 snapshot 之后继续修改 | 返回后将实际 snapshot 与它引用的 Stats 结果比较；保存差异为 `snapshot-postprocess`，不能按零差异之外的情况声称全由 StatMod 组成。 |
| `pkg/core/attack.go:7–29`、`:32–33`、`:89` | 接收手工快照、已生成攻击或延迟攻击 | 在现有 queue 入口记录实际 snapshot/provenance 引用。`QueueAttackWithSnap` 必须沿用传入快照的原采样，不重采样。 |
| `pkg/core/combat/attack.go:28–30` | 对每个目标复制整个 AttackEvent 后执行命中 | 原 snapshot provenance 可共享不可变记录；目标级记录必须写入新的目标 scope，不能往共用 slice 底层数组追加而串到其他目标。 |
| `pkg/enemy/attack.go:26–60` | `OnEnemyHit` 在 `ApplyAttackMods` 之前执行，随后进行反应及伤害计算 | 分别保存 entry、OnEnemyHit 后、AttackMod 后的数值边界，保留同一 `attackId + targetKey`。 |
| `pkg/core/player/character/mods.go:238–268` | 先按 attack tag 整体跳过部分反应；每个 AttackMod 的 `Amount(a,t)` 可以读实际攻击和目标 | tag 跳过是“不适用”，不是零贡献。`:264` 前后保存数值字段；`:266–268` 单独记录返回向量的真实加法。 |
| 同文件 `:370–392`，关键 `:382–383` | `ReactBonus` 从 0 开始，逐 modifier 调用一次并相加，还会清理过期项 | 保存各 scalar 返回值、0 起点、逐步 sum 和取样 scope。返回 0 只能说明实际贡献为 0，不能推断闭包条件为何未满足。 |
| `pkg/enemy/mods.go:100–117`、`:137–153` | 目标抗性和防御调整从基础值/0累加 `ResistMod.Value`、`DefMod.Value` | 两者没有 Amount 闭包，可直接记录 key、element、expiry、Value 与逐步 sum；保留原 expiry 判断。 |

必须保留三种时间：`sourceFrame`（攻击入队来源）、`snapshotFrame`（原属性取样）、`readFrame`（本次 live modifier/目标/反应加成读取）。它们不能都替换为命中帧。相同帧内用单调 `readId/stepIndex` 保留顺序。

当前源的到期语义也不能统一改写：角色属性/攻击/反应读数在 `expiry == frame` 时不应用，`-1` 表示永久；`modifier.FindCheckExpiry`（`pkg/modifier/modifier.go:117–126`）却把相等视为仍存在。敌方 `resist/defAdj` 原判断是 `expiry > frame`，没有角色读取的 `-1` 特例。导出记录各入口实际走过的分支，不借机修正来源机制。

## 3. 建议的最小记录结构

类型放在低层 `pkg/core/info` 的独立文件中，只有数值、字符串、数组和 ID；避免 `info → sourcehost → info` 循环依赖。记录收集器由现有 `sourcehost.Bridge` 持有，未安装 host 时不做记录。

```ts
type StatRead = {
  id: number;
  parentReadId?: number;
  parentModifierStep?: number;
  scopeId?: number;
  kind: "stats" | "stat" | "non-extra-stat" | "select-stat"
      | "attack-mods" | "reaction-bonus" | "resistance" | "defense-adjustment";
  actorIndex?: number;
  targetKey?: number;
  frame: number;
  selector?: number[];
  nonExtra?: boolean;
  base: number[];       // 对 scalar read 只有其实际槽位；不是补出的全属性面板
  steps: ModifierStep[];
  result: number[];
};
type ModifierStep = {
  index: number;        // 本次原始遍历顺序，不以 key 去重
  key: string;
  expiryBefore: number;
  expiryAfter?: number; // 仅闭包执行后发生变化时保存
  affectedStat?: number;
  extra?: boolean;
  affectedByHitlag?: boolean;
  outcome: "applied" | "returned-nil" | "expired"
         | "stat-filtered" | "extra-excluded";
  before?: number[];
  returned?: number[]; // 原 Amount 返回量的立即拷贝；nil 不伪装成全零
  after?: number[];
  attackMutations?: NumericFieldChange[];
  childReadIds?: number[];
};
```

记录应保留原 Float64 数值，不能读取 `PrettyPrintStatsSlice` 的格式化字符串；该函数 `pkg/core/attributes/stats.go:66–80` 会按两位小数输出。复制返回切片是必要的：例如绝缘的闭包复用并写入同一个 `m`，下一次调用会覆盖先前切片的内容。

`key` 不是跨时间的唯一实例 ID：`modifier.Add`（`pkg/modifier/modifier.go:86–105`）会替换相同 key。最小版使用 `(readId, step.index)` 唯一标识本次观察，不假装它是长期 buff 实例。`Expiry()`（同文件 `:28`）已经包含 hitlag extension；保存其实际值即可满足“本次何时到期”。初版不承诺创建帧、完整刷新链或推断持续时间。需要生命周期时，后续再在 `AddStatMod/AddAttackMod/AddReactBonusMod` 和 `Extend/Delete` 的原执行点分配 generation ID，不用日志事件指针当身份。

## 4. 不重复求值的绑定方法

1. 在 Bridge 增加同步、可嵌套的读取 scope。进入现有 Stats/Stat/SelectStat/Amount 时压入一个 read/step ID，退出后弹出；内部实际触发的读取自然成为子记录。只记录调用关系，不宣称子读取的每个返回值都被闭包公式使用。
2. 通用 `Snapshot` 在原 `c.Stats()` 前开一个具名采样 scope，执行原调用，结束 scope 后把根 Stats read ID 存进 `info.Snapshot.SourceHostStatReadID`。不能用“此角色最近一次 Stats”缓存关联；闭包内嵌套读取及多个部署物会使它错误。该方案不改 `Stats()` 原公共返回签名。
3. 命中 scope 在 `Enemy.HandleAttack` 入栈，携带已有 `SourceHostAttackID` 和当前 target key；`ApplyAttackMods`、ReactBonus、目标抗性/防御读取全部关联到此 scope。嵌套攻击需嵌套 scope，不能覆盖父攻击的当前 ID。
4. 现有反应公式边界在**原来的** `src.ReactBonus(...)` 外开 scope，紧接该次返回取其 read ID。当前 classic patch 已将原内联调用拆成 `bonus := src.ReactBonus(...)`（`packages/source-host/patches/001-authoritative-formula-boundary.patch` 的 `CalcReactionDmg/CalcCatalyzeDmg` hunk）；增幅入口是 `packages/source-host/go/pkg/enemy/sourcehost.go` 的 `calcSourceHost`。月曜 contributor 同样只接收原调用记录，不增加 ReactBonus 读取。
5. 本击请求传输所有被引用读取的不可变闭包：snapshot read、目标命中 scope、直接反应 read 及其子记录。最终运行记录可另外保存全部读数供诊断；独立 capture 必须自行包含被引用的记录，不能要求加载整个原运行。
6. 在 `sourceHostDamageRequest` 最后附加数值 provenance，继续用实际 `SnapshotFields`、原始 Stats 和 `Input` 作为计算上下文。当前函数 `packages/source-host/go/pkg/enemy/sourcehost.go:78–91` 已复制实际快照；`Bridge.Resolve` 的 JSON 冻结在 `packages/source-host/go/pkg/core/sourcehost/bridge.go:87–114`，导出记录应在冻结之前纳入请求。

EM 等 scalar 已作为数值参数传入某些反应 helper 时，该 helper 无法自动知道数值来自哪一次读取。最小实现可以完整链接它内部这一次 ReactBonus，但 EM 的上游 read ID 必须在原调用端通过显式 scope/参数传递；未接入的参数继续标作实际观测输入，不能根据“同角色、同帧、同数值”猜关联。手工构造的 snapshot 没有 Stats read ID 也同理：保存实际字段并明确未捕获上游。

为区分 AttackMod 返回量与它直接修改攻击的行为，`:264` 前保存 `Snapshot.Stats` 及伤害相关标量，原 Amount 返回后再保存一次，最后运行原向量加法。于是可分别显示“闭包直接修改”和“返回增量相加”。标量至少包括 `Mult/FlatDmg/BaseDmgBonus/Elevation/IgnoreDefPercent`，另保留 element 与攻击标签变化；不深复制 Callback、Target 或运行时闭包。

## 5. 可以进入共享 AST 的部分

共享解释必须从原始 receipt 重建可执行表达式，不能只把 Go 日志打印为公式。

| 输入证据 | 可执行节点 | 解释能力 |
| --- | --- | --- |
| 原基础向量与按原顺序捕获的返回增量 | `s0 = base; s1 = s0 + delta1; ...`；每个节点定义属性、modifier key、读数帧/expiry、数值代入和中间结果 | 对本次真实增量与累计关系完整；delta 的闭包内部公式仍可能不透明。 |
| `SelectStat` 输出 | `ATK = BaseATK × (1 + ATKP) + ATK`，HP/DEF 同理；来源 `pkg/core/attributes/stats.go:49–51` | 纯属性合成完整。保留原乘加顺序，不把它改写成数值近似的其他顺序。 |
| ReactionBonus 每项返回值 | `r0 = 0; ri = r(i-1) + modifier_i` | scalar 累计完整；不把 0 标注为已证明的“条件不满足”。 |
| 目标 ResistMod/DefMod 的 Value | 基础抗性或 0 加各实际 Value；随后独立显示真实 clamp | 没有 Amount 闭包的加法可完整解释；上游为何创建该 mod 不由此证明。 |
| 命中最终快照与实际 crit clamp | 既有共享伤害公式；CR `clamp(x,0,1)` 作为单独节点 | 用读数图的输出连接当前伤害输入，避免重复加成。 |
| 已观察的直接 mutation | 保存 before/after，并把 `after-before` 标为“观察差值” | 可核对数值去向，但不是来源闭包公式；不能伪装成可随任意属性编辑而重算的被动。 |

当前 TS 接入点是 `packages/sim-core/src/source-host-formula.ts:46` 的 `runDamage`：在 `sourceScalingStat` 之前导入贡献节点，把对应输出接到该节点。`sourceFlatDamage` 仍需保留尚未解释的余项。已有 `assertSourceHostNumber` 可比较记录的累计结果与真实 snapshot/input，不另造第二套伤害核心。

编辑后的独立最终属性仍执行既有 `explicitFinalScaling` 路径；原始 provenance 作为历史上下文展示。除非某个被动已经有已核对的纯 AST，修改 ATK/EM 后不能沿用旧 delta 并声称重新执行了原闭包。由共享伤害核心进行反事实数值计算时应明确这一边界。

## 6. 通用 hook 仍然不透明的具体位置

- **绝缘转增伤闭包**：`internal/artifacts/emblem/emblem.go:46–57` 实际调用 `NonExtraStat(ER)` 后执行 `min(ER × 0.25, 0.75)`。通用 hook 可记录子 ER 读取、原 modifier 返回值和加法；要显示这条 min 公式，需给该来源 key 增加经过核对的专用表达式描述，不从返回数值反推。
- **角色 snapshot 后处理**：魈 `internal/characters/xiao/xiao.go:62–90` 在通用 snapshot 之后直接给 DmgP 加 Q 等级系数。通用 Stats hook 不含此项。core queue 边界能看到差值；只有补该实际源码行的表达式标记才能说明它的天赋来源。
- **OnEnemyHit 直接加算**：赤角 `internal/weapons/claymore/redhorn/redhorn.go:40–52` 读取实时 DEF 并加 FlatDmg；辰砂 `internal/weapons/sword/cinnabar/cinnnabar.go:34–60` 还维护状态与延迟任务；余响 `internal/artifacts/echoes/echoes.go:60–117` 有 RNG、概率与 ICD 更新。它们不经过 ApplyAttackMods，单挂 Amount 不能覆盖。
- **事件闭包本身**：`pkg/core/event/event.go:165–169` 调用具备 key 的真实 `v.f(args...)`。若下一步需要精确“哪个订阅者改了哪个数值”，可只在 `OnApplyAttack/OnEnemyHit` 的该原调用前后挂记录器，记录订阅 key 和实际攻击字段差值；不能新加另一个同名订阅来包围旧调用，也不能再次调用 `v.f`。事件订阅没有通用 expiry，必须为未知/不适用，不能填 `-1` 冒充永久 modifier。闭包内 RNG、私有计数与任务队列仍不可由差值恢复。
- **原始基础面板来源**：`pkg/core/player/character/character.go:154–155` 将输入 `p.Stats` 合入 BaseStats，可能已包含用户提供的圣遗物合计，不能虚构分件来源。`basestat.go:18–24`、`:32–38` 已分别得到角色/武器基础向量，若需要进一步拆基础来源，可在这两个原加法循环直接记录；成长曲线与突破的完整公式则来自同文件 `AvatarBaseStat:73–100`、`WeaponBaseStat:103–126`。初版可把 BaseStats 作为明确的读取起点，不声称已经展开所有底层数据。

## 7. 建议实施顺序与文件归属

先新增独立的属性 provenance Go 类型/收集器和单独 patch：只覆盖 Stats/Stat/NonExtraStat/SelectStat、通用 Snapshot、ApplyAttackMods/ReactBonus、目标 resistance/defense、命中绑定。随后再由统一 owner 给现有 Request/Wire/Capture 加引用闭包，最后在共享 TS AST 消费 receipt。这样不用逐角色改写原公式，也不与当前月曜公式 patch 并行重写同一段代码。

基础面板逐项来源、事件订阅闭包的公式、角色 snapshot 特殊后处理、可恢复的整个来源 checkpoint 仍是独立缺口；这些不应随着通用加法贡献导出自动变成“完整解释”或“已验证机制”。

后续已按授权编写最小生产范围，等待根任务统一构建：`003-stat-provenance.patch`、`go/pkg/core/sourcehost/provenance.go` 和 `packages/sim-core/src/source-host-stat-provenance.ts`。实际采用 `StatsWithProvenance` 返回明确记录的方案，保留原 `Stats()` 公共接口；覆盖 Stats、同角色嵌套 Stat/NonExtraStat/SelectStat、通用 Snapshot 与 ApplyAttackMods，目标记录采用写入时复制。现有 `SnapshotFields` 导出 `statProvenance`。ReactBonus、敌方 res/def 逐项、跨角色闭包依赖及事件内部来源尚未纳入这一最小实现；上面的相应 hook 仍是后续设计。
