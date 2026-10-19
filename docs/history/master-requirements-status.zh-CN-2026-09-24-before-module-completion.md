# 主提示全量要求完成矩阵

审计日期：2026-09-24。依据：完整读取用户指定的 [GENSHIN_DPS_MASTER_PROMPT_EN.md](/Users/evan/Downloads/GENSHIN_DPS_MASTER_PROMPT_EN.md)，共588行，修订日期2026-09-22；逐节核对当前工作树、生成清单、实现模块及已保存的验证记录。本次只读审计并写入本矩阵，**没有运行测试、构建、生成器、状态更新或外部请求**，也没有重新观察正式服版本。

**全部要求尚未完成。** 独立计算器已是可工作的永久产品入口；共享公式、执行轨迹、可编辑教学和有限模拟支持都有实际证据。当前主要缺口是全量可执行数据、证据到产品的贯通、通用动作与资源机制、特殊反应适用域及完整状态覆盖。继续给少量角色添加条件命中或重复其测试，不能代替这些要求。

本文中的“已验证”只指链接记录中确实执行过的、范围明确的检查或外部样本，**不等于当前官服机制 verified，也不等于当前脏工作树通过完整发布检查**。源码存在、文档写了支持、类型或构建通过，均不能单独获得这个状态。

## 状态与当前分母

| 标记 | 含义 |
| --- | --- |
| **证** | 有真实执行记录；只覆盖记录中的输入、规则版本、代码快照和范围，本审计未重跑。 |
| **码** | 当前代码路径存在，本轮未执行验证；包含仍在并行修改、尚未完成整批验收的代码。 |
| **缺** | 尚未完成，但存在可继续实施的代码或数据接线工作；不能统称为外部阻塞。 |
| **源** | 指定数值、行为或版本证据缺失／冲突；需补证或保持阻塞，不能填零、猜值或直接晋升。 |

以下数字读取已生成清单，表示不同对象，不能相加或混成“完成率”：

| 对象 | 已保存状态 | 不能推导出的结论 |
| --- | --- | --- |
| 最近正式发布观察 | 2026-09-23保存的7.1；活动目录released/provisional；`activeVerifiedDataset=null`；preview快照0、archive快照4 | 不是2026-09-24实时核查，也不是7.1完整机制已验证。 |
| 原始目录 | 124角色身份、127天赋集、789 ability、255武器、63套装、127命座集 | ability及描述不是可执行伤害动作；变体与身份不能混计。 |
| `.18` 条件命中映射 | 120身份、941击、550完整条件动作、135部分动作、18具体阻塞；这些映射推导的team-ready为0 | “完整条件动作”不等于完整角色或可自动执行轮转。 |
| 条件装备条款 | 200武器、988精炼实例、53二件及44四件套映射 | 不证明整件装备的触发、计时、叠层、消耗、快照及团队交互齐全；实际无被动武器不应算缺被动。 |
| 更新证据字段 | 9025个字段记录，其中5366缺失；正式数值／机制及各scope verified计数仍为0 | 来源交叉一致及本地重放通过不能被改名为正式游戏验证。 |
| 独立武器追击 | 上一已验增量为12把／60精炼位置／75条件分支；当前共享定义已扩至16把，新增20精炼位置，单列于装备条款之外 | 最后四把定义／来源已写入但本轮0测试／0构建；Messenger只有一次外部样本，本地对照被暂停；其余三把自动触发仍明确阻塞。不能把定义数改写成已完成验证数。 |

来源：[活动状态](../packages/game-data/src/generated/update-status.json)、[命中覆盖](../packages/game-data/src/generated/classified-hit-coverage.json)、[装备实施](weapon-hit-effects-implementation.md)、[最新已保存QA](qa-report.md)。武器名册252普通名称与255源记录间有3项任务变体，独立武器分母仍为partial；无全项目统一完成百分比。

## 逐节要求与实际落点

