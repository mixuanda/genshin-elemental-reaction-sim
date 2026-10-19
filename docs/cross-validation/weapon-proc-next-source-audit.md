# 下一批独立武器追击：固定来源审计

日期：2026-09-24。本次仅静态读取 16 份实际武器实现、共享伤害/排程代码和固定 catalog；没有执行模拟、测试或构建，也没有修改生产代码。结果是接入优先级与缺口，不是机制已经实现或实测通过。

后续实施说明（2026-09-24）：钺矛、苍纹角杯、冷寂迸音已接入[永久独立追击计算器](../validation/weapon-proc-calculator.md)及[显式无角色卡肉的团队触发模型](../validation/independent-weapon-proc-runtime.md)，另有[一次外部参考运行](weapon-proc-external.md)和[有限确定性检查点](../validation/weapon-proc-phase-checkpoint-core.md)。之后又接入吃虎鱼刀、试作古华、雪葬的星银、龙脊长枪、忍冬之果的[共享来源定义](weapon-proc-five-source-audit.md)与独立单次计算；[团队随机追击](../validation/random-weapon-proc-runtime.md)使用同帧同相位FIFO伤害回调，霜葬在成功回调读取原目标冰／冻结并为整次AoE选择倍率。已有[唯一忍冬R5外部双目标样本及本地对照](frost-proc-external.md)，不将其扩大为五把全精炼或当前游戏核验。新五把随机流与延后回调私有状态仍阻塞完整周期证明。

后续四状态增量（2026-09-24）：笛剑、以理服人、流月针、竭泽的独立单次入口新增20个精炼位置，[一项核心检查](../validation/weapon-proc-calculator-stateful.log)首跑通过；累计十二把、60个精炼位置、75个条件倍率分支，仍为provisional。笛剑固定Optimizer sheet写死2，其R1–R4与gcsim/目录冲突，采用后两者并保留说明，不能将20个位置写成三方全部一致，详见[来源冲突](weapon-proc-lifecycle-optimizer-source-audit.md)。真实合法E、实际粒子分发与普通伤害回调驱动状态，[结果重放](../validation/stateful-weapon-proc-integrity.md)不接受日志自报窗口/音符/次数。[唯一竭泽R5外部样本及本地对照](stateful-weapon-procs-external.md)实测两轮三次追击及激活冷却内E不刷新，本地16击及JSON回放差0；未外部运行另外三把，也不认证完整迪奥娜动作时钟。余下信使、昭心、苍翠猎弓、水仙十字之剑四把未接入。以下正文保留最初静态审计时点，尤其“不曾执行”的声明及暂缓的来源缺口不改写为后续验证结果。

此四状态增量的[共享来源与纯转换](weapon-proc-lifecycle-source-audit.md)、[真实运行时](../validation/stateful-weapon-proc-runtime.md)及[完整状态检查点](../validation/stateful-weapon-proc-checkpoint.md)分别记录实际执行范围。确定性合成闭合输入已有周期1、1880伤害／32秒=58.75 DPS证据，保留了此前夹具失败和真实固定属性字段错误及修复。它不解除另外五把随机追击或未导出反应域／目标时钟的阻塞，也不把固定来源提升为当前游戏verified。

gcsim 固定版本 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，本地原文 `/tmp/gidps-gcsim-b4ae769`（源码归档，没有 `.git`）；版本沿用已归档 manifest。catalog 固定 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，读取 `/tmp/gidps-genshin-db-71-source/src/data/ChineseSimplified/weapons/`。本次未联网重新核验归档。

## 首批推荐：两个机制，三把武器

**钺矛**作为确定性 ATK 单目标追击：本人普通攻击实际回调 → 角色独立冷却 → 新建一击物理追击。**苍纹角杯／冷寂迸音**共用确定性 HP 范围追击：本人前台命中 → 独立冷却 → 保存触发时 HP 基数 → 新建一击物理追击。两种机制没有随机触发、音符层数、粒子前置、弱点或弹射依赖，最适合首先接入完整单次追击计算，并以有限真实触发场景连接 simulator。

