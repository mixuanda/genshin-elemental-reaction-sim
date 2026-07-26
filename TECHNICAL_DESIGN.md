# 技术设计：提瓦特伤害实验室

## 1. 当前目标

Vanilla v0.1 结果继续由兼容模式和 Golden Fixture 冻结。正式路径已经加入 60 FPS 合法帧时间线、角色无关的行动状态机、火/冰/水 Aura、声明式 ICD Profile、自动融化/蒸发、可复现粒子/能量事件、逐击命中产球及其内部冷却审计，以及来源可追溯的杜林黑/白 E 部分机制向量；仍不声称拥有完整游戏机制精度。

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
  从冻结 v0.1 采集的 Golden Fixture。
```

依赖方向：

```text
schemas <- game-data
schemas <- sim-core
schemas + sim-core + game-data <- mechanics
sim-core + schemas + game-data + mechanics/durin-audit <- apps/web
```

完整目录通过 `@genshin-dps-lab/game-data/catalog` 子路径显式导入；包根只导出轻量运行时索引、预设和展示柜适配器。网页从 `@genshin-dps-lab/mechanics/durin-audit` 读取由测试锁定的紧凑运行时投影，不在浏览器重新解析完整倍率目录。当前生产入口为 318.62 kB（gzip 80.63 kB）。

## 3. 配置契约

每个输入必须包含：

```ts
schemaVersion
engineVersion
dataVersion
randomSeed
```

`migrateConfig()` 负责把无版本、`0.1.0`、`1.0.0`、`1.1.0`、`1.2.0`、`1.3.0`、`1.4.0`、`1.5.0`、`1.6.0`、`1.7.0`、`1.8.0`、`1.9.0`、`1.10.0`、`1.11.0`、`1.12.0` 或 `1.13.0` 配置迁移到 `1.14.0`。迁移后由严格 Zod Schema 校验；未知字段、重复 ID、未知角色引用、未注册敌方目标、未知粒子触发命中 ID、缺失 Miss/目标策略原因、空操作目标策略、同目标重复/重叠/越界阶段、超过四人的队伍和越界数值在模拟前失败，并返回字段路径。`engineVersion` 当前为 `1.14.0-multi-target-registry`。

## 4. 确定性与排序

相同时间的事件排序为：

1. `action`
2. `buff` / `debuff`
3. `energy` / `particleSpawn` / `particleReceive`
4. `hit`
5. 同类型同时间按插入序号

状态在 `end <= hitTime` 时先过期，因此恰好处于结束边界的命中不享受该状态。该规则由测试固定。

因此同帧行动会先检查/消耗能量，随后才接收该帧到达的粒子；同帧先产生的充能效率 Buff 则会在粒子接收前生效。这两个子阶段语义均有专门测试，后续若要与新实测帧规则对齐，必须作为引擎版本变更处理。

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
finalDamage
displayDamage
```

`finalDamage` 是用于 Golden、聚合与后续计算的浮点原始值；`displayDamage` 使用 `Math.round(finalDamage)`，与 gcsim Sample 页的整数展示口径一致。二者并存，避免 UI 隐式改变模拟结果。

`reactionAudit` 包含 `icdAllowed`、`icdTag`、`icdGroup`、`applicationGaugeUnits`、`auraBefore`、`auraApplied`、`auraConsumed` 和 `auraAfter`。兼容引擎不具备 Aura/ICD 推演能力，所以这些字段必须为 `null`，手工反应标记为 `manual-override`；不得用空数组伪装为“敌人无附着”。`aura-v1` 下数组表示核心实际判定的空/非空状态。

核心同时返回：

- `enemyTargets`：应用共享敌人默认值后的具名目标等级、抗性和减防。
- `characterSummaries`：伤害、命中、DPS、占比。
- `targetSummaries`：逐目标实际/潜在伤害、结算段数、landed/Miss、免疫段数、DPS 和占比。
- `bySkill`：伤害、命中、DPS、占比。
- `perSecond`：逐秒、逐角色伤害桶。
- `damageCurve`：每一段伤害对应一个累计曲线点，含逐角色累计值。
- `hitResolutionLog`：每次排队逐击的目标、`landed / miss`、原因、伤害/Aura/命中回调三层许可、公式潜在伤害、实际伤害，以及可空的伤害事件反向链接；因此 Miss 和免疫 0 伤害都不会从审计中消失。
- `targetPhaseTimeline`：核心实际使用的 60 FPS 半开目标阶段窗口，含目标、开始/结束帧、三层策略和原因。
- `auraTimeline`：每一段 Aura 模式伤害对应的目标、附着前后、ICD、消耗和反应记录。
- `particleEvents`：每一次产球的来源、生成帧、到达帧、元素、类型、随机后数量和是否在模拟期内接收。
- `particleTriggerLog`：每一次逐击产球检查、对应 hit ID、是否触发、被阻止原因、内部冷却键和下一可用帧。
- `energyLog`：每个固定回能或粒子对每名接收者的逐次结算。
- `energyCurve`：初始、消耗、固定回能和粒子接收后的全队能量快照。
- `timelineExecution.stateLog`：行动状态的进入、刷新、消耗、清除和到期帧。

