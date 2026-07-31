# 提瓦特伤害实验室

一个以“逐段可审计、配置可迁移、结果可复现”为目标的原神队伍 DPS 模拟器。当前完成了 Vanilla v0.1 基线冻结、纯 TypeScript 模拟核心、合法帧时间线、基础元素反应矩阵、`aura-v5` 有序 Aura 链、ReactionA/B 伤害组、燃烧 Marker/Fuel/Tick，以及绽放、草原核、烈绽放和超绽放的确定性纵向切片。1.32 加入 opt-in 的玩家反应自伤基础模型；1.33 再加入独立 opt-in 的敌方目标本地时钟与 Hitlag 审计；1.34 新增 opt-in `aura-v6`，在不改写 v1–v5 的前提下，以共享来袭 Gauge 结算固定参考的雷元素多反应顺序；1.35 为共享敌人和具名目标加入严格的八项基础抗性表；1.36 再新增 opt-in `aura-v7`，把 Quicken 后的水草绽放跟进建模为同帧零延迟、FIFO 且执行时重读实时 Aura 的核心任务；1.37 新增独立 `targetTaskModel`，以显式 opt-in 的 `target-phase-v1` 冻结第一批 Burning target callback → 目标 Aura 衰减 → 同帧 core/incoming work 边界；1.38 再新增显式 opt-in 的 `target-phase-v2`，只冻结每个目标边界内 QueueEnemyTask / 目标 callback → 该目标 `Reactable.Tick` 的顺序，不改写冻结的 v1；1.39 新增独立 `reactionDeliveryModel`，让默认兼容路径继续延迟交付反应伤害，同时允许满足严格版本门的配置显式选择同步递归碎冰交付；1.40 再以显式 opt-in `aura-v8` 修复 Quicken→Bloom 耗尽水 Aura 后的感电流清理；1.41 新增默认关闭、`community-provisional` 的附近湿目标伤害传播。1.42 再新增严格 opt-in 的 `aura-v9` 感电全局 cadence safety：新流的 F+10 首伤与 F+70 callback 独立排入全局队列，目标 Hitlag 只冻结该目标的 `Reactable.Tick` / Aura 衰减，不冻结感电 callback 或 Wane；F70 缺失水雷共存时明确记录 `tick-skipped` 并进入 dormant，边界前恢复可按原代次继续或保持 dormant，非零实际伤害才保留 `+6f` Wane listener，每个水/雷来源槽分别削减 `0.4U`，cleanup 截止前已终止的流通过 `ended-before-deadline` 与 reciprocal 引用闭合。1.42 还增加 24 个非 `none` 标签、16 类经典反应的发布门；Lunar 反应族仍未实现。1.44 新增显式 opt-in 的 `target-phase-v3`：Burning owner callback 以 `burning-callback-zero-delay-v1` 微事件按敌人注册顺序同帧交付跨目标伤害与火附着，在接收目标尚未进入该帧时只物化到 F-1 并读取当前 Aura，再由该目标的 `Reactable.Tick` 推进 F 边界；已越过当帧目标 Tick 的接收者则在 Tick 后应用。每个 `landed / miss / unresolved` 尝试及其命中、伤害、目标状态外键都进入严格 v3 Schema 和跨日志完整性门；正延迟的子反应仍留在全局 heap。当前兼容预设及 1.42→1.44 迁移只升级身份，继续保留原 Aura、目标任务、感电范围与反应交付模式，不会自动启用 v3、`aura-v9`、递归碎冰或附近湿目标传播，默认 120 秒伤害基线也不改变。1.43 保留给未发布的 energy wire，1.44 不包含该能量模型变更。所有列明的反应与目标顺序仍只按固定 gcsim 提交交叉校验并标记 `fixed-gcsim-provisional`，不是官服真值或完整 gcsim parity。敌方每次实际伤害继续由核心返回结构化构成并进入既有全队、个人、技能、时间轴、逐段日志和累计/构成曲线；本轮无 UI 扩展，展示层仍只读核心结构化结果。粒子/能量闭环、版本化数据目录、受限 UID 展示柜映射与杜林黑/白 E 部分机制审计向量也已保留。

## 安装和运行

要求 Node.js 24 或兼容版本。

```bash
npm install
npm run dev
```

开发服务器默认位于：

```text
http://127.0.0.1:5173
```

生产构建与预览：

```bash
npm run build
npm run preview
```

## 测试

```bash
npm test
npm run typecheck
npm run test:e2e
npm run data:check
npm run check
```

只验证 1.44 反应核心、24 标签/16 类经典反应发布门、感电单目标兼容/附近湿目标传播、`aura-v9` 全局 cadence safety、逐元素敌方抗性、Quicken→Bloom 核心任务、`aura-v8` cleanup、冻结的 1.37 v1 目标相位、1.38 v2 callback→`Reactable.Tick` 边界、1.44 v3 Burning callback 零延迟跨目标交付、递归碎冰交付、增幅覆盖闸门、玩家自伤、目标本地时钟、可靠 Schema 与兼容 Golden 时可运行：

```bash
npx vitest run packages/schemas/src/schema.test.ts packages/sim-core/src/__tests__/simulation-result-schema.test.ts packages/sim-core/src/__tests__/simulation-result-runtime-boundary.test.ts packages/sim-core/src/__tests__/formulas.test.ts packages/sim-core/src/__tests__/amplifying.test.ts packages/sim-core/src/__tests__/catalyze.test.ts packages/sim-core/src/__tests__/superconduct.test.ts packages/sim-core/src/__tests__/reaction-a.test.ts packages/sim-core/src/__tests__/reaction-b.test.ts packages/sim-core/src/__tests__/bloom-gauge.test.ts packages/sim-core/src/__tests__/bloom-aura.test.ts packages/sim-core/src/__tests__/bloom-integration.test.ts packages/sim-core/src/__tests__/dendro-core.test.ts packages/sim-core/src/__tests__/aura-v6-electro.test.ts packages/sim-core/src/__tests__/aura-v6-simulator.test.ts packages/sim-core/src/__tests__/hydro-order.test.ts packages/sim-core/src/__tests__/quicken-bloom-task-order.test.ts packages/sim-core/src/__tests__/aura-v8-ec-cleanup.test.ts packages/sim-core/src/__tests__/aura-v9-ec-global-cadence.test.ts packages/sim-core/src/__tests__/electro-charged-global-cadence-golden.test.ts packages/sim-core/src/__tests__/electro-charged-quicken-cleanup.test.ts packages/sim-core/src/__tests__/electro-charged-cleanup-golden.test.ts packages/sim-core/src/__tests__/electro-charged-propagation.test.ts packages/sim-core/src/__tests__/burning.test.ts packages/sim-core/src/__tests__/burning-v7-refresh.test.ts packages/sim-core/src/__tests__/target-task-phase.test.ts packages/sim-core/src/__tests__/target-task-phase-log.test.ts packages/sim-core/src/__tests__/aura-reactable-boundary.test.ts packages/sim-core/src/__tests__/aura-current-state-hit.test.ts packages/sim-core/src/__tests__/target-phase-v2-reaction-gate.test.ts packages/sim-core/src/__tests__/target-reactable-phase-v2.test.ts packages/sim-core/src/__tests__/target-phase-v3-burning-delivery.test.ts packages/sim-core/src/__tests__/target-phase-v3-result-integrity.test.ts packages/sim-core/src/__tests__/shatter-recursive-delivery.test.ts packages/sim-core/src/__tests__/enemy-elemental-resistance.test.ts packages/sim-core/src/__tests__/crystallize.test.ts packages/sim-core/src/__tests__/player-damage.test.ts packages/sim-core/src/__tests__/player-reaction-damage.test.ts packages/sim-core/src/__tests__/target-clock.test.ts packages/sim-core/src/__tests__/aura-target-clock.test.ts packages/sim-core/src/__tests__/target-clock-integration.test.ts packages/sim-core/src/__tests__/target-hitlag-status.test.ts packages/sim-core/src/__tests__/reaction-matrix-golden.test.ts packages/sim-core/src/__tests__/golden.test.ts packages/sim-core/src/__tests__/performance.test.ts
npx playwright test apps/web/e2e/simulator.spec.ts --project=chromium
```

`aura-v7` 的基础反应发布门另外固定运行：

```bash
npx vitest run packages/sim-core/src/__tests__/aura-v7-order-release.test.ts packages/sim-core/src/__tests__/aura-v7-public-grid.test.ts
```

前者逐项断言火、水、冰、雷、草、风、岩的高信息量有序链、Frozen 对火蒸发的固定参考 guard、F150 ICD 重置和 F426 小元素量精确到期；后者覆盖 `6^5` 组公开初始普通 Aura 赋值，并对八种来袭元素使用确定性 mixed-gauge covering grid，共执行 62,208 个向量、186,624 次独立引擎运行。它检查 finite、非负、来源槽最大值、逐槽消费守恒、重复可复现和初始数组顺序无关。该门只证明当前 `aura-v7` 的公开普通初态和单次命中闭包，不证明特殊 Aura 全排列、后续周期任务或官服真值。

