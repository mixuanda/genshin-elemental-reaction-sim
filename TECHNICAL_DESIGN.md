# 技术设计：提瓦特伤害实验室

## 1. 当前目标

Vanilla v0.1 结果继续由兼容模式和 Golden Fixture 冻结。正式路径已经加入 60 FPS 合法帧时间线，以及火/冰/水 Aura、默认 ICD 和自动融化/蒸发的最小闭环；仍不声称拥有完整游戏机制精度。

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
  预设、版本化数据和展示柜数据适配器。当前杜林预设为 provisional。

packages/mechanics
  声明式伤害修正插件入口，避免在核心循环写角色名分支。

packages/test-vectors
  从冻结 v0.1 采集的 Golden Fixture。
```

依赖方向：

```text
schemas <- sim-core <- mechanics
schemas <- game-data
sim-core + schemas + game-data <- apps/web
```

## 3. 配置契约

每个输入必须包含：

```ts
schemaVersion
engineVersion
dataVersion
randomSeed
```

`migrateConfig()` 负责把无版本、`0.1.0` 或 `1.0.0` 配置迁移到 `1.1.0`。迁移后由严格 Zod Schema 校验；未知字段、重复 ID、未知角色引用和越界数值在模拟前失败，并返回字段路径。`engineVersion` 当前为 `1.1.0-aura`。

## 4. 确定性与排序

相同时间的事件排序为：

1. `action`
2. `buff` / `debuff`
3. `energy`
4. `hit`
5. 同类型同时间按插入序号

状态在 `end <= hitTime` 时先过期，因此恰好处于结束边界的命中不享受该状态。该规则由测试固定。

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
    animationEndFrame,
    cooldownFrames,
    maxCharges,
    chargeRecoveryFrames,
    hits: [{ frame, ...damageDefinition }]
  }],
  commands: [
    { type: "skill", actorId, abilityId },
    { type: "swap", characterId },
    { type: "wait", frames }
  ]
}
```

命令游标默认推进至行动的可取消帧。显式 `atFrame` 早于游标时视为行动重叠；`strict` 抛出带命令路径的错误，`wait` 移动至可执行帧并记录调整。冷却和充能次数使用每个充能槽的下一可用帧计算。

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

- `characterSummaries`：伤害、命中、DPS、占比。
- `bySkill`：伤害、命中、DPS、占比。
- `perSecond`：逐秒、逐角色伤害桶。
- `damageCurve`：每一段伤害对应一个累计曲线点，含逐角色累计值。
- `auraTimeline`：每一段 Aura 模式伤害对应的附着前后、ICD、消耗和反应记录。

UI 只绘制这些结构化结果，不重新执行伤害公式。

### 6.1 Aura / ICD 最小状态机

`packages/sim-core/src/aura.ts` 是无 DOM 依赖的纯状态机。命中通过以下字段声明附着：

```ts
application: {
  gaugeUnits: 1,
  icdTag: "ability-stream",
  icdGroup: "default" | "no-icd"
}
```

普通 Aura 的初始耐久为标称元素量的 `0.8` 倍；1U 的衰减长度为 `420 + 6 × 1 = 426` 帧。默认 ICD 窗口为 150 帧，序列为允许、阻止、阻止并循环；状态键包含施放者、`icdTag` 和 `icdGroup`。`no-icd` 每次允许附着。

当前增幅反应消耗规则与 gcsim 的最小语义对齐：

- 火打冰：正向融化，2 倍伤害基础，按 2 倍来袭元素量消耗冰 Aura。
- 冰打火：反向融化，1.5 倍基础，按 0.5 倍消耗火 Aura。
- 水打火：正向蒸发，2 倍基础，按 2 倍消耗火 Aura。
- 火打水：反向蒸发，1.5 倍基础，按 0.5 倍消耗水 Aura。

如果反应发生，剩余来袭元素不继续挂为普通 Aura。正式 `aura-v1` Schema 禁止非 `none` 的手工 `reaction`；只有 `debugAllowReactionOverride: true` 时可使用 `reactionOverride`。

当前状态机只实现单目标的火/冰/水普通 Aura。冰/水的同元素 overlap 尚未保存 gcsim 式按来源数组，暂以单状态的较强剩余 Aura 表示；复合共存、冻结、转化反应和角色特有 ICD Group 尚未实现。

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
- 同时间命中稳定排序。
- 120 秒末端截断语义。
- 相同版本/配置/种子的可复现性。
- 默认 120 秒 Golden Fixture。
- 整数帧行动、切人、命中追踪、取消帧与动画结束帧。
- 严格模式冷却拒绝和等待模式冷却调整。
- 多充能次数、行动重叠与错误前台角色。
- 1U Aura 的 0.8 初始耐久和 426 帧衰减。
- 默认 ICD 第 1/2/3/4 次附着、150 帧重置、独立角色/Tag/Group 和 No ICD。
- 正/反融化与正/反蒸发的反应方向和 Aura 消耗。
- 无 Aura 不触发融化，以及正式 Aura 配置拒绝手工反应标签。
- Aura 结果接入伤害乘区和 `auraTimeline`。

Playwright 覆盖预设切换、JSON 导入、运行、总览数字、时间轴、逐击累计曲线、敌方 Aura 曲线、ICD 阻止、自动融化、逐段筛选、公式展开、导出和字段路径错误。

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

展示柜数据与 `SimConfig` 故意分离：目前缺少版本化角色/武器数据库和机制映射，不能仅凭玩家面板生成可信轮转。所谓“毕业站位”同样只创建 `graduation-target-placeholder`，在目标标准核验前禁止模拟。

纯静态部署没有 Vite 中间件，必须把代理迁移为受控服务端函数，并继续遵守上游 TTL 和限流要求。

## 9. Milestone 3 当前边界

Milestone 2 的结构能力已经落地，但内置行动帧仍是 provisional 示例，不代表游戏实测。当前时间线先编译再执行；若爆发因能量不足失败，后续命令尚不会动态回滚或重新排程，失败仍通过 `skippedActions` 明确记录。

Milestone 3 的最小闭环已经落地：火/冰/水普通 Aura、可扩展元素量、衰减、默认 ICD、No ICD、融化/蒸发、逐击审计和敌方附着曲线均有测试。冻结的杜林兼容预设仍保留手工反应以维持 Golden；尚未有基于核验角色数据重建的正式杜林合法帧/Aura 预设，因此不能把兼容预设的手工标签删除后声称机制等价。

下一阶段应先扩展 Milestone 3 的机制矩阵和测试向量（复合附着、冻结、转化反应、角色特有 ICD Group），或者进入 Milestone 4 建立粒子对象和动态能量队列。无论选择哪一条，都必须保留现有 Golden 与 Aura 向量。
