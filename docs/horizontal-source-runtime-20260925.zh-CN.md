# `.26` 横向来源能力与运行时实施记录

更新：2026-09-25。独立单击／单技能计算器保持永久正常入口，不需要队伍。本批两项核心分别在retry3／retry7通过，唯一正常页面首轮通过，近期累计38文件／91用例、24页面。数据与2026-09-25的build.retry1已有通过记录；**该批结束时**，奈芙尔物化、感电旧到期、草核priority及位置随机流修复尚未包含在build.retry1中；其后已由[`.27`最终构建](broad-coverage-runtime-20260925.zh-CN.md)收口，原构建与失败记录不改写。全量goal仍进行中；本文档整理没有运行任何检查、提交或部署。

## 数据与来源口径

固定映射`gcsim-b4ae769+a7dc4bf+optimizer-180a0a1-reviewed-hits.26+durin.8`为120身份、1200命中模板、666完整条件动作、16部分、0分类阻塞。相对`.25`净增9模板和4完整条件动作，解决此前水长E两性及伊安珊的3个分类阻塞；不将“0分类阻塞”写成全游戏机制已完成。另有Linnea两项、Sandrone六项**已发生特殊组成命中**，共8项，按`actual-component/partial`单列，不计完整施放、team-ready或verified。

可组合来源注册仍为`gcsim-b4ae769-composable-abilities-v1`：5角色、10可执行动作、38命中模板，其中既有5个C0 Q和本批安柏完整N1–N5。它是独立分母，不增加条件动作计数。正式目录保持released/provisional，数值／机制及四种scope的verified仍0，条件映射team-ready仍0。真实7.1.50预览保持独立快照；缺匹配来源定义不采用正式数据回退，没有新增7.2V1身份或游戏核验声明。

## 实际实现

| 范围 | 本批代码与正常产品行为 | 保留边界 |
| --- | --- | --- |
| 来源普攻连段 | 正常团队能力入口一次加载、编辑和删除同一角色的完整安柏N1–N5，保留用户属性、配装及初能；正常轮转按钮和DSL共同生成`sourceNormalChain: next-v1`。实际接受输入才选择下一段，等待和拒绝的Q不重置；成功非普攻和真实换人重置。真实段号、起手／取样／命中、状态前后、指令回链进入结果及完整JSON | 显式指定N段仍严格校验；固定来源、C0、无卡肉和受限单目标域，不等于全角色普攻或攻速／碰撞模型 |
| 普攻回能 | 用户正常勾选后采用既有`fixed-source-independent-stream-v1`并声明弓类型；合并原模型，不填满初能。账本记录实际抽样和入账 | 本地具名流不承诺与外部gcsim同seed共享序列 |
| 水主长E | 两性来源协议记录真实HP事件、同帧顺序、释放、露滴／洪流／芒性实际命中和历史快照。充盈仅统计本次实际符合条件的耗血，独立已发生洪流不依赖未来日程。正常控件、共享AST、最终面板和JSON贯通 | 观察帧是明确输入，不是自动认证的固定发射间隔；不自动推导打断、替换、目标接触或资源生命周期 |
| 伊安珊Swift | 使用真实普通攻击天赋身份和系数；实际25帧伤害与33帧动画分开。普通／重击资格、前置普攻、夜魂及体力按输入分支检查；只有本击前已存在A1才增加攻击，本击触发的新A1不反向加成本击 | 独立单击保留本击资格和旧A1实际份额；未完成整个E／Q／夜魂自动循环 |
| 特殊组成命中 | Linnea直接月结晶与Sandrone星超导／星扩散进入同一特殊核心；实际状态、被动已含份额、转换源属性、历史快照与最终面板保留。Sandrone光束采用独立原始倍率，来源冲突留档 | 8项仅为实际已发生组成，不声称Lumi或多阶段特殊实体的完整生命周期 |
| 奈芙尔有限幻戏 | 实际观察的两段普通混合ATK／EM与三段直接月绽放，共5击；保留两个执行者的顺序、真实露滴／使用次数、帷幕与独立8秒EM增益状态。完整施放、装备转最终面板和JSON经同一核心 | 直接月绽放不误乘3；三层帷幕不自动推定EM增益有效。该有限动作不等于整个影舞／露滴自动资源系统 |
| 周期反应检查点 | 感电、燃烧、草原核和结晶的真实私有状态、待队列、来源快照、相对时钟、位置随机流已接入；不由页面或输入重建状态 | before2／before32的实际待队列、位置随机状态与完整JSON断言通过；捕获状态不等于周期1、分布收敛或任意队伍稳态 |
| 正常账本 | 来源连段账本显示实际状态；三处正常日志分页已合并并通过构建 | 分页没有额外专项页面测试，不把构建当成分页实测 |

