# 月反应与 Stellar 条件公式：实现与证据边界

本次实现的是有版本来源的**条件数值公式**。它们进入独立计算器的共享公式追踪，不证明当前角色、队伍、附着、领域或资源过程已经支持。尤其不能把来源的 Luna VI、7.0 范围自动提升成 7.1 全量机制验证。

## 本次实际读取的来源

| 规则 | 来源及范围 | 抓取时间（UTC） | HTML SHA-256 |
| --- | --- | --- | --- |
| Lunar | [KQM Lunar Reaction Guide](https://keqingmains.com/misc/lunar-reactions/)，页面标明 Luna VI | 2026-09-22 14:30:48.108617 | `de1ebc4ee7767842f07ee7a5eb6ceeb7eb980b1d8b55a7eaac84e5e027097a9e` |
| Stellar | [KQM Stellar Glimmer Reaction Guide](https://keqingmains.com/misc/stellar-reaction-guide/)，页面标明 7.0 | 2026-09-22 14:30:49.729027 | `cba82bde8a037b75cc1762a3b13976c857118a917221087a756b0347f5a6330c` |

读取了页面，并逐一检查其公式图片；图片的逐项 URL、响应元数据和哈希见 [source-retrievals.json](source-retrievals.json)。没有仅凭图片文件名推断公式。页面中的公式为以下实现的证据；独立游戏内实验、精确角色字段及当前版本回归证据仍不充分，因此实现状态始终为 `conditioned-formula-only`。

## 可执行公式与分支

每名贡献者或直接能力所有者使用：

```text
EMBonus = 6 × EM / (EM + 2000)
base = finalStat × talentCoefficient          （直接能力）
base = explicitLevelBase                     （反应贡献）
scaled = k × base × (1 + specialBaseBonus)
augmented = scaled × (1 + EMBonus + reactionBonus) + specialAdditive
contribution = augmented × individualCrit × resistance × elevationMultiplier
```

`elevationMultiplier` 是公式图片中直接相乘的总倍率，默认教学值为 1；不能再自动加 1。专属基础提升、专属反应加成和专属加算的作用次序分别保留。普通伤害加成、普通加算和敌人防御不进入这些公式。各输入均为明确给定的条件，不声称任意角色的效果都适用。

| branch ID | 实际执行方式 | k 或状态含义 | 直接公式证据 |
| --- | --- | --- | --- |
| `lunar-charged-direct` | 单一能力所有者，属性 × 天赋 | 3 | [Direct-LC.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/01/Direct-LC.webp) |
| `lunar-charged-reaction` | 等级基数、独立暴击、排名加权 | 3 | [image2-new.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/05/image2-new.webp) |
| `lunar-bloom-direct` | 单一能力所有者，属性 × 天赋 | 1 | [Direct-LB.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/01/Direct-LB.webp) |
| `lunar-bloom-event` | 非直接伤害事件；不返回伤害数值 | 产生草原核、草露；其后伤害另属事件 | Lunar 指南正文 |
| `lunar-crystallize-direct` | 单一能力所有者，属性 × 天赋 | 1.6 | [Direct-LCr.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/01/Direct-LCr.webp) |
| `lunar-crystallize-reaction` | 等级基数、独立暴击、排名加权 | 1.6 | [image5-new.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/05/image5-new.webp) |
| `stellar-conduct-direct` | 单一能力所有者，属性 × 天赋 | 由条件化 Polestar 计数确定 | [Direct-Stellar-Conduct-Formula.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/08/Direct-Stellar-Conduct-Formula.webp) |
| `stellar-conduct-event` | 非伤害状态事件；不返回伤害数值 | 状态与能力伤害分离 | Stellar 指南正文 |
| `stellar-swirl-direct` | 单一能力所有者，属性 × 天赋 | 1 | [Direct-Stellar-Swirl-Formula.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/08/Direct-Stellar-Swirl-Formula.webp) |
| `stellar-swirl-anemo-reaction` | 等级基数、独立暴击、排名加权 | 0.75 | [Indirect-Stellar-Swirl-Formula.webp](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/08/Indirect-Stellar-Swirl-Formula.webp) |
| `stellar-swirl-vortex-1` | 等级基数、独立暴击、排名加权 | 2 | 同上 |
| `stellar-swirl-vortex-2` | 等级基数、独立暴击、排名加权 | 3 | 同上 |

星导直接能力的 Polestar 计数输入只接受整数 0 至 12，依次映射到 `[1, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2]`。计数如何随时间累计未在此内核中执行，未把计数器冒充领域模拟。

精通公式分别读取 [Lunar EM](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/01/EM-Bonus.webp) 与 [Stellar EM](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/08/EM-Bonus-Formula.webp)。本内核要求调用者提供等级基数、等级、证据状态和来源；不自动读取旧版表、不插值、不捏造缺失等级。教学例的合成基数明确不代表真实 90 级数值。

## 参与者、暴击、排序与期望

仅对上述已读取排名公式的反应伤害分支使用 `[0.6, 0.3, 0.05, 0.05]`；直接能力权重为 1。Lunar [贡献公式](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/05/image6-new.webp) 与 Stellar [贡献公式](https://kqm-uploads.keqingmains.com/wp-content/uploads/2026/08/Stellar-Swirl-Contribution.webp) 分别取得，未把一套排名算法套给未读取的分支。无贡献者的名次按零贡献理解，不将剩余权重归一化。

参与者 ID 必须唯一，重复元素施加不能重复计数。每种独立暴击组合先算各贡献者完整伤害，再按真实贡献排序加权，最后乘该组合概率。至多四人，因此最多 16 种组合；概率为零的组合略过。期望值在这些输出上求和，不对输入或贡献先求均值。条件范围不含暴击触发后改状态的反馈。

相同贡献用 ID 稳定排序仅为确定性数值归属；不声称游戏中的并列归属规则。最高贡献并列而暴击状态不同时，`displayedCritical` 为 `ambiguous-tie`。数值期望不依赖这种 UI 标签。普通输入顺序变化不会改变总伤害。

独立人工验算向量（所有其他非暴击因素之后的合成输入）：A = 100，暴击率 0.5、暴伤 1；B = 150，暴击率 0。未暴击组合为 `150 × .6 + 100 × .3 = 120`；A 暴击组合为 `200 × .6 + 150 × .3 = 165`；精确期望 `0.5 × 120 + 0.5 × 165 = 142.5`。错误地先平均后排名得到 135，少 7.5。该向量是数学教学验算，不是角色实战记录。

## 与独立计算器共享执行

- `packages/reaction-formulas/src/special.ts`：版本化分支、严格输入模式、独立暴击组合和执行表达式。
- `packages/sim-core/src/special-calculator.ts`：将内核的每个表达式交给公共 `TraceBuilder.add` 执行，返回同一节点的原始结果、公式、数值代入、来源和中文解释键。数值计算与解释不另写两套公式。
- `createSpecialTeachingContext` 与 `SPECIAL_TEACHING_CONTEXTS`：12 个分支各有可修改的完整合成输入，含两个非伤害事件；不会进入正式角色目录。

输入恢复保留 `branch`、`ruleVersion`、贡献者所有数值及来源、敌人有效抗性、条件说明与 Polestar 计数。同一 JSON 上下文可复算相同的数值、排名结果和每个追踪节点。此项证明计算上下文复现，**不证明**团队模拟器已经能自动产生这些特殊事件。

## 执行验证与未完成项

2026-09-22 执行 `npx vitest run packages/reaction-formulas/src/special.test.ts packages/sim-core/src/special-calculator.test.ts`，2 文件、41 测试通过，Vitest 报告耗时 234 ms。人工数值验算采用 `toBeCloseTo(..., 10)`（绝对容差小于 5×10⁻¹¹）；共享表达式与追踪执行采用未舍入机器值完全相等。覆盖人工验算 142.5、顺序变化、并列、暴击改变排名、16 组合、固定缺席权重、12 分支、完整星导计数表、抗性边界、重复身份/非法字段/版本冲突/溢出拒绝、JSON 上下文复现、输入编辑后的追踪重算、共享 AST 中每项代入与机器值一致。

一次同步的全工程 `npm run typecheck` 在 UI 正在添加 `special` 分支时发现 `calculator-ui.ts` 尚未穷尽处理新联合类型；特殊公式新文件无类型错误。最终全工程检查由主任务重新执行，不能将本节的局部测试作为全工程通过声明。

尚未完成且必须继续阻止完整机制就绪声明：各角色启用与转换、Moonsign/Radiance 条件、雷云/草露/月笼/Polestar/Stellar Vortex 的真实生命周期与附着、贡献者资格时间窗、角色特定专属加成/上限、当前版本等级基数交叉验证、游戏内暴击关联及状态反馈、非确定并列的真实游戏归属。转换关闭或未知时返回带原因的阻塞；普通反应回退必须由完整元素事件环境重新确定，绝不自动改名成普通反应。
