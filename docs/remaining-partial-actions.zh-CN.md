# `.27` 部分动作索引与历史分组

2026-09-27 当前生成分类为`.27`：124身份、1249命中模板、710条件完整动作、**16部分动作、0分类阻塞**。唯一当前分母来自 `packages/game-data/src/generated/classified-hit-coverage.json`；按角色分布为：

| 角色 | 部分动作数 | 主要未完成边界 | 固定来源／代码入口 |
|---|---:|---|---|
| 卡齐娜 | 4 | `kachina-plunge-collision`、`kachina-skill-riding-single-pulse`、`kachina-skill-independent-single-pulse`、`kachina-burst-initial`；单击组件不等于完整施放／资源生命周期 | `packages/game-data/src/character-mappings/optimizer-kachina-mappings.ts`；Optimizer Kachina sheet、技能参数及公式文件已归档 |
| 奈芙尔 | 1 | 幻戏／特殊状态和资源、减抗事件自动顺序 | `packages/game-data/src/character-mappings/optimizer-skill-mappings.ts`、`packages/sim-core/src/nefer-phantasm-formulas.ts`、`packages/sim-core/src/nefer-phantasm-schedule.ts` |
| 洛恩 | 2 | 资源获取、奇谋普攻／重击循环及自动被动时序 | `packages/game-data/src/character-mappings/optimizer-resource-mappings.ts`；当前未发现 Lohen 专属 `sim-core` handler，固定 Optimizer 原始公式与参数归档在 `packages/game-data/sources/optimizer-missing-components/lohen/` |
| 莉奈娅 | 2 | 露米召唤的资源、形态交替、重置／到期及完整攻击日程 | `packages/game-data/src/character-mappings/optimizer-linnea-mappings.ts`、`packages/sim-core/src/observed-special-component-formulas.ts`；两种月结晶单次特殊组成已有观测组件公式 |
| 桑多涅 | 4 | 解析热量状态、重击／射线日程、星导／星旋替代时序 | `packages/game-data/src/character-mappings/optimizer-special-components.ts`、`packages/sim-core/src/observed-special-component-formulas.ts`；六种单次特殊组成已有观测组件公式 |
| 阿罗夏 | 3 | Q场地刻数、索敌和印记后续自动生命周期及A4输入绑定 | `packages/game-data/src/character-mappings/optimizer-skill-mappings.ts`；固定 Optimizer 原始公式与参数归档在 `packages/game-data/sources/optimizer-missing-components/alyosha/`，尚无专属 `sim-core` handler |

8 个独立观测特殊组成（莉奈娅2、桑多涅6）是单次真实组成的可计算路径，另在生成文件 `standaloneSpecialComponents` 标为 partial。它们既不是缺失的公式，也不增加16动作分母；仍要求真实事件及上下文，不能据此推定完整实体或自动时序。各角色具体 `completeAction:false` 行以分类器映射文件为准，下面旧分组不得当作当前动作清单。

此前日期的实施记录保留为历史，不回填成`.27`现况：

从`.21`的68部分动作，`.22`的12个姿态／封闭后续分支、7个显式实体观察分支、4个普通周期分支、7个男性重击分支，合计30个新条件完整动作替换34个旧部分动作；男性专属独立来源另解除7个旧阻塞。来源审计分别见[姿态](cross-validation/idle-stance-casts-source-audit.md)、[实体](cross-validation/observed-entity-casts-source-audit.md)、[普通周期](cross-validation/periodic-ordinary-casts-source-audit.md)、[男性重击](cross-validation/traveler-male-charged-resolution.md)。这些有限条件不能外推为任意高命座、任意输入或自动队伍完整。

## 历史：`.23`下落碰撞组成分组，6项

- `noelle-plunge-collision` — 诺艾尔
- `kachina-plunge-collision` — 卡齐娜
- `lohen-plunge-collision-base` — 洛恩
- `linnea-plunge-collision-base` — 莉奈娅
- `sandrone-plunge-collision-base` — 桑多涅
- `alyosha-plunge-collision-base` — 阿罗夏

单次碰撞尚不构成完整跳跃／下落生命周期，不能通过重命名计作完整动作。

## 历史：`.23`已接入的接触与标记协议

