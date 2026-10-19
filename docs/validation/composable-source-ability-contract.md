# 可组合来源能力绑定

`source-action-library.ts` 新增逐能力来源检查，沿用现有模拟入口，不再要求新入口匹配整场固定面板。旧安柏、诺艾尔、久岐忍固定来源版本的身份、检查和执行语义保留。

当前绑定来自 `compileSourceRuntimeAbility`：`abilityId / actorId / sourceActionId / talentLevel / ascension / constellation / registryVersion`。首批可执行来源为安柏、重云、刻晴、埃洛伊、钟离的C0 Q；安柏N数表虽然已登记，真实连段推进与动作重置未接入，仍明确拒绝可组合执行。

检查只约束绑定能力的实际倍率、命中、取样、附着、能量、冷却、取消帧和自身增益。能力名称、命中／增益标签可编辑；角色实际数值、等级、配装、初始能量、队友、换人及其他自定义能力不被整场签名冻结。同一角色的来源身份、突破、命座必须一致；来源Q角色的元素和40能量上限须匹配。不同abilityId不能重复绑定同一角色的同一来源动作来绕过冷却。

此批需要60 FPS合法时间线、`aura-v3`真实附着、固定来源附着ICD与直接伤害组规则、禁用调试反应覆盖及卡肉目标时钟，以及单个静止且在范围内的目标。用户必须明确选择所需规则；校验不悄悄更换模型。原rotation数组可以保留供恢复，合法时间线运行时不执行它；旧整场固定契约身份不能同时用于新绑定。来源状态仍为provisional，带此绑定的场景不能标为verified。对于真实快照清单中明确选定的preview／official-next快照ID或标签，校验拒绝混用已发布来源数值；不靠任意dataVersion字符串的拼写推测数据身份。

`deriveSourceBackedRotationMappings` 可派生已验证能力的Q别名；若同角色有多个同种自定义／来源能力，快捷名不私自选择其一，仍需明确action ID。`compileRotationDsl` 自动采用来源映射并保留显式用户映射。绑定校验由公开模拟入口与实际捕获／回放入口共用；不增加第二套调度器或schema到core的动态依赖。

指定时点取样与独立附加基数由主事件队列执行，`sourceSnapshotLog`记录真实帧、优先级、拥有者和取样属性。共享AST展示实际来源快照与独立HP附加的公式、变量、代入和解释；命中捕获／计算器回放／完整JSON保留同一关系。本批没有对这些新取样任务执行完整检查点周期闭合验证。

根任务统一验证已完成：唯一组合核心首轮1/1 PASS（Vitest3.27s／墙钟3.754s），唯一正常页面首轮1/1 PASS（3.1s／墙钟3.594s）。数据生成／一致性／状态首轮exit0（4.502／4.345／3.469s）。构建首轮因`reproducibility.test.ts:604`审计字段类型遗漏`sourceSnapshotLog`失败，补齐后exit0（墙钟3.283s、484模块、Vite442ms）。[核心日志](composable-source-core.initial.log)、[页面日志](composable-source-browser.initial.log)、[原构建失败](composable-source-build.initial.log)与[通过日志](composable-source-build.retry.log)均保留同名退出码文件。

页面实际保留初能7／11，用户填40后两Q各扣40；天星6563.304、独立HP附加6600，刻晴10击，全场10028.029／8s=1253.503625 DPS，回放差0，完整记录恢复一致。来源和计数边界见[本批中文报告](../composable-source-actions-20260925.zh-CN.md)。本次文档收尾没有新增或执行测试。
