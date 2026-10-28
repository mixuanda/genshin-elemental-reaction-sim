# 散法妮杜公开输入恢复：有限验收

本批基线 `404c76a`。只读既有修后 Classic 捕获，没有调用原生引擎、重跑120秒或改写历史结果。完整文件、逐能力命中、原始哈希及限制见 [机器索引](wanderer-public-scenario-20261023.json)。

## 可复用的最新完整结果

按六份完成回执的 `endedAt`，最新为 `2026-10-23T11:44:48.316Z`：

- 结果：`/tmp/GIDPS-legal-recharge-evidence-20261023/er150-seed-20261022-c2fixed/run.result.json`，50,219,676字节，SHA256 `e6ccae8bec3bfe8483eed2e32cc8387ed8eeb4e688162fdd5d6d6826f4c46af3`。
- 同目录请求 `run.request.json`：SHA256 `c1158edf280d66b4fc567ef0c946892743b0e7aa41bea2f3adfe6b901711644f`。配置与公开 `wanderer-team-recharge.er150.gcsl` 逐字相同。
- 固定源 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，修后 Classic WASM `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`，47,084,886字节。
- 完整四人装备取公开 `wanderer-team-120-classic.equipment.json`，仅流浪者替换为公开 `wanderer-team-recharge.er150.equipment.json`；其余三人逐件保留。等级/命座/精炼为流浪者100/C6/R5、珐露珊90/C6/西风R5、尼可及杜林90/C2/专武R1。后三人的90级和所有基础天赋10均是已披露假设。

## 确证的用户接线缺口

`er150.equipment.json` 只有一份流浪者 `EquipmentBuildInput`，没有队伍导入所需的 `members/actions`。已有 `classic.draft.json` 明确是静态编辑样例：编译后从 `active wanderer` 开始，补一次尼可切人，没有原轴的 Q 就绪判断或 `phase()`；原自适应程序从 `active nicole` 起手。不能拿静态编译后的另一轴声称复现旧 DPS。

公开 GCSL 本身还不足以恢复原请求：补丁073只在 `PhaseConfig` 存在时注册 `phase()`。必须一并恢复 `phaseObservation`、seed、满能仅开场一次、`stopAtDuration=true`、`auto-wait`。本批未另证实新的核心机制错误。

## 最小接线合同

新模块 [wanderer-public-scenario.ts](../../apps/web/src/wanderer-public-scenario.ts) 导出：

```ts
prepareWandererPublicScenario({
  variant, baselineEquipmentText, candidateEquipmentText?, configText,
  inventory, wasmSha256, seed // seed: "20261022" | "20261023"
}): Promise<PreparedWandererPublicScenario>
```

`WANDERER_PUBLIC_SCENARIO` 提供现有公开文件路径和固定哈希。函数先核原始文本、名册来源及修后WASM，再由实际五件装备解析四人卡片；天赋以基础10传入，不手动追加命座等级或把最终面板再写入 `add stats`。返回：

- `exactRequest`：保留原自适应程序和真实请求条件，供独立参考运行按钮使用。
- `equipmentDraft`：四人卡片，`actions=[]`；它只恢复配装，不能编译为原轴。
- `actionProgram`：独立自适应程序标记、尼可开场、配置哈希和编辑提示。
- `binding`：编辑身份。执行前调用 `assertWandererPublicScenarioBinding(prepared, {request,equipmentDraft,wasmSha256})`。装备、天赋、动作、程序或运行条件改变即要求解绑为新自定义方案；旧结果仍只读保留。JSON重开应从固定公开文本重新准备，不能信任外部JSON自带的绑定声明。

公共接线由根线程负责：同时装载卡片和完整请求，参考运行使用 `exactRequest`，不要触发静态生成回调。卡片编辑后禁用参考运行或明确重新加载；导入旧结果时只有配置与公开原文逐字相同时才恢复对应参考卡片，不猜自定义脚本。

## 本次实际覆盖与限制

既有实际窗口 `[0,7200)` 包含610击、403笔能量写入、25个执行者/能力分组，原生总伤害 `27069474.337322712`。独立按应用表求和为 `27069474.337322768`，差约 `5.6e-8`，来自求和顺序。包括流浪者E状态普攻/重击、C6追击、Q，以及珐露珊坍缩、杜林白焰龙、尼可Q/C1投影；原生自动产生93次火扩散。投影的 `actorKey` 是执行者，支援归属须使用另行审计的来源链，不能按名字重归属。

到达的23次Q决策全数就绪：尼可/杜林/珐露珊各6次，流浪者5次。第六段在流浪者Q之前截断，不能称六轮全Q或无限稳态。尼可/杜林仍为已公开的通用装备假设，非玩家库存或毕业最优解。结果 `explanationStatus=partial`、4131条说明，不能据此声称全部游戏机制已独立验证。

只运行 `wanderer-public-scenario.test.ts`：8/8通过，日志 `/tmp/GIDPS-wanderer-public-scenario-20261023.test.log`。覆盖原配装/er150、真实请求匹配、静态轴反例、错误装备/程序/来源/WASM/seed、JSON往返及编辑后拒绝。未运行全回归或原生模拟；公共界面与浏览器往返由根线程验收。
