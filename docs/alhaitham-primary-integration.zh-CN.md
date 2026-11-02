# /goal 艾尔海森 C0 单次镜投射接线

本文件保留初次C0接线记录；C1–C3新增合同、导入精度门与当前限制见 [C1–C3接线增量](./alhaitham-c1-c3-integration.zh-CN.md)。

基线 `9ce6a04`；本提交只新增角色模块。此前 `getCharacterDocuments('character:10000078', 10)` 有10个入口、0个投射入口，复现记录在 `/tmp/GIDPS-role-alhaitham-evidence-20261023/before-repro.json`。新增一次1/2/3镜投射，可单选其中实际一段；不包含触发它的普通攻击、重击、下落，亦不计算镜生成/消失/后续循环。

公共接线由根线程完成：

| 位置 | 精确接口 |
| --- | --- |
| 严格 `gameContext` schema | `alhaithamDamage: alhaithamDamageContextSchema.optional()`；schema导入 `packages/sim-core/src/alhaitham-damage-context.ts`。 |
| source prepare/reset/finalize | `prepareAlhaithamDamageDocument(document: CalculatorDocument): CalculatorDocument`；`resetAlhaithamPanelAccounting(document: CalculatorDocument, mode: 'fresh-equipment' \| 'imported-final'): void`；`finalizeAlhaithamPanelAccounting(document: CalculatorDocument): void`。模块路径 `./alhaitham-damage-formulas`。最终转换仍保留原生精通和A4的可执行公式，freeze签名包含角色等级、有效E天赋、突破、命座、镜数与必要状态。 |
| classified mapping registry | 导入并展开 `alhaithamPrimaryMappings`，来源 `packages/game-data/src/character-mappings/alhaitham-primary-mappings.ts`；同模块导出 `alhaithamPrimarySourceEvidence`、`ALHAITHAM_MIRROR_ATK_VALUES`、`ALHAITHAM_MIRROR_EM_VALUES`、`ALHAITHAM_PROJECTION_TIMING`。 |
| character documents | 调用 `extendAlhaithamDocuments(documents: CalculatorDocument[], workspace?: RuntimeWorkspace): CalculatorDocument[]`；同模块另有 `alhaithamCatalogVectorIssues(workspace: RuntimeWorkspace): string[]`。已有分类入口就地初始化，不重复追加，完整核对E的六组15级向量。非本角色与preview不扩展。 |
| constellation scope | `isAlhaithamDamageAction(document: CalculatorDocument): boolean` 识别本批入口，允许范围严格为 `constellation === 0`，引用 `ALHAITHAM_DAMAGE_SOURCE_REFS`；更高命座不可借C0结果。 |
| controls / requirements | 注册 `renderAlhaithamControls(document: CalculatorDocument): string` 与 `alhaithamRequirementAdapter`；现有布尔/可选数值source字段协议可直接写回。突破未知时有 `gameContext.ascension` 的明确就地控件。 |
| showcase / action drafts | 以 `talent:alhaitham:combat2` 绑定独立有效E天赋；重新导入调用reset使触发、接触、稳定性、A4已含量归未知，所选镜数情景保留。各动作旧条件的恢复与公共JSON正式注册由根接线。 |

精确入口与实例：

| skillId | hit.id | 快照与命中（相对投射触发帧） |
| --- | --- | --- |
| `alhaitham-projection-1-mirror` | `alhaitham-projection-1-mirror-hit` | snapshot+20；左39或右40，一次命中 |
| `alhaitham-projection-2-mirrors` | `alhaitham-projection-2-mirrors-hit-instance-1`、`-instance-2` | snapshot+22；左28/37或右26/35，两次命中 |
| `alhaitham-projection-3-mirrors` | `alhaitham-projection-3-mirrors-hit-instance-1`、`-instance-2`、`-instance-3` | snapshot+26；32/41/51，三次命中 |

