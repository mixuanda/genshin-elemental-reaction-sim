# 技术设计：提瓦特伤害实验室

## 1. 当前目标

Vanilla v0.1 结果继续由兼容模式和 Golden Fixture 冻结。正式路径已经加入 60 FPS 合法帧时间线、角色无关的行动状态机、火/冰/水/雷/草 Aura、声明式 ICD Profile、基础增幅/转化/状态反应、`aura-v5` 有序多反应链、ReactionA/B、燃烧 Marker/Fuel/Tick，以及绽放、草原核、烈绽放和超绽放的确定性纵向切片。1.32 提供 opt-in 的玩家反应自伤；1.33 提供独立 opt-in 的敌方目标本地时钟；1.34 以 opt-in `aura-v6` 加入雷元素有序多反应链；1.35 加入严格的八项敌方基础抗性；1.36 再以 opt-in `aura-v7` 将 Quicken 后的水草绽放跟进建模为同帧零延迟、FIFO 且执行时重读实时 Aura 的 core task；1.37 新增独立 `targetTaskModel`，以显式 opt-in 的 `target-phase-v1` 冻结第一批 Burning target callback 与目标 Aura 衰减边界；1.38 另增显式 opt-in `target-phase-v2`，只把每个目标 callback→同一目标 `Reactable.Tick` 固定为一个边界，不改写冻结的 v1；1.39 新增独立 `reactionDeliveryModel`，默认保留事件堆延迟交付，并允许满足严格版本门的配置显式选择同步递归碎冰交付；1.40 再新增精确版本门下的 `aura-v8`，把 Quicken→Bloom 耗尽同代水 Aura 后的感电 cleanup 固定到下一次有效目标 Tick。1.41 新增独立 `electroChargedPropagationModel`：默认及迁移结果均为 `single-target-v1`；显式 `nearby-wet-radius-v1` 才按用户提供的半径审计附近湿目标并逐目标交付感电伤害。该分支是默认关闭的 `community-provisional` 契约，不是 gcsim parity、官服实测真值或正式半径数据。核心持有版本化目标/草原核/玩家 HP 时间线、逐击伤害构成、可复现粒子/能量事件、命中产球、核心反应任务、两种目标相位日志、递归碎冰父链、EC cleanup、传播候选及其跨日志审计，并通过 `runManifest` 固定每次运行的配置、选项和插件身份。当前优先保证基础反应核心及其测试；新的 UI/展示扩展明确后置。

## 2. 包边界

```text
apps/web
  只负责输入、调用核心和渲染结构化结果。

packages/schemas
  TypeScript 公共类型、Zod Schema、字段路径错误、版本迁移。

packages/sim-core
  事件队列、状态、能量、敌方/玩家伤害公式、聚合和逐击曲线数据。
  不依赖 React、Vite、Canvas、DOM 或浏览器全局。

packages/game-data
  预设、版本化完整目录、浏览器轻量索引和展示柜数据适配器。
  当前杜林预设和目录记录均为 provisional。

packages/mechanics
  Ability Blueprint、来源编译闸门、声明式伤害修正插件和角色机制向量；
  避免在核心循环写角色名分支。

packages/test-vectors
  冻结 v0.1、1.30 Burning、1.31–1.35 历史反应矩阵、1.36 历史兼容/反应任务 Golden、1.37 冻结兼容/v1 目标相位向量、独立的 1.38 兼容/v2 目标相位向量，以及 1.39 兼容、Quicken→Bloom、v2 Miss 和递归碎冰向量。
  1.40 另以三份只读 Fixture 冻结兼容默认、identity-only Quicken→Bloom 与 aura-v8 EC cleanup。
  1.41 只新增兼容默认与 community-provisional EC 附近湿目标传播向量，不覆盖或重写任何历史 Fixture。
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

`migrateConfig()` 负责把无版本及 `0.1.0`–`1.40.0` 配置迁移到 `1.41.0`。1.35→1.40 的迁移继续作为冻结历史契约；1.40→1.41 只更新运行身份并注入 `electroChargedPropagationModel: { mode: "single-target-v1" }`，原样保留 `reactionEngine`、`playerDamageModel`、`targetClockModel`、`targetTaskModel`、`reactionDeliveryModel`、逐元素敌方抗性和其余配置，不会自动启用附近湿目标传播。历史输入夹带未来字段会 fail-closed。只有精确 `1.41.0` / `1.41.0-ec-secondary-wet-propagation` 身份可声明新的传播模型；`nearby-wet-radius-v1` 还要求 `legal-frame-v1`、60 FPS、`target-phase-v2` 与 `aura-v8`。严格 Zod Schema 会校验版本配对、历史 wire contract、合法模式和场景结构。`engineVersion` 当前为 `1.41.0-ec-secondary-wet-propagation`。

目标时钟的版本化输入是：

```ts
targetClockModel:
  | { mode: "disabled" }
  | { mode: "target-local-hitlag-v1" };

targetTaskModel:
  | { mode: "legacy-event-heap-v1" }
  | { mode: "target-phase-v1" }
  | { mode: "target-phase-v2" };

reactionDeliveryModel:
  | { mode: "deferred-event-heap-v1" }
  | { mode: "shatter-recursive-zero-delay-v1" };

electroChargedPropagationModel:
  | { mode: "single-target-v1" }
  | {
      mode: "nearby-wet-radius-v1";
      radius: number; // 有限正数，当前 Schema 上限 100
      verificationStatus: "provisional";
    };

hit.targetHitlag?: {
  haltFrames: number; // 有限数，0 <= haltFrames <= 600，可为小数
  factor: number;     // [0, 1]
};
```

公共配置不暴露固定参考中的 defense-halt bonus。Schema 在输入边界强制 `0 <= haltFrames <= 600` 和 `0 <= factor <= 1`，负数、非有限数或超过 600 帧的单次 Halt 都会拒绝。每次扩展帧采用 `ceil(ceil(haltFrames) × (1 - factor))`；命中所在目标 Tick 先完成，新增暂停从下一全局帧开始。同目标同帧多次命中叠加冻结帧，不同目标隔离。Miss 不改变时钟；1.39 在 v2 下仍会为配置了 Hitlag 的 Miss 写入 `blockedReason: "TARGET_MISS"`、`applied: false` 的审计。landed 但数值免疫或 Aura/命中回调阻断的目标仍应用 Hitlag；零扩展只记录 `ZERO_EXTENSION`。这些数据状态固定为 `fixed-gcsim-provisional`，不代表官服实测真值。

`targetTaskModel` 与 `targetClockModel`、`reactionEngine` 分别建模。三种模式各自有独立 wire contract：历史兼容路径使用 `legacy-event-heap-v1`；1.37 `target-phase-v1` 已冻结 callback→Aura 衰减；1.38 `target-phase-v2` 只新增 callback→同一目标 `Reactable.Tick`。v1/v2 都在运行时强制 `legal-frame-v1`；历史身份与 v1 继续只允许 `aura-v7`，精确 1.40/1.41 的 v2 可显式选择 `aura-v8`。迁移保留输入原模式。当前 target-owned callback 覆盖已实现的 Burning wake，以及精确 `aura-v8` 中 Quicken→Bloom cleanup 的下一有效目标 Tick 决议；Quicken→Bloom follow-up 本身仍保持 1.36 的 core zero-delay task 身份，感电伤害 Tick/Wane 与其他 core work 也继续留在全局队列。

`reactionDeliveryModel` 与 Aura、目标任务和目标时钟分别建模。`deferred-event-heap-v1` 是所有现有预设、兼容配置及迁移结果的默认值，并保留 1.38 及更早的父段先编号、碎冰子段稍后交付顺序。`shatter-recursive-zero-delay-v1` 从精确 `1.39.0` / `1.39.0-shatter-recursive-delivery` 身份开始可显式选择，后续迁移会原样保留该选择；它要求 `timeline.mode = legal-frame-v1`、`fps = 60`，并只配合当前身份允许的 `aura-v7`/`aura-v8`。它只让零延迟碎冰子伤害在同一帧、同一目标、同一来源上下文中先于直接父段或嵌套 Overload 父段交付；其他反应、目标任务和周期事件仍沿用原调度。因为子段先编号，递归模式允许 `parentDamageEventId` 合法前向引用；结果 Schema 强制连续 DamageEvent ID、无环父链、同帧/目标/来源约束，以及唯一 Shatter `reactionDamageLog` 的 reciprocal 引用。迁移绝不从 deferred 自动切换到该模式。

`electroChargedPropagationModel` 只控制感电实际伤害 Tick 的目标集合，不修改 Aura、ICD、ReactionB、周期流或目标时钟所有权。`single-target-v1` 是默认兼容路径，只生成源流目标的伤害。`nearby-wet-radius-v1` 在每个 Tick 执行点构造一次 `electroChargedPropagationAudit`，并固定写入 `mechanicsDataStatus: "community-provisional"`：源目标总是第一项且选中；其余目标按注册顺序读取实时 Hydro Gauge，再以源目标位置、目标位置和圆形 hurtbox 计算距离阈值。候选会明确记录 `SOURCE_STREAM_TARGET`、`NEARBY_WET_IN_RANGE`、`NO_HYDRO_AURA`、`OUT_OF_RANGE`、`POSITION_UNRESOLVED` 或 `SOURCE_POSITION_UNRESOLVED`，被选中的每个目标都必须反链唯一 `hitResolutionLogId` 与 `damageEventId`。副目标伤害使用源 Tick 的 owner、snapshot、等级、EM、反应增伤和同一反应伤害批次；每个目标独立应用其雷抗与伤害免疫。

附近传播只交付伤害，不施加 Hydro/Electro Aura，不递归搜索下一层，不创建或接管副目标感电流，不刷新/重置副目标 `+10/+60` cadence，也不为副目标安排 `+6` Wane。副目标已有感电流继续由其原 owner 和 generation 独立推进。这个选择与半径是显式 `community-provisional` 规则；固定 gcsim 提交的经典 EC 实现仍是 `NewSingleTargetHit`，因此本模式不得标记为 gcsim parity 或官服精确。

严格结果边界会用 `targetClockLog` 对每个 `TargetStateTimeline.targetFrame` 做插值重放，并把 simulation-end 与目标汇总精确绑定；一个 `hitResolutionLogId` 最多只能产生一条 Hitlag 日志。超导状态以 `startFrame + 720 + Σ reciprocal extensionFrames` 校验自然结束帧，被刷新截断的旧区间则必须恰好结束在 `supersededAtFrame`。Aura 同一目标帧的连续性以 `expiresAtTargetFrame` 为权威，允许 Hitlag 只重投影全局到期帧而不制造虚假状态突变。

当前玩家模型的版本化输入形状为：

```ts
playerDamageModel:
  | { mode: "disabled" }
  | {
      mode: "reaction-self-v1";
      position: { x: number; y: number };
      hitboxRadius: number;
      shieldMode: "crystallize-v1";
      zeroHpPolicy: "clamp-and-continue";
      characters: Array<{
        actorId: string;
        initialHpRatio: number;
        resistances: {
          pyro: number; cryo: number; hydro: number; electro: number;
          anemo: number; geo: number; dendro: number; physical: number;
        };
      }>;
    };
