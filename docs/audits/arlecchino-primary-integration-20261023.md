# /goal 阿蕾奇诺 C0 红死之宴普攻单击交接

> 本文保留首批 C0 的实现与数值审计历史。后续 C0–C5 范围、正式入口验证及兼容性说明见 [命座扩展交接](arlecchino-constellations-20261023.md)；当前来源审计脚本也已覆盖 C3 的原始天赋加级实现。

基线 `9ce6a04`，工作树 `/tmp/GIDPS-role-kazuha-20261023`，分支 `cloud/role-arlecchino-20261023`。仅新增本角色独立文件，没有改公共模型、计算器、source-cast、分类注册或 UI 接线。

## 最小复现与实际范围

基线实际调用 `getCharacterDocuments('character:10000096',10)`，仅两个文档、五个普通命中：Q 一击，以及 E 血火/横扫/两次未回收血偿勒令四击；没有普通攻击标签或红死之宴入口。证据为 `/tmp/GIDPS-role-arlecchino-evidence-20261023/before-documents.json`。

新增七个明确单击：

| skillId 后缀 | 普攻段/子击 | 该段开始后的来源命中/取样帧 | NA10 普通 ATK 系数 |
| --- | --- | --- | --- |
| `1` | 第一段 | 11f | 0.938961 |
| `2` | 第二段 | 16f | 1.029996 |
| `3` | 第三段 | 17f | 1.29251 |
| `4-hit-1` | 第四段第一击 | 24f | 0.734264 |
| `4-hit-2` | 第四段第二击 | 35f | 0.734264 |
| `5` | 第五段 | 21f | 1.383358 |
| `6` | 第六段 | 44f | 1.687709 |

完整 skillId 前缀为 `arlecchino-red-death-normal-`；对应 mapping ID 在 skillId 后加 `-hit`。每个文档只有该命中，`scope='single-hit'`，`completeAction=false`。只开放 C0；C1+ 明确阻断。保留原普通普攻边界，不把低契或未知契的输入改成物理，也不以零伤害替代。

原始 `attack.go` 的红死状态门为当前生命之契不低于最大生命的 30%。普通攻击在各自命中帧取当前状态、总攻击及生命之契；处于红死状态时伤害改为火、忽略其他附魔，并在普通 ATK 项之外增加：

```text
FlatDmg = masque[独立有效普攻等级] × (本击扣契前生命之契 / 本击最大生命) × 本击实际总攻击
```

NA10 的 masque 为 2.38。来源伤害回调之后才按当前契的 7.5% 消耗，有 2f ICD；本模块不运行该回调、不推算下一击契比例。第四段两击分别填写各自实际取样值，不能把 24f 的比例自动沿用到 35f。这里也不模拟 E 回收、耗契、攻击轮转、Q 治疗或附着/反应触发。

## 固有 40% 火伤与记账

`arlecchino.go Init()` 无突破门调用 `passive()`，`asc.go` 永久提供 0.4 火伤；A1 回收和 A4 抗性不改变本模块所选 C0 单击的直接伤害表达式。

- `fresh-equipment` 自动设置 `passivePyroBonusIncluded=false`、`includedBondBase=0`，由共享装备公式推导 ATK 与实际火伤，再由角色来源公式补加固有 40%；这两项已知记账无需玩家回答。
- `imported-final` 清除旧实际契比例、已含固有火伤标志和旧固化身份。公开展柜没有实际生命之契；玩家须填写本击命中扣契前的真实百分比。
- 导入火伤已含固有 40% 时，明确选“已经包含”，公式差额为 0；未含则补 0.4；未知会阻断，不凭火伤数值猜测。
- 最终 ATK 面板不包含这项 FlatDmg。只有明确空且未固化的附加基伤输入可推得已含契附伤为 0；非零/固化输入要求明确 `includedBondBase`，表达式只补 `实际契附伤 − 已含份额`。
- 仍保留合法外部 `attackAdjustment`、`elementalMasteryAdjustment` 等不同公式槽；契附伤读取共享属性阶段之后的实际 ATK。外来基础覆盖、同槽附加/增伤公式、同角色伪前缀以及 `groupMultiplier != 1` 均保留输入证据并阻断。

## 根线程最小接线

