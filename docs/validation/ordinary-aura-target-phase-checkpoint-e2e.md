# 原生 Aura v9 与 target-phase-v2 检查点：浏览器实测

日期：2026-09-24。使用主任务统一构建后的生产预览 `http://127.0.0.1:4173`，没有启动或重启服务。

实际执行命令：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/ordinary-aura-target-phase-checkpoint.spec.ts --reporter=line --output=test-results/ordinary-aura-target-phase-checkpoint
```

首次 **1 passed (1.8s)，exit 0**。完整输出见 [ordinary-aura-target-phase-checkpoint-e2e.log](ordinary-aura-target-phase-checkpoint-e2e.log)，退出码见 [ordinary-aura-target-phase-checkpoint-e2e.exit](ordinary-aura-target-phase-checkpoint-e2e.exit)。仅执行这一新流程；没有重试、旧流程重跑、Monte Carlo 或独立构建。输出中的 `NO_COLOR` / `FORCE_COLOR` 为终端颜色环境警告。

## 实际通过的流程

通过正常 JSON 导入明确标为合成的合法帧情景：原生 **aura-v9 + target-phase-v2**，目标时钟关闭。没有把配置转换成旧 Aura 或旧目标任务模式。两秒周期中 Hydro@0、Pyro@108，ATK1000、L90/90、零抗性，原始实际伤害为 **500 + 750 = 1250**，108f 的目标阶段日志确为 `target-phase-v2`。

在页面分析入口执行八周期连续预热并导出完整分析 JSON，验证：

- 模型和目标时钟配置保持不变。观察窗口 **[960,1080)f**，总伤 **1250**，DPS **625**，周期 **1**，结果为 `steady-state-established` / `established-from-simulation`。包括未来驱动审计尾段的完整运行共 **1200f**，预热行动 16 次。
- 五个完整检查点位于 480、600、720、840、960f，状态逐项相同，`checkpointCoverage.complete=true`，没有缺失维度或阻塞原因。
- 每个检查点的真实 Aura 保留 `mode=aura-v9`、`reactableTickModel=cached-boundary-v2`、空的实际生命周期缓存和 12f 物化年龄。水元素量为 `0.8 − 108 × (0.8/570) − 0.5`，每帧衰减为 `0.8/570`；来源槽的角色为 `a`，元素量一致。
- 实际附着 ICD 保留剩余 48f、窗口年龄 12f、下一命中序号 1；直接伤害组保留剩余 17f、窗口年龄 12f、下一命中序号 1。
- `pendingEvents.targetPhase` 实际导出 `model=target-phase-v2` 以及 `scheduledDecay=[]`、`completedDecay=[]`、`phases=[]`。此正常循环的事件前边界没有未来衰减任务；并非用占位空数组替代状态。非空任务、真实 FIFO 与缺失任务的区别由本轮[针对性核心验证](ordinary-aura-target-phase-checkpoint-core.md)覆盖，本浏览器流程没有重复运行它们。
- 长轨迹的所有火命中均实际发生反向蒸发，没有跳过行动。返回原始两秒结果中的 750 伤害火命中，经“打开独立计算器”复现差值为 **0**；两处全部可见公式行与细节一致，命中导出保留对应完整原始模拟结果。分析长轨迹与原始命中结果的身份保持分开。

本流程仅证明已声明普通水火闭合域、关闭目标时钟时的集成结果。没有认证其它反应生命周期、目标时钟、target-phase-v1/v3、特殊反应注入或随机状态已经具备完整确定性稳态检查点。
