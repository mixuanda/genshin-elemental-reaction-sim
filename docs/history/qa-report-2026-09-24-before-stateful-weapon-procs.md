# QA 与实测报告

更新：2026-09-24。本轮新增五把随机武器追击的永久独立计算入口、团队真实回调与完整命中恢复。最终 goal 保持进行中，全游戏机制仍未完成；未提交、推送或部署。

## 实际变化

新增吃虎鱼刀、试作古华、雪葬的星银、龙脊长枪和忍冬之果，独立追击累计八把／40精炼位置；三把霜葬的两档倍率展开后共55条件分支。本轮40个新精炼／条件组合由共享来源与计算核心核对，旧三把15组合未重复执行。普通配装和角色覆盖数量未因此增加。

独立计算器无需队伍或轮转。三把霜葬要求明确原触发目标在实际回调时是否含冰／冻结，未知留阻塞，不填无冰或零倍率。该条件只选择一次，整次范围追击共用；当前被算目标可以无冰。面板、精炼和条件可编辑，来源系数／条件AST由共享核心重建，JSON改条件而保留旧公式也会重新推导。倍率选择、ATK乘算、增伤、暴击、防御和物抗继续输出公式、变量、实际代入、中间值与解释；触发概率不乘进已经发生的一击。

团队新五把使用真实同帧同相位FIFO尾部回调，届时才检查前台、冷却、标签和抽样。霜葬读取真实回调时的原目标状态，而不是直接复制父命中的auraAfter。吃虎鱼刀先抽样再检查非零伤害，roll=0.5仍成功；试作古华和霜葬使用严格小于且没有额外零伤门禁。R5霜葬概率1仍消耗真实随机抽样。独立流`independent-weapon-proc-v1`可本地复现，不宣称与gcsim共享流同seed逐项相同。

成功回调保存实际面板、冷却、抽样、附着条件和选定倍率，下一帧作为独立物理攻击落地；期间目标附着变化不重选倍率。正常队伍控件、结果／分析账本、完整JSON和只读命中恢复均接入。结果校验独立复原回调相对位置、FIFO及原目标Cryo/Frozen谓词，不相信导入日志自报的条件；模拟命中桥接复用独立计算器的条件选择AST。

原三把沿用既有无随机回调和确定性检查点范围。新五把随机流及待执行回调尚无完整周期状态，因此检查点明确不完整，不认证随机稳态。批次附加真实随机政策；随机起步页也有声明与账本接线，本轮未单独执行随机起步全流程。特殊宿主、反应伤害回调、角色卡肉及任意gcsim跨类任务顺序仍不在已认证范围。

主要改动：[共享定义](../packages/reaction-formulas/src/independent-weapon-proc.ts)、[独立文档与条件准备](../packages/sim-core/src/weapon-proc-calculator.ts)、[共享计算器](../packages/sim-core/src/calculator.ts)、[触发运行时](../packages/sim-core/src/weapon-proc.ts)、[模拟队列](../packages/sim-core/src/simulator.ts)、[独立回放](../packages/schemas/src/weapon-proc-replay.ts)、[真实附着条件恢复](../packages/schemas/src/weapon-proc-aura-replay.ts)、[命中桥接](../packages/sim-core/src/calculator-bridge.ts)、[永久页面](../apps/web/src/calculator-ui.ts)、[团队控件](../apps/web/src/weapon-proc-controls.ts)、[实际账本](../apps/web/src/weapon-proc-ledger.ts)。类型、当前结果校验、Worker随机政策及已知限制相应更新。

## 实际检查与失败记录

| 范围 | 实际结果 | 证据 |
| --- | --- | --- |
| 新来源合同1项 | 首跑1/1通过，89ms／测试6ms，exit0；39份原文指纹，40新系数位置及25精炼冷却／概率。归档准备时一处源路径错误先修正，未称其为测试失败 | [来源报告](cross-validation/weapon-proc-five-source-audit.md)、[日志](validation/weapon-proc-five-source-contract.log) |
| 新独立计算核心2项 | 首跑2/2通过，354ms／测试176ms；40组合、未知条件、完整trace与JSON重推 | [日志](validation/weapon-proc-calculator-expansion.log) |
| 新结果完整性1项 | 前两次因新夹具目标ID／landed及合法时间线配置错误失败；只修夹具后1/1通过，1.25s／测试313ms，四类篡改均拒绝 | [全部记录](validation/random-weapon-proc-integrity.md) |
| 新真实运行核心3项 | 首轮2通过／1失败，揭示显式legacy选项被timeline内部覆盖。入口仅对新五把提前拒绝，原失败项复验通过1.08s／测试187ms，另2项未重跑 | [专项](validation/random-weapon-proc-runtime.md)、[首跑](validation/random-weapon-proc-runtime.log)、[定点复验](validation/random-weapon-proc-runtime.retry.log) |
| `npm run build` | 首次可选布尔／命中序号类型、旧三武器测试枚举范围及新页面命中夹具报错；窄修后完整tsc与375模块构建通过，466ms | [首跑](validation/random-weapon-proc-build.log)、[复验](validation/random-weapon-proc-build.retry.log) |
| 独立计算器新页面1流程 | 首次通过1.8s／exit0，无修复或重跑；正常条件编辑、只读来源倍率、面板保留及JSON全部trace相等 | [页面专项](validation/weapon-proc-five-calculator-e2e.md) |
| 团队新页面1流程 | 首次通过3.2s／exit0；正常控件、实际延迟回调、逐击恢复、完整JSON、检查点阻塞和仅2次batch随机政策导出 | [页面专项](validation/random-weapon-proc-runtime-browser.md)、[日志](validation/random-weapon-proc-runtime-browser.log) |
| 唯一固定外部CLI | 首次通过，0.018644s／exit0，保存原始配置、summary、debug及固定来源 | [外部报告](cross-validation/frost-proc-external.md) |
| 唯一本地外部对照 | 首次通过，1.100659292s／exit0；三击／总伤／三capture JSON／两独立文档JSON均零差，126源码指纹在该次运行前后一致 | [指标](cross-validation/frost-proc/charlotte-frostbearer-reference.local-metrics.json) |