数据目录由固定的 `genshin-db@5.2.12` npm 包和固定 Enka 数字互操作快照生成：

```bash
npm run data:generate  # 显式更新两个生成产物
npm run data:check     # 验证提交产物与固定输入逐字节一致
```

首次运行 Playwright 时若本机没有浏览器：

```bash
npx playwright install chromium
```

## 当前功能

- 无 DOM 依赖的纯 TypeScript 确定性事件模拟核心。
- `legal-frame-v1` 使用 60 FPS 整数帧调度命令，不要求轮转手填每次命中的绝对秒数。
- 支持切人耗时、显式占用帧的冲刺/跳跃、行动开始帧、命中帧、动画结束帧、技能冷却和多充能次数；同一技能可按紧随其后的普攻、重击、战技、爆发、冲刺、跳跃或切人分别选择取消帧。
- 合法时间线支持 `strict` 拒绝模式和 `wait` 自动等待模式，并返回逐指令诊断。
- 角色无关的行动状态支持进入、刷新、前置要求、消耗、无前置清除和到期；状态在边界帧先失效，每次实际变更都进入结构化日志。
- 输入配置含 `schemaVersion`、`engineVersion`、`dataVersion` 和 `randomSeed`。
- Zod 严格校验、字段路径错误，以及 v0.1–1.42.0 配置迁移；当前 Schema 为 `1.44.0`、引擎为 `1.44.0-burning-callback-delivery`。1.35→1.42 的历史迁移契约继续冻结；1.42→1.44 只更新运行身份，原样保留 `reactionEngine`、`electroChargedPropagationModel`、目标任务、目标时钟、玩家模型与伤害交付模式，不会自动启用 `target-phase-v3`、`aura-v9` 或 `nearby-wet-radius-v1`。历史输入不得夹带未来字段，迁移也绝不自动启用递归碎冰、`aura-v8/v9`、v3 或附近湿目标传播。1.43 仅保留为未发布 energy wire 版本号，不是可接受的历史输入。逐元素抗性仍从 1.35 起才是合法 wire contract，旧版本夹带该字段会 fail-closed。
- `targetClockModel` 与 Aura 版本独立：`disabled` 保持 1.32 及更早兼容结果；只有 `target-local-hitlag-v1` 允许命中声明原子的 `targetHitlag: { haltFrames, factor }`。扩展帧采用 `ceil(ceil(haltFrames) × (1 - factor))`，命中当前帧的目标 Tick 先完成，暂停从下一全局帧开始；同目标同帧多次 Hitlag 可叠加，不同目标完全隔离。
- 启用目标时钟后，核心返回严格校验的 `targetClockAudit`、可重放的压缩 `targetClockLog` 和逐次 `targetHitlagLog`。Schema 会逐点重放并核对 `TargetStateTimeline.targetFrame`，拒绝同一命中被重复消费为多次 Hitlag，并按 reciprocal 日志精确累计超导状态的延长帧数。普通 Aura、Frozen、Quicken、Burning Fuel/Tick 与感电共存自然到期使用稳定的目标本地截止帧；1.38 v2 可把感电共存自然到期记录为 `Reactable.Tick` transition，但感电 `+10/+60` 伤害 Tick、`+6` Wane、ReactionA/B、扩散/结晶/碎冰、独立反应伤害和草原核生成/到期/烈绽放/超绽放仍按全局帧运行。1.39 还会为配置了 Hitlag 的 v2 Miss 写入 `blockedReason: "TARGET_MISS"` 的未应用审计，不推进目标时钟。已存在且结束帧晚于命中帧的超导减物抗状态会按实际 Hitlag 延长；同帧稍后才创建的状态不会被追溯延长。
- `targetTaskModel` 与目标时钟、Aura 版本分别建模，并提供四种模式：`legacy-event-heap-v1` 是历史迁移和当前兼容预设的默认值；`target-phase-v1` 是冻结的 1.37 第一批 Burning callback→Aura 衰减契约；`target-phase-v2` 是 1.38 的独立显式 opt-in；`target-phase-v3` 只允许精确 1.44、`legal-frame-v1 + 60 FPS + aura-v7/v8/v9` 显式选择。v3 保留 v2 的 QueueEnemyTask→同目标 `Reactable.Tick` 边界，但把实际 Burning Tick 的跨目标范围命中作为 callback 所有的 `burning-callback-zero-delay-v1` 微事件同帧交付。接收目标若尚未运行当帧 Tick，附着结算使用 F-1/当前已物化 Aura，再进入该目标 F `Reactable.Tick`；注册顺序更早、已运行 Tick 的目标则记为 `after-reactable-tick`。v3 `delivery.attempts` 必须按所有敌人注册顺序完整记录 `landed / miss / unresolved`，并闭合 `reactionDamageLog`、命中、伤害和 `targetStateTimeline` 外键。正延迟子反应仍进全局 heap；`aura-v9` F+10/F+70 callback 和 Wane 也仍使用全局帧。冻结的 v1 使用 `targetTaskPhaseLog`；v2/v3 使用带严格模式判别的、相互排斥的 `targetPhaseLog`。
- `reactionDeliveryModel` 独立控制反应伤害的交付顺序。`deferred-event-heap-v1` 是现有兼容预设和历史迁移的默认模式；`shatter-recursive-zero-delay-v1` 从精确 1.39 身份开始可显式选择，1.39→1.42 迁移会原样保留该选择，并继续要求 `legal-frame-v1` 与 60 FPS。递归模式在同一帧、目标和来源上下文中先交付碎冰子伤害，再交付其直接或嵌套反应父伤害；`parentDamageEventId` 因而可以合法前向引用。严格结果 Schema 要求连续 ID、无环父链，以及每个递归碎冰子段与唯一 `reactionDamageLog` 的 reciprocal 引用。该模式只覆盖零延迟碎冰，不会把其他反应或目标任务自动改为同步递归。
- 每次运行返回 `runManifest`：固定输入 Schema/引擎/数据版本、版本化配置哈希、解析后的运行选项、按顺序排列且带内容哈希的插件身份和 `gdl-v2-fnv1a32-*` 复现键。FNV-1a 只用于确定性漂移检测，不是密码学完整性或签名；声明式效果由核心规范化后计算内容哈希，任意代码插件的 descriptor/contentHash 则仍属于插件作者提供的受信声明，不能把它当作代码真实性证明。
- 输出侧当前使用精确 `1.44` 的 `simulationResultV144Schema`，同时保留身份严格的冻结 `simulationResultV142Schema`。65 个顶层字段和 DamageEvent、ReactionAudit、反应/状态生命周期、行动、能量/粒子、汇总、曲线、Aura 边界及合法时间线叶节点全部使用 strict Zod 结构；未知字段、非有限数、与当前已建模判别联合不匹配的分支及历史结果身份会 fail-closed。统一完整性层还会闭合 result/config/manifest 身份与别名、逐击 ID/队列顺序/个位显示/伤害构成、命中与已注册机制的主要反应反链、总伤/DPS/反应命中、角色/目标/技能/逐秒汇总和伤害曲线。1.44 另对 v3 callback owner、交付事件元组、按注册顺序的 attempts、`before/after-reactable-tick`、命中/伤害/Aura 时间线 reciprocal 引用和接收目标不得篡夺 callback-owned hit 实施专门完整性门。外部 JSON、持久化的完整结果及未来新增的完整 `SimulationResult` 测试向量必须走完整 Schema；现有仅含冻结摘要的 Golden 不是完整结果 wire。`sim-core` 内部结果在公开返回边界运行 `assertTrustedSimulationResultV144()` 复用跨字段完整性规则；该零拷贝内部断言不等同于完整 Zod parse，不能用于接纳外部或持久化 wire。Schema 证明输出结构和已注册的不变量，不代替公式、Aura 语义、角色数据或 gcsim 精度验证。
- `aura-v1` 支持火/冰/水普通 Aura、可扩展元素量、衰减、默认三击/2.5秒 ICD、No ICD、独立的角色/Tag/Group 流和显式声明的角色特有 ICD Profile。
- `aura-v2` 在保持上述语义的基础上加入雷普通 Aura，以及超载/超导的双向触发。反应本体与独立伤害分开记录；两者的独立伤害都延迟 1 帧、同一触发目标具有各自独立的 6 帧伤害 GCD，并以触发目标命中时的位置为圆心对半径 3 内的注册目标逐一求交。
- `aura-v3` 保留 v1/v2 回放语义，另按固定 gcsim 提交的 `25 durability = 1U` 换算修正普通 Aura：标称 `1U` 初始为 `0.8U`，自然寿命为 `570f`。火/冰/水/雷/草普通 Aura 与激元素均保存逐来源槽；同一次反应从每个来源槽扣除相同预算，状态最大值、共享衰减与变更来源进入逐击审计。旧 `aura-v1/v2` 的历史寿命不被静默改写。
- `aura-v4` 在保留 v1–v3 回放语义的基础上加入燃烧纵向切片。启动时建立不自然衰减的 `2U` Burning Marker 和独立 Fuel；Fuel 至少以 `0.4/60 U/f` 衰减，燃烧期间普通草 Aura 与激元素按固定参考路径调整衰减。首次 Tick 在启动后 15 帧，之后每 15 帧检查一次，固定跳过索引 9；实际伤害使用 `0.25 × 等级基准 × (1 + 转化精通加成 + 燃烧增伤)`、火抗、无防御且不普通暴击，并以半径 1 扇出。
- 每次燃烧 Tick 都携带 `1U` 火附着，使用目标局部、队伍全局的内置 120 帧 ICD 序列 `[允许, 阻止 × 7]`。草命中会把 Fuel 覆盖为剩余来袭草量的 `0.8` 倍并刷新后续 Tick 归属/实时面板快照；火命中只刷新后续伤害归属/快照，不补 Fuel，也不重置 Tick 节奏。Marker 被蒸发、融化、超载、火扩散或火结晶消耗时，周期流立即停止；Fuel 自然耗尽则同时移除 Marker、普通草 Aura 和激元素。
- `ReactionAudit.burningReaction` 与 `burningStateLog` 记录启动、Fuel 覆盖、快照刷新、Tick、固定跳过、附着 ICD、自然到期和 Marker 消耗停止。旧 `auraTimeline`、各状态日志及 `auraInitialStates` / `auraEndStates` 继续作为兼容输出保留。
- `aura-v7` 对已经存在的 Burning 只更新 Fuel、归属或快照状态，不再把 refresh 投影成一次新的 `burning` 反应；真正从未燃烧状态启动时才计入反应列表和反应命中。刷新本身仍保留完整 `burningReaction` / `burningStateLog` 状态审计，不会丢失生命周期信息。v1–v6 保持各自已冻结的兼容输出。
- `aura-v5` 在不改写 v1–v4 回放语义的前提下加入基础反应矩阵和冰来袭有序链：`超导 → 融化 → 冻结`。水雷共存时可得到 `超导 → 冻结`；水雷火共存且冰量足够时可得到 `超导 → 反向融化 → 冻结`。这是固定参考的兼容顺序；任意 Aura 来源重叠和所有多反应排列仍未完成。
- `aura-v6` 是独立 opt-in，沿用 v5 的 Aura 耐久、Burning、Bloom 与草原核主体语义，并为雷元素来袭按固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 结算 `超激化 → 超载 → 感电 → 冻结底超导 → 普通超导 → 原激化 → 绽放`。各消费分支共享同一来袭 Gauge，不会为同一命中重复创建元素量；同击产生多个转化反应时，完整有序结果写入 `transformativeReactions`，旧的单值 `transformativeReaction` 只保留第一项作为兼容投影。v6 另在水来袭有序链中落实固定参考的 Frozen guard：同一命中先生成冻元素后，不再启动感电；`aura-v5` 则刻意保留历史的 post-Freeze EC/F+10 行为，以免改写旧配置和 Golden。该顺序标记为 `fixed-gcsim-provisional`；参考源码本身对反应顺序保留 TODO，因此它是固定代码路径的可复现契约，不是官服真值。v1–v5 输出与历史 Golden 不变。
- `aura-v7` 是 1.36 新增的独立 opt-in，继承 v6 主体语义，但把“原激化后检查水 Aura 并触发绽放”从命中内同步调用改为 core zero-delay task。任务继承触发事件的 frame/priority，并以更晚的全局 sequence 保证已经入队的同帧命中先执行；轮到任务时重新读取目标的实时 Hydro/Quicken Aura，再触发 Bloom 或以 `MISSING_HYDRO` / `MISSING_QUICKEN` 等原因跳过。它不属于敌方 per-target queue；冻结的 1.37 `target-phase-v1` 和 1.38 `target-phase-v2` 都不会把它重新分类为 target-owned task。
- `aura-v8` 是精确 1.40、`legal-frame-v1 + 60 FPS + target-phase-v2` 的独立 opt-in。若 Quicken→Bloom core follow-up 恰好消耗同一代感电共存中的最后水 Aura，核心在 F0/目标帧 0 记录 cleanup，等到下一次有效 `Reactable.Tick` 再决定结果：无 Hitlag 在 F1 停止，5 帧目标 Hitlag 时目标帧截止仍为 1、全局帧重投影到 F6；截止前恢复水雷共存会保留同一代次，被新代次替换会记录 superseded，自然到期碰撞只复用唯一的到期停止记录，模拟结束前尚未到达截止则明确记录 pending。已经排队的 F10 首次感电伤害不被撤销；停止后不得再产生 F16 Wane 或 F70 后续 Tick。任务、目标相位 transition、周期停止记录和 `TargetStateTimeline` 之间使用严格 reciprocal 引用；`aura-v7` 输出保持不变。
- `aura-v9` 是精确 1.42、`legal-frame-v1 + 60 FPS + target-phase-v2` 的独立 opt-in，继承 v8 cleanup 但修复长 Hitlag 下的全局 cadence 所有权。新代次开始时 F+10 首伤和 F+70 callback 独立排程；目标 Hitlag 只冻结 `Reactable.Tick` / Aura 衰减。F70 若水雷不再共存会写入 `tick-skipped`、令 cadence 进入 `dormant` 且不排 F+130；F70 前恢复可让该 callback 正常结算，F71 才恢复则保留 dormant，不伪造新的 cadence。Wane listener 只在实际非零伤害且水雷共存时保持活动，Wane 对 Hydro 和 Electro 的每个来源槽分别扣除最多 `0.4U`，弱槽耗尽不会错误删除仍由强槽维持的流。若 Wane 或其他终止先于已武装 cleanup 的目标帧截止，cleanup 使用 `ended-before-deadline`、唯一终止周期记录和目标相位/时间线 reciprocal 引用闭合；旧代 Wane 不能污染替换代次。该模型固定参考 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，只声明 `fixed-gcsim-provisional`。
- `electroChargedPropagationModel` 是 1.41 新增且与 `reactionEngine` 分离的版本边界。`single-target-v1` 保持现有每 Tick 只命中流所属目标的语义，也是全部内置预设与迁移结果的默认值。`nearby-wet-radius-v1` 必须显式给出有限正数 `radius`，只在当前 1.41 严格版本门下启用；每次源 Tick 都按“源目标优先，其余目标按注册顺序”审计所有候选，并为每个范围内且具有 Hydro Aura 的目标生成独立 `DamageEvent`。它不施加任何 Aura、不递归触发传播、不接管副目标已有感电流、不重置副目标 cadence，也不为副目标安排 `+6` Wane；全部伤害沿用源 Tick 的所有者、快照、等级、精通和反应增伤。该模式的半径和目标选择是本项目显式的 `community-provisional` 契约，默认关闭，不能称为 gcsim parity 或官服精确实现。
- 当前经典反应家族已经能由核心执行：正/反融化、正/反蒸发、超载、超导、感电、冻结/碎冰，火/水/冰/雷扩散，火/水/冰/雷结晶，燃烧、绽放/烈绽放/超绽放，以及原激化/超激化/蔓激化。精确 1.42 / `aura-v9` 发布门以 24 个场景锁定 24/24 个非 `none` 标签和 16 类经典反应，并检查确定性、无机制截断、伤害构成、个位显示伤害与曲线末值。这里的“通过发布门”只表示当前版本化代码路径和审计向量存在；Lunar-Charged、Lunar-Bloom、Lunar-Crystallize 等 Lunar 反应完全未实现，经典反应的顺序与常量也仍统一标记为 `fixed-gcsim-provisional`，不等于官服真值、完整多 Aura 语义或完整 gcsim 精度。
- 水草双向绽放以及燃烧/激元素相交的 v5 路径会生成 `bloomReactions`，并在 30 帧后生成具有稳定 ID、来源/归属、确定性位置和全场最多 5 个上限的草原核。当前草原核生成后的寿命固定为 `300f`，但参考源码对此数值本身带不确定注释，所以仍是 provisional 兼容常量；第 6 个核心会淘汰最旧核心。自然到期后 1 帧结算半径 5、倍率 2 的绽放，火接触后 1 帧结算半径 5、倍率 3 的烈绽放；雷接触后 60 帧先以 15m 选择圆与敌方圆形 hurtbox 求交，再按目标中心距离和注册顺序稳定选择最近目标，并以半径 1、倍率 3 结算超绽放。核心生命周期、接触、ReactionA、父链和 DamageEvent 交叉引用都进入严格结构化日志。
- 在 `aura-v5/v6` 中，`pendingHydroBloomFollowup` 仍只是兼容审计标记，实际同步结果以 `bloomReactions` 和草原核日志为准；`aura-v7/v8` 则要求每个 pending 标记恰好对应一条核心 `reactionTaskLog`。任务执行时用实时 Aura 形成 Bloom/草原核预约或明确记录跳过，不能由 UI 根据这个布尔字段自行补算。
- `playerDamageModel` 是显式版本边界：`disabled` 保持历史兼容结果，`reaction-self-v1` 才启用玩家反应自伤。启用时配置必须给出静态玩家二维位置、碰撞半径、每名队员的初始 HP 比例和火/冰/水/雷/风/岩/草/物理八项抗性；当前前台角色在实际自伤帧承受伤害。玩家位置不会随冲刺、跳跃或切人移动，角色 Max HP 也只从静态面板初始化。
- 燃烧使用对应敌方反应攻击的抗性前原始伤害，绽放、烈绽放和超绽放分别取对应原始伤害的 `2%` 作为玩家侧输入，再经过玩家元素抗性。燃烧自伤不进入玩家 ReactionA；绽放系玩家自伤按“受击玩家 + 来源角色 + 反应”在 30 帧半开窗口只允许前两次造成伤害，后续尝试仍保留零伤害审计。玩家侧转化反应伤害不普通暴击并忽略防御。
- 玩家空间检查、`playerDamageEvents`、`playerHpTimeline`、逐角色 HP 汇总、总承伤，以及到 Burning/草原核/ReactionA/护盾日志的双向 ID 都由核心和严格 Schema 维护。出圈只记录 Miss；超绽放没有合法敌方目标时不会伪造玩家命中。所有玩家承伤与敌方 `damageEvents`、总伤、DPS、角色/技能统计和敌方伤害曲线完全隔离。
- 核心新增输出侧独立版本 `targetStateTimeline.version = "1.0.0"`：按实际 AuraEngine 调用点记录初始/结束边界、普通 Aura 自然到期、直接命中与独立反应伤害的附着/碎冰子阶段，以及冻元素、激元素、感电和燃烧的 Tick、削减与到期。事件点携带真实 `eventPriority / eventSequence / intraEventSequence`，自然衰减点不会伪造队列事件；数组顺序和连续 `id` 是权威顺序。网页 Aura/Fuel 曲线只按这些核心点的原序绘制，并通过 `primaryDamageEventId` 回链逐击，不再合并旧日志、手写优先级或自行排序。
- 草与雷双向触发原激化；典型 `1U` 与 `1U` 生成 `0.8U` 激元素，并按 `360 + 300 × 激元素U` 帧衰减。较弱候选不覆盖，等强/更强候选按来源槽刷新。雷命中激元素触发超激化，草命中触发蔓激化；两者不消耗激元素，分别把 `1.15` / `1.25 × 等级基准 × (1 + 精通加成 + 反应增伤)` 作为加算基础伤害，再进入本段增伤、防御、抗性、暴击、增幅与目标策略。激化精通在命中帧读取，即使技能倍率采用行动快照。
- 正向/反向融化、正向/反向蒸发由核心根据命中元素、敌方 Aura、元素量和 ICD 自动判断。
- 超载伤害使用角色等级基准、`2.75` 基础倍率、转化反应元素精通加成、反应增伤和目标火抗；不暴击、忽略防御，不施加 Aura，也不触发普通命中回调。触发、GCD、范围目标、未解析坐标和生成的伤害事件均进入 `reactionDamageLog`。
- 超导独立冰伤使用同一等级/精通公式与 `1.5` 基础倍率。每个被范围伤害命中的目标从伤害帧起获得 720 帧 `-40%` 物理抗性；目标级状态按半开区间结算，刷新会截断旧区间，并完整写入 `reactionStatusLog`。当前三层目标策略中，数值伤害免疫只把该段伤害乘为零；只要反应范围判定为 landed，超导状态仍会施加。
- 感电支持水打雷与雷打水，并在同一目标保留水雷共存。新流在触发后 10 帧产生首次单目标雷伤，之后每 60 帧检查并产生下一次 Tick；刷新不重置节奏，但未来 Tick 改用最近触发者的等级、精通、反应增伤与快照。每次实际非零伤害后 6 帧，水/雷 Aura 各削减 `0.4U`；数值伤害免疫会跳过本次削减。若后续命中通过其他反应移除水或雷 Aura，周期流在该命中帧立即停止；已经排队的首次伤害仍会结算，但不会再排下一 Tick 或削减 Aura。启动、刷新、每次 Tick、削减、跳过和停止均写入 `periodicReactionLog`。
- 冻结支持水打冰与冰打水：消耗量取来袭元素量与剩余目标 Aura 的较小值，生成其两倍的独立冻元素耐久。冻元素从 `0.4/60 U/f` 起逐帧增加 `0.1/3600 U/f` 的衰减速率；`freezeResistance` 会加快衰减，值为 `1` 时仍记录冻结反应和冰/水消耗，但不生成冻元素。冻元素可被火正向融化或雷冻结底超导消耗，并阻止火打水的反向蒸发、冰打雷的普通超导和新感电等错误分支；其中“水来袭本击先生成 Frozen、再阻断 EC”只在 `aura-v6` 生效，`aura-v5` 保留冻结的兼容行为。生成、刷新、免疫、消耗和精确到期均写入 `frozenStateLog`。
- 命中可声明 `strikeType: "blunt"` 与非负 `poiseDamage`；钝击先按 `0.006U × poiseDamage` 削减冻元素，只有剩余冻结时才碎冰，岩元素命中则无需钝击分类。碎冰再消耗最多 `8U`，同帧产生单目标物理独立伤害：等级基准 `×3.0`、不暴击、忽略防御，并按目标拥有 12 帧伤害 GCD。超载范围伤害按固定 gcsim 的钝击/`90` 韧性伤害语义，也能对邻近冻结目标削冻并触发碎冰。1.39 的递归模式会在父段结算前同步交付碎冰子段；兼容模式继续通过事件堆延迟交付。触发检查、两阶段冻结消耗、GCD、父伤害和整数伤害全部进入逐击审计、`frozenStateLog` 与 `reactionDamageLog`。
- 风元素附着可按固定 gcsim 顺序扩散雷、火、水、冰和冻元素；水雷共存时，雷扩散会立即递归检查水，再继续常规顺序，因此一个风命中可产生多条扩散审计。扩散先以 `0.5 × 剩余风元素量` 削 Aura，并按固定 durability 公式计算传播元素量；典型 `1U 风 + 0.8U Aura` 消耗 `0.5U Aura` 并传播 `2.2U`。每个通过元素/目标本地 6 帧队列 GCD 的扩散会排入触发后 1 帧的源目标伤害，以及触发后 5 帧、半径 5、排除源目标的范围传播。水扩散的范围段伤害为 0，但仍保留逐目标事件和元素传播。
- 扩散自身段与传播段都是独立 `DamageEvent`，使用等级基准 `×0.6`、不暴击、无视防御和被扩散元素抗性；其独立扩散伤害组在 30 帧窗口只让前两段产生伤害，之后的段仍处理 Aura 和二次反应。它与通用 ReactionA/B 是不同的兼容状态机。传播附着会在目标上再次运行 Aura 引擎，并用 `parentDamageEventId` 保留“风命中 → 扩散传播 → 二次反应伤害”父链。
- 通用 ReactionA 按 `目标 + 角色 + 反应` 隔离碎冰、超导、绽放、烈绽放和超绽放，在半开 30 帧窗口允许前两次伤害；ReactionB 同样隔离超载和感电，但只允许第一次伤害。被阻止的尝试仍进入审计，且不回滚已经合法发生的 Aura、接触或核心生命周期变化。
- 岩元素附着按固定 gcsim 的雷→水→冰→火→冻元素顺序选择第一条可结晶 Aura；所有结晶元素共享目标本地 60 帧队列 GCD。成功时按 `0.5 × 岩元素量` 削减 Aura，23 帧后生成元素碎片，触发后第 54 帧起才可拾取；碎片从生成起存活 900 帧，全场上限 3 个，第四个会淘汰最旧碎片。GCD 阻止时不会消耗 Aura，也不会生成碎片。
- 合法时间线新增显式 `pickUpCrystallize` 命令，支持指定火/水/冰/雷或 `any`，且不占用行动帧。护盾等级与精通在碎片生成帧快照；拾取时按固定等级表和 `40/9 × EM/(1400+EM)` 计算吸收量，覆盖既有结晶盾，并在 906 帧后到期。1.32 的玩家自伤会先消耗当前结晶盾基础 HP，再扣前台角色 HP；同元素伤害使用 `2.5` 倍吸收，来袭岩伤使用 `1.5` 倍，其余为 `1` 倍。吸收与破裂均写入护盾日志和时间线。碎片生成/淘汰/过早拾取/成功拾取/到期、护盾增加/覆盖/到期仍由核心返回，并在网页现有表格与护盾阶梯曲线显示；玩家自伤吸收/破裂尚无专用 UI。
- 正式 `aura-v1`–`aura-v9` 配置禁止手工 `reaction` 标签；`reactionOverride` 只在显式调试开关下可用。
- `enemy.targets` 可注册最多 32 个具名敌方目标，并分别覆盖等级、抗性、减防、初始附着，以及可选的静态二维坐标与碰撞半径；未声明时核心物化兼容目标 `enemy-0`。每个目标拥有独立 Aura 与附着 ICD 状态，结果、逐击表和 Aura 曲线均保留目标身份并可筛选。
- 1.35 的 `enemy.resistances` 与 `enemy.targets[].resistances` 都必须是严格、完整且数值有限的八键表：`pyro / cryo / hydro / electro / anemo / geo / dendro / physical`。实际基础抗性按 `目标八项表 > 目标标量 > 共享八项表 > 共享标量` 解析；目标级 `resistance` 与 `resistances` 互斥。输出边界会在每次模拟返回前核对目标解析顺序、标量/表继承与每个 `DamageEvent` 的实际元素和 `enemyStateBeforeHit.baseResistance`；历史版本即使通过非 JSON 原型夹带逐元素表也会 fail-closed。旧 `enemy.resistance` 仍是必填兼容回退，不会因迁移而被删除或自动解释成正式敌人数据库。
- `enemy.targetMotions` 可按目标声明有序、不重叠的 60 FPS 线性移动分段；分段从上一已解析位置移动到 `endPosition`，分段间保持位置，相邻分段在边界帧连续。核心返回含实际起点的 `targetMotionTimeline`。
- 每个逐击先进入结构化 `hitResolutionLog`；未指定目标时默认 `enemy-0 / landed`，场景可在命中定义的 `targeting` 中选择已注册目标或显式指定带原因的 `miss`。对 landed 命中还可独立声明伤害免疫、Aura/反应阻断和命中回调阻断；核心同时保留公式潜在伤害与实际 0 伤害。Miss 或回调阻断都不会错误启动粒子 ICD。
- `enemy.targetPhases` 支持有序、不重叠的 60 FPS 半开阶段窗口 `[startFrame, endFrame)`；核心返回 `targetPhaseTimeline`，逐击日志标记策略来自默认、活动阶段还是逐击覆盖，并在相邻阶段的精确边界切换。
- 单个命中可用 `targeting: { mode: "fanout", targets: [...] }` 对多个已注册目标逐一结算；每个目标拥有独立 Miss、阶段、伤害、Aura 和回调结果，但同一逻辑命中的命中确认产球只聚合执行一次。
- 单个命中也可用 `geometry` 对全部具备位置的注册目标自动求交：`circle` 比较中心距离，`rectangle` 比较中心到旋转矩形的最近距离，`capsule` 比较中心到有限线段的最近距离与“扫掠半径 + 目标碰撞半径”，`sector` 比较圆形碰撞体到由圆心、半径、方向和夹角定义的二维填充扇形的最近距离。几何默认使用世界坐标；声明 `coordinateSpace: "actor-local"` 时，核心会用 `actorPoses` 中施放者的静态位置与朝向把全部形状旋转、平移为世界坐标。逐击日志记录原坐标空间、施放者姿态、解析后的形状、距离、阈值和范围外原因；`targeting` 与 `geometry` 互斥，360° 扇形确定性退化为圆盘。
- ATK / HP / DEF / EM 缩放、增伤、防御、抗性、暴击、增幅反应、激化加算反应及转化反应公式。
- `ampBase` 必须是有限正数。为保证 1.35 及更早兼容配置可回放，兼容模式继续允许 `reaction: "none"` 搭配显式 `ampBase` 作为旧版倍率覆盖；它不会被标记为一次正式元素反应。Aura 模式仍只允许在显式调试开关和非 `none` 的 `reactionOverride` 下使用。公式层会拒绝零值、负值、非有限值以及转化/加算公式的非法运行时输入。
- 行动快照与命中时动态结算。
- 能量消耗、固定回能和能量不足整行动取消；合法时间线会在运行时回滚失败行动，不预占冷却、不改变行动状态，也不生成 Buff、命中、回能或粒子。
- 版本化粒子/晶球定义：固定生成帧或指定逐击命中触发、按来源角色和键共享的粒子内部冷却、元素、离散数量范围、飞行帧和固定随机种子。
- 粒子在到达帧按当时前台、队伍人数、同/异/无色、粒子/晶球和每名角色充能效率分配。
- 固定回能、粒子回能、实际获得、能量上限溢出和爆发消耗分别记录；固定回能支持按来源角色和键共享的内部冷却，并保留通过/阻止日志及精确可用帧。
- 每段伤害的施放者、缩放面板、伤害归属、状态、敌人状态和完整乘区。
- 每段伤害同时返回核心浮点原始值和四舍五入到个位的显示值。
- 每段伤害由核心返回直接伤害、激化加算和转化反应三类最终贡献；三项严格求和为该段 `finalDamage`。插件上下文把普通 flat 与激化 flat 分开，Catalyze 命中若仍用含糊的总 flat 覆盖会按插件 ID 直接失败，避免 UI 展示无法证明的归因。UI 不反推伤害，并直接绘制三类累计构成曲线。
- 每段伤害返回 `auraBefore`、`auraApplied`、`auraConsumed`、`auraAfter`、ICD 流和自动反应审计；兼容模式明确返回“未模拟”。
- 超载/超导触发命中与每个实际范围伤害都是独立 `DamageEvent`；触发事件通过 `transformativeReactions` 记录同击有序的全部排队/GCD/目标状态定义，`transformativeReaction` 保留首项兼容投影；伤害事件通过 `parentDamageEventId` 反链触发命中，并带独立的等级基准、精通、反应增伤和抗性因子。感电 Tick、碎冰、扩散自身/传播，以及绽放、烈绽放、超绽放也都生成独立 DamageEvent 和可追踪父链。
- 角色/技能伤害构成。
- 逐目标实际/潜在伤害、命中、Miss、免疫段数、DPS 和占比构成。
- 逐秒堆叠伤害时间轴。
- 每个折点对应一段伤害的逐击累计伤害曲线，以及由核心提供的直接伤害、激化加算、转化反应和按反应累计的构成曲线；绽放系伤害会进入现有逐击、时间轴和伤害曲线，专门的草原核生命周期面板后置。
- 敌方 Aura/激元素/Burning Marker/Fuel 的衰减与消耗曲线、逐来源槽、逐击附着表、激元素状态机和燃烧状态机；点击可定位对应伤害事件。
- 逐角色能量阶梯曲线、粒子生成/接收标记、每次命中产球检查及 ICD 阻止摘要和逐角色回能审计表。
- 可筛选、分页并展开公式的逐段伤害日志。
- JSON 导入、导出和高级编辑。
- 固定游戏数据 Schema 与迁移门：当前目录版本
  `gi-6.7-zh-CN.genshin-db-5.2.12.enka-2b9d23b.1`。
