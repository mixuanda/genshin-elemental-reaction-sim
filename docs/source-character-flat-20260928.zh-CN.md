# 来源角色排队伤害 FlatDmg 共享公式（2026-09-28）

## 本轮范围

本轮新增 `character-flat` 公式族，把部分原生排队攻击中的 `FlatDmg` 设值、加值与乘算结果接入共享 AST。对应 classic／stellar 两 lane 的 [041 A](../packages/source-host/patches/041-character-flat-a.patch)、[042 B](../packages/source-host/patches/042-character-flat-b.patch)、[043 C](../packages/source-host/patches/043-character-flat-c.patch)、[044 D](../packages/source-host/patches/044-character-flat-d.patch)、[045 E](../packages/source-host/patches/045-character-flat-e.patch)。最终 registry 有 142 条规则、覆盖 40 个角色：A 组 21 条（6 个角色、24 个写入点），B 组 26 条（6 个角色），C 组 25 条（5 个角色、29 个写入点），D 组 20 条（8 个角色），E 组 50 条（15 个角色）。按原操作计，120 条 `set`、16 条 `add`、6 条 `multiply`；classic 适用 140 条，stellar 适用 142 条。可查[registry 与 patch literal 对照清单](source-character-flat-registry-20260928.json)。

公式族描述见 [AST 与输入校验](../packages/sim-core/src/source-host-character-flat-formula.ts)及 [A](../packages/sim-core/src/source-host-character-flat-group-a.ts)、[B](../packages/sim-core/src/source-host-character-flat-group-b.ts)、[C](../packages/sim-core/src/source-host-character-flat-group-c.ts)、[D](../packages/sim-core/src/source-host-character-flat-group-d.ts)、[E](../packages/sim-core/src/source-host-character-flat-group-e.ts)组模块。每条规则保留原操作类型：`set` 返回该字段完整新值，`add` 以原先的 `FlatDmg` 与公式项求和，`multiply` 按原顺序缩放先前值。对于 `add`／`multiply`，捕获会连同 `priorFlatDamage`、`priorComponents` 与 `componentIds` 记录原操作前的数值和来源组件，并递归解析这些前置公式。

Go 在原写入点按实际 getter 顺序、攻击快照和保存字段计算共享结果；公式描述不会另行触发 getter 或重建排队动作。`CharacterFlatAttach` 在写回后用当前完整结果替换 active component lineage，避免旧组件被再次累加。对同一 `AttackInfo` 的循环覆写仍在原循环位置处理。来源 actor 与数值持有者也分开记录，例如 Nicole 的投射攻击可由队友执行，而公式读取 Nicole 的来源数值；这两种身份不会混为一人。

上批 23 条 `character-additive` 规则中，Clorinde A1 与 Xilonen C6 已处理其 `AddAttackMod.Amount` 的同击加值及 nil 返回；它们不是本批 142 条 `character-flat` registry 的新增规则。本批只计入当前 A–E registry 中排队／快照 `FlatDmg` 操作，不重复计算上批 nil-only 加项。保存值例子包括 Kokomi 的生命附伤、Varesa 每 6 帧刷新的攻击力缓存，以及 Hydro Traveler 首次／后续真实累积值及其消费；编辑器据对应 `valueSources` 与组件回执解析这些依赖。

## 编辑与验证边界

UI 将 `character-flat` 捕获作为可编辑的单公式实验，允许改公式输入及非 `set` 操作前的 `priorFlatDamage`，并把实验随计算文档 JSON 保存。编辑产生新的公式 trace，不改变原始 capture，也不重跑队伍模拟、不传播到后续命中或资源窗口；其范围仍为公式级反事实数值。

本轮没有迁移 Dehya 自伤链或 Nilou 核心玩家受击链，也没有把所有排队攻击、覆写和乘算 producer 全部接入。源码保留的 TODO 与事件时序假设仍按 provisional 第三方模拟器语义处理；共享 AST 和静态接线不等于游戏验证，game-verified 分母不变。

## 构建与页面验收

Classic 首次 Go 构建通过，用时 35.239 秒。Stellar 首次构建因 Citlali C4 patch 声明的 `flat`／`flatID` 未使用而失败，用时 31.215 秒；retry1 通过，用时 16.364 秒。见 [classic 首次构建收据](../docs/validation/source-character-flat-classic-first-20260928.json)、[stellar 首次失败收据](../docs/validation/source-character-flat-stellar-first-20260928.json)和 [stellar retry1](../docs/validation/source-character-flat-stellar-retry1-20260928.json)。

Web 首轮因 `maxHP`／`maxHp` 拼写及缺少 `SourceHostCharacterModifierDynamicStatLeaf` 类型导入失败；retry1 又因 `exactOptionalPropertyTypes` 不接受 helper 显式传入 `undefined` 而失败，之后 retry2 与 retry3 均通过。各次结果见 [Web 首轮](../docs/validation/source-character-flat-web-first-20260928.json)、[retry1](../docs/validation/source-character-flat-web-retry1-20260928.json)、[retry2](../docs/validation/source-character-flat-web-retry2-20260928.json)和 [retry3](../docs/validation/source-character-flat-web-retry3-20260928.json)。

旧的 [classic-first E2E](../docs/validation/source-character-flat-e2e-classic-first-20260928.json)使用旧 dist／WASM，不代表本轮产品代码失败或通过。新代码首轮 E2E 曾因 #432 `character-flat` 组件回放与原生时序／应用量不一致而失败；共享 TypeScript 校验按实际 request frame 修正。retry2 失败是测试夹具选中同帧 consumer，producer 与该 request 都为 frame 102，故严格早于断言不成立；不是新增的产品运行时错误。改为选择后续跨帧 consumer 后，retry3 聚合页面通过：墙钟 51.446 秒、用例 47.1 秒、runner 49.9 秒，`pageErrors` 为空。classic／stellar 各两场，共每 lane 25 个伤害应用、2,690 次公式计算；观察到 13 个规则 ID（不外推到全部 142 条），每 lane 5 个选定重放差值为 0。Chiori 设值加乘算结果从 1,778.3118434808002 编辑为 1,961.83398174186，原始 capture 不变，JSON 恢复一致。数据见[聚合结果](../docs/validation/source-character-flat-20260928.result.json)与 [retry3 收据](../docs/validation/source-character-flat-e2e-retry3-20260928.json)。本次页面使用的 classic WASM SHA-256 为 `89966e037bcb528f05de2b138cab5de86f61331e2e238336dbb53977c9b3a886`（43,003,852 bytes），stellar 为 `af424731f25b44a792d9bce9d790e606b8a6af7343a22a7a6ae888aef7c00bf2`（64,595,003 bytes）。静态 registry 对照和构建通过均不替代页面运行时证据。
