# 共享体力运行时：本次实现与验证

2026-09-24（香港时间）。这是固定来源、显式动作声明的 `shared-stamina-v1`，证据分类为 `fixed-source-assumed`；不是全角色体力机制或官方服务器验证结论。

后续已在 [体力完整相位检查点记录](stamina-phase-checkpoint.md) 中关闭本文当时保留的检查点缺口；下文保留首轮实现与测试的实际历史记录。

## 本次实际变化

- 当前配置可显式选择 `staminaModel: { mode: "shared-stamina-v1", profileId: "gcsim-b4ae769-stamina-v1", initialStamina }`。全队共用上限 240 的池；初始量可以是 0–240。没有选择该模型的旧输入保留原执行。
- 开启后，每个技能定义及每个 dash/jump 指令必须声明 `staminaCost: { amount, consumeFrame, source }`。`source` 为带说明的 custom 或带引用的 source。不会凭技能名、武器类型或“跳跃应该免费”补数；费用也不会自动乘入未声明的被动/命座/减耗。
- `amount: 0` 默认表示明确没有 UseStam 调用；不会延迟恢复。需要复现来源中零费用重击仍调用 UseStam 的情况时，显式增加 `consumeWhenZero: true`。
- 输入时检查当前体力。strict 体力不足记录 `INSUFFICIENT_STAMINA` 和失败指令，后续指令仍执行；它不制造伤害、冷却、扣费或能量失败记录。wait 模式等到真实恢复足够再执行；恢复期间到期的行动状态仍会拒绝该技能，已耗去的等待时间会保留。
- 正数 `consumeFrame` 延迟扣除，但不预留体力。这与冻结来源冲刺的“先检查、稍后 UseStam”相符。实际扣除 `max(0, S_before − declaredCost)`，到达零时不产生负值；每次实际调用重置恢复延迟。
- 合法轮转编译器使用同一资源状态机决定等待帧，最终模拟另有独立实例执行实际行动扣除及延迟任务。`result.stamina` 来自这次真实模拟，不是把编译器的预测日志复制到结果。
- 恢复在整数玩家帧发生，条件 `F − LastStamUse > 90`，每帧 `25 / 60`；同帧先玩家恢复、再延迟扣除、再输入行动。日志将连续恢复帧合并为区间，而非每帧生成一行。每行有公式、变量解释、数值代入、前后值和实际变化量。
- `staminaTraceBefore(result, endFrame)` 提供半开观察窗的只读核心视图：跨窗恢复区间截到 `endFrame−1`，使用同一恢复函数重算日志数值与代入，界面无需自算，也不会把窗口后的体力显示成窗口内状态。
- JSON 模型、费用、结果有当前版本专用 schema，结果核对消费关联、日志数值连续性、恢复公式及最终量。旧版本拒绝这些扩展；当前版本中缺少显式费用也被拒绝。
- 周期检查点明确报告尚未纳入体力量、恢复冷却和待扣除任务，因此不据此宣称确定性稳态已证明。

## 固定原始来源

来源提交：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。四份原始文件保存在 [stamina-source](stamina-source/manifest.json)，并重新从该提交的 raw URL 读取核对；四个 SHA-256 全部与本地归档一致，见 [远端逐字节核对](stamina-source/remote-verification.json)。本次没有执行 gcsim 外部模拟，因此这些是来源代码证据和手算比较，不是新的外部结果对照。

| 文件 | SHA-256 | 直接支持的语义 |
|---|---|---|
| `pkg/core/player/player.go` | `1920e035af195f85b136262c811832d31389e6cb9fda7438e1e14685c4c1df3e` | MaxStam=240；StamCDFrames=90；UseStam 扣除、下限零和 LastStamUse；Tick 严格大于90帧后25/60恢复 |
| `pkg/core/player/exec.go` | `daa25611e8a527c7ff81e857272f10646971a58722460906fb07e0f6d91b6bb0` | 重击/冲刺输入检查；重击即时 UseStam；冲刺交由角色动作排队 |
| `pkg/core/core.go` | `c61c270ac466b25c392e428f622b06d06174e3348c7f9377e4e42f2601541f7b` | Player.Tick 在 Tasks.Run 之前 |
| `internal/template/character/stam.go` | `414c7c87cdc498e0551dd9a90ee4d03b414ad7d7cca0028fe037c5cc2e077767` | 默认冲刺18、在DashLength−1时 UseStam；默认重击存在武器/角色覆盖差别，因此不自动套到所有角色 |