1. `calculator-model.ts` 导入 `arlecchinoDamageContextSchema`，在 `gameContext` strictObject 增加可选 `arlecchinoDamage`。
2. `classified-hits.ts` 注册 `arlecchinoPrimaryMappings`、`arlecchinoPrimarySourceEvidence` 并更新 mapping version。每项除普通攻击完整 15 级向量外，另有 `formulaParameters` 对 `combat1.param12` 的完整 masque 向量校验；不能只检查普通倍率而跳过契附伤倍率。
3. `character-calculations.ts` 新文档初始化调用 `initializeArlecchinoDamageDocument(document)`。只给教学空面板零记账，不给任何默认契比例；默认入口会显示缺少实际契状态。普通等级绑定使用 `talent:arlecchino:combat1`，不借用 E/Q，也不再次加命座等级。
4. `source-cast-context.ts` 统一调用 `prepareArlecchinoDamageDocument(document)`、`resetArlecchinoPanelAccounting(document,mode)`、`finalizeArlecchinoPanelAccounting(document)`。导入路径沿既有 source-cast reset 即可；不需要额外导入 helper。
5. `calculator-source-cast-controls.ts` 拼接 `renderArlecchinoControls(document)`。全部控件已有标准 `data-source-cast-state-field`、`data-field`、`data-source-cast-number-field` 和 `data-optional-number`，既有通用嵌套 handler 可直接处理。另导出可选文本适配 `updateArlecchinoDamageControl(document,fieldPath,raw): boolean`，无需与通用 handler 同时执行。
6. `calculator-requirements.ts` 注册 `arlecchinoRequirementAdapter`。关键字段为 `bondOfLifePercent`（0–200；小于30时红死入口拒绝）、`passivePyroBonusIncluded`（布尔，未知拒绝）、`includedBondBase`（非负，空输入可证0）、`finalizedHitStates`。
7. `finalizedHitStates` 已包括角色身份/等级、能力、技能、独立普攻等级、命座、突破、命中 ID、真实契百分比和两项记账。真实转换后改等级、契比例、技能/天赋或记账会阻断；导入 reset 不会重新签名旧快照。

## 测试与独立数值

`packages/sim-core/src/arlecchino-damage-formulas.test.ts` 的 **63 项全部通过**；定向 TypeScript（含测试）通过。已覆盖七个普通 ATK 项和独立契 FlatDmg、1/10/15 级、全 15 级 catalog 向量、30%/200% 边界、未知和低契阻断、N4 分别取样、永久火伤与导入已含份额、实际装备 EM→ATK 属性阶段、合法外部调整、同槽冲突、命中复制和转换后历史身份。

独立数值条件：ATK=2000，NA10，**本击扣契前 150%**，火伤输入=0 且固有 40% 未含，角色/敌人均 90 级，10% 抗性，无减防/无视，CR=0.5、CD=1，无反应。契 FlatDmg=7140；N1 非暴击为 **5681.29086**、暴击 **11362.58172**、期望 **8521.93629**。普通 ATK 项保持 `2000×0.938961`，没有把契附伤塞进通用倍率。若把火伤输入改为 0.4 并确认已含固有火伤，结果应完全相同；若附加基伤已填7140且已含契份额也填7140，结果仍相同。

本分支测试中名为 `forUnwiredSharedCore` 的适配器，仅在真实 prepare 后移除尚未注册的额外 context，再执行未改动共享引擎；转换夹具也暂时转移 context 并显式 finalize。**根接线后必须移除这两处临时未接线适配，让原数值和所有负例直接通过正式 calculate/convert 路径；不删除、跳过或降低断言。** 本分支没有临时修改任何共享文件。

命令与证据：

```sh
python3 scripts/audit-arlecchino-primary-sources.py
node node_modules/vitest/vitest.mjs run packages/sim-core/src/arlecchino-damage-formulas.test.ts
node node_modules/typescript/bin/tsc --noEmit --project /tmp/GIDPS-role-arlecchino-evidence-20261023/tsconfig.json
```

证据目录 `/tmp/GIDPS-role-arlecchino-evidence-20261023`：`before-documents.json`、`source-audit.log`、`unit.log`、`typecheck.log`、定向 `tsconfig.json`。

来源 manifest 记录 Classic `b4ae769...` / Stellar `a7dc4bf...` 共 14 份原始文件的 SHA256/Git blob、7 个普攻子击及 masque 共 8 组完整 15 级向量、来源许可身份。原始文件来自 `source-build-cache/upstream/<revision>/source`，两版本逐字一致；指定 native build 目录已有 SourceHost 插桩，manifest 另行记录其与原文是否一致，未把 native 哈希当作上游证据。同一 gcsim 实现链的一致性不是独立机制验证。没有复制 Go 源码、没有改根许可证。

待根线程接线、正式 JSON/导入/转换复核与可见浏览器闭环；无外部审批阻塞。未 push、部署、登录、读取凭据、安装依赖或重建 WASM。
