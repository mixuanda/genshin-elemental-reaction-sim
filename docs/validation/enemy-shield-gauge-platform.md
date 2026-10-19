# 敌方元素盾量核心：实现与来源边界

本批新增敌盾量结算与普通宿主，并接入主模拟器、当前配置／结果 schema、共享附着 ICD、敌人生命结算及捕获命中还原。正常团队配置／账本控件已提供，应用挂载由根任务负责。当前来源范围有限且仍为 provisional；本批没有新增或运行测试，没有运行构建，不能将静态落盘写成验证通过。

`schemas/enemy-shield-schema.ts` 是统一公开配置与日志定义，core context 仅导出它。`EnemyShieldHost` 从实际共享 ICD 及普通伤害核心取得输入，不接受用户手写逐击削盾 GU。

## 已落地接口

- `EnemyShieldRuntime(definitions)` 仅注册明确定义，不自动生成敌盾。
- `create(definitionId, actualEventPoint, initialGaugeUnits?)` 在真实生成事件建立／替换盾，记录代次和阶段。
- `targetPolicy(targetId)` 在普通伤害计算前返回真实盾类型、元素、当前阶段，以及明确提供的护甲抗性修正。它不把所有护甲设为统一抗性。
- `settle(actualHit)` 从实际共享伤害结果、附着／反应事件、削韧资料计算盾量消耗；归零立即记为击破，返回明确的阶段转换。
- `remove(targetId, nextPhaseId, actualEventPoint)` 处理真实敌方阶段移除；不猜自然寿命或 AI 再生。
- `captureState()` 导出真实状态：定义身份、目标、代次、是否存活、当前 GU、生成／移除帧、阶段。模块没有另一套目标生命或事件队列。

所有适用算术均由现有 `TraceBuilder` 执行，记录公式树、变量解释、原始数值代入、中间值及来源。既有伤害核心输出保留为 `potentialDamage`。存续力场盾的实际生命伤害 `finalDamage` 与 `targetDamageMultiplier` 为 0，既有总伤害／DPS／敌人生命／掉落只累计该实际生命伤害，不把削盾 GU 或潜在伤害填作实战生命伤害。模型下另提供 `totalPotentialDamage`，仅为潜在公式值合计。

## 算法与明确输入

盾量消耗为反应、伤害、削韧三项之和。伤害项是 `damageConversionRatio × damageWithoutAmplifyingReaction × maxShieldGauge / (shieldHpRatio × targetMaxHp)`；最大盾量与敌人最大生命分别保留场景倍率。伤害输入保留实际暴击、DEF、RES 和剧变精通，排除蒸发／融化的增幅倍率。

直接标准元素盾系数使用已归档来源表中的非周期项。表中未收录的输入不会当作零；水／雷盾感电只在实际 tick 时扣 0.4 GU。`gaugeUnitsReachingShield` 必须已经过真正 ICD 与外来 Aura 处理。护甲、岩结晶等可接受带事件身份、系数与来源的真实外部解析结果，模块不会重新发明 Aura 引擎。

岩／Frozen 削韧转换读取明确的 `attackType`、`strikeType`、`initialDamage`，不由角色武器类别、暴击或伤害数值猜测。`Blunt` 不重复叠加 `Melee` 转换。

`createStandardAbyssMageShieldDefinition()` 提供固定历史标准法师参数：火／水／Frozen 基础 12 GU、雷 8 GU，伤害转换率 0.2、盾生命比 1。实际敌人最大生命、场景盾量倍率、生成事件与阶段身份仍须明确输入；未知深渊或联机倍率没有默认值。返回最大盾量计算轨迹。

## 生命穿透和未完成边界

`elemental-force` 存活且本击未击破时阻止生命伤害；语义上的 `elemental-armor` 允许生命伤害穿透且伤害削盾转换率为零。大岩史莱姆按具体来源属于可受伤害削盾的 force shield，不能因主页面某分类段落称其 armor 就套用零伤害项。

来源未给出可通用于所有敌人的击破一击溢出分配。击破事件没有独立转移依据时，接口返回 `breaking-hit-unresolved` 和 `damage:null`，保留真实削盾／击破结果，不虚构 0 伤害或按 GU 比例还原 HP。已有明确依据可通过 `breakingHitTransfer:{hpDamage,sourceRef}` 传入；后续无盾命中正常穿透。

本次普通域已接实际生成／阶段事件、直接命中与共享 ICD、无增幅同暴击公式、公开日志与独立导入重放。尚缺其他反应副作用、剧变交付、真实适用削韧元数据、其余装备／角色回调资格以及检查点归一化。角色暴击触发与西风等武器的护盾交互不能只复用“伤害归零就所有回调失效”规则。定向木／石盾、再生、自然衰减、Fatui 外来 Aura 修改及特殊敌人机制不在当前自动解析范围。

## 来源归档