```

玩家抗性是用户显式输入和本项目的公式约定。固定 gcsim 提交可用于核对列明的自伤倍率、时机、范围和盾吸收路径，但没有提供可直接视作官服正式角色抗性数据库的真值；任何默认测试抗性都不得外推为角色正式数据。

敌方基础抗性的 1.35 输入形状为：

```ts
enemy: {
  level: number;
  resistance: number; // 旧配置的必填标量兼容回退
  resistances?: {
    pyro: number; cryo: number; hydro: number; electro: number;
    anemo: number; geo: number; dendro: number; physical: number;
  };
  targets?: Array<{
    id: string;
    name: string;
    resistance?: number;
    resistances?: {
      pyro: number; cryo: number; hydro: number; electro: number;
      anemo: number; geo: number; dendro: number; physical: number;
    };
  }>;
}
```

两个 `resistances` 字段都是严格、完整的八键有限数表，不能省略某个元素或附加未知键。目标级 `resistance` 与 `resistances` 互斥；共享 `resistance` 继续必填，以便旧配置和没有逐元素表的目标确定性回退。每段伤害按其实际 `damageElement` 解析基础抗性，优先级固定为 `目标八项表 > 目标标量 > 共享八项表 > 共享标量`。直接伤害、增幅/激化后的普通伤害、超载/超导/感电/燃烧/绽放系等独立反应伤害、扩散伤害和物理伤害均复用同一选择函数；超导等减抗状态在选定的元素基础抗性之上继续应用。`enemyStateBeforeHit.baseResistance` 保存本段实际选中的值。运行时复用既有结果解析门，在一次 `simConfigSchema` 解析中同时校验具名目标的解析顺序、标量/表继承，以及每个 `DamageEvent.element` 对应的基础抗性；独立投影 Schema 也可供外部消费者验证结果。1.34 及更早对象即使从原型链继承 `resistances` 也会 fail-closed，避免非 JSON 输入绕过历史 wire contract。该表是场景输入契约，不是经来源核验的完整敌人抗性数据库。

输出侧的 `SimulationRunManifest`、Burning/Quicken/Bloom 审计、核心 `reactionTaskLog`、冻结 v1 的 `targetTaskPhaseLog`、v2 的 `targetPhaseLog`、1.39 反应交付父链/碎冰日志引用、ReactionA/B 伤害组、草原核生命周期/接触/时间线、玩家空间命中/伤害/HP 时间线与汇总、结晶盾吸收/破裂、具名目标/逐击基础抗性、`targetClockAudit` / `targetClockLog` / `targetHitlagLog` 及其跨日志引用、`TargetStateTimeline` 等关键投影均有严格 Zod Schema，并使用模拟器实际生成的状态流做解析测试。两种目标相位日志按目标任务模式互斥；`TargetStateTimeline`、草原核时间线和玩家 HP 时间线分别拥有独立输出版本。严格引用 Schema 校验 ID 连续性、事件帧序、HP/盾量守恒、目标时钟回放守恒、目标注册顺序、对应相位中的 Aura 连续性、反应交付父链无环和双向外键、逐角色汇总与总计。完整 `SimulationResult` 目前仍由 TypeScript interface 约束，尚未建立覆盖全部输出字段的单一顶层运行时 Zod Schema；因此“可靠 Schema”声明只适用于输入配置和已显式注册的关键输出契约。

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
2. 目标任务相位：冻结 v1 的 target-owned callback/Aura 衰减，或 v2 的每目标 callback→同一目标 `Reactable.Tick`（当前 callback 仅第一批 Burning wake；按目标注册顺序分配子优先级）
3. `buff` / `debuff`
4. `energy` / `particleSpawn` / `particleReceive` / 周期 Aura、冻元素、激元素、结晶碎片/护盾/草原核到期检查 / 结晶碎片与草原核生成
5. `hit` 与继承触发元组的 Quicken→Bloom core zero-delay task
6. legacy 周期反应 Tick 准备
7. 独立反应伤害
8. 周期反应延迟 Aura 削减
9. 显式结晶碎片拾取
10. 同类型同时间按插入序号

状态在 `end <= hitTime` 时先过期，因此恰好处于结束边界的命中不享受该状态。该规则由测试固定。

因此同帧行动会先检查/消耗能量，随后才接收该帧到达的粒子；同帧先产生的充能效率 Buff 则会在粒子接收前生效。`legacy-event-heap-v1` 中普通命中仍先于周期 Tick 准备，因此恰好与感电 Tick 同帧的水雷刷新会更新该 Tick 的未来伤害归属；普通命中也先于独立反应伤害和 6 帧延迟 Aura 削减。`target-phase-v1` 只为明确列出的 target-owned callback 建立更早的目标相位；`target-phase-v2` 也只把该 callback 与同一目标的 `Reactable.Tick` 绑定，既不建立全目标 barrier，也不会把感电 `+10/+60` 伤害 Tick、`+6` Wane、ICD、ReactionA/B、草原核/结晶实体、玩家状态、Quicken→Bloom 或其他 core work 自动搬入目标相位。碎冰的状态检查属于命中内部子阶段，严格按“钝击削冻 → 碎冰消耗 → 本段元素附着/反应”执行。`deferred-event-heap-v1` 继续让同帧碎冰物理子段进入通用反应伤害队列，因而在 `damageEvents` 中排在触发父段之后；`shatter-recursive-zero-delay-v1` 则在同一触发栈内先交付碎冰子段，再完成直接或嵌套反应父段，所以子段可先编号并前向引用父段。两种模式的总伤害与逐段数值应保持一致，只有交付/编号顺序改变。玩家反应自伤在拥有它的独立反应伤害事件中结算：先完成玩家空间命中和玩家 ReactionA，再按玩家抗性、当前结晶盾、HP 的顺序处理；该帧实际前台角色是受击者。它不创建敌方 `damageEvents`，也不进入敌方统计。结晶碎片在生成帧先处理状态/Buff 到期并快照等级/精通；显式拾取排在该帧全部已实现战斗事件之后，且同帧护盾到期先于新拾取，因此边界行为稳定。1.39 只对齐固定 gcsim 的零延迟碎冰伤害交付顺序；参考实现另有一个 `DoNotLog` 的零伤害 “Freeze Broken” 合成攻击，本项目尚未实现，也不能据此声称完整回调/事件等价。这些子阶段语义后续若要与新实测帧规则对齐，必须作为引擎版本变更处理。

Burning 在 `legacy-event-heap-v1` 中继续采用“同帧普通命中先于 Tick”的 1.30 引擎契约；Fuel 自然清理边界也冻结为 `F+121`。1.37 的 `target-phase-v1` 是冻结的独立 opt-in，只覆盖第一批 Burning target callback→该目标 Aura 衰减；callback 产生的 Burning 伤害仍在后续全局 core 阶段结算。1.38 的 `target-phase-v2` 另行 opt-in，并且只保证同一目标 callback 先于该目标 `Reactable.Tick`；它没有实现 callback 内同步跨目标 Aura/反应命中，也不把实际 Burning 范围伤害移入 callback。目标 Hitlag 造成的陈旧 wake 会先重投影，避免在错误全局帧提前处理。两条边界都仅为 `fixed-gcsim-provisional`，不能解释成完整 gcsim target phase、官方真值或完整 gcsim 精度。

`aura-v7` 为 Quicken→Bloom 建立的是 core zero-delay task，而不是敌方目标任务：Quicken 命中产生 `pendingHydroBloomFollowup` 后，模拟器注册 `quickenBloomFollowup`，继承触发事件的 frame/priority，并取得更晚的全局 sequence。因而同优先级且已在队列中的同帧命中先执行，任务随后用实时 Aura 决定 Bloom 或跳过。冻结的 1.37 `target-phase-v1` 和 1.38 `target-phase-v2` 都不会把它重新分类为 target-owned task；未来扩展更多目标任务所有权时必须另升引擎版本并重新验证全部日志顺序。

`aura-v8` 不改变上述 follow-up 的 core task 身份，只在该任务实际消耗同一代感电共存的最后 Hydro 时建立 `electroChargedCleanup`。cleanup 的 deadline 固定为触发点之后的下一目标帧；普通衰减/到期先按该目标 `Reactable.Tick` 执行，再决定 `stop | retained | superseded | natural-expiry`，模拟结束仍未到 deadline 时输出 `pending-at-end`。F0/TF0 启动且无 Hitlag 的停止点为 F1/TF1；命中造成 5 帧目标 Hitlag 时 deadline 仍为 TF1，但投影到 G6。停止只终止原代次后续 cadence，不撤销已经排队的 F10 首次感电伤害；停止后不得出现 F16 Wane 或 F70 后续 Tick。同代水雷共存恢复时保留流，新代次替换时不得停止替代流；自然到期与 cleanup 同 Tick 碰撞时，普通到期拥有唯一的 `AURA_DECAY_EXPIRED` 周期停止/时间线点，cleanup 复用其 ID，不能重复删除或重复停止。

cleanup 审计通过 `reactionTaskLog.electroChargedCleanup`、`targetPhaseLog` 的 `electro-charged-cleanup` transition、`periodicReactionLog` 的停止记录及 `TargetStateTimeline` 点建立 reciprocal 引用。严格 Zod 结果边界重放目标时钟、代次、deadline、结果和外键；存在合法 v8 depletion 候选时不能通过删除 audit 及其拥有的日志来伪装为普通结果。`aura-v7` 不产生这一字段的非空值，其历史输出和 Golden 不被改写。

`SimulationResult.targetStateTimeline` 是核心旁路记录的权威目标 Aura 状态序列，当前输出版本为 `1.0.0`。核心在实际 AuraEngine 调用点记录初始/结束边界、普通 Aura 自然到期派生点、直接命中的碎冰与附着子阶段、独立反应伤害的附着与嵌套碎冰，以及 Frozen、Quicken、Electro-Charged、Burning 的 Tick、削减和到期。事件点保存真实的 `eventType / eventPriority / eventSequence / intraEventSequence`；边界点和普通 Aura 自然到期派生点明确使用空事件元组，不伪造调度器事件。点数组顺序和连续 `id` 是消费顺序，网页 Aura/Fuel Canvas 只按目标过滤并保持原序，不再拼接旧状态日志、硬编码优先级或二次排序；旧 `auraTimeline`、各状态日志、`auraInitialStates` 和 `auraEndStates` 仍保留给既有表格与消费者。草原核使用独立 `dendroCoreTimeline`，其生命周期点通过严格 ID 引用回链 `dendroCoreLog`，不会让 UI 从伤害事件猜测核心状态。

1.31 升级了运行身份契约；1.32 的 `playerDamageModel`、1.33 的 `targetClockModel`、1.34 的 `aura-v6` 身份、1.35 的逐元素敌方抗性、1.36 的 `aura-v7` 核心反应任务、1.37 的 `targetTaskModel` v1、1.38 的 v2 身份、1.39 的 `reactionDeliveryModel` 和 1.40 的 `aura-v8` EC cleanup 先后成为规范化配置的一部分。`runManifest` 把配置哈希、解析后的运行选项和有序插件身份纳入 `gdl-v2-fnv1a32-*`。兼容场景的敌方伤害与事件必须保持历史 Golden 语义，但版本字段、配置哈希和复现键会因规范化配置身份升级而合法变化；1.35→1.36 不自动启用 v7，1.36→1.37 不自动启用 target phase，1.37→1.38 必须保留 legacy 或 v1 模式而不自动启用 v2，1.38→1.39 必须注入 deferred 而不自动启用递归碎冰，1.39→1.40 又必须保留现有 v7/目标任务/伤害交付选择而不自动启用 v8。`legacy-default-120s-1.37.golden.json`、`quicken-bloom-task-order-1.37.golden.json` 与 `target-task-phase-1.37.golden.json` 冻结 1.37 身份和 v1；`legacy-default-120s-1.38.golden.json`、`quicken-bloom-task-order-1.38.golden.json` 与 `target-reactable-phase-1.38.golden.json` 独立锁定 1.38 身份和 v2；`legacy-default-120s-1.39.golden.json`、`quicken-bloom-task-order-1.39.golden.json`、`shatter-recursive-delivery-1.39.golden.json` 与 `target-reactable-phase-1.39.golden.json` 再分别锁定 1.39 的兼容默认、核心任务、递归碎冰与 v2 Miss 边界。1.40 以 `legacy-default-120s-1.40.golden.json`、`quicken-bloom-task-order-1.40.golden.json` 和 `electro-charged-quicken-cleanup-1.40.golden.json` 分别锁定不变兼容基线、identity-only v7 core task 和 v8 的 F1/Hitlag5→F6 cleanup。任何新身份都不能覆盖旧 Fixture。1.40 默认 120 秒仍为总伤 `41410555.13728799`、DPS `345087.9594773999`、命中 `269`、反应命中 `129`、跳过行动 `3`。更早 Golden 继续作为冻结历史证据；Quicken→Bloom Fixture 的身份升级不重写其 core task 语义。

冻结文件的 SHA-256 是发布门的一部分，不得因 1.39 迁移改写：

```text
1.37 legacy-default-120s       168595c9e3df60717fe2b5619278cc227789df7cbf56b9985a78ceb78e10bacc
1.37 quicken-bloom-task-order  d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6
1.37 target-task-phase         5bb1ebe27d7bd5dd613abed4cb1326345925dec00311ee500b24648ffd97c60a
1.38 legacy-default-120s       a3813cda16b831d6606df5976dc90e2d8410c272fadefd25551e29e94ff334ed
1.38 quicken-bloom-task-order  07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc
1.38 target-reactable-phase    f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0
legacy-default-120s-1.39.golden.json              9765979c127cee707a99db1344a9569d25560d8a2f19ad2577fac2c7c9225151
quicken-bloom-task-order-1.39.golden.json         a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534
shatter-recursive-delivery-1.39.golden.json       a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579
target-reactable-phase-1.39.golden.json           40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8
legacy-default-120s-1.40.golden.json              843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f
quicken-bloom-task-order-1.40.golden.json         b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4
electro-charged-quicken-cleanup-1.40.golden.json  bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0
```

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

兼容模式保留已经冻结且合法的旧版伤害语义，Golden 回归容差为 `1e-8` 相对误差。`ampBase` 必须是有限正数；1.35 及更早配置允许 `reaction: "none"` 搭配它作为显式 legacy 倍率覆盖，这不会把命中投影成正式反应。Aura 模式只允许 `debugAllowReactionOverride: true` 与非 `none` 的 `reactionOverride` 组合。`calcAmplifyingReactionMultiplier()` 拒绝零/负数和非有限显式底数；转化与加算公式也会拒绝非法反应、等级、倍率和非有限运行时输入。

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

`reactionAudit` 包含 `icdAllowed`、`icdTag`、`icdGroup`、`applicationGaugeUnits`、`auraBefore`、`auraApplied`、`auraConsumed`、`auraAfter`、有序 `reactions`、明确截断的 `unsupportedReactions`、目标级 `mechanicsTruncation`，以及可空的 `transformativeReaction`、可选有序数组 `transformativeReactions`、`periodicReaction`、`frozenReaction`、`shatterReaction`、扩散多判定数组 `swirlReactions`、逐目标 `swirlDamageGroup`、`crystallizeReaction`、`catalyzeReaction` 和 `burningReaction`。`aura-v6` 在同击产生多个转化反应时使用 `transformativeReactions` 保存全部独立排队/GCD 审计，单值 `transformativeReaction` 必须严格等于数组首项；v1–v5 不新增该键，以保持历史序列化输出。碎冰审计独立保存打击类型、韧性伤害、削冻前后、碎冰消耗、触发/GCD 结果、冻结快照和下一可用帧；扩散数组避免一个风命中的多元素扩散互相覆盖；结晶审计保存共享 GCD、岩预算、Aura 消耗、元素选择和碎片三条边界帧；Catalyze 审计保存加算反应、激元素候选/代次/来源槽/到期与零消耗；Burning 审计保存 Marker/Fuel、归属、快照、周期常量、调度和停止原因。兼容引擎不具备 Aura/ICD 推演能力，所以 Aura 字段必须为 `null`，手工反应标记为 `manual-override`；不得用空数组伪装为“敌人无附着”。`aura-v1` / `aura-v2` / `aura-v3` 下数组表示核心实际判定的空/非空状态。普通独立转化反应伤害以 `model: "reaction-damage"` 明确标记，Aura 与 ICD 字段为“不适用”的 `null`，不伪装成一次新附着；超载独立伤害仍可通过单独的 `shatterReaction` 审计削冻。扩散传播攻击是例外：它本身仍是独立转化伤害事件，但显式携带传播附着并重新运行 Aura 引擎，所以 Aura 字段记录目标上的真实二次反应。

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
- `crystallizeShieldLog` / `crystallizeShieldTimeline`：护盾增加、覆盖、到期，以及 1.32 玩家反应自伤触发的吸收/破裂；保存固定等级表、精通加成、通用/同元素/岩伤吸收量、基础盾 HP 前后和玩家伤害反链。
- `playerHitResolutionLog` / `playerDamageEvents`：四类玩家反应自伤的空间命中、来源反应/目标/角色、玩家 ReactionA、抗性因子、盾吸收、HP 损失和跨日志 ID。
- `playerHpTimeline` / `playerHpSummaries`：逐角色初始/受伤/结束 HP 状态、总入射伤害、盾吸收、实际 HP 损失、命中数与是否到达 0 HP；全局两个总计都按盾后、钳制后的实际 HP 损失统计。
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

`enemy.targets` 是最多 32 项的具名目标注册表；每项目标可覆盖共享 `enemy.level / resistance / resistances / defReduction` 和 `reactionEngine.initialAura`，并可声明初始二维 `position` 与圆形 `hitboxRadius`，但必须保留兼容目标 `enemy-0`。1.35 允许共享敌人和目标分别声明完整八项 `resistances` 表；目标标量与目标表互斥，实际优先级为 `目标八项表 > 目标标量 > 共享八项表 > 共享标量`。旧 `resistance` 标量仍为必填兼容回退，不能把标量或八项场景输入解释为完整敌人抗性数据库。`enemy.targetMotions` 可为已注册且有初始位置的目标声明有序、不重叠的线性移动段 `{ startFrame, endFrame, endPosition }`：每段起点取该目标上一段终点（首段取初始位置），段内按整数命中帧线性插值，间隙保持上一位置，`endFrame` 精确到达终点并可与下一段相邻。未提供注册表时核心自动物化 `enemy-0`，因此既有 Golden 配置无需改写。每段命中在伤害公式之前先选择一个已注册目标；未声明 `targeting` 或 `geometry` 时使用 `enemy-0 / landed`。场景可显式声明 `{ targetId, outcome: "miss", reason }`，或声明圆形/旋转矩形 geometry。圆形按 `hypot(positionAtHit - origin) <= radius + hitboxRadius + 1e-9`；矩形先将目标中心按 `-rotationDegrees` 转到局部坐标，夹取到 `[-halfWidth, halfWidth] × [-halfHeight, halfHeight]` 的最近点，再比较最近距离与 `hitboxRadius + 1e-9`。几何与脚本 targeting 互斥，且要求所有目标都有位置。Miss 会写入 `hitResolutionLog`，但不会调用该目标的 Aura / ICD 状态机，不会生成 `damageEvents`，也不会触发或占用命中产球 ICD。对 landed 命中，`effects` 可分别把 `damage` 设为 `immune`、把 `aura` 或 `hitConfirm` 设为 `blocked`，并强制附带原因。伤害免疫仍保留公式潜在值和 0 实际值；Aura 阻断只推进该目标的时间衰减，不施加元素或反应；回调阻断写入 `TARGET_HIT_CONFIRM_BLOCKED` 且不启动粒子 ICD。

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

普通 Aura 的初始耐久为标称元素量的 `0.8` 倍。兼容模式 `aura-v1/v2` 保留历史的 `420 + 6 × nominalU` 寿命，因而 1U 回放仍为 426 帧；opt-in `aura-v3` 按固定 gcsim 提交的 `25 durability = 1U` 换算使用 `420 + 150 × nominalU`，1U 为 570 帧。1.38 的内置默认 ICD 窗口为 150 帧，使用固定参考的 24 项 `[允许, 阻止, 阻止] × 8` 序列，越界后钳制到最后一项，F150 重置；内置 Burning 也使用钳制尾部。自定义 `IcdProfile.tailPolicy` 可显式选择 `repeat` 或 `clamp`，历史及未声明该字段的用户 Profile 继续按 `repeat` 解释。状态键包含施放者、`icdTag` 和 `icdGroup`。`no-icd` 每次允许附着。这一边界只与固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `icd_groups.dm.go` / `target/icd.go` 交叉核对，标记为 `fixed-gcsim-provisional`，不是官方或官服真值。

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

如果消耗型反应发生，剩余来袭元素是否继续参与同击后续反应由对应 Aura 版本的显式顺序决定，不由 UI 或手工标签猜测。正式 `aura-v1`–`aura-v8` Schema 都禁止非 `none` 的手工 `reaction`；只有 `debugAllowReactionOverride: true` 时可使用 `reactionOverride`。

当前状态机为每个已注册目标建立独立的火/冰/水普通 Aura 与 ICD 实例；`aura-v2` 另允许雷普通 Aura、独立冻元素耐久，并为感电保留同目标水雷共存；`aura-v3` 再加入草普通 Aura、激元素和普通 Aura/激元素的逐来源槽；`aura-v4` 增加目标级 Burning Marker/Fuel、周期代次、归属和内置燃烧附着 ICD；`aura-v5` 增加有序基础反应矩阵、Bloom 审计和草原核管理器；`aura-v6` 增加雷来袭有序链及水来袭 Frozen→EC guard；`aura-v7` 再增加 Quicken→Bloom 实时 Aura 核心任务和 Burning refresh 计数修正；`aura-v8` 只新增该 follow-up 耗尽 Hydro 后的 EC next-target-Tick cleanup。1.41 的传播模型不改变这些 Aura 状态机，只在感电伤害 Tick 交付点按显式半径增加独立副目标伤害。同一角色/Tag/Group、感电流、燃烧流、冻元素/激元素代次、碎冰 GCD、ReactionA/B、扩散元素队列 GCD、草原核与周期调度在不同目标或各自作用域内确定性隔离。一般化特殊 Aura overlap、全部可达排列、官服核验的感电传播规则、Burning callback 内同步跨目标 Aura/反应命中、更多 Hitlag 属性、通用目标任务所有权和角色回调顺序仍未实现。自定义 ICD Profile 已具备通用契约，但尚未建立全角色 Profile 数据库。

基础发布门把 `aura-v7` 的公开输入面拆成代表性有序链与公开普通初态组合两层：前者固定七种来袭元素的高信息量链、Frozen 火蒸发 guard、ICD 重置和 Aura 精确到期，后者检查数值有限、Gauge 非负、Aura 元素唯一且稳定排序、聚合 Gauge 等于最大来源槽、逐槽消费守恒、Bloom 预算守恒、重放确定性和输入数组换序。结果 Zod Schema 同样在 `sourceSlots` 存在时强制来源唯一和最大槽一致，并对每条 `sourceMutation` 强制守恒；没有来源槽的历史投影继续接受。

这不是特殊状态全排列证明。公开 `initialAura` 只能直接表达普通五元素，组合门不会直接注入 Frozen、Quicken、Burning Marker/Fuel，也不会执行后续 Tick、草原核或目标任务；这些状态继续由各自的顺序、生命周期、Golden 和交叉引用测试负责。冻结的 1.37 v1 门覆盖低 Fuel callback-before-decay、Hitlag 重投影、多目标顺序和 `targetTaskPhaseLog`；1.38 v2 门只覆盖 callback→同一目标 `Reactable.Tick` 与 `targetPhaseLog`。固定 gcsim 提交的 Reactable 顺序附近仍有 TODO，因此这些精确链只能标为 `fixed-gcsim-provisional`，不是官方或官服验证真值。

目标本地时钟暂停普通五元素 Aura 的被动衰减/自然到期、Frozen 与 Quicken 的衰减/到期、Burning Fuel/依赖的草与激元素衰减以及每 15 个目标帧的 Burning Tick 链；在 v2 中，这些列明的自然到期转换可以由同一目标 `Reactable.Tick` 记录。感电的 `+10/+60` 伤害 Tick 和 `+6` Wane 仍是全局任务，只有水雷 Aura 共存的自然到期跟随目标时钟。附着 ICD、Overload/Superconduct/Shatter/Swirl/Crystallize 队列与 GCD、ReactionA/B、所有独立反应伤害、草原核生成/寿命/爆炸、结晶实体、行动/Buff/能量/粒子、目标 movement/phase 和玩家侧状态也仍按全局帧推进。

#### 6.1.0 aura-v6 雷元素有序多反应链

`aura-v6` 是 1.34 引入并由 1.35 继续保留的独立 opt-in 模式，沿用 v5 的耐久、来源槽、Frozen、Quicken、Burning、Bloom 和草原核主体语义，不改变 v1–v5 的序列化输出或 Golden。它有一个明确的水来袭版本差异：同一命中在有序链中先生成 Frozen 后，v6 会按固定参考拒绝随后启动 Electro-Charged；v5 则保留历史 post-Freeze EC/F+10 结果。雷元素附着通过 ICD 后，核心以同一份 `remainingElectroGaugeUnits` 按以下顺序推进：

```text
超激化（Aggravate，不消耗来袭 Gauge）
→ 超载（Overload）
→ 感电（Electro-Charged）
→ 冻结底超导（Frozen Superconduct）
→ 普通超导（Superconduct）
→ 原激化（Quicken）
→ 原激化后的水草绽放跟进（Bloom）
```

顺序来自固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 Reactable 路径；项目将其标记为 `fixed-gcsim-provisional`。参考源码自身在该顺序附近保留 TODO，因此这里仅冻结一个可复现的固定代码路径，不宣称它是官服全部版本和全部复合附着的真值。除非该步骤的参考语义明确为非消费，前一步消费后的余额才进入后一步；余额不会为每个分支重置，也不能由 UI 重新推导。

一次雷命中可以同时触发超载与超导等多个转化反应。`ReactionAudit.transformativeReactions` 按上述顺序保存每个反应自己的 GCD、排队帧和状态定义；模拟器遍历整个数组，为所有已排队项分别生成独立 `DamageEvent`。旧的 `transformativeReaction` 必须等于数组首项，仅用于兼容只认识单值字段的旧消费者。v1–v5 继续省略数组字段。当前七种来袭元素已有代表性有序链和公开普通初态 covering gate，但尚未证明所有特殊 Aura 可达排列、全部来源 overlap、后续任务相位或 Lunar 反应；1.35 的逐元素敌方抗性只是明确的伤害公式输入，不会补齐这些分支。因此这不是一般化反应求解器，更不代表完整 gcsim 精度。

#### 6.1.0a aura-v7 Quicken→Bloom 核心零延迟任务

`aura-v7` 是 1.36 的独立 opt-in；1.35→1.36 迁移仍保留 `aura-v6`，不会自动采用本节语义。v6 在命中内部同步执行 `pendingHydroBloomFollowup`，v7 则只登记 pending，并向模拟器的 core event heap 排入 `quickenBloomFollowup`：

```text
task.frame = trigger.frame
task.priority = trigger.priority
task.sequence > trigger.sequence and already-enqueued same-frame sequences
task reads live target Aura when executed
```

任务先推进并读取目标当前 Aura；只有 Hydro 与 Quicken 同时仍存在时才执行一次 Bloom resolver，否则以 `MISSING_HYDRO`、`MISSING_QUICKEN` 或目标机制截断原因确定性跳过。成功任务保存实际 `auraBefore / auraConsumed / auraAfter`、Bloom 审计、Quicken mutation 和草原核预约 ID；跳过任务同样保存观察到的 Aura 和原因，不产生核心。

`SimulationResult.reactionTaskLog` 是该核心任务的权威日志。严格结果 Schema 要求连续 ID/排序，核对触发 actor/action/hit/group/event 元组，要求每个 v7 pending 恰好对应一个任务，并把 triggered 任务与 `quickenStateLog`、`dendroCoreLog`、`dendroCoreTimeline`、`targetStateTimeline` 做 reciprocal 引用。该增量任务只覆盖固定参考中的 Quicken→Bloom 零延迟路径；它不属于敌方 per-target queue，冻结的 1.37 `target-phase-v1` 与 1.38 `target-phase-v2` 都不会把它重新分类为 target-owned task。

#### 6.1.0b 1.37 target-phase-v1 目标任务相位

`targetTaskModel.mode` 是独立版本边界。无版本及 0.1–1.36 输入迁移后固定为 `legacy-event-heap-v1`；`target-phase-v1` 必须由 1.37 配置显式 opt-in，运行时要求 `legal-frame-v1`，配置了反应引擎时要求 `aura-v7`。第一批契约按固定目标注册顺序执行：

```text
target-0 owned callback → target-0 Aura decay
→ target-1 owned callback → target-1 Aura decay
→ same-frame core/incoming work
```

当前 target-owned callback 只覆盖已实现的 Burning wake。callback 在 Aura 衰减前读取 Marker/Fuel 并决定本 Tick 是否成立；实际 Burning 范围伤害仍排入后续 core 阶段。目标 Hitlag 使旧 wake 失效时，模拟器会先按目标本地截止帧重投影，再执行 callback/decay，不能在旧全局帧提前清除 Fuel。没有 target-owned callback、但有 hit 或 reaction damage 到达的目标也会在 incoming 前完成该目标的 Aura 边界推进。

`SimulationResult.targetTaskPhaseLog` 以每个目标/全局帧的相位行为记录 `auraBeforeTasks / auraAfterTasks / auraAfterDecay`、目标顺序、目标帧、权威事件元组及 Burning、命中、核心反应任务日志 ID。严格 Schema 校验 ID、帧/目标顺序、目标时钟、Aura 链和外键。该切片只标记为 `fixed-gcsim-provisional`：它不是官服真值，不是完整 gcsim target phase，也没有一般化 movement/phase、Debuff、敌方 AI 或其他任务的所有权。

#### 6.1.0c 1.38 target-phase-v2 目标 Reactable 相位

`target-phase-v2` 是 1.38 的独立显式 opt-in；1.37→1.38 迁移会原样保留 `legacy-event-heap-v1` 或冻结的 `target-phase-v1`，不会自动采用 v2。其运行时前提与 v1 相同：要求 `legal-frame-v1`，配置反应引擎时要求 `aura-v7`。v2 只增加一个局部顺序：

```text
target callback → same target Reactable.Tick
```

这里的 `Reactable.Tick` 只推进该目标已经列明的普通 Aura、Frozen、Quicken、Burning Fuel 和感电共存自然到期边界；精确 1.40 v8 还会在普通推进之后决议 Quicken→Bloom depletion cleanup。它不建立“所有目标 callback 后再统一 Tick”的全目标 barrier，也不接管感电 `+10/+60` 伤害 Tick、`+6` Wane、附着 ICD、ReactionA/B、Quicken→Bloom follow-up 本身、草原核/结晶实体、独立反应伤害或其他 core work。实际 Burning 范围伤害仍排入后续全局 `reactionDamage` 管线；callback 内同步跨目标 Aura/反应命中尚未实现。

`SimulationResult.targetPhaseLog` 是 v2 的权威相位日志，记录 callback 前后与同目标 `Reactable.Tick` 后的 Aura/状态边界、目标顺序、目标时钟和关联 ID。目标任务模式为 v2 时只允许填充 `targetPhaseLog`，冻结的 `targetTaskPhaseLog` 必须为空；legacy/v1 则不填充 v2 日志。该互斥边界防止消费者把两个不同版本的相位含义合并。v2 同样只标记为 `fixed-gcsim-provisional`：固定提交是可复现参考，不是官方真值、完整 gcsim target phase 或完整 gcsim 精度。

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

超导伤害命中后才给对应目标施加 `superconduct-phys-shred`：物理抗性降低 `40%`，基础持续 720 帧。状态使用 `[startFrame, endFrame)`；同帧优先级较高的普通命中不会提前受益，结束帧立即失效。刷新在新超导伤害帧截断旧日志区间并创建新的 720 帧区间。数值伤害免疫只把独立冰伤乘为零，只要范围判定为 landed 仍会施加状态；这与固定 gcsim 提交在伤害应用后始终发出 `OnEnemyDamage`、再由该事件添加超导减抗的路径一致。1.33 启用目标时钟时，只延长命中帧已经存在且 `endFrame > hitFrame` 的超导状态；同帧更晚的反应伤害才创建的状态不会被追溯延长。延长的状态日志 ID 与 Hitlag 日志双向核验。

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

该语义交叉核对固定 gcsim 提交的 `pkg/reactable/electrocharged.go`。固定路径使用 `NewSingleTargetHit`，所以默认 `single-target-v1` 仍让每个敌人独立维护单目标 Tick 流。1.41 的 `nearby-wet-radius-v1` 是另行标注的社区临时规则，不宣称来自这条固定 gcsim 路径。`aura-v6` 中冻元素存在时会拒绝新感电，包括水命中在同一有序链中刚生成 Frozen 的情况；`aura-v5` 仍保留旧 post-Freeze EC 行为用于历史回放。任意来源 Aura overlap、所有同击反应排列和官服核验的目标传播规则仍未完成，因此不是完整 gcsim Aura 系统。

1.40 的 `aura-v8` 已实现此前未完成的 Quicken→Bloom cleanup：只有 follow-up 恰好耗尽同代最后 Hydro 才设定下一有效目标 Tick 的 deadline；无 Hitlag 在 F1 停止，5 帧 Hitlag 在 F6/TF1 停止。已经排队的 F10 首次伤害继续结算，同代补水可保留流，新代次替换、自然到期碰撞和模拟末端 pending 都有显式结果；停止后的 F16 Wane/F70 Tick 不再发生。`aura-v7` 仍保留旧行为，迁移不自动启用 v8。1.41 只新增默认关闭的附近湿目标伤害传播与候选审计，不改变上述 cleanup 或任何目标流的 cadence/Wane 所有权。跨过 F70 callback 的长 Hitlag Golden、任意来源 Aura overlap、全部同击反应排列和传播的官服真值仍未完成。

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

这部分交叉核对固定提交的 `pkg/reactable/freeze.go`、`pkg/reactable/melt.go`、`pkg/reactable/vaporize.go`、`pkg/reactable/superconduct.go` 和 `pkg/reactable/reactable.go`。当前实现冻元素耐久、冻结底反应、1.33 起的目标本地衰减/到期重投影与下述碎冰子集；仍没有敌人定身/动画状态、冻结气泡破裂、目标 movement/phase 随 Hitlag 暂停或敌人冻结抗性数据库。`aura-v5/v6/v7/v8` 固定冰来袭 `超导 → 融化 → 冻结`：水雷共存可得到 `超导 → 冻结`，水雷火共存且冰量足够时可得到 `超导 → 反向融化 → 冻结`。这不代表其他单次来袭元素的所有多反应排列均已完成。

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

`shatterReaction` 保留 `NO_FROZEN_AURA`、`FROZEN_DEPLETED_BY_POISE`、`REACTION_DAMAGE_GCD` 三类显式结果；实际两阶段耐久变化分别写入 `frozenStateLog` 的 `poise-consume` / `shatter-consume`，碎冰排队与生成伤害写入 `reactionDamageLog`。网页逐击详情展示完整公式和 GCD，冻结曲线加入两个削减节点。1.39 的 `shatter-recursive-zero-delay-v1` 通过专用同步交付路径覆盖直接钝击/岩命中和“普通命中 → 超载 → 碎冰”的嵌套父链；`deferred-event-heap-v1` 继续保持历史编号与交付顺序。递归模式的子段与父段继承相同 frame、target、source、priority 和 root event sequence，父链可以前向引用但不能成环；12 帧 GCD 内再次削冻仍只记录阻止，不生成第二个子伤害。该实现交叉核对固定提交的 `pkg/reactable/freeze.go` 与 `pkg/enemy/attack.go`，但当前 `poiseDamage` 仅服务于冻结消耗，不代表已实现敌人通用韧性条、击退、硬直、重量或冲击；也没有完整技能打击类型/韧性伤害数据库，且未实现固定参考中的 `DoNotLog` “Freeze Broken” 合成攻击。

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

新结晶盾无条件覆盖旧结晶盾，持续 `15.1s = 906f`。核心返回护盾增加/覆盖/到期与阶梯曲线点；1.32 的四类玩家反应自伤还会消耗基础盾 HP，并记录 `absorb/break`、吸收伤害和穿透到 HP 的余量。同元素吸收倍率由盾元素与来袭元素比较；`1.5` 倍分支由来袭岩伤决定，而不是由盾元素决定。当前没有一般敌方攻击、非结晶盾、护盾强效 Buff、装备/角色被动回调、碎片受击、角色与碎片距离、真实拾取路径或月结晶，所以这仍不是完整生存结果。网页目前只保留既有碎片/护盾状态视图，尚未新增玩家自伤吸收/破裂专用展示。

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

`aura-v3` 对燃烧、绽放、草原核、超绽放和烈绽放保持历史 fail-closed；`aura-v4` 只把燃烧移出该集合，绽放系仍使用同一边界。`aura-v5/v6/v7/v8` 启用 6.1.9 的绽放/草原核实现，不会反向改写 v3/v4 回放。旧模式命中满足尚未支持的前提时，核心会：

1. 先记录排序更早且已经支持的 Aura 消耗与同击内联效果；若其独立伤害尚未落地，则在截断边界明确标为 `TARGET_MECHANICS_TRUNCATION`、不得声称已排队；
2. 把未支持分支写入 `unsupportedReactions` 与 `mechanicsTruncation`；
3. 清空并锁定该目标 Aura，避免把任何保留状态继续当作真实燃烧/绽放结果；
4. 保留触发当击的权威直接伤害和已经内联进该段的激化加算；不再排入依赖截断状态的后续独立事件。同帧后序及后续可独立求值的伤害事件保留公式 `potentialDamage`，但标记 `mechanics-truncated`、令 `finalDamage=0`，从总伤和 DPS 排除；依赖未知 Aura 的感电 Tick/削减和旧状态到期事件通过 generation 或截断守卫直接失效。

这是逐目标 fail-closed 截断；其他目标继续独立模拟。跨过边界的结果返回 `mechanicsStatus: "partial"` 与 `targetMechanicsTruncationLog`，网页也会显式警告“结果部分有效”。它不是绽放近似模型。该切片交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `pkg/reactable/catalyze.go`、`reactable.go` 与等级反应表。固定提交自身仍含反应顺序 TODO、草原核持续时间 `// ??` 注释和燃烧测试 TODO，所以 v3/v4 与下述 v5/v6/v7 都只声称固定代码路径交叉校验，不声称官方数值验证或完整 gcsim 精度。

