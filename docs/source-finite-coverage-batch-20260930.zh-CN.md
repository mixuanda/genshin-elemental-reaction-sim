# 固定来源有限技能覆盖扩展（117）

## 已确认的实现范围

本批已集成七项：四个直接技能攻击（甘雨 E、烟绯 E、魈 E、托马 E），以及三项任务生产者（神里绫人 E 水影爆炸、云堇 Q 施放攻击、绮良良 E 三种施放模式）。甘雨 E 由一次施放产生两个根攻击，观察需覆盖延迟至第 373 帧的莲花爆炸；烟绯 E、魈 E、托马 E 各为一次直接根攻击。天赋或命座中由后续攻击触发的额外效果不并入本次 E/Q 根攻击。直接攻击计数和任务门控仍是固定来源假设，不证明游戏机制已核验。

神里绫人 E 水影爆炸沿用原 Core 延迟任务与施放位置；云堇 Q 初击沿用原角色本地帧任务及任务执行时的位置。二者只记录施放自身的伤害生产，后续普攻、水影后的独立触发和队伍增益归属于后续动作，不计入该施放根攻击。

绮良良长按会在同一个原生 `AttackEvent` 上重复调用零延迟 `QueueAttackEvent`。新增显式同步 occurrence wrapper，在每次原生排队前暂存、清空并恢复四个 sidecar 身份字段（`SourceHostOrigin`、`SourceHostQueuedObservationIndex`、`SourceHostAttackID`、`SourceHostDispatchID`）；仍使用同一事件对象和快照，并按原路径每次调用 `QueueAttackEvent(..., 0)` 一次。Ability finalizer 通过稳定 `QueueID` 找回各次队列观察，避免复用对象时多次长按只被记成首击。此 helper 仅适用于已审阅的同步零延迟普通 ability scope；不扩大到延迟复用、其他事件或实体引用，也不改原生游戏字段、调度和伤害逻辑。

## 来源证据与已知边界

固定来源提交沿用 classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。来源资料包括[直接技能审计](validation/source-finite-coverage-batch-direct-20260930.json)、[简单延迟任务审计](validation/source-finite-coverage-batch-simple-tasks-20260930.json)、[护盾角色动作审计](validation/source-finite-coverage-batch-shield-actions-20260930.json)及[即时攻击 occurrence native 审计](validation/source-immediate-attack-occurrence-native-20260930.json)。神里绫人 E 与云堇 Q 的任务、延迟、快照及排除项也由两 lane 来源审阅。

首轮浏览器案例在 6.187 秒失败，并暴露出真实 registry 元数据缺陷：DSL 使用 `ayato`，但固定来源 `config.yml` 的 canonical key 是 `kamisatoayato`，使有效的原生调用无法匹配有限合同。随后按两 lane 固定来源配置逐行核对 71 个 registry 行（70 个不同合同），修正 11 个 `characterKey` 与 5 个重复目录前缀错误的 `sourcePath`；合同 ID 未变。此处的旧 registry 修正只修正匹配元数据，不代表此前角色重新完成 runtime 验证。证据见[canonical key 审计](validation/source-finite-native-key-audit-20260930.json)。修正后 Web build 再次通过，1.080 秒（Vite 897 毫秒）；复用了原始捕获，没有重跑 Go/native 或 typecheck，后者仅受 JSON 字符串和测试查找调整影响。

托马 `skill.go` 自带限制说明：snapshot 标为 unknown，damage component 标为 not final；C1 冷却实现为固定 12 秒，没有按护盾受击条件变化。作为 fixed-source 假设如实记录并在面板与 calculator 账本标出，不把它包装成游戏已验证机制。绮良良短／长按分支复用同一原生 `*AttackEvent`；occurrence 包装只暂存并恢复身份 sidecar 字段，底层事件及其快照、pattern、callback 和原生排队调用保持原样。

## 验收结果