- 可审计的完整中文目录：120 个角色、125 套天赋、762 个技能/被动记录、237 把武器；技能倍率保留 15 级数组，武器保留 1–5 精炼值。这些数字只表示可查询目录覆盖，绝不表示 120 个角色或 237 把武器已经具备完整可执行机制。
- 每条角色、天赋、技能和武器记录都带补丁、来源、来源版本、核验时间、校验状态、说明和机制映射状态。
- `AbilityBlueprint` 1.7 把技能倍率引用、命中帧、分后续动作取消帧、附着、ICD、固定回能及其内部冷却、命中产球及其内部冷却、行动状态、前置条件、未实现机制和逐项证据放入严格 Schema；1.0 / 1.1 / 1.2 / 1.3 / 1.4 / 1.5 / 1.6 Blueprint 可迁移，通用编译器默认拒绝 `partial`。
- 内置“杜林黑 E · 部分机制审计向量”：精质转变 6 秒窗口会被核心授予/强制前置/消耗，随后进入 30 秒黑度之否；已按 gcsim 固定提交映射普攻/重击/战技/爆发/冲刺/跳跃/切人取消帧，天赋 10 级三段倍率 `1.30032 / 0.9576 / 1.16352`、命中帧 `48 / 53 / 58`、DurinSkill 自定义 ICD、带 6 秒共享内部冷却的 33 固定回能，以及由首段已处理命中触发并受 18 帧共享粒子 ICD 约束的 4 火粒子，均由核心输出，并在网页逐段、行动状态表、伤害曲线、Aura 曲线和能量曲线中展示。
- 内置“杜林白 E · 部分机制审计向量”：同一精质转变前置由第二次战技消耗，白/黑分支状态通过核心 `clears` 互斥；天赋 10 级倍率 `1.9008`、全局命中帧 `50`、33 固定回能和命中产 4 火粒子均有逐项测试与网页展示。锁定 gcsim 提交未给该段设置 `Durability`，本向量因此按“火伤但不施加附着”实现；这项行为仍需官方资料或官服实测交叉验证。
- 完整 1.9 MB 数据包与约 130 kB 浏览器 UID 索引分离；生产首屏 JS 只使用轻量索引。
- 从 Enka.Network 读取公开 UID 展示柜，经 Schema 校验后展示本地化角色/武器/技能名称、等级、命座、技能等级、面板与圣遗物。
- UID 映射会报告所有缺失的角色、武器和技能 ID；旅行者按实际技能 ID 集合解析元素变体。
- 测试 UID `283733593` 在 2026-07-26 真实只读联调返回 12 名公开角色，当前目录映射为 0 项缺失。
- “毕业站位”目前只生成显式不可模拟的占位对象，不会编造统一毕业面板。

