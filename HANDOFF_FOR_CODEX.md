# Codex Handoff：提瓦特伤害实验室 / Genshin Team DPS Simulator

## 0. 你的任务

你将接手一个已经能运行的浏览器端原神队伍 DPS 模拟器 MVP。不要把它当成一次性页面重写，也不要直接追求“支持全部角色”。首要任务是把现有原型演进为一套：

- **数值可审计**：每一段伤害都能解释来源、面板、Buff、Debuff、反应、抗性、防御、暴击和归属。
- **机制可验证**：核心公式、事件顺序、快照、能量、ICD、元素附着等均有自动化测试。
- **数据可版本化**：角色、武器、圣遗物和敌人数据与模拟引擎解耦，并标注版本、来源和校验状态。
- **结果可复现**：相同配置、数据版本、随机种子和引擎版本必须得到相同结果。
- **便于继续扩展**：以后新增角色不需要修改模拟器核心，只需要增加数据和少量机制插件。

请直接检查并修改现有项目，不要只输出架构建议。先保留现有结果作为回归基线，再开始重构。

### 2026-08-01 权威 Current State

以下状态优先于后面的历史里程碑描述：

- 当前输入契约为 `schemaVersion: 1.47.0`、`engineVersion: 1.47.0-elemental-application-icd-root`，当前 `runManifest.version` 为 `1.3.0`；反应核心、目标任务、交付顺序、感电传播、经典反应公式、普通直伤组和数字元素施加分别由显式版本字段固定。1.46→1.47 迁移只更新身份、注入 `elementalApplicationIcdModel`，并把旧 application 显式迁移为 No ICD 或 legacy boolean selector；它不会猜测 fixed group、自动绑定未经核验技能、改变默认伤害或启用其他 opt-in 机制。精确 V146/V145/V144/V142 wire、Manifest 和 Fixture 保持冻结；精确 1.44–1.47 均可在既有版本门下显式选择 v3。历史版本夹带未来 model/selector 会 fail-closed。
- `aura-v5` 已把正/反融化、正/反蒸发、超载、超导、感电、冻结/碎冰、火/水/冰/雷扩散、火/水/冰/雷结晶、原激化/超激化/蔓激化、燃烧，以及绽放/草原核/烈绽放/超绽放接入无 DOM 的核心。`aura-v6`–`aura-v9` 继续冻结共享 Gauge 有序链、Quicken→Bloom core task、EC cleanup 与全局 cadence/Hitlag/Wane 所有权。精确 1.42 历史身份下 v9 只允许 `legal-frame-v1 + 60 FPS + target-phase-v2`；精确 1.44–1.47 可在同样的帧率/时间线门下与 v2 或显式 v3 组合。这些经典反应路径仍全部是 `fixed-gcsim-provisional`，不能视为官服真值或完整 gcsim 精度；v1–v8 的历史语义和 Golden 保持不变。
- 1.44 `target-phase-v3` 保留 v2 的 QueueEnemyTask→同目标 `Reactable.Tick` 边界，但把每个实际 Burning Tick 的范围伤害/火附着改为 callback 所有的 `burning-callback-zero-delay-v1` 微事件。它按敌人注册顺序处理接收目标：尚未执行当帧 Tick 的目标只物化到 F-1，以当前 Aura 结算反应后再运行 F `Reactable.Tick`；已执行 Tick 的更早目标在 Tick 后应用。`delivery.attempts` 完整记录每个注册敌人的 `landed / miss / unresolved`、`before/after-reactable-tick` 与命中/伤害/`targetStateTimeline` 外键，严格 Schema 和 trusted 完整性门会双向闭合。正延迟的子反应仍在全局 heap，碎冰递归模式也仍是独立契约。这条切片固定参考 gcsim 提交 `ef41805d855a60b9e1035293584b85c085dc69e7`，但只能标记 `fixed-gcsim-provisional`；不是官服真值、通用敌方任务模型或完整 gcsim parity。
- 1.45 新增无 DOM 的 `packages/reaction-formulas` 公式信任根。唯一可选 profile 为 `gcsim-b4ae769-classic-provisional-v1`，固定来源 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，规范化内容 SHA-256 为 `sha256:7ae4ee955e0c7986c47931cff596694c8cd4754b48df90e0ad1cf092738ccafd`。它冻结 1–100 级反应等级基准、融化/蒸发基础倍率、转化反应倍率、扩散自身/传播通道（含水传播 0 伤）和超激化/蔓激化加算倍率；V145 完整性门把配置选择、Manifest 根、来源角色等级与实际反应交付重新计算并闭合。当前根显式携带 `officialServerTruth: false` 与 `completeGcsimParity: false`：它不是官服真值或完整 gcsim parity，也不证明完整 Aura/ICD、action-snapshot EM/反应增伤的来源、Ability 命中数据库、动作帧、粒子或 Lunar 反应。
- 1.46 新增无 DOM 的 `packages/icd-profiles` Damage Group 数据叶。唯一可选 profile 为 `gcsim-b4ae769-damage-groups-provisional-v1`，固定同一 gcsim 提交中的 58 组 reset timer 与 damage sequence，规范化内容 SHA-256 为 `sha256:7e6d16a2a90ac7d9bb84daa80c43f09d28fb65e45319c62f67d14c50bb5e9c70`，覆盖范围明确为 `damage-group-reset-and-damage-sequences-only`。`tailPolicy` 固定为 `clamp-last`，reset 固定在 `windowStartFrame + resetFrames - 1`，并按 reset-before-hit 处理该边界帧。它不包含 elemental-application sequence；`officialServerTruth` 与 `completeGcsimParity` 仍为 false。
- 普通直伤状态机按每个目标实例建立，再以结构化的“来源角色 + `icdTag`”嵌套 key 隔离；`icdGroup` 故意不进入 key，所以同 Tag 切组共享计数器，而活动窗口的 reset timer 继续由开窗组拥有。Miss 不调用状态机、不消费序列且没有日志行；landed 但数值免疫会消费；序列 0 产生零直接伤害并把 `damageGroupOnEnemyHitAllowed` 记为 false，但不会阻止 Aura/反应、目标 Hitlag、草原核接触或技能自己的 hit-confirm 粒子回调。固定序列在全部伤害插件之后相乘，代码插件不能用绝对覆盖复活零槽。
- V146 为每个 landed 普通直接 DamageEvent 写入一条 `directDamageGroupLog`：未配置的旧命中是显式 `bypassed`，已配置命中记录目标/来源/Tag/组、开窗组、reset、hit/sequence index、序列倍率、配置倍率、逐插件倍率 trace、插件后倍率和最终倍率。public Zod 与 trusted 完整性门从配置、固定 profile 和 DamageEvent 独立重放 Damage Group 状态、顺序、基数、backlink、窗口、非插件倍率与 root/model 身份；删除、重复、换序或改写这些可重放字段会 fail-closed。插件 trace 明确携带 `structural-only-unverified-runtime-output-v1`：公开 JSON 只校验链结构、manifest 顺序和下游算术，不能重放任意运行时代码、证明插件真实输出，或排除 trace 与插件后倍率的协调篡改。公共普通命中不得冒用内部 `reaction-a`、`reaction-b`、`burning` 三组。
- 1.47 在 `packages/icd-profiles` 增加独立元素施加 profile `gcsim-b4ae769-elemental-application-provisional-v1`，固定来源 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，内容 SHA-256 为 `sha256:df461cf8aefee33ec57b8a8f83e2ec26497f17be8bc3ee1e6d667bf91d4015c1`。来源保留 58 组，`reaction-a`、`reaction-b`、`burning` 三组由引擎拥有，公共直接命中只可选择 55 组。该 root 与 1.46 Damage Group root 完全分离，两种同名组不得混用；三份固定 root 都明确 `officialServerTruth: false`、`completeGcsimParity: false`。
- 1.47 application selector 只能是 `no-icd-v1`、`legacy-boolean-profile-v1` 或 `fixed-gcsim-application-v1`。fixed 状态按目标、来源角色和 Tag 隔离，Group 不进入 key；开窗组拥有 reset timer，当前组选择数字 sequence，tail clamp，reset 在 `start + resetFrames - 1` 且 reset-before-hit。倍率 0 的 evaluated attempt 仍消费，No ICD 不开窗，有效 Gauge 为 `nominal × multiplier`，纳西妲 Skill 的 `1.5` 槽保留数字语义。legacy selector 保留旧 `(actor, tag, profile)`、`start + resetFrames`、repeat/clamp 与 target-global Burning。
- V147 的 `elementalApplicationIcdLog` 为每个配置应用的普通直接命中目标尝试恰写一行。`miss`、`target-aura-blocked`、`no-aura-engine`、`mechanics-truncated` 都是明确 skip reason 且不推进窗口；evaluated 行闭合 selector、窗口、序列、名义/有效 Gauge 和 reciprocal 命中/伤害外键。带应用的 physical 命中会拒绝，包括继承出的 physical 元素。Burning Tick、扩散传播等反应拥有/派生应用尚未进入该统一日志。
- 当前开发优先级是基础经典反应、元素附着 ICD、Aura 生命周期和结果完整性，不是展示扩张。1.44 的 Burning 结果门现在反向要求 start/stop 审计，重放 generation、首 Tick、15f cadence、tickIndex、Fuel 自然到期、callback、反应伤害与时间线反链，并把 Marker/Fuel 标量和 Fuel-expire 的 Aura 消费扎回权威快照；普通 stop 必须有精确 audit、callback、直接 Aura 消费、目标相位衰减或显式机制截断所有者。每个目标的首个物化 Burning 流固定为 generation 1，终止流保留退出 generation，内部 stop 递增一次后下一次 start 再递增一次，因此合法重启为退出 generation `+2`；目标时钟模式下，所有 lifecycle row 直接绑定当前事件切点重放出的目标帧。v3 `before-reactable-tick` 附着的 audit 快照绑定上一全局帧末尾的目标本地帧：无 Hitlag 时它比 lifecycle 帧小 1，跨越该 callback 的 Hitlag 下两者可以相同，禁止机械地做 `-1/+1`。仍未从输入配置完整重放每个 Burning Gauge、全部特殊 Aura 和所有可达反应链，因此不能把这些门称为完整 Aura 证明。
- `target-phase-v3` 结果完整性不允许 motion/phase/delivery 日志互相自证：注册目标、名称、初始位置、圆形 hurtbox、`targetMotions`、`targetPhases` 和三层目标策略从 `SimConfig` 重放；callback 截止、Burning 圆心/半径/`1U` 火附着，以及每个 attempt 的 outcome、距离、阈值、reason、`damageAllowed / auraAllowed / hitConfirmAllowed`、伤害倍率和 mechanics status 都必须与配置根一致。旧 `aura-v2/v3` 与 `aura-v4` 的非 Pyro legacy 分支仍只权威执行各自已经实现的首反应，但有序可达性预演现在会把不消费来袭 Gauge 的 EC 计为真实分支、让 EC 后的剩余雷量继续检查 Quicken，并按固定参考保持 Cryo reverse Melt 不扣来袭 Cryo；一旦发现第二条尚未实现的可达反应，就以 `legacy-multi-reaction-order` 或 `non-pyro-multi-reaction-order` / `TARGET_MECHANICS_TRUNCATION` fail-closed。`aura-v4` 已有的 Pyro 有序路径保持原语义。Frozen Superconduct 是消耗普通 Cryo/Frozen 后丢弃剩余来袭雷量的终止分支，不得伪造后续 Quicken。这些边界都不表示旧模式已经实现完整多反应链。
- Hitlag 模式下，Burning Fuel/首 Tick/后续 Tick 的全局截止按严格早于观察事件的已审计 Hitlag 与目标本地截止重投影；同一命中末尾才应用的 Hitlag 不得回写先前审计。Fuel 驱动的 Quicken rebase 和 Burning stop 后恢复的 Quicken 固有到期也按目标本地时钟校验。`aura-v5/v6` 的同击 Quicken→Burning→同步 Bloom 日志已改为 Aura 实际的 G1→G2→G3 顺序，避免 G2 反向覆盖 G3 active source；当前 Burning 截止重放仍以结果中的已校验 `targetHitlagLog` 为输入，尚未完成 Ability `haltFrames/factor` 到 Hitlag 行的 config-root provenance。
- 草原核在触发后 30 帧生成，拥有稳定 ID、来源/归属、确定性二维位置、全场 5 个上限、接触/消费/淘汰/到期日志和完整 DamageEvent 父链；自然绽放、烈绽放、超绽放接入通用 ReactionA。超绽放在影响帧用 15m 选择圆与目标 hurtbox 求交，再按中心距离和注册顺序稳定选敌。当前生成后 `300f` 寿命来自带不确定注释的固定参考代码，必须继续标记 `provisional`。
- 1.39 引入的 `reactionDeliveryModel` 提供两种严格模式：现有兼容预设和历史迁移默认使用 `deferred-event-heap-v1`；`shatter-recursive-zero-delay-v1` 从精确 1.39 身份开始可显式选择，1.39→1.40 迁移会原样保留该选择，并继续要求 `legal-frame-v1 + 60 FPS`。递归模式只把零延迟碎冰子伤害在同帧、同目标、同来源上下文中先于直接或嵌套反应父段交付，允许 `parentDamageEventId` 指向稍后编号的父段；它不会同步化其他反应或敌方任务。结果门会验证连续 ID、无环父链、同帧/目标/来源约束，以及每个递归碎冰子段与唯一 `reactionDamageLog` 的双向引用。固定 gcsim 还会建立一个 `DoNotLog` 的零伤害 “Freeze Broken” 合成攻击，本项目尚未实现。
- 通用 ReactionA 按 `目标 + 角色 + 反应` 在 30 帧窗口允许碎冰、超导和绽放系前两次伤害；ReactionB 对超载、感电只允许第一次。增幅反应使用来源角色的行动快照 EM、命中帧实时反应增伤；`scalingOwnerId` 和 `creditOwnerId` 不会篡改反应所有权。
- 当前 V147 完整性门继承 V146 的基础反应、公式和普通直伤组证明，再从配置与固定 application profile 独立重放每个普通直接命中目标尝试、skip/evaluated 判定、状态窗口、数字倍率、名义/有效 Gauge 与 reciprocal 外键。V146 的历史证明保持原样；V147 新增层不等于从反应派生应用、完整 Ability/Aura、动作快照或角色数据库重放全链。
- Frozen 现在要求记录了 `freeze` 的反应事件拥有对应 `frozenReaction` 与唯一非到期生命周期行；目标 Aura 时间线中 Frozen 的出现/消失边沿必须由 start、自然到期、消费或精确匹配的机制截断拥有，普通 `aura-natural-expiry` 不能伪装成 Frozen 到期。活动 Frozen 必须在 simulation-end Aura 中仍然存在，或由显式自然到期/消费/机制截断闭合。自然到期的来源与触发事件必须成对保留并匹配当前 generation 的最近状态，或成对为 `null`；不能挂到无关事件或不存在角色。感电每个 target/generation 必须先有唯一 `start`，普通 terminal stop 只能有一个且需要已建模原因，Wane 必须保持 `Tick + 6f`、与时间线双向闭合，且每个未取消的范围内 tick 只能拥有一个 callback 结果；v2–v7 的旧式 Wane 仍按 damage child 识别，避免把流重启后借用新 generation 的冻结兼容语义误判为重复。同一命中若先识别 EC、随后因旧 Aura 模式无法完成第二反应而机制截断，`periodicReaction` 必须为 `null`，不得宣称 start/refresh 或首伤已排队；已存在流遗留在 heap 的 tick、Wane、expiry 也在写日志、伤害或时间线前逻辑取消。
- 1.32 已建立玩家反应自伤基础切片：燃烧、绽放、烈绽放和超绽放按静态玩家位置/碰撞半径求交，并在实际伤害帧由当前前台角色承受。配置必须显式提供每名队员的初始 HP 比例和火/冰/水/雷/风/岩/草/物理八项玩家抗性；绽放系使用独立的玩家 ReactionA，按“受击玩家 + 来源角色 + 反应”在 30 帧窗口允许前两次伤害。
- 玩家反应伤害先经过玩家抗性与结晶盾，再扣 HP；结晶盾吸收/破裂、HP 钳制到 0 后继续、空间命中、逐次伤害、HP 时间线/汇总/总计及到 Burning、草原核、ReactionA、护盾日志的双向外键均由核心和严格 Zod Schema 维护。玩家侧事件完全排除在敌方总伤、DPS、角色/技能聚合和敌方伤害曲线之外。
- 每次模拟返回 Manifest 1.3.0，固定配置哈希、Schema/引擎/数据版本、解析后的运行选项、随机种子、有序插件身份、完整 `reactionFormulaRoot`、`directDamageGroupRoot` 与 `elementalApplicationIcdRoot`；复现键使用 `gdl-v2-fnv1a32-*`。当前 32-bit FNV-1a 已知可碰撞，只是 drift detector，不能作为密码学身份或签名。
- 1.33 引入且后续版本保留的目标时钟只在 `legal-frame-v1` 下启用。每个命中可显式声明 `targetHitlag: { haltFrames, factor }`；Schema 要求 `0 <= haltFrames <= 600` 且 `0 <= factor <= 1`。扩展帧采用 `ceil(ceil(haltFrames) × (1 - factor))`，命中所在目标帧先完成，暂停从下一全局帧开始。同目标可叠加、不同目标隔离；Miss 不应用，landed 但伤害免疫仍可应用，零扩展只记录审计。1.39 会让配置了 Hitlag 的 v2 Miss 也生成 `blockedReason: "TARGET_MISS"`、`applied: false` 的审计记录，但绝不推进目标时钟。严格结果 Schema 会逐点重放目标时间线、禁止同一命中重复产生 Hitlag，并精确核对超导状态的累计延长。普通 Aura、Frozen、Quicken、Burning Fuel/Tick 和感电共存自然到期使用目标本地截止帧；已存在的超导减物抗状态会延长。v1/v2 中陈旧的 Burning 唤醒必须先按目标时钟重投影，不能在原全局帧提前衰减或执行。
- 感电的 `+10/+60` 伤害 Tick 与 `+6` Wane、附着 ICD、core reaction task/GCD、ReactionA/B、独立反应伤害、草原核/结晶实体、行动/Buff/能量/粒子、目标运动/阶段和玩家侧状态仍按全局帧运行。1.38 v2 只允许把感电共存自然到期记录为 `Reactable.Tick` transition；1.40 v8 只在该目标 Tick 上决议 Quicken→Bloom depletion cleanup，不会把 Tick/Wane 本身本地化。草原核日志明确标记 `global-frame-gadget-v1` / `not-affected-by-enemy-hitlag`；不能把 v1、v2 或 v8 cleanup 描述为通用敌方任务暂停。
- 1.41 的 `nearby-wet-radius-v1` 只改变感电实际伤害 Tick 的目标集合：源目标始终优先，其余候选按注册顺序读取 Hydro Gauge 与二维位置/圆形 hurtbox，在显式半径内的湿目标各生成一条独立 `DamageEvent`。`electroChargedPropagationAudit` 必须标记 `mechanicsDataStatus: "community-provisional"`，并给出半径、源/目标位置、距离/阈值、Hydro Gauge、选中结果、拒绝原因及伤害/命中反链。副目标伤害沿用源 Tick 的 owner、snapshot、等级、EM 与反应增伤，并独立应用自身雷抗/免疫。
- 1.42 基础反应发布门必须保持 24 个精确场景、24/24 个非 `none` 标签与 16 类经典反应，覆盖确定性、无机制截断、结构化伤害构成、个位显示伤害和曲线末值。该门不包含 Lunar-Charged、Lunar-Bloom、Lunar-Crystallize 等 Lunar 反应；不得据此声称“全部元素反应”或完整 gcsim 精度。
- 附近传播不施加 Aura、不递归、不创建或接管副目标感电流、不重置其 cadence，也不为副目标产生 `+6` Wane；副目标既有流继续保持自己的 owner/generation。该分支是默认关闭的 `community-provisional` 项目契约，固定 gcsim 提交的经典实现仍使用单目标命中，因此严禁把它写成 gcsim parity、官服精确传播或正式半径数据。
- 1.33–1.36 的兼容 Golden 身份与 SHA-256 继续作为历史证据保留；`legacy-default-120s-1.36.golden.json` 和 `quicken-bloom-task-order-1.36.golden.json` 均不被改写。1.37 三个冻结 Fixture 及 SHA-256 分别为：`legacy-default-120s-1.37.golden.json` = `168595c9e3df60717fe2b5619278cc227789df7cbf56b9985a78ceb78e10bacc`、`quicken-bloom-task-order-1.37.golden.json` = `d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6`、`target-task-phase-1.37.golden.json` = `5bb1ebe27d7bd5dd613abed4cb1326345925dec00311ee500b24648ffd97c60a`。1.38 三个冻结 Fixture 及 SHA-256 分别为：`legacy-default-120s-1.38.golden.json` = `a3813cda16b831d6606df5976dc90e2d8410c272fadefd25551e29e94ff334ed`、`quicken-bloom-task-order-1.38.golden.json` = `07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc`、`target-reactable-phase-1.38.golden.json` = `f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0`。1.39 四个冻结 Fixture 及 SHA-256 分别为：`legacy-default-120s-1.39.golden.json` = `9765979c127cee707a99db1344a9569d25560d8a2f19ad2577fac2c7c9225151`、`quicken-bloom-task-order-1.39.golden.json` = `a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534`、`shatter-recursive-delivery-1.39.golden.json` = `a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579`、`target-reactable-phase-1.39.golden.json` = `40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8`。1.40 三个冻结 Fixture 及 SHA-256 分别为：`legacy-default-120s-1.40.golden.json` = `843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f`、`quicken-bloom-task-order-1.40.golden.json` = `b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4`、`electro-charged-quicken-cleanup-1.40.golden.json` = `bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0`。1.40 默认 120 秒继续冻结总伤 `41410555.13728799`、DPS `345087.9594773999`、命中 `269`、反应命中 `129`、跳过行动 `3`，角色和技能浮点值也不变。`reaction-matrix-1.35.golden.json` 的 17 个向量继续作为反应矩阵语义 Golden 复用。版本字段、配置哈希和复现键只按各自身份合法更新。
- 1.41 已新增并现场复核两份只读 Fixture：`legacy-default-120s-1.41.golden.json` = `9768d8b0461bd641ed5a4097e1cfe4204e1d6db9e9a6453e75754eb1a90bf9c8`；`electro-charged-propagation-1.41.golden.json` = `b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18`。前者使用 `single-target-v1` 并冻结与 1.40/Vanilla 完全一致的 120 秒总伤、DPS、角色/技能伤害、命中、反应命中和跳过行动；后者只冻结当前 `community-provisional` 的候选/逐目标伤害契约。未实际运行并复核的新版本仍不得预写 SHA 或测试计数。
- 1.42 已新增并现场复核两份只读 Fixture：`legacy-default-120s-1.42.golden.json` = `ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df`；`electro-charged-global-cadence-1.42.golden.json` = `ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611`。前者冻结不变的总伤 `41410555.13728799`、DPS `345087.9594773999`、269 个命中、129 个反应命中、3 个跳过行动、角色/技能伤害和完整逐击摘要，默认配置仍是历史 Aura 模式与 `single-target-v1`；后者冻结 `aura-v9` 的长 Hitlag/cadence、恢复边界、dormant、逐来源 Wane、提前终止和逐击伤害/曲线闭合。后续版本仍不得预写或猜测 SHA。
- 1.44 已新增并现场复核两份只读 Fixture：兼容默认 `legacy-default-120s-1.44.golden.json` = `e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05`，`configHash = fnv1a32:dad42c01`，`reproducibilityKey = gdl-v2-fnv1a32-03487d7e`；Burning 机制 `burning-callback-delivery-1.44.golden.json` = `4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65`，其场景 `configHash = fnv1a32:3aa2ff18`、`reproducibilityKey = gdl-v2-fnv1a32-ee7f1332`。前者冻结 `1.44.0 / 1.44.0-burning-callback-delivery` 身份，但默认预设继续使用 `legacy-event-heap-v1`、历史 Aura 和 `single-target-v1`；总伤、DPS、角色/技能伤害、269 命中、129 反应命中、3 跳过行动及逐击 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f` 与 1.42/Vanilla 一致。后者冻结 v3 的注册顺序 attempts、callback-owned 反链、F15 零延迟交付与 F16 正延迟 Overload 子反应，只标记 `fixed-gcsim-provisional`。1.42 两份 Fixture SHA 现场复核不变，旧 Golden 没有被回写。
- 1.45 已新增并现场复核只读兼容 Fixture：`legacy-default-120s-1.45.golden.json` = `ce59efca02ea2a895195139a3775ec0eeefe6b73414603ee8650e46b2e3c2167`，`configHash = fnv1a32:e53f9200`，`reproducibilityKey = gdl-v2-fnv1a32-b696a75d`。它冻结 V145 身份、Manifest 1.1.0 与上述公式根；总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动、角色/技能浮点汇总和逐击 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f` 与 1.44/1.42/Vanilla 一致。V144 和所有更早 Fixture SHA 保持不变。
- 1.46 新增 `legacy-default-120s-1.46.golden.json` 与 `direct-damage-group-1.46.golden.json` 两个独立向量。默认预设没有为任何示例技能声明未经核验的 `directDamageGroup`，所以 269 个 landed 普通直接伤害段都以 `bypassed` 行记录，120 秒总伤、DPS、角色/技能汇总、命中、反应命中和跳过行动继续与 1.45/Vanilla 数值一致；专用向量单独冻结零槽、同 Tag 切组、tail clamp 与 reset-before-hit。它们不得覆盖 V145/V144/V142 或更早 Fixture；最终 SHA 和测试结果只在现场验收后报告，不在本文件预写。
- 1.47 已新增并现场复核两份只读 Fixture。`legacy-default-120s-1.47.golden.json` = `918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996`，`configHash = fnv1a32:62b82c76`，`reproducibilityKey = gdl-v2-fnv1a32-8823b0d7`；它保持总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动和伤害 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f`。普通直伤日志仍为 269 个 bypass、digest `a9c1df34508e3fcdda365e3b6717460d618b263a2409ad843df2016de0ce0e88`；默认预设未配置 application，所以新日志 0 行、digest `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。冻结 V146 来源 Fixture SHA 保持 `3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465`。
- `elemental-application-icd-1.47.golden.json` = `9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7`；application、DamageEvent、目标时间线 digest 分别为 `66eab58f46d75556a661e51cd0ed16c9cc46d9ff5048365d3bb886b8c9643d62`、`f7a9da88535903ed2a18a966e172e57217007056d3dc861a8b20e18cb54597e1`、`fc0a62bd92559e2356c3e33b4a44a8e50be1db521086ec70070ed3f995caaf99`。它冻结 F0/F1/F2/F148/F149 的 `1/0/0/0/1.5`、同 Tag 切组、tail clamp 与 reset-before-hit，得到总伤 2700、DPS 900、5 段伤害、2 个反应命中、0 个跳过行动。Golden 只证明当前参考路径和兼容迁移。
- 当前现场结果：1.47 应用根/Schema/迁移/结果完整性/两份 Golden 为 8 个文件、336 项测试全部通过；经典基础反应门另为 17 个文件、275 项测试全部通过（13/206 + 4/69）；完整 unit 为 106 个文件、1446 项测试，性能门 3/3，data check、typecheck、build 均通过。Playwright Chromium 为 36/36，独立浏览器检查 HTTP 200、无 console error/错误覆盖层，并确认默认指标、角色/技能构成与伤害曲线渲染。`npm run check` 不包含 E2E，浏览器门仍须单独运行。
- 1.45 冻结阶段曾现场通过 `87` 个测试文件、`1205/1205` 项测试；这只是历史记录，不是 1.46 的最终测试总数，也不代表本轮 build、性能门或 Playwright 已完成。1.46 的最终计数和结果必须以后续现场命令为准，不得预写。
- 1.35 为共享敌人和具名目标增加可选的逐元素基础抗性。`enemy.resistances` 与 `enemy.targets[].resistances` 都必须提供严格、完整且值为有限数的 `pyro / cryo / hydro / electro / anemo / geo / dendro / physical` 八键表。核心按 `目标八项表 > 目标标量 > 共享八项表 > 共享标量` 选择每段实际伤害元素的基础抗性；目标级标量与八项表互斥。旧 `enemy.resistance` 仍是必填兼容回退，迁移不会删除、复制或假装这些输入是正式敌人数据库。
- Zod 已严格覆盖当前 V147 输入与结果；当前 `simulationResultV147Schema` 和 `assertTrustedSimulationResultV147()` 在 V146 全部证明上增加数字应用 root、attempt 日志、状态重放和外键闭合。冻结 `simulationResultV146Schema`、`simulationResultV145Schema`、`simulationResultV144Schema`、`simulationResultV142Schema` 仍保持精确身份并由各自断言接纳。外部或持久化完整结果必须走完整 Zod；trusted assertion 不是外部 wire 验证边界。
- 精确 V145/V146 的所有命中都禁止输入 `ampBase`，增幅底数只能由固定公式 profile 决定；冻结 V144 及更早 wire 继续按各自历史契约接受已经合法的显式 legacy 覆盖。Aura 模式只允许显式 debug 且非 `none` 的 `reactionOverride`。公式层拒绝非正、非有限底数，并对转化/加算公式的非法运行时输入 fail-closed。
- v7 的 Burning refresh 只更新 Fuel、归属或快照状态，不再把 refresh 投影为一次新的 `burning` 反应；真正启动 Burning 时才增加反应列表/反应命中。refresh 的状态审计仍完整保留在 `burningReaction` 与 `burningStateLog`。
- 性能门保留 3 项 120 秒回归：默认兼容预设、带能量前缀探测的合法时间线、持续 Burning 刷新流；每项预热后计时 21 次，要求中位数 `<100ms` 且最大离群值 `<250ms`。阈值是当前桌面回归门，不是跨设备 SLA。
- 当前基础反应正确性优先于展示扩张。UI 继续只消费核心的敌方逐击、构成、时间线和曲线结构；本轮没有新增 UI 面板。v3 产生的每条伤害依然通过结构化 `DamageEvent` 自然进入现有全队、个人、技能、时间轴、逐段伤害、伤害构成和曲线；展示扩展延后，UI 不能自行补算候选、伤害、Aura 或事件顺序。
- 明确未完成：24 标签/16 类经典反应门之外的 Lunar/月反应；完整特殊/多 Aura 可达空间；官服核验的感电传播；Burning 之外的通用 callback/目标任务所有权与全目标 barrier；固定参考的 `DoNotLog` “Freeze Broken”；反应拥有/派生应用进入统一 1.47 日志；把 55 个公共 application group 与普通直伤组逐技能绑定到全角色；真实粒子/掉球/飞行、完整动作帧/Hitlag、玩家 Aura/敌袭/治疗/死亡/复活、三维命中，以及全角色/武器/圣遗物/敌人的可执行机制数据库。两份 58 组来源表都不等于全角色覆盖。UID 展示柜仍不能可靠编译任意账号为 `SimConfig`，“毕业站位”仍是不可模拟占位。草原核 `300f`、附近传播、固定参考数据和默认杜林示例魔法数均为 provisional。本项目仍未达到 gcsim 精度。
- 感电完整性的当前共享证明已经闭合本轮约定范围：每目标 `start` generation 从 1 连续递增，start/refresh audit 与 lifecycle row 双向唯一；命中移除 ordinary stop 与唯一 `COEXISTING_AURA_REMOVED_BY_HIT` 行精确反链，legacy `COEXISTING_AURA_MISSING` 也必须继承前一排程的 frame/source/trigger，机制截断不允许生成伪 hit-stop；Wane 必须反链 owning Tick 的 `waneFrame/tickIndex`，并由回调前水雷共存与来源目标实际子伤害推导 `stop / wane-skipped / wane`。实际 Wane 按 Hydro→Electro 对每个来源槽分别消费至多 `0.4U`，核对 reason、下一 Tick、共存截止、上一目标时间线 deadline、时间线 reciprocal point 和 `aura-v9` cadence/listener。精确 1.44 wire 会省略清理后消费量 `<=1e-10U` 的元素；共享证明只在该元素确实耗尽的序列化 epsilon 边界接受这一冻结例外，物质消费不得漏项。期限证明使用舍入 Gauge 与 `ceil(gauge / decay - 1e-9)` 的可行衰减率交集和 target-clock 重放，不等于从配置根唯一恢复 `decayPerFrame`。pre-v8 跨 generation Wane 仍是冻结兼容例外；尚未从 Ability/ICD/完整 Aura 历史重放全部中间决策，现有门和 1.42 Golden 不能解读为完整 EC 生命周期、官服真值或 gcsim parity。
- 超激化/蔓激化的 additive audit 现在在 public Zod 与 trusted assertion 两侧都强制 `consumedQuickenGaugeUnits = 0` 且 `quickenGaugeUnitsAfter` 与 `quickenGaugeUnitsBefore` 精确相等；1.45 又把等级基准表与 `1.15/1.25` 倍率绑定到不可变公式根。该证明仍不等于从完整 Aura/ICD/动作快照与角色 Ability 数据库重放反应成立条件和全部输入来源。
- `target-phase-v2` 结果出现感电自然到期或 cleanup transition 时，trusted assertion 会按需复用 public 边界的同一专用反链 Schema；孤立 transition、缺失周期行/任务/时间线引用及不闭合 Aura 链不能再借 EC 快速路径绕过。无该 transition 的结果不承担这次专用 Zod 投影成本。
- 文中“零拷贝 trusted assertion”仅指通常路径；上述含 v2 感电 transition 的条件分支会解析并克隆该专用 facet，但仍不会运行或克隆完整 `SimulationResult` Zod。
- 玩家八项抗性是用户显式输入和本项目的公式约定；固定 gcsim 提交用于列明路径的交叉参考，但没有提供可直接当作官服正式角色抗性数据库的真值。测试向量、草原核寿命和杜林示例数值都不得包装为正式官服数据或完整 gcsim 精度。
- Burning 的 `legacy-event-heap-v1` 有意保留 1.30 兼容相位；1.37 v1 与 1.38 v2 也继续冻结。精确 1.44–1.47 的显式 v3 可在 owner callback 内交付列明的零延迟跨目标伤害/Aura；启用目标时钟时陈旧唤醒会先重投影。Burning 自有的 target-global legacy 应用状态尚未纳入普通直接命中的 1.47 统一日志。所有这些顺序仅为 `fixed-gcsim-provisional`，不是官服真值、完整 target phase 或完整 gcsim 精度。
- v2 可把列明的普通 Aura、Frozen、Quicken、Burning Fuel 和感电共存自然到期纳入该目标 `Reactable.Tick` 日志；精确 1.40 v8 还会在普通推进之后决议 Quicken→Bloom depletion cleanup，但仍没有建立全目标 barrier。感电 Tick/Wane、Quicken→Bloom follow-up 本身、ICD、ReactionA/B、草原核/结晶实体和其他 core work 继续按全局队列运行，通用 target-owned task 仍未实现。