首轮构建与静态检查均通过：classic 来源构建 4.572 秒（45,207,319 B，SHA-256 `d39406fc6974c7e6c96d6c800d010ff4e403a0977fac6cfabd94e593da13603c`），Stellar 构建 5.183 秒（70,012,537 B，SHA-256 `45e75f7b8f32f6ccef0bae91cc07f64cde97ed915c43784e2c2ef4b9be9e1750`）；talent registry 0.111 秒，typecheck 2.835 秒，Web build 1.118 秒（Vite 894 毫秒）。registry 分别为 classic 576 表／600 sites／10 expression sites、Stellar 605／632／10。本批共 70 项不同有限合同、57 项生产计划和 74 个 producer sites。记录见 [classic build](validation/source-finite-coverage-batch-classic-build-20260930.json)、[Stellar build](validation/source-finite-coverage-batch-stellar-build-20260930.json)、[registry](validation/source-finite-coverage-batch-talent-registry-20260930.json)、[typecheck](validation/source-finite-coverage-batch-typecheck-20260930.json) 与 [Web build](validation/source-finite-coverage-batch-web-build-20260930.json)。

## 实际运行与边界

一次浏览器案例共尝试两次。首轮在 6.187 秒因 DSL/package alias `ayato` 与原生 canonical key `kamisatoayato` 不匹配而失败；这是有限技能 registry 元数据缺陷。依据两 lane 固定来源 `config.yml` 核对 71 行（70 项不同合同）后，修正 11 个 `characterKey` 与 5 个 `sourcePath`，合同 ID 保持不变。旧合同元数据修正不表示此前角色重新完成 runtime 验证。Web build 随后复建通过，1.080 秒（Vite 897 毫秒）；没有因此重跑 Go/native 或 typecheck。第二次复用相同两份原生捕获通过，浏览器耗时 4.317 秒（runner 4.0 秒、测试体 3.1 秒），`pageErrors` 为空。

两份 classic 配置使用 C0、90 级角色、1 级天赋、1 级精炼 1 武器和单个 90 级目标；显式启用 `ignore_burst_energy=true`，仅检查本批施放归属与重放，不作为能量验收。两份配置都以 960 帧为配置终点，但因 actions-exhausted 分别在第 612／634 帧结束，各有 5 个应用；原生总伤害分别为 2,604.62240906229 与 773.9741445048104。第二份配置的 `hold=60` 是绮良良的长按输入时长；该配置整次原生观察为 634 帧。两次运行均非固定 960 帧 benchmark，结果不应解释为 DPS 比较。汇总记录共观察 10 个选定命中，7 项有限动作全部闭合，逐击共享公式重放差值全为 0：

| 动作 | 命中数 | 归属伤害小计 |
| --- | ---: | ---: |
| 甘雨 E | 2 | 1,194.0357925738979 |
| 烟绯 E | 1 | 622.8374895493632 |
| 魈 E | 1 | 551.6531511516001 |
| 托马 E | 1 | 236.09597578742884 |
| 神里绫人 E 水影爆炸 | 1 | 147.14406046349998 |
| 云堇 Q 施放攻击 | 1 | 378.6432788016 |
| 绮良良 E（长按输入 `hold=60` 帧） | 3 | 248.1868052397105 |

绮良良长按实际登记两次翻滚任务；两个重复使用原生事件指针的排队分别保留独立身份，各产生一击，再加一次踢击，共三项根攻击。甘雨 E 的两击编辑及 JSON 导入／导出通过。构建和原生资产记录见[测量汇总](validation/source-finite-coverage-batch-measurements-20260930.json)、[合同审计](validation/source-finite-coverage-batch-contracts-20260930.json)、[最终浏览器结果](validation/source-finite-coverage-batch-team-20260930.result.json)、[浏览器重试日志](validation/source-finite-coverage-batch-browser-retry-20260930.log)与[首轮失败日志](validation/source-finite-coverage-batch-browser-20260930.log)。

Stellar 本批仅有构建证据。托马固定来源将 snapshot 标为 unknown、damage component 标为 not final，C1 冷却固定 12 秒而非按护盾受击变化；这些限制已展示在面板和 calculator 账本，重放只说明忠实复现该来源，不表示游戏机制已核验。正式／预览数据指针未变，`activeVerified` 仍为 null，7.2 V1 与固定来源的不可变版本映射未核实。本批没有重新抓取数据；其他状态／实体／资源归属、完整动作范围、更广的稳态收敛证据和远端 CI 执行仍待处理，全量目标继续开放。
