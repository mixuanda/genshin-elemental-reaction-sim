# 给独立玩家导入任务的整合边界

2026-10-22补充：下文是当时的交接状态。随后核实Enka规定 `propMap.val` 为权威值、`ival` 应忽略；本轮统一修复旧UID与独立导入路线，不再依赖 `ival` 或桥接复制。缺失／非法值继续保留未知。当前进展见 `docs/integration/FUNCTIONAL-GAPS-20261022.zh-CN.md`。

本地提交 `113d4ef`（刷新失败保留）与 `1a70222`（缺项未知）未推送。新导入任务不能假定远端包含这些修复；请在整合时审查补丁，不重写计算引擎。

## 已改的契约与消费者

- `packages/schemas/src/showcase.ts`：`ImportedShowcaseCharacter.level`、面板七项属性、`damageBonuses` 的值允许 `null`；`GraduationBuildPlaceholder.sourceLevel` 同样允许 `null`。这只描述导入中间数据，不改变已保存 CalculatorDocument 或历史模拟结果身份。
- `packages/game-data/src/showcase.ts`：缺失数值返回 `null`，明确零仍为 0；等级来源为有效 `propMap[4001].ival`，没有该字段时可用展示列表的明确等级；已有但非法的等级不得回退掩盖。天赋有效值沿用基础值加映射 bonus 一次。
- `apps/web/src/calculator-import.ts`：导入完整性门禁列出缺失字段，检查等级、最终面板必填属性及所选命中元素加成。充能未知保持字段缺失；不得用 1 填补。保留原始有效天赋匹配检查，装备贡献不重复添加。
- `apps/web/src/calculator-ui.ts`：未知展示与元素切换门禁；未生成可执行文档时不展示貌似准确的伤害。
- `apps/web/src/app.ts`：未知展示；刷新失败保留上次成功展示柜及选择，明确不是本次刷新结果。
- `packages/game-data/src/build-import.ts` **没有改动**：严格配装路线仍传 `baseTalentLevels` 与命座；不可将展示有效等级塞回基础等级。
- 测试：`showcase.test.ts`、`build-import.test.ts`、`showcase-refresh-preservation.spec.ts`。`scripts/register-json-modules.mjs` / `json-module-loader.mjs` 解决 Node ESM JSON 加载；标准浏览器入口为 `npm run test:e2e -- <spec>`。

## 共同限制

原始最终面板不是完整战斗快照，不能反推条件增益/历史快照。导入预览应区分基础天赋、命座加成和有效天赋，并保留可追溯来源及未知状态。缺失不等于零；也不能把合法零标为缺失。

新任务负责独立授权适配层、规范化、完整度及预览；当前任务不新增登录、会话收集或持久授权。用户认可的后续目标是“全部已拥有角色当前配装”，不是背包未装备物品或历史配装。现有真实队伍验收来自固定测试构建，不是玩家实装。
