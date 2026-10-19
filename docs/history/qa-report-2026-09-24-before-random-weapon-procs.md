# QA 与实测报告

更新：2026-09-24。本轮实现四类祭礼武器的真实技能充能重置及合法轮转反馈。独立单击／完整技能计算器继续是一等入口，不需要队伍或轮转。最终 goal 保持进行中；未提交、推送或部署。

## 实际变化

祭礼剑、大剑、残章、弓R1–5共用固定来源：概率40／50／60／70／80%，内部冷却1800／1560／1320／1140／960帧。代码保留源浮点表达式及严格小于比较。实际普通伤害先检查持有者在前台、明确战技标签、祭礼冷却、E已无可用充能且剩余冷却非零、伤害非零，再抽独立`sacrificial-v1`随机流；失败不开始冷却，到期等号仍阻塞。

同一持有者的技能变体共用真实串行充能槽。`cooldownStartFrame`到时才扣层，不在输入帧提前预留；每次入队保留自己的恢复时长。成功只恢复队首一层，余下队首从触发帧重新计满，旧worker失效。自然恢复、延迟启动与实际命中有明确事件顺序；重置反馈后续E施放、命中、产球、拾取和爆发资格，不是修改结果中的最终冷却数字。

正常团队页提供四种武器与精炼选择，合法轮转页可编辑冷却启动延迟，预览通过同一Worker真正模拟当前种子。结果和分析窗口显示抽样、门禁、单层恢复、队列前后状态与实际来源。关闭模型同步移除其专用延迟声明。固定来源安柏、诺艾尔和久岐忍示例仍检查武器身份，不允许附加祭礼后保留原契约。

完整JSON的独立结果校验从接受的动作与实际普通伤害重建队列和随机判定，并核对命令最早可用时间；不信任导入文件自报的重置日志。现有命中捕获仍直接回到独立计算器，共享完整数值核心和解释。

运行方案1.1.0使用真实基线；旧1.0.0结构方案显式拒绝祭礼。重复请求模板只按参考种子解析一次，随机运行共用请求表并各自执行冷却反馈，不能每个种子重新排出有利请求。随机诊断保存参考种子／选项／模板哈希；私有随机流、串行槽与延迟任务尚无完整周期状态，稳态证明继续阻塞。

主要代码文件：[共享祭礼参数](../packages/reaction-formulas/src/sacrificial.ts)、[串行冷却](../packages/reaction-formulas/src/skill-cooldown.ts)、[触发判断](../packages/sim-core/src/sacrificial.ts)、[模拟器](../packages/sim-core/src/simulator.ts)、[合法编译器](../packages/sim-core/src/legal-timeline.ts)、[独立结果回放](../packages/schemas/src/sacrificial-replay.ts)、[命令资格校验](../packages/schemas/src/sacrificial-command-integrity.ts)、[队伍控件](../apps/web/src/sacrificial-controls.ts)、[实际账本](../apps/web/src/sacrificial-ledger.ts)。现有execution-profiles／simulation-analysis／stochastic-startup及网页Worker／轮转面板相应接线，四类固定来源示例增加武器身份限制。

## 实际检查与失败记录

| 范围 | 实际结果 | 证据 |
| --- | --- | --- |
| 新共享来源／串行队列2项 | 首次2/2通过，85ms／测试7ms，exit0 | [专项](validation/sacrificial-shared-cooldown.md)、[日志](validation/sacrificial-shared-cooldown.log) |
| 新实际运行核心3项 | 首轮2通过／1失败：体力子夹具的闲置能力缺显式零费用；仅修夹具并复验第2项通过，957ms／测试70ms，另2项未重跑。该项同时覆盖新发现的同帧相位倒序修复 | [专项](validation/sacrificial-runtime.md)、[首跑](validation/sacrificial-runtime.log)、[定点复验](validation/sacrificial-runtime.retry.log) |
| 新结果完整性1项 | 首次1/1通过，1.07s／测试198ms，exit0；四类篡改被拒绝 | [专项](validation/sacrificial-result-integrity.md)、[日志](validation/logs/sacrificial-result-integrity.txt) |
| 新运行消费者1项 | 首次1/1通过，959ms／测试105ms，exit0；四条诊断轨迹保持同一请求表 | [日志](validation/sacrificial-runtime-consumers.log) |
| `npm run build` | 首轮两个TS收窄错误；事件联合类型拆分、新测试改等价条件取帧后，完整tsc及374模块构建通过，357ms。无数值或调度逻辑因此改动 | [首跑](validation/sacrificial-build.log)、[复验](validation/sacrificial-build.retry.log) |
| 新页面1条综合流程 | 首轮前部实际执行／capture／JSON全部通过；末尾strict后续循环因真实冷却不足停止。仅在正常UI选择wait后同一流程通过，2.4s／exit0，生产无改动 | [页面专项](validation/sacrificial-runtime-browser.md)、[首跑](validation/sacrificial-runtime-browser.log)、[复验](validation/sacrificial-runtime-browser-retry.log) |
| 唯一外部CLI | 首次exit0，0.020092416s，保存配置、summary、debug及31份源码 | [外部报告](cross-validation/sacrificial-external.md) |
| 本地外部对照 | 首次夹具目标ID／aura版本不合法，0.678863458s退出1，未进入战斗；仅修夹具后完整对照通过，1.722076666s。125源码指纹在该次运行前后一致 | [报告与失败记录](cross-validation/sacrificial-external.md)、[指标](cross-validation/sacrificial/sucrose-charge-reference.local-metrics.json) |

