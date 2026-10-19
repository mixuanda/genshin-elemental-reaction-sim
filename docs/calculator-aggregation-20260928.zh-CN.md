# 计算器命中组成与总和归属（2026-09-28）

本轮在既有 `SourceHitMapping` 上增加统一计算结果 `CalculatorResult.aggregation`，把已准备命中、选择状态、归属范围和可用伤害值交给同一核心汇总。未另造 manifest，也没有增加角色、动作、系数或时间线覆盖。本输出整理现有计算结果，不会消除它们自身的生命周期、来源或 completeness 缺口。

## 归属与完整性

核心为每个组成段记录来源、是否选中、命中类型、状态、阻塞原因及非暴击／暴击／期望伤害。若命中有 `castContribution`（例如受条件触发概率影响的追击），汇总优先采用施放贡献值；否则才取逐段 damage result。所选组成可区分单击、完整施放、用户声明命中集合和任意选中分段，完整施放标签需同时满足：来源上下文声明 scope complete、所有准备段都被选中，且没有任何阻塞。

被阻塞或未选中的段不会补成0。若已选段中存在阻塞，只输出可计算部分的 `subtotal.nonCritical`、`subtotal.critical`、`subtotal.expected` 与 `knownSubtotal`，不生成正式 `totals`。若所选集合本身均可计算，则可以有该所选范围的正式 `totals`；但取消了其他段时，`aggregation.scope` 仍是 `selected-components`，不能将其称作完整技能伤害。只有全部准备段都选中、来源上下文声明 scope complete 且无阻塞，才标为完整施放。

## 页面呈现

`apps/web/src/calculator-aggregation-view.ts` 以中文列出组成、范围、完整性说明和分页详情；初始显示20项，可继续展开。选择已算组成时沿用既有 hit detail 操作展开该段对应的完整公式。计算根节点接入核心结果，既有核心与独立用户工作流保留；导出报告带上聚合数据，导入文档后由核心重新计算，不信任导出时附带的旧总和作为当前结果。

## 已执行验证

核心聚合测试2项通过，覆盖 Keqing 完整／取消选择／阻塞时已知小计／单击范围，以及 Yanfei 条件追击的概率归属与被禁用分支。收据 `docs/validation/calculator-aggregation-core-20260928.json`：Vitest 3.02秒、测试64ms、墙钟3.531秒。

Web build 首轮通过，墙钟3.531秒、686 modules、Vite 860ms。日志保留 dynamic-import 和大 chunk 提示；构建仍为 exit 0。收据 `docs/validation/calculator-aggregation-build-20260928.json`。

页面聚合 E2E 首轮失败于测试 helper 仍按两位小数格式化，生产计算器使用六位小数，断言收到3491.42、实际界面3491.424。仅将 spec 精度改为6位，并补上点击组成项展开已记录公式的交互；未修改生产实现后 retry1 通过（单用例2.7秒、runner3.4秒、墙钟3.922秒，`pageErrors: []`）。收据 `docs/validation/calculator-aggregation-e2e[-retry1]-20260928.{json,log}`。

实际结果来自行秋两段施放：完整期望总伤2909.5200000000004；仅保留单击时，所选范围total为1360.8000000000002，第二段为1548.72。独立工作流将ATK从1000改为1200后，两段分别为1632.9599999999998与1858.4640000000002，总和3491.424；导出文档、报告内聚合和导入重算都保留该值，导入后的aggregation与原结果深度相等。compact测量收据 `docs/validation/calculator-aggregation-measurements-20260928.json` 标记 `reportAggregationMatchesEdited` 和 `importedAggregationMatchesEdited` 均为true。页面改动整合了既有大数字显示、保留 `calc-*` test IDs，组成明细为五列，最多显示六位小数，长ID和来源折叠查看。

本轮没有构建新来源WASM；既有WASM结果不自动覆盖新聚合代码。以上测试与页面结果不代表新增角色/动作/来源数据覆盖，也不证明全游戏伤害完整；数据与 verified 分母不变。

最终工作树收据 `docs/validation/calculator-aggregation-final-worktree-20260928.json` 记录 `git diff --check` 通过（0.054秒）及 HEAD `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`。这仅表示 tracked whitespace 检查通过，不是全面完整性验证。
