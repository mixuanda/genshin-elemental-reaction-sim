# 剩余装备自动运行时差距审计（2026-09-28）

本记录是实施前审计快照，不代表当前覆盖状态。血红之证与炉火融炼之心已在后续实现；请以[星辉圣遗物组合实现报告](../stellar-artifact-composition-20260928.zh-CN.md)为当前状态依据。本记录其余部分仍按当时 checkout 的运行时代码和已固定的本地源码资料审计；不以旧报告的覆盖率或目录计数代替调用链。判断标准是：效果是否从真实队伍装备声明出发，由模拟事件产生触发、窗口、叠层、消费和队伍传播。能手工输入命中前状态、但运行时不生成状态的规则，仍记作“未自动运行”。

## 实施前建议组：两套星辉圣遗物（已实现，见当前报告）

当时建议优先接入**血红之证（`artifact-set:15047`）与炉火融炼之心（`artifact-set:15048`）**。两者的固定 a7 包分别为 `internal/artifacts/scarletproof/scarletproof.go`、`internal/artifacts/heartofthefurnace/heartofthefurnace.go`，当时条件公式位置为 `packages/game-data/src/artifact-additional-effects.ts:220`–`:221`。当前已实现范围、触发标签、状态窗口和验证边界见[实现报告](../stellar-artifact-composition-20260928.zh-CN.md)。特别是炉火融炼之心：固定来源的 wearer `OnStellarConduct`、`OnStellarSwirl` 与 wearer 的 `OnEnemyDamage` 且 `AttackTag.IsStellar()` 都会触发；其 `+50% ReactBonus` 针对所有 `IsStellar` 攻击标签，不限于星导领域或单一反应类型。

本审计提出的实现边界是建立 special-equipment state/profile，保留触发者、实际伤害来源、受益角色、过期帧及套装种类去重：血红之证管理合法触发者的暴击窗口并把40%奖励加到星扩散公式；炉火融炼之心管理12秒攻击状态，并对所有 `IsStellar` 攻击标签应用全队 `+50% ReactBonus`，而非限于单一星辉反应。当前实现细节以链接报告为准；这类奖励应由特殊反应公式路径消费，不能当普通 `dmgBonus` 处理。

## 已存在的自动宿主

当前代码已经有数个事件运行时，但它们各自接收显式模型，尚未成为统一的“装备选择→运行时事件模型”路径。

| 已有运行时 | 已有自动事件面 | 精确位置 |
|---|---|---|
| 武器命中叠层（13把、6类） | 实际普通伤害回调、持有者/前台/攻击标签/伤害/暴击过滤、冷却、叠层和真实面板读取 | `packages/schemas/src/weapon-hit-stack-model.ts`；`packages/sim-core/src/weapon-hit-stack-runtime.ts`；普通宿主在 `packages/sim-core/src/simulator.ts:3217`、`:3220`、`:10169`、`:5896` |
| 武器独立被动／追击 | 已登记模型可订阅技能、收到粒子和伤害；其中独立伤害进入事件队列 | `packages/reaction-formulas/src/independent-weapon-proc.ts`、`weapon-proc-lifecycle.ts`；`packages/sim-core/src/weapon-proc.ts`；技能／粒子事件在 `simulator.ts:10715`、`:11930` |
| 六种普通圣遗物动态增益 | 爆发、普通反应、生命之契变化、实际掉血、换人、属性读取和延迟施加 | `packages/reaction-formulas/src/artifact-buff.ts`；`packages/sim-core/src/artifact-buff-runtime.ts`；队列接线集中在 `simulator.ts:4799`，实际反应入口在 `:4809`、`:16779` |
| 四种圣遗物功能事件 | 流放者爆发回能、学士实际拾取粒子、赌徒持有者击杀重置、烬城二件套夜魂迸发回能 | `packages/schemas/src/artifact-event-source.ts`；`packages/sim-core/src/artifact-runtime.ts`；队列入口 `simulator.ts:10055`、`:10702`、`:11934` |
| 两种圣遗物伤害回调 | 余响真实命中随机判定；昔时真实治疗记录、转换、五次伤害消费 | `packages/sim-core/src/artifact-damage-runtime.ts`；宿主入口 `simulator.ts:9830`、`:10144`、`:16610` |
| 三种月曜圣遗物条款 | 如雷月感电、乐园月绽放、晓歌换入/回场状态；乐园对绽放族真实触发叠层 | `packages/reaction-formulas/src/lunar-artifact-bonus.ts`；`packages/sim-core/src/lunar-artifact-runtime.ts`；普通 Bloom / Hyperbloom / Burgeon 与完成换人回调在 `simulator.ts:6385`、`:10555`、`:10929`、`:16791` |

