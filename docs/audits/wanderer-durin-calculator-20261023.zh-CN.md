# /goal 流浪者／杜林实际主输出入口

基线 `404c76a`。真实 `getCharacterDocuments` 修前只给流浪者一个E初击入口，杜林只有白E一击／黑E三击；原始默认阻塞及已有控件见 `.before.json`。本提交仅新增角色专属文件，不改公共registry、UI、schema或构建文件，不运行120秒或原生模拟。

新增流浪者C0–C6四种空居普攻单击（第三段两击分别选）、仅C6的四种对应追加单击、Q固定五击组（可单选或确认五击合计）。NA使用独立有效NA×E；C6只有0.4×原Mult，使用自己的新快照，不复制父伤害、武器层数或A4风矢。火30%攻击按基础攻击补差，冰20%暴击按已含百分点补差；“均未生效”只指这两种增益，水／雷及C4随机吸收不被否定。Q五击共用固定来源55帧取样，命中92/98/104/110/116f；C2在按Q时取已消耗空居力×4%，上限200%，只影响Q。C3/C5均由独立有效等级一次处理。

新增杜林C0–C2当前白Q已经发生的一次白焰之龙追击。当前Q第1–10次自动使用A4，倍率为 `1+min(生成该段时总攻击/100×0.03,0.75)`，第11–20次不再强化；不让玩家手填任意倍率。当前Q只有这两种DoT消费A4，旧Q由burstSrc失效，因此此索引可推导；未生成完整20tick。C2取本击此前已经生效的50%火伤并扣除输入已含份额；不由当前反应猜触发。白Q C1给其他前台队友，不给杜林自身，黑Q不在本次范围。

两份 `packages/game-data/sources/{wanderer-primary,durin-burst}/manifest.json` 保存固定b4源码完整SHA/Git blob和15级向量。流浪者Q另绑定已审阅137修复，避免原C2 StatMod向非Q泄漏；未改137或原生。固定社区实现不是游戏认证，55f和C6快照时点保留原源码近似限制。图莱R5与黑蚀R1沿用已有装备规则：前者需实际窗口／前台／增伤单位，后者有常驻爆发16%暴伤及另一个实际攻击窗口；不自动猜窗口或当前队伍魔导资格，黑蚀触发击攻击TODO也未静默修复。

## 根线程最小接线

- `classified-hits.ts`：引入并加入 `wandererPrimaryMappings`、`durinBurstMappings`；总mapping版本由root统一递增。ID以这两个独立mapping文件为准，旧E ID不变。
- `calculator-model.ts`：把 `wandererPrimaryContextSchema`、`durinBurstContextSchema` 作为可选 `gameContext.wandererPrimary/durinBurst`，不添加默认战斗状态。
- `source-cast-context.ts`：按 `isWandererPrimaryAction/isDurinBurstAction` 调用对应 `prepareWandererPrimaryDocument/prepareDurinBurstDocument`；panel reset/finalize 注册 `resetWandererPrimaryPanelAccounting/resetDurinBurstPanelAccounting`、`finalizeWandererPrimaryPanelAccounting/finalizeDurinBurstPanelAccounting`。finalize只在真实转换阶段调用，不在普通导入时证明历史快照。
- `character-calculations.ts`：新动作初始化分别用 `initializeWandererPrimaryDocument/initializeDurinBurstDocument`；命座门只对这两个来源身份允许至6／2，核心仍核对ability、集合与C6资格，不放行其他流浪者／杜林来源。
- 控件：挂载 `renderWandererPrimaryControls/renderDurinBurstControls`、`wandererPrimaryRequirementAdapter/durinBurstRequirementAdapter`。所有数字／状态／枚举沿用 `data-source-cast-*`，不需要新事件分支。
- import／换招：保留对应专属context；导入后按明确的combat2有效天赋绑定 `wandererPrimary.skillTalentLevel`，缺来源就删除。基础攻击只由明确来源属性提供，配装模式已自动用角色＋武器基础攻击；最终ATK不得冒充基础攻击。fresh-equipment自动记账0，imported-final未知仍须问，不能靠非零即已含推断。
- 专属公式编辑锁按真实context＋下述ruleId，不锁别人的合法不同槽公式：`wanderer-primary-a1-pyro-atk-b4ae769`、`wanderer-primary-a1-cryo-cr-b4ae769`、`wanderer-primary-c2-q-bonus-b4ae769`、`durin-white-q-tick-a4-base-b4ae769`、`durin-white-q-c2-pyro-accounting-b4ae769`。

数值独立预期见 `.arithmetic.json`：ATK2000、CR50%／CD100%、无反应、90级敌人10%抗性时，100级流浪者NA10/E13的空居N1为2023.940139／3035.910209／4047.880278；同面板独立C6追加为809.576056／1214.364084／1619.152111；Q13五击且C2封顶为43310.769231／64966.153846／86621.538462。90级杜林Q10首十次、A4与C2生效且未含时，单次为3679.6032／5519.4048／7359.2064（非暴／期望／暴击）。这些是明确面板算例，不冒充玩家完整配装伤害。

本地测试明确分为source prepare负例与共享公式协议；`wanderer-durin-entry-test-support.ts` 使用隔离protocol ID执行已准备的真实公式，不冒充公共入口或整体JSON已完成注册，也不会删掉已注册context后误触发第二次prepare。验证包含真实指定武器来源构筑、数值三列、已含去重、C2非Q排除、A4第10／11次、来源槽冲突／非法复制、低命座C6拒绝、转换与旧状态／角色等级变更保护。正式getDocuments／聚合JSON保存重开／浏览器选招由root接线后验证。

证据 `/tmp/GIDPS-wanderer-durin-calculator-evidence-20261023`。三份定向测试最终 **52/52通过**，本角色新文件与其真实依赖的定向typecheck **exit0**。全仓typecheck受本worktree既有缺失的三份docs fixtures阻塞（Noelle参考、流浪者毕业配装、EC事件步），未修改这些无关文件。命令和实际结果见该目录最终日志，不以筛选重跑中未选中的用例当全量通过。
