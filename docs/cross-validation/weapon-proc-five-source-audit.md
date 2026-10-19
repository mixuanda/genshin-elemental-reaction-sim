# 五把武器独立追击：固定来源与共享定义

2026-09-24。本增量扩展共享 `independent-weapon-proc.ts`，接入吃虎鱼刀、试作古华、雪葬的星银、龙脊长枪、忍冬之果。钺矛、苍纹角杯、冷寂迸音原有系数、冷却、范围、前台条件和攻击标签保持原值；仅为其补充 `weaponClass`。本报告只记录共享定义与来源合同验证，独立计算器、实际运行时、浏览器和回放接入的测试由各自报告记录。

## 共享字段与调用约定

新增武器身份 `filletblade / weapon:11305`、`prototypearchaic / weapon:12406`、`snowtombedstarsilver / weapon:12411`、`dragonspinespear / weapon:13409`、`frostbearer / weapon:14412`。`weaponClass` 为 sword、claymore、polearm、catalyst、bow 之一。

定义仅增加必要条件字段：

- `cryoOrFrozenCoefficients`：三把霜葬武器的替换倍率；不是再加一段伤害。
- `cooldownFramesByRefinement`：吃虎鱼刀 R1–R5 的冷却；该武器的旧形状 `nominalCooldownFrames` 仅表示 R1，应调用 getter 取得实际精炼值。
- `randomTrigger`：R1–R5 概率、成功比较符 `<`／`<=`、零伤害检查 `none`／`after-roll`。该对象不存在才表示无 RNG；概率 1 仍有随机调用。

公共 getter 为 `getWeaponProcCoefficient(definition, refinement, triggeringTargetCryoOrFrozen?)`、`getWeaponProcCooldownFrames(definition, refinement)`、`getWeaponProcTriggerProbability(definition, refinement)`。系数 getter 对条件武器要求明确的 true／false；缺值不会自动当作无冰。独立计算器可将该缺失转为可编辑的 blocked 条件，实际运行时则从原触发目标的回调状态取值。

## 固定源码的数值与执行门槛

| 武器 | R1–R5 ATK 倍率 | 随机成功条件 | 名义冷却 | 来源范围 |
| --- | --- | --- | --- | --- |
| 吃虎鱼刀 | 2.4 / 2.8 / 3.2 / 3.6 / 4 | roll ≤ .5，随后要求实际宿主伤害非零 | 900 / 840 / 780 / 720 / 660 帧 | 原目标单体 |
| 试作古华 | 2.4 / 3 / 3.6 / 4.2 / 4.8 | roll < .5；无零伤害门 | 900 帧 | 以原目标为中心，半径 3 |
| 雪葬、龙脊、忍冬 | 普通 .8 / .95 / 1.1 / 1.25 / 1.4；冰／冻结时替换为 2 / 2.4 / 2.8 / 3.2 / 3.6 | roll < .5 + .1×R；无零伤害门 | 600 帧 | 以原目标为中心，半径 3 |

五者均要求持有者自己且在场。吃虎鱼刀不筛选宿主攻击标签：按 actor、前台、ICD 检查后才掷随机数，随机成功后再检查零伤害，因此合格零伤回调也可能消耗一次随机数。源码写的是 `roll > .5` 时返回，等号应成功。

其余四把先检查普攻／重击标签，再抽随机数；共享接口的 `normal / charged` 对应固定源码 `AttackTagNormal / AttackTagExtra`，不是产球系统的 `normalHitEnergyTag`。试作古华不读取伤害值。三把霜葬还要求回调目标为 Enemy，R5 仍执行一次 `Rand.Float64()`，不能因概率为 1 而跳过随机流。

各次成功追击都是独立 physical / weapon-skill 伤害，使用触发回调当时的角色快照，源码 `QueueAttack(..., 0, 1)` 表示立即取样、延后 1 帧伤害。三把霜葬在原触发目标的伤害回调中读 `AuraContains(Cryo, Frozen)`，只设置一次 AttackInfo.Mult，整次 AoE 共用这份系数。不能在每个被范围命中的次级目标上重新选倍率。宿主本击新施加的冰也可能已在该回调可见，不能一概取攻击前附着。

