# 技术设计：提瓦特伤害实验室

## 1. 当前目标

Vanilla v0.1 结果继续由兼容模式和 Golden Fixture 冻结。正式路径已经加入 60 FPS 合法帧时间线、角色无关的行动状态机、火/冰/水/雷/草 Aura、声明式 ICD Profile、基础增幅/转化/状态反应、`aura-v5` 有序多反应链、ReactionA/B、燃烧 Marker/Fuel/Tick，以及绽放、草原核、烈绽放和超绽放的确定性纵向切片。核心还持有版本化目标/草原核时间线、逐击伤害构成、可复现粒子/能量事件、命中产球及其内部冷却审计，并通过 `runManifest` 固定每次运行的配置、选项和插件身份。当前版本仍不声称拥有完整游戏机制或 gcsim 精度。

## 2. 包边界

```text
apps/web
  只负责输入、调用核心和渲染结构化结果。

packages/schemas
  TypeScript 公共类型、Zod Schema、字段路径错误、版本迁移。

packages/sim-core
  事件队列、状态、能量、公式、聚合和逐击曲线数据。
  不依赖 React、Vite、Canvas、DOM 或浏览器全局。

packages/game-data
  预设、版本化完整目录、浏览器轻量索引和展示柜数据适配器。
  当前杜林预设和目录记录均为 provisional。

packages/mechanics
  Ability Blueprint、来源编译闸门、声明式伤害修正插件和角色机制向量；
  避免在核心循环写角色名分支。

packages/test-vectors
  冻结 v0.1、1.30 Burning 与 1.31 反应矩阵 Golden Fixture。
```

依赖方向：

```text
schemas <- game-data
schemas <- sim-core
schemas + sim-core + game-data <- mechanics
sim-core + schemas + game-data + mechanics/durin-audit <- apps/web
```

完整目录通过 `@genshin-dps-lab/game-data/catalog` 子路径显式导入；包根只导出轻量运行时索引、预设和展示柜适配器。网页从 `@genshin-dps-lab/mechanics/durin-audit` 读取由测试锁定的紧凑运行时投影，不在浏览器重新解析完整倍率目录。当前 Vite 生产构建仍会给出主 JS chunk 超过 500 kB 的拆包警告；这不影响核心正确性，但在继续扩展 UI 前应拆分懒加载边界。

## 3. 配置契约

每个输入必须包含：

```ts
schemaVersion
engineVersion
dataVersion
randomSeed
```

`migrateConfig()` 负责把无版本及 `0.1.0`–`1.30.0` 配置迁移到 `1.31.0`；1.30 配置保留 `aura-v4` 模式、Burning 相位和绽放 fail-closed 语义，只有显式选择 `aura-v5` 才启用新反应矩阵与草原核。严格 Zod Schema 会校验 Schema/引擎版本配对并拒绝未注册或重复的 fanout 目标、同时声明脚本命中与几何命中、缺少目标位置或形状参数的几何配置、重复/未知的静态角色姿态、没有对应姿态的施放者局部几何、未注册/无初始位置/重叠/越界的目标移动分段，以及非钝击命中携带 `poiseDamage`。`aura-v5` 才能产生正式的 Bloom/core 审计；全零 Bloom 消耗、非法槽公式、核心 ID 重用和跨日志悬空引用都会被严格 Schema 拒绝。`engineVersion` 当前为 `1.31.0-dendro-cores`。

输出侧的 `SimulationRunManifest`、Burning/Quicken/Bloom 审计、ReactionA/B 伤害组、草原核生命周期/接触/时间线及其跨日志引用、`TargetStateTimeline` 等关键投影均有严格 Zod Schema，并使用模拟器实际生成的状态流做解析测试。`TargetStateTimeline` 自带独立输出版本 `1.0.0`；草原核时间线同样校验连续 ID、帧序和日志链接。完整 `SimulationResult` 目前仍由 TypeScript interface 约束，尚未建立覆盖全部输出字段的单一顶层运行时 Zod Schema；因此“可靠 Schema”声明只适用于输入配置和已显式注册的关键输出契约。

每次结果都返回 `runManifest`：

```ts
version
identityAlgorithm        // fnv1a32-v2
schemaVersion
engineVersion
dataVersion
configHash
resolvedRuntimeOptions   // energyMode / critMode / compatibilityMode / randomSeed
plugins                  // 有序 descriptor + contentHash
reproducibilityKey       // gdl-v2-fnv1a32-*
```

配置先规范化再哈希；每一次前缀探测和最终模拟都从 `createRuntime()` 建立全新插件实例，防止复用有状态插件污染结果。声明式插件由核心对规范化效果生成内容哈希；任意代码插件的 descriptor/contentHash 仍是插件作者提供的受信声明。FNV-1a 仅用于确定性漂移检测，不提供密码学完整性、来源认证或签名。

## 4. 确定性与排序

相同时间的事件排序为：

1. `action`
2. `buff` / `debuff`
3. `energy` / `particleSpawn` / `particleReceive` / 周期 Aura、冻元素、激元素、结晶碎片/护盾/草原核到期检查 / 结晶碎片与草原核生成
4. `hit`
5. 周期反应 Tick 准备
6. 独立反应伤害
7. 周期反应延迟 Aura 削减
8. 显式结晶碎片拾取
9. 同类型同时间按插入序号

状态在 `end <= hitTime` 时先过期，因此恰好处于结束边界的命中不享受该状态。该规则由测试固定。

因此同帧行动会先检查/消耗能量，随后才接收该帧到达的粒子；同帧先产生的充能效率 Buff 则会在粒子接收前生效。普通命中先于周期 Tick 准备，因此恰好与感电 Tick 同帧的水雷刷新会更新该 Tick 的未来伤害归属；普通命中也先于独立反应伤害和 6 帧延迟 Aura 削减。碎冰的状态检查属于命中内部子阶段，严格按“钝击削冻 → 碎冰消耗 → 本段元素附着/反应”执行；其同帧独立物理伤害进入优先级 6 的通用反应伤害管线，所以结构化 `damageEvents` 中稳定排在触发伤害之后。结晶碎片在生成帧先处理状态/Buff 到期并快照等级/精通；显式拾取排在该帧全部已实现战斗事件之后，且同帧护盾到期先于新拾取，因此边界行为稳定。固定 gcsim 的递归 `QueueAttackWithSnap(..., 0)` 会先应用碎冰伤害；当前差异不影响已实现的无回调物理伤害，但未来加入伤害回调时必须升级事件版本并重新核对顺序。这些子阶段语义均有专门测试，后续若要与新实测帧规则对齐，必须作为引擎版本变更处理。

Burning 在 `aura-v4/v5` 继续采用“同帧普通命中先于 Tick”的 1.30 引擎契约；Fuel 自然清理边界也冻结为 `F+121`。固定参考的敌方局部任务路径则是 `F+120` 最后 Tick、Fuel 清理、再处理普通命中；这项相位差异必须作为兼容限制保留，不能在现有引擎版本里静默改写。多个目标在同一帧进入 Burning Tick 时，核心按 `enemy.targets` 注册顺序分配目标内子优先级，并在下一个目标 Tick 前完成当前目标的范围伤害、附着、ICD 与嵌套刷新/停止，避免先批量准备全部 Tick 再批量结算。

`SimulationResult.targetStateTimeline` 是核心旁路记录的权威目标 Aura 状态序列，当前输出版本为 `1.0.0`。核心在实际 AuraEngine 调用点记录初始/结束边界、普通 Aura 自然到期派生点、直接命中的碎冰与附着子阶段、独立反应伤害的附着与嵌套碎冰，以及 Frozen、Quicken、Electro-Charged、Burning 的 Tick、削减和到期。事件点保存真实的 `eventType / eventPriority / eventSequence / intraEventSequence`；边界点和普通 Aura 自然到期派生点明确使用空事件元组，不伪造调度器事件。点数组顺序和连续 `id` 是消费顺序，网页 Aura/Fuel Canvas 只按目标过滤并保持原序，不再拼接旧状态日志、硬编码优先级或二次排序；旧 `auraTimeline`、各状态日志、`auraInitialStates` 和 `auraEndStates` 仍保留给既有表格与消费者。草原核使用独立 `dendroCoreTimeline`，其生命周期点通过严格 ID 引用回链 `dendroCoreLog`，不会让 UI 从伤害事件猜测核心状态。

1.31 同时升级了运行身份契约：`runManifest` 现在把配置哈希、解析后的运行选项和有序插件身份纳入 `gdl-v2-fnv1a32-*`。伤害与事件仍保持兼容 Golden；因为哈希契约本身升级，旧 `gdl-*` 文本键不再是当前身份。当前锁定的 `legacy-v0.1` key 为 `gdl-v2-fnv1a32-5a0c4085`，1.30 Burning key 为 `gdl-v2-fnv1a32-2227b3cd`。

引擎保留两条时间路径：

- `legacy-v0.1`：保留浮点秒和原有排序，保证 Golden 完全一致。
- `legal-frame-v1`：命令、行动占用、切人、冷却、效果和命中以 60 FPS 整数帧编译；事件队列首先按整数帧排序，秒数只作为 UI 表示。

合法帧配置把角色行动数据与轮转命令分离：

```ts
timeline: {
  mode: "legal-frame-v1",
  fps: 60,
  legalityMode: "strict" | "wait",
  initialActiveCharacterId,
  swapFrames,
  abilities: [{
    kind,
    cancelFrame,
    cancelFrames: {
      normal,
      charge,
      skill,
      burst,
      dash,
      jump,
      swap
    },
    animationEndFrame,
    cooldownFrames,
    maxCharges,
    chargeRecoveryFrames,
    hits: [{ frame, ...damageDefinition }],
    particles: [{
      element,
      kind: "particle" | "orb",
      count: number | { min, max, step },
      spawnFrame?, // 固定产球与 trigger 二选一
      travelFrames,
      trigger?: {
        kind: "hit-confirm",
        hitIds,
        internalCooldown?: { key, durationFrames }
      }
    }],
    timelineState: {
      requires: ["actor-state"],
      consumes: ["actor-state"],
      clears: ["opposite-branch-state"],
      grants: [{ key, label, durationFrames }]
    }
  }],
  commands: [
    { type: "skill", actorId, abilityId },
    { type: "charge", actorId, abilityId },
    { type: "dash", actorId, frames },
    { type: "jump", actorId, frames },
    { type: "swap", characterId },
    { type: "wait", frames }
  ]
}
```

