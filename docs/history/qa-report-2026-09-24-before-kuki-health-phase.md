# QA 与实测报告

更新：2026-09-24。本轮接入刻晴 Q 的 C4/C6 逐击条件，以及动作治疗／生命消耗的真实共用 HP。独立计算器仍为主功能，不要求队伍；完整 goal 保持进行中。未提交、推送或部署。

## 实际改变

刻晴十击逐行明确 C4 是否有效、共享 ATK 是否已含、基础攻击，以及 C6 的三类外部状态和已含类别数。本 Q 自身类别按固定来源计一次。C4 修正为基础攻击×25%×状态差，C6 为6%×类别数差；缺失只阻塞对应命中。单击可独立恢复，来源装备／最终面板／导入及 JSON 不重复加算；临时状态不能由展示柜证明。布尔编辑保持展开行，数值修改直接更新共享核心。来源和核心细节见[刻晴专项](validation/keqing-constellation-context.md)。

`healthChanges` 由成功行动排入真实队列，与反应自伤共用生命池。固定／比例治疗、来源与受治疗加成、有效治疗、溢出，以及明确下限的生命消耗均由共享 AST 计算。按执行时选择前台／指定角色／全队，能量失败不排事件；生命消耗不扣护盾或计为伤害。普通队伍页可编辑这些明确条件；合成条件按钮有清楚标记。主结果和启动视图按实际 HP 时间线显示观察边界前状态，详情显示公式、变量、代入、中间值和解释。既有燃烧区“自伤未模拟”固定文案改为实际模型状态。来源、版本边界及核心检查见[生命专项](validation/player-health-runtime.md)。

## 已执行检查

| 范围 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 新刻晴核心3项 | 首次3/3通过，1.40s／测试231ms、exit0 | [日志](validation/keqing-constellation-context.log) |
| 新生命核心3项 | 各项最终通过；首次fixture兼容目标错误、后续tick/冷却预期和帧时钟修正均保留；最后仅第三项1通过2跳过，926ms／测试140ms | [逐次命令、失败及实测](validation/player-health-runtime.md) |
| `npm run data:status` | 本地生成两次exit0；第二次更正来源manifest历史范围标签，未联网刷新版本 | [首次](validation/keqing-constellation-data-status.log)、[最终](validation/keqing-constellation-data-status-final.log) |
| `npm run build` 首次 | exit1，类型检查发现可选baseAttack、Map键、ES目标findLast、回调null收窄及新wire类型断言问题；未进入生产构建 | [日志](validation/health-constellation-build.log)、[退出码](validation/health-constellation-build.exit) |
| 修正后 `npm run build` | exit0；全工程TypeScript与309模块生产构建通过，335ms | [日志](validation/health-constellation-build-retry.log)、[退出码](validation/health-constellation-build-retry.exit) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/health-constellation.spec.ts` | 首次2/2通过，总4.7s；刻晴2.5s、生命1.1s，exit0，无重试 | [浏览器报告](validation/health-constellation-browser.md)、[日志](validation/health-constellation-browser.log) |

新浏览器流程使用4173生产预览，保留默认30秒预算和全部断言，仅关闭自动化trace的DOM快照。真实表单输入、逐击未知／恢复、同一展开行连续填写、单击↔完整施放、JSON，以及队伍页新增生命动作、保存／执行／记录重跑均经过验证。测试耗时不是产品性能基准。没有旧测试全集、性能重测、大样本随机模拟或外部gcsim重跑；通过构建不等于游戏机制认证。

## 实测数值

- 刻晴 T1 首击：共享ATK1000、基础攻击500、C4有效且未含、C6本Q＋普攻类别，共享核心得到 `(1000+500×0.25)×0.88×1.12×0.5×0.9=498.96` 非暴击，A4后65%CR／100%CD的期望为823.284。页面完整十击明确状态后的非暴击2315.376、期望3820.3704；再清空尾击状态不会阻塞已完整首击。
- C4跨击变化核心场景：初击无buff、后九击加125，整次非暴击2323.8／期望3834.27；共享面板已含125时，首击移除且后续不重复追加，结果相同。装备基础300＋400时固定加175，不再乘50%ATK。
- 页面生命场景：`5000→3000→4300→2500`。第二步治疗 `1000×(1+0.2+0.1)=1300`；最终请求消耗90%当前生命，但25%最大生命下限使实际只扣1800。总恢复1300、消耗3800；完整记录导入重跑一致。
- 核心另验证2500起步、消耗下限、3250治疗、1250溢出、下限处消耗0及超观察窗事件不执行。第15帧切人后的主动／全队治疗和消耗先更新B到3500，同帧燃烧读取同一个3500实际生命值；不是独立HP估算。

## 数据、边界与历史

条件映射`.14`仍为120身份／880命中／537完整条件动作／149部分／18阻塞，194武器／958合法精炼与53二件／44四件。本轮扩明确命座范围，没有凭泛化生命执行增加完整角色计数。released/provisional目录仍7.1，verified为空，preview数0；最新发布来源观察仍为2026-09-23 14:22香港时间，没有冒充本轮重新查证。

C4/C6触发历史和时钟尚未自动推演。治疗／消耗要求明确数值，尚不支持动态最大生命、生命之契、死亡／复活、敌人攻击、被动回调及角色生命技能自动映射。生命待执行队列尚未进入完整相位检查点，含该配置仍不能证明周期；其余随机／Aura私有状态阻塞保留。更广缺口见[已知限制](known-limitations.md)。

[上一轮QA](history/qa-report-2026-09-24-before-health-constellation.md)冻结耐力检查点、渲染探针及原始失败。120秒模拟性能仍仅引用2026-09-23T06:42:28.209Z的[历史基准](cross-validation/simulation-execution-benchmark.md)，不是本轮性能结论。构建既有大chunk与无效动态拆分提示未进行无关重构。

本轮 `git diff --check` 首次exit0、无输出，仅检查已跟踪差异。[日志](validation/health-constellation-diff-check.log)／[退出码](validation/health-constellation-diff-check.exit)。
