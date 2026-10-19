# 特殊反应状态：来源证据与实现边界

2026-09-23 核查。这里区分指南机制描述、固定模拟器实现与本项目执行结果。本文没有进行游戏内实验，也没有运行上游模拟器；**固定源码能证明源码采用的规则，不能单独证明游戏实际行为**。

原始 Lunar 指南快照 `S2` 为 Luna VI，Stellar 指南快照 `S3` 为 7.0，均于 2026-09-22 读取；HTML 哈希见 [source-retrievals.json](./source-retrievals.json)。Lunar 源码沿用 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。本次另取得 Stellar 源码提交 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，提交时间 2026-09-23T04:51:44Z。14 个固定源码的 URL、SHA-256、实际下载时间与临时路径见 [special-state-source-retrievals.json](./special-state-source-retrievals.json)。这是新增研究证据，不自动更新项目全局公式版本。

## 指南可以支持的状态规则

| 机制 | 明确条件与数值 | 来源与保留项 |
| --- | --- | --- |
| 月反应启用 | 月感电：Ineffa、Flins、Columbina；月绽放：Lauma、Nefer、Columbina；月结晶：Zibai、Columbina、Linnea。均需相应被动和角色在队。 | [S2 对应反应章节](https://keqingmains.com/misc/lunar-reactions/)。不能用“任意月兆角色在队”替代具体开启条件。 |
| 月兆 | 有对应被动的角色每人增加 1 级；指南列初辉、满辉两档。 | S2 / Moonsign。只有部分被动开启反应；角色数与反应开关应分别存储。 |
| 雷云 | 双水雷附着目标可被攻击；存在时间约 6 秒，间隔约 2 秒，前台顿帧可使间隔约 2.1–2.3 秒；伤害动态取属性。 | S2 / Lunar-Charged / Additional Information。近似数字不是精确帧数证据。 |
| 草露 | 月绽放产生草原核或丰穰之核；反应本身无即时月绽放伤害。60 FPS 条件下一次反应约 2.5 秒填满 1 草露；同次攻击多目标仅一次生成。 | S2 / Lunar-Bloom。120 FPS 约 97% 且重叠触发存在连续填充，不能按“每反应独立排队 +1”实现。 |
| 月笼 | 三个月笼；三次月结晶触发后各攻击一次；月结晶本身没有普通结晶的全局 ICD。 | S2 / Lunar-Crystallize。精确生成位置、贡献者窗口及生命周期未在指南给出。 |
| 星反应启用 | Sandrone、Odette、Cryo Traveler 的对应被动启用星超导及星扩散。 | [S3 对应章节](https://keqingmains.com/misc/stellar-reaction-guide/)，范围 7.0。不是当前所有版本的穷尽名单。 |
| 极星辉域 | 每 4 秒取样已记录有效冰雷附着次数并清零，生成持续 4 秒的增益；创建领域那次附着不计；同次攻击多目标只计一次；冰扩散和漩涡爆炸附着也计数。 | S3 / Stellar-Conduct。普通命中但被 ICD 阻止附着不计数。表列 0–12 档：反应倍率 `[1,1.45,1.5,1.55,1.6,1.65,1.7,1.75,1.8,1.85,1.9,1.95,2]`；冰雷加成为其五分之一，物抗降低 40%。 |
| 星漩涡 | 创建一级，3 秒后爆炸；创建后再触发两次达到二级；再触发五次提前引爆的自然解释为总次数达到六次。初次同一攻击多目标只创建一级；已有漩涡时各反应分别加计。 | S3 / Stellar Swirl。“总六次”也与源码的上限常量一致，但源码递增存在下述缺陷，不能声称运行交叉验证成功。初始风伤不附着；爆炸附着 1U 冰。 |
| 辉映优先级 | 同时满足时星超导优先；状态并非任意队员均有。 | S3 / Damage Formulas / Additional Information；具体角色资格须读被动。 |

以上规则足以建立带证据标记的事件和计数状态。尚不能据此推导所有角色天赋、空间命中、贡献归属、增益叠加或完整团队伤害。

## 固定 Lunar 源码中的精确规则

以下帧单位以 gcsim 的 60 帧/秒模型为条件，状态为 `fixed-upstream-implementation-only`。

- [月感电源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go)：64–69 行创建后第 9 帧首次扫描，每次触发刷新云剩余寿命至 330 帧；231–264 行随后每 6 帧扫描，目标击中 ICD 120 帧，8 米玩家中心圆。源码明确留下云中心是否应随玩家移动的 TODO，故空间行为未核实。94–104 行的贡献者是在**每次攻击时目标上仍有个人水或雷耐久值**的角色，并非任意历史施加者或固定秒数窗口。最后触发月感电者拥有事件归属；每次伤害重新取属性。冻结阻止该分支。
- [月结晶源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go)：20–29 行设月笼寿命 540 帧、伤害生成延迟 13/25/37 帧、另加 10 帧飞行。41–67 行的全局计数上限 6；附近已具 3 月笼、计数至少 3 且 Harmony ICD 空闲时扣 3，并设置 37 帧 ICD。99–108 行每次反应收集触发者及目标所有仍有水附着的个人所有者，取并集；131–145 行在排定三次攻击时固定贡献者集合，随即清空下一轮集合。角色属性则在各次伤害生成时取样。月笼在 Harmony 时刷新寿命；20 米邻近判定在创建和延长函数存在 `<20` / `<=20` 边界差异，生成坐标有 TODO。
- [草露源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/verdantdew.go)：草露上限 3；月绽放在下一帧把生成截止设置为触发帧加 149。后续完整 [时序取证](./lunar-mixed-v2-source-evidence.md) 确认该赋值在当帧草露生产之后；原窗口未启用时首累计为触发后第 2 帧，零部分进度时首枚为第 147 帧。生成启用期间每帧累积 1 份，146 份生成 1 草露并清零部分计数，满 3 时停止累积。这是**持续填充窗口延长**模型，不是多个独立延迟奖励；与指南约 2.5 秒、FPS 相关的叙述不能直接视为完全一致。角色消费规则及月露（Moonridge Dew）为独立资源。

单位转换：KQM [Elemental Gauge Theory / Decay Rate](https://github.com/KQM-git/TCL/blob/master/docs/combat-mechanics/elemental-effects/elemental-gauge-theory.md)明确 `1U = 25 durability`。因此月感电扣除的 10 durability 为 0.4U。[固定 reactable.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go)174–175 行取该元素所有个人耐久的最大值作为目标可反应耐久；204–209 行新附着先乘 0.8；273–276 行 `reduceMod` 对每位个人分别扣除不超过其余额的同一数量。不可将所有个人耐久求和，也不可把 0.4U 平均分给各角色。

## 新 Stellar 源码提供的信息与明显冲突

[极星辉域源码](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarconduct_gadget.go)使用半径 15 米、寿命 360 帧、每角色记录 ICD 6 帧、上限 12、取样周期 240 帧。创建即取样一次；后续反应仅刷新剩余寿命，不重置取样周期。领域内敌人上的冰雷有效附着才可记录。

源码的增益寿命为 **241 帧**，注释说明多一帧用于避免同帧移除和重加；这是执行器处理，不应宣传为游戏的 4.0167 秒机制。领域于 360 帧消失后，240 帧取样产生的状态可能继续留到 481 帧；角色是否真正已离开领域没有逐帧重检。因此这份实现不能直接证明辉映退场与离场行为。

[星扩散源码](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarswirl.go)与[漩涡源码](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarswirl_gadget.go)可支持研究假设：初始贡献者为风触发者及目标现存冰附着所有者；冻结贡献者另限制角色本身为冰元素；每次触发集合并入漩涡集合，爆炸取出后清空。普通冰与冻结是否同时参与仍有 TODO。漩涡集合以全局标记存储，不是已验证的逐实体贡献归属。

源中出现以下实质冲突，必须保留阻断/未验证状态：

1. `stellarswirl.go:239` 使用加法赋值加上“当前计数加一”，从零连续调用得到 `1 → 3 → 7`；读取时截到 6。它不是逐次 `1 → 2 → 3`，故不能用该实际执行证明三次升级、六次引爆。
2. `stellarswirl_gadget.go:31` 以 `PolestarField` 类型注册漩涡，而 `stellarswirl.go:98` 按 `StellarVortex` 类型查找。`gadget.GadgetTyp()`直接返回注册值，未见自动纠正。
3. 源码数组中爆炸半径为 `[0,6,6,8,8,8,8]`，达到上限并未进一步增大；与指南提前引爆会扩大范围的叙述不一致。
4. 漩涡寿命常量是 181 帧；指南为 3 秒。需确认核心 Tick 次序才可解释差一帧，不能未执行就断定等同 180 帧。
5. 同次攻击多个目标的初次创建分组未在该分支体现；初始命中 ICD 使用普通冰扩散标签且附有 TODO。初始伤害范围 5 米、爆炸范围 6/8 米、生成中心玩家位置都只属于该固定实现。

## 辉映资格与 8 秒持续时间

本地 [genshin-db 投影清单](../../packages/game-data/manifests/source-evidence/genshin-db-7.1-source.json)固定提交为 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，通道仍为 `official-next`。其 `ChineseSimplified.talents.{sandrone,odette,travelercryo}.passive3` 明确分别规定：处于极星辉域时获得星超导辉映；附近队友触发星扩散后获得 8 秒星扩散辉映。`vesna.passive3` 只写星扩散转换及 8 秒星扩散辉映，不能由此授予星超导资格。这些字段仍是固定社区数据，不能越过通道验证升级为正式数据。

固定新源码的 [Odette](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/odette/stellar.go)、[Cryo Traveler](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/traveler/common/cryo/stellar.go)均在星扩散事件时授予 480 帧状态，不检查是否前台；超导优先，但未删除尚未到期的扩散状态。源事件监听未实际验证“附近”的距离。这个实现只能支持“未发现换人清除”而非所有角色后台行为的游戏验证。七七另需 `revelation` 条件，说明不能为全队无条件赋予可用辉映。

## 结论与阻断项

可以实现明确规则版本下的状态框架，并将指南支持的计数与固定模拟器帧规则分别记录。自动数值结果必须继续校验实际附着所有者、参与资格、空间范围、角色条件和规则版本。缺少这些上下文时应输出缺失原因，不能补全零值或以全部历史施加者代替。

尚缺独立游戏实测：云中心与真实命中时序、月笼精确空间与边界、草露 FPS/帧序、星漩涡贡献者冻结组合、星扩散 ICD、漩涡全局/局部实体归属、领域离场与辉映残留、相关角色专属延长和叠加规则。本次只做读取、取证和静态逻辑检查；未执行本项目测试或上游模拟器，测试数为零。
# 月结晶投递补充核查（2026-09-23）

后续为真实月结晶接入又读取固定 `b4ae769d…` 的 `pkg/core/attack.go`、`pkg/core/combat/attack.go`、`pkg/enemy/attack.go`、`pkg/enemy/damage.go`、`pkg/enemy/mods.go`、`pkg/reactable/crystallize.go`，取证清单现有 **20** 条。人物属性和个人暴击在谐律后的 13/25/37 帧取样；`QueueAttackWithSnap` 延迟 10 帧后，敌人伤害函数才使用当前有效 Geo 抗性。Hydro 转换分支在普通晶片与全局间隔逻辑之前返回，因此不能在后台继续生成普通水结晶盾。