命令游标默认推进至行动的可取消帧。若紧随其后的命令是普攻、重击、战技、爆发、冲刺、跳跃或切人，编译器优先使用 `cancelFrames[下一命令类型]`；未声明、后续为 `wait` 或已到队尾时回退到 `cancelFrame`。所有取消帧必须是不超过动画结束的非负整数，实际选中的帧会进入逐指令结果和逐行动日志。冲刺/跳跃命令不是伤害技能，不查找 `abilityId`，但要求正整数 `frames` 作为显式占用并检查前台角色；当前不从角色数据猜测其持续时间，也不模拟耐力、位移、无敌帧、落地或碰撞。显式 `atFrame` 早于游标时视为行动重叠；`strict` 抛出带命令路径的错误，`wait` 移动至可执行帧并记录调整。冷却和充能次数使用每个充能槽的下一可用帧计算。

`timelineState` 是归属于施放角色的行动合法性状态，与改变面板的 Buff/Debuff 分离。编译器在实际执行帧先处理到期，再检查 `requires`，随后执行 `consumes`、`clears` 和 `grants`。`clears` 不要求目标状态存在，只在实际移除时写日志，适合表达互斥分支；因此状态在 `expiresAtFrame` 当帧不可再用，冷却等待跨过状态窗口后会重新检查并以 `MISSING_REQUIRED_STATE` 拒绝。`stateLog` 记录 `grant / replace / consume / clear / expire`、来源指令和精确帧。

能量是运行时状态，不能在静态时间线编译时猜测。`simulateLegalTimeline()` 按命令顺序对每个 `energyCost > 0` 的行动编译到该命令为止并运行确定性前缀，记录实际 `energyBefore / energyCost`；随后用已确认的失败集合重编译最终时间线。能量失败命令保留尝试帧和结构化 `INSUFFICIENT_ENERGY` 审计，但不加入执行队列、不占用冷却、不推进取消帧，也不执行 `consumes / grants`。后续命令、状态边界和冷却均从回滚后的游标重新计算。这样带能量消耗的能力可以安全声明行动状态。该实现优先保证确定性和可审计性；未来若引入大量条件命令，需要替换成单遍运行时调度器并保持相同输出契约。

## 5. 伤害公式

公式拆分为纯函数：

```ts
calcTotalStat()
calcDefenseMultiplier()
calcResistanceMultiplier()
calcCritMultiplier()
calcAmplifyingReactionMultiplier()
calcDamage()
```

普通倍率伤害：

```text
基础伤害 = 倍率 × 缩放属性 + 附加基础伤害

最终伤害 = 基础伤害
         × (1 + 增伤)
         × 防御区
         × 抗性区
         × 暴击区
         × 增幅反应区
         × 伤害组修正
```

兼容模式保留旧版语义，包括旧配置的字段行为。Golden 回归容差为 `1e-8` 相对误差。

## 6. 逐击审计与曲线

