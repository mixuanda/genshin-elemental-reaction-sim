# QA 与实测报告

更新：2026-09-23。以下是本地工作树的新增量证据；未提交、推送或部署。遵循有限、针对改动的验证，没有重复完整单元、旧浏览器全集或性能矩阵。

## 本次整合结果

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | exit 0；生成120身份／667命中、47武器／235精炼、50二件套／17四件套，README与状态页同步 | [状态](../validation/next-data-status.log) |
| `npm run data:check` | exit 0；历史目录可复现、活动7.1投影及覆盖摘要一致、5份圣遗物表源哈希正确 | [检查](../validation/next-data-check.log) |
| `npm run build` 首次 | exit 1；仅新增测试文件的7处可能undefined与3处exactOptionalPropertyTypes错误；没有关闭严格检查 | [首次记录](../validation/next-build.log) |
| `npm run build` 修复后 | exit 0，全工程TypeScript通过；Vite 227模块、305 ms；保留大chunk与无效动态拆分提示 | [构建](../validation/next-build-final.log) |
| 导航修复后 `npm run build` | exit 0，全工程TypeScript通过；Vite 227模块、307 ms | [构建](../validation/next-build-navigation-fix.log) |
| 新增浏览器首轮 | 3失败：轮转页说明元素定位、TF测试trace节点前缀、返回结果页丢失同次独立运行；数值路径已执行到逐击回放 | [原始记录](../validation/next-increment-e2e.log) |
| 新增浏览器复验 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/next-increment.spec.ts --workers=1 --last-failed`，exit 0，3/3通过，5.9 s；固定307 ms构建，不重复旧套件 | [复验](../validation/next-increment-e2e-rerun.log) |
| SSW／件数规则后的 `data:status` | exit 0；当前两件套53，其他目录身份／命中／武器覆盖保持原值 | [最终状态](../validation/next-final-data-status.log) |
| SSW／件数规则后的 `data:check` | exit 0；实际运行时投影、覆盖生成、5源哈希通过 | [最终数据检查](../validation/next-final-data-check.log) |
| 最后一次构建首轮 | exit 1；仅新SSW夹具的排序数组让type字面量拓宽为string | [类型记录](../validation/next-final-build.log) |
| 字面量收窄后构建 | TypeScript通过，生产构建完成；Vite229模块、300 ms。该次PTY退出码未单独留存，完整日志及产物保留 | [最终构建](../validation/next-final-build-retry.log) |
| 普通扩散捕获修复后构建 | exit 0；全工程TypeScript与生产构建通过，229模块、315 ms | [构建](../validation/next-capture-fix-build.log)、[退出码](../validation/next-capture-fix-build.exit) |
| SSW新增浏览器首轮 | 1失败，5.4 s：导入时的普通冰扩散被damage-group ICD抑制为0，但捕获校验漏乘已有groupMultiplier，配置未正常载入；已修复真实校验路径，随后同项复验通过 | [记录](../validation/stellar-swirl-e2e.log) |
| SSW浏览器定向复验 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/next-increment.spec.ts --workers=1 --grep 'Stellar Swirl guide profile'`，1/1通过、2.2 s、exit 0；不重跑先前3项 | [复验](../validation/stellar-swirl-e2e-rerun.log)、[证据](../validation/stellar-swirl-e2e.md) |

首次类型失败只修改测试对象收窄及省略可选字段的写法，保留数值断言和生产schema，不为类型修复重复已通过单元。浏览器首轮暴露的两处应用问题已修复：轮转说明使用固定元素ID；已完成的独立运行随导航保留，离开只取消未完成Worker，当前工作区变化明确提示，读取配置才清除旧结果。TF测试改为实际共享trace节点ID，数值断言保留。

数据检查输出中的旧目录120/237等数量是历史生成器复现，不是当前元数据124/255或条件支持120/667；CLI提示已明确标出历史基线。

## 实施时的定向检查