#### 6.1.8 aura-v4/v5/v6/v7/v8 Burning Marker、Fuel 与周期 Tick

`aura-v4` 是首个启用燃烧的 opt-in 机制版本，`aura-v5/v6/v7/v8` 继承其主体语义；v1–v3 与 `legacy-v0.1` 的配置/Golden 不被静默改写。启动条件按固定提交的反应顺序执行：

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

`ReactionAudit.burningReaction` 记录启动、Fuel 覆盖、快照刷新、停止或目标截断；`burningStateLog` 记录状态事件的 frame、priority、sequence、Fuel/Marker 前后、到期帧、Tick 索引、伤害/父事件 ID、附着 ICD 和限制标记。v7 明确区分“启动反应”与“刷新状态”：只有从未燃烧状态启动时才把 `burning` 写入反应列表并增加反应命中；对既有 Marker 的 Fuel/归属/快照刷新仍返回完整 `burningReaction` 和状态日志，但不再投影为一次新反应。网页只能读取这些核心结果。

Burning 的时钟字段按显式配置二选一：

```text
targetClockModel.disabled:
  clockModel = target-local-no-hitlag
  hitlagStatus = unsupported-enemy-hitlag

targetClockModel.target-local-hitlag-v1:
  clockModel = target-local-hitlag-v1
  hitlagStatus = modeled-enemy-hitlag

selfDamageStatus =
  unsupported-player-damage-model     // playerDamageModel.disabled
  modeled-player-reaction-damage      // reaction-self-v1
```

