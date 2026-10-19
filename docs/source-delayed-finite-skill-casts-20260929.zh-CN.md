# 固定来源延迟有限技能范围（108）

2026-09-29。本批把 107 的十项固定来源技能合同扩展至 **12 个延迟 producer 技能族、19 个显式 producer sites、共 21 个独立技能合同**。新增集合中有一个和 107 Bennett E 重合：现在 Bennett E 是一个统一技能合同，覆盖 press 与 hold 两条分支。静态合同描述源码排队的根 `AttackEvent`，不等同于目标数、命中数、派发数、伤害数或游戏实测。

这份报告以 107 的有限闭合规则为基础，记录 callback 来源标记和实际回执如何支持后续闭合判断。本批已完成双版本构建、定向回归和一条通过的 classic 浏览器用例；其 runtime 覆盖只含 Diona Q 与 Kaeya Q，Venti 终止分支的最后收窄没有重新跑浏览器或原生。

## 契约扩展

静态依据来自固定源 commit classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`、stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，producer 标记位于共享补丁 [`108-ability-producer-sites.patch`](../packages/source-host/patches/108-ability-producer-sites.patch)。producer site 清单见[静态审计 JSON](validation/source-ability-producer-sites-20260929.json)；每个方法、队列位置、callback 分支、子任务关系及源码 SHA 记录在清单中。固定计数针对方法分支；运行时仍须观察实际回执，不能根据施放时状态推算之后 callback 是否发出攻击。

| 技能范围 | 根攻击数规则 | 结束条件与关键边界 |
| --- | --- | --- |
| 罗莎莉亚 E | 固定 2：方法直接 1，角色本地 callback 再排 1 | 绑定 `rosaria.skill.followup` 子回调执行并排队第二击；命中回调产球／状态不是额外根攻击。实际全局帧可受 hitlag 影响。 |
| 罗莎莉亚 Q | C<2 为 6，C≥2 为 8：方法直接 1；callback 再排第二击及 4／6 段持续伤害 | 绑定一次角色任务并确认所有相关攻击派发／应用阶段结算；不能用状态到期推断未排攻击。 |
| 阿贝多 Q | 1 或 8 | 延迟 core task 运行时检查 `skillActive`：未激活为 1，激活则生成 7 朵生灭之花。必须读取该 task 的实际分支；施放时快照、目标数或任务队列长度不能决定结果。 |
| 雷电将军 Q 初始斩击 | 固定 1 | 仅限 Musou Shinsetsu 首击。后续架势中的普攻／重击来自之后独立玩家动作；C4 任务只增益。不能把初始斩击契约写成整个 Q 架势。 |
| 丽莎 Q | 初始攻击 1，加 30 个 discharge callback 的实际发射数；总数不固定（源码上限：C4 前 31、C4 起 91） | 30 个 tick 必须逐一记录开始、完成和实际发射数。C4 的每 tick 可发 0–3 击，受实体数与随机分支影响；首 tick 遇至少 3 个实体还可能提前返回。不能按最大值或 30 个任务数补齐。 |
| 迪奥娜 Q | 固定 7：初始 1，父任务建立 6 个子 tick，各发 1 | 父 callback 完成不代表闭合；必须确认六个子任务逐一执行、排队攻击并结算。治疗和 C1 能量、C6 增益不是根攻击。 |
| 娜维娅 Q | 固定 18：初始 1，角色任务建立 17 个炮击子任务 | 角色本地钟到达任务点后注册 17 个 core 子任务；每个子任务各排一击。到期帧会受 hitlag 影响，需按真实注册与完成记录判断。 |
| 凯亚 Q | 初始注册 3 条 ticker 根任务（C6 为 4）；总攻击数由递归运行分支决定 | 初始 ticker 数不保证产生 3／4 次命中。每次有效 ticker 发 1 击并注册下一 ticker；状态已结束或 `burstTickSrc` 已变更时停止。C2 击杀事件最多三次延长状态。须观察递归链实际终止并结算已排攻击，不能用猜测时长或某帧空队列闭合。 |
| 班尼特 E（点按与蓄力） | 一个统一 E 合同：press 有独立点按分支；有效蓄力等级 1：2 击；`hold_c4=1` 且 C4+ 时为 3；等级 2：3 | 两个蓄力 callback 各排一击；等级 1 的 C4 爆炸或等级 2 爆炸按有效输入额外排一击。hold 会被规范到 0–2，C4 的 `hold_c4` 可将等级强制为 1。press 不进入本批新增 producer site。 |
| 温迪 Q | 未成功吸收为 20；成功吸收为 35 | 20 个 Anemo tick 各发 1 击；吸收检查递归到成功或计数上限，首次成功另排 15 击。要等检查链及攻击阶段结束；因吸收字段共享可变，同一 Q 链关闭前不能重叠第二次温迪 Q 来冒充独立闭合。 |
| 甘雨 Q | 固定 50 | 方法先排 50 个 core tick；每个 tick 选目标或随机位置后各排 1 击。目标选择影响几何与实际应用，不能要求恰好 50 次命中来代表 50 次源码发射。 |
| 砂糖 Q | C<2 为 3–6；C≥2 为 4–8，取决于每个 tick 执行时的 `qAbsorb` | 初始风伤击数和吸收检查／tick 配对分别记录；吸收检查只改变状态、注册后继检查，不直接发攻击。须闭合全部配对 tick 与递归检查；同 Q 未关闭前不得让另一砂糖 Q 覆盖共享吸收字段。 |

19 个 producer IDs 由以上 12 行覆盖，其中包含可建立子任务的父 callback、子 callback，以及会递归注册自身的 ticker／吸收检查。相同方法内存在多个 ID；静态 site 的数目不是一次施放的 task 数。例如甘雨一个 site 在施放时注册 50 个 task，凯亚与吸收检查的 site 则可能递归多次。

## 回执与闭合所需证据

显式 `SourceHostQueueTask`／`SourceHostQueueCharTask` 给经审计的原生 callback 标记稳定 `siteId`，并交给既有原生调度队列执行。每个 producer 回执记录 producer ID、关联 invocation ID、父 producer ID、site ID、角色索引、注册帧、开始帧、完成帧、`pending`／`completed` 状态及 callback 实际排入的攻击。攻击回执包含原生 queue ID，并在原生 AttackID 可用时补上该 ID。子任务只在父 callback 实际注册时产生，并由父 producer ID 关联；递归任务通过实际父链和各自 site ID 连接。

闭合还必须把 `useAbility` 的实际返回／成功与方法直接攻击分开，然后沿“显式注册 site → callback 开始及完成 → callback 排入的攻击 → 派发完成 → 逐目标应用、落空或未决阶段”核对。仅有 ability 名、父链、某任务完成，或某个观察窗内的空队列都不能代替 site 级证据。等待时限和帧数不从理想间隔推测；例如角色本地任务帧与全局帧可能因 hitlag 不同。攻击机会如尚在途或无法解释，结果必须保留为 partial／pending。

Raiden Q 的范围尤其受限：producer `raiden.burst.initial-strike` 只覆盖初始 Musou 斩击。架势期间后来执行的转化普攻／重击属于后续动作输入，不会因 stance 仍在就并入这条有限施放。其余记录同样只描述列出的技能根攻击；武器／圣遗物／队伍追击、独立反应交付、之后玩家动作、治疗和增益生命周期不在该合同中。

实现集中在共享核心的 [producer 规则](../packages/sim-core/src/source-host-producer-plan.ts)、[任务闭合分析](../packages/sim-core/src/source-host-producer-analysis.ts)和[有限技能分析](../packages/sim-core/src/source-host-finite-cast.ts)。独立计算器与团队命中交接使用同一个[集合捕获入口](../packages/sim-core/src/source-host-action-collection.ts)，每击继续使用已有共享公式与可编辑结构化轨迹。界面分别显示固定预期数、运行后实际攻击数和未执行任务；角色源码路径与审阅细节收进可展开说明。JSON 保留所有关联任务及调用记录，重新导入时重新计算完整性。

## 实际测量与故障记录

实际命令和归档见[测量记录](validation/source-delayed-finite-measurements-20260929.json)与[浏览器结果](validation/source-delayed-finite-browser-20260929.result.json)。固定源码合同数为 12 families／19 sites／21 个含 107 在内的独立技能合同。classic build 6.262 秒、stellar build 6.875 秒、registry 0.183 秒均通过。Web 首次构建 3.616 秒因 finite UI alias 可能为 undefined 失败；收窄 alias 后 Web build 4.799 秒通过。producer regression Vitest 1 项通过（0.750 秒）。最终 Web build 4.779 秒通过。没有跑完整测试矩阵。

浏览器命令共尝试三次。第一次 12.416 秒：Diona 断言已完成，随后夹具使用非法的 90 级 Dull Blade，案例在执行 Kaeya 前失败。第二次 7.599 秒：页面在 disabled 控件准备好前导入，0 次原生执行。第三次 9.601 秒通过，`pageErrors=[]`，记录三次成功案例中的原生执行：

| classic 捕获 | producer／根攻击与重放 | 结果 |
| --- | --- | --- |
| Diona Q，15 秒 | 7/7 producer 完成；7 个根攻击、7 击共享公式重放 | 共享总伤害与原生总伤害均为 2334.666065224993；证书导入／导出一致；缺 producer 不能闭合 |
| Kaeya Q，12 秒 | 16/16 producer 完成；13 个实际根攻击、13 击共享公式重放 | 总伤害与原生一致，为 2966.6700854069763；有限范围闭合 |
| Kaeya Q，2 秒 | 5 个 producer 中 2 完成、3 pending；2 个实际根攻击和2击重放 | 已知小计与原生为 456.410782370304；范围保持未闭合，不把截断链标完整 |

三份归档合计 **22 条逐击重放断言，差值均为 0**。计数口径为四次原生执行：一次 Diona 执行在第一次浏览器失败前已产生断言，成功浏览器案例内另有上述三次；不能把前者从运行数中省略。三份归档、大小与 SHA 见测量记录。

一次来源审查发现 Venti 递归终止回执允许过宽；修正后只运行一项 synthetic producer 回归并完成最终类型检查／Web build，没有再运行 browser 或 native。该合成回归不是 Venti 原生样本。Venti 的吸收递归范围以实际 site 深度及攻击／子任务排队结果判断，不把此次单测说成游戏或原生机制验证。

## 验证边界

运行样本只来自 classic Diona Q 与 Kaeya Q；stellar 只构建，没有新增运行样本。其余 producer families、Albedo 的 1／8 分支、Lisa 与 Sucrose 的条件发射等仍是固定源码审计能力，并未逐项通过 runtime 样本。Raiden Q 合同仅覆盖初始 Musou 斩击，不包括后续架势普攻／重击。源码排队和 callback 终止证据不验证游戏内任务时钟、角色卡肉、碰撞／随机选点、反应行为或任何实战数值。

本批不改 released／preview 数据、数据指针或 `activeVerified`；游戏 verified、全角色 coverage 与 master 全量目标仍未完成。独立武器／圣遗物／队伍追击、反应拥有的攻击、后续玩家动作、治疗和增益生命周期仍在合同外。缺少必要回执或规则尚未覆盖的分支保持 unavailable／partial；已审阅分支也必须满足运行回执条件才显示完整范围，静态合同本身不代表游戏验证。
