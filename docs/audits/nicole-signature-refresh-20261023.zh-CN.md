尘光七谕的 `dynamicHitBonuses` 保存生成时的窗口、取样和公式；改变 `equipment.effectContext` 本身不会刷新它。合法的妮可90级、尘光R1、两件角斗士及明确手动面板差额构成2000攻击力时，旧路径仅把context改为首次护盾状态，实际增伤仍为0，应为 `min(2000×0.0001,0.26)=0.2`。真实失败保存于 `/tmp/GIDPS-nicole-signature-refresh-evidence-20261023/before.json`，原断言期望0.2、实际0。

`packages/sim-core/src/nicole-skill-initial-weapon-refresh.ts` 新增纯函数 `refreshNicoleSkillInitialWeaponEffects(document)`，返回 `{document,status,blocked,refreshed,reason?}`。status区分 `not-applicable`、`unchanged`、`refreshed`、`blocked`。公共prepare必须把blocked转成missing依赖，推荐ID为导出的 `NICOLE_SKILL_INITIAL_WEAPON_REFRESH_DEPENDENCY`；不能继续执行留下的旧零增伤。无上下文、未知资格、未知取样、条款不一致均不能借自动绑定取得通过。

实现复用已有 `deriveNicoleSkillInitialWeaponContext`，再用已有 `resolveWeaponCatalystEffects` 分别解析保存的旧context和已证明的新context。必须先精确核对旧武器stat/dynamic条款；对象键顺序不影响比较，但不能删除字段、过滤标签、来源、输入或公式来通过。重复、缺失、冲突及出现在未审阅槽中的尘光条款保留原样并阻断。新旧resolver还必须证明常驻12%攻击、反应条款、来源、假设及限制不变；仅替换其一条动态增伤，合并三个已有状态字段。没有重建build，因此所有可编辑面板差额、圣遗物、其他公式及来源均保持。

共享 `offField` 有额外边界：旧状态明确为后台且存在其他生成效果时，不能仅改尘光后保留可能过时的其他快照，返回blocked要求普通装备解析按前台条件重新处理。未知的其他机制及限制不被清空。历史finalSnapshot不刷新、不盖新身份；已保存的角色身份仍须由原角色prepare校验，`not-applicable`不代表历史获得新验证。

来源仍是 `packages/game-data/sources/nicole-skill-initial/manifest.json` 及 `sources/weapon-catalyst-effects` 的固定B4证据。尘光首次护盾取样发生在新E/C2/A1之前；本helper仅绑定本次初击的首次取样，未生成0.5秒刷新、回能、队伍传播或后续日程。

6项定向测试通过，覆盖实际装备解析、原失败路径、2000攻击→20%增伤、面板编辑→25%及26%上限、幂等、JSON往返、显式观察与合法0、未知/false阻断、非武器条款及面板差额保留、缺失/伪造/重复/跨槽负例和历史快照不改写。独立初击算式为 `2600×2.4912×0.5×1.075×1.2×1.5=6266.6136`。报告为 `/tmp/GIDPS-nicole-signature-refresh-evidence-20261023/refresh-focused.json`。未改公共接线、未跑native或全套，页面与解析前入口接线由根线程负责。
