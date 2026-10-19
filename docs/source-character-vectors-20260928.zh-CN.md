# 来源角色动态向量共享公式（2026-09-28）

## 本轮范围

本轮把剩余角色 `StatMod`／`AttackMod` 向量公式按 A–D 四组接入共享公式 AST：A 对应 `034`，B 对应 `035`，C 对应 `036`，D 对应 `037`。在旧清单漏掉流浪者一命冰吸收的 20% 暴击率后，D 组追加 `char-vec-wanderer-a1-cryo`，最终为 193 条规则（A 55、B 54、C 40、D 44）。源码改动分别位于 [A patch](../packages/source-host/patches/034-character-vector-a.patch)、[B patch](../packages/source-host/patches/035-character-vector-b.patch)、[C patch](../packages/source-host/patches/036-character-vector-c.patch)、[D patch](../packages/source-host/patches/037-character-vector-d.patch)；共享公式描述分别收录于 [A 组](../packages/sim-core/src/source-host-character-vector-group-a.ts)、[B 组](../packages/sim-core/src/source-host-character-vector-group-b.ts)、[C 组](../packages/sim-core/src/source-host-character-vector-group-c.ts)和 [D 组](../packages/sim-core/src/source-host-character-vector-group-d.ts)。这是规则描述数，不等于源回调数或完整角色机制数。

共享公式只计算可追溯的向量数值槽。原 Go 回调仍控制触发条件、目标选择、命座／状态门、持续时间、`nil` 返回和实际消费时点。创建或更新阶段在原字段写入位置记录共享公式创建 ID；消费阶段则在原 `Amount` 路径、原门槛之后取得该快照。因此，同一字段后续被多个命中消费时会关联原创建记录，而不是在每次消费时重读属性或重建触发过程。对于同帧公式，原 getter 的读取位置和值也保留为带来源的输入。Hu Tao 本轮增加的双 getter `statReads`／`statLeaves` 记录，属于这类真实读取来源。

迁移仅针对逐条审阅并完整绑定的回调；未覆盖的动态槽、别名或无法绑定的向量继续留在原生实现中。本轮没有新增一个运行时扫描／回退机制。完整 coverage 分类仍以单独的静态清单为准，不能从 193 条规则数推算已迁移回调总量。

最终 Go AST coverage 扫描分别匹配 classic 的 302 个、stellar 的 326 个角色 `Amount` 回调，未发现残留的非空向量回调。两 lane 各保留两个 nil-only 回调：Clorinde A1 与 Xilonen C6；它们通过副作用增加 `FlatDmg`，并非本轮向量共享目标。其余回调在静态分类中分别记录 fixed bridge、dynamic read 或 creation snapshot；扫描按每个 `Amount` 函数体归类，并不据同文件内其它 bridge 误算覆盖。详见[最终 coverage 清单](source-character-vectors-coverage-20260928.json)和保留的[初次扫描清单](source-character-vectors-coverage-initial-20260928.json)。

## 单公式实验与保存范围

新的角色公式实验保存在来源命中计算文档的 `characterExperiments` 中，逐项以 `calculationId` 关联捕获到的角色公式。编辑限制在同一规则、修饰键、来源持有者和阶段内的公式状态变量；不会替换角色或创建阶段。界面可展示公式 trace，并将实验随计算文档 JSON 保存与恢复。

该入口是单条角色公式的数值实验：它不会修改原始捕获，也不会重新运行来源轮转；更不会把修改传播到后续命中伤害、反应、资源窗口或队伍结果。实验结果的 `scope` 明确为 `formula-only`。本轮页面流程选中 Ayato 公式，将天赋索引从 0 改为 1，公式值由 0.11 变为 0.12；原始捕获保持不变，JSON 恢复后仍得到 0.12。现有主命中与圣遗物编辑仍按其既有范围工作。

实现入口：[捕获、文档 schema 与公式重算](../packages/sim-core/src/source-host-capture.ts)；[角色公式实验 UI](../apps/web/src/source-host-character-controls.ts)。

