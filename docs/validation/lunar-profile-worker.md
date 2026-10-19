# 月反应运行的执行配置基线 Worker 验证

2026-09-24。生产接线只改 `apps/web/src/lunar-simulation-panel.ts` 与 `lunar-simulation-worker.ts`；主应用 getter 由主任务改为读取原始配置，并独立提供执行配置。`applyExecutionProfile` 在月反应 Worker 中先对原配置、原运行选项和原执行配置求基线，再将延迟后的原指令替换到面板运行副本；副本的反应模式／运行选项改动和追加月露涤荡保留。追加动作使用用户明确填写的最终帧，不再次增加延迟。

变化检测包含执行配置。响应、结果展开审计和导出保留 `executionBaseline.sourceConfig / options / profile / audit`；audit含profileKey、baselineMode、实际基线运行选项及逐指令延迟。无执行配置时不新增这些字段。现有终止 Worker 的取消能力覆盖基线和后续特殊执行。

## 唯一浏览器检查

新增 `apps/web/e2e/lunar-profile-worker.spec.ts` 一个流程，使用既有 `lunar-bloom-reference.synthetic.json`，仅显式关闭原配置自动反应，随后通过正常月绽放面板开启 aura-v5。这样能实际区分原始基线输入与后续副本改动，不依靠两个相同模式的输入宣称顺序正确。

导入1.1.0 runtime-energy-v1执行配置，输入与换人各1帧、额外取消延迟0；原选项为configured/noCrit/legacy-v0.1、明确seed。通过正常UI追加160帧月露涤荡并导出完整结果。

命令：`GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/lunar-profile-worker.spec.ts`

首次 **1通过**，测试 **1.1s**、总计 **1.5s**；退出0。复用4173与已有构建，未构建、未重跑旧月反应矩阵、未跑全套。日志 `lunar-profile-worker-e2e.log/.exit`，实际测量 `lunar-profile-worker-measurement.json`。对应文件已加入现有浏览器gate，但本轮没有执行整个gate。

实际断言：

- 读取当前配置前后普通结果身份不变、没有新增Worker。静态接线中该getter不调用apply，唯一新增基线执行点位于月反应Worker。
- 运行只启动1个lunar Worker。导出基线profile与导入1.1.0输入完全一致；sourceConfig等于读取的原配置，仍无自动反应模式、只有原4条指令；原选项完整保留，而特殊运行采用aura-v5/legal-frame-v1。
- 原始请求0/5/6/153只延迟一次至 **1/7/9/157**；追加来源请求仍为 **160**，实际开始帧依次1/7/9/157/160。
- 特殊三击为 **222/230/252**。逐个从正常结果入口进入独立计算器，恢复上下文相等，实际数值差为 **0/0/0**。
- 运行后全局配置仍等于原始配置；seed为 `lunar-worker-original-options-reference`。

本检查确认有限的线程与输入顺序合同，不重复验证整套月反应机制，也不扩大既有角色来源覆盖范围。