新增核心共7项均有通过记录，只复验失败／受影响用例；唯一新增页面流程通过，并已加入后续发布检查入口。本次只执行该新流程，复用冻结构建和已有4173预览，没有重启服务。没有旧全集、旧浏览器矩阵、性能重跑或大型Monte Carlo。构建保留大chunk和无效动态导入提示，构建耗时不是产品性能测量。

`git diff --check`最终通过（exit0），见[差异检查](validation/sacrificial-diff-check.log)。

## 实测数值与证据范围

| 场景 | 数值／实际行为 |
| --- | --- |
| 砂糖C1固定来源对照，R5、单人、三静止无附着目标、无卡肉 | 实际E1／57／113帧，SetCD10／66／122；99帧只恢复一层并重启剩余900帧，原910帧worker失效，999／1899自然恢复 |
| 外部及本地九击 | 每击36.491855604123714，总328.4267004371134；逐击与总伤残差全部0 |
| 本地相位与资源边界 | 99帧命中重置对默认phase0最早100帧，对phase8可99帧。零cancel的phase8后phase0请求调整为[1,2]，strict明确拒绝倒序；仅体力不足的等待114帧仍只归因于体力 |
| 完整捕获 | 九套capture→JSON→解析→共享计算器重放差全部0；完整当前result通过schema与独立回放 |
| 实际回能 | 143／199／255帧各拾取四风微粒，能量0→12→24→36 |
| 本地独立随机流 | 明确使用既有种子`sacrificial-consumer-reference`，首抽0.6284964594524354，严格小于R5概率后实际触发；没有注入外部reset |
| 正常页面实测 | E实际1／2／10帧，7帧恢复一层，队列2→1，第三E后回到2；旧601帧worker失效，607恢复。三击总1350、最终能量9，命中还原差0，完整JSON重载相等；一轮预热后仍明确steady-state-not-established、checkpointComplete=false |
| 固定请求随机诊断 | 请求表[1,10,1201,1210,2401,2410]在四条轨迹保持不变。参考运行第7帧重置，第二E实际10帧；失败种子首抽0.992040…，请求仍10而实际等待601帧 |

外部的summary与debug sample种子不同，gcsim共享随机序列也不同于本地独立子流；数值一致不表示同seed逐抽样一致。唯一外部样本没有覆盖失败roll、离场、零伤、错误标签、ICD等号、其他精炼或其他祭礼武器，目标几何有明确重叠warning。保留这些限制，没有重复外部运行以凑齐证据。完整模板重置不覆盖所有角色私有覆写；这些对照不认证完整砂糖动作库或当前官服机制。

## 数据、剩余范围与历史证据

本轮只增加四把祭礼的实际生命周期接线，没有把它算成新增独立伤害或角色技能。映射.18仍为120身份／941击／550完整条件动作／135部分／18具体阻塞；普通配装200武器／988精炼／53二件／44四件，独立追击3把／15精炼另列。

活动目录仍`gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空、preview0；9025字段组中5366缺失，正式verified数值／机制仍0。官方观察仍为2026-09-23 14:22香港时间。本轮没有重生成未变的目录或更新状态。

全量角色／装备生命周期、其余13把已审独立追击、角色卡肉／私有回调、复杂反应混合、完整随机稳态、敌人HP／盾及生命之契／死亡、可靠7.2预览和广泛整队外部对照仍未完成。未核验的数值不补零、不编造、不升级verified。见[已知限制](known-limitations.md)。

性能仅引用2026-09-23的历史测量：关闭trace中位30.500ms／p9533.336ms，开启129.735／148.481ms，随机29.397ms／34.01次每秒；本轮没有重测，详见[历史性能证据](cross-validation/simulation-execution-benchmark.md)。

上一轮讨龙的独立逐击记账、实际切人、外部六击对照与周期1证据冻结于[上轮QA](history/qa-report-2026-09-24-before-sacrificial.md)。