凯亚Q、胡桃E血梅香及埃洛伊E的4个旧部分组件由3个明确来源协议替换；固定来源近似、真实接触和完整观察仍是必要条件，未升级为自动队伍完整。凯亚13机会不是游戏最大命中数，埃洛伊小弹数量不默认，胡桃重击本体不混入E总伤。见[协议边界](validation/contact-marker-source-protocols.md)和[本批记录](artifact-contact-expansion-20260925.zh-CN.md)。

## 历史：`.23`资源、后续实体与特殊反应组成分组，24项

- `kachina-skill-riding-single-pulse` — 卡齐娜
- `kachina-skill-independent-single-pulse` — 卡齐娜
- `kachina-burst-initial` — 卡齐娜
- `ifa-skill-skilldmg` — 伊法
- `dahlia-burst-burst` — 塔利雅
- `lauma-skill-skillhold1` — 菈乌玛
- `flins-burst-burstinit` — 菲林斯
- `nefer-skill-rush` — 奈芙尔
- `jahoda-burst-burst` — 雅珂达
- `zibai-spirit-steed-ordinary-component` — 兹白
- `zibai-burst-ordinary-component` — 兹白
- `varka-skill-skillinitial` — 法尔伽
- `lohen-skill-etch-resource` — 洛恩
- `linnea-lumi-pummeler-pair` — 莉奈娅
- `nicole-burst-burstinitial` — 尼可
- `prune-skill-skill` — 布伦妮
- `sandrone-charged-sweepdmg-component` — 桑多涅
- `sandrone-charged-beamdmg-component` — 桑多涅
- `sandrone-charged-overdrivedmg-component` — 桑多涅
- `alyosha-burst-field-tick` — 阿罗夏
- `alyosha-burst-tugarin-bite` — 阿罗夏
- `odette-skill-skill` — 奥黛塔
- `odette-skill-codadot` — 奥黛塔
- `odette-burst-direct-four-hits` — 奥黛塔

完整资源消耗、姿态输入、附着／直接月伤及自动追击仍需逐机制落实。敌盾动态最大生命、私有反应规则等全局未完项另见主需求矩阵，不因本动作表数量下降而视为完成。

## 历史基线：`.20`的87项

快照：2026-09-24，分类版本 `.20`，运行时来源注册表直接读取。条目数是部分动作 ID，不是完整角色数。该文件记录下一批实施前的基线；后续注册改变时以生成覆盖为准。

2026-09-25 后续记录：十八个持按／生命周期／有限后续完整条件分支已替换本基线中的十九个部分组件，实际 `.21` 剩余 68 个部分动作。以下 87 项分组保留为实施前历史，不作为当前未完成清单；来源和验收见[本批来源审计](cross-validation/held-finite-casts-source-audit.md)与[增量记录](held-resource-expansion-20260925.zh-CN.md)。

## 普通攻击残段与碰撞（含来源冲突）：15 项

- `aether-anemo-charged-base` — 空
- `aether-geo-charged-base` — 空
- `aether-electro-charged-base` — 空
- `aether-dendro-charged-base` — 空
- `aether-hydro-charged-base` — 空
- `aether-pyro-charged-base` — 空
- `aether-cryo-charged-base` — 空
- `noelle-charged-cycle` — 诺艾尔
- `noelle-charged-finisher` — 诺艾尔
- `noelle-plunge-collision` — 诺艾尔
- `kachina-plunge-collision` — 卡齐娜
- `lohen-plunge-collision-base` — 洛恩
- `linnea-plunge-collision-base` — 莉奈娅
- `sandrone-plunge-collision-base` — 桑多涅
- `alyosha-plunge-collision-base` — 阿罗夏

## 旅行者持按与完整生命周期：12 项

- `aether-dendro-burst-pyro-transformed-explosion` — 空
- `aether-hydro-skill-dewdrop-no-suffusion` — 空
- `aether-hydro-burst-tick` — 空
- `aether-pyro-skill-hold-initial` — 空
- `aether-pyro-skill-blazing-tick` — 空
- `aether-pyro-skill-scorching-trigger` — 空
- `lumine-dendro-burst-pyro-transformed-explosion` — 荧
- `lumine-hydro-skill-dewdrop-no-suffusion` — 荧
- `lumine-hydro-burst-tick` — 荧
- `lumine-pyro-skill-hold-initial` — 荧
- `lumine-pyro-skill-blazing-tick` — 荧
- `lumine-pyro-skill-scorching-trigger` — 荧

## 姿态、重施与后续动作：15 项

