# 观察生命周期、共享护盾与能量对照实施报告（2026-09-28）

本轮完成正常页面接线、两个来源 WASM 构建与必要的新流程验证。永久独立单击／单技能计算器继续保留；小毕业／大毕业配装、18 个队伍起步模板和装备导入沿用前批实现。全量 goal 仍进行中，不能把固定来源复现、条件动作或本地测试当作游戏机制 verified。

## 实际基线与当前数据

工作树为 `/Users/evan/Documents/gidps`，Git 基线 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`；大量既有未提交工作均保留。本轮没有提交、推送或部署，也没有重复旧基线全集。原压缩包与实际输入关系见[基线审计](current-project-audit.md)。

最新已记录的官方版本观察仍是 2026-09-24 14:48:17 UTC 的 7.1，本轮没有把它刷新成 9 月 28 日的新观察。活动数据 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`、快照 `953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34` 保持 released/provisional；verified 指针为空。正式元数据仍为124身份／127天赋／789能力／255武器／63套装／127命座；3把任务试用武器与252把普通武器分开。实际7.1.50两角色预览仍独立保存，1活动预览／4归档、可执行定义0，未证明等同所请求的7.2 V1。

本次生成映射 `.28` 为 **124身份、1255命中模板、713条件完整动作、16部分动作、0分类阻塞**，另8项已发生特殊组成单列；比前批增加6模板／3条件完整动作。Kachina旧单击部分行仍存在，新完整观察分支单列，不能从计数推断整角色完成。可组合 TypeScript 来源注册仍为15角色／57动作／89模板。装备生成统计为201定义／993精炼变体，其中173条件武器定义；53二件／48四件，包含部分条款。以上没有晋升 verified 或条件映射 team-ready。

## 本轮实际改动

| 路径 | 已实现行为 |
| --- | --- |
| `packages/sim-core/src/kachina-*`、`apps/web/src/calculator-kachina-controls.ts`、Optimizer映射 | C0 E的完整已观测寿命与编辑例题；C0 Q直接伤害；低／高空下落的一次碰撞加落地分支 |
| `packages/sim-core/src/alyosha-observed-*`、`apps/web/src/calculator-alyosha-observed-controls.ts` | 印记、精准、实际Q身份、攻击与A1治疗事件；修正角色目录ID绑定；不生成未知首击或次数 |
| `packages/source-host/patches/005–007`、`stellar-overlay`、`source-host-shield-formula.ts` | 两固定来源的玩家入伤、每面盾HP与穿透、并行盾最小穿透、Drain比例使用共享AST；原回调顺序保留；逐次动作拒绝日志 |
| `apps/web/src/source-host-energy-*`、`source-host-batch.ts`、worker/panel | 连续同一次运行的能量分窗、实际Q请求、多种子与额外ER网格、完整结果导出／导入与逐次打开 |
| `packages/game-data/src/weapon-extended-effects.ts` | 武器11435按固定Optimizer公式计算手动0–18档ATK；自动移动档数／退出清除仍缺 |
| `.github/workflows/data-discovery.yml` | 保存每周只读来源抓取工作流；尚未远端执行，不自动解析或晋升候选，见[执行边界](data-discovery-workflow.zh-CN.md) |

Luna承担覆盖盘点、装备缺口与文档／工作流整理；机制、共享公式及UI接线分别委派，主线程整合。没有重跑历史角色、历史页面、性能全集或大型随机矩阵。

## 已执行检查与失败记录

