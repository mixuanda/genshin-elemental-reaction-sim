# 下一批可执行产品缺口优先级 — 2026-09-28

依据当前[主要求完成矩阵](../master-requirements-status.zh-CN.md)与已存在的执行接口排序。当前批次已完成来源候选流程、8个观察式下落动作、来源起步状态和圣遗物事件面板；映射已重生为`.29`。本文不将这些新增项重复列为建议。

## 1. 扩充来源动作目录并进入队伍日程

主要求 M05 仍缺来源 N／CA／P／E／Q 及实体、取消、位移和卡肉规则。下一步可围绕完整动作族扩展当前可组合目录，让用户能在同一队伍日程中选择已固定来源的动作序列，并查看接受、能量、命中和尾段的来源轨迹。只登记已存档且逐项有来源的动作；不明时序、状态或队伍条件继续阻塞执行。

可复用 `packages/game-data/src/source-ability-registry.ts` 的动作身份和系数映射、`packages/sim-core/src/source-runtime-abilities.ts` 的能力编译、`packages/sim-core/src/source-action-library.ts` 的可编辑场景，以及 `packages/sim-core/src/rotation-dsl.ts` 的日程与接受规则。按现成来源包逐族接入，并对被接入动作做窄回放，无需重跑历史全套构建或验收。

## 2. 补齐状态效果在普通、月曜与星辉宿主间的可组合性

普通圣遗物增益、武器命中叠层、追击、敌盾和目标生命已有共享状态或回执实现，但 `packages/sim-core/src/simulator.ts` 对若干模型与月曜／星辉特殊宿主组合仍显式拒绝。可选择一个已有公式和事件定义最完整的机制，先将相同的真实回调、快照读取和延迟任务接入一个特殊宿主，再按机制逐步扩展。这样能让同一队伍输入跨普通与特殊反应路径复用装备、玩家与目标状态。

优先复用 `packages/sim-core/src/artifact-buff-runtime.ts`、`packages/sim-core/src/artifact-buff-panel.ts` 对应的真实事件账本，以及月曜／星辉宿主已有的队列、AST 和 JSON 恢复接口。组合仍须由实际事件驱动；来源未覆盖的特殊伤害、副作用或应用顺序应继续明示阻塞，不新增推测倍率。

## 3. 延伸可恢复检查点到已建模的完整运行状态

M09 已有多类 reaction、随机与资源状态检查点，但矩阵仍指出随机稳态、目标重置，以及固定来源宿主任意帧检查点未解决。下一步可统一保存和比较已实现状态的输入身份、排队任务、生命周期代次及随机流位置，使用户能够从某个完整观察边界重放，不必把局部逐击数值捕获误称为可恢复模拟。

可复用 `packages/sim-core/src/phase-checkpoint.ts` 的阻塞与捕获合同、`packages/sim-core/src/random-checkpoint.ts` 的随机流状态、已有的 reaction／玩家生命／敌盾／圣遗物状态捕获，以及 `packages/sim-core/src/source-host-wire.ts` 的显式 checkpoint 能力字段。按单一已有状态模块增加输入到输出回放样例；缺少必要私有状态的来源宿主继续报告不可恢复，避免大型随机重跑和隐式补零。

## 当前状态边界

以上是基于当前矩阵的后续优先级，不表示实现已完成，也不构成新增覆盖数字或 verified 认定。候选管线、观察下落动作、来源起步状态与圣遗物事件面板的最终集成与检查见[本批报告](../candidate-utilities-startup-20260928.zh-CN.md)。
