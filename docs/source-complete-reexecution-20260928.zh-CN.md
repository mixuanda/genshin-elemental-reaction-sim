# 固定来源完整结果从头复跑核对（2026-09-28）

本轮为已保存的来源执行结果增加同一固定 Go/WASM 产物下的完整运行核对。既有数值导入与共享公式重算仍可用，但它们本身不是机制从头复跑；完整核对必须由当前页面重新执行保存的脚本和 seed 并导出本次 receipt。source-input receipt 或历史复跑 receipt 的存在也不等于本页面本次核对已通过。

## 完整结果合同

复跑请求严格从保存的结果恢复 `protocol`、完整 `config`、`seed`、`executionMode` 及来源 variant，不取当前编辑器草稿。Classic b4 与 Stellar a7 按完整固定 `sourceCommit` 选择来源。运行前读取所选 manifest 并对实际取回 WASM 字节计算 SHA-256 和大小，要求同时匹配清单与保存结果；错误 hash 在创建 Go 实例和执行前拒绝。

本次完整比对包括六域：

1. `calculations`：每个来源请求及共享公式返回；
2. `applications`：敌方目标实际伤害应用；
3. `playerApplications`：玩家受击、护盾、Drain 等回执；
4. `result`：完整来源原生统计及状态序列；
5. `logs`：完整原生事件列表；
6. `capabilities`：桥公开的能力边界。

前置身份还要求 `protocol`、`sourceCommit`、`config`、`seed` 与规范化后的 `executionMode` 一致，并要求保存记录通过 `source-host-result-v1` 与 `shared-ast-source-host-v1` formula 身份校验。对象键顺序不影响比较；数组顺序、原生值、浮点值、帧、字段存在性及嵌套结构均保留，首个差异报告为字段路径。墙钟 `elapsedMs` 不参与机制结果比较；模拟 `result.duration`、统计字段和完整原生日志均参与。

WASM hash 标识 Go 产物，不单独标识 JS 侧共享公式。系统先检查保存的 formulaVersion，再完成六域结果比对；因此 JS 公式版本与完整输出一同受约束。现有 JSON schema 对原生 `result` 与 `logs` 保持 unknown，不能只用 schema parse、总伤或抽取事件替代深比对。

## 页面行为与边界

导入会保留保存的 schema/formula 身份，重算共享数值并允许查看结果；不会自动触发完整 Go 运行。导入旧数值结果时，必须先验证保存的 formulaVersion，再调用会附着当前公式元数据的导入 helper，避免覆盖旧身份后将其冒充当前版本。没有保存 WASM hash 和字节数的旧记录可数值查看，但完整复跑按钮明确拒绝核对。

“从头复跑核对”只在新运行当前成功且完整比对通过后创建 receipt。假 WASM hash 会在执行前拒绝；日志被手工改动后可重新运行，但按首个差异拒绝通过并保留导入记录供查看/导出。导入一份曾通过的 reexecution wrapper 会清除本页面的通过状态，必须重新运行才能生成新的通过 receipt。严格模式提前中止只有停止前日志和错误，不具备完整 `result`，不可作为通过结果。

这证明的是同一记录输入、同一固定 WASM 和当前 JS 公式处理在该次完整运行中的结果相同；它不提供任意帧断点恢复，不证明固定 gcsim 实现等于当前游戏机制，也不提升 provisional/game verification 状态或整体目标完成状态。

## 本轮实际结果

### 核心与生产构建

- `source-host-reexecution.test.ts` 首轮 1 文件、2 用例通过，记录墙钟 0.428 秒；Vitest 自身 Duration 218 毫秒。见 [核心日志](validation/source-reexecution-core-20260928.log) 与[聚合检查记录](validation/source-reexecution-checks-20260928.json)。
- `npm run build` 首轮 exit 0，记录墙钟 3.457 秒；Vite 编译 669 modules、内置 build 计时 635 毫秒。见[构建日志](validation/source-reexecution-build-20260928.log)。本轮没有新的 WASM 构建；复跑使用已有执行器产物。
- 新增页面聚合 Playwright 首轮通过 1/1；用例计时 2.9 秒，runner 总计 3.7 秒，记录墙钟 3.928 秒。见[浏览器日志](validation/source-reexecution-browser-20260928.log)。

### 两来源逐次结果

Classic 使用已保存的 6 秒 Noelle 普攻脚本、seed `1` 完整复跑。receipt 来源 commit 为 b4，WASM 为 41,920,581 bytes、SHA-256 `5eacb29bec79827710457c876c5075ac6f4dae9371c316095776541bc13fe3d0`；本例逐一核对 1 calculation、1 application、0 player application、35 条 log event。原生模拟时长 360 帧，总伤 `1609.831987036225`，DPS `268.30533117270414`。实际动作队列日志为 sequence 1 在帧 1 排队、帧 13 接受、帧 40 开放下一输入窗。完整回执保存在[Classic 实际结果](validation/source-complete-reexecution-20260928.result.json)。

Stellar 页面新运行 4 秒 Noelle 普攻脚本后又从头复跑；两次结果完全一致。receipt 来源 commit 为 a7，WASM 为 61,527,503 bytes、SHA-256 `325459ac0aefb3fbf7e9173a8aa7f47ef2be53b02642a8009dd17ecc2de92eed`；本例核对 1 calculation、1 application、0 player application、34 条 log event。原生模拟时长 240 帧，总伤 `1609.831987036225`，DPS `402.45799675905624`。动作在帧 1 排队并接受，帧 28 开放下一输入窗。完整回执保存在[Stellar 实际结果](validation/source-complete-reexecution-stellar-20260928.result.json)。

Classic 的 6 秒源轨迹来自此前实际运行后保存的结果；本轮为该轨迹重新执行 b4 产物。Stellar 是本轮页面内新建 4 秒运行并进行完整复跑。两条 WASM SHA 与保存记录一致；不将构建工件身份说成新构建。

### 页面负向路径

首轮页面用例还验证：手工更改原始日志后，新复跑因 `logs[n].msg` 差异拒绝通过，原输入仍可查看；伪造 64 位零 hash 的记录在运行前以执行器不匹配拒绝；导入先前导出的复跑 wrapper 后页面显示尚未在本页完成核对，旧 pass 不继承。页面上编辑器脚本故意改为无效内容后，复跑仍使用保存脚本，确认复跑输入不是当前草稿。测试和结果文件为上述[页面日志](validation/source-reexecution-browser-20260928.log)及两个实际结果 JSON。

## 验证解释

`source-host-complete-reexecution-v1` receipt 的 checkedFields 和具体计数证明这两份结果执行了六域完整比较；输入 receipt、单击共享公式恢复、相同总伤或旧 receipt 导入均不能替代该过程。结果仍标记 `verification=provisional`、`explanationStatus=partial`。本批没有新增 WASM 构建，没有实现任意 checkpoint/中途状态恢复，也没有进行游戏内验证；只核对报告中列出的两条保存输入与当前固定产物运行。
