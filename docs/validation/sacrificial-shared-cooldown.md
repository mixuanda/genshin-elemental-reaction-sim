# 祭礼共享来源与串行技能冷却核心

2026-09-24。本子任务实现四把祭礼武器的共享固定定义，以及模板角色 E 冷却队列的纯状态转换。它不修改独立伤害计算器，也不在纯函数内创建第二套事件调度器。真实伤害回调、合法轮转反馈和捕获回放分别由运行时与 schema 接入。

## 已实现文件与 API

- `packages/reaction-formulas/src/sacrificial.ts`：共享 `SACRIFICIAL`、`SACRIFICIAL_WEAPONS`、精炼概率／ICD读取，以及 inclusive ICD 判断。
- `packages/reaction-formulas/src/skill-cooldown.ts`：纯队列状态和转换；经既有 package index 导出。
- `packages/game-data/sources/sacrificial/manifest.json`：引用 18 份既有实际原文和指纹，不重复复制原文。
- `packages/reaction-formulas/src/sacrificial.test.ts`：本轮唯一新增的两项聚焦测试。

四个 wire ID 分别为 `sacrificialsword`、`sacrificialgreatsword`、`sacrificialfragments`、`sacrificialbow`，对应 `weapon:11403`、`weapon:12403`、`weapon:14403`、`weapon:15403`。它们的固定包装器全部转发同一个 common 实现。

| 精炼 | 概率的数学值 | 名义 ICD 帧数 |
| --- | ---: | ---: |
| R1 | 40% | 1800 |
| R2 | 50% | 1560 |
| R3 | 60% | 1320 |
| R4 | 70% | 1140 |
| R5 | 80% | 960 |

`sacrificialProbability()` 保留源式 `0.3 + refinement × 0.1` 的实际浮点结果，因为源 RNG 使用严格 `<`，不将 R3 的机器表达额外舍入为另一边界。`sacrificialCooldownIsActive(expiry, frame)` 在 `frame == expiry` 仍返回真；只在下一帧失效。实际卡肉延长由宿主更新 expiry，本纯函数不推测卡肉。

`SerialSkillCooldownState` 保存 `maxCharges`、`availableCharges`、`queue`、`workerStartedFrame`、`workerGeneration`。每个队列项保存 `castId`、`abilityId`、`recoveryFrames`；因此同角色不同 E 变体可共享一个 slot，各次施放仍可使用不同的实际冷却时长。宿主必须确认这些变体的 maxCharges 一致；不能按 ability ID 为同一个 E 另开并行队列。

| API | 责任 |
| --- | --- |
| `createSerialSkillCooldown(maxCharges)` | 初始化所有充能可用、空队列。 |
| `startSerialSkillCooldown(state, frame, entry)` | 在真正 SetCD 执行时扣一层、将本次时长入队；只在原队列为空时新建 worker。 |
| `resetSerialSkillCooldown(state, frame)` | 已满时无操作；否则仅加一层、弹出队首，并从当前帧启动剩余队首的完整已保存时长。 |
| `recoverSerialSkillCooldown(state, frame, generation)` | 只有到期且 worker 身份匹配时自然恢复一层；旧 worker 不生效。 |
| `serialSkillCooldownRemaining(state, frame)` | 只要还有任何 charge 就返回 0；否则返回当前 worker 到期帧减当前帧。 |
| `serialSkillCooldownWorker(state)` | 返回应由宿主排入事件队列的 `{frame, generation}`，或无 worker 时的 null。 |

所有转换返回状态，不修改传入状态。generation 对应源 worker 指针身份，保证同帧重建且到期帧也相同的旧任务仍然失效。无效的实际 SetCD 超量扣层明确报错，与源假设“被允许执行的动作应有可用层”一致。

## 延迟、自然恢复及同帧边界

`SetCDWithDelay` 只排延迟任务，直到它真正执行才计算当时的 CDR、入队并扣层。本核心接受已经取样好的 `recoveryFrames`，不提前预扣或保留 charge；待执行的延迟任务由宿主保存，祭礼 reset 不应取消它们。

自然队首到期帧，`Cooldown()` 的数值在 worker 尚未执行时已经为 0；执行后因有可用 charge 也返回 0，所以这一帧的祭礼冷却门都应阻挡。另一方面，普通脚本动作在 `Core.Tick()` 执行任务之后才进入 readiness 检查，自然恢复到期帧可立即再次消耗 charge，不能默认强推至下一帧。动画／能量仍可另行阻止施放。

