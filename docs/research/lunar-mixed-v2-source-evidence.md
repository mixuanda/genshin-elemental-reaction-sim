# Lunar mixed v2：有序反应、草原核与草露时序来源

来源查读阶段只读取既有固定来源、重新计算单文件哈希；未下载新来源、运行上游模拟器或进行游戏实测。后续项目修正验证见文末。来源为现有 `/tmp/gidps-gcsim-b4ae769`，对应锁定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。19 份源码共 80,072 字节，URL、SHA-256 与原下载归档身份见 [证据清单](./lunar-mixed-v2-source-evidence.json)。本地目录没有 Git 元数据，提交身份来自已有固定归档下载记录；本次不声称重新验证整份归档哈希。

`TryQuicken` 实际位于 `pkg/reactable/catalyze.go`。既有项目归档 `packages/game-data/sources/weapon-additional-effects/gcsim/pkg__reactable__catalyze.go.txt` 与本次读取文件哈希完全一致。先前限定特殊来源缓存的只读审计找不到正文，并不表示项目没有该证据。

## 同一入射攻击的反应顺序

[reactable.go:93–139](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go#L93) 在本次水／雷／草／岩范围内依次执行：

| 入射 | 顺序 | 重要条件 |
| --- | --- | --- |
| 水 | Bloom → `TryAddEC` | 启用月感电时，`TryAddEC` 转发至 `TryAddLC`，不创建普通感电。 |
| 雷 | Aggravate → `TryAddEC` → Quicken | 超激化不把 `Reacted` 设为真、不消耗入射量；LC 后还需继续 Quicken。 |
| 草 | Spread → Quicken → Bloom | Quicken 先耗雷与入射草；后面的普通 Bloom 仍读取剩余草预算。 |
| 岩 | 雷结晶 → 水结晶转换 | 沿 mixed v1 已有顺序；草与原激化不作为可结晶元素。 |

固定 [electrocharged.go:16–19](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/electrocharged.go#L16) 证明 LC 转发位置。[lunarcharged.go:24–69](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go#L24) 要求仍有正入射量及另一种 H/E Aura；只有 `!a.Reacted` 才附着入射 H/E。此前 Bloom 已消耗但仍有剩余量时，仍可触发／刷新 LC 云，却不能再次附着水。LC 自身不减少入射预算。

## Quicken → Bloom 是读取执行时状态的任务

[catalyze.go:47–85](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/catalyze.go#L47) 的关键语句：

```go
r.attachQuicken(consumed, a.Info.ActorIndex)
r.core.Tasks.Add(func() { r.tryQuickenBloom(a) }, 0)
```

Quicken 先按 1:1 消耗相反的 D/E Aura 与入射量，将消耗量作为新 Q 量，Q 所有者为入射攻击角色；源码耐久单位下寿命为 `12 × consumed + 360` 帧。仅当此时仍有水，才排入 `+0` 回调。回调保留同一个攻击 `a`，不是生成一次新的草元素攻击。

[bloom.go:62–88](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/bloom.go#L62) 到执行时再次检查 Q 与 H，并读取当时最大个人 Q 量。若以 U 表示，`q = max(Q个人量)`、`h = max(H个人量)`，则水减量为 `min(2q, h)`，Q 减量为 `min(q, h/2)`；[reduce / reduceMod](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go#L273) 将相同减量分别作用于每个个人槽、各自最低为零，不能对所有者求和或平均。

普通水触发 Bloom 则分别对 D 和 Q 调用 `reduce(..., 0.5)`，水预算取两者最大消耗，不把二者相加。草触发 Bloom 对水调用 `reduce(..., 2)`。这些与 Q→Bloom 回调使用实时 Q 作为反应预算的路径必须区分。

全局 [task.go:38–60](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/task/task.go#L38) 以执行帧、再入队 ID 排序。`+0` 排入当前帧任务队列；不是在 `TryQuicken` 的调用栈中内联执行。队列运行过程中新增同帧任务会继续被取出，但应排在已入队的同帧旧任务之后。

## Bloom 回调、草核和草露不能互相替代

直接 Bloom 与 Q→Bloom 在成功后使用同样顺序：

1. 完成各自 Aura 消耗。
2. 启用 LB 时调用 `LunarBloom()` → `Player.OnLunarBloom()`，安排草露生产截止时间的更新。
3. `addBloomGadget(a)` 安排 30 帧后的普通草核生成。
4. 立即发送 `OnLunarBloom`，否则发送 `OnBloom`。

[bloom.go:44–58、77–103](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/bloom.go#L44) 保留传入攻击的角色／元素／上下文，因此由雷入射 Quicken 排出的 Q→Bloom 仍由该雷攻击角色拥有；不能强制改为草角色，也不能因为入射元素为雷而丢弃 LB 资源刷新。LB 不取消普通草核生成。

## 新发现：草露首次有效累积比窗口赋值晚一帧

本次修正前，`special-reaction-state.ts` 用 `activeFrom = Bloom帧 + 1`。追到共享任务对象后，固定来源给出的时序不同；这是现行独立 LB 与共享状态都需要修正的一帧偏差：

- [verdantdew.go:36–38](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/verdantdew.go#L36)：Bloom 在 F 发生时，排入 `+1` 任务，将截止设为 `F + 149`。
- [core.go:93–103](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L93)：玩家的 `Tasks` 就是全局 `c.Tasks`，不是生产前运行的另一队列。
- [core.go:138–153](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138)、[player.go:317–324](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L317)：每帧先玩家动画、草露生产、角色任务，再全局任务。因此 F+1 的截止赋值在当帧生产阶段之后。
- [run.go:286–288](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L286)：正常模拟先增 F 再 Tick；不会因初始截止值 0 而在第 0 帧自动产生一份部分进度。

由以上源码顺序推导：原窗口不活跃且部分进度为零时，F 的 Bloom 首次有效累积在 **F+2**，连续 146 个有效生产帧后，于 **F+147** 获得第一枚；生产包含 F+149。旧窗口仍活跃时，F+1 可沿旧截止继续生产，随后再更新截止；不能每次刷新都人为断开一帧。若旧窗口在 F 前已经结束，重新激活同样须等待赋值后的下一生产阶段。部分进度保留；满三枚时该生产阶段不累积，后续角色任务消费不能追溯补生产。

这是源码时序推导，没有通过本子任务执行上游模拟器或游戏实测。项目修正与验证采用生产／全局更新的真实次序，覆盖旧截止帧与重新激活窗口的边界。

核心实现统一使用 `verdant-dew-fixed-core-order-v2`：Bloom 排真实 F+1 的窗口赋值任务；先完成 F+1 旧窗口生产，再将截止更新到 F+149。该修正同时适用于现行独立 LB、默认 `SpecialReactionState` 和新的 mixed v2，不保留一个默认执行已知错误时序的路径。资源结果与相应状态日志携带新的规则 ID，供结果审计识别该语义变化。

## 普通雷接触草核与 LC 攻击的区别

[combat/attack.go:28–30、44–68](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go#L28) 对每个目标复制攻击，先处理敌人，后处理草核等 gadget。敌人反应消耗的是其副本，因此不能把敌人侧剩余入射量当作草核接触量。已有草核若被本次雷攻击实际命中，仍可触发 Hyperbloom；本次 Bloom 才安排的草核尚未到 30 帧生成时间，不能被同一即时攻击提前命中。

[dendrocore.go:86–124](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/dendrocore/dendrocore.go#L86) 在正耐久雷攻击实际命中草核时，安排 60 帧后的 Hyperbloom，立即清除草核并发事件。延迟任务届时读取触发者属性，并从草核位置选择 15 米范围内最近敌人；不是按原 Bloom 所有者取属性，也不是触发时提前固定目标。

LC 不能仅因为伤害元素为雷而触发超绽放：[lunarcharged.go:109–120](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go#L109) 为 `NewSingleTargetHit(敌人Key)`，且攻击结构没有 `Durability` 值；[target.go:107–109](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/target/target.go#L107) 要求单目标键完全一致。草核继承相同目标命中判定，键不匹配；即使忽略该命中限制，零耐久也会被草核 `Attack` 入口拒绝。LC 的 0.4U 消耗是命中后的独立回调，不是可供草核接触的雷附着。

## 已执行的草露修正验证

2026-09-23 执行一次以下命令：

```sh
npx vitest run packages/sim-core/src/special-reaction-state.test.ts packages/sim-core/src/lunar-bloom-runtime.test.ts packages/sim-core/src/__tests__/lunar-bloom-simulation.test.ts -t 'Verdant Dew|preserves core conversion|executes real one-Dew|stops production|actual Lunar-Bloom'
```

结果：3 文件、7 项通过，8 项无关测试跳过；总计 1.38 秒，测试执行 328 毫秒，无失败重跑。覆盖首次生成 F+147、窗口连续刷新、旧截止帧生产后再赋值、过期窗口不能追溯生产、满层先停产再消费、同帧新资源不能倒用于选择动作，以及独立 LB 普通／特殊事件的计算器恢复。合成独立 LB 实例在第 6 帧触发 Bloom、第 153 帧生成草露、第 215 帧消费，三次伤害仍发生在 222／230／252 帧，各为 916.8434100000001。该范围不替代 mixed v2 的新集成测试或统一构建验收。
