# 下一增量只读审计：共享 Lunar 加入 Dendro 与月绽放

接续记录：本文件保留实施前审计；其后授权的真实实现与验证见 [mixed-v2 执行报告](../lunar-mixed-v2-simulation.md)。原件定位缺口已由完整固定源码中的 `catalyze.go` 解除，现行 Dew 时序也已统一修正；不要将本文的历史“未实施”状态用于判断当前实现。

状态：**未实施**。本文件是已完成 `lunar-mixed-reference-v1`（LC＋LCrys）之后的实施接续说明，不是新增能力的完成报告。审计仅阅读现有项目与已固定的本地源码；没有获取新来源、运行测试或构建、修改生产代码。经主任务要求，仅将结论写入本文。

## 结论与最小可执行范围

可以沿现有引擎继续实现，但不能只放宽 mixed v1 的元素白名单或把独立 LB 运行结果相加。

建议新增显式 `lunar-mixed-reference-v2`，使用 `aura-v7` 已有的实际零延迟 Quicken→Bloom 任务，保留 v1／aura-v3 的输入及结果语义。最小完整范围为水、雷、草、岩、物理，单个静止且明确位于作用范围内的目标、60 FPS、无卡肉、合法时间轴，无插件和玩家受伤反馈。普通绽放、草原核、激化／超激化／蔓激化以及实际雷接触草原核产生的超绽放均属于该范围的必要结果，不能静默跳过。

月绽放直接伤害先复用已有的哥伦比娅闲置起手月露涤荡，显式声明有效普通攻击天赋、突破、C0。菈乌玛／奈芙尔直接能力、月岭露、Gravity、领域、其他命座、取消连携不在最小范围。火、冰、风、冻结、Stellar、多目标、位置竞争及特殊贡献者随机暴击仍不纳入。

三类转换须分别依据 `SPECIAL_STATE_REGISTRY` 检查 party。哥伦比娅的已映射资格可同时满足三类；不能把单类资格推广为全部资格，也不能从身份推定面板、技能、天赋或命座。

## 必须执行的反应顺序

锁定本地 `reactable.go` 已直接给出以下顺序。表中省略的火／冰步骤仅因为推荐范围明确排除这些元素，不是修改来源优先级。

| 入射元素 | 最小范围中的顺序 | 必须保留的状态与预算 |
| --- | --- | --- |
| Hydro | 普通 Bloom → LC 转换 | Bloom 使用水的真实剩余入射量并消费 Dendro／Quicken 等；LC 使用其后剩余量。若此前已经反应，LC 不再次附着入射水；仍可刷新云，是否能命中要由以后扫描的实际 H/E 槽决定。 |
| Electro | Aggravate → LC 转换 → Quicken | Aggravate 读取命中前 Q 且不消费它；LC 可在没有更早消费反应时附着雷，不能提前结束整条反应链；随后 Quicken 消费 Dendro／入射预算并维护 Q 寿命。 |
| Dendro | Spread → Quicken → 普通 Bloom | Spread 不消费 Q；Quicken 消费 Electro，并为真实同帧后续 Q→Hydro Bloom 创建任务；剩余入射草还要经过正常 Bloom 路径。 |
| Geo | 普通 Electro Crystallize → Hydro Lunar-Crystallize | 沿用 mixed v1 的同份岩预算、普通雷晶片 60 帧间隔与水分支独立转换；不能把 Dendro 或 Quicken 当作可结晶 Aura。 |

普通 Bloom 不被 LB 的特殊直接伤害替代。LB 转换负责刷新草露生产，实际普通草原核及其后续伤害必须保留。

`aura.ts` 当前 `lunarChargedConversion` 早退分支约在 **6089**：它为水／雷直接附着后返回。该实现适用于现有 H/E/G/P 范围；一旦加入 Dendro，它会跳过 Hydro Bloom、Electro 的 Aggravate／Quicken。因此下一步要把 LC 的“不再创建普通感电任务”和“是否允许附着”分别接入有序 Hydro／Electro 分支，不能继续使用这个提前返回。

## Aura 版本与现成接点

所有行号是本次审计时的定位，继续工作应以符号为准。

