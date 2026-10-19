# 无后续攻击与自主实体：完整施放来源审计

本批覆盖 12 个 C0 限定施放，协议为 `explicit-idle-stance-v1`。完整性来自显式输入、完整观察窗口与全部自主实体伤害的展开；原有初击倍率相同，不足以证明完整施放。

来源为固定 gcsim 提交 [`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541)。目录与原始 genshin-db 数据使用固定提交 [`49a6544a6c6ae36089cb42fa591fc46f01de8bcf`](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf)。这属于 `fixed-source-provisional`，不宣称当前游戏实测一致。

## 交付与证据

- `packages/game-data/src/character-mappings/idle-stance-mappings.ts`：映射、类型及精确的旧行替换集合。
- `packages/game-data/sources/idle-stance-casts/definitions.json`：12 个施放、15 类伤害，供目录与核心共同读取。
- `packages/game-data/sources/idle-stance-casts/manifest.json`：逐文件 SHA-256、Git blob SHA-1、倍率绑定及归档摘要。
- `packages/game-data/sources/idle-stance-casts/source.json.gz`：151 个相关原始文件，包括 111 个角色 Go 文件、25 个公共实现文件、两份 LICENSE 与 13 份 genshin-db 原始数据文件。不是完整仓库或单一大归档的副本。

所有归档文件的 Git blob 摘要均对应上述固定提交。18 个实际使用的天赋倍率向量在全部 15 级与活动目录及归档原始数据逐项相等，容差为 0；未扩大容差或替换冲突系数。钟离 A4 另按源码固定 `0.019 × HP`，突破等级至少为 4。

本层的 `instanceCount=1` 是代表性倍率行。一次动作的实际次数、时间、取样与完整性由核心编译，不能直接相加 15 个模板行，更不能让目录代表行绕过生命周期要求。

## 完整动作的边界

所有时间均相对施放开始，以帧计；明确无卡肉、未声明中断、再次施放、实体替换、外部攻击或未知先存状态。每个候选伤害均须给出接触结果；有接触才计算伤害，缺少信息不能自动视作成功。

角色状态使用的 modifier 在其终止标记帧仍可能有效。观察必须越过该帧；实体实际删除与已经发出的尾段则按各自任务实现处理。证据包括 `pkg/core/player/character/mods.go`、`pkg/modifier/modifier.go`、`pkg/core/task/task.go`、`pkg/core/core.go`、`pkg/core/attack.go`，均已归档。

| skillId | 限定完整施放 | 必须展开的伤害与观察窗口 |
| --- | --- | --- |
| `idle-razor-burst-c0` | 新鲜 Q，`hexerei=false`，无后续普攻 | 初击取样/命中 32；状态标记至 932，观察至 933。后续普攻列表为空，因此没有狼追击。 |
| `idle-zhongli-hold-skill-c0` | 长按新建唯一岩脊，无其他构造 | 长按与柱初击均在 48；共鸣 `48+120n`，`n=1…15`；柱寿命至 1908。 |
| `idle-tartaglia-skill-c0` | 从 Idle 切近战，无任何后续攻击 | 初击取样/命中 16；姿态终止标记 1800，观察至 1801；无原有断流及击杀链。 |
| `idle-yanfei-burst-c0` | 新鲜 Q，无后续重击 | 初击取样 0、命中 24；灼灼标记 901，900 帧最后赠印标记至 1500，观察至 1501。 |
| `idle-ayato-skill-c0` | 新鲜 E，无瞬水剑 | 水影在显式 `illusionDelay∈[35,360]` 同时取样/命中；姿态标记 360，观察至 361。 |
| `idle-nilou-skill-c0` | 新鲜 E，不续舞 | 初击生命基数取 0，其余进攻面板及命中 16；状态标记 600，观察至 601；不是三段舞。 |
| `idle-wanderer-skill-c0` | 新鲜 E，无元素吸收、无后续攻击，显式结束 E | 初击取样/命中 2；结束 E 明确位于 28…599，观察至结束后 26 帧落地。 |
| `idle-alhaitham-skill-c0` | 零镜 E，明确点按/长按，无后续攻击 | 点按初击 19、生成镜 15、失镜 248/481；长按初击 28、生成镜 23、失镜 256/489；观察至最后失镜。 |
| `idle-mika-hold-skill-c0` | 显式单敌长按，其他合格敌人数量 0 | 主箭取样 12、命中 15；灵风标记至 732，观察至 733；自然零碎片。 |
| `idle-kaveh-burst-c0` | 新鲜 Q，无已有或新生成草核、无后续攻击 | 初击取样/命中 36；状态标记 756，观察至 757。 |
| `idle-gaming-burst-c0` | 新鲜 Q，无 E 或特殊下落 | 36 回血并启状态，初击取样/命中 60，61 派出文仔；显式返回延迟后回到自身，观察至 `max(757,61+delay)`。 |
| `idle-chiori-skill-c0` | 无构造、无裁锦后续的单个袖；明确点按/长按 | 点按初击 21、人偶 60/276/492/708/924，寿命 1069；长按初击 37、人偶 75/291/507/723/939，寿命 1084。 |

空动作列表仅表示使用者没有后续输入。它不会取消钟离或千织自主伤害，也不会替散兵执行结束动作。

## 数值与所有权细节

### 钟离：两个取样时点与护盾减抗尾段

`zhongli/skill.go` 的长按伤害读取施放时的进攻面板与 A4 生命，命中为 48。`zhongli/stele.go` 在 48 创建岩脊时读取柱初击与后续共鸣的快照及 A4 生命，并每 120 帧检查岩脊仍存在。这里限定唯一岩脊，无其他构造参与共鸣，无破坏和重建。

护盾在两个 48 帧伤害之后建立，因此两个初击不能使用本次护盾的自产减抗。无受击且目标始终在 7.5 米范围内时，盾到 1248 帧，最后 1236 帧刷新减抗至 1296 帧。于是前 10 次共鸣享有 20% 减抗，后 5 次没有；每击必须扣除面板已经计入的自产份额。证据为 `skill.go`、`stele.go`、`shield.go`、`construct.go`、`asc.go` 与公共盾、构造处理实现。

### 初击生命或精通与进攻快照分开

妮露初击的生命基础在 0 帧读入，其他进攻属性在 16 帧快照。艾尔海森初冲的精通基础在 0 帧读入，攻击面板在点按 19 或长按 28 帧快照；A4 不加初冲。两者不能因为普通伤害公式方便而合并取样时点。

零镜 E 直接生成 2 镜，是艾尔海森技能本体的 `skillMirrorGain()` 分支，**与 A1 解锁无关**。后续投射有自己的普攻/重击/下落命中触发器；本分支未输入这些动作，故没有投射。

### 三个不能凭空补全的后续

- 散兵：源码每 6 帧扣空居力，但扣至 0 不会自行执行 `skillEndRoutine()`。限定 28…599 帧显式结束 E，随后完整观察 26 帧落地；不虚构 600 帧自然退出。无 A1 吸收须实际声明，避免遗漏初击前生效的火攻击和冰暴击，以及水改变寿命。
- 米卡：`makeRimestarShardsCB()` 搜索 10 米范围内除主箭目标外的敌人。单敌分支自然生成 0 碎片，不能把碎片伤害加回主目标；多敌分支不由本模板覆盖。
- 嘉明：文仔返回只重置 E 冷却及调用命座逻辑，C0 不自动施放 E、特殊下落或另一击。完整窗口须覆盖其真实返回，即使返回晚于猊兽共舞状态。

### 其他被动与反应边界

烟绯 Q 的伤害加成仅针对重击，A4 只由重击暴击触发；初击可能受先前 A1 增伤影响，实际份额与输入已含份额必须明确。雷泽 A1 冷却重置与 A4 充能不加 Q 初击；其魔导分支明确关闭。绫人 A1 浪闪增量与瞬水剑生命附加不加水影爆破。妮露未续至第三段不会创建金杯丰馈、祈月或水环，并要求相关旧状态不存在。

卡维 Q 会处理草核，故此分支必须明确范围内无已有草核、也没有本次新生成草核；不能把外部反应拥有者的伤害算作卡维本体，或遗漏其被主动引爆的生命周期。

千织每次上挑/人偶攻击都分别读取当时 ATK 与 DEF。无构造不会生成额外袖，且本分支没有先前 A4 岩伤。A1 解锁后，空后续输入使点按 104 或长按 119 帧自动获得岩附魔；没有普攻输入就没有额外伤害，其 300 帧窗口结束早于人偶寿命。A1 未解锁时没有该附魔。

## 倍率绑定

全部为 15 级精确匹配；角色目录的绫人标识为 `kamisatoayato`，gcsim 目录为 `ayato`。

| 角色 | gcsim 字段 | 目录字段 |
| --- | --- | --- |
| 雷泽 | `burstDmg` | `combat3.param1` |
| 钟离 | `skillHold` / `skill` / `skillTick` | `combat2.param4` / `param1` / `param2` |
| 达达利亚 | `skill` | `combat2.param1` |
| 烟绯 | `burst` | `combat3.param1` |
| 神里绫人 | `skill` | `combat2.param6` |
| 妮露 | `skill` | `combat2.param1` |
| 流浪者 | `skill` | `combat2.param1` |
| 艾尔海森 | `rushAtk` / `rushEm` | `combat2.param1` / `param2` |
| 米卡 | `skillHold` | `combat2.param2` |
| 卡维 | `burst` | `combat3.param1` |
| 嘉明 | `burst` | `combat3.param1` |
| 千织 | `thrustAtkScaling` / `thrustDefScaling` | `combat2.param5` / `param6` |
| 千织 | `turretAtkScaling` / `turretDefScaling` | `combat2.param1` / `param2` |

米卡 `skillExplode` 不属于单敌分支，不列入采用向量计数。钟离固定 A4 不是天赋向量，单独记录在 `fixedCoefficientBindings`。

## 精确替换范围

只替换以下 12 个 `SourceHitMapping.id`。它们与旧技能 ID 不同，均保留实际的 `-hit` 后缀。

```text
razor-burst-burstdmg-hit
zhongli-skill-skillhold-hit
tartaglia-skill-hit
yanfei-burst-burst-hit
ayato-skill-hit
nilou-skill-hit
wanderer-skill-hit
alhaitham-skill-rushatk-hit
mika-skill-skillhold-hit
kaveh-burst-burst-hit
gaming-burst-burst-hit
chiori-skill-thrustatkscaling-hit
```

本次数据制作完成了固定文件与倍率证据核对；未运行构建、项目测试或游戏实测。核心协议、界面接入及最终验收属于整批集成工作，不能从数据文件存在推断已经完成。

## 可复用上下文示例

以下是 `idle-chiori-skill-c0` 点按分支的 `gameContext.idleStanceCast`，用于使用者已经观察到六次接触、没有后续动作且基础面板稳定的场景；不是预设命中保证。天赋、突破、C0和实际面板仍由完整计算文档提供。

```json
{
  "casterId": "chiori",
  "targetId": "enemy-1",
  "freshCastConfirmed": true,
  "noHitlag": true,
  "noInterruption": true,
  "noReplacement": true,
  "fullObservedLifetime": true,
  "observedThroughFrame": 1069,
  "statsStableAcrossHits": true,
  "followupActions": [],
  "targetContacts": {
    "initial": true,
    "doll-1": true,
    "doll-2": true,
    "doll-3": true,
    "doll-4": true,
    "doll-5": true
  },
  "chiori": {
    "hold": false,
    "noGeoConstructs": true,
    "priorA4Inactive": true
  },
  "sharedState": { "includedDamageBonus": 0 }
}
```

独立命中只读取本击数值状态，不要求填写未来 `followupActions` 或 `observedThroughFrame`。千织独立人偶可用 `sharedState.chioriA4Active` 明确本击状态；烟绯独立命中可用 `yanfeiA1Seals`；钟离独立命中可用 `zhongliShieldReductionActive`。这些实际份额与输入已含的 `includedDamageBonus` 或 `includedResistanceReduction` 分开记录。

每个实际命中ID为 `skillId:candidateId`，逐击 `hitStates` 用完整ID覆盖 `sharedState`。常规快照键是 `sample:<frame>`；妮露与艾尔海森另外支持 `scaling:0`，也可直接提供 `scalingHp` 或 `scalingEm`。没有独立起手数值时，必须明确该数值与当前面板相同；完整分支的稳定基础面板声明亦可建立这一相等关系。

最终JSON保留 `idleStanceEvent`、公式AST、输入份额与 `finalizedHitEvents`。来源重新准备会恢复倍率；已转换日程的事件身份改变后，旧面板会被阻塞，需重新应用构筑或恢复真实新快照。完整分支要求的观察终点来自编译器，不从用户勾选的命中次数反推。

## 2026-09-25统一集成记录

公共模型、注册、来源编译、准备／转换／重置、公式AST与正常控件已接入，JSON保留实际事件、逐击状态及权威历史快照。已发生单击只检查所选命中的依赖；未选命中缺少未来记录不会阻塞本击，完整施放仍需全部资格及生命周期观察。

统一数据命令首轮通过，实际`.22`为120身份、1157命中模板、636条件完整动作、34部分动作、11阻塞，自动团队就绪0。本轮四组新增30条件完整动作，替换34旧部分动作并解除7男性来源冲突阻塞。证据见[生成](../validation/lifecycle-maxhp-data-generate.log)、[校验](../validation/lifecycle-maxhp-data-check.log)、[状态](../validation/lifecycle-maxhp-data-status.log)。

唯一新增[核心聚合](../../packages/sim-core/src/lifecycle-source-batch.test.ts)4组用例首轮全部通过（Vitest 3.08秒，墙钟3.533秒），[原始日志](../validation/lifecycle-source-batch.initial.log)和[退出状态](../validation/lifecycle-source-batch.initial.exit)保留。每组一条完整转换／JSON／独立单击链路，其余分支只核对来源排程及必要条件；没有重复旧角色套件或性能基线。运行时验收不能反向提升固定来源为游戏内实测或团队就绪。总记录见[生命周期与最大生命扩展](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。
