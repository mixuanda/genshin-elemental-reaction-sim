# /goal 胡桃E状态主输出交接

仅新增角色模块，公共引擎、schema、模型、分类、角色动作、UI、导入与旧血梅香/基础重击均未改。

真实基线 `9ce6a04` 调用 `getCharacterDocuments('character:10000046',10)` 只返回 `hutao-charged-base` 与 `observed-hutao-skill-c0`。复现证据在 `/tmp/GIDPS-role-hutao-evidence-20261023/repro.log`；不是E+Q已覆盖。

## 入口与API

`hutaoPrimaryMappings` / `hutaoPrimarySourceEvidence` 从 `packages/game-data/src/character-mappings/hutao-primary-mappings.ts` 导出。8个入口均为 `talent:hutao:combat1`，effectiveTalentLevel是独立普攻有效等级：

| skillId | hitId | 普攻天赋字段 |
| --- | --- | --- |
| hutao-paramita-normal-1-c0-c1 | hutao-paramita-normal-1-hit | param1 |
| hutao-paramita-normal-2-c0-c1 | hutao-paramita-normal-2-hit | param2 |
| hutao-paramita-normal-3-c0-c1 | hutao-paramita-normal-3-hit | param3 |
| hutao-paramita-normal-4-c0-c1 | hutao-paramita-normal-4-hit | param4 |
| hutao-paramita-normal-5-1-c0-c1 | hutao-paramita-normal-5-1-hit | param5 |
| hutao-paramita-normal-5-2-c0-c1 | hutao-paramita-normal-5-2-hit | param6 |
| hutao-paramita-normal-6-c0-c1 | hutao-paramita-normal-6-hit | param7 |
| hutao-paramita-charged-c0-c1 | hutao-paramita-charged-hit | param8 |

公开核心API：

```ts
hutaoDamageContextSchema
type HutaoDamageContext
isHutaoPrimaryDocument(document: CalculatorDocument): boolean
prepareHutaoDamageDocument(document: CalculatorDocument): CalculatorDocument
resetHutaoPanelAccounting(document: CalculatorDocument, mode: 'fresh-equipment' | 'imported-final'): void
finalizeHutaoDamageContextSnapshot(document: CalculatorDocument): void
// finalizeHutaoPanelAccounting 为同一函数别名
hutaoContext(document: CalculatorDocument): HutaoDamageContext | undefined
```

`apps/web/src/hutao-calculation-context.ts` 导出 `applyHutaoDamageContext(document, supplied)` 和 `createHutaoExampleContext(skillTalentLevel?: number)`。初始化helper不猜E等级、生命、最大生命是否稳定；E等级必须由可信来源的独立有效E等级绑定或用户填写。

`apps/web/src/calculator-hutao-controls.ts` 导出 `renderHutaoControls`、`hutaoRequirementAdapter`、可选 `updateHutaoDamageControl(document, fieldPath, raw): boolean`。控件使用既有 source-cast-state/optional-number 约定，空值清除，与真实0分开。

`gameContext.hutaoDamage`字段：

| 字段 | 含义 |
| --- | --- |
| paramitaActive | 本击取样时实际E状态，必须true |
| skillTalentLevel | 独立有效E等级1–15，不从NA或命座推断 |
| skillAttackIncludedInPanel | ATK输入是否已经包含本次E的增攻；已含时不反推/再次追加 |
| maxHpUnchangedSinceSkillCast | 未含E增攻时，确认施放E至取样最大生命保持不变，明确true才使用当前HP属性 |
| skillCastMaxHp | 最大生命变化时，用户提供施放E当时的真实最大生命；固定历史值 |
| baseAttack | 角色＋武器白字，供400%上限；equipment-derived自动取白字，最终面板不能反推 |
| hpPercentAtSnapshot | 本击取样时生命百分比；CA在动作开始，NA在命中帧；不是施放E前的血量 |
| a4ThresholdStable | 已在半血同一侧稳定且火伤面板已更新；A4解锁后必须true，避开固定源0.3秒近似 |
| a4IncludedInDamageBonus | 输入增伤是否已含A4的33%，按实际份额补差 |
| finalizedHitStates | 内部历史身份，转换后不得由用户编辑或覆盖 |