主要生产落点为`source-action-controls.ts`、`workspace-panels.ts`、`source-normal-chain-ledger.ts`、`calculator-hydro-resolved-controls.ts`及共享来源编译、DSL、合法执行与结果校验；水主、Swift、特殊组成和幻戏各自的context／schedule／formula模块接入统一准备、最终面板和JSON流程。周期捕获范围另见[真实状态说明](validation/periodic-reaction-checkpoint-state.md)。没有在UI复制伤害公式。

## 执行检查与保留的失败

本批只有1个新增核心文件、2个聚合用例，以及1条新增页面流程；未增加每角色矩阵。两项核心分次通过，页面首轮通过；近期累计38文件／91用例、24页面。已通过第一核心项自retry4起跳过，重试不重复计数。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 数据生成／一致性／状态 | 首轮exit0，墙钟4.674／4.999／3.669s | [生成](validation/remaining-horizontal-data-generate.initial.log)、[一致性](validation/remaining-horizontal-data-check.initial.log)、[状态](validation/remaining-horizontal-data-status.initial.log) |
| 分类计数最终读取 | exit0，1.606s；120／1200／666／16／0 | [分类](validation/remaining-horizontal-classified.final.log) |
| 类型／生产构建 | initial类型接线失败，窄修后2026-09-25的retry1 exit0，3.232s、582模块、Vite510ms；只对应当时树，后续四项核心修复由`.27`最终构建收口，原chunk提示保留 | [首次失败](validation/remaining-horizontal-build.initial.log)、[通过](validation/remaining-horizontal-build.retry1.log) |
| 核心第一项 | retry3首次通过，此后不重跑；该轮第二项仍失败，整轮Vitest2.93s／墙钟3.402s不是第一项单独耗时 | [retry3](validation/remaining-horizontal-core.retry3.log) |
| 核心第二项 | retry7首次PASS，1通过／1跳过、测试460ms、Vitest2.96s／墙钟3.455s、exit0；retry4起仅执行第二项 | [retry7](validation/remaining-horizontal-core.retry7.log)／[退出码](validation/remaining-horizontal-core.retry7.exit) |
| 保留失败 | initial至retry6均exit1；原始日志及同名退出码完整保留，具体归因见下表 | [initial](validation/remaining-horizontal-core.initial.log)、[retry1](validation/remaining-horizontal-core.retry1.log)、[retry2](validation/remaining-horizontal-core.retry2.log)、[retry3](validation/remaining-horizontal-core.retry3.log)、[retry4](validation/remaining-horizontal-core.retry4.log)、[retry5](validation/remaining-horizontal-core.retry5.log)、[retry6](validation/remaining-horizontal-core.retry6.log) |
| 唯一正常页面 | 首轮1/1PASS，用例2.6s、Playwright3.9s、墙钟4.483s；复用4173 | [页面日志](validation/remaining-horizontal-browser.initial.log) |

每份执行日志的同名`.exit`保留实际退出码；失败记录没有覆盖为成功，重试不重复计数。构建初次包含测试联合类型收窄、审计字段穷尽联合、特殊描述字段与optional接线错误，修正类型不改变数值断言；其中下一批资源文件参与类型检查，不表示已获本批运行时验收。

夹具修正与生产问题分开记录：Swift最初使用了不真实的角色／天赋ID，改为目录中的`character:10000110`／`talent:iansan:combat1`；幻戏误用普通天赋后改为真实战技身份；周期输入的几何原点及几何／脚本选敌互斥也属于夹具。retry2的奈芙尔`undefined.stats`是真实生产转换遗漏：普通两段只有实时EM修正而未物化最终快照，特殊三段已经有快照；修复`equipmentPanelForConversion`按幻戏实际逐击EM窗口物化普通两段后，五段均保存EM200，保持原JSON／trace断言。其他生产问题包括generic-next命令实际解析能力的结果回链仍按anchor校验，以及周期状态的早期相对时钟／旧草核优先级校验。没有通过修改伤害期望、降低schema完整性或移除回放断言掩盖失败。retry6又暴露检查点schema没有注册`dendroCorePosition`／`crystallizePosition`两条实际流；补齐流schema并将帧前drawCount与真实spawn日志核对，retry7通过。各轮保留如下。

