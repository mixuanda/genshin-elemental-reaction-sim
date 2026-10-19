# QA 与实测报告

更新：2026-09-24。本轮完成烟绯独立重击及条件追击、14个条件 E/Q 动作和有限随机起步诊断。独立单击／单技能入口仍无需队伍或轮转。只执行本轮必要检查，未提交、推送或部署；完整 goal 保持进行中。

## 整合检查

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm run data:status` | 首次 exit 0；120身份／856命中／534完整条件动作／149部分／18具体阻塞；装备194武器／958合法精炼、53二件套／44四件套 | [日志](../validation/yanfei-startup-data-status.log)、[退出码](../validation/yanfei-startup-data-status.exit) |
| `npm run data:check` | 首次 exit 0；历史目录可复现，活动7.1投影、圣遗物来源哈希一致 | [日志](../validation/yanfei-startup-data-check.log)、[退出码](../validation/yanfei-startup-data-check.exit) |
| `npm run build` | 首次 exit 0；全工程 TypeScript 和 Vite 生产构建通过，289模块、338 ms | [日志](../validation/yanfei-startup-build.log)、[退出码](../validation/yanfei-startup-build.exit) |
| 新增两个浏览器流程 | 首次2/2通过，exit 0，6.7 s；烟绯4.9 s，随机诊断783 ms | [日志](../validation/yanfei-startup-e2e.log)、[退出码](../validation/yanfei-startup-e2e.exit)、[逐项记录](../validation/yanfei-startup-e2e.md) |

浏览器命令为 `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/yanfei-startup.spec.ts`，复用4173生产产物。未重跑旧浏览器文件或修改断言来消除失败。发布校验脚本已纳入新文件；远端 CI 尚未执行或配置必需检查。

## 来源与核心定点检查

以下是各自独立执行记录，不能合并冒充一次全套测试。

| 检查 | 实际结果与修正 |
| --- | --- |
| `npx vitest run packages/game-data/src/character-mappings/sourced-conditional-skill-mappings.test.ts` | 首次1/1通过，1.31 s、测试58 ms；归档43文件哈希、300个T1–15数值及14动作25击的实际共享计算。[来源与数值](../cross-validation/conditional-skills-source-audit.md)、[日志](../validation/conditional-skills-source-test.log) |
| `npx vitest run packages/sim-core/src/__tests__/calculator-yanfei-charged.test.ts` | 首次3/3通过，1.17 s、测试54 ms；7源文件哈希与90个数值、概率归属、两段独立条件、最终面板及JSON。[完整记录](../validation/yanfei-charged-calculator.md)、[日志](../validation/yanfei-charged-core.log) |
| 烟绯突破未知修正后，仅 `-t 'checks C6 seal limit'` | 1通过、2跳过，1.16 s、测试38 ms；未知突破分别阻塞主击、A4和整次，不能当明确未解锁。[日志](../validation/yanfei-charged-core-unknown-ascension.log) |
| 烟绯最终暴击率覆写修正后，同一定点项 | 1通过、2跳过，1.19 s、测试38 ms；明确覆写保持0.5，改C2生命条件不推断其组成；清空覆写才按来源得0.7。[日志](../validation/yanfei-charged-core-final-override.log) |
| `npx vitest run packages/sim-core/src/__tests__/stochastic-startup.test.ts` | 首次2通过、1失败，922 ms、测试120 ms；两项真实连续模拟首轮通过。统计手算的等价运算顺序相差约3×10⁻¹⁶，测试误用严格相等。[日志](../validation/stochastic-startup-core.log) |
| 随机统计只复验 `-t 'separates empirical spread'` | 1通过、2跳过，800 ms、测试3 ms；改为14位近似断言，生产统计公式不改，没有重跑已过模拟项。[日志](../validation/stochastic-startup-core-recheck.log)、[政策及NIST来源](../validation/stochastic-startup-core.md) |

烟绯首轮通过后的两次定点检查由实际生产语义修正触发。各自原日志／退出码均保留，不以最后结果覆盖首次记录。本轮没有执行旧单元全集、大型 Monte Carlo、外部 gcsim 或性能复测。

## 实际数值和验收边界

- 烟绯：双方90级、10%火抗、ATK1000、CR0.5、CD1、普攻T1、三印、A1/A4解锁且灼灼无效。主击倍率1.502332，非暴击777.45681；A4实际非暴击414、自身期望621，但整次期望贡献仅310.5。整次非暴击777.45681、全暴击2382.91362、期望1476.685215。单击模式独立选A4则显示621，不再次乘触发概率。
- 烟绯C2：主击前目标生命0.5、A4前0.49，暴击率分别0.5／0.7，A4整次期望贡献351.9。浏览器还实际修改面板CR、旧A1已含量、独立Q1／Q10和两段灼灼开关，验证JSON往返后总伤及完整逐段轨迹相同。
- 条件 E/Q：ATK2000、双方90级、10%对应抗性、无增伤和反应，北斗两层3974.4；班尼特二段蓄力三击2844；锅巴四口4006.08；凝光无屏六枚4695.84。属于共享核心的条件数值，不是实战DPS测量。
- 随机诊断：合成2秒周期、4秒观察、W=1、N=2，共4次真实连续8秒轨迹。零起步Q成功122／362帧、失败2／242帧；窗口起末能量分别3／3和0／0，满起步为0／0和3／3。每窗2次耗能请求、1次失败；无请求的后台角色失败率为null。单Q仅可能427.5或641.25；浏览器独立手算每组分位数、样本标准差、df=1的t=12.706均值区间和4个同种子配对差值，并从实际导出JSON核对。
- 有限诊断保留真实状态，W／2W可重叠；配对差先逐seed计算，均值区间与单次分布分栏。区间含零不宣称没有起步差异，更不证明随机稳态。源动作合法性门和未完成特殊机制仍可阻止诊断。

数据仍为 released/provisional，当前正式验证数据集为空；856命中和534完整条件动作不是全量角色或团队就绪数量。来源快照时点、完整技能生命周期及预览缺失继续保留，不为通过率填值。

## 历史与性能

[上一轮一斗／确定性检查点QA](../history/qa-report-2026-09-24-before-yanfei-startup.md)保留当时失败、修复及首次通过结果。更早诺艾尔外部六击残差0和105.67709476067012总伤属于原时点测量，不冒充本轮重测。钟离旧报告面板笔误已更正：实际ATK2000／HP20000对应887.4，突破三387；未为文字勘误重跑测试。

[既有性能证据](../cross-validation/simulation-execution-benchmark.md)固定于2026-09-23T06:42:28.209Z：120秒、269事件，2预热／12计时；trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms，随机关闭trace中位29.397 ms、34.01次/秒。本轮没有重测，不宣称新代码全负载达到100 ms。

环境为Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10及Playwright Chromium。构建仍提示大chunk和无效动态拆分；没有为本轮扩展增加推测性的防御层。

本轮 `git diff --check` 首次exit 0、无输出，只检查Git已跟踪差异；见[日志](../validation/yanfei-startup-diff-check.log)和[退出码](../validation/yanfei-startup-diff-check.exit)，不据此宣称所有未跟踪文件已审阅。完整未完成范围见[已知限制](../known-limitations.md)。
