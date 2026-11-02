# 剩余正确性失败有限复查

起点 c269ce5，独立 integration 工作树。最近已知完整回归仍为 2907 pass / 86 fail；本轮没有运行完整回归，不能用局部通过更新该总数。

## 选择依据与当前实证

读取 ec-contract-audit-20261021/comparison.json 与 REPORT：原86分为消费者8、历史格式45、Golden24、EC9。优先检查曾经阻断真实输出的 EC 传播，以及可能影响反应伤害/状态期限的 target-reactable-phase-v2。

后续提交 626e211 已将 nearby-Wet 传播测试/执行接到新显式见证协议；3eac528 提供该协议 parser、重放与校验。因此不重复把旧 EC 报告当当前未修复。

实际运行命令：

```
npm run test:unit -- packages/sim-core/src/__tests__/electro-charged-propagation.test.ts packages/sim-core/src/__tests__/event-step-execution-profile.test.ts packages/sim-core/src/__tests__/target-reactable-phase-v2.test.ts --reporter=json --outputFile=/workspace/GIDPS-cloud/remaining-correctness-20261021/focused.json
```

结果26项：21 pass / 5 fail。

- EC传播9/9通过，保留原数值、Aura、归属、几何、节奏与顺序断言。
- 新协议执行延迟3/3通过，含延迟帧、可复现、逐击独立重放与篡改拒绝。
- 目标阶段14项中9通过；5项失败发生在最终冻结Golden严格等值对比，此前各用例关键帧、事件顺序与状态期限断言已通过。

## 五项失败的精确范围

用测试已有 PRINT_TARGET_REACTABLE_PHASE_GOLDEN 诊断开关捕获投影。第一次 stdout 被测试运行器隐藏，第二次仅临时增加本地 writeFileSync 捕获；原测试逐字恢复，git diff为空。此模式跳过Golden断言，**其14 pass不是验证通过证据**，只用于生成差异；正式结果仍21/5。

沿用原测试的身份规范化（只去schemaVersion、engineVersion、configHash、reproducibilityKey），逐字段比较冻结1.39：

| 场景 | 差异字段数量 | 内容 |
|---|---:|---|
| Frozen F176 | 12 | flatStatBuffSemantics及eventSequence |
| Quicken F600 | 12 | 同上 |
| Burning Fuel F61 | 7 | 同上 |
| EC coexistence F570 | 14 | 同上 |
| Frozen +5 hitlag F181 | 1 | 仅flatStatBuffSemantics |

运行语义新增 canonical-v1；其余差异对应投影中 damage.rows[8]、boundaryTimelinePoints[8]、targetTasks.event[2]、burning.event[1]，均为事件队列序号。未采用统一偏移、忽略序号或宽松断言让测试变绿。

在这些**投影字段**内，伤害值/逐击帧/归属/Aura/状态期限/时钟与冻结基准一致；这不证明投影外所有机制、全部消费者都正确。完整字段差异见 golden-differences.json。

## 有限缺口与下一项建议

1. 历史格式45：旧投影不接受新增flatStatBuffSemantics等字段；需逐版本证明可表示语义，保留原件和拒绝有损转换，不能当伤害公式缺陷改数值。
2. Golden24：本轮只核了其中上述5项；其余19项未重跑，不能推断全部仅身份差异。下一块优先核 Shatter recursive delivery 的实际伤害/递归顺序差异，复用相同精确投影方式。
3. 消费者8：前次审计列明条件缺项、旧身份/目录计数、隔离preview、说明文案；本轮只读复核已有分析，没有新发现实际数值错误。不能为满足旧无条件成功断言推断碰撞数、完整Q或战斗状态。
4. EC9：普通传播9项当前通过（原8项失败来自该文件，另1个Golden未本轮重跑），后续实现已覆盖公开新协议。不重复修复或宣称原86清零。

本轮没有确认真实未解决数值缺陷，故没有生产算法修复，也没有修改原测试、Golden、旧结果或账号导入逻辑。证据不足时交付上述精确缺口，不编造错误。无环境/权限阻塞；没有push、部署、合并或许可证操作。