这些不是全库存自动覆盖：`SimConfig` 把 `weaponHitStackModel`、`artifactBuffModel`、`artifactDamageModel`、`artifactEventModel` 和 `weaponProcModel` 分列为可选声明（`packages/schemas/src/types.ts:1698`、`:1704`、`:1713`）。应用也提供各自独立的勾选面板，例如 `apps/web/src/weapon-hit-stack-controls.ts`、`weapon-proc-controls.ts`、`artifact-event-controls.ts`、`artifact-damage-controls.ts`。配装求解返回静态/条件公式与阻塞项，不返回这些运行时模型：`packages/game-data/src/equipment-build.ts:166`、`:176`–`:198`、`:240`。

## 仍未自动运行的普通装备条款

共同缺口是已有 resolver 接受 `effectContext`、`weaponStacks`、`setEffectActive`、计时剩余次数或元素集合，再计算一个条件快照；大多数入口明确说明自己不会生成触发、计时、层数或消费。例子如下，均已有可读的条件定义，不是“等外部资料”的统称。

| 条款组 | 仍未自动产生的状态 | 现有公式/事件钩子 | 主要文件 |
|---|---|---|---|
| 普通武器条件、扩展与命中特有层数 | 狼牙、裁叶、猎人之径、白雨心弦、风鹰/四风等按命中、能量、治疗、移动/瞄准或冷却积累的分立层数；目前调用方可交入已确认状态，未由主队列持续维护 | `weaponHitStackRuntime` 是明确被登记的13把武器专用栈，不会代管其余武器；普通命中队列可提供 owner、标签、元素、目标和真实伤害，技能、能量、治疗、HP/Bond、换人和护盾另有现成事件入口 | `packages/game-data/src/weapon-conditional-effects.ts:87`；`weapon-additional-effects.ts:96`；`weapon-extended-effects.ts:111`；`weapon-melee-hit-effects.ts:96`、`:119`；`weapon-bow-effects.ts:212`、`:216`、`:227`；`packages/sim-core/src/simulator.ts:3220`、`:9830`、`:9825`、`:10549` |
| 普通武器定时属性/团队转授 | 反应叠层、受伤/治疗标记、拾叶/拾晶、后台衰减、触发后团队转授、同类团队被动去重；如自由誓言/终末/晚星/千夜、船坞助手/动力锯、赦罪/静水 | 主机已有反应、生命、治疗、能量接收、拾取和换人事件；但这些武器各有独立的归属、冷却、退场保留和共享规则，不能把一个已有通用回调直接当完整触发器 | `packages/game-data/src/weapon-extended-effects.ts:158`、`:161`、`:176`、`:196`、`:197`、`:211`；`weapon-bow-effects.ts:202`；`weapon-catalyst-effects.ts:164`、`:204`；`packages/sim-core/src/simulator.ts:10549`、`:10715`、`:11930` |
| 条件圣遗物状态与按目标效果 | 魔女、逐影、剧团、水仙、沉沦、追忆、辰砂、花海、苍白等的元素命中/类别栈、技能后窗口、HP变化、受伤栈、切人清除与目标减抗寿命 | `getArtifactConditionalControls` 把这些条件暴露为手工快照；`resolveArtifactConditionalEffects` 只解析命中前/面板状态；普通目标减抗计算器另行消费手工有效布尔值 | `packages/game-data/src/artifact-conditional-effects.ts:13`–`:39`、`:96`–`:110`、`:182`、`:192`；`packages/game-data/src/artifact-reaction-effects.ts:37`–`:44` |
| 四件套团队/触发窗口 | 染血击杀、武人战技、沙楼重击、饰金之外的角色窗口、夜间低语结晶/月笼条件、风起之日每次命中、天赐元素传授等；当前只接受 `setEffectActive` 等显式状态 | 已有普通 damage/reaction/swap/shield/character hooks；但没有这些套装的专属私有状态、队伍 receiver 去重和到期事件。宗室/教官/饰金/谐律/乐园/辰砂等六套已经进入 `ArtifactBuffRuntime`，不要重复造第二套普通运行时 | `packages/game-data/src/artifact-additional-effects.ts:25`–`:54`、`:125`–`:136`、`:180`、`:209`；`packages/sim-core/src/artifact-buff-runtime.ts:93`–`:178` |

