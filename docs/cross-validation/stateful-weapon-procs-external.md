# 四把状态追击武器：固定来源事件审阅与竭泽外部样本

本报告只验证固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的限定实现。原始源码位于 `/tmp/gidps-gcsim-b4ae769`（解压树，不是 Git checkout）；已检查的 23 个源文件路径、固定 URL 与 SHA-256 见 [source-review.json](stateful-weapon-procs/source-review.json)。canonical 原文归档由 `ningguang_snapshot_core` 维护，本目录不重复打包。未将历史实现或一个样本视为当前游戏全机制认证。

已逐字节确认这 23 个原文与 [29 文件 canonical manifest](../../packages/game-data/sources/weapon-proc-lifecycle/manifest.json) 一致。manifest SHA-256 为 `be72d41bef9361ddedf4c9b4015c2f08828b3226ec84d9d8e829f7e6f4c6df90`，压缩源归档 SHA-256 为 `b75a1dacd3ddd4f57ad2291c7670d361cc195e4fa10ba2229b122fb733d4fa71`。归档另明确保留笛剑 R1–4 的来源冲突：固定 Optimizer sheet 均为 2，而 gcsim 与目录分别为 1／1.25／1.5／1.75；本任务没有将其描述为三源一致，也没有以竭泽样本消除此冲突。

## 事件合同

### 战技

- `pkg/core/player/exec.go:188–194` 同步 `Emit(OnSkill)`，然后才调用 `char.Skill`。正常循环在 `pkg/simulation/run.go:182–197` 先调用就绪检查；不就绪不会执行动作或发事件。技能函数自身返回错误则已发出的事件不回滚。源中没有发现普通 Skill 主动返回 `ErrActionNoOp` 的实际路径，不能将这个可能性当成已观测游戏行为。
- `pkg/core/attack.go:89–96` 的零延迟攻击立即计算，但 `pkg/enemy/attack.go:63–78` 把 `applyDamage → OnEnemyDamage → Attack callbacks` 加进共享零延迟任务。若攻击发生在任务队列内，新任务仍在本次 drain 执行；若是脚本直接 `Exec` 的技能体，要等下一次 `Tasks.Run`。旧攻击任务在本帧 `Core.Tick` 先于脚本新动作执行；不能把所有同帧事件都排成“新战技先”。依据 `pkg/simulation/run.go:286–294`、`pkg/core/core.go:150–153`、`pkg/core/task/task.go:38–60`。
- 以理服人 `internal/weapons/claymore/debateclub/debateclub.go:32–40` 在持有者在场的战技事件清除伤害 ICD、刷新 900 帧效果。没有激活 ICD、概率或次数上限。伤害回调要求自身、在场、有效果、Normal/Extra、无 ICD；没有零伤害门。先写 180 帧 ICD，再排立即快照／下一帧物理追击，倍率 `0.45 + 0.15R`，触发目标中心半径 3（43–81）。
- 竭泽 `internal/weapons/bow/endoftheline/endoftheline.go:37–54` 先检查持有者在场、720 帧激活 ICD。成功才写效果 900 帧、激活 ICD 720 帧、清伤害 ICD、计数归零。被激活 ICD 拦截的战技不刷新任何状态。伤害回调要求自身、在场、有效果、无伤害 ICD；**无攻击标签或零伤害门**。立即快照并排下一帧物理追击，倍率 `0.60 + 0.20R`、半径 2.5；之后计数加一。第 3 次删除效果，保留已排伤害，且不再写 120 帧伤害 ICD（57–96）。因此本次战技自身命中可以消耗第一次追击。

### 微粒与笛剑