固定 Core task 按 `(executeBy, insertionId)` 排序；伤害计算后另排零延迟任务才发出 `OnEnemyDamage`。因此不能只用命中帧比较推断它与 delayed SetCD 的先后。本纯核心保留显式事件调用，不固化“所有命中先于冷却”或相反的优先级。动作执行后新增的 `Core.Tasks.Add(0)` 通常要下一 Tick 才执行，`SetCDWithDelay(0)` 的直接调用等同步例外也应由真实宿主表达；单纯交换全局事件优先级不能证明所有同帧情况都与源一致。

## 来源实际字节

来源提交固定为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，目录固定为 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。[新清单](../../packages/game-data/sources/sacrificial/manifest.json) 保持 `source-backed-provisional`，其中：

- 12 份原文复用已有 `weapon-lifecycle-next`、`weapon-catalyst-effects` 和 `weapon-bow-effects` 文件，包括 common、四个包装器、串行冷却、status／卡肉和四份中文目录。
- 6 份任务／动作顺序等源码复用本轮外部参考已保存的 [固定原文归档](../cross-validation/sacrificial/fixed-source.json.gz)，归档 SHA-256 为 `bacb69fa2d3f37d346b01681c38ccf361825d3c6e08ee6b87d85137091be7d5d`；清单另保存所引用条目的原文 SHA-256。

核心来源位置：`internal/weapons/common/sacrificial.go:31–63`、`internal/template/character/cooldown.go:34–45,78–119,145–202`、`pkg/modifier/modifier.go:117–125`、`pkg/core/task/task.go:38–60`、`pkg/simulation/run.go:182–189,230–288`、`pkg/enemy/attack.go:60–78`。原始档案没有被本子任务改写。

## 本轮实际验证

只执行：

```sh
npx vitest run packages/reaction-formulas/src/sacrificial.test.ts
```

首跑 **2 passed / 2**，09:15:24 开始，总 **85 ms**、测试 **7 ms**、exit **0**。[原始日志](./sacrificial-shared-cooldown.log)、[退出码](./sacrificial-shared-cooldown.exit)。没有失败、重跑、旧全集、构建或本子任务新增的外部 CLI。

第一项核对 18 份原文指纹、四个真实 common 包装器、每把武器 R1–R5 的 20 个概率和 20 个 ICD 目录位置、严格浮点源式、延迟扣层以及 inclusive ICD。纯状态例在第 9 帧仍有充能，SetCD 于第 10 帧执行后才消耗；300 帧队首在第 310 帧恢复。ICD expiry=1059 时，1059 阻挡、1060 解除。

第二项检验同 actor E 变体共享串行队列、reset 只恢复一层、不同已保存时长、旧 worker 失效与输入状态不被修改：

| 帧 | 操作 | 可用层 | 队列时长 | 下次恢复 |
| --- | --- | ---: | --- | ---: |
| 0 | tap，600 帧 | 1 | `[600]` | 600 |
| 50 | hold，900 帧 | 0 | `[600,900]` | 600 |
| 100 | 祭礼重置一格 | 1 | `[900]` | 1000 |
| 200 | 新 E，300 帧 | 0 | `[900,300]` | 1000 |
| 600 | 旧 worker 被忽略 | 0 | `[900,300]` | 1000 |
| 1000 | 自然恢复一格 | 1 | `[300]` | 1300 |
| 1300 | 自然恢复一格 | 2 | `[]` | — |

另在同一测试中保持旧／新 worker 的起点和到期帧都相同，只改变 generation，确认旧 worker 仍不恢复 charge。这直接覆盖按“起始帧相等”错误识别 worker 的问题。

本轮外部砂糖实测由其他子任务独立执行，原始结果与随机边界见 [外部报告](../cross-validation/sacrificial-external.md)。本文件的两项测试没有重新执行该样本，也不把本地 named RNG 宣称为 gcsim 同 seed。真实多目标触发、再次施放、粒子变化、合法性反馈、日志反演与完整调度顺序的接入结果须以相应运行时验证报告为准。少数角色可覆盖模板 `ResetActionCooldown`；本共享队列只证明这里明确的模板语义，没有据此宣称所有角色特殊重置机制完成。
