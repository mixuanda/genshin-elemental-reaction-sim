# 新增武器显式条件公式：33把

本增量新增 `packages/game-data/src/weapon-additional-effects.ts`，只生成共享核心可执行的AST、输入定义、来源与阻碍。与此前47把支持武器去重后，审阅35把候选，其中33把具备可明确恢复的数值条款；试作星镰与神乐之真意因来源冲突排除。这里不将“部分输出条款可计算”写成“整件武器全部机制已验证”。所有结果保持 `provisional`。

本代理仅修改新模块、新来源档案与本文；未修改dispatcher、核心、schema、UI、生成器或测试文件，**未运行测试或typecheck**。接线和唯一聚焦验证由整合代理执行。本文末尾及独立fixture提供手列期望，不是已通过的测试报告。

## 接口与条件

导出接口为 `SUPPORTED_WEAPON_ADDITIONAL_IDS`、`hasWeaponAdditionalRule`、`getWeaponAdditionalControls({weaponId})`、`resolveWeaponAdditionalEffects({weaponId, refinement, enabled, context})`。结果为 `EquipmentFormulaResolution`，`missingConditions`始终存在；启用条款缺少必要条件时阻止其应用。停用条款不要求窗口或层数。

`EquipmentAdditionalWeaponContext`继承原有上下文，只提出四个新增字段：

| 字段 | 用途 |
| --- | --- |
| `normalHitEffectActive` | 匣里日月由合法普攻命中触发的6秒战技/爆发增伤窗口 |
| `skillBurstHitEffectActive` | 匣里日月由合法战技/爆发命中触发的6秒普攻增伤窗口，与前者独立 |
| `teamBurstEnergyTotal` | 断浪、曚云、恶王丸全队角色的元素能量**上限**总和；不是当前能量，不乘ER |
| `nearbyEnemyCount` | 决斗之枪当前已经生效的属性分支所对应的敌人数采样；不是即时位置推算 |

魔导绪论复用原圣遗物条件的 `targetFrozen`；其他条款复用 `weaponEffectActive`、`weaponStacks`、`enemyAuras`、`offField`。所有标签均给出武器专属含义；例如千岩层数代表已确认璃月人数，大魔术层数代表含自身的同元素人数，冬极层数代表四类攻击中仍有效的类别数。没有把随机模式、命中次数或累计击杀数偷偷当作叠层。

所有百分比以比例进入AST；增加的ATK/DEF/HP/EM/CR/ER属性为 `pre-panel`，伤害条款使用显式攻击标签或七元素过滤。数值与条件没有在UI预先计算。实例必须经共享核心输出公式、实际代入与中间结果。既有完整配装不因独立计算器缺少团队而被要求先建队；团队总量由用户显式提供，不猜缺失成员。

## 数值覆盖范围

- 叠层：铁蜂刺、万国诸海图谱、螭骨剑、试作斩岩、白影剑、飞天大御剑、无垠蔚蓝之歌。
- 队伍构成或能量上限：千岩古剑、千岩长枪、断浪长鳍、曚云之月、恶王丸、最初的大魔术。
- 已确认窗口：暗铁剑、翡玉法球、息燧之笛、虹的行迹、证誓之明瞳、饰铁之花、风信之锋、风花之颂、浪影阔剑、静谧之曲、撼地者、若水、东花坊时雨。
- 特殊明确状态：魔导绪论水/雷分支、四风原典、冬极白星、匣里日月、决斗之枪、波乱月白经津、有乐御簾切。

普通伤害加成不提升独立剧变反应伤害。万国、四风、波乱常驻元素加成排除物理；波乱的普攻条款独立按标签过滤，可作用于物理普攻。匣里日月不提升重击。三把能量上限家族只提升爆发，公式为 `min(来源上限, 全队能量上限总和 × 每点来源比例)`；不生成能量或证明循环可行。

## 必须保留的来源边界

