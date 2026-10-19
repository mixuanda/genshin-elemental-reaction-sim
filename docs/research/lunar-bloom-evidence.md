# 月绽放直接能力与草露消费：固定来源核查

核查日期：2026-09-23。范围是 `gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 中可独立描述的直接月绽放能力，**不代表菈乌玛、哥伦比娅或奈芙尔整角色已经实现**。本次只读取源码与固定社区数据，没有进行游戏内实验、执行上游模拟器或修改计算代码。

19 份源码的固定 URL、实际下载时间、字节数和 SHA-256，以及未截断的仓库树证据，保存于 [lunar-bloom-source-retrievals.json](./lunar-bloom-source-retrievals.json)。源码副本位于 `/tmp/gidps-lunar-bloom-sources/`；下述行号以这些原始下载文件为准。草露生成基本规则已见 [special-state-evidence.md](./special-state-evidence.md)，本文仅补直接能力消费与时序。

## 可以独立声明的能力：哥伦比娅「月露涤荡」

固定 [charge.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/charge.go#L45) 的 45–47 行在动作开始检查 `Dew()>0`，成立时将重击切换为 Moondew Cleanse。82–110 行描述了完整三段：草元素、直接月绽放、生命值倍率、忽略防御、不附着元素；消费一次 1 枚草露。[columbina.go:66](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/columbina.go#L66)另明确该资源条件下的重击体力消耗为 0。

最小可信执行范围为 **C0、从空闲状态开始、无顿帧、不中断、没有并行草露消费、单个明确命中目标**。需要先拥有资源，不要求释放元素战技、元素爆发或执行完整轮转。

| 事件 | 相对动作开始的源码帧偏移 | 作用 |
| --- | ---: | --- |
| 开始条件 | 0 | `Verdant Dew + Moonridge Dew > 0`，否则该源码走普通水重击分支。若仅支持草露，须明确声明 Moonridge Dew 为 0。 |
| 消费 | 55 | `43 + idle windup 12`；角色任务队列调用 `ConsumeDew(1)`。 |
| 第一段 | 62 | `50 + 12`；此时取样并命中。 |
| 第二段 | 70 | `58 + 12`；再次取样并命中。 |
| 第三段 | 92 | `80 + 12`；再次取样并命中。 |

源码还区分接普通攻击和接重击的前摇，本文建议的能力范围不启用这些衔接。不能把这个三段能力误写为哥伦比娅元素战技的五段引力干涉；后者有另外的资源、触发窗口和飞行延迟。

### 精确天赋倍率

[zz_columbina.dm.go:104–121](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/zz_columbina.dm.go#L104)的 `chargeLB` 是**每段**生命值比例，三段各用一次，不应先乘三又把三段重复累计。

| 有效天赋等级 | 每段倍率 |
| ---: | ---: |
| 1 | 0.015112 |
| 2 | 0.016245 |
| 3 | 0.017379 |
| 4 | 0.018890 |
| 5 | 0.020023 |
| 6 | 0.021157 |
| 7 | 0.022668 |
| 8 | 0.024179 |
| 9 | 0.025690 |
| 10 | 0.027202 |
| 11 | 0.028713 |
| 12 | 0.030224 |
| 13 | 0.032113 |
| 14 | 0.034002 |
| 15 | 0.035891 |

[character.go:221–233](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/character.go#L221)表明无额外加级时索引为输入天赋等级减 1。表存在 15 项不等于任意配置都能达到天赋 15；实际可用天赋等级仍须角色及加级来源证明。

本地固定 `genshin-db@49a6544a6c6ae36089cb42fa591fc46f01de8bcf` 投影的 `stats.talents.columbina.combat1.param6` 与这 15 项**逐值完全一致**；中文 `combat1` 正文也说明有资源时消耗一枚、免体力、造成三次视为月绽放的草伤。该投影仍标为 `official-next`，本次一致性核对不改变其通道或社区证据等级。

### 每段取样与真实被动

`charge.go:105–107` 对每段调用 `QueueAttack`，令取样延迟等于命中延迟。[core/attack.go:73–77](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go#L73)到期后生成快照并立即命中；[模板 Snapshot:56–76](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/character.go#L56)读取当时角色属性。因此 HP、EM、CR、CD 不是动作开始时统一锁定的三段共享快照。

命中前还会执行被动及攻击修改。[asc.go:26–40](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/asc.go#L26)给所有直接月曜伤害增加 `min(MaxHP / 1000 × 0.002, 0.07)` 的基础伤害加成，按命中时哥伦比娅的生命值读取；这不是 C1 效果，**C0 范围也不能静默省略**。其他队友被动、命座、装备、Pale Hymn、月域、引力产生的暴击加成必须显式输入或明确排除，不能把面板属性当成完整计算上下文。

直接月绽放从 [enemy/damage.go:185](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L185)计算，精通加成及专属加成适用；普通伤害加成不进入公式。当前目标抗性在命中时读取。每段单独进行暴击判定，源码没有把三段锁为同一暴击结果。这个能力没有元素附着，因此自身不会额外触发一次月绽放反应来生成草露；如果元素战技正在生效，直接月曜伤害可通过另一个事件钩子影响引力，这不在最小能力范围内。

## 同帧资源生产与消费顺序

固定 [core.Tick:138–154](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138)顺序是目标、构造物、玩家、全局任务。[player.Tick:317–324](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L317)内部先执行动画处理，再执行草露生产，之后逐角色 Tick。

[character/hitlag.go:10–34](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/hitlag.go#L10)确认 `QueueCharTask` 进入角色时钟队列，角色 Tick 才执行。因此同一帧的正常草露生产先于本能力草露消费；若原本已满上限，本帧生产会先被上限阻止，再发生消费，不可反过来补生产。

后续追查确认，`OnLunarBloom` 的 +1 窗口赋值使用同一全局任务队列，晚于该帧草露生产。新窗口首个有效累积在触发后第 2 帧，零部分进度时第一枚为第 147 帧；旧窗口仍有效时先照旧生产再刷新。当前共享状态及独立 LB 已统一修正为 `verdant-dew-fixed-core-order-v2`，没有沿用旧的 F+1 首累计近似。完整来源链与受影响用例结果见 [补充取证](./lunar-mixed-v2-source-evidence.md)。

顿帧会推迟角色时钟消费任务，而三段 `QueueAttack` 使用全局任务时钟。故 55/62/70/92 的固定时序仅用于明确无顿帧的配置，不能擅自扩展为所有实战时序。消费函数实际先用 Verdant Dew，不足再用 Moonridge Dew；它返回实际消费数。但本能力源码没有校验延迟消费是否真正取得 1 枚。若其他动作在第 55 帧前抢用资源，上游会出现已排伤害与资源不足之间的边界。项目应拒绝这种未支持的并行竞争，不能以失败消费代替成功，也不能悄悄取消或补出伤害后宣称源码一致。

## 其他能力的证据与限制

| 对象 | 已取得的固定证据 | 本次不宜扩大到完整实现的原因 |
| --- | --- | --- |
| 菈乌玛长按战技的直接月绽放一段 | [skill.go:109–170](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/lauma/skill.go#L109)：开始有 Dew；29 帧消费最多 3；45 帧一段普通草伤加一段直接月绽放，后者每露倍率×EM。`skillHold2` 有效等级 9 为 2.584，10 为 2.736。 | 完整战技同时创建霜林圣域、普通草附着、减抗、月咏；爆发状态又改变月咏处理。不能只实现直接一段便标完整 E；同帧两段与减抗回调的顺序也须保留。 |
| 哥伦比娅引力干涉·月绽放 | [skill.go:153–245](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/skill.go#L153)：选择月绽放类型后，五段 HP 伤害在 51/56/62/71/82 帧生成，另加 20 帧飞行。`skillLB` 等级 9 每段 0.023936，10 为 0.025344。 | 自动触发依赖战技存在、引力累计及反应类型比较；源码注明非 C1 平局选择还未正确实现。它不消费 Dew，不能伪装成草露消耗实例。 |
| 哥伦比娅山月草露 | [asc.go:126–153](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/asc.go#L126)：A4、月域与月绽放事件条件下生成；每 18 秒计数窗口最多 3，另有 3 帧 ICD。 | 源码明确尚未实现 60 秒未补充后清除；须独立资源，不可混入普通草露生成条。 |
| 奈芙尔 | 固定提交的完整、未截断树中 `internal/characters/nefer/` 文件数 **0**。本地社区数据有幻戏描述和倍率字段。 | 缺少该固定模拟器上的动作帧、幻戏各段状态、资源消费时间与完整切换逻辑；不能靠名称或描述补帧，也不能声称此提交提供实现交叉验证。 |

## 本次执行结果

- 下载并校验 19/19 份固定源码的 SHA-256 与字节数。
- 确认固定仓库树未被截断，奈芙尔角色实现文件数为 0。
- 三组天赋数组：月露涤荡、引力干涉月绽放、菈乌玛长按第二段，各 15 项；与固定本地投影合计 **45/45 完全一致**。
- 以上是静态取证和数据一致性检查；未执行游戏实验、上游模拟器或本项目测试，未将帧偏移声明为新完成的实测。

建议将「月露涤荡」作为**限定条件的独立直接月绽放能力**，每一段输出可复算上下文；草露生产、消费、动作合法性及三段伤害分开追踪。完整哥伦比娅、复杂取消、范围多目标、顿帧、并行消费、装备与队友被动仍须各自证据和实现。
