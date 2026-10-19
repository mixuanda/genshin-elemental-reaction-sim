# 24 套普通圣遗物常量条款来源审计（2026-09-28）

范围为固定 b4 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 a7 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 的以下24个 artifact Go 构造器：berserker、blizzard、bloodstained、bolide、braveheart、defenderswill、desertpavilionchronicle、exile、gambler、gladiator、instructor、lavawalker、maiden、martialartist、noblesse、reminiscence、scholar、sojourner、tenacity、thundersoother、wanderer、deepwood、viridescent、oceanhuedclam。两版本里这24个 `.go` 文件逐一比较后，22个相同；差异限 Blizzard 与 Viridescent，详列于后。这里的“可桥接”仅指把 Go `StatMod.Amount`/`AttackMod.Amount` 实际返回的数值交给共享标量公式/解释；触发、分支、受益对象、持续与消费仍归原生事件生命周期所有。

## 候选常量与 gate

路径根：`/tmp/gidps-source-host-cache/upstream/{b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541,a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd}/source/internal/artifacts/`。下表行号按 b4，同名路径适用于 a7；只有版本差异处另注。slot 使用源码 `attributes` 字段名。Key 是实际 modifier key；所有二件/常驻项都由件数门槛安装。

| 套装/源码行 | `StatMod.Amount` / `AttackMod.Amount` 常量候选 | modifier key / slot | 源码 gate（必须保留在 Go） |
|---|---|---|---|
| Berserker `berserker/berserker.go:23-46` | 2pc `0.12`；4pc `0.24` | `berserker-2pc` Stat/CR；`berserker-4pc` Attack/CR | 4pc `char.CurrentHPRatio() <= 0.7`，逐次 AttackMod 求值。
| Blizzard `blizzard/blizzard.go:25-61,63-84` | 2pc `0.15`；4pc 冻结目标 `0.40`、仅 Cryo aura `0.20` | `bs-2pc` Stat/CryoP；`bs-4pc` Attack/CR | 对当前 target 检查 Frozen 优先于 Cryo；无 aura 返回 nil。Lunar reaction contributor 有单独 CR snapshot 回调，hook 版本变化见下文。
| Bloodstained Chivalry `bloodstained/bloodstained.go:29-39,42-85` | 2pc `0.25`；4pc `0.50` | `bloodstained-2pc` Stat/PhyP；`bloodstained-4pc-dmg%` Attack/DmgP | 4pc 仅己方持有人击杀敌人且持有人在场后装入600f hitlag AttackMod；只对 `AttackTagExtra` 返回。另有 Charged Attack 体力减免（非 Stat/Attack Amount）。
| Retracing Bolide `bolide/bolide.go:24-44` | 4pc `0.40` | `bolide-4pc` Attack/DmgP | 只 Normal/Extra，且来源要求该持有人受盾 (`CharacterIsShielded(holder, active)`)。2pc `0.35` 是 ShieldBonusMod，不属于本次 Stat/Attack 范围。
| Brave Heart `braveheart/braveheart.go:24-59` | 2pc `0.18`；4pc `0.30` | `braveheart-2pc` Stat/ATKP；`braveheart-4pc` Attack/DmgP | 4pc target 必须是敌人且 `HP/MaxHP > 0.5`；仅在 `DamageMode` 安装。
| Defender's Will `defenderswill/defenderswill.go:24-40` | 2pc `0.30` | `defenderswill-2pc` Stat/DEFP | 4pc明示 TODO/not implemented（四种不同元素对应自身抗性+30%）；不得作为已有常量回调桥接。
| Desert Pavilion Chronicle `desertpavilionchronicle/desertpavilionchronicle.go:25-82` | 2pc `0.15`；4pc `0.10`、`0.40` | `desert-2pc` Stat/AnemoP；`desert-4pc-spd` Stat/AtkSpd；`desert-4pc-dmg` Attack/DmgP | 4pc由持有人 `OnEnemyDamage` 且 `AttackTagExtra` 触发，持续900f hitlag；AtkSpd 的 Amount 仅 `CurrentState()==NormalAttackState` 时返回，AttackMod 仅 Normal/Extra/Plunge。
| The Exile `exile/exile.go:23-73` | 2pc `0.20` | `exile-2pc` Stat/ER | 4pc Burst 后给其他队员2能量、120f间隔共三次；无 Stat/Attack Amount。多持有者是否延时保留源码 TODO。
| Gambler `gambler/gambler.go:31-44` | 2pc `0.20` | `gambler-2pc` Attack/DmgP | 精确只筛 `AttackTagElementalArt`（不含 Hold）；4pc击杀回战技冷却是非标量功能回调。
| Gladiator's Finale `gladiator/gladiator.go:20-46,55-64` | 2pc `0.18`；4pc `0.35` | `glad-2pc` Stat/ATKP；`glad-4pc` Attack/DmgP | 4pc仅 Spear/Sword/Claymore 武器类安装，且仅 Normal tag 返回。
| Instructor `instructor/instructor.go:23-70` | 2pc `80`；4pc `120` | `instructor-2pc` Stat/EM；`instructor-4pc` Stat/EM（全队） | 4pc订阅 reaction event 区间；要求持有人前台且反应攻击的 `ActorIndex` 为持有人；对全队添加480f hitlag StatMod。多持有人是否刷新/延时 TODO。
| Lavawalker `lavawalker/lavawalker.go:24-43` | 4pc `0.35` | `lavawalker-4pc` Attack/DmgP | target 必须为 Reactable 且当前有 Pyro aura。2pc只写“not implemented”日志，无数值实现。
| Maiden Beloved `maiden/maiden.go:24-60` | 2pc `0.15` | `maiden-2pc` Stat/Heal | 4pc是所有队员 `HealBonusMod` `0.20`，触发者前台施放 Skill/Burst 后600f hitlag；不属于本次 Stat/Attack Amount 范围。
| Martial Artist `martialartist/martialartist.go:27-60` | 2pc `0.15`；4pc `0.25` | `martialartist-2pc` Attack/DmgP；`martialartist-4pc` Attack/DmgP | 两者只 Normal/Extra；4pc在持有人前台使用 Skill 后480f hitlag安装。
| Noblesse Oblige `noblesse/noblesse.go:42-90` | 2pc `0.20`；4pc `0.20` | `nob-2pc` Attack/DmgP；`nob-4pc` Stat/ATKP（全队） | 2pc只 Burst tag；4pc持有人前台 OnBurst 后给全队720f hitlag。原注释标记“used to be post, need to check”；自施放特殊角色可延迟1帧，刷新时是否 snapshot 仍 TODO。
| Shimenawa's Reminiscence `reminiscence/reminiscence.go:29-80` | 2pc `0.18`；4pc `0.50` | `shim-2pc` Stat/ATKP；`shim-4pc` Attack/DmgP | 4pc仅持有人前台、当前能量至少15、10秒 ICD 未激活时 Skill 触发；延迟10f扣15能量，buff为600f hitlag，限制 Normal/Extra/Plunge。事件原生状态和延迟不能从标量公式派生。
| Scholar `scholar/scholar.go:23-58` | 2pc `0.20` | `scholar-2pc` Stat/ER | 4pc持有人前台收到粒子且180f ICD不活跃时，给队伍中 Bow/Catalyst 角色各3能量；非 Stat/Attack Amount。
| Resolution of Sojourner `sojourner/sojourner.go:24-47` | 2pc `0.18`；4pc `0.30` | `sojourner-2pc` Stat/ATKP；`sojourner-4pc` Attack/CR | 4pc仅 `AttackTagExtra`。
| Tenacity of the Millelith `tenacity/tenacity.go:33-79` | 2pc `0.20`；4pc `0.20` | `tom-2pc` Stat/HPP；`tom-4pc` Stat/ATKP（全队） | 4pc持有人自己的 Skill/Hold `OnEnemyDamage` 且30f hitlag ICD未激活时，对全队装入180f hitlag ATK StatMod。+30%盾强另属 ShieldBonusMod；源码 TODO 说该部分未随 hitlag 延长。
| Thundersoother `thundersoother/thundersoother.go:24-44` | 4pc `0.35` | `ts-4pc` Attack/DmgP | 当前目标 Reactable 且有 Electro aura。2pc只写 not-implemented 日志，无数值实现。
| Wanderer's Troupe `wanderer/wanderer.go:21-44,56-65` | 2pc `80`；4pc `0.35` | `wt-2pc` Stat/EM；`wt-4pc` Attack/DmgP | 4pc仅 Bow/Catalyst 武器类安装，且只 Charged (`AttackTagExtra`)。
| Deepwood Memories `deepwood/deepwood.go:26-64` | 2pc `0.15` | `dm-2pc` Stat/DendroP | 4pc不是角色 Stat/Attack Amount，而是逐 target `ResistMod -0.30`；持有人 Skill/Hold/Burst 敌人伤害命中即可，允许后台，480f hitlag。
| Viridescent Venerer `viridescent/viridescent.go:29-63,65-129` | 2pc `0.15` | `vv-2pc` Stat/AnemoP | 4pc `ReactBonusMod +0.6` 是独立反应奖金类型（排除 Amped/Catalyzed，只接受普通 Swirl tags）；-40%目标抗性也是 ResistMod，非本次 Stat/Attack scalar。a7增加星辉分支，见下文。
| Ocean-Hued Clam `oceanhuedclam/oceanhuedclam.go:33-61,65-136` | 2pc `0.15` | `ohc-2pc` Stat/Heal | 4pc泡沫物理伤害是累计治疗 `healStacks * 0.9`、上限30,000；动态值与独立泡沫/冷却生命周期，不是常量 Amount，排除。

