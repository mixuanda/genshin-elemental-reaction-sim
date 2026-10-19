# 有限次数与短冷却武器固定来源审计（2026-09-28）

范围限定为固定 gcsim b4 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 a7 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`：裁叶（Light of Foliar Incision）、猎人之径（Hunter's Path）、辰砂之纺锤（Cinnabar Spindle）。三把武器在两份来源中的 `*.go`、`config.yml` 实现目录逐文件相同；以下把来源规则与已测游戏事实区分开。

## 触发与数值的原生规则

| 武器/主证据（b4 路径；a7同路径） | 触发、输入取样与加值 | 触发击/计数、期限与冷却 | 实际接入时需保留的语义 |
|---|---|---|---|
| **裁叶** `internal/weapons/sword/foliar/foliar.go:28-79` | 常驻暴击率 `0.03 + 0.01*refine`。持有人必须前台；其 `AttackTagNormal` 且元素非 Physical 的 `OnEnemyHit` 启动状态。之后持有人 Normal、ElementalArt 或 ArtHold 每个 `OnEnemyHit` 加固定伤害 `current EM * (0.9 + 0.3*refine)`。EM 在每个计数目标命中回调现场通过 `char.Stat(EM)` 读取，不在开窗时缓存。 | 首个合格元素普攻命中先开720f（12秒、hitlag）buff及同为720f的 ICD、设28次并 `return`，所以这个激活回调不吃加值且不消费次数。激活后每个合格目标命中先加值再减一次，28次中的最后一次仍享受加值，随后删 buff；时间窗先到也会失效。 | `OnEnemyHit` 含单一 target；多目标/多命中会逐目标消费。首次命中的首个目标按代码不加，后续目标事件若已看到新 buff 则会进入消费分支，同一攻击动作可能出现目标间差异。须建模 source 回调顺序，不能把整次攻击动作粗略当一次统一 proc。
| **猎人之径** `internal/weapons/bow/hunterspath/hunterspath.go:28-80` | 常驻全元素伤害 `0.09 + 0.03*refine`。持有者 `AttackTagExtra` 的 `OnEnemyHit` 可启动；代码按 `ActorIndex` 过滤，但没有前台检查。之后每个 `Extra` 目标命中加 `current EM * (1.2 + 0.4*refine)`。EM 每个命中现场读取。 | ICD 未激活的首个 `Extra` 命中开启600f（10秒、hitlag）buff、720f（12秒、hitlag）ICD，设12次并返回；启动回调不加值/不消费。后续合格目标命中先加值、后减次数，12次中的最后一次享受加值。buff 先到期后剩余次数不可用；ICD尚未到期时不能重开。 | 与裁叶相同，次数单位是每个 `OnEnemyHit` target callback，而非玩家发起的一次 Charged Attack；一个多目标 Extra 动作中第一个目标触发且返回，之后已看到状态的目标可能消费次数/获得加值。不要自行增加 source 不存在的前台门槛。
| **辰砂之纺锤** `internal/weapons/sword/cinnabar/cinnnabar.go:21-62` | 持有者 `ElementalArt`/`ArtHold` 的每个 `OnEnemyHit` 在 ICD 不活跃时直接加 `current TotalDef(false) * (0.3 + 0.1*refine)` 到该攻击的 `FlatDmg`。DEF 在每个合格 target callback 当前帧读取；`TotalDef(false)` 通过 `SelectStat(false, BaseDEF, DEFP, DEF)` 取当前属性，`false` 不排除 Extra StatMod。 | 第一个可触发命中设置一个6f、非 hitlag `durationKey`，并排队在+6f时开始90f、非 hitlag ICD；同一次命中仍继续计算/应用 DEF 加值。`durationKey` 仅阻止重复排队，没有作为加值条件；所以在 ICD 实际开始前所有匹配命中回调均可得到加值（可按目标多次）。 | 源码注释写“技能伤害后0.1秒清除”及1.5秒 ICD；实现明确标 TODO 假设 ICD 在效果后开始。现代码是“6f queue latch + 延后90f ICD”，不应悄悄等价成一次触发/整次技能一次加值；它同样没有次数计数器。多目标、同帧多个 OnEnemyHit 与+6f排队边界需按原生顺序复现或作为来源限制说明。

`OnEnemyHit` 的事件形状是 `(target, AttackEvent)`（b4/a7 `pkg/core/event/event.go:6-10`）。`pkg/core/combat/attack.go:28-30, 45-58` 显示每个目标各复制一次 `AttackEvent` 再调用 `HandleAttack`；`pkg/enemy/attack.go:26-33` 对 `grpMult>0` 的敌人命中发事件，随后才运行 `ApplyAttackMods` 和实际伤害计算（`attack.go:52-67`）。因此同一次多目标动作中，首个目标可以启动共享持有人状态，后续目标在各自独立的事件中看到状态并获得加值/消费次数，但前一目标改写的 `FlatDmg` 不会串到下一目标。裁叶/猎人之径可在命中前修改当前 target 的 `atk.Info.FlatDmg`，辰砂的激活命中也会加值；这里的“未吃触发击”只指首先启动状态的 target callback 先 `return`，不是整次攻击动作或所有 `OnEnemyHit` 被动的一般规律。

这些状态都用 `StatusIsActive` 检查，相关回调在恰好 `Expiry == frame` 仍将状态判为 active，且前两把的buff/ICD会受 hitlag 延长；实现应复用来源时钟和相等边界，不能把720f/600f直接当不受 hitlag 的绝对墙钟。辰砂的两个状态则均不受 hitlag。武器 source callback 在 `OnEnemyHit` 处取 EM/DEF，并非伤害快照前缓存的装备面板值。

## b4/a7比较及共享标量接入建议

在上述固定两个 source commit 中，三把武器的 Go 规则文件和配置文件逐文件无差异：公式、前台过滤、次数初始化/消耗顺序、状态帧数、hitlag 标志、辰砂 +6f 延迟及 TODO 均相同。因此可以按同一套规则 ID 接入两种宿主；差异应只来自 bridge provenance 里的实际 `sourceCommit`，不能误报为机制版本差异。

可参照[固定来源普通圣遗物共享公式与捕获链路](../source-host-artifact-formulas-20260928.zh-CN.md)：公式输入与事件状态分开，源宿主仍管理触发、owner/tag 过滤、实时 EM/DEF 取样、目标次数、状态到期和冷却。三个明确可审计的标量是：

- `foliar-flat-damage`: `em * (0.9 + 0.3 * refine)`，宿主在 `foliar.go:70-71` 以当次 `OnEnemyHit` 的 EM 输入，原样加回 `atk.Info.FlatDmg`。
- `hunterspath-flat-damage`: `em * (1.2 + 0.4 * refine)`，宿主在 `hunterspath.go:71-72` 同样按每个 eligible target hit 现场取样。
- `cinnabar-flat-damage`: `totalDef * (0.3 + 0.1 * refine)`，宿主在 `cinnnabar.go:55-56` 提供实时 `TotalDef(false)`。

当前 `packages/sim-core/src/source-host-artifact-formula.ts` 的 discriminated union 和 `packages/source-host/patches/010-artifact-scalar.patch` 都只定义/接线 `artifact-scalar`。最小成组扩展位置是加入 weapon 规则输入和共享公式节点、bridge/capture 支持类型化 weapon 标量记录，再在 b4/a7 weapon source host 分别于上列 FlatDmg 计算点请求公式值。不要把它们伪装成 StatMod/AttackMod 数值：原生结果是每次命中动态读值后直接加到 `AttackEvent.Info.FlatDmg`，与普通面板属性向量不同。

首要来源风险不是公式复杂度，而是上面代码已有的计数语义：两个武器的激活回调 `return` 与逐目标重复事件形成 target 顺序依赖；辰砂把文字窗口落实成延后启动的冷却队列，并显式承认是 source assumption。共享公式只替换乘法，不可替代这些生命周期/flat damage timing； capture 也应把公式读值和实际攻击的目标、攻击标签、命中帧关联，避免把一次多目标动作错误地记为单一消费。

本轮只读取指定 b4/a7 武器源码、相应事件/DEF 取样语义及现有共享标量文档，并新增本报告；未改生产代码或测试，未运行测试/构建。
