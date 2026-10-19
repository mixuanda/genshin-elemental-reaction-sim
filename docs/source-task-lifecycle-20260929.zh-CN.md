# 固定来源原生 Task.Handler 排队与回调生命周期（2026-09-29）

本批在原生执行侧观察三类实际 `task.Handler` 队列：core、character、enemy。追踪器对每个真实排队项分配跨队列共享的 run-global task ID，并记录 `parentTaskId`、queue ID、origin、key、排队／执行／回调返回时的全局 frame；各队列另保留本地 queue clock、入队 clock 与 due clock。层级关系来自回调运行时的 active parent，便于区分某个任务回调内再排入的子任务。账本只观察 Handler 的真实堆项目与执行，不推导未记录任务或技能结果。

Task 状态 `pending` 表示观察时仍排队，`completed` 只表示该 Handler 取出任务并在当前 callback 返回时记录完成。某个 callback 返回或相关队列当前为空，均不等于角色技能、状态、实体或整次施放已完成。实现没有 cancellation API；取消、移除或未被追踪的队列路径不能凭缺失记录解释为已完成。尤其 enemy queue 单独绑定 target tracker，但保持 origin 不绑定，避免改变其既有 callback 执行上下文；它提供排队身份，不是敌方伤害归属或完整来源链。

到期计数使用各 Handler 的本地时钟。核心队列使用全局帧；角色和敌人队列受命中停顿影响，不能直接换成全局 `frame + delay`。schema分别保存 `queuedClock`／`dueClock` 与 `queuedFrame`／`runFrame`／`completedFrame`；UI 展示本地剩余clock。character／enemy 的 `QueueCharTask`／`QueueEnemyTask` 在 delay=0 时直接调用 callback，绕过 `Handler`，因此在本批账本实现范围之外；普通 core `Handler.Add(delay=0)` 仍进入heap并可被记录。两条即时直调路径未由本批接入，不能把它们误读为一般delay=0任务都已覆盖或未覆盖。

Collection 可按已选关联保留直接相关 task、实际父任务链和这些 task 所在的 queues；task-only证据也可以打开独立集合。但计算器的 `knownSubtotal` 只由已结算伤害或明确miss构成：只有task排队／完成记录时仍为undefined，不能视作零伤害。集合始终标注 `completeCast=false`。任务账本只说明实际捕获到的Handler活动，并不关闭完整技能生命周期。

验收结果：classic／stellar native build分别7.231／6.708秒，registry生成0.170秒，Web build4.979秒（Vite978毫秒）；单个双lane浏览器案例通过（case9.4秒、runner10.5秒、墙钟11.024秒，`pageErrors=[]`）。每lane在观察frame720登记4个queues：core clock720、enemy target1 clock682、character actor0 clock682、character actor1 clock720。总148个任务（136 completed、12 pending），其中core 123／11、character 13／1、enemy 0；131条有父任务链接。enemy只登记tracker与本地clock，本案例没有enemy tasks，不证明敌方任务执行或死亡分支。

两lane各102 calculations／38 applications与098对照完整不变；`packages/game-data/manifests/pointers.json` 与 `packages/game-data/manifests/runtime/current.ts` 的数据hash也未变化（native manifests为本批artifact因此更新）。所选行秋E创建关联7个任务，其中6完成、1 pending；E已记录2个命中，首击重放差0。pending任务11位于core queue，dueClock1304、观察时queueClock720；该core队列使用全局frame计数，因此本条还差584帧。角色与敌人队列使用各自本地clock，不能作同样换算。所选关联任务的parent-chain context为0，本案例没有祖先上下文正例；task-only无damage分支也未由本次页面样本观察。capture／collection JSON往返通过，`completeCast=false`。

共享schema、collection与UI实现见 `packages/sim-core/src/source-host-task-lifecycle.ts`、`packages/sim-core/src/source-host-action-collection.ts` 和 `apps/web/src/source-host-lifecycle-view.ts`。单次callback返回仅是该 task 记录完成，尚未证明技能或实体完整结束；delay0同步callback、取消/移除行为、未接入的Handler路径及全技能任务闭包仍未验证。完整命令、captures、manifests与数据hash见 `docs/validation/task-lifecycle-measurements-20260929.json`。本批无新增unit tests或角色矩阵，不改变verified、coverage、数据指针或整体goal状态；不提升 `completeCast`。
