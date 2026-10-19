# 圣遗物一件套与缺失两件套来源审计

本轮为只读机制审计：仅新增本文和 `packages/game-data/sources/artifact-piece-effects/` 证据档案，没有修改生产规则、核心、schema、UI、覆盖统计，也没有运行测试。后续实现应单独验证，不把这份审计视为功能交付。

本轮开始时，活动7.1目录快照为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，共63套：4套仅一件套、59套有两件套。对照当时 `artifactTwoPieceRules` 的50个命名映射，准确缺少**4个一件套、9个两件套**。原始清点记录在 `initial-missing-piece-inventory.json`；这个分母不是旧版本的57套。后续其他代理加入规则时，本节仍表示审计开始时的基线。

## 完整缺项清单与作用对象

“来源属性”列采用实际 GO/gcsim 源码标识，不自行发明 `FIGHT_PROP_*` 映射。作用对象均须在生产合约中保留。

| ID / 套装 | 件数与活动目录原文 | 实际来源属性和作用对象 | 推荐控制与限制 |
| --- | --- | --- | --- |
| 15009 祭火之人 | 1：受到的火元素附着效果的持续时间减少40%。 | 装备者自身受到的火附着持续时间；GO无可执行节点，gcsim无实现 | 合法冠位自动激活；需专用自身附着减时属性。不得替代火抗或敌人附着量 |
| 15010 祭水之人 | 1：受到的水元素附着效果的持续时间减少40%。 | 同上，水元素 | 同上 |
| 15011 祭雷之人 | 1：受到的雷元素附着效果的持续时间减少40%。 | 同上，雷元素 | 同上 |
| 15013 祭冰之人 | 1：受到的冰元素附着效果的持续时间减少40%。 | 同上，冰元素 | 同上 |
| 10004 奇迹 | 2：所有元素抗性提高20%。 | GO自身 `premod.${ele}_res_ = 0.2`，七元素，不含物理 | 无状态控件；仅需合法件数。不得写到敌人RES、普通增伤或全队抗性 |
| 10013 游医 | 2：角色受到的治疗效果提高20%。 | GO自身 `premod.incHeal_ = 0.2`，受治疗加成 | 无状态控件；接收治疗者属性，不能替代施治者的治疗加成 |
| 14002 平息鸣雷的尊者 | 2：雷元素抗性提高40%。 | GO自身 `premod.electro_res_ = 0.4` | 无状态控件；不降低敌人雷抗 |
| 14003 渡过烈火的贤人 | 2：火元素抗性提高40%。 | GO自身 `premod.pyro_res_ = 0.4` | 无状态控件；不降低敌人火抗 |
| 15015 逆飞的流星 | 2：护盾强效提高35%。 | GO自身 `premod.shield_ = 0.35` | 件数激活的自身属性；无需“当前有盾”开关才记录属性。不应提高所有角色的盾量或误作伤害加成 |
| 15037 烬城勇者绘卷 | 2：队伍中附近的角色触发「夜魂迸发」时，装备者恢复6点元素能量。 | gcsim `OnNightsoulBurst` → 装备者 `AddEnergy("scroll-2pc", 6)` | 是事件，不是静态数值或充能效率；须有合法触发、接收角色、触发时能量及上限 |
| 15038 黑曜秘典 | 2：装备者处于夜魂加持状态，并且在场上时，造成的伤害提高15%。 | gcsim自身 `DmgP = 0.15`，两个条件同时成立 | 明确夜魂加持状态与前台状态；普通伤害加成、不限攻击标签/伤害元素；不属于剧变反应加成 |
| 15047 血红之证 | 2：攻击力提高18%。 | GO自身 `premod.atk_ = 0.18` | 可复用已有百分比攻击类型，无新增条件 |
| 15048 炉火融炼之心 | 2：攻击力提高18%。 | GO自身 `premod.atk_ = 0.18` | 同上 |

四祭冠的活动目录 `slots` **只有circlet**，允许稀有度为3、4；没有花、羽、沙、杯，也不能以五星冠制造两件套。游医为1–3星，奇迹为3–4星，以上其他缺项为4–5星。所有件数仍须来自真实、互不重复的装备槽。

## 来源可信范围与实现建议

可以复用当前输出公式合约的明确候选是血红、炉火两件套的18%攻击，以及黑曜两件套的条件15%普通增伤。后两套的两件数值在活动目录与固定GO sheets完全一致；黑曜的条件和数值在目录与固定gcsim完全一致。它们仍是社区来源交叉审阅，不升级为全面游戏内验证。