1. **试作星镰排除。** 当前目录明确普攻/重击伤害加成，但固定gcsim把该数值写入 `ATKP`。支撑源码确认攻击modifier逐项加入面板快照，`TotalATK`读取ATKP，而增伤另读DmgP；这不是命名差异。不能依此伪称正确乘区已交叉核验。
2. **神乐之真意排除。** 活动7.1文案为24秒并含星超导增伤；固定gcsim仍16秒、无星超导，满层分支还写入物理增伤。新模块导出两项精确阻碍及目录、gcsim完整来源链接，供整合层展示。
3. **魔导绪论部分分支阻断。** 源码将Cryo与水、雷同列，而目录只列水、雷。目标有明确水或雷时数值一致；没有水雷时必须明确是否冻结。纯冰或冻结分支返回 `missingConditions`，不猜应采用哪份来源。已明确无水、雷、冰且不冻结时为零。
4. **无垠蔚蓝仅恢复合法层数。** 固定源码在过滤普/重标签前先增加内部层数，状态机顺序存在问题；R3重击旧注释8%又与执行代码及当前目录9%冲突。采用后两者一致的每层9%，保留自动触发未完成阻碍。
5. **暗铁剑新触发尚缺实现证据。** 当前目录列星超导，固定gcsim未订阅该事件；只恢复已确认有效的12秒攻击窗口，不由星超导事件自动产生窗口。翡玉法球源码已包含当前条款中的月绽放订阅，但本模块仍不生成反应事件。
6. **有乐的触发来源过宽。** 文案要求前台角色造成岩伤，固定gcsim回调没有检查前台。这里只接受用户确认的合法前台触发窗口，普攻/战技双倍的数值与目录一致，不照抄错误触发范围。
7. **若水与决斗不能用瞬时位置推断。** 若水源码每30帧扫描8单位范围，增伤保留72帧；其布尔值代表已生效状态。决斗每60帧检查附近敌人数，再延迟48帧且仅仍在前台时更新；输入代表当前生效分支所据的采样，未自动调度。
8. **四风需恢复正确取样时间。** `offField`与层数是本击所用属性的取样时状态。可快照技能前台叠层后施放、退场后命中，应恢复施放/快照时前台及层数，不能用命中时后台清除已保存增益。模块未自动管理历史快照。源码240帧全局检查相位并不随换入重置，不当作完整计时验证。四风10%移速未执行。
9. **命中前后顺序不混淆。** 斩岩、白影、飞天、铁蜂等输入是本击前已有层；击中后产生的新层不倒灌本次伤害。息燧、虹迹、证誓等施放战技事件与命中事件不同，来源的 `OnSkill`可先于本次技能后续取样发生；不将所有增益统一延后一击。
10. **构成和层数来源明确。** 千岩数全队符合璃月来源的成员，包括符合条件的装备者；大魔术同元素人数至少1、最多4，攻击在3人封顶。冬极四类独立12秒窗口不是累计命中次数；波乱输入是已消耗波穗后仍有效的8秒普攻增益层数，不是待消耗波穗。
11. **未表达条款不隐瞒。** 螭骨受伤增加及受击减层/护盾交互、大魔术异元素移速、四风移速均未执行，保留具体 `effectBlockers`。饰铁、风信、冬极需触发时前台，但合法取得的窗口/层数可在随后退场后保留；不因当前后台就一律禁用。

本批没有自动状态机、距离模型、攻击速度模型、随机暴击反馈或所有角色快照模型的完整声明。调用方必须按每个命中的真实完整上下文恢复条件；同一目标上的东花坊时雨状态不能复制到其他目标。

## 来源档案与审阅

固定参考实现为 [gcsim b4ae769](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541)，活动目录固定来源为 [genshin-db 49a6544](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf)。`packages/game-data/sources/weapon-additional-effects/manifest.json`记录87份原始来源文件，共315,717字节，包括35把候选原始中文JSON、武器实现、必要的属性/攻击/事件支撑代码及两个MIT许可证。每项保留完整固定URL、SHA-256、字节数。原字节没有重写。