启用目标时钟后，Fuel、燃烧期间依赖的普通草/激元素衰减和每 15 个目标帧的 Tick 链都使用不可变的目标本地截止帧；后续 Hitlag 只重投影全局唤醒帧，不改变 Tick 序号或目标帧节奏。1.32 的 `reaction-self-v1` 已在每个实际 Burning Tick 的伤害帧，以同一抗性前原始反应伤害和半径 1 对静态玩家圆形碰撞体求交，再进入玩家火抗、结晶盾和 HP；固定跳过槽不生成玩家伤害。所有 1.32 配置迁移都会禁用目标时钟，但会原样保留其玩家模型；1.31 及更早配置与内置兼容预设才同时禁用两项模型。两条迁移都不改变原 Golden。角色专属 `OnBurning` hook-before-snapshot 与纳西妲 C2 对燃烧等转化反应的特殊暴击仍没有进入当前事件阶段。

实现语义交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 Burning/Reactable/目标任务与玩家伤害代码路径。`legacy-event-heap-v1` 有意保留 1.30 的第 121 目标帧 Fuel 清理和“同一目标帧普通命中先于 Tick”相位；v7 的 refresh 反应投影修正不会反向改写它。冻结的 1.37 `target-phase-v1` 必须显式 opt-in，只覆盖第一批 Burning callback→Aura 衰减；1.38 `target-phase-v2` 也必须显式 opt-in，并且只覆盖 callback→同一目标 `Reactable.Tick`。两者都把实际 Burning 范围伤害留在后续全局 core 阶段，尚未实现 callback 内同步跨目标 Aura/反应命中；启用 Hitlag 时陈旧 wake 会先重投影。固定源码自身仍有 TODO，玩家抗性又是本项目的显式用户输入；因此三种目标任务模式的相应切片都只能称 `fixed-gcsim-provisional`，固定提交不是官方/官服真值，也不是完整 gcsim 精度。