展示柜请求由 Vite 开发/预览服务器的 `/api/showcase/:uid` 代理发出，以便设置上游要求的自定义 `User-Agent`，并按上游 `ttl` 做内存缓存。纯静态部署时需要把同一路由迁移到服务端函数。

## 数据声明

内置“黑杜林融化”配置的 `verificationStatus` 为 `provisional`。其中角色、装备系数和确定性回能包含用于兼容回归的示例魔法数：

- 它们不是正式、已验证的游戏数据库。
- Golden Fixture 只证明迁移前后结果一致，不证明数值符合游戏实测。
- 页面明确显示 `provisional`，导出配置也保留这一状态。

单独的杜林黑/白 E 审计向量同样是 `provisional + partial`。倍率来自固定 `genshin-db` 数据，帧、黑 E 附着 ICD、白 E 无附着口径、回能和产球用固定 gcsim 提交交叉核对；这只证明列出的 E 分支子集可追溯、可执行，不代表杜林整角、命座、武器或完整队伍已经验证。

### Golden 与复现身份

- `legacy-default-120s.golden.json` 继续冻结 Vanilla 的原始浮点结果；1.33–1.36 的版本化 Fixture 保留各自历史投影，`legacy-default-120s-1.36.golden.json` 不被改写；`legacy-default-120s-1.37.golden.json` 冻结 1.37 兼容身份与不变的数值基线。1.38 使用独立的 `legacy-default-120s-1.38.golden.json`，不得覆盖 1.37 文件。1.39 已用四份独立 Fixture 冻结兼容默认、Quicken→Bloom、v2 Miss 审计和递归碎冰边界；默认 120 秒仍为总伤 `41410555.13728799`、DPS `345087.9594773999`、命中 `269`、反应命中 `129`、跳过行动 `3`。
- 1.39 Fixture 的 SHA-256 为：`legacy-default-120s-1.39.golden.json` = `9765979c127cee707a99db1344a9569d25560d8a2f19ad2577fac2c7c9225151`；`quicken-bloom-task-order-1.39.golden.json` = `a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534`；`shatter-recursive-delivery-1.39.golden.json` = `a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579`；`target-reactable-phase-1.39.golden.json` = `40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8`。它们新增 1.39 运行身份和交付/阻止审计，不允许回写 1.37/1.38 文件。
- 1.40 使用三份新的只读 Fixture：`legacy-default-120s-1.40.golden.json` = `843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f`；`quicken-bloom-task-order-1.40.golden.json` = `b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4`；`electro-charged-quicken-cleanup-1.40.golden.json` = `bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0`。前两份分别冻结不变的 120 秒兼容基线和 identity-only 的 `aura-v7` Quicken→Bloom 语义；第三份冻结 `aura-v8` 的 F1 cleanup 与 Hitlag5→F6 重投影。1.40 默认总伤、DPS、命中、反应命中、跳过行动以及角色/技能浮点值均与 Vanilla/1.39 完全一致。
- 1.41 已新增并复核两份只读 Fixture：`legacy-default-120s-1.41.golden.json` = `9768d8b0461bd641ed5a4097e1cfe4204e1d6db9e9a6453e75754eb1a90bf9c8`；`electro-charged-propagation-1.41.golden.json` = `b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18`。前者证明内置预设与 1.40→1.41 迁移结果使用 `single-target-v1` 时，默认 120 秒总伤、DPS、角色/技能伤害、命中、反应命中和跳过行动与上述冻结值完全一致；后者只冻结当前 `community-provisional` 的候选/逐目标伤害契约。
- 1.42 已新增并现场复核两份只读 Fixture：`legacy-default-120s-1.42.golden.json` = `ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df`；`electro-charged-global-cadence-1.42.golden.json` = `ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611`。前者冻结 `1.42.0 / 1.42.0-ec-global-cadence-safety` 身份，但继续保留历史 Aura 模式与 `single-target-v1`；总伤 `41410555.13728799`、DPS `345087.9594773999`、269 个命中、129 个反应命中、3 个跳过行动和完整 269 段伤害摘要均与 1.41/Vanilla 一致。后者冻结 `aura-v9` 的长 Hitlag、恢复边界、dormant cadence、逐来源 Wane、`ended-before-deadline` 和逐击伤害/曲线闭合。
- 1.44 已新增并现场复核两份只读 Fixture：兼容默认 `legacy-default-120s-1.44.golden.json` = `e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05`，`configHash = fnv1a32:dad42c01`，`reproducibilityKey = gdl-v2-fnv1a32-03487d7e`；Burning 机制 `burning-callback-delivery-1.44.golden.json` = `4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65`，其场景 `configHash = fnv1a32:3aa2ff18`、`reproducibilityKey = gdl-v2-fnv1a32-ee7f1332`。前者冻结 `1.44.0 / 1.44.0-burning-callback-delivery` 身份，但默认预设仍使用 `legacy-event-heap-v1`、历史 Aura 与 `single-target-v1`；总伤、DPS、角色/技能汇总、269 命中、129 反应命中、3 跳过行动及逐击 digest `b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f` 与 1.42/Vanilla 一致。后者锁定 v3 注册顺序 attempts、callback-owned 反链、F15 零延迟交付与 F16 正延迟 Overload 子反应，仍只是 `fixed-gcsim-provisional`。上述 1.42 两份 Fixture SHA 保持不变，旧 Golden 没有被回写。
- 本轮全量 Vitest 已实际运行并通过 `79` 个测试文件、`1084/1084` 项测试；该数量只记录本次核心/Schema/Golden 验证，不预写 build 或 Playwright 结果。
- `burning-aura-v4-1.30.golden.json` 冻结 1.30 Burning 兼容切片；1.34–1.37 身份继续作为历史证据保留，1.38 身份只通过新的兼容 Fixture 更新，不改写历史 Burning 数值、状态日志或摘要。
- `reaction-matrix-1.31.golden.json`、`reaction-matrix-1.32.golden.json` 与 `reaction-matrix-1.33.golden.json` 保留历史 14 个 `legal-frame-v1 + aura-v5` 向量；`reaction-matrix-1.34.golden.json` 保留 1.34 的 15 个历史向量；`reaction-matrix-1.35.golden.json` 冻结当前 17 个向量，其中新增 `elementalResistance` 覆盖逐元素抗性，新增 `hydroFrozenEcGuard` 冻结 `aura-v6` 的“本击先生成 Frozen 后必须阻断感电”边界。该 guard 以 F0 的 `3U` 水命中各 `1U` 火/冰/草/雷，结果只能依序为 `vaporize → freeze → bloom`，不得启动感电或生成 F+10 Tick，草原核在 F+30 生成；独立的 `hydro-order.test.ts` 同时锁定 `aura-v5` 的历史 post-Freeze EC 行为。`aura-v7-order-release.test.ts` 再锁定七种来袭元素的复合有序链，包括固定 `vaporize.go` 中“Frozen 存在时火蒸发必须被拒绝、随后融化消耗 Frozen”的相反方向边界；62,208 向量的公开初态 covering grid 则验证普通 Aura/来源槽的有限性、非负性、守恒和确定性。兼容向量继续保持 `targetClockModel: disabled`，Hitlag 与 `aura-v6` 雷多反应链也继续由独立单元/集成向量冻结。
- 1.32 增加显式 `playerDamageModel`，1.33 增加显式 `targetClockModel`，1.34 增加显式 opt-in `aura-v6`，1.35 增加可选的完整敌方八项抗性表，1.36 增加显式 opt-in `aura-v7` 与核心 `reactionTaskLog`，1.37 再增加显式 `targetTaskModel` 与 `targetTaskPhaseLog`，1.38 增加 `target-phase-v2` 与独立 `targetPhaseLog`，1.39 增加显式 `reactionDeliveryModel`，1.40 增加显式 opt-in `aura-v8` cleanup，1.41 增加显式 `electroChargedPropagationModel`，1.42 增加显式 opt-in `aura-v9` 全局 cadence safety，1.44 增加显式 `target-phase-v3` 与 callback-owned delivery audit。1.42→1.44 只更新身份并保留旧模式，不自动 opt-in v3；1.43 保留未发布。所有历史 Fixture 均不得回写；每一版本只能新增独立 Fixture。所有 Fixture 都是回归证据，不是官方数值认证或完整 gcsim parity 报告；其中测试抗性、草原核寿命、固定 gcsim 路径、附近传播半径和默认杜林预设的示例魔法数都仍是 `provisional`、`community-provisional` 或 `fixed-gcsim-provisional`。

