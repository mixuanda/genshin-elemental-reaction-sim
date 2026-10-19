# 信使：明确弱点上下文、独立必暴击与到期边界外部对照

固定实现为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，解压源码位于 `/tmp/gidps-gcsim-b4ae769`，不是 Git checkout。审阅的 16 个源码路径、固定 URL、字节数和 SHA-256 见 [source-review.json](messenger/source-review.json)。历史来源条件与实际当前游戏验证保持分开，未修改上一轮状态武器的冻结样本。

## 源合同与证据层级

- `internal/characters/amber/aimed.go:35–50,70–99` 接受明确 `hold=0,weakspot=0/1,travel=10`；物理瞄准倍率来自 `zz_amber.dm.go:125` 的天赋 1 倍率 `0.4386`，取样在输入 +15 帧，命中在 +25 帧。`HitWeakPoint` 直接由 `weakspot==1` 赋值；这是来源明确条件输入，**不是空间几何或目标弱点识别**。
- `internal/weapons/bow/messenger/messenger.go:31–66` 要求自身伤害、持有者在场、`HitWeakPoint`、无有效 ICD。没有攻击标签或非零伤害门。先写 600 帧 ICD，再以 `0.75+0.25R` ATK 立即独立快照、下一帧原目标单击。子命中实际为 **AttackTagNone（0）**、Physical、Pierce、Durability100，并自行设置 `HitWeakPoint=true`；不能声称它是 WeaponSkill（7）或继承宿主的暴击结果。
- `pkg/enemy/damage.go:63–99` 先限制 CR 到 `[0,1]`，再结算防御／抗性；暴击条件为 `HitWeakPoint || Rand.Float64() <= CR`。逻辑或短路意味着弱点命中不消费暴击随机抽样，仍按自身快照 CD 乘 `(1+CD)`。非弱点即使 CR=0 仍抽样。
- `pkg/enemy/attack.go:63–78` 先应用实际伤害，再按订阅顺序发 `OnEnemyDamage`，最后执行攻击自己的 callbacks。武器在 `Core.AddChar`（`core.go:201`）注册，早于 `Core.Init:129` 的普重回能订阅；`event.go:165–170` 按订阅顺序调用。弱点宿主的顺序是：自身必暴计算、不抽 crit → 信使写 ICD 和取样排 +1 → 普重回能另行抽样。下一帧子追击必暴、不抽 crit，也不符合普重回能的 Normal/Extra 标签。
- `pkg/core/energy.go:49–79` 的普重回能随机仍可能发生；不能把“跳过暴击 RNG”扩大成整个样本无随机。安柏 C0/A0 排除了 C1 第二支箭和 A4 命中后加攻。本任务也不认证后者与追击快照的动态交互。
- `pkg/modifier/modifier.go:117–125` 只在 `expiry < frame` 时使状态无效；到期帧等号仍在冷却。

原始 debug 不直接打印 `HitWeakPoint` 或 RNG roll／draw index。本报告的弱点标记由保存的命令与固定源码映射得出；暴击 RNG 的跳过由源码短路语义得出。**实际暴击布尔值、未舍入伤害、快照帧、ICD 和输入执行帧则均直接存在于原始输出**，两种证据未混淆。

## 唯一外部执行

[配置](messenger/amber-messenger-reference.gcsl)、[完整命令／执行记录](messenger/amber-messenger-reference.execution.json)、[原始 summary](messenger/amber-messenger-reference.result.json)、[原始 debug](messenger/amber-messenger-reference.sample.json)、[逐击未舍入参考](messenger/amber-messenger-reference.reference.json)。提取脚本只读这一次现有样本，不调用模拟器。

2026-09-24 04:22:49 UTC，首次且唯一 CLI 调用成功，退出 **0**，耗时 **0.027003458002582192 秒**，无重试、安装或重新构建。二进制 SHA-256 为 `2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`，结果 revision 与上述一致、`modified=false`。实际配置为 `hitlag=false`；默认 false JSON 字段省略不代表启用卡肉。

安柏 C0、等级 1／突破 0、有效天赋 1，信使 R5／等级 1，无圣遗物、CR 手动减至 0；保留信使真实 CD 副属性。目标等级 90、抗性 10%、坐标 `(0,2)`、半径 0.25，全程单目标静止，角色始终在场。summary 种子 `17050184153569218374`，同一次 CLI debug 种子 `11399344348390296731`；两者独立，不声称随机序列一致。

