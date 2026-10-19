# 四个普通周期施放：固定来源审计

本批新增伊涅芙E无月感电场、哥伦比娅E无月反应事件、菈乌玛短按E、恰斯卡Q单目标四个条件完整动作，替换七个旧局部动作。结论为 `provisional-conditioned`：来源内完整不等于当前游戏实测、任意命座或自动队伍轮转完整。游戏资料观察基线仍为2026-09-24 14:48 UTC；实现与统一验收记录日期为2026-09-25。

## 固定来源与数值

[manifest](../../packages/game-data/sources/periodic-ordinary-casts/manifest.json)固定 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。47份原始代码、引擎依赖及许可证字节已归档，逐项Git blob SHA-1匹配固定提交树，逐文件SHA-256见manifest。归档还保存所用活动目录的相关投影和完整目录哈希，不能把投影称为原始完整目录。

- [source.json.gz](../../packages/game-data/sources/periodic-ordinary-casts/source.json.gz)：SHA-256 `b2e5a5f4cf0c6eff740cd242791961bc1fd0b8885b5a8faeb5e73be6522af8e3`。
- [definitions.json](../../packages/game-data/sources/periodic-ordinary-casts/definitions.json)：4动作、12伤害角色，SHA-256 `5e6cbf0ca7701c568f230b99f6c63763de070d12f9d6661ebd3d6f3b98b683db`。
- 11组独立数值向量、每组15级，与活动目录逐级精确一致，容差0。包括10组伤害向量以及菈乌玛E减抗向量；不按标签猜倍率或元素。
- 活动目录版本为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，SHA-256 `3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602`。

## 来源生命周期与实际输入

| 动作 | 固定来源机会与观察尾部 | 明确资格及独立取样 |
| --- | --- | --- |
| `periodic-ordinary-ineffa-skill-no-lunar-c0` | 初击26；机器人68生成，110起每119帧放电，到1268到期，共10次放电机会 | 全程没有月感电雷云，且没有此前或期间Q引入A4精通转化；未声明不能省略A1或A4 |
| `periodic-ordinary-columbina-skill-no-lunar-c0` | 初击21；138起每117帧涟漪，到1521到期，共12次周期机会 | 没有月反应／月伤事件，没有旧引力或A1暴击层数残留 |
| `periodic-ordinary-lauma-skill-press-c0` | 初击16；62、179、296、413、530、647、764、881的八次圣域机会，完整观察至900 | 目标此前没有菈乌玛减抗；实际命中结算后更新600帧减抗，落空不更新；A4读取初始化EM，与本击面板EM分开 |
| `periodic-ordinary-chasca-burst-c0` | 初击96；六枚弹依次103、139、147、153、157、160 | 单一合资格敌人、没有E夜魂飞行或夜魂迸发；声明其余队员元素及实际六枚弹顺序，验证每位火水雷冰队员贡献两枚对应元素弹，余下为风弹 |

所有机会都需要明确接触记录。缺少接触不是落空；全落空也不会补造一次伤害。完整施放还要求C0、新鲜施放、无卡肉、无打断、无重施／替换以及完整观察。不能用持续时间除以周期推算伤害次数。

直接依据：[伊涅芙skill.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/ineffa/skill.go)、[哥伦比娅skill.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/skill.go)、[菈乌玛skill.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/lauma/skill.go)、[菈乌玛asc.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/lauma/asc.go)、[恰斯卡burst.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/chasca/burst.go)。系数来自各角色同提交的`zz_*.dm.go`，与归档目录精确对照。

## 生产协议与记账

`gameContext.periodicOrdinaryCast`通过公共Zod模型、编译器和`prepareSourceCastDocument`连接普通控件、计算与JSON。事件保存候选ID、角色、实际命中帧、快照帧、目标；角色增伤和减抗通过共用公式AST执行。菈乌玛A4为`min(初始化EM × 0.004, 0.32)`减去已含份额；减抗使用实际命中历史及天赋向量，不以施放存在代替命中。

单独选中的已发生命中跳过未来完整日程，只验证该击实际资格与状态。伊涅芙A4、哥伦比娅A1是否未生效可以逐击声明；菈乌玛保留初始化EM和本击实际减抗事实。无需为了计算一击声明未来团队事件。未知字段保持阻塞。

显式历史快照每次准备均为权威输入。转换后的事件身份绑定本击事件、局部状态、历史快照、天赋／突破以及菈乌玛初始化EM；删改后不会静默沿用旧时点装备增伤、基伤或抗性。最终面板转换保留可执行角色公式并仅物化已经处理的装备数值，敌方有效抗性覆盖避免再次叠加同一减抗。

菈乌玛长按直接月伤、伊涅芙月感电追击、哥伦比娅引力与月伤、恰斯卡任意多目标／夜魂额外状态不在上述四个条件分支中。实际弹序是显式观测输入，不是自动随机期望。

## 统一批次证据

统一数据命令首轮通过：[generate](../validation/lifecycle-maxhp-data-generate.log)、[check](../validation/lifecycle-maxhp-data-check.log)、[status](../validation/lifecycle-maxhp-data-status.log)，耗时分别4.348秒、4.241秒、3.314秒。实际`.22`为120身份、1157命中模板、636条件完整动作、34部分动作、11阻塞，`teamSimulationReadyFromTheseMappings=0`。整个四组批次新增30个条件完整动作，解决34个旧部分动作及7个男性来源冲突阻塞；本模块占其中4个新动作和7个旧部分动作。

新增核心验收集中在一个文件`packages/sim-core/src/lifecycle-source-batch.test.ts`的四组用例，每组仅一条完整转换／JSON／独立单击链路。[唯一核心聚合](../validation/lifecycle-source-batch.initial.log)4/4首轮通过（Vitest3.08秒、墙钟3.533秒），退出状态已保留。未重复运行旧角色套件或性能检查，不能将来源向量一致当作运行时通过。总批次记录见[生命周期与最大生命扩展](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。
