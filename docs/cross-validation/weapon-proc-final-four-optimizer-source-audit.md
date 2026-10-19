信使、水仙十字之剑、昭心、苍翠猎弓：固定来源核对

固定版本：Optimizer `180a0a1015cb725c7570cd828eb086749960df98`；genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`；仅用于昭心分歧核对的 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。本报告为来源审查，没有改变生产实现、运行构建、测试套件、外部模拟器或上游应用。

四把武器的 20 个 R1–5 系数在 Optimizer 生产 sheet、同版本中文描述和 genshin-db 之间完全一致，最大差 0；20 条去除着色标记后的描述文本也完全一致。这个结果只覆盖系数和文字：信使的必暴与水仙的始基力资格没有在 sheet 中落实，苍翠是单 tick，昭心的固定 gcsim 倍率另有五项冲突。

[manifest.json](/Users/evan/Documents/gidps/packages/game-data/sources/weapon-proc-final-four-optimizer/manifest.json) 记录 20 份真实原文、SHA-256、Git blob SHA-1、来源版本和取得方式。13 份来自 Optimizer（8 份新 HTTPS，5 份复用同版本归档），5 份来自固定 genshin-db 本地源码，2 份来自固定 gcsim 本地源码。全部 blob 匹配各自固定 Git tree。genshin-db 的递归树标记 truncated=true，但本次四个武器文件与 LICENSE 均有明确条目并逐一匹配；未对树中省略的路径作声明。Optimizer 与 gcsim 的树未截断。没有把本地复制记录成新 HTTP 下载。

| 武器 / ID | R1 → R5 ATK 倍率 | 生产 sheet 取值 | 静态节点范围 |
|---|---|---|---|
| 信使 / 15305 | 1 / 1.25 / 1.5 / 1.75 / 2 | `input.total.atk` | 一次额外伤害；未强制暴击 |
| 水仙十字之剑 / 11428 | 1.6 / 2 / 2.4 / 2.8 / 3.2 | `input.total.atk` | 一次能量冲击；资格 gate 未实现 |
| 昭心 / 14409 | 2.4 / 2.7 / 3 / 3.3 / 3.6 | `input.premod.atk` | 一次法球命中；不是弹射总和 |
| 苍翠猎弓 / 15409 | 0.4 / 0.5 / 0.6 / 0.7 / 0.8 | `input.total.atk` | 一次风之眼 tick；不是完整持续总和 |

逐武器真实源码与边界：

- **信使**：[`libs/gi/sheets/src/Weapons/Bow/Messenger/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Bow/Messenger/index.tsx#L18)，倍率 L18，攻击力 L23，物理属性 L25；[Optimizer 中文描述](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_Messenger_gen.json#L8)；[genshin-db 原文](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/messenger.json)。

