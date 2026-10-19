# 兹白：有限普通／月结晶双段的固定来源协议

本批实现两种独立动作：一次已经合法发生的灵驹飞踏重施、一次元素爆发。每次由普通岩伤第一段和直接月结晶第二段组成；不把进入隙中月的E开启动作冒充灵驹，也不把有限重施当作整个E姿态。范围为C0、明确单目标和实际观察输入，来源仍为provisional。

证据来自固定Optimizer提交 `180a0a1015cb725c7570cd828eb086749960df98`。原文、MIT许可证、每文件SHA-256以及四组各15级的倍率向量位于[来源manifest](../../../packages/game-data/sources/zibai-finite-casts/manifest.json)和[definitions](../../../packages/game-data/sources/zibai-finite-casts/definitions.json)。倍率绑定零容差；本次没有运行测试、构建或数据生成，不能把归档动作称为验收通过。

## 实际伤害与公式分区

`Zibai/index.tsx` 的 `skill.stride1Dmg`、`burst.skill1Dmg` 是普通DEF缩放岩伤；`skill.stride2Dmg`、`burst.skill2Dmg` 明确进入 `lunarDmgNode(...,'def','lunarcrystallize')`。归档的 `wr/reaction/lunar.ts` 给出直接月结晶系数1.6，`wr/reaction/special.ts` 给出各乘区顺序，生产计算继续调用已有共享特殊伤害AST。

- 第一段：普通DEF×天赋，适用普通增伤、防御、暴击、抗性等既有核心步骤；不会读取月结晶专属基础提升、反应加成或灵驹A1。
- 第二段：`[1.6×DEF×天赋×(1+专属基础提升)×(1+6EM/(EM+2000)+专属反应加成)+专属追加值]×暴击×提升倍率×抗性`。普通标签增伤与普通伤害附加值不会自动进入此分支。
- 灵驹A1只在突破1后、第二段本击实际处于四秒窗口时，增加 `0.6×DEF` 的**专属追加值**；它位于精通与反应乘区之后。窗口由实际输入声明，不从本次重施推定刷新。Q第二段始终不读取A1窗口或已含A1份额。
- 突破4的A4：每位其他岩队友增加15%防御百分比，每位水队友增加60精通；两类人数总计不超过3。实际应有贡献减输入面板已含贡献，通过同一AST产生补差。装备模式由中央装备属性阶段使用补差重算已有属性转换；普通和特殊两段使用相同实际面板。
- 固有月结晶基础提升是 `min(DEF/100×0.007,0.14)`。它与A4分别记账，以本击实际总DEF计算；输入专属基础提升再加实际固有份额、减已含份额，防止重复加入。

实际历史快照必须已含本次A4以及由此派生的其他属性，不能对未知旧装备重新采样。手动最终面板若需要防御百分比补差，还必须提供真实基础防御，不能把最终DEF作为百分比基数。转最终面板保存逐击实际属性，更新逐击A4已含份额；特殊基础提升与追加值继续按各自输入份额执行，来源解释保留。

## 可编辑观察协议

`gameContext.zibaiFiniteCast` 使用普通来源技能表单。完整动作由 `observations` 明确两条记录，顺序为 `ordinary`、`lunar`；每条有独立 `candidateId`、实际命中 `frame`、`snapshotFrame`、`snapshotId` 和 `targetId`。没有固定来源动画帧，因此不生成假定的首帧、段间隔或取消窗；只校验第二段不早于第一段、取样不晚于交付。`targetContacts` 必须逐条明确命中或落空，落空不生成伤害。`fullObservedLifetime` 与 `observedThroughFrame` 声明有限两段已观察结束。

完整计算可以明确两段面板稳定，或逐段提供完整进攻快照。独立模式通过 `independentEvent` 直接选择已发生的普通段或月结晶段，仅索取该击相关状态，不要求未来另一段、完整轮转或团队。灵驹仍需确认是合法重施；Q单击不会额外索取灵驹资格。

`sharedState` 与 `hitStates[完整hitId]` 均保存A4、专属基础提升、A1等输入。未知份额不默认零；明确零可正常计算。改变已物化事件、时刻、快照或被动记账会使旧逐击面板失效，避免旧面板与新状态静默混合。全部字段纳入严格JSON模型后由根任务统一验证。

## 中央接线合同

- schema：`zibaiFiniteCastBaseSchema` 由中央模型扩展既有 `snapshots`，导出 `ZibaiFiniteCastContext`；ordinary及special各加 `zibaiFiniteEventSchema`。
- 日程：`compileZibaiFiniteSchedule`；IDs为 `zibai-finite-spirit-steed-c0`、`zibai-finite-burst-c0`。
- 来源文档：`prepareZibaiFiniteCastDocument`、`resetZibaiFinitePanelAccounting`、`finalizeZibaiFinitePanelAccounting`。
- 属性阶段：`resolveZibaiFiniteA4` 返回比例DEF补差和固定EM补差；`resolveZibaiFinitePanel` 用于已提供最终属性的补差及历史记账校验。装备构筑的 `defPercent` 本身使用比例（0.15），不是UI显示的15；补差直接在共享属性阶段按比例相加。
- 特殊段：`resolveZibaiFiniteSpecialContext` 将实际面板、基础提升及A1追加值送入现成直接月结晶核心；`zibaiFiniteEventTrace` 记录实际观察／取样。
- 文字：`ZIBAI_FINITE_TRACE_TEXT_ZH` 为所有新AST节点提供稳定key、中文变量定义和解释，UI只渲染共享trace。
- 注册表：`zibaiFiniteMappings`、`zibaiFiniteTemplates`、`zibaiFiniteSourceEvidence`；只替换旧普通组件映射 `zibai-spirit-steed-first-hit`、`zibai-burst-first-hit`。源特殊倍率经 `formulaParameters` 独立绑定，不能省略第二段核对。

## 保留限制

仍未建立隙中月资源获得／消费、N/CA序列、灵驹使用次数、姿态结束、Q额外延长1.7秒与后续动作的自动状态机。没有来源动画帧、ICD、粒子、取消窗或自动团队执行认证；本动作不得注册为可组合自动团队能力。A1窗口是已观察本击条件，不能从有限两击反推实际触发历史。高命座C1/C2/C6等未在此C0适配器执行。独立来源公式不提升为当前官服实测验证，也不会把released与preview资料合并。
