# 自动特殊反应状态：实际实现及接入边界

原始更新：2026-09-23；高跳代码说明补充于 2026-09-25。此次仅同步文档，未重跑检查、构建或测试；新增高跳检查尚未运行。

`packages/sim-core/src/special-reaction-state.ts` 把队伍转换、实际施加事件、贡献者、实体、资源、领域计数与伤害意图区分开。它不再依赖用户为每一击手填“发生特殊反应”。输入必须来自 Aura/ICD 引擎实际允许的施加，包含事件 ID、攻击实例 ID、目标与施加前的个人元素所有权。

规则使用显式参考配置 `special-state-reference-60fps-no-hitlag-v1`：60 FPS、无卡肉、固定队伍、一个静止且处于相关范围内的目标。来源为 Luna VI/7.0 KQM 指南、固定 gcsim 提交与可追溯角色被动数据；状态结果仍为 provisional，不宣称当前版本完整服务器机制。来源细节与冲突见 [状态证据](research/special-state-evidence.md)及 [20 份源码取证清单](research/special-state-source-retrievals.json)。

## 已执行的状态规则

| 范围 | 自动行为 | 输出或证据边界 |
| --- | --- | --- |
| 队伍转换 | 从源版本列出的实际队员身份决定 LC/LB/LCrys/SSC/SSW 是否替换对应普通反应；没有启用者返回普通回退 | Moonsign 成员不自动等于转换启用者；`resolveMoonsignLevel` 单独保留未解析成员 |
| 月感电 | 云持续 330 帧且再触发刷新；初次 9 帧扫描，其后每 6 帧；同目标命中间隔 120 帧 | 取该次扫描仍有个人有效水/雷 Aura 的贡献者；属性需在此帧取样；源代码对区域跟随仍有 TODO，因此限定静止目标 |
| 月感电扣量 | 伤害投递后请求每位个人水、雷 Aura 各扣 0.4U | 必须由主 Aura 引擎执行，不能误当成在多人之间分摊总计 0.4U；普通感电定时伤害与扣量必须停用 |
| 月结晶 | 首次建立三个持续 540 帧的月笼；计数上限 6；已有月笼时累计至少 3 次且不在 37 帧间隔内，消耗 3 次触发一轮 | 13/25/37 帧分别取属性快照，另有 10 帧投递；本轮参与者是此前水 Aura 所有者与 Geo 触发者的去重集合，开火后清空 |
| 草露 | 规则 `verdant-dew-fixed-core-order-v2`：每次 LB 排下一帧全局任务，将生成结束延至触发后 149 帧；当帧生产先读取旧窗口。此前窗口不活跃且进度为零时，F+2 首次累积、F+147 首枚。146 个有效帧得一层，最多 3 层；同攻击实例去重 | 保留部分填充、实际消费和不足量，旧窗口仍有效时连续生产；不把每次触发简化为独立“2.5 秒后 +1”。保留普通草原核，不添加即时月绽放伤害 |
| Polestar | 创建攻击不计数；之后记录真正施加冰/雷的命中，按攻击实例去重、每角色 6 帧间隔，上限 12；创建时立即发布，之后每 240 帧发布并清计数 | 未发布计数与角色计数 ICD 独立于领域，销毁/重建仍保留；新领域立即发布残留计数。刷新 360 帧寿命不重置发布相位。发布冰雷加成、40% 物抗削减和直接 SSC 系数；主路径只执行领域对普通命中的作用，直接能力仍需定义。源配置 buff 241 帧不冒充严格游戏四秒边界 |
| Stellar Vortex | 初次生成一级；累计第 3 次为二级，第 6 次提前引爆；未提前时按指南三秒在 180 帧引爆，追加触发不续寿 | 初始 Anemo 不附着；主路径已在爆炸投递时实际施加 1U Cryo 并保存回执。参与者集合跨漩涡生命周期保留，爆炸时取属性；指南分支不表示固定源码冲突已解决 |
| 高跳 | 爆炸产生全队共用的一次 300 帧资格；实际跳跃开始时删除有效资格并保存独立腾空状态，声明需要并消耗 `airborne` 的下落动作执行时落地 | 增量代码已写，新增检查待执行；主路径 `consumptionImplemented:true`。到期帧不可消费，已腾空状态不随原资格到期自动删除；空中非下落角色动作拒绝，普通下落命中计入经典伤害 |
| 辉映 | 为已取证的三名启用者保留 480 帧 SSW 辉映，并让场内 SSC 优先 | 不给无资格队员自动套辉映，魔女启迪等额外资格须各自有执行定义 |

实际缺失的元素所有权不会变成零，也不会仅用最后触发者代替全体贡献者。月结晶与漩涡会记住生命周期中早先发生的资料缺失；随后某次完整事件不能把之前不完整的累计集合“洗白”。冻结与 Cryo 同时存在的 SSW 贡献资格按具体字段阻塞。