- **水仙十字之剑**：[`libs/gi/sheets/src/Weapons/Sword/SwordOfNarzissenkreuz/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Sword/SwordOfNarzissenkreuz/index.tsx#L18)，倍率 L18，攻击力 L26，物理属性 L30；[Optimizer 中文描述](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_SwordOfNarzissenkreuz_gen.json#L8)；[genshin-db 原文](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/swordofnarzissenkreuz.json)。

- **昭心**：[`libs/gi/sheets/src/Weapons/Catalyst/EyeOfPerception/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/EyeOfPerception/index.tsx#L18)，倍率 L18，攻击力 L25，物理属性 L29；[Optimizer 中文描述](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_EyeOfPerception_gen.json#L8)；[genshin-db 原文](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/eyeofperception.json)。

- **苍翠猎弓**：[`libs/gi/sheets/src/Weapons/Bow/TheViridescentHunt/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Bow/TheViridescentHunt/index.tsx#L18)，倍率 L18，攻击力 L23，物理属性 L25；[Optimizer 中文描述](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_TheViridescentHunt_gen.json#L8)；[genshin-db 原文](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/theviridescenthunt.json)。

**信使。** 两份描述均要求重击命中要害，额外伤害必定暴击，触发冷却 10 秒。生产 sheet 没有要害判定、`hitMode` 覆盖或暴击率覆盖，只通过公共 `customDmgNode` 使用一般非暴击 / 暴击 / 期望模式。因此该 sheet 可比对倍率和物理类别，不能证明已自动执行“必定暴击”。计算一次已触发的信使被动时，应由完整上下文明确实际要害命中及强制暴击；普通平均暴击计算不能代替这条规则。

**水仙十字之剑。** 两份描述均要求装备者不具备始基力，由普攻、重击或下落攻击命中触发；冷却 12 秒，芒性 / 荒性由武器当前属性决定。生产 sheet 虽包含真实倍率和 physical 设置，但明写 [`TODO: Don't show dmg value when wielder has an Arkhe`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Sword/SwordOfNarzissenkreuz/index.tsx#L19)，未落实资格判定。数值冲击和芒荒机制应分别描述：这里没有证明角色资格判定、武器属性切换、始基力交互或敌人状态效果已完成；也不能据冲击带芒荒属性，把数值伤害改成任一七元素。

**昭心。** 生产 sheet 与两份描述均支持 2.4 / 2.7 / 3 / 3.3 / 3.6 × ATK；描述另给普攻或重击命中后 50% 概率、12 / 11 / 10 / 9 / 8 秒冷却、至多在敌人间弹射 4 次。sheet 不实现概率、弹射路线、目标数量或总命中数。该节点只是一发命中，不能默认乘 4 或 5 得到任意场景的完整伤害。

昭心的固定 [gcsim 原函数 L63](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/perception/perception.go#L63) 写作 `dmg := 2.1 * float64(r) * 0.3`，直接计算为 0.63 / 1.26 / 1.89 / 2.52 / 3.15；相对上述一致来源，差为 −1.77 / −1.44 / −1.11 / −0.78 / −0.45，五档均冲突，最大绝对倍率差 1.77。原函数 CD 与描述一致，但本次阅读的 `OnEnemyDamage` 处理器没有显式 50% 随机门槛。保留原文及分歧，不能把整个 gcsim 函数作为这把武器的数值或概率 oracle。没有执行其运行时或实机测量。

**苍翠猎弓。** sheet 只给每 tick 的 0.4 / 0.5 / 0.6 / 0.7 / 0.8 × ATK。两份描述给普攻或重击命中后 50% 概率、每 0.5 秒一段、持续 4 秒、14 / 13 / 12 / 11 / 10 秒触发冷却。sheet 没有循环、初次伤害时刻、终点是否含伤害或目标留在范围内的判定；不能仅由该节点或 `4 ÷ 0.5` 宣称 8 段完整动作已经验证。若其他真实时序来源支持 8 段，应独立记录其时间点与命中条件。吸引效果和范围目标数同样不在这个数值节点中。

四个 sheet 均显式 physical，动作 move 均为 `elemental`，并未继承触发它们的普攻、重击、下落或战技类别增伤。公共 [`customDmgNode` L113–138](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx#L113) 接入 [`formula.ts` L431–450](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts#L431) 的普通伤害、防御、抗性和暴击路径；信使的强制暴击是上述已列出的缺失条件。昭心使用 premod.atk，其他三把使用 total.atk；虽然公共公式默认 total 对应项读取 premod，任意后处理或属性转化条件下的等价性未由本次审查证明。

可信度保持 provisional。没有将系数一致扩展为时序、强制暴击、始基力、弹射或完整持续动作已完成；没有使用空 refinementBonus 或 TODO 桩补齐缺失机制。三方系数一致也不是独立游戏测量。

完整归档清单（每个条目均匹配对应版本 Git blob；SHA-256 见 manifest）：

| 来源 | 上游路径 | Git blob SHA-1 |
|---|---|---|
| optimizer | `LICENSE` | `ccc6a6c559f48acd605c121885cd8c37a01aaf42` |
| optimizer | `libs/gi/sheets/src/Characters/dataUtil.tsx` | `736a1229592f4afead151920884dbccd5c5e22cb` |
| optimizer | `libs/gi/wr/src/formula.ts` | `7a066de7a030ed2dd05b5184703bb955f6331961` |
| optimizer | `libs/gi/dm/src/mapping/weapon.ts` | `33edfa77556a7bb7dc1ef771f1194a57df306df5` |
| optimizer | `libs/gi/dm/src/dm/weapon/WeaponExcelConfigData_idmap_gen.json` | `e11e04044b2b4e50ca7a798c6384dccf47bd373c` |
| optimizer | `libs/gi/sheets/src/Weapons/Bow/Messenger/index.tsx` | `8e63e7522911e5791cfa9cfb33217d2351354e10` |
| optimizer | `libs/gi/dm-localization/assets/locales/chs/weapon_Messenger_gen.json` | `daa624758e2791e5f300d6006eb65169a01695fb` |
| optimizer | `libs/gi/sheets/src/Weapons/Sword/SwordOfNarzissenkreuz/index.tsx` | `f248ac534b6b284c36c7b12c45b298146e14ffdb` |
| optimizer | `libs/gi/dm-localization/assets/locales/chs/weapon_SwordOfNarzissenkreuz_gen.json` | `efe5f7f3611844de798ee9339b205d1c451a92bb` |
| optimizer | `libs/gi/sheets/src/Weapons/Catalyst/EyeOfPerception/index.tsx` | `7841af9818b64044e1f19da5c250dec9636fae4b` |
| optimizer | `libs/gi/dm-localization/assets/locales/chs/weapon_EyeOfPerception_gen.json` | `b78a6abda8fa1ec0be57c5a0510093573f0e16be` |
| optimizer | `libs/gi/sheets/src/Weapons/Bow/TheViridescentHunt/index.tsx` | `7940dd3774aee6bd17ace83c19866199ea9871a8` |
| optimizer | `libs/gi/dm-localization/assets/locales/chs/weapon_TheViridescentHunt_gen.json` | `130082dd46ad536b6b3b73690b29378b03543a09` |
| genshin-db | `LICENSE` | `5335086ba177d823d802d64e7a255e0256258099` |
| genshin-db | `src/data/ChineseSimplified/weapons/messenger.json` | `3ad391eee195ee405283925a213072d74e32899f` |
| genshin-db | `src/data/ChineseSimplified/weapons/swordofnarzissenkreuz.json` | `bee0807126ceedd0ce8683dcb17e5df9f6e13b1a` |
| genshin-db | `src/data/ChineseSimplified/weapons/eyeofperception.json` | `84042d757bf9d4a8df7dd169f6ce3271f8cb54f3` |
| genshin-db | `src/data/ChineseSimplified/weapons/theviridescenthunt.json` | `0316a1d8cb331a0845620e3262975a898ff46e0f` |
| gcsim | `LICENSE` | `194f5e6715dd99e008f815327df1d87228eb5b3b` |
| gcsim | `internal/weapons/catalyst/perception/perception.go` | `026a2144b4b4fe1774f757ddfcf8794df8399bd3` |
