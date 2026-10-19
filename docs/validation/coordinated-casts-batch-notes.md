# 显式协同日程合并检查记录

命令：`npx vitest run packages/sim-core/src/coordinated-cast.test.ts`。

首次执行为 1 项通过、1 项失败。行秋转换为最终面板前期望伤害 `13589.0141184`，转换后为 `11324.178432`。检查发现通用转换只结算装备与手工增伤，仍在运行的角色 `damageBonusFormula` 并未结算；本批 finalizer 却提前把 20% A4 标为已含，导致再次扣除。修复为保留已含份额，并记录转换事件身份，使改变日程后旧时点已结算值持续阻塞。首轮 `/tmp` 日志在定向重跑时被覆盖；这里诚实保留已观察的失败数据，不重建一份伪原始日志。

同一合并检查定向重跑 2 / 2 通过，原始输出与退出码为 `coordinated-casts-batch.retry.log`、`coordinated-casts-batch.retry.exit`。覆盖十二协议、独立命中、trace、重复准备、JSON 往返、实际最终面板数值一致、单击独立性、冷却/到期边界、奥兹尾弹、未知资格，以及显式快照修改和已转换日程修改。没有运行逐角色测试套件或性能测试。

随后 `npx tsc --noEmit` 只有并行武器任务 `remaining-weapon-proc-lifecycle.test.ts:68` 的一处 `LegalTimelineCommand.atFrame` 类型问题；保存当次真实日志和退出码，本批文件无类型错误。这是早期检查结果，后续统一构建已通过，见下文。

## 后续实际完成的统一验证

页面检查又发现文本框失焦重绘丢输入，以及 JSON 键顺序被误作事件身份导致抗性覆盖丢失；修复后仅定向复验失败流程。事件身份按固定字段顺序取值。核心合并检查最终 2 / 2 通过，耗时 2.64s，命令耗时 3.086s；原始输出与退出码见 [coordinated-casts-identity-retry.log](coordinated-casts-identity-retry.log) 和 [coordinated-casts-identity-retry.exit](coordinated-casts-identity-retry.exit)。

统一类型检查与生产构建 exit 0，命令耗时 2.833s，425 个模块，Vite 418ms；见 [continuation-modules-build.final.log](continuation-modules-build.final.log) 和[退出记录](continuation-modules-build.final.exit)。这些后续结果不抹去早期类型检查失败或首次单元日志被覆盖的事实。

实际执行的是 `apps/web/e2e/coordinated-cast.spec.ts` 的一条共享入口自动流程：在正常网页选择行秋显式日程 Q，通过装备界面建立输入并编辑普攻状态 100–221 帧，核对 120／180／240 帧的 2／3／2 剑共 7 击及来源 trace；转换为最终面板后数值一致；导出并重新导入完整 JSON 后日程、命中、选择和总值一致；最后去掉完整未来日程条件，独立末击仍可计算且数值一致。该流程通过，测试耗时 1.0s，命令耗时 1.703s；见 [coordinated-casts-browser.final.log](coordinated-casts-browser.final.log) 和[退出记录](coordinated-casts-browser.final.exit)。

## 原拟统一浏览器手工验收计划（未逐项执行）

1. 打开计算器，选择行秋 C0 的“显式日程 Q”动作与一次施放；填写施放者 `owner`、目标 `enemy`，确认全新施放、完整观察、无卡肉/替换/中断、各击实际命中、稳定条件；观察至 1000 帧，已含自身被动填 0。
2. 在普通可编辑日程表明确普攻状态列表，新增一行：标识 `normal`、开始 100、结束 221、角色 `driver`、在场、起手延迟 0、首段普攻。应用日程。检查生成 7 次独立剑雨命中，并能展开触发与快照来源；这只是该输入日程的结果，不是全 Q 最大次数。
3. 编辑结束帧但先不应用：结果/导出应提示有未应用草稿。切到另一动作再回来，确认草稿保留；恢复 221 并应用，逐击输入和已应用日程保持。
4. 记录当前期望伤害，转为最终面板，确认数值不变。随后将状态开始帧改为 101 并应用：应显示已转换日程变化的阻塞，不能沿用旧时点数值。重新应用明确装备构筑并确认新面板条件后可恢复计算。
5. 导出完整 JSON，重新导入：事件、逐击选择、输入、快照来源和期望伤害应一致。选择最后一击并切到单击，去掉完整未来日程条件仍可计算已发生的该击。

上列保留的是原始手工计划，不是执行记录。实际自动流程仅覆盖前节所述范围；第 3 步的跨动作草稿保留，以及第 4 步转换后修改日程再恢复构筑等更广交互没有据此声称已通过页面验收。也没有复制十二个逐角色浏览器场景。
