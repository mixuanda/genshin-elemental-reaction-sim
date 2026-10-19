# 来源执行器随机策略回执

2026-09-28。本批为 classic b4 与 stellar a7 补充来源随机策略回执，并验证批量样本拒绝重复初始化流。记录反映固定来源实现及种子转换，不是游戏验证或随机稳态证明。

## 种子身份与采样策略

请求将十进制 `uint64` 种子转换成 Go `int64`，再交给固定 toolchain 的 `math/rand/rngSource.Seed`。归一化规则为：对 `2147483647` 取有符号余数；负数加回该模数；余数为零时替换为 `89482311`。所以不同文本种子可能初始化相同的 Core.Rand 流：`1` 与 `2147483648` 都得到 `1`；`0` 与 `89482311` 都得到 `89482311`。`uint64` 最大值在 stellar 路径转成 signed `-1`，再归一化为 `2147483646`。

`source-host-randomness-v1` 回执保存原始、signed、effective seed，算法与归一化版本、Go 版本，以及 `critPolicy=native-seeded`、`criticalTriggeredEffects=native-sampled`、`otherRng=native-sampled`。旧结果没有原生回执时，界面将实际暴击触发效果及其他随机事件的来源采样情况标为未知；同时只按固定算法推导并展示种子初始化映射，不把推导值说成旧运行的原生回执。导入与计算器上下文会校验并保留已有元数据。

多种子能量与起步分析按 effective seed 拒绝初始化到同一随机流的样本；导入的旧统计样本即使没有原生随机回执，也按其种子文本推导并拒绝别名。界面说明：不同初始化流不等于数学上独立的输出；零能与满能对照使用相同初始化流，但起始状态差异会改变随机数消耗顺序。来源结果界面显示原始种子、int64 转换值与实际初始化值。

固定源码审计检查两版入口与生产 `math/rand` 调用：入口解析 uint64 后传给 `simulation.NewCore`；模拟抽样使用注入的 `core.Rand`，包括随机几何、仿真统计、战斗选择及配置的能量／受伤事件。未发现模拟时调用 package-global `math/rand` 的路径，因此本批没有添加全局 RNG 路由补丁。源码依据见[审计回执](validation/source-host-rng-policy-20260928.md)。

## 实现入口

种子归一化与重复流校验位于 [`source-host-randomness.ts`](../packages/sim-core/src/source-host-randomness.ts)；原生回执由两版 [`rng_policy.go`](../packages/source-host/go/cmd/sourcehost/rng_policy.go) 与 [stellar overlay](../packages/source-host/stellar-overlay/go/cmd/sourcehost/rng_policy.go) 产生，并随 [`source-host-wire.ts`](../packages/sim-core/src/source-host-wire.ts)、[`source-host-capture.ts`](../packages/sim-core/src/source-host-capture.ts) 和 [`source-host-reexecution.ts`](../packages/sim-core/src/source-host-reexecution.ts) 的结果／命中上下文保留。运行 worker 接口在 [`source-host-worker.ts`](../apps/web/src/source-host-worker.ts)；结果种子回执见 [`source-host-panel.ts`](../apps/web/src/source-host-panel.ts)，样本入口与摘要分别由 [`source-host-batch.ts`](../apps/web/src/source-host-batch.ts)、[`source-host-startup-analysis.ts`](../apps/web/src/source-host-startup-analysis.ts) 和 [`source-host-startup-panel.ts`](../apps/web/src/source-host-startup-panel.ts) 接入。

## 页面与构建结果

聚合页面执行三次，每次含 5 个伤害应用。classic 种子 `1` 与 `2147483648` 的 effective seed 相同，二者的 `applications` 与 `energyApplications` 完全相等；多种子与起步入口均拒绝 `1,2147483648` 和 `0,89482311`。stellar 使用最大 uint64，回执为 signed `-1`、effective `2147483646`；导入／导出、计算器上下文中的 RNG 元数据一致，选定命中重放差 0，`pageErrors=[]`。详细字段见[浏览器回执](validation/source-rng-policy-browser-20260928.result.json)。

| 检查 | 最终结果 |
|---|---|
| classic 来源构建 | 5.853 秒；WASM SHA-256 `35548a34a9ce33367ebc13a53d53bafccd44f84392ebf2a76f866a408c1333fc`，44,496,857 字节 |
| stellar 来源构建 | 6.365 秒；WASM SHA-256 `36b833e9ac379a89346d3c3e61c2a1866ac6e115d96e25f80de39c801b9235b3`，66,059,562 字节 |
| 聚焦单元 | 3 文件、7 项通过，96ms；命令和结果见[测量记录](validation/source-rng-policy-measurements-20260928.json) |
| Web | 首次因 `exactOptionalPropertyTypes` 下可选 `randomness` 类型不兼容失败；修正类型后最终构建通过，18.056 秒，Vite 4.00 秒 |
| 聚合页面 | 1 项通过；用例 12 秒、墙钟 16.138 秒；public 与 dist WASM 身份匹配 |

public 与 dist WASM 和页面回执中的 SHA 一致。数据指针 SHA `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`、runtime-current SHA `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045` 均未改变。完整命令、首轮失败与构建身份见[测量 JSON](validation/source-rng-policy-measurements-20260928.json)。

本批确认种子映射、重复初始化流拒绝和结果上下文保存；未修补全局随机数路径，也未证明随机输出分布、样本数学独立或角色机制正确。未扩跑角色全矩阵、未激活新数据集，全量 goal 仍 active。