| 检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 数据生成 | 首次5.596s；映射版本递增后4.795s，均exit0。控制台基础目录120身份与运行时补充目录124身份是不同投影 | `validation/lifecycle-data-generate-20260928*.log` |
| b4 WASM | 首轮exit0，10.254s；41,903,094字节 | [构建日志](validation/source-energy-shield-classic-build-20260928.log) |
| a7 WASM | 首轮exit0，12.640s；61,515,572字节 | [构建日志](validation/source-energy-shield-stellar-build-20260928.log) |
| 类型＋网页生产构建 | initial缺optional undefined类型，retry1撞到并行修正测试的可空数组项；窄修后retry2 exit0，12.360s，659模块，Vite2.72s | [initial](validation/source-energy-lifecycle-build-20260928.log)、[retry1](validation/source-energy-lifecycle-build-20260928.retry1.log)、[通过](validation/source-energy-lifecycle-build-20260928.retry2.log) |
| Kachina受影响核心 | 最终修改后5/5通过，2.914s；早期5/5后shell保留变量错误也已留档 | [最终日志](validation/kachina-lifecycle-20260928.final.log) |
| Alyosha＋旧公式文件 | Alyosha3项通过；联合运行共6通过／1失败，Nefer夹具修改了已不使用的基础catalog。改为克隆实际运行workspace后只重跑该失败项，1通过／3跳过 | [原记录](validation/alyosha-observed-lifecycle-20260928.log)、[定点通过](validation/nefer-runtime-workspace-drift-20260928.log) |
| 新盾／Drain核心 | 4/4通过，兼容旧捕获缺失状态步骤时明确显示不可复现 | [检查记录](validation/source-host-player-shield-20260928.result.json) |
| 能量分析核心 | 早期3/3通过；之后修正跨窗失败区间与单帧结果，纳入最终构建及实际页面 | [原日志](validation/source-host-energy-analysis-20260928.test.txt) |
| 11435武器文件 | 子任务实际运行133/133通过、12.31s；该次仅工具输出，未保存独立原始日志；未为补日志重跑 | 子任务执行回执 |
| 新页面 | 首轮卡齐娜／阿罗夏2/2通过。两来源页面因测试默认满能而拒绝断言失败；首次夹具修正漏写GCSL的`+params`，仍满能；正确显式零能后仅重跑失败来源页，2/2通过，9.019s | [首轮](validation/source-energy-lifecycle-browser-20260928.log)、[夹具失败](validation/source-energy-lifecycle-browser-20260928.retry1.log)、[最终](validation/source-energy-lifecycle-browser-20260928.retry2.log) |

4个新增页面均已通过，但不是同一轮全绿；原失败保留。Kachina页面验证未完成寿命阻塞、应用两击例题、将接触改为未命中后减少总伤，以及JSON恢复；Alyosha页面验证实际事件控件与绑定，未声称完整Q。来源页面检查真实WASM、共享盾链、拒绝动作日志、ER修改、独立受击计算器恢复及浏览器无异常。

## 实测结果与复现边界

来源脚本固定6秒／360帧，诺艾尔C0、90级、天赋1、显式初能0，一次E、反复等待同一Q执行；第61帧假设物理受击12000。b4运行种子1、2 × 额外ER 0、20%，共4次；a7运行种子1、2，共2次。每次1次对敌命中／6次共享计算，对敌伤害668.5822293435001。初始日志ER由1.613变为1.813，能量均0→0；每次341条实际`insufficient_energy`拒绝是宿主逐帧重试同一命令，**不是341次成功施放，也不是341条用户命令**。增加ER没有制造粒子，所测候选均不满足能量要求，不据此断言任意ER无解。

两来源的本次受击均：原始12000，护盾吸收2750.769483240001，穿透／Drain尝试9249.230516759999；盾原始生命2750.76948324→0；玩家比例由1变为0.23377421621419195。回执保存两个`player-shield`、一个`player-shield-min`和一个`player-drain`步骤。独立恢复按相同数值上下文逐步求值；旧JSON仍可恢复护盾前伤害，但没有状态步骤时明确标为历史回执。

**发现的固定来源缺陷：**两次来源回执中的诺艾尔E盾元素都是`electro`。固定`internal/characters/noelle/shield.go`的`newShield`未赋`Ele`，而`attributes.Electro`枚举值为零。本轮如实保存这个来源行为，没有把盾元素静默改成岩，也没有将本次物理盾测量标为游戏验证。另有既存`Tmpl.OnDamage`按入射岩元素判断1.5，与`ShieldStrength`按盾元素判断的冲突。护盾生成倍率与部分属性闭包前置解释仍未完全展开。

浏览器记录的单次求值耗时（不含首次下载／WASM装载）b4为99.6、30.7、25.0、17.8ms，a7为325.6、80.0ms；样本小且受预热影响，只说明此6秒脚本，不作一般性能或随机稳态结论。完整结果：[b4](validation/source-energy-shield-classic-20260928.result.json)、[a7](validation/source-energy-shield-stellar-20260928.result.json)、[测量摘要](validation/source-energy-lifecycle-20260928.measurements.json)。

