# 执行方案与周期实体检查点：定点浏览器验证

新增 [profile-periodic-checkpoint.spec.ts](../../apps/web/e2e/profile-periodic-checkpoint.spec.ts) 恰好两条流程，并追加到 `test:e2e:calculator`。本轮只运行该新文件；发现一个真实保存缺陷后，仅重跑失败的第一条。没有运行旧流程全集、Monte Carlo、性能测试或数据生成。

浏览器使用 `127.0.0.1:4173` 现有生产预览。初次运行前统一构建的 TypeScript 检查与 Vite 已通过，327 模块 / 337 ms；首个构建尝试的类型错误及修复记录由主任务保留，最终构建证据为 [日志](profile-periodic-checkpoint-build-retry.log) / [退出码](profile-periodic-checkpoint-build-retry.exit)。

## 真实尝试记录

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/profile-periodic-checkpoint.spec.ts
```

首次结果为 **1 FAIL / 1 PASS，exit 1，总计 3.5 秒**。执行方案流程在 1.2 秒时发现：正常预览使用用户指定的 `kuki-profile-energy-reference`，但保存轮转时 `syncControlsFromConfig()` 将种子控件改回情景默认种子，导致真实 Worker 与导出记录失去用户种子。测试未放宽断言。原始 [日志](profile-periodic-checkpoint-browser.log)、[退出码](profile-periodic-checkpoint-browser.exit) 及 [失败上下文](profile-periodic-checkpoint-browser-first-error.md) 均保留。

周期实体流程首次通过，耗时 **646 ms**，没有重跑。

主任务修复保存配置时的种子保留，重新构建通过：327 模块 / 339 ms，见 [修复构建日志](profile-seed-build.log) / [退出码](profile-seed-build.exit)。之后只执行失败项：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/profile-periodic-checkpoint.spec.ts -g 'Execution profiles use the actual energy baseline'
```

复验结果 **1 PASS，exit 0**，流程 **1.8 秒**，总计 **2.4 秒**。见 [复验日志](profile-periodic-checkpoint-browser-seed-fix.log) / [退出码](profile-periodic-checkpoint-browser-seed-fix.exit)。最终两条新增流程均已通过，但不是同一次运行首轮全绿。测试保留失败操作追踪并关闭 DOM snapshots；上述耗时不是产品性能基准。

## 执行方案实际结果

通过正常来源入口载入久岐忍 E／Q，在队伍页把初始能量改为 0，在结果页指定种子、`noCrit`、配置初能和单次迭代，然后在轮转页追加安柏切人请求 565 帧，选择“实用输入”方案。

| 项目 | 已验证的实际值 |
| --- | --- |
| 保存的执行方案 | `1.1.0` / `runtime-energy-v1` |
| 参考政策 | `executionBaseline.policy = fixed-reference-v1` |
| 真实参考种子 | `kuki-profile-energy-reference` |
| 原始请求 | `1 / 51 / 300 / 564 / 565` |
| 延迟后请求 | `3 / 63 / 318 / 584 / 591` |
| Q 基线 | 未施放，`INSUFFICIENT_ENERGY` |
| 最后切人增加的延迟 | 6 帧，没有追加失败 Q 的取消延迟 |
| Worker 实际结果 | Q@584 被拒绝，切人@591 开始、592 完成 |

预览表、最终请求表与导出的 `executionBaseline.changes` 一致。导出的完整基线运行选项与记录的运行选项一致，明确保留所选种子、能量及暴击规则。动作定义和命中时序本身保持相同。

同一流程以已导出记录构造一个明确的旧版兼容输入：E@1 后等待至 swap@100，附带版本 `1.0.0` 的旧结构方案。导入后界面选择 `stored-profile` 并标示 1.0.0；原规则仍把相邻能力后的切人计作 10 帧延迟，产生请求 `3 / 112`。再保存运行并导出后，整个旧方案对象保持一致，未新增 `baselineMode`，也未伪造新版 `executionBaseline`。这是合成兼容性输入，未声称使用真实历史用户文件。

## 周期实体与锁定条件实际结果

第二条使用明确标注 provisional 的确定性合成输入，导入后通过正常分析面板运行连续预热 Worker。基础为每 120 帧施放一次；实体有替换和已排出的延迟伤害，动作相位为 8，起手生命条件被锁定。没有开启随机触发或附着引擎。

| 项目 | 已验证的实际值 |
| --- | --- |
| 预热 | 1080 帧，即 9 周期 |
| 观察区间 | `[1080, 1200)` |
| 保留尾段后的真实模拟长度 | 1730 帧 |
| 稳态 | 完整检查点建立 period 1 |
| 窗口两次伤害 | 1100 帧 50；1130 帧 600 |
| 窗口总伤 / DPS | 650 / 325 |
| 边界实体代次 | `−1` 已替换，`0` 存活 |
| 待执行任务及剩余帧 | 取消旧 tick@0、历史命中@50、活 tick@120、另一历史命中@170 |
| 锁定动作条件 | 两条 `selected=true`、起手优先级 8、取样 HP 10000 |

伤害采用独立手算：分支 `1000 × 0.1 × 0.5 = 50`，延迟命中 `(1000 + 200) × 0.5 = 600`，两秒窗口 DPS 为 325。导出检查点仍保留旧实体对应的 EM 200 取样、实体身份关联、取样年龄 180 帧及未来输入优先级 8。观察窗结束后仍存在真实执行的尾段伤害，未把截断队列当作稳态。

启动结果界面实际展示替换记录、取消旧 tick 的完整 JSON，以及观察边界前九条已接受的条件记录；这些值来自同一 Worker 结果。

本流程证明的是该确定性合成范围的完整状态重复，不认证随机稳态、带附着引擎的真实久岐忍队伍、动态目标、完整角色生命周期或跨引擎随机序列一致。
