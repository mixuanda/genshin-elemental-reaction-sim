四把武器额外伤害及持续状态：固定 Optimizer 来源核对

核对版本：`frzyc/genshin-optimizer@180a0a1015cb725c7570cd828eb086749960df98`。结果为 **20 个精炼位置中 16 个一致、4 个冲突**，不能写成全部通过。冲突集中于笛剑 R1–4：该版本生产 sheet 写死倍率 2、不读取精炼等级；同版本中文描述为 1 / 1.25 / 1.5 / 1.75 / 2。本报告保留冲突，不修改原文或以另一个来源替它宣告通过。

[manifest.json](/Users/evan/Documents/gidps/packages/game-data/sources/weapon-proc-lifecycle-optimizer/manifest.json) 保存全部原文 URL、SHA-256、Git blob SHA-1、时间、取得方式和结构化字段。共归档 14 文件：9 份本次 HTTPS 取得，5 份从前批同固定版本归档复制；逐文件 Git blob 与 `/tmp/gidps-optimizer-180a0a1/tree.json` 一致，固定树 `truncated=false`。没有运行构建、测试套件、外部模拟器或 Optimizer 应用。

以下数值按 R1 → R5 排列，单位为 ATK 倍率。

| 武器 / ID / Optimizer key | 生产 sheet | 同版本中文描述 | 攻击力层 | 结论 |
|---|---|---|---|---|
| 笛剑 / 11402 / `TheFlute` | 2 / 2 / 2 / 2 / 2 | 1 / 1.25 / 1.5 / 1.75 / 2 | `input.premod.atk` | 仅 R5 一致；R1–4 冲突 |
| 以理服人 / 12305 / `DebateClub` | 0.6 / 0.75 / 0.9 / 1.05 / 1.2 | 0.6 / 0.75 / 0.9 / 1.05 / 1.2 | `input.total.atk` | 5 个位置一致 |
| 流月针 / 13403 / `CrescentPike` | 0.2 / 0.25 / 0.3 / 0.35 / 0.4 | 0.2 / 0.25 / 0.3 / 0.35 / 0.4 | `input.total.atk` | 5 个位置一致 |
| 竭泽 / 15418 / `EndOfTheLine` | 0.8 / 1 / 1.2 / 1.4 / 1.6 | 0.8 / 1 / 1.2 / 1.4 / 1.6 | `input.total.atk` | 5 个位置一致 |

