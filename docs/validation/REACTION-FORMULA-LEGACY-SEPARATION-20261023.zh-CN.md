# 反应完整性旧失败：分离当前检查与不可变历史协议

本批基线 `23e9094`。这是**测试协议隔离修复**，没有发现新的生产反应数值或完整性漏检，没有修改模拟器、schema、生产 projector 或既有 Golden。

## 原失败及本次实际差集

先读取 `/workspace/GIDPS-cloud/failure-triage-20261022` 的逐项分类与原 `function-batch-20261022/full-current.json`。原完整记录为 3134 pass / 79 fail / 1 skip；后续完整基线 3196/79/1 仍沿用原记录，本批没有全量运行或更新该口径。

在当前基线保留原断言定向运行六项：**1 pass / 5 fail / 17 未选择**。其中一项 `project-v153-to-v152` 及四项 `reaction-formula-integrity.test.ts` 精确拒绝根及 manifest 运行选项中的 `flatStatBuffSemantics`。前者没有损失等价证明，本批保持其代码与原失败不变；已经修复的 EC 新见证入口、旧文件源输入挽救、温迪/A4/黑蚀/图莱/Shatter 不重复处理。

原反应测试将当前结果经过私有 helper 改成 V144 身份，再要求 V144 接受，之后才执行当前数值伪造拒绝断言。当前结果已明确携带 canonical flat-stat 语义，冻结旧 wire 不能表达。此次没有删除语义字段、重算旧身份或让旧 schema 接受扩展来满足这个前置条件。

先以内存诊断提前执行原当前拒绝断言，仍保留全部原断言。结果仍为 7 pass / 4 fail；这不是通过证据。但诊断确认超导等级基数、融化反应基数、超激化等级基数、蔓激化倍率、五种公式根伪造及配置／profile 伪造全部被当前边界拒绝，失败仍只发生在历史前置条件。没有据此编造生产算法补丁。

本次拆分后，原文件 **11/11**，新增历史协议测试 **8/8**，最终 **19/19**、无跳过。原 79 中以下四个具体失败现已恢复执行并通过：

- `accepts exact current results at both public and trusted boundaries`
- `rejects a coordinated Superconduct level-base rewrite`
- `rejects a coordinated Melt base rewrite`
- `rejects a coordinated 'aggravate' 'levelBaseDamage' rewrite`

原文件其他七项保持通过。不能将这个局部差集直接改报为全量 75 失败或全绿。

## 断言与历史身份如何保留

[当前测试](../../packages/sim-core/src/__tests__/reaction-formula-integrity.test.ts)保留全部原数值篡改、协调修改、重 key 和当前 public/trusted 拒绝断言。八个当前输入／篡改／校验核心函数与基线逐字一致，五处当前拒绝调用保留；只是移除跨协议前置条件。另加独立算术：免疫目标最终伤害为零，但潜在融化伤害应为 `1000×.5×.9×2×(1+2.78×100/1500+.2)=1246.8`。

[历史测试](../../packages/sim-core/src/__tests__/reaction-formula-legacy-v144.test.ts)从不可变本仓提交 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5` 的原测试获取五份 V144 wire。保留原测试在内存观察前后的原断言，其独立历史源码运行 **11/11**。六个相关源文件 Git blob 与该提交逐一核对；workspace 的 schemas、sim-core、reaction-formulas 均解析到归档自身，外部依赖才复用现有安装。

这些是该不可变测试自带的历史投影 helper 生成的**合成边界样例**，不是原 1.44 引擎实机记录或真实用户文件，也不是本次把当前 canonical 结果降格。三份故意伪造样例仍被旧 proof 接受，是保留的历史局限，不得当成当前可信结果：

| 历史样例 | 原冻结 V144 期待 |
| --- | --- |
| 合法融化 | 接受 |
| 超导等级基数×10，保持零实际伤害 | 接受，旧局限 |
| 融化基数 2→20，保持零实际伤害 | 接受，旧局限 |
| 超激化等级基数×10，保持零实际伤害 | 接受，旧局限 |
| 蔓激化倍率 1.25→12.5 | 拒绝，旧 proof 已有此约束 |

[新历史样例文件](../../packages/sim-core/src/__tests__/fixtures/reaction-formula-v144-84ff5cd.json)保存精确 `wireText`，没有让浮点值经过另一语言重新格式化；每份 wire 有 SHA256，整体 141221 字节、SHA256 `6dee5dd4000a4bfe77d811fa44bcd56710c0dbc295a0b110d086f6614c625033`。测试核对原配置 hash、运行身份、完整字节和版本，不重新签发身份。另证明当前 schema 拒绝这些历史 wire；往旧 root 或 manifest 注入当前语义字段时仍严格拒绝。样例没有更新入口，不覆盖既有 Golden。

## 验证与限制

定向 TypeScript 检查通过。只跑上述小范围原断言、诊断、归档原测试和拆分后的两份测试，没有运行全量或 120 秒，也没有新增浏览器、生产部署、账号或远端写入。

机器摘要见[本批证据](reaction-formula-legacy-separation-evidence-20261023.json)。完整本地证据在 `/tmp/GIDPS-old-failure-correctness-evidence-20261023`：原完整记录提取、`original-priority-before.json`、保留失败的诊断、历史捕获配置与五份 wire、`assertion-preservation.json`、最终测试及类型日志。剩余历史投影／Golden 仍须逐个证明可表示性；本次不会授予旧结果新的验证身份，也不改变原件只读、输入另建副本的策略。