## 主模拟器契约

当前主路径保留月感电、月结晶、星导、月绽放和星扩散五个独立显式入口，另有 `simulateLunarMixedProfile` 的 LC＋LCrys 共享 v1，以及 `simulateLunarMixedV2Profile` 的 LC/LCrys/Bloom/Hyperbloom/草露/显式月露涤荡共享 v2。月感电/月结晶/星导/星扩散及混合 v1 要求 `aura-v3`，独立月绽放要求 `aura-v5`，混合 v2 要求 `aura-v7` 的真实队列化 Quicken→Bloom，不能统一写成同一个 Aura 版本。星扩散额外保留 `guide-profile-source-conflict`，其余固定来源身份也不自动成为官服验证。各配置的身份映射只决定转换资格，不补造角色能力、命座或面板。

```ts
const result = transitionSpecialState(previousState, actualApplicationOrAdvance, {
  profileId: SPECIAL_STATE_PROFILE_ID,
  spatialProfile: "single-stationary-target-in-range",
  party, targetId,
  auraAt: (frame, targetId) => actualPersonalAuraSnapshot,
});
```

返回状态、日志、`nextWakeFrame`、自动转换决定、伤害意图及具体 `blockedMechanics`。主调度器必须在每个 wake 帧执行，或提供能够查询所有中间帧真实 Aura 的解析器。相同帧先执行已排定状态任务再处理下一施加，这是本参考配置的公开顺序，不宣称所有游戏机制都服从一个全局优先级。

不能把本模块简单挂在普通反应之后再加伤害。转换需要实际替换普通伤害、普通周期扣量或传播；月绽放则保留原草原核。伤害意图中的 `onDelivery` 操作必须在正确投递帧进入 Aura 引擎。SSC 的物抗变化和普通增伤已在主路径作为真实效果执行；对尚未挂接的适配器，缺少这些步骤仍须报告 `conversion-not-applied` 或对应字段并排除自动伤害，不能形成双重计数。

`packages/sim-core/src/special-state-calculation.ts` 将完整状态意图绑定到实际数值快照。必须逐一提供所有且仅有已解析贡献者；没有等级基数、数值快照、已执行的普通反应替换或元素投递，不会填补默认值。已经被阻塞的意图拒绝转成自动数值计算。成功上下文记录 `mode=state-resolved`、状态规则版本、事件 ID、目标、所有者、快照帧、投递帧、贡献者规则和来源；它通过已有公共特殊公式与追踪核心复算。独立手工条件公式仍保留原有入口。

月感电数值接入另有 `lunar-charged-calculation.ts`。已重新读取固定提交的 [combat/reaction.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/reaction.go)：`CalcLunarReactionDmg` 经 `CalcReactionBaseDmg` 读取 `reactionLvlBase`，因此此参考实现可复用同提交 `reaction.dm.go` 的精确表。只接受 1–100 整数级；不沿用源函数对越界等级的静默夹取。每位参与者的原始 CR/CD 保存在恢复上下文；概率通过共享 AST 显式限制到 0–1，选择平均/全暴击/非暴击只改变输出分支，不改写人物输入。专属反应加成、基础提升、加算、擢升和额外攻击在本参考配置明确关闭，不作为缺少资料时的隐式零值。

月结晶数值接入为 `lunar-crystallize-calculation.ts`，复用同一精确等级表和独立的 1.6 分支。人物与敌人必须分开取样：固定源码 [lunarcrystallize.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go) 在各段出手时取人物属性，随后 [core/attack.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go) 延迟投递，命中阶段的 [enemy/damage.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go) 与 [enemy/mods.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/mods.go) 才读取当前岩抗。接入者须保存 +13/+25/+37 的人物快照，到 +23/+35/+47 命中时给适配器传入当时抗性。恢复上下文同时保存两种帧号。普通水结晶盾和全局间隔必须在真实前置转换中停用；每位水 Aura 扣除 `R=min(0.5×岩附着量, 最大个人水量)`（不低于零），岩剩余量减 `2R`，不能误减成 `R`。

`simulateStellarConductProfile` 已在真实 Aura 中替换普通超导伤害/12 秒减抗，按 1:1 消耗冰雷，并把发布计数对应冰雷增伤和物抗削减作用到普通命中。人物效果遵循动作快照或命中取样，敌人抗性在命中读取；领域到期与末次 241 帧增益到期是不同状态。`baseResult` 的普通命中已包含领域调整，总伤不再追加一个虚构星导伤害。完整捕获可由独立计算器重现其计数查表、增伤相加及抗性相减，见 [星导执行](stellar-conduct-simulation.md)。