新增核心共7项均有通过记录，必要改动只复验失败／受影响项。旧三把来源测试现在明确使用其原归档的三把名单，新五把由新来源合同覆盖；没有删除旧检查，也没有执行旧全集。两条新页面均首轮通过，已加入后续发布检查入口；本次只运行它们，使用一次成功的冻结构建和已有4173预览，没有重启服务。没有旧浏览器矩阵、数据重生成、性能或大型Monte Carlo重跑；构建的大chunk／动态导入提示仍在，构建耗时不是产品性能测量。

`git diff --check`最终通过（exit0），见[差异检查](validation/random-weapon-proc-diff-check.log)。

## 实测数值与范围

| 场景 | 实际数值／行为 |
| --- | --- |
| 独立页面默认ATK1000，90对90，物抗10% | 忍冬R1无冰：非暴360／暴击720／期望540；原目标有冰：900／1800／1350 |
| 正常编辑ATK1500、CR25%、CD120%，忍冬R5有冰 | 非暴2430／暴击5346／期望3159；JSON只改原目标条件false，重新得到945／2079／1228.5 |
| 清除原目标条件 | 显示阻塞，不生成总伤；切吃虎鱼刀R5保留面板得到2700／5940.000000000001／3510，没有额外乘50% |
| 同帧父物理命中之后火命中消冰 | 父命中记录仍有冰，但实际延期回调时原目标已无冰，霜葬R5选1.4；另一目标仍有冰也沿用1.4，两击各700，加宿主500总1900，JSON复现差0 |
| 冻结／历史分支 | 新生成Frozen可选3.6；落地前Frozen被其他命中消耗，已排追击仍沿用真实触发时3.6。R5抽样和到期等号边界有本地运行证据 |
| 固定外部忍冬样本 | 夏洛蒂N1起手1、14帧命中只打中原目标并新施Cryo；15帧范围追击两目标都用3.6，另一目标无冰且此前未中普攻 |
| 外部／本地精确伤害 | 宿主9.65933654375722，追击各69.76265017880414，总149.18463690136548；逐击／总伤残差0 |
| 完整还原与独立计算 | 三份capture→JSON→解析→共享核心差0；两个追击另用明确原触发条件的独立文档计算及JSON恢复，差也为0 |
| 正常团队页面 | 实际火命中eventSequence2后，回调sequence3读取Cryo=false／Frozen=false并选1.4，F1两次物理追击各700，总1900；原始roll0.8347660845611244仍draw0→1。命中与JSON还原0；预热检查点不完整；2次batch正确导出独立weaponProcPolicy与rngPolicy |
| 本地R5抽样 | roll0.46866409154608846，draw0→1，真实triggerAura={cryo:true,frozen:false}；未跳过100%概率抽样 |

固定外部只有这一忍冬R5、单N1回调、两目标样本，没有同帧竞争任务；它证明新施冰后的条件选择与同一次AoE共用系数，不能替代本地并发反例，也不验证其他四武器全部外部行为。summary与debug种子不同，外部共享随机流与本地独立流不同；只对实际发生的明确结果作数值和时序对照。源源码与目录一致不等于当前官服实测。

## 数据、剩余范围与历史证据

活动目录仍`gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空、preview0；9025字段组中5366缺失，正式verified数值／机制仍0。官方观察仍为2026-09-23 14:22香港时间。

映射.18仍为120身份／941击／550完整条件动作／135部分／18具体阻塞；普通配装200武器／988精炼／53二件／44四件。独立追击的8把／40精炼另列，不把条件数或自动接线虚增到普通装备映射。

其余八把已审追击、全量角色／装备生命周期、角色卡肉／私有回调、复杂反应混合、完整随机稳态、敌人HP／盾及生命之契／死亡、可靠7.2预览和广泛整队外部对照仍未完成。来源冲突或缺失不填零、不编造、不提升verified，详见[已知限制](known-limitations.md)。

性能仅引用2026-09-23已有测量：关闭trace中位30.500ms／p9533.336ms，开启129.735／148.481ms，随机29.397ms／34.01次每秒。本轮没有重测，见[历史性能证据](cross-validation/simulation-execution-benchmark.md)。

上一轮祭礼实际充能重置、真实后续E／能量反馈及九击外部对照，冻结于[上轮QA](history/qa-report-2026-09-24-before-random-weapon-procs.md)。
