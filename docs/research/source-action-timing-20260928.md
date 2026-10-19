# b4/a7 来源动作时间线与等待语义审计（2026-09-28）

本文记录本轮实现前的源码审计。审计后完成的执行政策及回执见[实际实现与检查](../action-timing-special-replay-20260928.zh-CN.md)；下文“当前/缺少”指审计时的原生源码与旧面板。

## 结论

缓存的 b4、a7 GCSim 执行器当前都是原生自动等待：队列动作尚未就绪时逐帧重试，角色动画未开放下一输入时也逐帧等待。GCSL `options` 没有 `strict` 或 `stop` 项；`iteration` 是模拟次数，`duration` 是模拟观测时长（秒），不是单个动作的等待秒数。脚本可用 `wait(n)` 固定跳过 n 帧，也可用 `delay(n)` 累积下一动作前延迟；二者语义不同。

时间线能从现有来源日志确定动作实际执行帧、动画开始与结束/中断帧、冷却触发与实际 ready 帧。每个动作的下一输入窗口只部分可推导：动画开始日志包含 `CanQueueAfter` 与逐个下一动作的帧阈值，但它们是基于动画内部时间的门槛；受 hitlag 暂停或 `UseNormalizedTime` 影响时，不能把 `start + CanQueueAfter` 当成实际可输入帧。要显示精确窗口，来源侧需增加实际 queue-ready 帧事件。现有日志也缺少脚本动作实例 ID，重复循环中无法无歧义关联编辑器里的某一行。

## 配置、等待与终止

固定源码缓存路径：

- b4：`/tmp/gidps-source-host-cache/upstream/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/source/`
- a7：`/tmp/gidps-source-host-cache/upstream/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/source/`

两 variant 的 `pkg/gcs/parser/parseOptions.go` 解析 `iteration`、`duration`、`defhalt`、`hitlag`、延迟项等（b4 第 20–108 行）。其中 `defhalt` 控制防御类 hitlag 处理，不是动作等待模式；未知 option 会报错（第 107–109 行）。`pkg/simulation/run.go` 在 duration 未设时默认 90 秒（第 110–119 行），固定时长模式以 `F == Duration*60` 终止（第 298–315 行）；DamageMode 则在没有剩余动作或所有目标死亡时终止（第 298–312 行）。

- `iteration` 写入 `Settings.Iterations`（parseOptions.go:29–33），控制模拟运行次数；不能解释为动作重复次数或等候次数。
- `duration` 写入 `Settings.Duration`（:34–38），是整场观测窗秒数。
- 原生 ReadyCheck 对 `ErrActionNotReady` 与 `ErrPlayerNotReady` 每帧重试（`pkg/simulation/run.go:162–198`）；这是 auto-wait 行为。合法性检查（如无前置普攻的非法重击）在 ReadyCheck 前直接返回错误（:169–179），不是可等待的就绪条件。
- 动作执行后，执行器逐帧检查 `CanQueueNextAction()`，条件成立后才向 evaluator 取下一动作（`run.go:230–269`）。
- `wait(n)` 在当前帧记 `executed wait` 与 `f=n`，再精确推进 n 帧（`run.go:138–216`；`pkg/gcs/eval/sysfunc.go:102–125`）。它是明确动作/固定等待。
- `delay(n)` 累积为下一动作前的延迟（`sysfunc.go:128–151`、`run.go:142–150, 219–239`）。延迟倒数在 hitlag 暂停时不递减（run.go:219–227）；不同于 `wait`，也不能当作实际动作开始时间。

如果产品提供 strict，应明确这是新增执行模式：动作一旦在既定队列时点遇到 `ErrActionNotReady` / `ErrPlayerNotReady` 就报失败，而不是逐帧 retry；不能把 `options strict=true` 写进现有 GCSL。若 strict 仍需要动画队列策略、隐式 swap 或延迟行为，需由实现定义后再显示其语义。建议保留来源错误类别与首次失败帧。

## 时间线可用字段及边界

`pkg/core/action/action.go:13–25, 53–66, 72–101` 定义动画信息：`AnimationLength`、`CanQueueAfter`、按下一动作计算的 `Frames(next)`、hitlag 暂停时间 `TimePassed` 与始终递增的 `NormalizedTimePassed`。`CanUse(next)` 在指定条件下用 normalized time，否则若 frozen 则不可用，再比较 `TimePassed >= Frames(next)`；`CanQueueNext()` 则比较 `TimePassed >= CanQueueAfter`。动画结束条件是 `TimePassed > AnimationLength`，而非等于。

