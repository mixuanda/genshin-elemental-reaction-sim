# 流浪者 C2：Classic/Stellar 共享消费者与旧档案

基线为 `6cbc4f9e380420913833581f72fe95cc4967e479`。本项只核查及修复 TypeScript 消费者，没有运行原生模拟、重建 WASM、修改旧结果或 Golden。

两模式共用 `char-dyn-wanderer-c2` 创建公式，分别接受固定源码 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`：`min((maxPoints-currentPoints)*0.04,2)`。创建时的浮空力数值保存在原向量；后续 Q 快照消费该创建回执，不以命中时已归零的浮空力重算。此数值部分没有发现 Classic/Stellar 分叉。

发现的真实缺口在 `source-host-artifact-support.ts`：此前会核对角色规则、modifier key、DmgP 槽、创建 ID、持有者、时间、源码及数值，但不核对 C2 消费命中的攻击范围。因此合法 Q 回执仅改成普攻标签后，仍把 C2 的 +200% 连接成已校验公式。独立期望为 ATK1000、倍率1、90 对90、零抗无暴时，Q 含 C2 得1500；普攻不能借此得到1500，其无 C2 算术为500。最小跨模式回归在修复前为4通过、4失败；失败均为应拒绝的范围负例。

修复收紧所有 C2 消费：请求必须为 `damage`，角色必须为流浪者，消费角色及属性读取角色必须为创建持有者，数值标签必须为6，标签名称须匹配已核对的元素爆发枚举。Classic 的 `AttackTagElementalBurst` 和 Stellar 的 `AttackTag(6)` 走同一已有别名比较器。技能显示名称不能代替标签。非伤害请求的通用 Stats 回执若挂入 C2 消费，同样拒绝；没有消费回执的创建公式自身仍正常可算。原有创建阶段、ID、数值、源码和时序检查均保留；公式值及延迟 Q 快照未改。检查约束的是记录中的作用范围，不等于独立证明所有原生触发、期限或游戏机制。

## 旧结果读取与新验证分开

基线的 `apps/web/src/source-host-panel.ts` 导入直接调用 `createSourceHostResult`，校验失败后无法赋值或启用结果导出。因此新增严格检查需要配合只读档案入口，不能把旧原件整体拒之门外，也不能给坏回执授予新验证。

新增公开接口：

```ts
openSourceHostResultArchive(originalText: string): {
  mode: "replayed" | "readonly-c2-defect";
  originalText: string;
  result: SourceHostResult;
  currentNumericValidation: "passed" | "failed";
  warning: string | null;
}
```

入口先用原保存结果 schema 检查结构及身份，再执行当前严格重放。仅捕获 `SourceHostWandererC2ScopeError`，其 `code` 为 `SOURCE_HOST_WANDERER_C2_SCOPE`，携带 `creationCalculationId` 和 `consumerCalculationId`。其他结构或数值错误原样抛出；原生新响应不接受为保存档案。原有复跑记录 wrapper 可读取其中结果，但导出应使用整个 `originalText`，保留 wrapper、空白和原身份。

`readonly-c2-defect` 的 `result` 保留原 schema、公式及 verification 元数据，旁路状态明确为本次数值验证失败。它只用于阅读；UI 必须关闭作为本次验证或独立重放的入口，原样导出使用 `originalText`。不能把历史元数据当本次通过。`createSourceHostResult`、命中捕获、独立计算与重放仍严格拒绝违规消费。共享 UI 接线由根线程负责，本提交不改 UI。

## 保留真实 Stellar 旧记录的探针

只读取根线程提供的旧24秒结果：`/tmp/GIDPS-c2-crossmode-20261023/stellar-before/run.result.json`，9599369字节，SHA-256 `a553a11ab38ee7cb5e5ec405972daeabc545e2fcfb668ece30687aabd7e98533`。以下真实记录共用创建公式3438：

| attackId | 命中帧 | 快照帧 | 动作 | 标签 | 当前检查 |
| --- | ---: | ---: | --- | --- | --- |
| 109 | 1169 | 1164 | 排队 Normal 2 (Windfavored) | `AttackTag(1)` | 拒绝 C2 消费 |
| 110 | 1169 | 1169 | Shugen C6 | `AttackTag(1)` | 拒绝 C2 消费 |
| 122 | 1284 | 1284 | Arcane Projection: Unity | `AttackTag(0)` | 拒绝 C2 消费 |
| 111–115 | 1254–1278 | 1217 | 五笔 Q，sourceFrame1162 | `AttackTag(6)` | 五笔逐一重放差值均为0 |

真实旧档案通过结构读取，返回 `readonly-c2-defect`。探针确认 `originalText` 逐字相等、schema/公式/源码身份未改、源文件字节未改。此探针读取已有结果，没有新增24秒或120秒原生运行。旧记录的三笔错误不能借新数值消费者得到通过证明；其余五笔合法 Q 可以独立验证原算术。

## 定向验证

新增跨模式测试16项：创建值及0/1/49/50/超过上限边界、五笔延迟 Q、合法结果保存重开、公式实验只改数值且不改历史命中、NA/C6/投射拒绝、数值/字符串标签不一致拒绝、持有者与读取角色拒绝、创建 ID 标记保留、非伤害通用 Stats 消费拒绝而独立创建不误挡、旧档案原文及 wrapper 导出、严格重放拒绝、其他结构/数值错误不得借只读分支吞掉。另运行原有非 C2 圣遗物消费者回归，合计17项，检查共享分支没有扩散改动。

证据目录为 `/tmp/GIDPS-c2-crossmode-consumer-evidence-20261023/`；`before-corrected-test.json` 是有效的修前范围复现，`before-nondamage.json` 保留后补非伤害负例的2项修前失败，`focused-tests-final.json` 是最终定向测试，`stellar-before-facts.json` 和 `stellar-before-real-probe.json` 保存真实旧记录观察。早期 `before.json` 曾误读独立计算返回属性名，`after-archive.json` 曾错误假设捕获入口不会自行重放；修正测试调用后仍保留全部数值和拒绝断言，且另明确断言捕获入口也拒绝旧坏消费。原始失败回执未覆盖。