此外，普通 hit-stack 自动钩子目前明确从共同伤害结算口 `settleTargetHealth` 排队（`simulator.ts:3217`–`:3220`）。普通团队伤害已具备真实 callback；月曜/星辉的特殊伤害独立经过自己的解析、交付及属性快照路径。不要在特殊伤害尚未给出可信 owner、贡献者、目标及真实暴击结果时，直接把特殊事件伪装成普通伤害 callback。

## 月曜装备条款仍未自动运行

已经自动运行的三种四件套见上表；以下规则则在数据/公式层存在，但其**专属装备状态**没有接入自动运行时。

| 条款 | 未自动状态 | 当前源码钩子及精确文件 |
|---|---|---|
| 穹境示现之夜（夜之天空显现） | 邻近队员触发任一月曜反应时的前台资格、4秒暴击窗口，以及按不同“月辉明光”效果种类去重后的全队月曜反应加成 | 固定 a7 包 `internal/artifacts/nightoftheskysunveiling/nightoftheskysunveiling.go`；四件套公式/手工 active 与 moonsign 已在 `packages/game-data/src/artifact-additional-effects.ts:55`、`:212`–`:220`；现有月曜反应入口 `packages/sim-core/src/simulator.ts:16786` 和 Bloom/核心回调，但没有该套的窗口/种类注册表 |
| 纺月的夜歌 | 前后台均可由装备者元素伤害触发8秒全队精通窗口；依不同月辉效果种类提供全队月曜反应加成并做同类不叠加 | 固定 a7 包 `internal/artifacts/silkenmoonsserenade/silkenmoonsserenade.go`；公式/手工状态在 `packages/game-data/src/artifact-additional-effects.ts:55`、`:212`–`:220`；普通命中和特殊反应伤害的 owner/元素事件已分别存在，尚无该套效果状态与 moonlight-type registry |
| 如雷的盛怒四件套 | 月感电装备归属奖励、战技冷却返还以及前台触发/0.8秒门限；星超导反应奖励 | 源规则已列在 `packages/game-data/src/artifact-reaction-effects.ts:65`–`:70`；当前只产出普通剧变/激化反应项，月感电与星超导被明确阻塞；月曜反应部分应复用真实 special reaction contributor，而不是把普通 Electro-Charged 奖励扩大化 |
| 霜结、血染荒城、碎裂光环、掘金之锹、乌髓灯、月织之晨、帷间夜曲等武器条款 | 月曜反应伤害/暴击/回能、护盾生成触发、队伍传播和同一装备者触发后的窗口刷新 | 有精确的专属分支名称/条件快照，未由月曜运行时生成：`packages/game-data/src/weapon-bow-effects.ts:229`；`weapon-polearm-effects.ts:90`、`:95`、`:110`；`weapon-catalyst-effects.ts:191`、`:241`、`:254`。月曜武器效果应接到 Moon Charged/Crystallize/Bloom 的有效事件与每段受益角色快照；特殊加成不能回填普通增伤或只作用于装备者的公式 |

有代表性的固定实现位于 a7 pinned source tree：`packages/source-host/stellar-overlay/source-tree.json.gz`。上述月曜套装包在 `apps/web/public/source-host-stellar/inventory-metadata.json` 可按 `resolved.configurationKey` 找到实现路径；不是缺少固定资料。

## 星辉装备条款仍未自动运行

