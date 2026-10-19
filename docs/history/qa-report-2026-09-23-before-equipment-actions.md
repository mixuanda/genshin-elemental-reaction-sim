# QA 与实测报告

更新：2026-09-23。本批为三类Lunar／草核共享执行、奈芙尔条件纠正、逐击精通、武器条款和完整启动日志的本地增量。未提交、推送或部署。只执行新增行为与实际受影响用例、数据检查、统一构建及三项新浏览器流程；没有重跑旧全集或性能矩阵。

## 当前整合检查

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | exit 0；120身份／676命中，406完整条件动作／146部分／18阻塞；192武器／948合法精炼，53二件套／44四件套 | [状态](../validation/dendro-data-status.log)、[退出码](../validation/dendro-data-status.exit) |
| `npm run data:check` | exit 0；历史目录复现、活动7.1投影、生成覆盖与来源哈希一致 | [数据检查](../validation/dendro-data-check.log)、[退出码](../validation/dendro-data-check.exit) |
| `npm run build` 首次 | exit 1；mixed-v2运行时taskId联合、其新测试atFrame联合，以及装备新测试可选characterId共三处类型收窄问题 | [首次构建](../validation/dendro-build.log)、[退出码](../validation/dendro-build.exit) |
| 类型修正后 `npm run build` | exit 0；全工程TypeScript与生产构建通过，253模块，Vite335 ms | [构建](../validation/dendro-build-rerun.log)、[退出码](../validation/dendro-build-rerun.exit) |
| 新增浏览器首轮 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/dendro-increment.spec.ts`，2通过／1失败，40.6 s、exit 1；数值通过，mixed回放操作因测试未展开父级details超时 | [首轮](../validation/dendro-increment-e2e.log)、[退出码](../validation/dendro-increment-e2e.exit) |
| 仅复验浏览器失败项 | 补父级summary展开，`--last-failed` 仅运行mixed，1/1通过，7.9 s、exit 0；本批三项均已通过 | [复验](../validation/dendro-increment-e2e-rerun.log)、[退出码](../validation/dendro-increment-e2e-rerun.exit)、[详细证据](../validation/dendro-increment-e2e.md) |

三处修复分别是按实际字段识别已定义的能力任务、完整构造原有154/155帧swap/charge命令，以及仅有值时传入可选角色ID。没有改变生产数值规则或放宽schema。已通过的单元没有为这些类型修正重跑。

三项浏览器使用固定4173生产产物。奈芙尔正常命座／精通控件、C2/C4数值、真实重新配装及最终面板／JSON相等首轮通过（6.1 s）；启动场景实际120成功行动、60失败耗能请求、60能量记录，翻页到末条并核对完整导出和窗口边界，首轮通过（2.6 s）。mixed首轮已通过实际分项、队列、草核和资源数值，测试漏展开父级面板；只补正常summary点击后复验通过（用例7.3 s），从同一运行恢复Hyperbloom及全部七个特殊命中。没有为此改生产结果，也没有重跑前两项。

## 本批定向检查

各行是独立命令的实际结果，不合并冒充一次完整套件。工具转录与原始日志分别标明。

| 范围 | 实际结果与证据 |
| --- | --- |
| 112把新增武器 | `npx vitest run packages/game-data/src/equipment-weapon-expansion.test.ts` 首轮130通过／1失败，1.13 s；失败为0.7000000000000001与0.7深相等。只改该断言为容差，再以 `-t 'executes new ordinary and reaction terms'` 复验1通过／130跳过，1.05 s。包含548合法精炼、318源哈希、条件与标签、R1限制、真实配装／JSON／最终面板；[记录](../weapon-expansion-implementation.md) |
| 奈芙尔普通条件 | `nefer-ordinary-context.test.ts` 首次4/4通过，1.14 s；随后新增导入条件仅筛选1/1通过、4跳过，1.11 s；[来源与命令](../cross-validation/nefer-ordinary-context.md)、[原日志](../validation/nefer-ordinary-context.log)、[导入日志](../validation/nefer-import-accounting.log) |
| 逐命中精通 | `calculator-hit-elemental-mastery.test.ts` 1/1首次通过，189 ms；不同段状态、缩放／反应、JSON与最终面板。随后实际装备交互新文件 `calculator-hit-em-equipment.test.ts` 1/1首次通过，1.09 s；旧快照保留、相关实时转换才阻塞、已含最终精通无需历史分解；[完整转录](../validation/per-hit-elemental-mastery-20260923.md) |
| 三类月曜与草核共享 | `npx vitest run packages/sim-core/src/__tests__/lunar-mixed-v2-simulation.test.ts` 3/3首次通过，1.78 s（测试体981 ms）；真实反应顺序、草核／Hyperbloom、三类月曜、资源、同帧边界及全部普通／特殊命中恢复；[记录](../lunar-mixed-v2-simulation.md) |
| 受影响草露／独立月绽放 | 3文件仅执行受影响7项，全部通过、8项未运行，1.38 s（测试体328 ms）；一次执行，无旧全集；[确切命令与源码时序](../research/lunar-mixed-v2-source-evidence.md) |

奈芙尔旧来源测试为纠正E作用范围及扩展命座调整了预期，但本批未重复运行这些旧文件，不列为本批新通过。武器首轮失败无需修改生产算术。

## 数值与纠错

- 三类混合合成输入由同一次运行得到：普通 **23110.385481818183**＋月感电 **5992.856862332142**＋月结晶 **11398.06384097143**＋月露涤荡 **4066.8554115**＝**44568.16159662175**。8帧真实原激化后绽放任务，38帧生成两核；116帧两个Hyperbloom各9588.692740909091。草露155帧取得、215帧消费，直接三击222/230/252帧。见[输入](../fixtures/lunar-mixed-v2-reference.synthetic.json)与[实测预期](../fixtures/lunar-mixed-v2-reference.synthetic.expected.json)。
- 草露固定源码先执行玩家生产、后执行全局窗口刷新；无旧活跃窗口时首次有效累计F+2、首枚F+147。现行独立LB示例首枚由错误152修正153；160起手、215消费、222/230/252三击和总伤6209.86653不变。旧数值捕获仍可复算，不声称旧时序正确。
- 奈芙尔普通初始E不使用幻戏帷幕乘区。ATK2000、EM100、有效E10、额外基伤500、双方90级、抗性10%：旧错误1912.8419712纠正为 **1586.16288**。
- 奈芙尔有效Q10、ATK2000、原面板EM100、月兆2：C2消费5层且200EM有效为 **35481.888**；EM失效为 **30023.136**；消费0但EM仍有效为 **11827.296**；C4目标减草抗有效为 **41395.536**。精通、消费层数和减抗均为实际命中条件，未模拟这些状态的自动生命周期。

这些是固定来源、显式条件下的结果，仍为provisional。mixed-v2限制单个静止定位目标、60FPS、水／雷／草／岩／物理和已声明的Moondew能力；不能推成全部Lunar／Stellar混合或完整官服验证。

## 历史验证与性能边界

[前一混合增量QA](../history/qa-report-2026-09-23-before-dendro-increment.md)保留2项浏览器首轮通过12.3秒，以及80武器／676命中的当时检查；[更早专项](../history/qa-report-2026-09-23-before-mixed-increment.md)、[2167单元时点](../history/qa-report-2026-09-23-before-special-increment.md)、[9月22日检查](../history/qa-report-2026-09-22.md)和[干净基线](../baseline/checks.json)分别保留其原始范围。本批未重跑旧单元、旧浏览器或性能矩阵。

固定外部gcsim对照仍为历史受控结果：[反向蒸发](../cross-validation/gcsim-reverse-vaporize.comparison.md)3击总伤49.4586860166433、总残差0；[安柏N5](../cross-validation/action-library/amber-local-comparison.md)5击总伤29.521217804783504、逐击及恢复残差0。它们不证明本批新角色和特殊混合已获官服验证。

[2026-09-23T06:42:28.209Z性能测量](../cross-validation/simulation-execution-benchmark.md)保持原代码时点：120秒／269事件、2预热／12计时，trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms；随机关闭trace中位29.397 ms／34.01次每秒。本批没有重测，不宣称新代码全负载达到100 ms。

环境为Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。生产构建保留大chunk及无效动态拆分提示：catalog约1.97 MB、Worker约1.69–1.71 MB（未压缩），未提高阈值掩盖警告。没有独立lint脚本，未额外进行安全审计。

本批 `git diff --check` 实际exit 0、无输出（[日志](../validation/dendro-diff-check.log)、[退出码](../validation/dendro-diff-check.exit)）；该命令只检查Git已跟踪差异，不将大量新文件误称为已全部静态审阅。

发布校验脚本已纳入新 `dendro-increment.spec.ts`；远端CI及必需检查尚未执行或配置。完整goal仍进行中，具体未完成范围见[已知限制](../known-limitations.md)。
