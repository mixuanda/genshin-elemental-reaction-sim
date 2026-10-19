# 来源动作：延迟耗能与定时召唤实体

本增量为显式声明的来源动作增加通用执行能力，不根据角色名称切换主模拟器行为。固定 gcsim 来源为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；这是参考实现规则，不是官方验证声明。

## 延迟耗能

`AbilityDefinition.energyCostFrame` 与编译后的 `ActionDefinition.energyCostFrame` 是相对起手的整数帧。未配置或为 0 时保留原来的起手扣除行为。正数时，起手仍检查所需能量，并记录该次动作的内部预留；实际能量不改变，回能仍先受真实能量上限限制。预留仅避免另一个耗能动作重复使用同一笔未扣能量，不提高上限、不形成虚拟回能。

真正的扣能任务进入同一个事件堆，在声明帧读取当时能量并执行 `max(0, E_current − cost)`。任务在成功起手后、该动作的返能/粒子/增益/命中任务之前入队；同一能量优先级按照真实入队顺序执行。观察终点之前未到扣能帧时，不产生扣能记录或已消耗能量。

`energyCostLog` 保留 `reserve` 与 `debit`，通过 `actionLogIndex` 关联原动作，包含实际帧、任务顺序、实际能量及内部预留的前后值。真正扣能同时产生 `energyCurve.kind="spend"`，加入 `energyStats.spent`。旧的 `energyLog` 继续只表示固定返能和粒子收入；起手 `actionLog.energyBefore/After` 记录真实能量，不提前伪装扣能。

安柏固定源 `internal/characters/amber/burst.go` 调用 `ConsumeEnergy(59)`；`pkg/core/player/character/energy.go` 将该扣能回调加入任务队列并在实际执行时读取能量。该声明可独立表达最早取消动作在第 57 帧、扣能仍在第 59 帧的顺序。

## 定时实体

`summons` 的每项包含 `id / label / spawnFrame / lifetimeFrames / expiryAttackDelayFrames / hitIds`。绑定命中仍使用原动作的命中定义、倍率、命中组和产球触发器；其时间须恰等于生成、生命周期与到期攻击延迟之和，并显式选择 `snapshot:"action"`。

实际起手不调度这些绑定命中，而只调度实体生成。生成时保存 owner、实例标识、生成/到期/攻击帧、属性快照和施放者站位。生命周期到期时从活动实体集合移除，再将原动作的绑定命中放入主事件堆。命中使用生成时快照；敌人状态、命中判定及产球仍走原有真实命中执行路径。没有到期就没有攻击，没有确认敌人命中就没有绑定粒子。

`summonLog` 的 `spawn / expire` 两种记录保留上述时间、来源动作、完整主 owner 属性快照、绑定命中 ID 以及队列顺序。单击计算器继续从完整模拟结果恢复命中时的真实计算输入；实体日志提供快照来源和生命周期证据。

安柏参考 E：`skill.go` 在起手后 45 帧执行 `makeBunny`；`bunny.go` 此时快照并设置 `Duration=484`。由于 `Core.Tick` 中战斗实体 tick 先于全局任务，首次生命周期递减在下一帧，因此到期为起手后 529 帧；到期再延迟 1 帧，在 530 帧攻击。首次确认敌人命中产生 4 个火粒子，采用来源默认 100 帧接收延迟。

本通用实体是明确的定时到期参考配置。实体受击、HP、提前销毁、位移、冻结、手动引爆及其角色条件不因此成为已实现功能；来源动作库必须限制或阻断这些未建立的上下文。能量预留、定时召唤及其实际队列现已进入完整相位检查点；确定性配置可在其他状态均已覆盖时建立周期稳态，详见 [运行状态检查点证据](phase-checkpoint-runtime-state.md)。随机回能等独立限制仍保留。

## 验证范围

新增针对性文件 `packages/sim-core/src/__tests__/delayed-energy-summon.test.ts` 覆盖真实能量上限与同帧扣能/回能顺序、预留不可复用、观察截断、实体生成快照与实际到期攻击、首次命中产球、计算器回放以及篡改日志拒绝。实测：首轮运行 2 项，实体用例通过；能量用例最后的截断输入使用 0.5 秒，被既有配置最短 1 秒的校验拒绝。仅将测试输入改为第 60 帧末端起手、观察至第 60 帧，再单独复验能量用例：1 通过、1 跳过，测试 68 ms、总用时 807 ms。生产代码未因此改变。两项核心行为均已通过，没有重复实体用例或运行旧全集。记录见 `docs/validation/delayed-energy-summon-tests.log` 与 `docs/validation/delayed-energy-summon-energy-recheck.log`。
