# 执行延迟方案：真实能量基线

2026-09-24（Asia/Hong_Kong）。本轮核心改动限 `packages/sim-core/src/execution-profiles.ts`、包入口导出及一个含 3 项测试的新文件。没有改模拟器调度、资源判定主循环或 checkpoint。

## 实际行为与兼容

新默认／自定义执行方案版本为 `1.1.0`，显式声明 `baselineMode: runtime-energy-v1`。`applyExecutionProfile(input, profile, runtimeOptions)` 直接调用已有 `simulate(input, runtimeOptions)`，读取其真实能量判定后的 `timelineExecution`；不再把静态结构编译当作真实资源基线，也不新增第二套调度。

能量不足的请求保持其实际请求时点，并可累计输入延迟；它没有成功动作的动画／冷却，不让后续换人凭空多出取消延迟。取消附加延迟依据最后实际接受能力的动画状态，等待和失败输入不创建新动画；能力已自然结束时不算取消。结构冲突仍由共享编译／模拟路径报错，不因施加延迟而自动修复。

运行选项完整转入，包括能量模式、暴击模式、种子和 `execution.criticalSampling`；没有强行覆盖为解析期望暴击。`AppliedExecutionProfile.baselineRuntimeOptions` 返回实际解析选项，`changes` 附带 `baselineStatus` 和可选 `baselineFailureCode`。

`parseExecutionProfile(raw)` 保留旧记录的版本、元数据和帧数。旧 `1.0.0`（无 baselineMode 或明确 `structural-v1`）仍执行原结构编译及“相邻能力输入”取消语义；即使其 id 与当前预设相同也不会升级。版本或基线模式不匹配时拒绝。

新版基线只是一条选定种子的参考轨迹，用它生成固定请求表。批次的不同迭代重用该表，再独立模拟真实资源和随机事件；不宣称每个 `:iteration:N` 种子都重新生成延迟请求。界面／运行记录接线由 root 任务负责，核心返回值与说明已明确该边界。

## 已执行的检查

只执行新文件和直接受默认方案语义影响的原文件，各一次，均首次通过。没有失败重跑、全套、build、外部模拟或 data:status。

```sh
npx vitest run packages/sim-core/src/__tests__/execution-profile-runtime-baseline.test.ts > docs/validation/execution-profile-runtime-baseline-tests.log 2>&1
command_result=$?
printf '%s\n' "$command_result" > docs/validation/execution-profile-runtime-baseline-tests.exit
cat docs/validation/execution-profile-runtime-baseline-tests.log
exit "$command_result"
```

开始 04:41:19，退出 **0**，**3/3 通过**，总耗时 **1.10 秒**、测试 **273 毫秒**。原始 [日志](execution-profile-runtime-baseline-tests.log)／[退出码](execution-profile-runtime-baseline-tests.exit)。

```sh
npx vitest run packages/sim-core/src/__tests__/execution-profiles.test.ts > docs/validation/execution-profile-existing-tests.log 2>&1
command_result=$?
printf '%s\n' "$command_result" > docs/validation/execution-profile-existing-tests.exit
cat docs/validation/execution-profile-existing-tests.log
exit "$command_result"
```

开始 04:41:41，退出 **0**，**3/3 通过**，总耗时 **908 毫秒**、测试 **99 毫秒**。原始 [日志](execution-profile-existing-tests.log)／[退出码](execution-profile-existing-tests.exit)。

## 实际断言结果

| 场景 | 已核对的结果 |
| --- | --- |
| 久岐忍初能 0，E@1／换安柏@51／换回@300／Q@564／换安柏@565 | 理想请求保留 `1,51,300,564,565`；实用方案为 `3,63,318,584,591`。Q 仅加 2 帧输入延迟，后续换人仅加 6 帧，没有伪造 4 帧取消。延迟后 Q 实际失败、换人成功，Q 条件决定为空。 |
| 同一久岐忍输入恢复真实旧 1.0.0 方案 | 旧结构基线仍报 `ACTION_OVERLAP`，没有因同 id 匹配当前预设而静默改变语义。 |
| 同帧已有微粒到达后 Q 起手 | Q 基线实际接受；实用 Q@14、换人@26，真实扣能在 18 帧。成功取消额外 4 帧保持。 |
| 明确非法提前换人 | 仍报 `ACTION_OVERLAP`。 |
| 动画自然结束后换人 | 新版只加 6 帧换人延迟；旧版仍加 10 帧，证明保存的旧取消假设没有改写。 |
| 西风 R5、明确种子和 seeded-random 暴击 | 实际 1 帧触发，10 帧收到 6 能量并允许同帧 Q。返回选项保留选定种子与采样模式；改为 noCrit 时 Q 失败，换人不加伪取消。遗漏真实二元暴击设置仍按共享运行时规则报错。 |
| 既有 3 项延迟测试 | 命中／产球相对帧、buff 寿命、显式等待、理想输入和结构错误检查全部保持通过。 |

本轮没有引入自适应输入策略或多轮迭代调度。延迟后若实际资源状态改变、请求越界或产生新的结构冲突，仍由最终模拟报告。
