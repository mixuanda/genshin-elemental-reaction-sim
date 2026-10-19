# 来源角色治疗、冷却覆写与公式逐步追踪（2026-09-28）

## 实现范围

本轮在原 35 条来源角色 scalar 规则上新增 3 条派生公式记录：Durin 黑形态 A1 一条、Ifa a7 两种反应分支各一条。046 补充 helper 的真实输入叶：Durin 保留 `IsHexerei` 与队伍魔导人数的读取分支，Ifa 保留逐位队员夜魂读取、Condition 错误和浮点数分支。共享 AST 展开这些已由 Go 读取的状态，不替代原 helper 的队伍访问或日志。

[047 patch](../packages/source-host/patches/047-character-healing-overrides.patch)为 Arlecchino、Clorinde 的治疗接收路径增加共享记录：阿蕾奇诺只把自己的指定爆发治疗交给原角色接收函数，其它来源仍由原覆盖分支拒绝；克洛琳德在战技外委托正常接收、本人符合条件的 Impale the Night 战技治疗也走原接收路径，战技中的其它治疗先按突破分支换算生命之契，再由原逻辑压制角色 HP 治疗。capture 关联基础量、倍率／覆写及实际接收记录，独立计算器允许编辑单次数值公式而保留原始捕获。

[048 patch](../packages/source-host/patches/048-cooldown-overrides.patch)记录冷却请求及角色路由，不接管真实冷却队列。规则覆盖 Cyno 两来源的动作分发，Varka 两来源不同的特殊技能路由，以及仅 a7 的 Odette 路由；Thundering Fury 的来源请求仍是 60 帧。如雷触发门、修饰器读取、分发队列、充能和 worker 调度继续由 Go 执行。经典 Varka 四风计时器的共享算式保留 `max(expiry - reduction, currentFrame)`，结果用于原生重排任务；不是独立模拟冷却队列。

## 统一公式执行细节

核心新增 `executeFormulaExpressionDetailed`，沿用同一 AST evaluator，返回最终值及子表达式实际执行顺序、中间结果和条件分支选择。Web 的共享 trace renderer 用可展开区域显示这些步骤。独立计算器导出完整报告时另加 `executionDetails` sidecar；旧计算 JSON schema 保持兼容，sidecar 从已保存公式与输入派生，不改变原公式结果。

本轮改动文件包括 [Durin／Ifa 派生规则](../packages/sim-core/src/source-host-character-scalar-rules-b.ts)、[冷却公式](../packages/sim-core/src/source-host-cooldown-formula.ts)、[治疗捕获与计算](../packages/sim-core/src/source-host-healing-capture.ts)、[冷却捕获与计算](../packages/sim-core/src/source-host-cooldown-capture.ts)、[AST 逐步执行](../packages/sim-core/src/calculation-trace.ts)和 [Web trace renderer](../apps/web/src/calculator-trace-view.ts)。这些固定 b4／a7 来源语义仍是 provisional；没有改动正式、preview 或 verified 数据指针。

## 收据与实测范围

两条 Go 构建首次通过：classic 5.550 秒，stellar 6.236 秒。页面所用 classic WASM SHA-256 为 `cae2f558f9ae44bcee62494765ffc066589ecad11fb8e89f2f8f1cafab09b262`（43,031,838 bytes），stellar 为 `2786376a66c4db689ebfd353de1323f72124a282f71c397903d0d6d4d1f723b5`（64,601,772 bytes）。核心首轮测试 27 项通过、1 项失败，失败是测试仍引用旧派生 rule ID；更新该用例后，仅重跑新文件，1 项通过（0.846 秒）。Web 首轮因 5 处新增类型错误失败，修复后 retry1 通过，4.018 秒／730 modules／Vite 868 ms。收据见 [classic](../docs/validation/source-character-overrides-classic-first-20260928.json)、[stellar](../docs/validation/source-character-overrides-stellar-first-20260928.json)、[核心首轮](../docs/validation/source-character-overrides-core-first-20260928.json)、[核心 retry1](../docs/validation/source-character-overrides-core-retry1-20260928.json)、[Web 首轮](../docs/validation/source-character-overrides-web-first-20260928.json)与 [Web retry1](../docs/validation/source-character-overrides-web-retry1-20260928.json)。

聚合页面流程通过：13.132 秒墙钟、11.6 秒用例、12.6 秒 runner，`pageErrors` 为空。每条 lane 两场合计 20 次伤害应用、14 次治疗应用、4,125 次计算；治疗场景含 12 次伤害应用、9 次治疗应用、2,680 次计算，冷却场景含 8 次伤害应用、5 次治疗应用、1,445 次计算。两个 lane 各记录 5 条治疗捕获及 2 条冷却捕获，选定回放差值为 0。classic 的转契路径由 1,545.51047554 编辑到 1,670.51047554（输入增加 100，治疗加成 1.25，对应结果增加 125），原始捕获不变且 JSON 恢复成功；TF 冷却记录为 446→386 帧。独立 trace 报告含 49 个 trace nodes、67 个实际运算；sidecar 结果与对应 trace 结果相同，页面能展开中间步骤。数据见[本轮聚合结果](../docs/validation/source-character-overrides-20260928.result.json)、[测量汇总](../docs/validation/source-character-overrides-measurements-20260928.json)与 [E2E 收据](../docs/validation/source-character-overrides-e2e-first-20260928.json)。tracked `git diff --check` 通过（0.068 秒）；不覆盖未跟踪文件。

Ifa、Durin 的新增推导及 Varka、Odette 路由本轮没有新的原生执行样本，仅有相应核心公式、静态接线或构建证据。已运行的 Cyno 冷却路由也不代表其全队冷却机制均经页面验证。24 项部分动作审计提示，多数动作资格与执行次序仍需实际观察，且六个角色没有固定源码中的专属 Go 包；不得据此推测动作帧或完整循环。详见[剩余动作实现审计](remaining-action-implementation-20260928.json)。本轮未重跑历史全集、未提升游戏 verified 状态，也不宣称全量机制完成。

下一实现批次已定位到尚以最终 Mult 数值进入伤害核心的复合技能倍率，见[源码倍率清单](source-multiplier-implementation-audit-20260928.json)。其中按层数加算、状态乘数和 helper 返回值分组；单纯读取已给定天赋表的项目单独排除。该清单只定位缺口，不代表已经迁移或验证。