### 历史实施里程碑（按时间保留）

下面条目记录各版本如何到达当前状态；涉及“当前”“未实现”或旧版本号时，以以上权威 Current State 为准。

- Milestone 0 已完成：Vanilla 版本已冻结到 `legacy/v0.1-vanilla/`，默认 120 秒 Golden Fixture 和基线报告已提交。
- Milestone 1 已完成：纯 TypeScript 核心、严格 Zod Schema、版本迁移、逐击审计、Vitest 和 Web UI 已提交。
- Milestone 2 已完成最小闭环：60 FPS 整数帧、切人、行动占用、冷却/充能次数、strict/wait 合法性和命中追踪已提交。
- Milestone 3 已完成第一批最小闭环：火/冰/水普通 Aura、可扩展元素量、衰减、默认 ICD、No ICD、自动融化/蒸发、逐击 Aura 审计和敌方 Aura 曲线已经实现并有测试。
- Milestone 3 的第二批第一条转化反应切片已完成：Schema/引擎升级到 `1.22.0` / `1.22.0-overload-reaction`，`aura-v2` 加入雷普通 Aura 与双向超载。超载独立伤害按等级基准、精通、反应增伤与火抗计算，延迟 1 帧，使用同一触发目标 6 帧伤害 GCD，并以触发目标位置为圆心、半径 3 对注册目标逐一求交；排队、GCD、未解析坐标、逐目标伤害及触发反链均进入结构化结果和网页。击退/韧性、三维范围以及其余反应仍未实现。
- Milestone 3 第二批的超导切片已完成：Schema/引擎升级到 `1.23.0` / `1.23.0-superconduct-reaction`，同一通用转化反应调度/范围管线支持冰雷双向超导。独立冰伤使用 `1.5` 倍等级/精通公式；每个被反应伤害命中的目标获得 720 帧 `-40%` 物抗。目标级状态按半开区间作用于后续物理逐击，独立反应伤害之后才施加，同帧更早的普通命中不提前获益；刷新、截断、精确到期和来源伤害 ID 均进入 `reactionStatusLog`。Hitlag 延长仍未实现；冻结底超导已在后续 `1.25.0` 冻结切片补齐。
- Milestone 3 第二批的感电切片已完成：Schema/引擎升级到 `1.24.0` / `1.24.0-electro-charged-reaction`。`aura-v2` 可在每个目标上保留水雷共存；新流 10 帧后首次单目标雷伤、之后每 60 帧 Tick，非零实际伤害后 6 帧各削减水/雷 `0.4U`。刷新不重置节奏，但未来 Tick 的归属和面板快照切到最近触发者；首次已排队 Tick 保留原触发者。启动、刷新、Tick、Aura 削减、零伤害跳过、衰减到期和停止均进入 `periodicReactionLog`；后续命中用其他反应移除水或雷 Aura 时，周期流会在同一命中帧停止，削减/停止节点也进入网页 Aura 曲线。实现固定交叉核对 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的单目标 Tick 路径，因此未虚构附近潮湿目标自动连锁；这里没有声称该提交仍是上游 HEAD，更不把它当作官服真值。
- Milestone 3 第二批的冻结切片已完成：Schema/引擎升级到 `1.25.0` / `1.25.0-freeze-state`。`aura-v2` 可由水/冰双向生成独立冻元素耐久，并按固定 gcsim 的逐帧加速速率与目标 `freezeResistance` 精确衰减；冻结抗性为 1 时保留反应/元素消耗审计但不生成耐久。冻元素会阻止火打水反向蒸发、冰打雷普通超导和新感电等错误分支，可被火正向融化或雷冻结底超导消耗。生成、刷新、免疫、消耗和自然到期进入 `frozenStateLog`、逐击详情、冻结状态表与敌方 Aura 曲线。敌人定身、冻结气泡破裂、Hitlag 和冻结抗性数据库仍未实现。
- Milestone 3 第二批的碎冰切片已完成：Schema/引擎升级到 `1.26.0` / `1.26.0-shatter-reaction`。命中可严格声明 `strikeType: "blunt"` 与非负 `poiseDamage`；钝击先按固定 gcsim 的 `0.15 × PoiseDMG` 内部槽规则削冻，剩余冻结才由钝击或岩元素命中碎冰。碎冰最多消耗 `8U`，同帧排入单目标物理、`3.0` 倍等级/精通、无暴击、无视防御伤害，并按目标维护 12 帧伤害 GCD；GCD 不阻止冻结消耗。超载范围伤害也按 `StrikeTypeBlunt + PoiseDMG 90` 检查邻近冻结目标，可形成普通命中→超载→碎冰父链。触发、失败原因、两阶段消耗、GCD、逐击伤害、表格和曲线均可审计。1.26–1.38 的兼容事件堆让同帧碎冰子段排在触发父段之后；1.39 才以独立显式模式加入子段先交付的同步递归路径。当前韧性字段只服务削冻，不是通用敌人韧性/击退/硬直系统；“Freeze Broken” 合成攻击仍未实现。
- Milestone 3 第二批的扩散切片已完成：Schema/引擎升级到 `1.27.0` / `1.27.0-swirl-propagation`。`aura-v2` 按固定 gcsim 的雷→递归水→火→水→冰→冻元素顺序消耗目标 Aura 和风预算；典型 `1U 风 + 0.8U Aura` 传播 `2.2U`。每条元素/目标本地 6 帧队列 GCD 通过后，核心排入 1f 源目标伤害与 5f 半径 5、排除源目标的传播攻击；水扩散传播段保留 0 伤害事件但仍附着。每个目标/角色/扩散元素的 ReactionA 在 30 帧只让前两段产生伤害，后续仍处理 Aura。传播附着可放大融化/蒸发，也可继续排入超载/超导、启动感电或生成冻结，并保留普通命中→扩散传播→二次反应的父链。消耗换算、队列、传播量、排除目标、ReactionA、二次 Aura、零伤害事件、表格、Aura 曲线和累计伤害曲线均有 Vitest/Playwright。三维高度、吸附聚怪、物件/召唤物/玩家目标、按来源 Aura overlap 和角色特有扩散修正仍未实现。
- Milestone 3 第二批的结晶切片已完成：Schema/引擎升级到 `1.28.0` / `1.28.0-crystallize-shards`。岩附着按固定 gcsim 的雷→水→冰→火→冻元素顺序选择第一条 Aura，所有元素共享目标本地 60 帧 GCD；成功后 23 帧生成碎片，触发后 54 帧起可由合法时间线的显式 `pickUpCrystallize` 命令拾取。碎片存活 900 帧、全场最多 3 个；生成位置在目标生成帧圆形碰撞体外 0.5m 使用独立固定种子角度。护盾在碎片生成帧快照来源等级/精通，使用固定等级表与精通公式，拾取时覆盖旧结晶盾并持续 906 帧。Aura/GCD、碎片生成/淘汰/过早拾取/拾取/到期、护盾增加/覆盖/到期、三类吸收量、网页表格和阶梯曲线均有 Vitest/Playwright。1.28 当时还没有玩家受击和盾破裂；1.32 只为列明的四类反应自伤补入吸收/破裂，角色移动距离拾取、自动吸附、一般敌袭、非结晶盾、护盾强效、装备/被动回调、月结晶和 gcsim 全局 RNG 序列等价仍未实现。
- Milestone 3 第二批的草雷激化切片已完成：Schema/引擎升级到 `1.29.0` / `1.29.0-catalyze-reaction`，新增 opt-in `aura-v3`，不改写 v1/v2 Golden。普通火/冰/水/雷/草 `1U` 按固定 gcsim 提交的 `25 durability = 1U` 语义得到 `0.8U / 570f`，并以来源槽保存、共享衰减和逐槽消耗。草雷双向生成/刷新激元素；超激化/蔓激化在命中帧读取来源角色等级、实时精通和反应增伤，不消耗激元素，把加算基础值放入普通增伤/防御/抗性/暴击链。当前切片的反应顺序、来源槽变更、激元素代次/到期、扩散传播触发激化、插件 flat 分量契约和最终构成均有结构化审计及 Vitest；网页增加逐击三类伤害构成、构成累计曲线、草/激元素曲线和状态表。`aura-v3` 继续把燃烧、绽放、草原核、超绽放和烈绽放当作未支持边界；燃烧只在下述 opt-in `aura-v4` 执行。固定参考提交自身仍含草原核持续时间注释和燃烧测试 TODO，因此这里不是官服验证或完整 gcsim 精度声明。
- Milestone 3 第二批的燃烧切片已完成到 Schema/核心/UI 集成：Schema/引擎升级到 `1.30.0` / `1.30.0-burning-reaction`，新增 opt-in `aura-v4`，不改写 v1–v3 或 `legacy-v0.1` Golden。固定 gcsim 提交语义下，燃烧建立 `2U` Marker 与独立 Fuel，Fuel 至少以 `0.4/60 U/f` 衰减；启动后第 15 帧首次 Tick、之后每 15 帧一次并固定跳过索引 9。伤害为火元素、半径 1、等级基准倍率 `0.25`、无视防御且不普通暴击；每 Tick 携带 `1U` 火附着和目标局部/队伍全局的 120 帧 `[允许, 阻止 × 7]` 内置 ICD，序列耗尽后保持最后的阻止值直至重置。草命中先扣除 Quicken 消耗，只用剩余草量覆盖 Fuel 并刷新后续伤害归属/实时面板；火命中只刷新后续归属/快照，二者都不重置节奏。Marker 被蒸发、融化、超载、火扩散或火结晶消耗时停止；Fuel 自然耗尽会移除 Marker、普通草 Aura 与激元素。历史实现按目标注册顺序处理 Tick callback，但范围伤害/Aura 后果仍在后续全局 core 管线中结算；这不等于 callback 内同步跨目标命中。启动、刷新、Tick、固定跳过、附着 ICD、停止/到期、伤害父链和归属进入 `burningStateLog`、逐击详情、Aura/Fuel 曲线与燃烧累计伤害曲线；核心首尾 Aura 快照还保证零命中场景的初始敌方附着不会被网页漏画。
- 1.30 Burning 是有意收窄的历史纵向切片：敌人 Hitlag 对目标局部时钟/Fuel/Tick 的暂停未实现，日志固定标记 `target-local-no-hitlag` / `unsupported-enemy-hitlag`；该版本当时没有玩家 HP/受击模型，只标记 `unsupported-player-damage-model`。1.32 的 opt-in 玩家自伤没有反向改变这份 1.30 Golden 或默认兼容模式。角色专属 `OnBurning` hook-before-snapshot 与纳西妲 C2 转化反应特殊暴击仍未实现；固定 gcsim 源码自身也有 Burning 测试 TODO，因此只能称固定代码路径兼容语义。
- 核心目标状态时间线基础已完成：`SimulationResult.targetStateTimeline` 使用独立输出版本 `1.0.0`，在实际 AuraEngine 调用点记录边界、普通 Aura 自然到期、直接/独立反应伤害子阶段及 Frozen、Quicken、Electro-Charged、Burning 的状态变化。事件点携带真实队列优先级、序号和同事件子序；自然到期派生点不伪造事件。网页 Aura/Fuel 曲线只按核心点数组原序消费并用 `primaryDamageEventId` 回链，旧 `auraTimeline` 和各状态表仍兼容保留。这个历史切片本身没有升级输入 Schema/引擎；1.31 另以 `dendroCoreTimeline` 和严格交叉引用补入草原核状态。
- 反应核心优先阶段已推进到 1.44：1.40–1.42 依次冻结 EC next-target-Tick cleanup、默认关闭的附近湿目标传播和 `aura-v9` 全局 cadence/Hitlag/Wane 所有权；1.44 又以显式 `target-phase-v3` 完成已建模 Burning Tick 的 callback-owned 零延迟跨目标交付、F-1/当前 Aura 边界和按注册顺序的 attempt audit。当前顺序是继续补其他来袭元素、多 Aura 排列与通用目标任务所有权；随后才考虑 Lunar、玩家 Aura、敌袭、治疗/死亡等生存机制和新增展示。
- Milestone 4 已完成核心第一批最小闭环：版本化粒子/晶球 Schema、固定种子离散产球、生成/到达帧、接收时前后台、同/异/无色、元素充能效率、固定/粒子回能拆分、溢出、逐次日志和能量曲线已实现并有测试。120 秒来源核验预设、敌人掉球和真实技能产球数据库仍未完成。
- 1.44 继续沿用并加固冻结的 1.42 能量回放：配置行动、命中确认、粒子生成、逐角色结算、能量汇总和曲线必须形成完整且唯一的投影，公共 Zod 边界与 trusted 边界都要拒绝协同删改。冻结的 V142 输入 Schema 仍允许历史负数回能声明，但新执行会在运行入口 fail-closed。1.43 只保留给尚未发布的 energy wire；计划中的输入收窄、`particleEventId`、行动/曲线反链和显式同帧序号并未随 1.44 发布。
- 固定 gcsim 提交 `ef41805d855a60b9e1035293584b85c085dc69e7` 的 3/2/1 粒子倍率、晶球三倍、后台倍率、接收时充能和上限处理可作对照；其同帧任务先后与角色专属延迟扣能不同于当前冻结的 1.42 模型。不得改写既有 Golden 冒充对齐；后续必须以版本化 `energyTaskModel` 和新 Golden 实现。
- Milestone 5 已完成数据层基础：固定 `genshin-db@5.2.12` / 游戏 6.7 输入生成 120 个角色、125 套天赋、762 个技能/被动和 237 把武器的完整目录；另有约 130 kB 浏览器索引和 148 组 Enka ID 映射。每条记录均有来源、补丁、状态和未映射机制；全部保持 `provisional + metadata-only`，未冒充正式可执行角色。
- “完整目录”不等于“完整可执行数据库”：全角色/武器逐技能倍率、命中拆段、特有 ICD、动作帧、快照、粒子和专属机制尚未完成；UID 展示柜只能映射公开身份/面板/装备，尚不能把任意 UID 与圣遗物效果可靠编译为 `SimConfig`。不得把测试 UID 一次成功映射写成全 UID 数据支持。
- 当前 Schema/引擎为 `1.47.0` / `1.47.0-elemental-application-icd-root`，Manifest 为 1.3.0。既有具名目标、Aura/反应、几何、时钟、EC cleanup/传播与普通直伤组边界保持不变；数字元素施加以第三份独立 root 和状态机追加。默认预设和迁移继续保留既有 Aura/目标任务/反应交付模式；精确 1.44–1.47 输入均可在版本门下 opt-in `target-phase-v3`。`AbilityBlueprint` 当前为 1.9，1.0–1.8 可迁移；编译器可显式传递两类 descriptor/application selector，但不会自动猜测 fixed group。
- 杜林黑/白 E 已形成独立的 `provisional + partial` 审计向量：精质转变 6 秒窗口会被核心强制并由对应分支消耗，黑/白状态互斥；黑 E 三段与白 E 单段倍率、命中帧、黑 E 附着 ICD、锁定 gcsim 的白 E 无附着口径、带 6 秒共享冷却的 33 固定回能，以及命中触发并受 18 帧共享粒子 ICD 约束的 4 火粒子均有 Vitest，并在网页逐段伤害、状态表、累计伤害曲线、Aura 曲线和能量曲线展示。白 E 的 `Durability=0` 行为仍需官方或官服实测交叉验证；两项向量都不是杜林整角或 120 秒正式队伍预设。
- UID `283733593` 已在 2026-07-26 做真实只读浏览器联调：返回 12 名公开角色，角色、武器和技能达到 0 项未匹配；旅行者元素变体由技能 ID 集合选择。Playwright 仍使用固定响应，避免网络波动进入 CI。
- 冻结的杜林预设仍为 `legacy-v0.1` Golden 兼容配置，手工反应和示例魔法数没有被包装为正式数据。多目标 AoE 已有显式扇出、二维圆形/旋转矩形/胶囊/填充扇形自动求交、静态施放者局部坐标变换、声明式线性目标移动与一次产球语义；但具体技能范围和实战移动轨迹仍需来源核验，且尚无高度、角色移动/自动转向/索敌、真实 Boss AI、黑/白爆发、状态驱动的被动、命座和装备。

