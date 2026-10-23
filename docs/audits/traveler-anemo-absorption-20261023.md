# /goal 风旅行者吸收 Q 交接

基线 `c8a3024`；独立分支 `cloud/traveler-anemo-absorption-20261023`。只修改 traveler-cross 专属模块、控件、requirements 和对应测试；没有修改公共 model、registry、UI、命座门、冻结来源或 Golden。

共享接线：在 `character-calculations.ts` 的逐命中命座门复用直接从 `traveler-cross-entity-formulas.ts` 导出的 `travelerAnemoConstellationScope(document, hit?)`。返回 `{allowed,reason,sourceRefs}|undefined`；undefined 表示不属于两个确切 Anemo skill ID。helper 核对角色ID/性别、风 variant、Q ability、C0–C6以及具体风模板或真实元素吸收事件，核心自己也使用同一 helper。不放行草或其他形态。现有 prepare/reset/finalize 和 baseSchema.extend 自动承接新字段，无新公共 handler；所有控件使用既有 `data-source-cast-*` 路由。C6公式 ruleId 为 `traveler-cross-entity:anemo-c6-target-resistance-a7dc4bf`。

新字段：`anemo.singleHitRole`（tick/absorbed-tick）、`absorptionElement`（四种可吸收元素）、`absorptionStartFrame`、逐元素 `elementDamageBonuses`、完整C6的 `c6InitiallyInactive`；共同/逐击 state 的 `c6ActiveBeforeHit`、`includedC6ResistanceReduction`。事件 role 支持 absorbed-tick，包含 absorbedElement 及来源推导的 c6ActiveBeforeHit。完整吸收快照 ID 为 `snapshot-0-absorbed-${element}`；旧风 `snapshot-0` 不变。单击不要求未知吸收历史或未来日程。普通手动面板未知元素加成会阻塞，导入使用已保存各元素 number/null，装备由真实元素过滤推导；绝不拿风伤或默认0代替未知。

`/tmp/GIDPS-traveler-anemo-absorption-evidence-20261023/before-functional.log` 保留两条旧机制实际 blocked 失败（当时仅新增可选字段 schema，公式/日程尚未改）；最早 `before.log` 是字段尚未放入 hitState 时的 schema 失败，不把它当机制数值证据。`focused.log` 是本轮最终四文件55/55通过，包含独立数值、旧C0、93/94/345边界、同帧C6、落空、刷新、已含/部分已含、manual/import/null/equipment、转换JSON和等级/元素/接触改变拒绝、外来公式冲突及固定来源哈希。原requirements12项保留；过时的“C6整体不支持／完整模式无链接”断言改为“缺实际状态仍阻塞／完整条件只链接不自动填写”，原全部数值及负向边界保留。

命令（cwd 为上述 worktree）：

```sh
node node_modules/vitest/vitest.mjs run packages/sim-core/src/traveler-cross-entity-anemo-absorption.test.ts packages/sim-core/src/traveler-cross-entity-anemo-source.test.ts apps/web/src/calculator-traveler-cross-requirements.test.ts apps/web/src/calculator-traveler-cross-absorption.test.ts --reporter=verbose
```

来源和独立手算见 `packages/game-data/sources/traveler-anemo-absorption/README.zh-CN.md` 与完整manifest。剩余范围：已有旧C6减抗的完整生命周期、元素抗性不同的混合完整合计、自动附着/ICD/扩散/能量/轮转均未实现；由玩家按实际单击输入。根线程负责公共门、动态展示文案及真实浏览器验收。本分支未跑原生120秒、全回归、WASM重建或浏览器，也没有push/生产操作。
