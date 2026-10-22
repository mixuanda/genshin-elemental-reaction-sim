# 角色实际输出概览接线

基线 `4770eab`。新增 `apps/web/src/calculator-character-outputs.ts`，未修改 `calculator-ui.ts`、核心公式或动作定义。

主界面可直接使用当前真实输入与计算结果：

```ts
overview.innerHTML = renderCharacterOutputs(buildCharacterOutputs(candidateDocuments, workspace.catalog, {
  selectedCandidateIndex: index, currentDocument: current, currentResult: result,
}));
// 从点击元素的最近 button[data-character-output-index] 读取原候选索引，
// 交给现有 loadCandidate(index)，由原入口准备状态并实际计算。
```

模块按当前工作区目录的 `ability.kind` 区分 E、Q、普通攻击族；普通攻击族再根据已有命中的 `attackTag` 区分普攻各段、重击、下落。既不按中文名称或 `combat*` 后缀分类，也不创建候选。每项的 `candidateIndex` 始终保留原列表索引，分组排序不改变索引。已有 `variantName` 与明确状态原样展示，不把所有特殊形态概括成 E 强化。

无结果时显示“待计算／—”；缺少动作定义、条件阻塞、已知部分与完整所述施放分别显示。数值直接来自 `CalculatorResult` 的现有总值和聚合组成，不重新求和、不新增公式、不把单次命中当完整轮转。不暴击数值若被核心标为实际不可能的对照分支，会保留该说明。冗长的待补条件收在折叠项内。

基线真实候选清点：

| 角色 | 当前已有动作定义 | 边界 |
| --- | --- | --- |
| 凯亚 | N1–N5、E、固定正面十三击 Q、Q 完整观察 | Q 的所述接触／观察条件不同，不能复用另一候选的结果 |
| 诺艾尔 | N1–N4、旋转／终结／完整持有重击、独立与完整观察下落、E、Q 起手两段 | 普攻等使用已有 `noelleBurst` 明确 Q 状态；历史 DEF 转换与当前面板不由概览推断 |
| 流浪者 | 仅 `idle-wanderer-skill-c0`，当前单选 E 初击 | 不能由此创建空居普攻、重击、Q 数值；目录中的普攻／Q 以一行缺少定义提示显示 |
| 久岐忍 | 基础重击、E 初击＋8 环／10 环、Q 7 击／12 击 | E 命座与 Q 施放生命分支沿用原候选，概览不从名称推断实际条件或反应次数 |

清点来自 `getCharacterDocuments`、当前目录及已固定来源的 `noelle-action-mappings.ts`、`kuki-skill-burst-mappings.ts`、`idle-stance-mappings.ts`、`character-calculations.ts`。这些是当前实现覆盖差异，不表示各角色在游戏中没有其他动作。

可选摘要缓存：`captureCharacterOutputResult(document, result)` 保存动作身份及完整输入的稳定序列化版本；通过 `observations` 传回。只有当前动作的精确文档版本相同时才显示该摘要。`effectiveDocuments` 可提供已有入口准备好的每动作当前文档；未提供时只匹配原候选，绝不从当前其他动作借用状态或快照。装备、敌人、等级、天赋、所选命中、形态、历史快照或来源／规则任一变化都会使旧摘要失效。当前直接传入的 `currentResult` 必须由调用方保证是对应 `currentDocument` 的结果。

验证：真实来源候选的 7 项聚焦测试通过，覆盖上述角色差异、真实结果复用、输入版本失效、状态隔离、目录 kind 分类和 HTML 转义。
