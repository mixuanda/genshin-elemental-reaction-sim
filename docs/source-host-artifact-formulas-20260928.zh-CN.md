# 固定来源普通圣遗物共享公式与捕获链路（2026-09-28）

本轮把固定来源中七套普通圣遗物的指定数值表达式移入共享 TypeScript AST，并让 b4、a7 来源宿主在原有修饰器数值回调中请求该 AST 的结果。改动把“公式如何算”与“何时触发、当前有几层、何时到期、攻击是否适用”分开：Go 仍负责后者，不能将 AST 覆盖范围解读为圣遗物机制已完成游戏验证。旧的[普通圣遗物生命周期审计](cross-validation/ordinary-artifact-lifecycle-source-20260928.md)记录了固定 b4 源码的事件和时序边界。

## 公式与来源状态边界

共享公式位于 `packages/sim-core/src/source-host-artifact-formula.ts`，以严格 discriminated-union 输入定义18条规则，分属逐影猎人、黄金剧团、沉沦之心、水仙之梦、苍白之火、炽烈的炎之魔女、花海甘露之光七套。规则覆盖常量二件/四件数值，以及实际层数、后台档位和反应分支计算。层数、分支等输入取自 Go 本次 modifier `Amount` 调用时交来的状态；AST 不推导触发事件，也不自行推进或清除状态。

b4 的 `packages/source-host/patches/010-artifact-scalar.patch` 与 a7 overlay 的对应宿主接线在原生 modifier 数值回调中发出 `artifact-scalar` 请求，使用共享 AST 的返回值。原生触发订阅、状态键和层数、刷新/到期任务、hitlag、前后台条件、攻击标签筛选、返回 `nil` 的不适用分支仍在 Go 代码中。因此本轮不是另造一套生命周期模拟器，也没有改变各套原生触发次数或持续时间。

固定 b4 生命周期审计中的来源待核点仍然成立：逐影猎人 `OnCharacterHurt` 留有 TODO；沉沦之心保留“过去在 Post、需检查”的旧注释；炽烈的炎之魔女“post snapshot”注释与通用 `OnSkill` 在能力函数前发事件的调度顺序存在张力。共享 AST 不裁定这些边界，也不把它们转换为额外触发。

公式节点带固定来源 commit 与对应 artifact 源码链接。`source-host-formula.ts` 将共享公式计算结果与 Go 实际返回值核对，并把实际参与的属性/反应修饰来源指向公式节点。`source-host-capture.ts` 把这些调用存于命中记录的 `supportingCalculations`；伤害公式的 `components` 仍单独表示伤害组成。两者职责不同，装备支持公式不会被伪装成伤害组件。重放会核对来源版本、支持记录的身份/集合和值以及命中计算结果。

独立计算器可将编辑保存为 `source-host-calculator-v1` JSON。公式实验只在从装备标量到末端伤害的透明路径完整关联、且没有中间不透明修饰器或变换时才传播编辑后的伤害；无法证明全链路时会保留实验结果并说明阻断原因，不把局部数值变化冒充最终伤害变化。这是当前已声明并验证的链接范围，不代表任意公式或任意宿主终端路径都可联动。

## 当前验证记录

- 共享公式核心：`source-host-artifact-formula.test.ts` 1个文件、1项测试通过；此项是构造输入/回执的核心公式测试，不是实际 Go 执行证明。命令与收据见 `docs/validation/source-host-artifact-core-20260928.json` 和同名 `.log`。
- b4 原生宿主构建一次通过，用时5.534秒；WASM SHA-256 为 `9b398482f3548e2df21f25bf03ef7ca028c69c2f0c32438981d44af90525f648`，大小41,951,079字节。收据：`docs/validation/source-host-artifact-classic-build-20260928.json`。
- a7 原生宿主构建一次通过，用时5.918秒；WASM SHA-256 为 `0fc30fad44cce69fa90455a3fc9f8d7741957460a073ff792d5266e2bfb8a840`，大小61,564,612字节。收据：`docs/validation/source-host-artifact-stellar-build-20260928.json`。
- Web 构建首次因 TypeScript 类型问题退出1（2.581秒）；修复后 retry1 退出0（3.546秒），详见 `source-host-artifact-web-build-20260928.{json,log}` 与 `source-host-artifact-web-build-retry1-20260928.{json,log}`。首次失败保留在记录中。
- 浏览器验收首轮1项失败（墙钟7.956秒）：测试取到的原生攻击标签为数值格式 `AttackTag(n)`，而断言预期名称字符串。retry1 通过1项（Playwright用例9.7秒、测试进程10.6秒、墙钟11.107秒），日志与收据见 `docs/validation/source-host-artifact-browser-retry1-20260928.{json,log}`；首次失败保留。

## 页面实际来源运行

`docs/validation/source-host-artifact-formulas-20260928.result.json` 保存了一次明确配置在两套固定来源上运行的结果。两个变体各有51个应用和1,133次 artifact-scalar 调用；Classic 共1,200条计算，Stellar共1,190条。实际出现10种规则ID，来自黄金剧团、苍白之火、沉沦之心和炽烈的炎之魔女四套；其余三套虽有共享 AST 规则，本次页面结果没有覆盖，不能写成七套全流程都经页面实测。页面 `pageErrors` 为空。

首个实际命中 application 7 引用了支持公式 ID 4、5。黄金剧团四件套 `gt-4pc` 从 ID 5 的 tier 1／0.25 切换至 tier 2／0.5；相应命中伤害由 1526.037633429651 变为 1789.1475702278665。两来源均观察到相同数值。capture 重放及导入后的主结果 difference 为0；独立公式实验导入后，用户编辑值原样恢复。

本轮新构建 WASM 的 hash/字节见上方各来源构建收据。早先完整运行凭证对应的产物身份不同，因此不能当成本轮新 WASM 的完整重执行证明；本轮页面结果与该独立 capture 重放仅支持此处列明的具体运行。

主线程另记录最终工作树 whitespace 检查 `git diff --check` exit 0（0.069秒），收据 `docs/validation/source-host-artifact-final-worktree-20260928.json`；此项不扩大功能验证范围。

以上证据只确认指定 AST、捕获/计算链路及所列构建、测试范围。它们不证明游戏内行为已验证，也不表示项目 master 要求全部完成。
