# 有固定来源的普攻输入链

本次新增 `packages/sim-core/src/source-action-library.ts`，把可执行的安柏 N1–N5 输入链与普通手写数字场景区分。数据来自固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，28 份源码已下载、逐份记录 HTTP 状态与 SHA-256，并归档 MIT 许可。它是 **provisional 固定参考实现**，不是官方客户端认证或完整安柏实现。

## 可调用接口

- `AMBER_NORMAL_CHAIN_CONTRACT`：运行时深冻结的来源、范围、限制及每次输入元数据。包括箭发射快照帧、命中帧、下一次普攻窗口、源码 AnimationLength；限制说明另行解释自然进入 Idle 的严格不等式。
- `createAmberNormalChainScenario()`：返回独立可编辑的 `SimConfig`。默认 4 秒，一次完整 N5；首条输入 `atFrame: 1` 与外部程序实际输入一致。
- `deriveSourceBackedRotationMappings(config)`：只有显式契约版本、固定面板与全部能力定义签名匹配才返回 `{ normalChains: { amber: [...] } }`；其他配置返回 `null`。不依据名字猜测。
- `validateSourceBackedNormalSequence(config)`：纯函数，返回 `status/contractId/issues`。检查真实输入顺序 `N1→N2→N3→N4→N5→N1`，允许停止在一个合法前缀。命令的实际时序继续交给公共合法时间线编译器。
- `assertSourceActionContract(config, options)`：由公共 `simulate()` 在迁移、schema 校验之后统一调用。JSON 导入、worker 和其他公共模拟调用都受同一限制，不仅 UI 做检查。

`N5` 是按顺序执行五次输入，不是只取第五个 hit，也不是重复五次 N1。当前安柏 C0 每次输入只有一支箭；接口仍将一次输入与其 `hits[]` 分开。`repeat 2 { N5 }` 正确在第二轮回到 N1。单次 `N1 N1`、跳过 N1、`N1 dash 12f N1` 等不会被当成合法连续普攻。

## 边界

本契约固定安柏 Lv1/20、C0、普攻天赋 1、猎弓 Lv1/20 R1，无圣遗物，无队友／增益／攻速／卡肉。角色基础 ATK `18.6984` 加武器 `23.245` 得 `41.9434`；暴击率额外减去 `0.05`，最终为 `0`，用于确定性外部对照。猎弓来源实现为 `NoEffect`；突破被动在本等级未解锁，不能由此声称其他被动、命座、E/Q、重击或瞄准已覆盖。

允许修改持续时间、静态目标等级／抗性、正常输入时点与输入延迟；保持来源标记时，不能改角色面板、能力定义、添加队友、动态增益、运行时插件、光环、多个目标或目标阶段。直接更换 `meta.version`／`dataVersion` 为用户自定义标记后，不再提供来源普攻 shorthand 或来源认证。

当前只开放连续 normal 命令，可通过 `atFrame` 表达输入延迟；不开放 dash/jump/swap/wait 的普攻重置。固定源码中未找到安柏按时间／Idle 自动重置普攻计数，但没有做客户端长间隔测量，不能补造超时规则。`timeline.swapFrames: 1` 只是 schema 必填且永远不可执行的占位值，不是声称切人占用为 1 帧。

来源在发射箭时做 snapshot，再经过默认 10 帧飞行命中。本地现有 snapshot 只有 `action`／`hit` 两种，因此样例用 `hit`，**仅凭受限静态面板保证数值等价**。没有实现一个虚假的发射 snapshot。动态效果与插件在公共入口被拒绝。

下一次普攻窗口为 `[26,22,37,34,60]`；E/Q/dash/jump/swap 的来源早期取消窗口是 `[14,10,27,26,26]`。能力定义保留这些来源数字，但本契约没有执行其他动作。不能拿早期取消窗当下一次普攻时点。源码 `CanUse` 使用 `>= Frames(next)`，自然退出动画使用 `> AnimationLength`：最后 N5 在 120 开始，下一普攻可在 180 开始，自然 Idle 为 181。能力 `animationEndFrame` 保存源码 AnimationLength，UI 以“定义动画末帧”呈现，并显示上述区别。未把 `wait(240)` 在上游队列被读取的时点 146 误认为动画结束。

## 本次执行证据

外部 gcsim `v2.44.1`、固定 commit 的 macOS arm64 二进制做了一次汇总迭代和一次样例迭代，4 秒 `amber attack:5`。随后执行一次 `node docs/cross-validation/action-library/compare-amber-local.mjs`，读取已保存的外部原始结果，不再次运行外部程序：

| 项目 | 外部与本地共同结果 |
|---|---|
| 输入帧 | `1, 27, 49, 86, 120` |
| 命中帧 | `25, 47, 86, 122, 156` |
| 逐击伤害 | `4.732408961072165, 4.732408961072165, 6.084525807092783, 6.197202210927834, 7.774671864618556` |
| 总伤害 | `29.521217804783504` |
| 帧平移 | `0`，未做后处理平移 |
| 逐击伤害／回放／独立单击计算器残差 | 均为 `0` |

N4 的箭在 122 命中，比 N5 输入 120 晚 2 帧；新输入未删除已在飞行中的上一支箭。每击执行了捕获、JSON 导出导入、完整上下文还原和独立 Single Hit 重算。该测量的源码 SHA-256 在运行前后一致，后续代码改动不冒充已重新测量。

定向测试实际执行 `npx vitest run packages/sim-core/src/__tests__/source-action-library.test.ts`：最终 6/6 通过（151 ms 的测试时间）。覆盖外部输入／伤害、两轮 N5 的计数回绕、非法输入与 JSON 公共入口、防动态上下文／来源漂移、真实输入延迟、禁止把早期取消窗当普攻窗。初次测试中的额外目标夹具漏了必需的 `enemy-0`，被 schema 更早拒绝；补成 schema 合法的双目标配置后，确认来源契约层也拒绝该场景。没有运行全性能或浏览器套件。

本增量类型检查曾执行，新增模块无诊断，但当时全树因并行编辑中的特殊反应 API／schema、其他数据映射及 rotation DSL 有错误，不能把那次执行记为全树通过。由根任务完成最后集成检查。

详细证据：

- [来源契约与数值表](cross-validation/action-library/amber-normal-contract.md)
- [28 份来源取证与哈希](cross-validation/action-library/amber-source-retrievals.json)
- [外部原始执行](cross-validation/action-library/amber-n5.execution.json)
- [本地与外部逐击比较](cross-validation/action-library/amber-local-comparison.md)
- [机器可读对照证据](cross-validation/action-library/amber-local-comparison.json)
