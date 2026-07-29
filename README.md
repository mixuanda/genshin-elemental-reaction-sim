# 提瓦特伤害实验室

一个以“逐段可审计、配置可迁移、结果可复现”为目标的原神队伍 DPS 模拟器。当前完成了 Vanilla v0.1 基线冻结、纯 TypeScript 模拟核心、合法帧时间线、基础元素反应矩阵、`aura-v5` 有序 Aura 链、ReactionA/B 伤害组、燃烧 Marker/Fuel/Tick，以及绽放、草原核、烈绽放和超绽放的确定性纵向切片。1.32 加入 opt-in 的玩家反应自伤基础模型；1.33 再加入独立 opt-in 的敌方目标本地时钟与 Hitlag 审计；1.34 新增 opt-in `aura-v6`，在不改写 v1–v5 的前提下，以共享来袭 Gauge 结算固定参考的雷元素多反应顺序；1.35 为共享敌人和具名目标加入严格的八项基础抗性表；1.36 再新增 opt-in `aura-v7`，把 Quicken 后的水草绽放跟进建模为同帧零延迟、FIFO 且执行时重读实时 Aura 的核心任务；1.37 新增独立 `targetTaskModel`，以显式 opt-in 的 `target-phase-v1` 冻结第一批 Burning target callback → 目标 Aura 衰减 → 同帧 core/incoming work 边界；1.38 再新增显式 opt-in 的 `target-phase-v2`，只冻结每个目标边界内 QueueEnemyTask / 目标 callback → 该目标 `Reactable.Tick` 的顺序，不改写冻结的 v1。当前兼容预设和 legacy 输入继续使用 `legacy-event-heap-v1`，已经显式选择 v1 的 1.37 输入在迁移后仍保持 v1。Quicken→Bloom 仍是 core zero-delay task，不属于敌方 target-owned queue。敌方每次实际伤害继续由核心返回结构化构成并进入既有全队、个人、技能、时间轴、逐段日志和累计/构成曲线；本轮优先保证基础机制，不扩展展示层。粒子/能量闭环、版本化数据目录、UID 展示柜映射与杜林黑/白 E 部分机制审计向量也已保留。

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

只验证 1.38 反应核心、逐元素敌方抗性、Quicken→Bloom 核心任务、冻结的 1.37 v1 目标相位、1.38 v2 callback→`Reactable.Tick` 边界、增幅覆盖闸门、玩家自伤、目标本地时钟、可靠 Schema 与兼容 Golden 时可运行：

