# 普通附着、ICD 与伤害组真实检查点（限定第一层）

本轮实现真实只读状态导出，没有修改反应公式、Aura 版本、执行顺序或重建第二套队列。没有运行旧全集、构建、Monte Carlo 或数据更新。

## 实际改动

- `AuraEngine.captureOrdinaryState()` 直接复制普通附着的原始 gauge、`decayPerFrame`、来源槽、真实物化帧和内嵌 ICD；不调用会推进时间的 `getAuraStateAt()`，也不使用清理数值精度后的公有快照替代原态。未导出的生命周期、特殊注入、目标 Tick 或机制截断会返回具体阻塞理由。
- `ElementalApplicationIcdEngine.captureState()` 导出直接 fixed、legacy、反应拥有 fixed、两个 Burning 命名空间，以及起始 group、profile、计数和原始计时器；`DirectDamageGroupEngine.captureState()` 导出真实 target/actor/tag 窗口。两者均返回脱离内部引用的值。
- `TargetStateTimelineRecorder.captureObservationState()` 保存自然到期调度实际读取的最新观察帧与 Aura 状态；历史 point ID 只是审计序号，不参与状态相等判断。
- `ordinary-aura-checkpoint.ts` 在同帧任何事件之前归一化真实状态。保留仍有效窗口的起始 group、完整命中计数、窗口年龄及剩余期限。直接窗口的下一次消费在 `frame >= resetAtFrame` 重开，因此到期窗口可以从语义状态删除；反应拥有 Burning 的不同等号边界没有套用此规则，而是继续阻塞。
- 未来输入域检查包括 compiled rotation、未编译 timeline 的全部能力命中、条件/周期/召唤引用的命中、实际目标初始 Aura、`scalingOwnerId` 的默认元素、未生效的 infusion。全局元素并集只允许普通持久元素的单元素域，或水火、冰火域（物理可并存）。这会保守拒绝不同目标分别安全但全局并集不安全的组合。
- 主模拟器向现有检查点传入实际引擎捕获结果和完整原队列。只有含对应特性时追加状态字段；原来没有 Aura/伤害组的检查点 wire 形状保持不变。

## 已支持范围与边界

第一层可解除 `legacy-event-heap-v1` 下上述确定性普通 Aura 域与直接伤害组的完整状态阻塞。检查点的 `auras.model` 为 `ordinary-aura-checkpoint-v1`，`targets[].mode` 保存实际 Aura 版本，ICD 位于 `targets[].applicationIcd`，直接伤害组位于 `icdAndTriggerHistory.directDamageGroups`。

**没有认证 v8/v9 的完整周期稳态。** 当前 schema 要求它们使用 `target-phase-v2`，该目标阶段与目标 Tick 的真实私有状态仍未纳入这一层。测试最初暴露了这个要求，随后使用本来就合法的合成 **aura-v7 + legacy-event-heap-v1** 配置验证本层；没有降级任何用户配置。Aura 的 raw capture 能读取 v9 普通数值，并不等于 v9 主模拟器已经具备完整检查点。

感电、冻结、激化、燃烧、扩散、碎冰、超载、超导、草原核/结晶、反应拥有的附着任务，以及目标时钟/阶段仍独立阻塞。七种特殊 execution 注入（含没有普通 Aura conversion flag 的 lunarBloom）、插件、随机暴击、随机产球/普攻回能、西风等沿用或补充明确阻塞。未以当前状态为空推断未来永远不会进入这些机制。

## 新增验证与实测

仅新增 `packages/sim-core/src/__tests__/ordinary-aura-phase-checkpoint.test.ts` 三个用例。

1. 连续模拟：120 帧轮转，Hydro@0、Pyro@108，预热 8 周期，观察 2 秒。两段普通伤害分别为 500 与逆蒸发 750，总伤害 **1250**，稳态 **625 DPS**。实际检查点保留水 gauge `0.8 - 108 × 0.8/570 - 0.5`、原始衰减率 `0.8/570`、物化年龄 12 帧、Pyro ICD 剩余 48 帧、伤害组剩余 17 帧；连续相位状态相同。
2. 相同 gauge、不同真实衰减率不会相等；相同 gauge、ICD nextHitIndex 为 1 与 2 会不同；后续推进不会修改已经捕获的数据。
3. 第 29 帧、窗口恰好到期且新命中尚未执行时捕获真实原值；第 30 帧保留新窗口。未来未选择能力、目标初始雷 Aura、休眠 Geo infusion 与随机暴击不会被误认证为完整确定性域。

执行记录（均仅本新增文件，失败后只复验失败项）：

| 日志 | 结果 | 说明 |
| --- | --- | --- |
| `ordinary-aura-phase-checkpoint.log` | exit 1，未收集测试，76 ms | 合成测试数组漏 `]`，已修正 |
| `ordinary-aura-phase-checkpoint-retry.log` | exit 1，1 passed / 2 failed，849 ms | 第 2 项通过；v9 测试配置缺合法 timeline/目标位置/geometry，并与目标阶段支持范围不符 |
| `ordinary-aura-phase-checkpoint-fixture-retry.log` | exit 1，2 failed / 1 skipped，914 ms | 已改原生 v7 合法合成输入；断言须使用现有 `reverseVaporize` 名称，边界测试须实际重复 legal timeline |
| `ordinary-aura-phase-checkpoint-final-retry.log` | exit 0，2 passed / 1 skipped，962 ms（测试 103 ms） | 仅复验第 1/3 项，已通过第 2 项没有重跑 |

最终三个新增用例分别已有通过证据；不把定向复验描述成一次全文件 3/3。集成类型检查、构建和浏览器验证由主任务统一安排，本专项不重复执行。
