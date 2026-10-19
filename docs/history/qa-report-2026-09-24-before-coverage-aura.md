# QA 与实测报告

更新：2026-09-24。本轮完成真实资源执行延迟、旧记录兼容，以及确定性周期实体／动作条件检查点。独立单击／单技能计算器保持主导航功能，不要求队伍或轮转。最终 goal 为完整主提示交付，仍进行中；未提交、推送或部署。

## 实际改动

执行方案新增 `1.1.0/runtime-energy-v1`，从共享模拟核心读取真实能量、暴击和种子下的接受／拒绝结果。缺能请求仍可有输入延迟，但不创建成功动画或冷却；动画自然结束后也不额外计算取消延迟。旧 `1.0.0` 保留原结构基线、取消假定及元数据，导入、预览与保存均不因同名预设自动升级。

一条基础种子的参考轨迹生成固定请求表，批次各轮使用该表，再按各自种子实际模拟。它不是每轮依照随机结果自适应操作。预览显示实际基线状态与选项，运行JSON保存原始输入、执行配置及 `fixed-reference-v1` 审计。导入后重新执行，不信任文件自报总伤害。界面验证发现保存轮转会重置手改种子，已修复：预览与运行使用同一选择。

准备阶段因需要完整模拟而移入既有 Worker：普通请求表预览、真实合法时间线预览和批次运行均可取消；月曜入口读取配置保持纯读取，基线在其 Worker 中执行，先使用原始配置和选项，再合并月曜副本的明确改动。追加来源动作继续使用用户明确指定的最终请求帧，不重复加延迟。

周期检查点直接导出实际活实体与被替换实体的引用关系、相对代次、取消任务及已排命中的历史取样；动作条件保留实际起手生命与锁定分支。排序来自同一队列的优先级与FIFO。没有后续影响的纯历史记录不参与状态比较；同HP但代次图、在途快照或分支不同不能判为同态。共用尾段计算覆盖最后可能执行的tick、延迟命中和粒子飞行。

主要代码为 `execution-profiles.ts`、`phase-checkpoint.ts`、`periodic-entity.ts`、`action-pending-horizon.ts`、`simulator.ts`、`simulation-analysis.ts`，以及网页 `app.ts`、`workspace-panels.ts`、`simulation-record.ts`、普通／月曜 Worker 接线。专项说明见[延迟核心](validation/execution-profile-runtime-baseline.md)、[周期检查点](validation/periodic-phase-checkpoint-core.md)、[页面验证](validation/profile-periodic-checkpoint-browser.md)。

## 实际执行检查

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/execution-profile-runtime-baseline.test.ts` | 首次3/3通过，1.10s，测试273ms，exit0 | [日志](validation/execution-profile-runtime-baseline-tests.log) |
| `npx vitest run packages/sim-core/src/__tests__/execution-profiles.test.ts` | 直接受影响的原3项首次通过，908ms，测试99ms，exit0 | [日志](validation/execution-profile-existing-tests.log) |
| `npx vitest run packages/sim-core/src/__tests__/periodic-phase-checkpoint.test.ts` | 首轮3项因夹具漏明确敌人位置失败，847ms；补齐夹具后仅复验同3项，通过958ms，测试179ms，exit0 | [首轮](validation/periodic-phase-checkpoint-core.log)、[复验](validation/periodic-phase-checkpoint-core-fixture-fix.log) |
| `npm run build` | 首轮TypeScript拒绝可选属性显式undefined；修正调用后全工程类型及327模块构建通过，337ms，exit0 | [首轮](validation/profile-periodic-checkpoint-build.log)、[复验](validation/profile-periodic-checkpoint-build-retry.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/profile-periodic-checkpoint.spec.ts` | 首轮周期流程通过646ms；延迟流程发现真实seed重置而失败，总3.5s、exit1 | [首轮日志](validation/profile-periodic-checkpoint-browser.log) |
| 修复seed保存后的 `npm run build` | 全工程类型及327模块构建通过，339ms，exit0 | [日志](validation/profile-seed-build.log) |
| 仅重跑上项失败的 `Execution profiles use the actual energy baseline` 页面流程 | 1/1通过，流程1.8s、总2.4s，exit0；已通过周期流程未重跑 | [定点复验](validation/profile-periodic-checkpoint-browser-seed-fix.log) |

