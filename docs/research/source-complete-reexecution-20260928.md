# 固定来源完整复跑核对合同（2026-09-28）

现有“导入来源结果”只调用 `createSourceHostResult(JSON.parse(text))`。它按保存的计算请求重算共享公式并检查伤害回执，却不执行 GCSL、Go/WASM 的角色动作、事件队列、资源、随机流或统计器。单击捕获的 `replaySourceHostHit` 也只恢复该击已保存的数值上下文。这两种数值回放仍有用，但不能称为完整来源复跑。入口分别在 `apps/web/src/source-host-panel.ts`、`packages/sim-core/src/source-host-capture.ts`。

## 最小复跑输入与产物身份

完整复跑只能从已保存的 `SourceHostResult` 取 `config`、`seed`、完整 `sourceCommit`、`executionArtifact.wasmSha256/wasmBytes` 与 `executionMode`（旧记录缺省值为 `auto-wait`）。不能取当前编辑器中的脚本、种子或模式。`sourceCommit === b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 精确映射 `/source-host`、`hostVariant: classic`；`=== a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 精确映射 `/source-host-stellar`、`hostVariant: stellar`。不要用 `startsWith` 选择复跑执行器。仅有 source commit 不足以区分同一固定源码上不同日期的本地桥、补丁和 WASM。

复跑前先校验保存记录的 `source-host-result-v1` schema、`shared-ast-source-host-v1` formulaVersion 和执行器哈希；不要先让 `createSourceHostResult` 重建并覆盖旧 formulaVersion。没有保存 `executionArtifact` 的旧 JSON 可以继续数值导入，但必须拒绝“完整复跑已核对”。读取所选 manifest 的完整 revision，并计算实际取回 WASM 字节的 SHA-256/大小；要求二者匹配 manifest，且 **实际字节** 匹配保存记录的哈希/大小。若当前 public 产物已经替换旧构建，明确报不匹配；可以另作新版本运行，却不能把它冒认为旧产物复跑。当前 worker 已校验 manifest→WASM，但尚未把保存结果的 hash 加入这条链（`apps/web/src/source-host-worker.ts`）。WASM hash 只标识 Go 侧；JS 共享公式由当前 worker 提供，formulaVersion 必须一致，最终全量回执比较进一步检出本输入的结果漂移。

新增核心 API 位于 `packages/sim-core/src/source-host-reexecution.ts`：

1. `sourceHostReexecutionRequest(raw): SourceHostRunRequest` 校验保存的 schema/formula/产物身份，返回保存的 `protocol/config/seed/executionMode` 与精确 `hostVariant`。
2. `assertSourceHostReexecutionArtifact(expected, actualArtifact): void` 在调用 WASM **之前** 比对 `wasmSha256` 与 `wasmBytes`。worker 仍须保留自身 manifest→实际 WASM 校验。
3. `verifySourceHostReexecution(expected, actual): SourceHostReexecutionReceipt` 在新运行完成后核对完整结果并返回字段清单及事件数；第一个差异以如 `logs[12].frame`、`result.duration` 的路径报错。若严格模式中止，wrapper 只返回 `error` 和停止前 `logs`，没有完整 `result`；这不是成功复跑的输入或输出。

## 完整比较范围

先要求 `protocol/sourceCommit/config/seed` 完全相同、`executionMode` 按旧记录默认 `auto-wait` 规范化后相同，并通过 WASM 哈希和大小。再逐字段深比较 `calculations`（所有请求与共享公式返回）、`applications`（敌目标扣血与伤害）、`playerApplications`（受击、盾、Drain 回执）、`result`（完整原生统计）、`logs`（完整原生事件）及 `capabilities`（桥公开的能力边界）。对象 JSON 键顺序没有语义，可忽略；数组顺序、帧、ID、浮点数、空值、字段存在性与嵌套字段均不可省略。现有 `sourceHostResultSchema` 对 `result/logs` 为 `unknown`，因此不能只依赖 Zod 解析或挑几项总伤作验证。

`result.duration` 是 Go 模拟帧数，不是机器耗时；`result.total_damage`、`result.dps`、每角色与敌人的统计、状态序列、区间和结束能量都属于本次固定输入/产物的完整机制结果，必须比较。`logs[].frame/ended/char_index/msg/logs/ordering` 的事件序列也必须比较，包含动作排队、接受、下个输入窗口与拒绝原因。日志 JSON 对象键顺序可忽略，事件列表不可重排。`schemaVersion/formulaVersion` 是前置身份门；`verification/explanationStatus/explanationGaps` 是当前 TS 的解释性标记，不是 Go 机制回执。worker 的 `elapsedMs`、批量运行的每项 `elapsedMs` 来自 `performance.now()`，只描述墙钟速度，不应参与机制相等性；manifest 的构建时间也不应参与。**没有理由排除模拟 `duration` 或统计数组。**

现有 worker API 是发送 `SourceHostRunRequest`（或 `SourceHostWorkerRequest.jobs`）给 `apps/web/src/source-host-worker.ts`，它选择 b4/a7、验证 manifest 与 WASM、创建新 Go 实例、调用 `gidpsSourceHostRun(JSON.stringify(request), resolver.resolve)`，用 `createSourceHostResult(native, resolver.calculations)` 交叉核对实际共享公式回调，再附上 `executionArtifact`。复跑集成应在同一流程取保存请求、运行前比对保存 hash、正常执行，并用新增 API 比较保存与新生成的完整结果；不要让 JSON 导入的原有数值回放暗中触发重跑。批量结果各有自己的 request、artifact 和 `elapsedMs`，如支持批量复跑须逐项核对，不把一个运行的哈希或种子泛用于整批。

本合同证明同一固定产物和本次共享公式在保存输入下重现了来源结果，不证明固定 gcsim 源码等同当前游戏，也不补足现有 partial 机制解释。旧产物不在 public 路径时，需要经相同哈希校验的归档执行器才能核对，不能降低比较域来让新产物通过。
