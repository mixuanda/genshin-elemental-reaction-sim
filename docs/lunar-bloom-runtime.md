# 月绽放资源与单能力执行说明

更新：2026-09-23。此次仅同步文档，未重跑检查、构建或测试。

`lunar-bloom-runtime.ts` 与 `lunar-bloom-calculation.ts` 已通过 `simulateLunarBloomProfile` 接入主模拟器，实现真实普通绽放之后的草露生产，以及显式声明的哥伦比娅 Moondew Cleanse（月露涤荡）三段能力。固定来源、下载时间、哈希和倍率交叉核查见 [来源报告](research/lunar-bloom-evidence.md)。证据仍为固定社区源码参考配置，不改变角色数据的 released／preview 通道，不声称当前游戏实测完成或整角色模拟完成。

## 实际执行

- 主 Aura 引擎先完成真实元素附着、ICD、普通绽放和草原核请求，再调用 `application`。特殊模块不吞掉草原核，也不为月绽放事件添加即时伤害。ICD 未通过或没有实际普通绽放时不产资源。
- 草露采用 `verdant-dew-fixed-core-order-v2`：触发后第 1 帧的生产先读取旧窗口，再由全局任务更新截止到触发后第 149 帧。原窗口未启用时，首次累积在第 2 帧，146 个有效生产帧后、即触发后第 147 帧获得第一层。最多三层，停产后的部分进度保留；连续有效窗口刷新不丢帧，同一攻击不重复刷新。该修正也适用于当前独立 LB，详见 [时序取证](research/lunar-mixed-v2-source-evidence.md)。
- 完整 `abilities` 声明通过 `sourceAbilityId` 绑定实际时间轴能力 ID。唯一已接直接能力为 `columbina-moondew-cleanse-idle-v1`；须明确 `actorId`、有效 `talentLevel`、`ascension` 和 `constellation: 0`。不根据角色等级猜突破或天赋加级，不扫描显示名称猜能力。声明可为空，纯资源执行仍有效。
- 月露涤荡开始时必须已有草露，从闲置起手、不中断、完整动画 124 帧。第 55 帧消费 1 草露；第 62、70、92 帧分别读取 HP、EM、CR、CD 和敌人草抗，造成三次直接月绽放。不附着元素，不重复生成普通攻击或草原核。
- 同帧源顺序是：动画选择重击类型、草露生产、角色消费任务、全局攻击。因此本帧刚产生的草露不能反过来选择重击类型；若此前已满三层，同帧先停产再消费，不在消费之后补一次生产。
- 哥伦比娅固有月兆按本段命中时最大生命值计算 `min(HP / 1000 × 0.002, 0.07)`，源码初始化无突破门槛。此规则作为共享公式 AST 的真实节点执行；基础提升、精通、暴击、抗性、结果均通过同一 calculator core。

每段状态上下文保存有效天赋与来源系数、突破、C0、闲置起手、动作开始帧、命中序号、人物取样、实际草露消费回执以及固有月兆的供给者 HP。JSON 恢复后再次执行 calculator core，可逐节点重现相同轨迹和伤害。`lunarBloomEventToCalculatorDocument` 提供单命中导入；独立计算器无需执行团队轮转即可使用条件特殊公式。

## 主模拟器集成契约

`LunarBloomRuntime` 构造器接受 `{config, options, target, critMode, snapshot, resistance, beforeWake}`。`snapshot(actorId, frame)` 由主模拟器返回当时已生效的面板；`resistance(frame)` 返回当前草抗。

主模拟器已在成功普通绽放后调用 `application`；在对应动作开始调用 `startDeclaredAbility({frame, actorId, sourceAbilityId, sourceEventId, fromState: 'idle'})`；事件队列推进与结束处调用 `advanceThrough(frame)`。公共 runner 要求显式直接能力使用合法帧 timeline，并验证其真实定义；主循环核对前一动作完整结束，阻止本段 124 帧完整占用内的取消、切人和其他动作。对应普通能力 `hits` 为空，额外 buff/debuff/能量/粒子等声明也被拒绝，避免专属三段与普通事件重复计算。124 帧是本配置完整闲置起手锁定，不宣称它是游戏最早取消窗口。

`result(baseResult)` 输出普通结果、资源状态、执行日志、特殊三段事件及合并伤害。草原核伤害继续属于 `baseResult.totalDamage`；只有已在模拟时限内投递的直接能力伤害加入 `lunarBloomDamage`。调用者使用 `simulateLunarBloomProfile` 取得完整封装，普通 `simulate` 不允许携带此模式而丢失特殊结果。主队列、能力占用和计算器恢复的实际接入记录见 [月绽放主路径](lunar-bloom-simulation.md)。

## 范围与尚未实现

固定 60 FPS、无卡肉、单个静止范围内目标、水／草／物理输入；使用 `aura-v5`，关闭玩家伤害反馈和插件。`aura-v5` 是项目首个支持普通绽放/草原核的版本，`aura-v3` 会截断该反应而被此配置拒绝。资源初始为零，不由 UI 任意注入。该模式与月感电、月结晶、星导分别运行，不支持混合特殊状态；当前仅接受精确期望／全部暴击／全部不暴击，不接特殊贡献者种子抽样。

未接月岭露、领域、Gravity、命座、取消和连携、并行资源消费、多目标几何、额外命中修改器，也未接菈乌玛或奈芙尔完整直接能力。固定来源树中没有奈芙尔实现。有效天赋 1 至 15 的系数都有来源，但选择某个有效等级不等于该角色配置的天赋加级来源已被模拟证明。

## 既有实测记录

以下保留实现阶段已执行记录，此次文档同步未重跑。后续主路径测试还验证真实草原核、来源动作绑定、消费/三段命中及窗口裁切，详细实际输入和结果见 [主路径记录](lunar-bloom-simulation.md)；不能用本节早期适配器测试替代整体最终检查。

执行 `npx vitest run packages/sim-core/src/lunar-bloom-runtime.test.ts packages/reaction-formulas/src/special.test.ts packages/sim-core/src/special-calculator.test.ts`：3 文件、45 项通过，768 ms。新增四项覆盖真实绽放窗口、无资源与错误声明拒绝、满资源同帧顺序、三段实时取样和完整 JSON 轨迹复现。

独立 Decimal 数学校验向量：HP 35000、有效天赋 10、EM 0、CR 0、敌草抗 0.1、仅固有月兆基础提升 0.07，每段 `35000 × 0.027202 × 1.07 × 0.9 = 916.84341`，三段合计 `2750.53023`。这是明确输入的数学校验，不是游戏测量。

同阶段修复星导状态源的生命周期差异：尚未发布的计数及角色 6 帧 ICD 属于全局／角色状态，领域销毁不会清除；新领域立即发布残留计数，发布清计数而不重置角色 ICD。对应状态测试 8 项通过，135 ms。星导领域现已单独接入主路径，见 [星导执行](stellar-conduct-simulation.md)；星扩散仍仅有 [独立适配器](stellar-swirl-adapter.md)。本节记录不声称完整工程测试或生产部署完成。
