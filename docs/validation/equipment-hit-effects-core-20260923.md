# 装备逐击基数附加与暴击属性：核心合同验证

2026-09-23；本文件转录实际工具结果，没有为日志补跑测试。

核心新增 `equipment.additiveBaseBonuses[]` 与 `criticalBonuses[]`。两者使用同一类型化表达式、输入、来源、伤害元素 / 攻击标签 / 武器过滤以及明确的 `inputPolicy`；暴击条款只允许 `critRate` 或 `critDamage`。`final-panel` 读取当前命中的实际属性（包含逐击来源精通），独立历史快照通过显式变量保存，不能从当前面板重采样。

普通基数附加进入 `additiveBaseDamage` 合计，不当作攻击力、普通增伤或反应专属增伤；随后按该普通命中的定义进入防御、抗性、暴击和增幅。角色附加公式与激化追加值仍分别计算一次。暴击条款只作用于符合条件的命中，先合计再使用共享公式限制暴击率；不可暴击和非普通伤害明确显示不适用。

最终面板保存每段 `effectiveCritRate` / `effectiveCritDamage` 与固化基数。`finalizedEquipmentEffects[]` 保存 `kind`、`amount`、来源表达式、当时真实输入和引用，回放时只展示历史代入而不再次加算。JSON 校验要求记录贡献与其表达式、输入相符。`finalizedEquipmentBaseInput` 保存原手动份额；公开 `restoreCalculatorHitEquipmentInputs` 只撤销装备份额，保留用户原手填基数、之后的手工编辑及角色附加公式。跨技能应从原始装备对新命中重新结算。

公开接口：

- `resolveCalculatorHitEquipmentContext(build, hit, documentContext?)`
- `convertCalculatorToFinalPanel(document, mode?)`
- `restoreCalculatorHitEquipmentInputs(hit)`

实际命令：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-equipment-hit-effects.test.ts
```

20:19:52：**1 passed，225 ms**（测试执行 49 ms），首次通过。没有执行旧测试、全量检查、build 或 E2E。

同一有界合同用例核对 DEF / HP / 本段 EM 的基数附加，标签与武器不适用分支，附加项的增幅与暴击位置，暴击率 `0.9 + 0.2 = 1.1` 后限制为 `1`，技能暴伤与爆发暴击率独立，final / JSON 等值，历史来源轨迹不重复应用，撤销装备份额保留原手填 `37` 及后来追加 `11`，篡改记录金额的 JSON 被拒绝，以及不可暴击 / 非普通事件不套用这些条款。

测试数字是明确标识的合成协议夹具。真实武器的参数、触发条件与来源匹配由装备来源模块单独验证；本核心不推测窗口生成、层数获取、次数消耗或一整个技能内的状态变化。

## 缺失条款按所选命中阻塞

新增 `equipment.pendingHitEffects`：仅记录尚缺输入的具体条款及其来源、标签 / 元素 / 武器过滤，未知值不写成 0。可选 `kind` 区分附加基数、暴击率与暴击伤害，从而排除不可暴击命中或已经提供对应最终暴击属性的情况。

`getCalculatorHitPendingEquipmentEffects(build, hit)` 只查询匹配缺口，不抛错，供界面正常展示阻塞文档。数值计算和最终面板冻结则阻止当前选中且依赖该条款的命中。明确错误标签和非普通伤害不受影响；缺少分类而无法排除依赖时仍保留缺口。

如果最终面板转换时，未知条款只关联未选段，则在该段保存 `pendingEquipmentEffects`，只冻结已知份额，且不生成未知属性的 `effectiveCritRate` / `effectiveCritDamage`。当前已完整的段仍可转换；以后改选未知段仍阻塞。重新配装时由 `restoreCalculatorHitEquipmentInputs` 清理旧条款记录，再从新装备输入恢复状态。

唯一新增实际作用域用例：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-pending-equipment-effects.test.ts
```

20:28:03：**1 passed，1.15 s**（测试执行 49 ms），首次通过。使用实际凯亚与狼牙来源配装、明确 E 层数 2、未知 Q 层数：E 可计算及 final / JSON 等值；未知 Q 不产生伪零暴击条款；最终面板保留未选 Q 缺口且不生成其未知最终暴击率，改选 Q 后仍阻塞；选中 Q 直接冻结失败。另检查错误攻击标签、不可暴击与剧变不受该暴击率缺口阻塞，明确最终暴击率能作为完整入口，以及负的最终暴击伤害按面板相同约束被拒绝。之后仅修正测试变量的 TypeScript 类型标注，没有改变断言或重复运行。

## 安柏 A1 所需的角色来源暴击率入口

普通命中另接入 `critRateFormula`，复用现有来源 AST 与依赖门，仅用于确有需求的角色暴击率条款。`characterCritRate` 节点在面板与装备暴击率后加入，最终由共享概率公式限制范围。未解锁突破时不适用；缺少相关突破时阻塞；明确不匹配的元素、标签或不可暴击段不受该条款影响。

明确 `effectiveCritRate` 时角色式不执行、不重复加入，也不要求未执行的历史突破分解，仍保留来源命座范围约束。`convertCalculatorToFinalPanel` 即使没有装备新增条款，也会保存已含该角色式的逐击最终暴击率，保留原公式与不适用来源说明。验证由角色来源代理新增的唯一安柏专项覆盖；本核心批次没有重复运行上述已通过测试。