下列结果有实际工具输出或标明来源的转录。部分最终文件在必要扩展／失败修复后只重跑受影响用例，不能合计成一次全套绿灯。

| 范围 | 实际执行与结果 |
| --- | --- |
| 装备反应与减抗共享核心 | `calculator-equipment-reactions.test.ts`、`character-damage-bonus.test.ts`、`calculator.test.ts`，35/35，462 ms；[工具转录](../validation/core-equipment-reactions-focused-20260923.md) |
| 新角色来源与AST | Kachina 3、三角色基础4、四角色扩展8、技能5、156份文档适配1、源公式4各自通过；[完整命令/时间/范围](../cross-validation/optimizer-character-expansion.md)、[适配日志](../validation/optimizer-adapter-expanded.log)、[公式日志](../validation/optimizer-source-formulas.log) |
| 四套反应装备 | 5/5，917 ms；真实翠绿配装、按元素减抗、反应集合、JSON和最终面板等价；[转录](../research/artifact-reaction-validation-2026-09-23.json) |
| 新增三项圣遗物两件套 | `artifact-piece-effects.test.ts`，3/3，967 ms；真实属性／条件AST、件数控件、JSON以及非伤害条款隔离；[记录](../artifact-piece-effects.md) |
| 19把新条件武器 | 参数化19/19，869 ms，核对95个精炼；真实破魔集成1/1，940 ms；[记录](../weapon-conditional-effects.md) |
| 行动DSL往返 | `rotation-dsl.test.ts`，7/7，530 ms；请求帧、所属角色、移动、拾取、组合首输入；[日志](../validation/next-rotation-dsl.log) |
| 来源普攻链 | `source-action-library.test.ts`，6/6；实际测试执行151 ms，公共入口拒绝非法顺序及不匹配来源；[记录](../source-action-library.md) |
| 当前执行选项schema | 相关30项通过，历史schema仍拒绝新执行选项；记录源于schema代理本次实际工具结果，未单独补跑 |
| LB独立模块／共享公式 | 3文件45项通过，768 ms；增加实际草露回执与三段不同HP/RES恢复；factory补入后其4项再次通过；[记录](../lunar-bloom-runtime.md) |
| 星导状态 | 8/8，135 ms；修复领域重建保留全局待发布计数与角色ICD；[状态说明](../special-reaction-state.md) |
| SSC实际主路径 | 最终1/1，1.23 s；实际替换、字段增伤/减抗及快照、到期、完整捕获恢复；[执行说明](../stellar-conduct-simulation.md) |
| LB实际主路径 | 两项分次通过：缺资源/非idle/窗口边界案例875 ms，主正常路径修夹具后1/1，1.01 s；普通Bloom保留和三段实际结算；[执行说明](../lunar-bloom-simulation.md) |
| SSW独立适配器 | 初始四项各自有通过记录；最后未过项1通过/3跳过，798 ms。后续主队列重构只复验受影响的两项，2通过/2跳过，787 ms；[记录](../stellar-swirl-adapter.md) |
| 普通扩散捕获回归 | 唯一新增案例1通过／3跳过，1.08 s；保留正基础伤害及0.6反应倍率，真实groupMultiplier=0后JSON与计算器恢复0，篡改乘数被拒绝；[记录](../stellar-swirl-simulation.md) |
| SSW实际主队列 | 3项各自通过；首轮2通过，第三项修正夹具为合法1秒边界后单项通过，801 ms。实际普通扩散替换、真实1U反馈、时序／窗口和全部命中恢复；[记录](../stellar-swirl-simulation.md) |

LB主接入时发现原先选择的aura-v3没有普通Bloom执行路径，实际改为已有aura-v5；没有让“资源日志存在”代替真实草原核。SSC/LB测试中修正过夹具日志字段、合法空时间轴和浮点比较，不改变来源倍率或用零补依赖。SSW测试先后暴露错误ICD标识、宿主时间推进顺序和基础配置问题，按记录逐一修复，只重跑未通过用例。