黑曜宜显式区分 `nightsoulBlessingActive` 和已有 `offField`：只有夜魂加持有效且不是后台才加15%。前者为新的建议合约字段，本文未增加schema。若用组合开关，也必须在标签上包含两个条件；不能将它与未来四件套的6秒暴击窗口共用。源码将15%放在 `StatMod` 而非逐目标 `AttackMod`；如果扩展到会快照面板的角色技能，应继续遵循该技能自身已核验的快照规则，而非无条件改变所有在途攻击。缺少必要条件应拒绝应用，不能默认为false。

奇迹、游医、渡火、平雷、逆飞的数值可登记为专用**非输出属性**，但只有相应受击、受治疗、护盾结算实际消费这些属性时，才能称其机制已执行。无下游消费者时必须明确显示“已记录属性，相关防御/治疗流程未执行”。不能用“对伤害没有影响”掩盖完全未建模。

四祭冠目前只有目录文本证据，GO旧sheets只有一件套展示项与空 `fields`；固定gcsim根本没有这些套装。可以审慎保存元素对应的40%自身附着减时条款，但叠加方式、状态结算位置、特殊附着与具体持续时间变化尚无本次参考实现证据。不能仅凭词义声称已实现附着时序，也不能把40%登记为元素抗性。

烬城的6点为固定能量恢复；固定gcsim `AddEnergy`直接相加后限制到 `[0, EnergyMax]`，不会乘元素充能效率，也没有后台粒子折扣。其两件套回调没有额外的前台或夜魂加持要求；触发条件是队伍合法夜魂迸发事件。装备者满能量时实际恢复量可为0，应保留“请求恢复6、实际恢复量、溢出量”的区别。不能从一个持续窗口布尔值反复领取能量，也不能仅用总次数证明事件时序和爆发可用性。[烬城固定实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/scrolloftheheroofcindercity/scrolloftheheroofcindercity.go)、[固定能量与粒子接收的区别](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/energy.go)

## 不应照抄的参考实现细节

固定gcsim的完整Git tree含4,779项、`truncated=false`；四祭冠、奇迹、游医、血红、炉火不在对应实现、artifact catalog或simulation imports中。渡火、平雷的两件套源码明确记录未实现，只有四件套条件增伤实现。故这两项自身抗性以GO sheets作为交叉来源，不能把gcsim的存在当作两件套验证。

逆飞两件套的gcsim代码向**全局**shield handler注册0.35，缺少装备者过滤。该回调返回 `(0.35, false)` 中的false意味着保留modifier，不是效果无效。不要因此将护盾强效错误赋给全队。GO sheets在自身 `premod.shield_` 登记0.35，与装备者属性的作用对象一致。逆飞四件套另有 `CharacterIsShielded(装备者, 当前前台)` 判定：全队共享盾仅保护当前前台，定向盾仅保护指定角色；“队伍存在盾”不等于“当前攻击者被盾保护”。四件套不是本轮新增实现范围。[逆飞固定源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts/bolide/bolide.go)

GO奇迹四件套UI虽有 `teamBuff: true`，实际数据只有自身 `premod`，没有团队数据。作用对象必须以实际数据结构与原文核对，不据UI标记给全队抗性。游医四件套的GO节点只是展示 `0.2 × input.total.hp` 的恢复量，没有本轮可采纳的施治/受治疗乘区或触发调度；不要顺带标记游医四件套完整。

GO同一固定提交的 `libs/gi/formula/src/data/artifact/*.ts` 仍含TODO占位模板，本次11套对应文件均如此。它们甚至给一件套祭冠生成假的两件 `atk_ +1` 与四件团队 `atk_ +1`；绝不能作为机制证据。归档仅保留 `PrayersForDestiny.ts` 代表并标记 `rejected-placeholder-template`。其原始SHA不同于其余套装，11份只能在替换套装key后得到相同模板；本文不把归一化hash冒充原文件hash。可信的实际属性来源是以下 `libs/gi/sheets/src/Artifacts/<Key>/index.tsx`。

## 7.1目录中的新四件套条款

活动目录的血红、炉火 `releasePatch` 字段均为7.0；本文没有重新认证其上线日期。两者两件套可独立审核，不依赖四件套是否完成。

血红四件套原文：装备者触发星扩散反应后的10秒内，暴击率提升16%，星扩散反应伤害提升40%。GO使用条件 `4Ss`，自身 `critRate_ +0.16`、`stellarswirl_dmg_ +0.4`，只展示10秒，没有自动触发计时。

炉火四件套原文：装备者触发星烁反应或造成星烁反应伤害后的12秒内，攻击力提升12%，队伍中附近的所有角色造成的星烁反应伤害提升50%。装备者处于后台时也能触发上述效果。同名圣遗物套装产生的伤害加成效果无法叠加。GO以条件 `4Stellar` 给自身 `atk_ +0.12`，并给团队 `stellarswirl_dmg_`、`stellarconduct_dmg_` 各0.5，以 `heartofthefurnace` 非叠加键处理。`allStellarReactionKeys`只有这两个键，不是所有月反应、普通扩散或所有伤害。固定gcsim没有两套的对应实现；本次没有验证星反应完整公式、触发、所有权、计时或团队去重，不建议将四件条款改写成普通增伤后计入覆盖。[血红GO sheets](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts/ScarletProof/index.tsx)、[炉火GO sheets](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts/HeartOfTheFurnace/index.tsx)