| 主提示 | 当前实现与证据 | 未完成要求与需要修改的模块 |
| --- | --- | --- |
| **§1 两个同等重要的产品** | **证** `/calculator`、`/examples`独立于队伍；主导航、单击／整次技能、共享核心及模拟命中回放已经落地。`app.ts`、`calculator-ui.ts`、`calculator.ts`、`calculator-bridge.ts`；[计算器规格](single-skill-calculator-spec.md)、[回放说明](simulator-calculator-replay.md)。 | **缺** 团队端仍是有限可执行模型与来源情景，未达到全量角色／装备／反应范围；见M03–M09。永久计算器及既有导入／导出／比较须继续保留。 |
| **§2 实际基线与信任修复** | **证** [实际基线审计](current-project-audit.md)先于重构；选用`84ff5cd`，记录Archive.zip实际上为课程文件、旧原神包与legacy逐字节一致、提示候选路径不匹配、Git与归档哈希；`docs/baseline/`保存六类实际检查，无lint脚本明确标出。历史复现与正确性向量分离。 | 已有基线证据不能代替当前改动后验收。**码** 本轮在途代码由整批交付统一归档；不重做已冻结基线，不覆盖用户工作树。 |
| **§3 完整独立技能流程** | **证** 三种面板模式、真实分类动作、有效天赋、角色等级／突破／命座、目标与逐击条件、选中依赖阻塞、JSON和公开展示柜；`character-calculations.ts`、`calculator-import.ts`、`equipment-controls.ts`及核心上下文模块。 | **缺** 135部分动作、未接被动／命座／形态需扩展；旧装备条件仍可能在配装阶段整体拒绝；逐击EM改变转换来源时仍要求最终面板绕过而非自动重建。修改`character-mappings/`、`equipment-build.ts`、`calculator.ts`，见M03/M04/M10。 |
| **§4 范围、归属、条件反应** | **证** `single-hit/one-cast/custom-sequence/team-rotation`有明确接口／产品用途；逐击先算再合计，列入／排除命中、无时长不报DPS；条件反应与自动Aura判断分开。 | **缺** 通用持久实体与角色全部归属／生命周期尚未覆盖；实际完整轮转边界指标尚缺。`source-action-library.ts`、实体运行时、`simulation-analysis.ts`，见M05/M07。 |
| **§5 执行轨迹** | **证** `calculation-trace.ts`包含类型化AST、规则／解释key、输入单位／来源／上下文、状态、未舍入结果和独立display；同一表达式产出数值、公式和代入。页面、报告、例题及回放复用。 | **缺** 新增每个可执行规则仍须接入同一轨迹与回放，不能只写说明。没有发现需要另建解释引擎的理由；已存在的内容不应重复实现。 |
| **§6 每步公式与教学** | **证** 普通、剧变及条件特殊公式均有实际步骤；`calculator-trace-view.ts`保留“阶段／数值／公式”三列与展开解释、变量、代入、结果和来源，未用舍入UI反算。 | **缺** 对未实现的角色／装备／特殊交互没有完整教学结果；必须随其可执行定义完成，而非用通用文案补齐。14项细分见下表及M10。 |
| **§7 可编辑例题** | **证** `WORKED_EXAMPLES`加载真实计算文档，经同一个`calculateDocument()`执行；普通ATK、HP、DEF、混合、资源条件、增幅、激化、剧变、逐击反应及特殊条件公式均有入口，非伤害事件不伪造伤害。合成与来源角色分离。 | **源＋缺** 当前真实角色例题为source-backed/provisional，`verified-game`类别尚无真正完成的实例；五个特殊完整游戏例题仍blocked。需版本匹配的完整输入和机制证据，然后接`game-worked-example-inputs.ts`，不能将合成例题改名。 |
| **§8 教学A** | **证** 共享核心和页面已有实际记录：最终ATK2000、非暴击2902.5、暴击6385.5、期望5340.6；百分比与独立加算位置、概率加权复核可编辑。`worked-examples.ts`、`calculator.test.ts`、`apps/web/e2e/calculator.spec.ts`；[例题说明](worked-examples.md)。 | 当前功能已落地；本轮未重复运行。后续共享核心改动只需相应必要回归，不应反复单独重建此例题。 |
| **§9 教学B** | **证** 2760＋1104＝3864；错误捷径4416、高估552由同一表达式执行，正式总量排除反例；入口为反应前／暴击前已解析伤害，无DPS。 | 当前功能已落地；不得拿预设资格当真实角色反应覆盖。 |
| **§10 独立证据与readiness** | **证** `update-schema.ts`拆分release／processing／numeric／mechanic／support，保存逐字段拒绝／冲突；解析器没有把百分比自动认作verified ATK；独立名册已建立但武器分母仍partial。 | **缺** 可信字段证据尚未贯通运行时和UI，当前多处固定provisional；仅晋升快照不会让已验证命中获得依赖级信任。`update-lib.mjs`、`character-calculations.ts`、`calculator.ts`／UI，见M01。 |
| **§11 全量数据与机制** | **证** 精确等级／突破、合法精炼、圣遗物槽位／稀有度／等级／主副词条及投词历史已有；AST支持混合、条件、上限、转换和队友输入。身份／变体与scope有独立计数。 | **缺** 全released角色的全部相关动作、被动、命座、解锁与时序尚未实现；装备条件条款不等于自动生命周期；4个无命中身份及18阻塞应分类型处理。修改`game-data/src/character-mappings/`、效果映射、`mechanics`、来源动作库；见M03/M04及证据阻塞表。 |
| **§12 持续更新与渠道** | **证** manifest替代固定生产版本；immutable快照、released／official-next／preview／archive、lastAttempt／lastSuccess、候选验证、原子晋升及回退已有，preview不得默认激活。 | **缺** preview workspace目前仅保存／显示快照ID，尚无独立目录装载与计算入口；**源** 7.2 V1结构化快照未取得。修改`update-data.mjs`、运行时目录选择、`update-panel.ts`和calculator加载，不借机污染released，见M02。 |
| **§13 README与更新文档** | **证** README事实块、`docs/update-status.md`、CHANGELOG与discovery／sync／normalize／classify／validate／diff／status／promote／rollback／preview命令已存在；历史版本文件保留。 | **缺** 部分专题说明落后当前代码，且全量差距此前没有统一映射；见M11。生成字段的“观察”和“本地生成”必须继续分开。 |
| **§14 来源与安全摄入** | **证** 固定仓库提交、原文字节、hash、映射、取样时间、外部工具及手算记录均有归档；运行时读取本地数据，不按点击抓Wiki；下载内容不作为可执行指令。 | **源** 部分官方正文hash为空、版本来源／规则冲突未解决；不能用页面外壳、检索摘要或相互复用上游数据冒充独立游戏证据。新增来源须继续记录实际许可／归属与获取范围，不能由旧归档推定所有来源许可已审。 |
| **§15 普通／Lunar／Stellar** | **证** 普通反应、非伤害状态和实体已有独立模型；月／星公式及五种受限真实模式、Lunar混合v1/v2已落地，不是普通反应改名。 | **缺＋源** 特殊直接能力、一般元素混合、多目标、空间、角色和FPS相关交互未齐；源固定Luna VI／7.0不自动认证7.1。`reaction-formulas`、各特殊runtime／calculation、`simulator.ts`及Worker，见M08。 |
| **§16 贡献者与非线性期望** | **证** 有去重／资格、逐贡献者暴击后排序、加权／归属，最多四人16组合精确枚举；伤害所有权和UI暴击标签分开。 | **缺** 特殊贡献者种子抽样与有状态反馈的随机执行未接；当前精确期望只对声明的独立暴击无反馈域成立。**源** 各特殊枝的资格／并列／空间证据仍需逐项核对，不可统一权重算法。见M08。 |
| **§17 模拟事件、状态、实体** | **证** 纯核心与Worker分离；60FPS整数tick、相位／FIFO、动作占用／取消、切人、能量、体力、静态生命、周期实体、快照及来源插件已实现。 | **缺** 角色卡肉、动态最大HP／生命之契／死亡复活、完整召唤物交互、一般延迟冷却与共享动作槽仍缺；现有相位不能冒充所有gcsim任务语义。见M05/M06/M09。 |
| **§18 编辑器、连击、执行档** | **证** 可视编辑和DSL共用合法执行器；N前缀与单击不同，已有动作的C/E/Q、hold别名、swap/wait/dash/jump/repeat、strict/wait和显式延迟档可执行。 | **缺** schema与DSL没有walk／plunge动作类型；来源动作库主要仍为安柏、诺艾尔、久岐忍固定情景；全角色真实取消／体力／产球尚未接。`rotation-dsl.ts`、`legal-timeline.ts`、schema、`workspace-panels.ts`及动作库，见M05。 |
| **§19 窗口与DPS** | **证** 15/18/20/60/90/120秒及自定义，半开区间、完整时长分母、跨周期连续状态、主目标／总目标指标已有。 | **缺** 独立“实际完整可执行轮转”汇总与完成边界尚未提供；当前首个配置周期不一定为完整轮转，sustained也不能自动标steady-state。`simulation-analysis.ts`、`analysis-panel.ts`，见M07。 |
| **§20 能量、起步、稳态、ER** | **证** full／zero／custom、真实扣能／失败、粒子／晶球／随机量／到球切人／ER分配／固定回能／溢出账本；连续预热与有限周期检测；ER有限网格不假设单调；随机W/2W×zero/full起步敏感性诊断存在。 | **缺** ER“任意ER无解”分支遗漏动态产球；随机与未导出的反应／时钟／私有队列不能证明完整稳态。`simulation-analysis.ts`、`phase-checkpoint.ts`及各runtime，见M00/M09。 |
| **§21 基准与随机** | **证** legacy110级零能120秒和KQMS-inspired/custom分开；暴击资格、独立种子、样本分位数／均值区间、Worker取消进度及运行身份保存已有。未冒称KQMS合规。 | **缺** legacy“无外部／击杀粒子”只有声明与不额外注入，现有粒子来源尚不能结构化审核输入全部满足；通用特殊随机域仍缺。修改能量来源schema、`benchmark-profiles.ts`及M08。全KQMS并非必须强称完成，允许明确custom及偏离。 |
| **§22 UID、敌人、UI** | **证** 公共Enka TTL／错误／ID映射／实际有效天赋／面板导入；未知身份不借用demo技能；主导航8类入口、每击回放、比较签名、普通命中分页、中文标签及部分状态／键盘控件已有。 | **缺** 正式敌人HP、盾耐久、阶段血量门及掉能实体缺失；部分资源／日志仍仅基础控件或整表输出，不能称全部大日志虚拟化、全部无障碍已验收。目标与能量来源模型见M06；大日志和标签按真实界面继续补，见M11。 |
| **§23 计算器回归门** | **证** CI `calculator-gate.yml`和`check:release`串联数据门、unit、build、calculator E2E；A/B、编辑、导入、JSON、选中依赖、逐击回放和preview隔离有真实历史证据，详见下表。 | **码** CI配置存在不等于远程CI本轮通过；最新专项记录不代表重跑全套。后续改动按影响范围验证，并在整批交付完成必要检查，勿以新增测试数量替代生产实现。 |
| **§24 全面正确性／交叉验证／性能** | **证** 普通边界、Aura／ICD／实体／能量／快照、特殊受限枝有固定源与集成记录；多个有限外部样本与捕获复算。120秒trace开关及随机吞吐有真实历史测量。 | **缺** 全量可模拟动作／效果的覆盖与独立验证尚未齐，不能由单个命座或样本推导全角色；不同证据维度需贯通统一状态。性能仅对应2026-09-23旧源码，非当前速度承诺。见M01/M03/M04/M08/M11。 |
| **§25 交付顺序、文档与中文报告** | **证** Stage A/B基本产品基础已落地，所列必需文档均存在，当前中文报告与原始日志保存了结果和失败。 | **缺** Stage C/D/E仍有以下模块工作；本矩阵是完成差距记录，不是以路线图替代实现。主QA、实施报告、CHANGELOG由主任务统一更新；总goal不能据本文或局部通过标完成。 |
| **§26 发布阻断条件** | **证** 已有永久计算器、真实trace、动态例题、共同核心、缺失门和渠道隔离；没有将规则更名当实现。 | 12项具体门见文末。必须在剩余模块实施时持续保持；未通过或未运行的检查不能改写为PASS。 |