`simulateLunarBloomProfile` 已保持普通草原核并按真实绽放生产草露，接入唯一明确声明的哥伦比娅 C0 闲置起手月露涤荡。公共 runner 绑定真实能力定义和 124 帧完整占用，+55 帧消费草露，+62/+70/+92 帧读取当时面板/草抗执行三段直接月绽放及固有月兆基础提升。资源、普通伤害、特殊伤害和每段消费凭据分别保留，可恢复到计算器；其他角色能力/命座/领域没有由此补齐，见 [月绽放执行](lunar-bloom-simulation.md)。

`simulateLunarMixedProfile` 已让月感电和月结晶共用实际 Aura、同一特殊状态和主事件堆。共享唤醒优先级为 2.5，雷云扫描/伤害/扣量在该任务执行；普通命中与月结晶投射优先级为 3，同级按真实入队序号。岩命中按固定来源先普通雷结晶、后水/月结晶，向后者传递剩余岩预算；普通雷晶片和 60 帧晶片间隔保留，普通感电与水晶片被转换。雷云实际消费个人水/雷后，岩和月笼看到更新后的附着；岩耗尽雷时也会让已有云后续扫描无法造成伤害。这是同次状态交互，不是把两个独立模式结果相加。

v1 共享特殊事件保存 `executionOrder`、真实贡献者及取样/投递时刻；雷云消费进入同一基础 Aura 时间线，`conversionEvents[].geoResolution` 保留岩两段分支预算和水消费前所有权，普通及特殊命中分别可恢复。此入口仍限水/雷/岩/物理，见 [共享 v1 执行](lunar-mixed-simulation.md)。

`simulateLunarMixedV2Profile` 将水/雷/草/岩/物理接入一次 `aura-v7` 执行，复用同一云/月笼/草露状态及主事件堆。水先 Bloom 再 LC；雷按 Aggravate→LC→Quicken，草按 Spread→Quicken→剩余量 Bloom。Quicken→Bloom 的零延迟回调读取执行时附着与原攻击归属，排在已经入队的同帧事件之后；雷拥有的成功 Bloom 同样刷新草露，不能因为不是水/草触发者而丢失资源。真实普通草核延迟生成，后续雷攻击按原攻击接触资料检查已有草核并产生超绽放；雷云投递不另造雷附着或草核接触。

共享 v2 的状态 wake、来源能力消费和伤害分别以优先级 2.5、2.75、3 入主堆，同优先级保留真实 sequence。显式月露涤荡沿用闲置起手/124 帧占用、+55 实际消费与 +62/+70/+92 逐段取样；生成草露本身不计伤害。结果区分经典、月感电、月结晶、直接月绽放伤害，特殊事件保存 `kind` 与 `executionOrder`，核生命周期保存来源/接触/消费审计。每个实际特殊事件可由 `lunarMixedV2EventToCalculatorDocument` 恢复，同次经典直接/剧变命中走公共捕获，见 [共享 v2 执行](lunar-mixed-v2-simulation.md)。

`StellarSwirlRuntime` 已通过 `simulateStellarSwirlProfile` 接入主模拟器，规则为 `stellar-swirl-guide-reference-v1`。真实 ICD 后、普通冰扩散任务创建前替换，按 `min(0.5×入射风量, 现有冰量)` 消耗冰；触发帧人物快照在 +3 帧送达，读取当时风抗。状态唤醒和伤害投递进入同一个主事件堆；第六次触发造成的零延迟爆炸在当前命中 Aura 审计完成后执行，不在 `application` 内提前修改当前命中。

爆炸时取样生命周期内贡献者，实际向 Aura 引擎投递最后触发者归属的 1U 冰，保存 `cryoDelivery` 与主队列 `executionOrder`。新冰按普通 0.8 税成为 0.8U、570 帧期限；既有个人附着保留衰减率并按 max refill 处理。这份真实冰可被后续风命中消费并再次触发。只有窗口内实际投递的初始/漩涡事件计入特殊伤害；普通和特殊事件均可恢复到独立计算器。

高跳增量使用独立的 `highJump` 资格与 `stellarAirborne` 状态。主队列实际跳跃通过 `consume-high-jump` 消费未过期资格，保存角色、起始帧和来源事件；`high-jump-use` 日志反馈给合法时间轴编译，静态跳跃占用不代替真实腾空证明。声明需要并消耗 `airborne` 的下落动作实际执行后，通过 `land-stellar-swirl` 解除腾空并记录 `high-jump-land`；该动作的普通命中计入 `classicDamage`。非下落角色动作不能在这段腾空期间执行，同帧事件继续服从主队列顺序。

`jump.frames` 仍由用户输入，不推导上游武器类别的 4／8 或 5／9 帧及空间高度。普通跳跃已经开始后才遇到爆炸的增强分支仍带源码 TODO，本次未支持。新增代码及尚未执行的验证范围见 [星扩散主路径](stellar-swirl-simulation.md)、[适配器契约](stellar-swirl-adapter.md)和[高跳来源审计](research/stellar-swirl-high-jump-source-audit.md)。

