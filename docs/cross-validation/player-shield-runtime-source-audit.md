# 玩家护盾运行时：固定来源审查

状态：`source-backed-provisional`，不代表游戏实测认证。固定 gcsim 版本为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。本任务只写来源报告与归档，不实现通用护盾、角色生成器或敌人攻击。

[原文归档](../../packages/game-data/sources/player-shield-runtime/source.json.gz) 包含 40 份完整原文：15 份通用处理器、实际入口、顺序依赖与许可证，以及五名角色的 25 份护盾定义、调用处、关联被动、配置及生成天赋表。[清单](../../packages/game-data/sources/player-shield-runtime/manifest.json) 保存每文件 SHA-256、字节数、Git blob SHA-1 与固定链接。全部原文在写入前重算 Git blob，匹配保存的非截断固定 Git tree 对应路径。角色文件仅是后续来源候选，不代表已经映射。

## 实际入口与事件顺序

[`pkg/core/player/hurt.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/hurt.go) 只有 package 声明。真正的配置伤害入口在 [`simulation/setup.go:540`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/setup.go#L540)：创建以玩家为目标的 Hurt 攻击，将配置数值放进 FlatDmg，忽略防御，使用 `snapshotDelay=-1`，按核心任务调度。不能把空 hurt.go 当成已经完成的伤害入口。

[`avatar.HandleAttack:29–75`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/avatar/avatar.go#L29) 的顺序是：

1. 读取当前前台索引，同步发 `OnPlayerHit(activeChar, attack)`。
2. `calc` 计算交给护盾的伤害量。
3. 调用 `Shields.OnDamage(activeChar, activeChar, damage, incomingElement)`；其中包含每盾受击及破盾事件。
4. 只有穿透量大于零时才调用 `Player.Drain(... External:true)`。
5. [`Player.Drain`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/heal.go#L18) 先发可修改 DrainInfo 的 `OnPlayerPreHPDrain`，随后改 HP，最后发 [`OnPlayerHPDrain`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L60)。全吸收不进入此扣血路径。

上述路径不发名为 `OnCharacterHit` 或 `OnCharacterHurt` 的事件。玩家 `calc` 本身还保留抗性与玩家反应的 TODO；这套入口不是完整敌人攻击/反应模型的认证。通用资源可明确接收“已经算好、即将交给护盾的伤害量”，但不能混淆为原始敌人倍率或所有减伤后的游戏最终值。

## 身份、适用目标与覆盖

[`Tmpl`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/template.go#L5) 保存生成者、目标、名称、来源键、盾类型、元素、当前原始盾 HP 与绝对到期帧。Target=-1 只保护受击时的前台；指定角色目标只保护该角色，见 [`handler.go:88–105`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/handler.go#L88)。生成者不必在前台。

[`Add:55–81`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/handler.go#L55) 的覆盖身份仅是 **(ShieldType, ShieldTarget)**，不包含 owner、元素或来源键。同类型同目标直接替换，旧盾强弱不参与通用判断。顺序为旧盾 `OnOverwrite()`，替换列表实例，再发新盾 `OnShielded`；覆盖本身不发 `OnShieldBreak`。角色可以在调用 Add 前自行合并、保留 HP 或改到期时间，但这不属于通用覆盖规则。

`Get(type)` 返回列表首个同类型实例，不再按 owner/target 筛选。`CharacterIsShielded` 只看目标适用关系，不检查盾 HP 或到期时间，依赖管理器此前正确维护列表。

## 多盾同时受击与剩余伤害

[`OnDamage:88–143`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/handler.go#L88) 先读取一次 `ShieldBonus()`，随后给每面适用盾传入**相同的全部伤害量**。每面盾独立扣损；给角色的穿透量是原伤害与各盾返回值的最小值。不是按列表依次用剩余伤害消耗盾，也不是把多盾原始 HP 相加。

每盾 `OnDamage` 回调在遍历中立即执行。管理器先完成全部盾的受击与列表移除，再按原遍历顺序向已破盾发 `OnShieldBreak`，最后返回最小穿透量。因此全体破盾事件早于上述角色 HP 扣减，而自定义盾的受击副作用可能发生在其他盾尚未受击时。

对正盾 HP、正吸收因子的普通输入，[`Tmpl.OnDamage:59–78`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/template.go#L59) 先算 `block=oldHP×elementFactor×(1+bonus)`，再执行原式 `HP -= HP×(damage/block)` 并向下夹到零；穿透量为 `max(damage−block,0)`。HP 恰好归零也算破盾，即便穿透量为零。零 HP / 零 block 等退化输入没有由这个公式建立可靠有限数值语义，不应作为正常已存在护盾的来源例子。

## 必须保留的元素与强效来源分歧

[`ShieldStrength:48–56`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/template.go#L48) 查询函数：同元素为 2.5 倍，**盾元素为 Geo** 时覆盖为 1.5 倍。实际 `OnDamage` 却在 L64 检查 **来袭元素为 Geo** 时覆盖为 1.5 倍。两者不同：例如 Geo 盾遭物理伤害时，实际函数因子为 1；Cryo 盾遭 Geo 伤害时实际因子为 1.5。不能把查询函数当实际伤害 oracle，也不能静默修正原文后声称与固定源码完全一致。普通同元素非岩为 2.5、普通异元素且来袭非岩为 1 的分支不存在这项选择条件冲突。

[`ShieldBonus():16–30`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/bonus.go#L16) 将当前未到期（`expiry>frame` 或永久）的全局回调结果相加。该读取发生在适用盾筛选之前；即使没有适用盾，也已经读取并可能清理回调。`Amount()` 返回 `done=true` 时，本次仍加上数值，然后移除该修饰；不是“永久保留”。数值取样到期帧已不含加成，但 `ShieldBonusModIsActive` 使用严格 `<frame` 失效，未清理前可能在到期帧仍返回真。

这里不自动读取生成者或受保护角色某个通用属性字段；角色/武器/圣遗物通过具体 callback 提供强效。固定[钟离 A1](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/zhongli/asc.go#L12)、[托马 A1](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/thoma/asc.go#L14) 及[岩共鸣](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/setup.go#L207) 存在返回 true 的分支，其读取后移除行为不能被“这本来应持续存在”的推测覆盖。护盾与强效的受卡肉行为均仍有明确 TODO。

## 到期、破盾与同帧顺序

[`Tick:146–166`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/handler.go#L146) 仅移除 `Expiry()==当前帧` 的盾，不是 `<=`。先逐个执行 `OnExpire()`，再完成列表移除，之后逐个发 `OnShieldBreak`。因此自然到期也发这个 break 事件；它不能直接等同“被伤害击破”。通用 Tmpl 的 OnExpire/OnOverwrite 为空，角色自定义覆盖则可能有行为。

OnDamage 不再次检查到期。正常每帧调度下，[`Core.Tick`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138) 先 Tick combat/construct，再 Tick player，最后运行 core tasks；[`Player.Tick`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L317) 先清盾再 Tick 各角色。配置 Hurt 的核心任务因此在该帧清盾后执行，但更早的战斗 Tick 回调与跳帧执行不能只凭“到期帧”概括为同一顺序。本来源不支持直接跳过到期帧后再期待 `==` 清理自动补执行。

## 五名角色：可批量映射所需字段与独立边界

所有候选都应明确保存：角色/技能身份、生成或刷新事件、实际生效帧及其队列时钟、生成者与保护目标、来源实例键、盾类型、原文元素（含缺失冲突）、天赋表名称与实际等级索引、取样时刻的基准属性、原始 HP 公式、命座倍率、刷新/合并/上限规则、到期帧，以及 OnDamage/OnExpire/OnOverwrite 副作用是否映射。以下是来源候选清单，不是生产支持列表。

| 候选 | 固定生成与数值字段 | 刷新及必须保留的边界 |
| --- | --- | --- |
| 诺艾尔 E | [`skill.go:43–51`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/skill.go#L43)：技能此处快照 DEF，`shieldFlat[t]+shieldDef[t]×DEF`；立即加入，720 帧，type NoelleSkill、target=-1。 | [`shield.go:13–44`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/shield.go#L13) **没有设置 Ele**，零值在 [element.go:14](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attributes/element.go#L14) 为 Electro；不能静默标成 Geo。C4 在到期、覆盖、伤害破盾时有爆炸路径。A1 是另一 type/指定目标，原文还明确写 Cryo，不能并入 E 的身份。 |
| 钟离玉璋盾 | [`shield.go:13–16,49–60`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/zhongli/shield.go#L13)：生成时实时 MaxHP，`shieldBase[t]+shieldPer[t]×MaxHP`；1200 帧，Geo，target=-1；E 的实际生成在 [skill.go:85](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/zhongli/skill.go#L85) 核心任务。 | 降抗循环、受击 A1、消失状态、C6 受击治疗均是独立副作用；C6 注释与实际 cap 读取也要区分：代码使用钟离自身 MaxHP。Geo 吸收仍受通用函数分歧影响。 |
| 迪奥娜猫爪盾 | [`skill.go:90–144`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/diona/skill.go#L90)：发爪时实时 MaxHP，`(pawShieldPer[t]×MaxHP+pawShieldFlat[t])×holdMultiplier`，五爪1.75，否则1，C2再乘1.15；Cryo，target=-1。 | 每爪首个实际伤害回调生成/延时，单爪多目标去重。已有盾同skillSrc只延长；不同skillSrc先重置HP且在条件内加一次dur，之后又统一加一次dur，再限制至当前帧+5dur。源码对新盾/续期仍有TODO；不能改写成任意固定12秒盾。 |
| 托马 E/Q | [`skill.go:46`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/thoma/skill.go#L46) 在核心+9帧按MaxHP读取E表；[`burst.go:93`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/thoma/burst.go#L93) 每次对应Q攻击首回调按MaxHP读取Q表。共用ThomaSkill、Pyro、target=-1。 | [`genShield`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/thoma/shield.go#L12) 在调用时若有旧盾，E取max(新量,旧HP)，Q相加，再用E等级的MaxHP上限表夹值；无旧盾分支未做该夹值。随后核心+1帧才Add，生效帧起480帧。取旧盾/计算与实际Add之间的同帧竞争不能合并成原子立即刷新。 |
| 莱依拉 E | [`skill.go:45–68`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/layla/skill.go#L45) 角色任务+19帧，无旧盾时按当时MaxHP计算 `shieldBase[t]+shieldPer[t]×MaxHP`，C1乘1.2；Cryo、target=-1、720帧。 | 已有盾只将Expires改为当前帧+720，**不恢复HP，也不重新取样**。到期/破盾清夜星及A1状态、夜星周期与盾强效为独立生命周期，不能由一条HP数值映射自动声称完成。 |

每名角色的 `config.yml` 与 `zz_<character>.dm.go` 已归档，能够核对表名称、生成注释与具体等级数值；本审查没有执行生成器，也没有把任何条件倍率伪造为通用默认。上述元素、吸收、回调及续期差异仍需父任务显式选定受支持范围。

## 验证与完成界限

完成原文 Git blob/SHA-256 身份核对和归档完整性检查，不是运行时测试。没有改生产代码、运行测试或构建、执行外部模拟器。档案说明的是固定实现；敌方护盾、角色专属副作用、真实敌人攻击编排及断点续跑均不能由这份来源审查推定已实现。
