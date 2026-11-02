# /goal 胡桃E状态主输出交接

本模块支持C0–C6的E状态选定普攻/重击；只修改胡桃专属文件，公共引擎、模型、分类、UI接线、导入与旧血梅香/基础重击由根线程统一维护。

高命座修复基线`cb9e869`的真实C3火重击被共享白名单和角色模块的C0/C1限制同时拒绝，见`/tmp/GIDPS-hutao-constellations-evidence-20261023/repro.log`。原8个skillId保留兼容，`-c0-c1`现在是存量标识；实际已审阅范围由API与条件决定。

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
HUTAO_PRIMARY_MAX_CONSTELLATION // 6
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
| c6Active | 仅C6需要：本击取样时100个百分点暴击率增益是否实际生效；不从HP或命座推断 |
| c6CritRateIncludedInPanel | 仅C6需要：输入暴击率是否已经包含C6增加的100个百分点 |
| finalizedHitStates | 内部历史身份，转换后不得由用户编辑或覆盖 |

E公式为 `min(施放E时MaxHP × ppatk[E有效等级], 4 × 基础ATK)`，作为Extra固定ATK追加，不再乘ATK%。只有明确最大生命一直相同时才使用本击HP属性。ATK已含E的路线只使用实际最终ATK，未要求反推不可知的施放HP和白字；独立E等级仍保留作为动作来源。

A4为突破4且生命≤50%时+33%火伤，再减输入已含份额。恰好50%包括在内。E消耗当前生命的30%不等于必然半血；本模块不扣血、不推断E前后的生命比例，也不把后续血量改写E施放时的转换。

C2只给血梅香加10%最大生命基伤；C4的队友暴击回调明确排除胡桃；C5只改Q有效等级，均不加入所选自身NA/CA。C3的+3已经包含在独立有效E等级，例如导入基础E10＋源额外3得到有效E13，本模块直接读取ppatk[12]=.07153，不再加3。C2–C5不会要求C6字段。

C6公式精确ruleId为`hutao-damage-c6-crit-rate-b4ae769`，计算`Number(c6Active)-Number(c6CritRateIncludedInPanel)`，单位为比例1（100个百分点），再由公共核心把实际暴击概率限制在0–1。C6已含且仍生效时不重复加入，已含但失效时移除1；低血量、拥有C6或当前已恢复高血量都不替代真实增益状态。不会生成免死、触发事件、600帧持续、3600帧冷却或源120帧轮询。

## 根线程最小接线

1. 基线已正式注册专属context schema、mapping、source-cast prepare/reset/finalize及控件adapter，无需临时schema适配。
2. 共享`applyCharacterConstellationScope`中用`HUTAO_PRIMARY_MAX_CONSTELLATION`放行0–6，继续用`isHutaoPrimaryDocument`识别原8个skillId。C6必要字段由角色模块逐击检查，不能仅凭共享白名单放行未知状态。
3. 独立有效E等级仍绑定`gameContext.hutaoDamage.skillTalentLevel`；新的两个C6字段是实际状态/已含份额，不能从独立天赋等级、低血量或命座自动绑定为生效。
4. C6仍用来源前缀`hutao-damage-`锁定公式输入；保存/重开保留新增两字段，禁止覆盖`finalizedHitStates`。只有C6在历史身份数组末尾附加新字段，旧C0–C5的身份前像保持不变。
5. fresh-equipment把C6已含标记设false，保留用户已确认的实际增益状态；新示例不提供C6实际状态。imported-final把两字段清为未知，保留独立有效E等级，不猜C6触发。
6. 原mapping的`completeAction:false`不变，根可更新来源分类版本/覆盖文案，不能把高命座的其他输出混称完整角色或完整E循环。

攻击调整、增伤及C6暴击率公式槽中如已有外来来源，模块原样保留其公式与sourceRefs，新增阻断，不覆盖证据。C0–C5不占用C6暴击率槽，可继续使用其他来源的暴击率公式。普通额外附加基伤等未占用槽仍由公共引擎独立处理。

## 来源与验证

Classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`、Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 各10个原始文件直接从固定GitHub原件下载并保留SHA256/Gitblob，共20身份（本轮补普通角色有效天赋加级源码）。保留8个NA向量与E转换完整15级向量，每提交135位置；全部与active catalog逐位一致。源码原件仅在 `/tmp/GIDPS-role-hutao-evidence-20261023/<revision>/` 读取审计，没有将Go副本放入提交。

两提交仅attack.go的取消时间表/末段接重击限制不同；所选伤害倍率、E快照与400%上限、A4及本文declared hitmark取样相同。N5两击15/26帧，重击固定源0帧快照3帧命中有明确TODO；本模块不调度取消、PP slide、能量/CD或血梅香后续。社区源码证据保持provisional，不宣称官方游戏认证。

独立例：NA10 CA=2.42565，E10=.06256；ATK2000未含E、施放E时MaxHP30000、白字1000得增攻1876.8；本击HP49%/50%、A4稳定且未含，90对90、抗10%、CR50%/CD100%、无反应：非暴5628.15031212，期望8442.22546818。施放E时MaxHP100000触顶4000，在HP50.001%无A4时非暴6549.255；恰好50%且A4解锁稳定时为8710.50915。

相同条件改为有效E13=.07153，E增攻2145.9：C3非暴6018.8166474975，期望9028.22497124625；C6实际生效且CR输入未含该100个百分点，公共核心限幅后期望12037.633294995。

定向测试直接使用正式`calculateDocument`、`convertCalculatorToFinalPanel`、序列化/解析入口，原33个数值/边界/历史状态测试保留；原C2拒绝断言按扩展范围迁为C6实际状态未知仍拒绝。新测试覆盖C2–C5直伤、真实Enka形状有效E13证据、C6补差/上下限、外来公式、未知状态、旧身份兼容及转换重开，不使用临时schema适配。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/hutao-damage-formulas.test.ts
python3 scripts/audit-hutao-primary-sources.py /tmp/GIDPS-role-hutao-evidence-20261023
```