每个 `DamageEvent` 至少记录：

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
reactionAudit
damageFactors
damageComposition
finalDamage
displayDamage
```

`finalDamage` 是用于 Golden、聚合与后续计算的浮点原始值；`displayDamage` 使用 `Math.round(finalDamage)`，与 gcsim Sample 页的整数展示口径一致。`damageComposition` 由核心把最终贡献拆成 `direct`、`additiveReaction`、`transformativeReaction`，三项严格求和为 `finalDamage`。插件上下文和返回契约把 `ordinaryFlatDamage` 与 `additiveReactionFlatDamage` 分开；多插件依次读取上一插件更新后的分量，Catalyze 命中若仍返回含糊的旧 `flatDamage` 会按插件 ID fail-fast。最终 `appliedFlatDamage` 直接取明确的激化分量，不从总 flat 猜测。UI 只显示这些字段，不重新分摊或计算。

`reactionAudit` 包含 `icdAllowed`、`icdTag`、`icdGroup`、`applicationGaugeUnits`、`auraBefore`、`auraApplied`、`auraConsumed`、`auraAfter`、有序 `reactions`、明确截断的 `unsupportedReactions`、目标级 `mechanicsTruncation`，以及可空的 `transformativeReaction`、`periodicReaction`、`frozenReaction`、`shatterReaction`、扩散多判定数组 `swirlReactions`、逐目标 `swirlDamageGroup`、`crystallizeReaction`、`catalyzeReaction` 和 `burningReaction`。碎冰审计独立保存打击类型、韧性伤害、削冻前后、碎冰消耗、触发/GCD 结果、冻结快照和下一可用帧；扩散数组避免一个风命中的多元素扩散互相覆盖；结晶审计保存共享 GCD、岩预算、Aura 消耗、元素选择和碎片三条边界帧；Catalyze 审计保存加算反应、激元素候选/代次/来源槽/到期与零消耗；Burning 审计保存 Marker/Fuel、归属、快照、周期常量、调度和停止原因。兼容引擎不具备 Aura/ICD 推演能力，所以 Aura 字段必须为 `null`，手工反应标记为 `manual-override`；不得用空数组伪装为“敌人无附着”。`aura-v1` / `aura-v2` / `aura-v3` 下数组表示核心实际判定的空/非空状态。普通独立转化反应伤害以 `model: "reaction-damage"` 明确标记，Aura 与 ICD 字段为“不适用”的 `null`，不伪装成一次新附着；超载独立伤害仍可通过单独的 `shatterReaction` 审计削冻。扩散传播攻击是例外：它本身仍是独立转化伤害事件，但显式携带传播附着并重新运行 Aura 引擎，所以 Aura 字段记录目标上的真实二次反应。

核心同时返回：

- `enemyTargets`：应用共享敌人默认值后的具名目标等级、抗性、减防、初始二维位置和碰撞半径。
- `actorPoses`：场景显式声明并由核心用于局部坐标变换的静态角色位置和朝向。
- `characterSummaries`：伤害、命中、DPS、占比。
- `targetSummaries`：逐目标实际/潜在伤害、结算段数、landed/Miss、免疫段数、DPS 和占比。
- `bySkill`：伤害、命中、DPS、占比。
- `perSecond`：逐秒、逐角色伤害桶。
- `damageCurve`：每一段伤害对应一个累计曲线点，含逐角色累计值，以及直接伤害、激化加算和转化反应的核心累计构成。
- `hitResolutionLog`：每次排队逐击的目标、判定来源、`landed / miss`、原因、命中时目标位置、静态施放者位置/朝向、原始坐标空间、解析后的圆心/端点/尺寸/旋转/扇形方向与夹角、几何距离/阈值、伤害/Aura/命中回调三层许可、公式潜在伤害、实际伤害，以及可空的伤害事件反向链接；因此 Miss 和免疫 0 伤害都不会从审计中消失。
- `reactionDamageLog`：每次转化反应或扩散自身/传播攻击的触发伤害 ID、触发/伤害帧、队列/伤害 GCD 结果、下一可用帧、触发目标、固定圆心、半径、传播元素量、源目标排除、全部已检查/命中/坐标未解析/ReactionA 阻止目标，以及生成的独立伤害事件 ID。
- `reactionStatusLog`：由转化反应伤害实际命中后施加的目标级状态，含来源伤害、目标、抗性元素/数值、开始/结束帧、施加/刷新，以及被刷新时对旧半开区间的精确截断。
- `periodicReactionLog`：每个目标上的周期反应启动、刷新、逐次 Tick、延迟 Aura 削减、零伤害跳过和停止，含流代次、Tick 序号、伤害归属、来源伤害 ID、Aura 前后状态和下一调度帧。
- `frozenStateLog`：每个目标的冻元素耐久生成、刷新、冻结抗性免疫、融化/超导消耗、钝击削冻、碎冰消耗和自然到期，含代次、来源伤害、Aura 前后状态、生成/消耗量、冻结抗性和精确到期帧。
- `quickenStateLog`：每个目标的激元素生成、刷新、较弱候选不覆盖和自然到期，含来源槽、代次、触发/被消耗元素、候选与前后耐久、来源伤害和精确到期帧。
- `burningStateLog`：每个目标的燃烧启动、Fuel 覆盖、快照刷新、逐次 Tick、固定第九槽跳过、附着 ICD、Marker 消耗停止和自然到期，含来源、代次、Marker/Fuel 前后量、父子伤害链接、事件排序与下一调度帧。
- `crystallizeShardLog`：每个碎片的生成、上限淘汰、过早/无匹配拾取尝试、成功拾取与自然到期，含触发伤害、元素、来源目标、固定种子位置、生成/最早拾取/到期帧、生成帧等级/精通快照和护盾反链。
- `crystallizeShieldLog` / `crystallizeShieldTimeline`：护盾增加、覆盖和到期，以及固定等级表、精通加成、通用/同元素/岩伤理论吸收量和供 UI 直接绘制的阶梯点。
- `targetPhaseTimeline`：核心实际使用的 60 FPS 半开目标阶段窗口，含目标、开始/结束帧、三层策略和原因。
- `targetMotionTimeline`：核心实际使用的 60 FPS 线性移动分段，含解析后的起点、终点、开始/结束帧和秒数。
- `auraTimeline`：每一段 Aura 模式伤害对应的目标、附着前后、ICD、消耗和反应记录。
- `targetStateTimeline`：输出版本 `1.0.0` 的核心目标状态序列，覆盖边界、普通 Aura 自然到期、命中/反应子阶段及已实现周期状态；每点携带前后 Aura、权威事件元组、同事件子序和可选伤害/日志链接。
- `particleEvents`：每一次产球的来源、生成帧、到达帧、元素、类型、随机后数量和是否在模拟期内接收。
- `particleTriggerLog`：每一次逻辑命中的产球检查、`hitGroupId`、全部检查/确认目标、是否触发、被阻止原因、内部冷却键和下一可用帧。
- `energyLog`：每个固定回能或粒子对每名接收者的逐次结算。
- `energyCurve`：初始、消耗、固定回能和粒子接收后的全队能量快照。
- `timelineExecution.stateLog`：行动状态的进入、刷新、消耗、清除和到期帧。

UI 只绘制这些结构化结果，不重新执行伤害公式。

`enemy.targets` 是最多 32 项的具名目标注册表；每项目标可覆盖共享 `enemy.level / resistance / defReduction` 和 `reactionEngine.initialAura`，并可声明初始二维 `position` 与圆形 `hitboxRadius`，但必须保留兼容目标 `enemy-0`。`enemy.targetMotions` 可为已注册且有初始位置的目标声明有序、不重叠的线性移动段 `{ startFrame, endFrame, endPosition }`：每段起点取该目标上一段终点（首段取初始位置），段内按整数命中帧线性插值，间隙保持上一位置，`endFrame` 精确到达终点并可与下一段相邻。未提供注册表时核心自动物化 `enemy-0`，因此既有 Golden 配置无需改写。每段命中在伤害公式之前先选择一个已注册目标；未声明 `targeting` 或 `geometry` 时使用 `enemy-0 / landed`。场景可显式声明 `{ targetId, outcome: "miss", reason }`，或声明圆形/旋转矩形 geometry。圆形按 `hypot(positionAtHit - origin) <= radius + hitboxRadius + 1e-9`；矩形先将目标中心按 `-rotationDegrees` 转到局部坐标，夹取到 `[-halfWidth, halfWidth] × [-halfHeight, halfHeight]` 的最近点，再比较最近距离与 `hitboxRadius + 1e-9`。几何与脚本 targeting 互斥，且要求所有目标都有位置。Miss 会写入 `hitResolutionLog`，但不会调用该目标的 Aura / ICD 状态机，不会生成 `damageEvents`，也不会触发或占用命中产球 ICD。对 landed 命中，`effects` 可分别把 `damage` 设为 `immune`、把 `aura` 或 `hitConfirm` 设为 `blocked`，并强制附带原因。伤害免疫仍保留公式潜在值和 0 实际值；Aura 阻断只推进该目标的时间衰减，不施加元素或反应；回调阻断写入 `TARGET_HIT_CONFIRM_BLOCKED` 且不启动粒子 ICD。

胶囊几何由 `start / end / radius` 定义。核心把目标中心投影并夹取到有限线段，再比较最近距离与 `radius + hitboxRadius`；零长度线段确定性退化为端点圆。`hitResolutionLog` 为胶囊保存两个端点、扫掠半径、最近距离与总阈值。

填充扇形由 `origin / radius / directionDegrees / angleDegrees` 定义。目标中心在扇形内时距离为 0；否则核心取其到圆弧和两条有限径向边的最小欧氏距离，再与圆形目标的 `hitboxRadius` 比较，因此径向边与弧端角点擦碰不会因只比较中心角度而漏判。`angleDegrees = 360` 确定性退化为圆盘。

四种形状默认使用世界坐标。`coordinateSpace: "actor-local"` 要求配置存在同施放者 ID 的 `actorPoses` 项；核心以朝向角旋转形状的点、矩形旋转角或扇形方向，再平移到角色位置，随后才与命中帧目标位置求交。结果保留原坐标空间和静态姿态，但形状字段始终是实际参与求交的世界坐标。姿态不会随切人、冲刺或技能自动变化，也不会朝目标自动旋转。

`enemy.targetPhases` 把相同三层策略提升为有序、不重叠的 `[startFrame, endFrame)` 场景窗口；开始帧立即生效，结束帧立即恢复或切换到相邻阶段。逐击 `effects` 可完整覆盖活动阶段，脚本化 Miss 仍拥有最高优先级。每条 `hitResolutionLog` 都保存 `targetEffectSource` 和活动 `targetPhaseId`，因此阶段策略、逐击覆盖和默认正常路径可区分。阶段由输入配置提供，当前不包含 Boss AI、血量阈值或动作状态自动驱动。

目标自身的等级、抗性、减防、初始 Aura、初始位置、线性移动分段和碰撞半径已逐目标解析；现有行动 `debuffs` 仍是场景全局敌方状态，会同时影响所有已注册目标。把 Debuff 绑定到单个目标属于后续 Schema 扩展。

这一分层参考锁定 gcsim 提交中 [`Combat.attack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go) 的 `AttackWillLand` 前置门、[`Enemy.HandleAttack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go) 中反应/实际伤害/附着/回调的顺序，以及 [`Target.AttackWillLand`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/target/target.go) 的目标/范围检查边界。gcsim 在这些文件中没有统一的通用无敌开关，因此本项目要求场景显式选择三层策略；这不是对所有官服无敌阶段行为的验证。当前只复制了二维圆形、旋转矩形、有限线段胶囊、填充扇形与预声明线性位置更新的最小子集，不是 gcsim 的完整形状、运动控制或目标系统。

### 6.1 Aura / ICD 最小状态机

`packages/sim-core/src/aura.ts` 是无 DOM 依赖的纯状态机。命中通过以下字段声明附着：

```ts
application: {
  gaugeUnits: 1,
  icdTag: "ability-stream",
  icdGroup: "default" | "no-icd" | "declared-profile-id"
}
```

普通 Aura 的初始耐久为标称元素量的 `0.8` 倍。兼容模式 `aura-v1/v2` 保留历史的 `420 + 6 × nominalU` 寿命，因而 1U 回放仍为 426 帧；opt-in `aura-v3` 按固定 gcsim 提交的 `25 durability = 1U` 换算使用 `420 + 150 × nominalU`，1U 为 570 帧。默认 ICD 窗口为 150 帧，序列为允许、阻止、阻止并循环；状态键包含施放者、`icdTag` 和 `icdGroup`。`no-icd` 每次允许附着。

角色特有组必须在 `reactionEngine.icdProfiles` 中显式声明：

```ts
icdProfiles: {
  "durin-skill": {
    resetFrames: 18,
    applicationSequence: [true, false, false]
  }
}
```

未知组在 Schema 校验和直接状态机调用两层都失败；不得静默退回默认 ICD。内置 `default` / `no-icd` 也禁止由配置覆盖。

当前增幅反应消耗规则与 gcsim 的最小语义对齐：

- 火打冰：正向融化，2 倍伤害基础，按 2 倍来袭元素量消耗冰 Aura。
- 冰打火：反向融化，1.5 倍基础，按 0.5 倍消耗火 Aura。
- 水打火：正向蒸发，2 倍基础，按 2 倍消耗火 Aura。
- 火打水：反向蒸发，1.5 倍基础，按 0.5 倍消耗水 Aura。

如果消耗型反应发生，剩余来袭元素是否继续参与同击后续反应由对应 Aura 版本的显式顺序决定，不由 UI 或手工标签猜测。正式 `aura-v1`–`aura-v5` Schema 都禁止非 `none` 的手工 `reaction`；只有 `debugAllowReactionOverride: true` 时可使用 `reactionOverride`。

当前状态机为每个已注册目标建立独立的火/冰/水普通 Aura 与 ICD 实例；`aura-v2` 另允许雷普通 Aura、独立冻元素耐久，并为感电保留同目标水雷共存；`aura-v3` 再加入草普通 Aura、激元素和普通 Aura/激元素的逐来源槽；`aura-v4` 增加目标级 Burning Marker/Fuel、周期代次、归属和内置燃烧附着 ICD；`aura-v5` 增加有序基础反应矩阵、Bloom 审计和草原核管理器。同一角色/Tag/Group、感电流、燃烧流、冻元素/激元素代次、碎冰 GCD、ReactionA/B、扩散元素队列 GCD、草原核与周期调度在不同目标或各自作用域内确定性隔离。v1/v2 为兼容回放继续使用聚合状态；v3/v4/v5 普通 Aura 的同来源重挂取较强值、不同来源保留独立槽，所有槽共享当前最大值决定的衰减，反应消耗从每个来源槽扣同一预算。一般化特殊 Aura overlap、敌人 Hitlag 时钟暂停和完整角色回调顺序尚未实现；自定义 ICD Profile 已具备通用契约，但尚未建立全角色 Profile 数据库。

#### 6.1.1 超载 / 超导独立伤害与目标状态

`aura-v2` 支持火命中雷 Aura 与雷命中火 Aura 的超载，也支持冰命中雷 Aura 与雷命中冰 Aura 的超导。四种方向都按 `1 × 来袭元素量` 消耗现有 Aura；反应触发与独立伤害是否通过 GCD 是两个不同事实。即使同一目标的 6 帧反应伤害 GCD 阻止爆炸，Aura 仍会被消耗，触发命中仍保留反应。超载和超导拥有彼此独立的伤害 GCD 流。

通过 GCD 后，核心在下一帧排入 `reactionDamage` 事件。触发目标在原命中帧的位置被冻结为爆炸圆心；伤害帧再读取其他目标的位置，并按半径 3 加各目标圆形碰撞半径逐一求交。触发目标没有坐标时确定性回退为只伤害该目标，其他目标写入 `unresolvedTargetIds`，不会假装命中。范围命中只处理伤害层：不施加 Aura、不推进附着 ICD、不执行普通命中确认产球。

两种反应共享转化反应公式，超载为火伤 `2.75` 基础倍率，超导为冰伤 `1.5`：

```text
等级基准 = gcsim 固定提交的 TransformativeBase[level]
精通加成 = 16 × EM / (2000 + EM)
抗性前伤害 = 等级基准 × 反应基础倍率 × (1 + 精通加成 + 反应增伤)
最终伤害 = 抗性前伤害 × 对应伤害元素抗性区 × 目标伤害策略
```

该事件不暴击且防御区固定为 1。每个范围内 landed 目标都生成独立 `DamageEvent(kind: "transformative-reaction")`，用 `parentDamageEventId` 指向触发命中，并提供 `transformativeReactionFactors`；普通伤害聚合、技能构成、逐秒桶和每击累计曲线因此自然包含反应，而 UI 不重算公式。

超导伤害命中后才给对应目标施加 `superconduct-phys-shred`：物理抗性降低 `40%`，基础持续 720 帧。状态使用 `[startFrame, endFrame)`；同帧优先级较高的普通命中不会提前受益，结束帧立即失效。刷新在新超导伤害帧截断旧日志区间并创建新的 720 帧区间。数值伤害免疫只把独立冰伤乘为零，只要范围判定为 landed 仍会施加状态；这与固定 gcsim 提交在伤害应用后始终发出 `OnEnemyDamage`、再由该事件添加超导减抗的路径一致。当前不实现 gcsim 的 Hitlag 延长，所以长 Hitlag 场景会与 gcsim 存在差异。

实现语义交叉核对固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `pkg/reactable/overload.go`、`pkg/reactable/superconduct.go`、`pkg/simulation/setup.go`、`pkg/core/combat/reaction.go`、`pkg/core/combat/reaction.dm.go` 与命中盒代码。冻结底超导现会先消耗剩余冰 Aura、再用来袭雷元素的余量消耗冻元素，并复用同一超导伤害/状态管线。当前仍未实现击退、通用韧性、三维范围、物件/召唤物或玩家自伤；这些是可审计的纵向切片，不是完整 gcsim 反应系统。

#### 6.1.2 水雷共存与感电周期流

`aura-v2` 在水命中雷 Aura 或雷命中水 Aura 时保留两种普通 Aura；触发本身不立即消耗 Aura。每个目标维护独立的感电流代次和固定节奏：

```text
新流首次伤害帧 = 触发帧 + 10
后续 Tick = 首次伤害帧 + 60 × n
伤害后 Aura 削减帧 = Tick 帧 + 6
水/雷削减 = 各 0.4U（仅当实际伤害 > 0）
感电抗性前伤害 = 等级基准 × 2.0 × (1 + 精通加成 + 反应增伤)
```

流存续期间再次触发感电只刷新共存 Aura 和未来 Tick 的角色等级/精通/反应增伤快照，不重置 Tick 节奏，也不追加即时 Tick。首次 Tick 保留初次触发时已经排队的快照；之后的 Tick 使用最近刷新者。每个 Tick 是单目标、雷元素、不暴击、忽略防御的独立 `DamageEvent`。目标数值伤害策略将实际伤害乘为零时，6 帧后的 Aura 削减被明确记录为 `wane-skipped`。

核心会按水/雷中较早的衰减到期帧排队可失效的检查；刷新或削减导致到期帧变化时，旧检查以流代次和期望到期帧判为过期，不会重复停止。若普通命中通过其他反应消耗掉水或雷 Aura，该命中的 `ReactionAudit.periodicReaction` 会在同帧记录 `stop`，清除未来 Tick 的活动来源，而不是等待下一 Tick 才发现共存丢失。固定 gcsim 实现已经把新流的首次伤害作为独立攻击排队，因此共存若在前 10 帧内丢失，首次伤害仍结算并记录 `QUEUED_FIRST_TICK_AFTER_STREAM_STOP`，但不会安排后续 Tick 或 6 帧后的 Aura 削减。网页把 `wane / stop` 节点合并进敌方 Aura 曲线，因此周期削减和命中终止都不会只存在于日志表。

该语义交叉核对固定 gcsim 提交的 `pkg/reactable/electrocharged.go`。固定路径使用 `NewSingleTargetHit`，所以本核心同样让每个敌人独立维护单目标 Tick 流，不推断附近潮湿目标的额外连锁。冻元素存在时会拒绝新感电；1.31 已覆盖指定的水雷/冰与水雷/火/冰有序链，但尚未实现任意来源 Aura overlap、所有同击反应排列或未经固定来源核验的目标传播，因此仍不是完整 gcsim Aura 系统。

#### 6.1.3 冻元素耐久、冻结抗性与冻结底反应

`aura-v2` 在水命中冰 Aura 或冰命中水 Aura 时触发冻结。目标 Aura 和来袭元素的实际反应量为二者较小值 `d`；目标普通 Aura 消耗 `d`，来袭元素不再附着，冻元素生成量为 `2d`。冻元素是独立于普通冰 Aura 的目标状态，可与后续普通冰或水 Aura 共存。

固定 gcsim 提交以内部 `25 durability = 1U` 换算后，冻元素的逐帧衰减为：

```text
初始衰减速率 = 0.4 / 60 U/f
每帧速率增量 = 0.1 / 3600 U/f
本帧冻元素削减 = 当前递增后速率 / (1 - freezeResistance)
```

因此无冻结抗性的 `1.6U` 冻元素在触发后第 176 帧边界清零。冻结刷新取当前有效耐久与新生成耐久的较强值，不重置已经升高的衰减速率；冻元素消失后速率每帧以两倍增量回落到初始值。`freezeResistance = 1` 时仍发生冻结事件并消耗冰/水，但不生成冻元素。

火命中冻元素按正向融化处理，冻元素与同时存在的普通冰 Aura 都按 `2U` 消耗系数减少；冻元素会阻止水底蒸发。雷命中冻元素走冻结底超导：先消耗普通冰，再用余量消耗冻元素；冻元素也会阻止普通冰底超导和新感电。每次生成、刷新、免疫、消耗及失效都写入 `frozenStateLog`，网页以独立状态表和 Aura 曲线的精确到期节点展示。

这部分交叉核对固定提交的 `pkg/reactable/freeze.go`、`pkg/reactable/melt.go`、`pkg/reactable/vaporize.go`、`pkg/reactable/superconduct.go` 和 `pkg/reactable/reactable.go`。当前实现冻元素耐久、冻结底反应与下述碎冰子集；仍没有敌人定身/动画状态、冻结气泡破裂、Hitlag 或敌人冻结抗性数据库。`aura-v5` 另固定冰来袭 `超导 → 融化 → 冻结`：水雷共存可得到 `超导 → 冻结`，水雷火共存且冰量足够时可得到 `超导 → 反向融化 → 冻结`。这不代表其他单次来袭元素的所有多反应排列均已完成。

#### 6.1.4 钝击削冻与碎冰

命中 Schema 只暴露当前确实影响机制的 `strikeType: "default" | "blunt"`；其他 gcsim 打击分类尚未进入公共契约。`poiseDamage` 只能随钝击出现且必须非负。对已有冻元素的目标，命中内部按固定顺序执行：

```text
钝击削冻 = min(当前冻元素, 0.15 × poiseDamage / 25)
若削冻后冻元素为 0：不触发碎冰
若仍有冻元素，且命中为钝击或岩元素：
  碎冰消耗 = min(剩余冻元素, 200 / 25) = min(剩余冻元素, 8U)
  碎冰伤害 = 等级基准 × 3.0 × (1 + 精通加成 + 反应增伤) × 物理抗性区
```

碎冰是单目标物理独立伤害，不暴击、无视防御、不施加元素、不触发普通命中确认；每个目标有独立 12 帧伤害 GCD。GCD 只阻止独立伤害，碎冰事件和 `8U` 消耗仍发生。岩元素无需声明钝击即可触发；钝击命中则一定先削冻，削减恰好耗尽时不会继续碎冰。超载独立伤害使用固定提交的 `StrikeTypeBlunt + PoiseDMG 90`，因此半径内每个 landed 目标都会独立检查冻结并可产生父链为“普通命中 → 超载 → 碎冰”的逐段伤害。

`shatterReaction` 保留 `NO_FROZEN_AURA`、`FROZEN_DEPLETED_BY_POISE`、`REACTION_DAMAGE_GCD` 三类显式结果；实际两阶段耐久变化分别写入 `frozenStateLog` 的 `poise-consume` / `shatter-consume`，碎冰排队与生成伤害写入 `reactionDamageLog`。网页逐击详情展示完整公式和 GCD，冻结曲线加入两个削减节点。该实现交叉核对固定提交的 `pkg/reactable/freeze.go` 与 `pkg/enemy/attack.go`，但当前 `poiseDamage` 仅服务于冻结消耗，不代表已实现敌人通用韧性条、击退、硬直、重量或冲击；也没有完整技能打击类型/韧性伤害数据库。

#### 6.1.5 扩散消耗、双攻击、传播与二次反应

`aura-v2` 允许带元素量的风命中进入扩散状态机；风不作为可持续 Aura。固定 gcsim 提交的检查顺序为雷、火、水、冰、冻元素，其中雷扩散在水雷共存且仍有风预算时立即递归检查一次水，再回到常规火/水/冰/冻元素顺序。因此同一命中可以产生多个 `SwirlReactionAudit`，甚至对剩余水 Aura 再执行一次被队列 GCD 阻止的水扩散判定；每次 Aura 消耗都真实发生。

以项目公共单位 `25 durability = 1U` 换算：

```text
Aura 实际削减 = min(剩余 Aura, 0.5 × 当前风预算)
风预算消耗 = Aura 实际削减 / 0.5

若风预算未耗尽：
  传播标称元素量 = 0.625 × 风预算消耗 + 0.95U
否则：
  传播标称元素量 = 1.25 × 本次扩散前风预算 + 0.95U
```

所以典型 `1U 风` 命中普通 `1U` 标称 Aura（实际剩余 `0.8U`）时，削减 `0.5U`、耗尽 `1U` 风预算并传播 `2.2U`。`ReactionAudit` 同时保存扩散前后风预算、目标 Aura 前后、实际削减、传播元素量和来源 Aura 类型；冻元素以冰扩散输出，并通过 `frozenReaction` / `frozenStateLog` 记录耐久消耗。

每个目标分别维护火/水/冰/雷四条 6 帧扩散队列 GCD。判定通过后排入两次攻击：

```text
触发帧 + 1：源目标单体，被扩散元素伤害，不附着
触发帧 + 5：以触发帧源目标位置为静态圆心，半径 5，
             排除源目标，对传播帧各目标位置求交，
             被扩散元素伤害 + 标称传播附着
```

两段伤害基础倍率均为 `0.6`；水扩散范围段倍率固定为 `0`，但仍生成逐目标 `DamageEvent`、执行传播附着并进入 Aura/伤害曲线。扩散伤害使用触发角色等级、元素精通与反应增伤，不暴击、无视防御并读取被扩散元素抗性。队列 GCD 只阻止上述两次攻击，不回滚已经发生的 Aura 消耗。

每个范围或自身命中的目标再按固定 `ICDGroupReactionA` 建立 `目标 + 角色 + 扩散元素` 伤害流：30 帧窗口内前两段伤害倍率为 1，第三段及之后为 0；元素附着序列始终允许。因此 `swirlDamageGroup` 会明确区分“伤害被 ReactionA 阻止”和“Aura/二次反应仍处理”。传播攻击先对目标调用 Aura 引擎，再结算扩散伤害：融化/蒸发使用传播攻击拥有者的精通放大该段扩散伤害；超载/超导会排入下一帧独立范围事件；感电可启动/刷新水雷周期流；冻结会生成冻元素。所有后续独立伤害用当前传播 `DamageEvent.id` 作为 `parentDamageEventId`，形成可查询的多层父链。

`reactionDamageLog` 把 `swirl-self` 与 `swirl-propagation` 分开，记录静态圆心、半径、源目标排除、传播元素量、已检查/命中/未解析目标、ReactionA 阻止目标和生成伤害 ID。`auraTimeline` 对传播段使用其实际二次 Aura 反应，而伤害事件本身仍以 `swirlPyro / swirlHydro / swirlCryo / swirlElectro` 标记来源反应。UI 只读取这些结构化结果，不重新计算。

该切片交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `pkg/reactable/swirl.go`、`pkg/reactable/reactable.go`、`pkg/core/attacks/icd_groups.dm.go`、`pkg/target/icd.go` 和命中盒构造。当前没有三维高度、风场吸附/聚怪、物件/召唤物/玩家受击、真实视觉/飞行路径、按来源 Aura overlap 数组、角色特有扩散修正或完整目标系统；这仍不是完整 gcsim 精度。

#### 6.1.6 结晶碎片、显式拾取与护盾状态

`aura-v2` 允许带元素量的岩命中进入结晶状态机；岩不作为可持续 Aura。固定 gcsim 提交按雷→水→冰→火→冻元素检查，第一条实际存在的 Aura 占用该目标所有结晶元素共享的 60 帧 GCD，因此同一岩命中不会双重结晶。GCD 可用时：

```text
Aura 实际削减 = min(剩余 Aura, 0.5 × 当前岩预算)
岩预算消耗 = Aura 实际削减 / 0.5
```

GCD 被阻止时 Aura 和岩预算都不消耗。冻元素生成冰结晶，并把耐久消耗同步写入 `frozenStateLog`。水雷共存中的结晶若移除任一共存 Aura，也会停止对应感电流。

每次成功结晶排入一个非伤害碎片生命周期：

```text
触发帧 + 23：生成碎片；读取该帧目标位置与来源角色等级/精通
触发帧 + 54：最早允许拾取
生成帧 + 900：未拾取碎片到期
全场第 4 个碎片生成：先淘汰最旧的活动碎片
```

碎片位置以生成帧目标圆形碰撞体半径外 `0.5m` 为圆周，使用 `randomSeed + crystallize-shard-position-v1` 的独立确定性随机流取角度。这样不会因加入结晶位置而改变既有粒子离散数量，且相同配置完全复现；但它不声称与 gcsim 的全局 RNG 调用序列逐次相同。目标没有位置时碎片位置记为 `null`，实体仍可由显式拾取命令操作。

合法时间线新增零占用 `pickUpCrystallize { element, atFrame }`，元素可为火/水/冰/雷或 `any`。它按生成顺序检查匹配碎片：太早的碎片写入失败记录并继续检查，第一枚达到最早帧的碎片被拾取；没有匹配项也写入失败记录。该命令有意复刻参考实现 `pick_up_crystallize` 的显式系统函数边界，不虚构距离判定、自动吸附或角色移动拾取。

碎片在生成帧保存来源角色等级和精通。拾取时使用固定 gcsim 等级表（等级截断到 1–100）：

```text
基础护盾 HP = levelTable[level]
精通护盾增益 = 40 / 9 × EM / (1400 + EM)
通用理论吸收 = 基础 HP × (1 + 精通护盾增益)
同元素理论吸收 = 通用理论吸收 × 2.5
岩伤理论吸收 = 通用理论吸收 × 1.5
```

新结晶盾无条件覆盖旧结晶盾，持续 `15.1s = 906f`。核心返回护盾增加/覆盖/到期与阶梯曲线点；UI 只绘制这些点。当前没有敌方对玩家攻击、护盾扣血/破裂、护盾强效 Buff、装备/角色被动回调、碎片受击、角色与碎片距离、真实拾取路径或月结晶，所以曲线表示理论吸收上限，而非完整生存结果。

该切片交叉核对固定提交的 `pkg/reactable/crystallize.go`、`pkg/reactable/reactable.go`、`internal/template/crystallize/shard.go`、`internal/template/crystallize/shield.go`、`pkg/core/player/shield/handler.go` 与 `pkg/core/combat/gadget.go`。所有数据仍属于参考实现交叉核对，不等于官方验证。

#### 6.1.7 aura-v3、来源槽与草雷激化

`aura-v3` 是 opt-in 机制版本；`aura-v1/v2` 的历史 `420 + 6 × nominalU` 普通 Aura 寿命继续保留，避免旧配置和 Golden 被静默改义。v3 按固定 gcsim 提交内部单位换算：

```text
25 durability = 1U
普通 Aura 初始耐久 = 0.8 × 标称元素量
普通 Aura 自然寿命 = 420 + 150 × 标称元素量（帧）
```

因此标称 `1U` 的火/冰/水/雷/草 Aura 都是 `0.8U / 570f`。每条 v3 普通 Aura 保存 `sourceActorId -> remainingGauge` 槽；同来源重挂只补到较强候选，不同来源各自存在，共享由当前最大槽决定的衰减。反应削减会对全部来源槽扣除同一预算，但对外 `auraConsumed.gaugeUnits` 仍表示目标有效 Aura 最大值的实际下降；`sourceMutations` 保存每个来源的前值、消耗与后值。

草雷任一方向按 `1 × 来袭元素量` 消耗另一元素 Aura，实际交互量 `d` 生成激元素候选 `d`。激元素使用相同来源槽和共享衰减：

```text
激元素自然寿命 = 360 + 300 × 候选U（帧）
较弱候选：不覆盖、不刷新代次
等强或更强候选：写入来源槽并刷新共享衰减/到期
```

激元素存在时，雷命中先触发超激化，草命中先触发蔓激化；二者不设置 consuming-reacted 标记，也不消耗激元素，因此同一命中仍可按固定顺序继续检查原激化或当前已实现的其他反应。有序结果保存在 `ReactionAudit.reactions`，例如 `["spread", "quicken"]`。加算值为：

```text
超激化加算基础伤害 = LevelBase × 1.15 × (1 + 5 × EM / (1200 + EM) + 反应增伤)
蔓激化加算基础伤害 = LevelBase × 1.25 × (1 + 5 × EM / (1200 + EM) + 反应增伤)
```

这项基础伤害与技能倍率/普通 flat 相加后，共同进入增伤、防御、抗性、暴击、可能的增幅反应和目标策略。来源角色等级、精通与反应增伤在实际命中帧读取；技能倍率及其他面板仍服从该命中的 action/hit 快照声明。核心返回公式值 `flatDamage`、插件分量契约后的 `appliedFlatDamage` 和最终 `damageComposition.additiveReaction`。扩散传播的雷附着也复用同一流程，能在激元素目标上产生可审计的超激化加算。

激元素到期是优先级 2 的目标状态事件，先于同帧普通命中；旧代次的到期事件用 generation 与期望帧失效，不会清除后续刷新。`quickenStateLog` 和网页曲线显式记录生成、刷新、较弱不覆盖与自然到期。

`aura-v3` 对燃烧、绽放、草原核、超绽放和烈绽放保持历史 fail-closed；`aura-v4` 只把燃烧移出该集合，绽放系仍使用同一边界。`aura-v5` 才启用 6.1.9 的绽放/草原核实现，不会反向改写 v3/v4 回放。旧模式命中满足尚未支持的前提时，核心会：

1. 先记录排序更早且已经支持的 Aura 消耗与同击内联效果；若其独立伤害尚未落地，则在截断边界明确标为 `TARGET_MECHANICS_TRUNCATION`、不得声称已排队；
2. 把未支持分支写入 `unsupportedReactions` 与 `mechanicsTruncation`；
3. 清空并锁定该目标 Aura，避免把任何保留状态继续当作真实燃烧/绽放结果；
4. 保留触发当击的权威直接伤害和已经内联进该段的激化加算；不再排入依赖截断状态的后续独立事件。同帧后序及后续可独立求值的伤害事件保留公式 `potentialDamage`，但标记 `mechanics-truncated`、令 `finalDamage=0`，从总伤和 DPS 排除；依赖未知 Aura 的感电 Tick/削减和旧状态到期事件通过 generation 或截断守卫直接失效。

这是逐目标 fail-closed 截断；其他目标继续独立模拟。跨过边界的结果返回 `mechanicsStatus: "partial"` 与 `targetMechanicsTruncationLog`，网页也会显式警告“结果部分有效”。它不是绽放近似模型。该切片交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `pkg/reactable/catalyze.go`、`reactable.go` 与等级反应表。固定提交自身仍含草原核持续时间 `// ??` 注释和燃烧测试 TODO，所以 v3/v4 与下述 v5 都只声称固定代码路径交叉校验，不声称官方数值验证或完整 gcsim 精度。

#### 6.1.8 aura-v4/v5 Burning Marker、Fuel 与周期 Tick

`aura-v4` 是首个启用燃烧的 opt-in 机制版本，`aura-v5` 继承其兼容语义；v1–v3 与 `legacy-v0.1` 的配置/Golden 不被静默改写。启动条件按固定提交的反应顺序执行：

- 火命中可对普通草 Aura 或激元素启动燃烧。
- 草命中可对普通火 Aura 或既有 Burning Marker 启动/刷新燃烧。
- 首次 Fuel 候选取现有普通草、激元素和剩余来袭草量 `×0.8` 中的最大值；草刷新会无条件用剩余来袭草量 `×0.8` 覆盖 Fuel，即使候选更弱。火刷新不增加 Fuel。
- 火/草命中在触发燃烧后仍按固定路径正常尝试自身附着；燃烧本身不会把整个命中标记为已经消费完毕。

每个目标保存不自然衰减的 `2U` Burning Marker、独立 Fuel、代次、Fuel/伤害来源、后续 Tick 的实时面板快照和节奏。Fuel 基础衰减为：

```text
Fuel decay = 0.4 / 60 U/f
燃烧期间 Quicken decay = Fuel decay
燃烧期间普通 Dendro decay = max(Fuel decay, 2 × 普通原生衰减)
```

Fuel 自然耗尽事件在同帧命中之前处理；有效代次耗尽时移除 Fuel、Marker、普通草 Aura 和激元素。旧代次到期事件通过 generation 与期望到期帧失效。Marker 被蒸发、融化、超载、火扩散或火结晶消耗时，燃烧流立即停止并移除 Fuel，但保留当时剩余的普通草 Aura/激元素。该差异通过 `stopReason: "BURNING_AURA_CONSUMED"` 审计。

周期调度为：

```text
first tick = start frame + 15
tick interval = 15f
skip tick index = 9
damage = 0.25 × LevelBase × (1 + 16 × EM / (2000 + EM) + reactionBonus)
final damage = damage × Pyro resistance factor
radius = 1
application = 1U Pyro
```

燃烧伤害不进入普通防御乘区，也不使用普通暴击。第 9 个槽只记录 `tick-skipped`，之后索引 10 继续，不改变 15 帧节奏。每个实际 Tick 的伤害拥有独立 `DamageEvent`、来源角色、父链和 `damageComposition.transformativeReaction`，并进入 `cumulativeByReaction.burning`；UI 只能读取这些核心结果。

Tick 的 `1U` 火附着使用内置 `burning` Profile：目标局部、队伍全局，120 帧重置，序列为 `[允许, 阻止, 阻止, 阻止, 阻止, 阻止, 阻止, 阻止]`。伤害始终结算，ICD 只决定该 Tick 是否继续施加火附着。草/火刷新不重置 Tick 节奏；最近一次触发者成为未来 Tick 的归属和实时面板来源，但已经开始处理的 Tick 仍使用该 Tick 进入队列时保存的来源/快照。

该内置序列不会循环：同一 120 帧窗口若因多个邻近燃烧源收到第 9 次及以后附着，索引会继续增长但判定钳制在最后一个 `false`，直到窗口重置。Dendro 按 `Spread → Quicken → Burning → Bloom` 顺序先扣除 Quicken 使用的来袭草量，Burning 只读取剩余量；完全耗尽时不生成幽灵 Marker/Fuel。

`ReactionAudit.burningReaction` 记录启动、Fuel 覆盖、快照刷新、停止或目标截断；`burningStateLog` 记录状态事件的 frame、priority、sequence、Fuel/Marker 前后、到期帧、Tick 索引、伤害/父事件 ID、附着 ICD 和限制标记。网页将其绘制为 Burning Marker/Fuel 曲线、燃烧状态表和独立累计伤害曲线，并允许回链到逐击事件。

当前时钟只实现确定性的目标局部帧序，固定标记：

```text
clockModel = target-local-no-hitlag
hitlagStatus = unsupported-enemy-hitlag
selfDamageStatus = unsupported-player-damage-model
```

固定 gcsim 路径会让敌人 Hitlag 暂停目标任务/Fuel，并在每个 Burning Tick 对玩家排入自伤；本项目尚无敌人 Hitlag 暂停和玩家 HP/受击模型，因此不生成虚假的自伤 0 值事件。角色专属 `OnBurning` hook-before-snapshot 与纳西妲 C2 对燃烧等转化反应的特殊暴击也没有进入当前事件阶段。

实现语义交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 Burning/Reactable/目标任务代码路径。当前 `aura-v4/v5` 有意保留 1.30 的 `F+121` Fuel 清理和“同帧普通命中先于 Tick”相位；固定参考敌方任务路径是 `F+120` 最后 Tick、Fuel 清理、再处理普通命中。这是版本化兼容差异，不应改写为“等价”。固定源码自身还有 Burning 测试 TODO，且本项目尚缺上述机制；因此只能称固定代码路径兼容切片，不是官方/官服真值，也不是完整 gcsim 精度。

#### 6.1.9 aura-v5 绽放、草原核、烈绽放与超绽放

`aura-v5` 在不改写 v1–v4 的前提下加入严格 Bloom gauge resolver。水草双向，以及固定顺序下燃烧/激元素与水草相交的分支，都会输出包含输入槽、实际消耗、剩余量、来源 mutation 和核心生成计划的 `BloomReactionAudit`；全零交互和不符合槽公式的伪审计会被 Schema 拒绝。`pendingHydroBloomFollowup` 仅是保留的固定参考兼容标记，实际执行以 `bloomReactions` 和后续草原核日志为准。

成功反应在触发后 30 帧生成草原核：

```text
spawnFrame = reactionFrame + 30
expiryFrame = spawnFrame + 300             // provisional
global core cap = 5
natural Bloom damageFrame = expiryFrame + 1
Burgeon damageFrame = Pyro contactFrame + 1
Hyperbloom damageFrame = Electro contactFrame + 60
```

核心 ID 在预约时确定且永不复用；位置由独立固定种子流产生，来源角色、伤害归属、触发反应和父事件 ID 随生命周期保存。生成第 6 个核心时先淘汰最旧者并按自然绽放结算。无效 RNG 会在任何状态变更前失败；已到期、消费或淘汰的 reservation ID 不能重放。核心管理器的这些不变量与 1,024 个 gauge 组合矩阵均有独立测试。

自然绽放和烈绽放以核心位置为圆心、二维半径 5 求交，基础倍率分别为 `2` 和 `3`；超绽放在 15m 内选择最近目标，60 帧后以目标为中心按半径 1、倍率 `3` 求交。没有合法目标时，超绽放仍消费核心并记录零伤害结果，不伪造命中。普通命中和 Burning/其他反应伤害都可以按元素、几何与同一逻辑 `hitGroupId` 接触核心；同一命中组对同一批核心只处理一次，即使敌方命中判为 miss，也不自动否定几何上真实发生的核心接触。

草原核伤害在实际爆炸帧读取来源角色当时的 EM 和反应增伤，不普通暴击、忽略防御，再进入对应元素抗性和目标策略。绽放、烈绽放、超绽放与碎冰/超导共用 ReactionA：按 `目标 + 角色 + 反应` 隔离，在半开 30 帧窗口只让前两次造成伤害；第三次仍生成零伤害 DamageEvent 和阻止审计。生命周期、接触、ReactionA、`reactionDamageLog`、DamageEvent 和 `HitResolution` 通过 `dendroCoreResultReferencesSchema` 做双向 ID/连续性检查。

Bloom resolver 还保留了 Fuel 部分/完全消耗和后续调度投影，以便固定参考语义可审计；但在当前公开合法命中流水线中，水会先蒸发并移除 Burning Marker/Fuel，草路径也不会以 Bloom 消耗 Fuel，所以该分支没有可从公共配置到达的合法初态。不得为了覆盖它而构造非法 Fuel 或声称当前实战路径已经验证。

当前 `300f` 核心寿命来自固定参考源码中带 `// ??` 的常量，仍为 `provisional`。本切片也没有玩家 HP/受击与绽放系自伤、丰穰之核、卡维强制迸发、角色/命座特殊修正、真实三维位置/追踪弹道或 Lunar 反应；因此不是完整 gcsim 或官服反应系统。

### 6.2 粒子 / 能量事件

`packages/sim-core/src/energy.ts` 提供无 DOM 依赖的确定性随机数和纯粒子能量计算。当前基础口径与所参考的 gcsim 能量实现保持同一组规则：

- 同色、无色、异色的单个基础能量分别为 `3 / 2 / 1`。
- 晶球是微粒的 `3` 倍。
- 前台倍率为 `1`；后台倍率为 `1 - 0.1 × 队伍人数`。
- 上述结果再乘接收角色命中帧的元素充能效率。
- 角色能量不得超过上限，未实际加入的部分写入 `wastedEnergy`。

离散数量范围由 `randomSeed` 驱动。随机算法是引擎版本契约的一部分，变更算法必须升级 `engineVersion`。粒子先产生 `particleSpawn`，再按飞行时间产生 `particleReceive`；前后台身份只在接收事件执行时读取。一次接收向全队逐角色分配，并记录：

```ts
spawnFrame
receiveFrame
particleElement
particleKind
particleCount
receiverId
isOnField
isSameElement
energyRecharge
rawEnergy
finalEnergy
gainedEnergy
wastedEnergy
energyAfter
```

固定回能不会套用粒子倍率或元素充能效率，并在同一日志中以 `kind: "fixed"` 明确区分。可选的 `internalCooldown { key, durationFrames }` 按“来源角色 + key”建立共享流：第一次事件在处理帧立即设置下一可用帧，`frame < readyFrame` 的后续事件被阻止，恰好位于 `readyFrame` 的事件重新允许。无论通过还是阻止都进入 `energyLog`；阻止事件同时写入不改变数值的 `fixed-blocked` 能量曲线点。

粒子既可在声明帧直接生成，也可通过 `trigger: { kind: "hit-confirm", hitIds, internalCooldown }` 绑定一组命中。显式 fanout、圆形、旋转矩形、胶囊或填充扇形几何产生的所有目标先分别完成 Miss、阶段、伤害、Aura 和回调判定，再以同一 `hitGroupId` 聚合；只要至少一个目标允许命中回调，该逻辑命中只执行一次产球检查。`particleTriggerLog` 保存全部检查目标和确认目标，粒子 ICD 也只启动一次。当前几何读取静态施放者姿态和该次命中帧的声明式线性目标位置，不模拟高度、角色移动/转向、追踪弹道、粒子飞行碰撞或真实 Boss AI；UI 不重新计算触发条件。

### 6.3 Ability Blueprint 与部分机制闸门

`packages/schemas/src/mechanics.ts` 定义版本化的 `AbilityBlueprint` 1.7 契约，并能把 1.0 / 1.1 / 1.2 / 1.3 / 1.4 / 1.5 / 1.6 输入迁移后再编译。每个技能映射必须包含：

- 数据版本、映射版本和角色/技能 ID。
- 每段命中帧、倍率参数引用、缩放属性、元素、快照和附着流。
- 固定回能、粒子与行动状态定义。
- 前置条件、尚未实现机制和逐项来源证据。
- `verificationStatus` 与 `simulationStatus: "partial" | "mechanics-mapped"`。

`packages/mechanics/src/compiler.ts` 按 `talentSetId / abilityKey / parameterKey / talentLevel` 从固定目录解析倍率。错误引用返回精确路径；`partial` 默认拒绝，审计测试必须显式 `allowPartial: true`。只有无未解决项的 Blueprint 才能标记 `mechanics-mapped`。

首批向量是杜林黑/白 E：

- 倍率来源：`genshin-db@5.2.12` 固定目录的技能 10 级参数。
- 行为交叉校验：gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `skill.go`、`icd_groups.dm.go` 与 `pkg/core/info/combat.go`。
- 黑分支覆盖：精质转变 6 秒状态授予/前置/消耗、30 秒黑状态进入、普攻/重击/战技/爆发/冲刺/跳跃/切人取消路径、三段命中、DurinSkill ICD、带角色级 360 帧共享内部冷却的 33 固定回能，以及首个已处理命中触发、18 帧共享粒子 ICD 的 4 火粒子。固定 gcsim 提交给出的首段 E 冲刺/跳跃取消均为 14 帧，黑 E 为 42/41 帧；重击复用其 `ActionAttack` 取消点是本引擎的分类映射推断。
- 白分支覆盖：技能 10 级 `1.9008` 倍率、35 帧命中、83 帧动画、相同回能/产球规则、30 秒白状态，以及通过 `clears` 与既有黑状态互斥；审计预设中的全局命中帧为 50。锁定 gcsim 提交未设置 `AttackInfo.Durability`，而其核心把 `0` 定义为不施加 Aura，因此本向量输出火伤但不施加附着、不触发反应；该口径仍保持 `provisional`，等待官方资料或官服实测交叉验证。
- 保持 `provisional + partial`：冲刺/跳跃物理、该技能实际 AoE 形状/尺寸/旋转/方向/位置、实战目标移动轨迹、真实 Boss 状态机、Hitlag、黑/白爆发及全部被动尚未实现；通用圆形/旋转矩形/胶囊/填充扇形求交与声明式线性移动只验证引擎路径，不代表杜林真实范围或敌人运动已经核验。

## 7. 测试策略

Vitest 当前覆盖：

- 裸伤与完整因子。
- 防御区与 100% 防御无视边界。
- 负抗、0%、75% 和高抗分段。
- 平均/全暴击/无暴击。
- 正向与反向增幅反应。
- 同帧状态和命中排序。
- 状态结束边界。
- 行动快照与命中动态结算。
- 能量刚好足够和能量不足整行动取消。
- 合法时间线能量失败后的冷却、状态、命中、粒子和后续命令帧回滚。
- 同时间命中稳定排序。
- 具名目标注册、目标级属性覆盖、未注册目标拒绝、逐目标 landed / miss、独立 Aura/ICD、伤害免疫双值审计、命中回调阻断，以及被阻断事件不启动粒子 ICD。
- 圆形几何 Schema、目标位置完整性、脚本/几何互斥、中心/精确边界/范围外求交、距离与阈值日志，以及几何扇出仍只执行一次命中产球回调。
- 旋转矩形 Schema、局部坐标变换、矩形内部、长短边、圆形碰撞体与角点接触、刚好范围外，以及形状参数逐击审计。
- 胶囊 Schema、有限线段投影、侧边/端帽边界、目标碰撞体接触、零长度退化、范围外和端点逐击审计。
- 填充扇形 Schema、扇形内部、圆弧/径向边界、圆形碰撞体对径向边与弧端角点的擦碰、范围外、方向/夹角日志和 360° 圆盘退化。
- 静态角色姿态 Schema、角色引用/重复校验、缺少姿态的局部几何拒绝，以及圆、矩形、胶囊、扇形的施放者局部到世界坐标变换与逐击审计。
- 目标移动分段的注册/初始位置/排序/重叠/时长校验、整数帧线性插值、相邻边界、分段间保持、移动后圆形命中与确定性复现。
- 有序不重叠的目标阶段 Schema、半开边界、相邻阶段切换、活动阶段来源日志和逐击覆盖优先级。
- 120 秒末端截断语义。
- 相同配置、Schema/引擎/数据版本、解析后运行选项、随机种子和有序插件身份的可复现性；配置哈希、插件顺序/内容哈希、重复插件 ID 拒绝、状态型插件实例隔离和 `runManifest` 运行时 Schema。
- 默认 120 秒 Golden Fixture、1.30 Burning Golden，以及覆盖 14 个基础反应/状态/草原核向量和严格结构投影的 1.31 Golden。
- 整数帧行动、切人、命中追踪、显式冲刺/跳跃占用、按后续普攻/重击/战技/爆发/冲刺/跳跃/切人选择取消帧、未声明路径回退与动画结束帧。
- 严格模式冷却拒绝和等待模式冷却调整。
- 多充能次数、行动重叠与错误前台角色。
- 行动状态的角色归属、授予、消耗、刷新、精确到期边界、缺少前置拒绝和冷却等待后重新检查。
- 行动状态的无前置清除、缺失状态空操作，以及杜林黑白分支互斥。
- v1/v2 的历史 `1U -> 0.8U / 426f` 回放，以及 v3 火/冰/水/雷/草 `1U -> 0.8U / 570f` 固定耐久换算。
- 默认 ICD 第 1/2/3/4 次附着、150 帧重置、独立角色/Tag/Group 和 No ICD。
- 自定义 ICD Profile、禁止覆盖内置组、未知组失败和 DurinSkill 18 帧序列。
- 正/反融化与正/反蒸发的反应方向和 Aura 消耗。
- 四个增幅方向都由来源角色的 action-snapshot EM 与 hit-time reactionBonus 驱动；代理施放者、`scalingOwnerId`、`creditOwnerId` 和确定性复现互不混淆。
- 无 Aura 不触发融化，以及正式 Aura 配置拒绝手工反应标签。
- Aura 结果接入伤害乘区和 `auraTimeline`。
- 扩散的固定雷→递归水→火→水→冰→冻元素顺序、完整/部分风预算消耗分支、典型 `2.2U` 传播、冻元素冰扩散和分元素 6 帧队列 GCD。
- 扩散 1f 自身/5f 范围传播、半径 5、源目标排除、传播帧目标位置、零伤害水传播、ReactionA 30 帧前两段伤害和“伤害阻止但附着继续”。
- 扩散传播触发融化/蒸发放大，以及“风命中 → 扩散传播 → 超载”多层父伤害事件、逐目标 Aura 日志和累计伤害曲线。
- 结晶雷→水→冰→火→冻元素优先级、共享 60 帧 GCD、`0.5` Aura 消耗、冻元素冰结晶和 GCD 阻止时不消耗。
- 结晶 23 帧生成、54 帧最早拾取、900 帧碎片寿命、三碎片上限、固定种子位置、无匹配/过早拾取和显式拾取命令。
- 结晶盾等级/精通生成帧快照、固定等级表、通用/同元素/岩伤吸收量、覆盖旧盾、906 帧到期和过期事件去重。
- 草雷双向生成 `0.8U / 600f` 激元素、来源槽、较弱候选不覆盖、刷新旧代次失效、到期帧先于命中，以及多目标状态隔离。
- 超激化/蔓激化零激元素消耗、`1.15/1.25` 加算公式、命中帧实时精通、同击 `spread -> quicken` 顺序、扩散雷传播触发超激化、插件上下文与最终构成守恒。
- v3 燃烧/绽放与 v4 绽放前提的结构化 unsupported 审计、目标级 Aura 丢弃/锁定、触发当击保留、后续潜在伤害排除和多目标截断隔离；v5 不反向改变这些历史模式。
- v4 燃烧启动/火草刷新、Marker/Fuel 来源、Fuel 覆盖与逐帧边界、15 帧周期、第 9 Tick 固定跳过、自然到期、Marker 被反应消费停止和旧代次事件失效。
- v4 燃烧 `0.25` 等级/精通/增伤/火抗公式、半径 1 扇出、逐击伤害父链、实时面板归属刷新、120 帧 `[允许, 阻止 × 7]` 火附着 ICD，以及 `target-local-no-hitlag` / 玩家自伤未支持标记。
- v5 Bloom gauge 1,024 组合不变量、水草双向交互、冰来袭 `超导 → 融化 → 冻结` 有序链、Burning/Quicken 边界和 stale-expiry 代次。
- 草原核 30 帧生成、provisional `300f` 寿命、稳定且不可重放的 ID、独立种子位置、五核心上限/最旧淘汰、自然绽放、火/雷接触、同 hit-group 去重和 expiry-before-hit 边界。
- 烈绽放 1 帧延迟/半径 5、超绽放 60 帧延迟/15m 最近目标/半径 1、无目标消费、爆炸帧实时 EM/反应增伤、ReactionA 前二/30 帧，以及生命周期/接触/时间线/反应伤害/逐击父链的严格引用一致性。
- 通用 ReactionA 对碎冰、超导和绽放系的前二/30 帧规则，以及 ReactionB 对超载、感电的首一/30 帧规则；被阻止尝试仍生成零伤害事件和审计。
- 同/异/无色微粒、晶球、前后台、队伍人数和元素充能效率倍率。
- 离散产球范围在相同随机种子下完全复现。
- 粒子到达前切人，按到达帧前台身份向全队分配。
- 固定回能与粒子回能拆分、能量溢出、模拟结束后才到达的粒子。
- 固定回能内部冷却的同帧顺序、角色隔离、阻止日志和精确到期边界。
- 命中产球的逐击绑定、角色级粒子内部冷却、阻止日志和精确到期边界。
- 粒子支持后续爆发，能量不足行动不会错误产球。
- 完整目录 Zod 校验、固定数量、固定输入哈希和逐字节再生检查。
- 每条角色/天赋/技能/武器的来源字段与 `metadata-only` 闸门。
- 首批五名角色的 ID、中文名、发布补丁和 provisional 状态。
- 杜林 15 级倍率数组与武器 1–5 精炼值的精确抽样。
- Ability Blueprint 的部分机制默认拒绝、来源参数路径解析和错误路径。
- 杜林精质转变前置/消耗/黑状态日志，以及黑 E 三段倍率、48/53/58 全局命中帧、首段融化、附着 ICD、逐击整数值、伤害曲线、33 固定回能、首段命中产 4 火粒子与后两段粒子 ICD 阻止。
- 杜林白 E 的 1.9008 倍率、50 全局命中帧、无附着/无反应与既有冰 Aura 保留、逐击整数值、33 固定回能、命中产 4 火粒子、白状态进入及从黑状态切换时的清除日志。
- UID 角色、武器、技能、天赋额外等级以及旅行者元素变体映射。
- 未知角色/武器/技能 ID 的完整诊断，不静默猜测。
- 120 秒兼容模拟、带运行时能量前缀探测的 120 秒合法时间线，以及含 479 次 Tick/119 次 Fuel 刷新的持续 Burning 流性能门；每项预热后运行 20 次，并要求最大值 `<100ms`。这是当前桌面回归门，不是跨设备 SLA。

Playwright 覆盖预设切换、JSON 导入、运行、总览数字、时间轴、逐击累计与三类伤害构成曲线、具名多目标属性与逐目标 Aura/ICD 隔离、显式 AoE 扇出、圆形/旋转矩形/胶囊/填充扇形几何的内部/边界/范围外判定、静态施放者局部到世界坐标变换、目标线性移动插值及跨目标一次产球聚合、目标/Aura 筛选、目标命中判定表、脚本化 Miss、三层目标策略、按帧阶段、敌方 Aura 曲线、扩散自身/传播/二次反应与父链、结晶碎片/拾取/护盾状态、草雷激化、燃烧、能量曲线、公式展开、杜林黑/白 E 审计向量及 UID 展示柜边界。1.31 绽放系伤害已进入现有逐击、技能、时间轴和累计/构成曲线；专用草原核生命周期/接触面板尚未添加，本轮展示扩展后置。

## 8. 展示柜导入边界

`apps/web/vite.config.ts` 提供开发/预览期服务端代理：

```text
GET /api/showcase/:uid -> https://enka.network/api/uid/:uid/
```

代理设置自定义 `User-Agent`，检查 UID，处理上游状态码，并按 `ttl` 做内存缓存。浏览器收到的数据先通过 `enkaShowcaseResponseSchema` 校验，再由 `packages/game-data` 规范化为：

- 玩家等级和世界等级。
- 公开角色 ID、等级、命座与技能等级。
- `fightPropMap` 的关键面板和元素伤害加成。
- 武器 ID、等级、精炼和面板。
- 圣遗物槽位、套装 ID、等级、主副词条。

规范化结果随后通过固定轻量索引补充：

- `avatarId` 对应的中文角色名、元素、武器类型和稀有度。
- 武器 `itemId` 对应的中文名称。
- Enka `skillLevelMap` 对应的普通攻击、元素战技和元素爆发名称。
- `proudSkillExtraLevelMap` 对应的额外天赋等级和有效等级。
- 角色、武器和技能的逐项匹配诊断。
- 旅行者按实际技能 ID 集合选择火/水/风/岩/雷/草/冰元素天赋变体。

展示柜数据与 `SimConfig` 故意分离：目录中的身份和倍率信息不等于可执行的帧、ICD、Aura、粒子、快照和特殊机制，不能仅凭玩家面板生成可信轮转。完整目录记录当前仍全部为 `metadata-only`；杜林黑/白 E 的独立 Ability Blueprint 也只到 `partial`，不能把整名角色视为已映射。所谓“毕业站位”同样只创建 `graduation-target-placeholder`，在目标标准核验前禁止模拟。

纯静态部署没有 Vite 中间件，必须把代理迁移为受控服务端函数，并继续遵守上游 TTL 和限流要求。

## 9. 版本化游戏数据目录

`packages/schemas/src/catalog.ts` 定义：

- `GameDataCatalog`：完整角色、天赋、15 级参数数组、武器和精炼数据。
- `GameDataRuntimeIndex`：网页只读 UID 映射所需的轻量身份索引。
- `GameDataProvenance`：`patch`、`source`、`sourceVersion`、`verifiedAt`、`verificationStatus` 和 `notes`。
- `simulationStatus`：`metadata-only | partial | mechanics-mapped`。
- `migrateGameDataCatalog()`：拒绝缺版本或未来版本，防止静默接受上游破坏性字段变化。

生成输入固定为：

```text
genshin-db npm 5.2.12
repository commit 1bab2cdba4d218fd5caa46b5f54e7884ee8359a2
Enka API-docs commit 2b9d23b334306f5845551ae7571d1165cdf096e5
catalog schema 1.0.0
game patch 6.7
```

`npm run data:generate` 同时生成完整目录和轻量索引；`npm run data:check` 从固定 npm 内容和提交的 Enka 数字 ID 快照重新生成内存结果并逐字节比较。完整目录当前含 120 个角色、125 套天赋、762 个技能/被动和 237 把武器。Enka 的 148 条映射只保留互操作数字关系；其审计仓库没有可识别许可证，因此没有复制文字或图片资产。

目录全部标记为 `provisional + metadata-only`。即使倍率数组存在，也不能跳过动作帧、命中拆段、元素附着、ICD、快照、产球、状态机和专属机制插件而直接编译为正式伤害事件。

## 10. Milestone 3–5 当前边界

Milestone 2 的结构能力已经落地，但除已单独引用的杜林取消点外，内置行动帧仍是 provisional 示例，不代表游戏实测。能量不足现在会通过确定性前缀探测进入 `skippedActions` 和 `timelineExecution.failures`，失败行动不预占冷却或状态，后续命令会重排；重击、冲刺与跳跃已经进入命令语言，冲刺/跳跃只使用显式占用帧。条件语句、目标命中分支和目标驱动取消仍未进入命令语言。

Milestone 3 已落地火/冰/水/雷/草普通 Aura、可扩展元素量、衰减、默认/No ICD、自定义 ICD Profile、融化/蒸发、超载/超导/感电/冻结/碎冰，火/水/冰/雷扩散、范围传播、ReactionA/B、传播后二次反应、结晶碎片/显式拾取/护盾状态、原激化/超激化/蔓激化、`aura-v4/v5` Burning Marker/Fuel/Tick，以及 `aura-v5` 绽放/草原核/烈绽放/超绽放纵向切片。逐击审计、父链、来源槽、目标/草原核时间线、严格交叉引用、每段累计伤害及构成曲线和结晶盾阶梯曲线均进入结构化结果与测试范围；目标 Aura 曲线只读取核心的版本化 `targetStateTimeline`，不再由 UI 推断同帧状态顺序。冻结的杜林兼容预设仍保留手工反应以维持 Golden；新增黑/白 E 只是独立审计向量，不能用它们替换 120 秒兼容预设后声称机制等价。

Milestone 4 已完成核心第一批闭环：版本化粒子 Schema、固定种子随机数量、固定帧或逐击命中触发、角色级粒子内部冷却、生成/到达事件、接收时前后台、同/异/无色、晶球、充能效率、溢出、固定回能拆分、逐次日志和能量曲线。具名多目标、逐目标 landed / miss、独立 Aura/ICD、三层目标效果策略、按帧阶段窗口、显式/圆形/旋转矩形/胶囊/填充扇形扇出、声明式线性目标移动和一次回调聚合已成为伤害和命中产球的共同门；内置 M4 预设仍只用于机制验收，其面板、帧数和产球范围是 provisional。尚未完成 120 秒、来源核验的杜林首轮启动/循环预设，也没有敌人掉球、粒子几何飞行轨迹、真实 Boss AI 或真实技能产球数据库。

Milestone 5 已完成数据层基础和首批部分机制编译闭环，不等于正式杜林预设完成。杜林黑/白 E 已有倍率引用、裸伤/增伤、动作帧、黑 E 附着/ICD、白 E 无附着口径、回能、粒子和互斥状态向量，但仍有明确未解决项；尼可、洛恩、茜特菈莉、希诺宁以及其余角色/武器仍需逐技能机制插件与交叉验证。全角色/全武器技能数值的可查询目录也不等于完整的特有 ICD、动作帧、粒子、快照和机制可执行库；展示柜 UID 映射尚未形成通用 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig`，不得把测试 UID 的单次映射成功外推为全 UID 支持。

下一阶段按以下顺序推进，且每项都要保留现有兼容 Golden、14 向量反应矩阵和运行身份：

1. 为目标事件队列加入敌人 Hitlag 时钟暂停，证明普通 Aura、Fuel、Tick、草原核和到期任务在暂停/恢复边界与固定参考路径一致；同时建立玩家受击/HP 最小模型，再接 Burning 与绽放系玩家自伤。完成前继续保留 `unsupported-enemy-hitlag` / `unsupported-player-damage-model`，并保留现有 F+121 兼容模式。
2. 扩展 `aura-v5` 的来源 overlap 与未覆盖多反应排列，以新 Golden 锁定每个新增顺序；随后才实现 Lunar 反应族。不得把现有冰来袭链或 14 向量矩阵外推为全反应覆盖。
3. 在快照阶段前建立可测试的 `OnBurning` 角色回调点，并以独立机制插件实现纳西妲 C2 的转化反应特殊暴击；未完成前继续输出明确限制，不向通用燃烧公式硬编码角色例外。
4. 建立覆盖全部 `SimulationResult` 字段的版本化顶层 Zod Schema；同时为任意代码插件增加可选的构建产物/源码摘要验证，减少只信任自报 descriptor/contentHash 的边界。
5. 把完整角色/武器目录逐项推进到 `mechanics-mapped`：补齐技能命中拆段、倍率来源、ICD、动作/取消帧、快照、产球、命座、专武和圣遗物效果，并为每个正式条目提供测试向量。
6. 建立版本化 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig` 管线，以 `skillDepotId` 优先消除旅行者/变体歧义，加入圣遗物目录与效果闸门，并用多个固定展示柜 Fixture 验证 UID 数据缺失/变更路径；“毕业站位”在标准核验前继续保持不可模拟占位。
7. 在当前静态角色姿态、四类局部几何和目标线性移动模型上增加角色移动/转向命令、追踪/索敌语义和命令/AI 驱动的敌方位置更新，再建立有来源的具体 Boss 状态机。
8. 映射杜林黑/白 Q，逐项补齐命座、专武和圣遗物效果后，才能组合 120 秒、0 初始能量、合法帧的来源核验预设；当前默认杜林预设中的示例魔法数继续保持 `provisional`。
9. 核心稳定后再增加专用草原核生命周期/接触、敌方附着和反应构成展示；UI 只能消费核心结构化结果，不得自行补算伤害或事件顺序。
