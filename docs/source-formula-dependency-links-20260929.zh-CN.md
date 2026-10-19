# 固定来源公式依赖链接与缺口边界（2026-09-29）

本批把来源公式的“算出相同数值”与“能证明该值被原生消费者读取”分开处理。只有经过消费者身份验证的公式来源，才连接到原生属性／标量增量；单独出现的数值 ID 不足以建立因果边。公式复算不重跑 Go 触发条件，也不提升游戏机制验证等级。

`verifySourceHostArtifactSupport` 从本次请求实际携带的 stat/scalar reads 和嵌套依赖取得候选 formula IDs，再验证该公式确实早于消费者、来源 commit 一致、规则 ID 与 modifier key 相符、公式重新计算值与记录相符，并检查实际 getter 的 read ID／step 序号／槽位、阶段、帧、持有者／受益者／目标和原生返回量。标量还核对 scalar kind 与原生读数；创建公式 ID 必须包含在该 step 的实际消费 ID 集合内。重复或含糊的候选不会任意选一个。验证成功后才在原生增量／标量节点及其消费者输入上添加共享公式来源边；否则原生返回量仍显示为观察值并保留 explanation gap。

同一验证表由盾、治疗、扣血等 helper request 消费：共享公式仍只计算本次实际金额，原生执行决定触发、门槛、目标、窗口、状态和应用时机。getter 差值、直接写入、边界前后值以及 AttackMod 的 `attackChanges` 都保留原始顺序和观测节点；如果没有可验证的公式消费者，差值不会被伪装成独立机制公式。`createSourceHostResult` 在处理这次运行已有的共享计算回执时收集各计算返回的 `explanationGaps`，不为补齐解释而再跑一遍来源角色或动作。

普通 `damage` request 现在通过 `source-host-damage-stat-links.ts` 接入面板来源 AST：ATK／HP／DEF缩放连接相应的基础、百分比、固定快照槽；EM只在精通缩放及实际增幅分支读取；CR按固定源码顺序钳制到 `[0,1]` 后连接暴击判断；CD连接暴伤槽。普通攻击标签分支按 b4 的 `AttackTagNoneStat=9`、a7 的 `AttackTagNoneStat=13` 区分；只有标签适用且请求伤害加成与实际元素／物理槽加通用槽之和完全相等时才连入普通伤害 AST。非适用分支只记录资格为 false 和常量零，不伪造一次未执行的属性读取。所有依赖均连到本次快照或同图计算，未重跑属性 getter。编辑最终面板的输入不借用原始历史 stats 节点。

剩余缺口现在精确到攻击字段。`AttackInfo.Mult` 可连接保存的角色倍率生产回执；若后续 AttackMod 有完整顺序和值回执，可沿实际 `Mult` 前后差展示观察变更，但该闭包内部仍未展开；缺表来源或变更链断裂时最终倍率保留为来源字段并注明未连接。非零 `BaseDmgBonus`（只作用于天赋倍率项，不乘 FlatDmg）、非零 `Elevation`（共享普通伤害和伤害组处理后再乘）、非默认组倍率，以及适用普通伤害的非零 `DefenseIgnore`，都仍需各自的来源生成式；当前公式只按真实字段顺序计算，并对这些非默认值报告 explanation gap。实际属性差异、直接快照修改和 `attackChanges` 不能替代其生成规则。

实际共享公式回放复用既有两lane档案，没有构建 Go 或重新运行角色／页面模拟。两lane各102条计算值全部精确复现；指定行秋 `Guhua Sword: Fatal Rainscreen 0` E首击（calculation #10）均为 `919.5508033975872`，差值0。该图199个trace nodes的child links均可定位；公式 #9 的行秋 A4增量链接到真实 read/step/13号属性槽及同一Hit；CR `0.25`、普通增伤 `0.2`、缩放值和FlatDmg同图依赖均已连通。编辑成最终面板后旧 stats links 会脱离，避免将历史回执套到编辑输入上。

缺口由原始回执逐项产生，而不是“所有闭包均不透明”的统一结论。所选命中的已知缺口只包括原生倍率 `1.68` 尚无可连接的天赋表读取／倍率生产公式，以及固定公式不重演原生触发和生命周期。该次运行另有8个无 `statProvenance` 的感电命中：FlatDmg组件均完整，但作为剧变基数输入的上游 EM getter 未捕获，对应反应基数按 producer ID 列出 EM 来源缺口，本击仍保留专用快照没有完整属性来源回执的说明；行秋5个Orbital缩放项与FlatDmg都为0，不因此制造面板缺口。聚合结果保留45条 `explanationGaps`，这是本次运行经 Set 去重后的不同文本条目；同类缺口可在不同计算节点分别出现，因此不是45种独立机制。

核心3个文件／6项测试全通过（Vitest 2.27秒，其中测试1.25秒；墙钟2.923秒）；Web typecheck+Vite首轮通过，墙钟4.961秒、Vite 992毫秒，仅有既存dynamic/static与chunk警告。没有运行本批Go构建、原生模拟或浏览器用例；输入是先前冻结的102 calculations／38 applications双lane档案，全部数值保持exact。测量与回放明细见[验证记录](validation/formula-links-measurements-20260929.json)及[回放结果](validation/formula-links-replay-20260929.result.json)。状态仍 `verification="provisional"`、`explanationStatus="partial"`；active verified 仍为 null，覆盖分类、数据指针与 `completeCast` 状态不变。
