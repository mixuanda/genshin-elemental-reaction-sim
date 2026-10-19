# QA 与实测报告

更新：2026-09-24。本轮将共享耐力纳入完整确定性相位检查点，优化独立计算器多段轨迹的DOM挂载，并修复数值框失焦吞掉展开点击的问题。完整goal保持进行中；独立单击／单技能仍无需队伍，未提交、推送或部署。

## 代码与正确性变化

`StaminaRuntime.captureBefore(tick)` 从实际运行时执行严格早于边界的恢复及扣除，保存独立状态；同帧事件尚未发生。九维检查点的资源部分加入 `shared-stamina-state-v1`：实际共享量、相对恢复时间、恢复基线及帧数；待处理部分保存全部延迟费用、真实接受命令、来源、角色、相对时间和队列顺序。没有耐力模型时旧形状不变，缺少实际资源状态仍不能生成完整证明。观察尾段覆盖费用延迟，完整状态比较不忽略恢复或待扣差异。

计算器仍立即求值全部选定命中，完整审计及报告保留全部轨迹。折叠的多段卡片在展开时从同一个 `currentResult` 挂载详情，不重新计算；单击默认完整显示。重新编辑保留已展开卡片和步骤，公式、变量、实际代入与结果均更新。数值输入已经在input事件校验并计算，因此删除烟绯／一斗／诺艾尔多余的change刷新，避免失焦时替换下一点击目标。

主要代码为 `packages/sim-core/src/stamina.ts`、`phase-checkpoint.ts`、`simulator.ts`、`simulation-analysis.ts` 与 `apps/web/src/calculator-ui.ts`。本轮不改角色、武器、圣遗物数据映射，也未增加独立UI伤害公式。

## 实际执行的检查