`packages/game-data/sources/enemy-shield-runtime/manifest.json` 保存原始字节、SHA-256、来源地址和边界。KQM 固定仓库版本为 `a64fcd604ee0d7ee3ebbb93024b49d3311e65521`；作者详细文档导出保留 2022-09 更新时间及变更记录，未改写成当前版本实机认证。公式和标准法师参数保持 provisional。

固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 `Enemy`、`EnemyProfile` 与 `applyDamage` 没有敌盾层；三份原始文件已与固定树 blob 及本地快照逐字节对应归档。玩家护盾模块不能作为敌盾已完成的依据。

来源：[KQM 敌盾主文](https://library.keqingmains.com/combat-mechanics/enemy-mechanics/enemy-shields-armor)、[KQM 实测证据](https://library.keqingmains.com/evidence/combat-mechanics/enemy-mechanics/enemy-shields)、[原作者详细公式](https://docs.google.com/document/d/1SUc9A7O5C7CX0qYHmCqB44uhpHYY-Txgv6rdibM8Jw4/edit)。

## 普通宿主与当前接线

`enemyShieldModelSchema` 的 mode 为 `kqm-standard-force-ordinary-v1`，`eventTiming` 为 `declared-before-frame-input-v1`。定义采用火／Frozen 标准法师参数，生命上限、场景盾倍率和阶段来源明确输入。生成／移除事件分别有 ID、帧、定义 ID 和来源，按照主队列 -2 相位执行；这是明确场景约定，不是宣称所有敌人 AI 都在该相位生成盾。

`EnemyShieldHost.tasks()` 只返回待排入真实队列的任务；`handlePhase()` 在实际执行时修改状态。`prepareDirectHit()` 在普通 Aura 处理前调用：检查真实存活盾与外来 Aura，将命中的真实 `application` 交给 `hooks.consumeApplication`。该 hook 必须操作目标既有的 ICD 引擎一次，不能初始化第二套盾 ICD，也不能继续向普通 Aura 附着同一份元素。结果记录实际 application decision，并随后绑定既有 ICD ledger ID。

首个宿主仅闭合普通直伤的物理／同元素／无附着命中，以及水打火盾、冰打火盾、火打 Frozen 盾的增幅反应削盾。Frozen 盾明确非 Blunt 才允许；未知 strike 或 Blunt 碎冰会拒绝。水向 Frozen 的实际附着、扩散、超载、超导、结晶、周期和草核副作用尚未进入该宿主。无附着的伤害不凭元素标签虚构反应。

实际盾不会伪造成普通 Aura。存续盾的普通 `reaction` 为 `none`，真实附着只进入独立 `shieldReaction` 削盾项。`settleDirect()` 在本击实际暴击已固定后，使用同一 `DamageCalculationInput` 执行共享 `calculateDamageTrace`；不重新抽暴击，不复制另一套伤害公式。击破伤害转移未解析时立即拒绝整场，不输出伪造 HP 伤害。`assertSupportedDelivery()` 用于主执行器的非 direct 交付入口，防止未支持的反应伤害静默穿盾。

`replayEnemyShieldHost()` 不读取敌盾输出日志或最终状态来重建输入。调用方从配置的真实队列任务、已校验的命中／快照／ICD 账本构造事件，按真实 frame/priority/FIFO/intra 顺序重放，得到期望日志与最终状态。当前结果完整性模块由已验证配置命中／真实 ICD 推导盾量，并比较阶段、逐击状态、算术轨迹和终态；这份实现尚未执行本轮验证。

中央现已使用这些挂点：真实 -2 阶段任务；`processShatterHit`／`processConfiguredHit` 前的盾专用共享 ICD 分支；实际暴击后的普通公式；`settleTargetHealth` 前的削盾与生命政策。捕获记录保留完整来源结果，计算器桥显示共同伤害 AST、实际盾 GU AST、末端生命倍率 0，且独立单次计算器入口不依赖本模型。

西风对这些盾不触发有专门实测来源，故不调用其普通伤害回调。其他独立武器、武器叠层、祭礼、普攻随机能量、命中产球、夜魂及未确认圣遗物回调仅在实际盾接触遇到相应模型时报告具体未支持机制，不以 HP=0 泛化所有机制。当前敌盾完整周期检查点明确阻塞：尚未纳入有限盾量、代次和阶段任务，不用空态冒称稳态。

可独立手算的待验证例：标准火盾 12 GU、最大生命 100000，普通 ATK1000、倍率1、90/90级、防御乘数0.5、抗性0.1、不暴击时潜在伤害450；伤害削盾为0.2×450×12/100000=0.0108 GU。实际1 GU水附着被共享 ICD 放行时再消耗2 GU，合计2.0108，剩余9.9892，生命伤害0。相同上下文的后续 ICD 阻塞命中仅消耗0.0108，剩余9.9784。此处是人工公式期望，未声称执行测得。