这三把的固定源码均实际创建独立 AttackInfo / QueueAttack；追击有自己的快照、伤害帧、暴击、防御和物理抗性乘区，**不能写成宿主技能 additiveBaseDamage**。它们的伤害量可直接复用 calculator 的 `ordinary`、`attackTag:"proc"`、ATK/HP terms 与共享 trace。模拟事件保留独立 eventId、来源 actor、宿主 parentDamageEventId、快照/结算帧和目标状态；现有 calculator-event-v1 捕获/复现入口可复用，但新增动态事件仍需生产 wire/integrity 真实接入，不能仅手添 timeline 命中就称触发实现。

## 16 项实际实现

以下系数为 R1–R5 的小数倍率。所有 16 项均有实际伤害实现，非整文件 NoEffect/TODO；部分分支有明确 TODO 或数值冲突。N/重击过滤中的 `AttackTagExtra` 在此 gcsim 版本指重击（例如 `internal/characters/kaeya/charge.go:32`），不是“额外普攻”。

| 武器 | 固定系数 | 实际触发过滤 | 快照、排程与名义状态时钟 | 建议/缺口 |
| --- | --- | --- | --- | --- |
| [吃虎鱼刀 11305](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/filletblade/filletblade.go#L32) | ATK 2.4/2.8/3.2/3.6/4.0 | 本人且前台的任意伤害回调，实际伤害非零；50% RNG，先抽样后查零伤害 | 名义 ICD 900/840/780/720/660f；即刻取样、+1f 单目标 | 数值/概率与 catalog 一致；需要独立概率流；未过滤攻击类型，不能擅自限定 N/E/Q，也不能直接以期望概率替代实际触发历史。 |
| [笛剑 11402](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/flute/flute.go#L36) | ATK 1/1.25/1.5/1.75/2 | 本人前台普攻/重击；每次合法回调加 1 音符，5 层清零触发 | 叠层 ICD 30f；共享音符窗口每次刷新 1800f；即刻取样、+1f、半径4 | 确定性计层模板；需要记录已有音符和刷新时钟，不能假定每五次任意命中均触发。 |
| [水仙十字之剑 11428](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/swordofnarzissenkreuz/swordofnarzissenkreuz.go#L23) | ATK 1.6/2/2.4/2.8/3.2 | 无原生始基力角色，本人前台普/重/下落命中 | 名义 ICD 720f；角色任务 +6f 后取样并立即半径3结算 | 6f 是源码 rough estimate 且受角色卡肉，目标圆心也是延迟任务执行时才创建；arkhe 参数只记日志，TODO 未影响伤害/机关。不适合宣称完整始基力模拟。 |
| [以理服人 12305](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/claymore/debateclub/debateclub.go#L28) | ATK .6/.75/.9/1.05/1.2 | 前台 OnSkill 建 900f 窗口；窗口内本人前台普/重命中 | 名义命中 ICD 180f；即刻取样、+1f、半径3 | 每次 OnSkill 额外删除命中 ICD；catalog 未明写这一重置语义，须保留来源实现边界。 |
| [试作古华 12406](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/claymore/prototype/prototype.go#L26) | ATK 2.4/3/3.6/4.2/4.8 | 本人前台普/重命中；50% RNG；无非零伤害检查 | 名义 ICD 900f；即刻取样、+1f、半径3 | 数值/过滤/概率与 catalog 一致；可作 Halberd 后的随机 AoE 扩展，不能复制 Fillet 的额外零伤害过滤。 |
| [雪葬的星银 12411](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/claymore/starsilver/starsilver.go#L27) | 普通 ATK .8/.95/1.1/1.25/1.4；冰附着 2/2.4/2.8/3.2/3.6 | 本人前台普/重对 Enemy；60/70/80/90/100% RNG | 名义 ICD 600f；触发目标当时 Cryo/Frozen 决定全 AoE 倍率；即刻取样、+1f、半径3 | 霜葬共享模板；catalog 不独立证明其落地帧。不能误用冰伤，不能逐个 AoE 目标重新选择倍率后声称等同此源码。 |
| [钺矛 13302](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/halberd/halberd.go#L29) | ATK 1.6/2/2.4/2.8/3.2 | 本人 Normal 命中；无 RNG、无前台/非零伤害检查 | 名义 ICD 600f；即刻取样、+1f 单目标 | 首选 ATK 独立追击模板。无明确数值冲突；保留源码实际过滤，不添未依据的统一限制。 |
| [流月针 13403](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/crescent/crescent.go#L27) | ATK .2/.25/.3/.35/.4 | 持有者前台 OnParticleReceived 建 300f 窗口；窗口内本人普/重且实际伤害非零 | 每次合法命中独立 proc，无额外命中 ICD；即刻取样、+1f 单目标 | 需要真实粒子/晶球接收事件；不可把普通固定攻击加算混入宿主。伤害回调本身无前台复查。catalog values 无 % 字符但语义为百分比。 |
| [龙脊长枪 13409](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/dragonspine/dragonspine.go#L27) | 普通 ATK .8/.95/1.1/1.25/1.4；冰附着 2/2.4/2.8/3.2/3.6 | 本人前台普/重对 Enemy；60/70/80/90/100% RNG | 名义 ICD 600f；触发目标当时 Cryo/Frozen 决定全 AoE 倍率；即刻取样、+1f、半径3 | 与雪葬/忍冬同模板；不是冰伤；保留来源的附着取样和近乎即时落地范围。 |
| [昭心 14409](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/perception/perception.go#L27) | 实码 ATK .63/1.26/1.89/2.52/3.15；catalog 2.4/2.7/3/3.3/3.6 | 本人普/重；无前台检查；实码完全缺 50% RNG | 名义 ICD 720/660/600/540/480f；一次共享快照；每跳 +10f；初击+至多4跳 | 明确倍率/概率冲突，暂排生产自动实现。8半径找最近可选敌人，目标36f防回跳状态，伤害半径0.6；不是最多5条伤害记录，AoE可多目标。 |
| [忍冬之果 14412](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/frostbearer/frostbearer.go#L27) | 普通 ATK .8/.95/1.1/1.25/1.4；冰附着 2/2.4/2.8/3.2/3.6 | 本人前台普/重对 Enemy；60/70/80/90/100% RNG | 名义 ICD 600f；触发目标当时 Cryo/Frozen 决定全 AoE 倍率；即刻取样、+1f、半径3 | 与雪葬/龙脊同模板；不是冰伤；只凭 catalog 不能独立验证落地及附着取样时点。 |
| [苍纹角杯 14427](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/ashgraven/ashgraven.go#L29) | HP .4/.5/.6/.7/.8 | 本人且前台对 Enemy 的伤害回调；无 RNG、攻击类型或非零伤害过滤 | 名义 ICD 900f；触发时 char.MaxHP()×系数写 FlatDmg；即刻取样、+1f、半径3 | 首选 HP 追击模板；与冷寂逐行同构。触发代码比自然语言“攻击”宽，首批可明确只覆盖普通命中实际回调，其他来源不冒称完成。 |
| [信使 15305](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/messenger/messenger.go#L28) | ATK 1/1.25/1.5/1.75/2 | 本人且前台、HitWeakPoint=true；没有额外 charged tag 检查 | 名义 ICD 600f；即刻取样、+1f 单目标；proc 强制 HitWeakPoint=true | 独立物理必暴击；不能继承宿主是否暴击，须保留可靠弱点命中来源。源码靠弱点标记而非重击过滤。 |
| [苍翠猎弓 15409](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/viridescent/viridescent.go#L29) | 每击 ATK .4/.5/.6/.7/.8 | 本人前台普/重；50% RNG | 名义 ICD 840/780/720/660/600f；触发时取样；+1,+31,…,+241f 共9击，半径3 | 源码 i<=240 是9击，不能按4秒/0.5秒自行改成8击；未实现吸引位移，圆心创建时固定。需要独立来源确认完整计数和空间机制。 |
| [竭泽 15418](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/endoftheline/endoftheline.go#L32) | 每击 ATK .8/1/1.2/1.4/1.6 | 本人前台 OnSkill 建效果；效果中本人前台任意伤害回调触发 | 效果900f/启动ICD720f；每次伤害ICD120f，3次清效果；每击即刻快照、+1f、半径2.5 | E重新启动时清命中ICD及计数；需要来源生命周期/计数记录。不能把三次默认并进一次无条件施放。 |
| [冷寂迸音 15432](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go#L29) | HP .4/.5/.6/.7/.8 | 本人且前台对 Enemy 的伤害回调；无 RNG、攻击类型或非零伤害过滤 | 名义 ICD 900f；触发时 char.MaxHP()×系数写 FlatDmg；即刻取样、+1f、半径3 | 与苍纹角杯共用同一 HP 追击模板，数值与 catalog 一致。 |

## 可共用的后续组

1. **单次追击调度**：钺矛先落地；吃虎鱼刀、试作古华增加独立概率与相应真实过滤；信使增加可靠弱点上下文和必暴击。不要把不同武器的“前台/非零伤害”条件强行统一。
2. **HP 单次范围追击**：苍纹角杯、冷寂迸音共享参数模板，但武器身份、来源与事件记录分开。
3. **效果窗口后追击**：以理服人、流月针、竭泽共用部分状态账本，分别需要 E、实际粒子接收、触发次数；笛剑需要独立五音符与刷新机制，不宜借一个通用 stacks 参数假装自动触发。
4. **冰附着分支**：雪葬的星银、龙脊长枪、忍冬之果共用 RNG/600f/附着倍率模板；需固定来源落地帧与触发目标附着快照，不能把它们按冰元素伤害计算。
5. **暂缓完整自动接入**：昭心（确定的倍率/概率冲突）、苍翠猎弓（9击排程、吸引缺失）、水仙十字之剑（始基力 TODO、6f 粗略估计）。这些仍可在清楚标记的来源条件下研究独立一击，不能声明完整被动完成。

## 共享核心语义与边界

- `pkg/enemy/attack.go:62–78` 在该帧末尾任务应用实际伤害并发出 OnEnemyDamage；武器的 +1f 是相对其回调发生帧。`pkg/core/attack.go:64–77` 的 snapshotDelay=0 立即取样；`89–96` 把独立追击排到未来伤害帧。
- `pkg/enemy/damage.go:24–44,60–99` 表明 AttackTagNone/WeaponSkill 都走正常物理+通用伤害加成、防御、物理抗性与自己的暴击。信使通过 HitWeakPoint 强制暴击；其他本批武器不继承宿主暴击结果。正常/战技专属增伤不能因为宿主标签而传给 proc。
- 所读 AttackInfo 均为 physical、ICDTagNone/Default、Durability100；`pkg/enemy/attack.go:122` 跳过 physical 元素附着。这里没有融化/蒸发，StrikeTypeDefault（信使为 Pierce）也不满足 `pkg/reactable/freeze.go:58–64` 的碎冰钝击/岩条件。快照仍会按其实际 tag 查附魔，不能把普通攻击附魔直接复制到 proc。
- `pkg/core/player/character/mods.go:50–62` 的 AddStatus(...,true) 标记角色卡肉延长，`character/hitlag.go:60–64` 真实延长有效状态。表中状态帧数是名义 duration，不能称为有卡肉时的固定全局时间。
- 冷却边界需按该源码精确保留：StatusIsActive → `pkg/modifier/modifier.go:117–125` 只有 expiry < currentFrame 才失效，**expiry 等于当前帧仍有效**。因此无其他移除/延长时，F 添加 duration600 的状态在 F+600 仍阻塞，在 F+601 才可再次触发。不要直接照搬另一 runtime 的 frame >= readyFrame 约定。
- `pkg/core/combat/hitbox.go` 的 NewCircleHitOnTarget 在创建时读取目标位置；未来落地不自动追踪。AoE 实际目标数不能由单目标伤害强乘一个猜测数量。
- 不同武器回调对零伤害/前台/攻击标签不同；HP两把和竭泽的代码对攻击来源标签较宽。第一阶段可声明支持范围内真实普通伤害回调，并把未接其他来源保留在缺口；不得把添加额外过滤后的行为称为完全复制 gcsim。
- 现有 `packages/sim-core/src/favonius.ts` 可参考事件审计与独立随机流做法，但它明示无卡肉时钟且 RNG 不匹配 gcsim；不可宣称跨引擎同 seed 产生同序列，更不可复制其冷却比较而忽略上面的 inclusive 边界。

## 昭心的明确冲突

固定 `perception.go:63` 为 `2.1 * refinement * 0.3`，应核对的 catalog 向量却是 2.4/2.7/3/3.3/3.6；77–100 行无 50% RNG。先消耗冷却，再从玩家周围半径8选择初始目标。每次选中目标加36f防回跳状态，然后10f后以半径0.6结算，至多初击+4次续跳，整链复用一次快照。36f 是目标锁而非弹射间隔，多目标圆形结算又可能产生多条伤害记录。此实现不能作为无冲突金标准。

## 已读取原文指纹

下表仅记录当前固定归档原文的 SHA-256 和字节数，不代表本次重新网络核验。未复制原始文件。

| 武器/路径（相对固定 gcsim 根） | bytes | SHA-256 |
| --- | ---: | --- |
| `internal/weapons/sword/filletblade/filletblade.go` | 1840 | `7137fb3445f71d5cbedf5409bce213e4d3ea232062f2b784aba4ea371f43b605` |
| `internal/weapons/sword/flute/flute.go` | 2148 | `df27541a50b740b2ef1ad3ccc8f5526b1e883362d864243d5ce1ee4e3b4510ae` |
| `internal/weapons/sword/swordofnarzissenkreuz/swordofnarzissenkreuz.go` | 2697 | `422df06b2fe00e6999ccf37d2622807139a263056e04aae93bc6e7b771390153` |
| `internal/weapons/claymore/debateclub/debateclub.go` | 2499 | `df6a10cd3275faabb635c102c5ee72212f22bc3ed987dac1e799809330799d2c` |
| `internal/weapons/claymore/prototype/prototype.go` | 1691 | `9b3a1f00837a8c4c51bf3c32e4e00fa322e611d57b61562f6aa414810b0f3ad5` |
| `internal/weapons/claymore/starsilver/starsilver.go` | 1878 | `8341659abdacac223206e4ea259db477342850ee608961885b368ee49bdb2612` |
| `internal/weapons/spear/halberd/halberd.go` | 1759 | `56b33f8e9fc5c4cea783231d45b8421e8556071dfa4c834a16c1405ef6ab1d8c` |
| `internal/weapons/spear/crescent/crescent.go` | 2003 | `a3d7ff1c0209e8c02b8e0c8a51f88c1b708b98679f13187859588c0e56e6400c` |
| `internal/weapons/spear/dragonspine/dragonspine.go` | 1915 | `df925ae15e322890016b9cdb215494038bd5e2f3ec738932260d7d0afe9ba8b1` |
| `internal/weapons/catalyst/perception/perception.go` | 2737 | `23fff81296ae0fafe98b21cc247c0d446b7431eac8fb0e8accbd648a31048b0f` |
| `internal/weapons/catalyst/frostbearer/frostbearer.go` | 1920 | `a16a34b02f58d6580c8c21d9f33b86c962673aa8d90b3c5e3e5f73ee2b111393` |
| `internal/weapons/catalyst/ashgraven/ashgraven.go` | 1616 | `a2ba3e0625efb19cd5336871f19023e39763c0d67cd3b56b0440c2d9afb49ef6` |
| `internal/weapons/bow/messenger/messenger.go` | 1961 | `e3725f9579e2745f8e97b8a2f4479301b51dc961eebafe5668099549951953ba` |
| `internal/weapons/bow/viridescent/viridescent.go` | 2038 | `023a0ff84290d4ffe62139b298e23baa5dec284524d2a1128e4fa50795e08a6f` |
| `internal/weapons/bow/endoftheline/endoftheline.go` | 3061 | `e86a6db96ce72ec593436a0beb10e979278d4a70c3121924e708cef85da95ca2` |
| `internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go` | 1616 | `d16358e9179a1c20b74c98ba81b160b7e64bf92b96a571eb07086d529e805a77` |

完整实现的后续最小证据应针对推荐模板记录一轮真实触发→独立事件→calculator重放；本审计没有产生运行结果，不把静态公式核对替代这一验证。
