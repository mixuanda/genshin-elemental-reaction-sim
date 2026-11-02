# /goal 基尼奇 C0/C1 所选 E 伤害接线

基线 `9638c78`；本提交只新增角色独立文件，不修改公共模型或执行路径。父线程统一接线后，再验证真实展示柜导入、保存重开和浏览器 UI。

导出与接线：

| 公共文件 | 精确导出／接线 |
| --- | --- |
| `calculator-model.ts` | 从 `./kinich-damage-context` 导入 `kinichDamageContextSchema`；在严格 `gameContext` 内加 `kinichDamage: kinichDamageContextSchema.optional()`。 |
| `source-cast-context.ts` | 从 `./kinich-damage-formulas` 导入 `prepareKinichDamageDocument(document: CalculatorDocument): CalculatorDocument`、`resetKinichPanelAccounting(document, mode: 'fresh-equipment' \| 'imported-final'): void`、`finalizeKinichPanelAccounting(document): void`，分别加入既有 prepare/reset/finalize 链。转换后保留可执行 A4 公式；最终暴伤由公共转换器冻结，不再补 C1。 |
| `classified-hits.ts` | 导入并展开 `kinichDamageMappings`（`packages/game-data/src/character-mappings/kinich-damage-mappings.ts`）。完整 15 级 E 向量逐项核对，不能按名称或仅选定等级匹配。 |
| `character-calculations.ts` | 导入 `extendKinichDocuments(documents: CalculatorDocument[], workspace?: RuntimeWorkspace): CalculatorDocument[]`，在最终 `getCharacterDocuments` 返回链调用；已有分类结果会就地初始化，不重复追加。`applyCharacterConstellationScope` 为 `isKinichDamageAction` 增加仅 `constellation <= 1` 允许分支，引用 `KINICH_DAMAGE_SOURCE_REFS`；最终仍走公共 prepare 链。 |
| `calculator-ui.ts` | 导入并渲染 `renderKinichControls(document: CalculatorDocument): string`。使用已有 `data-source-cast-state-field` 与 `data-source-cast-number-field` 写回，不需要新事件协议。技术记账默认折叠。 |
| `calculator-requirements.ts` | 注册 `kinichRequirementAdapter`；接口完全符合既有 `CalculatorRequirementAdapter`。 |
| `calculator-import.ts` | 既有 `resetSourceCastPanelAccounting(doc, 'imported-final')` 接线后会清除不能由展示柜证明的战斗状态与 C1 已含量。新命中显式附加基数为 0 且无历史/装备固化记录时，A4 已含量可确定为 0；自定义非零或历史保持未知。必须按 `talent:kinich:combat2` 要求导入的有效 E 等级，不借 NA 或 Q。 |

精确入口：

| `skillId` | `hit.id` | 范围 |
| --- | --- | --- |
| `kinich-loop-shot-single` | `kinich-loop-shot-hit` | 环绕射击实际一击 |
| `kinich-loop-shot-pair` | `kinich-loop-shot-pair-hit-instance-1`、`kinich-loop-shot-pair-hit-instance-2` | 同次输入两击；两次均接触同目标且面板/装备/目标状态相同时合计 |
| `kinich-scalespiker-cannon` | `kinich-scalespiker-cannon-hit` | 单炮；实际夜魂加持且请求前 20 点 |

三者 `abilityId` 都是 `talent:kinich:combat2`。默认不推断夜魂已生效、满点或心得；C1炮自动按命座补未含的 100% 暴伤。A4 消耗 0–2 个实际有效层数，每层 `3.2 × 动作创建时TotalAtk` 加在伤害基数；零层不要求起手攻击力。固定源先调用 `a4Amount()` 再在稍后释放时耗夜魂并取快照，因此有层数时必须独立提供起手攻击，不能默认使用炮命中面板。

`kinichDamage` 字段：`nightsoulBlessingActive?`、`cannonPointsBeforeUse?`（0–20整数）、`a4Stacks?`（0–2整数）、`a4CreationAttack?`、`includedA4BaseDamage?`、`c1CritDamageIncluded?`、`bothLoopHitsConnected?`、`statsStableAcrossHits?`、`finalizedHitStates?`。最后一项为转换器记录；改变角色等级、有效E等级、命座、突破、作用域、选择或状态后拒绝复用旧冻结面板。已有外来基伤或同槽公式不被静默覆盖。

独立数值：角色/敌人90级、攻击2000、暴率50%、暴伤100%、敌抗10%、增伤0、无反应与A4，E10 环绕单击非暴 `927.936`／期望 `1391.904`，同次双击非暴 `1855.872`／期望 `2783.808`；C0炮非暴 `11136.528`／期望 `16704.792`，C1炮非暴相同／期望 `22273.056`。C1炮两层心得、创建攻击1800时非暴 `16320.528`／期望 `32641.056`。

29 项独立单元通过。公共 schema 尚未接线，测试 adapter 先执行本模块 prepare，再删除扩展 context 字段，保留真实公式和依赖由未修改的公共计算器求值；这不等于已经验证生产接线或真实 UID。证据在 `/tmp/GIDPS-role-kinich-evidence-20261023/`：`kinich-unit-tests.json`、`source-audit.json`、`download-manifest.json` 及两个 revision 的原始文件。完整项目 tsc 仅报告稀疏基线缺失的 3 个历史 fixtures 及其衍生隐式 any，无新增角色模块诊断；根完整工作树统一复核。

源码审计命令：

```sh
python3 scripts/audit-kinich-damage-sources.py /tmp/GIDPS-role-kinich-evidence-20261023 --catalog packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json
node node_modules/vitest/vitest.mjs run packages/sim-core/src/kinich-damage-formulas.test.ts
```

已核对两固定源共16文件的 SHA256/Git blob，所用 E 两组15级向量各 revision 均与活动 catalog 完全一致（共60比较位置、差0）。A4 固定源按 tag 读取但未在消费处校验15秒过期，故本入口只接受实际未过期层数，不宣称复现完整生命周期。A1燃烧/烈绽放只产夜魂点，不直接增炮伤；本批不生成燃烧、产点、夜魂迸发、CD、产球或轮转。Q与C2以上明确未覆盖。
