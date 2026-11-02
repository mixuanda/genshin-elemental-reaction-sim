# /goal 伊安珊 C4、夜魂恢复与事件顺序只读审计

基线 `314218d`，固定 Stellar `a7dc4bf`、Optimizer `180a0a1`；逐文件原件 Git blob、SHA256、实际 patched 源码 SHA 和冻结中文原文见 `.sources.json`。14 个上游文件均与固定 source-tree 匹配。本分支仅写这两份文档，没有运行模拟、Go 测试或构建，没有修改源码、来源归档或旧捕获。

**可证明的缺陷是标示自然到期没有结束夜魂。** 固定中文 Q 明确“动能标示退场时，伊安珊的夜魂加持将会结束”。目前 `restorePointsTask` 发现 Q 状态过期只清 `c4Stacks`，`updateATKBuff` 只归零；只有耗尽夜魂或独立 16 秒夜魂计时器调用 `exitNightsoul`。因此，正夜魂跨过 Q 的 12 秒／C6 的 15 秒边界时，夜魂及其消费可以继续；12 秒 Q 后的 A1/C2 也可能持续到自身期限。现有 `after-sentinel/c6-q-team.native.json` 在 F717 已耗尽夜魂，早于该实例实际期限 F906，**不能**作为本缺陷的实际边界复现。

根线程拟议141用 Q 实例 `burstSrc` 绑定的全局任务，按当前 `StatusDuration+1` 检查、被 hitlag 延长就重排、实际失效才 `exitNightsoul`，符合原 `FindCheckExpiry` 在期限等号仍有效的约定。不要简单在每秒恢复的过期分支增加退出：旧 Q 任务可能晚于新 E 入夜魂。全局队列同期限按插入顺序执行，起手登记的 Q 到期任务早于后来 E 的延迟3帧入夜魂；当两者同帧，旧 Q 先退出、新 E 后进入。需由 root 用窄 fixture 实证同帧、hitlag、新 Q/提前退出和新 E 保护；本报告未实现或运行141。

| 合同 | 实际实现与判断 |
| --- | --- |
| C4 两层、每个标示一次 | `OnBurst` 回调检查标示有效、场上不是本人、`!c4Generated`，置层数2并锁定；本人的新 Q 重置层数/一次门。每次有效恢复消耗一层加4，与固定文本及参数 `[4,0.5]` 一致。未证明另一处数值错误。 |
| 恢复与旧溢出 | 每秒 core task 先算 `0.67×累计movement + A1(0/1/4) + C4(旧overflow×0.5 + [层数>0 ? 4 : 0])`，至多消费一层；随后清移动累计，计算新 overflow，授予 C6，再 clamp 恢复夜魂。旧溢出先读后写，没有把当次 overflow 回填当次恢复。 |
| overflow 跨标示 | 退出／新 Q 未清 `pointsOverflow` 是确定的源码事实；固定中文“下一次通过标示恢复”未明确是否跨标示，Optimizer 也没有生命周期求值，**不能据此确定应清零**。 |
| A1 下一次恢复 | `a1Points` 在恢复前消耗 `a1Increase`；生成/消费事件在 clamp 后携实际净量同步触发。A1 回调不读净量，满值零净恢复是否应触发强化仍缺游戏资格证据，不据此改规则。 |
| C6 其他恢复 | 仅标示每秒恢复计算 overflow 并调用 C6；Q+40帧的15点 `GeneratePoints` 不走此链。固定 C6 文本未限“标示恢复”，E→Q 的15点溢出是另一个应做窄资格验证的分支，尚未由本报告实测或修复。 |

Optimizer `index.tsx` 只读取 C4 的4点／50%参数并展示 `ct.talentTem('constellation4')`，不模拟层数、移动、事件、到期或跨 Q 溢出，不能用它为 native 全生命周期背书。

实际事件顺序是：该帧先处理 core tick（角色 local 队列先于 core 全局任务），之后才执行新输入。`useAbility` **先**发 `OnBurst`，随后才创建 ability invocation、调用具体角色 Burst；所以同帧队友 Q 不会倒灌已经完成的恢复。切人的延迟回调先改 active，再发 `OnCharacterSwap`。`OnMovement` 在动作方法之后、`OnActionExec` 之前发，并且只来自显式整数 `movement` 参数；dash/jump 本身不会自动产生测量距离。不能把无此参数的动作当作移动恢复，也不能把任填距离称为游戏几何实测。

当前 WASM `e607f7cfe90b778cbd95ba4fa1d0184c00464ac187f2bc8f65a20834ec0fbc45` 的普通20秒捕获虽有夜魂净变动日志、状态实例和任务记录，却没有 `pointsOverflow/c4Stacks/c4Generated/burstRestoreNS/a1Increase`，也未覆盖队友 Q 授层；故不能从总伤害或最终点数独立分解 C4。已有 opt-in `phaseObservation` 可在实际解释器标记读到反射私有字段，但不提供任意帧 checkpoint，且未知数值时钟／闭包仍会明确报 gap。

若后续需要生产点回执，最低记录：帧／角色 local clock、当前角色、Q/夜魂实例与 source、真实状态期限、恢复前点数、已有 movement 累计、旧/新 overflow、C4 触发门与层数前后、A1 强化标志及本次已求值贡献、请求与实际保留点数、原 actionSequence/task origin。只复制已有局部变量；不得再次调用会消耗标志的 `a1Points/c4Points`、再次恢复点数、追加 gameplay listener/event 或读取 RNG。缺这些字段时应报告缺证据，不把 C4/C6 全路径标成已验。
