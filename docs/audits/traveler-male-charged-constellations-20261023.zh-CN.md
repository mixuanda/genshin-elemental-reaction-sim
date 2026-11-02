# 空风形态基础物理重击 C0–C6（2026-10-23）

基线 `c8a3024f96aea587f43913a72267fb3839198e47`。只扩展现有 `male-charged-aether-anemo-c0` 的两段基础物理重击命座范围，旧 skillId／hit ID 保持兼容。其他六种男性旅行者形态仍只支持 C0；未开放荧、风 E/Q、附魔／剧情特殊重击或自动轮转。

先运行新 C6 正例，原实现在已有真实起手、20 体力、两次接触和实际稳定面板全部明确时仍因 C0 门失败：**0/1**。记录在 `/tmp/GIDPS-aether-anemo-charged-evidence-20261023/before.{json,log}`。源依据与字节身份见新增 [manifest](../../packages/game-data/sources/traveler-male-charged-constellations/manifest.json)，旧 source 包未改写。

| 命座 | 固定来源作用与本次边界 |
| --- | --- |
| C1 | 仅风涡剑牵引周围敌人与物体。不能由此推定重击实际接触。 |
| C2 | 仅充能效率 +16%；不增加这两击的 ATK、物理增伤、双暴或普攻等级。本模块不验证能量或就绪。 |
| C3／C5 | 分别 Q／E 等级 +3；输入的有效普攻等级只使用一次。 |
| C4 | 仅风涡剑持续期间受到伤害减少10%，不增加自身物理重击。 |
| C6 | Q 回调只减少风及实际吸收的冰／火／水／雷元素抗性；不减少物理抗性，也不为重击新增回调。 |

固定 Optimizer `180a0a1015cb725c7570cd828eb086749960df98` 的男性 auto[5]/auto[6] 是精确倍率来源；gcsim `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 的 Anemo charge 明确 Physical、读取普攻天赋，分别在第9／20帧取样并命中。C1/C4 原文以固定 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf` 的命座文件补证，新原文 SHA256 `15adfa19a48a957f7344ab3e74e6b81beb8ccf92b0c797094f66338c2b441d26` 与固定 ref 的 GitHub blob `8cb35f7be8f6de9b700ffe823bb5f512ad598e09` 一致。新归档保留8份原文字节及完整两段15级倍率向量，SHA256 `83705409418e1bcb9a5140d047909ee946282457a253f966263a39c697501575`。沿用的旧 gcsim 来源仍保留其原有“固定压缩包／计算 blob、非完整树验证”限制。

外部附魔和 TrueMoon 剧情增益仍须逐击明确关闭；固定风形态没有其他自身重击附魔命座。完整重击仍要求合法前置普攻、真实计数1–4、实际就绪、至少20体力、体力倍率1、无中断／卡肉／替换、两个接触布尔值、观察到第20帧，以及逐次实际快照或明确稳定面板。已发生的独立一击只依赖本击资格，不新增未来完整动作要求。未知、明确不成立与合法零保持不同；不会自动填“否”、命中、体力或稳定状态。旧模板资格覆盖在编译成事件 ID 后仍保留优先级和可编辑控件。

声明合成输入为 ATK2000、角色／敌人90级、10%物抗、50%暴击率／100%暴伤，无额外增伤或反应。NA10 下第一击 `2000×1.105×0.5×0.9=994.5`，第二击 `1080.18`；两击非暴／暴击／期望为 **2074.68／4149.36／3112.02**，C0–C6 相同。显式 NA13 使用1.339／1.45436，C3/C5/C6均不再加等级；NA15使用1.495／1.6238。不同实际快照也分别使用自己的 ATK：第9帧1800、第20帧2200时为 `(1800×1.105+2200×1.2002)×0.5×0.9=2083.248`。

定向 **26/26 通过**，另3项旧生命周期测试按名称未选择。包括新 core 18项、adapter 7项及原七形态 C0 重击测试1项；没有跳过阻断正负例。涵盖六种非风 C6 拒绝、错误性别／形态／天赋／动作／段落拒绝、未知或开启附魔／剧情拒绝、19体力／0计数／缺接触／不完整观察拒绝、明确落空只算实际命中、JSON及面板转换一致、转换后改命座或等级拒绝旧快照。报告哈希和命令见 [结构化记录](traveler-male-charged-constellations-20261023.json)。未跑全回归、全量类型检查、浏览器或原生模拟；root统一构建与实际页面验收。

公共接线仅需：

1. `packages/sim-core/src/traveler-male-charged-constellations.ts` 导出 `travelerMaleChargedConstellationScope(document, hit?)`，返回 `{allowed, maximumConstellation, reason, sourceRefs}` 或 `undefined`。公共命座门逐命中传入 `hit`；helper核对精确空／元素形态／combat1、有效普攻1–15级、物理charged及原模板或事件段落ID。范围不能转借给角色其他动作。core prepare 已独立使用同一审阅合同。
2. 将 `apps/web/src/calculator-traveler-male-charged-requirements.ts` 的 `travelerMaleChargedRequirementAdapter` 加入默认 registry；另有纯收集函数 `collectTravelerMaleChargedRequirements(document)`。它只连接现有专属控件，不写入状态。schema、prepare/reset/finalize API均不新增字段或改名。
3. 真页面建议：导入／选择空风 C6、普攻基础10且无额外普攻等级，使用旧兼容 skillId；默认独立第一击只应提示外部附魔／剧情两个条件，均明确否后验994.5，保存重开仍一致；改未知或是应阻断。切完整施放后补真实起手／体力／接触／观察／面板条件验2074.68；已转换面板再改命座须拒绝旧快照。另确认空岩 C6 仍阻断。单元 adapter 使用显式注入，未把尚未共享接线当作产品完成。
