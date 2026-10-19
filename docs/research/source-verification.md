# 来源核查：版本、公式与证据边界

本报告完成于 2026-09-22，观察时间为 `2026-09-22T14:35:20Z`（香港时间 22:35）。已完整阅读用户提供的 `GENSHIN_DPS_MASTER_PROMPT_EN.md`。本文记录本次实际浏览及源代码对照，不把主提示词中的版本目标当作已发布事实，也不把文献核对称为游戏实测。

## 1. 实际版本与请求目标

| 对象 | 本次可支持的结论 | 证据与限制 |
| --- | --- | --- |
| 最近观察到的官方已发布版本 | **7.0** | 官方账号 `genshinimpact` 的 [7.0 更新说明](https://www.reddit.com/r/Genshin_Impact/comments/1vm0zdc/everwinter_without_mercy_version_70_update_details/)；[HoYoLAB 官方原文](https://www.hoyolab.com/article/46233468)的检索正文给出 2026-08-12 06:00 UTC+8 开始维护。 |
| 用户请求的 7.1 | **official-next / 已开放预下载**，本观察时点尚不能标为已发布 | 官方账号的 [7.1 维护预告](https://www.reddit.com/r/Genshin_Impact/comments/1wm149c/version_71_update_maintenance_preview/)明确维护开始于 **2026-09-23 06:00 UTC+8**，完成后更新至 7.1；该时间是维护开始时间，不是已证实的服务器开放时间。 |
| 用户请求的 7.2 V1 partial | **未取得可核验、可重放的 V1 数据快照** | 未取得版本固定、具实体清单和数值字段的来源；应保留失败/未完成的发现记录，而不是创建内容为零的“成功同步”快照。 |
| 本地数据包的实际支持 | 不由上述发布事实决定 | 数据发布、来源解析、数值证据、动作机制以及可执行范围必须独立记录。数据清单见项目审计和更新状态；本报告不把目录版本提升为已验证正式服数据。 |

7.1 官方预告中的详情链接 `https://hoyo.link/USv7RhftM` 解析到 [HoYoLAB article_pre/18014398241022008](https://www.hoyolab.com/article_pre/18014398241022008)。网页工具未取得正文；直接 HTTP 下载只得到 7,213 字节的通用 JavaScript 外壳，与 7.0 URL 的外壳 SHA-256 相同。因此该外壳哈希**不证明公告正文**，正文证据采用实际读到的官方账号预告，不能把 HTTP 200 记为完整文章成功采集。

请求时的日期与发布日期存在实质差异。发布通道应在后续重新观察到维护完成/正式更新事实后才调整；到达计划时间本身不足以自动证明发布成功。

## 2. S1—S5 本次读取与固定证据

完整 URL、HTTP 状态、字节数、SHA-256、ETag、Last-Modified 和逐项读取时间保存在 [source-retrievals.json](./source-retrievals.json)。这是取证元数据，不复制网站全文。HTML 的修改日期与图像的 HTTP 修改日期属于不同证据，不互相替代。

| 来源 | 实际页/固定版本 | 观察结果 |
| --- | --- | --- |
| S1 | [KQM Damage Formula](https://library.keqingmains.com/combat-mechanics/damage/damage-formula)；对应源文件最近提交 [`bd7c18fa07735381a157e8397e9e55b3fc377be1`](https://github.com/KQM-git/TCL/blob/bd7c18fa07735381a157e8397e9e55b3fc377be1/docs/combat-mechanics/damage/damage-formula.md)，提交日期 2025-07-28 | 2026-09-22T14:30:46Z 成功读取；没有把该文件提交日期解释为全部游戏机制的适用版本。 |
| S2 | [Lunar Reaction Guide](https://keqingmains.com/misc/lunar-reactions/) | 页内适用范围 **Luna VI**；HTML `dateModified=2026-08-13T14:34:22Z`；本次读取 14:30:48Z。 |
| S3 | [Stellar Glimmer Reaction Guide](https://keqingmains.com/misc/stellar-reaction-guide/) | 页内适用范围 **7.0**；HTML `dateModified=2026-08-19T17:00:11Z`；本次读取 14:30:49Z。 |
| S4 | [KQM Calculation Standards](https://compendium.keqingmains.com/) | 页面自报 **2.0.2 / 2024-05-03**；本次读取 14:30:51Z。 |
| S5 | [gcsim Introduction](https://docs.gcsim.app/)及下面的固定代码 | 页面说明仍在开发、结果需核查；介绍页本身不能证明某角色或 7.0/7.1 的实现覆盖。 |

普通公式核对范围：角色与武器基础攻击相加后，先加百分比及固定攻击；技能基础项与附加基础伤害分离；增幅精通项为 `2.78 EM/(1400+EM)`，剧变为 `16 EM/(2000+EM)`，激化为 `5 EM/(1200+EM)`；抗性采用三段函数。S1 明确防御降低最多 90%。这些规则足以核对数值教学算例，但不自动证明具体角色天赋、命座、装备或实战反应覆盖。[S1](https://library.keqingmains.com/combat-mechanics/damage/damage-formula)

## 3. 特殊反应：图像公式已人工检查

公式图不能仅靠网页文本摘要读取。本次下载并逐一查看了 12 张公式图，图像地址和哈希均在 JSON。完整表达式和实现边界由 [special-formulas.md](./special-formulas.md)记录；下列是交付给实现者的关键核查结果。

月反应：月感电、月结晶区分直接伤害与反应伤害；月绽放反应生成草原核与资源，本身没有即时月绽放伤害。精通项是 `6 EM/(2000+EM)`；感电和结晶系数分别为 3、1.6。图中个人暴击计算位于贡献者排序之前；排名权重为 `[0.6,0.3,0.05,0.05]`，不能用全队求和替代。直接伤害使用属性及天赋系数，反应伤害使用等级基数；不应用普通伤害加成和防御区。状态机制仍需独立验证。[S2](https://keqingmains.com/misc/lunar-reactions/)

星反应：星超导反应本身是场地/状态，伤害来自对应能力；星扩散有初始风伤和漩涡冰伤，反应系数依次为 `0.75`、一级 `2`、二级 `3`。直接星扩散系数为 1。星超导直接伤害依赖极星领域计数；特殊精通项、个人暴击后排序以及贡献权重已查看图像。普通元素/通用/天赋伤害加成与防御区不适用。该页面描述的领域、Radiance、涡旋升级及附着行为，不等同于本项目已经实现。[S3](https://keqingmains.com/misc/stellar-reaction-guide/)

图像中的 `Elevation` 是最后独立相乘的量；本次没有核实所有角色的提升百分比、叠加规则和上限。安全的公式输入是明确的 `elevationMultiplier`，不能由属性名猜成任意加法项。贡献者不足四人时不重归一化，是对显示公式缺项作零的解释；真实贡献者收集窗口、去重和归属仍需机制证据。并列数值的稳定排序可作为可重放实现策略，但不能宣称是游戏归属规则。

一个独立的数学核对：A 的非暴击贡献 100、暴击率 50%、暴伤 100%；B 的贡献 150 且不暴击。先枚举暴击再排序，结果为 `(120+165)/2=142.5`；先取贡献期望再排序为 `150×0.6+150×0.3=135`。这证明均值排序会少算 7.5；此例是合成数学案例，不冒充真实角色实测。

## 4. 本地公式与机制检查

- 基线 `packages/reaction-formulas/src/profile.ts` 使用固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，并明确标记 `fixed-gcsim-provisional`、`officialServerTruth=false`、`completeGcsimParity=false`。这些限定应保留。
- 本次获取该提交的 [reaction.dm.go](https://raw.githubusercontent.com/genshinsim/gcsim/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.dm.go)，用 Python 解析两侧数组：本地 **100** 项、上游 **200** 项，本地 1–100 级与上游前 100 项 **100/100 完全相同，差异 0**。本地是精确查表并拒绝非整数及越界，不存在该模块插值问题。上游 101–200 项存在，不代表可以给玩家角色开放这些等级。
- 普通反应倍率已与 S1 对照：超载 2.75、超导 1.5、感电每次 2、碎冰 3；本次不应把它们“修正”为旧倍率。
- 基线 `formulas.ts` 历史字段 `defenseReduction` 实际表示有符号的防御调整，使用 `1+adjustment`。不能直接换成 `1-reduction` 而不迁移数据。其原始下限 -1 允许 100% 防御降低，与 S1 的 90% 上限不同；已向主实现者指出，应采用独立规则版本或诚实保留历史实验模式并限制已验证结果。
- `packages/mechanics/src/characters/durin.ts` 原有证据均标 `provisional`，只定义有限审计向量，代码明确不是完整角色预设。来源包括锁定社区数据及 gcsim。不能据此报告全角色、全命座或完整月/星反应支持。
- **具体错误：白 E 附着映射。** 基线声称固定提交中白 E 未设置 `Durability`，因此按 0/无附着处理。然而本次实际获取的同一提交 [skill.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/durin/skill.go#L74)在 `skillRecastWhite` 中明确有 `Durability: 25` 和 `ICDGroupDefault`。本地缺少白 E 附着，且来源说明与被引用代码相反。该文件于 `2026-09-22T14:35:39Z` 下载，4,729 字节，SHA-256 `14bded4b59a93b25f2ee7a49b7fa2bef2598054eddd411790ae7fd87120c256c`。应修复映射、来源说明和对应正确性测试；旧行为只能作为历史复现样例，不能为保持黄金输出而保留错误。黑 E 的 18 帧 ICD 与 `[1,0,0]` 应用序列和固定源文件一致。

这里记录的是审计发现的基线。后续实现修复后的具体状态、测试与限制以本次 QA 报告和支持矩阵为准。

## 5. 基准声明

KQMS 2.0.2 要求角色/武器 90 级、天赋 9（适用时 +3）、显式装备和命座；默认满生命及满大招，敌人 100 级、全抗性 10%。gcsim 分支要求至少 90 秒、1,000 次迭代及指定随机延迟处理，并规定能量掉落及目标尺寸位置。表格充能估计的粒子假设不能替代 gcsim 条件。未全部实现时使用“自定义 / KQMS-inspired”并列出偏离项；120 秒不是该标准的唯一固定时长。[S4](https://compendium.keqingmains.com/)

## 6. 明确未取得的证据

| 尝试 | 实际结果 | 处理 |
| --- | --- | --- |
| `ambr.top/en/changelog`、`api.ambr.top/v2/en/changelog` | 网页工具报告不可访问 | 未将网络失败等同空数据；不从搜索标题导入数值。 |
| `homdgcat.wiki/gi/char?lang=EN` | 502 | 没有读取成功的 7.2 V1 快照。 |
| Fandom 的版本页 | 工具报告不可访问/robots 限制 | 未规避限制。 |
| Fandom Stellar-Conduct 索引结果 | 旧抓取同时含 upcoming 与 Luna VIII released 标签 | 只作为存在冲突的发现记录，不作为当前发布状态或数值验证证据。 |
| KQM WordPress pages API 的两个 slug | 404 | 使用已读到的 HTML 元数据，不编造 revision ID。 |
| 独立游戏内测试、完整外部模拟器端到端复算 | 本子任务未执行 | 源码数组一致性和文献核对不冒充游戏实测。 |

7.2 V1 的版本、实体、缺失字段、源文件、采集时间和差异记录应在取得真实快照后填写。目前“未知”比伪造一份完整数据更准确。所有自动模拟还需要按所选动作实际依赖，验证角色定义、队伍开启条件、附着、ICD、资源、快照和实体时序。
