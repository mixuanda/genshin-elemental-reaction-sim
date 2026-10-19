# 祭礼：一次外部砂糖 C1 双充能实测

2026-09-24，外部取证阶段只运行一次固定 CLI，不修改生产代码。该样本实际观察到：第二次 E 触发祭礼，只恢复一层；第三次 E 使用恢复的充能；剩余队列从触发帧重新计时，随后两次自然恢复均符合固定源码。后续本地对照已完成，结果与一次配置输入失败记录见文末。

## 固定输入与执行

- gcsim revision：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；结果声明 `modified=false`，构建日期 `2026-07-25T16:00:55Z`。
- 复用既有 macOS ARM64 可执行文件；SHA-256：`2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`。没有安装或重建。
- 砂糖 Lv1/20、突破 0、C1、天赋 1/1/1；祭礼残章 R5 Lv1/20；无圣遗物，CR 以 `-0.05` 抵消基础值至 0，初始能量 0；显式 `hexerei=0`。
- 三个静止、无元素附着的目标：Lv90，抗性均 0.1；位置 `(0,2)`、`(1,3)`、`(-1,3)`，半径 1。它们都在真实 E 圆形范围内。输出保留 `target_overlap=true` 提醒：这个夹具有目标几何重叠，不认证敌人碰撞或移动行为。
- `hitlag=false`，34 秒，`iteration=1`、`workers=1`；依次输入 E、E、E，然后等待至第 2040 帧。
- 一次 CLI 在 `2026-09-24T01:03:53.329806+00:00` 启动，退出码 **0**，耗时 **0.02009241603082046 秒**。没有重抽、重跑或挑选成功记录。

完整命令、stdout、stderr、文件长度及 SHA 在 [execution](sacrificial/sucrose-charge-reference.execution.json)。该次调用生成一份统计结果和独立 debug 样本，二者种子分别为 `7127364829233787398`、`1214699284035967682`。不能把它们当成同一随机流；本报告的逐帧结论来自 debug 原始流水。统计总伤与样本总伤本次相等，不据此推断所有隐藏抽样也相同。

