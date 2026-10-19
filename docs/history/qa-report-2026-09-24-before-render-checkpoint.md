# QA 与实测报告

更新：2026-09-24。本轮完成凝光有屏Q的独立历史快照、原生控件与重现，以及团队合法帧模拟的共享耐力、实际扣除／恢复、等待和记录。独立单击／单技能继续无需队伍或轮转。完整全游戏goal保持进行中；未提交、推送或部署。

## 实际整合检查

| 命令 | 实际结果 | 原始证据 |
| --- | --- | --- |
| `npm run data:status` | 首次exit 0；120身份／880命中／537完整条件动作／149部分／18具体阻塞；194武器／958合法精炼、53二件套／44四件套 | [日志](../validation/snapshot-stamina-data-status.log)、[退出码](../validation/snapshot-stamina-data-status.exit) |
| `npm run data:check` | 首次exit 0；历史目录复现，活动7.1投影与圣遗物来源哈希一致 | [日志](../validation/snapshot-stamina-data-check.log)、[退出码](../validation/snapshot-stamina-data-check.exit) |
| `npm run build` | 首次exit 1；calculator.ts历史快照中可选ER的 `number \| undefined` 不能传入数值轨迹 | [日志](../validation/snapshot-stamina-build.log)、[退出码](../validation/snapshot-stamina-build.exit) |
| 修正后 `npm run build` | exit 0；只记录实际存在的历史字段，全工程TypeScript与302模块生产构建通过；Vite 341 ms | [日志](../validation/snapshot-stamina-build-retry.log)、[退出码](../validation/snapshot-stamina-build-retry.exit) |
| 新增2项浏览器流程 | 首次耐力通过1.5s，凝光失败；总26.3s、exit 1。十二击手算已通过，仅期望显示“1000”而实际为“1,000” | [日志](../validation/snapshot-stamina-e2e.log)、[退出码](../validation/snapshot-stamina-e2e.exit) |
| 仅凝光第一次复验 | 数字格式已修正；完整十二段反复编辑至历史A4后耗尽默认30s预算，32.9s、exit 1 | [日志](../validation/snapshot-stamina-e2e-retry.log)、[退出码](../validation/snapshot-stamina-e2e-retry.exit) |
| 仅凝光第二次复验 | 该长流程明确60s预算，交互及数值断言未删减；1/1通过，测试39.4s、命令40.4s，exit 0 | [日志](../validation/snapshot-stamina-e2e-retry2.log)、[退出码](../validation/snapshot-stamina-e2e-retry2.exit) |

浏览器首次命令为 `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/snapshot-stamina.spec.ts`；后续仅加 `--last-failed`。使用4173生产产物。两条当前均通过，但不是一次命令全部首次通过；未重跑已过耐力、旧浏览器或单元全集。关闭耐力模型同步清除行动费用的修正已包含在生产构建和首次耐力流程中。发布校验脚本已加入此新文件，远端CI未运行或设置必需检查。

超时trace显示，完整十二段的每次历史应用／A4切换正常完成但耗约5秒，并非元素找不到；局部增加测试预算未提高页面性能。这是现有交互观察，不是正式基准，响应优化仍列缺口。详见[浏览器独立记录](../validation/snapshot-stamina-browser.md)。

## 新增核心检查

