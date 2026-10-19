# QA 与实测报告

更新：2026-09-23。本批为月感电＋月结晶共享执行、角色条件公式和装备扩展的本地增量；未提交、推送或部署。只执行本批必要专项及两项新增浏览器流程，不重复旧完整单元、浏览器全集或性能矩阵。

## 当前整合结果

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | exit 0；120身份、676命中、407完整条件动作／145部分动作／18阻塞；80武器／400精炼、53二件套／44四件套 | [状态](../validation/mixed-data-status.log) |
| `npm run data:check` | exit 0；历史目录复现、活动7.1投影及覆盖摘要一致、来源哈希通过 | [数据检查](../validation/mixed-data-check.log) |
| `npm run build` 首次 | exit 1；新混合测试中四处 `LegalTimelineCommand.atFrame` 未排除wait联合成员；无生产类型错误 | [首次构建](../validation/mixed-build.log)、[退出码](../validation/mixed-build.exit) |
| 类型收窄后 `npm run build` | exit 0；全工程TypeScript及生产构建通过，237模块、330 ms；保留大chunk和无效动态拆分提示 | [构建](../validation/mixed-build-rerun.log)、[退出码](../validation/mixed-build-rerun.exit) |
| 新增浏览器 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/mixed-coverage.spec.ts`，首轮2/2通过、12.3 s、exit 0；固定4173生产产物 | [日志](../validation/mixed-coverage-e2e.log)、[退出码](../validation/mixed-coverage-e2e.exit)、[专项证据](../validation/mixed-coverage-e2e.md) |
| 新测试加入后的 `npm run typecheck` | exit 0；新增浏览器文件在生产构建后写入，因此补一次全工程类型检查；没有重复生产构建 | [类型检查](../validation/mixed-final-typecheck.log)、[退出码](../validation/mixed-final-typecheck.exit) |

浏览器第一项用正常角色、技能、资源与装备控件验证洛恩20/100及六斩、莉奈娅A1减抗与最终面板／JSON等值、匣里日月和烬城的独立窗口、未知与空集合。第二项只运行一次混合配置，读取实际导出分项、真实岩预算与队列，分别将月感电及月结晶命中送入计算器；往返结果页保留同一次结果。两项首轮通过，没有复验或扩跑旧浏览器套件。

类型修复仅将四行已知swap/skill命令的属性赋值改为显式构造同一命令，保留原请求帧及全部数值断言；不修改生产schema、不重复已通过的混合单元测试。旧目录生成器的120/237等数量属于历史基线，不能替代当前元数据124/255或条件命中120/676。

## 本批实际定向检查

下列是各自命令的真实结果，不代表一次完整套件运行。工具输出转录与原日志明确区分。

| 范围 | 实际命令与结果 |
| --- | --- |
| 新装备条款 | `npx vitest run packages/game-data/src/equipment-additional-effects.test.ts`，64/64通过、1.02 s（测试体62 ms）；33把武器165精炼来源、27套四件条款、门槛／封顶／标签及真实配装、JSON、最终面板；[记录](../equipment-additional-implementation.md) |
| 洛恩静态来源 | `optimizer-resource-mappings.test.ts`，5/5通过、853 ms；完整天赋向量、六斩组成和资源来源域；[记录](../cross-validation/lohen-linnea-context.md) |
| 莉奈娅静态来源 | `optimizer-linnea-mappings.test.ts`，4/4通过、851 ms；双击向量、A1常数、普通与月曜范围；[记录](../cross-validation/lohen-linnea-context.md) |
| 角色公式集成 | `npx vitest run packages/game-data/src/character-mappings/optimizer-resource-and-resistance.test.ts`，2/2通过、1.07 s；真实分类动作、共享公式、最终面板和JSON等价；[日志](../validation/optimizer-resource-and-resistance.log) |
| 奈芙尔C1普通作用域 | `npx vitest run packages/game-data/src/character-mappings/optimizer-constellation-scope.test.ts`，1/1通过、1.16 s；普通E/Q的C0/C1等值、C2/C4继续阻塞；[日志](../validation/optimizer-constellation-scope.log) |
| 共享减抗与已审输入域 | `calculator-equipment-reactions.test.ts -t 'character formula\|audited input'` 两项筛选：首轮1通过／1失败；修正夹具元素后只复验失败项1通过／4跳过、158 ms；[准确命令与转录](../validation/character-resistance-contract-20260923.md) |
| 同次月曜混合执行 | `npx vitest run packages/sim-core/src/__tests__/lunar-mixed-simulation.test.ts`，3/3通过、1.32 s（测试体533 ms）；真实扣量、岩先雷后水预算、晶片间隔、云失去附着、逐弹取样／实时抗性、两类特殊及全部普通命中恢复；[记录](../lunar-mixed-simulation.md) |

共享减抗首轮失败是合成夹具为physical而测试装备条款限定pyro；修正夹具元素，不改变来源倍率或适用规则。已通过的输入域用例没有复跑。莉奈娅静态测试另修正数组首项存在检查以满足严格TypeScript，没有删除数值断言。

## 数值结果与验证边界

- 混合合成夹具在同一次实际运行中得到：普通 **3291.75**＋月感电 **12656.313410639608**＋月结晶 **15319.194631856271**＝**31267.25804249588**。雷云命中15/135帧，月结晶43/55/67帧取样、53/65/77帧投递。岩预算、普通雷晶片和云扣量在同一Aura状态中相互影响，不是把两次独立总数相加。夹具及精确预期在[输入](../fixtures/lunar-mixed-reference.synthetic.json)和[预期](../fixtures/lunar-mixed-reference.synthetic.expected.json)。
- 固定角色公式条件：ATK2000、DEF800、有效天赋10、双方90级、基础抗性10%、无普通增伤。洛恩E另有固定附加500，消耗20为 **1274.76**、消耗100为 **1585.8**；消耗100的六斩合计 **16166.304**。外部固定附加没有被资源倍率放大。
- 露米普通双击：A1生效且月兆1为 **1416.96**、月兆2为 **1520.64**；范围外或A1未解锁为 **1244.16**。最终抗性覆盖保留来源解释，最终面板转换与JSON往返不重复减抗。
- 装备独立窗口：烬城基础12%与额外28%使用不同元素集合，允许只有额外尾段；黑曜二件前台夜魂15%与四件40%暴击独立；匣里日月两个窗口只作用于对应标签；影中沉凝经典超导80%不串入超载。未知条件与已知空集合含义不同。

这些是固定来源、显式上下文下的条件结果。游戏内独立验证数仍为0；混合仅支持明示水／雷／岩／物理、单静止目标及60FPS等范围。草／月绽放、星反应和一般多目标混合仍不支持。洛恩离散值域仅代表审过的来源界面情境；莉奈娅双击保持部分动作，不能推成持续25秒的完整输出。

## 历史检查和性能

[上一增量QA](../history/qa-report-2026-09-23-before-mixed-increment.md)保存来源动作／反应装备／星导／月绽放／星扩散的定向单元、3项整合浏览器和1项SSW浏览器的通过、首次失败及复验。更早[2167单元和性能门](../history/qa-report-2026-09-23-before-special-increment.md)、[9月22日记录](../history/qa-report-2026-09-22.md)与[干净基线](../baseline/checks.json)保留对应代码时点，本批未重跑。

旧固定外部gcsim对照保留：[反向蒸发](../cross-validation/gcsim-reverse-vaporize.comparison.md)三击7/164/260帧总伤49.4586860166433，总残差0；[来源安柏N5](../cross-validation/action-library/amber-local-comparison.md)五击25/47/86/122/156帧总伤29.521217804783504，逐击及恢复残差0。它们证明恒定面板、声明范围的结果，不证明本批新角色、混合特殊反应或完整官服机制。

没有新增性能重测。[2026-09-23T06:42:28.209Z测量](../cross-validation/simulation-execution-benchmark.md)为120秒／269事件、2次预热、12次计时：trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms；独立随机关闭trace中位29.397 ms／34.01次每秒。详细trace超过100 ms，不宣称全负载达标或此次新代码已重测。

环境：Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。构建catalog约1.97 MB、Worker约1.68–1.69 MB（未压缩）；没有改阈值隐藏提示。无独立lint脚本，本批没有额外安全审计。

本地发布脚本已纳入新增 `mixed-coverage.spec.ts`；远端CI和必需检查未设置或执行。本批 `git diff --check` 实际exit 0、无输出（工具结果转录；该命令只检查Git已跟踪差异）。完整全游戏goal保持进行中，具体缺口见[已知限制](../known-limitations.md)。
