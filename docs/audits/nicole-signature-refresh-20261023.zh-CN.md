尘光七谕的 `dynamicHitBonuses` 保存生成时的窗口、取样和公式；改变 `equipment.effectContext` 本身不会刷新它。合法的妮可90级、尘光R1、两件角斗士及明确手动面板差额构成2000攻击力时，旧路径仅把context改为首次护盾状态，实际增伤仍为0，应为 `min(2000×0.0001,0.26)=0.2`。真实失败保存于 `/tmp/GIDPS-nicole-signature-refresh-evidence-20261023/before.json`，原断言期望0.2、实际0。

`packages/sim-core/src/nicole-skill-initial-weapon-refresh.ts` 新增纯函数 `refreshNicoleSkillInitialWeaponEffects(document)`，返回 `{document,status,blocked,refreshed,reason?}`。status区分 `not-applicable`、`unchanged`、`refreshed`、`blocked`。公共prepare必须把blocked转成missing依赖，推荐ID为导出的 `NICOLE_SKILL_INITIAL_WEAPON_REFRESH_DEPENDENCY`；不能继续执行留下的旧零增伤。无上下文、未知资格、未知取样、条款不一致均不能借自动绑定取得通过。

实现复用已有 `deriveNicoleSkillInitialWeaponContext`，再用已有 `resolveWeaponCatalystEffects` 分别解析保存的旧context和已证明的新context。必须先精确核对旧武器stat/dynamic条款；对象键顺序不影响比较，但不能删除字段、过滤标签、来源、输入或公式来通过。重复、缺失、冲突及出现在未审阅槽中的尘光条款保留原样并阻断。新旧resolver还必须证明常驻12%攻击、反应条款、来源、假设及限制不变；仅替换其一条动态增伤，合并三个已有状态字段。没有重建build，因此所有可编辑面板差额、圣遗物、其他公式及来源均保持。

共享 `offField` 有额外边界：旧状态明确为后台且存在其他生成效果时，不能仅改尘光后保留可能过时的其他快照，返回blocked要求普通装备解析按前台条件重新处理。未知的其他机制及限制不被清空。历史finalSnapshot不刷新、不盖新身份；已保存的角色身份仍须由原角色prepare校验，`not-applicable`不代表历史获得新验证。

来源仍是 `packages/game-data/sources/nicole-skill-initial/manifest.json` 及 `sources/weapon-catalyst-effects` 的固定B4证据。尘光首次护盾取样发生在新E/C2/A1之前；本helper仅绑定本次初击的首次取样，未生成0.5秒刷新、回能、队伍传播或后续日程。

6项定向测试通过，覆盖实际装备解析、原失败路径、2000攻击→20%增伤、面板编辑→25%及26%上限、幂等、JSON往返、显式观察与合法0、未知/false阻断、非武器条款及面板差额保留、缺失/伪造/重复/跨槽负例和历史快照不改写。独立初击算式为 `2600×2.4912×0.5×1.075×1.2×1.5=6266.6136`。报告为 `/tmp/GIDPS-nicole-signature-refresh-evidence-20261023/refresh-focused.json`。未改公共接线、未跑native或全套，页面与解析前入口接线由根线程负责。

后续入口补充：通用装备控件原来先执行 `resolveEquipmentBuild(input)` 才回调角色prepare；窗口字段未知的尘光会在此前被阻断。新纯函数 `prepareNicoleSkillInitialEquipmentInput(document,input,dataset?)` 返回 `{input,status:'not-applicable'|'prepared'|'blocked',blocked,reason?}`，供通用控件解析前的可选hook调用。blocked必须抛出或显示reason，不能把旧inactive零增伤当作可算结果。当前角色与完整E路径资格成立时，helper以同一新input、`weaponEffectActive=false` 及已证明的前台状态解析准备面板；随后复用原derive取得样本。其他输入、圣遗物和状态保持，正常resolver再用返回input生成全部装备条款。它不替换原文档build，也不重验历史结果。

临时准备文档采用新装备面板、清除旧observed/equipment-current取样与历史身份，并按fresh-equipment的有据规则将角色已含记账置0/false；原文档不改。因新装备解析明确未加入妮可自身E/C2/A1，该临时零记账来自新构建，不是对旧面板未知值的猜测。新input绝不继承旧观察，即使旧值恰为0也重新推导。存在外来攻击公式而无法证明非转换样本时继续blocked，非法主副词条及来源校验照常拒绝。只有用户明确应用新装备后，公共onResolve才能按既有流程替换面板、恢复命中输入并重置角色fresh-equipment记账。

新增4项入口测试后本文件10项通过，报告为 `/tmp/GIDPS-nicole-signature-refresh-evidence-20261023/input-focused.json`。同时保留了原入口 `weaponEffectActive` 未知时真实throw的断言、新input不同武器等级取样变化、旧历史原文不变和无关动作not-applicable。刷新函数也新增可选第二参数dataset，传入时使用当前工作区武器来源，不隐式改为默认目录。

公共接线次序须注意：角色prepare会清除旧 `nicole-skill-initial:*` 依赖；refresh的blocked依赖应在角色prepare完成后追加，再让共享资格门处理。正常input的prepared仅表示新的装备输入可进行普通解析，不表示旧保存结果获得验证。未改通用装备控件或公共calculator文件。