所有入口的 `abilityId` 均为 `talent:alhaitham:combat2`。所选情景初始化对应的 `mirrorCount`，不要求玩家重复选镜数；来源镜数若未知、零或与入口不一致仍阻塞。选择情景不证明实际触发、接触或精通稳定。

`gameContext.alhaithamDamage` 字段：

- `mirrorCount?: number`（0–3整数，须匹配入口）；`projectionTriggerValid?: boolean`（前台NA/CA/下落命中敌人，且投射96帧冷却结束）。
- `masteryStableAcrossStages?: boolean`，界面为“触发到命中期间精通不变”；明确为是才共用当前实际面板的已解析精通，不额外增加精通；为否需 `triggerMastery?: number`。
- `statsAndTargetStableAcrossHits?: boolean`，多段共用其余面板及目标状态时必须为是；不同则单选实际命中。
- `hitStates?: Record<hitId, {connected?: boolean; hitTimeMastery?: number; includedProjectionBase?: number; includedA4Bonus?: number}>`。接触未知/否阻塞所选段；精通变化且A4已解锁时逐段需要命中精通；已含份额分别是伤害基数单位及增伤比例。
- `finalizedHitStates?: Record<hitId, string>` 为转换器维护。属性/状态变化后不能继续使用旧冻结面板。外来baseDamage、additiveBase或damageBonus同槽公式保留原样并产生冲突阻塞。

固定源码语义：`skill.go:projectionAttack` 在触发回调创建 `FlatDmg = mirrorEm[E] * Stat(EM)`；`QueueAttack` 延后20/22/26帧采集ATK/双暴/通用面板；`pkg/enemy/attack.go` 在目标命中处理时调用AttackMods，`asc.go:a4` 此时读取当前精通，增加 `min(0.001 * EM_hit, 1)`。两阶段精通变化时不能把后来的精通回填原生FlatDmg。每段主项为 `mirrorAtk[E] * ATK_snapshot`，原生精通贡献和A4分别减去显式已含份额；两者都不改变精通属性本身。

独立手算E10：`mirrorAtk=1.2096`、`mirrorEm=2.4192`，ATK2000、触发EM300、90对90、敌抗10%、无其余增伤、A4已解锁。主项2419.2＋原生精通基数725.76＝3144.96。命中EM300时一段非暴 `3144.96 * 1.3 * .5 * .9 = 1839.8016`，三段 `5519.4048`；命中EM1000时原生基数仍725.76，一段 `2830.464`，三段 `8491.392`。CR50%、CD100%时再乘1.5得期望。命中EM0/999.999/1000/1001边界、混合三段精通、装备精通变化及未解锁A4均有独立测试。

26个从固定GitHub revision下载的原始文件均有SHA256/Gitblob；镜投射所用六组完整15级向量每个revision90位置，共180比较位置与活动catalog完全相同。两个revision的`cons.go`仅C6内容有差异；`character/mods.go`的反应标签过滤不同，C0普通技能投射的AttackMod执行路径仍相同；manifest逐文件记录两者身份，不称全部字节一致。

验证：39项定向测试通过；只包含新增模块/测试及必要导入依赖的定向TypeScript检查通过。证据目录 `/tmp/GIDPS-role-alhaitham-evidence-20261023/` 内有 `alhaitham-unit-tests.json`、`source-audit.json`、`download-manifest.json`、空的 `typecheck-targeted.log` 和两个revision原始源码。公共schema尚未接线，测试临时adapter只在本模块prepare之后删除未注册的context字段，保留真实公式/依赖交给未修改公共引擎；根接线后应去掉该adapter，正式测试JSON、转换和真实浏览器。未执行全量或120秒无关回归。

```sh
node node_modules/vitest/vitest.mjs run packages/sim-core/src/alhaitham-damage-formulas.test.ts
python3 scripts/audit-alhaitham-primary-sources.py /tmp/GIDPS-role-alhaitham-evidence-20261023 --catalog packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json
```

源与结果均保持provisional。没有宣称支持完整镜生命周期、完整角色/队伍、Q或更高命座，亦未推断反应触发、ICD覆盖或实战轮转。
