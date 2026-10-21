# 感电内存见证与持久化决策断点（2026-10-21）

基线 `91dbfed`（2852 pass / 86 fail）。本块只完成可独立验证的内存见证基础，**没有修复公开感电返回链路**，没有放宽原公共校验，也没有改变任何历史结果身份/文件。

## 必须区分的全链路

| 环节 | 现状／本块处理 |
| --- | --- |
| 引擎分配 | simulator.ts 的同一取号器在实际分配时附带来源标签；不改变返回的编号或数值计算。只有显式 Symbol 观察器启用时保存内存记录。 |
| 内存验证 | direct-hit-step-witness.ts 验证实际分配数量、连续位置、已知来源类型、具体 hitResolutionLogId、frame/priority/queue、日志引用及父伤害归属；圣遗物另用现有 replayArtifactBuffs 从实际反应重放。未知分配点明确拒绝。 |
| 当前可信结果 gate | assertTrustedReactionDeliveryResultReferences 保持原样。观察器在此前收到分离副本，不能更改原结果或跳过抛错。四个感电正向观察用例仍显式要求原公共 gate 抛错。 |
| 持久化结果 | result-schema.ts 的 simulationResultV153Schema 是 strict；当前身份仍为 1.53.0/1.53.0-callback-bus。新内存数据没有写入结果对象，未制定 JSON 格式。 |
| 独立计算重放 | calculator-bridge.ts:63 用 simulationResultSchema.parse(sourceResult)，然后 assertTrustedSimulationResult；capture/serialize 都先 replay。只改模拟器 gate 无法让这个链路正确接受新证据，不能绕开解析。 |
| UI 与导出 | app.ts:1520 的命中解释及 :3408 的捕获调用上述重放器。本块没有把内部观察器接入这些用户入口，也不把缺证据的结果标成新验证通过。 |

已有不同来源的固定 Golden、1.53 flat-stat 扩展及历史身份问题仍按原规则保留。本块不借见证改造顺便改变它们。

## 已实现的有限范围

内存事件包含执行帧、优先级、队列序号、具体命中记录 ID、实际分配总数和逐个分配点。来源点当前覆盖 direct hit、直接反应圣遗物回调、Aura application、配置 Hitlag。

发现并处理了一个此前不能靠摘要猜测的细节：扇出调度和逐目标命中可共享队列序号。不能只用 eventSequence 当作执行身份；每份记录绑定实际 hitResolutionLogId，并按真实 hitResolutionLog 顺序验证。零分配的扇出调度不冒充一次命中执行。

当前支持的验证范围是已测直接命中路径，包括 landed/miss、教官真实反应回调、有/无 Hitlag。目标阶段复用、武器采样、其他中间生产点及 P5 传播尚未完成完整见证适配；出现未标注分配时记录 unclassified 并拒绝验证，不猜偏移、不假装支持。这些是尚未完成的工程，不是用户需要选择的游戏机制。

观察器收到 deepClone 的事件与结果；负例会清空副本，生产结果与关闭观察器时仍逐字段及 JSON 完全一致。此观察器不作为用户插件或公共导出 API。

## 测试证据

新增 **20 项针对性用例通过**：

- 四种真实引擎路径：无/有教官 × 无/有 Hitlag，捕获实际分配来源。序列由生产者产生，不是测试手工填写。
- 15 项负例：执行重排、分配缺失/重排、连同日志一起重排回调与附着、未知来源类型、错队列/帧/优先级、跨命中 root、圣遗物行缺失/错父伤害/错角色、配置 Hitlag 缺失/跨命中、删掉中间项后重新编号。
- 一项观察器隔离：修改观察副本不改变结果和导出 JSON。

四条路径的逐击 final/potential damage、damageFactors、damageComposition、Aura reactionAudit 及伤害归属，与修改前 `ec-contract-audit-20261021/runtime-probe.json` 捕获逐项严格一致。基线投影与原捕获哈希保存在 fixtures/direct-hit-witness-before.json；不是用新实现重新生成期待。

首次测试揭示共享队列身份假设错误（6 fail / 11 pass）；修正为具体命中归属后通过。后续补了重排与观察隔离负例。日志全保留。构建最初在合并 FrameHitDefinition/HitDefinition 的 TypeScript flatMap 推断处失败；补明确公共字段泛型后 `build-checked.log` 构建/类型检查通过，没有改运行逻辑来消除类型错误。

公共感电仍失败，不把诊断用例通过算成九项产品失败已修复。完整回归会话 40714 运行中；完成后补差集。没有 WASM/Go 变更，因此不重复原生重建或无关浏览器全套。

## 待决定的最小兼容边界

最新任务明确要求：如果必须改变持久格式或历史身份，先提出具体决策，不能擅自迁移。因此新增持久协议、公开 parser、重放器和 UI/导出接入停在此处。已通过文本问题请求选择，尚未收到答复；这是 **pending decision**，不是权限拒绝或环境故障。

**推荐：为带完整见证的新结果分配独立结果协议/版本，旧文件不改。** 新 parser 严格要求对应证据，缺失/不一致拒绝“新验证通过”；旧记录按自身版本阅读和原样导出，标为缺少新见证，不能进入声称等价的新版重放。未知或混用身份不自动重算、不补造记录。新协议仅覆盖本次证据，不顺带迁移 flat-stat 等其他旧语义。

备选：先维持本块内存诊断，不新增持久格式。代价是公开感电重放/导出仍无法完成，九项现有失败不能称解决。

此处需要选择的是是否允许新增结果协议及相应兼容行为；具体字段设计、分配点补齐、消费者接线和严格负例是后续工程责任，不要求用户决定。

## 文件与限制

证据目录 `/workspace/GIDPS-cloud/ec-step-witness-20261021`，含 focused*.json/log、targeted.json/log、build*.log 和完整回归日志。生产更改仅为可选内存捕获，不写用户历史文件；新增纯 TS 验证器、测试和修改前数据投影。

没有 push、合并、部署、根许可证修改、新凭据、付费或 Windows 实机操作。旧记录可读/导出的完整新 UI 行为尚未实现，不能以“未改旧文件”冒称该 UI 已完成。
