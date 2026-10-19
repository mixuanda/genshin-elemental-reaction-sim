# 三把独立伤害追击武器：固定 gcsim 外部实测

2026-09-24（香港）。外部取证阶段仅执行 **1 次既有外部 gcsim CLI**，首次 exit 0，耗时 **0.05100025003775954 秒**。没有安装依赖、重新构建 gcsim，或执行当时尚未冻结的本项目 runtime。一次小样本得到 5 次普通攻击伤害与 3 次武器追击，并实测钺矛冷却结束帧的严格边界。待本地实现冻结后，又完成下文所述的 **1 次本地受控对照**，没有重跑外部程序。

下面“公式与逐武器数值代入”的残差属于外部输入的算术复算；最后一节单独记录实际运行的本地 runtime、命中回放和独立计算器对照残差。

## 可复查原始资料

- [原始配置](weapon-procs/three-procs-reference.gcsl)
- [原始统计输出](weapon-procs/three-procs-reference.result.json)
- [原始 debug sample](weapon-procs/three-procs-reference.sample.json)
- [实际命令、时间、退出码、标准输出及 SHA256](weapon-procs/three-procs-reference.execution.json)
- [派生参考 JSON：全部实际伤害、动作、快照、calc 原字段与边界](weapon-procs/three-procs-reference.reference.json)
- [固定源码清单和各文件 SHA256](weapon-procs/fixed-source.manifest.json)、[28 文件离线源码档（含 LICENSE）](weapon-procs/fixed-source.json.gz)
- [只解析上述原始文件的提取脚本](weapon-procs/extract-reference.py)，不启动任何模拟器。

实际 working directory 为 `/Users/evan/Documents/gidps`，命令为：

```sh
/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-gcsim-b4ae769-03yjl36g/gcsim_darwin_arm64 \
  -c docs/cross-validation/weapon-procs/three-procs-reference.gcsl \
  -out docs/cross-validation/weapon-procs/three-procs-reference.result.json \
  -sample docs/cross-validation/weapon-procs/three-procs-reference.sample.json
```

二进制 SHA256：`2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`。输出自行报告 revision `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`、`modified=false`、build date `2026-07-25T16:00:55Z`。

| 原始文件 | SHA256 |
| --- | --- |
| config | `cc05b3bac2bd4774fc3a4ad8fa1e57c72b6586851acf42b569507d379494626f` |
| result | `a979dee82da0725c1d8729b2474c68b0d727a354ada3ca096194d18485793fbf` |
| sample | `3504e09525e2120c2595678d545f63f3d747b466774cc7d0c716fa927529b862` |

统计迭代 seed 为 `7985221182974661616`，debug sample seed 为 `10341522489272686395`。CLI 为统计与 sample 分别执行；二者不是同 seed。所选伤害的 CR=0，没有随机伤害分支，因此本配置可作确定性伤害对照；没有宣称与本项目随机流相同。

## 受控输入与实际时间线

钟离／芭芭拉／安柏均 C0、等级 1/20、突破 0、天赋 1/1/1，依次持有等级 1/20、R1 的 `halberd`／`ashgravendrinkinghorn`／`sequenceofsolitude`。没有圣遗物、E、Q、附魔、预置反应或同元素共鸣。各角色 `add stats cr=-0.05` 抵消来源自动加入的基础 5% CR；原始 calc 确认 CR=0、CD=0.5。武器自身副属性保留。

单个静止目标等级 90，各元素抗性 0.1，位置 (0,2)、半径 2。`duration=12`、`iteration=1`、`workers=1`、`hitlag=false`、`swap_delay=1`。最后一次钟离 N 输入帧 601 专门让命中落在钺矛状态的 expiry=612。

卡肉确实通过配置关闭：固定 `parseOptions.go:26–28` 将显式 `hitlag=false` 写入 `Settings.EnableHitlag`，`simulation/core.go:15` 传入核心，`combat/attack.go:71` 以该布尔值门控卡肉。result 中 protobuf 的 `enable_hitlag` 为 false 因 `omitempty` 省略（`model/sim.pb.go:440`）；sample 没有 `hitlag applied` 事件。参考 JSON 保留此证据，未只凭场景名称推断。

参考 JSON 每次追击还包含由未舍入 calc 字段恢复的等级、ATK/HP/DEF/EM、CR/CD、通用／对应元素增伤、敌方防御与抗性乘区、原始快照、冷却 status 和 parent hit。parent ID 是按同角色、唯一 `source_frame` 伤害及来源订阅关系派生，已注明并非 gcsim 原生字段。

