五把武器额外伤害：固定 Optimizer 来源核对

核对版本为 `frzyc/genshin-optimizer@180a0a1015cb725c7570cd828eb086749960df98`。本次仅完成来源阅读、原文归档和字段比对；没有修改计算器实现，也没有运行应用、外部模拟器、构建或测试套件。

归档见 [manifest.json](/Users/evan/Documents/gidps/packages/game-data/sources/weapon-proc-five-optimizer/manifest.json)：15 份原文逐一通过 SHA-256 与固定树的 Git blob SHA-1 校验。10 份武器 sheet / 中文描述本次通过 HTTPS 取得，另 5 份公共公式、身份映射和 LICENSE 从此前同版本本地归档复制；manifest 分别记录取得方式，未把本地复制写成新 HTTP 请求。固定树完整、`truncated=false`。

所有序列均按 R1 → R5 排列；伤害系数单位为攻击力倍率，概率为描述中的触发概率，CD 单位为秒。

| 武器 / ID | 通常伤害系数 | 冰影响替换系数 | 概率（描述） | CD |
|---|---|---|---|---|
| 吃虎鱼刀 / 11305 | 2.4 / 2.8 / 3.2 / 3.6 / 4 | 无此分支 | 50% / 50% / 50% / 50% / 50% | 15 / 14 / 13 / 12 / 11 |
| 试作古华 / 12406 | 2.4 / 3 / 3.6 / 4.2 / 4.8 | 无此分支 | 50% / 50% / 50% / 50% / 50% | 15 / 15 / 15 / 15 / 15 |
| 雪葬的星银 / 12411 | 0.8 / 0.95 / 1.1 / 1.25 / 1.4 | 2 / 2.4 / 2.8 / 3.2 / 3.6 | 60% / 70% / 80% / 90% / 100% | 10 / 10 / 10 / 10 / 10 |
| 龙脊长枪 / 13409 | 0.8 / 0.95 / 1.1 / 1.25 / 1.4 | 2 / 2.4 / 2.8 / 3.2 / 3.6 | 60% / 70% / 80% / 90% / 100% | 10 / 10 / 10 / 10 / 10 |
| 忍冬之果 / 14412 | 0.8 / 0.95 / 1.1 / 1.25 / 1.4 | 2 / 2.4 / 2.8 / 3.2 / 3.6 | 60% / 70% / 80% / 90% / 100% | 10 / 10 / 10 / 10 / 10 |

40 个伤害系数在生产 sheet 与固定版本中文描述之间完全一致，最大差 0。吃虎鱼刀的 5 个 CD 值也可在 sheet 与描述之间直接比对，最大差 0。其余 20 个 CD 值和全部 25 个概率值仅由对应中文描述支持，不能算作生产调度实现的交叉验证。

逐武器证据：

