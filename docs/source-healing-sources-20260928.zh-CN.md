# 原生治疗来源共享公式：范围与复核记录

本文记录固定源码实现和有限页面复跑，不表示机制已获游戏验证。

本轮把固定源码中 `HealInfo.Src`、`HealInfo.Bonus` 的治疗来源算术接入共享公式和因果捕获。Go 继续负责原有触发门槛、队列时点、角色/目标选择、getter 顺序、快照生命周期、HP 变化与事件；共享 AST 只重现来源字段实际采用的数值计算，并把结果写回对应字段及其来源 ID。规则描述符集中在 [source-host-healing-source-formula.ts](../packages/sim-core/src/source-host-healing-source-formula.ts) 和 A–G 分组文件；native 接线由 `059` bridge 与 `060`–`066` lane patches 完成。静态登记表见 [93 条来源注册表](source-healing-source-registry-20260928.json)。

注册表通过扫描两份固定源码树的 `HealSourceCompute` 调用、实际 rule ID、`HealInfo` 字段及 ID 配对写入和缓存对象复用生成，而非仅从 patch 文本推断。共 93 个 descriptor：classic b4 实际引用 88 个，stellar a7 引用 93 个；classic 相比 registry 少 5 项：Iansan A4、Ifa skill、Jahoda burst additional/robot，以及仅 stellar 的 Qiqi C4。两版显式 Src/Bonus 均与对应来源 ID 配对，审计缺失数为 0。上述数字表示固定源码接线和注册表覆盖，不等于游戏规则验证或全角色覆盖。

实现保留了不同来源字段的生产与消费时点：包括实时属性 getter、攻击快照 Heal 属性、初始治疗与周期治疗，以及将 `HealInfo` 缓存后延迟复用的路径。Qiqi 的 `healSnapshot` 和 Sayu 的分支规则选择仍沿用原调用条件；Hu Tao、Lyney 等缓存值保持原有生命周期，stellar Jahoda 的 `robotHi` 也保留创建后跨机器人 tick 复用。测试证据需区分历史 focused replay 与本批尚未完成的整体验收：[focused replay 记录](validation/source-healing-sources-focused-replay-20260928.md)仅对已保存的 classic 场景逐项重放 54 个治疗应用并比较治疗量及溢出，不代表本轮最终 WASM 或完整 E2E 通过。

本轮明确处理了 Escoffier A1 的 C4 额外治疗辅助函数：公式读取原分支计算出的 `a1Scaling + c4ExtraHeal`，再乘原位置读取的一次总攻击力；它保留辅助函数的状态读取，不把 C4 额外量改造成独立触发。Jahoda burst 的 robot 治疗缓存 `robotHi` 在 stellar 源码中带来源 ID 并跨 tick 传给 `Heal`；另有追加治疗 descriptor，但 classic 源码未引用这两项，不能据此称 classic 有相同运行路径。

仍有明确的来源链缺口。钟离 C6 的共享公式重现固定源码中 `min(0.4 × incomingDamage, 0.08 × Zhongli MaxHP)`；实际入参是护盾 `OnDamage` 收到的伤害值，不是护盾吸收后的值，且生命上限读取的是钟离自身。该伤害数值尚未关联到产生它的上游伤害公式 ID。阿蕾奇诺和克洛琳德公式读取治疗帧当下真实 `CurrentHPDebt`，但生命之契此前如何增减的历史状态链仍未完整追溯；克洛琳德固定源码关于治疗加成适用性的 TODO 也保留。本批只保留源码实际传入的生命之契数值，不据此扩写其游戏机制解释。Drain、Dehya 自伤和 Nilou 玩家受击链均属后续工作，不计入本批 93 条规则。

## 本批检查记录

最终检查已通过；此前失败和修复过程保留如下，早期收据不替代最终产物身份：

- classic 首轮除 `Snapshot` 值/指针传参不匹配外，也含 Kuki 返回值数量不匹配；retry1 曾通过。retry2 的 A 组 `bonusRead` 改名属于不必要改动，造成未使用变量并失败，已完整恢复 A。F 组 Prototype Amber、Aquila Favonia、Black Sword 三处真实变量遮蔽修复后，retry3 通过，耗时 3.688 秒；WASM SHA-256 `0f9f88393b50ccfcc3bdd9783ccd85fce8c676744f15f2795ce029caa04b3dd1`，43,521,359 bytes。
- stellar 首轮与 retry1 均通过；最终使用的 WASM SHA-256 为 `ebbea15f0e537f3015de291b55da5eeef1416e7a5c6d156beae1e954a001bb70`，65,076,238 bytes；retry1 耗时 4.523 秒。
- Web 首轮因 `source input closure` 的 TypeScript TS2339 类型收窄错误失败；retry1 至 retry3 通过后，最终 retry4 再通过，耗时 3.913 秒，760 modules、Vite 884 ms。既有 ineffective dynamic import 与大 chunk 警告仍在。
- E2E 首轮因 `kukishinobu` 规范角色 key 与 `kuki` 别名不匹配，来源身份被判无效；retry1 因 `requiredSupport` 数量与包含 source rows 的 map 数量比较不当失败；retry2 因 Go bonus 局部变量遮蔽，导致 `HealInfo` 数值与公式 #168 不符。修复后 retry3 通过：34.693 秒墙钟、33.3 秒用例、34.2 秒 runner。

最终四场固定来源运行共 206 个原生治疗应用，classic 98、stellar 108；本轮捕获并重放的应用差值均为 0。按 rule ID 去重后，classic 观察到 18 条、stellar 19 条；93 条注册规则中仍有 74 条未被这些场景观察，不能外推为全规则实测。所选治疗编辑将来源倍率从 0.176 改为 0.376，治疗量从 5,246.509849267135 变为 9,283.13251888888；原始 capture 保持不变，页面错误数为 0。详见[compact 测量汇总](validation/source-healing-sources-measurements-20260928.json)、[result 汇总](validation/source-healing-sources-measurements-20260928.result.json)、[最终聚合 E2E 收据](validation/source-healing-sources-e2eretry3-20260928.json)和各场景原始结果 [classic 1](validation/source-healing-sources-classic-scene1-20260928.result.json)、[classic 2](validation/source-healing-sources-classic-scene2-20260928.result.json)、[stellar 1](validation/source-healing-sources-stellar-scene1-20260928.result.json)、[stellar 2](validation/source-healing-sources-stellar-scene2-20260928.result.json)。早期 focused replay 使用的同名 raw 后来被 E2E 新结果覆盖，不能视为不可变输入凭证；其 5.85 秒记录只说明当时的 TS 定位检查，不是最终 WASM 证明。

本批仍未接入 [Drain producer 清点](source-drain-producers-census-20260928.json) 中的其他入口。治疗来源完整性、游戏行为真实性及 master 全量目标仍未完成；数据指针未变。末尾的 [tracked diff-check 收据](validation/source-healing-sources-diffcheck-20260928.json) 为 PASS、0.053 秒，仅覆盖 tracked 文件。
