# 130 OnRemoved 捕获审计

只读来源为 `/Users/evan/Library/Caches/gidps-source-host/build-voBklW/source`（b4）及 `/Users/evan/Library/Caches/gidps-source-host/stellar-build-F7xhXt/source`（a7）。行号对应这两份现有源；没有执行构建或模拟。

本批 b4 19 个、a7 20 个 `OnRemoved` 字面站点均完成类型迁移，其中 b4 17 个、a7 18 个仅捕获实际 actor 对象。描述器不只记录 source/actorIndex：它明确保留原函数、真实 actor 对象，并通过原 private reader 读取对象可达状态，原 unknown gaps 原样返回。actor 对象中的 shared Character/CharWrapper/Core 仍通过既有语义 owner 引用交给对应 provider。

| 站点 | b4 / a7 原入口 | 实际捕获及依赖 |
|---|---|---|
| HuTao `ppChargeAttack` | `internal/characters/hutao/charge.go:162` / 同行 | 仅 `c`；下一状态是调用参数，`ExtendStatus(paramitaBuff,-108)` 操作 wrapper status/mods 与当前 frame。 |
| Mavuika `BikeCharge` | `mavuika/charge.go:255` / `:265` | 仅 `c`；重置 `caState`，`bikeChargeAttackUnhook`（b4 `:693` / a7 `:700`）只按常量 event/key 取消订阅，不读包级 `bikeHittableEntityList`。event provider 保留实际订阅状态。 |
| Skirk `BurstExtinction` | `skirk/burst.go:182` / 同行 | 仅 `c`；删除常量 `burstAbsorbRiftAnimKey` status。 |
| Sigewinne `Skill` | `sigewinne/skill.go:107` / 同行 | 仅 `c`；`removeC2Shield`（`shield.go:41`）读 constellation、自有 `c2Shield` 及 `Core.F`，设置 expiry 并清 pointer。 |
| Sigewinne `Burst` | `sigewinne/burst.go:81` / 同行 | 仅 `c`；另读 `lastSwap/Core.F` 和常量 `player.SwapCDFrames`，更新 live player SwapCD。`lastSwap` 未审 clock gap、custom shield implementation gap 保留。 |
| Neuvillette `chargeAttackJudgement` | `neuvillette/charge.go:154` / 同行 | 仅 `c`；下一状态分支后按 `lastSwap/Core.F` 更新 live player SwapCD，clock gap 不消。 |
| Noelle `ChargeAttack` | `noelle/charge.go:116` / `:118` | 仅 `c`；下一状态不是 Charge 时重置自有 `caState`，不捕获 `windup/final/src`。 |
| Varesa `volcanicKablam` | `varesa/burst.go:162` / 同行 | 仅 `c`；调用 `clearNightsoulCB` 并重置 `usedShortBurst`。 |
| Varesa `highPlungeCA/highPlungeXY/lowPlungeXY` | `varesa/plunge.go:255/:329/:403` / 同行 | `c.clearNightsoulCB` method value 只保留 receiver；`varesa.go:101→:96→nightsoul.ExitBlessing` 操作 actor NS/status/log，不读取另一个 timer callback。 |
| Xilonen `nightsoulAttack` | `xilonen/attack.go:166` / `:165` | 仅 `c`；`canUseNightsoul→exitNightsoul` 读 actor NS/C6 status、操作 CD/counters，写 shared player LastStamUse。包内用到的 key 和 normalHitNum 是常量。 |
| Mona `Dash` | `mona/dash.go:62` / 同行 | `c.c6OnDashEnd` method value 只保留 receiver；`cons.go:344` 读 constellation/c6NearbyOmen、写 c6Src；未知 generation token gap 保留。 |
| Wanderer `WindfavoredBurst` | `wanderer/burst.go:121` / 同行 | 仅 `c`；`checkForSkillEnd→skillEndRoutine` 操作 actor statuses/statmods/CD/points/a4Prob，写 shared player SwapCD。该链不读包级 mutable Frames/landing slice。 |
| Hydro Traveler `skillPress/skillShortHold/skillHold` | `traveler/common/hydro/skill.go:120/:161/:208` / 同行 | 仅实际 Hydro `c`；不捕获 travel/hold/AttackInfo。`c4Remove`（`cons.go:72`）读 constellation/live shield、设置 `Expires=Core.F+1`。 |
| Itto `ChargeAttack` | b4 无 / `itto/charge.go:309` | 仅 a7 actor `c`；按下一状态重置 slashState/a1Stacks/stacksConsumed，InvalidSlash 是 const。 |

Xilonen/Wanderer 的 `SetCD→CDReduction` 间接调用 active `CooldownMod.Amount(a)`（b4 `pkg/core/player/character/mods.go:422` / a7 `:423`）。原 actor modifier provider 捕获其状态或留下 gap；本批没有借 owner 身份删除 modifier callback unknown。共享 Player、event 和 shield provider 状态亦保持。不存在将所有 private funcs 标为 ignored 或通用清 gap 的规则。

## 保留 opaque

| 站点 | 未覆盖捕获 |
|---|---|
| Fischl `burst.go:125`（两 lane） | `OnRemoved` 捕获 `burstShortOzFunc`。该嵌套闭包保留 src/ozSpawn/firstTick/c4HealFunc，src 又与 actor generation token 比较；本批不凭注册 key 或代码指针推断 captures。 |
| Klee `attack.go:149`（两 lane） | `OnRemoved` 捕获共享 `tryPerformAttack`；它保留 mutable done、AttackInfo、travel 与 actor，并和 queued animation callback共享。同一 actorIndex 不足以描述 alias 与捕获，保持原 gap。 |

两条 lane 各两个 `UseNormalizedTime` 赋值（HuTao `attack.go:185`、Keqing `attack.go:105`）均只返回 `next==ActionCharge`。原 NormalCounter 条件不变，统一构造器的唯一捕获为 `nextAction=ActionCharge`；不推广其他动态谓词。

## 本批未选 event-ref

event handler 的真实 hook 和 descriptor 已同槽保存；同 key 替换整槽，unsubscribe 将实际 `f` 置 nil。没有可安全把任意 private func 关联到该 hook 的身份 API。特别是 minazuki 的 retained triggerFunc 经 watcher closure 包装后使用，不是注册 Hook 本身；Chiori retained queuer 是 task queuer；Nicole APFunc 是未使用 alias，defaultHitBox/projectionHitbox 属于包级 mutable 函数状态。reflect function Pointer 只指向代码，不能证明捕获等价。未来需在真实绑定点引入显式 handle 和完整生命周期描述；本批保持这些 frontier 的 gap。
