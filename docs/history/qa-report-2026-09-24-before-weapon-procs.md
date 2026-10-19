# QA 与实测报告

更新：2026-09-24。本轮新增柯莱、夏洛蒂的五个完整条件技能分支，并将普通附着检查点接入原生 target-phase-v2。独立单击／单技能计算器仍为主导航功能，不要求队伍或轮转。最终 goal 继续进行，未提交、推送或部署。

## 实际变化

柯莱 E 提供往返两击、往返加两次新叶、往返加四次新叶三分支。往返使用释放面板，新叶使用用户明确填写的回收历史快照；历史值不会从当前面板复制。完整分支按 A1/C2 触发和未中断条件判断；单选飞叶轮不依赖未选新叶的未来条件。Spread 的精通与反应加成在命中时读取，选用该反应时须明确其实际值与对应面板相同；未知不能伪装快照。C6 完整技能仍因额外伤害缺失而阻塞。

夏洛蒂 E 提供点按初击加4次标记、长按初击加8次标记，支持 C0–1。完整技能要求明确标记未替换／中断／额外延长和各次取样状态稳定；独立单击仍可计算。突破4后，实际非枫丹其他队友人数×5%冰伤进入共享AST。人数未知不当作0；已含A4的面板不再次加成。来源配装和展示柜导入分别设置记账，导入的突破0–3不会误标已解锁A4。C2攻击变化及C6新增伤害仍待实现。

正常计算器中新增上述条件表单和完整历史快照编辑／应用／清除，逐击核心、公式解释、选择单击与完整施放、JSON恢复共用现有执行链。没有添加要求用户先建队的步骤。来源审计、公式与条件范围见[技能专项](cross-validation/collei-charlotte-skills-source-audit.md)。

目标阶段检查点读取真实待执行衰减键、已完成键、阶段旗标与快照，保留实际队列 priority/FIFO；Aura新增真实 reactableTickModel 和生命周期缓存。捕获不推进引擎，不伪造第二份事件队列。已执行当前边界帧或未来任务缺失时不能认证完整；只有不再影响未来机制的过去日志状态排除在周期比较之外。支持目标时钟关闭的 target-phase-v2 普通单元素／水火／冰火闭合域，检查全部声明能力、初始Aura与休眠附魔，保持原Aura版本。原生 v9 已实测；v8走相同受支持路径，本轮未单独运行。详见[核心专项](validation/ordinary-aura-target-phase-checkpoint-core.md)。

另完成讨龙／祭礼及16把独立追击武器的固定源码审计，**未实现这些新武器的自动生命周期**。精确触发、独立伤害标签、快照、概率和冷却边界已记录，见[生命周期审计](cross-validation/weapon-lifecycle-next-source-audit.md)与[追击审计](cross-validation/weapon-proc-next-source-audit.md)。纠正上轮试作星镰文案：固定源码 AttackTagExtra 表示重击，实际冲突仅为 ATKP 与普攻／重击 DMG% 的属性差异；产品现有实现未因这次文案纠正改变。

## 来源和生成数据

两角色保留15个固定gcsim文件、5个固定Optimizer文件及来源哈希。五组T1–15共75个系数位置与活动目录三方逐项一致，最大绝对差0。来源一致性不等于游戏实测或外部整队模拟。

映射 `.17` 实际生成 **120身份／941击／550完整条件动作／135部分动作／18具体阻塞**，净增21击、5完整动作，移除5个旧部分映射。新9个参数映射展开26击，不重复保留旧片段菜单。装备仍 **200武器／988合法精炼／53二件／44四件**，本轮没有增加装备覆盖。

活动目录仍为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional；verified为空、preview为0。元数据124身份／127天赋集／789技能／255武器／63套装／127命座集。本地状态重新生成不是新的在线发布观察；官方来源观察仍为2026-09-23 14:22香港时间。

## 实际执行的检查