源码在成功时建立受角色卡肉影响的 status，expiry 等号仍有效。这里保存的是名义冷却与固定来源行为，不据此认证真实游戏晶核坠落时间、移动闪避、命中几何或卡肉延长；宿主运行时需要明确自己的时序范围。

## 原式精度与独立来源交叉核对

新系数按实际源式构造，不把运算结果预先四舍五入为目录展示值：吃虎鱼刀 `2 + .4×R`，古华 `1.8 + .6×R`，霜葬普通 `.65 + .15×R`、条件 `1.6 + .4×R`；概率同样保留 `.5 + .1×R`。这保留了严格随机比较和数值重放所需的机器浮点边界。

固定版本：

- gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。
- genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。
- Optimizer `180a0a1015cb725c7570cd828eb086749960df98`。

[共享来源清单](../../packages/game-data/sources/weapon-proc-five/manifest.json) 与 [实际原文归档](../../packages/game-data/sources/weapon-proc-five/source.json.gz) 保存 24 个文件及每个原文 SHA-256：18 个 gcsim 文件与 6 个目录文件，均计入各自 LICENSE。归档 SHA-256 为 `994420b82da7377e3612039c26d588b53257182c4fc8b9e83f8d0811d9a06d1a`，压缩后 22911 bytes。其中 13 个 gcsim 原文指纹还与外部参考子任务独立读到的字节一致；包含 Charlotte 普攻／天赋、enemy 回调、AuraContains、攻击排程与范围几何，供外部忍冬样本引用。

[Optimizer 专项报告](./weapon-proc-five-optimizer-source-audit.md) 和 [15 原文清单](../../packages/game-data/sources/weapon-proc-five-optimizer/manifest.json) 保存生产 sheets、中文描述及公式依赖的 SHA-256／固定树 Git blob。40 个伤害系数位置均与目录和源式对应；Optimizer 直接给出吃虎鱼刀 5 个冷却值，但其他 20 个冷却与全部 25 个概率只有其描述证据，五份 sheet 没有 RNG／CD 调度。三霜葬 sheet 也没有从真实附着自动选分支。

吃虎鱼刀／古华 sheet 使用 `input.premod.atk`，三霜葬使用 `input.total.atk`。默认公式会将 total 指向 premod，但这不证明任意后处理／转换增益下两者等价。此次核对确认系数与指定普通快照计算范围，没有把原文相似或空 `refinementBonus`／TODO 当作全机制验证。

## 本子任务实际检查与结果

新增一个来源合同检查，读取实际归档而不是只相信报告里的派生数值，核验：24 个 gcsim／目录原文指纹，15 个 Optimizer 原文 SHA-256 与 Git blob；40 个条件系数位置、25 个冷却及概率位置；源式机器精度、随机比较顺序、未知触发目标条件、R5 仍保留随机定义。浮点源式与十进制表的比较使用小于 `1e-14` 的界限，不声称全都逐位零差。

```sh
npx vitest run packages/reaction-formulas/src/independent-weapon-proc-five.test.ts
```

唯一首跑 **1 passed / 1**，10:18:14 开始，总 **89 ms**、测试 **6 ms**、exit **0**。[原始日志](../validation/weapon-proc-five-source-contract.log)、[退出码](../validation/weapon-proc-five-source-contract.exit)。没有运行旧测试、构建或本子任务自己的外部模拟器。

来源打包脚本首次因误将 Snapshot 实现写成 `internal/template/character/snapshot.go` 而在读取时停止；找到实际 `character.go` 后修正并成功归档。该次失败不属于测试，也没有更改任何外部模拟原始产物。报告保留这一实际顺序，没有把打包首错写成全部首轮成功。

外部 Charlotte／忍冬参考由独立子任务执行，其文档与实际原始材料位于 `docs/cross-validation/frost-proc/`。共享源定义检查不代替实际多目标回调、独立随机流、冷却事件、完整回放和 UI 验证；也不将固定 released 数据身份提升为当前游戏机制 verified。
