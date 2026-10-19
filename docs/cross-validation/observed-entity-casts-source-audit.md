# 显式实体观察动作来源审计

本批把可莉Q、神里绫人Q、莱依拉E、瑶瑶Q、芙宁娜荒性E、艾梅莉埃E/Q的八个旧局部映射替换为七个完整观察动作。二十条伤害角色是供核心编译日程的倍率模板；它们的`instanceCount=1`不是完整施放命中数，不能直接合计这些模板后宣称完整动作。

新增数据位于`packages/game-data/src/character-mappings/observed-entity-mappings.ts`及`packages/game-data/sources/observed-entity-casts/`。协议为`explicit-observed-entity-v1`。本审计仅制作数据、读取固定源码和核对系数/归档哈希，未执行测试、构建、上游应用或外部模拟器。

## 固定来源与归档

- gcsim固定提交：[`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541)，从已有本地解压目录`/tmp/gidps-gcsim-b4ae769`读取，不重新下载。原始压缩包SHA-256为`334067728781541ccd4351fbe9851f7684f4f6c2d4dab79a1c3dd1e01318fd1a`。
- genshin-db固定提交：[`49a6544a6c6ae36089cb42fa591fc46f01de8bcf`](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf)，使用已有原始`src/data/stats/talents.json`和六名角色中文天赋原文，与当前固定目录快照逐项比对。
- `source.json.gz`保存92个完整原文文件，JSON键名采用`gcsim/<upstreamPath>`与`genshin-db/<upstreamPath>`。包括六名角色的所有Go文件、伤害排队/快照/修正、角色与核心队列、护盾、实体生命周期文件，以及两份MIT许可证。`manifest.json`逐文件记录字节数、SHA-256和Git blob SHA-1。
- 全部84个gcsim原文文件均与完整固定Git树的blob逐项一致，树的`truncated=false`。可用的genshin-db树是截断树：许可证与六个中文天赋文件匹配其中的blob；`stats/talents.json`不在该截断树中，其原文与仓库已有固定来源SHA-256记录一致。没有把计算出来的Git blob值当作缺失树项的独立证明。
- 归档压缩使用固定`mtime=0`。归档文件和`definitions.json`自身的SHA-256记在manifest；归档不执行上游源码。

## 倍率与固定项

十六组唯一的Go倍率向量在全部15级上与目录及原始stats三方完全相同，共240个值，绝对容差均为0。`values`保留目录值，`sourceValues`保留Go原值；不存在舍入宽限或人为覆盖。下表的Go字段位于相应角色目录的`zz_<catalogSlug>.dm.go`中，神里绫人的源码目录为`ayato`，目录slug为`kamisatoayato`。

| 动作角色 | 目录参数 | 缩放 | Go字段 |
| --- | --- | --- | --- |
| 可莉Q pulse | klee.combat3.param1 | ATK | burst |
| 神里绫人Q droplet | kamisatoayato.combat3.param1 | ATK | burst |
| 莱依拉E initial | layla.combat2.param1 | ATK | skill |
| 莱依拉E star | layla.combat2.param2 | ATK | starDmg |
| 瑶瑶Q initial | yaoyao.combat3.param4 | ATK | burstDMG |
| 瑶瑶Q burstRadish | yaoyao.combat3.param1 | ATK | burstRadishDMG |
| 瑶瑶Q skillRadish | yaoyao.combat2.param1 | ATK | skillRadishDMG |
| 芙宁娜E initial | furina.combat2.param1 | HP | skillOusiaBubble |
| 芙宁娜E chevalmarin | furina.combat2.param4 | HP | skillChevalmarin |
| 芙宁娜E usher | furina.combat2.param3 | HP | skillUsher |
| 芙宁娜E crabaletta | furina.combat2.param5 | HP | skillCrabaletta |
| 艾梅莉埃E initial | emilie.combat2.param1 | ATK | skillDMG |
| 艾梅莉埃E arkhe | emilie.combat2.param5 | ATK | skillArke |
| 艾梅莉埃E/Q level1 | emilie.combat2.param2 | ATK | skillLumidouce[0] |
| 艾梅莉埃E/Q level2 | emilie.combat2.param3 | ATK | skillLumidouce[1] |
| 艾梅莉埃Q burst | emilie.combat3.param1 | ATK | burstDMG |

莱依拉飞星在突破4后附加`0.015 × MaxHP`，见[`layla/asc.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/layla/asc.go)和[`shield.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/layla/shield.go)。这是飞星发射时的固定项，初击不包含它。目录`passive2`只有文字，没有参数数组，因此定义使用无`parameterKey`、`minimumAscension:4`的固定项。

艾梅莉埃A1在突破1后独立造成`6 × ATK`，原始标签为`AttackTagNone`，见[`emilie/asc.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/emilie/asc.go)。定义映射为`proc`，不享受普通技能/爆发标签专属加成。它使用`fixedOnly:true`和`fixedTerms`，不虚构目录参数。映射中的空`parameterKey`仅为兼容接口的哨兵，分类适配器须跳过该行的目录主项检查，并保留实际技能元数据及固定项。A1的`minimumAscension`为1。

艾梅莉埃二阶系数是每一发的系数；每次事件排入两发，不能再把目录展示的`×2`乘到每一发上。Q结束恢复的一/二阶柔灯读取E等级，只有三阶读取Q等级。瑶瑶A1在飞行后读取攻击信息时，若Q状态已结束则读取E角色`skillRadish`；这不等于把所有已发出的Q月桂萝卜都改为E倍率。

## 生命周期、面板与资格边界

