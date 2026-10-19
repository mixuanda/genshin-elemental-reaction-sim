# 来歆余响与昔时之歌：固定运行时来源审查

状态：`source-backed-provisional`，不是游戏实测认证。本次只审查已经固定的原文及其实际调用链；没有修改生产代码，没有运行测试、构建、游戏或外部模拟器。

## 原文身份

gcsim 固定版本：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。[已有清单](../../packages/game-data/sources/artifact-remaining-effects/manifest.json) 的两份原文均重新计算 SHA-256，与清单匹配，且逐字匹配 `/tmp/gidps-gcsim-b4ae769`。重算 Git blob SHA-1 亦逐一匹配已保存的固定、非截断 Git tree。

| 文件 | SHA-256 | Git blob SHA-1 |
| --- | --- | --- |
| [echoes.go](../../packages/game-data/sources/artifact-remaining-effects/raw/gcsim/internal/artifacts/echoes/echoes.go) | `49885e3655c7c3065a383c02a8cce196de90853bea4791b8eff8f33be09a38df` | `c5e31fb4a7baf9d3c598fdefa622413bd0dadcb8` |
| [songofdayspast.go](../../packages/game-data/sources/artifact-remaining-effects/raw/gcsim/internal/artifacts/songofdayspast/songofdayspast.go) | `c7f7965c8111efbeb7efa430fbe7eaf3fe8fa21c4679bf14e0785352e667b7fe` | `a52973505348f9ae211ed4d3cc7de5d15f56f7b9` |

本次引用的九份公共调用链文件（combat/attack、enemy/attack、enemy/damage、template/heal、player/heal、status、task、core、event）也逐文件匹配该固定 tree 的 blob。没有改写已有来源清单或原文归档。已有固定 genshin-db 两份描述及 Optimizer 两份 sheet 的 SHA-256 均与清单匹配。

## 共同伤害阶段

两套均订阅 **`OnEnemyHit`，而非 `OnEnemyDamage`**。[`enemy/attack.go:26–60`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L26) 先计算该目标的伤害组倍率，只有 `grpMult > 0` 才同步发 `OnEnemyHit`；之后才应用角色 AttackMod 并计算伤害。实际扣血、`OnEnemyDamage` 和攻击回调排在之后的零延迟任务中（L62–78）。两套本身都没有实际伤害非零检查，不能用伤害完成后的钩子替代这一前置阶段。

