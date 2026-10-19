# 固定来源动作机会与派发关联（2026-09-29）

本批为已捕获动作的伤害集合补充严格的原生派发身份关联，并把落空、未决与待结算观察分开呈现。独立 dispatch ID 使重复 AttackID、同帧或同名动作也可精确关联；不证明一个技能施放的所有机会或后续实体均已收集。

原生 `ApplyAttack` 每次派发生成独立 `dispatchId`，随 AttackEvent 复制并经过延期敌方目标处理保留。共享结果以 `dispatchId + attackId + targetKey` 精确关联目标处理终态与实际敌方伤害应用；不使用帧、技能名或可复用的 AttackID 单独猜测。新动作机会表展示派发编号；queued/dispatched 阶段行只是观察，不重复计入伤害。终态回执缺少派发号、攻击号或目标号，或出现已结算目标处理却没有同一身份的敌方伤害应用时，该机会保持 unresolved；它可能属于其他目标类型，也可能是记录缺失，因此不会虚构零伤害。若一组记录同时把同一派发与目标标记为 missed 和实际伤害，则拒绝将冲突伪装成完整记录。

集合保留实际 damage application 并计入一次；明确 `missed` 的接触检查记为观察到的零伤害；终点仍排队的任务为 pending；无法精确解释的回执为 unresolved。queued／dispatched 只记录阶段，既不增加伤害，也不能单独判定观察终点时仍待处理。`knownSubtotal` 仅在存在已结算伤害，或明确 missed 时提供；即使没有已捕获的敌方伤害应用，也不能由此推出该技能本身没有伤害或已完整施放。

捕获动作的门槛是该来源动作存在真实关联证据，可以是应用、攻击阶段、待处理任务或明确状态记录；只有排队／状态证据的集合仍可打开，但没有结算伤害或明确落空时小计保持未定义。零个已捕获敌方 application 的集合也保存原始 `sourceContext`：来源revision、脚本配置、种子、执行产物、随机策略、初能与启动状态，便于复现边界，而不是把空命中数组作为任意来源的默认结果。UI 允许从实际来源记录打开这类集合，并支持导出、导入与独立重算。

每条命中、明确落空、过程阶段、pending 及 unresolved 记录均保留其可解释来源节点或阻塞原因；单次 damage application 在伤害小计中最多计一次。仍待处理账本只覆盖两个已审计的 `core.Tasks.Add` 阶段（snapshot/application）；未跟踪的任务、其他目标类型、观察窗后的回调及完整攻击机会清点仍是缺口。集合的 `completeCast` 固定为 false，不把局部证据升级为完整技能生命周期、全角色技能覆盖或游戏验证。

固定样本中，行秋两次实际应用的可编辑共享公式值为 `919.5508033975872 + 1046.5363905334443 = 1966.0871939310314`；其 dispatchId 2／3 分别绑定 attackId 2／3 与 targetKey 1，排队和派发阶段行不额外计数。两lane各102次计算／38次应用的对照运行与基线 gameplay 一致。另一个 Venti 教学样本把目标移出攻击圆：两lane均记录 frame 52、dispatchId 1／attackId 1／targetKey 1 的 `intersect circle` 落空，应用数0、观察小计0；这只是脚本中明确记录的一次落空。截断于 frame 30 的 Venti 样本则保留 queued frame 1、due frame 52 的 application 任务，应用数0、`knownSubtotal` 未定义（JSON为null）；不能把结果中的数值字段0读成已证明零伤害。六个集合均导出、导入并往返成功。

最终核心5/5通过（Vitest 313 ms；运行墙钟1.547秒）；classic／stellar构建8.519／8.940秒，Web构建5.081秒；单一聚合页面流程通过（case 14.6秒、runner 15.8秒、墙钟16.371秒，pageErrors为空）。六个原生执行样本均完成集合 JSON 往返。完整收据及捕获见[测量记录](validation/action-opportunities-measurements-20260929.json)。本批不更改覆盖分类、外部数据指针或总体完成状态。