## 计算器教学14项逐项覆盖

这一表说明实际可执行分支的教学基础，并不把未接角色机制宣称为已解释。入口／公式缺必要依赖时显示阻塞，不能补一套看似完整的算术。

| §6条目 | 当前落点 | 剩余边界 |
| --- | --- | --- |
| 1 身份、版本、模式、单位、假设 | 文档`dataIdentity/gameContext/assumptions`、UI审计、trace inputs与JSON | 验证身份贯通仍缺M01，部分普通原始来源显示仍需中文说明。 |
| 2 角色／武器基础值 | `equipment-build.ts`＋`buildStats()`，精确等级和突破来源 | 导入／manual final不反推未知白值；这是正确边界，不是要造数据补全。 |
| 3 百分比、固定值、buff、转换、cap | `buildStats()`及来源效果AST，前／后转换绑定 | 逐击EM影响尚未重建的派生面板、旧整体条件门待M10。 |
| 4 有效天赋和精确系数 | 分类映射、有效等级、角色上下文、来源向量与trace | 未分类、冲突、命座等级依赖不能借用别的系数，待M03及源审阅。 |
| 5 ATK／HP／DEF／EM／混合 | 普通terms和`baseDamageFormula`共享AST | 全量角色尚缺；特殊等级基数目前显式输入，不能随等级插值。 |
| 6 基数乘算／追加和次序 | 基础公式、来源additive、独立加算、激化分别执行 | 各未接效果仍需自己的来源顺序，不套通用乘链。 |
| 7 增伤资格 | 元素／攻击tag／武器／反应类别筛选及排除原因 | 条件式装备支持不代表自动窗口，待M04。 |
| 8 DEF及减防／无视 | 普通公式与目标状态；剧变／特殊明确不适用 | 敌盾／HP阶段未建，待M06；不可伪装成普通DEF。 |
| 9 RES分支 | 共享抗性表达式、来源减抗及最终覆盖记账 | 缺失目标或动态规则不能默认已生效。 |
| 10 反应资格、所有者／贡献者 | 条件计算、自动事件桥、特殊贡献者表达式 | 多目标／混合／新直接能力和来源资格待M08。 |
| 11 暴击资格及四种模式 | 非暴击／暴击／期望共享核，普通实际采样trace与capture | 特殊随机贡献者和反馈的完整期望未接；不能先平均后排序。 |
| 12 独立修正、cap、资源条件 | typed AST、各逐击角色上下文、特殊规则 | 尚未执行的资源生命周期仍用明确条件，不算自动机制。 |
| 13 最终单击 | 共享执行结果和未舍入machine value | 本轮在途Messenger弱点增量尚无本地完整验收，不能扩大本项已验范围。 |
| 14 逐击聚合／纳排 | `includedHitIds/excludedHitIds`、整次总量AST、例题B反例 | 自动实体和完整轮转的完整归属仍待M05/M07。 |