`pkg/core/player/animation/animation.go:44–68, 70–94, 108–127` 记录来源动画开始时点，并在 debug 日志写 `AnimationLength`、`CanQueueAfter`、`State` 和按动作名的 `Frames(next)` 值。结束日志通过开始事件的 `ended` 字段记录结束或被新动作打断的实际帧；消息还给 `TimePassed` 与括号内的 `NormalizedTimePassed`。b4/a7 的固定来源配置启用这些 debug 日志。该日志没有说明某一后续动作究竟采用 normal 还是 normalized time，也没有单独记录 hitlag 暂停条件，因此 per-action Frames 是阈值，不足以还原实际 queue-ready 帧。

冷却通用模板 `internal/template/character/cooldown.go:34–56, 86–97, 145–203`：

- `cooldown triggered` 在触发帧输出 `type`、当时 `expiry`（当前剩余帧）、`original_cd`、CDR 后的 `modified_cd_by_cdr`、`charges_remain`、`cooldown_queue`。
- 队列工作器实际恢复一层充能时输出 `cooldown ready`、`type`、`charges_remain`、`cooldown_queue`（第 175–203 行）。强制 reset/reduce 也有事件（第 99–142 行）。
- 因多层充能、CDR、强制缩减/重置、延迟触发等存在，不应简单用 `触发帧 + original_cd` 伪造真实冷却结束。显示真实 CD/可用性应以 `ready`、`forcefully reset` 等实际事件及充能队列为准；没有通用事件的角色专属机制应标为来源未记录。

项目补丁 `packages/source-host/patches/007-action-attempts.patch:16–19` 为每次失败尝试记录 `source-host action rejected`，字段为 `action` 与 `reason`。这是尝试帧而非动作执行帧；现有 native attempt logger 对尚未就绪动作可能每帧输出。失败类型应保留原始 enum 字符串，尤其不能只映射泛化 `cooldown`：UI 当前 `source-team-builder.ts:352–355` 映射 `insufficient_energy`、`cooldown`、`insufficient_stamina`，与源码实际枚举名（如 `skill_cd` / `burst_cd`）可能不一致。`FailedActions` 聚合连续失败，不能替代逐次尝试记录（补丁注释）。

## 当前面板与最小增量

当前 `apps/web/src/source-team-builder.ts:348–375` 将原始行解为帧、事件、消息和字段；展示 rejected、executed action、wait、animation 与 cooldown/energy。时间线绘制 action/wait/animation（第 379–388 行），动画实际 `ended` 可用；cooldown ready 事件目前只在表格中展示，尚未连成冷却轴。动画开始日志中的 `AnimationLength`、`CanQueueAfter` 和各 action threshold 当前尚未进入事件模型。

建议最小增量：

1. 把 `executed <action>` 的来源 `frame` 作为已接受动作的实际执行时点；保留 `source-host action rejected` 作为此前的实际尝试点。动画 started 行作为实际动画起点，`ended` 作为动画结束/中断帧。
2. 先将 `AnimationLength`、`CanQueueAfter`、按 action 命名的阈值解入可选原始属性，显示成“来源动画长度”“队列门槛（相对动画内部时间）”。不得直接宣称 `start + CanQueueAfter` 是实际下一输入窗口。
3. 来源端新增实际首次 `CanQueueNextAction()==true` 的事件（frame、actor、当前 action、`TimePassed`、`NormalizedTimePassed`），作为精确下一输入窗口；可同时记录采用哪种计时基准/暂停条件。若暂不改来源，仅用相邻下一条 `executed` 事件给出“下一动作实际执行帧”，并将 queue threshold 标注为估算/理论门槛。
4. 把 `cooldown triggered`、`ready`、`forcefully reset/reduced` 合并到独立冷却轨道，按 actor + `type` + 充能队列顺序关联，以 ready/reset 的实际 frame 表示冷却结束/充能恢复。缺事件时明确“不足以判定”。
5. 若要将日志对齐到编辑器脚本行/循环实例，来源侧增加稳定的 action sequence/instance ID 并贯穿 evaluator、排队、rejection、execution、animation；仅按 action 名和角色邻近帧匹配会在循环及重复动作场景歧义。

以上结论来自缓存的 b4/a7 固定源码及当前 wire/UI 读取方式；这是字段与调度语义审计，不构成游戏实测或对每名角色冷却覆盖率的保证。

## 审计后的实现落点

共享008补丁已新增严格/自动等待政策，并通过同一sequence关联真实排队、接受和下一输入窗口回执；两个Go wrapper保留严格中止前的真实日志。现有内部帧门槛仍不能等同墙钟帧，编辑器行/循环编号映射以及独立游戏验证不因这些回执自动完成。