有差异位置的 `sheet − description` 分别为 1 / 0.75 / 0.5 / 0.25，最大绝对倍率差 1；这不是计算器输出误差或实机伤害测量。其余 16 个位置的倍率差为 0。`percent(2)` 的含义已追溯到 [`wr/src/utils.ts` L48–52](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/utils.ts#L48)：数值保持为 2，仅附上百分比显示单位，因此确为 200%，不能解释成 2%。

逐武器原文：

- **笛剑**：[`libs/gi/sheets/src/Weapons/Sword/TheFlute/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Sword/TheFlute/index.tsx#L21)，系数 L21，攻击力引用 L21，physical 明示 L22。描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_TheFlute_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_TheFlute_gen.json#L8)。

- **以理服人**：[`libs/gi/sheets/src/Weapons/Claymore/DebateClub/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Claymore/DebateClub/index.tsx#L18)，系数 L18，攻击力引用 L25，physical 明示 L29。描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_DebateClub_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_DebateClub_gen.json#L8)。

- **流月针**：[`libs/gi/sheets/src/Weapons/Polearm/CrescentPike/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Polearm/CrescentPike/index.tsx#L18)，系数 L18，攻击力引用 L25，physical 明示 L30。描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_CrescentPike_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_CrescentPike_gen.json#L8)。

- **竭泽**：[`libs/gi/sheets/src/Weapons/Bow/EndOfTheLine/index.tsx`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Bow/EndOfTheLine/index.tsx#L17)，系数 L17，攻击力引用 L24，physical 由 bow / elemental 的公共默认分支推导。描述见 [`libs/gi/dm-localization/assets/locales/chs/weapon_EndOfTheLine_gen.json`](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/weapon_EndOfTheLine_gen.json#L8)。

持续时间、次数和间隔全部属于同版本描述证据；四个生产 sheet 都只有静态单次伤害节点，没有状态机、时钟、计数器或事件监听。

| 武器 | 描述中的启用条件 | 描述中的 duration / count / interval / CD | 描述未给出或本次未核实 |
|---|---|---|---|
| 笛剑 | 普攻或重击命中获得和音 | 5 个和音触发；和音最多存在 30 秒；每 0.5 秒至多获得 1 个 | 和音独立到期或整体续期、清层及同帧次序；不能从 sheet 推定 |
| 以理服人 | 施放元素战技后，普攻或重击命中 | 持续 15 秒；每 3 秒至多造成一次额外伤害 | 再次 E 是否重置伤害间隔、边界是否含等号、总次数；无固定次数上限数字 |
| 流月针 | 获得元素微粒或晶球后，普攻与重击造成额外伤害 | 持续 5 秒 | 描述没有数字形式的伤害 ICD、次数上限或启用 CD；保留 null，不推导为已验证 0 或无限 |
| 竭泽 | 施放元素战技启用沿洄；攻击命中造成范围伤害 | 15 秒或 3 次范围伤害后移除；每 2 秒至多一发；每 12 秒至多启用一次 | E 本次命中是否可触发、重新启用的次数和伤害间隔重置、移除与命中同帧次序 |

描述没有给这四把武器另加数值概率门槛；本次也没有由此实现或验证随机触发机制。实际队伍总触发数必须由完整合法事件序列和状态处理确定，不能直接把持续时间除以间隔，或把竭泽 3 次上限当作每次启用必定命中 3 发。

伤害类别及复现边界：

- 笛剑、以理服人、流月针显式设置 `hit.ele = physical`。竭泽使用 [`dataUtil.tsx` L68–88](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx#L68) 的默认推导：`elemental` 不走 skill / burst 元素分支，bow 不走近战附魔或法器分支，最终为 physical。

- 四者调用的 move 都是 `elemental`，不继承触发普攻、重击或战技的动作类别增伤。公共 [`customDmgNode` L113–138](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx#L113) 接到 [`formula.ts` L431–450](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts#L431) 的普通非暴击 / 暴击 / 期望、防御和对应抗性公式。上述只证明固定源码表达，不代表已完成实机验证。

- 笛剑使用 `input.premod.atk`，其余三个使用 `input.total.atk`。公共 [`formula.ts` L339–344](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts#L339) 默认 total 对应项读取 premod；本次没有证明任意后处理或转化增益下二者相等。

- 未核实攻击事件细分、范围目标数、脱手规则、快照时点、多段计数、命中顺序、精确到期边界或触发递归。新实现若由 gcsim 等其他来源补齐，应单独记录证据及分歧，不能归因于这四个静态 sheets。

- 没有读取空 `refinementBonus` 或 TODO 公式桩来证明机制。manifest 的可信度保持 `provisional`，笛剑四个冲突位置显式保留。

身份与归档校验：四个 ID 分别在同版本 `mapping/weapon.ts` 和 `WeaponExcelConfigData_idmap_gen.json` 中确认为 TheFlute / DebateClub / CrescentPike / EndOfTheLine。笛剑不是 `FluteOfEzpitzal`。全部归档如下，SHA-256 见 manifest。

| 固定版本原文路径 | Git blob SHA-1（均匹配固定树） |
|---|---|
| `LICENSE` | `ccc6a6c559f48acd605c121885cd8c37a01aaf42` |
| `libs/gi/sheets/src/Characters/dataUtil.tsx` | `736a1229592f4afead151920884dbccd5c5e22cb` |
| `libs/gi/wr/src/formula.ts` | `7a066de7a030ed2dd05b5184703bb955f6331961` |
| `libs/gi/dm/src/mapping/weapon.ts` | `33edfa77556a7bb7dc1ef771f1194a57df306df5` |
| `libs/gi/dm/src/dm/weapon/WeaponExcelConfigData_idmap_gen.json` | `e11e04044b2b4e50ca7a798c6384dccf47bd373c` |
| `libs/gi/sheets/src/Weapons/Sword/TheFlute/index.tsx` | `7a30c999b8e46cb904f4f9eb8bb39b48f733bae3` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_TheFlute_gen.json` | `1e07d3f9eacdb748d289ad3498ff5f1247b66573` |
| `libs/gi/sheets/src/Weapons/Claymore/DebateClub/index.tsx` | `a7c0ca72c499b4b2240c7287107fa7458e8b85cc` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_DebateClub_gen.json` | `23e893c9a5a4d493ce6728c07fd58c782803e20e` |
| `libs/gi/sheets/src/Weapons/Polearm/CrescentPike/index.tsx` | `a5a5b680e00a81ebcd7c5703f93f6194e6e24083` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_CrescentPike_gen.json` | `f25f6399c0b1733be8622de83e2bbc52a82a859e` |
| `libs/gi/sheets/src/Weapons/Bow/EndOfTheLine/index.tsx` | `55cdb950540ec6bca5afec8b6cd68e5763f09ea3` |
| `libs/gi/dm-localization/assets/locales/chs/weapon_EndOfTheLine_gen.json` | `6af396120a76cd4a7549e1fd968a231a1382fb20` |
| `libs/gi/wr/src/utils.ts` | `607b570be2fc1ec356be367aabf29a49488f25e0` |