- `razor-burst-burstdmg` — 雷泽
- `zhongli-skill-skillhold` — 钟离
- `tartaglia-skill` — 达达利亚
- `keqing-skill` — 刻晴
- `yanfei-burst-burst` — 烟绯
- `ayato-skill` — 神里绫人
- `nilou-skill` — 妮露
- `cyno-skill-skillb` — 赛诺
- `wanderer-skill` — 流浪者
- `faruzan-skill` — 珐露珊
- `alhaitham-skill-rushatk` — 艾尔海森
- `mika-skill-skillhold` — 米卡
- `kaveh-burst-burst` — 卡维
- `gaming-burst-burst` — 嘉明
- `chiori-skill-thrustatkscaling` — 千织

## 持续实体与接触事件：14 项

- `kaeya-burst-burst` — 凯亚
- `klee-burst-burst` — 可莉
- `xinyan-skill` — 辛焱
- `hutao-skill-bb` — 胡桃
- `aloy-skill-skillmain` — 埃洛伊
- `aloy-skill-skillbomblets` — 埃洛伊
- `ayato-burst-burst` — 神里绫人
- `layla-skill` — 莱依拉
- `faruzan-burst-burst` — 珐露珊
- `yaoyao-burst-burstdmg` — 瑶瑶
- `furina-skill-skillousiabubble` — 芙宁娜
- `emilie-skill-skilldmg` — 艾梅莉埃
- `emilie-skill-skillarke` — 艾梅莉埃
- `emilie-burst-burstdmg` — 艾梅莉埃

## 后续版本资源、实体与特殊反应组成：31 项

- `kachina-skill-riding-single-pulse` — 卡齐娜
- `kachina-skill-independent-single-pulse` — 卡齐娜
- `kachina-burst-initial` — 卡齐娜
- `chasca-burst-burstgalesplitting` — 恰斯卡
- `ifa-skill-skilldmg` — 伊法
- `dahlia-burst-burst` — 塔利雅
- `ineffa-skill-skillinitial` — 伊涅芙
- `ineffa-skill-skilldot` — 伊涅芙
- `lauma-skill-skillpress` — 菈乌玛
- `lauma-skill-skillhold1` — 菈乌玛
- `lauma-skill-frostgrovesanctuaryatk` — 菈乌玛
- `flins-burst-burstinit` — 菲林斯
- `nefer-skill-rush` — 奈芙尔
- `jahoda-burst-burst` — 雅珂达
- `columbina-skill` — 哥伦比娅
- `columbina-skill-skilldot` — 哥伦比娅
- `zibai-spirit-steed-ordinary-component` — 兹白
- `zibai-burst-ordinary-component` — 兹白
- `varka-skill-skillinitial` — 法尔伽
- `lohen-skill-etch-resource` — 洛恩
- `linnea-lumi-pummeler-pair` — 莉奈娅
- `nicole-burst-burstinitial` — 尼可
- `prune-skill-skill` — 布伦妮
- `sandrone-charged-sweepdmg-component` — 桑多涅
- `sandrone-charged-beamdmg-component` — 桑多涅
- `sandrone-charged-overdrivedmg-component` — 桑多涅
- `alyosha-burst-field-tick` — 阿罗夏
- `alyosha-burst-tugarin-bite` — 阿罗夏
- `odette-skill-skill` — 奥黛塔
- `odette-skill-codadot` — 奥黛塔
- `odette-burst-direct-four-hits` — 奥黛塔

## 历史选定批次：`.21`持按与有限后续

本批选定旅行者 12 个部分动作对应的 10 个持按/生命周期完整分支、诺艾尔两条重击组成对应的一个完整持按动作，以及刻晴、珐露珊、辛焱、赛诺五个旧部分动作对应的七个有限后续分支，合计 19 个旧部分组件对应 18 个新条件完整分支。使用明确持按长度、生命周期、实际接触/触发事件、完整观察与逐击状态，不以持续时间除以周期猜命中数。

当时空的七种元素重击第二段存在来源与活动目录系数不一致，保留来源冲突阻塞。`.22`已用独立固定男性来源精确核准并引入专属数值解析器；共享女性目录值保持原样，没有放宽容差或借用荧的数据。单次下落碰撞仍不能通过改标签获得完整一次施放地位；胡桃血梅香已于`.23`另建实际标记寿命协议，未仅重命名旧单击。