#### 6.1.9 aura-v5/v6/v7/v8 绽放、草原核、烈绽放与超绽放

`aura-v5` 在不改写 v1–v4 的前提下加入严格 Bloom gauge resolver，`aura-v6/v7/v8` 完整继承。水草双向，以及固定顺序下燃烧/激元素与水草相交的分支，都会输出包含输入槽、实际消耗、剩余量、来源 mutation 和核心生成计划的 `BloomReactionAudit`；全零交互和不符合槽公式的伪审计会被 Schema 拒绝。`pendingHydroBloomFollowup` 在 v5/v6 只是同步兼容标记；在 v7/v8 中则必须恰好对应前节的一条 `reactionTaskLog`，由任务在执行点重读 Aura 后触发或跳过。

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

自然绽放和烈绽放以核心位置为圆心、二维半径 5 求交，基础倍率分别为 `2` 和 `3`；超绽放的 15m 选择圆先与敌方圆形 hurtbox 求交，合格候选再按核心到目标中心的距离和注册顺序稳定排序，60 帧后以所选目标为中心按半径 1、倍率 `3` 求交。没有合法目标时，超绽放仍消费核心并记录零伤害结果，不伪造敌方或玩家命中。普通命中和 Burning/其他反应伤害都可以按元素、几何与同一逻辑 `hitGroupId` 接触核心；同一命中组对同一批核心只处理一次，即使敌方命中判为 miss，也不自动否定几何上真实发生的核心接触。

