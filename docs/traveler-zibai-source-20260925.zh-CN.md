# 旅行者状态、跨来源 Q 与兹白有限两段增量

2026-09-25。本批围绕永久独立计算器接入三组来源协议，共 10 个条件完整动作：冰旅行者 E／Q 各两性、风／草旅行者 Q 各两性，以及兹白灵驹重施／Q。正常表单、完整观察日程、已发生单击、共享公式、逐击快照及 JSON 使用同一核心，不要求队伍或轮转。完整只指明确条件下的本次动作，不表示角色全部技能、命座或自动团队执行已完成。

本批**新增1核心文件／1聚合用例及1页面流程均经定点复验通过**。数据生成、一致性、状态和类型／生产构建通过；核心trace子节点与页面JSON依赖重复两次真实生产失败及窄修完整保留，已通过项不重跑。近期累计从36文件／88用例／22页面增至**37文件／89用例／23页面**。全量 goal 继续进行，没有提交、推送或部署。

## 数据分类和证据身份

实际生成版本为 `gcsim-b4ae769+a7dc4bf+optimizer-180a0a1-reviewed-hits.25+durin.8`：**120 身份、1191 命中模板、662 条件完整动作、16 部分动作、3 阻塞映射**。相对 `.24` 的 1183／652／18／11，本批新增 8 个模板、10 个条件完整动作，替换兹白 2 个部分组件并解除 8 个特定阻塞。模板数不是日程实际展开命中数。

剩余 3 个分类阻塞为水旅行者长 E 两性和伊安珊的来源问题。风／草 Q 的旧冲突向量保留在档案中，本批以独立数值来源明确裁决限定动作，不把旧来源改写为已经一致。`numericallyVerified`、`mechanicsVerified`、`hitReady`、`skillReady`、`sequenceReady`、`teamReady` 及 `teamSimulationReadyFromTheseMappings` 仍为 0，`activeVerifiedDataset` 仍为空。

