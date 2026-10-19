# 当前执行选项性能实测

采集：2026-09-23T06:42:28.209Z。命令：`node docs/cross-validation/run-simulation-execution-benchmark.mjs`（exit 0）。每场景预热 2 次、实测 12 次，再作一次未计时的首种子完整结果重放。机器信息、逐次耗时、逐击随机结果和实际源码哈希见 [JSON](./simulation-execution-benchmark.json)。

本报告追加当前证据；[旧报告](./simulation-benchmark.md)仍保存原先没有 execution 选项时的历史结果，旧报告中的“不支持关闭轨迹/随机暴击”不是当前能力描述。本次未运行旧 30 轮 benchmark。

环境：Apple M5 Max / arm64 / Node v24.15.0。没有隔离全机其他负载。三个场景共享同一 120 秒 provisional 杜林样例；为检验暴击资格，统一将 `nicole-e` 的第 0 个命中定义设为 `critEligible:false`，其余输入不变。此改动会影响跨周期重复命中，不能与未改动旧基准的总伤害直接比较。

| 场景 | 中位数 ms | p95 ms | 次/秒 | 伤害事件 | trace记录 / 节点 | 首轮结果 JSON bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| average-traces-off | 30.500 | 33.336 | 32.24 | 269 | 0 / 0 | 3238548 |
| average-traces-on | 129.735 | 148.481 | 7.56 | 269 | 269 / 4842 | 8062863 |
| random-crit-traces-off | 29.397 | 30.913 | 34.01 | 269 | 0 / 0 | 3235861 |

p95 为 nearest-rank；12 个样本时等于最大值。这里是墙钟耗时分布，不是伤害分位数或均值置信区间。计时含完整 `simulate()` 的计算、capture 和完整性验证，排除序列化、结果核对、I/O、浏览器和 Worker 传输。

**真实 detailedTraces 开/关：**两者均 `captureHits:true`。关闭模式的逐击 trace 记录及节点确实为 0；开启模式每击均有 trace。所有确定性轮次以及两种模式之间的总伤害、完整 damageEvents 字节一致，总伤害为 41311255.251386814。关闭逐击解释仍保留完整事件、快照、反应/回调/Aura/目标/能量审计、精确命中输入和 schema 校验，因此耗时不代表“全日志关闭”。本次未请求阶段检查点，也不验证稳态覆盖。

**实际随机暴击：**使用 `criticalSampling:'seeded-random-v1'`，每次以 `simulation-execution-benchmark-2026-09-23:iteration:i` 为种子；独立暴击流追加 `:critical-hit-v1`，经 FNV-1a32 后执行 Mulberry32。命中按 `roll < clamp(CR,0,1)` 取结果。每轮实测 263 次抽样，6 个不具资格命中不抽样；每轮均观察到暴击和未暴击，12 个种子得到不同总伤害，范围 40421145.38364142–42019228.08279395。首种子完整结果重放字节一致；所有逐击 roll、drawIndex、资格和结果均存入 JSON 并检查。

该随机验证只覆盖伤害是否暴击，不涵盖暴击触发被动、祭礼/西风等装备反馈、能量和角色后续状态。未将 12 次吞吐样本冒充收敛的伤害分布或均值置信区间。该报告只证明记录哈希对应源码快照的本机观测。
