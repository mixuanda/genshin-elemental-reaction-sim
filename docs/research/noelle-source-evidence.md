# 诺艾尔 C0 Q→N1–N4 固定来源证据

证据状态为 **fixed-source-assumed**。读取既有 `gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 解压源码，没有新下载或构建。23 份相关源码的 SHA-256、固定 URL、行号及完整有效天赋 1–10 数组保存在 [机器清单](./noelle-source-evidence.json)。这不是完整诺艾尔角色实现，也不是当前游戏实测认证。

## 倍率与动作

[zz_noelle.dm.go:38–107、306–359](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/zz_noelle.dm.go#L38) 的天赋 1–10 原始比例为：

| 分支 | 有效天赋 1–10，按顺序 |
| --- | --- |
| N1 ATK | 0.7912, 0.8556, 0.92, 1.012, 1.0764, 1.15, 1.2512, 1.3524, 1.4536, 1.564 |
| N2 ATK | 0.73358, 0.79329, 0.853, 0.9383, 0.99801, 1.06625, 1.16008, 1.25391, 1.34774, 1.4501 |
| N3 ATK | 0.86258, 0.93279, 1.003, 1.1033, 1.17351, 1.25375, 1.36408, 1.47441, 1.58474, 1.7051 |
| N4 ATK | 1.13434, 1.22667, 1.319, 1.4509, 1.54323, 1.64875, 1.79384, 1.93893, 2.08402, 2.2423 |
| Q 第一段 ATK | 0.672, 0.7224, 0.7728, 0.84, 0.8904, 0.9408, 1.008, 1.0752, 1.1424, 1.2096 |
| Q 第二段 ATK | 0.928, 0.9976, 1.0672, 1.16, 1.2296, 1.2992, 1.392, 1.4848, 1.5776, 1.6704 |
| Q DEF→ATK | 0.4, 0.43, 0.46, 0.5, 0.53, 0.56, 0.6, 0.64, 0.68, 0.72 |

表中只截取所需前十项，没有插值或重复端点。Noelle 的技能／爆发命座加级分别在 C3／C5；当前范围是 C0，不附加等级或 C6 的额外 0.5 转换。

[attack.go:14–43、45–99](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/attack.go#L14) 与 [frames.go:9–42](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/frames/frames.go#L9) 给出无攻速、无卡肉时的相对帧：

| 项目 | N1 | N2 | N3 | N4 |
| --- | ---: | ---: | ---: | ---: |
| 命中／CanQueueAfter | 27 | 24 | 19 | 41 |
| 下一普攻 | 38 | 46 | 31 | 106 |
| 下一重击 | 41 | 48 | 40 | 109 |
| E／Q／dash／jump／swap／aim 取消 | 27 | 24 | 19 | 41 |
| AnimationLength／未单独覆盖动作 | 54 | 66 | 72 | 112 |

Q 两段相对施放为 +24、+65。两段都保留 `AttackTagElementalBurst`、`ICDTagElementalBurst`、默认 ICD 组与 25 durability（1U）；第二段虽然命名为 “Sweeping Time (Skill)”，不能改作战技伤害。Q `AnimationLength=121`，下一普攻 83、重击／E 82、dash／jump 81、walk 90；未覆盖的 swap 等为 121，`CanQueueAfter=81`。[burst.go:23–30、87–136](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/burst.go#L23)

普通攻击基础为物理、钝击、1U、普通攻击 ICD tag／默认组。命中任务执行时若 Q 状态有效，改用 `ICDTagNone`；随后 Noelle 专有 Snapshot 给普通／下落／Extra tag 改岩元素，不能被普通武器附魔覆盖。范围、ICD 与面板均需按实际命中时状态处理，不应在输入时把全部后续普攻永久改为岩。

## 几何

来源参数相对玩家及其朝向，源函数参数是 radius 或 width／height，不能将直径与半径互换：

| 命中 | 未开 Q | 开 Q |
| --- | --- | --- |
| N1–N3 | 玩家前方局部偏移 (0,1)，圆半径 2 | 同偏移，圆半径 5.2 |
| N4 | 局部偏移 (0,−1)，矩形宽 2、高 3 | 同偏移，宽 3.3、高 6.2 |
| Q 第一段 | — | 玩家中心圆半径 6.5 |
| Q 第二段 | — | 玩家中心圆半径 4 |

Noelle Q-N3 的源卡肉停顿为 0.10 秒，未开 Q 的 N3 为 0.09 秒；其他 N1/N2 为 0.10、N4 为 0.15，Q 两段为 0.15，均 factor 0.01 且可 defense halt。本次外部 fixture 关闭卡肉，不据此验证卡肉链或几何边界。

## DEF 快照、Extra 与到期边界

[burst.go:33–49、73–85](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/burst.go#L33) 在施放时读取 `TotalDef(true)`，把 `defconv × DEF` 存入附加 ATK，并将该转换 modifier 本身标为 `Extra: true`。`TotalDef(true)` 经 [SelectStat:122–166](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L122) 排除 `Extra` DEF modifier，包含基础 DEF、非 Extra 百分比 DEF、非 Extra 固定 DEF。之后 DEF 改变不追溯修改本次转换；普通 ATK 等其他有效属性仍在各击 Snapshot 时读取。

源码公开留下三处未验证假设：`burstStart=80` 标为不确定；DEF 假设施放立即快照，使转换作用于两段 Q；buff 准确生效／截止时间仍待确认。C0 参考实现立即添加持续 `900+80=980` 帧的 modifier，受 hitlag 延长。不能抹掉 TODO 后标为 verified。

精确到期边界需要完整调用链，不能只读 `StatModIsActive`：

- [modifier.FindCheckExpiry:117–125](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117) 将 `expiry==F` 暂视为存在。
- [character.Stats:24–42、69](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L24) 在 snapshot 时实际删除 `expiry<=F` 的 StatMod；Stat／SelectStat 同样不计入到期帧数值。
- [Noelle.Snapshot:42–54](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/noelle.go#L42) 先调用模板 Snapshot（执行 Stats 清理），再检查 Q 附魔。因此精确到期帧的最终普通伤害是物理、无转换 ATK。
- 但普攻命中回调先于 Snapshot 检查 Q 状态、选几何与 ICD。若没有其他更早 Stats 调用清掉 modifier，该回调可先选扩大范围／ICDTagNone，再在 Snapshot 阶段失去附魔。此边界依赖同帧调用顺序，当前六秒外部例没有实际运行到到期帧；有界实现应明确保留该条件或阻塞该边界，不能简单宣称“到期帧仍岩”。

## 普攻回能的随机性

[core/energy.go:30–89](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/energy.go#L30) 使用 `OnEnemyDamage`，Normal／Extra 标签才参与。按 actor×武器类保存概率：剑初始 0.1，其他 0；失败增量为剑 0.05、大剑 0.1、长枪 0.04、弓 0.05、法器 0.1。共享全局 ICD 未阻挡时取 `Core.Rand.Float64()`，roll≤概率成功、固定回复 1；成功后全局 ICD 到 F+12，当前角色武器概率归零（剑回到 0.1）。失败只增加概率，不锁 ICD；恰好 F+12 可以再次判定。切人清空全队全部概率，再把每个角色的剑概率设为 0.1，但不清全局 ICD。源码对 12 帧 ICD 与切人清概率均有 TODO 假设。

满能量不跳过随机判定，固定回复经 `AddEnergy` 限幅；不乘充能效率，不冒充粒子。钩子不检查是否在前台、是否造成正伤害、是否成功附着元素。[enemy/attack.go:60–78](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L60) 在当前帧 +0 全局任务实际扣血后发出事件，再调用攻击回调。未命中不进入此路径；已实际进入 HandleAttack 的零伤害并无额外过滤。

使用与其他机制共享的 Go `math/rand.New(rand.NewSource(opt.Seed))`。普通伤害即使 CR=0 也取一次暴击 RNG（弱点必暴短路除外），因此不能另造一个相同 seed 的独立回能流并声称与上游序列一致。六击外部例伤害确定，但其 aggregate 与独立 sample 的普通回能末态不同；实际数据完整保留于 [外部测量报告](../validation/noelle-q-normal-external.md)。

## 本次外部执行范围

唯一外部调用使用已验证 SHA-256 的 gcsim v2.44.1 二进制，6 秒、1 次汇总迭代加独立 sample。Lv1/20、C0、天赋1、Lv1无被动大剑，正常能量条件执行 Q→N4；六次伤害与预先从固定面板和倍率计算的 Decimal 值相差最多 `2.68041237114e-15`。这里只验证外部来源行为与独立数值预期，未代替父任务的本地核心／计算器对照。