## 可并行完成的模块差距，按收益与依赖排序

优先修明确错误与横向基础，再按独立来源清单批量扩展；不要把下一轮又缩成“一个角色、一条测试”。每项列的是生产交付，不是新增测试清单。

| ID／优先级 | 需要完成的生产结果 | 直接修改模块与依赖 |
| --- | --- | --- |
| **M00／P0 能量结论正确性** | 修正ER无解判定。当前只看静态`action/ability.particles`，漏西风等回调动态产球，可能错误宣称任何ER都无解；未穷尽动态来源时只能说本次bounds内不可行。 | `packages/sim-core/src/simulation-analysis.ts:135`，与动态球源声明对齐；独立于全量角色开发。 |
| **M01／P1 证据贯通** | 将审阅过的字段／规则依赖从快照投影到真实输入和结果；按所选命中晋升，不让未相关新角色阻塞已验证命中，也不整库盲升。当前可信库参数未传UI，装备／特殊结果又无条件暂定。 | `packages/game-data/scripts/update-lib.mjs`的`materializeRuntimeSnapshot/createRuntimeIndex`；`update-schema.ts`；`apps/web/src/character-calculations.ts`、`calculator-ui.ts`；`packages/sim-core/src/calculator.ts`的trust/provisional判定。先保持现有诚实降级，再接真实证据，不为增加计数伪造verified。 |
| **M02／P1 隔离预览工作区** | 实际选择／导入一个preview快照、构建隔离目录与计算文档、明显标渠道、独立导出且禁止verified比较；V1补充及后续版本保持immutable并可diff。 | `update-data.mjs`、`manifests/runtime/`选择层、`update-panel.ts`、`character-calculations.ts`和calculator装载。工作区可开发；真实7.2 V1输入另属S01，不能先造样例冒充。 |
| **M03／P1 全量角色可执行定义** | 对当前独立名册逐角色／形态列明N/CA/plunge/E/Q、初击／持续／协同、passive/C0–C6、解锁条件；按已有固定来源批量完成135部分动作与其余可接定义。4项冰旅行者完整动作应作为现有源接线工作。 | `packages/game-data/src/character-mappings/`、`classified-hits.ts`、`current-skill-blockers.ts`、`packages/sim-core/src/*-calculation-context.ts`、`packages/mechanics/`。建立scope级缺项而非增加character-wide布尔门。S02/S03单独补证。 |
| **M04／P1 全量装备可执行机制** | 已支持的数值条款继续保留，补尚缺窗口／叠层／刷新／消费／触发／队友归属；按固定来源清单分组接入，不混淆“有文本／条件式／自动运行”。苍翠固定源九段已知，自动排程／吸引是可开发缺口；水仙资格／粗帧与昭心冲突分别处理。 | `equipment-build.ts`、武器／套装effects与source manifests、`independent-weapon-proc.ts`、`weapon-proc-lifecycle.ts`、`simulator.ts`／callback hooks。最后四把共享定义及Messenger代码在途，待整批必要验收；不得重跑既有12武器证明所有255条。 |
| **M05／P1 通用动作执行与来源库** | 将普通动作的共享E串行槽与延迟SetCD从祭礼专用域解耦；补walk／plunge、适用空中条件与取消；批量接真实N链／tap-hold／Q、体力、粒子、快照、实体，替代只靠少数固定情景。 | `packages/schemas/src/schema.ts`、`rotation-dsl.ts`、`legal-timeline.ts`、`source-action-library.ts`、角色source-action模块、`simulator.ts`、`workspace-panels.ts`；来源状态与M03联动但可并行。 |
| **M06／P1 敌人及通用生命资源** | 增加实际敌方HP、护盾／免疫／阶段切换的可执行状态、HP阈值与击杀掉能；粒子来源区分技能／外部／击杀，令legacy无外部掉球约束可审核。角色动态maxHP、生命之契、死亡复活应由来源范围驱动。 | `EnemyProfile`及结果schema、目标runtime／`target-controls.ts`、`energy.ts`、`player-health.ts`、`benchmark-profiles.ts`。不能以现有结晶盾事件当作全敌盾已实现；也不能猜通用盾系数。 |
| **M07／P2 完整轮转与归属指标** | 分开请求周期、真实完成周期、观察窗；提供完成轮转／开场／固定窗／持续／已建立稳态、主目标／总目标的清楚指标与归属，处理跨界实体尾段。 | `simulation-analysis.ts`的窗口与`simulateWithStartup()`、`analysis-panel.ts`、结果schema及导出。依赖M05真实执行边界，不用末击时点替换分母。 |
| **M08／P1 反应全适用域** | 已有独立普通／月／星模型上补可核实的特殊直接能力、贡献者种子抽样、状态反馈、一般混合／多目标／空间。星旋高跳目前`consumptionImplemented:false`应继续接实际消费行为。 | `packages/reaction-formulas/src/special.ts`、各`*-calculation.ts/*-runtime.ts`、Aura／entity、`simulator.ts`、`lunar-simulation-worker.ts`和面板；S04冲突字段保持阻塞，不能删guard冒充完成。 |
| **M09／P2 完整状态与随机起步** | 扩大真实checkpoint序列化到复杂Aura生命周期、目标时钟、未导出私有任务和随机流；只对捕获完整的域判定确定周期。随机运行使用既有W/2W诊断并明确残余敏感性，不许诺随机状态精确循环。 | `phase-checkpoint.ts`、`ordinary-aura-checkpoint.ts`、`target-phase-checkpoint.ts`、各reaction／weapon runtime、`stochastic-startup.ts`、`simulation-analysis.ts`。四状态武器已证明的确定性域不应继续一律blocked；五随机追击／祭礼仍是独立缺口。 |
| **M10／P2 计算器依赖与教学闭环** | 将旧常驻装备缺条件的整体拒绝逐步改为实际所选依赖；对逐击EM影响来源转换的场景重建正确派生面板与trace；来源达到门槛后补真实完整游戏例题及特定特殊实例。 | `equipment-build.ts`、`calculator.ts`的`pendingHitEffects`／派生绑定、上下文模块、`game-worked-example-inputs.ts`、`calculator-trace-view.ts`。保留历史快照与已含记账，不强迫用户为无关命中补状态。 |
| **M11／P2 交付状态与产品收尾** | 统一scope分母、数据浏览缺口与产品状态；将被实现超越的文档段落收敛到当前实情；补实际仍整表输出的大日志和无障碍缺项；最后报告真正修改与必要检查，明确历史性能。 | `update-status.ts`、`workspace-panels.ts`／日志面板、`reaction-support-matrix.md`、`rotation-dsl.md`、`benchmark-profiles.md`、`simulator-calculator-replay.md`。根任务维护主QA／实施报告／README／CHANGELOG，不由本审计覆盖。 |

