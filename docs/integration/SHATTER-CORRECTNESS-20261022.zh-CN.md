# 碎冰递归数值及帧边界复查

基线 e9cf67a；2026-10-22 02:11:28 UTC 云端命令成功、工作树干净。仅在 integration 分支工作。最近完整回归基线仍为 2907 pass / 86 fail；本轮不更新该总数。

## 实际结果

原 shatter-recursive-delivery.test.ts：4 pass / 5 fail。原断言、冻结1.39 Golden均保持原样。为收集失败实值，临时在Golden对比前写本地JSON，然后逐字恢复原测试；没有跳过断言。

五个失败的投影差异只有事件eventSequence、damageEvents摘要以及新增flatStatBuffSemantics。摘要变化不能据此推断其所有底层字段只改变编号；本次可证明的是独立投影中的逐击伤害、帧、目标、来源、父子关系、总量与角色贡献均与冻结基准一致。没有将编号改回旧值或放宽断言。

新增 shatter-independent-numerics.test.ts：最终8/8通过。类型检查首次发现测试中的可选hits访问，补明确非空类型断言后通过；不改变测试运行行为，初次失败日志保留。测试不调用生产公式函数计算期望；使用已有固定规则表的90级基值1446.8535（packages/reaction-formulas/src/profile.ts），碎冰倍率3，超载倍率2.75，精通项16×EM/(EM+2000)，抗性乘区。仅固定来源规则复现，不是官服完整精度证明。

| 配置 | 独立期望／实际总伤害 | 碎冰帧／归属 |
|---|---:|---|
| 钝击物理 | 7136.8247357142845 | F2 / crusher |
| 岩伤 | 7136.8247357142845 | F2 / crusher |
| 超载递归碎冰 | 20401.518246428568 | F3 / pyro，enemy-1 |
| GCD内再次冻结触发 | 8261.824735714285 | 仅F2一笔碎冰 |
| 钝击先耗尽冻结韧性 | 750 | 无碎冰 |

直接碎冰 = 1446.8535×3×(1+1600/2100+0.2)×0.75 = 6386.8247357142845。超载子碎冰 = 1446.8535×3×(1+1600/2100)×0.9 = 6882.888792857142；两目标各超载6309.314726785714，总量另加两笔直接伤害各450。逐事件求和、角色贡献求和分别校验，父子ID、目标和帧明确，不按站场角色猜归属。

额外边界：触发命中延后1帧，父子伤害F2→F3而总量不变；12帧GCD的间隔11帧只允许第一笔，间隔12帧第二笔在F14生效，每次只有一条碎冰伤害记录。使用60FPS整数帧调度，无提前秒级取整。

## 复现与证据

```
npm run test:unit -- packages/sim-core/src/__tests__/shatter-recursive-delivery.test.ts --reporter=json --outputFile=/workspace/GIDPS-cloud/shatter-correctness-20261022/baseline.json
npm run test:unit -- packages/sim-core/src/__tests__/shatter-independent-numerics.test.ts --reporter=json --outputFile=/workspace/GIDPS-cloud/shatter-correctness-20261022/independent-final.json
npm run typecheck
```

云本地证据目录 /workspace/GIDPS-cloud/shatter-correctness-20261022：原结果及配置、Golden差异、正式失败日志、新增独立数值日志、类型检查。fixtures/shatter-correctness-configs.json 只提取原测试配置，不保存新结果作为期望。角色名hydro/crusher/pyro是合成机制探针，不冒充真实角色/配队覆盖。

本轮没有证明生产数值缺陷，因此交付针对性回归保护而非伪造算法修复。未验证全部碎冰组合、真实角色端到端、Windows或所有剩余失败；没有覆盖旧文件、修改Golden、push、部署、许可证或凭据操作。后续优先对有原始失败证据的其余反应场景做同样有限复现。

模型偏好已接收：后续支持的回合边界使用 sol / max reasoning。当前执行工具不提供模型切换，因此不声称已经切换；本轮成果和断点完整保存，避免下一回合重跑已完成检查。
