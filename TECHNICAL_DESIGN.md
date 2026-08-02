# 技术设计：提瓦特伤害实验室

## 1. 当前目标

Vanilla v0.1 结果继续由兼容模式和 Golden Fixture 冻结。正式路径已经加入 60 FPS 合法帧时间线、角色无关的行动状态机、火/冰/水/雷/草 Aura、基础经典反应、`aura-v5`–`aura-v9`、ReactionA/B、Burning、绽放系、目标相位、感电 cleanup/传播/cadence、逐元素抗性和 24 标签/16 类经典反应发布门。1.45–1.51 依次冻结经典反应公式、普通直伤 Damage Group、数字元素施加、Burning/Swirl 反应所有施加、ReactionA/B 伤害组与基础反应调度根；当前 1.52 再为 Frozen 从正值耗尽到零的本地规范化 `Freeze Broken` 审计增加第七信任根。当前身份为 `schemaVersion = 1.52.0`、`engineVersion = 1.52.0-freeze-broken-attack`、Manifest 1.8.0。V1 root 为 `legacy-no-freeze-broken-attack-callback` / `legacy-no-freeze-broken-attack-callback-v1` / `sha256:2831fac7a15189b772db58c245ffd8091b1128b5fd5ea516885f03a99961c838`；V2 root 为 `fixed-gcsim-freeze-broken-attack-normalized-v2` / `gcsim-b4ae769-freeze-broken-attack-normalized-provisional-v2` / `sha256:71646812a4061c9ef2d4ae8ca7cef1abaa79d718c8831ffaf5e3f27832955e14`。前六份 root 与 V1.51 wire/Manifest/Fixture 全部冻结。所有 1.51 及更早输入迁移到 1.52 时为新 `freezeBrokenAttackModel` 选择 V1；只有原生 current 配置可显式选择 V2。两份 root 都标记 `officialServerTruth: false`、`completeGcsimParity: false`；V2 仍只是 `reference-audit-only-not-dispatched`。当前优先稳定基础反应，不扩展 UI，现有展示只读核心结构化结果。公开仓库为 <https://github.com/mixuanda/genshin-elemental-reaction-sim>。

## 2. 包边界

```text
apps/web
  只负责输入、调用核心和渲染结构化结果。

packages/schemas
  TypeScript 公共类型、Zod Schema、字段路径错误、版本迁移。

packages/reaction-formulas
  不可变的经典反应等级表、倍率、语义 ID、来源状态和内容哈希；无 DOM、无模拟器依赖。

packages/icd-profiles
  不可变的普通直伤 Damage Group、数字元素施加 reset/sequence、ReactionA/B 伤害组策略、基础反应调度策略、Freeze Broken 审计策略、来源状态和独立内容哈希；
  无 DOM、无模拟器依赖，各类 profile/root 不得混用。

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
  1.42 另增兼容默认与 aura-v9 EC global cadence safety 向量，并保留 1.41→1.42 的 aura-v8 + single-target identity-only 迁移。
  1.44 新增兼容默认 Golden 和 target-phase-v3 Burning callback delivery 实际结果/变异向量，不改写 1.42 Fixture。
  1.45 新增公式根身份兼容 Golden，不改写 1.44 或任何更早 Fixture。
  1.46 新增普通直伤 Damage Group 专用向量与默认兼容 Golden，不改写 1.45 或任何更早 Fixture。
  1.47 新增数字元素施加 ICD 专用向量与默认兼容 Golden，不改写 1.46 或任何更早 Fixture。
  1.48 新增 Burning Tick/Swirl 传播反应所有施加专用向量与默认兼容 Golden，不改写 1.47 或任何更早 Fixture。
  1.49 新增默认兼容与 Burning reset-boundary V1/V2 对照 Golden，不改写 1.48 或任何更早 Fixture。
  1.50 新增 ReactionA/B 伤害组 F+29 reset-task/FIFO 专用 Golden 与历史 Fixture 逐字节完整性门，不改写 1.49 或任何更早 Fixture。
  1.51 新增基础反应调度 V1/V2 专用 Golden、V151→V150 投影与历史 Fixture 逐字节完整性门，不改写 1.50 或任何更早 Fixture。
  1.52 新增 Freeze Broken V1/V2 专用 Golden、V152→V151 投影与历史 Fixture 逐字节完整性门，不改写 1.51 或任何更早 Fixture。
```

依赖方向：

```text
reaction-formulas <- schemas
reaction-formulas <- sim-core
reaction-formulas <- game-data
icd-profiles <- schemas
icd-profiles <- sim-core
icd-profiles <- game-data
reaction-formulas + icd-profiles + schemas + sim-core + game-data <- mechanics
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

`migrateConfig()` 负责把无版本及 `0.1.0`–`1.51.0` 配置迁移到 `1.52.0`。1.35→1.51 的迁移继续作为冻结历史契约；1.51→1.52 只注入 V1 `freezeBrokenAttackModel` 并推进身份。无版本与更早输入也为该新字段注入 V1，绝不静默升级到 V2；原生 current 配置才可显式选择 Freeze Broken V2。迁移原样保留公式、普通直伤 Damage Group、数字元素施加、Burning/Swirl 施加策略、ReactionA/B 伤害组、基础反应调度、Aura、传播、玩家伤害、目标时钟、目标任务、反应交付、逐元素敌方抗性和默认数值，不按技能名猜测 application group，也不物化固定参考合成攻击。历史输入夹带未来 model/selector 会 fail-closed。精确 1.44–1.52 均可声明 `target-phase-v3`；1.43 仍只是未发布 energy wire 的保留版本号。当前 `engineVersion` 为 `1.52.0-freeze-broken-attack`。

目标时钟的版本化输入是：

```ts
targetClockModel:
  | { mode: "disabled" }
  | { mode: "target-local-hitlag-v1" };

targetTaskModel:
  | { mode: "legacy-event-heap-v1" }
  | { mode: "target-phase-v1" }
  | { mode: "target-phase-v2" }
  | { mode: "target-phase-v3" };

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

reactionFormulaModel: {
  mode: "classic-formula-profile-v1";
  profileId: "gcsim-b4ae769-classic-provisional-v1";
};

directDamageGroupModel: {
  mode: "fixed-gcsim-direct-damage-group-v1";
  profileId: "gcsim-b4ae769-damage-groups-provisional-v1";
};

elementalApplicationIcdModel: {
  mode: "fixed-gcsim-elemental-application-v1";
  profileId: "gcsim-b4ae769-elemental-application-provisional-v1";
};

reactionOwnedElementalApplicationModel:
  | {
      mode: "fixed-gcsim-reaction-owned-application-v1";
      policyId: "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v1";
    }
  | {
      mode: "fixed-gcsim-reaction-owned-application-v2";
      policyId: "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v2";
    };

basicReactionSchedulerModel:
  | {
      mode: "legacy-immediate-basic-reaction-scheduler-v1";
      policyId: "legacy-partial-basic-reaction-scheduler-immediate-attachment-v1";
    }
  | {
      mode: "fixed-gcsim-basic-reaction-scheduler-v2";
      policyId: "gcsim-b4ae769-basic-reaction-scheduler-provenance-provisional-v2";
    };

freezeBrokenAttackModel:
  | {
      mode: "legacy-no-freeze-broken-attack-callback";
      policyId: "legacy-no-freeze-broken-attack-callback-v1";
    }
  | {
      mode: "fixed-gcsim-freeze-broken-attack-normalized-v2";
      policyId: "gcsim-b4ae769-freeze-broken-attack-normalized-provisional-v2";
    };

hit.directDamageGroup?: {
  icdTag: string;
  icdGroup: GcsimDamageGroupId;
};

hit.application?: {
  gaugeUnits: number;
  icd:
    | { mode: "no-icd-v1" }
    | {
        mode: "legacy-boolean-profile-v1";
        icdTag: string;
        profileId: string;
      }
    | {
        mode: "fixed-gcsim-application-v1";
        icdTag: string;
        groupId: PublicGcsimElementalApplicationGroupId;
      };
};

