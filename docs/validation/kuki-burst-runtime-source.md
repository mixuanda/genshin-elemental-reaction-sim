# 久岐忍真实 E/Q 来源增量验证

2026-09-24（Asia/Hong_Kong）。本轮只新增固定来源 E/Q 入口、来源注册与 2 项聚焦测试。共享动作相位、真实起手 HP 条件与 schema 由并行核心任务实现，其独立验证见 `action-condition-phase.test.ts` 对应报告；本报告不把并行检查算作本模块额外执行。

## 实际改动

- `packages/sim-core/src/kuki-burst-source-action.ts`：C0 / C2、Lv90/A6/T1 的新独立 E/Q 来源契约和 `createKukiSkillBurstScenario`。默认初能 60，可编辑合法初能与实际初始 HP；完整动作签名保持固定。
- `source-action-library.ts` / `index.ts`：注册、导出、身份查找、合法动作校验以及 E/Q DSL 别名。旧 E-only 入口与身份未修改。
- Q 接入共享 `conditionalHitGroups`：起手真实 HP≤50% 增加第 8–12 击；基础 7 击一直存在。显式 `after-frame-tasks-v1` 使已有本帧治疗先于 Q 的能量资格、条件决定与快照。费用 60 在 +4 帧实际扣除。
- 保存精确来源帧、目标圆心与 C1 范围、能量/冷却/取消窗，并通过共享命中捕获恢复计算器所需面板和真实动作条件。
- [新契约](../cross-validation/action-library/kuki-burst-source-contract.md)、[固定来源/hash清单](../cross-validation/action-library/kuki-burst-phase-sources.json) 与 [唯一外部执行报告](../cross-validation/action-library/kuki-eq-same-frame.md) 已归档。

## 本地执行

runtime/schema 冻结后，只执行以下新文件一次，首次通过；没有失败重跑、全套、build 或 data:status：

```sh
npx vitest run packages/sim-core/src/__tests__/kuki-burst-source-action.test.ts --silent=false > docs/validation/kuki-burst-source-tests.log 2>&1
command_result=$?
printf '%s\n' "$command_result" > docs/validation/kuki-burst-source-tests.exit
cat docs/validation/kuki-burst-source-tests.log
exit "$command_result"
```

- 日志：[原始输出](kuki-burst-source-tests.log)，[退出码](kuki-burst-source-tests.exit) **0**。
- 开始时间 04:10:06，耗时 **2.20 秒**（测试 1.37 秒），**2 / 2 通过**。
- 尽管显式 `--silent=false`，项目测试配置仍过滤了 `console.info`；没有为了打印更多数字重跑。本地差值以下列已执行断言界限报告，不冒充未输出的精确最大值。

第一项核对唯一外部黄金：默认 16 个伤害事件的帧与顺序完全一致、8 次治疗帧完全一致；每击伤害绝对差小于 `5e-12`，总伤害差小于 `5e-11`，治疗后 HP 和请求治疗量差小于 `5e-10`。Q 的 7 个实际命中均以独立 HP 手算核对，并从捕获结果经共享计算器重放，差值严格 **0**；JSON 结果通过 schema。

第二项核对来源边界：C2 在 Q@563 时实际起手低血，锁定 12 击至第 800 帧；第 564 帧治疗过半不改写分支，C2 E 仍有 11 击，Q 圆心 (0,2)、半径 6。单独 Q 起手恰好 50% 时为 12 击。初能 0 是合法输入，但不足以支付 Q：只有不足能失败，条件日志、扣能日志和 Q 命中均为空。第十二击的计算器重放差值严格 **0**。

## 唯一外部运行

固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 二进制只调用一次，首次退出 **0**，耗时 **0.021687 秒**。完整命令、二进制 hash、原始输出路径见 [execution.json](../cross-validation/action-library/kuki-eq-same-frame.execution.json)，不含第二次模拟或网络抓取。

源日志第 564 帧明确先治疗（日志序号 82），再 Q 快照（83）与动作执行（86）：HP `7394.142141417917 → 8424.575198408174`，比例 `0.4852457919264609 → 0.5528686878896913`，Q 选择 7 击。第 568 帧能量 `60 → 0`。

| 外部实际量 | 值 |
| --- | ---: |
| Q 帧 | 614, 631, 648, 665, 682, 699, 716 |
| Q 每击 | 247.18362973336724 |
| Q 总伤害 | 1730.2854081335706 |
| E 总伤害（9 击） | 496.89815872204804 |
| E/Q 总伤害 | 2227.1835668556187 |
| 外部逐击独立公式最大残差 | 0 |
| 外部治疗后 HP 独立公式最大残差 | 1.8189894035458565e-12 |

一次 CLI 的 aggregate iteration 与 sample 仍是两个随机轨迹：种子分别 `8657629235194519853`、`4622440989320708706`。本地粒子概率使用独立命名子流；没有宣称相同种子逐抽样一致，也没有把源 sample 粒子序列作为本地随机黄金。逐项数据见 [comparison.json](../cross-validation/action-library/kuki-eq-same-frame.comparison.json)。

## 尚未覆盖

此次没有外部执行 C2 或低血十二击；其来源代码与本地边界验证不等于额外外部参考运行。仍不覆盖 C4、C6、普通/重击、其他装备、动态属性/HP上限、敌方攻击、移动目标和低突破 E 初击 A4 来源冲突。已有任务优先于新动作的有限相位不代表完整复制全部 gcsim 队列。独立单技能计算器及旧 E-only 来源入口永久保留。
