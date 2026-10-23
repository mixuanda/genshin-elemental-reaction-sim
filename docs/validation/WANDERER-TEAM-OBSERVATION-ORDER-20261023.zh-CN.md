固定散珐妮杜队伍：F0／相位列表顺序审计（2026-10-23）

结论：现有前后记录中的战斗数值、公式回执及已记录事件流相等，源码也支持本配置下这两种顺序可交换；但不能把差异描述为“仅 JSON 枚举”或“一切顺序都无语义”。`c.mods` 的实际存储顺序、`OnTick` 的实际调用先后确实不同。原生相位模型保留这些顺序，跨运行完整相位／归档严格相等仍未通过。

本次只读源代码与约 100 KB 的比较报告，以及约 3 KB 固定请求；未重新解析任一约 119 MB 的原始归档，未运行 native/WASM、完整模拟、仓库测试或全回归。没有修改共享工作树或固定 Go 源码，没有 commit、push、上传、部署或新增权限。

审计定位：主仓库 `/workspace/GIDPS-cloud/player-import-integration`，开始时 HEAD `81b55a05e85b46d9535ff09d688745263ed0f495`。下文 Go 相对路径均以实际已修改构建源码 `/tmp/GIDPS-wanderer-c2-build-20261023/cache/build-ImmxbI/source` 为根；TS／报告路径以主仓库为根。委派给定 Classic pin `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；该 Go 源码目录不含 `.git`，本次没有独立重建整个源码树到 WASM 的构建证明，逐文件 SHA256 已保存在 `evidence.json`。

**已证：已保存报告与本次小报告断言。**

- 固定队伍为 Wanderer 100 C6 Tulay R5、Faruzan 90 C6 Favonius R5、Nicole 90 C2 Angelos R1、Durin 90 C2 Athame R1，基础天赋 10。配置使用沙楼 4、宗室 5、妮可／杜林角斗 5，无额外护盾强效套装。请求 fixture 的 config SHA256 为 `4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059`，与旧浏览器回执一致；seed `20261022`。来源：`apps/web/public/examples/wanderer-team-recharge.er150.gcsl:5`、`:6`、`:12`、`:17`、`:22`；浏览器脚本 `scripts/acceptance/wanderer-team-performance-browser.mjs:17`、`:68` 绑定真实请求至该 fixture。
- 既有 field comparison 报告只把 `phaseObservations`、`logs` 列为不同。其余 calculation、application、RNG、能量以及实际记录的事件／任务流严格相等，是既有完整比较的结果。本次没有重新生成该大归档比较。`compare-team-performance.mjs:28` 至 `:37` 明确先逐字段严格比对，`:45` 至 `:70` 再对差异作诊断分类。诊断副本的成员比对不代表原始相位严格比较通过；`:103` 的 strict archive 检查仍应失败。
- 小报告共有 30 项相位差异：四角色×六边界的 24 项 modifier 顺序，以及六项 `OnTick` 两钩子顺序。六帧为 F1、1322、2643、3964、5285、6606。本次对小报告逐项断言：24 组 key/kind 全列表都恰好是相邻 `*character.CooldownMod:anemo-res-cd` 与 `*character.StatMod:pyro-res` 互换，其他成员顺序不动；actor 0／2 固定交换索引 2、3，actor 1／3 固定交换索引 1、2。六组 hook 全对象恰好互为反转，均为 subscription 索引 12，keys 为 `stats-shield-tick-log`、`stats-status-log`。完整成员／值相等来自既有比较器断言 `:56`、`:66`；本次独立断言的范围另写入 `evidence.json`，没有混同为新一次原始归档核验。
- 两次各 8,825 条日志，9 个位置不同，全部在 F0 的共鸣初始化。F0 完整成员和值相等；F0 之后所有日志及顺序严格相等，来自保存的小比较报告。两份归档各自保存重开一致；跨运行文件不同。WASM 回执 SHA256 均为 `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`。

**已证：源码机制，不能把统计 getter 一概当纯读。**

- `pkg/simulation/setup.go:122` 建 `count` map，`:127` 直接遍历它；`:132` 的火共鸣给四人分别加永久 `StatMod`，仅返回固定 ATKP 0.25 向量。`:311` 的风共鸣给独立体力容器加 -0.15，并给四人分别加永久 `CooldownMod`，回调固定返回 -0.05。两分支不抽 RNG、不排任务、不调用战斗 getter。`pkg/core/player/character/mods.go:173`、`:237` 使用 `modifier.Add`；`pkg/modifier/modifier.go:89`／`:95` 按 key 查找并追加新 modifier，`:132` 记录日志。因此源码解释的是实际容器写入和初始化日志顺序，不单是序列化顺序。
- `pkg/stats/stats.go:22` 保存 collector map，`:34` 原样返回；`pkg/simulation/simulation.go:70` 直接遍历并调用 `New`。注册函数 `pkg/core/event/event.go:164`／`:195` 把新 key 追加到事件 slice，`:261`／`:266` 则按 slot 顺序执行。因此这两条 OnTick 的登记交换也对应真实执行先后交换。
- `pkg/stats/status/status.go:95` 的 callback 写自己的统计 buffer，读取当前角色 DEF、各角色能量／HP、敌人 aura。DEF 的 `damageMod` 在 `:64` 调 `TotalDef(false)`；`pkg/core/player/character/stats.go:257` 路由至 `SelectStatWithProvenance`（`:199`）。后者虽然不裁剪 `c.mods`，仍在 `:225` 调用相关 `StatMod.Amount()`，且 `:205` 建 provenance read。`internal/template/character/hp.go:66` 的 `CurrentHP` 调 `MaxHP`，后者在 `character/stats.go:242` 同样经选属性 getter。`pkg/core/player/character/sourcehost_stat_provenance.go:9` 还递增逐角色 read 序号并压栈。这些都不等价于无副作用直接字段读。
- `pkg/stats/shield/shield.go:94` 即使无护盾也先在 `:95` 调 `ShieldBonus()`。`pkg/core/player/shield/bonus.go:32` 会执行 `Amount()`（`:53`）、删除到期及 `done=true` modifier（`:62`、`:70`）；它还通过回调记录 read。`pkg/core/sourcehost/scalar_provenance.go:8` 增加 scalar 序号；`pkg/core/sourcehost/shield_bonus.go:40` 更新 `shieldBonusRead`。故不能为所有队伍把该钩子标成纯观测并从 phase equality 删除。
- Aura 读取 `pkg/reactable/reactable.go:174`／`:178` 只从 durability 数组取 max 并构造返回 slice；`pkg/core/player/shield/handler.go:113` 的 List 只返回 slice。妮可的 `internal/characters/nicole/shield.go:10` 仅嵌入 `*shield.Tmpl`，没有覆盖强度 getter；Tmpl 的 HP／expiry 是直接字段读，`pkg/core/player/shield/template.go:61` 的 ShieldStrength 仅按 HP、元素、bonus 做乘法。
- 原始 tick 注册不在“已记录事件流相等”的审计家族内：`pkg/core/event/event.go:218` 的 sourceHostObservedEvent 只有 OnEnemyDamage、OnTargetDied、OnSkill。故已记录 eventRegistrations／eventListenerCalls 相等不能替代或推出两条 OnTick 实际调用先后相同。

**源码推断：限固定配置的可交换性与根因解释。**

- 已见初始化差异与两个未排序的 map 遍历吻合，但本次没有独立实测 map 次序变化，更不能把先前恰好相同的三份旧结果写成“已复现旧不确定性”。也没有证明 TS 优化本身导致某个 map 顺序；固定 Go/WASM 未变只支持将它归为原有源码可产生的取序差异。
- 火／风两条 modifier 类型不同。Stats／SelectStat 只执行 StatMod，CDReduction 只执行 CooldownMod（`character/stats.go:49`／`:207`，`character/mods.go:438`）；ApplyAttackMods 同样筛自己的类型（`:362`）。固定相邻交换没有改变任何同类型 modifier 的相对计算顺序。两条共鸣都永久有效、无 hitlag 扩展，key 互不覆盖；风体力修正使用独立容器。故本配置下其交换不会变更浮点加和顺序或机械条件。
- 此固定装备没有可达 `AddShieldBonusMod` 生产者：全源码该 API 的非测试调用方为岩共鸣、Bolide、Tenacity、GoldenMajesty 系列、Dahlia／Thoma／Zhongli／Layla，均不在此配置。shieldBonusMods 初始化为空（`shield/handler.go:34`／`:40`），整个已审计配置无加入路径；所以该 tick 的 ShieldBonus 为 0，没有 Amount 回调或到期／done 条目可消费。妮可的护盾强度读取不调角色面板，也不重建护盾。
- status 的 DEF／HP 选属性仍会触发 NoStat 分支：例如图莱攻速门限（`tulaytullahsremembrance.go:46`）、流浪者 C1／C2（`wanderer/cons.go:26`、`:51`）、沙楼攻速（`desertpavilionchronicle.go:58`）。它们会读取动作条件、产生公式回执或更新返回向量，因此不应叫“零副作用”。但它们不读写 ShieldBonus 列表／shieldBonusRead；空 ShieldBonus 不产生 Resolve 请求。逐角色 stat 序号与全局 scalar 序号独立，公式步骤成对出入栈。交换这两条 callback 未识别到会改变对方读取结果、计算请求次序、任务、RNG 或最终机械状态的路径；这一静态结论与本次全部已记录战斗数据相等相互支持。

**相位周期检测的明确影响。**

- 原生 `character/sourcehost_phase_state.go:29`／`:31` 按真实 c.mods 顺序输出；`event/sourcehost_phase.go:10`／`:12`／`:35` 按真实 hook 顺序输出。两统计 descriptor 没有设 `Observational=true`（status `:150`、shield `:125`），所以仍参与原始 phase 状态。phase capture 自身不运行这些 gameplay Amount；`character/sourcehost_phase_state.go:8`、`shield/sourcehost_phase_state.go:5` 和 `phase.Descriptor.Observe` 另走只读描述。
- TS `packages/sim-core/src/source-host-phase-analysis.ts:57` 至 `:71` 仅排序对象键，`:67` 明确保留数组顺序。`:117`、`:173` 至 `:182` 只比较同一次连续来源运行的边界。若同一运行内 hook／modifier 乱序，即使数值同成员也会产生状态差异，不能静默排序来通过。
- 已保存的六对边界均存在同一个固定、可逆的排列 T：四角色上交换上述固定两个位置，event subscription 12 反转两 hook；所有其他状态和值相等。因此对这些已记录边界，A_i=T(B_i)，且 B_i=B_j 当且仅当 T(B_i)=T(B_j)。这个跨运行固定排列本身不改变每次运行内部“候选周期状态是否严格相等”的真假。相同 policy、frame、futureInput、coverage 与伤害区间也不变；状态差异路径中的数组索引可能移动。该结论是由既有完整成员比对和本次固定排列断言推得的分析，不是新增模拟或相位运行实测。
- 这不使跨运行 A_i 与 B_i 原始相等，更不能宣称该队已建立稳态。周期检测还要求未来输入、完整来源状态、RNG 状态、区间帧数和实际伤害闭合；本次未读取大原档重算完整 phase analysis，也没有证明/宣称任何稳态 DPS。`apps/web/src/source-host-phase-panel.ts:57` 本来也限定为同次运行、已声明原生状态，固定 seed 不等于 RNG 不前进。

**不能据本次证据宣称。**

- 所有队伍／共鸣／modifier／统计 getter／hook 顺序都无语义。
- 前后完整相位、整个归档或每一种实际事件调用顺序完全相同。
- 已用旧三份记录实证复现随机初始化次序，或已证明 TS 缓存导致该变化。
- 已建立无限稳态、总体期望 DPS，或未来／其他种子相同。
- 已完成未执行的 source-to-WASM 全构建证明、原始大文件再核对或新回归。

交付：`evidence.json` 包含 30 项原始诊断排列、24 项独立小报告断言、关键读取文件的绝对路径／字节数／SHA256、输入与运行范围。它不包含原始完整归档，也不改写任何历史证据。审计未遇到权限拒绝或未决写操作；无阻塞。跨运行严格归档不相等是已知未满足的性质，不是本次审计被拒绝执行。

关键源码 SHA256（其余见 evidence.json）：

| 文件 | SHA256 |
| --- | --- |
| `pkg/simulation/setup.go` | `8b08288512cc7297cdbb36c88bb6f0413bd31f0883fa6c07ba25a1032e086c93` |
| `pkg/simulation/simulation.go` | `bb07f741b808bd9812bfb73e1de94f9a8d30e9bf15094e5e796e3d61ab76d15e` |
| `pkg/stats/status/status.go` | `4874c890f526d821b25aab153c10ad7c144c9ca63fb22be8014ee205af67420f` |
| `pkg/stats/shield/shield.go` | `d2e3a8d5325171eb7c3042134054d55465ed1a02a0b717e1b6f68c6672af5eda` |
| `pkg/core/player/character/stats.go` | `174ee0916a26019e44b611964e37322f11b1366cdedcb09beab877034bbf8da1` |
| `pkg/core/player/shield/bonus.go` | `4f8ac3ab7e669f5d418ea8c7688b8e633e978a9307e3df5ff26b80abfe01c483` |
| `packages/sim-core/src/source-host-phase-analysis.ts` | `859df7f3d0168a5486f3f0a112282d7b8ba36ed702161be7a3ccf03ced5070d9` |
