# 模拟核心性能实测

> 历史快照：以下记录采集于 2026-09-22，当时尚无执行选项。当前真实 detailedTraces 开/关与随机暴击实测见 [后续报告](./simulation-execution-benchmark.md)；以下 unsupported 描述仅适用于原始快照，原始数值未改写。

采集时间：2026-09-22T15:01:02.315Z。命令：`node docs/cross-validation/run-simulation-benchmark.mjs`。原始逐次耗时、输出摘要、环境和源文件 SHA-256 均见 [simulation-benchmark.json](./simulation-benchmark.json)。

环境：Darwin 27.0.0 Darwin Kernel Version 27.0.0: Tue Aug 11 21:06:40 PDT 2026; root:xnu-13432.1.9~1/RELEASE_ARM64_T6050 / arm64 / Apple M5 Max / Node v24.15.0，18 逻辑处理器。HEAD：`84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`；报告仅证明该采集时间及所列源文件哈希对应的被测快照，后续工作区修改须重新执行；工作区实施代码可能尚未提交。独立 Node 进程运行，未隔离全机其他开发进程，因此数值是本机观测值，不是跨设备保证。

每个场景预热 3 次，计时 30 次。计时覆盖完整 `simulate()`（含轨迹生成和完整性校验），排除 Vite 模块加载、结果序列化、重放比对、浏览器渲染、Worker 传输及报告写盘。p95 为 nearest-rank；偶数样本中位数取中间两项均值。这里的分位数仅描述墙钟耗时分布，不是伤害分布分位数，也不是均值置信区间。

| 场景 | 中位数 ms | p95 ms | 最大值 ms | 次/秒 | 伤害事件数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| deterministic-120s-durin-demo | 28.951 | 30.792 | 36.100 | 34.27 | 269–269 |
| seeded-particle-120s-energy-demo | 5.429 | 6.651 | 7.121 | 177.46 | 2–2 |

- 确定性场景使用原始 120 秒 `durinMeltPreset`。全部 30 次完整 JSON 字节一致，并另行重放第一个种子。总伤害 41410555.13728799，DPS 345087.9594773999。
- 回能场景把 `particleEnergyDemoPreset` 的 duration 和 cycleLength 都设置为 120，与现有性能测试一致：120 秒窗口内只有一次合法指令序列，不可宣称为持续 120 秒高密度回能压力。每轮种子为 `simulation-benchmark-2026-09-22:iteration:i`（i 从 0 起）。实测粒子数量覆盖 2 / 3 / 4，每轮伤害事件数 2–2；完整种子重放一致。该预设不同掉球数未必改变总伤害，具体各轮输出已存档。
- 种子经 FNV-1a 32-bit 散列后输入 Mulberry32。两个场景均确认没有结晶碎片或草原核位置采样；当前引擎在其他场景还会采样这些空间位置。暴击模式为 `average`，属于解析期望，不是随机暴击或暴击反馈 Monte Carlo。
- **trace-disabled：unsupported。** 当前 SimulationOptions 没有关闭轨迹的选项，故不存在实测开/关轨迹比较。先产生完整结果再丢弃轨迹不能当作关闭轨迹。也未将 Node 核心耗时冒充浏览器 Worker 吞吐。
- 两个预设都标注 provisional；这些数字证明特定负载的实际性能与重复性，不证明正式游戏角色数据或全部机制已验证。