`reviewed-catalog.json`是明确标记的审阅投影：35把候选的全部R1–R5原文、数值、来源路径与支持/排除状态。运行时只允许命名规则，并将活动目录的slug、精炼正文、每个原始数值与投影逐项精确比较；任一改变要求重新审阅，不通过泛化文案解析自动启用。

只读复核已覆盖第二组9把和窗口组10把的数值索引、单位、AST属性目标与标签；四风取样时刻歧义据此修正了控件和假设。审阅不等于运行测试，也不把来源标成独立游戏内verified。

## 供整合验证的独立期望

`reviewed-expectations.json`提供33个手列案例：`weaponId`、`slug`、上下文、R1/R5属性增量及指定元素/标签下的增伤总和。数值由固定来源与手算填写，没有调用生产resolver生成。所有属性均为**本武器被动贡献**，不含基础面板；未匹配的增伤总和为零。另有封顶、false窗口、非线性档位、缺条件与冲突分支记录。

下表为同一fixture摘要；精炼中间档应执行原文/数值guard，必要条件与分支由整合代理的唯一新聚焦测试覆盖。此表尚不是执行结果。

| 武器（ID） | 显式上下文 | R1贡献 | R5贡献 |
| --- | --- | --- | --- |
| 铁蜂刺 (weapon:11407) | `{"weaponStacks":2}` | physical/normal=0.12 | physical/normal=0.24 |
| 万国诸海图谱 (weapon:14407) | `{"weaponStacks":2}` | pyro/normal=0.16, physical/normal=0 | pyro/normal=0.32, physical/normal=0 |
| 螭骨剑 (weapon:12409) | `{"weaponStacks":5}` | physical/normal=0.3 | physical/normal=0.5 |
| 千岩古剑 (weapon:12410) | `{"weaponStacks":4}` | atkPercent=0.28, critRate=0.12 | atkPercent=0.44, critRate=0.28 |
| 千岩长枪 (weapon:13406) | `{"weaponStacks":4}` | atkPercent=0.28, critRate=0.12 | atkPercent=0.44, critRate=0.28 |
| 试作斩岩 (weapon:11406) | `{"weaponStacks":4}` | atkPercent=0.16, defPercent=0.16 | atkPercent=0.32, defPercent=0.32 |
| 白影剑 (weapon:12407) | `{"weaponStacks":4}` | atkPercent=0.24, defPercent=0.24 | atkPercent=0.48, defPercent=0.48 |
| 飞天大御剑 (weapon:12306) | `{"weaponStacks":4}` | atkPercent=0.24 | atkPercent=0.4 |
| 暗铁剑 (weapon:11304) | `{"weaponEffectActive":true}` | atkPercent=0.2 | atkPercent=0.4 |
| 息燧之笛 (weapon:11431) | `{"weaponEffectActive":true}` | defPercent=0.16 | defPercent=0.32 |
| 魔导绪论 (weapon:14301) | `{"enemyAuras":["hydro"]}` | physical/normal=0.12 | physical/normal=0.24 |
| 翡玉法球 (weapon:14304) | `{"weaponEffectActive":true}` | atkPercent=0.2 | atkPercent=0.4 |
| 证誓之明瞳 (weapon:14415) | `{"weaponEffectActive":true}` | energyRechargeBonus=0.24 | energyRechargeBonus=0.48 |
| 无垠蔚蓝之歌 (weapon:14426) | `{"weaponStacks":3}` | physical/normal=0.24, pyro/charged=0.18, pyro/skill=0 | physical/normal=0.48, pyro/charged=0.36, pyro/skill=0 |
| 饰铁之花 (weapon:12418) | `{"weaponEffectActive":true}` | atkPercent=0.12, em=48 | atkPercent=0.24, em=96 |
| 风信之锋 (weapon:13419) | `{"weaponEffectActive":true}` | atkPercent=0.12, em=48 | atkPercent=0.24, em=96 |
| 风花之颂 (weapon:15413) | `{"weaponEffectActive":true}` | atkPercent=0.16 | atkPercent=0.32 |
| 静谧之曲 (weapon:15425) | `{"weaponEffectActive":true}` | physical/normal=0.16 | physical/normal=0.32 |
| 浪影阔剑 (weapon:12425) | `{"weaponEffectActive":true}` | atkPercent=0.24 | atkPercent=0.48 |
| 撼地者 (weapon:12431) | `{"weaponEffectActive":true}` | pyro/skill=0.16, pyro/burst=0 | pyro/skill=0.32, pyro/burst=0 |
| 虹的行迹 (weapon:13431) | `{"weaponEffectActive":true}` | defPercent=0.16 | defPercent=0.32 |
| 若水 (weapon:15508) | `{"weaponEffectActive":true}` | hpPercent=0.16; physical/normal=0.2 | hpPercent=0.32; physical/normal=0.4 |
| 四风原典 (weapon:14502) | `{"weaponStacks":4,"offField":false}` | pyro/normal=0.32, physical/normal=0 | pyro/normal=0.64, physical/normal=0 |
| 冬极白星 (weapon:15507) | `{"weaponStacks":4}` | atkPercent=0.48; pyro/skill=0.12, pyro/burst=0.12, physical/normal=0 | atkPercent=0.96; pyro/skill=0.24, pyro/burst=0.24, physical/normal=0 |
| 匣里日月 (weapon:14405) | `{"normalHitEffectActive":true,"skillBurstHitEffectActive":true}` | pyro/normal=0.2, pyro/skill=0.2, pyro/burst=0.2, pyro/charged=0 | pyro/normal=0.4, pyro/skill=0.4, pyro/burst=0.4, pyro/charged=0 |
| 决斗之枪 (weapon:13405) | `{"nearbyEnemyCount":2}` | atkPercent=0.16, defPercent=0.16 | atkPercent=0.32, defPercent=0.32 |
| 断浪长鳍 (weapon:13416) | `{"teamBurstEnergyTotal":300}` | pyro/burst=0.36, pyro/skill=0 | pyro/burst=0.72, pyro/skill=0 |
| 曚云之月 (weapon:15416) | `{"teamBurstEnergyTotal":300}` | pyro/burst=0.36, pyro/skill=0 | pyro/burst=0.72, pyro/skill=0 |
| 恶王丸 (weapon:12416) | `{"teamBurstEnergyTotal":300}` | pyro/burst=0.36, pyro/skill=0 | pyro/burst=0.72, pyro/skill=0 |
| 波乱月白经津 (weapon:11510) | `{"weaponStacks":2}` | physical/normal=0.4, pyro/normal=0.52, pyro/charged=0.12, physical/charged=0 | physical/normal=0.8, pyro/normal=1.04, pyro/charged=0.24, physical/charged=0 |
| 有乐御簾切 (weapon:11514) | `{"weaponEffectActive":true}` | defPercent=0.2; physical/normal=0.32, geo/skill=0.48, geo/burst=0 | defPercent=0.4; physical/normal=0.64, geo/skill=0.96, geo/burst=0 |
| 最初的大魔术 (weapon:15512) | `{"weaponStacks":4}` | atkPercent=0.48; pyro/charged=0.16, physical/normal=0 | atkPercent=0.96; pyro/charged=0.32, physical/normal=0 |
| 东花坊时雨 (weapon:11422) | `{"weaponEffectActive":true}` | physical/normal=0.16 | physical/normal=0.32 |

本代理没有执行测试；最终通过/失败与耗时须引用整合代理随后真实执行的输出，不从这些手列期望推断。
