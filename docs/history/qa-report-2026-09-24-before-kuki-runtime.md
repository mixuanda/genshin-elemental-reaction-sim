# QA 与实测报告

更新：2026-09-24。本轮增加久岐忍完整 E/Q 条件伤害，并补齐确定性生命动作的真实待执行队列检查点。独立单击／单技能仍无需队伍；完整 goal 保持进行中，未提交、推送或部署。

## 实际改动与来源

久岐忍新增 E初击＋8环、E初击＋10环、Q七击、Q十二击四个完整条件动作，替换原三条部分映射。A4的25%精通进入伤害基数，C6的150精通按有效／面板已含份额补差；明确恢复的最终精通不再追加。Q起手生命比例默认未知，50%边界决定完整分支；已有上下文的一击不要求其他命中或无关生命周期齐全。新来源配装、导入面板、动作切换、三态条件、数值编辑、JSON及公式展示均接同一核心。见[实施与核心实测](validation/kuki-complete-casts.md)。

10份固定gcsim文件和6份Optimizer文件已归档；45个执行倍率、210个生产数值参数与活动目录精确核对。固定gcsim低突破E初击无条件加25%EM，Optimizer要求突破4；冲突仅阻塞该初击，环伤及Q独立保留。Q注释旧称11击，实际执行循环为12，记录采用执行路径而非忽略差异。来源档案、哈希与适用范围见[gcsim审阅](cross-validation/kuki-complete-casts-source-audit.md)和[Optimizer审阅](cross-validation/kuki-optimizer-source-audit.md)。社区来源对照不等于当前游戏实测。

生命检查点直接遍历模拟真实queue，保存全部在途治疗／消耗的定义、来源、目标规则、相对施放／到期帧和FIFO顺序；HP沿用实际状态，未建立第二套血量或排期。旧rotation和合法timeline的启动尾段均覆盖最长生命延迟，边界同帧事件仍待执行。移除此前对所有healthChanges的一概周期阻塞，保留Aura、随机及其他未导出状态的阻塞。见[生命周期专项](validation/player-health-phase-checkpoint.md)。

## 实际执行检查

| 命令／范围 | 实际结果 | 原始证据 |
| --- | --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/calculator-kuki-complete-casts.test.ts` | 首次3/3通过，1.35s／测试181ms，exit0 | [日志](validation/kuki-complete-casts-tests.log)、[退出码](validation/kuki-complete-casts-tests.exit) |
| 生命周期新3项＋旧生命直接受影响1项 | 首次3通过1失败2跳过，1.22s；新Aura夹具错误使用旧rotation，被既有入口拒绝 | [日志](validation/player-health-phase-test.log) |
| 仅复验生命失败项 `-t 'refuses truncated tails'` | 1通过2跳过，853ms／测试83ms，exit0；未重复已通过项 | [日志](validation/player-health-phase-targeted.log)、[精确命令](validation/player-health-phase-checkpoint.md) |
| `npm run data:status` | 唯一一次本地生成，exit0；不在线刷新发行事实或提升验证 | [日志](validation/kuki-complete-casts-data-status.log)、[退出码](validation/kuki-complete-casts-data-status.exit) |
| `npm run build` | 首次exit0；全工程TypeScript＋315模块生产构建通过，331ms | [日志](validation/kuki-health-phase-build.log)、[退出码](validation/kuki-health-phase-build.exit) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/kuki-health-phase.spec.ts` | 首次2/2通过，总2.8s，exit0；久岐忍1.6s，生命Worker636ms，无重试 | [页面实测](validation/kuki-health-phase-browser.md)、[日志](validation/kuki-health-phase-browser.log) |

合计新增核心6项及必要旧回归1项各有通过证据，不能说核心首次全通过。两个新页面流程使用4173生产预览；保留默认30秒测试预算和全部断言，仅关闭自动化trace的DOM快照。未重跑旧全集、data:check、性能、大型随机模拟或外部gcsim。构建与浏览器耗时不是产品性能基准。

## 实测数值和边界

T1、双方Lv90、10%抗性、ATK1000／EM200／HP20000、突破6、50%CR／100%CD、无反应或额外增伤：E9非暴击1451.844、期望2177.766；E11非暴击1724.004、期望2586.006；Q7非暴击2271.024、期望3406.536；Q12非暴击3893.184、期望5839.776。E基础量为 `ATK×(.75712+环数×.2524)+命中数×.25×EM`，Q为 `HP×.036048×命中数`，后乘防御0.5与抗性0.9。完整总数来自各击实际求值。

核心另验证C6装备1100ATK／实际350EM时E11非暴击2057.2794，转最终面板及JSON重建一致；旧150份额已失效时能扣除。低突破环伤、C2从C0模板选前8环、未知Q生命时前7单击均局部可算；C0不能算延长第9环。普通页面实际检查0.5与0.5001边界、清空未知、稳定声明、E9/E11/Q7/Q12和单击JSON。

生命核心：每120帧@1施放，1000消耗延迟390帧、1000治疗延迟391帧，初始HP5000。9周期预热后建立周期1；观察 `[1080,1200)` 不变，实际尾段到1471。六项真实待执行任务剩余31/32/151/152/271/272帧，来源动作年龄359/239/119帧；窗口伤害427.5、DPS213.75。两次真实运行只交换同帧治疗／消耗先后，边界HP同为10000但队列不相同，执行后分别10000与9000，证明没有仅凭血量相同就声称周期一致。截断尾段和Aura配置仍不能获完整证明。

浏览器另用359/360帧延迟边界变体，通过正常分析Worker建立周期1，实际终点1440。第1080帧事件前HP5000，队列保留剩余0帧消耗；随后1080降至4000、1081回5000。预热账本按 `[0,1080)` 展示12条实际生命事件，结束HP5000，没有提前计入边界消耗。导出包含真实状态、在途任务和观察范围。

## 当前数据与剩余工作

映射`.15`生成120身份／916命中／541完整条件动作／146部分／18具体映射阻塞；194武器／958合法精炼及53二件／44四件规则不变。较上轮净增36命中和4完整动作，移除3部分动作；完整动作包含明确条件，不等于完整可执行角色。久岐忍自身覆盖41命中／5完整动作，其中包含原有动作。

活动目录仍 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional；verified为空，preview数0。最新发行来源观察仍为2026-09-23 14:22香港时间，不冒充本轮重新核实。

久岐忍低突破初击来源冲突未解决；E动态快照TODO、治疗／扣血／产球／环刷新、C4外部触发和C6时钟未自动执行。通用生命队列完成不表示动态最大生命、生命之契、死亡／复活、角色被动或敌人攻击完成。Aura和随机私有状态、完整角色／装备、特殊反应剩余范围、可靠预览数据与广泛外部整队验证仍见[已知限制](known-limitations.md)。

[上轮QA](history/qa-report-2026-09-24-before-kuki-health-phase.md)保留刻晴／生命入口及真实失败。120秒模拟性能仍仅引用2026-09-23T06:42:28.209Z的[历史基准](cross-validation/simulation-execution-benchmark.md)，本轮未重测。既有大chunk和无效动态拆分构建提示保留，未做无关重构。

本轮 `git diff --check` 首次exit0、无输出，仅检查已跟踪差异。[日志](validation/kuki-health-phase-diff-check.log)／[退出码](validation/kuki-health-phase-diff-check.exit)。