| 命令 | 结果 | 原始证据 |
| --- | --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/stamina-phase-checkpoint.test.ts` | 新3项首次通过，833ms／测试46ms、exit 0 | [日志](validation/stamina-phase-checkpoint-test.log)、[退出码](validation/stamina-phase-checkpoint-test.exit) |
| `npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts -t 'rejects only'` | 旧耐力受影响项1通过2跳过，900ms／测试103ms、exit 0；短轨迹仍按真实尾段不足阻塞 | [日志](validation/stamina-phase-checkpoint-existing-followup.log)、[退出码](validation/stamina-phase-checkpoint-existing-followup.exit) |
| 新文件仅 `-t 'establishes a continuous'` | 补充390帧长尾分支后只复验首项，1通过2跳过，834ms／测试54ms、exit 0 | [日志](validation/stamina-phase-checkpoint-tail-followup.log)、[退出码](validation/stamina-phase-checkpoint-tail-followup.exit) |
| `npx vitest run packages/sim-core/src/__tests__/phase-checkpoint-runtime-state.test.ts -t 'establishes a real legal periodic'` | 旧无耐力模型的召唤／扣能／转换周期1通过2跳过，832ms／测试89ms、exit 0 | [日志](validation/stamina-phase-checkpoint-legacy-followup.log)、[退出码](validation/stamina-phase-checkpoint-legacy-followup.exit) |
| `npm run build` | 首次exit 0；全工程TypeScript及302模块生产构建，330ms | [日志](validation/render-checkpoint-build.log)、[退出码](validation/render-checkpoint-build.exit) |
| 浏览器发现失焦问题后再次 `npm run build` | exit 0；302模块、335ms，包含最终生产修复 | [日志](validation/render-checkpoint-build-input-fix.log)、[退出码](validation/render-checkpoint-build-input-fix.exit) |
| 4条受影响页面流程 | 首次1过3失败，总36.0s、exit 1；刻晴／行秋16.2s通过 | [日志](validation/render-checkpoint-e2e.log)、[退出码](validation/render-checkpoint-e2e.exit) |
| 仅3失败条第一次复验 | 收集阶段exit 1，未执行测试；Playwright不支持describe级worker追踪选项 | [日志](validation/render-checkpoint-e2e-retry.log)、[退出码](validation/render-checkpoint-e2e-retry.exit) |
| 仅3失败条第二次复验 | 3/3通过，exit 0、总5.0s；教学A789ms、凝光2.0s、烟绯4.2s | [日志](validation/render-checkpoint-e2e-retry2.log)、[退出码](validation/render-checkpoint-e2e-retry2.exit) |

首次浏览器失败分别是：教学A的旧summary定位器同时匹配步骤与内嵌来源；烟绯fill后直接点击因blur/change重复重绘丢失原生展开；凝光全流程仍受大量审计DOM快照拖累，耗尽30秒。定位器只限定至步骤直属summary；烟绯修生产事件处理，测试保留直接点击且不加Tab绕过；凝光保留全部数值、键盘、轨迹、JSON断言和默认30秒，仅所在文件追踪设置 `retain-on-failure / snapshots:false`。同文件耐力逻辑未改，本轮未重跑。

最终四条均有通过结果，但不能合称一次首次全通过。已过刻晴／行秋没有重跑，最终生产只增加数值输入分支修复，不改变其上下文或计算。浏览器命令使用 `GIDPS_PREBUILT=1`、4173生产预览，完整grep范围和每次命令见[浏览器记录](validation/render-checkpoint-browser.md)。没有旧全集、大型Monte Carlo、数据生成／检查或外部gcsim重跑。没有将构建通过当成游戏机制验证。

## 实测状态与数值

共享耐力合成周期为120帧，初始240、每周期F1输入，费用12.5在输入后150帧扣除。9周期真实连续预热后建立周期1：边界共享量227.5、恢复还需2帧、待扣还需31帧。周期内30个恢复帧补回 `30×25/60=12.5`。两秒观察伤害427.5、DPS213.75，手算 `1000×190/(190+210)×0.9=427.5`。

把延迟改为390帧后，真实运行到 `1080+390=1470` 帧，观察end1200不变；边界保留三项剩余31／151／271帧的待扣费用、输入年龄359／239／119帧及相对顺序。仍建立周期1，伤害不变。相同共享量但恢复时钟21／31帧不同，或待扣时间不同，均不能视作等价周期；边界同帧任务保留，后来执行不改先前快照。完整适用范围及来源见[专项](validation/stamina-phase-checkpoint.md)。

独立计算器四条验证包括：教学A固定算术及显示与AST一致；刻晴／行秋的条件记账、完整／单击JSON；烟绯概率贡献和编辑后直接展开；凝光折叠卡片不先挂载详情、Enter展开后每个节点的值／公式／代入等于完整audit、关闭重开不重复挂载、展开步骤编辑后仍显示当前0.12 A4贡献，以及完整／单击JSON。凝光原十二击总期望10401.2856与历史单击611.24184继续通过。

## 页面探针：纠正旧计时解释

只做同一生产操作改前／改后各一次，命令分别为 `node docs/validation/calculator-render-probe.mjs before` 和 `... after`，均exit 0。Playwright DOM快照关闭，CPU profiler开启；这是诊断样本，不是重复性能基准。

| 项目 | 改前（UTC 17:52:10.647） | 改后（UTC 18:01:48.300） |
| --- | ---: | ---: |
| 一次十二击历史面板应用 | 83.556209ms | 79.802208ms |
| 结果容器元素数 | 23079 | 573 |
| 结果HTML字节 | 4004079 | 2580389 |
| 命中卡片数／总期望 | 12／10401.2856 | 12／10401.2856 |

日期均为2026-09-23 UTC，对应本地9月24日。原始[改前](validation/calculator-render-before.json)／[改后](validation/calculator-render-after.json)保留CPU归因及`.cpuprofile`，可用[同一探针](validation/calculator-render-probe.mjs)复现。DOM结构减少是直接测量；两次单样本的毫秒差不能证明统计提速。前轮约5秒记录包含Playwright大量DOM快照开销，不能当成用户实际等待；本轮2秒E2E也不能与旧39.4秒作为产品速度对比。

## 当前边界与历史

覆盖仍为120身份／880命中／537完整条件动作／149部分，194武器／958合法精炼及53二件套／44四件套。目录仍7.1 released/provisional，正式已验证数据集为空；7.2 V1可靠快照缺失，preview数0。上述源自上一轮实际生成，未在本轮重测。最新来源发布观察仍为2026-09-23 14:22香港时间。

耐力状态完成不等于全角色费用、动态减耗、特殊移动或随机稳态完成。普通回能／西风随机私有状态、Aura、插件和目标时钟等原有周期阻塞保留；有限提供的周期输入之外不宣称稳态。完整角色／装备与其余特殊反应范围仍见[已知限制](known-limitations.md)。大型完整审计文本仍有初始体积，所有命中都已即时计算；本轮未改为分批或Worker计算器。

[上一轮QA](history/qa-report-2026-09-24-before-render-checkpoint.md)保留其真实命令和失败。120秒模拟性能仍引用2026-09-23T06:42:28.209Z的[历史实测](cross-validation/simulation-execution-benchmark.md)：269事件、2预热12计时，trace关闭30.500ms／p9533.336ms，开启129.735／148.481ms，随机29.397ms／34.01次每秒；不作为本轮新增周期捕获的性能结论。

环境Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10及Playwright Chromium；构建仍提示大chunk和无效动态拆分，未进行无关重构。

本轮 `git diff --check` 首次exit 0、无输出；仅检查已跟踪差异。[日志](validation/render-checkpoint-diff-check.log)、[退出码](validation/render-checkpoint-diff-check.exit)。
