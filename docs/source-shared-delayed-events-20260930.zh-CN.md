# 固定来源共享事件与延迟攻击（114）

## 范围与结论

本报告记录第 114 批共享事件组件的来源审计、构建与浏览器验收。在现有 11 个事件组件上新增 11 个带类型的来源规则，registry 共 22 项；静态候选 inventory 的 23 个 family 中，22 个现有事件组件覆盖，另 1 个 Columbina Gravity 仍排除。组件描述固定源码中的监听调用、直接排队攻击或显式延迟 producer；不据事件触发者反推先前状态施加者，也不将局部组件扩大为完整技能、施放或生命周期。

新增站点包括：旅行者雷元素「落雷」与火元素「灼火之槛」，以及仅 Stellar 存在的 Odette C4；莫娜 Q 与 C2、草原核伤害触发的纳西妲三业净破；夏洛蒂 C6、珐露珊 C6；欧洛伦 A1；北斗 Q 弹射链；千织 C4 延迟任务树。11 个新增组件 ID、站点身份、source rules 与选择器已登记于共享 registry。本批不是游戏机制验证；当前任何站点均未因此取得游戏 verified 结论。

## 基线、数据与实际文件

继续使用 `/Users/evan/Documents/gidps` 的现有工作树，HEAD 为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`；保留此前未提交改动，本批未提交或发布。原始项目／Archive 基线说明见[项目审计](current-project-audit.md)。两套来源仍固定在 classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 和 stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。

数据沿用[当日来源刷新记录](data-evidence-refresh-20260930.json)：官方索引证据指向 7.1 公告，活动 verified 数据集为空；预览工作区是 `7.1.50.2` 部分快照，`7.1.51` 候选继续隔离，`7.2 V1` 的明确来源映射仍未确认。本批没有再次抓取或晋升这些数据。

实际改动集中在：

- `packages/sim-core/src/source-host-event-rules.ts`、`source-host-event-collection.ts` 与 `source-host-event-types.ts`：组件规则、捕获、分支判定及回执字段。
- 新增 `source-host-event-callback-analysis.ts`、`source-host-event-task-tree-analysis.ts`：分别接入北斗回调链和千织任务树。
- `packages/source-host/go/pkg/core/sourcehost/event_receipt.go`、`sourcehost_event_attack.go` 及 Stellar 对应文件：父任务与分支读数；`114-*.patch` 与 Stellar 构建清单：接入具体来源站点。补丁完整路径与校验和见测量记录。
- `apps/web/src/source-host-origin-panel.ts`、`source-host-event-calculator.ts`：筛选、分页与任务状态；`apps/web/e2e/source-shared-delayed-events.spec.ts`：本批唯一浏览器案例。天赋来源登记及构建产物随两套来源重新生成。

独立计算器和逐击公式、变量、代入与中间结果继续使用同一共享核心。本批实测了从事件组件进入计算器及编辑、JSON 往返；基础教学示例、单技能通用聚合和 Enka 导入沿用已有实现，本批未重复运行这些旧验收。

## 已完成来源审阅的范围

### 两元素旅行者与 Odette C4

[sites-a 审计](validation/source-shared-delayed-events-sites-a-20260930.json)对固定 classic／stellar 源码的三个站点记录了注册位置、监听分支、queue 参数及边界。旅行者雷元素只覆盖一次 `Falling Thunder` 监听调用所排的一次攻击；保留对 C6 标志的原始读取顺序和后续状态更新。旅行者火元素只覆盖一次 `Scorching Threshold` 监听调用所排的一次攻击；保留队列先于 ICD 写入的次序，另一个 tap 周期攻击不纳入此监听站点。Odette C4 是 Stellar-only，classic 不存在；只覆盖现有 Radiance 分支选择的一次协同攻击，保留未排攻击时的原始 ICD 行为。三者都不推断先前 E/Q 施放所有权或未来周期触发。

### 夏洛蒂 C6 与珐露珊 C6

[sites-c 审计](validation/source-shared-delayed-events-sites-c-20260930.json)记录两个明确的延迟 producer。夏洛蒂 C6 监听分支可排一个 +14 帧任务，任务体直接排一击；珐露珊 C6 分支可排一个 +33 帧任务，任务体直接排一击。producer 数只在监听分支记录；每个实际执行 producer 所排的一击来自固定任务体。夏洛蒂 C6 治疗与后续 OnHeal 效果不在内；珐露珊瞄准攻击路径不改写，保留快照和回调评估时机。两份审计记录的私有 patch 对应的只读固定来源树通过默认 `git apply --check`，并未修改原始来源树；这不是构建、runtime 或游戏行为证据。

### 欧洛伦 A1 与北斗弹射链

[欧洛伦与 Columbina 来源复核](validation/source-shared-delayed-events-resource-audit-20260930.md)确认，欧洛伦 A1 的 `OnEnemyDamage` 监听路径在符合夜魂资源和 ICD 条件后进入 Hypersense：来源中的循环对 1 至 3 个选中目标分别排队，目标数为 0 或达到循环上界时不排队。实现仅在该 listener 调用内标记已走过的具体 queue 分支，并保留共享 helper 的其他调用、C6 状态更新和既有资源／随机行为。它不证明夜魂或 blessing 的施加、消耗生命周期及未来触发归属。

[北斗来源记录](validation/source-shared-delayed-events-beidou-20260930.json)限定为 Stormbreaker 一次事件调用及其有限回调链。首跳与后续 bounce 使用原有 callback recursion、目标选择、攻击指针、native queue 和延迟；审计要求保留分支事实以区分链索引、实际队列数、最大命中数与目标键，不增加 RNG 或重复读取。弹射链捕获依赖现有逐目标命中回调身份，不把整次 Q 生命周期纳入组件。

## 其他事件与任务树审计

### 莫娜、纳西妲与千织 C4

[sites-b 审计](validation/source-shared-delayed-events-sites-b-20260930.json)覆盖三项直接事件组件。莫娜 Q 的泡影爆裂监听仅将泡影仍有效且命中符合原生破泡／冲击条件时直接排入的爆炸攻击纳入范围；泡影删除、Omen 状态和后续 Q 效果不在内。莫娜 C2 只包装事件监听使用的 `doCA` 路径，普通重击仍走原生路径；保留两 lane 原有 reset、particle、Omen refresh 与 Hexerei callback 次序。纳西妲三业净破沿用同一 helper，但仅事件监听分支写入每个实际排队敌人的 source-loop 计数；反应监听与粒子回调、草神印记生命周期不归属该组件。

[千织 C4 任务树审计](validation/source-shared-delayed-events-chiori-tree-20260930.json)追踪一次监听调用创建的两个根任务及其显式父子后代：生产者计数为 0 或 2；任务树包含 +180 帧到期任务、+36 帧初始 tick、后续 +30 帧 tick，以及每个 tick 可排的 +5 帧攻击任务。任务子任务数和攻击数取自原生分支读数；攻击命中本身不能提前关闭任务树。成功攻击后仍须等后续 tick 与 expiry 完成；无目标时 expiry 在 +180 帧、已排的 dead tick 在 +186 帧结束。专用任务树分析器判定任务交付闭合后，整项组件继续交由现有通用队列／命中检验及共享公式核心处理攻击和重放。两 lane 的私有 patch `git apply --check` 通过，原始树未修改。

Columbina Gravity 是 23 个候选 family 中唯一未纳入事件组件登记的范围。其事件回调更新重力资源和最近反应状态，随后由重复任务积累资源，再由 gravity tick 选择分支并建立延迟命中任务；一个事件监听不能独占归属之后由多次触发、资源状态、分支和随机状态共同决定的攻击。应另行审阅资源生产、周期任务、tick 分支和子攻击树后再建模，不以一个有限 listener queue 代替完整来源链。

## 原生证据与验收结果

原生回执在 event producer 任务行增加 `parentProducerId` 与 `entryFacts`，连接实际父 producer、监听调用和来源计数；监听器行既有的 `entryFacts` 保持原样。新增观察沿用原生 task 与 callback，不复制任务或重跑选择器。北斗链使用现有逐目标 hit callback 身份追踪后续 bounce。此类身份回执说明固定来源执行中的因果连接，不证明游戏行为正确、状态由谁施加或完整 E/Q 生命周期。

两 lane 来源构建、talent registry、typecheck、Web build 与一个浏览器案例首次通过：classic 6.385 秒（45,139,470 B，SHA-256 `5ed47cbc6ab0f064b92697ae8906098c3d9fae33fa4b8f915cfc118913fca363`），stellar 7.060 秒（69,680,952 B，SHA-256 `cf90cd8f982781cfbf5da2140e775f141c093957b1e918a8b78fd08bf557caf8`）；registry 0.127 秒、typecheck 3.731 秒，新增浏览器文件后最终 typecheck 2.868 秒，Web build 1.280 秒（Vite 1.010 秒）。Playwright 首次通过，用时 43.772 秒（测试案例 42.2 秒、runner 43.3 秒），页面错误为空；没有浏览器重试或全量测试。命令记录见[classic](validation/source-shared-delayed-events-classic-build-20260930.json)、[stellar](validation/source-shared-delayed-events-stellar-build-20260930.json)、[registry](validation/source-shared-delayed-events-talent-registry-20260930.json)、[typecheck](validation/source-shared-delayed-events-typecheck-20260930.json)及[Web build](validation/source-shared-delayed-events-web-build-20260930.json)。

两份 classic 原生捕获分别实际观察 798 与 258 帧，含 67／10 个团队应用；捕获总伤害分别为 38,769.898634191195 与 9,855.532194060197。帧数是实际观察窗，不等于名义固定 18／12 秒；这些总伤害也不是固定窗口 DPS benchmark。两份捕获共实测五个新增组件：莫娜 Q 泡影爆裂（1 击）、夏洛蒂 C6（1 producer、2 击）、珐露珊 C6（1 producer、2 击）、北斗 Q 弹射链（5 击）及千织 C4（两个根任务，任务树共 4 个已完成 producer，1 个攻击事件命中 2 目标）。共 12 个目标命中，所选组件小计 5,856.829210850738，全部交付闭合且共享公式重放差值为 0。其余六个新增组件只有源码与构建证据、本批没有原生样本：雷／火旅行者、Odette C4、莫娜 C2、纳西妲和欧洛伦。

页面展示 productive／all 过滤、组件筛选和 20／50 条分页；千织 C4 组件 JSON 往返和编辑后交付闭合均通过。三个离线缺证据探针分别移除夏洛蒂 producer 任务记录、北斗 callback 批次／槽位和千织任务树子项，均按预期拒绝闭合，额外原生运行数为 0。另复用 113 批阿贝多归档捕获做历史回归：2 个命中重放差值为 0，小计 1,356.88886407622。

测量记录确认正式／预览目录指针保持不变，`activeVerified` 仍为 null，没有数据晋升；当日较早的数据刷新记录中的小型索引字节变化已留档，latest／character-list 内容未变。测量汇总见[记录](validation/source-shared-delayed-events-measurements-20260930.json)，浏览器结果见[团队回执](validation/source-shared-delayed-events-team-20260930.result.json)。这些结果只覆盖所选固定来源事件组件与对应任务树；Columbina Gravity、既有护盾／状态所有权、完整技能和 phase convergence 仍未闭合；外部更新与下一版本来源证据仍待跟进。master 全量目标继续开放。60 个 finite contracts／51 项 plans 和游戏验证状态均未因此提升。

上批 113 报告见[固定来源直接事件攻击组件（113）](source-direct-events-20260930.zh-CN.md)。