## 需外部证据或争议解决的清单

| ID | 实际阻塞 | 可同时继续的工作 |
| --- | --- | --- |
| **S01 7.2 V1** | 当前没有可固定、可复现的结构化preview输入；0快照不等于“字段为0”。 | M02隔离工作区与真实快照导入流程；保存实际取得时间与已观察实体，不能声称已摄入。 |
| **S02 14项明确分类冲突** | 旅行者风Q×2、草Q×2、水长E×2、男性重击×7、伊安珊迅闪天赋等级绑定×1。需解决来源差异或保持对应动作阻塞。 | 不阻塞其余已知命中；另4项男女冰旅行者完整E／条件Q是已有源尚未接线，归M03，不混入此表。 |
| **S03 4身份未映射** | 奇偶男女、沃雅妮莎、薇斯纳在已检查固定gcsim与固定Optimizer中无对应实现。此事实不证明所有可访问来源均不可取得。 | 建立准确缺字段与其他来源审阅入口；其余120身份继续完成，不借用demo或同名系数。 |
| **S04 特殊规则版本／空间** | 月来源标Luna VI，星来源7.0；星旋计数、实体类型、181／180帧、冻结贡献者、月笼／云中心空间及FPS依赖仍有固定源冲突／缺独立证据。 | M08实现已确认规则与明确受限输入；未确认条件不靠重命名普通反应或移除校验消失。 |
| **S05 装备来源冲突** | 例如笛剑Optimizer固定2导致R1–R4与gcsim/catalog不同；昭心目录／Optimizer倍率与固定gcsim五档均冲突，后者还缺50%门；部分武器属性区、时长和粗帧仍有冲突。 | 保留逐条sourceNotes与provisional；实现已经选定且声明的固定源模型，不把多个来源同上游一致当作官服verified。详见[最后四把来源范围](cross-validation/weapon-proc-final-four-source-audit.md)。 |