| 文件／符号 | 已有实现 | 下一增量必须处理 |
| --- | --- | --- |
| `packages/sim-core/src/aura.ts:6254` 的 `usesOrderedHydroPipeline`，约 `6884` 的 `resolveBloom` 调用 | 已有 Hydro 的 Bloom 及剩余水预算 | 把后面的普通 EC 建流分支换为 LC 转换，保留此前反应是否已经发生、剩余量和真实 Aura。 |
| 同文件约 `6264` 的 `usesElectroHydroDendroPipeline`，约 `7340/7425` | aura-v5 特例先普通 EC 后 Quicken，再内联 Q→Bloom | 不可直接复用其普通 EC 建流；也不可把内联任务冒称精确的零延迟调度。 |
| 同文件 `usesOrderedElectroPipeline`、约 `7050` 起 | aura-v6+ 有完整有序雷路径 | 在 EC 所在步骤执行 LC，继续到 Quicken；保留 Aggravate 加算与普通命中捕获。 |
| 同文件 `resolveBloom`，约 `4577` | 统一消费 H/D/Q 与生成 `BloomReactionAudit` | 复用现有 gauge resolver，保持个人槽、Q 生命周期和完整 Aura 前后状态。 |
| 同文件 `processQuickenBloomFollowup`，约 `4864` | aura-v7/v8/v9 才执行真正队列化、执行时重读 Aura 的 Q→Bloom | 推荐最小版本 aura-v7；保留实际任务与后续草核生成，不退回 aura-v5 内联近似。 |
| `packages/sim-core/src/simulator.ts:9700` 附近的 `quickenBloomFollowup` 处理 | 已读取任务时 Aura，记录 Q 变化，调用 `scheduleBloomCoreSpawns` | 在真实 Bloom 成功时刷新共享 LB 草露；允许来源为 Electro，使用实际任务／攻击出处。 |
| 同文件约 `15481` 的 `lunarBloomRuntime.application` | 目前只接受 H/D 普通 hit 上的 `bloomReactions` | 不能覆盖 Electro 引发的 Q→Bloom，必须补上上行任务接点。 |
| 同文件约 `16011` 的 `scheduleBloomCoreSpawns` | 普通命中生成草核的既有路径 | 保留，不由特殊 runtime 再创建第二份草核。 |
| `packages/sim-core/src/dendro-core.ts` 的 `DendroCoreManager` | 生成位置、容量淘汰、到期与接触决策由现有管理器负责；模拟器安排伤害 | 继续共享这一个管理器及既有随机种子／几何，不为特殊模式建立平行草核集合。 |

当前本地固定 `reactable.go` 能证明总反应顺序，`lunarcharged.go` 能证明“已经反应则不再次附着”的 LC 行为。现有 aura-v7 代码和审计说明已经实现零延迟 Q→Bloom，但**本轮限定读取的特殊状态来源缓存不含相同提交的 `quicken.go`／`bloom.go` 正文**。下一增量实施前应从项目已有证据索引定位对应原件，核对 TryQuicken 的任务安排和所属攻击上下文；本次未抓取新来源，也未把代码注释提升为额外的原始来源证据。

## 必须共享的资源与调度

1. **同一 Aura。** H/E 的个人槽同时供 LC 扫描、LCrys 转换、Bloom 与 Quicken 使用。Dendro 或 Q→Bloom 耗尽水以后，云及月结晶必须看到实际改变。Quicken 消费雷也会改变后续云资格。不能在特殊 runtime 保存另一份独立元素量。
2. **同一普通草核集合。** 普通 Bloom 的生成延迟、容量淘汰、到期、Electro 接触生成 Hyperbloom，以及其归属、几何、伤害组和延迟均沿现有主引擎执行。LB 不直接把普通核删除或转成伤害。月露涤荡三段明确不附着，不能再追加普通 Dendro 应用。
3. **同一 `SpecialReactionState.dew`。** `special-reaction-state.ts` 已同时具备 cloud、moondrifts 和 dew。真实 Bloom 刷新生产窗口：触发后第 1 帧生产先读旧窗口，随后全局任务把截止设为触发后 149 帧；原窗口未启用时从第 2 帧累积，每 146 个有效帧生成 1 层，上限 3，保留部分进度。先前“下一帧开始”的初步说明已由 [完整时序取证](./lunar-mixed-v2-source-evidence.md) 纠正。不要把已有 `LunarBloomRuntime` 的第二份私有 state 并排接上。
4. **同一主堆。** `LunarBloomRuntime.advanceThrough` 约在 `lunar-bloom-runtime.ts:118`，目前为独立 LB 运行提前快进，并维护自己的消费／命中任务。它不能与 `LunarMixedRuntime` 的主堆调度并列启用，否则同一时间区间的状态可能被一方提前读取。应复用其能力声明与数值适配器，将生产、消费、命中任务接入 mixed 共享状态／主队列。
5. **真实动作与草露收据。** `startDeclaredAbility` 必须在原有主模拟 `actionStart` 接点执行（`simulator.ts:9286` 附近）；前一动作结束后才可闲置起手，保持整个 124 帧锁。来源顺序为动作变体选择 → 当帧草露生产 → 角色任务消费 → 攻击；本帧稍后才生成的草露不能倒用于选择动作。保留 `+55` 消费 1 层、`+62/+70/+92` 每击人物面板／实时敌抗与真实消费收据。

