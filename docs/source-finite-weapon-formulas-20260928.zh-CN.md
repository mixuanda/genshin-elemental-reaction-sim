# 固定来源三把有限触发武器：共享算式与可编辑捕获（2026-09-28）

本轮把裁叶、猎人之径、辰砂之纺锤的三条动态附加基伤乘法迁入共享 TypeScript AST，并在 b4／a7 原生武器回调中接入。三把武器及其原生命周期早已存在于固定来源；这次是算术共用与回执解释扩展，不是新增全武器支持，也不扩大项目的武器覆盖分母。

## 实际改动

- `packages/sim-core/src/source-host-weapon-formula.ts` 定义严格输入 `{ ruleId, refinement, statValue }` 与三条公式：裁叶 `EM × (0.9 + 0.3 × refinement)`，猎人之径 `EM × (1.2 + 0.4 × refinement)`，辰砂之纺锤 `TotalDEF(false) × (0.3 + 0.1 × refinement)`。来源在每个实际目标命中回调中读取 EM／TotalDEF，并传入读值来源与精炼等级；共享层只计算本次数值。
- `packages/source-host/patches/011-weapon-additive.patch` 在原 native `OnEnemyHit` 判定和计数状态逻辑内，以 `StatWithProvenance`／`TotalDefWithProvenance` 取得原本那次实时属性读取，调用 weapon-additive bridge，再将返回值照旧加进当前攻击的 `FlatDmg`。a7 使用相同 bridge。请求同时保留来源 commit、攻击/目标/帧身份、属性读取和武器状态（到期、冷却及适用时的前后剩余次数）；公式值因此能链接到本次实际属性读数与 hit，而非静态面板估算。
- `source-host-capture.ts` 将 weapon-additive 作为有身份的共享组件捕获；独立命中编辑可修改这项公式的精炼或本次属性值，重算其直接进入普通伤害 `FlatDmg` 的下游结果。原始 statRead 与捕获保持历史证据，编辑值另记为用户实验输入，不回写或重跑 Go 武器计数、触发、冷却及窗口状态。页面控件在捕获命中中展示武器、帧、目标、剩余次数、到期/冷却帧和公式结果。

## 固定源码假设与不透明范围

既有[有限次数与短冷却武器源码审计](cross-validation/finite-weapon-source-20260928.md)记录了来源事件语义，本轮没有重写这些状态机。裁叶和猎人之径的首次合格目标回调启动窗口后立即返回；后续 `OnEnemyHit` 以目标为单位取值及消费次数，所以同一多目标动作中不同目标可能出现启动与消费差异。裁叶限制前台持有人元素普攻启动，后续加值适用于来源指定的普攻、战技；猎人之径按持有人 Extra 命中，不额外添加前台条件。二者的状态与 ICD 时长受 hitlag，且对状态到期等号按固定宿主语义判断。

辰砂之纺锤在满足来源条件的每个战技目标命中均实时读 `TotalDEF(false)` 并附加伤害；`false` 对应包含 Extra StatMod 的总防御读数。源码文字描述技能后延迟和 ICD，与代码中用于安排任务的6帧状态、6帧后开始且持续90帧的非 hitlag ICD 及其 TODO 假设并不等同于“整次技能仅触发一次”。本轮保留固定来源实现，没有用共享公式替它裁定注释与实现的差异。

这三条公式只解释动态附加基伤乘法。裁叶静态暴击率、猎人之径静态元素伤害增益及其他源宿主快照里没有这次 weapon-additive 来源链接的静态属性仍显示为 opaque；它们没有被本轮提升为可解释项。若组件进入非普通/特殊伤害路径，`deriveSourceHostWeaponAdditiveEdit` 会阻止只改终端 FlatDmg 后宣称完整命中联动，并给出阻断原因。公式编辑只重算共享数值与允许路径上的伤害，不重放随机事件、多个目标顺序、武器剩余次数、冷却或队伍轮转。

本批没有新增游戏数据采集、游戏内验证或外部武器来源核验，也不改变全量支持计数和 verified 分母。

## 已有构建与聚焦测试收据

- b4 来源 WASM 首轮构建通过（5.615秒），SHA-256 `3664f845f69adfbf43f4560716a79a0f7d8b593c6e436d754ddeea83c423985e`；a7 首轮构建通过（6.003秒），SHA-256 `3b173bc4351f9205ee0ad4bb54985eb4e0e8c4e3f11039623133d0d7747d1986`。收据见 `docs/validation/source-finite-weapon-wasm-{classic,stellar}-20260928.json`。
- 核心公式／capture 测试首轮因 trace child linking 未执行到的链接节点而失败；生产公式追踪链接修复后，同一聚焦测试 retry1 通过（1文件／1测试，Vitest约312ms、墙钟0.835秒）。两次记录保留于 `source-finite-weapon-core-20260928.{json,log}` 和 `source-finite-weapon-core-retry1-20260928.{json,log}`。
- Web build 首轮因 E2E 夹具的 optional 字段与 exact optional property typing 不匹配而失败；修正后 retry1 通过（墙钟3.691秒）。失败与重试均有收据，见 `source-finite-weapon-build-20260928.{json,log}`、`source-finite-weapon-build-retry1-20260928.{json,log}`。
- 聚合浏览器验收首轮通过：b4 与 a7 两条 lane 各36条计算、20个命中应用，武器共享调用为裁叶11、猎人之径3、辰砂之纺锤2；两套 WASM 的实际 hash 与字节数列于该次收据。Playwright用例6.3秒、runner 7.2秒、墙钟7.744秒，`pageErrors` 为空。收据 `docs/validation/source-finite-weapon-e2e-20260928.json`、数值汇总 `docs/validation/source-finite-weapon-measurements-20260928.json`。
- 两 lane 选中 application ID 9／weapon component ID 6，编辑输入令公式值由240变为360，普通命中伤害由441.98680316515686变为511.5388031651569；原 capture 重放差0，独立实验 JSON 导入后恢复一致。
- 此条16秒每 lane 脚本仅实测三名持有者、双目标下观察到的回调；没有测完 Foliar/Hunter 的次数耗尽、完整冷却或辰砂完整冷却边界。核心只对三条公式做 R1/R5 输入值测试，不是固定来源原生全精炼矩阵。

上述本地构建、聚焦测试和单条聚合来源页面流程不证明任何新的游戏内机制真实性，也不表示已支持全部武器、所有伤害路径或项目全量目标。
