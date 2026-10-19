# 固定来源事件攻击组件（112）

## 范围与实现

本批把原生事件监听调用建成独立、可编辑的来源组件。事件并非 E/Q 施放归属：`OnEnemyDamage` 的触发命中可能来自任意角色；`OnTargetDied` 的致死攻击是触发者，不证明目标先前状态由哪个动作施加。共享原生观察器覆盖 `OnEnemyDamage` 与 `OnTargetDied` 两类事件，不扩大固定来源技能合同或计划分母。

原生回执区分事件注册实例、事件发射、实际执行的监听调用及其显式登记的后续任务。嵌套事件保留父事件关系；观察阶段跳过的 gameplay listener 记录为 suppressed，而 nil/unsubscribed slot 不冒充活动监听。攻击和延迟任务通过本次调用内部标记的具体 queue site 连接，不按技能名、角色、帧邻近或全局时序猜测归属。实现审计见[设计记录](validation/source-event-ownership-design-112-20260930.json)。

## 两个已审阅事件站点

- **白术 C2 的 `OnEnemyDamage` 监听调用**：在真实 listener call 中记录触发者是否为场上角色及 C2 冷却分支，并只将该调用实际排队的 Gossamer Sprite: Splice 攻击接入组件。触发命中不因此归属白术 E。同一监听器安排的治疗不属于本组件；C6 可能产生的护盾和后续 Spiritvein 仍需实体／护盾生命周期证据。
- **达达利亚的 `OnTargetDied` 监听调用**：读取真实目标及其已有断流状态；若进入分支，登记实际 +5 帧任务和该任务排入的 Riptide Burst。致死攻击只作为本次死亡事件父项；断流状态先前由谁施加仍未知。手动 `KillEnemy` 可没有父攻击／派发身份，不能合成一个。

两者是 `baizhu.c2.enemy-damage` 与 `tartaglia.riptide.target-died` 两个审阅站点，共用 `source-host-event-collection-v1` schema，并以不同 `componentId` 区分组件。组件保留原 source context、事件与任务证据、目标派发／落空／待处理阶段和所选应用的可编辑公式；使用真实 `listenerCallId` 选取，而非动作名或帧匹配。它核对的是所选事件攻击的交付范围，不宣告完整 E/Q 或 full-cast。

## 固定源码审计的候选边界

[source event damage inventory](validation/source-event-damage-inventory-20260930.json) 列出 23 个候选 family：22 个两 lane 均存在，1 个仅 stellar；其中 2 个站点进入本批组件。其余 Raiden E、Dehya E、Mona Q/C2、Beidou Q、Nahida、Ororon、Traveler 等目前仅有静态调用图，不表示已接入或运行。inventory 不把只改增益、状态、冷却或治疗且无相邻排伤害路径的 hook 算作伤害组件。

本批不提升 60 个 finite contracts／51 项 plans，不宣称全角色事件 hook 覆盖。事件来源组件不增加游戏数据验证，也不替代一般角色 E/Q 方法合同。白术治疗及 C6 护盾后续攻击、达达利亚此前断流来源均未闭合；Shield C6、此前 Riptide 状态和 C4 仍受阻。

## 验收结果

classic 与 stellar 来源构建分别通过（16.09 秒、5.584 秒）；typecheck 通过（6.892 秒），talent registry 通过（0.197 秒），producer declarations 离线回归 1 项通过（3.073 秒），最终 typecheck + Web 构建通过（7.469 秒，Vite 1.33 秒）。浏览器重放最终通过 1 项（40.802 秒，个案 38.7 秒）。首轮浏览器检查因上下文投影继承严格 schema 而拒绝额外顶层字段；修复该投影，并按保存的原生记录更正完整 AttackTag 字符串后，重新构建并复用捕获通过。公共事件文档 schema 仍严格校验。

本批共执行一次原生模拟；浏览器重试复用首轮归档，未再次执行原生模拟（重试记录为 `nativeRunPerformed=false`）。完整捕获含 5 个注册实例、9 次事件发射、33 次监听调用；其中两个已审阅站点对应 2 个注册实例、9 次监听调用和 1 个已完成的延迟任务。选择的两个组件各有 1 次命中，逐击共享公式重放差均为 0，且本次事件攻击已结算；白术小计为 303.44568032812504，达达利亚小计为 125.39785272501312。导入／导出一致，共享核心编辑后小计有变化；缺少延迟 producer 的负例保持未闭合，页面错误为空。详细命令与汇总见[测量记录](validation/source-event-components-measurements-20260930.json)，浏览器原始结果见[团队结果](validation/source-event-components-team-20260930.result.json)及[归档捕获](validation/source-event-components-team-20260930.capture.json)。

早期构建失败来自不完整 `/tmp` 源码、缺失 Go module/protobuf 及 Go 1.25 标准库缓存；通过保留带日期目录并重新取得固定版本源码／工具链恢复，未改公式。以上是固定来源实现、共享公式重放和页面路径证据，不是游戏内验证、全技能闭合或覆盖提升。
