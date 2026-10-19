# 原生动作来源链与观察命中集合

2026-09-29。本批在固定来源 b4 与 a7 中传递实际动作／攻击来源关系，记录攻击进入队列、派发和逐目标结果，并提供可编辑的已观察多击集合。它提升来源归属的可追溯性；不把观察窗口升级为完整原生技能，也不替代独立 typed 技能覆盖。

## 来源字段与观察账本

动作接受回执保留队列序号、角色键、动作、排队帧、接受帧及输入窗口信息。核心来源链在真实动作执行、任务与事件回调、攻击创建和目标处理边界传递 `creationActionSequence`、`triggerActionSequence`、`parentAttackId`、`via` 与事件身份。`queued` 记录在攻击拿到 ID 或快照前可以暂时没有 `attackId`；之后的 `dispatched` 在攻击派发时记录 ID，`resolved`／`missed` 按每个目标的实际目标检查记录。两版面板按回执顺序展示阶段观察。

结果中两种 `origin` 有不同含义：`Application.origin` 来自被应用 `AttackEvent` 在实际创建时保存的 origin，是实际伤害命中归属的唯一分组依据；公式 `Request.origin` 描述公式被调用时的上下文。在协同攻击、嵌套回调等情况，公式调用上下文可能与攻击创建来源不同，这是有意区分。UI 不按能力名、动作附近帧数或请求公式上下文推断来源。

Xingqiu Raincutter 的本例中，角色 `Init` 安装的雨剑 hook 能观察到 N 攻击触发链，但实际攻击创建来源仍未知；原生记录没有足够信息将其归到一个 `Q` 接受动作。此观察不证明或声称 Q 注册了对应攻击钩子。

## 可编辑集合及完整性边界

来源面板按“创建链”或“触发链”分别选择实际已记录的应用，导出集合中的每击完整公式捕获。集合要求命中属于同一来源、脚本、种子和起步状态，拒绝重复命中，并保留命中筛选、逐击编辑和完整 JSON 导入／导出。创建与触发集合可能重叠，不能相加当作技能总伤；编辑只重算选中公式，不改写原始运行数值、目标状态或后续轮转。

集合类型为 `observed-action-hits`。本次没有完整攻击机会普查，也没有对观察结束后仍可能待处理的攻击作完整结算普查；目标级 `resolved`／`missed` 观察不是“总机会数”声明。排队时尚未分配 ID、创建关系未知、观察窗尾部待处理及未映射事件必须留空或显示为缺口。因此该功能是一个可恢复的观察命中小计，不是完整 native skill capture，也不是游戏内验证。

## 实际结果

唯一页面脚本在两版均记录 38 个伤害应用、114 条阶段观察（38 queued、38 dispatched、38 resolved，0 missed），并出现 9 个创建来源未归属命中／lane。按被接受的 Xingqiu skill 创建链选出的两击，原始公式伤害合计 `1966.0871939310314`，共享公式重放差 0。页面将一个 hit 的 scaling input 增加 100、排除另一个 hit 后，所选公式小计为 `1010.2708033975873`；集合 JSON 再导入后数值与选择恢复，`pageErrors=[]`。baseline 与 origin-enabled 运行的 calculations、applications、energy/healing/player/drain applications 及归一化 result 一致，证明这两个固定脚本运行的 gameplay 未改变，不代表其他脚本已证明等价。

| 检查 | 最终结果 |
|---|---|
| classic 来源构建 | 12.401 秒；WASM SHA-256 `021c96f43b667096600959914913298627aeb9f7b666ee0f287c6c172ecddeb2`，43,436,608 字节 |
| stellar 来源构建 | 12.961 秒；WASM SHA-256 `0450e6ae62b8f652b26b73a4262246ba942c8a288fa53b198e138ee882434ee8`，65,116,866 字节 |
| 核心窄测 | 2 项通过；测试运行235ms、命令墙钟1.930秒 |
| Web 构建 | 8.019 秒通过 |
| 聚合页面 | 最终1/1通过；用例4.8秒、墙钟6.796秒；`pageErrors=[]` |

页面记录还保留了三次前序测试-only失败：首轮依赖公式 `Request.origin` 查找动作组；第二次比较时未规范化 map 派生的 aura interval 顺序；第三次用过窄的 `AttackTagElementalArt` 条件筛选实际命中而未找到。最终以 accepted-action 回执选择动作序号、以 `Application.origin` 分组，并仅规范化结果比较中的无序 interval 后通过。所有过程见[测量记录](validation/action-origin-measurements-20260929.json)及[最终页面回执](validation/action-origin-browser-20260929.result.json)。public/dist WASM 与运行回执身份一致；活动目录和 preview／verified 指针哈希未变。

## 实现入口

两 lane 原生接线依次见 [088 action origin](../packages/source-host/patches/088-action-origin.patch)、[089 attack observation](../packages/source-host/patches/089-attack-observation.patch)、[090 phase observation exclusion](../packages/source-host/patches/090-origin-phase-observation.patch)；stellar 对应补丁位于 `packages/source-host/stellar-overlay/patches/`。Go tracker 与 bridge 在 `packages/source-host/go/pkg/core/info/sourcehost_origin.go`、`packages/source-host/go/pkg/core/sourcehost/attack.go`、`packages/source-host/go/pkg/core/sourcehost/bridge.go`，stellar overlay 具备同一来源语义。Schema／收集／计算逻辑位于 [`source-host-action-origin.ts`](../packages/sim-core/src/source-host-action-origin.ts)、[`source-host-action-collection.ts`](../packages/sim-core/src/source-host-action-collection.ts) 和 [`source-host-wire.ts`](../packages/sim-core/src/source-host-wire.ts)；产品入口由 [`source-host-origin-panel.ts`](../apps/web/src/source-host-origin-panel.ts) 与 [`source-host-action-calculator.ts`](../apps/web/src/source-host-action-calculator.ts) 提供。

完整交付仍受尚未归属的创建关系、未观察机会、运行尾部待处理事件和其他角色／动作覆盖限制；全量 goal 未完成。