| 命令 | 实际结果 |
| --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/calculator-ningguang-snapshot.test.ts` | 首次3/3通过，1.26s、测试134ms、exit 0。固定源哈希、15个天赋系数最大差0、两组快照手算、A4、C6范围、局部阻塞、历史装备隔离、最终面板及JSON。[日志](../validation/ningguang-snapshot-core.log)、[退出码](../validation/ningguang-snapshot-core.exit) |
| `npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts` | 首次3失败，823ms、测试20ms、exit 1；夹具的swapFrames=0在schema处被拒绝，尚未进入耐力执行。[日志](../validation/stamina-runtime-test.log)、[退出码](../validation/stamina-runtime-test.exit) |
| 修正合法夹具后相同命令 | 3通过，895ms、测试155ms、exit 0；共享、等待、延迟、零费用回调、JSON和旧版本隔离。[日志](../validation/stamina-runtime-test-retry.log)、[退出码](../validation/stamina-runtime-test-retry.exit) |
| 仅 `-t 'rejects only\|preserves absent'` | 2通过1跳过，919ms、测试143ms、exit 0；修正等待期间状态到期后保留实际游标，收紧旧wire拒绝原因。[日志](../validation/stamina-runtime-state-followup.log)、[退出码](../validation/stamina-runtime-state-followup.exit) |
| 仅 `-t 'rejects only'` | 1通过2跳过，873ms、测试99ms、exit 0；新增核心半开窗口裁剪的相关断言。[日志](../validation/stamina-runtime-window-followup.log)、[退出码](../validation/stamina-runtime-window-followup.exit) |

每次均为独立执行，不能合称一次全集通过。凝光首次核心检查后仅改显示单位／中文释义；整合时修正可选字段类型，后续构建和页面完整流程通过。四份体力固定来源与远端固定提交字节相同，但本轮没有新的外部gcsim运行，没有性能复测、大规模Monte Carlo或旧测试矩阵。

## 独立手算与实际行为

凝光T1每枚系数0.8696，双方90级、10%岩抗。本体用当前ATK2000、CR0.5、CD1、无增伤：每击非暴击 `2000×0.8696×0.5×0.9=782.64`，期望1173.96。屏宝石用历史ATK1000、CR0.2、CD0.5、增伤0.3：每击非暴击 `1000×0.8696×1.3×0.5×0.9=508.716`，期望559.5876。六枚各一组，整次非暴击 **7748.136**、期望 **10401.2856**。历史A4增加0.12只作用屏宝石，单击期望 **611.24184**；面板已含开关不重复加入。

浏览器验证历史缺失时六枚屏段阻塞、本体单击仍可计算；添加完整历史快照恢复十二击，历史A4不会追改当前Q；改当前ATK9999不改变历史单击。完整和单击JSON往返保存上下文、逐段轨迹及总量，清除历史后相关段再次阻塞。C0–C6本次自身Q伤害的来源范围、T1–15与时序TODO见[凝光专项](../validation/ningguang-screen-snapshot.md)。

耐力合成两人队伍初始10、A费用10在F6扣除、B在F10请求费用10。strict下B失败，只有A的F1命中；F97–180恢复84帧，最终35。wait下F97–120累计24帧恢复到10，B在F120起手、F121命中，延迟至F123消费；三个额外恢复帧使扣除前11.25、后 **1.25**，到观察结束尚未再恢复。命中总伤855，来源为合成面板和明确动作声明，不是真实角色整队DPS。页面记录与导出一致，完整运行记录导入后实际重跑相同，关闭并保存模型后费用声明一并移除。

核心另外验证延迟消耗不预留：A声明晚扣18，B先耗尽共享池，A回调即使实际扣除量为0仍重置恢复时点；明确免费技能不重置，零费用UseStam会重置。F91–180恢复日志裁至F120之前时，仅保留F91–119：`29×25/60=12.083333333333334`，原日志不变。见[体力专项](../validation/stamina-runtime.md)。

## 边界、历史与测量时点

活动仍为7.1 released/provisional，已验证正式数据集为空。当前覆盖包含条件及部分定义，不能视作全角色、装备或整队完成。来源发布观察仍为2026-09-23 14:22香港时间，本轮data:status没有重新查证官方版本；7.2 V1仍无可靠快照，preview数0。

凝光十二枚以同一稳定目标全部命中为明确条件，弹道、碰撞、准确hitmark和A4自动穿屏仍未认证。耐力费用由用户或固定引用明确声明，尚无全角色费用／动态减耗／连续冲刺锁与特殊移动资源；私有耐力量、恢复冷却和待扣任务未进入完整周期检查点。多段页面响应、HP／盾及其余角色／装备／特殊反应范围仍待完成，见[已知限制](../known-limitations.md)。

[上一轮刻晴／行秋／西风QA](../history/qa-report-2026-09-24-before-snapshot-stamina.md)保留原命令、首次失败与数值，不冒充本轮重测。[既有性能](../cross-validation/simulation-execution-benchmark.md)测于2026-09-23T06:42:28.209Z：120秒269事件，2预热12计时；trace关闭中位30.500ms／p95 33.336ms、开启129.735／148.481ms、随机关闭trace中位29.397ms／34.01次每秒，不能作为本轮新功能的性能结论。

环境Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。构建保留大chunk和无效动态拆分提示，未扩展为无关重构。

本轮 `git diff --check` 首次exit 0、无输出；仅检查已跟踪差异，不作为所有未跟踪文件已审阅的证明。[日志](../validation/snapshot-stamina-diff-check.log)、[退出码](../validation/snapshot-stamina-diff-check.exit)。
