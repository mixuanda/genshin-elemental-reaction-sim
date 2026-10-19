# QA 与实测报告

更新：2026-09-24。本轮将钺矛、苍纹角杯和冷寂迸音接入独立计算器及真实团队追击执行。独立单击／单技能仍是一等入口，不要求队伍或轮转。完整 goal 继续进行；未提交、推送或部署。

## 实际产品变化

三把武器共用固定来源的15个精炼倍率和触发定义。独立计算器新增武器／精炼选择，可直接打开一次已触发追击，编辑最终面板、目标和适用增伤，查看公式、变量、实际代入与中间值，并导出完整JSON。首次值明确标为教学面板；切换武器或精炼保留已填写面板和目标。来源倍率只读，不借用角色技能天赋。

团队页新增真实装备效果声明、精炼、额外物理加成及逐击攻击标签。钺矛只读明确的normal标签，不从动作名称或回能标签猜测；两把HP武器读实际前台状态。实际普通伤害回调先检查角色独立冷却，再保存当前进攻面板；追击经既有事件队列在下一帧独立结算自身暴击、防御和物理抗性，不继承宿主命中限定增伤、暴击覆盖、附魔或防御无视。

钺矛针对原目标，两把HP武器按触发目标当时的真实位置建立半径3范围，保留实际命中／miss；没有按猜测敌人数乘伤害。名义600／900帧冷却在到期帧仍有效，下一帧才可再触发。本配置明确假设无角色卡肉；反应伤害及月曜／星辉特殊宿主回调尚未接入。

结果及分析页新增分页追击账本：触发／拒绝理由、真实宿主与子事件、冷却前后值、取样与交付帧、范围和公式。窗口前触发、窗口内交付会标为跨窗记录，不虚增窗口触发次数，也不补算窗外伤害。原有“打开独立计算器”恢复同一真实追击上下文。追击自身仍进入普通回调，钺矛因标签、HP武器因冷却被拒绝，这些实际决定保留在日志。

当前wire新增明确模型、攻击标签与追击日志；结果校验重放真实触发与冷却，核对来源、快照、几何和父子关联。旧普通伤害不能借此任意设置父事件；未声明模型时仍无追击日志字段。源码契约固定武器的安柏／诺艾尔／久岐忍示例不能换武器后继续沿用旧来源身份。

主要文件为共享 `independent-weapon-proc.ts`、计算器 `weapon-proc-calculator.ts` 与 `calculator-ui.ts`、运行时 `weapon-proc.ts`／`simulator.ts`、schemas的weapon-proc文件及calculator bridge、正常页面 `weapon-proc-controls.ts`／`weapon-proc-ledger.ts`。

## 来源与数据范围

固定gcsim、Optimizer和目录三方核对15个R1–R5倍率，最大差0；来源字节、哈希与固定Git blob证据见[来源审计](cross-validation/weapon-proc-calculator-source-audit.md)。独立定义为 **3把／15精炼**，不并入既有配装普通属性定义后宣称全被动完成。

既有角色覆盖 `.17` 仍为 **120身份／941击／550完整条件动作／135部分／18具体阻塞**；配装覆盖仍 **200武器／988合法精炼／53二件／44四件**。本轮未重新生成未变目录、覆盖或在线更新状态。活动目录仍 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional、verified为空、preview为0。官方来源观察仍是2026-09-23 14:22香港时间，不把新本地代码当成最新版本同步。

## 实际执行与失败记录

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| 新独立calculator来源与builder两项 | 首次2/2通过，1.04s／106ms。之后只简化身份字段，未重跑该文件，最终类型与页面实际验证新身份 | [专项](validation/weapon-proc-calculator.md)、[日志](validation/weapon-proc-calculator.log) |
| 新runtime四项 | 首次4项同因旧direct父事件规则失败，912ms；修复真实生产引用门槛后，仅失败4项复验通过，1.11s／290ms | [专项](validation/independent-weapon-proc-runtime.md)、[首跑](validation/independent-weapon-proc-runtime.log)、[复验](validation/independent-weapon-proc-runtime.retry.log) |
| 新结果完整性一项 | 首次同门槛失败，875ms；修正后1/1通过，1000ms／154ms；五类篡改拒绝 | [专项](validation/weapon-proc-result-integrity.md)、[完整日志](validation/logs/weapon-proc-result-integrity.txt) |
| `npm run build` | 首次类型阶段失败：外部归档.ts被纳入工程、两旧类型断言漏新日志、固定半径字面量类型不匹配。修复后全工程类型＋354模块生产构建通过，336ms | [首跑](validation/weapon-proc-build.log)、[复验](validation/weapon-proc-build.retry.log) |
| 新standalone页面1流程 | 首次通过，976ms，exit0；正常入口、三武器、精炼、面板及JSON轨迹 | [报告](validation/weapon-proc-calculator-browser.md)、[日志](validation/weapon-proc-calculator-browser.log) |
| 新团队页面1流程 | 两次失败为测试将8条回调日志误当3触发、将宿主额外CD4误当最终CD4；只修期望并仅复验本流程，最终通过2.9s／exit0，生产未因此修改 | [尝试表及原始记录](validation/independent-weapon-proc-e2e.md) |
| `node docs/cross-validation/weapon-procs/compare-local.mjs` | 首次exit0，1次本地simulate，1.112661792s；三追击runtime／完整命中JSON回放／独立calculator残差全部0 | [指标及源码哈希](cross-validation/weapon-procs/three-procs-reference.local-metrics.json) |
| 固定外部gcsim一次CLI | 1次summary iteration及CLI自身debug sample，exit0、命令0.051s；明确关闭hitlag，保存配置／结果／sample／执行记录和哈希 | [外部报告](cross-validation/weapon-proc-external.md) |