实际WASM SHA-256：b4 `457ee7fa1db6f1895ad3d80d16dc8b8a9d12efa01ffbdeb6e69d75d242e1ec74`；a7 `b38c27d8fb828f4a09a0cee6a1af3c4a2993c98d8722cab3e429796e81820bad`。manifest仅补充已执行的共享状态能力标签并留下metadataCorrections，未改WASM或原构建回执；后续构建脚本自动输出这些标签。

## 仍需完成

- 16部分动作和其余角色／命座／装备自动状态覆盖仍存在；观察事件协议不替代未知自动时序。实际分布及已有公式纠偏见[部分动作盘点](research/actual-partial-paths-20260928.md)。
- 11把普通武器不在a7注册中；其中现有5把有范围有限的TS条款，6把仍缺独立固定公式来源。8套缺注册套装有不同程度的描述／条款，不能称自动机制完成，见[精确ID盘点](research/equipment-execution-gaps-20260928.md)。
- 任意Go闭包检查点、完整角色被动推导、游戏验证及随机稳态还未完成；连续分窗和多种子统计不授予这些结论。
- 7.2 V1来源身份、字段缺失与preview可执行覆盖仍需证据；正式与预览保持隔离。新定期工作流仅发现已登记URL的字节变化，还不是自动数据候选流水线。

以下为各机制具体输入协议及限制，便于继续实施。

## 卡齐娜：冲天转转的观察寿命

普通计算器动作 `kachina-skill-observed-lifecycle` 带有实际事件 JSON 编辑器（`apps/web/src/calculator-kachina-controls.ts`），事件按帧排列，同帧由列表次序表达。示例数字只是格式示例，UI 明确不把它们当作技能时序。用户需记录初始 E 分支、搭乘/下车、每次实际震荡、震荡后的夜魂余额、目标接触以及最终耗尽和消失；必要时可附逐击历史最终面板快照。

`compileKachinaCastSchedule`（`packages/sim-core/src/kachina-cast-formulas.ts`）从 60 点开始，只处理输入事件，不生成震荡周期、首击帧或逐动作扣点。完整寿命汇总要求动作与切换均已记录、覆盖至实体消失、无燃素续航/替换/中断，并满足该固定倍率分支的 A1 全程未触发条件；事件必须符合夜魂余额不增加、形态与搭乘状态匹配、实际目标接触、耗尽后只允许结束等规则。只有实际接触目标的震荡成为伤害事件。若各击面板不稳定，应按事件关联快照；固定倍率分支以 C0 为界。独立的一次已发生命中可单独计算，无须推断后续寿命。C0 Q 的直接伤害是独立单次动作，其领域不展开后续伤害。

边界：此路径重放的是有完整证据的实际事件，而不是 Kachina 自动战斗模拟。燃素续航、命座补点、A1 实际触发后的逐击增伤、未记录的震荡、周期与点数推算都不在完整固定分支内。

## 阿罗夏：印记、猎人精准与 Q 的观察事件

普通计算器通过 `calculator-alyosha-observed-controls.ts` 提供 JSON 账本，并由 `resolveAlyoshaObservedLifecycle`（`packages/sim-core/src/alyosha-observed-lifecycle.ts`）按实际帧和同帧顺序重放 C0 事件。账本要求观察起点的印记、猎人精准和现存 Q 状态已知为空，并确认截止点事件完整、顺序已核、无卡肉。事件类型包括实际 Q 施放、前台切换、施印、猎场攻击、图加林撕咬和精准检查。

状态重放记录目标印记 15 秒生命周期；再次有效施印可激活并移除旧印，按事件记录附近队员取得 15 秒猎人精准。E 天赋等级决定精准攻击比例；星导增伤只在用户确认相应星导条件时记入。Q 以实际 `burstId` 建立 14 秒身份；猎场命中和撕咬必须逐条给出实际攻击身份，程序仅检查同类事件的 2 秒间隔，不把持续时间换算为次数或猜测首击。目标进入猎场、图加林接近目标、实际接触、前台对象以及 A1 治疗结算均需显式观察。若事件恰在印记/精准到期帧，需给出边界有效性确认。命中通过 `hitBindings` 绑定相应来源事件，且最终攻击力需符合该时点精准状态。