- **吃虎鱼刀**：[`libs/gi/sheets/src/Weapons/Sword/FilletBlade/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Sword/FilletBlade/index.tsx#L18)；系数 L18；攻击力取值 L26；物理分类 L30；CD数组及显示 L19 / L48。概率、触发类型及冷却描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_FilletBlade_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_FilletBlade_gen.json#L8)。

- **试作古华**：[`libs/gi/sheets/src/Weapons/Claymore/PrototypeArchaic/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Claymore/PrototypeArchaic/index.tsx#L18)；系数 L18；攻击力取值 L25；物理分类 L29。概率、触发类型及冷却描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_PrototypeArchaic_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_PrototypeArchaic_gen.json#L8)。

- **雪葬的星银**：[`libs/gi/sheets/src/Weapons/Claymore/SnowTombedStarsilver/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Claymore/SnowTombedStarsilver/index.tsx#L18)；系数 L18；冰条件系数 L19；攻击力取值 L26 / L40；物理分类 L30 / L44。概率、触发类型及冷却描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_SnowTombedStarsilver_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_SnowTombedStarsilver_gen.json#L8)。

- **龙脊长枪**：[`libs/gi/sheets/src/Weapons/Polearm/DragonspineSpear/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Polearm/DragonspineSpear/index.tsx#L18)；系数 L18；冰条件系数 L19；攻击力取值 L26 / L40；物理分类 L30 / L44。概率、触发类型及冷却描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_DragonspineSpear_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_DragonspineSpear_gen.json#L8)。

- **忍冬之果**：[`libs/gi/sheets/src/Weapons/Catalyst/Frostbearer/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/Frostbearer/index.tsx#L19)；系数 L19；冰条件系数 L20；攻击力取值 L27 / L41；物理分类 L31 / L45。概率、触发类型及冷却描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_Frostbearer_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_Frostbearer_gen.json#L8)。

五个 ID 均与固定版本 [`WeaponExcelConfigData_idmap_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm/src/dm/weapon/WeaponExcelConfigData_idmap_gen.json) 和 [`mapping/weapon.ts`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm/src/mapping/weapon.ts) 一致。吃虎鱼刀的描述为攻击命中后，对单体触发；试作古华为普攻或重击命中后的小范围伤害；三把霜葬武器为普攻或重击命中后产生坠落晶核。原文中的 `<cryo>` 是数值着色标记，不能据此把被动伤害认作冰伤。

五把生产 sheet 都显式传入 `hit.ele = physical`，动作分类传入 `elemental`；该分类并非触发它的普攻或重击分类，也不表示冰元素伤害。公共 [`customDmgNode`（L113–138）](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx#L113) 进入 `input.hit.dmg`；公共 [`formula.ts`（L431–450）](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts#L431) 使用普通伤害、防御、相应抗性与暴击路径：非暴击乘数 1，暴击乘数 `1+CRIT_DMG`，期望乘数 `1+clamp(CRIT_RATE,0,1)×CRIT_DMG`。单次已经触发的伤害不应再乘触发概率；上述 sheets 也没有将概率乘进伤害节点。

需要保留的实现边界：

- **攻击力层不同**：吃虎鱼刀与试作古华使用 `input.premod.atk`；三把霜葬使用 `input.total.atk`。公共 [`formula.ts`（L339–344）](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts#L339) 默认将 total 对应项读为 premod，所以基础场景可相等；此静态核对没有证明带任意后处理、转化或特殊增益时两者等价，也没有运行数值冲突案例。不得将此发现误写为已测出的游戏差异。

- **冰条件为替换分支**：三个霜葬 sheet 各自暴露 `dmgAoe` 与 `dmgOnCryoOp` 两个数值，未读取敌人 aura 来自动判定。高系数不能与普通系数相加；冰附着是否在晶核落地时仍成立、冻结等边界均未由这些 sheets 验证。

- **概率和 CD 不等于轮转机制**：全部概率只见描述；吃虎鱼刀的 CD 数组用于字段显示，五个 sheet 均无 RNG / CD 调度。没有验证随机抽样、触发后冷却起点、晶核下落延迟、范围目标数量、脱手触发、未命中或 snapshot 时点。

- **可信度仍为 provisional**：固定来源的一致性不是独立游戏测量。没有使用空 `refinementBonus` 或 TODO 公式桩填补机制，也没有宣称已通过本地计算核心或完整队伍模拟验证。

原文路径及 Git blob 校验清单（所有条目 `matchesPinnedTree=true`；完整 SHA-256、URL、取得方式和归档时间保存在 manifest）：

| 固定版本原文路径 | Git blob SHA-1 |
|---|---|
| `LICENSE` | `ccc6a6c559f48acd605c121885cd8c37a01aaf42` |
| `libs/gi/sheets/src/Characters/dataUtil.tsx` | `736a1229592f4afead151920884dbccd5c5e22cb` |
| `libs/gi/wr/src/formula.ts` | `7a066de7a030ed2dd05b5184703bb955f6331961` |
| `libs/gi/dm/src/mapping/weapon.ts` | `33edfa77556a7bb7dc1ef771f1194a57df306df5` |
| `libs/gi/dm/src/dm/weapon/WeaponExcelConfigData_idmap_gen.json` | `e11e04044b2b4e50ca7a798c6384dccf47bd373c` |
| `libs/gi/sheets/src/Weapons/Sword/FilletBlade/index.tsx` | `480c8f6e5fb015432898b041ed5d07ded4324d2c` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_FilletBlade_gen.json` | `0dc6fd3755618aef71adfe1ac4cf374a186c6889` |
| `libs/gi/sheets/src/Weapons/Claymore/PrototypeArchaic/index.tsx` | `2e2475d824e05ce290a0b894d85854916ad86dee` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_PrototypeArchaic_gen.json` | `2edb991e4dbd3422bf559035f0129e9c2684ff37` |
| `libs/gi/sheets/src/Weapons/Claymore/SnowTombedStarsilver/index.tsx` | `1666b5c89a23569100bbabd0e4f57c07825a0270` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_SnowTombedStarsilver_gen.json` | `8141b7a12cac536ebdfa447f0f9356b0884a5eb4` |
| `libs/gi/sheets/src/Weapons/Polearm/DragonspineSpear/index.tsx` | `b22c8f6b1404276fb59d1e72e540fe5389dee7eb` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_DragonspineSpear_gen.json` | `9b8766fbbc5763a65db85cb0610bc9e2d3bdd0d7` |
| `libs/gi/sheets/src/Weapons/Catalyst/Frostbearer/index.tsx` | `8248f0a896fd09128bb1df1ab3e7d367c9ceb798` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_Frostbearer_gen.json` | `2a3ce4f0b94b4f3f2d0e2e0956cdd3ab9f4821a5` |
