# 安柏基础普攻链：固定来源与执行契约

限定为一级／20 上限、C0 安柏，普攻天赋 1，一级／20 上限 R1 猎弓；无圣遗物、附魔、攻速增益、队友、技能、爆发或额外触发，关闭 Hitlag。这是固定社区实现的来源核对和一次外部执行，状态为 **source-backed-provisional**，不声明完整安柏实现或官方游戏真值。

全部来源锁定 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，对应官方发行 v2.44.1。已从固定 raw GitHub URL 重新取得 **28 个文件、974,651 bytes**，均 HTTP 200，并逐字节核对已有临时源码目录。原始文件归档在 `source/`，包含该提交的 [MIT 许可](./source/LICENSE)；逐文件 URL、时间、SHA-256 见 [取证清单](./amber-source-retrievals.json)。复取命令：`python3 docs/cross-validation/action-library/retrieve-amber-source.py`。

## 动作数值

时间单位为帧，60 FPS，均相对于本次动作开始。安柏源码把所谓 `attackHitmarks` 传给 `QueueAttack` 的 **snapshotDelay**，箭矢再飞行默认 10 帧才结算伤害，不能把它误写为目标命中时刻。[攻击源文件](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/amber/attack.go#L14-L65)、[QueueAttack 语义](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go#L36-L86)

| 动作 | 天赋 1 ATK 系数 | 快照／CanQueueAfter | 默认命中 | 下一普攻最早执行 | AnimationLength | E／Q／冲刺／跳跃／切人取消 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N1 | 0.3612 | 14 | 24 | 26 | 26 | 14 |
| N2 | 0.3612 | 10 | 20 | 22 | 22 | 10 |
| N3 | 0.4644 | 27 | 37 | 37 | 37 | 27 |
| N4 | 0.4730 | 26 | 36 | 34 | 34 | 26 |
| N5 | 0.5934 | 26 | 36 | 60 | 60 | 26 |

每个普攻动作提交一个命中。完整 1–15 天赋的 **75 个系数**已从 [生成天赋表](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/amber/zz_amber.dm.go#L36-L124) 提取至 [机器契约](./amber-normal-contract.json)。无队友天赋加级或命座加级时，`TalentLvlAttack()` 将天赋 1 映射为表下标 0；未设置 HP／DEF／EM 替代基数的普通攻击使用 ATK。[下标规则](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/character.go#L221-L234)、[默认 ATK 基数](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L46-L61)

## 排队、取消与自然结束的区别

`CanQueueAfter` 允许取得并排队下一项输入；实际执行还受 `Frames(next)` 约束。`InitNormalCancelSlice` 默认把所有后续动作设为 AnimationLength，再单独把 aim、skill、burst、dash、jump、swap 设为较早的快照帧。**下一次普通攻击必须使用 26／22／37／34／60，不能使用 14／10／27／26／26。** Aim 也有早期取消来源，但本次产品只需实现的 E／Q／冲刺／跳跃／切人表已单独放入 JSON。Charge、plunge、walk 等未经特殊覆盖的表项保留 AnimationLength；其动作本身的合法性和代价不在本契约内。[帧表构造](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/frames/frames.go#L9-L20)

`CanUse` 使用 `TimePassed >= Frames(next)`；**未被下一动作替换**时，`Tick` 要到 `TimePassed > AnimationLength` 才清除状态。因此外部 N5 在绝对帧 120 开始，下一普攻理论上可在 180 开始，而没有替换动作时自然结束日志为 181。把自然 Idle 时刻、完整动画长度和任意后续动作取消时间压成一个字段会丢失语义。[执行与结束判断](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/action/action.go#L53-L103)

帧闭包捕获该次 NormalCounter 与攻速，并调用 `AtkSpdAdjust`。这里明确固定攻速加成为 0，所以使用表中原始整数；不能顺便宣称攻速、Hitlag 情形已验证。`AdvanceNormalIndex` 在构造当前攻击后递增，五次后回到 N1；普通 `player.Exec` 的非普攻动作和切人会重置普攻计数。[闭包](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/frames/frames.go#L31-L43)、[递增](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/character.go#L99-L108)、[非普攻重置](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/exec.go#L163-L165)

本次日志在 N5 的 CanQueueAfter 时刻 146 显示 `wait(240)`，**这不是取消动画**。脚本 wait 在 simulation 层特殊处理，只推进帧，未走普通角色动作，N5 动画仍到 181 才结束。不能据 wait 日志把最终占用设成 26 帧。[特殊 wait](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L200-L216)

对固定源码的 `pkg/`、`internal/template/character/` 和安柏目录检查 `NormalCounter` 及重置入口，未见安柏依赖长间隔或 Idle 自动重置计数的定时器。已观察到的重置是五段后循环、实际非普攻动作与切人；脚本 wait 不在其中。这里没有额外执行长间隔探针，不能把“固定源码未建模超时重置”扩大成客户端也永不重置。最小动作库宜限定连续普通攻击链：N5 构造后计数已回 0，下一个 N1 按 +60 执行，不必等待 +61 的自然 Idle。

快照在发射时取得，命中在 10 帧飞行后发生。当前本地接口若只有 action/hit 快照，只有本契约的静态无增益面板才能保证数值等价；应拒绝动态增益、飞行期面板变化及插件，而非把命中快照冒充一般发射快照。

## 面板、元素与资源

一级安柏基础 ATK **18.6984**，一级猎弓基础 ATK **23.245**；各自一级曲线倍率为 1.0，20 上限无突破加成，合计 **41.9434**。HP **793.2582**，DEF **50.358**，EM 0，原始 CR 5%，CD 50%，ER 100%，能量上限 40。保留原始小数，不能先把装备界面的显示值四舍五入再相加。[角色数据](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/catalog/character.dm.go#L1531-L1551)、[武器数据](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/catalog/weapon.dm.go#L6822-L6839)、[属性组装](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/basestat.go#L73-L126)

猎弓注册 `NoEffect`，没有精炼被动；一级安柏 Ascension 0 的 A1 提前返回，C0 不注册 C2 的技能相关回调。本次仅普通攻击，不调用瞄准弱点、战技、爆发。[猎弓](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/huntersbow/hunter.go#L10-L13)、[安柏初始化](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/amber/amber.go#L17-L44)、[突破限制](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/amber/asc.go#L11-L35)

五段为物理、Normal tag、Pierce、原始 Durability 25、`ICDTagNone`、`ICDGroupAmber`。**物理没有元素附着**：敌人反应与 Aura attach 路径都显式排除 Physical；不要因看到 25 就给这五段创建 1U 火附着。`ICDTagNone` 跳过元素应用 ICD；伤害组计数仍存在，但 Amber 的伤害序列全为 1。普通攻击不消耗体力／能量、不产球；外部五次攻击后体力均保持 240。[物理排除](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L118-L125)、[物理 attach 排除](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L234-L239)、[ICD None](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/target/icd.go#L8-L12)

## 独立外部 N5 执行

使用此前哈希已验证的官方 v2.44.1 arm64 可执行程序，仅额外执行一次 `amber attack:5`：4 秒、1 个汇总迭代和独立 1 次 sample，CR 添加 −5% 抵消原生 CR，敌人等级 90／物理抗性 10%，exit 0。没有运行项目测试套件或性能基准。[配置](./amber-n5.gcsl)、[命令及原始 stdout](./amber-n5.execution.json)、[原始结果](./amber-n5.result.json)、[原始逐帧 sample](./amber-n5.sample.json)

| 动作 | 输入帧 | 快照帧 | 命中帧 | 外部非暴击伤害 |
| --- | ---: | ---: | ---: | ---: |
| N1 | 1 | 15 | 25 | 4.732408961072165 |
| N2 | 27 | 37 | 47 | 4.732408961072165 |
| N3 | 49 | 76 | 86 | 6.084525807092783 |
| N4 | 86 | 112 | 122 | 6.197202210927834 |
| N5 | 120 | 146 | 156 | 7.774671864618556 |

总伤害 **29.521217804783504**。输入间隔、快照延迟、命中延迟、全部五个倍率及运行时打印的后续动作帧表均与固定源码一致；N3 命中和 N4 输入共享帧 86，不能把同帧事件任意调序。该探针未实际执行 E／Q／冲刺／跳跃／切人，取消帧只是已核对源码及运行时帧表，不能把它扩大成这些动作的完整行为验证。上游 config.yml 声明的帧表／视频链接已随原文保存，本次未独立复核视频。
