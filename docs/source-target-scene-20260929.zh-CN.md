# 固定来源静态多目标场景与伤害汇总（2026-09-29）

本批在来源队伍草稿和单角色单动作草稿中增加静态初始目标场景：首目标加可复制、添加和删除的额外目标；每个目标分别保留既有档案与初始几何，可选择独立的统计主目标。`apps/web/src/source-target-scene.ts` 验证目标列表与统计索引，`source-target-scene-controls.ts` 渲染编辑器和示意图；`packages/sim-core/src/source-host-target-summary.ts` 按原生 application ID 和 targetKey 汇总各目标 raw damage、applied damage、HP loss 与命中数，再计算全目标和统计主目标结果。目标声明序号、原生 key、统计目标和初始默认目标分别保留。

统计主目标只决定分析归属，不修改原生锁定、default target 或攻击分配。单技能入口只汇总与所选动作关联的 application IDs，不显示 DPS，也不把未关联应用纳入该次关联统计；没有该关联的伤害证据时保持未知。团队来源结果汇总全部实际应用；实际运行覆盖完整配置时长时显示统计主目标及全目标固定窗口 DPS，否则清楚标为实际观察时长伤害率。结果保留可展开的逐目标应用 trace 与场景快照。此功能仅支持静态起始场景，不支持动态移动、目标phase／无敌、敌盾或完整施放认证。

验收依据为[汇总测量](validation/source-target-scene-measurements-20260929.json)及[浏览器结果](validation/source-target-scene-browser-20260929.result.json)。窄单测首次 4/5：目标汇总的速率节点误引用 raw grouping 对象；仅重跑修复后的 summary 文件，2/2 通过，其余三个场景测试首次已通过。classic／stellar native build 分别 5.783／6.831 秒，registry 0.182 秒。Web 首次 4.622 秒因 `exactOptionalPropertyTypes` 类型错误失败，修复后 6.358 秒通过。唯一浏览器用例 14.971 秒通过，`pageErrors=[]`；两次实际 native runs 都是 classic，stellar 本批仅编译。

两次运行使用同一三目标 GCSL 与 seed，仅更改统计主目标。单技能案例选择目标 2（index 1，key 2），原生初始默认仍是 key 1；目标 1、2、3 的 raw/applied 汇总分别为 `1161.8921525418264`、`645.4956403010146`、`0`，第三目标 0 hits，全部 raw total `1807.387792842841`。团队案例选择目标 3（index 2，key 3），原生默认仍为 key 1；全目标总量完全相同，所选统计主目标 raw damage 为 0。主目标切换没有改变 native applications；四个逐目标回放差均为 0。队伍目标复制、删除及 JSON 恢复成功。截图显示表格可横向滚动；目标靠近时图中编号文字会重叠，但编号列表仍能区分目标。

这批交付的是初始静态目标场景与 application 汇总，不等于 master §22 的完整敌人模型或 verified 数据。适用 DEF modifiers、enemy shields、phases／invulnerability、移动目标以及 source/game 行为验证仍是独立缺口；coverage、`verified`、数据指针及 `completeCast` 均未提升。103 报告提议的静态多目标汇总已由本批交付；下一项待审查方向改为共享敌方状态及初始 DEF modifiers。此前 9 月 29 日数据证据仍显示 7.1.51、7.2 V1 身份未确认及项目数据指针不变，详见[既有证据刷新记录](data-evidence-refresh-20260929.json)。
