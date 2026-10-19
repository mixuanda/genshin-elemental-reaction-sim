# QA 与实测报告

更新：2026-09-23。本轮为16名角色的102段条件命中、诺艾尔独立Q上下文与真实Q→N执行、普通命中随机回能及安柏v2的本地增量。未提交、推送或部署。只执行新增与确实受影响的行为，没有重跑旧全集或性能矩阵。

## 当前整合检查

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | exit 0；120身份／797命中、492完整条件动作／149部分／18具体阻塞；装备194武器／958合法精炼、53二件套／44四件套 | [状态](../validation/noelle-actions-data-status.log)、[退出码](../validation/noelle-actions-data-status.exit) |
| `npm run data:check` | 首次exit 0；历史目录复现、活动7.1投影、来源哈希及生成覆盖一致 | [检查](../validation/noelle-actions-data-check.log)、[退出码](../validation/noelle-actions-data-check.exit) |
| `npm run build` | 首次exit 0；全工程TypeScript及生产构建，273模块、Vite336 ms | [首轮](../validation/noelle-actions-build.log)、[退出码](../validation/noelle-actions-build.exit) |
| 新增及受影响浏览器首轮 | 仅诺艾尔两个新流程＋安柏v2一个受影响流程，2通过／1失败，3.6 s、exit 1 | [首轮](../validation/noelle-actions-e2e.log)、[退出码](../validation/noelle-actions-e2e.exit) |
| 输入焦点修复后构建 | exit 0，273模块、Vite341 ms；只改诺艾尔条件输入重绘方式 | [构建](../validation/noelle-actions-build-ui-fix.log)、[退出码](../validation/noelle-actions-build-ui-fix.exit) |
| 仅复验独立诺艾尔失败项 | `--last-failed` 仅1项通过，4.1 s（用例3.7 s）、exit 0；全部三个流程均有通过记录 | [复验](../validation/noelle-actions-e2e-rerun.log)、[退出码](../validation/noelle-actions-e2e-rerun.exit)、[完整命令](../validation/noelle-actions-e2e.md) |

三个浏览器场景使用固定4173生产产物。安柏v2首轮1.9秒通过，19击原数值、扣能、召唤日志及完整恢复保持一致；诺艾尔Q→N首轮1.4秒通过，六击/总量精确相等，转换与随机回能可见流水及两类命中完整捕获相等。

独立诺艾尔首轮发现真实焦点缺陷：填完防御快照后移到独立Q等级框，上一输入的blur/change重建全部控件，销毁下一输入目标，导致Q1输入丢失，仍算Q10的576而非320。修复后保留可编辑DOM，只更新源系数与只读数值；未改伤害公式、断言或加测试等待。只复验失败流程通过（用例3.7秒、命令4.1秒），同样连续编辑验证Q1/Q10/C6、已含面板、C2、两段Q及赤角final／JSON／重新配装。已通过的两项不重跑。

## 定向来源与核心检查

下列为各独立命令的实际结果，不合并冒充一次全套检查。

| 范围 | 实際结果及证据 |
| --- | --- |
| 诺艾尔9基础组成＋Q两击 | `noelle-action-mappings.test.ts` 首次1/1通过，1.02 s（测试12 ms）；180来源数值、有效天赋1–15、标签、部分范围和12份哈希；[来源报告](../cross-validation/noelle/source-mappings.md)、[日志](../validation/noelle-source-mappings.log) |
| 第一批五名角色 | `base-state-attack-mappings.test.ts` 首次1/1通过，895 ms（测试6 ms）；31动作／33hit、32源文件、480倍率；[日志](../validation/base-state-attack-mappings.log) |
| 第二批十名角色 | `base-state-additional-attack-mappings.test.ts` 首次1/1通过，1.14 s（测试32 ms）；46动作／58hit、60源文件、735倍率、钟离逐段A4与缺突破门；[日志](../validation/base-state-additional-attack-mappings.log)、[两批审计](../cross-validation/basic-attack-gap-audit.md) |
| 诺艾尔独立攻击上下文 | `calculator-noelle-context.test.ts` 首次3/3通过，1.15 s（测试58 ms）；历史非Extra DEF、独立Q等级、C2/C6、当前DEF变化不重采、两段Q、final/JSON/记账；[实际工具转录](../validation/noelle-calculator-context.md) |
| 普攻随机回能与来源运行首轮 | 1通过／2失败，901 ms；独立RNG概率/间隔/切人/重放用例通过；Noelle工厂误用不支持岩的aura-v1，合成探针缺合法时间线，两Noelle用例未通过 | [首轮](../validation/noelle-source-core-tests.log) |
| 仅两Noelle失败项复验 | 2失败，895 ms；修正输入后暴露旧结果来源校验仍静态要求physical，拒绝实际Geo附魔；严格校验改接同一有效附魔状态推导 | [复验](../validation/noelle-source-core-recheck.log) |
| 两失败项＋新增安柏v2 | 3/3通过，1.65 s（测试846 ms）；六击来源对照、完整恢复、动态DEF快照及精确到期、v2 Q后N与旧v1边界。未重复已通过RNG模块 | [最后](../validation/noelle-source-core-infusion-recheck.log)、[完整实现说明](../noelle-source-simulation.md) |

