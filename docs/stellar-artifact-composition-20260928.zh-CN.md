# 固定 a7 星辉圣遗物组合：实现与页面验证（2026-09-28）

本轮在普通 `/results` 特殊宿主选择器中加入两套固定 a7 星辉圣遗物四件套动态效果；静态二件套属性必须由配置基线提供。实现是来源行为参考，不是游戏内验证，也不表示固定来源注册或该模型可以覆盖全部星辉直接能力。

## 来源条款和触发范围

固定来源文件：

- a7 `internal/artifacts/scarletproof/scarletproof.go`：两件套 `ATKP +18%`；四件套在佩戴者实际触发 `OnStellarSwirl` 后，给佩戴者 `+16% CR` 与对本人星扩散反应标签的 `+40% ReactBonus`，持续 600 帧。来源 ReactBonus callback 只接受 `AttackTagReactionStellarSwirl` 与 `AttackTagDirectStellarSwirl`。
- a7 `internal/artifacts/heartofthefurnace/heartofthefurnace.go`：两件套 `ATKP +18%`；四件套由佩戴者的 `OnStellarConduct`、`OnStellarSwirl`，或该佩戴者拥有的真实 Stellar-tagged `OnEnemyDamage` 触发。触发后佩戴者获得 `+12% ATKP`（按基础攻击力的攻击百分比），全队获得 `+50% ReactBonus`，持续 720 帧。两个四件套 mod key 固定为 `furnace-4pc-atk`、`furnace-4pc-react`；后续触发刷新同名 key，而非累加一份新团队加成。

这些持续窗按来源帧、60 FPS 与半开到期检查实现；实际 trigger frame 加 600/720 得到到期帧。trace 中每个应用记有 receiver、key、来源、值、到期和被覆盖来源。四件套动态项不把静态两件套攻击自动重复计入。

范围限制：普通 `damage` / normal hit 不会仅凭命中而变成 `DirectStellarSwirl` 或 Stellar direct。星导现有宿主只实现其领域对普通命中的作用；状态转移如果要求未声明的直接星导伤害就阻止，因此无根据角色名称或普通命中补造“直接星导能力”。炉火融炼之心的 `OnEnemyDamage` 回调只在真实 Stellar-tagged damage intent 的 owner 与佩戴者一致时进入模型，不能用它推导普通攻击触发。

星扩散当前 special runtime 是与固定 a7 装备源码存在冲突的指南参考 profile；用户必须显式勾选接受混合参考后才能执行。该确认只记录采用本地参考组合，不解决冲突、不认证当前游戏机制。该 profile 仅显式接入本模型列出的暴击率、攻击百分比与星辉专属反应加成；其它专属基础提升、特殊增伤、加算、擢升及额外攻击仍关闭。

## 核心模型、入口和保存回放

`packages/sim-core/src/stellar-artifact-runtime.ts` 实现来源回调状态、定时窗口、贡献者取值、触发/读取 trace 与完整事件记录。现在可移植的 `stellarArtifactBonus` snapshot 记录 `snapshotFrame`、Scarlet wearer／到期帧，以及 Heart 最后刷新来源／到期帧；共享 `stellarArtifactBonusStages` 同时供模拟路径与独立特殊伤害计算器使用。这样特殊计算按实际快照来源和持续窗求值，不会把已经进入聚合 `ReactBonus` 的值再加一次。`stellar-conduct-runtime.ts` 在真实转换后的星超导反应触发 callback；没有将角色普通攻击提升为直接星导。`stellar-swirl-runtime.ts` 在真实反应 callback 触发，在特殊伤害意图的 snapshot frame 读取 contributor 反应加成，并在 Stellar damage 的真实 delivery 时通知拥有者 callback。

配置类型和 schema 用 `fixed-a7-stellar-artifact-4pc-v1`、`baselineIncludesStaticTwoPiece: true` 与 15047/15048 setId 显式建模；每个角色最多声明一个四件套 holder。schema 要求合法 60 FPS 时间线、持有人属于队伍、不得把 `verificationStatus` 设为 `verified`，并禁止和同角色的已有 artifact buff/damage/event model 重叠。星扩散执行若未设 `allowGuideSourceConflict: true` 会拒绝。