---

## 1. 当前项目

项目名称：**提瓦特伤害实验室**

当前主工作区：

```text
README.md
TECHNICAL_DESIGN.md
HANDOFF_FOR_CODEX.md
apps/web/
packages/sim-core/
packages/schemas/
packages/game-data/
packages/mechanics/
packages/test-vectors/
legacy/v0.1-vanilla/
```

启动方式：

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

主版本是 npm workspace + Vite/TypeScript；无构建步骤的 Vanilla 版本只在 `legacy/v0.1-vanilla/` 作为只读回归基线保存。

---

## 2. 当前已经实现的能力

### 2.1 确定性事件模拟

- 使用最小堆维护按时间排序的事件。
- 当前事件优先级：
  1. `action`
  2. `buff/debuff`
  3. `energy`
  4. `hit`
  5. `reactionDamage`
- 冻结的 1.37 `target-phase-v1` 和 1.38 `target-phase-v2` 仍保持原顺序及日志语义。1.44 `target-phase-v3` 保留 v2 的每目标 callback→同目标 `Reactable.Tick`，另在实际 Burning callback 与 owner Tick 之间安排 callback-owned delivery 微事件：按敌人注册顺序，尚未执行当帧 Tick 的目标先用 F-1/当前 Aura 结算，已执行的目标在 Tick 后应用。`legacy-event-heap-v1` 保持既有优先级和 Golden；`quickenBloomFollowup`、感电 F+10/F+70 callback/Wane、正延迟子反应和其他 core work 仍在全局队列。继续扩展通用目标任务阶段时仍须另升引擎版本，不能静默重排历史 Aura 或目标任务模式。
- 按 `cycleLength` 重复 `rotation`，直至达到 `duration`。
- 支持 `once`、`cycles`、`everyNCycles` 和 `cycleRemainder`。
- 行动能量不足时，整个行动及其后续命中、Buff和回能事件均跳过，并记录原因。