草露与月露涤荡依据已经完整保存在现有本地来源：`/tmp/gidps-lunar-bloom-sources/pkg__core__player__verdantdew.go`、`pkg__core__player__player.go`、`internal__characters__columbina__charge.go` 及对应天赋表。其锁定版本与哈希见 `docs/research/lunar-bloom-source-retrievals.json`。没有新的数值缺口需要猜测。

## Schema 与结果恢复

- `packages/schemas/src/types.ts:1388` 的 `LunarMixedExecutionOptions`、`schema.ts:682` 的 `lunarMixedExecutionOptionsSchema` 目前是严格的 v1 `profileId + party`，会拒绝额外 `abilities`。仅新增可选声明未必破坏旧输入，但此次 Aura 和调度语义扩大应使用显式 v2，保留 v1 重放契约。
- 可复用 `types.ts:1406`／`schema.ts:697` 的 LB 能力声明：唯一 `sourceAbilityId`、`actorId`、`abilityKey: columbina-moondew-cleanse-idle-v1`、天赋 1–15、突破 0–6、C0。能力仍由 `createMoondewCleanseAbility` 建立空普通命中定义；三段由实际资源执行产生。
- `result-integrity.ts:21252` 的 `validateLunarChargedConsumptionIntegrity` 没有 aura-v5/v7 模式门。需要允许新的显式 mixed profile；其真实消费仍是 priority `2.5`，水／雷所有者必须属于配置和 party。无归属初始 Aura 不能因此放行。
- 同文件约 `734` 的共享消费证明要求 H/E 每个个人槽最多减 `0.4U`，其他 Aura 必须保持。因此一个 LC 消费时间线点不能夹带 Bloom 或 Quicken 变化；这些变化应继续由各自普通命中／真实任务 mutation 记录。
- 同文件约 `11161` 的普通 EC 证据识别不把 LC 消费当作普通 EC；没有普通 EC 审计／周期日志时会退出。没有必要为了 H/E 共存而伪造普通 EC 反应、建流或扣量记录。
- `ReactionAudit.bloomReactions`（`types.ts:1925`）以及现有普通草核／Hyperbloom 完整性校验（`result-integrity.ts:16309`、`:17740` 附近）已经承载需要的普通结构，无需增加普通反应枚举。
- v2 结果需要能区分 LC／LCrys 状态反应事件与 LB 来源能力直接命中，使用判别联合并保留同次全局连续 ID。LB 分支保留 `sourceAbilityExecution`、`resourceConsumption`、真实执行顺序及上下文。普通事件沿原有捕获桥接，特殊事件沿共享公式核心恢复，统一总伤只累计本次实际交付。

## 建议的最少集成验证范围（尚未执行）

1. Hydro 在 Dendro＋Electro 上先 Bloom，再 LC；验证剩余水预算、已反应时不重复附着、真实核心与草露记录，以及未生成普通 EC 任务。
2. Electro 在 Hydro＋Dendro／Quicken 上依序处理加算、LC、Quicken，并真正排队 Q→Bloom；后续水变化影响云／月结晶，草露回调保留 Electro 来源；普通草核被实际雷接触时保留 Hyperbloom。
3. 一次共享运行中取得真实草露并执行来源 Moondew 动作，LC、LCrys、LB 和普通核伤害共用队列；验证动作选择同帧边界、真实消费、三段快照与全部类别的 JSON 逐击恢复。

以上是下一增量的测试计划，没有在此次只读审计运行，也不替代后续实际结果。

## 固定来源定位

已有特殊状态证据清单：`docs/research/special-state-source-retrievals.json`。已读取的 Lunar 源码锁定提交为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`：

- [reactable.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go)：Hydro／Electro／Dendro／Geo 反应顺序。
- [lunarcharged.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go)：LC 附着条件、即时参与者和实际消费回调。
- [lunarcrystallize.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go) 与 [crystallize.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/crystallize.go)：同份岩预算、普通晶片与水转换。
- [attack.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go)：零延迟攻击同步交付与正延迟任务。

本审计只确认这些固定版本参考证据与项目接点，未宣称当前游戏实测或三类混合已完成。
