# 共享核心装备反应／减抗专项结果转录

本文件转录 2026-09-23 已观察到的工具结果，不是重新执行生成的原始日志。未为保存本文件重跑测试。

工作目录：`/Users/evan/Documents/gidps`。

实际命令：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-equipment-reactions.test.ts packages/sim-core/src/__tests__/character-damage-bonus.test.ts packages/sim-core/src/__tests__/calculator.test.ts
```

工具返回退出码：`0`。Vitest 输出：

```text
 RUN  v4.1.10 /Users/evan/Documents/gidps

 Test Files  3 passed (3)
      Tests  35 passed (35)
   Start at  16:16:39
   Duration  462ms (transform 67ms, setup 0ms, import 158ms, tests 152ms, environment 0ms)
```

范围为装备经典反应加成、元素／显式条件减抗、逐击最终抗性、最终面板及 JSON 等价，连同受转换改动影响的草主 A4 与既有核心夹具。新装备协议夹具明确为合成输入；这份结果不认证真实装备映射、特殊反应装备效果或全项目集成。测试之后仅为一处测试变量补充了 TypeScript 判别联合收窄，没有改变断言或运行时计算。
