# 普通圣遗物生命周期固定源码审计（b4，2026-09-28）

前一份[装备运行时差距审计](../research/remaining-equipment-runtime-20260928.md)是实施前快照；上轮 Moonlight（月曜）与装备运行时桥接已实现。本记录只核对指定普通圣遗物在固定 b4 源码中的真实事件、状态及消费语义，不把源码实现等同于游戏实测。

固定资料根目录：`/tmp/gidps-source-host-cache/upstream/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/source/`。下表引用此目录下文件和行号。

## 源码事件顺序和修饰器消费

- `pkg/core/player/exec.go:172-195` 把 Skill 映射到 `OnSkill`，并在 `useAbility` 中先 `Events.Emit(state)`、再调用能力函数 `f(param)`。所以 Skill 订阅在能力函数执行前触发。它本身不证明能力攻击快照取样在触发前或后；特别是下方 HoD 有显式未决 TODO，Crimson 的“post snapshot”注释也与通用 dispatch 顺序需要对照具体能力。
- `pkg/enemy/attack.go:52-67` 先对攻击调用 `ApplyAttackMods`，再结算伤害；实际敌人伤害事件 `OnEnemyDamage` 在伤害应用之后、帧尾任务中发出。因此由 `OnEnemyDamage` 触发的增益不会回溯改变触发这次事件的攻击快照，只能影响事件之后尚未完成 AttackMod 应用的攻击。多个攻击若都已预先套用修饰器，同帧收到事件也不会追溯影响它们。
- `pkg/core/player/character/mods.go:20-44, 67-86, 126-159, 238-298`：`AttackMod.Amount(atk,target)` 按单次攻击标签返回向量，非匹配可以返回 nil；`ApplyAttackMods` 把向量加到该 `AttackEvent` 的 `Snapshot.Stats`。默认这就是逐击攻击加成消费点。该方法会跳过普通 reaction tag 范围；若规则要作用于 Lunar contributor，需按注释额外订阅 `OnLunarReactionAttack` 并修改各贡献者。
- `StatMod` 由 `pkg/core/player/character/stats.go:11-71, 74-94, 122-151` 在 `Stats`、`Stat`、`SelectStat` 请求时动态求值并汇入角色属性；它不是 AttackMod 的逐标签过滤。`ReactBonusMod` 是单独按 `AttackInfo` 的反应消费通道（`mods.go:36-44, 126-143`）。实现时不能把三类加成统统塞入普通伤害加成。
- 计时：`pkg/modifier/modifier.go:45-65` 中 `NewBaseWithHitlag` 以帧设到期并标记受 hitlag 延长；`NewBase` 不受 hitlag。攻击/属性消费在过期帧 `Expiry() <= currentFrame` 时跳过（`mods.go:260-267`、`stats.go:32-40`），而 `StatusIsActive` 的 `FindCheckExpiry` 在 `Expiry() == currentFrame` 仍判活（`mods.go:180-189`、`modifier.go:117-125`）。恰好到期的状态检查和实际属性消费边界并不相同。

## 各套精确条款

