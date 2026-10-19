# 剩余来源技能、通用玩家护盾与普通圣遗物增益增量

2026-09-25。本批 **4 个新增核心文件／5 用例与 2 条页面流程均已有通过记录**，分定点重试完成，已通过项不重跑。类型／生产构建及数据三步检查通过；原始失败、夹具修正和真实生产修复保留在下文。近期模块累计从 32 文件／83 用例／20 页面增至 **36 文件／88 用例／22 页面**，重试不重复计数。全量 goal 仍进行中，未提交、推送或部署。

独立单击与完整单技能计算器仍为正常产品入口，不要求队伍或轮转。新增来源条件、日程草稿、历史取样与最终面板继续进入共享核心；界面编辑事实和选择范围，不维护第二套伤害公式。正式与预览工作区保持各自数据身份，缺少匹配来源时不回退到另一工作区。

## 数据结果与证据等级

本批实际生成版本为 `gcsim-b4ae769+a7dc4bf+optimizer-180a0a1-reviewed-hits.24+durin.8`。状态日志记录 **120 个有分类命中的角色身份、1183 个分类命中模板、652 个条件完整动作、18 个部分动作、11 个阻塞映射**。这些是带明确来源域及条件的定义数量，不是任意构筑、命座、后续动作或整队模拟均已完成。