普通 `/results` 选择器按角色绑定 15047 Scarlet Proof 或 15048 Heart of the Furnace。用户必须确认配装基线恰好含有该套二件套 +18% 攻击，且未预先包含动态四件套效果；基线未确认时不会附加 runtime model。星扩散额外显示冲突声明并要求明确勾选；星超导不需要这项混合来源确认。配置会随特殊模拟请求保存，面板展示本次触发日志、加成读取 trace 与结束状态，并分页呈现长日志。完整页面 capture 的保存与重跑已分别覆盖两套效果。

`captureSpecialSimulation` / `serializeSpecialSimulation` 保存完整请求和特殊结果；`parseSpecialSimulation` 导入时复跑相同特殊宿主并比较捕获结果。核心用例已验证星扩散捕获序列化后可解析，并且完整 result 与原运行一致；页面分别完成星超导与星扩散配置、计算、完整 capture 导入和结果核对。核心伤害数值精确相等；页面断言用 `toBeCloseTo(..., 8)`，因此这里只报告符合 1e-8 精度断言，不声称页面测得差值为零。

## 已执行检查与失败记录

- 首轮失败如实保留：页面 1 流程失败，墙钟 31.052 秒；失败在模拟开始前，`[data-stellar-artifact-index="e"]` 控件匹配但不可见，`selectOption` 超时。之后修正生产页面控件可见性并加入日志分页。
- retry1：核心 1 项通过，墙钟 2.029 秒；生产构建通过，墙钟 3.285 秒、671 modules、Vite 630ms；页面 1 流程通过，墙钟 3.348 秒、Playwright 3.1 秒。核心精确伤害相等，页面计算器与事件伤害断言达到 1e-8 精度。
- 真实页面运行：星超导 10 秒，9 次普通伤害、1 次 artifact callback、0 次 artifact read、0 次 special damage，伤害 5631.125／DPS 563.1125，首 callback frame 6。星扩散 5 秒，8 次普通伤害、9 次特殊伤害、7 次 callback、16 次读取，伤害 31490.881476071634／DPS 6298.176295214327。首个受益事件在 snapshot frame 6、delivery frame 9，伤害 2340.7863448592034，CR 0.76、反应加成 0.4、expiry frame 606。两次普通页面 capture 均完成保存、导入与完整重跑一致核对。
- 两条结果的面板输入均声明静态二件套 +18% ATK 基线；扩散读数中的 +16% CR 与 +40% ReactBonus 已按生效快照进入面板。独立上下文尚未新增完整全装备属性来源树。
- 主线程随后只调整了独立计算器 trace 的中文变量释义与总额核验说明，数值及上下文未变；该文案调整后没有重跑核心或页面。上列 retry1 是行为验收记录；文案补齐后的最终 `npm run build` 通过，墙钟 3.380 秒、671 modules、Vite 644ms，不计为新增行为测试。

证据：[核心日志](validation/stellar-artifact-core-20260928.log)、[构建日志](validation/stellar-artifact-build-20260928.log)、[页面首轮失败日志](validation/stellar-artifact-browser-20260928.log)、[本轮聚合记录](validation/stellar-artifact-checks-20260928.json)、[最终核心日志](validation/stellar-artifact-core-20260928.retry1.log)、[最终页面日志](validation/stellar-artifact-browser-20260928.retry1.log)、[文案后最终构建](validation/stellar-artifact-build-20260928.final.log)、[Conduct 原始结果](validation/stellar-artifact-conduct-20260928.result.json)、[Swirl 原始结果](validation/stellar-artifact-swirl-20260928.result.json)、[派生测量](validation/stellar-artifact-measurements-20260928.json)。

即使页面验收通过，结论仍限于指定固定 a7 回调、当前 special profiles、用户声明的二件套基线和实际产生的事件；不声称任意角色直接 Stellar ability 已实现、任意 checkpoint 可恢复或游戏机制已 verified。
