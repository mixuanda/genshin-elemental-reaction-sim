# 固定来源目标档案与 HP 截止策略（2026-09-29）

本批为固定来源队伍草稿和单角色单动作草稿接入共用的目标档案。`SourceTargetProfile` 保存目标等级、共用抗性、初始几何、可选逐元素绝对抗性、冻结抗性、目标 HP 与自定义掉球。共享编辑器在两个入口复用同一读取、校验、摘要和 GCSL formatter；现有配置保持原有来源默认。抗性映射按元素生成来源 target 子句，空元素项沿用共用抗性。冻结抗性限于 0–1；显式 HP 须为正数；掉球配置必须同时有 HP、正阈值、非负数量和元素。来源解析器将逐元素抗性写入目标配置；当前产品输入不把 profile 扩展为多目标集合。

结构化来源运行可选择 `stopAtDuration` 策略；队伍生成脚本自动启用，单角色单动作入口也请求启用它。raw 来源入口提供可见开关，缺省沿用原生策略。启用后，观察窗到达配置 duration 时停止；目标全部死亡或击杀模式动作流结束也可更早结束。显式目标 HP 独立地启用来源击杀模式。回执区分 `duration-or-native` 与 `native`，记录配置截止帧、实际结束帧和终止原因；重新执行沿用保存的停止策略。deadline 在原生 frame tick 后检查，范围包含 readiness waits；它不能抢占不让出执行权的手写循环。观察窗上限不表示完成技能或目标之外的实体结算。原生在当前攻击伤害排队／应用前检查此前累计扣血；阈值满足后固定排队 100 帧再分发粒子，因此末击不保证能触发检查或赶在观察结束前收到掉球。原始 GCSL 执行入口保留来源原生终止行为。

对应 master §22 的精确范围是自定义目标等级、逐元素抗性、位置／命中体积、显式 HP 和一类用户声明的能量掉落输入。此批没有提供适用 DEF 修正编辑、敌方护盾、phase／无敌窗或多个目标的伤害汇总，也没有扩充 verified enemy 数据。目标档案可被固定来源消费，不等于这些模型均已实现或 verified；target profile、初始目标几何、接触机会、终止策略和完整 cast 证明是不同能力。

主要实现位置：`apps/web/src/source-target-profile.ts` 定义验证、解析及子句生成；`source-target-profile-controls.ts` 提供两个入口共享的进阶字段；`source-team-builder.ts` 与 `source-single-skill-panel.ts` 负责队伍及单角色编辑。停止策略由 `source-single-skill.ts` 请求，通用运行／重执行请求与回执位于 `packages/sim-core/src/source-host-wire.ts`、`source-host-reexecution.ts` 和 `apps/web/src/source-host-panel.ts`；原生可选 deadline 由 source-host bridge 与 `packages/source-host/patches/103-stop-at-duration.patch` 接入。固定来源审计取自 classic `/tmp/gidps-source-host-cache/build-AdoyVi/source` 和 stellar `/tmp/gidps-source-host-cache/stellar-build-knpD0p/source`；构建后的 classic patched tree 为 `/tmp/gidps-source-host-cache/build-HPMFBa/source`。原生 `pkg/gcs/parser/parseTarget.go` 解析抗性、freeze、HP、掉球字段；`pkg/enemy/attack.go` 在当前攻击伤害排队／应用前检查此前累计扣血，并在满足阈值后排队固定 100 帧的粒子分发；`pkg/simulation/run.go` 处理可选 duration 截止。

验收依据为[汇总测量](validation/source-target-profile-measurements-20260929.json)及[浏览器结果](validation/source-target-profile-browser-20260929.result.json)。目标 profile focused unit 3/3 通过（测试 3ms，命令 0.713 秒）；classic／stellar native build 分别 7.381／8.764 秒，registry 0.223 秒。Web 首次构建 4.884 秒失败，原因仅为测试 unknown 类型；修正后 build 6.316 秒通过。唯一浏览器案例首次通过，墙钟 6.674 秒（case 4.8 秒、runner 6.0 秒），`pageErrors=[]`。三次 native run 都是 classic：两次 Kaeya E 检查 Cryo 抗性与 HP mode，一次零能量 Kaeya Q 检查 duration cap。

抗性案例将 Cryo `0.1→0.5`，knownSubtotal 从 `1161.8921525418264` 变为 `645.4956403010146`，实测比例 `5/9`，共享重放差 0。HP=100 案例的 HP 上限前 knownSubtotal 为 `645.4956403010146`，实际 native applied damage／HP loss 均为 100，在 frame 29 以 `targets-dead` 提前结束（配置 frame 360，policy `duration-or-native`），重放差 0。零能量 Q 示例在 frame 360 因 `duration` 截止，0 applications。队伍入口的逐元素 Cryo、freeze resistance 和自定义 particle profile 完成 JSON/GCSL 配置核对，并在 starved Q 配置中消费；freeze/drop 本批没有实际触发。stellar 只完成 build，没有 runtime run；policy reexecution 与 batch/startup 路径仅完成 typecheck，本批没有新的完整 replay。

本批没有 verified promotion 或 complete-cast 结论。目标档案可被固定来源消费不代表完整实现 master §22：适用 DEF modifiers、敌方 shields、phases、invulnerability、多目标 damage 与 verified enemy data 仍缺；目标 profile、接触几何、触发机会和 cast completion 必须分开看。目标验证不提升 coverage、数据指针或整体完成状态。

后续横向产品优先项是静态多目标汇总：固定来源会解析并配置多个目标，攻击按各目标分别应用；在共享结果中应能区分 primary-target damage 与 all-target total，同时保留每个 target 的identity和原始命中。固定来源依据是 `pkg/gcs/parser/parseTarget.go` 的多 target append、`pkg/simulation/setup.go` 的逐目标建立与默认 closest target 选择，以及 `pkg/enemy/attack.go` 的按目标应用。它不要求先捏造阶段／无敌或敌盾规则，也尚未在本批实现。目标 DEF modifier、enemy shield 与阶段语义应作为另外的能力处理。

同日数据证据刷新见[独立证据记录](data-evidence-refresh-20260929.json)：提供方索引仍标为 7.1.51，响应哈希与前次相同；没有检测到新的可采纳版本修订，7.2 V1 身份仍未确认。此前隔离候选与项目指针保持原样；此次目标档案工作不变更数据指针、候选或 verified 状态。