UI 只绘制这些结构化结果，不重新执行伤害公式。

`enemy.targets` 是最多 32 项的具名目标注册表；每项目标可覆盖共享 `enemy.level / resistance / defReduction` 和 `reactionEngine.initialAura`，但必须保留兼容目标 `enemy-0`。未提供注册表时核心自动物化 `enemy-0`，因此既有 Golden 配置无需改写。每段命中在伤害公式之前先选择一个已注册目标；未声明 `targeting` 时使用 `enemy-0 / landed`。场景可显式声明 `{ targetId, outcome: "miss", reason }`。Miss 会写入 `hitResolutionLog`，但不会调用该目标的 Aura / ICD 状态机，不会生成 `damageEvents`，也不会触发或占用命中产球 ICD。对 landed 命中，`effects` 可分别把 `damage` 设为 `immune`、把 `aura` 或 `hitConfirm` 设为 `blocked`，并强制附带原因。伤害免疫仍保留公式潜在值和 0 实际值；Aura 阻断只推进该目标的时间衰减，不施加元素或反应；回调阻断写入 `TARGET_HIT_CONFIRM_BLOCKED` 且不启动粒子 ICD。

`enemy.targetPhases` 把相同三层策略提升为有序、不重叠的 `[startFrame, endFrame)` 场景窗口；开始帧立即生效，结束帧立即恢复或切换到相邻阶段。逐击 `effects` 可完整覆盖活动阶段，脚本化 Miss 仍拥有最高优先级。每条 `hitResolutionLog` 都保存 `targetEffectSource` 和活动 `targetPhaseId`，因此阶段策略、逐击覆盖和默认正常路径可区分。阶段由输入配置提供，当前不包含 Boss AI、血量阈值或动作状态自动驱动。

目标自身的等级、抗性、减防和初始 Aura 已逐目标解析；现有行动 `debuffs` 仍是场景全局敌方状态，会同时影响所有已注册目标。把 Debuff 绑定到单个目标属于后续 Schema 扩展。

这一分层参考锁定 gcsim 提交中 [`Combat.attack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go) 的 `AttackWillLand` 前置门、[`Enemy.HandleAttack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go) 中反应/实际伤害/附着/回调的顺序，以及 [`Target.AttackWillLand`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/target/target.go) 的目标/范围检查边界。gcsim 在这些文件中没有统一的通用无敌开关，因此本项目要求场景显式选择三层策略；这不是对所有官服无敌阶段行为的验证，且尚未复制其几何系统。

### 6.1 Aura / ICD 最小状态机

`packages/sim-core/src/aura.ts` 是无 DOM 依赖的纯状态机。命中通过以下字段声明附着：

```ts
application: {
  gaugeUnits: 1,
  icdTag: "ability-stream",
  icdGroup: "default" | "no-icd" | "declared-profile-id"
}
```

普通 Aura 的初始耐久为标称元素量的 `0.8` 倍；1U 的衰减长度为 `420 + 6 × 1 = 426` 帧。默认 ICD 窗口为 150 帧，序列为允许、阻止、阻止并循环；状态键包含施放者、`icdTag` 和 `icdGroup`。`no-icd` 每次允许附着。

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

如果反应发生，剩余来袭元素不继续挂为普通 Aura。正式 `aura-v1` Schema 禁止非 `none` 的手工 `reaction`；只有 `debugAllowReactionOverride: true` 时可使用 `reactionOverride`。

当前状态机为每个已注册目标建立独立的火/冰/水普通 Aura 与 ICD 实例，同一角色/Tag/Group 在不同目标上互不推进。冰/水的同元素 overlap 尚未保存 gcsim 式按来源数组，暂以每个目标单状态的较强剩余 Aura 表示；复合共存、冻结和转化反应尚未实现。自定义 ICD Profile 已具备通用契约，但尚未建立全角色 Profile 数据库。

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