边界：静态技能表不能决定 Q 首击帧、攻击次数、目标移动/接近或实际命中；不完整的输入会保留问题并阻止该事件链被视为完整。该观察解析器限定 C0；C1–C6 与团队星导反应不是此生命周期的自动结算范围。

## b4 玩家盾与 a7 来源捕获中的共享盾/Drain 核心

`packages/sim-core/src/player-shield-runtime.ts` 实现了通用玩家护盾状态处理，固定来源配置标识为 `gcsim-b4ae769-template-v1`，状态为 `fixed-source-assumed`。它处理显式授盾/强效/受击事件、到期与覆盖、每次受击的护盾吸收和现有玩家受伤模型中的生命扣减；不运行角色专属护盾回调。固定模板受击算术把入射岩伤倍率设为 1.5、同元素为 2.5、其他为 1.0；代码也保留了 `ShieldStrength` 对盾元素判定的来源分歧，未以游戏实测解决。授盾时以当时声明的角色属性求值，之后属性变化不回算已有盾。

多盾分支各自承受完整入射值，最终穿透量取分支最小值，吸收量不能相加；相同类型且保护目标相同的盾覆盖。强效在一次受击中只读取一次，一次性强效也按此顺序消费。到期仅按管理器实际处理到期帧的相等条件触发；跳过该帧不会在之后补发。通用护盾的击中卡肉延长、角色特有副作用及未记录的授盾/受击事件没有实现为自动事件。

来源宿主协议（`packages/sim-core/src/source-host-wire.ts`、`source-host-formula.ts`、`source-host-incoming-capture.ts`）将来源运行给出的玩家实际受击回执接入同一公式上下文：复核护盾前伤害、各盾步骤、护盾后伤害与 Drain 尝试值之间的对应关系。回执完整时，`player-shield` / `player-shield-min` 状态公式和 `player-drain` 公式按实际步骤顺序重放，并检查 Drain 输入等于运行报告的 `drainAttempted`。普通 UI 的来源运行结果页可查看实际受击账本并打开独立计算器（`apps/web/src/source-host-panel.ts`）。

玩家盾 UI（`apps/web/src/player-shield-controls.ts` 与 `player-shield-panel.ts`）要求现有玩家受伤模型启用且帧率协议合法，采用显式绝对帧授盾、强效和入射事件；它不会重复周期、推导敌方攻击或由护盾状态自行生成敌人伤害。通用模拟器中的玩家盾运行时可将盾状态接到模拟器真实玩家伤害处理，但其配置受合法帧协议约束。

敌方盾状态器 `packages/sim-core/src/enemy-shield-runtime.ts` 使用暂定配置 `kqm-enemy-shield-gauge-20260925-v1`，只处理明确给出的盾定义以及实际创建、命中、反应/tick 和移除事件。标准强元素盾的反应系数仅接受表中有来源的元素组合；缺项表示未知/不支持，不是零。感电只按实际 tick 消耗，不从一次元素应用猜 tick 数。护甲/强盾、相位及额外抗性必须在具体场景声明；破盾一击转移到生命的伤害须有独立依据，否则结果保持未解析。AI、生成时刻、朝向、自然衰减、再生以及未提供的相位变化不会自动补齐。

边界：b4 的玩家盾分支带有明确的固定源码假设；a7/来源宿主回执分支重放的是所记录的一次真实来源运行及其公式输入。两者都不等于完整游戏敌我双方战斗模拟，也不解决来源明确留白的分歧。旧版来源结果若没有盾和 Drain 状态步骤，只能报告状态算术不可用；不能把缺少回执说成零吸收或零 Drain。

## 能量账本：实际动作尝试与原生模拟器成本

来源运行适配器 `apps/web/src/source-host-energy-analysis.ts` 从实际来源日志逐行读取能量 `particle`、`adding energy` 和 `draining energy` 事件，保留帧、角色索引、来源、前后能量、数量、实际获得与溢出，并读取最终面板 ER。它另将原生 `action` 日志中的 `executed ...` 记作已接受动作，将 `source-host action rejected` 连同动作和原因记作拒绝尝试。能量分析窗在总时长大于一帧时切为两个半开窗，一帧结果保留完整单窗；边界能量由来源能量轨迹索引映射，不会将两窗误作两次独立运行。

