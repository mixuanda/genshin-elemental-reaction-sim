# 圣遗物反应与减抗：固定来源审计

本次只审计来源并保存证据，没有修改生产公式、没有执行测试。当前活动目录为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，目录标记7.1 released；套装记录的数字证据仍为unchecked、机制证据仍为missing，目录发布标签不等于本次独立核验完成。

活动描述与 gcsim固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 逐项比较。证据目录为 `packages/game-data/sources/artifact-reaction-effects/`：`manifest.json` 记录当前目录身份、完整原文摘录、固定源码URL、SHA256及许可；四份套装源码、敌人抗性修饰与通用覆盖函数、MIT LICENSE共7份原始文件，合计20,176字节，以`.txt`保存且未改变原始字节。其余检查过的公式／标识源码保留URL及哈希于清单中。

## 推荐的精确映射

下面“本项目名称”按现有计算器与特殊反应分支填写；gcsim内部标识不是都使用同样大小写。正数是反应系数中的加算奖励，负数是敌人抗性的加算变动，均不得塞入普通`damageBonus`冒充通用增伤。

| 套装条款 | 本项目精确反应／元素集合 | 值与固定源码证据 |
|---|---|---|
| 翠绿普通扩散伤害 | `swirlPyro, swirlHydro, swirlCryo, swirlElectro` | `+0.60 reactionBonus`；限四个Swirl攻击标签且 `!Amped && !Catalyzed` |
| 翠绿对应元素减抗 | `pyro, hydro, cryo, electro`，每个元素单独状态 | 该目标对应元素 `RES += -0.40`；600帧、受卡肉延长 |
| 深林草减抗 | `dendro` | 该目标 `RES += -0.30`；480帧、受卡肉延长 |
| 如雷常规剧变 | `overload, electroCharged, superconduct, hyperbloom` | `+0.40 reactionBonus` |
| 如雷超激化 | `aggravate`，不含`spread`或非伤害`quicken` | `+0.20`加入超激化加算伤害的反应系数；源要求 `Catalyzed && CatalyzedType == Aggravate` |
| 如雷月感电 | `lunar-charged-direct, lunar-charged-reaction` | 源确有 `+0.20`，对应`DirectLunarCharged`与`ReactionLunarCharge`两标签；需接至有资格装备者的特殊反应贡献者`reactionBonus` |
| 魔女常规剧变 | `overload, burning, burgeon` | `+0.40 reactionBonus` |
| 魔女增幅 | `melt, reverseMelt, vaporize, reverseVaporize` | `+0.15`加入增幅反应系数；源判断 `ai.Amped`，不依赖魔女战技叠层 |

如雷不增幅绽放、烈绽放、扩散或蔓激化；魔女不增幅超绽放、感电、超导或激化。没有来源依据的名称不能因元素相近而加入集合。魔女火伤叠层与其反应奖励是独立条款，即使战技层数为0，符合反应条件的加成依然存在。

## 源码中的乘区位置

[gcsim反应公式](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.go) 将剧变伤害的等级／反应基础乘以 `1 + 16×EM/(2000+EM) + ReactBonus`；激化加算基础使用 `1 + 5×EM/(1200+EM) + ReactBonus`。这里的如雷20%只改变超激化加算部分，再由普通命中公式处理后续乘区，不把整次普通命中乘1.2。

[敌人伤害公式](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go) 的增幅项为 `AmpMult × (1 + 2.78×EM/(1400+EM) + ReactBonus)`。魔女15%进入其中的加算奖励，不能直接把最终伤害乘1.15。直接月反应使用 `1 + 6×EM/(2000+EM) + ReactBonus`；间接月反应也将奖励加入对应贡献者的反应系数。

如雷月感电奖励在固定源码已存在，不能因提交较旧而统一标记“未实现月感电”。但装备归属、直接／间接分支、参与者资格仍须完整接线；只知道20%这个数值不足以给全部贡献者统一加20%。本审计没有实现该接线或执行验证。

## 减抗触发与刷新

[翠绿源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/viridescent/viridescent.go) 要求反应所有者是装备者，且**触发当时**装备者在场。四类扩散事件可给主要目标施加减抗；另有扩散伤害命中次要目标的监听路径。已有减抗不会因为装备者随后退场而立即失效，条件快照应恢复“当前目标、当前元素的减抗仍有效”，不要额外要求当前仍在前台。

[深林源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/deepwood/deepwood.go) 检查攻击所有者与`ElementalArt / ElementalArtHold / ElementalBurst`标签，没有前台要求，因此后台战技／爆发命中也能触发。伤害元素不限于草，但结果只降低被命中目标的草抗。

两套均修改敌人的抗性，不能修改防御、角色面板或给所有敌人默认附加。翠绿使用`vvpyro/vvhydro/vvcryo/vvelectro`对应键，深林使用`dm-4pc`键。[敌人修饰管理](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/mods.go)调用[通用Add函数](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go)，同一目标上的同键修饰被替换刷新。因此同名同元素翠绿不能叠成减80%，多套深林不能叠成减60%。不同元素翠绿状态可各自存在，只有命中对应元素的伤害读取该状态。

这里只确认数值与源码条件；主要／次要目标传播、反应事件与减抗生效的逐帧先后、卡肉延长及到期清理仍需由事件核心独立实现和测试。不能从“用户勾选有效”反推这些事件已发生。

## 如雷冷却条款

[如雷源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/thunderingfury/thunderingfury.go)监听超载、感电、月感电、超导、超绽放、原激化、超激化。触发所有者必须是装备者，并且装备者在场；共享`tf-4pc-icd`为48帧（0.8秒），每次把战技冷却减少60帧（1秒）。除超绽放外，还要求回调目标为敌人对象。

伤害加成集合和减冷却事件集合不相同：原激化没有对应伤害奖励，却可触发减冷却；月感电伤害两种标签获得奖励，也不意味着每个直接月感电伤害事件都能跳过反应事件条件触发减冷却。源码没有如雷或魔女能量返还，不应增加回能行为。本审计未实现任何减冷却事件。

## 活动7.1文本与固定源码的缺口

活动翠绿文本新增星扩散伤害20%，并说明星扩散还会降低冰抗40%；同元素减抗不可叠加。固定gcsim翠绿只有四类普通扩散，没有Stellar伤害标签或事件，因此**星扩散20%及其星扩散触发冰减抗路径保持阻塞**。不能把所有`stellar-swirl-*`分支直接并入普通`swirlCryo`。

活动如雷文本新增星超导伤害20%，并将其纳入减冷却触发描述；固定源码已有月感电20%，但没有任何Stellar枚举／事件。因此**星超导奖励及其冷却事件保持阻塞**；不能把它猜成普通`superconduct`或仅凭中文名称套用`stellar-conduct-*`。

活动魔女、深林的本次审计条款与固定源码没有上述新增反应差异。所有比较依然是来源交叉检查，状态为provisional，未作当前官服独立实验。历史实现文档的完成声明由生产规则与相应测试另行更新，本文件不把审计结果当作已经上线的功能。