## 当前精度边界

本版本不是 gcsim 精度实现。`legacy-v0.1` 继续保持 Golden 兼容；`aura-v1`–`aura-v9`、冻结的 `target-phase-v1`、受限的 `target-phase-v2`、1.44 显式 opt-in 的 `target-phase-v3`、1.39 的碎冰递归交付切片、1.40 的 EC next-target-Tick cleanup、1.41 默认关闭的附近湿目标传播、1.42 的 EC 全局 cadence safety 和粒子引擎只覆盖当前可审计机制闭环。v3 也只声明已建模 Burning Tick 的 callback-owned 零延迟跨目标交付、F-1/当前 Aura 读取与接收目标 `Reactable.Tick` 的局部顺序；它不是通用全目标 barrier、全部反应同步语义或完整 gcsim target phase。固定 gcsim 交叉参考路径保持 `fixed-gcsim-provisional`；1.41 附近传播单独标记为 `community-provisional`，不能称为官方/官服真值或完整 gcsim 精度。尚未实现或未完整实现：

- `aura-v4`–`aura-v9` 已实现上述 Burning Marker、Fuel、周期伤害、Tick 火附着、归属/快照刷新和核心输出。`legacy-event-heap-v1`、v1 和 v2 继续按冻结历史语义将实际范围伤害排入后续全局 `reactionDamage`。只有精确 1.44 的显式 `target-phase-v3` 才在 owner callback 内完成零延迟跨目标交付，并按注册顺序标记接收目标为 `before-reactable-tick` 或 `after-reactable-tick`。`target-local-hitlag-v1` 造成的陈旧唤醒会先重投影到正确全局帧；该切片仍没有实现通用敌方任务所有权、完整 gcsim target phase 或官服全部边界，正延迟子反应也仍由全局 heap 处理。
- v2 的 `Reactable.Tick` 可以记录普通 Aura、Frozen、Quicken、Burning Fuel 与感电共存自然到期，但只证明每个目标内部的 callback→生命周期推进顺序；它不建立所有目标共享的 barrier，也不把感电 damage Tick/Wane、ICD、ReactionA/B、Quicken→Bloom、草原核/结晶实体或其他 core work 改为 target-owned。
- `reaction-self-v1` 已为 Burning Tick 建立玩家空间命中、抗性、结晶盾和 HP 自伤路径；`disabled` 兼容配置继续返回 `selfDamageStatus: "unsupported-player-damage-model"`，不会静默改变旧结果。当前模型只处理反应自伤，并不等于通用玩家受击系统。
- 八项玩家抗性必须由输入配置显式提供。固定 gcsim 提交在这条玩家路径中并没有提供可直接当作官服角色抗性数据库的正式真值；本项目采用通用三段抗性公式，并把这些抗性视为用户输入/项目约定。不得把固定测试向量或默认抗性外推为所有角色、环境和版本的正式数据。
- 玩家位置、碰撞半径、Max HP 和初始 HP 比例当前都是静态输入；切人只决定自伤帧的受击角色，不移动玩家。尚无动态 Max HP Buff、治疗、死亡/倒地、复活、敌人攻击、玩家 Aura 与被敌攻击触发的反应、非结晶盾或护盾强效。`clamp-and-continue` 会把 HP 钳制到 0 后继续记录事件，只是确定性审计策略，不是游戏死亡逻辑。
- 本轮没有增加任何新 UI 面板；现有全队/角色/技能/时间轴/逐击、伤害构成与曲线继续只消费核心结构化结果。玩家侧及 v3 delivery 日志可供后续展示扩展使用，但页面不得自行重算伤害、Aura、护盾、HP 或事件顺序。
- 角色专属 `OnBurning` hook-before-snapshot 尚未进入通用事件阶段；纳西妲 C2 对燃烧等转化反应的特殊暴击也未实现。当前燃烧 Tick 不应被用于验证这些角色特有机制。
- `aura-v5/v6/v7/v8` 已实现上述绽放、草原核、烈绽放和超绽放纵向切片，并可在 `reaction-self-v1` 中结算其玩家自伤；v7/v8 的 Quicken→Bloom follow-up 仍是列明的 core zero-delay task，不属于冻结的 v1 或 1.38 v2 target-owned queue，v8 只把其 EC cleanup 决议放入下一目标 Tick。草原核 `300f` 寿命、简化二维位置/范围和最近目标选择仍是 provisional，丰穰之核、卡维强制迸发、角色专属核心修正和完整三维碰撞仍未实现。旧 `aura-v3/v4` 对绽放系继续保持历史 fail-closed。
- `aura-v8` 已冻结 Quicken→Bloom 耗尽同代水 Aura 后的 EC cleanup，包括 F1、Hitlag5→F6、同代恢复、代次替换、自然到期碰撞、模拟末端 pending 和 F10 首次伤害保留。1.42 `aura-v9` 已补齐跨过 F70 callback 的长目标 Hitlag、F20/F69/F70/F71 恢复边界、dormant cadence、每来源槽 `-0.4U` Wane、旧代 Wane 隔离和 `ended-before-deadline` 审计。1.41 的 `nearby-wet-radius-v1` 仍只增加源 Tick 对显式半径内湿目标的逐目标伤害分支：不附着 Aura、不递归、不接管或刷新副目标流、不重置 cadence、不产生副目标 Wane。官服选择半径、目标上限、传播层数、secondary takeover/cadence reset/secondary Wane，以及其他多 Aura overlap 与感电/冻结/燃烧等特殊状态的全部排列仍未完成。
- `targetStateTimeline`、草原核时间线和玩家 HP 时间线只把当前已经实现的状态变化按核心真实顺序暴露给消费者；启用目标时钟时目标状态点同时携带 `targetFrame`，但它们不会补全玩家 Aura/被敌攻击触发的反应、敌方攻击、治疗、死亡/复活、任意 Aura 来源重叠、角色回调或其他缺失机制。
- 火、水、冰、雷、草、风、岩七种来袭元素的代表性高信息量链已有 `aura-v7` 精确顺序测试；公开可配置的五种普通初始 Aura 又通过既有 mixed-gauge covering 门检查有限性、非负性、来源槽/消费守恒、确定性与输入数组换序。该门仍不覆盖 Frozen、Quicken、Burning/Fuel 等特殊 Aura 的全部可达排列。1.44 v3 另锁定 Burning callback 的接收目标 F-1/当前 Aura→该目标 `Reactable.Tick`、注册顺序反转、Hitlag 重投影、`landed / miss / unresolved` attempts、确定性与正延迟 Overload 子反应继续入 heap；它不证明感电 Tick/Wane 已本地化，也不证明所有 callback/反应都已同步化。未覆盖分支仍应 fail-closed 或作为新引擎版本实现。所有固定顺序只标记为 `fixed-gcsim-provisional`，参考源码自身的顺序 TODO 也禁止把它外推为官服真值。
- 扩散只覆盖固定 gcsim 提交中的目标 Aura 消耗、1f/5f 双攻击、二维半径 5、源目标排除、传播附着、二次反应和 ReactionA 伤害 ICD。尚未实现三维高度、风场吸附/聚怪、扩散对物件/召唤物/玩家目标的命中、扩散攻击的真实视觉/飞行路径、按来源 Aura overlap 数组或任何角色特有扩散修正。当前二维圆心在触发帧冻结，目标位置在传播帧读取，与固定提交 `NewCircleHitOnTarget` 创建静态圆形的行为一致。
- 结晶碎片位置使用独立固定种子，在生成帧目标圆形碰撞体半径外 `0.5m` 取确定性角度；固定 gcsim 同样把碎片简化为随机圆周点，但本项目没有复刻其全局 RNG 调用序列。显式拾取命令与参考实现的 `pick_up_crystallize` 一样不检查角色到碎片的距离；1.32 只让已实现的四类玩家反应自伤消耗结晶盾并记录吸收/破裂，尚无角色移动拾取、自动吸附、一般敌方攻击、非结晶盾、护盾强效 Buff、磐岩套/角色被动回调、碎片被攻击、月结晶或真实视觉实体。因此当前护盾/HP 结果不是完整生存模拟。
- 超载/超导尚未模拟击退、完整敌人韧性条、爆炸高度/三维碰撞、物件/召唤物/玩家自身受击或真实敌方移动；半径 3 求交依赖场景显式提供的二维目标坐标与圆形碰撞半径。当前韧性数值只用于固定 gcsim 的“钝击先削冻”局部规则，不是通用韧性系统。启用目标时钟时，已经存在的超导减物抗状态会受 Hitlag 延长；防御 Halt Bonus 尚未成为公共配置，其他敌方状态的 Hitlag 属性也未一般化。冻结状态不会自动停止声明式目标移动，也未实现冻结气泡破裂或冻结抗性的敌人数据库。`deferred-event-heap-v1` 继续让碎冰子段排在触发父段之后；1.39 的显式递归模式才允许子段先交付并以严格前向父引用保持审计。固定 gcsim 还会建立一个 `DoNotLog` 的零伤害 “Freeze Broken” 合成攻击，本项目尚未实现该攻击及其回调面。等级基准和反应常数来自固定 gcsim 提交的交叉校验，不代表整个 Aura/反应系统已达到 gcsim 精度。
- 感电默认 `single-target-v1` 严格跟随固定 gcsim 提交的单目标 Tick 语义；每个敌人独立维护共存 Aura 和周期流。1.41 的显式 `nearby-wet-radius-v1` 是独立、默认关闭的社区临时契约，不冒充该固定 gcsim 路径：它只读取副目标当时的 Hydro Aura 与二维位置/碰撞半径来决定是否生成伤害，不改变任何目标 Aura 或周期流。`aura-v6` 中冻元素会阻止新感电，包括同一水命中刚生成 Frozen 的边界；`aura-v5` 仍保留旧 post-Freeze EC 结果用于兼容回放。扩散已覆盖水雷共存的雷→水递归多扩散，但按来源 Aura overlap 的全部组合和真实游戏额外目标传导仍未完整验证。
- `aura-v3/v4/v5/v6/v7/v8` 普通 Aura 与激元素已有逐来源槽、共享衰减和逐槽消耗；`aura-v1/v2` 仍保留旧聚合状态。结果 Schema 现在在 `sourceSlots` 存在时强制来源唯一、聚合 Gauge 等于最大槽，并对每条 `sourceMutation` 强制 `before - consumed = after`；无来源槽的历史投影继续兼容。v4–v8 已有单目标 Burning Marker/Fuel 来源与归属；目标本地 Hitlag 时钟已有 opt-in v1，但一般化特殊 Aura overlap、更多 Hitlag 属性和角色回调顺序仍未完成。
- 全角色的特有 ICD Group 数据库；引擎已经支持声明式 Profile，但当前只有 DurinSkill 的 18 帧 / `[允许, 阻止, 阻止]` 审计映射。
- 经过来源核验的逐技能产球数量/概率/飞行帧，以及敌人掉球、击杀掉球、白球来源、拾取路径和多目标粒子。
- 1.44 继续沿用冻结的 1.42 能量语义：从配置、行动、命中确认、粒子事件和固定回能逐点重放 `energyLog`、`energyStats` 与整条 `energyCurve`，但仍是“同帧行动先于粒子、行动开始立即扣能”。固定 gcsim 提交 `ef41805d855a60b9e1035293584b85c085dc69e7` 则先处理已排定的全局粒子任务，并按角色定义的延迟帧扣爆发能量。1.43 保留给这条尚未发布的 `energyTaskModel` wire；1.44 没有偷渡该变更，不能回写 1.42 或宣称当前已经同 gcsim 对齐。
- 粒子目前按一次定义聚合为同一到达事件；其飞行不读取命中几何或静态角色姿态，也没有角色移动、拾取碰撞或逐个粒子的独立飞行轨迹。
- 尚未给全角色填入经过实测核验的命中帧、逐后续动作取消帧、动画结束帧和冷却数据；杜林只映射了指定黑/白 E 分支。冲刺/跳跃目前要求配置显式给出占用帧，不模拟耐力、位移、无敌帧、碰撞、落地或真实动作帧。
- 命中产球已支持逐击触发、显式 fanout、圆形/旋转矩形/胶囊/填充扇形几何得到的逐目标 `landed / miss`、三层目标策略、按帧阶段和“至少一个目标允许回调时只产一次球”的聚合；目标初始坐标、线性移动分段和攻击形状参数仍由场景声明。
- 当前几何只支持二维圆、可旋转矩形、有限线段胶囊和填充扇形，目标碰撞体仍只有圆形；角色姿态是场景静态值，敌方移动只支持预先声明的线性分段。尚无高度、角色移动/转向命令、追踪弹道、AI 驱动敌人移动、自动索敌、障碍物、Hitlag 导致的位移/动作/阶段暂停、真实 Boss 阶段状态机、目标死亡、护盾和特殊易伤窗口。扇形也不是带高度或自动朝向目标的三维锥体。
- 敌方逐元素基础抗性输入已在 1.35 建立，但仍只是显式场景数据，不是经过来源核验的完整敌人抗性数据库；旧标量继续作为兼容回退。减抗/减防 Debuff 当前仍作用于所有已注册目标，尚不能声明只影响单个敌人。
- Monte Carlo 暴击/粒子采样和统计分布；离散产球范围目前只按固定种子给出单次可复现轨迹。
- 社区数据目录已建立，但角色/武器记录仍为 `provisional`；尚未完成全角色/全武器的逐技能倍率、命中拆段、ICD、动作帧、粒子、快照和专属机制可执行数据库，也未完成与官方文本、实测或独立向量交叉验证后的稳定数据发布。
- 圣遗物套装、敌人数据库及其版本化效果尚未进入当前目录。
- 展示柜已能映射本地化角色、武器与技能名称，但不会自动转换为 `SimConfig`；完整 UID 数据解析、圣遗物效果编译和角色专属机制没有通过 `mechanics-mapped` 门。
- 月曜/月绽放、月感电、月结晶等 Lunar 反应族尚未实现；当前“基础反应矩阵”不得解读为覆盖这些后续反应系统。

