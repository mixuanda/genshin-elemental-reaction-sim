# /goal 艾尔海森 C4–C6 所选镜投射

基线 `8b7d36227d92c4edd352c981dd2166e3aa3d2bac`；独立分支 `cloud/alhaitham-c4-plus-20261023`。仅扩展现有 1/2/3 镜的单次投射入口，不实现 Q 伤害、镜生成/消失/溢出事件或整轮。旧 skillId、hitId、`gameContext.alhaithamDamage` 及 prepare/reset/finalize API 保持兼容。`ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION` 现在为 **6**。

旧门的实际复现保存在 `/tmp/GIDPS-role-alhaitham-c4-plus-evidence-20261023/before-repro.json`：E10、ATK2000、基础 EM300 加实际 C2 两层，C3 单击非暴为 2133.7344；同样条件的 C4/5/6 被公共命座门和角色条件拒绝。本批新增实际高命座状态及补差公式，不能仅把旧门放开后按 C3 代算。

新增字段均可选以兼容旧 JSON，但解锁相关命座时必须提供实际状态。原 C0–C3 没有新增必填项。

| 路径（均在 `gameContext.alhaithamDamage` 下） | 实际含义 |
| --- | --- |
| `c4SnapshotStacks?: number` | 延后进攻快照时仍有效的 C4 自身草伤份额，0–3 整数，每份来自本次 Q 实际生成的一枚镜。0 明确表示未触发或已到期；持镜数、消耗镜数不能替代它。 |
| `c6SnapshotActive?: boolean` | 实际镜溢出触发的 C6 双暴在本次延后快照时仍有效。`false` 是合法无增益情景；未知不能默认 `false` 或 `true`。 |
| `hitStates[hitId].includedC4Bonus?: number` | 本段已输入增伤中包含的 C4 草伤比例，0–0.3。以实际有效份额乘 0.1 减此值，只补差。 |
| `hitStates[hitId].c6CritRateIncluded?: boolean` | 所填面板或本段显式最终暴击率是否已含该来源的 10% 暴击率。 |
| `hitStates[hitId].c6CritDamageIncluded?: boolean` | 同理，是否已含该来源的 70% 暴伤，独立于暴击率声明。 |

新教学入口与 fresh equipment 只可证明新增来源**已含**比例为 0、双暴为 false，不替玩家确认实际激活。imported-final 清除全部新增实际及已含声明；旧 C4+ JSON 缺项时继续阻断并给就地控件，旧 C0–C3 JSON 可直接重开。实际状态、等级、有效 E 及完整角色 context 均在冻结签名中；改变它们不能重用旧转换快照。降命座后遗留实际/已含 C4 或 C6 正贡献会拒绝，不能保留高命座属性。

原 `c2RequiresActualPanelConfirmation` 标记、`c2OtherSnapshotStatsFinal` 的 unknown/false 阻断、JSON 重开保护及精通变化路径限制完整保留。C4 不给自己额外精通；队友收到 C4 后再反馈给自己的效果不在本模块制造，必须遵守既有完整实际阶段面板合同。

公式导出：

```ts
createAlhaithamProjectionBonusFormula(
  ascension: number, stableMastery: boolean, hitTimeMastery: number,
  includedA4: number, c4Stacks: number, includedC4: number,
): CalculatorFormula
createAlhaithamC6CriticalFormula(
  target: "critRate" | "critDamage", active: boolean, included: boolean,
): CalculatorFormula
```

C4+ 的 `damageBonusFormula` 使用 `alhaitham-damage-a4-c4-snapshot-b4ae769`，表达式为原 A4 命中取样补差加 `0.1 * c4SnapshotStacks - includedC4Bonus`。C0–C3 仍生成原 `alhaitham-damage-a4-impact-em-b4ae769`；旧原式是可识别自有公式，不被当成外来贡献。

