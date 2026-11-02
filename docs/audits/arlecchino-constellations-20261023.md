# /goal 阿蕾奇诺 C0–C5 红死之宴实际普攻单击

基线 `cb9e869`，分支 `cloud/arlecchino-constellations-20261023`。本单元只修改本角色公式、控件、映射、manifest、原始来源审计脚本、独立测试和文档；公共命座门、聚合注册、导入、UI 与最终浏览器接线由根线程独占。

## 复现与根因

基线正式执行 `getCharacterDocuments('character:10000096',10)` → 选择 N1 → C1 → 明确命中前150%契及固有火伤记账 → `applyCharacterConstellationScope` → `calculateDocument`，返回 blocked、无三列总数。公共 `constellation-scope` 与角色 prepare 均仅允许 C0。证据 `/tmp/GIDPS-arlecchino-constellations-evidence-20261023/c1-before.json`。

角色内部限制及公式已扩展至 **C0–C5**。根线程还须把 `character-calculations.ts` 中阿蕾奇诺公共命座分支从 C0 改为 `context.constellation <= ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION`，同步来源原因及分类版本。此单元没有改该公共文件。

## 来源口径与实际范围

固定原始 Classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` / Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`：

- `attack.go bondBonus`：C1 及以上的 `c1Bonus=1.0`；附加基伤为 **`(masque[有效普攻等级] + C1的1.0) × 命中扣契前契比例 × 本击总攻击`**。给的是附伤倍率增加 100 个百分点，不是附伤整体乘二，也不改变普通 ATK 倍率项。
- `arlecchino.go` 初始化 `NormalCon=3`、`BurstCon=5`。`pkg/core/player/character/character.go TalentLvlAttack` 在原生 C3 时增加3级；独立计算器接收的有效普攻等级已经包含这项加级，直接查表一次，不再增加3级。
- C2 改血偿回收条件并在相应回收事件触发独立900% ATK攻击，不归属本次已选 NA；本模块不额外生成此攻击，也不因此拒绝已明确的 NA。
- C4 回收后的回能/Q冷却变化，C5 的 Q 天赋等级，都不改变这个实际 NA 单击；不把这些效果计入普通伤害。
- **C6 继续拒绝**：E 后普攻的条件10%暴击率/70%暴伤状态尚未实现，不以 C5 公式代替。

七个 `arlecchino-red-death-normal-*` skillId 和命中 ID 均保持原值；第四段24f/35f两击仍各自选择、各自填写扣契前真实比例。继续只算本次实际火普攻，不模拟回收、耗契、回血、普攻循环、Q 或完整角色输出。

## API 与保存兼容

新增导出：

```ts
export const ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION = 5;
createArlecchinoBondBaseFormula(effectiveNormalTalent, bondOfLifePercent, included, constellation = 0);
```

前三参数及既有 prepare/reset/finalize、控件和 requirement adapter API 均保留。prepare 显式传入实际 `gameContext.constellation`；第四参数缺省只用于旧 C0 factory 调用兼容，不是导入命座回退。

**没有新 context 字段或玩家条件控件。** `bondOfLifePercent`、`passivePyroBonusIncluded`、`includedBondBase`、`finalizedHitStates` 保持原结构，所有字段可选规则不变。旧 C0 JSON、原已拥有公式 ruleId 及历史身份结构保持可读；来源公式在正式 prepare 内重建。新增的 C1 数值绑定在公式 trace 中，不是让玩家另填技术参数。

固有40%火伤仍分别处理：fresh-equipment 自动补加已知未含份额，imported-final 未证明已含或未含时要求明确确认；同命座已含火伤与生命之契附伤的份额均只扣一次。原30%门槛、源槽冲突、`groupMultiplier != 1`、来源身份及包含角色等级的历史快照校验均保留。转换后即使从C1改到同数值的C2，或从C3改到同数值的C4，也不能改写原命座历史命中。

## 独立数值与验证

条件：ATK=2000、命中扣契前契150%、火伤输入0且固有40%未含、90级对90级、10%抗性、无减防/无视、CR=0.5、CD=1、无反应。

| 命座 / 独立有效NA | 普通ATK系数 | 附伤系数 | 附加基伤 | 非暴击 | 暴击 | 期望 |
| --- | --- | --- | --- | --- | --- | --- |
| C0 / NA10 | 0.938961 | 2.38 | 7140 | 5681.29086 | 11362.58172 | 8521.93629 |
| C1/C2 / NA10 | 0.938961 | 2.38+1 | 10140 | 7571.29086 | 15142.58172 | 11356.93629 |
| C3/C4/C5 / 已有效NA13 | 1.1378 | 2.884+1 | 11652 | 8774.388 | 17548.776 | 13161.582 |

原有 C0 数值、阈值、去重、slot冲突、合法外部调整、命中复制及转换身份断言保留。原 C1–C5“整体拒绝”参数化用例因支持范围扩展而迁至仍未支持的 C6，新增严格正例而非删掉验证。新增覆盖 C1 七命中、C1–C5 三列手算、有效NA13只查一次、同命座40%与附伤去重、30%边界、C2/C4/C5单击归属、C5外来公式冲突、正式 JSON 旧公式兼容，以及支持命座内的真实装备转换和历史变更。

**86/86 正式 `calculateDocument` / `convertCalculatorToFinalPanel` 测试通过，无临时 adapter；定向 TypeScript（含测试）通过。** manifest 记录新增 C3 原始 wrapper 文件，两版本共16份原始文件 SHA256/Git blob、七普通子击及 masque 完整15级向量均通过审计。Classic/Stellar 对这些文件逐字一致；仍标注同一实现链，不冒充独立机制验证。未复制 Go 或改变根许可证。

证据目录 `/tmp/GIDPS-arlecchino-constellations-evidence-20261023`：`c1-before.json`、`source-audit.log`、`unit.log`、`typecheck.log` 和定向 `tsconfig.json`。命令：

```sh
python3 scripts/audit-arlecchino-primary-sources.py
node node_modules/vitest/vitest.mjs run packages/sim-core/src/arlecchino-damage-formulas.test.ts
node node_modules/typescript/bin/tsc --noEmit --project /tmp/GIDPS-arlecchino-constellations-evidence-20261023/tsconfig.json
```

待根线程使用上述最大命座常量打开公共命座门，并验证真实导入有效NA等级、三列结果及重开。没有其他阻塞；未 push、部署或重试发布，未使用新权限、凭据或付费资源。
