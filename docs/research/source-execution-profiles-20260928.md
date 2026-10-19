# 来源执行难度配置审计（2026-09-28）

## 结论

b4/a7 缓存源码都接受 `swap_delay`、`attack_delay`、`charge_delay`、`skill_delay`、`burst_delay`、`jump_delay`、`dash_delay`、`aim_delay` 和 `frame_defaults=human`。`human` 是源码内置的 frame preset 名称和值，不是经过游戏测量或社区标准认证的延迟。新手配置可将其作为“来源内置参考值”准确展示；保守值例如 swap 12、其余 8 应标成产品提供的用户假设，不能归因于游戏/社区标准。

更重要的是，固定 b4/a7 native simulation 执行路径里，`Delays.Swap` 确实驱动 swap 动画和切人任务；其他七项在 GCSL 中被解析、保存在 settings、传入 Core 并序列化，但当前执行逻辑没有把它们应用到普通动作前等待或取消时间。`frame_defaults=human` 因而只会在此执行器实际影响 swap 的 8 帧，不能宣称当前 native 动作执行普遍加入 5 帧操作延迟。显式 `delay(n)` 才会作为下一动作前的预延迟；它也不是按动作类型自动应用的 profile。

## 来源值与解析

证据路径以 b4 缓存为例（`/tmp/gidps-source-host-cache/upstream/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/source/`）；a7 固定缓存对应 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/source/`，检查到的解析和 player 执行结构一致。

- `pkg/gcs/parser/parser.go:49–58` 新建 `SimulatorSettings` 时，默认 `Swap=1`，其他 delay 字段为 Go 零值 0。故未提供配置时，不等同于 `frame_defaults=human`。
- `pkg/gcs/parser/parseOptions.go:47–85` 将八个命名配置各解析为整数并存入对应字段：`swap_delay`、`attack_delay`、`charge_delay`、`skill_delay`、`burst_delay`、`jump_delay`、`dash_delay`、`aim_delay`。
- `parseOptions.go:87–103` 的 `frame_defaults=human` 将 Swap 设为 8，Attack/Charge/Skill/Burst/Dash/Jump/Aim 均设为 5；未设置 walk 或 low/high plunge 项。该分支直接赋值，因此配置项顺序有影响：放在 `frame_defaults=human` 后面的显式 delay 会覆盖 preset；放在它之前的显式 delay 会被 preset 覆盖。
- `pkg/core/info/actionlist.go:57–65` 定义这八个字段；`pkg/simulation/core.go:8–17` 把整个 `Delays` 结构传入 Core；`pkg/simulator/simulator.go:208–225` 也把这些数值写进模拟结果 `SimulatorSettings.Delays`。配置被存储/序列化本身不证明运行时实际应用。

建议产品预设区分来源事实与产品假设：

| 配置 | swap | attack | charge | skill | burst | jump | dash | aim | 对用户的准确说明 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Ideal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 产品理想化无输入延迟假设；不是来源 preset |
| Practical | 8 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 数值精确采用 GCSim `frame_defaults=human`；不代表游戏实测保证 |
| Conservative | 12 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 示例性产品假设，用户可改；不称作游戏/社区标准 |
| Custom | 用户填写 | 用户填写 | 用户填写 | 用户填写 | 用户填写 | 用户填写 | 用户填写 | 用户填写 | 直接映射到对应字段，并明确帧数单位 |

如果引擎仅按当前固定来源实现，不应将 practical/conservative 标签暗示成所有动作均实际套用上述帧数。可将 UI 文案写为“来源配置值”，并说明该来源执行器当前实际只在切人转场使用 swap delay；等攻击等其他 delay 真正接入 native scheduler 后再扩大其运行效果描述。

## 延迟实际生效阶段

**Swap。** `pkg/core/player/exec.go:130–155` 先记录切人，构造 `action.Info`，其中 `Frames`、`AnimationLength`、`CanQueueAfter` 都等于 `h.Delays.Swap`，并用 `QueueAction(h.swap(k), h.Delays.Swap)` 安排实际换人。执行器随后 `SetActionUsed`（同文件 :151–152）。因此 swap delay 从 swap 动作执行帧开始，既决定换人 callback 的计划延迟，也决定该转场动画的长度/开放下一队列的门槛；不是在发出 swap 指令之前等待。

**普通动作。** `pkg/core/player/exec.go:96–128` 分发 charge/dash/jump/walk/aim/skill/burst/attack/plunge 到角色方法；`:183–213` 调用角色方法返回该动作自己的 `action.Info`，再 `SetActionUsed` 并写 `executed <action>`。这里没有用 `Delays.Attack/Charge/Skill/Burst/Jump/Dash/Aim` 给动作前加等待或改动画参数。角色动作自身的 `Frames`、`AnimationLength`、`CanQueueAfter` 驱动动画与取消窗口；来源 profile 字段与它们不能混为一谈。

**显式 GCSL `delay`。** `pkg/gcs/eval/sysfunc.go:128–151` 把 `delay(n)` 解析成独立 `ActionDelay` 及参数 `f`。`pkg/simulation/run.go:142–150` 在取到 Delay 后将其加入 `preActionDelay`，而不是当作一个角色动画执行；动作准备执行前在 :219–239 逐帧递减，hitlag 时停减。然后回到 ReadyCheck (:226–227) 再执行下一动作。这是按脚本位置执行的固定前置延时，不按 Skill/Attack 等分类自动读取 profile 值。

**显式 GCSL `wait`。** `sysfunc.go:102–126` 发出 ActionWait；`run.go:138–141, 200–216` 记录并推进指定帧数，之后重新排队。它是独立站立等待动作，与 profile delays、动画取消门槛均不同。

## 动作范围边界

- 八个 delay 字段里，`swap_delay` 是当前固定 b4/a7 执行器里直接驱动动作逻辑的项。
- `attack_delay`、`charge_delay`、`skill_delay`、`burst_delay`、`jump_delay`、`dash_delay`、`aim_delay` 在 parser settings 与结果 settings 中存在；在上述 b4/a7 native simulation 调用路径没有对应的动作前等待逻辑。不可仅凭字段名、frame_defaults preset 或结果 JSON 宣称其已生效。
- `walk` 没有 delay 字段或 parser option；low/high plunge 也没有对应 delay 字段。动作分发包含 Walk 与两类 Plunge（`pkg/core/player/exec.go:114–128`），但其时序由角色动作自身 Info/动画状态定义。
- 角色动画取消/连招门槛不等同于操作输入 delay：`action.Info` 中的 `Frames(next)`、`AnimationLength`、`CanQueueAfter` 是角色动作逻辑数据，角色方法返回后通过 AnimationHandler 处理；swap 是前述独立实现。

本审计只覆盖固定源码配置和 native 执行路径；`human` 的命名和数字只可称来源 preset，conservative 示例只可称产品假设。游戏输入时延实测、社区规范与游戏内逐角色动作行为均未由此验证。
