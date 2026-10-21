# 感电 P5 内存见证阶段记录

基线：48ff7f9。云目录 `/workspace/GIDPS-cloud/latest`。

本次捕获实际 reactionDamage 事件中的候选观测、应用分配和命中记录读取。命中记录读取当前游标但不递增，允许它与下一次分配使用相同编号；校验重放明确的 allocate/observe-hit 操作，不使用固定 +1/+2，也不接受任意递增。记录绑定来源角色、来源目标、触发命中、父反应、队列及目标，并检查候选/应用/命中日志的顺序和引用。未知分配点明确拒绝。观察器接收深拷贝，不修改生产事件、伤害或持久字段。

验证命令：

```
node node_modules/vitest/vitest.mjs run packages/sim-core/src/__tests__/direct-hit-step-witness.test.ts --reporter=json --outputFile=/workspace/GIDPS-cloud/ec-p5-witness-20261021/final-targeted.json
node node_modules/typescript/bin/tsc --noEmit
```

结果：39 pass / 0 fail；类型检查通过。原20项保留，新增19项：四种有/无教官与Hitlag组合的真实引擎正例、13个来源/顺序/遗漏/游标篡改负例、6和32目标传播（含无水与超范围未选中目标）。四种原场景的逐击伤害、反应和归属继续逐字段对照原基线 fixture。首次实现误把捕获放在另一命中帮助函数、误用父字段名，初测31/6；已修正捕获位置/字段，复测37/0，扩展目标后39/0。原始失败日志保留，未改数值断言。

范围：这里只验证子步骤引用，不替代既有Aura、几何、反应伤害和其他跨日志证明；不是敌意完整伪造数据的真实性认证。新增路径为现有 provisional nearby-wet-radius-v1、target-phase-v2；没有将其升级为官方已验证机制。未覆盖额外回调分配点、其他目标阶段模型、动态位移等新组合的正向接入；未知分配拒绝。公开 EC9 仍在原门禁失败，不以内部观察器成功声称公开模拟修复。未修改WASM，无重建必要，未跑重复全量回归；最近全量仍为2872/86，不能加上新测试冒充本轮全量结果。Windows真实浏览器未测试。

兼容策略已获用户批准：新内容采用新格式，旧文件读取保留；编辑转换为新副本，原件/原结果保留，仅重新模拟并满足新协议才可标新验证。该策略不再等待决定。本次尚未接入parser、重放、UI和导出。发现app.ts导入当前会调用runSimulation，后续接入须去掉隐式重算。新文档必须区分输入可迁移、缺输入、旧结果仅可读，且转换失败保留编辑内容。

下一块：新协议公共链路与文件编辑副本闭环，然后复用现有rotation-visual/workspace-panels和Worker推进动作面板，不另造CD或能量规则。整批完成后一次全量回归。无push、部署、许可变更。