草原核伤害在实际爆炸帧读取来源角色当时的 EM 和反应增伤，不普通暴击、忽略防御，再进入对应元素抗性和目标策略。绽放、烈绽放、超绽放与碎冰/超导共用 ReactionA：按 `目标 + 角色 + 反应` 隔离，在半开 30 帧窗口只让前两次造成伤害；第三次仍生成零伤害 DamageEvent 和阻止审计。生命周期、接触、ReactionA、`reactionDamageLog`、DamageEvent 和 `HitResolution` 通过 `dendroCoreResultReferencesSchema` 做双向 ID/连续性检查。

Bloom resolver 还保留了 Fuel 部分/完全消耗和后续调度投影，以便固定参考语义可审计；但在当前公开合法命中流水线中，水会先蒸发并移除 Burning Marker/Fuel，草路径也不会以 Bloom 消耗 Fuel，所以该分支没有可从公共配置到达的合法初态。不得为了覆盖它而构造非法 Fuel 或声称当前实战路径已经验证。

草原核属于全局 Gadget 时钟，日志固定标记 `clockModel: "global-frame-gadget-v1"` 与 `hitlagStatus: "not-affected-by-enemy-hitlag"`；`+30f` 生成、`300f` 寿命、自然绽放/烈绽放 `+1f` 和超绽放 `+60f` 都不随目标 Hitlag 暂停。当前 `300f` 核心寿命来自固定参考源码中带 `// ??` 的常量，仍为 `provisional`。1.32 已为自然绽放、烈绽放和超绽放接入 opt-in 玩家自伤，但仍没有丰穰之核、卡维强制迸发、角色/命座特殊修正、真实三维位置/追踪弹道或 Lunar 反应；因此不是完整 gcsim 或官服反应系统。