| 角色 | 实际动作输入帧 | 伤害帧 | 原始 sourceAbil | damage | attack-tag |
| --- | ---: | ---: | --- | ---: | --- |
| 钟离 | 1 | 12 | Normal 0 | 6.003345217650947 | 1 / Normal |
| 钟离 | 触发帧 12 | 13 | Halberd Proc | 31.217527806278106 | 0 / None |
| 钟离 | 19 | 28 | Normal 1 | 6.07801364197259 | 1 / Normal |
| 芭芭拉 | 29（同帧切入） | 35 | Normal 0 | 6.590546377731959 | 1 / Normal |
| 芭芭拉 | 触发帧 35 | 36 | Ash-Graven Drinking Horn Proc | 111.76226483010309 | 7 / WeaponSkill |
| 安柏 | 121（同帧切入） | 145 | Normal 0 | 6.893750818391754 | 1 / Normal |
| 安柏 | 触发帧 145 | 146 | Sequence of Solitude Proc | 108.03686008824745 | 7 / WeaponSkill |
| 钟离 | 601（切入帧 301） | 612 | Normal 0 | 6.003345217650947 | 1 / Normal |

三次武器快照帧分别为 **12、35、145**，攻击各延迟 **1 帧**。武器追击均为物理、`ICDTagNone`、`ICDGroupDefault`、durability=100。芭芭拉普攻为水伤，其他普通攻击为物理；没有反应伤害。sample 中没有 energy 事件。

原始统计 `statistics.total_damage.mean` 为 **282.5856539980269**，DPS mean 为 **23.548804499835573**。参考 JSON 直接保存这个原始 mean；没有用另一套求和算法覆盖其末位数字。

## 公式与逐武器数值代入

本输入没有增伤、减防、无视防御、反应或暴击，因而：

```text
M_DEF = (角色等级 + 100) / [(角色等级 + 100) + (敌等级 + 100)]
      = 101 / (101 + 190) = 0.3470790378006873
M_RES = 1 - 物理抗性 = 1 - 0.1 = 0.9
D = 基础伤害 × (1 + 物理增伤 + 通用增伤) × M_DEF × M_RES
```

1. **Halberd R1** 的系数为 `1.2 + 0.4×R = 1.6`。钟离含武器的基础 ATK 为 `59.426100000000005`，ATK% 为 `0.051067`，总 ATK 为 `59.426100000000005 × 1.051067 = 62.460812648700006`。基础伤害 `1.6 × 62.460812648700006 = 99.93730023792001`；最终 `99.93730023792001 × 1 × (101/291) × 0.9 = 31.217527806278106`。
2. **Ash-Graven Drinking Horn R1** 的 HP 系数为 `0.3 + 0.1×R = 0.4`。芭芭拉基础 HP 为 `820.6119`，武器 HP% 为 `0.09`，最大 HP 为 `820.6119 × 1.09 = 894.4669710000001`。基础伤害 `0.4 × 894.4669710000001 = 357.78678840000003`；最终 `357.78678840000003 × 1 × (101/291) × 0.9 = 111.76226483010309`。
3. **Sequence of Solitude R1** 同为 `0.4×MaxHP`。安柏基础 HP 为 `793.2582`，HP% 为 `0.09`，最大 HP 为 `793.2582 × 1.09 = 864.6514380000001`。基础伤害 `0.4 × 864.6514380000001 = 345.8605752000001`；最终 `345.8605752000001 × 1 × (101/291) × 0.9 = 108.03686008824745`。

HP 两把在来源中以 `Mult=0, FlatDmg=MaxHP×0.4` 表示，日志中的 `total_scaling=ATK` 不意味着还要乘一次 ATK。它们仍经过普通物理伤害乘区。提取脚本用 calc 未舍入数值按原运算顺序复算，8 次伤害的算术绝对残差最大值为 **0**。debug `final_stats` 是保留两位小数的展示字符串，不用于复算。

## 冷却等号边界与源码适用范围

实测：钺矛在 frame 12 产生状态，日志 expiry=612；frame 28 和 **frame 612** 的普攻都没有第二次追击。固定源码 `CharWrapper.StatusIsActive` 调用 `modifier.FindCheckExpiry`，后者只有在 `expiry < frame` 时返回失效。因此该参考采用 **frame <= expiry 仍有效**；frame 613 是源码推导的首次可再次触发帧，本样本没有执行这一帧的普攻。不是动画取消或日志清理顺序造成的差异。