| 套装与源码 | 真实触发/前后台 | 效果通道、标签、数值与窗口 | 时序/源码未决点 |
|---|---|---|---|
| **逐影猎人** `internal/artifacts/marechausseehunter/marechausseehunter.go:29-47, 56-112, 114` | 二件套常驻。四件套只统计佩戴者自身且前台时的 HP 变化：`OnPlayerHPDrain` 要求 `ActorIndex` 匹配、`Amount>0`；`OnHeal` 要求治疗目标是佩戴者、佩戴者前台、实际治疗 `amount>0`，并排除全过量治疗。后台治疗/掉血不会触发。 | 二件套 `AttackMod` 只给 `AttackTagNormal`/`AttackTagExtra` +15% 伤害。四件套每个有效 HP 变化 +12% 暴击率，至多3层、5秒；刷新同一 `mh-4pc` StatMod。StatMod 是属性查询时求值。 | 新层数在 HP/治疗事件后产生，不作用于已完成的触发攻击。`OnCharacterHurt` 明确留有 TODO，故普通受击/护盾挡伤不得擅自当作本规则已实现触发。StatMod 受 hitlag 延长。
| **黄金剧团** `internal/artifacts/goldentroupe/goldentroupe.go:27-35, 45-89, 92-109` | 四件套在初始化时若持有人非前台即获得后台态；换出持有人时获得后台额外部分，换入时启动2秒延迟清理。二件套常驻。 | 二件套为元素战技/点按或长按 `AttackMod` +20%；四件套基础元素战技 +25%，后台额外 +25%（合计四件部分+50%），对同样技能标签过滤。换入后2秒才从+50%清回+25%；这不是全攻击通用静态 DMG。 | 常驻窗口用 `NewBase`；额外态由显式 swap task 清除，`lastSwap` 防陈旧 task 误清，初始化时也需模拟初始后台状态。+20%、+25%、后台额外+25%只能落到 `ElementalArt`/`ElementalArtHold` 攻击。
| **沉沦之心** `internal/artifacts/heartofdepth/heartofdepth.go:25-64` | 二件常驻；四件要求 `OnSkill` 时佩戴者当前前台。 | 二件 `StatMod` Hydro +15%；四件在 Skill 时加同 key `hod-4pc`，15秒受 hitlag 的 `AttackMod` +30%，仅 Normal/Extra。重复触发覆盖/刷新同 key。 | 源码原注释 `TODO: this used to be on Post, need to be checked`（46行）。现有事件实际上在能力函数 `f(param)` 前发出；规则应该按该固定触发顺序建模，但究竟对应何种能力快照语义仍是来源自己标出的待核点。
| **水仙之梦** `internal/artifacts/nymphsdream/nymphsdream.go:25-83, 85-108` | 二件常驻。四件五种状态分别由佩戴者前台的实际敌人伤害触发：Normal、Extra、Plunge、ElementalArt/hold、ElementalBurst；按 `ActorIndex` 和前台检查。 | 二件 `StatMod` Hydro +15%。四件各类别是独立 `480f`（8秒、受 hitlag）状态，重复同类别刷新自己的 slot；不同类别各占一层，最多取同时有效的3类。每层按源码公式：ATK% `0.09*n - 0.02`（1/2/3层=7/16/25%），Hydro +4/9/15%。动态 `StatMod`，不按单次攻击标签过滤。 | 五个 slot key (`nd-normal/charged/skill/burst/plunge`) 必须分开管理；不能把同类连续命中叠成多层，也不能把不同类窗口合并成一条共享480帧计时。敌方伤害事件后才开窗，触发那击已经结算。
| **苍白之火** `internal/artifacts/paleflame/paleflame.go:27-33, 37-97` | 二件常驻。四件仅佩戴者前台、且其 ElementalArt/hold 命中造成 `OnEnemyDamage` 时触发；0.3秒 ICD。 | 二件 StatMod 物伤+25%；四件最多2层、每层 ATK+9%，仅2层时再加物伤+25%；每个有效 proc 刷新同 key `420f`（7秒、受 hitlag）StatMod。 | 先检查有效 StatMod，已过期则层数归零；同一层数窗中计数到2封顶。触发是伤害后，层数/属性不能回填本次战技攻击；ICD 是单独 18f hitlag Status。特定帧等号时 `StatModIsActive` 与 StatMod 属性消费边界不完全一致，见上文。
| **炽烈的炎之魔女** `internal/artifacts/crimson/crimson.go:26-90` | 二件常驻。四件 `OnSkill` 只在佩戴者前台时叠，最多3层；每次 skill 事件增加一层并重置同 key 10秒窗。 | 二件 StatMod Pyro +15%；四件每层给 Pyro +7.5%（上限22.5%），用10秒 hitlag StatMod。永久 `ReactBonusMod`：Overload、Burning、Burgeon +40%；若 `AttackInfo.Amped` 则 +15%。 | 源码行46注释“post snap shot to increase stacks”，但通用 `OnSkill` 在 ability function 前发出；此注释和事件语义要对照所消费能力，不可据它声称是所有技能伤害后才触发。反应奖金不是常规逐击 `AttackMod`，应接反应公式消费。
| **花海甘露之光** `internal/artifacts/vourukashasglow/vourukashasglow.go:25-94` | 二件常驻。四件的5个独立 +8% slot 由佩戴者任意正数、外部 `OnPlayerHPDrain` 触发；无前台条件，必须 `ActorIndex` 匹配且 `External=true`。每次按循环下一个 slot 刷新。 | 二件 StatMod HP +20%；四件基础 `AttackMod` +10% DMG，及每个 +8% slot，二者都严格限 ElementalArt/hold/Burst。每个 slot 独立300f（5秒、受 hitlag），最多同时存在5个、总计最多+40% 该标签伤害；第6次起轮替覆盖最旧对应槽。 | Drain 事件之后加 slot；不会改变先前已套用 AttackMod 的攻击。务必保留五个 slot key/剩余时间，不能把触发简单归约成一个总层数定时器。源码只接受 External HP drain；不能将任意掉血、掉血百分比或护盾消耗推成该触发。

## 对生命周期整组的实现含义

已有来源足以直接建模的不是单一“每击加伤”模板，而是两类消费形态和数种状态机：按标签逐击过滤的 `AttackMod`（黄金剧团、沉沦之心、花海甘露之光、逐影猎人二件）、查询时动态 `StatMod`（逐影猎人四件、水仙之梦、苍白之火、炽烈的炎之魔女、花海甘露之光二件）、以及按反应标签读取的 `ReactBonusMod`（炽烈的炎之魔女四件）。可直接实施的一组宜先包括**水仙之梦、苍白之火、花海甘露之光**：已有精确触发条件、标签和时长，不依赖额外目标状态；但接线必须按五类/五槽分别保留状态，并在对应 StatMod 或 AttackMod 取样点消费。

逐影猎人和黄金剧团可同批实现但需要 HP/heal 实际变化语义与换人定时清理；炽烈的炎之魔女需要厘清能力 Skill 事件相对技能伤害取样点，并有独立 `ReactBonus` 消费路径。额外触发范围只有源码明确标 TODO/冲突时才标外部待核：逐影猎人受击 TODO、沉沦之心旧 Post 语义 TODO、炎之魔女的 post-snapshot 注释与通用事件顺序差异。不要把这些具体待核点扩大成整组规则都缺少来源。

本轮仅读取指定固定 b4 artifact 源码及其 character/modifier 事件与消费定义，并新增本审计；未修改生产代码或测试，未运行测试/构建。