[`combat/attack.go:12–31`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go#L12) 先检查该目标是否命中，再复制 AttackEvent 给目标；L44–58 按敌人列表顺序逐个处理存活目标。故两套状态可以在同次范围攻击的目标之间变化，但某目标上追加的 `Info.FlatDmg` 不会自动累加到下一个目标的副本。

两套均往宿主 `Info.FlatDmg` 加数值。[`enemy/damage.go:46–98`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L46) 将它加入宿主基础伤害，再应用增伤、防御、抗性、暴击。它不是独立物理追击，不另造一次攻击、额外伤害标签或另一套暴击判定。

## 来歆余响

固定依据：[`echoes.go:58–117`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/echoes/echoes.go#L58)。每个装备者各持独立 `prob`、`icd`、`procExpireF`，初值为 0.36、0、0。

1. 必须装备者当前前台、攻击归属该装备者，且标签严格为 `AttackTagNormal`。后台伤害、队友伤害、重击、下落、战技、爆发及武器追击不通过。
2. 每个通过标签与归属的敌人回调先读取装备者此刻 `TotalAtk()`。若 `frame < procExpireF`，直接追加 `0.7 × live ATK`，不抽随机、不刷新窗口、不检查触发冷却。
3. 否则若 `frame < icd` 则结束，不抽随机；因此冷却到期帧已经可以再次判定。
4. 抽一次 `Float64()`；`roll > prob` 为失败，等号成功。失败同样令 `icd=frame+12`，并将概率直接加 0.2。连续失败阈值为 0.36、0.56、0.76、0.96、1.16，没有夹到 1；阈值超过 1 时仍会进行这次随机抽样。
5. 成功立刻给当前宿主命中追加 `0.7 × live ATK`，设置 `procExpireF=frame+3`、`icd=frame+12`，将概率重置为 0.36。

这些是绝对核心帧数，不是受角色卡肉的 Status。3 帧窗口只覆盖起始帧、+1、+2；+3 已不能沿用增幅。窗口内额外命中不会将到期时间后移。加值依据每次命中回调的实时攻击力，不是宿主早先快照攻击力，也不是第一次触发时保存的攻击力。

范围攻击的第一名合法目标若成功，同帧后续合法目标可沿用窗口，各自追加一次 70% 实时攻击力；若第一名目标失败，同帧后续目标受 12 帧冷却阻断，不各自追加一次失败概率。多个装备者的状态彼此独立，因为前台、攻击归属双门使该攻击只有自己的余响订阅能够作用。

固定 genshin-db 描述与上述 36%、失败加 20 个百分点、70% ATK、0.2 秒判定间隔一致；不过“伤害后 0.05 秒清除”的文字本身不足以独立证明所有网络延迟、命中时序或多目标实现。固定 Optimizer [`EchoesOfAnOffering/index.tsx:23–38`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts/EchoesOfAnOffering/index.tsx#L23) 包含 on 模式 0.7、avg 模式 `0.7 × 0.50204` 及自选概率的静态条件节点；该平均值不是实际随机序列或逐命中状态机的替代。

## 昔时之歌：治疗记录与转换

固定依据：[`songofdayspast.go:16–79`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/songofdayspast/songofdayspast.go#L16)。渴盼状态、记录池、快照、浪潮状态与次数都使用无装备者后缀的全局键。

`OnHeal` 仅要求 `HealInfo.Caller` 是该四件套装备者；不要求装备者在前台，也不另限制受治疗角色。读取的是 `args[4]`，即 [`template/heal.go:21–55`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L21) 发出的**清契前、加成后的原治疗量**。它包括溢出，亦会包括被生命之契吸收或被角色专属 ReceiveHeal 阻止转为 HP 的部分。这里不是读取有效 HP 增量，也不是简单用 `实际回血 + 溢出` 重建。后一组特殊交互是固定代码行为，目录文字未独立验证，不能标为游戏正确。

每次事件先把治疗量加进共享池并向上限制为 15,000，再检查 `Status.Duration(yearningKey)==0`：若为零，启动 360 帧记录期并排一个 +360 核心任务。没有治疗量必须大于零的门，因此零治疗事件也能启动计时。群体治疗由 [`player/heal.go:8–15`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/heal.go#L8) 按角色分别发出 OnHeal；各目标的加成后治疗量分别进入池。

转换任务执行时：将当时共享池复制到 `healSnap`，把池置零，添加 600 帧浪潮状态，把全局次数直接设为 5。转换不会主动删除渴盼键，而是依靠其持续时间归零。浪潮存在时，之后治疗仍能开始下一个渴盼记录期；新一轮转换会**覆盖**旧浪潮快照、刷新 600 帧并重置为 5 次，不保留旧剩余次数或排第二个独立浪潮。

全局 [`status.Duration:24–32`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/status/status.go#L24) 仅在 `expiry > frame` 时返回正值，故记录期与浪潮到期帧持续时间均为零。它与角色 `StatusIsActive` 的包含到期帧语义不同，不能复用后者。两个时期均使用全局时间；源码没有为它们设置受角色卡肉延长。

## 昔时之歌：命中消费与多装备者分歧

[`songofdayspast.go:84–113`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/songofdayspast/songofdayspast.go#L84) 接受 normal、extra、plunge、elemental-art、elemental-art-hold、elemental-burst 六种源码标签。必须存在未到期浪潮，并且攻击者等于**当前前台角色**；不要求攻击者是套装装备者。每次合法敌人回调消费一次共享次数，并往该宿主追加 `0.08 × healSnap`，最多每次 1,200；次数达到零就删除浪潮状态。没有“同一招只消费一次”去重，因此范围攻击可按实际命中的不同敌人连续消费。

**固定实现的多装备者问题必须显式处理。** 每个四件套装备者都以独立订阅键注册一份 OnEnemyHit（L53–55），而消费函数没有装备者归属门；所有订阅又共享同一快照和次数。事件分发器 [`event.go:134–170`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/event/event.go#L134) 会按注册顺序执行每个订阅。因此拥有 N 名四件套装备者时，一名敌人的一次合法宿主回调可消费最多 N 次剩余额度，并追加最多 N 份加值；最后一个额度被消费后，后续订阅立即看到状态已删除。这与“共享治疗池、每敌人命中仅消费一次”的模型不是同一种行为。

治疗记录端因 `Caller` 匹配不同角色，并不会仅因多装备者而把同一治疗事件重复计数；它们会把各自来源的治疗汇入同一个池。固定目录明确一次渴盼共享多装备者治疗，但没有明确支持同一命中按装备者数量重复消费/加值。这里记录为源码与共享消费者解释之间的分歧；父任务必须明确采用单装备者边界、标明采用原样多订阅行为，或为修正后的共享消费者模型提供独立来源，不能静默声称三者等价或游戏已验证。

固定 Optimizer [`SongOfDaysPast/index.tsx:22–49`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts/SongOfDaysPast/index.tsx#L22) 根据手动选择的治疗量提供五类宿主的 `0.08 × healAmt` 加值；展示 5 次/10 秒不等于执行对应状态机。它不解决上述多订阅问题或回调时序。

## 同帧顺序不能简化为先清理全部到期效果

[`task.go:38–60`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/task/task.go#L38) 对核心任务先按执行帧、再按入队 ID 排序，同帧遵守先入队先执行。[`Core.Tick:138–153`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138) 先运行敌人及玩家等 Tick，之后才运行核心任务；任务文件开头亦明确角色/敌人局部队列先于核心队列。事件分发本身同步。

因此渴盼转换帧的治疗归属依赖实际执行顺序：若治疗先于旧转换任务，源码先把它加进旧池，同时因旧渴盼 Duration 已为零而安排下一轮；旧转换随后把含该治疗的池取样并清零。若旧转换先执行，则该治疗进入新池并启动下一轮。不能仅按帧号把边界治疗固定分到某一轮。

同帧攻击若在转换之前执行，看到的是尚未转换或旧浪潮状态；在转换之后执行才看到新快照与重置次数。浪潮自然到期帧本身不可消费，不需要等待额外删除任务。对余响则必须在实际目标回调前更新并消费随机/窗口状态，不能在所有目标伤害已算完之后补加。

## 本次完成边界

唯一写入为本文。已有原文与清单保持不变。完成的是固定代码、描述与静态 sheet 的语义核对及原文身份核验；没有执行上游应用或本地运行时。随机种子回放、实际队列衔接、结果导入、检查点恢复及 UI 入口均由父任务另行实现和验收；本文不以来源阅读代替这些完成证据。

## 后续实施与必要检查

上述来源边界保留；随后实际核心、正常页面、完整JSON及回放已由根任务完成并检查。原失败、修正与实测见[本批交付记录](../artifact-contact-expansion-20260925.zh-CN.md)。该检查不构成官服实测或正式verified晋升。