因此，当前完成的是“全量可查询目录”，不是“全角色可执行模拟器”。Enka 只提供玩家公开配置；社区倍率表也不能代替动作帧、附着、ICD、快照、粒子和特殊机制的逐角色实现与测试。

合法时间线对每个有能量消耗的命令按顺序执行确定性前缀探测，再用已确认的失败集合重编译最终时间线；因此失败行动不会推进游标、预占冷却或改变状态，后续命令会按新帧重新执行。它仍不是 gcsim 式单遍动态行动执行器：命中确认分支、目标死亡、角色/AI 命令驱动移动、运行时空间分支和玩家条件语句尚未进入命令语言。Aura/ICD 已按注册目标隔离，静态施放者局部几何与声明式目标线性移动已能共同求交；目标本地 Hitlag 只暂停已列明的敌方时钟域，并不暂停玩家行动时间线，也不能替代完整角色动作/ICD 数据库。

## 目录

```text
apps/web                 Vite + TypeScript 展示层
packages/sim-core        纯 TypeScript 模拟与公式
packages/schemas         Zod Schema、类型和版本迁移
packages/game-data       预设、完整数据目录、轻量 UID 索引与展示柜适配器
packages/mechanics       Ability Blueprint、来源编译闸门、声明式插件与部分机制审计向量
packages/test-vectors    兼容 Golden 与版本化机制回归向量
legacy/v0.1-vanilla      冻结的原版网站和基线记录
```

## gcsim 参考边界

项目借鉴 gcsim 的“角色/技能伤害构成、逐帧 Sample、每个事件可展开计算、显式能量问题与版本化配置”思路。杜林黑/白 E 的部分路径和列明的经典反应机制使用固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 交叉校验；1–100 级反应基准数值表直接保留自该提交并附带 MIT 许可。该提交的经典感电路径使用单目标命中，所以 1.41 `nearby-wet-radius-v1` 明确不是固定 gcsim parity，而是默认关闭、显式半径的 `community-provisional` 扩展。它只冻结逐目标伤害和候选审计，不表示官方传播半径、目标选择、传播层数或 Aura 行为已验证。Hitlag、玩家/敌方八项抗性和大量场景数据仍由用户显式输入；固定提交本身也保留 TODO。因此固定路径只能称 `fixed-gcsim-provisional`，附近传播只能称 `community-provisional`，两者都不是官方数值、官服实测证明或完整 gcsim 精度。TypeScript 实现和 Schema 为独立编写；完整倍率目录来自单独固定的 `genshin-db` MIT 数据包，Enka 只用于公开展示柜和数字 ID 互操作。详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