`numericallyVerified`、`mechanicsVerified`、`hitReady`、`skillReady`、`sequenceReady`、`teamReady` 及 `teamSimulationReadyFromTheseMappings` 仍为 **0**，`activeVerifiedDataset` 仍为空。当前正式目录保持 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`；预览工作区保持 `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc`。解析成功、源码数值一致和本地测试通过均不自动提升为游戏实测认证。

| 已执行命令 | 结果 | 墙钟 | 原始记录 |
| --- | --- | --- | --- |
| `npm run data:generate` | PASS，exit 0 | 4.555 秒 | [日志](validation/remaining-source-data-generate.log)、[退出码](validation/remaining-source-data-generate.exit) |
| `npm run data:check` | PASS，exit 0 | 4.709 秒 | [日志](validation/remaining-source-data-check.log)、[退出码](validation/remaining-source-data-check.exit) |
| `npm run data:status` | PASS，exit 0 | 3.781 秒 | [日志](validation/remaining-source-data-status.log)、[退出码](validation/remaining-source-data-status.exit) |

## 来源技能：实际范围

本批接入沿五组共用来源协议展开；其中 idle 组已有此前基础与测试，本批不能把五组全部重计为新测试完成量。以下“伤害角色模板”指同一技能内的 `role`，日程可重复展开或排除它，并非实际命中次数。

| 来源组 | 技能模板／伤害角色模板 | 当前有限来源域 | 固定档案 |
| --- | --- | --- | --- |
| idle stance | 12／15 | C0、无指定后续攻击或旧状态的明确分支；钟离单岩脊和千织单袖包含完整声明寿命内的持续攻击 | [manifest](../packages/game-data/sources/idle-stance-casts/manifest.json) |
| extended stance | 4／20 | Ifa E 实际射击及主动结束；Dahlia Q 完整分支要求突破 4、无再生触发且盾不破；Varka E 实际姿态动作、充能和扩散；Prune E 首次实际扩散及可选二段 | [manifest](../packages/game-data/sources/extended-stance-casts/manifest.json) |
| mixed source | 3／15 | Lauma 长按 E 草露与霜林；Flins 非 Symphony 普通 Q；Odette Coda 的旧倒影剩余寿命，保留普通与特殊伤害各自公式 | [manifest](../packages/game-data/sources/mixed-source-casts/manifest.json) |
| Noelle plunge | 2／4 | 真实 `AirborneXianyun` 资格、C0、Q 关闭、无外部附魔的低／高空物理下落，明确可选碰撞与落地闭环；不作为任意腾空入口 | [manifest](../packages/game-data/sources/noelle-plunge-casts/manifest.json) |
| entity followup | 4／11 | Jahoda Q、Nicole Q、Odette 未升级的新生 E／Q；保留 Jahoda 非火分支乘数初始化和 Nicole 突破门控的源码冲突 | [manifest](../packages/game-data/sources/entity-followup-casts/manifest.json) |

五组共 25 个技能模板、65 个伤害角色模板。固定 gcsim `b4ae769…`／`a7dc4bf…` 的原文、数值绑定和逐文件身份见各 manifest；来源状态仍为 provisional。没有用此计数宣称 25 个动作在所有游戏条件下完整，也没有把它们自动转换为团队可执行技能。

实际生产模块为各组的 `*-context.ts`、`*-schedule.ts`、`*-formulas.ts`，由 [source-cast-context.ts](../packages/sim-core/src/source-cast-context.ts) 统一准备、面板记账重置及固化。普通表单位于 `calculator-idle-stance-controls.ts`、`calculator-extended-stance-controls.ts`、`calculator-mixed-source-controls.ts`、`calculator-noelle-plunge-controls.ts` 与 `calculator-entity-followup-controls.ts`，沿现有计算器挂点接入。

日程与接触缺失保持未知；草稿未应用时不把旧结果伪装为新日程结果。完整施放使用实际动作、接触、取样和寿命条件；已发生的独立命中仅要求该击自身依赖，不索取未来事件。混合特殊命中可经装备构筑转换为最终面板，逐击历史快照、被动已含份额和共享 AST 随 JSON 保留。代表性核心与页面路径已通过，覆盖范围和测量见下文，未为每个角色重复展开测试矩阵。

## 通用玩家护盾：声明资源进入实际队列

新增 `playerShieldModel.mode = gcsim-b4ae769-template-v1`，在合法帧轮转与玩家生命模型下显式声明生成、强效及交盾前已结算的来袭伤害。生成时取来源属性；同类型与同保护目标覆盖；多面适用盾各承受完整来袭量，角色穿透取最小值。实际到期、覆盖、破盾、一次性强效读取及 HP 变化进入日志、共享公式追踪、结果 JSON 和检查点待执行任务。

核心为 [player-shield-runtime.ts](../packages/sim-core/src/player-shield-runtime.ts)，配置与结果约束位于 `player-shield-schema.ts`／`player-shield-integrity.ts`；正常队伍编辑与结果详情位于 `player-shield-controls.ts`／`player-shield-panel.ts`。主执行器保存真正的队列时间、优先级及事件关系，页面不按计划重新推测吸收或扣血。

证据等级为 **fixed-source-assumed**。固定源码 `Tmpl.OnDamage` 按“来袭元素是岩”选择 1.5 倍，而 `ShieldStrength` 查询按“盾元素是岩”选择，两者冲突保留；同元素非岩的 2.5 倍分支未受此冲突影响。当前只执行通用模板与管理器顺序，不自动生成诺艾尔、钟离等角色护盾，不执行角色专属副作用，不认证完整敌人攻击公式或护盾卡肉延长。[来源审查](cross-validation/player-shield-runtime-source-audit.md)与[40 份原文清单](../packages/game-data/sources/player-shield-runtime/manifest.json)中的五名角色档案属于后续候选，不等于生产映射完成。

## 六套普通域圣遗物：实际事件触发增益

新增 `artifactBuffModel.mode = fixed-source-no-character-hitlag-v1`。来源常量、真实生命周期、配置／结果／状态独立校验及正常控件、账本分别位于 `artifact-buff.ts`、`artifact-buff-runtime.ts`、`artifact-buff-model.ts`／`artifact-buff-integrity.ts`／`artifact-buff-state-replay.ts`、`artifact-buff-controls.ts`／`artifact-buff-panel.ts`。数值、层数、窗口、延迟及清除由执行时共用 AST 求值；实际命中的取样结果经现有 calculator bridge 还原。

| 四件套 | 实际触发与增益 | 保留的来源边界 |
| --- | --- | --- |
| 宗室 | 前台持有者实际接受爆发，全队攻击力 +20%，720 帧 | 持有者自身显式 0／1 帧延迟，同名覆盖；不重写既存快照 |
| 教官 | 前台持有者本人实际普通反应，全队精通 +120，480 帧 | 多持有者延长规则源码仍有 TODO |
| 饰金 | 本人实际普通反应；初始化同元素队友每人 +14% 攻击、异元素每人 +50 精通，最多 3 人 | 480 帧窗口及冷却；两项属性一起应用，既存攻击快照不回填 |
| 谐律 | 真实生命之契非零变化，最多 3 层、每层 18% 普通增伤 | 实际回调量决定事件；整体刷新 360 帧窗口 |
| 普通乐园 | 本人普通绽放／超绽放／烈绽放；40% 基础反应加成加每层 10%，最多 4 层 | 600 帧窗口、60 帧冷却；不接月绽放或普通增伤乘区 |
| 辰砂 | 前台持有者爆发给 8% 攻击，实际正数掉血请求每层 +10%，最多 4 层 | 48 帧冷却、960 帧原窗口不续期；固定源码任意实际换人清窗，当前限一位持有者 |

六套限定普通宿主、全局帧、无角色卡肉；月曜／星辉特殊宿主仍明确阻塞。宗室 pre/post、教官延长及辰砂的订阅和掉血归属行为保留来源假设，不升格为实机认证。角色静态面板不得预含这里自动执行的条件四件套增益；二件套面板仍由输入构筑负责。[来源清单](../packages/game-data/sources/artifact-buff-runtime/manifest.json)与[接线合同](validation/artifact-buff-runtime.md)保存准确窗口、事件和待执行任务要求。

## 非周期普通反应检查点

[nonperiodic-reaction-checkpoint.ts](../packages/sim-core/src/nonperiodic-reaction-checkpoint.ts) 联同 Aura 与帧前检查点保存冻结／激化生命周期来源与代次、到期任务、反应伤害组窗口与重置任务、排队攻击、反应 ICD 及目标减益。归一化只去除不影响后续执行的历史身份，真实事件队列顺序仍由主执行器保存；目标 phase 状态不可丢弃。

单项聚合验收涵盖冻结、激化、超载、超导、火扩散、碎冰六种闭合合成输入，已在本次统一核心检查通过，验证真实状态和所给检查点的 1 周期重复。日志未提供各场景 DPS 数值，此处不补造测量。这不是全反应域：未来驱动可能产生感电、燃烧、草原核或结晶实体的组合仍不能借当前空 Aura 证明完整检查点；调试反应覆盖、未导出的周期来源及不完整观察尾段仍阻塞。即使局部资源已纳入检查点，也不等于任何团队配置已证明周期闭合或支持断点续跑。

## 真实前序失败与窄修记录

| 阶段 | 实际结果 | 定位及当前记录 |
| --- | --- | --- |
| 非周期反应首次单项 | 1 项失败，exit 1，Vitest 1.15 秒 | 120 秒夹具在末检查点后不足两次完整输入周期；夹具延长为 140 秒，检查点与动作不变，随后在本次统一核心检查通过。[原日志](validation/nonperiodic-reaction-checkpoint.initial.log)、[退出码](validation/nonperiodic-reaction-checkpoint.initial.exit) |
| 新技能／反应首次联合 | 2 文件／2 项失败，exit 1，Vitest 2.69 秒、墙钟 3.189 秒 | mixed 夹具去除不属于该 schema 的 `freshCastConfirmed`。冻结生产修复使包含 v3 的 `targetPhaseV2Enabled` 分支跳过过时到期任务的空记录，保留实际物化／到期状态和 schema 严格检查。两项随后通过。[原日志](validation/remaining-reaction-core.initial.log)、[退出码](validation/remaining-reaction-core.initial.exit) |
| 本次四核心统一检查 | 2 文件通过、2 文件失败；2 项通过、3 项失败，exit 1，Vitest 3.62 秒、墙钟 4.144 秒 | 两个圣遗物夹具缺少兼容目标 `enemy-0`，其中一个还缺少 aura-v5 火元素应用的显式几何；玩家盾夹具缺少有位置的敌人目标。窄修夹具，未放松 schema。[原日志](validation/remaining-source-runtime-core.initial.log)、[退出码](validation/remaining-source-runtime-core.initial.exit) |
| 核心 retry1 | 1 项通过、2 项失败，exit 1；2.07／2.570 秒（Vitest／墙钟） | 辰砂／谐律通过后不再运行；另一圣遗物夹具同时填写 geometry 与 scripted targeting 被拒绝；盾观察尾段不足一完整周期。[日志](validation/remaining-source-runtime-core.retry1.log) |
| 核心 retry2 | 2 项失败、1 项跳过，exit 1；1.92／2.385 秒 | 几何夹具改为唯一命中来源；Bloom 过滤误把带反应标记的直接触发击也计入，随后限定 `transformative-reaction`；盾延长后仍不足两次完整周期，继续只修观察尾段。[日志](validation/remaining-source-runtime-core.retry2.log) |
| 核心 retry3 | 1 项通过、1 项失败、1 项跳过，exit 1；1.63／2.089 秒 | 盾完整通过后不再运行；绽放实际 6961.276273584905 对手抄预期差 0.00020207547095196787，定位为参考基础值抄成 1446.853458，实际固定源表为 1446.8535，未放宽容差。[日志](validation/remaining-source-runtime-core.retry3.log) |
| 核心 retry4 | 1 项通过、1 项跳过，exit 0；1.70／2.190 秒 | 仅复验宗室／教官／饰金／乐园聚合用例，固定源值修正后通过；本批累计五项均通过。[日志](validation/remaining-source-runtime-core.retry4.log)、[退出码](validation/remaining-source-runtime-core.retry4.exit) |
| 本次统一构建初次 | exit 1，墙钟 2.513 秒；未进入 Vite 构建 | 类型接线遗漏：exact optional 属性、`shield-hit` 标签、集合／索引类型及来源代表项的可选值；窄修后构建通过见下文。[原日志](validation/remaining-source-runtime-build.initial.log)、[退出码](validation/remaining-source-runtime-build.initial.exit) |
| 页面初次 | 团队通过、独立计算器失败；3.1／3.569 秒（Playwright／墙钟），exit 1 | 独立页面发现真实 mixed JSON 问题：每次 prepare 重复追加相同依赖标签。生产改为 `Set` 幂等合并，未降低文档／trace 比较要求；仅重新打包并复验失败页面。[日志](validation/remaining-source-runtime-browser.initial.log)、[退出码](validation/remaining-source-runtime-browser.initial.exit) |

不得将重试计作新增用例，也不得在修复落盘后直接改写旧失败为通过。

## 本次最小验收与测量

四个核心文件共 5 个用例，首次统一调用后只定点复验失败项；六种反应场景在一个聚合用例内，不按场景重复计数。未运行源码旧组回归、历史全套、额外随机批次或新的外部游戏对照。

| 核心文件的命令入口 | 目的 | 最终状态 |
| --- | --- | --- |
| `npx vitest run packages/sim-core/src/remaining-source-batch.test.ts` | Ifa／Nicole／Noelle／Flins 代表性真实日程、特殊单击及最终面板 | 1 项 PASS；不再重复 |
| `npx vitest run packages/sim-core/src/__tests__/nonperiodic-reaction-checkpoint.test.ts` | 六种闭合输入的实际生命周期与完整周期状态 | 1 项 PASS；不再重复 |
| `npx vitest run packages/sim-core/src/__tests__/player-shield-runtime.test.ts` | 真实生成、并行吸收、覆盖、到期、HP、待任务与 JSON | 1 项 PASS，retry3 |
| `npx vitest run packages/sim-core/src/__tests__/artifact-buff-runtime.test.ts` | 六套增益的真实行动、反应、生命回调及命中回放 | 2 项 PASS，分别在 retry1／retry4 |

实际首次调用将上述四文件合并；后续只筛选尚未通过的用例。通用盾核心覆盖同时受击、跨生成者覆盖、自然到期先于受击、强效读取、过量伤害及真正待队列，JSON 重跑保留原状态。六套核心分别验证真实反应和生命回调，不用注入已算好的圣遗物结果代替执行；饰金后续伤害 670、谐律三层伤害 770，已有动作快照仍保留触发前的面板。以上为通过断言的合成输入结果，不是游戏实测。

`npm run build` 在窄修类型后 exit 0，包含 `tsc --noEmit` 与生产构建，525 模块、Vite 471 毫秒、墙钟 3.176 秒：[日志](validation/remaining-source-runtime-build.retry1.log)、[退出码](validation/remaining-source-runtime-build.retry1.exit)。页面发现并修复依赖标签幂等问题后，只重打包 Web，525 模块、Vite 497 毫秒、墙钟 0.734 秒、exit 0：[日志](validation/remaining-source-runtime-bundle.retry2.log)、[退出码](validation/remaining-source-runtime-bundle.retry2.exit)。第二次是定点 bundle，不冒称再次执行全工程类型检查。现有大 chunk 提示保留。

| 页面命令入口 | 单条流程范围 | 最终状态 |
| --- | --- | --- |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/remaining-source-calculator.spec.ts` | Flins 已发生独立特殊命中、正常编辑、装备转最终面板、JSON；Noelle 独立碰撞与完整高空下落 | 单项 retry1 PASS；用例 1.2 秒，Playwright 1.5 秒／墙钟 2.016 秒 |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/player-shield-artifact-buff.spec.ts` | 正常队伍控件启用宗室及合成通用盾、实际 AST／HP、命中回放、完整运行 JSON | initial 首次 PASS，用例 1.7 秒；随后未重跑 |

两页面首次合并执行，之后只复验独立计算器：[初次完整日志](validation/remaining-source-runtime-browser.initial.log)、[单项通过日志](validation/remaining-source-runtime-browser.retry1.log)、[最终退出码](validation/remaining-source-runtime-browser.retry1.exit)。复用既有 4173 生产预览，未重启服务。

实际页面测量与独立手算一致：无宗室 `500+500=1000`，开启宗室后 `600+600=1200`；1000 原始火盾以 2.5 倍吸收 2500，来袭 3000 穿透 500，明确受保护角色 HP `10000→9500`。真实命中与独立计算器共享 trace、回放差 0；完整运行记录导出重载完全一致，`completeRecordRestored=true`。

独立页面 Flins 已发生末击期望 `19628.247956210533`，编辑实际 impact ATK 后 `19885.06615376843`；切换真实装备构筑再转最终面板，期望 `2436.026350157214` 且 JSON／逐击 AST 完整一致。诺艾尔已发生独立碰撞期望 `1006.9353000000001`；补齐实际空中资格、接触和寿命条件后，两击完整高空下落期望 `3521.8354500000005`，取样／命中帧为 33、42。显示的浮点尾数来自原始日志，不自行改造成更精确的游戏数值。

## 剩余边界

剩余 18 个部分动作和 11 个阻塞映射、未认证数值与机制、preview 缺失来源、角色专属盾及副作用、月曜／星辉圣遗物宿主与未导出的周期反应资源均继续保留。局部完整动作、数据再生成和本地闭合样例不能替代主提示要求的全量完成。

README、实施总报告、需求状态、QA、已知限制、CHANGELOG 与六套圣遗物专题已按上述日志同步；文档收尾未运行测试或构建。下一批 A／B／C 模块虽已在新文件实施，但尚未完成接线与验证，不计入本批完成范围或通过数。新的可组合来源取样任务也不借用上述六种反应样例的周期证据宣称任意队伍稳态。