## §23的13项回归契约及真实证据范围

现有发布门配置为`npm run check:release`。下表是现存证据映射，本次没有执行这些命令；历史PASS与本轮在途变更明确分开。

| 契约 | 实现／检查落点 | 当前结论 |
| --- | --- | --- |
| 计算器独立运行 | `apps/web/e2e/calculator.spec.ts`的独立路由例题；`app.ts`路由 | **证**，无需队伍或轮转。 |
| 无关机制不阻塞所选命中 | `calculator.ts`选择依赖、`calculator.test.ts`及各历史快照／条件上下文专项 | **证**于已接协议；旧装备整体条件门仍有M10缺口。 |
| 相关缺失不返回假零 | calculator schema／dependencies、分类数据门及对应单元例 | **证**于已实现范围，不能证明全部未分类机制已被枚举。 |
| A/B精确算术 | `worked-examples.ts`、calculator核心与E2E | **证**，数值及解释共源。 |
| 显示代入／中间值来自trace | `calculation-trace.ts`、`calculator-trace-view.ts`、E2E逐行比较 | **证**，不存在另算的静态教学表。 |
| 编辑输入不留旧解释 | calculator输入重算及A/B编辑E2E | **证**；新上下文仍按其新增范围交付。 |
| 导入与装备不双计 | `calculator-import.ts`、最终面板转换、公开showcase mock E2E | **证**，真实在线UID未因mock通过而被声称已测。 |
| 技能合计＝纳入命中之和 | `calculateDocument()` totals AST、例题B、完整条件技能专项 | **证**于已定义命中／条件，未实现生命周期不算入。 |
| 不适用修正有解释 | `equipmentHitExclusions`、特殊／剧变trace及核心例 | **证**于现有公式。 |
| 暴击三分支遵守资格 | shared ordinary／transformative／special公式与随机捕获 | **证**于现有域；特殊随机反馈仍M08。 |
| 完整模拟命中可复现 | `calculator-bridge.ts`、result schema、外部／本地capture专项 | **证**于实际捕获的普通／剧变／受限特殊事件；截断或缺上下文明确阻塞。 |
| JSON保留输入、scope、假设与版本 | calculator document／capture parser、往返与篡改拒绝专项 | **证**于已落盘合同；当前在途schema变更尚需整批必要验收。 |
| preview／synthetic不混入verified | update激活门、calculator身份标签、比较签名、preview E2E | **证**隔离门；真实preview目录加载产品路径尚缺M02。 |