正式目录继续使用 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`；7.1.50 部分预览继续隔离在 `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc`。本批没有新的官方版本观察或预览证据晋升。可组合团队来源能力的 5 角色／5 Q／33 模板仍是独立分母。

## 实际来源和生产范围

| 组 | 已接入的有限协议 | 来源与保留边界 |
| --- | --- | --- |
| 冰旅行者状态 | 空／荧 E 读取实际辉映变化与本人 N／CA／P 敌人命中回调；Q 在 36 帧锁定辉映、寒辉和进攻快照，分别走普通、直接星超导或星扩散核心 | 固定 gcsim `a7dc4bf…`；[39 文件 manifest](../packages/game-data/sources/traveler-cryo-state/manifest.json)。男性动画沿用女性的源假设、男性下落来源缺口及极星实体计数疑点保留；使用实际计数，不自动创建领域闭环 |
| 风／草跨来源 Q | 两性 C0 风 Q 全程无吸收、草 Q 全程无转化；固定候选逐项明确接触或落空。风在 0 帧、草在 54 帧锁面板，草 A4 另读命中时实际精通 | Optimizer `180a0a1…` 四组共 60 个倍率与活动目录全 15 级零容差一致；gcsim `a7dc4bf…` 只作行为来源，原冲突保留。[63 文件 manifest](../packages/game-data/sources/traveler-cross-source-casts/manifest.json)及[来源裁决](../packages/game-data/sources/traveler-cross-source-casts/README.zh-CN.md) |
| 兹白有限两段 | 一次合法灵驹飞踏重施或 Q，由普通岩伤与直接月结晶两段组成；记录真实观察时刻、目标、接触及各自取样 | 固定 Optimizer `180a0a1…`，4 组各 15 级倍率、8 文件。[manifest](../packages/game-data/sources/zibai-finite-casts/manifest.json)与[公式／状态合同](cross-validation/zibai/finite-pairs.md)。没有来源认证的动画帧，不把合成观察 10／20 帧当游戏时序 |

归档数量按各包记录，包含重复原文，不加总为互不重复的文件总量。跨来源 Q 包的 48 份 gcsim 文件只有 9 份匹配其本地 selected-tree，其余 39 份保留固定归档身份与字节摘要；不能借冰旅行者另一包的完整树审查，宣称该包全部通过完整树认证。

各组由 `traveler-cryo-state-*`、`traveler-cross-entity-*`、`zibai-finite-*` 的 context／schedule／formulas 实现，经 [source-cast-context.ts](../packages/sim-core/src/source-cast-context.ts) 统一准备、记账重置和固化，[calculator.ts](../packages/sim-core/src/calculator.ts) 执行同一普通／特殊公式及装备属性阶段。正常控件分别为 `calculator-traveler-cryo-state-controls.ts`、`calculator-traveler-cross-entity-controls.ts`、`calculator-zibai-finite-controls.ts`，显示明确状态、逐项观察、历史快照与来源说明，不另算伤害。

冰 E 定时检查 178／354／530／706 帧，每次重新读取辉映；星导模式跳过当次双晶，已排冰晶仍按其取样及飞行交付。本人回调 12 帧 ICD 的等号仍阻塞。Q 的特殊公式不借普通冰伤忽防代替，历史攻击和命中时固有基础提升使用不同输入。未知回调、接触、快照或已含份额不会默认零。

风 Q 九次候选为 94 至 334 帧，观察至 363 帧的递归终止任务；草 Q 八次候选为 91 至 721 帧，观察至 816 帧的 A1 尾段。草灯 A4 使用实际命中时 EM × 0.001，再扣已含增伤；之后获得的精通不倒灌 54 帧快照。独立已发生的一击只读取本击资格和属性，不要求未来实体寿命。

兹白 A4 的 DEF 比例和 EM 先进入装备属性阶段，再执行已有派生转换；同阶段转换读同一阶段快照。灵驹 A1 的 `0.6×DEF` 仅位于其月段的 EM／反应乘区之后，Q 月段不读取 A1 窗口或已含份额。固有月结晶基础提升为 `min(DEF/100×0.007,0.14)`。最终面板保留逐击实际属性和已含 A4 份额，不能对未知历史装备重新补算转换。

## 实际检查与首轮失败

| 命令／阶段 | 当前实际结果 | 原始记录 |
| --- | --- | --- |
| `npm run data:generate` | PASS，exit 0；墙钟 4.784 秒 | [日志](validation/traveler-zibai-data-generate.initial.log)、[退出码](validation/traveler-zibai-data-generate.initial.exit) |
| `npm run data:check` | PASS，exit 0；墙钟 5.090 秒 | [日志](validation/traveler-zibai-data-check.log)、[退出码](validation/traveler-zibai-data-check.exit) |
| `npm run data:status` | PASS，exit 0；墙钟 4.230 秒 | [日志](validation/traveler-zibai-data-status.log)、[退出码](validation/traveler-zibai-data-status.exit) |
| `npm run build` | PASS，exit 0；包含全工程类型检查；墙钟 3.497 秒，546 模块、Vite 515 毫秒。原大 chunk 提示保留 | [日志](validation/traveler-zibai-build.log)、[退出码](validation/traveler-zibai-build.exit) |
| `npx vitest run packages/sim-core/src/traveler-zibai-source-batch.test.ts` 首次 | 1 文件／1 用例失败，exit 1；Vitest 2.61 秒、用例 147 毫秒 | [首次日志](validation/traveler-zibai-core.log)、[退出码](validation/traveler-zibai-core.exit) |
| 同一聚合核心定点复验 | PASS，exit 0；1文件／1用例，Vitest 2.09秒／墙钟2.590秒，用例111毫秒 | [retry1日志](validation/traveler-zibai-core.retry1.log)、[退出码](validation/traveler-zibai-core.retry1.exit) |
| 修复trace后的 Web 单独打包 | PASS，exit 0；墙钟0.779秒，546模块、Vite512毫秒；不是再次全工程类型检查 | [bundle retry1](validation/traveler-zibai-bundle.retry1.log)、[退出码](validation/traveler-zibai-bundle.retry1.exit) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/traveler-zibai-calculator.spec.ts` 首次 | 1条失败，exit 1；用例1.4秒／墙钟2.415秒。最终JSON完整命中比较发现重复依赖 | [initial日志](validation/traveler-zibai-browser.initial.log)、[退出码](validation/traveler-zibai-browser.initial.exit) |
| JSON幂等修复后的Web单独打包 | PASS，exit 0；墙钟0.762秒，546模块、Vite499毫秒；不重复全工程类型检查 | [bundle retry2](validation/traveler-zibai-bundle.retry2.log)、[退出码](validation/traveler-zibai-bundle.retry2.exit) |
| 同一页面定点复验 | PASS，exit 0；1条流程，用例1.4秒、Playwright1.7秒／墙钟2.155秒；复用现有4173，无重启 | [retry1日志](validation/traveler-zibai-browser.retry1.log)、[退出码](validation/traveler-zibai-browser.retry1.exit) |