## 来源与验证边界

所依据的 b4／a7 固定源码及规则仍是第三方模拟器中的 provisional 来源语义。共享 AST、Go 接线或一次计算回放都不构成游戏内验证；本轮也不改变游戏数据的 verified 分母。

验收记录显示，b4 和 a7 首次 Go 构建都因 Itto `burst.go` 中新旧 creation ID 变量同作用域冲突而失败；035 将新变量改名后，retry1 均通过。经典版耗时 3.772 秒，WASM SHA-256 为 `957bfc13a8ad4725daa47f2b2c81f83bca34ea3bbbae24b782032d9bf798d0cd`（42,626,124 bytes）；星辉版耗时 4.231 秒，SHA-256 为 `5d24c5e5776629a0de3831b1bfc50a1dd6979cf58cd71cd7a4a4ff21c8765a1c`（64,192,251 bytes）。首次 Web 构建因 UI 重用 `Event` 而不符合 `InputEvent` 类型失败；移除冗余 `onchange` 转发后 retry1 通过，耗时 4.093 秒，718 个模块，Vite 850 ms。随后发现并补入流浪者 A1 冰吸收暴击率规则；只针对补丁后的 Go/WASM 与 Web 重新构建，没有重跑页面流程。最终 classic WASM 耗时 3.976 秒，SHA-256 `a639e57057960ef53c29e66326daf78e370d52b4969ab08fe1d217d5e1123337`（42,627,371 bytes）；stellar WASM 耗时 4.288 秒，SHA-256 `350262da570c5c540ac3345754b88f08bcdd8a648de95acefc667df9fb89b49c`（64,193,392 bytes）；Web 构建耗时 4.006 秒，718 个模块，Vite 845 ms。最终构建记录见 [classic](../docs/validation/source-character-vectors-classic-build-final-20260928.json)、[stellar](../docs/validation/source-character-vectors-stellar-build-final-20260928.json)和 [Web](../docs/validation/source-character-vectors-web-build-final-20260928.json)。

单次聚合页面流程通过，耗时 14.096 秒（测试 12.6 秒、runner 13.6 秒），`pageErrors` 为空。它使用的是补入流浪者冰伤规则之前构建的 WASM（classic `957bfc…798d0cd`、stellar `5d24c5…8765a1c`），所以页面证据不覆盖新增的第 193 条规则。两条 lane 各运行创建表与索引槽场景，时长为 21 秒与 20 秒；classic 总计 2,819 次计算、56 个命中，stellar 2,820 次计算、56 个命中。每 lane 观察到 14 个不同规则 ID，6 个选定命中全部 replay difference 为 0；本批页面未观察的规则为 179 条。这不是对 193 条规则的全面实测。Ayato 编辑结果、Keqing 双槽、Diluc 双槽、Nicole、Navia 和 Xilonen 索引槽均可在 [聚合结果](../docs/validation/source-character-vectors-20260928.result.json)及其[原始 classic 创建表](../docs/validation/source-character-vectors-classic-creation-table-20260928.result.json)、[classic 索引槽](../docs/validation/source-character-vectors-classic-indexed-slots-20260928.result.json)、[stellar 创建表](../docs/validation/source-character-vectors-stellar-creation-table-20260928.result.json)、[stellar 索引槽](../docs/validation/source-character-vectors-stellar-indexed-slots-20260928.result.json)中查看。页面证据见 [E2E 收据](../docs/validation/source-character-vectors-e2e-20260928.json)。

本批源码与规则仍属 b4／a7 第三方模拟器来源的 provisional 语义，不是游戏验证；上述场景也没有验证其它 178 条规则或任意完整角色名册。游戏数据 verified 分母没有变化。

完整[测量汇总](validation/source-character-vectors-measurements-20260928.json)同时保存本批所有失败与成功收据。最终 `git diff --check` 通过（0.088 秒），只覆盖已跟踪文件，不能据此声明未跟踪文件已检查。全量 goal 继续进行；正式、预览和 verified 指针本轮未变。