hit.targetHitlag?: {
  haltFrames: number; // 有限数，0 <= haltFrames <= 600，可为小数
  factor: number;     // [0, 1]
};
```

1.46 的 `directDamageGroup` 只适用于普通直接伤害，不替代 `hit.application` 或 Aura 引擎的元素附着 ICD。公共 Schema 固定全部 58 个来源组 ID，但拒绝普通命中使用内部 `reaction-a`、`reaction-b`、`burning` 三组；有 descriptor 的命中必须提供显式、非空 hit ID，Tag 必须是有限长度、无控制字符的非空字符串。`AbilityBlueprint` 1.8 可选携带同一 descriptor，编译器逐字段原样复制；1.7→1.8 迁移保持字段缺失，现有 Blueprint 和预设不会因数据名称相似而被自动绑定。

运行时为每个目标建立独立 `DirectDamageGroupEngine`。引擎内部用嵌套 Map 保存 `(sourceActorId, icdTag)`，避免分隔符拼接碰撞；`icdGroup` 不属于 key。同一 Tag 在窗口中切组时，共享计数器但用当前组的 damage sequence，reset timer、`windowStartGroup` 与窗口起点仍归开窗组。调用必须按非递减全局帧；未知组、无效帧或倒序输入在消费前 fail-closed。

固定 profile 采用 `tailPolicy: "clamp-last"`：hitIndex 超出数组后继续使用最后一项。reset 截止为 `windowStartFrame + resetFrames - 1`，该帧先关闭旧窗口再把当前命中作为新窗口 index 0。Miss 在目标解析阶段被过滤，不调用引擎；landed 但 `damage: "immune"` 的目标仍消费；damage sequence 为 0 的 landed 命中也消费并保留普通直接 DamageEvent，只是其 potential/final/display 与直接伤害构成为 0。

伤害计算先读取命中配置的 `groupMultiplier`，再依次运行伤害插件，最后乘固定 sequence multiplier。因此 `effectiveMultiplier = postPluginMultiplier × sequenceMultiplier`，插件绝对覆盖也不能复活零槽。零槽只关闭通用 `OnEnemyHit` 许可并写入 `damageGroupOnEnemyHitAllowed: false`；Aura/反应、目标 Hitlag、草原核接触、hit-confirm skill particles 和其他技能回调保持执行。内部 ReactionA/B/Burning 伤害交付继续走各自既有管线，不重复进入普通直伤引擎。

1.47 的元素施加 profile 为 `gcsim-b4ae769-elemental-application-provisional-v1`，保留来源中的 58 个组；`reaction-a`、`reaction-b`、`burning` 三组由引擎内部拥有，公共直接命中只能选择其余 55 组。固定应用状态同样按“目标实例 + 来源角色 + `icdTag`”隔离，Group 不进入 key。开窗组拥有 reset timer，当前命中的组选择数字 application sequence；tail 固定 clamp，reset 固定在 `windowStartFrame + resetFrames - 1`，边界执行 reset-before-hit。每个 evaluated attempt 即使 multiplier 为 0 也消费槽位；No ICD 不创建窗口。有效附着量严格为 `nominalGaugeUnits × applicationMultiplier`，因此纳西妲 Skill 的 `1.5` 槽保持数值语义。

legacy selector 保留旧 `(actor, tag, profile)`、`windowStartFrame + resetFrames`、repeat/clamp 与 target-global Burning 状态语义，不被当前 fixed state machine 偷换。带应用的物理命中会在 Schema 阶段拒绝，包括从缩放角色继承出的 physical 元素。1.47 的直接命中行保持精确 wire；1.48 的统一 `elementalApplicationIcdLog` 用 `configured-direct-hit | burning-tick | swirl-propagation` 区分来源。evaluated 行闭合 selector、窗口、序列、名义/有效 Gauge 和 reciprocal 命中解析/伤害/反应伤害/目标相位引用；跳过行明确说明原因且不推进窗口。

1.48 的策略根只编译两种 trusted channel：Burning Tick 固定映射到 `ICDTagBurningDamage / burning / 1U Pyro`；Swirl AoE 传播按火/水/冰/雷映射到 `ICDTagSwirl* / reaction-a / propagated Gauge`。Swirl 的 source-target 伤害段没有 Durability，不生成 application 行。配置的直接命中与反应所有命中在 `ElementalApplicationIcdEngine` 中使用分离的 configured/reaction-owned 状态图，不互相读写。Burning 使用受信任的 target-global observable projection，Swirl 使用 per-target/source/tag 窗口。EC/Wane、Overload、Superconduct、Shatter、Bloom/Burgeon/Hyperbloom、Quicken 后续、core damage 与 Crystallize damage/lifecycle 不生成反应所有 application 行。策略根的 `sameFrameOrdering` 固定为 `provisional-source-task-insertion-dependent`，不是官服同帧顺序声明。

1.49 保留上述 V1 精确语义，并新增 V2 channel-specific reset boundary。Burning Tick 属于 `enemy-target-task`：在 `resetAtFrame` 精确截止帧先尝试、后由 core reset，因此仅 `frame > resetAtFrame` 才重开窗口；Swirl follow-up propagation 仍是 reset-before-attempt，使用 `frame >= resetAtFrame`。配置选择、Manifest policy root、日志 selector、decision policyId 与 `resetSchedulePolicy` 必须闭合为同一版本。V2 仍是 source-derived provisional 解释，不是官服真值或完整 gcsim parity。

1.51 的基础反应调度与 1.49 的 application reset、1.50 的 ReactionA/B damage reset 是三个独立状态边界。V1 在每条 Swirl propagation attack 结算后立即提交未反应的 Aura，精确保留 V150 兼容语义。V2 先解析同一帧已经排入队列的全部 Swirl attack，再以更晚的 `reactionAuraAttachment` 任务按 insertion sequence 提交每个未反应附着；commit 只消费 Aura 引擎预先签发的一次性 opaque token，不再次运行 application ICD 或反应判定，跨引擎、伪造、复用和过期 token 均 fail-closed。`basicReactionSchedulerLog` 用 attack/commit 配对、disposition、任务序号与 reciprocal 外键闭合这一顺序。它当前只为 Burning/Swirl 的窄切片提供 provenance，不建立感电、Quicken→Bloom、草原核、结晶、玩家状态或所有目标共享的 barrier。Burning 使用单调 generation 阻止旧 callback 复活；这是本地安全偏差，不声称逐字复刻固定 gcsim 的 frame-token 重启行为。

1.52 的 Freeze Broken 与碎冰 DamageEvent、ReactionA/B 和基础反应调度状态都彼此独立。V1 固定 V1.51 的“无 callback、无日志”兼容结果。V2 观察 Frozen generation 的正值到耗尽 transition，只接受五类本地来源：自然衰减、`poise-consume`、`shatter-consume`、`swirlCryo` 消耗和 `crystallizeCryo` 消耗；mixed Hydro + Frozen Swirl 保留有序 Hydro/Cryo Swirl，而 audit row 绑定消耗 Frozen 的 Cryo 分支。Melt、Superconduct 和未耗尽的部分消耗不得生成行。每个合法 transition 恰好一行，生成行时顶层 `mechanicsStatus = "partial"`；零行结果保持 `complete`。

V2 root 固定参考 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 中 `Freeze Broken` 的合成攻击与可观察顺序，但本地规范化为 `executionStatus: "reference-audit-only-not-dispatched"`。行内 `attack.sourceIsSim` 与 `attack.doNotLog` 均为 true，`damageEventId` / `hitResolutionLogId` 必须为 null；核心不消费参考 crit RNG draw，不创建 DamageEvent/HitResolution，不增加命中、总伤、DPS 或曲线点。固定参考的 `doNotLog` 在该路径上没有被读取，本地也尚无 callback bus、Mona bubble/impulse、全局事件订阅者或其他回调副作用；因此这份 root 只证明来源与本地规范化边界，不证明参考执行等价、官服真值或完整 gcsim parity。

公共配置不暴露固定参考中的 defense-halt bonus。Schema 在输入边界强制 `0 <= haltFrames <= 600` 和 `0 <= factor <= 1`，负数、非有限数或超过 600 帧的单次 Halt 都会拒绝。每次扩展帧采用 `ceil(ceil(haltFrames) × (1 - factor))`；命中所在目标 Tick 先完成，新增暂停从下一全局帧开始。同目标同帧多次命中叠加冻结帧，不同目标隔离。Miss 不改变时钟；1.39 在 v2 下仍会为配置了 Hitlag 的 Miss 写入 `blockedReason: "TARGET_MISS"`、`applied: false` 的审计。landed 但数值免疫或 Aura/命中回调阻断的目标仍应用 Hitlag；零扩展只记录 `ZERO_EXTENSION`。这些数据状态固定为 `fixed-gcsim-provisional`，不代表官服实测真值。

`targetTaskModel` 与 `targetClockModel`、`reactionEngine` 分别建模。四种模式各自有独立 wire contract：历史兼容路径使用 `legacy-event-heap-v1`；1.37 v1 与 1.38 v2 冻结原语义；精确 1.44–1.52 可显式开启 Burning callback-owned 零延迟跨目标交付。v3 要求 `legal-frame-v1 + 60 FPS + aura-v7/v8/v9`，迁移保留输入原模式，不自动 opt-in。Quicken→Bloom follow-up、感电 callback/Wane、正延迟子反应与其他 core work 继续留在各自冻结队列。统一 application 日志只记录交付结果，不会把 v3 扩张为通用全目标 barrier。

`reactionDeliveryModel` 与 Aura、目标任务和目标时钟分别建模。`deferred-event-heap-v1` 是所有现有预设、兼容配置及迁移结果的默认值，并保留 1.38 及更早的父段先编号、碎冰子段稍后交付顺序。`shatter-recursive-zero-delay-v1` 从精确 `1.39.0` / `1.39.0-shatter-recursive-delivery` 身份开始可显式选择，后续迁移会原样保留该选择；它要求 `timeline.mode = legal-frame-v1`、`fps = 60`，并只配合当前身份允许的 `aura-v7`/`aura-v8`/`aura-v9`。它只让零延迟碎冰子伤害在同一帧、同一目标、同一来源上下文中先于直接父段或嵌套 Overload 父段交付；其他反应、目标任务和周期事件仍沿用原调度。因为子段先编号，递归模式允许 `parentDamageEventId` 合法前向引用；结果 Schema 强制连续 DamageEvent ID、无环父链、同帧/目标/来源约束，以及唯一 Shatter `reactionDamageLog` 的 reciprocal 引用。迁移绝不从 deferred 自动切换到该模式。

`electroChargedPropagationModel` 只控制感电实际伤害 Tick 的目标集合，不修改 Aura、ICD、ReactionB、周期流或目标时钟所有权。`single-target-v1` 是默认兼容路径，只生成源流目标的伤害。`nearby-wet-radius-v1` 在每个 Tick 执行点构造一次 `electroChargedPropagationAudit`，并固定写入 `mechanicsDataStatus: "community-provisional"`：源目标总是第一项且选中；其余目标按注册顺序读取实时 Hydro Gauge，再以源目标位置、目标位置和圆形 hurtbox 计算距离阈值。候选会明确记录 `SOURCE_STREAM_TARGET`、`NEARBY_WET_IN_RANGE`、`NO_HYDRO_AURA`、`OUT_OF_RANGE`、`POSITION_UNRESOLVED` 或 `SOURCE_POSITION_UNRESOLVED`，被选中的每个目标都必须反链唯一 `hitResolutionLogId` 与 `damageEventId`。副目标伤害使用源 Tick 的 owner、snapshot、等级、EM、反应增伤和同一反应伤害批次；每个目标独立应用其雷抗与伤害免疫。

附近传播只交付伤害，不施加 Hydro/Electro Aura，不递归搜索下一层，不创建或接管副目标感电流，不刷新/重置副目标 `+10/+60` cadence，也不为副目标安排 `+6` Wane。副目标已有感电流继续由其原 owner 和 generation 独立推进。这个选择与半径是显式 `community-provisional` 规则；固定 gcsim 提交的经典 EC 实现仍是 `NewSingleTargetHit`，因此本模式不得标记为 gcsim parity 或官服精确。

`aura-v9` 不改变上述传播选择，只修复源流自身的全局 cadence、Wane listener 和 cleanup 审计。在新 generation 建立时，F+10 首次伤害任务与 F+70 后续 callback 必须各自独立排入全局事件队列；refresh 更新未来 callback 的 owner/snapshot，但不重排 cadence，也不修改已经排队的 F+10 snapshot。`target-local-hitlag-v1` 仅重投影该目标的 `Reactable.Tick` / Aura 衰减和 cleanup 截止，不能暂停 F+10、F+70 或实际伤害后的 F+6 Wane。

F+70 callback 在执行点重读水雷共存：存在时结算伤害并排下一个 +60f callback；缺失时写 `operation: "tick-skipped"`、`cadenceStatus: "dormant"`、`nextTickFrame: null`，不生成伤害，也不伪造新 callback。F70 及更早恢复仍由已排队 callback 观察；F71 及以后恢复保持 dormant，除非另一个明确的新 generation 合法启动。`waneListenerActive` 只在实际非零 EC 伤害且当时水雷共存时为真；Wane 对 Hydro 和 Electro 的每个来源槽各自削减最多 `0.4U`，整体状态仍由各元素最大来源槽决定。generation guard 必须让旧 Wane、旧 callback 和旧 cleanup 对替换代次无效。

若 Quicken→Bloom 已武装 next-target-Tick cleanup，但当前 generation 在 deadline 到达前因 Wane 或其他合法停止而结束，cleanup 不得重复停止或抛出所有权错误；它返回 `ended-before-deadline` / `ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP`，复用唯一 terminal periodic row，并与 `reactionTaskLog`、`targetPhaseLog`、`TargetStateTimeline` 建立 reciprocal 引用。`scheduled | dormant | stopped | superseded` cadence 结果、`lastCallbackFrame` 与 Wane listener 必须在 pending-at-end 和已解析 cleanup 中反映同一代次的实际末态。

这些语义交叉核对固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的传统 Electro-Charged 单目标路径；本项目额外加入单调 generation guard 和完整 reciprocal 审计以避免陈旧任务污染。该合同固定标记为 `fixed-gcsim-provisional`，不包含 Lunar-Charged，也不声称官方帧序、Aura 规则或完整 gcsim 精度。

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

输出侧当前的精确 1.52 `simulationResultV152Schema` 覆盖当前 `SimulationResult` 全部已声明字段，同时保留身份严格的冻结 `simulationResultV151Schema`、`simulationResultV150Schema` 及更早精确版本。V152 在 V151 的全部证明之上，再闭合 `freezeBrokenAttackModel`、Manifest `freezeBrokenAttackRoot`、Frozen 耗尽来源与 `freezeBrokenAttackLog`。public Zod 与 `assertTrustedSimulationResultV152()` 都会 fail-closed；外部 JSON 和持久化结果必须走完整 Zod parse。冻结 V151 及更早版本继续由各自精确 Schema/断言接纳。V2 行只能是 audit-only：正触发需恰好一行，Melt/Superconduct/部分消耗需零行，且 `damageEventId` / `hitResolutionLogId` 固定为 null。当前结果 wire 仍只提供已建模任务与 Freeze Broken provenance，不能因此声称 callback bus、参考 RNG、副作用、完整 Ability/Aura、动作快照输入来源、角色数据库或官服数据已可全链重放。

`target-phase-v2` 结果含感电自然到期或 cleanup transition 时，trusted assertion 会按需复用 public 边界的 `targetPhaseV2ResultReferencesSchema`，把周期行、reaction task、目标时间线、Aura 链和 transition 的互反引用纳入同一验收；无该 transition 的普通结果跳过这份专用 Zod 投影。前文“零拷贝”仅指通常路径：该条件分支会克隆专用 facet，但不会运行或克隆完整结果 Schema。超激化/蔓激化的 `consumed = 0` 之外，`after` 与 `before` 也要求精确相等。

每次结果都返回 `runManifest`：

```ts
version                  // 当前 1.8.0；冻结 V151 为 1.7.0，V150 为 1.6.0，V149 为 1.5.0
identityAlgorithm        // fnv1a32-v2
schemaVersion
engineVersion
dataVersion
configHash
resolvedRuntimeOptions   // energyMode / critMode / compatibilityMode / randomSeed
plugins                  // 有序 descriptor + contentHash
reactionFormulaRoot      // V145 起固定的公式 profile/root
directDamageGroupRoot    // V146 固定的普通直伤 reset/damage-sequence root
elementalApplicationIcdRoot // V147 固定的数字元素施加 reset/application-sequence root
reactionOwnedElementalApplicationRoot // V149 绑定配置选择的 V1/V2 Burning/Swirl 策略 root
reactionDamageGroupRoot // V150 绑定配置选择的 V1/V2 ReactionA/B 伤害组 root
basicReactionSchedulerRoot // V151 绑定配置选择的 V1/V2 基础反应调度 root
freezeBrokenAttackRoot   // V152 绑定配置选择的 V1/V2 Freeze Broken audit root
reproducibilityKey       // gdl-v2-fnv1a32-*
```

配置先规范化再哈希；每一次前缀探测和最终模拟都从 `createRuntime()` 建立全新插件实例，防止复用有状态插件污染结果。声明式插件由核心对规范化效果生成内容哈希；任意代码插件的 descriptor/contentHash 仍是插件作者提供的受信声明。当前 `configHash` 和 reproducibility key 仍使用非加密的 32-bit FNV-1a，仅用于确定性漂移检测；它已知可碰撞，不能作为唯一运行身份、完整性证明、来源认证或签名。下一 Schema/Manifest 版本应迁移到 SHA-256，并在兼容读取旧身份时明确算法。

1.46 的普通直伤日志保存配置倍率、每个代码/声明式插件造成的逐插件倍率 trace、插件后倍率和固定序列后的最终倍率，并把 `pluginTraceVerification` 固定为 `structural-only-unverified-runtime-output-v1`。核心生成结果时这些行来自本次执行，但公开 wire 本身没有附带可重放代码或可信执行凭证；外部验证者只能闭合 trace 的数值链、插件顺序/声明身份与最终 DamageEvent，不能证明插件真实输出、代码未被替换，或排除 trace 与插件后倍率的协调篡改。

## 4. 确定性与排序

相同时间的事件排序为：

1. `action`
2. 目标任务相位：冻结 v1 的 target-owned callback/Aura 衰减，v2 的每目标 callback→同目标 `Reactable.Tick`，或 v3 的 callback→callback-owned Burning delivery 微事件→该目标 `Reactable.Tick`（按目标注册顺序分配子优先级）
3. `buff` / `debuff`
4. `energy` / `particleSpawn` / `particleReceive` / 周期 Aura、冻元素、激元素、结晶碎片/护盾/草原核到期检查 / 结晶碎片与草原核生成
5. `hit` 与继承触发元组的 Quicken→Bloom core zero-delay task
6. legacy 周期反应 Tick 准备
7. 独立反应伤害
8. 周期反应延迟 Aura 削减
9. 显式结晶碎片拾取
10. 同类型同时间按插入序号

状态在 `end <= hitTime` 时先过期，因此恰好处于结束边界的命中不享受该状态。该规则由测试固定。

普通直伤 Damage Group 不是新的队列事件类型。每个 hit 先完成逐目标命中解析；Miss 在此结束且不消费。landed 目标随后在该目标的 `DirectDamageGroupEngine` 消费一个序列槽，再继续执行快照、Aura/反应、Hitlag、草原核接触、插件和 DamageEvent 生成。固定序列只在插件全部结束后进入最终伤害乘区，因此 sequence 0 不会倒推取消已经合法发生的 Aura/状态/技能回调。reset 边界帧由状态机内部按 reset-before-hit 处理，不改变全局事件 queue 的排序。

ReactionA/B 反应伤害组则在 1.50 显式接入 core task 序号。ReactionA 的固定 damage sequence 是 `[1, 1, 0]`，尾部 clamp 使第三次及以后继续为 0；ReactionB 是 `[1, 0]`。两者都按 `targetId + sourceActorId + icdTag` 分窗口，damage source 不进 key。V1 在 `windowStart + 30` 的下一次尝试时 lazy reset；V2 在开窗时立即排定 `windowStart + 29` 的 priority-5 reset task，并与同帧反应伤害尝试按全局插入序/`eventSequence` FIFO 执行。尝试序号早于 reset 时消费旧 generation；reset 序号更早时先删除旧窗口，后续尝试再开新 generation。递归零延迟 Shatter 继承 parent 任务序号，并只在 parent 之前确实存在更早的当帧 reset 时先执行该 reset；之后 heap 再遇到已执行 reset 时以可审计 stale/no-op 收敛。这只是列明反应伤害窗口的局部任务模型，不是通用 scheduler parity。

元素施加 ICD 也不是新的队列事件类型。每个配置应用的直接 hit-target attempt 先经过命中解析、目标 Aura 许可和机制截断门；只有可评估 attempt 才调用对应目标的应用状态机。固定 selector 在该命中 Aura 子阶段计算数字 multiplier 并形成有效 Gauge，之后 Aura 引擎按既有反应顺序处理；乘数为 0 的 evaluated attempt 仍推进序列，skip attempt 不推进。reset 边界同样在状态机内执行 reset-before-hit。普通直接命中的应用行按事件/目标尝试顺序稳定输出；反应拥有的后续应用保持原队列与日志，不伪装成普通 hit attempt。

因此同帧行动会先检查/消耗能量，随后才接收该帧到达的粒子；同帧先产生的充能效率 Buff 则会在粒子接收前生效。`legacy-event-heap-v1` 中普通命中仍先于周期 Tick 准备。v1/v2 只保持各自冻结目标边界；v3 则在实际 Burning owner callback 之后、owner `Reactable.Tick` 之前安排一个更晚的微事件元组，按注册顺序将范围命中交付给每个接收目标。尚未运行 F Tick 的接收目标只物化到 F-1，用当前 Aura 结算后再由该目标 Tick 推进；已运行 Tick 的目标在其后应用。该微事件只同步交付根 Burning 范围伤害/附着；其触发的正延迟 Overload 等子反应仍排入全局 heap。碎冰的状态检查和独立 `reactionDeliveryModel` 继续按冻结契约执行。这些子阶段语义都只是 `fixed-gcsim-provisional`，后续若要扩展为通用目标任务或新实测帧规则，必须作为引擎版本变更处理。

Burning 在 `legacy-event-heap-v1`、v1 和 v2 中继续按各自冻结契约运行，实际范围伤害仍在后续全局 core 阶段结算。精确 1.44–1.52 的显式 `target-phase-v3` 可在 owner callback 内以零延迟微事件同步交付跨目标范围命中；目标 Hitlag 造成的陈旧 wake 会先重投影。v3 不改写前三种模式，也不是完整 gcsim target phase、官方真值或完整 gcsim 精度。1.48 只将实际 Burning Tick 的 target-global observable projection 纳入反应所有施加日志，不重写 1.47 的普通直接命中日志；1.49 只按任务所有权区分 V1/V2 的精确 reset 边界。1.50 的 ReactionA/B 伤害组任务与该施加状态保持独立，1.51 的基础调度根也只管理列明的 attack/commit 边界。

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

兼容模式保留已经冻结且合法的旧版伤害语义，Golden 回归容差为 `1e-8` 相对误差。精确 V145 禁止所有命中携带 `ampBase`；冻结 V144 及更早 wire 继续保留各自已经合法的 legacy 覆盖。Aura 模式只允许 `debugAllowReactionOverride: true` 与非 `none` 的 `reactionOverride` 组合；非法反应、等级、倍率和非有限输入均 fail-closed。

1.45 的公式叶数据位于 `packages/reaction-formulas`。`gcsim-b4ae769-classic-provisional-v1` 固定 1–100 级反应基准、融化/蒸发基础倍率、经典转化倍率、扩散自身/传播通道及超激化/蔓激化倍率；其完整规范化 payload 由 `sha256:7ae4ee955e0c7986c47931cff596694c8cd4754b48df90e0ad1cf092738ccafd` 标识。配置哈希绑定 `reactionFormulaModel`，复现键绑定 Manifest 中完整 root。profile 明确携带 `officialServerTruth: false`、`completeGcsimParity: false`；固定提交只是可复现参考，不是官服验证。

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
- `directDamageGroupLog`：V146 起为每个 landed 普通直接伤害段记录 bypass/evaluated、开窗组、序列、插件 trace、最终倍率与 reciprocal 伤害外键。
- `elementalApplicationIcdLog`：V147 为每个配置 application 的普通直接命中目标尝试记录 evaluated 或明确 skip、selector、窗口、数字倍率、名义/有效 Gauge 与 reciprocal 命中/伤害外键。
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

历史字段名 `defReduction` 实际保存有符号 defense adjustment：负值表示减防，正值表示增防。V150 及更早 wire 继续按该算术冻结，但名称具有方向歧义；后续只能通过新 Schema 版本迁移到明确字段名，不能原地偷换符号。旧内部名称 `ReactionALimiter` / `ReactionBLimiter` 已标记 deprecated；新 API、结果字段和机制数据应使用 ReactionA/B damage group 术语。

胶囊几何由 `start / end / radius` 定义。核心把目标中心投影并夹取到有限线段，再比较最近距离与 `radius + hitboxRadius`；零长度线段确定性退化为端点圆。`hitResolutionLog` 为胶囊保存两个端点、扫掠半径、最近距离与总阈值。

填充扇形由 `origin / radius / directionDegrees / angleDegrees` 定义。目标中心在扇形内时距离为 0；否则核心取其到圆弧和两条有限径向边的最小欧氏距离，再与圆形目标的 `hitboxRadius` 比较，因此径向边与弧端角点擦碰不会因只比较中心角度而漏判。`angleDegrees = 360` 确定性退化为圆盘。

四种形状默认使用世界坐标。`coordinateSpace: "actor-local"` 要求配置存在同施放者 ID 的 `actorPoses` 项；核心以朝向角旋转形状的点、矩形旋转角或扇形方向，再平移到角色位置，随后才与命中帧目标位置求交。结果保留原坐标空间和静态姿态，但形状字段始终是实际参与求交的世界坐标。姿态不会随切人、冲刺或技能自动变化，也不会朝目标自动旋转。

`enemy.targetPhases` 把相同三层策略提升为有序、不重叠的 `[startFrame, endFrame)` 场景窗口；开始帧立即生效，结束帧立即恢复或切换到相邻阶段。逐击 `effects` 可完整覆盖活动阶段，脚本化 Miss 仍拥有最高优先级。每条 `hitResolutionLog` 都保存 `targetEffectSource` 和活动 `targetPhaseId`，因此阶段策略、逐击覆盖和默认正常路径可区分。阶段由输入配置提供，当前不包含 Boss AI、血量阈值或动作状态自动驱动。

目标自身的等级、抗性、减防、初始 Aura、初始位置、线性移动分段和碰撞半径已逐目标解析；现有行动 `debuffs` 仍是场景全局敌方状态，会同时影响所有已注册目标。把 Debuff 绑定到单个目标属于后续 Schema 扩展。

这一分层参考锁定 gcsim 提交中 [`Combat.attack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go) 的 `AttackWillLand` 前置门、[`Enemy.HandleAttack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go) 中反应/实际伤害/附着/回调的顺序，以及 [`Target.AttackWillLand`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/target/target.go) 的目标/范围检查边界。gcsim 在这些文件中没有统一的通用无敌开关，因此本项目要求场景显式选择三层策略；这不是对所有官服无敌阶段行为的验证。当前只复制了二维圆形、旋转矩形、有限线段胶囊、填充扇形与预声明线性位置更新的最小子集，不是 gcsim 的完整形状、运动控制或目标系统。

### 6.1 Aura / ICD 最小状态机

`packages/sim-core/src/aura.ts` 与 `packages/sim-core/src/elemental-application-icd.ts` 都是无 DOM 依赖的纯状态机。1.47 命中通过以下字段声明附着：

```ts
application: {
  gaugeUnits: 1,
  icd:
    | { mode: "no-icd-v1" }
    | {
        mode: "legacy-boolean-profile-v1",
        icdTag: "ability-stream",
        profileId: "declared-profile-id"
      }
    | {
        mode: "fixed-gcsim-application-v1",
        icdTag: "ability-stream",
        groupId: "default"
      }
}
```

普通 Aura 的初始耐久为有效元素量的 `0.8` 倍。兼容模式 `aura-v1/v2` 保留历史的 `420 + 6 × nominalU` 寿命，因而 1U 回放仍为 426 帧；opt-in `aura-v3`–`aura-v9` 按固定 gcsim 提交的 `25 durability = 1U` 换算使用 `420 + 150 × nominalU`，1U 为 570 帧。fixed selector 使用数字 application sequence、末项 clamp 和 `start + resetFrames - 1` reset-before-hit，状态 key 为目标、来源角色与 Tag；No ICD 每次使用倍率 1 且不建立窗口。legacy selector 则继续使用 1.46 及更早冻结的 boolean Profile：状态 key 为目标、角色、Tag 与 Profile，reset 在 `start + resetFrames`，tail 依 Profile repeat/clamp；内置 Burning 保留 target-global legacy 状态。两套状态机显式分离，迁移不会把旧 boolean 组猜成 fixed 数字组。

legacy 角色特有组必须在 `reactionEngine.icdProfiles` 中显式声明：

```ts
icdProfiles: {
  "durin-skill": {
    resetFrames: 18,
    applicationSequence: [true, false, false]
  }
}
```

未知 legacy/fixed 组在 Schema 校验和直接状态机调用两层都失败；不得静默退回默认 ICD。内置 legacy `default` / `no-icd` 也禁止由配置覆盖。固定元素施加 root 只交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，标记为 `fixed-gcsim-provisional`，不是官方或官服真值。

当前增幅反应消耗规则与 gcsim 的最小语义对齐：

- 火打冰：正向融化，2 倍伤害基础，按 2 倍来袭元素量消耗冰 Aura。
- 冰打火：反向融化，1.5 倍基础，按 0.5 倍消耗火 Aura。
- 水打火：正向蒸发，2 倍基础，按 2 倍消耗火 Aura。
- 火打水：反向蒸发，1.5 倍基础，按 0.5 倍消耗水 Aura。

如果消耗型反应发生，剩余来袭元素是否继续参与同击后续反应由对应 Aura 版本的显式顺序决定，不由 UI 或手工标签猜测。正式 `aura-v1`–`aura-v9` Schema 都禁止非 `none` 的手工 `reaction`；只有 `debugAllowReactionOverride: true` 时可使用 `reactionOverride`。

当前状态机为每个已注册目标建立独立的火/冰/水普通 Aura 与 ICD 实例；`aura-v2` 另允许雷普通 Aura、独立冻元素耐久，并为感电保留同目标水雷共存；`aura-v3` 再加入草普通 Aura、激元素和普通 Aura/激元素的逐来源槽；`aura-v4` 增加目标级 Burning Marker/Fuel、周期代次、归属和内置燃烧附着 ICD；`aura-v5` 增加有序基础反应矩阵、Bloom 审计和草原核管理器；`aura-v6` 增加雷来袭有序链及水来袭 Frozen→EC guard；`aura-v7` 再增加 Quicken→Bloom 实时 Aura 核心任务和 Burning refresh 计数修正；`aura-v8` 只新增该 follow-up 耗尽 Hydro 后的 EC next-target-Tick cleanup；`aura-v9` 增加感电全局 cadence/Hitlag/Wane 所有权。1.41 的传播模型不改变这些 Aura 状态机，只在感电伤害 Tick 交付点按显式半径增加独立副目标伤害。同一角色/Tag/Group、感电流、燃烧流、冻元素/激元素代次、碎冰 GCD、ReactionA/B、扩散元素队列 GCD、草原核与周期调度在不同目标或各自作用域内确定性隔离。1.44 `target-phase-v3` 已实现所列 Burning Tick 的 callback 内零延迟跨目标 Aura/反应命中；一般化特殊 Aura overlap、全部可达排列、官服核验的感电传播规则、其他 callback 的同步跨目标交付、更多 Hitlag 属性、通用目标任务所有权和角色回调顺序仍未实现。自定义 ICD Profile 已具备通用契约，但尚未建立全角色 Profile 数据库。

基础发布门把 `aura-v7` 的公开输入面拆成代表性有序链与公开普通初态组合两层：前者固定七种来袭元素的高信息量链、Frozen 火蒸发 guard、ICD 重置和 Aura 精确到期，后者检查数值有限、Gauge 非负、Aura 元素唯一且稳定排序、聚合 Gauge 等于最大来源槽、逐槽消费守恒、Bloom 预算守恒、重放确定性和输入数组换序。结果 Zod Schema 同样在 `sourceSlots` 存在时强制来源唯一和最大槽一致，并对每条 `sourceMutation` 强制守恒；没有来源槽的历史投影继续接受。

这不是特殊状态全排列证明。公开 `initialAura` 只能直接表达普通五元素，组合门不会直接注入 Frozen、Quicken、Burning Marker/Fuel，也不会执行后续 Tick、草原核或目标任务；这些状态继续由各自的顺序、生命周期、Golden 和交叉引用测试负责。冻结的 1.37 v1 门覆盖低 Fuel callback-before-decay、Hitlag 重投影、多目标顺序和 `targetTaskPhaseLog`；1.38 v2 门只覆盖 callback→同一目标 `Reactable.Tick` 与 `targetPhaseLog`。固定 gcsim 提交的 Reactable 顺序附近仍有 TODO，因此这些精确链只能标为 `fixed-gcsim-provisional`，不是官方或官服验证真值。

旧 `aura-v2/v3` 与 `aura-v4` 的非 Pyro legacy 分支不会被静默升级为完整的有序多反应执行器；这些分支仍只结算历史首反应，`aura-v4` 已有的 Pyro 有序路径则保持原语义。但 fail-close 可达性预演必须遵守相同的来袭 Gauge 语义：Electro-Charged 是可达但不消费来袭 Gauge 的分支，所以 Hydro 在 Vaporize 后仍可能到达 EC，Electro 在 EC 后仍可能到达 Quicken；固定参考的 Cryo reverse Melt 减少 Pyro Aura，却不扣除来袭 Cryo，因此后续 Freeze 仍可能可达。若第二条可达分支尚未由该模式实现，目标以 `legacy-multi-reaction-order` 或 `non-pyro-multi-reaction-order` 截断，而不是返回 `unsupportedReactions: []` 的伪完整结果。Frozen Superconduct 是明确终止分支：它依次消耗普通 Cryo 与 Frozen 后丢弃剩余来袭 Electro，不能把余额再用于 Quicken。这个预演只证明“需要截断”，不生成第二反应伤害，也不是完整 Aura 求解器。

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

这里的 `Reactable.Tick` 只推进该目标已经列明的普通 Aura、Frozen、Quicken、Burning Fuel 和感电共存自然到期边界；精确 1.40 v8 还会在普通推进之后决议 Quicken→Bloom depletion cleanup。它不建立“所有目标 callback 后再统一 Tick”的全目标 barrier，也不接管感电 `+10/+60` 伤害 Tick、`+6` Wane、附着 ICD、ReactionA/B、Quicken→Bloom follow-up 本身、草原核/结晶实体、独立反应伤害或其他 core work。在本节冻结的 v2 语义中，实际 Burning 范围伤害仍排入后续全局 `reactionDamage` 管线，callback 内不会同步交付跨目标 Aura/反应命中；该能力只由后述精确 1.44 `target-phase-v3` 的 Burning 特例提供。

`SimulationResult.targetPhaseLog` 是 v2 的权威相位日志，记录 callback 前后与同目标 `Reactable.Tick` 后的 Aura/状态边界、目标顺序、目标时钟和关联 ID。目标任务模式为 v2 时只允许填充 `targetPhaseLog`，冻结的 `targetTaskPhaseLog` 必须为空；legacy/v1 则不填充 v2 日志。该互斥边界防止消费者把两个不同版本的相位含义合并。v2 同样只标记为 `fixed-gcsim-provisional`：固定提交是可复现参考，不是官方真值、完整 gcsim target phase 或完整 gcsim 精度。

#### 6.1.0d 1.44 target-phase-v3 Burning callback 交付

`target-phase-v3` 是精确 `1.44.0 / 1.44.0-burning-callback-delivery` 的独立显式 opt-in；1.42→1.44 迁移会保留 legacy/v1/v2，不会自动采用 v3。它要求 `legal-frame-v1`、60 FPS 和 `aura-v7/v8/v9`，并保留 v2 的目标局部阶段，但对“实际成立的 Burning Tick”加入 callback 所有的交付微事件：

```text
owner QueueEnemyTask / Burning callback
→ burning-callback-zero-delay-v1 delivery
→ owner Reactable.Tick
→ next registered target phase
```

delivery 使用独立且稳定的 `eventPriority/eventSequence`，并按 `enemyTargets` 注册顺序完整写出 `attempts`。每个 attempt 都有连续 `order`、`targetId/targetOrder`、`applicationPhase` 和判别结果：`landed` 必须同时引用命中、伤害和目标状态时间线点；`miss` 只引用命中判定；`unresolved` 不得伪造任何三类引用。无效代次、停止或 `tick-skipped` task 的 `delivery` 必须为 `null`。

对尚未运行全局 F 对应目标 Tick 的接收者，`AuraEngine.processHitAtCurrentTargetState()` 只物化到 F-1，在当前 Aura 上结算 Burning 火附着及其反应，随后由接收目标的 F `Reactable.Tick` 推进自然衰减/到期，并标记 `before-reactable-tick`。若接收目标注册更早、该帧 Tick 已执行，则直接读取已物化的 F 状态并标记 `after-reactable-tick`。这一区分使 Frozen 等恰在 F 到期的状态不会被提前消费，也不会被过期后的陈旧快照伪造。

v3 只同步交付该 Burning callback 的根范围命中。由火附着触发且定义为正延迟的 Overload 等子反应仍进入全局 heap，不得折叠到 callback delivery；`reactionDeliveryModel` 的递归碎冰切片也仍为独立模式。冻结 V144 与当前 V145 的精确 Schema/断言都要求 task↔Burning lifecycle↔`reactionDamageLog`↔hit↔damage↔`TargetStateTimeline` 的事件元组和 reciprocal 引用唯一，并禁止接收目标相位把 callback-owned hit 归为自己的 incoming hit。

v3 的结果完整性验证以规范化 `SimConfig` 为根重新解析目标注册顺序、hitbox、静态/分段移动位置、阶段窗口及 `damageAllowed / auraAllowed / hitConfirmAllowed / mechanicsPolicy`，再据此重放每个 attempt 的距离、阈值、命中结果、效果来源和目标相位 ID；不能用结果中的几何或阶段字段相互证明。callback 截止目标帧必须等于 phase 的目标帧，Burning 父事件的圆心、半径、`1U` 火附着及不适用字段也必须精确投影。该闭环只覆盖 v3 已声明的目标几何和阶段输入，不等于从配置重放全部 Aura、ICD 或事件堆。

该切片参考 gcsim 固定提交 `ef41805d855a60b9e1035293584b85c085dc69e7` 的 Burning callback/敌人任务路径，但 gcsim 自身的 Burning 测试仍有 TODO，且本项目 AuraEngine 仍把反应与未反应附着合并在同一 resolver。因此只能称 `fixed-gcsim-provisional`，不是官服真值、完整 Aura/ICD 系统、通用目标任务所有权或完整 gcsim parity。

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

1.40 的 `aura-v8` 已实现此前未完成的 Quicken→Bloom cleanup：只有 follow-up 恰好耗尽同代最后 Hydro 才设定下一有效目标 Tick 的 deadline；无 Hitlag 在 F1 停止，5 帧 Hitlag 在 F6/TF1 停止。已经排队的 F10 首次伤害继续结算，同代补水可保留流，新代次替换、自然到期碰撞和模拟末端 pending 都有显式结果；停止后的 F16 Wane/F70 Tick 不再发生。`aura-v7` 仍保留旧行为，迁移不自动启用 v8。1.41 只新增默认关闭的附近湿目标伤害传播与候选审计，不改变上述 cleanup 或任何目标流的 cadence/Wane 所有权。1.42 `aura-v9` 已补上跨过 F70 callback 的长目标 Hitlag、F20/F69/F70/F71 恢复边界、dormant cadence、逐来源 Wane、旧代隔离和 `ended-before-deadline`；迁移仍不自动启用 v9。任意来源 Aura overlap 的全部排列、全部同击反应排列和传播的官服真值仍未完成。

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

这部分交叉核对固定提交的 `pkg/reactable/freeze.go`、`pkg/reactable/melt.go`、`pkg/reactable/vaporize.go`、`pkg/reactable/superconduct.go` 和 `pkg/reactable/reactable.go`。当前实现冻元素耐久、冻结底反应、1.33 起的目标本地衰减/到期重投影与下述碎冰子集；仍没有敌人定身/动画状态、冻结气泡破裂、目标 movement/phase 随 Hitlag 暂停或敌人冻结抗性数据库。`aura-v5/v6/v7/v8` 固定冰来袭 `超导 → 融化 → 冻结`：水雷共存可得到 `超导 → 冻结`，水雷火共存且冰量足够时可得到 `超导 → 反向融化 → 冻结`。`aura-v2/v3` 若在冻结底上先触发超载、又留下可达的火量却无法按当前版本继续投影融化，会逐目标 fail-closed 为 `legacy-multi-reaction-order`，清空该目标 Aura 并标记 `TARGET_MECHANICS_TRUNCATION`；不得静默保留一个看似完整但次序未知的结果。这不代表其他单次来袭元素的所有多反应排列均已完成。

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

`shatterReaction` 保留 `NO_FROZEN_AURA`、`FROZEN_DEPLETED_BY_POISE`、`REACTION_DAMAGE_GCD` 三类显式结果；实际两阶段耐久变化分别写入 `frozenStateLog` 的 `poise-consume` / `shatter-consume`，碎冰排队与生成伤害写入 `reactionDamageLog`。网页逐击详情展示完整公式和 GCD，冻结曲线加入两个削减节点。1.39 的 `shatter-recursive-zero-delay-v1` 通过专用同步交付路径覆盖直接钝击/岩命中和“普通命中 → 超载 → 碎冰”的嵌套父链；`deferred-event-heap-v1` 继续保持历史编号与交付顺序。递归模式的子段与父段继承相同 frame、target、source、priority 和 root event sequence，父链可以前向引用但不能成环；12 帧 GCD 内再次削冻仍只记录阻止，不生成第二个子伤害。该实现交叉核对固定提交的 `pkg/reactable/freeze.go` 与 `pkg/enemy/attack.go`，但当前 `poiseDamage` 仅服务于冻结消耗，不代表已实现敌人通用韧性条、击退、硬直、重量或冲击；也没有完整技能打击类型/韧性伤害数据库。1.52 已保留固定参考 `DoNotLog` “Freeze Broken” 合成攻击的 audit provenance，但没有物化该攻击、DamageEvent、HitResolution 或回调面。

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
4. 保留触发当击的权威直接伤害和已经内联进该段的激化加算；不再排入依赖截断状态的后续独立事件。同帧后序及后续可独立求值的伤害事件保留公式 `potentialDamage`，但标记 `mechanics-truncated`、令 `finalDamage=0`，从总伤和 DPS 排除。若首分支识别到感电、第二分支才证明必须截断，则保留已识别的父反应标签，但把 EC `periodicReaction` 清为 `null`，不建立或刷新周期流；依赖未知 Aura 的 tick、Wane、expiry 事件即使已留在 heap，也必须在写周期日志、伤害或目标时间线前由截断守卫逻辑取消。

这是逐目标 fail-closed 截断；其他目标继续独立模拟。跨过边界的结果返回 `mechanicsStatus: "partial"` 与 `targetMechanicsTruncationLog`，网页也会显式警告“结果部分有效”。它不是绽放近似模型。该切片交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `pkg/reactable/catalyze.go`、`reactable.go` 与等级反应表。固定提交自身仍含反应顺序 TODO、草原核持续时间 `// ??` 注释和燃烧测试 TODO，所以 v3/v4 与下述 v5/v6/v7 都只声称固定代码路径交叉校验，不声称官方数值验证或完整 gcsim 精度。

#### 6.1.8 aura-v4/v5/v6/v7/v8/v9 Burning Marker、Fuel 与周期 Tick

`aura-v4` 是首个启用燃烧的 opt-in 机制版本，`aura-v5/v6/v7/v8/v9` 继承其主体语义；v1–v3 与 `legacy-v0.1` 的配置/Golden 不被静默改写。启动条件按固定提交的反应顺序执行：

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

结果完整性重放把每个目标的首个物化流固定为 generation 1。`stop` / `fuel-expire` 行继续使用退出流 generation；AuraEngine 在终止时递增内部 generation，下一次 start 再递增，因此同目标的下一次合法 start 必须是退出 generation `+2`。目标本地时钟模式下，所有 `burningStateLog.targetFrame` 必须等于该事件切点重放出的目标帧。v3 在接收目标尚未执行该帧 `Reactable.Tick` 时，audit 的 `snapshotTargetFrame` 读取上一全局帧末尾的目标本地时钟，而 lifecycle 行绑定当前事件切点；无 Hitlag 时两者相差 1，若 Hitlag 覆盖 callback 则可以相同。这些规则关闭代次复用和局部排程整体平移，但尚未替代从 Ability 配置根重放完整 Burning Gauge/Fuel 候选。

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

`ReactionAudit.burningReaction` 记录启动、Fuel 覆盖、快照刷新、停止或目标截断；`burningStateLog` 记录状态事件的 frame、priority、sequence、Fuel/Marker 前后、到期帧、Tick 索引、伤害/父事件 ID、附着 ICD 和限制标记。v7 明确区分“启动反应”与“刷新状态”：只有从未燃烧状态启动时才把 `burning` 写入反应列表并增加反应命中；对既有 Marker 的 Fuel/归属/快照刷新仍返回完整 `burningReaction` 和状态日志，但不再投影为一次新反应。结果完整性门要求每个非截断 start/refresh/stop/fuel-expire/tick/tick-skipped 审计都有唯一生命周期所有者；每个实际 Tick 必须与唯一 `burning-tick` 反应伤害日志及其有序子伤害事件双向闭合，Fuel 到期的 Aura 消耗、Marker/Fuel 标量、代次、ICD、回调和停止归属都必须一致。协调删除或伪造其中任一条链均应 fail-closed。网页只能读取这些核心结果。

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

启用目标时钟后，Fuel、燃烧期间依赖的普通草/激元素衰减和每 15 个目标帧的 Tick 链都使用不可变的目标本地截止帧；后续 Hitlag 只重投影全局唤醒帧，不改变 Tick 序号或目标帧节奏。Schema 会按事件元组重放观察点之前的 `targetHitlagLog`，校验 Fuel、首 Tick、后续 Tick 以及 Burning 驱动的 Quicken 到期全局帧；同一命中后置的 Hitlag 不得追溯改变当前审计。当前该证明仍以已校验的结果级 Hitlag 日志为输入，尚未从 ability 配置的 `haltFrames/factor` 重新生成完整 Hitlag provenance，因此不能称 config-root 闭环。

同一 Dendro 应用中若依次产生 Quicken、Burning 驱动的 Quicken decay-rebase 和同步 Quicken→Bloom，序列化与来源状态必须严格保持 Aura 引擎的 `G1 start → G2 decay-rebase → G3 partial-consume` 顺序；G3 到期拥有权不能被较早的 G2 回写覆盖，G2 的旧到期只能形成 stale observation。1.32 的 `reaction-self-v1` 已在每个实际 Burning Tick 的伤害帧，以同一抗性前原始反应伤害和半径 1 对静态玩家圆形碰撞体求交，再进入玩家火抗、结晶盾和 HP；固定跳过槽不生成玩家伤害。所有 1.32 配置迁移都会禁用目标时钟，但会原样保留其玩家模型；1.31 及更早配置与内置兼容预设才同时禁用两项模型。两条迁移都不改变原 Golden。角色专属 `OnBurning` hook-before-snapshot 与纳西妲 C2 对燃烧等转化反应的特殊暴击仍没有进入当前事件阶段。

实现语义交叉核对固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 和 1.44 callback 切片锁定的 `ef41805d855a60b9e1035293584b85c085dc69e7`。`legacy-event-heap-v1` 有意保留 1.30 相位；冻结 v1/v2 也仍把实际 Burning 范围伤害留在后续全局 core 阶段。精确 1.44–1.52 的显式 v3 可以前节的 callback-owned 微事件同帧交付跨目标伤害/Aura；启用 Hitlag 时陈旧 wake 会先重投影，正延迟子反应仍留在全局 heap。固定源码自身仍有 TODO，因此所有相应切片都只能称 `fixed-gcsim-provisional`，不是官方/官服真值或完整 gcsim 精度。

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

1.42 的结果完整性门按冻结引擎语义重放整条链：

```text
配置中的行动/技能
→ 命中确认与粒子 ICD
→ 粒子生成、固定种子数量与到达
→ 每名角色的前后台、ER、上限和溢出结算
→ 行动消耗、固定回能、energyStats
→ energyCurve 的每一个状态点
```

公共 Zod Schema 和核心内部可信断言共享这组跨字段不变量；外部结果仍必须走完整 Zod。1.42 wire 没有 `particleEventId`、曲线来源外键或同帧 `eventSequence`，因此兼容校验只能依靠冻结的确定性顺序闭合重复事件，不能声称已经具备下一版的显式逐事件外键。负数 `energyGains.amount` 不被当作隐式扣能；1.42 执行入口对它 fail-closed。正式收窄输入域及独立的延迟扣能事件必须通过新 Schema 版本完成。

固定 gcsim 提交 `ef41805d855a60b9e1035293584b85c085dc69e7` 的中央粒子公式继续支持上述 `3 / 2 / 1`、后台倍率、到达时 ER、全队分配和上限/溢出交叉核对，但其任务相位与 1.42 不同：

- 1.42 固定为 `action/cost → buff/debuff → particleReceive`，所以同帧行动先检查能量。
- 该 gcsim 提交先运行已排定的全局粒子任务，再在帧尾检查/执行行动。
- 1.42 在行动开始立即扣能；该 gcsim 提交的普通爆发按角色定义的延迟帧扣除满额能量。

因此这些顺序不得写成 gcsim parity 或官服真值。下一版应新增显式 `energyTaskModel`，保存 `(frame, scheduleSequence)`、粒子事件外键、行动/扣能事件外键，并以独立 Golden 覆盖“粒子到达、换人、爆发检查、延迟扣能”同帧组合；不得回写 1.42 Fixture。

### 6.3 Ability Blueprint 与部分机制闸门

`packages/schemas/src/mechanics.ts` 定义版本化的 `AbilityBlueprint` 1.9 契约，并能把 1.0–1.8 输入迁移后再编译。1.8→1.9 只把旧 application 显式迁移为 No ICD 或 legacy boolean selector，不会自动映射 fixed group。每个技能映射必须包含：

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

```bash
npx vitest run packages/icd-profiles/src/application-profile.test.ts packages/schemas/src/elemental-application-icd-result-schema.test.ts packages/schemas/src/reproducibility.test.ts packages/schemas/src/schema.test.ts packages/sim-core/src/elemental-application-icd.test.ts packages/sim-core/src/__tests__/elemental-application-icd-result-integrity.test.ts packages/sim-core/src/__tests__/elemental-application-icd-golden.test.ts packages/sim-core/src/__tests__/legacy-default-v147-golden.test.ts
node packages/test-vectors/scripts/generate-elemental-application-icd-v147.mjs --preview
node packages/test-vectors/scripts/generate-legacy-default-v147.mjs --preview
```

两条 Golden 脚本的日常发布门只使用 `--preview`；冻结 Fixture 不得被 update/overwrite 模式回写。

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
- 1.42 已冻结 `legacy-default-120s-1.42.golden.json`（SHA-256 `ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df`）与 `electro-charged-global-cadence-1.42.golden.json`（SHA-256 `ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611`）。前者锁定 `1.42.0 / 1.42.0-ec-global-cadence-safety` 身份，同时保持历史 Aura 模式、`single-target-v1`、总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动及完整逐击摘要不变；后者锁定 v9 长 Hitlag、恢复边界、dormant、逐来源 Wane、`ended-before-deadline` 和逐击伤害/曲线闭合。未来文件 SHA 仍只能在最终只读清单完成并现场复核后写入。
- 1.44 已冻结 `legacy-default-120s-1.44.golden.json`（SHA-256 `e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05`，`configHash = fnv1a32:dad42c01`，`reproducibilityKey = gdl-v2-fnv1a32-03487d7e`）与 `burning-callback-delivery-1.44.golden.json`（SHA-256 `4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65`，场景 `configHash = fnv1a32:3aa2ff18`，`reproducibilityKey = gdl-v2-fnv1a32-ee7f1332`）。前者只升级身份，默认仍使用 `legacy-event-heap-v1`、历史 Aura 与 `single-target-v1`，总伤、DPS、角色/技能汇总、269 命中、129 反应命中、3 跳过行动和逐击 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f` 与 1.42/Vanilla 一致；后者锁定 v3 注册顺序 attempts、callback-owned 反链、F15 零延迟交付和 F16 正延迟 Overload 子反应。两份 1.42 Fixture SHA 保持不变，机制 Golden 仍只是 `fixed-gcsim-provisional`。
- 1.45 已冻结 `legacy-default-120s-1.45.golden.json`（SHA-256 `ce59efca02ea2a895195139a3775ec0eeefe6b73414603ee8650e46b2e3c2167`，`configHash = fnv1a32:e53f9200`，`reproducibilityKey = gdl-v2-fnv1a32-b696a75d`）。它绑定冻结 V145 身份、Manifest 1.1.0 和公式根 `sha256:7ae4ee955e0c7986c47931cff596694c8cd4754b48df90e0ad1cf092738ccafd`，同时保持总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动、角色/技能汇总与逐击 digest 不变。1.44、1.42 及全部更早 Fixture SHA 均保持只读。
- 1.46 新增 `legacy-default-120s-1.46.golden.json` 与 `direct-damage-group-1.46.golden.json`，但不回写任何旧文件。前者要求默认预设 269 个 landed 普通直接伤害段全部以 `bypassed` 行进入新日志，并保持 V145/Vanilla 总伤、DPS、角色/技能、命中、反应命中、跳过行动和逐击数值；后者冻结 sequence 0、同 Tag 切组、tail clamp、reset-before-hit、双 root、插件 trace 和可变异结果证明。最终 SHA 及通过计数只在现场命令完成后报告。
- 1.47 新增两份只读 Fixture。`legacy-default-120s-1.47.golden.json` 的 SHA-256 为 `918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996`，`configHash = fnv1a32:62b82c76`、`reproducibilityKey = gdl-v2-fnv1a32-8823b0d7`；它保持总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动与伤害 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f`，普通直伤日志仍为 269 个 bypass、digest `a9c1df34508e3fcdda365e3b6717460d618b263a2409ad843df2016de0ce0e88`；默认预设没有配置应用，所以 application 日志为 0 行、digest `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。其冻结 V146 来源 Fixture SHA-256 保持 `3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465`。
- `elemental-application-icd-1.47.golden.json` 的 SHA-256 为 `9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7`；application、DamageEvent 与目标时间线 digest 分别为 `66eab58f46d75556a661e51cd0ed16c9cc46d9ff5048365d3bb886b8c9643d62`、`f7a9da88535903ed2a18a966e172e57217007056d3dc861a8b20e18cb54597e1`、`fc0a62bd92559e2356c3e33b4a44a8e50be1db521086ec70070ed3f995caaf99`。它冻结 F0/F1/F2/F148/F149 的倍率 `1/0/0/0/1.5`、同 Tag 切组、tail clamp 与 reset-before-hit，得到总伤 2700、DPS 900、5 段伤害、2 个反应命中、0 个跳过行动。
- 1.48 新增两份只读 Fixture，不回写 1.47 或更早文件。`legacy-default-120s-1.48.golden.json` 的 SHA-256 为 `563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c`，`configHash = fnv1a32:6d2a6835`、`reproducibilityKey = gdl-v2-fnv1a32-e69ac333`；它保持总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动、全部角色/技能汇总与伤害 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f`。`reaction-owned-application-1.48.golden.json` 的 SHA-256 为 `704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd`，冻结 36 条 Burning 行、16 条 Swirl 行和各自 digest `388ad56a6bc0c98c056fddbe29caf39ee4f950d66c291762cfabe86ece904d0a` / `7f18c61188e4ac0493e585e3e3e20cca1262d0b69ad290248dd3b454d538197b`，并显式保留 `officialServerTruth: false`、`completeGcsimParity: false` 与 provisional 同帧顺序口径。
- 1.49 新增两份只读 Fixture，不回写 1.48 或更早文件。`legacy-default-120s-1.49.golden.json` 的 SHA-256 为 `961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931`；原生默认预设选择 V2，但总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中、3 跳过行动及全部角色/技能汇总不变。`burning-reset-boundary-1.49.golden.json` 的 SHA-256 为 `3e89c431c3b277fd1dc52881f7ea048b39060e0c16c5230af9c1a73b624e0e10`，冻结 F15/F134/F135 的 V1 允许序列 `true / true / false` 与 V2 `true / false / true`；这仍只是 provisional 确定性合同。
- 1.50 新增 `reaction-damage-group-reset-boundary-1.50.golden.json`，不回写 1.49 或更早文件。当前复核的 SHA-256 为 `f58cdac88ec2395239fc5f8c4818adff92e563479268ee5c4aa5a75639ae06d1`。它用 Superconduct/ReactionA 与 Overload/ReactionB 的实际模拟结果冻结 V2 开窗、F+29 reset-before-attempt FIFO、generation、decision/reset backlink 与各层 digest；attempt-before-reset 的反向拓扑由纯引擎与递归 Shatter 模拟器定向测试覆盖。所有历史 Fixture 另有逐字节完整性门。
- 1.51 新增 `basic-reaction-scheduler-1.51.golden.json`，SHA-256 为 `25cf50a6f39eb9bf4de2d709c896dc74e079493ef2b4e81dfad8d65d17fa4424`，不回写 V150 或更早文件。它冻结 V1 即时附着兼容、V2 同帧 attack cohort 后按 task order commit、两条攻击/两条 `reactionAuraAttachment`、第六根身份和 reciprocal 结果引用。它不证明通用 scheduler 或完整 Aura/ICD。
- 1.52 新增 `freeze-broken-attack-1.52.golden.json`，SHA-256 为 `d9a8811a46efb2ed839fac111a4e796d308323f25f3ce0fe7b53c225664f01d4`，不回写 V151 或更早文件。它冻结自然衰减、韧性削冻、碎冰削冻、冰扩散、mixed Hydro/Frozen Swirl、冰结晶六个正向场景，以及 Melt、Superconduct、部分消耗三个负向场景；V1 始终零行，V2 正向恰好一行且 `mechanicsStatus: partial`，负向零行且 `complete`。Fixture 还锁定无 DamageEvent、HitResolution、RNG、命中、曲线、总伤或 DPS 副作用；它只证明本地规范化，不证明官服或完整 gcsim callback 语义。
- V1.50 冻结阶段的历史现场记录为：单元测试 129 个文件/1629 项、数据目录 120 角色/125 天赋集/762 技能与被动/237 武器、Playwright Chromium 36/36，另有 typecheck、build 与 3/3 性能探针通过。该数字不得冒充 V1.51 验收；V1.51 的完整 Vitest、性能、typecheck、build 和 Playwright 计数必须以发布前现场重跑为准。墙钟结果会随主机负载漂移，性能阈值不是跨设备 SLA。
- V1.51 发布前现场记录为：基础反应聚合门 22 文件/300 项、完整 unit 139 文件/1679 项、数据目录 120 角色/125 天赋集/762 技能与被动/237 武器、性能 3/3、typecheck、build 与 Chromium Playwright 36/36 全部通过。完整 `npm run check` 顺序中的默认 120 秒、运行时能量和持续 Burning 中位数为 29.370ms、5.195ms、93.471ms；Burning 输出仍为 479 ticks/479 applications、60 allowed/419 blocked，并保持冻结的伤害与两个哈希。墙钟会随主机负载漂移，性能阈值不是跨设备 SLA。build 仍有主 JS chunk 超过 500kB 的非阻断警告。
- V1.52 本轮现场已通过基础反应聚合门 29 个文件/372 项、完整 unit 146 个文件/1752 项、数据目录 120 角色/125 天赋集/762 技能与被动/237 武器、性能 3/3、typecheck、production build 与 Chromium Playwright 36/36。最终 `npm run check` 的默认 120 秒、运行时能量和持续 Burning 三项中位数为 25.975ms、4.971ms、79.773ms；build 仍有主 JS chunk 超过 500kB 的非阻断警告。默认 120 秒预设仍为总伤 `41410555.13728799`、DPS `345087.9594773999`、269 命中、129 反应命中和 3 跳过行动；角色、技能、逐段伤害与曲线均不变，`freezeBrokenAttackLog` 为 0 行。
- 1.45 冻结阶段曾现场通过 `87` 个测试文件、`1205/1205` 项测试；这不是 1.46 最终计数，当时未预写 1.46 的 build、性能门、Vitest 或 Playwright 结果。
- 整数帧行动、切人、命中追踪、显式冲刺/跳跃占用、按后续普攻/重击/战技/爆发/冲刺/跳跃/切人选择取消帧、未声明路径回退与动画结束帧。
- 严格模式冷却拒绝和等待模式冷却调整。
- 多充能次数、行动重叠与错误前台角色。
- 行动状态的角色归属、授予、消耗、刷新、精确到期边界、缺少前置拒绝和冷却等待后重新检查。
- 行动状态的无前置清除、缺失状态空操作，以及杜林黑白分支互斥。
- v1/v2 的历史 `1U -> 0.8U / 426f` 回放，以及 v3 火/冰/水/雷/草 `1U -> 0.8U / 570f` 固定耐久换算。
- 默认 ICD 第 1/2/3/4 及第 24/25/26 次附着、150 帧重置、独立角色/Tag/Group 和 No ICD。
- 自定义 ICD Profile 的缺省/显式 `repeat` 与显式 `clamp`、禁止覆盖内置组、未知组失败和 DurinSkill 18 帧序列。
- 普通直伤 Damage Group 的 58 组 leaf/root 身份、canonical SHA、冻结/深冻结、unknown group fail-closed、末项 clamp 和 `start + resetFrames - 1` reset-before-hit。
- 每目标、来源角色、Tag 隔离，结构化 tuple 无分隔符碰撞，同 Tag 切组共享 counter 但沿用开窗 timer；Miss 不消费、landed immune 消费、sequence 0 消费并保留 Aura/反应、Hitlag、草原核接触和技能 hit-confirm 粒子。
- 固定 damage sequence 在插件后相乘；bypass/evaluated 日志、DamageEvent 因子/零伤害/外键、root/model/configHash/repro identity 必须由 public Zod 与 trusted assertion 同时闭合。逐插件倍率 trace 只闭合结构和下游算术，并以 `structural-only-unverified-runtime-output-v1` 明示不能独立执行、证明或认证任意运行时插件输出。
- 数字元素施加 profile 的 58 组 leaf/root 身份、55 个公共组、三种 selector、unknown/reserved group 与物理附着 fail-closed；固定状态按目标/角色/Tag 隔离、Group 不入 key，开窗组拥有 timer、当前组选择 sequence，尾部 clamp、`start + resetFrames - 1` reset-before-hit、倍率 0 仍消费、No ICD 不开窗、纳西妲 `1.5` 槽按数字 Gauge 结算。
- `elementalApplicationIcdLog` 必须与配置直接命中、Burning Tick 和 Swirl 传播的目标 attempt 一一对应；来源类型、跳过/消费决策、独立状态窗口、名义/有效 Gauge、root/model/configHash/repro identity 及 reciprocal 外键都必须可重放。感电/Wane、超载、超导、碎冰、绽放系、激化后续、core 伤害与结晶不得伪造反应所有应用行。
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
- v4 燃烧等级/精通/增伤/火抗公式、范围扇出、逐击伤害父链、实时面板归属刷新、火附着 ICD 和 Tick/Fuel 边界；冻结 v1/v2 继续锁定各自历史语义。1.44 v3 新门覆盖 `processHitAtCurrentTargetState()` 的 F-1/当前状态边界、Frozen 到期前后、注册顺序反转、Hitlag 重投影、全目标 `landed / miss / unresolved` attempts、callback-owned 外键、确定性和正延迟 Overload 子反应继续入 heap。
- Burning 结果反链变异门覆盖跨角色 stop、伪造或错误代次 stop、自然到期伪装、删除 start/stop 审计或生命周期、Fuel-expire Aura/Gauge 漂移、候选 Gauge、时钟身份、同击 Hitlag 正例与全局截止帧协同漂移；合法机制截断和 blocked start 必须继续通过。
- v3 目标相位变异门从配置重放移动位置、hitbox、阶段策略、目标名、距离和 callback target-frame，拒绝结果侧几何/阶段字段的协调伪造。
- v2/v3 冻结底 `超载 → 融化` 的未建模残余顺序必须产生明确逐目标截断；禁止静默保留残余火量。
- v5 Bloom gauge 组合不变量、水草双向交互、冰来袭 `超导 → 融化 → 冻结` 有序链、v6 `hydroFrozenEcGuard` 和 post-Freeze EC 兼容边界，以及 v7 Quicken→Bloom core zero-delay FIFO/live-Aura 触发、跳过路径与 `reactionTaskLog` reciprocal 引用；冻结的 v1 与 1.38 v2 都必须证明该核心任务没有被重新分类为 target-owned task。
- aura-v5/v6 同击 `G1 Quicken → G2 Burning rebase → G3 Bloom consume` 必须保持真实 mutation 顺序、G3 来源/到期归属和 G2 stale observation；Burning 的非 `none` Quicken mutation 还须与唯一 lifecycle row 和 application timeline backlink 双向闭合。
- v8 Quicken→Bloom 耗尽最后 Hydro 后只在下一有效目标 Tick 清理同代感电流；F1、Hitlag5→F6、F10 首次伤害保留、F16/F70 抑制、同代恢复、代次替换、自然到期唯一所有权和模拟末端 pending 都必须可审计且确定性复现。1.41 另行验证显式半径附近湿目标伤害传播；它不能反向改变 cleanup。1.42 v9 补充 F+10/F+70 独立全局排程、跨过 F70 的长 Hitlag、F20/F69/F70/F71 恢复、`tick-skipped` / dormant、pending 末态、per-source `-0.4U` Wane、零伤害不排 Wane、旧代隔离和 `ended-before-deadline` reciprocal 引用。
- EC 共享结果 mutation gate 必须同时通过 public Zod 与 trusted assertion：覆盖 start/refresh audit→row 缺失、首代与重启 generation 协同篡改、hit-stop reason laundering、ordinary stop 双向反链、pre-v8 跨代 Wane 的 active generation/tickIndex、owning Tick `waneFrame` 删除、Wane 伪装 stop、每来源 `0.4U` 协同漂移、1.44 sub-epsilon 省略例外、global/target-clock deadline 漂移及 v9 cadence/listener；合法机制截断、历史跨代 Wane 和冻结 Golden 必须继续通过。
- 精确 1.42 / `aura-v9` 的 24 场景发布门覆盖 24/24 个非 `none` 标签与 16 类经典反应，逐场验证确定性、无机制截断、伤害构成、个位显示伤害和曲线末值；Lunar 反应明确不在该门内。
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

Playwright 覆盖预设切换、JSON 导入、运行、总览数字、时间轴、逐击累计与三类伤害构成曲线等既有页面。1.46–1.52 都只扩展核心、Schema、Golden 和回归门，没有新增 Damage Group、application ICD、反应所有施加、reset 边界、基础反应调度或 Freeze Broken 的专用面板。普通直接伤害和反应伤害仍通过核心生成的逐目标 `DamageEvent` 自动进入既有全队、角色、技能、逐击、时间轴和累计/构成曲线；V1.52 audit-only Freeze Broken 行不是 DamageEvent，故不得进入命中或曲线。UI 只能读取核心结构化输出，不得自行推导 Damage Group、元素施加倍率、反应或事件顺序。V1.52 本轮现场已通过 Chromium 36/36，锁定 V2/V1 配置回环、4 个角色、7 个技能、269 段逐击、茜特菈莉 51 段筛选、最终伤害构成，以及公开 UID 展示柜导入仍以毕业占位配置为边界。

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

Milestone 3 已落地火/冰/水/雷/草普通 Aura、可扩展元素量、衰减、legacy 默认/No ICD/自定义 Profile、正反增幅、经典转化/状态反应、`aura-v5`–`aura-v9`、目标相位、感电 cleanup/传播/cadence 和 24 标签/16 类经典反应门；全部仍是 `fixed-gcsim-provisional` 或列明的 `community-provisional`。1.46–1.51 依次冻结普通直伤 Damage Group、配置直接 application、Burning/Swirl 反应所有施加、ReactionA/B 伤害组与基础调度；1.52 只新增 Freeze Broken 正值到耗尽的 audit-only root。这些切片不代表所有反应都已精确，58 个来源组也不等于全角色技能已绑定。现阶段继续优先稳定基础反应、Aura 生命周期、两类 ICD 和日志所有权，不扩张专用展示。Lunar 反应、完整特殊/多 Aura 状态空间、官服核验传播、通用 callback/全目标 barrier、Freeze Broken callback bus/Mona bubble/impulse/订阅者/RNG 执行、真实粒子、完整动作帧、全角色/武器可执行数据库和可靠 UID→可执行配置仍未完成。Burning monotonic generation guard 是本地安全偏差；冻结杜林预设的示例魔法数继续是 provisional。

Milestone 4 已完成核心第一批闭环：版本化粒子 Schema、固定种子随机数量、固定帧或逐击命中触发、角色级粒子内部冷却、生成/到达事件、接收时前后台、同/异/无色、晶球、充能效率、溢出、固定回能拆分、逐次日志和能量曲线。具名多目标、逐目标 landed / miss、独立 Aura/ICD、三层目标效果策略、按帧阶段窗口、显式/圆形/旋转矩形/胶囊/填充扇形扇出、声明式线性目标移动和一次回调聚合已成为伤害和命中产球的共同门；内置 M4 预设仍只用于机制验收，其面板、帧数和产球范围是 provisional。尚未完成 120 秒、来源核验的杜林首轮启动/循环预设，也没有敌人掉球、粒子几何飞行轨迹、真实 Boss AI 或真实技能产球数据库。

Milestone 5 已完成数据层基础和首批部分机制编译闭环，不等于正式杜林预设完成。杜林黑/白 E 已有倍率引用、裸伤/增伤、动作帧、黑 E 附着/ICD、白 E 无附着口径、回能、粒子和互斥状态向量，但仍有明确未解决项；尼可、洛恩、茜特菈莉、希诺宁以及其余角色/武器仍需逐技能机制插件与交叉验证。全角色/全武器技能数值的可查询目录也不等于完整的特有 ICD、动作帧、粒子、快照和机制可执行库；展示柜 UID 映射尚未形成通用 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig`，不得把测试 UID 的单次映射成功外推为全 UID 支持。

下一阶段按以下顺序推进，且必须保留全部历史 Golden、V152 Freeze Broken V1/V2 root 与 Manifest 1.8、1.52 audit Fixture、冻结 V151 基础反应调度 V1/V2 root 与 Manifest 1.7、1.51 调度 Fixture、冻结 V150 ReactionA/B V1/V2 root 与 Manifest 1.6、1.50 伤害组 Fixture、V149 Burning/Swirl V1/V2 root 与两份 1.49 Fixture、V148 四 root 与两份 1.48 Fixture、V147 冻结 wire/Fixture、1.41/1.42 传播与 cadence Fixture、24 标签/16 类经典反应门和 1.44 Burning callback delivery：

1. 先给合成 Ability、再给有来源核验的真实技能逐项绑定元素施加与普通直伤 Tag/Group；每个映射必须有命中拆段、动作帧、Gauge、两类序列和回归向量。禁止按角色/技能名批量猜测。
2. 扩展 Burning/Swirl 的特殊 Aura、多目标、多代次、跨来源与同帧 reset/order 向量；不得回写冻结的 V1/1.48 覆盖，对任何新增 channel 都须先核对固定来源，再升版策略根。
3. 继续扩展特殊/多 Aura 可达空间、来源 overlap、多代次交错、cleanup/传播、Hitlag/Frozen、逐元素抗性/减抗交叉；在新引擎版本中先建立可审计 callback bus，再实现 Freeze Broken 的 Mona bubble/impulse、全局/订阅者副作用和明确 RNG 语义，不能把 V1.52 audit row 直接升级为已执行攻击。
4. 基础经典反应稳定后，再以新版本和独立 Schema/Golden 实现 Lunar 反应族；不得把当前 24 标签/16 类门外推为全反应覆盖。
5. 从 Burning 专用 v3 切片向通用目标 callback/任务所有权扩展；证明 Quicken→Bloom、感电 Tick/Wane、两类 ICD、ReactionA/B、草原核/结晶和玩家状态不被误归类或误冻。
6. 建立玩家 Aura、敌方攻击、玩家侧反应、治疗、死亡/复活、动态 Max HP、角色移动、非结晶盾和护盾强效的独立版本模型。
7. 在快照前建立可测试的 `OnBurning` 回调，并以机制插件实现纳西妲 C2 等角色例外，不向通用公式硬编码角色名。
8. 把 `configHash`/repro identity 从可碰撞的 32-bit FNV 迁移到 SHA-256，并为任意代码插件增加可选构建产物/源码摘要验证。
9. 把角色/武器目录逐项推进到 `mechanics-mapped`，补齐动作帧、命中拆段、两类 ICD、快照、粒子、命座、专武和圣遗物效果；再建立版本化 `ShowcaseSnapshot -> ResolvedLoadout -> SimConfig` 与多个固定 UID Fixture。
10. 增加角色移动/转向、追踪/索敌、敌方 AI/位置更新和有来源的 Boss 状态机。
11. 映射杜林黑/白 Q、命座、专武和圣遗物后，才组合 120 秒、0 初始能量的来源核验预设；现有示例魔法数继续保持 `provisional`。核心门稳定前不扩展专用面板，UI 仍只能消费结构化结果。