## 固定来源与原始哈希

来源锁定如下，三仓库MIT许可证及版权原文均随证据保留：

- [genshin-db 49a6544](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf)：13套原始中文JSON与活动目录的相应条款逐一完全一致。
- [gcsim b4ae769](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541)：固定实现、角色能量、盾handler、套装清单与imports。
- [genshin-optimizer 180a0a1](https://github.com/frzyc/genshin-optimizer/tree/180a0a1015cb725c7570cd828eb086749960df98)：固定sheets与类型定义，排除新formula占位模板。

`packages/game-data/sources/artifact-piece-effects/manifest.json`包含43个原始来源文件，合计154,354字节；每项包含完整固定页面URL、raw URL、SHA-256、字节数与证据用途。下表便于实现者定位主要文件，全部辅助文件及13份目录JSON的完整hash见manifest。

| 来源路径 | 原始SHA-256 |
| --- | --- |
| gcsim: `internal/artifacts/bolide/bolide.go` | `b8f7fc3aea507f0afc67d39e6a8d5920c04749e48c2cadd781a1f963c3d875df` |
| gcsim: `internal/artifacts/lavawalker/lavawalker.go` | `9e2a5a5d6ca4b782ea5aa167eba1ebf6de882508654850046804a3c8a894dff8` |
| gcsim: `internal/artifacts/thundersoother/thundersoother.go` | `2c00825d2536a415085b6f815aba1c9d9a37f4670ba47d09cef3455d65b9be7b` |
| gcsim: `internal/artifacts/obsidiancodex/obsidiancodex.go` | `ec2e882c77448f1ab0c86c58304cd786d8f8c68c009be9415133d98a19d7c779` |
| gcsim: `internal/artifacts/scrolloftheheroofcindercity/scrolloftheheroofcindercity.go` | `16774e7726f5270f4598ef17739225aef3a2310bda84cabdbd03a7f5abfef0cc` |
| optimizer: `libs/gi/sheets/src/Artifacts/PrayersForIllumination/index.tsx` | `fde70a071e519db670de56520996a1f80b68a178949e2fe002068580ca8c2ef8` |
| optimizer: `libs/gi/sheets/src/Artifacts/PrayersForDestiny/index.tsx` | `898a3ef945eebddd0bf03eada5fb2a1cb136c7faed89f279f7a01143ed2c19d4` |
| optimizer: `libs/gi/sheets/src/Artifacts/PrayersForWisdom/index.tsx` | `e74044f8ae4b2c1d576f54590b8e4b8f5c313847b472d00acd078d1cf0f6dd75` |
| optimizer: `libs/gi/sheets/src/Artifacts/PrayersToSpringtime/index.tsx` | `014c31f9279f95ace4783af0715dbdab02bd9006d71122bb87388bf521f4c1a4` |
| optimizer: `libs/gi/sheets/src/Artifacts/TinyMiracle/index.tsx` | `d06497d57d08ec74b650cad6472e8812ac344623e6c421b6b44dddc47290c28d` |
| optimizer: `libs/gi/sheets/src/Artifacts/TravelingDoctor/index.tsx` | `71c25d9ebf94876dc713634311e41f5355cf937bd3fd0a7382ac6cf5e63649b3` |
| optimizer: `libs/gi/sheets/src/Artifacts/Lavawalker/index.tsx` | `817704ea6e5fd8e9a137a964efb4e85b7750d67d8b1ec0bf9b172d99d055c169` |
| optimizer: `libs/gi/sheets/src/Artifacts/Thundersoother/index.tsx` | `78aa98aee5acfff12fdeb55183f9344679bb71230ada7e57076f5a76f7f5cdb2` |
| optimizer: `libs/gi/sheets/src/Artifacts/RetracingBolide/index.tsx` | `5a06db00dec76c7387f5f7d6423104b7ae6ac0a019c5c0c6b999025602da4d17` |
| optimizer: `libs/gi/sheets/src/Artifacts/ScarletProof/index.tsx` | `ab66bfad832e80e0192d9ca998f7aab4998112e4463f17c248f3384c96e06424` |
| optimizer: `libs/gi/sheets/src/Artifacts/HeartOfTheFurnace/index.tsx` | `a61c1c61e3362523c57479e85a1a2b65de8476b6ef56518ec852b138ec12e746` |

本轮没有执行任何测试，也没有改写生产文件或全局覆盖数字。来源文件下载、原字节hash和目录条款比对属于证据采集，不是运行时验证。