```bash
npx vitest run packages/schemas/src/schema.test.ts packages/sim-core/src/__tests__/formulas.test.ts packages/sim-core/src/__tests__/amplifying.test.ts packages/sim-core/src/__tests__/reaction-a.test.ts packages/sim-core/src/__tests__/reaction-b.test.ts packages/sim-core/src/__tests__/bloom-gauge.test.ts packages/sim-core/src/__tests__/bloom-aura.test.ts packages/sim-core/src/__tests__/bloom-integration.test.ts packages/sim-core/src/__tests__/dendro-core.test.ts packages/sim-core/src/__tests__/aura-v6-electro.test.ts packages/sim-core/src/__tests__/aura-v6-simulator.test.ts packages/sim-core/src/__tests__/hydro-order.test.ts packages/sim-core/src/__tests__/quicken-bloom-task-order.test.ts packages/sim-core/src/__tests__/burning.test.ts packages/sim-core/src/__tests__/burning-v7-refresh.test.ts packages/sim-core/src/__tests__/target-task-phase.test.ts packages/sim-core/src/__tests__/target-task-phase-log.test.ts packages/sim-core/src/__tests__/aura-reactable-boundary.test.ts packages/sim-core/src/__tests__/target-phase-v2-reaction-gate.test.ts packages/sim-core/src/__tests__/target-reactable-phase-v2.test.ts packages/sim-core/src/__tests__/enemy-elemental-resistance.test.ts packages/sim-core/src/__tests__/crystallize.test.ts packages/sim-core/src/__tests__/player-damage.test.ts packages/sim-core/src/__tests__/player-reaction-damage.test.ts packages/sim-core/src/__tests__/target-clock.test.ts packages/sim-core/src/__tests__/aura-target-clock.test.ts packages/sim-core/src/__tests__/target-clock-integration.test.ts packages/sim-core/src/__tests__/target-hitlag-status.test.ts packages/sim-core/src/__tests__/reaction-matrix-golden.test.ts packages/sim-core/src/__tests__/golden.test.ts packages/sim-core/src/__tests__/performance.test.ts
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
- Zod 严格校验、字段路径错误，以及 v0.1–1.37.0 配置迁移；当前 Schema 为 `1.38.0`、引擎为 `1.38.0-target-reactable-phase`。1.35→1.36 的 identity-only 迁移仍按历史契约保留；1.36→1.37 为此前输入补入 `targetTaskModel: { mode: "legacy-event-heap-v1" }`，不会自动启用 `target-phase-v1` 或静默切换 Aura 模式；1.37→1.38 精确保留 `targetTaskModel` 的 `legacy-event-heap-v1` 或 `target-phase-v1`，绝不自动升级到 `target-phase-v2`。只有 1.38 输入可显式选择 v2。迁移继续保留 `reactionEngine`、`playerDamageModel`、`targetClockModel`、逐元素敌方抗性和其余配置；1.35 及更早配置继续遵守各自历史模式的保留/禁用规则，逐元素抗性仍从 1.35 起才是合法 wire contract，旧版本夹带该字段会 fail-closed。
- `targetClockModel` 与 Aura 版本独立：`disabled` 保持 1.32 及更早兼容结果；只有 `target-local-hitlag-v1` 允许命中声明原子的 `targetHitlag: { haltFrames, factor }`。扩展帧采用 `ceil(ceil(haltFrames) × (1 - factor))`，命中当前帧的目标 Tick 先完成，暂停从下一全局帧开始；同目标同帧多次 Hitlag 可叠加，不同目标完全隔离。
- 启用目标时钟后，核心返回严格校验的 `targetClockAudit`、可重放的压缩 `targetClockLog` 和逐次 `targetHitlagLog`。Schema 会逐点重放并核对 `TargetStateTimeline.targetFrame`，拒绝同一命中被重复消费为多次 Hitlag，并按 reciprocal 日志精确累计超导状态的延长帧数。普通 Aura、Frozen、Quicken、Burning Fuel/Tick 与感电共存自然到期使用稳定的目标本地截止帧；1.38 v2 可把感电共存自然到期记录为 `Reactable.Tick` transition，但感电 `+10/+60` 伤害 Tick、`+6` Wane、ReactionA/B、扩散/结晶/碎冰、独立反应伤害和草原核生成/到期/烈绽放/超绽放仍按全局帧运行。已存在且结束帧晚于命中帧的超导减物抗状态会按实际 Hitlag 延长；同帧稍后才创建的状态不会被追溯延长。
- `targetTaskModel` 与目标时钟、Aura 版本分别建模，并提供三种模式：`legacy-event-heap-v1` 是历史迁移和当前兼容预设的默认值；`target-phase-v1` 是冻结的 1.37 第一批 Burning callback→Aura 衰减契约；`target-phase-v2` 是 1.38 的独立显式 opt-in。v1/v2 都要求运行时使用 `legal-frame-v1`，配置了反应引擎时只允许 `aura-v7`。v2 只保证同一目标边界内 QueueEnemyTask / 目标 callback 先于该目标 `Reactable.Tick`，不声称建立全目标 barrier，也不会把随后 core work 搬入目标相位。Hitlag 造成的陈旧唤醒会先按目标本地时钟重投影。冻结的 v1 使用 `targetTaskPhaseLog`；v2 使用相互排斥的 `targetPhaseLog`。
- 每次运行返回 `runManifest`：固定输入 Schema/引擎/数据版本、版本化配置哈希、解析后的运行选项、按顺序排列且带内容哈希的插件身份和 `gdl-v2-fnv1a32-*` 复现键。FNV-1a 只用于确定性漂移检测，不是密码学完整性或签名；声明式效果由核心规范化后计算内容哈希，任意代码插件的 descriptor/contentHash 则仍属于插件作者提供的受信声明，不能把它当作代码真实性证明。
- 输出侧已为 `SimulationRunManifest`、Burning/Quicken/Bloom 审计、`reactionTaskLog`、冻结 v1 的 `targetTaskPhaseLog`、v2 的 `targetPhaseLog`、ReactionA/B 伤害组、草原核生命周期/接触/时间线、玩家命中/自伤/HP 时间线/汇总、目标时钟/Hitlag 及其跨日志引用、`TargetStateTimeline` 等关键投影提供严格 Zod Schema，并用真实模拟结果做运行时解析回归。Quicken→Bloom 任务会与触发命中、Quicken mutation、Bloom 审计、草原核预约和目标状态时间线做双向引用校验；v1/v2 日志分别核对各自版本化目标顺序、目标时钟、Aura 连续性和关联日志，且不能在同一运行中同时激活。整个 `SimulationResult` 仍只有 TypeScript 顶层契约，尚未具备覆盖全部结果字段的单一运行时 Zod Schema。
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
- 水草双向绽放以及燃烧/激元素相交的 v5 路径会生成 `bloomReactions`，并在 30 帧后生成具有稳定 ID、来源/归属、确定性位置和全场最多 5 个上限的草原核。当前草原核生成后的寿命固定为 `300f`，但参考源码对此数值本身带不确定注释，所以仍是 provisional 兼容常量；第 6 个核心会淘汰最旧核心。自然到期后 1 帧结算半径 5、倍率 2 的绽放，火接触后 1 帧结算半径 5、倍率 3 的烈绽放；雷接触后 60 帧先以 15m 选择圆与敌方圆形 hurtbox 求交，再按目标中心距离和注册顺序稳定选择最近目标，并以半径 1、倍率 3 结算超绽放。核心生命周期、接触、ReactionA、父链和 DamageEvent 交叉引用都进入严格结构化日志。
- 在 `aura-v5/v6` 中，`pendingHydroBloomFollowup` 仍只是兼容审计标记，实际同步结果以 `bloomReactions` 和草原核日志为准；`aura-v7` 则要求每个 pending 标记恰好对应一条核心 `reactionTaskLog`。任务执行时用实时 Aura 形成 Bloom/草原核预约或明确记录跳过，不能由 UI 根据这个布尔字段自行补算。
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
- 命中可声明 `strikeType: "blunt"` 与非负 `poiseDamage`；钝击先按 `0.006U × poiseDamage` 削减冻元素，只有剩余冻结时才碎冰，岩元素命中则无需钝击分类。碎冰再消耗最多 `8U`，同帧产生单目标物理独立伤害：等级基准 `×3.0`、不暴击、忽略防御，并按目标拥有 12 帧伤害 GCD。超载范围伤害按固定 gcsim 的钝击/`90` 韧性伤害语义，也能对邻近冻结目标削冻并触发碎冰。触发检查、两阶段冻结消耗、GCD、父伤害和整数伤害全部进入逐击审计、`frozenStateLog` 与 `reactionDamageLog`。
- 风元素附着可按固定 gcsim 顺序扩散雷、火、水、冰和冻元素；水雷共存时，雷扩散会立即递归检查水，再继续常规顺序，因此一个风命中可产生多条扩散审计。扩散先以 `0.5 × 剩余风元素量` 削 Aura，并按固定 durability 公式计算传播元素量；典型 `1U 风 + 0.8U Aura` 消耗 `0.5U Aura` 并传播 `2.2U`。每个通过元素/目标本地 6 帧队列 GCD 的扩散会排入触发后 1 帧的源目标伤害，以及触发后 5 帧、半径 5、排除源目标的范围传播。水扩散的范围段伤害为 0，但仍保留逐目标事件和元素传播。
- 扩散自身段与传播段都是独立 `DamageEvent`，使用等级基准 `×0.6`、不暴击、无视防御和被扩散元素抗性；其独立扩散伤害组在 30 帧窗口只让前两段产生伤害，之后的段仍处理 Aura 和二次反应。它与通用 ReactionA/B 是不同的兼容状态机。传播附着会在目标上再次运行 Aura 引擎，并用 `parentDamageEventId` 保留“风命中 → 扩散传播 → 二次反应伤害”父链。
- 通用 ReactionA 按 `目标 + 角色 + 反应` 隔离碎冰、超导、绽放、烈绽放和超绽放，在半开 30 帧窗口允许前两次伤害；ReactionB 同样隔离超载和感电，但只允许第一次伤害。被阻止的尝试仍进入审计，且不回滚已经合法发生的 Aura、接触或核心生命周期变化。
- 岩元素附着按固定 gcsim 的雷→水→冰→火→冻元素顺序选择第一条可结晶 Aura；所有结晶元素共享目标本地 60 帧队列 GCD。成功时按 `0.5 × 岩元素量` 削减 Aura，23 帧后生成元素碎片，触发后第 54 帧起才可拾取；碎片从生成起存活 900 帧，全场上限 3 个，第四个会淘汰最旧碎片。GCD 阻止时不会消耗 Aura，也不会生成碎片。
- 合法时间线新增显式 `pickUpCrystallize` 命令，支持指定火/水/冰/雷或 `any`，且不占用行动帧。护盾等级与精通在碎片生成帧快照；拾取时按固定等级表和 `40/9 × EM/(1400+EM)` 计算吸收量，覆盖既有结晶盾，并在 906 帧后到期。1.32 的玩家自伤会先消耗当前结晶盾基础 HP，再扣前台角色 HP；同元素伤害使用 `2.5` 倍吸收，来袭岩伤使用 `1.5` 倍，其余为 `1` 倍。吸收与破裂均写入护盾日志和时间线。碎片生成/淘汰/过早拾取/成功拾取/到期、护盾增加/覆盖/到期仍由核心返回，并在网页现有表格与护盾阶梯曲线显示；玩家自伤吸收/破裂尚无专用 UI。
- 正式 `aura-v1`–`aura-v7` 配置禁止手工 `reaction` 标签；`reactionOverride` 只在显式调试开关下可用。
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

- `legacy-default-120s.golden.json` 继续冻结 Vanilla 的原始浮点结果；1.33–1.36 的版本化 Fixture 保留各自历史投影，`legacy-default-120s-1.36.golden.json` 不被改写；`legacy-default-120s-1.37.golden.json` 冻结 1.37 兼容身份与不变的数值基线。1.38 当前身份使用独立的 `legacy-default-120s-1.38.golden.json`，不得覆盖 1.37 文件。
- `burning-aura-v4-1.30.golden.json` 冻结 1.30 Burning 兼容切片；1.34–1.37 身份继续作为历史证据保留，1.38 身份只通过新的兼容 Fixture 更新，不改写历史 Burning 数值、状态日志或摘要。
- `reaction-matrix-1.31.golden.json`、`reaction-matrix-1.32.golden.json` 与 `reaction-matrix-1.33.golden.json` 保留历史 14 个 `legal-frame-v1 + aura-v5` 向量；`reaction-matrix-1.34.golden.json` 保留 1.34 的 15 个历史向量；`reaction-matrix-1.35.golden.json` 冻结当前 17 个向量，其中新增 `elementalResistance` 覆盖逐元素抗性，新增 `hydroFrozenEcGuard` 冻结 `aura-v6` 的“本击先生成 Frozen 后必须阻断感电”边界。该 guard 以 F0 的 `3U` 水命中各 `1U` 火/冰/草/雷，结果只能依序为 `vaporize → freeze → bloom`，不得启动感电或生成 F+10 Tick，草原核在 F+30 生成；独立的 `hydro-order.test.ts` 同时锁定 `aura-v5` 的历史 post-Freeze EC 行为。`aura-v7-order-release.test.ts` 再锁定七种来袭元素的复合有序链，包括固定 `vaporize.go` 中“Frozen 存在时火蒸发必须被拒绝、随后融化消耗 Frozen”的相反方向边界；62,208 向量的公开初态 covering grid 则验证普通 Aura/来源槽的有限性、非负性、守恒和确定性。兼容向量继续保持 `targetClockModel: disabled`，Hitlag 与 `aura-v6` 雷多反应链也继续由独立单元/集成向量冻结。
- 1.32 增加显式 `playerDamageModel`，1.33 增加显式 `targetClockModel`，1.34 增加显式 opt-in `aura-v6`，1.35 增加可选的完整敌方八项抗性表，1.36 增加显式 opt-in `aura-v7` 与核心 `reactionTaskLog`，1.37 再增加显式 `targetTaskModel` 与 `targetTaskPhaseLog`，1.38 增加 `target-phase-v2` 与独立 `targetPhaseLog`。1.35→1.36 只更新版本身份，不自动启用 v7；1.36→1.37 把更早输入固定迁移到 `legacy-event-heap-v1`；1.37→1.38 精确保留 legacy/v1 模式，不自动启用 v2。`legacy-default-120s-1.36.golden.json` 和 `quicken-bloom-task-order-1.36.golden.json` 继续冻结历史身份；`legacy-default-120s-1.37.golden.json`、`quicken-bloom-task-order-1.37.golden.json` 与 `target-task-phase-1.37.golden.json` 冻结完整 1.37 历史。1.38 使用新的 `legacy-default-120s-1.38.golden.json`、`quicken-bloom-task-order-1.38.golden.json` 与 `target-reactable-phase-1.38.golden.json`，不得用它们回写旧 Fixture。1.35 的 17 向量反应矩阵继续作为语义 Golden 复用，历史 v1–v7 Fixture 均不重写。所有 Fixture 都是回归证据，不是官方数值认证或完整 gcsim parity 报告；其中测试抗性、草原核寿命、固定 gcsim 路径和默认杜林预设的示例魔法数都仍是 `provisional`。

## 当前精度边界

本版本不是 gcsim 精度实现。`legacy-v0.1` 继续保持 Golden 兼容；`aura-v1`–`aura-v7`、冻结的 `target-phase-v1`、受限的 `target-phase-v2` 和粒子引擎只覆盖当前可审计机制闭环。v2 只声明目标 callback→该目标 `Reactable.Tick`，不能外推为全目标相位或通用任务所有权。所有相关顺序都只标记为 `fixed-gcsim-provisional`：固定 gcsim 提交自身也保留反应顺序、草原核持续时间和燃烧测试 TODO，因此只能称为“固定代码路径兼容语义”，不能称为官方/官服真值或完整 gcsim 精度。尚未实现或未完整实现：

- `aura-v4/v5/v6/v7` 已实现上述 Burning Marker、Fuel、周期伤害、Tick 火附着、归属/快照刷新和可视化；v7 只修正 refresh 的反应计数投影。`legacy-event-heap-v1` 有意继承冻结的 1.30 相位：Fuel 在本项目兼容语义的第 121 个目标帧清理，且同一目标帧的普通命中先于 Burning Tick。1.37 的 `target-phase-v1` 冻结第一批 Burning target callback→Aura 衰减边界；1.38 的 `target-phase-v2` 只把同目标 callback→`Reactable.Tick` 建模为独立边界。两种模式下实际 Burning 范围伤害仍进入后续全局 core `reactionDamage`，callback 内同步跨目标 Aura/反应命中尚未实现。`target-local-hitlag-v1` 造成的陈旧唤醒会先重投影到正确全局帧；这些切片都没有实现通用敌方任务所有权、完整 gcsim target phase 或官服全部边界。
- v2 的 `Reactable.Tick` 可以记录普通 Aura、Frozen、Quicken、Burning Fuel 与感电共存自然到期，但只证明每个目标内部的 callback→生命周期推进顺序；它不建立所有目标共享的 barrier，也不把感电 damage Tick/Wane、ICD、ReactionA/B、Quicken→Bloom、草原核/结晶实体或其他 core work 改为 target-owned。
- `reaction-self-v1` 已为 Burning Tick 建立玩家空间命中、抗性、结晶盾和 HP 自伤路径；`disabled` 兼容配置继续返回 `selfDamageStatus: "unsupported-player-damage-model"`，不会静默改变旧结果。当前模型只处理反应自伤，并不等于通用玩家受击系统。
- 八项玩家抗性必须由输入配置显式提供。固定 gcsim 提交在这条玩家路径中并没有提供可直接当作官服角色抗性数据库的正式真值；本项目采用通用三段抗性公式，并把这些抗性视为用户输入/项目约定。不得把固定测试向量或默认抗性外推为所有角色、环境和版本的正式数据。
- 玩家位置、碰撞半径、Max HP 和初始 HP 比例当前都是静态输入；切人只决定自伤帧的受击角色，不移动玩家。尚无动态 Max HP Buff、治疗、死亡/倒地、复活、敌人攻击、玩家 Aura 与被敌攻击触发的反应、非结晶盾或护盾强效。`clamp-and-continue` 会把 HP 钳制到 0 后继续记录事件，只是确定性审计策略，不是游戏死亡逻辑。
- 本轮没有给网页增加玩家自伤、HP 或盾破裂专用面板；现有全队/角色/技能/时间轴/逐击和伤害曲线仍只消费敌方伤害结果。玩家侧结构化日志已可供后续 UI 使用，但页面不得自行重算其伤害、护盾或 HP。
- 角色专属 `OnBurning` hook-before-snapshot 尚未进入通用事件阶段；纳西妲 C2 对燃烧等转化反应的特殊暴击也未实现。当前燃烧 Tick 不应被用于验证这些角色特有机制。
- `aura-v5/v6/v7` 已实现上述绽放、草原核、烈绽放和超绽放纵向切片，并可在 `reaction-self-v1` 中结算其玩家自伤；v7 的 Quicken→Bloom 仍是列明的 core zero-delay task，不属于冻结的 v1 或 1.38 v2 target-owned queue。草原核 `300f` 寿命、简化二维位置/范围和最近目标选择仍是 provisional，丰穰之核、卡维强制迸发、角色专属核心修正和完整三维碰撞仍未实现。旧 `aura-v3/v4` 对绽放系继续保持历史 fail-closed。
- `targetStateTimeline`、草原核时间线和玩家 HP 时间线只把当前已经实现的状态变化按核心真实顺序暴露给消费者；启用目标时钟时目标状态点同时携带 `targetFrame`，但它们不会补全玩家 Aura/被敌攻击触发的反应、敌方攻击、治疗、死亡/复活、任意 Aura 来源重叠、角色回调或其他缺失机制。
- 火、水、冰、雷、草、风、岩七种来袭元素的代表性高信息量链已有 `aura-v7` 精确顺序测试；公开可配置的五种普通初始 Aura 又通过既有 mixed-gauge covering 门检查有限性、非负性、来源槽/消费守恒、确定性与输入数组换序。该门仍不覆盖 Frozen、Quicken、Burning/Fuel 等特殊 Aura 的全部可达排列，也不执行后续 Tick、Core、ReactionA/B 或目标任务相位；冻结的 1.37 v1 门继续锁定低 Fuel、Hitlag 重投影、多目标顺序和 `targetTaskPhaseLog`，1.38 v2 门另锁定 callback→`Reactable.Tick` 与 `targetPhaseLog`。v2 门不证明感电 Tick/Wane 已本地化，也不证明 Burning callback 内同步跨目标 Aura/反应命中。未覆盖分支仍应 fail-closed 或作为新引擎版本实现。所有固定顺序只标记为 `fixed-gcsim-provisional`，参考源码自身的顺序 TODO 也禁止把它外推为官服真值。
- 扩散只覆盖固定 gcsim 提交中的目标 Aura 消耗、1f/5f 双攻击、二维半径 5、源目标排除、传播附着、二次反应和 ReactionA 伤害 ICD。尚未实现三维高度、风场吸附/聚怪、扩散对物件/召唤物/玩家目标的命中、扩散攻击的真实视觉/飞行路径、按来源 Aura overlap 数组或任何角色特有扩散修正。当前二维圆心在触发帧冻结，目标位置在传播帧读取，与固定提交 `NewCircleHitOnTarget` 创建静态圆形的行为一致。
- 结晶碎片位置使用独立固定种子，在生成帧目标圆形碰撞体半径外 `0.5m` 取确定性角度；固定 gcsim 同样把碎片简化为随机圆周点，但本项目没有复刻其全局 RNG 调用序列。显式拾取命令与参考实现的 `pick_up_crystallize` 一样不检查角色到碎片的距离；1.32 只让已实现的四类玩家反应自伤消耗结晶盾并记录吸收/破裂，尚无角色移动拾取、自动吸附、一般敌方攻击、非结晶盾、护盾强效 Buff、磐岩套/角色被动回调、碎片被攻击、月结晶或真实视觉实体。因此当前护盾/HP 结果不是完整生存模拟。
- 超载/超导尚未模拟击退、完整敌人韧性条、爆炸高度/三维碰撞、物件/召唤物/玩家自身受击或真实敌方移动；半径 3 求交依赖场景显式提供的二维目标坐标与圆形碰撞半径。当前韧性数值只用于固定 gcsim 的“钝击先削冻”局部规则，不是通用韧性系统。启用目标时钟时，已经存在的超导减物抗状态会受 Hitlag 延长；防御 Halt Bonus 尚未成为公共配置，其他敌方状态的 Hitlag 属性也未一般化。冻结状态不会自动停止声明式目标移动，也未实现冻结气泡破裂或冻结抗性的敌人数据库。碎冰伤害在本引擎的结构化事件数组中稳定排在同帧触发伤害之后；固定 gcsim 的递归攻击会先应用碎冰伤害，这一无状态副作用的日志顺序差异已明确保留，后续若加入伤害回调需升级事件语义。等级基准和反应常数来自固定 gcsim 提交的交叉校验，不代表整个 Aura/反应系统已达到 gcsim 精度。
- 感电当前严格跟随固定 gcsim 提交的单目标 Tick 语义；每个敌人独立维护共存 Aura 和周期流，不会凭距离自动向附近潮湿目标连锁。`aura-v6` 中冻元素会阻止新感电，包括同一水命中刚生成 Frozen 的边界；`aura-v5` 仍保留旧 post-Freeze EC 结果用于兼容回放。扩散已覆盖水雷共存的雷→水递归多扩散，但按来源 Aura overlap 的全部组合和真实游戏是否存在额外目标传导仍未实现或未验证。
- `aura-v3/v4/v5/v6/v7` 普通 Aura 与激元素已有逐来源槽、共享衰减和逐槽消耗；`aura-v1/v2` 仍保留旧聚合状态。结果 Schema 现在在 `sourceSlots` 存在时强制来源唯一、聚合 Gauge 等于最大槽，并对每条 `sourceMutation` 强制 `before - consumed = after`；无来源槽的历史投影继续兼容。v4–v7 已有单目标 Burning Marker/Fuel 来源与归属；目标本地 Hitlag 时钟已有 opt-in v1，但一般化特殊 Aura overlap、更多 Hitlag 属性和角色回调顺序仍未完成。
- 全角色的特有 ICD Group 数据库；引擎已经支持声明式 Profile，但当前只有 DurinSkill 的 18 帧 / `[允许, 阻止, 阻止]` 审计映射。
- 经过来源核验的逐技能产球数量/概率/飞行帧，以及敌人掉球、击杀掉球、白球来源、拾取路径和多目标粒子。
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

项目借鉴 gcsim 的“角色/技能伤害构成、逐帧 Sample、每个事件可展开计算、显式能量问题与版本化配置”思路。杜林黑/白 E 的动作帧、黑 E ICD、白 E 无附着口径、回能和产球行为，以及超载/超导/感电/冻结/碎冰/扩散/结晶/激化/燃烧、草原核、玩家反应自伤/结晶盾吸收、敌方 Hitlag 与列明的目标 callback→该目标 `Reactable.Tick` 路径使用固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 交叉校验；1–100 级反应基准数值表直接保留自该提交并附带 MIT 许可。该目标顺序交叉参考不覆盖感电 damage Tick/Wane、其他 core work 或 Burning callback 内同步跨目标 Aura/反应命中。Hitlag 的 `haltFrames/factor` 仍由场景显式输入，尚无角色/武器/攻击类型数据库自动推导。玩家八元素抗性和 1.35 的敌方八元素基础抗性也仍是用户显式输入和本项目的公式约定，不是从该提交取得的官服正式角色/敌人数据库真值。固定提交本身仍含草原核持续时间注释和燃烧测试 TODO，因此这里表示 `fixed-gcsim-provisional` 的“固定代码路径可复现交叉校验”，不是官方数值或官服实测证明。TypeScript 实现和 Schema 为独立编写，没有复制其 Go 角色实现。完整倍率目录来自单独固定的 `genshin-db` MIT 数据包；Enka 只用于公开展示柜和数字 ID 互操作。详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