- `pkg/core/energy.go:12–27`：`QueueParticle` 延迟 0 时立即分发，正延迟以到期任务分发。`pkg/core/player/player.go:197–202` 先让所有队员 `ReceiveParticle`，然后只发一次全局 `OnParticleReceived(p)`。参数只有 Source / Num / Ele，没有接收者或实际恢复值（`character/character.go:263–267`）。满能封顶不取消事件；零粒子数量也没有提前返回（`character/energy.go:73–82`）。这不同于各角色的 `OnEnergyChange`。
- 流月针 `internal/weapons/spear/crescent/crescent.go:31–38` 忽略事件参数，只要求**拾取时**持有者在场。微粒生产者无关；后台获得能量不等于后台持有者激活。满能或零数量分发仍能触发该源回调。状态刷新为当前帧 +300，替换旧期限，不累计剩余时间；可被持有者 hitlag 延长。伤害回调要求自身 Normal/Extra、实际非零伤害、效果有效，**没有命中时在场门、ICD 或次数上限**。触发时重新快照，向同一目标下一帧施加物理 WeaponSkill，倍率 `0.15 + 0.05R`（40–65）。
- 笛剑 `internal/weapons/sword/flute/flute.go:36–75` 不监听战技或微粒。自身在场 Normal/Extra 命中通过 30 帧 ICD 后，若 1800 帧持续状态已失效先清层，然后加一并刷新持续期；没有零伤害门。第 5 次清层和持续状态，保留本次 30 帧 ICD，下一帧产生倍率 `0.75 + 0.25R`、半径 4 的物理 WeaponSkill。
- 四者使用普通 `Status`。`pkg/modifier/modifier.go:117–125` 只在 `expiry < frame` 时失效，**等号仍有效**。`character/mods.go:50–64` / `modifier.go:86–104` 的刷新用新状态替换旧状态与旧 hitlag extension；`character/hitlag.go:41–64` 延长带标志状态。`character/stats.go:25–33` 只清 StatMod，不会提前清这些 Status。

## 唯一外部执行

[配置](stateful-weapon-procs/diona-endoftheline-reference.gcsl)、[完整命令／执行记录](stateful-weapon-procs/diona-endoftheline-reference.execution.json)、[summary](stateful-weapon-procs/diona-endoftheline-reference.result.json)、[原始 debug sample](stateful-weapon-procs/diona-endoftheline-reference.sample.json)、[未舍入提取参考](stateful-weapon-procs/diona-endoftheline-reference.reference.json)。提取器只读现有文件，不调用模拟器。

- 2026-09-24 03:05:37 UTC，首次且唯一 CLI 调用，退出 0，耗时 **0.21073783398605883 秒**。没有失败或重试，没有构建／安装／随机种子搜索。
- 固定二进制 SHA-256 `2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`；结果记录同 revision、`modified=false`。实际配置 `hitlag=false`；JSON 的 false 字段按源 `omitempty` 省略，保留的 `def_halt=true` 不是启用 hitlag。
- 迪奥娜 C0、等级 1／突破 0、三个有效天赋 1；竭泽 R5、等级 1；无圣遗物，手动移除默认 5% 暴击以固定 CR=0。单目标等级 90、抗性 10%、坐标 `(0,2)`、半径 0.25；角色全程在场，无敌人攻击。
- 一次统计迭代种子 `942646285147619496`；同次 CLI debug 样本种子 `13679379115129225248`。两者独立，不声称随机序列相同。迪奥娜产球与普通攻击回能仍可能抽样；它们不改变本样本伤害。未改变采样结果或重跑。

| 事件 | 实测帧／结果 |
|---|---|
| 战技执行 | 1、400、800 |
| 激活竭泽 | 1（效果预期到 901，激活 ICD 到 721）；800（效果预期到 1700，激活 ICD 到 1520） |
| 第一轮触发／伤害 | 11→12、189→190、341→342 |
| 第二轮触发／伤害 | 810→811、989→990、1141→1142 |
| 计数 | 1、2、3、1、2、3 |
| 第三次效果移除 | status 原始 `ended=341` / `1141`；各次已排追击仍命中 |
| 激活 ICD 内的 E400 | 没有新增效果／激活 ICD；410、411 两爪命中没有追击 |
| 普通攻击序列 | 160／960 为 `Normal 0`（0.3612）；320／1120 为 `Normal 1`（0.3354）。等待没有在该源中重置普攻索引。 |

源最终 ATK = 基础 `60.209`，ATK% 与固定 ATK 均为 0；HP `802.3761`、DEF `50.358`、EM 0、ER 1.1、CR 0、CD 0.5；通用／物理／冰增伤均为 0。每次竭泽的独立快照与基底为 `60.209 × 1.6`（原始浮点中间值 `96.33440000000002`）；防御区 `(1+100)/(1+100+90+100) = 101/291`，抗性区 `1−0.1=0.9`，每次实际伤害 **30.09208577319588**。

6 次竭泽、6 次 E 爪和 4 次普攻共 16 命中。E 每爪 **7.8841264725773215**；两个普通段分别 **6.793288363298969** / **6.308053480206186**。summary 均值与 debug 逐击合计均为 **254.05995716164952**，差值 **0**。所有实际面板与数值代入字段原样保存在提取参考 `numericSnapshots`，未使用日志里格式化到两位小数的面板。