## 仍需阻塞或披露的具体范围

- 一般移动、多个目标/多个区域竞争、云与领域的真实跟随，以及卡肉对相应定时器的影响超出这个参考配置；不能称为完整实战模拟。
- 草露只按固定 60 FPS 源码规则执行；120 FPS 近似 97% 的描述不是可直接编码的精确生成规则。
- 固定 gcsim Stellar 源码存在 `1→3→7` 加计、实体注册/查找类型不一致及 181 帧寿命；本实现显式采用指南逐次 +1、三次升级、六次提前引爆和 180 帧自然爆炸。主路径执行成功没有解决这些冲突；范围与多目标、冻结贡献者及当前客户端时序未独立核验，结果始终保留 `guide-profile-source-conflict`，不能提升为 verified。
- Moonsign 全角色成员身份、团队加成持续时间、额外角色的辉映资格与强化后天赋执行、角色专属资源/上限/额外攻击尚须逐项数据与执行定义。它们不影响独立已取证的纯数值公式入口。
- 五个独立主路径、混合 v1 与混合 v2 都是限定单目标、元素和无卡肉配置；v2 已包含所列草反应，Stellar、火冰风及一般多目标/空间混合仍未完成，特殊状态完整稳态检查点仍未建立。星扩散高跳资格消费代码已接入、验证待执行，普通跳跃途中增强及完整角色直接能力仍未覆盖；本模块或集成用例通过不等于全引擎自动特殊反应、完整角色或当前官服验证已完成。

## 既有定向验证记录

2026-09-25 高跳增量新增 `packages/sim-core/src/__tests__/stellar-swirl-high-jump.test.ts` 三项核心用例和 `apps/web/e2e/stellar-swirl-high-jump.spec.ts` 一条页面流程，尚未运行，未计入下列历史通过数量。本次文档更新不新增测试或构建通过声明。

以下是对应实现阶段已执行的记录；此次文档同步没有重跑。主路径后续集成范围见 [星导执行](stellar-conduct-simulation.md)、[月绽放执行](lunar-bloom-simulation.md)、[星扩散执行](stellar-swirl-simulation.md)及 [QA 报告](qa-report.md)，不从早期状态机通过数推定后续检查通过。星扩散三项定向主路径用例的实际记录已在其执行文档中；随后新增星扩散浏览器用例已实际通过，普通导入首轮失败及修复后的单项复验见[浏览器证据](validation/stellar-swirl-e2e.md)；不由核心测试推定浏览器状态。

`npx vitest run packages/sim-core/src/special-reaction-state.test.ts packages/sim-core/src/special-state-calculation.test.ts`：2 文件、9 项通过，Vitest 报告 205 ms。

覆盖自动启用/回退、真实 ICD 允许条件、云动态贡献者与目标间隔、月结晶三段快照/投递、持续草露与实际消费、Polestar 周期和计数、漩涡升级/提前引爆、缺失贡献者持续阻塞、资格受限的辉映优先级，以及状态生成事件经过同一计算核心得到 142.5 并在 JSON 恢复后逐节点一致。没有运行或借此声称全工程测试通过。

上述早期状态机记录采用当时草露实现，其首次累积/生成早一帧，不能继续作为该时序正确性的证据。后续依据固定源码的生产/全局任务顺序，统一修正为 `verdant-dew-fixed-core-order-v2`；3 文件、7 项定向通过、8 项跳过，总计 1.38 秒。独立 LB 合成例在 Bloom 第 6 帧后于第 153 帧生成首枚，消费第 215 帧及三击 222/230/252 帧不变。混合 v2 另有 3 项集成用例一次通过（1.78 秒）；这些实际记录见 [草露修正证据](research/lunar-mixed-v2-source-evidence.md)与 [v2 执行记录](lunar-mixed-v2-simulation.md)，不代替本批构建或浏览器验收。

数值桥接追加验证：`npx vitest run packages/sim-core/src/lunar-charged-calculation.test.ts packages/reaction-formulas/src/special.test.ts packages/sim-core/src/special-calculator.test.ts`，3 文件、43 项通过，314 ms。新增两项验证精确等级表绑定、各暴击模式保留原始面板、上下文恢复、超上限暴击率的显式概率步骤，以及不支持分支/等级的拒绝。

月结晶数值桥接：`npx vitest run packages/sim-core/src/lunar-crystallize-calculation.test.ts`，1 文件、2 项通过，147 ms；验证 1.6 独立分支、源表 80/90 级基数、保持人物快照但改变命中抗性、恢复上下文、10 帧旅行语义和不支持输入拒绝。该结果不替代主模拟器实际消费、延迟投递与合并总量的集成测试。