### 2.2 当前伤害模型

当前普通倍率伤害：

```text
基础伤害 = 倍率 × 对应缩放属性 + 附加基础伤害
最终伤害 = 基础伤害
         × (1 + 增伤)
         × 防御区
         × 抗性区
         × 暴击区
         × 增幅反应区
         × 伤害组修正
```

已支持：

- ATK / HP / DEF / EM 缩放。
- 固定附加基础伤害和跨角色附加基础伤害。
- 平均暴击、全暴击、无暴击。
- 融化、反向融化、蒸发、反向蒸发。
- 负抗、0–75%抗性和高于75%抗性的分段函数。
- 防御降低与防御无视。
- `snapshot: "action"` 和 `snapshot: "hit"`。
- `scalingOwnerId`：使用谁的面板。
- `creditId`：伤害归属给谁。

### 2.3 当前输出和UI

- 全队总伤和平均 DPS。
- 角色总伤、DPS和占比。
- 技能总伤、命中次数和占比。
- 每秒、每角色的堆叠伤害时间轴。
- 逐段伤害日志、筛选、分页。
- 点击一段伤害查看完整公式因子。
- 每名角色的能量获得、消耗、最终能量和断轴次数。
- JSON 导入、导出、直接编辑。
- 内置 `C6R5 杜林 + C6R1 尼可 + 洛恩 + 茜特菈莉` 的结构示例预设。