新增核心6项及直接受影响的既有3项已有通过证据；两个新增页面流程分次通过。构建和测试耗时不是产品性能指标。首轮失败没有隐藏，也没有放宽数值断言。既有大chunk和无效动态拆分提示仍保留。月曜Worker的必要追加接线检查在下文记录。

## 实测结果

| 场景 | 实际结果 |
| --- | --- |
| 久岐忍初能0，原请求E1／换安柏51／换回300／Q564／换安柏565，实用延迟 | 新请求 `3,63,318,584,591`；Q584失败，随后换人仅加6帧，没有伪造4帧取消延迟 |
| 页面选择种子 | 导出原始输入、记录选项和基线选项均保持 `kuki-profile-energy-reference` |
| 旧1.0.0记录E1／换安柏100 | 导入、预览、保存仍为1.0.0，实际请求 `3,112`，不增加新baselineMode或新基线审计 |
| 西风核心受控场景 | 保留真实seeded-random设置，1帧触发／10帧收6能量并允许同帧Q；noCrit时Q失败，后续换人无伪取消 |
| 合成周期实体连续运行 | 120帧输入周期，9周期预热＋650帧尾段，总1730帧；真实建立period1，窗口 `[1080,1200)` 有2击、总伤650／DPS325 |
| 相位边界实体与任务 | 旧代次−1／活代次0；取消tick、旧命中、活tick、新命中分别剩余0／50／120／170帧。保留EM200取样、priority8及实际锁定条件 |
| 相同当前HP但不同历史 | 真实代次图、EM400旧取样／EM200新取样，以及治疗后满HP但起手40%／60%锁定分支均保持不同状态 |
| 长尾边界 | duration901、首次tick1000、伤害延迟230，尾段实际1230帧；12周期总2670帧。600帧截断输入明确不能证明完整状态 |

这些是显式合成／受控来源场景，不是全角色或全队验证。带附着、概率产球、随机暴击、普通随机回能、西风私有状态等场景仍有独立检查点阻塞；久岐忍来源情景没有因此被标成已建立完整稳态。

## 月曜 Worker 追加接线检查

`GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/lunar-profile-worker.spec.ts` 唯一新流程首次通过，流程1.1s／总1.5s，exit0。没有再构建、重跑旧矩阵或改变原数值断言。见[专项报告](validation/lunar-profile-worker.md)、[原始日志](validation/lunar-profile-worker-e2e.log)及[实际测量](validation/lunar-profile-worker-measurement.json)。

正常界面加载合成输入，基线保存未启用Aura的原配置及明确seed/configured/noCrit/legacy选项；用户在月曜副本中启用aura-v5/legal，导出保留两者区别。原四条命令只延迟一次至 `1,7,9,157`；新增月露涤荡保持明确请求160，实际三击为222／230／252帧。三击分别在独立计算器打开，复算差 `[0,0,0]`。点击读取配置新增Worker数0且普通结果身份不变；本次运行只启动一个月曜Worker。

最终本轮有6项新增核心、3项直接受影响既有核心，以及3项新增页面流程的通过证据；页面不是一次全绿，种子保存的真实首轮失败保留。`git diff --check` exit0、无输出，仅检查已跟踪差异，见[日志](validation/profile-periodic-checkpoint-diff-check.log)／[退出码](validation/profile-periodic-checkpoint-diff-check.exit)。

## 数据与剩余工作

本轮未修改目录或映射。`.15`仍为120身份／916命中／541完整条件动作／146部分／18具体阻塞，194武器／958合法精炼及53二件／44四件规则。完整条件动作不等于完整角色。

活动目录仍为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空，preview数0。发行观察仍为2026-09-23 14:22香港时间，本轮没有在线刷新或证据晋升。全角色生命周期、剩余装备自动触发、特殊反应冲突与范围、复杂附着／随机状态、可靠预览快照和广泛外部整队对照仍见[已知限制](known-limitations.md)。

未重跑旧全集、目录／数据状态、120秒性能或大型Monte Carlo。前轮久岐忍真实Q与外部同帧验证、独立计算器逐击复现差0等证据保存在[历史QA](history/qa-report-2026-09-24-before-profile-periodic-checkpoint.md)。性能只引用2026-09-23T06:42:28.209Z的[历史基准](cross-validation/simulation-execution-benchmark.md)，没有宣称本轮重测。