初次核心失败为 `Unknown or unexecuted trace child: hitElementalMastery`。兹白 A4 的 DEF／EM 补差触发属性重建，但本击没有另一条独立 EM 调整，旧代码却固定引用该未执行节点。生产窄修为引用实际存在的精通调整或兹白 A4 delta 节点；保留 trace 对不存在子节点的严格检查，没有放宽数值断言或来源条件。随后同一聚合用例retry1通过；修复后的页面产物另由bundle retry1生成，不重跑旧核心文件。

首次 core／build／data-check／data-status 的真实文件名没有 `.initial` 后缀，系命令包装器处理所致；本报告直接链接原文件，不移动、覆盖或改写失败。只有 data-generate 文件有 `.initial` 后缀。

页面首次在JSON重载的完整 `hits` 比较中发现，未选中的兹白普通代表行每次prepare重复追加schedule及逐击依赖。三个本批helper统一改为Set幂等赋值，保持全部选中与未选中命中、数值和trace比较；不通过忽略依赖字段规避问题。根任务只重打包并复验失败页面，没有重跑已通过核心。

## 唯一聚合验收的独立预期

下列独立来源算式及明确合成输入已由聚合核心retry1通过断言；它们不是游戏实测，也不代表逐角色矩阵全部覆盖。页面独立预期和实际测量在下文另列。

核心 A：冰 E 在 170／190 帧切换辉映、171／183／184 帧收到实际声明回调，预期 9 击，183 帧回调因等号 ICD 不生成冰晶。ATK1000、同级零抗零暴时，`1000×(.9168+8×.21392)×.5=1314.08`。独立 Q 星超导以 36 帧 ATK1000 快照、命中时 ATK2000、8 层寒辉、12 次极星应用计算，预期 `1000×(.36754+8×.018377)×2×1.07=1101.14984`，不填未来日程。

核心 B：风／草有效天赋 14 的独立倍率分别 1.818／1.8036；冻结 ATK2000、CR0.5、CD1，目标同级抗性0.1。风九击预期 22088.7；草快照 EM50，实际七击 EM200、一击 EM300，预期 23618.142，验证没有以快照精通替代 A4 实时精通。

核心 C：DEF1000、EM0、零暴零抗，灵驹普通／月段预期 862.64／3013.37216，后者含独立 A1 加值600；Q 两段预期 634.8／3042.97728，声明 A1 窗口和已含999也不误加或误减。合成装备协议先由一岩／两水队友 A4 得到 DEF920／EM320，再让同阶段 `EM×.001→DEF%` 与 `DEF×.1→EM` 得到 DEF1176／EM412；并非真实武器条款。该完整输入贯穿装备转最终面板和 JSON 全 trace 恢复。

唯一页面选草旅行者Lv14的完整八候选、实际一击和54帧历史快照，先保留未知接触阻塞，再明确落空，实际期望 **1521.7875**（非暴击1014.525／暴击2029.05）。随后直接建立兹白Q的已发生月段，实际期望 **3042.97728**；把其他特殊基础提升改为0.1后，期望 **3327.36768**，与独立算式一致。普通DEF乘区没有误入直接月结晶。

页面随后实际应用目录装备，再转最终面板、导出和重载，期望 **3315.9334107998875**，非暴击3175.5730806357856／暴击5982.77968391782。完整gameContext、所有选中及未选中hits、总量和逐击共享trace深比较一致；不只比较单一伤害数字。来源、面板和观察均为明确输入，本流程未建立队伍、未编造未来事件，也未遍历角色、天赋或精炼矩阵。

## 剩余范围

本批没有新增自动队伍来源能力、角色附着／产球／能量轮转、完整姿态资源、命座或新周期检查点。完整条件动作不能替代团队可执行定义，完整 JSON 恢复也不能证明周期闭合。当前 N 连段、水旅行者／伊安珊与七角色补全、周期反应检查点属于下一批实施，不计本批交付或测试通过数。

文档收尾不执行测试或构建；只记录根任务的唯一聚合核心和唯一页面验收，已通过项不再运行。