## 范围及本地对照

本外部样本只覆盖竭泽 R5 两次激活周期、战技自身触发、三次上限与移除后已排伤害、激活 ICD 内无刷新，以及普通独立物理追击的真实快照／帧序。未实测另外三件武器、等号到期命中、满能／零数量拾取、切人后台伤害、hitlag、完整迪奥娜盾生命周期或当前版本游戏机制。那些源合同与外部观测明确分开。

本地比较在 runtime/schema 冻结后执行，使用同一未舍入基础面板与明确输入的真实动作／宿主命中帧，由运行时自行激活、计数、冷却并产生追击，没有注入追击结果。先有一次解析失败，再对这个失败夹具做限定修正，之后只执行了一次完整战斗。

### 首个本地调用：配置解析失败，未执行战斗

runtime/schema owner 通知冻结及共同 validator 通过后，首调用耗时 `0.725800625` 秒、退出 1。脚本错误使用了当前仅允许祭礼持有者的 `cooldownStartFrame` 字段，配置在进入战斗前被拒绝。原始 [输入](stateful-weapon-procs/diona-endoftheline-reference.local-attempt1-config.json)、[错误](stateful-weapon-procs/diona-endoftheline-reference.local-attempt1-error.json)、[执行记录](stateful-weapon-procs/diona-endoftheline-reference.local-attempt1-execution.json) 与 [当时脚本](stateful-weapon-procs/compare-local-attempt1.mjs) 已保留。

限定修正只将 E 的 +5 延迟、360 帧冷却表示为当前支持的总间隔 `cooldownFrames:365`，删除祭礼限定的字段；实际 E1／400／800 均在这个可再次施放时间后。所有面板、宿主命中帧、倍率和武器模型未变，也不通过放宽生产 schema 绕过约束。该夹具不认证迪奥娜内部延迟 CD 队列；更正后只复验这个失败对照。

### 修正后的唯一完整战斗：通过

命令为 `STATEFUL_EXTERNAL_LOCAL_READY=1 node docs/cross-validation/stateful-weapon-procs/compare-local.mjs`。2026-09-24 03:37:42 UTC 开始，退出 0，耗时 **3.1316694590000003 秒**。保存 [实际输入](stateful-weapon-procs/diona-endoftheline-reference.local-config.json)、[完整结果](stateful-weapon-procs/diona-endoftheline-reference.local-result.json)、[逐项比较／运行时间／源码前后 SHA](stateful-weapon-procs/diona-endoftheline-reference.local-metrics.json)。127 个生产／基底夹具 TS 文件前后 SHA 全部不变。本次没有调用外部 CLI，也没有修改生产代码。

| 比较项 | 实际结果 |
|---|---|
| 外部 16 击逐值 | 全部相等；最大绝对差 0 |
| 总伤害 | 本地及外部均 `254.05995716164952`；差 0 |
| 16 个真实命中 capture → JSON → parse → replay | 全部复现差 0，且与各外部命中差 0 |
| 6 次追击通过独立计算器 builder | 每次 `30.09208577319588`，外部差 0；各文档 JSON 往返总量相等 |
| 完整 current result schema | 通过 |
| 真实技能事件 | F1 激活、F400 因激活 ICD 拒绝刷新、F800 重新激活 |
| 真实追击计数 | `[1,2,3,1,2,3]`，未从外部日志注入 |
| 移除效果与已排伤害 | F341／1141 移除；F342／1142 追击仍命中 |
| 追击 ICD 实际字段 | `[131,309,309,930,1109,1109]`；第三次保留旧值、不新增 |

本地保持静态真实面板，普通箭矢采用本地命中时取样，与源中提前 10 帧的快照数值相同；这不认证完整普通攻击快照时钟或动作编译器。宿主动作与命中帧是明确的外部观察输入，E 使用总冷却间隔表示合法性，不认证通用延迟冷却队列。没有在本地复刻无关的迪奥娜盾、随机产球或普攻回能，也未声称和 gcsim 使用同一随机序列。

本任务最终执行数：**外部 CLI 1 次成功；本地 API 2 次，其中 1 次预战斗解析失败、1 次完整战斗通过**。没有旧单元测试、全套测试、构建、第二次外部样本或额外概率采样。

所有原始外部文件、失败记录、成功输入与结果、16 份 capture／replay、6 份独立计算文档／结果及本报告的字节与 SHA-256 见 [冻结产物清单](stateful-weapon-procs/diona-endoftheline-reference.artifacts.json)。