旧安柏来源测试显式绑定 `legacy-v1`，保持原始历史行为；本轮未执行该旧文件，不写为当前新通过。新增当前版本日志同步旧格式类型差集，未放宽旧wire或静默迁移旧模型。

## 实际数值与外部边界

诺艾尔固定gcsim二进制只调用一次，6秒，1次汇总加一个独立sample。固定Lv1/C0/T1/训练大剑、无圣遗物、无卡肉、单个静止范围内目标。Q在1帧以非Extra DEF **66.95325 × 0.4 = 26.7813** 转固定ATK，基础ATK **39.2722** 得到命中ATK **66.0535**。Q两击25/66帧，N1–N4在111/146/187/240帧；第9帧真实扣60能量。

六击逐值与外部sample差值均 **0**，总伤与外部aggregate **105.67709476067012** 差值 **0**。外部sample的派生求和为105.6770947606701，保留此浮点累计差，不修改原始数据或冒称sample派生和完全相同。核心恢复全部六击，并在同一共享AST中重现防御快照及转换步骤。见[原始外部证据](../validation/noelle-q-normal-external.md)、[来源边界](../research/noelle-source-evidence.md)、[本地完整结果](../validation/noelle-q-normal-local.result.json)。

本地独立随机流在N4获得1能量，外部sample在N3获得1能量；不更换seed、不借用外部结果、不声称同种子随机轨迹相同。12帧共享间隔、切人重置、Q起手快照时刻及980帧持续均为固定源码仍带TODO的参考假定。默认结果为 `fixed-source-assumed`／provisional，未晋升为verified。第981帧按源码Stats先删除到期转换的顺序，ATK加值与最终岩附魔均失效；静止目标范围条件明确保留。

独立伤害例：历史DEF800、Q1系数0.4产生 **320** 固定ATK；Q10系数0.72为 **576**，C6为 **976**。钟离N5在ATK1000/HP30000/T1/双方90级/10%物抗条件下，突破四四段合计 **887.4**，突破三 **387**，每一击各自加入HP项；突破未知不推断。

## 历史与性能

[上一轮QA](../history/qa-report-2026-09-23-before-noelle-actions.md)保留武器逐击条款、安柏E/Q旧来源及其首轮失败和定点复验；[更早草核／精通增量](../history/qa-report-2026-09-23-before-equipment-actions.md)、[2167单元时点](../history/qa-report-2026-09-23-before-special-increment.md)、[9月22日](../history/qa-report-2026-09-22.md)与[干净基线](../baseline/checks.json)保持历史证据范围。当前只复验实际改变了来源身份的安柏浏览器流程，没有重跑旧装备场景或全套。

[2026-09-23T06:42:28.209Z性能测量](../cross-validation/simulation-execution-benchmark.md)仍为旧代码时点：120秒／269事件、2预热／12计时；trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms；随机关闭trace中位29.397 ms、34.01次每秒。本轮无重测，不宣称新代码全负载达到100 ms。

环境仍为Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。构建保留大chunk和无效动态拆分提示。未进行无关lint、安全或性能扩展。

本轮 `git diff --check` 首次执行退出0且无输出，范围为Git已跟踪文件的差异；见[原始日志](../validation/noelle-actions-diff-check.log)与[退出码](../validation/noelle-actions-diff-check.exit)，不据此宣称所有未跟踪文件已审阅。正常发布校验脚本已加入 `noelle-actions.spec.ts`，远端CI未执行或配置必需检查。完整goal保持进行中，具体未完成范围见[已知限制](../known-limitations.md)。
