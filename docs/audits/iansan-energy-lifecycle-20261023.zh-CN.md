# 伊安珊 C1 消费门与短轴验收（2026-10-23）

基线 `a9c7be1a520ab34e4fd2a3088e590cdb0448d98f`。本次只新增 Stellar 补丁139、独立 Go 窄测试和来源／短轴证据；没有改共享引擎、旧断言、旧结果、build.mjs、许可证或凭据，也没有执行原生模拟、Go测试或构建。

当前模式边界：Classic `b4ae769` 名册没有伊安珊；Stellar `a7dc4bf4` 注册该角色，提供 `strict`／`auto-wait`、zero／full／custom 初能覆盖和原生能量写入回执。手动 Swift 入口当前只覆盖 C0 单击及明确 Q 刷新增攻输入，不能证明团队能量、CD或完整夜魂史。Stellar 支持属于固定源码实现，不代表完整游戏验证。

固定源码中，E 命中敌人后只生成一次4颗雷粒子，经过真实接收分配与ER，再写入能量账。C1 是 `AddEnergy("iansan-c1",15)` 固定回能，不乘ER。补丁020和现有 `source-host-energy-formula.ts` 已将粒子数量／应用、固定回能及消耗分别接入 `energyApplications`，按实际前后余额和上限记账。Q最大能量70，合法门同时检查能量及CD；CD18秒，真正消耗延迟6帧。零能在 `auto-wait` 下会反复被拒绝而等待，不会因此免费释放。

实证缺陷有两个相连部分：C1唯一调用处把请求消费量传给计数器，未扣除夜魂不足时的clamp；计数器严格比较6，十次0.6累加为 `5.999999999999999`，因此第十次已消耗6点却延到第十一次才回能。完整调用核对发现：定时每6角色任务帧消费0.6、Dash消费10、DashState中Jump消费6；恢复可来自Q的15点、移动×0.67、A1和C4溢出恢复等，不能整数化或截断十分之一。

139只改 `iansan/skill.go` 与 `iansan/cons.go`：先读取Points，消费后把真实前后差额交给C1；非正消费不累计；仅阈值6使用绝对 `1e-12` 舍入容差。它吸收0–54点范围内这条短消费求和的舍入误差，仍拒绝真实差额 `1e-10`，不改资源点、不量化恢复值、不放宽Q的42点门。当前 `OnNightsoulConsume` 的伊安珊A1、玛薇卡斗志和黑曜秘典监听者均不在回调内重新生成本人的夜魂点，因此该差额与模板计算的实际used一致。C0、18秒ICD、触发后清零、15点固定回能及夜魂退出语义均保留。

Root已有不可改写的真实前测：`/tmp/GIDPS-iansan-team-20261023/before-energy/zero-energy-e-q.native.json`，SHA256 `d42ad502fcbddf511118d9b6c0741a2f6b1c376acc86d2f7e0b00da717cccd03`，实际WASM `1aea2d170dd5a7a6977a28497f4f5937162bfc0e5b9a56b8e8bbc44e496e967c`。本代理独立读取回执：E在F1进入，夜魂F4到达54点，第十次消费F64，C1却在F70才写入15；F110四颗雷粒子写入12，总能量27。148次Q尝试至F179均因 `insufficient_energy` 被拒，无成功Q或Q消耗。补丁后同一3秒请求应只把首次C1写入提前到F64，粒子仍F110，零初能Q仍不足；不能把修好C1解释成循环能量满足。

Q／夜魂先后另保留原规则：Q起手立即启用增攻状态、安排每18角色任务帧刷新，但新增15夜魂在+40核心任务帧才到达；E在+3核心帧进入54点。恢复任务每60核心帧结算实际移动／A1／C4，不能拿当下点数代替最近刷新采用值。每帧角色任务先于核心任务，同一队列按到期帧和入队顺序执行，所以同帧到达／恢复不保证已被此前的增攻刷新读到。实际消费后先处理C1，再按剩余≤0.2退出；退出清点并移除Q/A1、使旧刷新／恢复任务失效。139不更改这些顺序或18帧刷新。

交付文件：

- [139补丁](../../packages/source-host/stellar-overlay/patches/139-iansan-c1-consumption-threshold.patch)，SHA256 `6f61d4f4ee3478b8b55ce4097c5ac35e6719a79188bb34126263444227b12e79`。已在仅含两份插桩源的隔离副本通过 `git apply --check` 并成功应用，原源未动。
- [Go窄测试](../../packages/source-host/tests/fixtures/iansan-c1-consumption-threshold_test.go)，复制到已验证源副本的 `internal/characters/iansan/` 后运行 `go test ./internal/characters/iansan -run '^TestIansanC1' -count=1`。实际调用角色方法、任务队列和能量wrapper；原版应显示第66角色帧才回能，139后应是第60角色帧。覆盖54／15初值、C0、ICD、0／负值、末次clamp、任意恢复小数、真实不足1e-10、ER与上限、零／满能Q、CD及6帧延迟消耗。**本代理未执行Go测试，root统一前后验证。**
- [短原生请求](../../packages/source-host/tests/fixtures/iansan-c1-short-native-cases.json)：优先复用已有零能E→Q的3秒前测，root只补同请求after；custom55仅在需要直接证明Q就绪提前时使用，full Q-only为可选有限控制。没有无限注能或120秒请求；新WASM身份须由root实际构建结果绑定。
- [结构化来源、算术与原生证据](iansan-energy-lifecycle-20261023.json)。固定a7原cons字节SHA与先前来源记录一致；skill来自冻结归档，新增dash/jump读取固定raw URL，仅记录字节／计算blob身份，不升级为独立完整树验证。

Stellar build登记交由另一代理：在 `phaseCompletionPatches` 中与138相邻加入 `patches/139-iansan-c1-consumption-threshold.patch`。139与Swift天赋修复138无文件重叠，由root单次官方重建、执行窄Go测试和短原生after，再决定整合；本分支不push或发布。