| 核心轮次 | 实际通过／失败 | 具体归因 | 墙钟 |
| --- | --- | --- | ---: |
| initial | 0／2 | 夹具：Swift身份；生产：next-v1实际能力回链 | 3.519s |
| retry1 | 0／2 | 夹具：幻戏天赋身份及aura-v9火／雷接触缺几何 | 3.650s |
| retry2 | 0／2 | 生产：奈芙尔普通两段最终快照遗漏；夹具：几何center误作origin | 3.686s |
| retry3 | 1／1 | 第一项通过；第二项夹具同时声明几何与脚本选敌 | 3.402s |
| retry4 | 0／1，另1跳过 | 第二项生产：感电到期记录缺对应Reactable.Tick关联 | 3.299s |
| retry5 | 0／1，另1跳过 | 第二项生产：草核接触旧priority约束拒绝实际任务相位 | 3.370s |
| retry6 | 0／1，另1跳过 | 第二项生产：检查点schema未注册草核／结晶位置随机流 | 3.394s |
| retry7 | 1／0，另1跳过 | 两位置流schema及帧前实际spawn抽样核对补齐；第二项全部断言通过 | 3.455s |

统一门使用的目标为`packages/sim-core/src/remaining-horizontal-source.test.ts`与`apps/web/e2e/remaining-horizontal-source.spec.ts`；失败后核心按第二项名称定点筛选。数据命令为`npm run data:generate`、`npm run data:check`、`npm run data:status`，构建为`npm run build`；页面使用`GIDPS_PREBUILT=1`及已运行的4173生产预览。本文没有再次执行这些命令。

## 实测结果

正常页面保留初能7／11。实际普攻段号为`1,2,3,4,5,1,2,3,1`；起手帧`0,26,48,97,131,191,229,251,280`，命中帧`24,46,85,133,167,215,249,288,304`。229帧Q因能量拒绝，随后实际N继续推进；总普通伤害为1900.6000000000004。该页面时序与核心采用的显式绝对帧夹具不同，不能混用两者的总伤。

水主页面实际独立洪流非暴／暴击／期望为1865.5200000000002／3731.0400000000004／2798.28；编辑后为2027.5200000000002／4055.0400000000004／3041.28；完整明确两击为2218.32／4436.64／3327.4800000000005。完整计算文档恢复一致，`completeCalculatorRestored=true`。

核心第一项独立算式包括：水主两份历史ATK1000／2000与本次耗血800的期望合计3106.08，独立洪流2798.28；Swift实际NA1系数0.84194，旧A1作用后ATK2160的期望1227.54852，24体力阻塞，未启用旧A1的独立单击1136.619。Linnea／Sandrone的实际A4转换进入特殊公式，奈芙尔5段装备、最终面板和完整JSON保持相同上下文及数值。这些是明确合成输入下的来源公式检验，不是当前官服实测。

第二项实际通过before2／before32的感电／燃烧待队列、草核／结晶生成状态及相对期限检查；两条位置流从drawCount0到1，恢复真实随机状态后的下一抽与实际生成记录一致，完整检查点JSON断言通过。这是测试断言的实际验收范围；Vitest日志没有打印独立的测量对象，不虚构console输出、总伤或period1结论。

## 未完成范围

本批当时最后构建及页面通过发生在奈芙尔普通两段物化、感电旧到期关联、草核优先级和位置随机流schema修复之前。这些改动当时仅有相关核心通过记录；后续已由[`.27`最终统一构建](broad-coverage-runtime-20260925.zh-CN.md)覆盖，3.673s／625模块／Vite590ms。原`.26`构建及页面并未重跑，不借用其旧结果冒充后续检查。当前仍有16部分动作、全量被动命座／形态、一般团队动作库、更多装备生命周期与混合空间反应；7.2V1身份和独立验证证据仍缺。

工作树中正在接入的resources、weaponstack、enemyshield及bowfamily属于下一批；不计`.26`已验收，不因通过本次全工程构建而视为运行时完成。没有重跑历史全集、性能、大型随机、外部模拟或真实UID实验。