类型配置只排除用于证据归档的 `packages/game-data/sources/**`，没有修改外部原文或排除产品源码；两个旧断言仍由全工程tsc检查。新增两条浏览器流程使用已构建产物、独立输出目录和现有4173预览，没有重启服务。没有旧全集、旧页面矩阵、性能或大型Monte Carlo重跑。构建时间不是产品性能指标；大chunk提示仍保留。

## 实测结果

| 场景 | 数值／行为 |
| --- | --- |
| 独立教学钺矛R1，ATK1000，90/90，RES0.1，CR0.5/CD1 | 非暴击720、期望1080，自己的暴击乘区 |
| 编辑面板后钺矛R5 | 期望3192.252631578948；保留ATK1500、CR0.2/CD1.5、角色80／目标100、抗性0.2、物伤0.35 |
| 独立HP追击R5 | HP20000时10640.842105263158；改ATK9999不变，改HP25000后13301.052631578947 |
| 两HP武器R1及JSON | 期望6650.526315789473；完整文档与逐击trace往返相同 |
| 团队页三把武器 | 3次触发、5个独立子伤害：1280、6800、3400、4000、2000；其余5条自身回调为拒绝，8条总审计并非8次触发 |
| 独立与宿主暴击隔离 | 宿主CR1／最终CD4.5，追击CR0／CD0.5；宿主加成与防御无视不传给追击 |
| 核心冷却边界 | 钺矛触发2、到期602仍阻塞、603再触发；冷寂触发0、900仍阻塞、901再触发 |
| 历史快照与范围 | HP快照20000在短增益到期后仍使用；半径3边缘命中，范围外留miss且无伤害事件 |
| 实际追击回放与完整运行JSON | 独立计算器差0；页面导出后重新运行的完整result深相等；关闭模型不保留proc日志 |
| 外部固定来源三追击 | 第13帧31.217527806278106；第36帧111.76226483010309；第146帧108.03686008824745。外部钺矛到期612帧仍阻塞 |

随后用外部未舍入面板和明确宿主命中帧12／28／35／145／612做一次本地实际运行：三追击落地帧13／36／146、伤害与外部均精确相等。每击完整capture→JSON→replay差0，同源独立builder与JSON的三份结果差也均0；八击总量282.5856539980269一致，612帧冷却阻塞。执行前后111份核心／schema／共享公式源码指纹一致，原始输入／结果／轨迹已保存。

这些表中教学与合成输入不代表完整游戏配装认证；受控对照明确给定宿主命中，只证明这些条件下的追击机制，不证明全角色动画、宿主快照时序、能量、附着或全部实战触发来源已经一致。

## 剩余工作

三武器的反应伤害回调、角色卡肉冷却延长、实际冷却与在途追击快照的完整周期检查点仍缺；启用时不能认证确定性稳态。此前16追击武器审计中其余13把、讨龙／祭礼自动生命周期仍待实现，昭心倍率与概率冲突不能直接照搬。独立单次可计算、普通回调自动执行和全被动完成分别报告。

全角色／装备／敌人、复杂附着及特殊反应、随机完整状态、可靠7.2V1快照和广泛外部整队对照继续见[已知限制](known-limitations.md)。[上轮QA](history/qa-report-2026-09-24-before-weapon-procs.md)保存柯莱／夏洛蒂和原生v9检查点证据。性能仍只引用2026-09-23T06:42:28.209Z[既有测量](cross-validation/simulation-execution-benchmark.md)，未重测。

收尾 `git diff --check` exit0、无输出；只检查已跟踪差异，不冒充机制验证。[日志](validation/weapon-proc-diff-check.log)。
