# 原生相位收敛：下一实施接口

后续进展：此文件的接口提案已在[原生相位实施批次](source-native-phase-20260928.zh-CN.md)部分落地。下面保留审计基线；具体缺口以最新报告与剩余产品清单为准。

2026-09-28，本批只读代码审计；无代码修改或额外运行。此文件是待实现接口说明，不是完成证明。现有有限双窗／初能／多种子分析保留。任意帧 Go JSON 导入恢复不是 master 独立必做项。

## 已确认入口

- `apps/web/src/source-host-energy-analysis.ts` 132–229：同次连续执行的有限观察，没有完整状态闭合证明。
- `packages/sim-core/src/source-host-wire.ts` 请求与来源 `go/cmd/sourcehost/main.go`：目前没有相位观察选项，只输出终值并标 checkpoint=false。
- 固定源码 `pkg/simulation/run.go` 的 queuePhase 向 evaluator 取下一动作前：可添加只读采样。须明确上一帧 Core.Tick、handleEnergy、handleHurt、OnTick 都已完成；同帧 delay 链不能重复充作不同周期。
- GCSL evaluator 的 goroutine／AST 没有公开下一输入位置；需最窄 loop-iteration/next-input receipt，或限制到显式可验证的重复脚本模板。仅用 frame%rotation 不是相位证明。

## 可实施范围

为同一次 native run 增加 opt-in 相位观察请求，包含明确输入周期、有限 warmup／cycle 上限。在同输入位置、同帧处理阶段，记录每周期真实伤害和归一化未来相关状态；至少比较多个连续周期并允许 period-k。仅在全部状态 provider 有来源依据且无缺口时建立确定性周期；其余保持 not-established。checkpoint:false 不必改变，另报 phaseObservation。

必须核对 simulation 的 queue／preActionDelay／noMoreActions 与解释器位置；player 在场、体力、上次体力使用、切人／冲刺／动作与动画占用；角色 Energy／HP／生命之契、普攻计数、Tags、冷却／充能、角色时钟及私态；有序 mods／status／expiry；护盾 HP／时长／顺序；core／角色／目标各自时钟的任务 deadline、FIFO 与捕获值；在途攻击、粒子、gadget；目标 HP、附着、ICD、计数与位置；有序事件订阅和私态；外部能量／受伤定时；未来相关随机状态。额外 getter 若会清理 mod 或修改状态不可用于观察。

核心 task 的 opaque func 不能仅按 deadline 比较，需原 enqueue 语义描述或严格限定首个已审计域；不需要通用函数序列化。ICD 还会在 core heap 排队计数重置，目标附着为空不等于没有未来状态。

普通敌人伤害即使 CR=0 也可能消耗 Rand.Float64；不能简单把零暴击率当成零随机。首个受限确定性正例必须证明所有这些随机结果对其未来伤害和控制流无影响，否则保留真实 RNG 状态或只给随机暖机统计。TypeScript 的 phase-checkpoint 属另一执行域，不能用来认证 Go。

## 完成门槛

实际运行一个来源与准入条件明确的周期正例，以及同一机制下一个缺少状态/不收敛的必要边界。页面展示采样来源、周期、状态差异／缺口和实际伤害；不因 DPS 或能量相近就升级为稳态。只执行必要的原生构建、集中页面及聚焦检查，不展开角色全矩阵。