粒子既可在声明帧直接生成，也可通过 `trigger: { kind: "hit-confirm", hitIds, internalCooldown }` 绑定一组命中。核心在已选目标判定为 landed、命中回调策略允许且对应伤害事件处理完毕后逐次检查触发；粒子内部冷却同样按“来源角色 + key”共享并允许精确边界帧，所有通过、`TARGET_MISS`、`TARGET_HIT_CONFIRM_BLOCKED` 或 `INTERNAL_COOLDOWN` 检查都进入 `particleTriggerLog`，实际生成事件反向保存 `triggerLogId` 与 `triggerHitId`。按帧目标阶段可阻止回调且不会错误启动粒子 ICD。当前每个命中定义只选择一个目标；同一攻击的 AoE 扇出、跨目标“至少命中一个即产球”聚合、几何自动命中和真实 Boss AI 尚未建模。UI 只读取 `particleEvents`、`particleTriggerLog`、`energyLog` 和 `energyCurve`，不重新计算能量或触发条件。

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
- 保持 `provisional + partial`：冲刺/跳跃的耐力与移动物理、几何自动命中、真实 Boss 阶段状态机、单击 AoE 扇出/回调聚合、Hitlag、黑/白爆发以及状态驱动的全部被动尚未实现；多目标注册、场景显式 Miss、三层阻断与按帧阶段只验证结算门，不代表已建模真实范围或官服 Boss 行为。

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
- 有序不重叠的目标阶段 Schema、半开边界、相邻阶段切换、活动阶段来源日志和逐击覆盖优先级。
- 120 秒末端截断语义。
- 相同版本/配置/种子的可复现性。
- 默认 120 秒 Golden Fixture。
- 整数帧行动、切人、命中追踪、显式冲刺/跳跃占用、按后续普攻/重击/战技/爆发/冲刺/跳跃/切人选择取消帧、未声明路径回退与动画结束帧。
- 严格模式冷却拒绝和等待模式冷却调整。
- 多充能次数、行动重叠与错误前台角色。
- 行动状态的角色归属、授予、消耗、刷新、精确到期边界、缺少前置拒绝和冷却等待后重新检查。
- 行动状态的无前置清除、缺失状态空操作，以及杜林黑白分支互斥。
- 1U Aura 的 0.8 初始耐久和 426 帧衰减。
- 默认 ICD 第 1/2/3/4 次附着、150 帧重置、独立角色/Tag/Group 和 No ICD。
- 自定义 ICD Profile、禁止覆盖内置组、未知组失败和 DurinSkill 18 帧序列。
- 正/反融化与正/反蒸发的反应方向和 Aura 消耗。
- 无 Aura 不触发融化，以及正式 Aura 配置拒绝手工反应标签。
- Aura 结果接入伤害乘区和 `auraTimeline`。
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
- 120 秒兼容模拟和带运行时能量前缀探测的 120 秒合法时间线性能门。

Playwright 覆盖预设切换、JSON 导入、运行、总览数字、时间轴、逐击累计曲线、具名多目标属性与逐目标 Aura/ICD 隔离、目标/Aura 筛选、目标命中判定表、脚本化 Miss 对伤害/Aura/产球的共同阻断、landed 命中的伤害免疫/Aura 阻断/回调阻断独立组合、按帧目标阶段的半开边界及来源显示、敌方 Aura 曲线、固定回能 ICD 阻止、命中确认产球与粒子 ICD 阻止、自动融化、粒子生成/接收、接球时前后台、能量曲线、逐段筛选、公式展开、导出、字段路径错误、杜林黑/白 E 审计向量，以及 UID 的本地化角色/武器/技能名称、目录状态和毕业占位边界。

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

Milestone 3 的最小闭环已经落地：火/冰/水普通 Aura、可扩展元素量、衰减、默认/No ICD、自定义 ICD Profile、融化/蒸发、逐击审计和敌方附着曲线均有测试。冻结的杜林兼容预设仍保留手工反应以维持 Golden；新增黑/白 E 只是独立审计向量，不能用它们替换 120 秒兼容预设后声称机制等价。

Milestone 4 已完成核心第一批闭环：版本化粒子 Schema、固定种子随机数量、固定帧或逐击命中触发、角色级粒子内部冷却、生成/到达事件、接收时前后台、同/异/无色、晶球、充能效率、溢出、固定回能拆分、逐次日志和能量曲线。具名多目标、逐目标 landed / miss、独立 Aura/ICD、三层目标效果策略与按帧阶段窗口已成为伤害和命中产球的共同门；内置 M4 预设仍只用于机制验收，其面板、帧数和产球范围是 provisional。尚未完成 120 秒、来源核验的杜林首轮启动/循环预设，也没有敌人掉球、几何飞行轨迹、AoE 回调聚合、真实 Boss AI 或真实技能产球数据库。

Milestone 5 已完成数据层基础和首批部分机制编译闭环，不等于正式杜林预设完成。杜林黑/白 E 已有倍率引用、裸伤/增伤、动作帧、黑 E 附着/ICD、白 E 无附着口径、回能、粒子和互斥状态向量，但仍有明确未解决项；尼可、洛恩、茜特菈莉、希诺宁以及其余角色/武器仍需逐技能机制插件与交叉验证。

下一阶段应在现有目标注册表之上加入“一次命中定义 → 多个目标结算”的 AoE 扇出、至少一目标命中时的一次产球/回调聚合，再逐步加入范围/位置驱动判定和有来源的具体 Boss 阶段状态机；随后映射杜林黑/白 Q，并逐项补齐命座、专武和圣遗物效果，才能组合 120 秒 0 能量合法帧预设。并行的数据工作应给尼可、茜特菈莉、希诺宁建立同样的 Blueprint；洛恩在当前 gcsim 参考提交中不存在，必须另找可审计来源，不能猜。之后再扩展复合附着、冻结和转化反应。所有工作都必须保留现有 Golden、目标注册、目标判定、阶段、Aura、能量、行动状态、Ability Blueprint 和目录再生向量。
