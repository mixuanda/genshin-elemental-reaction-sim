# /goal 阿蕾奇诺 C6：现有红死普攻单击

基线：`8b7d36227d92c4edd352c981dd2166e3aa3d2bac`。独立分支：`cloud/arlecchino-c6-20261023`。

本次只扩展已有七个 `arlecchino-red-death-normal-*` skillId。C6 必须声明本次实际命中结算时的双暴状态；没有状态仍然阻断，不能退回 C5 计算。普通未附魔普攻和现有 Q 入口没有借用本模块取得新覆盖。

## 修前复现

在未修改源码时执行：

```text
./node_modules/.bin/vitest run packages/sim-core/src/arlecchino-damage-formulas.test.ts -t 'rejects C'
1 passed / 85 skipped，5.43s
```

该原断言证明 C6 被 `ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION = 5` 阻断。修后保留 C6 缺实际状态必须阻断的断言；仅将过时的整体范围拒绝改为实际条件拒绝，原数值、30% 门槛、外来公式冲突、命中复制和历史等级断言保留。

## 固定来源与生命周期

原件来自 `source-build-cache/upstream/<revision>/source`，不是带 SourceHost 插桩的 native 构建树：

- Classic：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。
- Stellar：`a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。
- `internal/characters/arlecchino/cons.go` SHA256：`dd2b35228ec953833d0b765255e98847032b2137a2ca07d36a9b0adf3a03c83e`。
- `internal/characters/arlecchino/burst.go` SHA256：`6bf3e4030fbd50aaa7ad76d31161789ed458d67c0aa2759d14a50bc3668dafa6`。

`skill.go` 在 `finalHitmark = 38` 的角色任务中调用 `c6skill`。该函数要求 C6，并受 `15*60` 的实际触发 ICD 限制；添加的是 `NewBaseWithHitlag(c6Key, 20*60)`，**不是 10 秒**。只对 Normal / ElementalBurst 攻击标签给 CR `0.1`、CD `0.7`；同一修正键替换，不叠加成多层。

`AddAttackMod` 在触发帧设到期值；`ApplyHitlag` 延长仍生效且受卡肉影响的修正。`ApplyAttackMods` 在伤害计算之前检查到期，`expiry <= current frame` 时不再应用。它向目标本击快照增加双暴；不能仅检查一个宽松的状态查询来断言边界帧仍有双暴。

已有 NA 在各自命中任务中以 `QueueAttack(..., 0, 0, bondConsumeCB)` 立即取样并结算。C6 双暴按伤害前的实际攻击修正状态处理；生命之契仍取本击扣契前比例，消耗回调在之后。第四段两击仍分别选择、分别输入实际状态，不自动生成第二击或扣契过程。

Q 另有 `7.0 * TotalAtk * current bond ratio` 的附加基伤，在其 110f 伤害任务中取样。本模块没有实现这项 Q，也没有模拟 Q 治疗、E 触发/刷新时间线、耗契或完整轮转。

来源 manifest 保留原八条完整 1–15 级向量和原文件哈希，并新增 burst 与六条生命周期路径的双版本 SHA256/Git blob。角色九条主路径跨版本字节相同；生命周期 `mods.go` 和 template 初始化文件不同，分别保留身份，不能声称整条链字节相同或独立游戏验证。没有复制 Go 原件或变更许可证。

## API 与已含份额

`ArlecchinoDamageContext` 新增三个可选字段，旧 JSON 可继续解析：

| 字段 | 含义 |
|---|---|
| `c6Active?: boolean` | 本击伤害结算前 C6 攻击修正实际生效；false 包括未触发或已到期，缺失不猜测。 |
| `c6CritRateIncludedPercent?: number` | 所填暴击率已含 C6 的百分点，范围 0–10，允许部分包含。 |
| `c6CritDamageIncludedPercent?: number` | 所填暴伤已含 C6 的百分点，范围 0–70，可与暴击率包含程度不同。 |

补差按 `((active ? maximum : 0) - included) * 0.01` 计算，两个 maximum 分别为 10 和 70 个百分点。若旧输入包含该份额而本击增益已失效，明确的已含份额会被扣除。最终暴击概率由共享公式限幅，不能提前把源 CR 增量截小。

`fresh-equipment` 自动将两个已含份额设为 0，不推定 `c6Active`。`imported-final` 清除三个字段，要求确认实际状态和输入记账。教学入口只确定未含份额为 0，同样不制造激活状态。

现有 `prepareArlecchinoDamageDocument`、`resetArlecchinoPanelAccounting`、`finalizeArlecchinoPanelAccounting`、controls/requirements 导出签名不变；`ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION = 6`。

新增纯公式导出：

```ts
createArlecchinoC6CriticalFormula(
  stat: "critRate" | "critDamage", active: boolean, includedPercent: number
): CalculatorFormula
```

两个来源规则 ID：

- `arlecchino-damage-c6-crit-rate-b4ae769` → `critRateFormula`。
- `arlecchino-damage-c6-crit-damage-b4ae769` → `critDamageFormula`。

C6 的外来同槽公式保留并阻断，不静默覆盖；独立 ATK/EM 槽保留。转换由现有真实公共入口物化双暴，重开不再重复补加。C6 的实际状态、已含份额和最终双暴进入历史身份；角色等级等原身份维度保留。C0–C5 不追加新可选字段到旧身份数组。

控件沿用 `data-source-cast-state-field` 和 `data-source-cast-number-field` / `data-field`。不需要新的 UI 事件分支或计时器。根线程负责公共公式编辑器的来源规则锁定、最终可见浏览器闭环与集成提交。

## 独立数值

固定 Go DM 原表直接取值，再用独立 Decimal 乘区运算；没有复用计算器输出。条件：ATK 2000，命中前契 150%，NA13，90 对 90，10% 抗性，输入 CR 50% / CD 100%，未含固有 40% 火伤，无反应。

普通项 `2000 * 1.1378`；附基伤 `2000 * 1.5 * (2.884 + 1) = 11652`。非暴 `8774.388`。

| C6 实际状态 | 非暴 | 暴击 | 期望 |
|---|---:|---:|---:|
| 未激活 / 已到期 | 8774.388 | 17548.776 | 13161.582 |
| 已激活，实际 CR60 / CD170 | 8774.388 | 23690.8476 | 17724.26376 |

若角色为 100 级、敌人仍 90 级，同一输入的 C6 激活结果是非暴 `8999.372307692308`、暴击 `24298.30523076923`、期望 `18178.73206153846`。等级不得只改标签而复用 90 级伤害。

定向验证：原模块 86 项、原 web 集成 3 项与新增 C6 42 项，共 **131/131 通过**，13.96s。定向 `tsc --noEmit` 退出码 0；30 份固定原件审计通过。没有临时未接线适配，测试走真实公共计算、转换与 JSON 入口。

证据目录：`/tmp/GIDPS-arlecchino-c6-evidence-20261023`，含修前阻断、来源审计、独立原表算式、定向测试与定向类型检查。未运行全回归、WASM、120 秒模拟或部署。