#### 6.1.10 1.32 玩家反应自伤、结晶盾与 HP（1.33–1.39 保持全局时钟）

`reaction-self-v1` 是无 DOM 的纯核心路径，只覆盖 Burning、Bloom、Burgeon、Hyperbloom 四类已实现反应。自伤始终从该反应攻击的“已计入等级、EM 和反应增伤，但尚未经过敌方抗性”的原始伤害派生：

```text
Burning player pre-res damage   = source pre-res damage × 1
Bloom player pre-res damage     = source pre-res damage × 0.02
Burgeon player pre-res damage   = source pre-res damage × 0.02
Hyperbloom player pre-res damage = source pre-res damage × 0.02

player final incoming =
  player pre-res damage
  × player resistance multiplier
  × player ReactionA multiplier
```

玩家侧转化反应伤害不普通暴击并忽略防御。抗性使用与核心一致的负抗、`[0, 0.75)` 和 `>=0.75` 三段公式；八项抗性必须由配置逐角色显式提供。这里的抗性输入是用户数据和项目约定，不是固定 gcsim 提交或官服资料提供的正式角色抗性数据库。

空间语义为二维圆形相交，边界相切算命中：

- Burning：以当前 Burning 目标为圆心，伤害半径 1。
- Bloom：以草原核为圆心，伤害半径 5。
- Burgeon：以草原核为圆心，伤害半径 5。
- Hyperbloom：15m 选择圆与目标 hurtbox 相交后按中心距离选最近敌方目标，60 帧后以该目标为圆心，伤害半径 1；没有合法目标时不生成敌方或玩家伤害。

玩家中心和碰撞半径来自 `playerDamageModel` 的静态场景输入；当前不因冲刺、跳跃、切人或任何命令改变坐标。每个自伤帧读取当时的前台角色作为受击者。Burning 不经过玩家 ReactionA；三类绽放系按“受击玩家 + 来源角色 + 反应”维护独立 30 帧半开窗口，前两次允许伤害，第三次及以后仍生成结构化零伤害尝试和阻止原因。

伤害落地顺序固定为：

1. 计算空间命中、玩家 ReactionA、抗性后入射伤害。
2. 若存在当前结晶盾，先按基础盾 HP 消耗：同元素来袭吸收倍率 `2.5`，来袭岩伤倍率 `1.5`，其余 `1`；元素精通生成加成沿用护盾快照。
3. 剩余伤害扣除当前前台角色 HP。静态 Max HP 为 `baseHp × (1 + hpPct) + flatHp`；初始 HP 由配置比例给定。
4. `zeroHpPolicy: clamp-and-continue` 把 HP 钳制到 0，记录 overkill，后续事件继续执行。它是回归/审计策略，不实现死亡、倒地或复活。

核心返回 `playerHitResolutionLog`、`playerDamageEvents`、版本化 `playerHpTimeline`、`playerHpSummaries`、`totalPlayerDamageTaken` 和 `totalReactionSelfDamageTaken`。结晶盾 `absorb/break` 行写入既有盾日志与时间线。严格 `playerDamageResultReferencesSchema` 校验连续 ID、事件排序、Miss/landed 对应关系、Burning/草原核/ReactionA/护盾双向外键、HP 连续性、吸收与实际 HP 损失守恒、逐角色汇总和总计。

玩家承伤数组与敌方 `damageEvents` 完全分离，不改变 `totalDamage`、DPS、角色/技能聚合、敌方逐击时间线或敌方累计/构成曲线。`disabled` 模式必须返回空玩家事件并保持旧 Golden 的敌方数值与顺序。网页本轮没有增加玩家 HP、自伤或盾破裂专用视图；现有敌方结果展示保持原样，未来 UI 必须直接消费这些结构化输出。

该切片交叉核对固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 Burning、草原核、玩家/角色 HP 和结晶盾代码路径，但只声称所列路径的版本化兼容参考。1.33–1.39 的敌方目标时钟、冻结的 v1、1.38 v2 和 1.39 递归碎冰交付都不会暂停玩家 HP、结晶盾或玩家 ReactionA；固定提交只提供 `fixed-gcsim-provisional` 参考，不是官方真值。尚未实现玩家 Aura 与被敌攻击触发的反应、敌方攻击、治疗、死亡/复活、动态 Max HP、玩家移动、非结晶盾、护盾强效和完整生存系统。

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

Vitest 发布门与验证清单（执行对应命令后方可报告结果）：

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
- 默认 120 秒 Golden Fixture、1.30 Burning Golden、1.31–1.40 历史基础反应/状态/目标相位/递归碎冰/EC cleanup 向量继续只读保留。1.41 已冻结 `legacy-default-120s-1.41.golden.json`（SHA-256 `9768d8b0461bd641ed5a4097e1cfe4204e1d6db9e9a6453e75754eb1a90bf9c8`）与 `electro-charged-propagation-1.41.golden.json`（SHA-256 `b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18`）。前者锁定 `single-target-v1` 默认兼容；后者锁定当前传播候选/逐目标伤害合同。传播门仍须断言湿/干/范围外/位置未解析/伤害免疫、hurtbox 边界、逐元素抗性、同帧目标相位、现有副目标流的 owner/cadence 保持、不递归、不产生副目标 Wane、目标上限和重复运行确定性。未来新 Golden 摘要和 SHA 仍只能在运行校验后写入。
- 整数帧行动、切人、命中追踪、显式冲刺/跳跃占用、按后续普攻/重击/战技/爆发/冲刺/跳跃/切人选择取消帧、未声明路径回退与动画结束帧。
- 严格模式冷却拒绝和等待模式冷却调整。
- 多充能次数、行动重叠与错误前台角色。
- 行动状态的角色归属、授予、消耗、刷新、精确到期边界、缺少前置拒绝和冷却等待后重新检查。
- 行动状态的无前置清除、缺失状态空操作，以及杜林黑白分支互斥。
- v1/v2 的历史 `1U -> 0.8U / 426f` 回放，以及 v3 火/冰/水/雷/草 `1U -> 0.8U / 570f` 固定耐久换算。
- 默认 ICD 第 1/2/3/4 及第 24/25/26 次附着、150 帧重置、独立角色/Tag/Group 和 No ICD。
- 自定义 ICD Profile 的缺省/显式 `repeat` 与显式 `clamp`、禁止覆盖内置组、未知组失败和 DurinSkill 18 帧序列。
- 正/反融化与正/反蒸发的反应方向和 Aura 消耗。
- 四个增幅方向都由来源角色的 action-snapshot EM 与 hit-time reactionBonus 驱动；代理施放者、`scalingOwnerId`、`creditOwnerId` 和确定性复现互不混淆。
- 无 Aura 不自动触发融化，`ampBase` 拒绝非正/非有限输入并保留显式 legacy 覆盖，以及正式 Aura 配置拒绝手工反应标签。
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
- v4 燃烧等级/精通/增伤/火抗公式、范围扇出、逐击伤害父链、实时面板归属刷新、火附着 ICD，以及禁用/启用目标时钟下的 Tick/Fuel 边界；v7 另锁定启动与 Fuel/快照 refresh 的反应投影；冻结的 1.37 v1 锁定 legacy 不漂移和 callback-before-decay，1.38 v2 另锁定 callback→同一目标 `Reactable.Tick`。实际 Burning 范围伤害仍为全局 core work，callback 内同步跨目标 Aura/反应命中不在当前门内。
- v5 Bloom gauge 组合不变量、水草双向交互、冰来袭 `超导 → 融化 → 冻结` 有序链、v6 `hydroFrozenEcGuard` 和 post-Freeze EC 兼容边界，以及 v7 Quicken→Bloom core zero-delay FIFO/live-Aura 触发、跳过路径与 `reactionTaskLog` reciprocal 引用；冻结的 v1 与 1.38 v2 都必须证明该核心任务没有被重新分类为 target-owned task。
- v8 Quicken→Bloom 耗尽最后 Hydro 后只在下一有效目标 Tick 清理同代感电流；F1、Hitlag5→F6、F10 首次伤害保留、F16/F70 抑制、同代恢复、代次替换、自然到期唯一所有权和模拟末端 pending 都必须可审计且确定性复现。1.41 另行验证显式半径附近湿目标伤害传播；它不能反向改变 cleanup，也不覆盖跨过 F70 callback 的长 Hitlag。
- 草原核 30 帧生成、provisional `300f` 寿命、稳定且不可重放的 ID、独立种子位置、五核心上限/最旧淘汰、自然绽放、火/雷接触、同 hit-group 去重和 expiry-before-hit 边界。
- 烈绽放 1 帧延迟/半径 5、超绽放 60 帧延迟/15m 最近目标/半径 1、无目标消费、爆炸帧实时 EM/反应增伤、ReactionA 前二/30 帧，以及生命周期/接触/时间线/反应伤害/逐击父链的严格引用一致性。
- 通用 ReactionA 对碎冰、超导和绽放系的前二/30 帧规则，以及 ReactionB 对超载、感电的首一/30 帧规则；被阻止尝试仍生成零伤害事件和审计。
- 玩家 Max HP、负抗/0%/75%/高抗边界、四类反应自伤倍率/半径和固定等级向量、圆形命中边界、结晶盾普通/同元素/岩伤吸收、盾基础 HP 守恒、破裂与 HP 钳制。
- Burning 圈内/圈外、绽放系独立玩家 ReactionA、切人后受击者、结晶盾完整吸收/破裂后余伤、HP 归零后继续、玩家日志/HP/护盾外键与汇总守恒，以及禁用玩家模型时敌方伤害和排序逐项相等。
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
- 120 秒兼容模拟、带运行时能量前缀探测的 120 秒合法时间线和持续 Burning 流继续受既有桌面性能门约束；该阈值不是跨设备 SLA，也不得在未实际运行对应命令时写入通过结论。