---

## 3. 原 Vanilla 实现中必须承认的问题

不要把当前预设数值当作正式游戏数据库。它只是机制和UI校准样例。

以下是冻结基线的问题清单；已完成项的当前状态以上述实施进度、`README.md` 和 `TECHNICAL_DESIGN.md` 为准。

### 3.1 模拟引擎问题

1. **反应由每个 hit 手工指定**，没有 Aura、元素附着量、元素消耗和自动反应判断。
2. **没有独立 ICD 组**，也没有默认 3-hit / 2.5-second 规则。
3. **没有动作占用时间**。当前只按绝对时间启动行动，允许两个角色在逻辑上同时行动。
4. **没有冷却、充能次数、切人和取消帧合法性检查**。
5. **没有粒子对象和飞行时间**，只有直接写入角色的确定性回能数值。
6. **没有前台/后台、同色/异色、元素充能效率的粒子分配规则**。
7. `activeId` 只是最近启动行动的角色，不能可靠代表命中发生时的前台角色。
8. 快照是“整张面板”快照；真实机制经常只快照部分属性或部分乘区。
9. 状态在 `end <= eventTime` 时先清除；需要用测试明确“边界帧命中是否吃到Buff”的规则。
10. 相同时间事件的优先级仍然过粗，需要定义到帧和子阶段。
11. 只有一个全元素基础抗性字段，没有分元素敌人抗性。
12. `dmgBonus` 只有通用增伤，没有元素增伤、普攻/战技/爆发等攻击标签增伤。
13. 没有概率效果、随机粒子、暴击采样或 Monte Carlo。
14. 已支持具名多目标、逐目标 Aura/ICD、显式 fanout、二维圆形/旋转矩形/胶囊/填充扇形 AoE 自动扇出、静态角色位置/朝向和声明式目标线性移动；尚无高度、角色移动/转向、AI/命令驱动敌人移动、自动索敌、护盾和特殊易伤窗口。