| 条款组 | 未自动状态 | 当前源码钩子及精确文件 |
|---|---|---|
| 血红之证（星扩散） | 装备者合法触发星扩散后的10秒暴击窗口，以及星扩散反应专属40%奖励 | a7 包 `internal/artifacts/scarletproof/scarletproof.go`；现有条件公式仅恢复暴击状态，40%星扩散奖励仍被标为特殊反应协议未接入：`packages/game-data/src/artifact-additional-effects.ts:220`。星扩散事件由 `packages/sim-core/src/stellar-swirl-runtime.ts` 单独交付，需附上真实触发者而非贡献者猜测 |
| 炉火融炼之心（实施前快照，已实现） | 原缺口为12秒攻击增益、全队 `+50% ReactBonus` 与同名刷新；固定来源触发为 wearer 的 `OnStellarConduct`、`OnStellarSwirl`，或 wearer 的 Stellar-tagged `OnEnemyDamage`，反应加成适用于所有 `IsStellar` 标签 | a7 包 `internal/artifacts/heartofthefurnace/heartofthefurnace.go`；实施与当前准确范围见[实现报告](../stellar-artifact-composition-20260928.zh-CN.md) |
| 影中沉凝的幻灭 | 星超导反应40%奖励、受星超导影响目标的逐击16%暴击率 | a7 包 `internal/artifacts/disenchantmentindeepshadow/disenchantmentindeepshadow.go`；普通超导系数和条件暴击快照已有规则，星超导仍未接入：`packages/game-data/src/artifact-remaining-effects.ts:119`、`packages/game-data/src/artifact-additional-effects.ts:225`。需特殊反应状态给出目标 debuff 与贡献来源 |
| 戍望谣歌、白湖冬羽、柔灯挽歌、无垠蔚蓝、金流/万世、星鹫之羽等武器 | 星烁/星扩散专属倍率、暴击、回能或触发窗口；其中部分已支持手工层数/窗口，未自动累计/应用 | `packages/game-data/src/weapon-polearm-effects.ts:124`；`weapon-extended-effects.ts:200`、`:214`；`weapon-catalyst-effects.ts:197`、`:222`；`weapon-bow-effects.ts:223`。触发层数、冷却和特殊 reactionBonus 必须在正确类别/持有者上计算，不能转成普通元素增伤 |

星辉底层不是通用伤害事件。`packages/sim-core/src/stellar-swirl-runtime.ts` 保留 `guide-profile-source-conflict`；目前实现域与固定 GCSIM 行为存在差异，因此不能把它扩成更广范围的自动源模型。星导领域则由 `packages/sim-core/src/stellar-conduct-runtime.ts` 输出实际应用计数和领域窗口，但星辉四件套事件尚未跟随该输出。这两类进度必须分开记录。

## 建议的下一可实施整组

1. **先做装备声明到已实现模型的自动桥接（普通主线）。** 从 `EquipmentBuildResolution.build.equipment` 的实际 `weaponId`、套装件数与角色归属，构造当前已有的 `weaponHitStackModel`、`weaponProcModel`、`artifactBuffModel`、`artifactEventModel`、`artifactDamageModel` 中适用声明，并检查面板 baseline 与未映射条件；不要从名称或词条描述补出缺失状态。实现面已具备，缺口是生成声明与把配置贯穿工作台、simulator、worker、capture。这样可以让当前已实现的普通触发条款真正随装备自动运行。
2. **（已完成）接入星辉两套可执行圣遗物回调。** 血红之证与炉火融炼之心已实现；准确范围、事件标签和当前验证状态见[实现报告](../stellar-artifact-composition-20260928.zh-CN.md)。
3. **再做月辉标记和套装窗口整组。** 将 Night of the Sky’s Unveiling、Silken Moon’s Serenade 的 Moonlight effect type/unique-type registry，与现有 `LunarArtifactRuntime` 的完成换人和 Lunar reaction callbacks 共用；处理前后台资格、4/8秒窗口、Moon Sign 快照、队伍受益者和重复套装非叠加。计算规则已有明确源码，可按固定事件开工。
4. **之后扩展普通装备的通用生命周期映射。** 以现有 burst/reaction/HP/Bond/heal/particle/swap/shield/kill/damage 回调建立按 owner 的状态驱动器，再批量接入共享触发骨架：技能/命中窗口、不同攻击类别栈、治疗/生命变化栈、目标减抗、拾取物与追击。每个家族保留源内冷却、触发先后和 owner 过滤，源注释中的 TODO 或与游戏目录冲突的边界不自动升级成已知机制。

## 边界

`artifact-conditional-effects.ts` 中基于现有固定来源实现的规则可直接推进；反之，如果来源本身写有 TODO、与目录存在未解决的触发/持续时长冲突，或需要尚未实现的动画/体力/受击系统，就不是单纯生产接线。例如 `weapon-conditioned-expansion.ts:103` 的聊聊棒触发/持续时间冲突、`weapon-polearm-effects.ts:111` 的圣祭者之辉 5/6 秒差异、`weapon-extended-effects.ts:144` 的熔猎异端之刃移动距离到档位映射缺失，须单独保留来源冲突/不可推导状态。

本报告记录只读差距审计；本次更正仅更新本文件以标注实施后状态并修正炉火融炼之心的固定来源触发范围，没有改实现代码或运行测试/构建。