初始 `LastStamUse=0` 对应该来源零值语义：自定义初始量不足240时也从第91帧开始恢复，而不是假定输入前已经闲置。strict 失败继续、wait 等待是本项目明确的轮转输入策略；数值和恢复顺序采用以上来源。

## 实际执行的聚焦检查

只新增并运行 `packages/sim-core/src/__tests__/stamina-runtime.test.ts` 的三个测试，没有重跑旧单元全集、浏览器全集、性能或大样本蒙特卡洛。

1. `npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts`：首轮 **3失败**，823ms，测试20ms。三项均在无效测试夹具 `swapFrames=0` 被 schema 拒绝，尚未进入体力计算；保留 [原始日志](stamina-runtime-test.log) 与 [退出码1](stamina-runtime-test.exit)。
2. 将夹具合法切换占用设为1帧，跨角色即时扣除的期望帧相应从1改为2。相同命令 **3通过**，895ms，测试155ms；[日志](stamina-runtime-test-retry.log)、[退出码0](stamina-runtime-test-retry.exit)。
3. 检查发现等待后状态到期的失败分支需要保留真实游标，补上该生产分支和对应断言；同时将历史输入断言收紧至具体 `staminaModel` 拒绝原因。仅运行受影响的两项：`npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts -t 'rejects only|preserves absent'`，**2通过、1跳过**，919ms，测试143ms；[日志](stamina-runtime-state-followup.log)、[退出码0](stamina-runtime-state-followup.exit)。

4. 接入半开观察窗后，只复验带跨界断言的第一项：`npx vitest run packages/sim-core/src/__tests__/stamina-runtime.test.ts -t 'rejects only'`，**1通过、2跳过**，873ms，测试99ms；[日志](stamina-runtime-window-followup.log)、[退出码0](stamina-runtime-window-followup.exit)。F91–180的恢复日志裁为F120之前时，实际区间为F91–119，`29 × 25/60 = 12.083333333333334`；原始日志仍结束于F180。

测量/手算边界：

- 初始0、费用10：strict 仅重击失败，后续明确免费技能在F0实际造成一次伤害；到F180恢复 `90 × 25/60 = 37.5`。
- 相同输入的wait模式：F91至F114共24帧恢复恰好10，F114重击扣至0，后续免费技能F115命中。至F180尚未恢复。两次命中实际帧为 `[114,115]`。
- 等待时100帧行动状态到期：F114检查该状态失败，后续免费技能仍从F114开始，不退回早先帧；至F180共享量37.5。
- 初始18：角色A在F0声明冲刺延迟至F20扣18；角色B于F2即时扣18至0；A的F20回调实际扣除量0并重置恢复延迟。F50明确免费技能不重置，F111首次恢复 `25/60`。
- 显式零费用UseStam在F50发生时，F140仍为0，F141为`25/60`。
- JSON 往返通过；修改导出最终体力被拒绝；漏声明费用被拒绝；旧版本携带模型被明确拒绝。移除模型及声明后，两次伤害恢复为原F0/F1，总伤与等待版本相等，结果不携带体力字段。

## 仍未覆盖

未推导真实角色减耗、天赋/命座状态、动态减耗、恢复天赋、体力上限变化、攀爬/游泳/飞行、冲刺冷却/连续冲刺锁、特殊冲刺持续消耗，也不把手动动作声明升级成该角色完整来源契约。延迟费用采用输入声明的固定数值，不承诺来源在回调时重新计算动态减耗的机制。输入上下文和这些限制随模型说明公开保留；开启模型不等于完整真实角色可执行支持。