### 3.2 当前代码问题

1. 引擎、预设数据、UI渲染全部集中在一个约645行的 `app.js` 中。
2. 没有 TypeScript 类型、Schema校验、单元测试和E2E测试。
3. JSON错误只在应用配置时暴露，没有字段级提示。
4. `getDebuffState()` 会把与当前元素无关的 Debuff 标签也写进详情，应修正。
5. 逐击表主要显示 `creditId` 对应角色，实际施放者、缩放面板所有者和伤害归属没有同时清晰展示。
6. 当前预设包含大量魔法数值，缺乏来源、版本和验证状态。
7. 当前时间轴按整秒聚合，只适合概览，不适合观察单轴Buff窗口和ICD。

---

## 4. 当前技术架构

项目已采用 npm workspaces + Vite/TypeScript；不要为了追逐框架而改写已验证边界，更不要把模拟核心写回页面组件。

```text
apps/
  web/                    # Vite + TypeScript，只负责输入和渲染
packages/
  sim-core/               # 纯TypeScript、无DOM依赖的确定性模拟核心
  schemas/                # Zod Schema、版本迁移和JSON类型
  reaction-formulas/      # 固定经典反应公式数据叶与信任根
  icd-profiles/           # 固定普通直伤 Damage Group 数据叶与信任根
  game-data/              # 角色/武器/圣遗物/敌人版本化数据
  mechanics/              # 特殊角色和机制插件
  test-vectors/           # 裸伤、状态边界、能量、反应等基准向量
legacy/
  v0.1-vanilla/           # 当前可运行版本，只读保存作为基线
```

### 必须遵守的边界

- `sim-core` 不得依赖 React、Next.js、Canvas、DOM 或浏览器全局对象。
- `game-data` 不得直接执行模拟逻辑。
- UI不得自行重算伤害；只能消费 `sim-core` 的结构化结果。
- 特殊角色机制通过插件、回调或声明式效果表达，避免在核心循环里堆角色名称判断。
- 所有JSON配置必须含 `schemaVersion`、`engineVersion` 和 `dataVersion`。

---

## 5. 执行顺序

## Milestone 0：冻结基线，禁止盲目重写

先完成以下事项：

1. 将当前版本复制到 `legacy/v0.1-vanilla/`。
2. 在浏览器中运行默认120秒预设，记录：
   - 总伤害。
   - 平均DPS。
   - 每角色伤害。
   - 每技能伤害。
   - 命中数量。
   - 跳过行动数量。
3. 把当前 `simulate()` 抽成可在 Node 环境调用的模块，或写一个临时Node兼容包装器。
4. 为当前结果建立 golden fixture，作为迁移前后回归基线。
5. 后续每次重构必须证明：在仍使用旧的手工反应和确定性回能模式时，结果与基线一致，误差不超过 `1e-8` 相对误差。

### Milestone 0 验收

- `npm test` 或 `pnpm test` 能运行。
- 至少有公式、事件排序、状态边界、能量不足和默认预设五类测试。
- 当前网站功能不丢失。

### 已冻结的默认 120 秒 Golden

迁移前 Vanilla 与当前 `legacy-v0.1` 兼容模式必须保持以下原始浮点结果（显示层可四舍五入，但断言不得改成只比整数）：

```text
总伤害       41410555.13728799
DPS          345087.9594773999
命中数       269
反应命中数   129
跳过行动数   3

Nicole       740338.5919263127
Citlali      77244.84267655843
Durin        38779268.124040276
Lohen        1813703.5786448019
```

技能基线保存在 `packages/test-vectors/fixtures/legacy-default-120s.golden.json`。1.30–1.45 的历史升级继续按原契约保留，任何后续工作都不得覆盖其 Fixture。1.44→1.45 只更新身份、Manifest 与固定公式选择；1.45→1.46 再只更新身份、Manifest 并注入固定 `directDamageGroupModel`，同时不给旧命中自动分配 Tag/Group。两次迁移都保留历史 Aura、`legacy-event-heap-v1`、`single-target-v1`、目标时钟与反应交付选择。1.46 默认数值继续与 Vanilla/1.42/1.44/1.45 浮点基线一致，269 个普通直接伤害段以 bypass 日志证明未启用未经核验的技能映射；V145 兼容 Fixture 的 SHA-256 仍为 `ce59efca02ea2a895195139a3775ec0eeefe6b73414603ee8650e46b2e3c2167`，`configHash = fnv1a32:e53f9200`，`reproducibilityKey = gdl-v2-fnv1a32-b696a75d`。1.44 默认/Burning Fixture SHA 仍为 `e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05` 与 `4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65`；1.42 默认/cadence Fixture SHA 仍为 `ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df` 与 `ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611`，均不得回写。Golden 相等只证明迁移兼容和对应结构化结果没有漂移，不证明测试抗性、传播半径、杜林预设中的手工反应、装备系数或固定 gcsim 数据是官方真值。

