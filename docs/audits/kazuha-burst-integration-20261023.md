# /goal 万叶 C0/C1 Q 直接伤害模块交接

本分支只新增角色独立文件；共享模型、分类注册、公式入口、导入、UI 接线和最终浏览器验证由根线程统一完成。

## 已实现

- `kazuha-burst-slash`：82f 初斩，仅一击，独立有效 Q 天赋。
- `kazuha-burst-anemo-dot`：单次风 DoT，81f 进攻快照。
- `kazuha-burst-complete`：初斩 + 140/257/374/491/608f 五次风 DoT；明确元素转化时，按首次成功吸收检查生成实际附加段，附加段先于同帧风伤。不含扩散等反应实体。
- 吸收检查严格为 81+18×n 帧，n=0..16；81f/135f 染色五次、153f/243f 四次、261f/369f 三次。整数帧以来源相对施放时点为准。
- A4 只给染色元素：明确 81f 前同元素实际扩散的 A4 仍生效，使用该次扩散的 NonExtraEM×0.0004，扣除明确已含份额。当前精通、本 Q 初斩后的新扩散均不倒灌 81f。
- C0/C1；C1 只重置 E CD，不追加 Q 直接命中；C2+ 明确阻断。
- 手动/导入保存四种染色元素各自的最终加成。null/缺项不替换为 0 或风伤。装备路线由共享装备公式按真实染色元素筛选加成。
- 完整直接伤害须确认全部命中、领域未被替换、81f/82f 面板及各击目标状态稳定；单击不要求无关条件。
- 换分支完整选中集合会重建。独立选中的旧染色段被移除时保留阻断记录，重复 prepare 不会静默换成初斩。转换后的历史快照按角色、Q 身份、有效天赋、命座、突破、真实分支/时点及 A4 状态核验。

## 最小共享接线（本分支未应用）

1. `packages/sim-core/src/calculator-model.ts`：从 `./kazuha-burst-context` 导入 `kazuhaBurstContextSchema`；在 `gameContext` strictObject 增加 `kazuhaBurst: kazuhaBurstContextSchema.optional()`。不必扩展 hit schema；来源事件表保存在 context。
2. `packages/game-data/src/classified-hits.ts`：导入 `kazuhaBurstMappings,kazuhaBurstSourceEvidence`；将 mappings 注册到 `sourceClassifiedMappings`，证据注册到 `independentImplementationSources`，mapping version 增加 `+kazuha-q.1`。这份来源来自同一 gcsim 实现链，证据自身明确不是独立机制交叉验证。
3. `apps/web/src/character-calculations.ts`：导入 `initializeKazuhaBurstDocument`、`isKazuhaBurstAction`、`KAZUHA_BURST_SOURCE_REFS`。getCharacterDocuments 的专属初始化分支 `if (isKazuhaBurstAction(document)) return initializeKazuhaBurstDocument(document);`，在公共 workspace stamp 前执行。命座分支 `allowed = context.constellation <= 1`，原因说明 C0/C1 直接伤害、C2+ 未支持，sourceRefs 加角色来源。不把旧普通/E 入口标为已支持。
4. `packages/sim-core/src/source-cast-context.ts`：导入并调用 `prepareKazuhaBurstDocument(document)`、`resetKazuhaBurstPanelAccounting(document,mode)`、`finalizeKazuhaBurstPanelAccounting(document)`；签名与 Xiao 相同。
5. `apps/web/src/calculator-import.ts`：所有 reset 后、return 前，调用

   ```ts
   captureKazuhaImportedDamageBonuses(doc, character.stats.damageBonuses);
   ```

   签名为 `(document: CalculatorDocument, bonuses: Partial<Record<'pyro'|'hydro'|'electro'|'cryo', number|null|undefined>>): void`。传原始真实四元素值，不预先用 0 填缺项；helper 保留可用有限数值和未知缺项。`reset...('imported-final')` 会清除旧已含 A4 记账，须用户明确新面板已含份额。
6. `apps/web/src/calculator-source-cast-controls.ts`：导入 `renderKazuhaControls,applyKazuhaControl`；render 拼接前者；`applySourceCastControl(document,input)` 开头：

   ```ts
   if (applyKazuhaControl(document, input)) return;
   ```

   控件同时带 `data-kazuha-control` 和既有 `data-source-cast-state/enum/value-field`；数字带 `data-field`、`data-source-cast-number-field`、`data-optional-number`。既有 input/change 分支直接处理；元素/吸收帧 change 会经过既有 renderControls。无需新增事件分支。改变元素会清除不同元素的旧 A4 声明/时点，保留四元素加成；已固化快照不会被 handler 清除或重新签名。
7. `apps/web/src/calculator-requirements.ts`：导入并注册 `kazuhaBurstRequirementAdapter`。
8. `packages/sim-core/src/calculator.ts` 需根线程扩展普通装备的转换快照条件：现有 `equipmentPanelForConversion` 仅在 `panel.rebuiltEquipment` 或 `neferPhantasmEvent` 时建 `finalSnapshot`。真实万叶 Q 命中即使没有 EM 属性补差，也必须捕获逐击 equipment snapshot，才能完整保护其历史 81f/82f 和元素分支。可在内部传入真实万叶 Q 标志后放开该门；保留现有 pending effect、明确突破及装备身份检查。角色模块不重算或伪造共享装备面板。

## 独立验证与数值预期

命令：`node node_modules/vitest/vitest.mjs run packages/sim-core/src/kazuha-burst-formulas.test.ts`。44 项包括原始源码 SHA256/Git blob、全部 15 级来源向量与 catalog 对比、先染色后风伤帧序、晚染色裁剪、各元素真实增伤、前序 A4、C2+、导入 null、缺项、选中身份、控件和来源 EM 装备转换。定向 TypeScript 包含本角色生产文件和测试。

独立条件：90 级角色对 90 级敌人、10% 抗性、无减防/无视，ATK=2000、Q10、风伤=0.466、暴击率=0.5、暴伤=1；无反应。

- 初斩非暴击 = `2000*4.7232*1.466*0.5*0.9` = **6231.79008**。
- 单风 DoT 非暴击 = `2000*2.16*1.466*0.5*0.9` = **2849.904**。
- 无转化完整 Q = `2000*(4.7232+5*2.16)*1.466*0.5*0.9` = **20481.31008**。
- 火伤=0.2，前序同元素扩散 NonExtraEM=800、A4 仍生效，未含份额=0：每次染色附加非暴击 = `2000*0.648*(1+0.2+0.32)*0.5*0.9` = **886.464**；81f 转化五次完整 Q = **24913.63008**，369f 转化三次完整 Q = **23140.70208**。期望均再乘 **1.5**。
- 将火伤输入改为 0.52，同时明确已含 A4=0.32，应得到完全相同结果。仅改当前 EM（例如 9999→50000），不得改变上述前序 A4 值。

证据目录：`/tmp/GIDPS-role-kazuha-evidence-20261023`（source-verification.json、unit.log、typecheck.log、定向 tsconfig）。独立测试在 prepare 后仅移除尚未共享注册的 `gameContext.kazuhaBurst`，再交给真实共享公式引擎；未临时修改共享文件。最终接入后应补充 schema roundtrip、getCharacterDocuments/public showcase、无 EM 补差普通装备转换以及浏览器验证。

未 push、未部署、未登录米游社、未读取 cookie/token；未安装依赖或重建 WASM。
