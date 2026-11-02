# /goal 赛诺C0启途誓使单击交接

本提交只新增赛诺模块，公共模型、分类、UI、导入及现有末途真眼E均未改动。

## 入口与公开API

`cynoDamageMappings`：7个单击，均为`talent:cyno:combat3`，有效Q等级直接使用一次。skillId如下：

- `cyno-q-normal-1-c0` → `cyno-q-normal-1-hit` / param1
- `cyno-q-normal-2-c0` → `cyno-q-normal-2-hit` / param2
- `cyno-q-normal-3-c0` → `cyno-q-normal-3-hit` / param3
- `cyno-q-normal-4-1-c0` → `cyno-q-normal-4-1-hit` / param4
- `cyno-q-normal-4-2-c0` → `cyno-q-normal-4-2-hit` / param5
- `cyno-q-normal-5-c0` → `cyno-q-normal-5-hit` / param6
- `cyno-q-charged-c0` → `cyno-q-charged-hit` / param7

`cyno-damage-context.ts`公开`cynoDamageContextSchema`、`CynoDamageContext`。`gameContext.cynoDamage`字段：

| 字段 | 含义 |
| --- | --- |
| `burstActive?: boolean` | 本动作开始时实际Q状态，必须明确true |
| `burstEmIncludedInPanel?: boolean` | 原输入精通是否已含Q的100精通 |
| `emStableFromActionStart?: boolean` | 本段普攻开始至本击取样的实际精通是否相同；不默认true |
| `actionStartEm?: number` | 精通变化时填写本段普攻开始时的实际总精通，含当时Q加成；0有效 |
| `includedA4Base?: number` | 用户输入附加基伤已含的赛诺A4数值，普通装备为0 |
| `finalizedHitStates?: Record<string,string>` | 转换时记录的内部身份；不能当作用户可编辑字段 |

`cyno-damage-formulas.ts`公开：

```ts
isCynoDamageDocument(document: CalculatorDocument): boolean
prepareCynoDamageDocument(document: CalculatorDocument): CalculatorDocument
resetCynoPanelAccounting(document: CalculatorDocument, mode: 'fresh-equipment' | 'imported-final'): void
finalizeCynoDamageContextSnapshot(document: CalculatorDocument): void
// finalizeCynoPanelAccounting 为同一函数别名
cynoContext(document: CalculatorDocument): CynoDamageContext | undefined
```

`apps/web/src/calculator-cyno-controls.ts`公开`renderCynoControls`、`cynoRequirementAdapter`及可选处理器`updateCynoDamageControl(document, fieldPath, raw): boolean`。控件沿用现有`data-source-cast-state-field`、`data-field`、`data-source-cast-number-field`约定，数值为空清除而非转0。布尔输入支持`unknown`/`0`/`1`。处理器保留快照身份，编辑后由prepare阻断旧快照。

`apps/web/src/cyno-calculation-context.ts`公开`applyCynoDamageContext(document, supplied): CalculatorDocument`及仅教学示例使用的`createCynoExampleContext()`。示例只声明Q生效、原面板未含Q精通和A4，精通稳定性仍需明确选择。

## 根线程最小接线

1. 在`calculator-model.ts`导入schema，并向`gameContext`严格schema增加`cynoDamage: cynoDamageContextSchema.optional()`；可从公共入口导出类型。
2. `classified-hits.ts`注册`cynoDamageMappings`和`cynoDamageSourceEvidence`；更新对应版本/覆盖声明。7个mapping为`completeAction:false`，不要改成完整Q/完整普攻段。
3. `getCharacterDocuments`生成这些mapping后，用`applyCynoDamageContext(doc, createCynoExampleContext())`初始化教学示例。`applyCharacterConstellationScope`最后应调用prepare；C0之外保持缺失，模块亦独立阻断C1+。
4. `source-cast-context.ts`的prepare、reset、finalize分别调用上列3函数。finalize只在普通转换捕获面板时执行；编辑已有历史状态时不能重写身份。普通转换保留精通调整与A4公式树，finalSnapshot复现时通用引擎移除精通调整，A4继续读取已含Q精通的历史值，因此不需要把context已含标记改为true。
5. UI串入render、requirement adapter；锁定`cyno-damage-`来源公式输入；沿现有state/number handler写入路径。重新应用装备/切换动作需按现有角色模块保存用户实际状态；转换之外不得调用finalize覆盖身份。
6. 真实UID精通由普通装备配装求得时用`fresh-equipment`清零已含份额，但Q状态与精通稳定性仍需回答。若直接导入最终精通，调用`imported-final`清除已含份额与战斗状态，不能推断100精通是否已含。`prepare/reset`仅在单击附加基伤为0、无外部附加公式且无历史快照时证明`includedA4Base=0`并隐藏该技术字段；非零附加或历史仍需明确。
7. `resetCynoPanelAccounting`两种模式都会清除动作开始EM，避免换装备后沿用旧数值。稳定性为false时需重填。不要把原E的`finiteFollowupCast`与`cynoDamage`混用或改写。

## 来源与数值证据

固定上游`b4ae769...`与`a7dc4bf...`各9个原始文件直接从GitHub下载，`manifest.json`保存每文件SHA256/Git blob及7×15倍率。角色8文件外补`pkg/core/attack.go`明确snapshotDelay=0立即快照。原件在`/tmp/GIDPS-role-cyno-evidence-20261023/<revision>/`。

两提交倍率、A4、Q精通、命中与快照语义相同；`attack.go`末段衔接重击限制不同，`cons.go`C4反应事件订阅不同。本模块不提供衔接调度或C4。此证据为固定社区实现审阅，保持provisional，不声称官方游戏认证。

Q普攻A4在动作开始读EM，各击面板在命中帧读；第四段两击为5/14帧。Q重击在0帧快照、27帧命中，没有A4普攻项。末途真眼35%只对应E主击，渡荒之雷2.5EM项归现有E模块。

独立Q10示例：ATK2000、输入EM300未含Q100、A4解锁且明确精通稳定；敌我90级、敌抗10%、无反应/增伤，CR50%/CD100%。

| 单击 | Q10系数 | 非暴击 | 期望 |
| --- | ---: | ---: | ---: |
| N1 | 1.547459 | 1662.7131 | 2494.06965 |
| N2 | 1.630198 | 1737.1782 | 2605.7673 |
| N3 | 2.068339 | 2131.5051 | 3197.25765 |
| N4第一击 | 1.021861 | 1189.6749 | 1784.51235 |
| N4第二击 | 1.021861 | 1189.6749 | 1784.51235 |
| N5 | 2.586465 | 2597.8185 | 3896.72775 |
| 重击 | 1.9975 | 1797.75 | 2696.625 |

普攻公式为`(ATK × Q倍率 + 1.5 × 动作开始EM) × 增伤 × 防御 × 抗性`；已含份额先扣除。精通变化时A4仍用动作开始值，激化由普通引擎读取本击快照EM。

运行独立检查：

```sh
./node_modules/.bin/vitest run packages/sim-core/src/cyno-damage-formulas.test.ts
python3 scripts/cyno-damage-audit.py /tmp/GIDPS-role-cyno-evidence-20261023
```

本分支单元仅验证独立公式树、来源向量、prepare/reset/finalize与UI缺项，未假接公共schema或执行WASM。实际UID→装备→转换/保存重开与浏览器验收由根线程接线后负责。