| 命令／范围 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 新 `collei-charlotte-skill-mappings.test.ts` 四项 | 首跑2通过／2失败，1.30s；发现ring被动作ID中的sprout误分类，修复精确后缀后仅两项失败复验通过，1.23s／另2跳过 | [首跑](validation/collei-charlotte-skills.log)、[定点修复](validation/collei-charlotte-skills-collei-fix.log) |
| 同文件 `-t 'Charlotte'`，导入记账修正后 | 过滤匹配了包含Charlotte的父级描述，**实际4/4再次通过**，1.55s／测试182ms，exit0；不写成只跑1项，不再重跑 | [日志](validation/collei-charlotte-import-reset.log) |
| 新 `ordinary-aura-target-phase-checkpoint.test.ts` | 首次3/3通过，948ms／测试114ms，exit0 | [日志](validation/ordinary-aura-target-phase-checkpoint.log) |
| `node packages/game-data/scripts/generate-classified-coverage.mjs` | 首次exit0，生成941／550／135／18 | [日志](validation/collei-target-phase-classified-generation.log) |
| `npm run data:status` | 首次exit0，生成本地状态、README及更新页事实 | [日志](validation/collei-target-phase-data-status.log) |
| `npm run data:check` | 首次exit0，历史目录可复现、当前投影及来源哈希一致 | [日志](validation/collei-target-phase-data-check.log) |
| `npm run build` | 首次exit0，全工程TypeScript＋343模块生产构建，367ms | [日志](validation/collei-target-phase-build.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/collei-charlotte-casts.spec.ts --output=test-results/collei-charlotte-casts --reporter=line` | 新2流程首次通过，总2.8s，exit0 | [页面报告](validation/collei-charlotte-browser.md)、[日志](validation/collei-charlotte-browser.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/ordinary-aura-target-phase-checkpoint.spec.ts --reporter=line --output=test-results/ordinary-aura-target-phase-checkpoint` | 新1流程首次通过，总1.8s，exit0 | [页面报告](validation/ordinary-aura-target-phase-checkpoint-e2e.md)、[日志](validation/ordinary-aura-target-phase-checkpoint-e2e.log) |

新增7项核心最终有通过证据，首次并非全绿。三条新增页面均首次通过，复用既有4173生产预览，未重启。没有旧全集、旧页面矩阵、性能或大型Monte Carlo重跑。构建时间不是产品性能指标；既有大chunk和无效动态拆分提示保留。

## 实测数值与状态

技能均为T1、角色／目标90级、抗性10%、当前ATK1000／CR0.5／CD1。柯莱新叶另明确历史ATK2000／CR0.2／CD0.5／增伤0.3；夏洛蒂明确2名非枫丹其他队友。属于教学条件，不冒充真实配装。

| 场景 | 实际结果 |
| --- | --- |
| 柯莱往返＋2新叶 | 非暴击2296.8、期望3070.8；逐击独立手算一致 |
| 仅把释放ATK改1500 | 历史新叶不变；非暴击2977.2、期望4091.4000000000005 |
| 柯莱C2往返＋4新叶及JSON | 非暴击3232.8、期望4100.400000000001；完整上下文及逐击trace往返一致 |
| 清除历史后 | 完整新叶阻塞，飞叶轮单击仍期望1020.5999999999999 |
| 夏洛蒂点按／长按 | 期望1663.2000000000003／3445.2；各5／9击 |
| 夏洛蒂已含A4及JSON | 长按仍3445.2；九击A4补入均0，未重复增伤 |
| 原生aura-v9＋target-phase-v2 | Hydro0／Pyro108，周期120帧，连续预热8周期；完整运行1200帧，窗口[960,1080)为1250伤／625DPS，period1 |
| 实际完整检查点 | 480、600、720、840、960帧同态；保存raw水量、衰减、来源槽、12帧物化年龄、48帧ICD、17帧伤害组和真实目标阶段状态 |
| 实际逆蒸发命中回放 | 原始2秒情景750伤，计算器全上下文恢复差0；可见公式与细节相同 |

正常循环边界的阶段队列为空是实际捕获结果；非空未来衰减任务、FIFO顺序、缺失任务和已经执行边界由新增核心用例验证，不以空占位数组认证。

## 剩余工作

柯莱C6、夏洛蒂C2–6、动态后续取样、实际反应触发和技能几何／帧／产球仍未完整实现；条件动作不代表整角色模拟。目标本地时钟、target-phase-v1/v3、感电／冻结／激化／燃烧／草核／结晶等生命周期、特殊注入及随机暴击／概率产球／西风私有状态仍不能用本轮普通闭合域证明完整稳态。讨龙、祭礼和追击武器仍是后续实现工作，不能把完成审计当成完成机制。

全游戏角色／装备／敌人、特殊来源冲突、可靠7.2V1快照和广泛外部整队对照继续见[已知限制](known-limitations.md)。[历史QA](history/qa-report-2026-09-24-before-collei-target-phase.md)保留上轮真实执行记录；其中试作星镰标签冲突的历史误述由本轮明确更正。120秒性能仍引用2026-09-23T06:42:28.209Z[既有测量](cross-validation/simulation-execution-benchmark.md)，未重测。

收尾 `git diff --check` exit0、无输出；HEAD仍为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`。该检查只覆盖已跟踪差异，不当作全机制验证。[日志](validation/collei-target-phase-diff-check.log)。