C6 的 `critRateFormula` / `critDamageFormula` 分别使用 `alhaitham-damage-c6-snapshot-cr-b4ae769` / `alhaitham-damage-c6-snapshot-cd-b4ae769`，只补 `0.1 / 0.7 * (实际有效 - 输入已含)`。外来同槽式保留并拒绝覆盖。若用户另填 `hit.effectiveCritRate` / `effectiveCritDamage`，该最终覆盖会跳过角色补差，因此有非零差额时拒绝并定位原覆盖控件；应清除覆盖后补差，或填写实际最终值并修正已含声明。可信转换快照按已冻结身份保留其解析后的双暴。

根共享接线只有两处需要更新：`character-calculations.ts` 现有分支已经读取 MAX 常量，应把 C0–C3 及 C4 以上未实现文案改为当前范围；`calculator-ui.ts` 的来源锁定公式列表增加上述三个 ID。schema、source-cast、导入 reset、最终面板 finalize 及 requirement adapter 已通过角色模块引用，API 无新增绑定函数。不要把 C5 的 Q+3 再加到有效 E；E13 的独立向量仍为 ATK1.428、EM2.856。

固定来源为 Classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 和 Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，原件保存在上述 evidence 目录下按完整 revision 分组。manifest 保存每个原件的 URL、SHA256、Git blob 与字节数；审计脚本验证 32 个原件和 180 个完整向量比较位置，差值为 0，不只验证所选 E 等级。

源码时序与边界：

- `cons.go:c4Loss` 对其他队友每枚消耗镜给 30 精通，显式跳过海森；`c4Gain` 自身每枚实际生成镜给 10% 草伤，900 帧且受命中停顿影响。`burst.go` 的实际生成任务在 +184 帧、仍前台时执行；C6 强制生成数为 3，不代表任务必定执行或必定溢出。C4 同 key 的 modifier 覆盖，不能累加多个历史 Q。
- 固定源码注释说再次 Q 清除旧时限，但 `c4Gain(0)` / `c4Loss(0)` 返回且没有显式删除旧项。本批不模拟该重置或零生成生命周期，只接受已核实际有效的快照份额；不把源码注释与执行差异隐藏为已完成循环。
- `skill.go` 在镜数超过 3 时将超出数量交给 C6；`cons.go` 首次给 360 帧，已有效时每个超出镜再延长 360 帧，增加剩余时限而非重置为 6 秒。`Stats()` 在 expiry <= 当前帧时排除属性。本批不从持镜数猜资格，也不运行计时器。
- Classic C6 `StatMod` 标记 `AffectedStat=CR`，Stellar 删除该字段；实际投射快照在 `template/character/character.go` 调用 `CharWrapper.Stats()`，该函数累加完整属性向量而非单属性筛选，因此两个版本均取得 10% CR 和 70% CD。C4/C6 在触发 +20/+22/+26 帧取样，之后即使在命中前到期也不抹去已取得的进攻快照；A4 仍在命中时读取精通。
- C5 仅设置 `BurstCon=5`。本批不声称完成 Q；固定 Q 源码 ATK 倍率取 `TalentLvlBurst`、EM 倍率取 `TalentLvlSkill` 的差异仍需另批专项证明。

独立手算（90 对 90，10% 抗性）：E10、ATK2000、实际 EM400，原生基数为 `1.2096*2000 + 2.4192*400 = 3386.88`，A4 为 0.4。C4 三份使非暴为 `3386.88 * 1.7 * .5 * .9 = 2590.9632`；CR0.5/CD1 下期望 3886.4448。实际有效 C6 后 CR0.6/CD1.7，暴击 6995.60064，期望 5233.745664。E13 同条件非暴 3058.776、C6 期望 6178.72752。100 级角色对 90 级目标的防御乘区为 200/390，E13 三镜 C6 期望为 19011.46929230769；这些独立 Decimal 算式在 `independent-arithmetic.json`，不是从实现输出反推断言。

定向测试保留旧 61 项并新增 22 项，包括 C4 0–3、C5/E13、C6 逐实例/已含/过期/暴击率上限、触发与命中精通分离、外来同槽、最终覆盖冲突、import/fresh、旧 JSON、转换重开、降命座和实际面板标记保护。角色源码的定向 TypeScript 检查通过。本批不 push、不部署、不重试之前被拒的发布操作；根负责公共接线和真实浏览器验收。
