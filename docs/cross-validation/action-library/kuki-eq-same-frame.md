# 久岐忍 E/Q：同帧治疗先于 Q 分支的外部证据

固定来源 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。沿用[原 E 场景的精确面板](./kuki-source-parameters.md)，只将忍初始能量改为 60，并在帧 564 输入 Q。C0、突破 6、三个天赋均 1，无圣遗物和武器被动；忍 EM +200、CR −0.05 为明确合成输入。此证据仍为 `source-backed-provisional`，不代表完整角色或游戏客户端认证。

## 实际执行

唯一 CLI 调用首次 exit 0，记录墙钟 **0.021687083 秒**；包含一个汇总迭代和一条独立 sample，没有重复模拟、网络请求、npm 测试或构建。二进制重新读取 SHA-256 后匹配 `2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`。

原件：[配置](./kuki-eq-same-frame.gcsl)、[执行记录及输出文件哈希](./kuki-eq-same-frame.execution.json)、[汇总结果](./kuki-eq-same-frame.result.json)、[完整 sample](./kuki-eq-same-frame.sample.json)、[机器比较](./kuki-eq-same-frame.comparison.json)。

动作输入依次为 E1、换人51（安柏52成为前台）、换人300（忍301成为前台）、`wait(564-f()); kuki burst;`。实际 sample 的零起始日志下标证明：

|帧|日志下标|实际事件|
|---|---:|---|
|564|82|E 治疗：忍 HP 7394.142141417917 → 8424.575198408174，比例 0.4852457919264609 → 0.5528686878896913|
|564|83|Q 快照，A1 条件因 HP 已高于 50% 而不满足|
|564|86|Q 执行；实际采用普通 7 击分支|
|568|95|Q 扣能：60 → 0|

Q 命中帧为 **614、631、648、665、682、699、716**。每击独立算式 `15237.931506964002 × 0.036048 × (190 / 380) × 0.9 = 247.18362973336724`，七击合计 **1730.2854081335706**。E 仍有原来的 9 击、总伤 **496.89815872204804**，合计 16 击 **2227.1835668556187**。逐击独立算术最大残差 **0**；汇总 DPS **139.1989729284762**。

8 次 E 治疗的帧、对象、治疗加成和 HP 与此前 E 场景完全相同，最后忍 HP **10216.632688826016**。独立递推 HP 最大残差仍为 **1.8189894035458565e-12**。这验证同帧治疗改变了 Q 的**施放时条件**，并非 Q 后续命中不断重判生命阈值。

## 固定来源的执行阶段

[阶段来源清单](./kuki-burst-phase-sources.json) 对 14 份既有固定原始档案重新核对字节并记录 SHA-256；均引用现有路径，没有重复下载或复制源码。

1. `simulation.nextFrame` 先增加帧数，完整执行 `Core.Tick`，再处理模拟层能量、受伤和 OnTick。`Core.Tick` 顺序为 combat、constructs、player、core tasks。本场景草轮的既有任务因此在恢复 `wait` 后的 Q 输入前执行。[模拟循环](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L273-L299)、[Core.Tick](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138-L155)
2. core task 堆先按到期帧排序，同帧再按插入 ID 排序，执行条件为 `executeBy <= 当前帧`。文件同时明确警告 `delay <= 0` 的行为不一致，并说明敌人、角色与 core tasks 具有不同队列顺序。因此不能从这一场景推断所有来源队列都已被完整复制。[完整 task 源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/task/task.go)
3. 既有本帧任务完成、`wait` 恢复后，输入经过 ready check 与 `executeActionPhase`。`Burst()` 取得快照并读取当时 `CurrentHPRatio() <= 0.5`，决定 7／12 击；整数除法 `2 * 60 / 7` 为 17 帧，首击偏移 50。能量消耗另排到 +4 帧。[动作执行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L231-L270)、[Q 来源](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/burst.go)、[扣能排队](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/energy.go#L9-L32)

本地实现可据此建立“既有本帧任务 → 接受输入 → 本动作零偏移效果”的有限执行边界；本报告没有验证整个来源的多队列语义、所有零延迟任务、hitlag 或动态装备快照。Q 源码的旧注释写低血量可能 11 击，但实际分支赋值为 12，不能采用该注释。此次只实际执行高于 50% 的 7 击分支。

sample seed 为 `4622440989320708706`，汇总迭代 seed 为 `8657629235194519853`，二者独立。该 sample 粒子在 666、756 到达；依显式 100 帧延迟推定生成于对应 E 命中 566、656，测量文件明确标注推定。双方回能只从该 sample 原始日志读取，不与汇总迭代混合，也不要求跨引擎相同 seed 产生相同随机序列。
