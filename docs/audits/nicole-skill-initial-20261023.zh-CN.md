404c76a的实际角色文档中，妮可C2的 `nicole-skill` 初击只有未审阅命座阻断；没有角色条件控件可恢复本次E的实际增攻和C2减抗。Q实体另有严格C0与无E状态门。本次保持原E skillId/hitId，只增加可选 `gameContext.nicoleSkillInitial` 处理C0–C2的9帧初击，不开放C1协同造影或Q完整日程。旧无context存档不迁移，原始复现留在 `/tmp/GIDPS-faruzan-nicole-single-evidence-20261023/before.json`。

固定B4原文、完整15级倍率/E增攻比例及上限、尘光七谕原始实现身份见 `packages/game-data/sources/nicole-skill-initial/manifest.json`。原归档未改；固定社区源码及其顺序不是当前官方游戏认证。

关键顺序是E起手清除旧E/A1/C2攻击增益；8帧先创造护盾，精1尘光在 `OnShielded` 同步取得首次非转换攻击样本，然后本次E按 `min(样本×本级E比例, 本级上限)` 授予增攻，再给C2的300点平攻；9帧初击取得攻击快照。新A1来自此击的 `OnEnemyHit`，因此其300点攻击不会回填已取样的攻击力。

抗性不能照攻击快照处理：已归档 `pkg/enemy/attack.go` 明确先同步发出 `OnEnemyHit`，再读取抗性计算伤害。满突破妮可A4在这个事件内升级自身A1，C2 ticker同步施加25%火抗降低，所以本记E可享受新减抗。完整合法E最早31帧换人，初击仅9帧；若未被额外位移，5米E命中范围包含在同心10米C2范围内，不再要求玩家重复选择前台或范围。显式后台/超范围的独立数值负例返回0；此受限E路径中显式超范围、位移或未知记录保持阻断，不把矛盾当作自动25%。

来源分歧保留：原生 `a4Init` 缺少突破4门，固定天赋说明则需要解锁A4。C2、突破0–3的此自动同击减抗分支暂不代算。不能让玩家填一个开关绕过来源冲突。

`resolveNicoleSkillInitialGrantAttack` 只在普通装备面板、无conversion类modifier、无外来攻击调整、输入明确未含自身E/C2/A1，且上述实际路径资格成立时，调用共享 `resolveCalculatorStats` 推导8帧样本。其他输入必须给实际记录，不能由已含增攻的最终ATK倒算。显式观察优先，合法0保留；自动记录标记为 `equipment-current`，手填为 `observed`。同槽外来公式保留并阻断冲突；历史转换保存实际状态、等级及快照身份，变化后不能重新盖写。

`deriveNicoleSkillInitialWeaponContext(doc, currentEffectContext)` 仅为已启用精1尘光返回合并后的既有effectContext：`weaponEffectActive=true`、`offField=false`、`catalystSnapshotAtk=同一份8帧样本`。不修改传入对象、不清其他字段、不向角色的damageBonusFormula添加任何武器增伤。装备模块继续负责本身的12%攻击及先导之光公式；公共materialize路径应先绑定该helper，再重新解析装备，防止先把E/C2/A1加进武器首次样本。此绑定仅证明本次首次刷新，不生成每0.5秒后续刷新、回能或队伍传播。

公开hooks为 `nicoleSkillInitialContextSchema`、`initializeNicoleSkillInitialDocument`、`prepareNicoleSkillInitialDocument`、`resetNicoleSkillInitialPanelAccounting`、`finalizeNicoleSkillInitialPanelAccounting`、`isNicoleSkillInitialHit(doc, hit)`、`NICOLE_SKILL_INITIAL_MAX_CONSTELLATION=2`。控件导出 `renderNicoleSkillInitialControls`、`updateNicoleSkillInitialControl`、`nicoleSkillInitialRequirementAdapter`。输入回调应先调用专属update：手填/清除攻击样本时同步更新或清除grantAttackSource，避免把手填误作旧自动值。公共schema/source-cast新context提前分派/命座gate/控件注册由根线程负责；无新context旧档走旧路径，新建文档才initialize。

11项定向断言已通过，包括负抗区间、独立E等级、增攻上限与合法0、已含份额、A1不回填、低突破及范围负例、外来公式、实际精1装备解析与既有武器公式、JSON往返及历史身份。E10、8帧ATK2000、C2前输入ATK2000时，初击ATK为2600，倍率2.4912，敌原抗0.1经同击C2后为-0.15；90对90、CR50%/CD100%、无反应时非暴3481.452、期望5222.178。相同2000样本的尘光精1由既有公式给20%增伤，期望6266.6136。独立Decimal算式也保存于manifest。

这些单元直接运行角色prepare、普通伤害AST和现有装备公式；没有修改公共schema或造临时注册以声称页面已可用。报告为 `/tmp/GIDPS-faruzan-nicole-single-evidence-20261023/nicole-focused-final.json`。根线程负责整合后的实际页面及保存重开验收。未跑native120秒、全套回归、push或部署。