可莉Q的固定源码第100帧快照，波次起点为186、294、401、503、610、718帧。每波必有三发，第二/三组各有额外随机一发；观察协议必须记录分支结果和逐发接触。换人使状态提前结束后，未开始的波次停止；不能凭一条局部倍率恢复随机整轮命中数。源码对起始时点、间隔与快照仍有近似注释，并保留卡肉队列TODO，见[`klee/burst.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/klee/burst.go)。

神里绫人Q在第101帧快照并开始每30帧一次、共36次的选点，伤害延迟38帧；同一敌人的选中标记持续87帧。无可选敌人时选择随机落点，所以每次选点不等于一次命中。源码对成形时快照仍有疑问注释，见[`ayato/burst.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/ayato/burst.go)。

莱依拉E初击施放时快照、第32帧造成伤害；护盾第19帧建立。护盾生命周期、技能聚星事件、射星期间暂停累积、索敌重试和已经排入的飞星尾段必须完整覆盖。飞星发射时快照，其ATK与A4生命值份额均使用该时点，之后按逐发旅行时间命中，见[`layla/skill.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/layla/skill.go)和`shield.go`。

瑶瑶Q固定实现的状态持续360帧，第104、162、221帧尝试生成跳跃月桂，换人移除Q及跳跃月桂。月桂生成时快照，投掷后仍有13帧尾段；A1在冲刺/跳跃资格下产生萝卜，并在旅行后、伤害前一帧选择Q/E攻击信息和快照。目标选择依赖范围与在场角色生命值，治疗不计入本次自身直接伤害，见[`yaoyao/yuegui.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/yaoyao/yuegui.go)及`burst.go`、`asc.go`。

芙宁娜荒性初击的生命值项在施放时读取，伤害及普通面板快照在第18帧。三名成员行动时读取生命值上限，并乘`1 + 0.1 × eligibleAllyCount`；资格为生命值比例大于0.5。该计数在在场角色爆发无敌帧的扣血豁免之前增加，不能以实际扣血人数替换它。成员命中前再次验证实体与持续时间，普通面板在实际执行攻击时快照。A4仅沙龙成员享有，使用其每30帧更新的`min(MaxHP / 1000 × 0.007, 0.28)`；初击不享有此项，见[`furina/skill.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/furina/skill.go)及`asc.go`。

芙宁娜成员间隔来自拟合与随机偏移，不能将均值视为逐次观测值。源码对于重击切换、重施放或到期是否取消已发出的投射物/扑击保留明确TODO；本协议复现固定取消分支，不把它声明为游戏实测结论。

艾梅莉埃E第16帧建立柔灯，第37帧初击，第62帧灵息之刺。Q第96帧建立三阶柔灯，第306帧恢复旧等级或默认一阶并开始新的22秒实体寿命。必须记录每个香韵生成、收集、降级、A1触发及已排入伤害的尾段。A4在命中时按该目标是否燃烧及实际ATK给出`min(ATK / 1000 × 0.15, 0.36)`，与基础系数分开处理，见[`emilie/lumidouce.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/emilie/lumidouce.go)、`skill.go`、`burst.go`及`asc.go`。

柔灯攻击额外调用会自行再次排队的香韵收集函数；源码对该调用时点明确保留疑问。固定源码复现须保留这些队列条目，不能自行合并为一个30帧周期后宣称相同。

引擎每帧按Combat、Constructs、Player、核心Tasks推进；角色队列与核心队列属于不同阶段，同一核心队列按入队ID稳定排序。`pkg/core/task/task.go`明确提示`delay<=0`及跨队列顺序问题；`pkg/core/attack.go`还区分立即伤害、延迟快照与已有快照伤害。因此观察协议须保留会改变边界结果的同帧次序，并覆盖伤害尾段。

## 替换范围与状态

只移除以下八个局部映射ID：`klee-burst-burst-hit`、`ayato-burst-burst-hit`、`layla-skill-hit`、`yaoyao-burst-burstdmg-hit`、`furina-skill-skillousiabubble-hit`、`emilie-skill-skilldmg-hit`、`emilie-skill-skillarke-hit`、`emilie-burst-burstdmg-hit`。它们是映射ID，不是旧`skillId`。

七个新动作均为C0、无卡肉、明确观察输入下的固定源码完整自身直接伤害。是否能够计算完整动作由核心观察协议负责；数据模板本身不认证随机结果、碰撞、自动轮转、当前游戏时间线或运行时正确性。本次数据交付不包含测试或构建通过声明。

## 2026-09-25统一集成记录

公共模型、注册、来源编译、准备／转换／重置、公式AST与正常控件已接入，JSON保留实际事件、逐击状态及权威历史快照。已发生单击只检查所选命中的依赖；未选命中缺少未来记录不会阻塞本击，完整施放仍需全部资格及生命周期观察。

统一数据命令首轮通过，实际`.22`为120身份、1157命中模板、636条件完整动作、34部分动作、11阻塞，自动团队就绪0。本轮四组新增30条件完整动作，替换34旧部分动作并解除7男性来源冲突阻塞。证据见[生成](../validation/lifecycle-maxhp-data-generate.log)、[校验](../validation/lifecycle-maxhp-data-check.log)、[状态](../validation/lifecycle-maxhp-data-status.log)。

唯一新增[核心聚合](../../packages/sim-core/src/lifecycle-source-batch.test.ts)4组用例首轮全部通过（Vitest 3.08秒，墙钟3.533秒），[原始日志](../validation/lifecycle-source-batch.initial.log)和[退出状态](../validation/lifecycle-source-batch.initial.exit)保留。每组一条完整转换／JSON／独立单击链路，其余分支只核对来源排程及必要条件；没有重复旧角色套件或性能基线。运行时验收不能反向提升固定来源为游戏内实测或团队就绪。总记录见[生命周期与最大生命扩展](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。