动作拒绝区间来自来源运行 `failed_actions`；若有拒绝区间却找不到相应尝试日志，分析会报告未匹配区间，并提供 `perAttemptFailuresComplete` 完整性标记。缺失原生日志并不表示没有尝试。结果页 `source-host-energy-panel.ts` 展示能量事件、动作尝试、区间统计和日志完整性信息，可从来源运行结果继续打开实际命中或玩家受击公式上下文。

本地模拟器 `packages/sim-core/src/simulator.ts` 也保留其自身的动作接受/拒绝与成本证据：能源不足的动作进入 `skippedActions` 并带原因和当时能量/所需成本；已接受动作记入 `actionLog`；能量消耗在需要时以 `reserve` 与 `debit` 逐项写入 `energyCostLog`，含帧、事件次序及前后能量/预留量。此日志是本地模拟器执行记录，与 GCSim 来源宿主原生日志是两套来源不同的证据，不能混称为同一运行轨迹。

## 来源宿主批量 ER 对照

当前工作树中，来源宿主结果页通过 `source-host-panel.ts` 挂载 `source-host-batch.ts` 的“多种子与额外充能对照”控件，并经 `source-host-worker.ts` 对每个候选实际重新运行完整来源 WASM。种子支持 1–32 个不重复 uint64 值；额外 ER 网格支持最多 8 个不同值、范围 0–500%。额外 ER 以单行完整角色声明之后新增 `add stats er=...`，只加显式 ER，保留其他属性；每个种子从脚本初始状态开始。前后两个统计窗取自同一条连续运行，不清空能量或随机状态。

汇总会按角色、附加 ER、来源提交身份与配置分组，统计成功 Q、能源不足拒绝与实际请求。只有观察到实际 Q 请求和至少一次成功Q、分析记录完整、并且没有能源不足拒绝的候选才会标为“观察范围内满足”；报告的最小值仅是已评估网格中的最小附加 ER。若没有 Q 请求，程序不判可行；网格中没有候选也不能推出任意 ER 都无解。冷却、动作锁等其他拒绝仍保留在尝试账本；有限种子的分布/均值区间不能证明稳态、单调性或圣遗物预算等价，也不做配装最优化。

集成边界：普通来源页面已按上文实际输入通过检查；这项验证不覆盖任意脚本、网格或随机稳态。

## 武器 11435：熔猎异端之刃手动档位被动

`packages/game-data/src/weapon-extended-effects.ts` 已把 `weapon:11435`（`hereticsmoltenblade`）注册为有公式的扩展被动。装备者需显式提供效果窗口 `weaponEffectActive` 和 `weaponStacks` 手动档位（0–18）；公式以活动武器目录精炼数值的上下限作线性档位插值，仅向攻击百分比属性添加被动。独立来源证据包括固定 Optimizer 武器表（`packages/game-data/sources/weapon-extended-effects/optimizer/libs__gi__sheets__src__Weapons__Sword__HereticsMoltenBlade__index.tsx.txt`）：档位 0–18，说明 14 秒持续/冷却；独立登记的预期值（`reviewed-expectations.json`）为 R1 档位 18 的攻击百分比 +36%、R5 +72%。生产解析器会核对当前活动目录描述和精炼数值与登记来源一致。

这不是按移动输入自动运行的武器生命周期：固定 Optimizer 只提供手动档位和攻击公式，没有上一秒移动距离到档位的映射。战技触发、每秒取样、14 秒效果/冷却计时、退场移除均未自动处理。手动档位是用户声明的输入条件，不能称作已经观察验证的移动距离结果；若有效窗口未确认或档位缺失，不得把未知条件默认为生效或零档。

## 验证状态

本轮实际命令、失败、修正和页面测量见上方验收表。收尾静态读取两个来源各自的package dist、public和网页dist，共六份WASM，大小及SHA-256均与manifest相符；`git diff --check`通过。此收尾没有新增模拟或重跑测试。