Playwright已覆盖技能选择、展开步骤、例题编辑、mock展示柜、导出重载和模拟命中；截图未被用作数值证据。最近已保存专项QA列明失败后的窄修／定点复验，并非“全部既有测试又通过”。目前没有新增测试建议清单；先完成相应生产模块，再用与改变有关的现存门和必要增量证据验收。

## §26发布阻断条件映射

| 禁止回归 | 现有保证与仍须保留的边界 |
| --- | --- |
| 计算器消失或要求先组队 | 永久`/calculator`和主导航；后续团队扩展不得替换。 |
| 只有总乘数或泛泛解释 | AST实际执行＋三列表＋展开变量／代入／结果；M03/M04/M08新增规则必须同样接入。 |
| 静态例题脱离计算 | `WORKED_EXAMPLES`加载真实文档，A/B及特殊条件编辑调用同核。 |
| UI与模拟器不同公式 | UI仅渲染，普通／剧变表达式和特殊核心共享，bridge复算。 |
| 缺值默认为0／ATK／verified | 分类和依赖门保持阻塞；M01只接真实证据，不整体升级。 |
| 无关缺口封锁已知单击 | 已选命中依赖协议保留；M10处理尚余整体装备门。 |
| relevant缺口被静默忽略 | 当前来源条件及被动停用声明不等于完整角色；缺失须显式报告。 |
| 全技能强行相同反应 | 各命中独立条件／实际上下文、共享合计；例题B保留。 |
| 月／星只是普通改名 | 独立特殊公式／状态／实体与显式适用域；未接域保持缺／源。 |
| preview／synthetic混入正式数据 | 渠道、激活与排名门；M02使用独立workspace不改released默认。 |
| 固定版本仅换另一固定版本 | manifest和来源观察驱动；7.1是保存观察，7.2 V1是待取得目标。 |
| 无证据报PASS／全覆盖 | 每条实际记录限定输入、源码快照与执行结果；不得将本矩阵或构建通过当作完成证明。 |