1.46→1.47 只更新身份、Manifest、显式 application selector 与 `elementalApplicationIcdModel`，不自动启用 fixed group。`legacy-default-120s-1.47.golden.json` 的 SHA-256 为 `918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996`，`configHash = fnv1a32:62b82c76`、`reproducibilityKey = gdl-v2-fnv1a32-8823b0d7`；默认总伤、DPS、角色/技能、269 命中、129 反应命中、3 跳过行动和逐击伤害保持不变。`elemental-application-icd-1.47.golden.json` 的 SHA-256 为 `9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7`，专门冻结数字序列和 application 日志。V146 来源 Fixture SHA `3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465` 保持只读。

1.36–1.42 的历史门继续按各自固定版本常量运行。1.41 传播门、1.42 cadence Golden 和 24 标签/16 类经典反应门保持原契约。1.44 新增 `aura-current-state-hit.test.ts`、`target-phase-v3-burning-delivery.test.ts` 和 `target-phase-v3-result-integrity.test.ts`，分别锁定 F-1/当前 Aura API、Frozen 精确到期前后的注册顺序、Hitlag 重投影、正延迟 Overload 子反应继续入 heap、`landed / miss / unresolved` attempt 覆盖、确定性与公共/trusted Schema mutation 拒绝。所有这些门仍只验证 `fixed-gcsim-provisional` 或列明的 `community-provisional`，不证明官服完整语义或 gcsim parity。未实际执行对应命令前不得写入通过结论或测试计数。

当前验证命令：

```bash
npm run typecheck
npx vitest run packages/icd-profiles/src/application-profile.test.ts packages/schemas/src/elemental-application-icd-result-schema.test.ts packages/schemas/src/reproducibility.test.ts packages/schemas/src/schema.test.ts packages/sim-core/src/elemental-application-icd.test.ts packages/sim-core/src/__tests__/elemental-application-icd-result-integrity.test.ts packages/sim-core/src/__tests__/elemental-application-icd-golden.test.ts packages/sim-core/src/__tests__/legacy-default-v147-golden.test.ts
npx vitest run packages/sim-core/src/__tests__/amplifying.test.ts packages/sim-core/src/__tests__/overload.test.ts packages/sim-core/src/__tests__/superconduct.test.ts packages/sim-core/src/__tests__/electro-charged.test.ts packages/sim-core/src/__tests__/swirl.test.ts packages/sim-core/src/__tests__/crystallize.test.ts packages/sim-core/src/__tests__/freeze.test.ts packages/sim-core/src/__tests__/shatter.test.ts packages/sim-core/src/__tests__/burning.test.ts packages/sim-core/src/__tests__/bloom-aura.test.ts packages/sim-core/src/__tests__/bloom-integration.test.ts packages/sim-core/src/__tests__/dendro-core.test.ts packages/sim-core/src/__tests__/catalyze.test.ts
npx vitest run packages/sim-core/src/__tests__/reaction-matrix-golden.test.ts packages/sim-core/src/__tests__/reaction-formula-profile.test.ts packages/reaction-formulas/src/profile.test.ts packages/sim-core/src/__tests__/formulas.test.ts
node packages/test-vectors/scripts/generate-elemental-application-icd-v147.mjs --preview
node packages/test-vectors/scripts/generate-legacy-default-v147.mjs --preview
npx vitest run packages/icd-profiles/src/profile.test.ts packages/schemas/src/direct-damage-group-schema.test.ts packages/schemas/src/mechanics.test.ts packages/schemas/src/target-phase-v3-integrity.test.ts packages/sim-core/src/__tests__/direct-damage-group.test.ts packages/sim-core/src/__tests__/direct-damage-group-simulator.test.ts packages/sim-core/src/__tests__/direct-damage-group-result-integrity.test.ts packages/sim-core/src/__tests__/direct-damage-group-golden.test.ts packages/sim-core/src/__tests__/legacy-default-v146-golden.test.ts packages/mechanics/src/compiler.test.ts
npx vitest run packages/schemas/src/schema.test.ts packages/sim-core/src/__tests__/simulation-result-schema.test.ts packages/sim-core/src/__tests__/simulation-result-runtime-boundary.test.ts packages/sim-core/src/__tests__/formulas.test.ts packages/sim-core/src/__tests__/amplifying.test.ts packages/sim-core/src/__tests__/catalyze.test.ts packages/sim-core/src/__tests__/superconduct.test.ts packages/sim-core/src/__tests__/reaction-a.test.ts packages/sim-core/src/__tests__/reaction-b.test.ts packages/sim-core/src/__tests__/bloom-gauge.test.ts packages/sim-core/src/__tests__/bloom-aura.test.ts packages/sim-core/src/__tests__/bloom-integration.test.ts packages/sim-core/src/__tests__/dendro-core.test.ts packages/sim-core/src/__tests__/aura-v6-electro.test.ts packages/sim-core/src/__tests__/aura-v6-simulator.test.ts packages/sim-core/src/__tests__/hydro-order.test.ts packages/sim-core/src/__tests__/quicken-bloom-task-order.test.ts packages/sim-core/src/__tests__/aura-v8-ec-cleanup.test.ts packages/sim-core/src/__tests__/aura-v9-ec-global-cadence.test.ts packages/sim-core/src/__tests__/electro-charged-global-cadence-golden.test.ts packages/sim-core/src/__tests__/electro-charged-quicken-cleanup.test.ts packages/sim-core/src/__tests__/electro-charged-cleanup-golden.test.ts packages/sim-core/src/__tests__/electro-charged-propagation.test.ts packages/sim-core/src/__tests__/burning.test.ts packages/sim-core/src/__tests__/burning-v7-refresh.test.ts packages/sim-core/src/__tests__/target-task-phase.test.ts packages/sim-core/src/__tests__/target-task-phase-log.test.ts packages/sim-core/src/__tests__/aura-reactable-boundary.test.ts packages/sim-core/src/__tests__/aura-current-state-hit.test.ts packages/sim-core/src/__tests__/target-phase-v2-reaction-gate.test.ts packages/sim-core/src/__tests__/target-reactable-phase-v2.test.ts packages/sim-core/src/__tests__/target-phase-v3-burning-delivery.test.ts packages/sim-core/src/__tests__/target-phase-v3-result-integrity.test.ts packages/sim-core/src/__tests__/shatter-recursive-delivery.test.ts packages/sim-core/src/__tests__/enemy-elemental-resistance.test.ts packages/sim-core/src/__tests__/crystallize.test.ts packages/sim-core/src/__tests__/player-damage.test.ts packages/sim-core/src/__tests__/player-reaction-damage.test.ts packages/sim-core/src/__tests__/target-clock.test.ts packages/sim-core/src/__tests__/aura-target-clock.test.ts packages/sim-core/src/__tests__/target-clock-integration.test.ts packages/sim-core/src/__tests__/target-hitlag-status.test.ts packages/sim-core/src/__tests__/reaction-matrix-golden.test.ts packages/sim-core/src/__tests__/golden.test.ts packages/sim-core/src/__tests__/performance.test.ts
npx vitest run packages/sim-core/src/__tests__/electro-charged.test.ts
npx vitest run packages/sim-core/src/__tests__/aura-v7-order-release.test.ts packages/sim-core/src/__tests__/aura-v7-public-grid.test.ts
npm test
npm run check
npx playwright test apps/web/e2e/simulator.spec.ts --project=chromium
```

Golden 脚本的日常验收只使用 `--preview`；冻结文件不得覆盖。`npm run check` 包含数据校验、类型检查、单元/性能测试和 build，但不包含 Playwright，E2E 必须单独运行。

---

## Milestone 1：TypeScript核心与可靠Schema

### 任务

1. 把模拟核心迁移到 `packages/sim-core`。
2. 使用明确类型：

```ts
SimConfig
CharacterProfile
EnemyProfile
RotationCommand
ActionDefinition
HitDefinition
StatusDefinition
EnergyEvent
SimulationEvent
DamageEvent
SimulationResult
```

3. 使用 Zod 校验输入 JSON 并提供字段路径错误。当前精确 1.47 输出由 `simulationResultV147Schema` 覆盖全部已声明顶层字段和叶节点；冻结 `simulationResultV146Schema` / `simulationResultV145Schema` / `simulationResultV144Schema` / `simulationResultV142Schema` 仍只接受各自精确历史身份。外部或持久化结果必须完整解析，核心内部当前结果运行 `assertTrustedSimulationResultV147()`。V145 公式根、V146 Damage Group root/log、V147 application root/log 与相关外键都必须 strict 校验；trusted assertion 不能作为外部 wire 的验证边界。
4. 加入 Schema 迁移系统，例如：

```ts
migrateConfig(input): SimConfigV2
```

5. 结果对象至少保留：

```ts
sourceActorId
scalingOwnerId
creditOwnerId
actionId
hitId
frame
timeSeconds
activeCharacterId
statsBeforeDamage
activeStatuses
enemyStateBeforeHit
damageFactors
finalDamage
```

6. 将公式拆成纯函数：

```ts
calcTotalStat()
calcDefenseMultiplier()
calcResistanceMultiplier()
calcCritMultiplier()
calcAmplifyingReactionMultiplier()
calcDamage()
```

7. 给所有公式写边界测试。

### Milestone 1 验收

- 新核心在旧兼容模式下通过全部Golden测试。
- 非法配置在模拟开始前给出明确错误，而不是运行中静默忽略。
- `sim-core` 可以在Node和浏览器中运行。

---

## Milestone 2：合法行动时间线

这是正式模拟与当前MVP的第一项实质差异。

### 必须支持

- 使用60 FPS整数帧作为内部时间单位；UI可显示秒。
- 切人耗时。
- 行动开始帧、命中帧、可取消帧、动画结束帧。
- 技能冷却、爆发冷却、充能次数。
- 行动队列与失败原因。
- 当前前台角色随切人事件改变。
- 行动重叠检查。
- 可配置的严格模式：非法指令报错或等待到可执行时刻。

### 建议命令模型

```ts
swap(characterId)
castSkill(characterId, params)
castBurst(characterId, params)
normal(characterId, comboIndex)
charge(characterId)
wait(frames)
```