- [Halberd 定义 L24–63](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/halberd/halberd.go#L24-L63)：仅持有者 Normal 伤害，单目标，没有额外前台限制，600 帧状态。
- [Ash-Graven 定义 L25–58](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/ashgraven/ashgraven.go#L25-L58)、[Sequence 定义 L25–58](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go#L25-L58)：持有者伤害事件且持有者在前台，900 帧状态；触发目标位置的半径 3 米圆形攻击。
- [状态写入 L50–64](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L50-L64)、[活动状态查询 L180–184](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L180-L184)、[严格过期谓词 L117–126](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117-L126)。状态均受卡肉延长，本次显式关闭卡肉。
- [共享排队与快照](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go#L37-L80)、[普通伤害计算](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L46-L99)。

## 未验证范围

本次只验证 R1、单目标、静止目标、固定面板、无卡肉与三次前台触发。未执行 R2–R5、多目标数量／几何边界、切出后的持有者伤害触发、临时增益变化、暴击、两把 HP 武器的 900 帧再触发边界。其余来源条件可以供实现使用，但不能说这些分支已由本次外部样本覆盖。

固定源码 `damage.go` 对抗性恰好 0.75 的分支存在独立问题；本样本固定 0.1，不使用该边界作为正确性参考。该旧 revision 也不等于当前游戏版本的全面验证。本次没有失败的外部 CLI 尝试，没有修改生产代码。

## 冻结后本地受控对照：一次通过

2026-09-24，确认 runtime、schema 与构建完成后，执行且只执行一次：

```sh
node docs/cross-validation/weapon-procs/compare-local.mjs
```

首次 exit 0，脚本内部计时 **1.1126617920000001 秒**，`errors=[]`。没有新增 unit 矩阵、重跑全套测试或构建；没有重跑外部 gcsim。脚本从 `fixtures.makeConfig` 创建配置，用外部 `numericSnapshot` 的未舍入 ATK/HP/DEF/EM、CR/CD 和敌方条件恢复最终面板，明确设置普通攻击宿主命中帧 **12、28、35、145、612**，然后由真实 `weaponProcModel` 处理回调、独立取样、冷却和下一帧追击。CR=0；本地随机种子单独命名，不声称与外部随机流相同。

| 追击 | 外部／本地命中帧 | 外部＝本地伤害 | runtime 残差 | 完整命中 JSON 回放差 | 独立计算器残差 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Halberd | 13 | 31.217527806278106 | 0 | 0 | 0 |
| Ash-Graven Drinking Horn | 36 | 111.76226483010309 | 0 | 0 | 0 |
| Sequence of Solitude | 146 | 108.03686008824745 | 0 | 0 | 0 |

三次触发帧 **12、35、145**，冷却 expiry **612、935、1045** 也逐项相等。钺矛 frame **612** 的真实 runtime outcome 为 `cooldown-blocked`。本地包含明确给定宿主命中的 8 击总量为 **282.5856539980269**，与外部原始 mean 的绝对残差为 **0**。

每次实际追击都经过 `captureSimulationHit → serializeSimulationHit → parseSimulationHit → replaySimulationHit`，不是另造一条伤害冒充回放。每把武器还使用生产 `createWeaponProcCalculatorDocument`，以同一最终面板调用共享普通计算核心；三份独立文档均 `status=calculated`，并且 JSON 保存／恢复后的 totals 严格相等。分别使用共享来源定义的 `1.6×ATK`、`0.4×HP`、`0.4×HP`。

资料已保存：

- [可复用对照脚本](weapon-procs/compare-local.mjs)、[完整本地配置](weapon-procs/three-procs-reference.local-config.json)、[完整本地结果](weapon-procs/three-procs-reference.local-result.json)
- [逐项指标、实际命令、执行时间和生产源码 SHA256](weapon-procs/three-procs-reference.local-metrics.json)、[本地资料文件 SHA256 清单](weapon-procs/three-procs-reference.local-artifacts.json)。执行前后核心、schema、共享公式源码指纹一致。
- 钺矛：[完整 capture](weapon-procs/three-procs-reference.halberd.capture.json)、[回放](weapon-procs/three-procs-reference.halberd.replay.json)、[独立文档](weapon-procs/three-procs-reference.halberd.calculator.json)、[计算轨迹](weapon-procs/three-procs-reference.halberd.calculator-result.json)
- 苍纹角杯：[完整 capture](weapon-procs/three-procs-reference.ashgravendrinkinghorn.capture.json)、[回放](weapon-procs/three-procs-reference.ashgravendrinkinghorn.replay.json)、[独立文档](weapon-procs/three-procs-reference.ashgravendrinkinghorn.calculator.json)、[计算轨迹](weapon-procs/three-procs-reference.ashgravendrinkinghorn.calculator-result.json)
- 冷寂迸音：[完整 capture](weapon-procs/three-procs-reference.sequenceofsolitude.capture.json)、[回放](weapon-procs/three-procs-reference.sequenceofsolitude.replay.json)、[独立文档](weapon-procs/three-procs-reference.sequenceofsolitude.calculator.json)、[计算轨迹](weapon-procs/three-procs-reference.sequenceofsolitude.calculator-result.json)

本地对照范围是**已观测宿主命中条件下的独立武器追击机制**。角色进场由这些条件动作明确给定；没有认证钟离／芭芭拉的完整普攻动画、宿主快照时序、附着、随机回能或粒子模型，也没有用相等的总伤害宣称上述子系统完成。独立计算器文档同样以“该追击已经触发且实际命中”为条件，不预测次数或 DPS。