E公式为 `min(施放E时MaxHP × ppatk[E有效等级], 4 × 基础ATK)`，作为Extra固定ATK追加，不再乘ATK%。只有明确最大生命一直相同时才使用本击HP属性。ATK已含E的路线只使用实际最终ATK，未要求反推不可知的施放HP和白字；独立E等级仍保留作为动作来源。

A4为突破4且生命≤50%时+33%火伤，再减输入已含份额。恰好50%包括在内。E消耗当前生命的30%不等于必然半血；本模块不扣血、不推断E前后的生命比例，也不把后续血量改写E施放时的转换。

## 根线程最小接线

1. 公共模型导入schema，给gameContext注册 `hutaoDamage: hutaoDamageContextSchema.optional()`；如需从公共index导出类型可统一处理。
2. classified-hits 注册 `hutaoPrimaryMappings` 与 `hutaoPrimarySourceEvidence`，保留 `completeAction:false`，同步版本/来源覆盖，不能标作完整E或整套普攻。
3. getCharacterDocuments 构造新动作时调用 `applyHutaoDamageContext(doc,createHutaoExampleContext())`。根线程把独立已导入/用户有效E等级接到 `skillTalentLevel`，不使用NA等级。
4. source-cast-context 的prepare/reset/finalize分别调用对应核心函数。finalize仅在来源配装转换已核对完成时调用；已有身份发生变化会拒绝重新盖写。转换前后的角色等级、突破、NA/E等级、命座、HP条件、白字与面板值均进入身份。
5. UI渲染与缺项adapter串入，来源公式前缀为 `hutao-damage-`，锁定其来源输入。跨动作草稿、绑定E等级、重开持久化由根线程统一接线。
6. fresh-equipment清空旧施放HP/白字/历史身份，把E攻击及A4已含标记设false；E实际状态/HP条件仍需实际值。imported-final保留独立有效E等级，其余记账与战斗条件清为未知，不自动猜开E/半血。

攻击调整及增伤公式槽中如已有外来来源，模块原样保留其公式与sourceRefs，新增阻断，不覆盖证据。普通额外附加基伤等未占用槽仍由公共引擎独立处理。

## 来源与验证

Classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`、Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 各9个原始文件直接从固定GitHub原件下载并保留SHA256/Gitblob，共18身份。保留8个NA向量与E转换完整15级向量，每提交135位置；全部与active catalog逐位一致。源码原件仅在 `/tmp/GIDPS-role-hutao-evidence-20261023/<revision>/` 读取审计，没有将Go副本放入提交。

两提交仅attack.go的取消时间表/末段接重击限制不同；所选伤害倍率、E快照与400%上限、A4及本文declared hitmark取样相同。N5两击15/26帧，重击固定源0帧快照3帧命中有明确TODO；本模块不调度取消、PP slide、能量/CD或血梅香后续。社区源码证据保持provisional，不宣称官方游戏认证。

独立例：NA10 CA=2.42565，E10=.06256；ATK2000未含E、施放E时MaxHP30000、白字1000得增攻1876.8；本击HP49%/50%、A4稳定且未含，90对90、抗10%、CR50%/CD100%、无反应：非暴5628.15031212，期望8442.22546818。施放E时MaxHP100000触顶4000，在HP50.001%无A4时非暴6549.255；恰好50%且A4解锁稳定时为8710.50915。

定向测试使用明确的**临时兼容适配**：先prepare产生完整公式/阻断，再仅移除尚未注册的hutaoDamage上下文后进入现有严格引擎；转换后重新附上下文并finalize。未修改公共schema/parser/引擎，也未降低结果断言。根线程正式注册后可把测试run替换为 `calculateDocument(doc)`、convert替换为 `convertCalculatorToFinalPanel(doc)`，移除适配；其余断言保留。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/hutao-damage-formulas.test.ts
python3 scripts/audit-hutao-primary-sources.py /tmp/GIDPS-role-hutao-evidence-20261023
```