实际面板为 ATK **58.5735**（ATK% 与固定 ATK 均 0）、HP **793.2582**、DEF **50.358**、EM 0、ER 1、CR 0、CD **0.5680000000000001**；通用与物理增伤均为 0。防御乘区 `101/291 = 0.3470790378006873`，抗性乘区 `0.9`。每次信使基底为 `58.5735×2`，再乘防御、抗性和其自身 `(1+0.5680000000000001)` 暴伤乘区。

| 命中帧 | 源动作／取样帧 | 弱点来源条件 | 原始 crit | 实际伤害 |
|---|---|---|---|---:|
| 26 | aim 输入 1，取样 16 | 显式 0 | false | 8.02491973329897 |
| 125 | aim 输入 100，取样 115 | 显式 1 | true | 12.583074141812787 |
| 126 | 信使取样 125 | 子命中独立固定 true | true | 57.378359059793816 |
| 725 | aim 输入 700，取样 715 | 显式 1 | true | 12.583074141812787 |
| 825 | aim 输入 800，取样 815 | 显式 1 | true | 12.583074141812787 |
| 826 | 信使取样 825 | 子命中独立固定 true | true | 57.378359059793816 |

F125 写 ICD 到 F725；F725 的弱点攻击确实没有再次追击。F825 再次触发，ICD 到 F1425。没有将“到期帧”误读成提前一帧或强行修改样本来匹配期望。6 击总和与外部 summary 均值均为 **160.53086027832495**，差值 **0**。

## 其余三把武器的可实现边界

只读复核不支持将它们永久整件阻塞；本轮来源单击入口与尚未实现的自动机制必须分别列明。

- **苍翠猎弓**：`viridescent.go:29–75` 明确每击 ATK `0.4/0.5/0.6/0.7/0.8`、物理 WeaponSkill、50% 成功条件 `roll<=0.5`、触发帧取样和固定半径 3，`+1,+31,…,+241` 共 9 次排程。9 次代码本身不是来源缺失。真实自动边界是没有吸引位移，以及当前游戏总击数尚无独立验证；本轮未据此样本验证其自动场。
- **水仙十字之剑**：`swordofnarzissenkreuz.go:51–96` 的单击 `1.6/2/2.4/2.8/3.2` ATK、物理伤害明确。已有原生 Arkhe 的持有者不注册效果。真正缺口是第 26 行把 6 帧标为粗略估计，第 36–49 行 Arkhe 仅记日志、未实现交互；这些不阻止明确已经触发一击的计算。延迟任务执行时才取样并读取目标位置。
- **昭心**：`perception.go:63` 实码为 `2.1×R×0.3`，与同树描述、目录和固定 Optimizer 的 `2.4/2.7/3/3.3/3.6` 冲突；第 77–100 行还缺描述中的 50% RNG。单击可采用明确裁决后的目录／Optimizer 来源，但不能将该 gcsim 的冲突倍率用作一致性金标准。完整弹射还需要共享快照、目标 36 帧锁、每跳 10 帧及首命中回调顺序，不能简单声称固定五条伤害。

本次没有运行以上三把的外部或本地自动样本。它们的固定 Optimizer 原文已另归档于 `packages/game-data/sources/weapon-proc-final-four-optimizer`；昭心 sheet 使用 `premod.atk`，苍翠／水仙使用 `total.atk`，本报告未认证复杂属性转换场景完全一致。

## 本地对照状态

**外部有限样本已验证；本地留待整批必要验证。** 用户要求优先完成主提示词的横向实现，停止围绕个别对象持续追加对照；因此本地脚本尚未执行，不再等待或发放单项运行许可。本目录没有本地模拟结果、capture 通过记录或本地残差结论，也没有重复外部样本。

[已准备但未执行的脚本](messenger/compare-local.mjs) 保存了后续可复用输入：恢复这 6 个未舍入命中与明确弱点，使用真实信使触发和独立必暴分支；seeded critical sampling 计划检查一个普通命中的 crit draw 与五个必暴命中的跳过抽样。上述只是待整批验证的计划，不能据此宣称完整 schema、capture JSON 重放或独立计算器已经通过。后续验证由整批实施的必要检查统一决定，不自行继续局部循环。