Playwright 覆盖预设切换、JSON 导入、运行、总览数字、时间轴、逐击累计与三类伤害构成曲线、具名多目标属性与逐目标 Aura/ICD 隔离、显式 AoE 扇出、几何求交、目标移动、目标/Aura 筛选、反应父链、结晶、激化、燃烧、能量、公式、杜林审计向量及 UID 展示柜边界。1.41 当前只要求核心、Schema、Golden 和既有页面不退化；不为附近传播、EC cleanup、玩家自伤/HP/盾破裂或草原核生命周期新增专用面板。所有新增传播伤害仍通过核心生成的逐目标 `DamageEvent` 自动进入既有逐击、技能、时间轴和累计/构成曲线；展示扩展后置，未来 UI 也只能读取核心结构化输出。

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

Milestone 3 已落地火/冰/水/雷/草普通 Aura、可扩展元素量、衰减、默认/No ICD、自定义 ICD Profile、正/反融化、正/反蒸发、超载、超导、感电、冻结/碎冰，火/水/冰/雷扩散、火/水/冰/雷结晶、燃烧、绽放/烈绽放/超绽放及原激化/超激化/蔓激化；这些经典反应家族均可执行但仍为 `fixed-gcsim-provisional`。1.36–1.40 依次冻结 Quicken→Bloom core task、两种目标相位、碎冰递归交付和 EC next-target-Tick cleanup。1.41 再加入默认关闭的 `community-provisional` 附近湿目标伤害传播：候选、逐目标伤害与反链可审计，但 Aura 不附着、传播不递归、副目标流不被接管或重置，也不产生副目标 Wane。迁移保留全部历史模式并注入 `single-target-v1`，不自动启用附近传播。目标 Aura 曲线仍只读取核心的版本化 `targetStateTimeline`，UI 不推断同帧状态顺序。完整多 Aura、官服核验的传播规则、Burning callback 内同步跨目标 Aura/反应命中及 “Freeze Broken” 合成攻击尚未实现。冻结的杜林兼容预设仍保留手工反应并使用 legacy 目标任务模型和 deferred 交付以维持 Golden；其示例魔法数继续是 provisional，不是正式角色数据。

Milestone 4 已完成核心第一批闭环：版本化粒子 Schema、固定种子随机数量、固定帧或逐击命中触发、角色级粒子内部冷却、生成/到达事件、接收时前后台、同/异/无色、晶球、充能效率、溢出、固定回能拆分、逐次日志和能量曲线。具名多目标、逐目标 landed / miss、独立 Aura/ICD、三层目标效果策略、按帧阶段窗口、显式/圆形/旋转矩形/胶囊/填充扇形扇出、声明式线性目标移动和一次回调聚合已成为伤害和命中产球的共同门；内置 M4 预设仍只用于机制验收，其面板、帧数和产球范围是 provisional。尚未完成 120 秒、来源核验的杜林首轮启动/循环预设，也没有敌人掉球、粒子几何飞行轨迹、真实 Boss AI 或真实技能产球数据库。

Milestone 5 已完成数据层基础和首批部分机制编译闭环，不等于正式杜林预设完成。杜林黑/白 E 已有倍率引用、裸伤/增伤、动作帧、黑 E 附着/ICD、白 E 无附着口径、回能、粒子和互斥状态向量，但仍有明确未解决项；尼可、洛恩、茜特菈莉、希诺宁以及其余角色/武器仍需逐技能机制插件与交叉验证。全角色/全武器技能数值的可查询目录也不等于完整的特有 ICD、动作帧、粒子、快照和机制可执行库；展示柜 UID 映射尚未形成通用 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig`，不得把测试 UID 的单次映射成功外推为全 UID 支持。

下一阶段按以下顺序推进，且每项都要保留全部历史 Golden 与两份已冻结的 1.41 Fixture：

1. 继续稳定 1.41 基础反应门：在已冻结 `single-target-v1` 默认兼容和 `nearby-wet-radius-v1` 候选/逐目标伤害 Golden 的基础上，补跨过 F70 callback 的长 Hitlag、来源 overlap 和多代次交错；必须继续证明已排队首次伤害、源目标 Wane、后续 Tick、既有副目标流与目标时钟各自的所有权，不得静默改写 v7/v8 或任何历史 Golden。
2. 继续补基础反应：扩展除已列明雷来袭之外的其他来袭元素顺序、来源 overlap、所有特殊/多 Aura 可达排列和边界向量，并继续覆盖逐元素敌方抗性与减抗状态的交叉组合；每个新增顺序都用新 Golden 锁定。另立事件契约补固定参考的 `DoNotLog` “Freeze Broken” 合成攻击及回调。完成这些基础机制后再考虑 Lunar 反应族，不得把当前经典反应路径外推为全反应覆盖。
3. 基础反应门稳定后，从冻结的 1.37 callback→Aura 衰减和 1.38 callback→同一目标 `Reactable.Tick` 边界继续补 Burning callback 内同步跨目标 Aura/反应命中与通用目标任务所有权，再决定 movement/phase、更多 Debuff/状态和敌方 AI 任务如何受 Hitlag；继续证明 Quicken→Bloom core zero-delay task、感电 `+10/+60` Tick 与 `+6` Wane、附着 ICD、ReactionA/B、草原核/结晶实体和玩家侧状态不被误归类或误冻。当前 v2 没有全目标 barrier，也不能声称完成同步跨目标 Burning；不得静默改写 v1–v8、legacy 或任何冻结 Golden。
4. 在当前玩家反应自伤基础上，按独立版本加入玩家 Aura、敌方攻击与玩家侧反应，再逐项设计治疗、死亡/复活、动态 Max HP、角色移动、非结晶盾和护盾强效；`clamp-and-continue` 不能冒充正式死亡逻辑。
5. 在快照阶段前建立可测试的 `OnBurning` 角色回调点，并以独立机制插件实现纳西妲 C2 的转化反应特殊暴击；未完成前继续输出明确限制，不向通用燃烧公式硬编码角色例外。
6. 建立覆盖全部 `SimulationResult` 字段的版本化顶层 Zod Schema；同时为任意代码插件增加可选的构建产物/源码摘要验证，减少只信任自报 descriptor/contentHash 的边界。
7. 把完整角色/武器目录逐项推进到 `mechanics-mapped`：补齐技能命中拆段、倍率来源、ICD、动作/取消帧、快照、产球、命座、专武和圣遗物效果，并为每个正式条目提供测试向量。
8. 建立版本化 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig` 管线，以 `skillDepotId` 优先消除旅行者/变体歧义，加入圣遗物目录与效果闸门，并用多个固定展示柜 Fixture 验证 UID 数据缺失/变更路径；“毕业站位”在标准核验前继续保持不可模拟占位。
9. 在当前静态角色姿态、四类局部几何和目标线性移动模型上增加角色移动/转向命令、追踪/索敌语义和命令/AI 驱动的敌方位置更新，再建立有来源的具体 Boss 状态机。
10. 映射杜林黑/白 Q，逐项补齐命座、专武和圣遗物效果后，才能组合 120 秒、0 初始能量、合法帧的来源核验预设；当前默认杜林预设中的示例魔法数继续保持 `provisional`。
11. 上述核心机制稳定后再增加玩家 HP/自伤/盾破裂、专用草原核生命周期/接触、敌方附着和反应构成展示；UI 只能消费核心结构化结果，不得自行补算伤害或事件顺序。当前基础机制优先级高于新增面板或曲线样式。