`result.simulator_settings` 省略 `enable_hitlag` 是 protobuf 的 false/omitempty 序列化；`def_halt=true` 是另一个保留的选项，不代表启用卡肉。解析器确实把配置的 false 传给 `EnableHitlag`，敌人和角色卡肉调用均先检查此门。证据见固定 [parseOptions.go L26–28](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/gcs/parser/parseOptions.go#L26-L28)、[sim.pb.go L440](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/model/sim.pb.go#L440)、[combat/attack.go L70–83](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/attack.go#L70-L83)。

## 来源规则与真正执行顺序

1. [common/sacrificial.go L39–63](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/common/sacrificial.go#L39-L63) 监听实际 `OnEnemyDamage`，依次要求：攻击属于持有者、持有者在前台、精确 `AttackTagElementalArt` 标签、祭礼 ICD 不活跃、`Cooldown(E) != 0`、实际伤害不等于 0，然后才抽 `Rand.Float64() < probability`。并非所有叫“战技”的动作、所有战技衍生标签都自动符合。
2. R1–R5 的概率分别为 0.4/0.5/0.6/0.7/0.8；ICD 分别 1800/1560/1320/1140/960 帧。成功先调用 `ResetActionCooldown(E)`，再建立可受角色卡肉延长的 status。失败不设置 ICD。`FindCheckExpiry` 用 `< frame` 判过期，所以无卡肉下 expiry 等号仍阻挡，下一帧才过期。[固定概率和 ICD](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/common/sacrificial.go#L29-L37)、[expiry 判断](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117-L125)。
3. [cooldown.go L78–96](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/cooldown.go#L78-L96)：延迟 `SetCD` 使用全局任务；只有到实际任务帧才入队并扣充能。只要 `AvailableCDCharge > 0`，`Cooldown()` 返回 0，祭礼不抽概率。CR=0 的伤害仍会调用暴击 RNG，不能把“不抽祭礼”写成“整个随机流不消耗”。[damage.go L97](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go#L97)。
4. [reset L99–119](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/cooldown.go#L99-L119)：恢复恰好一层，弹出队首、令旧 worker 失效，再从当前触发帧开始完整计时剩余队首。并非补满所有层，也不保留被移除队首的已过时间。[worker L145–202](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/cooldown.go#L145-L202) 到时先检查指针身份，然后恢复一层、弹首并启动下一项。
5. [砂糖 C1](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/sucrose/sucrose.go#L33-L35) 初始化两层。E [起手快照 +0、命中 +42](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/sucrose/skill.go#L52-L63)，冷却 900 帧于起手 +9 才开始/扣层，E→E 为 56 帧。每次成功命中，粒子回调以 24 帧共享 ICD 只生成一组 4 风元素微粒；默认传播 100 帧。C1 没有 C4 随机减 CD；突破 0 不启用 A1/A4；Hexerei 显式关闭。
6. 全局帧先 `Combat.Tick → Constructs.Tick → Player.Tick → Tasks.Run`；任务按到期帧、插入序号执行，并继续执行当帧新加入的零延迟任务。[core.go L138–153](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/core.go#L138-L153)、[task.go L38–60](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/task/task.go#L38-L60)。逐帧 advance 完成 `Tick` 和 `OnTick` 后返回动作检查阶段，所以此全局恢复 worker 在当帧动作资格检查之前执行；该结论是源码顺序，本样本没有在 999 帧另输入 E。[run.go L273–295](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L273-L295)。
7. 一次 AOE 先遍历各目标计算伤害，再由零延迟任务依序应用伤害、发送 `OnEnemyDamage`、执行技能命中回调。第 99 帧三个目标的 calc 日志先出现；目标 1 的伤害回调随后重置/设置祭礼 ICD，再调用产球回调；目标 2、3 不再抽祭礼。[enemy/attack.go L60–78](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L60-L78)。外部日志不记录祭礼的具体随机数；不能虚构 roll 数值。

## 原始样本实际结果

| 帧 | 事件 | 可用层 / 冷却队列 |
| --- | --- | --- |
| 1 | 第一次 E 起手及快照 | 起始 2 层；尚未扣层 |
| 10 | 延迟 SetCD | 1 / `[900]`；日志 expiry=0，因为仍有一层 |
| 43 | E 同时命中 3 目标 | 剩一层，祭礼资格门跳过；生成一组 4 风粒子 |
| 57 | 第二次 E 起手及快照 | 1 / `[900]` |
| 66 | 延迟 SetCD | 0 / `[900,900]`；日志 expiry=844 为剩余帧数 |
| 99 | 第二 E 命中；目标 1 回调祭礼成功 | 1 / `[900]`；剩余恢复任务改到 999；祭礼 ICD expiry=1059 |
| 113 | 第三次 E 起手及快照 | 使用恢复的那一层 |
| 122 | 延迟 SetCD | 0 / `[900,900]`；日志 expiry=877 |
| 155 | 第三 E 同时命中 3 目标 | 祭礼仍处 ICD；确实再次生成一组 4 风粒子 |
| 910 | 原恢复 worker 原定到期 | 没有恢复日志；旧 worker 已失效 |
| 999 | 新队首自然恢复 | 1 / `[900]` |
| 1899 | 下一队首自然恢复 | 2 / `[]` |

粒子在 **143、199、255** 帧收到，每组 4 风粒子，ER=1、单人前台同元素，每组恢复 12 能量：`0 → 12 → 24 → 36`。三目标没有令同一次 E 生成三组粒子。

全部九次目标伤害相同，原始未舍入 panel：基础/最终 ATK=`55.313500000000005`，HP=`775.02234`，DEF=`58.94175`，EM=48，CR=0，CD=0.5，通用和风元素增伤均 0。E1 倍率=2.112；敌人 Lv90、抗性 0.1、无减防/无视防御。

`55.313500000000005 × 2.112 = 116.82211200000002`；防御乘区 `101 / 291 = 0.3470790378006873`；抗性乘区 `0.9`；每个目标伤害 **36.491855604123714**。九次按原始执行顺序求和 **328.4267004371134**，统计结果均值也是 **328.4267004371134**，差 **0**。此处差值指外部统计与外部样本总量比较；本地引擎残差单独列于后文。

## 可复现材料及范围

- [原始配置](sacrificial/sucrose-charge-reference.gcsl)、[统计结果](sacrificial/sucrose-charge-reference.result.json)、[不可变 debug 样本](sacrificial/sucrose-charge-reference.sample.json)、[执行记录](sacrificial/sucrose-charge-reference.execution.json)。配置 SHA=`53eb8fbb1491d822ec485b01817f37b3c5a1ee275baf5518812773c3bfc6f845`；结果 SHA=`fd0b72ad4c82b170a330b28612bc0f92f874aa74e6f2819ac45e76ac0759f741`；sample SHA=`a1fd3bea97034efb66609d3972a76e130400ed7159f46888e7f78b42c05fff94`。
- [派生参考 JSON](sacrificial/sucrose-charge-reference.reference.json) 保留 raw log index、所有九击未舍入数值、实际 action/CD/proc/粒子流水、三目标数据及随机边界。该文件由 [只读提取脚本](sacrificial/extract-reference.py) 生成，不执行模拟器。
- [31 文件固定来源清单](sacrificial/fixed-source.manifest.json) 与 [含 LICENSE 的来源字节归档](sacrificial/fixed-source.json.gz) 保存逐文件 SHA 和固定 revision URL。本地来源目录是解压树而非 Git checkout；不把目录名当作 `git rev-parse` 的证明。
- 本地对照应从未加额外 buff 的实际 panel 恢复 E，显式声明与外部观察相符的触发结果或本地独立 RNG 策略，比较恢复队列、再次 E、粒子与逐击数值。不能声称本地 named RNG 和 gcsim 共用同 seed 序列。
- 本样本没有实测失败 roll、离场、零伤、错误标签、ICD 恰好到期及下一帧、其他精炼或武器类型，也没有实现/认证完整砂糖动作库。相关精确规则只能按上述源码范围引用。固定历史实现也不等于当前游戏全量机制认证。

执行记录：唯一外部 CLI 首次通过，未发生外部失败或重跑。之后提取/归档脚本首次因两个源文件名写错而中止（`player/energy.go` 应为 `player/player.go`，`attack_tag.go` 应为 `attack.go`）；修正路径后提取成功，没有触碰或重新生成原始 CLI 产物。外部取证阶段未运行本地模拟；本任务始终未运行单元测试、构建或全量检查。

## 冻结后的本地真实运行对照

在运行时与完整结果/回放 schema 均冻结后执行 [compare-local.mjs](sacrificial/compare-local.mjs)。该脚本使用真实 `makeConfig → simulate` 与当前严格结果校验，没有注入祭礼日志、重置事件、恢复任务或预先计算的伤害。

本地初始面板直接恢复外部 `characterDetails.snapshot` 的未增益基础/最终属性；E 的 2.112 倍率、起手快照、+42 命中、+9 才 SetCD、两层上限、900 帧串行恢复均来自固定源。三个普通合法 E 指令请求帧为 1/57/113，严格取消窗使用 E→E 56 帧、动画结束 68 帧。真实圆形范围中心 `(0,5)`、半径 6 解析三个外部位置；命中确认触发 4 风粒子、24 帧粒子 ICD、100 帧传播。保留外部目标重叠范围限制，不认证全角色动作。

使用本已在新运行时用例注明的独立 seed `sacrificial-consumer-reference`，未搜索 seed、批量抽样或拟合伤害。第一个本地祭礼抽样实际为 **0.6284964594524354**，发生于第 **99** 帧，严格小于 0.8，运行时因而恢复一层。外部没有记录具体 roll 数值，故只比较观察到的触发分支及实际结果；不声称 RNG 或同 seed 序列相同。

执行过程保留一项真实输入失败：首次 `simulate` 调用在配置解析阶段拒绝了缺少兼容目标 `enemy-0` 及 `aura-v1` 不支持风元素附着，未发生战斗。原配置、错误堆栈、来源哈希和工具报告耗时 **0.678863458 秒**保存为 [attempt1 config](sacrificial/sucrose-charge-reference.local-attempt1-config.json)、[attempt1 error](sacrificial/sucrose-charge-reference.local-attempt1-error.json)、[attempt1 execution](sacrificial/sucrose-charge-reference.local-attempt1-execution.json)。仅将本地目标 ID 改为 `enemy-0..2` 并选用已支持风元素的 `aura-v3` 后复验；面板、几何、倍率、时序、种子、队列与预期伤害没有改变。

修正后的唯一完整战斗在 `2026-09-24T01:27:57.148Z` 开始，**PASS**，耗时 **1.722076666 秒**，进程退出 0：

| 对照项 | 实际结果 |
| --- | --- |
| 三条合法 E 命令 | 均 executed，起手 1/57/113 |
| 延迟扣层 | 10、66、122，逐次充能/队列与外部完全一致 |
| 祭礼真实回调 | 第一 E 三目标均 skill-ready、无祭礼抽样；第二 E 第一个目标触发，其余及第三 E 受 ICD 阻挡 |
| 实际 reset | 99 帧，0→1 层，`[900,900]→[900]`，武器 ICD expiry=1059 |
| 串行恢复 | 999、1899；910 帧旧 worker 被记录为 stale-worker，无充能变化 |
| 三组粒子 | 143/199/255，各 4 风粒子；能量 0→12→24→36 |
| 九个逐目标命中 | 各 **36.491855604123714**；相对外部绝对残差全部 **0** |
| 总伤 | **328.4267004371134**；相对外部绝对残差 **0** |
| 完整结果 JSON | 当前 `simulationResultSchema` 校验通过 |
| 九份命中 capture→JSON→parse→calculator replay | 九项自身差值与外部残差全部 **0** |
| 运行前后生产来源哈希 | 125 个文件完全一致 |

证据：[实际本地配置](sacrificial/sucrose-charge-reference.local-config.json)、[完整本地结果](sacrificial/sucrose-charge-reference.local-result.json)、[逐项数值/失败数组/来源前后哈希](sacrificial/sucrose-charge-reference.local-metrics.json)、[33 项产物哈希清单](sacrificial/sucrose-charge-reference.local-artifacts.json)。九份 `hit-0` 至 `hit-8` 的 capture/replay JSON 同目录保存。

合计是 **2 次本地 API 调用（1 次解析失败、1 次完整战斗）**，没有运行第二次外部 CLI，没有修改生产代码或重新跑旧测试。该对照验证实际合法技能、串行冷却和命中驱动的祭礼/产球路径；不扩大为全部精炼、全部角色、概率分布、失败抽样、卡肉或恰好 expiry 帧的实测认证。
