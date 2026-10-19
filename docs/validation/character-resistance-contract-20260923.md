# 角色减抗表达式与已审输入档：定向合同验证

2026-09-23；本文件是实际工具结果转录，没有为生成日志补跑测试。

实现：`calculator-model.ts` 接入普通命中的 `resistanceReductionFormula` 与公式输入的 `allowedValues`；`calculator.ts` 以同一 AST 执行角色减抗，与适用装备减抗合计。明确的 `effectiveResistance` 覆盖两者，保留原角色公式及不适用来源说明。最终面板转换保留各段最终抗性，JSON 往返不再次扣除减抗。来源角色映射的具体数值由独立来源测试验证，本文件只记录核心合同。

运行命令：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-equipment-reactions.test.ts -t 'character formula|audited input'
```

18:32:45，171 ms：1 passed、1 failed、3 skipped。已审资源档 `[20,40,60,80,100]` 的 JSON 保留与越界拒绝用例通过；减抗用例失败原因是合成夹具仍为 physical，而测试条款限定 pyro。修正测试夹具的元素，不改伤害数值或适用规则。

仅重跑失败用例：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-equipment-reactions.test.ts -t 'character formula'
```

18:32:59，158 ms（执行 24 ms）：1 passed、4 skipped。检查覆盖：角色与装备减抗相加、突破未解锁归零、缺突破阻塞、明确最终抗性覆盖、保留来源 trace、最终面板与 JSON 等值。此前通过的输入档用例未重复运行。未执行全量测试。
