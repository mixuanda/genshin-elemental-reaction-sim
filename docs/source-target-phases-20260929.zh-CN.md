# 固定来源目标阶段与逐击应用边界（2026-09-29）

本批将用户声明的目标阶段接入固定来源执行链。每个阶段带稳定 ID、名称、说明、目标声明下标及整数帧窗 `[startFrame, endFrame)`；帧数非负且起点小于终点，同一目标的阶段 ID 不重复、窗口不重叠。阶段条件不由敌人名称或外部游戏资料推断。

阶段内三个策略轴独立保存、独立处理：

- `damage`: `normal` 或 `immune`，只控制本次伤害应用；免伤不等于 miss，原始伤害公式仍可给出非零值。
- `aura`: `normal` 或 `blocked`，控制本次元素附着与反应路径。阻止时不进行本次附着、反应或附着 ICD 消耗；既有附着仍按原有衰减规则运行。
- `hitConfirm`: `normal` 或 `blocked`，控制命中后的玩法回调。阻止时仍保留实际几何接触、统计与双方 hitlag；跳过 `OnEnemyHit`／`OnEnemyDamage` 的非观察型玩法订阅者和该攻击的 `AttackCB`。已登记的来源观察钩子仍可记账。这不代表所有脚本事件都停止，也不把命中改写为 miss。

阶段逐击匹配使用实际目标键和原生命中帧，而不是仅凭目标序号或时间猜测：用户档案中的 `targetIndex` 经 Go 请求校验后，按初始目标声明顺序绑定到原生 `targetKey`；native 在目标处理攻击时以 `(targetKey, frame)` 查找唯一半开窗口。匹配结果带回阶段 ID、策略、实际目标键及命中帧，并随应用记录保存。前端校验与 native 校验均拒绝越界目标、无效效果值、同目标重复 ID 或重叠阶段。

同一共享目标应用公式接收已完成的 outgoing `rawDamage`、该击前 `hpBefore`、运行模式和匹配阶段。正常伤害时，HP 损失为 `min(rawDamage, hpBefore)`；免伤时为 0。击杀模式的伤害应用量与实际 HP 损失一致；固定时长模式保留原始伤害统计量；免伤时两种模式的应用量均为 0。native 原始攻击计算继续单独留在 `rawDamage`，来源记账应用量与目标 HP 前后值另存，因此可区分“公式算出伤害”“应用记账”和“实际扣血”。没有阶段匹配时，目标应用沿用原生原值路径。

共享档案字段为 `SourceTargetProfile.phases`。队伍和单技能入口复用每个目标的阶段编辑器；多目标 draft 在生成 run request 时把阶段展平为带 `targetIndex` 的 `targetPhases`，目标几何、阶段策略和统计主目标各自保留。单技能结果、队伍生成脚本、source request/result schema、native Go config 与应用回执共享同一元数据；capture/re-execution 会恢复声明并核对 receipt 与真实 `targetScene` 键。阶段结果面板逐阶段显示原始公式伤害、来源记账伤害、HP 损失和实际应用编号／帧，并区分没有配置窗口与已配置但窗口内没有应用；完整证据保留在 JSON，列表展示有上限。

主要实现位置包括 `apps/web/src/source-target-phase-controls.ts`、`source-target-profile.ts`、`source-target-scene.ts`、`source-host-target-phase-panel.ts`，共享核心 `packages/sim-core/src/source-host-target-phase.ts` 与 `source-host-target-application.ts`，以及 native patch `packages/source-host/patches/106-target-phases.patch` 和生成树中的 `packages/source-host/go/pkg/core/sourcehost/target_phase.go`、`packages/source-host/go/cmd/sourcehost/target_phases.go`。原始来源阶段观察与此用户声明的目标阶段是不同模型；本批不会把前者的状态快照解释成敌人机制。

## 验收结果

按[本批测量归档](validation/source-target-phases-measurements-20260929.json)，classic／stellar native build 分别 7.372／7.854 秒通过，registry 0.115 秒；focused tests 首轮 5/6，修复共享公式 child 引用后同一组 6/6 通过（1.484 秒）。Web 首轮 3.353 秒因 request kind 排除与 E2E result 类型失败，修正后仍发现 receipt 带 `targetKey` 不能直接通过严格 request schema；最终 Web build 4.405 秒通过。浏览器首轮命令 62.531 秒包含 strict-schema assertion timeout，没有接受的导出运行；把 receipt 转回 request identity 后，同一用例通过 5.694 秒、`pageErrors=[]`。两lane各只构建一次；native 有两次调用（首个结果被拒绝、一次成功归档的 classic 六目标运行），队伍 JSON 往返没有再跑 native。capture 大小 201841 bytes，SHA-256 `76344295139492f5a1ac15e6d89786feb17560653e7050a545230df5de49f82b`。详细构建产物、失败记录和未变化的数据指针均见汇总测量。

单次接受的 classic Kaeya E 在实际第 29 帧对六个并列 synthetic targets 命中；声明下标 0–5 分别映射 native `targetKey` 1–6。所有目标 outgoing raw 均为 `1161.8921525418264`。下标1的 `immune-at-29` 将应用量记为0，而 raw 保留；下标2的 `aura-block-at-29` 仍造成正常应用量但没有元素附着；下标3的 `hit-confirm-block-at-29` 仍造成正常应用量，跳过3个 `AttackCB`、屏蔽2个 `OnEnemyDamage` 玩法订阅者，并在该过滤分支记录到1个观察型订阅者。此计数只来自 hitConfirm=blocked 的过滤路径，不用于推断普通命中阶段的观察者数量。下标0没有阶段；下标4的阶段在第29帧结束、下标5的阶段在第30帧开始，因此该击均未匹配阶段并保持正常，验证了半开窗口的边界。六次 outgoing／application 重放的 raw 与 applied 差值均为0。合计 raw `6971.352915250958`，applied `5809.460762709132`。此次运行全为固定时长模式，HP loss 都是0；HP cap 只由窄算术单测覆盖，不能把此页的零 HP loss 当成击杀模式的实测。stellar 仅编译。

这批验证的是固定来源执行器对用户声明三轴策略的有限消费路径，不等于原生敌人免疫／无敌机制已经核实，也不提供怪物阶段资料。它没有新验证附着ICD重置／继承、既有aura衰减、shatter、每种反应或所有玩法订阅者；未来阶段状态代码没有新的收敛运行证据。编辑并重放捕获时沿用已捕获阶段与前击HP，不会重新执行之后的世界状态。HP损失运行场景、来源游戏机制、coverage、`verified`、数据指针、`activeVerified`、`completeCast` 与整体需求状态均未提升。