## 证据有效期与文档漂移

- [当前基线审计](current-project-audit.md)保存的是原始基线；[2026-09-23性能](cross-validation/simulation-execution-benchmark.md)的trace关闭／开启中位数为30.500／129.735ms，随机暴击吞吐34.01次／秒。它们都不是当前工作树重测结果，也不是收敛Monte Carlo伤害分布。
- 四状态武器的[确定性检查点实证](validation/stateful-weapon-proc-checkpoint.md)为32秒、1880伤害、58.75 DPS、period1；只证明完整捕获的有限域。普通闭合Aura也已有支持，不能继续将“所有Aura／所有武器”写成一律阻塞。
- [Messenger外部样本](cross-validation/messenger-external.md)只证明一次固定来源外部运行。本地脚本尚未执行；最新全量纠偏后暂停该项局部扩测，不得写成本地capture或当前产品验收通过。
- `reaction-support-matrix.md`关于全部Aura稳态的旧句、`rotation-dsl.md`关于体力的旧句，以及`benchmark-profiles.md`的旧执行方案／检查点段落、`simulator-calculator-replay.md`关于月绽放／星分支尚未接主队列的旧段落，已落后新实现。M11应按当前专项和代码窄修，不能反向删掉已支持能力，也不能篡改历史测量。

总完成判据仍是主提示的全量产品范围。可取得且已确认来源的模块继续实施；真正不能验证的具体字段保持可追踪阻塞。当前状态为**持续实施，未完成**。
