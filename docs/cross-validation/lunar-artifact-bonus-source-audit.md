# 月曜圣遗物反应加成：固定来源审计

2026-09-24。本报告仅核对如雷、乐园遗落之花、晨星与月的晓歌四件套的月曜反应加成与事件时序；结论为 **source-backed / provisional**，不是实机验证。最初的来源审计阶段没有运行测试、构建或外部模拟器；后续运行时接入与聚焦检查另记于下文。

[原文清单](../../packages/game-data/sources/lunar-artifact-bonus/manifest.json)与[压缩原文](../../packages/game-data/sources/lunar-artifact-bonus/source.json.gz)保存 30 个 UTF-8 原文文件及逐文件 SHA-256，包含许可证。gcsim 固定为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；本地目录是解压产物，没有 `.git`，本次将所收录的 25 个 gcsim 文件逐个计算 Git blob SHA-1，与已保存的固定提交树逐项匹配。其余目录／Optimizer 原文与已有清单的 SHA-256 匹配，Flower 的 Optimizer sheet 另与已保存固定树的 Git blob 匹配。本次没有重新联网获取来源；清单明确记录继承来源与验证方式。

## 加成作用域

这些值进入 `ReactBonus`，与月曜公式的 `1 + 6EM/(2000+EM)` 相加，不是普通元素伤害加成，也不是最后再乘一次独立倍率。直接月曜伤害在 `calcDirectLunar` 中读取此值；月感电／月结晶的多人贡献先分别读取各角色的加成，再暴击、排序和加权。两件套与普通反应条款不属于本增量范围。[公式与读取位置](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.go#L20-L28)、[直接月曜公式](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L185-L226)。

| 四件套 | 精确标签 | 月曜反应加成 |
| --- | --- | --- |
| 如雷的盛怒 | `AttackTagDirectLunarCharged`、`AttackTagReactionLunarCharge` | `0.20`；伤害加成无前台条件 |
| 乐园遗落之花 | 仅 `AttackTagDirectLunarBloom` | 常驻 `0.10`；有效层数 `s` 再加 `0.10 × s × 0.25`，`0 ≤ s ≤ 4` |
| 晨星与月的晓歌 | `AttackTagIsLunar`：上述三类，以及 `AttackTagReactionLunarCrystallize`、`AttackTagDirectLunarCrystallize` | 合格时 `0.20`，初始化时月兆等级 `≥ 2` 再加 `0.40` |

[如雷 54–71 行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/thunderingfury/thunderingfury.go#L54-L71)、[乐园 57–107 行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/flowerofparadiselost/flowerofparadiselost.go#L57-L107)、[晓歌 49–75 行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/aubade/aubade.go#L49-L75)、[五类标签定义](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attacks/attack.go#L33-L69)。不能把这三套提升为对所有特殊反应或所有元素伤害有效。

如雷的冷却缩减是另一条事件回调：要求触发者为持有者、持有者当前在场，月感电事件要求目标为 Enemy；成功后设置 48 帧 ICD 并减少 60 帧元素战技冷却。它不是上述无前台限制的伤害加成条件。[独立回调](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/thunderingfury/thunderingfury.go#L73-L102)。

## 乐园：双订阅、共享冷却与两种到期语义

`OnBloom` 经 Enemy 过滤，`OnLunarBloom` 直接进入同一 `f`；`OnHyperbloom`、`OnBurgeon` 也共享它。回调只接受持有者的触发，可在后台生效，并共用 `flower-4pc-icd`。但是固定 `TryBloom` 与 `tryQuickenBloom` 实际只选择并发出 `OnBloom` **或** `OnLunarBloom` 之一；没有证据支持一次月绽放天然发出两种事件或加两层。如果宿主适配器同时分发两种通知，第二次仍须被共享 ICD 拦截。[订阅与持有者检查](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/flowerofparadiselost/flowerofparadiselost.go#L73-L118)、[事件二选一](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/bloom.go#L47-L88)。

无卡肉时，在 `f` 帧触发后：

- ICD 在 `f + 60` 帧仍有效，首次可再次触发是 `f + 61`。`StatusIsActive` 经 `FindCheckExpiry` 仅在 `expiry < frame` 时失效。
- 每次合格触发给同一 buff 加一层至最多四层，并把整组期限刷新为当前帧加 600；源码不是四个独立衰减期限。
- 实际伤害查询 `ReactBonus` 使用 `expiry > frame`，在 buff 的精确到期帧已不计叠层加成，并会从 `c.mods` 删除该 `ReactBonusMod`；常驻 `0.10` 仍在。
- 精确到期帧的下一次触发存在读取顺序差异：若此前没有 `ReactBonus` 查询，`StatusIsActive(buffKey)` 仍认旧组有效，保留旧层数后加层／刷新；若同帧已有该角色的 `ReactBonus` 查询删除了过期组，下一次触发重置为一层。不可把所有到期判断统一为一个比较符。

[状态查询与叠层刷新](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/flowerofparadiselost/flowerofparadiselost.go#L78-L107)、[inclusive 状态查询](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117-L125)、[strict 加成查询及删除](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L370-L392)。两种状态都带 hitlag 标记；角色卡肉延长只在 `expiry > frame` 时发生，因此上述是名义无卡肉帧数。[卡肉延长](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/hitlag.go#L41-L67)。

## 取样时机与普通伤害读取的边界

月感电每次贡献计算先 `Snapshot`，再发出 `OnLunarReactionAttack`，随后读取该贡献者的 `ReactBonus`；月结晶每个计划命中也执行同样次序。贡献者集合可以提前保存，但加成没有随最初附着永久锁定。直接月曜伤害使用攻击自身已有的属性快照，反应加成则在命中伤害计算时读取。[月感电](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go#L122-L152)、[月结晶](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go#L139-L195)、[直接读取](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L218-L223)。

通用 `Snapshot()` 仅调用 `Stats()`；后者只清理 `StatMod`，保留 `ReactBonusMod`。普通未增幅攻击本身不调用 `ReactBonus`，因此**不能在每次普通快照时清理乐园过期组**来仿制固定来源。普通蒸发／融化在伤害计算时查询 `ReactBonus`，剧变与激化经各自反应公式查询，也能清理同一角色的过期乐园组，即使本次攻击不吃乐园加成。[通用快照](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/character.go#L56-L96)、[Stats 保留其他 mod](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L24-L34)、[普通增幅查询](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L104-L114)、[剧变／激化查询](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.go#L31-L40)。

只实现月曜读取的显式面板宿主，无法声称完整复现任意普通反应先读取、同帧月绽放后触发的精确到期边界。要复现它，应接入真实的反应加成查询点及事件顺序，或明确该混合查询序列不在运行时范围。固定敌人流程先 `React(atk)` 再 `calc(atk)`，因此同一命中若触发月绽放，其新乐园层可在后续直接月绽放伤害读取时生效；不能统一为命中前快照。[反应先于伤害计算](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L118-L143)。

## 晓歌：实际换入与初始前台

`Init` 在全队加入后固定计算 `0.20 / 0.60`，回调没有每次动态重算月兆。后台立即合格；实际换入时设置 180 帧 `aubade-4pc-onfield`，实际换出时删除它。前台且该状态不存在／过期时返回零。状态采用 inclusive 查询，因此无卡肉时换入帧 `s` 至 `s + 180` 仍有效，`s + 181` 起无加成。[晓歌初始化与回调](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/aubade/aubade.go#L27-L75)。

换人命令通过 `QueueAction(h.swap(k), h.Delays.Swap)` 安排；实际 `swap` 才先修改 active 再发出 `OnCharacterSwap`。因此三秒从实际换入完成开始，而非命令开始。初始角色使用 `SetActive` 直接赋值，不发出该事件；初始前台晓歌没有自动三秒宽限、加成为零，初始后台有加成。[命令排程](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/exec.go#L130-L155)、[实际换人](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L104-L138)、[SetActive](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L183-L185)、[开局设置](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/setup.go#L83-L90)。

## 独立来源能确认什么

Optimizer 固定 `180a0a1015cb725c7570cd828eb086749960df98` 的 Flower sheet 直接给出四件套门槛、`0.10 + 0.025 × s` 与 `premod.lunarbloom_dmg_` 路由，确认数值和反应通道；sheet 条件选择器不是动态叠层模拟，不能确认上述帧边界。[Flower sheet](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts/FlowerOfParadiseLost/index.tsx#L38-L87)。

genshin-db 固定 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf` 的 Flower／Aubade 原文支持 10% 基础、25% 相对叠层、四层、1 秒、10 秒，以及晓歌 20% + 40%、后台和三秒移除描述，但不足以裁定 inclusive/strict 比较、乐园整组刷新、初始前台与同帧读取顺序。本地只有 TF／Aubade Optimizer sheet 的固定树条目，没有原文，未把文件存在视作公式验证。这些来源间的证据范围差异保留为明确限制，不提升为游戏机制 verified。

## 后续运行时接入核验

五种月曜宿主已接入显式圣遗物声明、真实触发、贡献者取样与JSON导出回放。独立月感电／月结晶原有队列在同帧换人完成前取样；接入复核发现后已修正为实际完成换人再读取晓歌状态，与固定 `Core.Tick` 的 `Player.Tick()` 先于 `Tasks.Run()` 顺序一致。[Core.Tick 150–153 行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L150-L153)。月结晶飞行投递仍使用此前逐弹取样，未重读圣遗物窗口。

[聚焦运行时检查记录](../validation/lunar-artifact-runtime.md)保留初次样例预期失败与最终三项通过结果。本接入只执行所选月曜四件套条款；二件套、普通反应加成、如雷减冷却及未建模角色效果不由该适配器补入。该结果仍为固定来源 provisional。