表中动态条件通常不妨碍“仅桥接返回值”：例如 HP、敌人 aura、武器类和 AttackTag 由原生 Amount gate 决定是否调用；共享标量只返回具体固定数字。反之，不应把当前 target aura 或成员武器类提前折叠成静态套装数值。

## b4/a7 的两项非同源差异

1. **Blizzard Strayer**：b4 `blizzard/blizzard.go:64` 订阅 `event.OnLunarReactionAttack`，a7 同一处改订 `event.OnSpecialReactionAttack`。CryoP `+0.15`、target Frozen `+0.40 CR`、Cryo `+0.20 CR` 常量与 Frozen 优先 gate 未变。桥接同一数值规则时必须让每版本保留其 native event hook，不要把 hook 变化写成 scalar 变化。
2. **Viridescent Venerer**：a7 `viridescent/viridescent.go:53-60` 将四种常规 Swirl tag 明确返回 `+0.60`，另增 Direct/Reaction Stellar Swirl tag `+0.20`；b4 只有四种常规 Swirl `+0.60`。a7 也在 `:90` 新增 `OnStellarSwirl` 并复用 Cryo VV 抗性减益回调；b4 无此事件。这些是额外动态 reaction/profile/event 分支，不并进相同常规常量 ID。

另外22套的对应 `.go` 文件在两源版本 byte-identical。当前公式 AST `packages/sim-core/src/source-host-artifact-formula.ts` 与 `packages/source-host/patches/010-artifact-scalar.patch` 仅纳入上一批七套，不含本表新候选项；`statIndex` 与精确 rule IDs 应按表增补。对本范围之外或非 stat/attack modifier 不要伪造兼容：ShieldBonusMod、HealBonusMod、ReactBonusMod、ResistMod、能量/体力功能、动态治疗累计各有独立消费通道。a7 Viridescent 的 `+0.20` 星辉分支应作为独立版本规则，不能将 b4 常规 `+0.60` 向它泛化。

本轮仅读取指定 b4/a7 的24个 artifact Go 条款及共享公式声明作为桥接参照；未改生产/测试文件，未运行测试或构建。