三个综合浏览器场景通过真实装备反应与最终面板等价、轮转可视编辑／来源N5预览，以及星导／月绽放执行与同次结果逐击还原。月绽放三段在同一次运行上逐一往返计算器，均保持完整上下文与数值；没有通过重新模拟来掩盖结果丢失。[月绽放页面截图](../validation/screenshots/lunar-bloom-result.png)用于视觉核对，数值依据为测试断言及完整导出。

SSW首轮浏览器失败发生在普通模式导入，不是特殊事件数值断言。修复仅在捕获校验中乘已有且由伤害组日志独立验证的groupMultiplier；计算器原有reactionGroupPolicy已正确解释此步骤，没有新增输入字段或将基础伤害伪造为0。未通过换导入方式、跳过普通运行或放宽断言回避问题；复验继续使用同一正常入口且通过，只运行这一新增场景；9事件及实际1U回执、初始和漩涡完整上下文往返、来源冲突和高跳未消费标记均有断言。

## 独立数值证据

- [双角色自动反向蒸发](../cross-validation/gcsim-reverse-vaporize.comparison.md)：实际固定gcsim v2.44.1与本地三击帧为7/164/260；总伤害49.4586860166433、总残差0；DPS浮点残差8.881784197001252e-16。附着在外部日志的打印精度内一致，三击重放与独立计算器蒸发箭残差0。
- [安柏来源N5](../cross-validation/action-library/amber-local-comparison.md)：外部一次汇总和一次sample存档后，本地比较不重复运行binary。五击命中25/47/86/122/156，总29.521217804783504；每击伤害、JSON重放与独立计算器残差0，N4在N5起手后的在途箭保留。
- SSW合成参考夹具普通4381.875＋特殊20826.86259373466＝25208.73759373466；9个实际特殊事件，真实冰反馈可再次触发。指南／源码冲突仍在，不能称官服验证。
- SSC合成参考夹具总伤4469.75，6个受字段影响的普通命中；LB合成夹具普通3459.3363＋三段直接2750.53023＝6209.86653。合成面板不放入正式角色验证，不能由此宣称完整角色配装正确。

两个外部场景都采用恒定面板、明确关闭未建模状态；发射与命中取样在该条件下数值等价，不证明动态快照、全装备、能量循环或当前官服全量机制。对照源码与产物哈希保存于各自报告，本轮不以最后构建冒充重新执行外部程序。

## 保留的检查与性能

[上一增量QA](../history/qa-report-2026-09-23-before-special-increment.md)保存2167单元的首轮2164通过/3失败及三个定向复验、3项性能门、3个综合浏览器场景与所有原始日志。9月22日1994单元/3性能/43浏览器记录在[旧QA](../history/qa-report-2026-09-22.md)，干净基线1858/3/36在[baseline/checks.json](../baseline/checks.json)。这些都是对应当时源码的证据，不冒充本次重跑。

没有新增性能重测。原[120秒性能测量](../cross-validation/simulation-execution-benchmark.md)固定于2026-09-23T06:42:28.209Z源码：2次预热、12次计时；关闭trace中位30.500 ms/p95 33.336 ms，开启129.735/148.481 ms，种子随机关闭trace中位29.397 ms/34.01次每秒。269事件；随机每轮263次抽样、6次不合资格命中不抽样；相同种子重放相等。详细trace超过100 ms，不宣称全负载达标。

环境：Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。无独立lint脚本；未运行额外安全审计。最后产物catalog约1.97 MB、三个Worker约1.68 MB（未压缩）；保留构建体积提示，不修改阈值掩盖它。

最后 `git diff --check` exit 0，记录于 [差异检查](../validation/next-final-diff-check.log)。

本地 `check:release` 已包含独立calculator及两批整合E2E文件，远端CI与分支必需检查尚未设置或执行。已知机制与数据缺口见[已知限制](../known-limitations.md)，最终goal仍为进行中。