不要继续要求用户手动填写所有命中绝对时间。角色行动定义应提供命中帧，轮转只描述操作顺序。

### 验收

- 两个角色不能在同一前台帧同时施放动作。
- 过早施放技能会被等待、拒绝或明确记录，行为由模式决定。
- 时间线中每段命中都能追溯到合法行动。

---

## Milestone 3：元素附着、Aura和增幅反应

先覆盖杜林融化队需要的最小范围，不要一开始实现所有复杂反应。

### 第一批支持范围

- Pyro、Cryo、Hydro Aura。
- 元素附着量：1U、2U、4U及可扩展数值。
- Aura衰减。
- 默认ICD：3-hit / 2.5-second。
- `No ICD`。
- 独立 `icdTag` + `icdGroup`。
- 正向/反向融化和蒸发自动判断。
- Aura触发前后状态写入逐击日志。
- 调试模式允许 `reactionOverride`，但正式预设不得依赖手工反应标签。

### 事件日志必须增加

```ts
auraBefore
auraApplied
auraConsumed
auraAfter
icdAllowed
reactionTriggered
reactionType
```

### 验收测试

- 同一ICD组连续三击的附着序列正确。
- 不同ICD组互不影响。
- 1U冰底被火触发正向融化后的消耗正确。
- 没有Aura时不得凭配置标签发生融化。
- 当前杜林预设可以移除绝大多数手工 `reaction` 字段。

---

## Milestone 4：粒子与能量系统

### 支持

- 粒子产生帧、元素、数量、随机范围和飞行时间。
- 粒子到达时的前台角色。
- 同色/异色粒子倍率。
- 前台/后台能量倍率。
- 每名角色元素充能效率。
- 固定回能与粒子回能分开记录。
- 能量上限溢出。
- 0能量启动。
- 可固定随机种子。

### 输出

能量日志至少显示：

```ts
spawnFrame
receiveFrame
particleElement
particleCount
receiverId
isOnField
isSameElement
energyRecharge
rawEnergy
finalEnergy
wastedEnergy
```

### 验收

- 110级、10抗、0能量、120秒的预设能明确展示首轮启动过程。
- 每次爆发是否成功、为何断轴均可追溯到具体粒子事件。

---

## Milestone 5：数据层与杜林队正式预设

在核心稳定前，不要批量录入全部角色。

当前实施说明：用户后续明确要求保存全角色/武器/技能数值，因此已先建立全量“可查询目录”，但没有批量生成可执行机制。完整倍率数据与运行时 UID 索引分离；所有条目必须通过逐角色 `mechanics-mapped` 审核门才能进入正式模拟。

当前新增的杜林黑/白 E 使用独立 `AbilityBlueprint` 达到 `partial`，不是目录整条记录的 `mechanics-mapped`。编译器默认拒绝 `partial`；只有明确命名的审计向量能以 `allowPartial: true` 运行。禁止因为局部技能向量而提升整名角色状态。

### 第一批角色

1. 杜林
2. 尼可
3. 洛恩
4. 茜特菈莉
5. 希诺宁

### 第一批装备

- 上述角色的相关专武。
- 讨龙英杰谭。
- 队伍所需圣遗物套装。
- 只录入该队会实际使用的效果。

### 每条数据必须包含

```ts
id
name
patch
source
sourceVersion
verifiedAt
verificationStatus: "verified" | "provisional" | "user-supplied"
notes
```

### 数据规则

- 不得把当前MVP中的魔法数当作已验证数据。
- 公开稳定版本数据与测试服/未验证数据必须隔离。
- 如果参考gcsim代码，先检查其许可证；如复用代码，保留许可证和归属。更推荐独立实现并用其测试向量交叉校验。
- 每个技能至少需要一个裸伤测试向量和一个Buff后测试向量。

---

## 6. UI/UX目标

保留当前深色、数据工具型视觉方向，但从“JSON编辑器优先”改为“表单和轮转编辑器优先；JSON作为高级模式”。

### 页面结构

#### A. 队伍构建

- 四名角色卡。
- 等级、命座、武器、精炼、天赋等级。
- 圣遗物主词条和可编辑最终面板。
- 数据验证状态提示。

#### B. 敌人与环境

- 敌人等级。
- 分元素抗性。
- 防御降低、易伤或阶段性状态。
- 模拟时间、初始能量、随机种子。
- 预设按钮：`110级 / 10抗 / 0能量 / 120秒`。

#### C. 轮转编辑器

- 命令列表和可视化时间线。
- 拖拽排序不是第一优先级；先确保键盘和按钮编辑可靠。
- 显示行动占用、Buff窗口、爆发CD和能量。
- 非法操作直接标红并解释。

#### D. 模拟结果

顶部固定显示：

- 全队平均DPS。
- 120秒总伤。
- 有效战斗时长。
- 成功/失败行动。
- 反应覆盖率。
- 能量断轴次数。

结果页签：

1. **角色**：个人总伤、DPS、占比。
2. **技能**：技能/段数拆分。
3. **时间线**：每秒伤害、累计伤害、Buff和能量轨道。
4. **逐击日志**：来源、归属、倍率、反应、Aura、Buff、最终伤害。
5. **能量日志**：粒子和固定回能。
6. **比较**：两套配置差异。

### 逐击公式详情

必须清晰区分：

- 实际施放者。
- 缩放面板所有者。
- 伤害归属角色。
- 基础倍率伤害。
- 所有附加基础伤害来源。
- 元素/攻击标签增伤。
- 防御降低和防御无视。
- 有效抗性。
- 暴击模式。
- Aura与ICD。
- 最终反应倍率。

不要只显示一个“最终乘数”；必须展示分步结果。

---

## 7. 测试要求

使用：

- `Vitest`：核心单元测试和Golden测试。
- `Playwright`：导入预设、运行模拟、切换页签、筛选逐击、展开公式、导出配置。
- 可选 `fast-check`：公式和事件队列性质测试。

### 必测向量

1. 裸伤：无Buff、无反应、10%抗性。
2. 敌人等级110、角色90的防御区。
3. 抗性跨越0%。
4. 抗性跨越75%。
5. 防御无视达到100%上限。
6. Buff恰好在命中帧失效。
7. 同帧Buff与命中的事件优先级。
8. 行动快照与命中时动态结算。
9. 能量刚好等于爆发消耗。
10. 能量不足导致整个行动取消。
11. 默认ICD的第1、2、3、4次命中。
12. 正向融化和反向融化。
13. 粒子到达前后切人。
14. 120秒最后一轮伤害截断。
15. 重开持续技能是否取消上一实例。

### 性能目标

第一阶段目标：

- 一个120秒确定性单目标模拟在普通桌面浏览器中 `< 100 ms`，若暂时无法达到，必须输出基准并说明瓶颈。
- 逐击日志达到10万行时，UI不得一次渲染全部DOM；使用分页或虚拟列表。
- Monte Carlo后续放入Web Worker，不阻塞主线程。

---

## 8. 当前杜林队模拟口径

优先保留并正式实现以下场景：

```text
单体木桩
敌人等级：110
基础全元素抗性：10%
初始能量：全员0
持续时间：120秒
无击杀掉球
无外部能量球
无敌人移动或无敌时间
无特殊破盾易伤
```

核心候选队：

```text
C6R5 杜林
C6R1 尼可
C0/C2R1 洛恩
C2R1 茜特菈莉 或 C2R1 希诺宁
```

请不要把当前MVP的DPS数字当作目标答案。正式目标是：

1. 每个机制经过数据和测试校验。
2. 输出能够解释为什么某一队更高。
3. 明确区分“确定性平均暴击”“随机模拟均值”和“全暴击录像上限”。
4. 允许比较茜特菈莉专武、精5讨龙、希诺宁方案。

---

## 9. 禁止事项

- 不要在没有Golden测试前删除或彻底重写旧引擎。
- 不要把全量可查询目录批量提升为“完整可执行角色”；每个角色/武器必须逐项通过 `mechanics-mapped` 和测试向量。
- 不要用一个巨大的 `switch(characterName)` 实现全部角色机制。
- 不要让UI组件自己计算伤害。
- 不要继续依赖手工标记每一段是否融化作为正式方案。
- 不要静默忽略非法字段或非法轮转。
- 不要用“看起来合理”的数值填充缺失数据；缺失数据应标为未验证并阻止正式结果认证。
- 不要为了视觉效果牺牲逐击可审计性。
- 不要声称与gcsim完全一致，除非有覆盖测试和误差报告。
- 不要将测试服、泄露或用户猜测的数据混入稳定数据集而不标记。

---

## 10. 原始第一轮交付要求与当前续作

Milestone 0、Milestone 1 和 Milestone 2 的第一轮要求已经完成。以下清单保留为历史验收契约，不能因后续功能扩展而退化。当前续作以本文件顶部的 1.47 权威 Current State 为起点：保持全部历史 Golden、Manifest 1.3 三 root、两份 1.47 Fixture、核心 `reactionTaskLog`、反应交付/EC cleanup 引用、1.41/1.42 传播与 cadence 向量、24 标签/16 类经典反应发布门，以及 1.44–1.47 v3 callback delivery/attempt 完整性契约。下一步先逐技能绑定经过来源核验的两类 Tag/Group，再把反应拥有/派生应用纳入新版本统一审计，同时补特殊/多 Aura 排列、来源 overlap、Hitlag/Frozen 交叉和 Burning 之外的通用目标任务所有权；Lunar 反应另立版本实现。基础机制稳定后才处理玩家 Aura/敌袭生存模型、全角色机制映射、UID 配置编译和专用 UI。

交付时必须提供：

1. 实际修改摘要。
2. 新目录结构。
3. 运行命令。
4. 测试命令与测试结果。
5. 迁移前后的默认预设基线数字。
6. 未完成项和已知偏差。
7. 下一步建议，但不得用建议代替本轮应完成的实现。
8. 浏览器截图或Playwright验证结果。

### 历史完成定义

第一轮完成至少意味着：

- 旧版被保存。
- 新的TypeScript模拟核心已建立。
- 有可靠Schema。
- 有自动化测试。
- 默认预设在兼容模式下结果完全对齐。
- 网站仍可以运行并查看全队、个人、技能和逐段伤害。

后续每轮仍应从检查现有文件、版本、Golden 和运行身份开始，随后直接实施；不得用架构建议替代可运行代码与验证。
