# /goal 伊安珊 C2 当前受益人资格修复

固定 Optimizer `180a0a1` 的 `Iansan/index.tsx:138–142` 只把 C2 攻击加成给 `activeCharKey == target.charKey` 的角色。冻结中文原文明确“若伊安珊处于队伍后台，还会使队伍中自己的当前场上角色的攻击力提升30%”；英文一致。原件仍在既有 `iansan-swift-resolved-casts/source.json.gz`，未改归档；固定来源完整哈希见同名前缀 `.sources.json`。

原 a7 `cons.go:c2Init` 和 Stellar035 仅排除本人、检查伊安珊 A1 有效，因而错误授予后台队友。140 只在该 Amount 内增加 `Core.Player.Active() == char.Index()` 资格，保留原 A1/命座/解锁/本人排除及 `.3` 向量。这个门在 SourceHost 消费回执之前；既有快照不追改。只登记 Stellar，Classic 不在本次范围；build 登记与官方构建由根线程完成。

同一个真实 core 两角色 Go 夹具修前实际失败：伊安珊在前台时，后台凯亚 ATKP 为 `.55`（应 `.25`），总攻击与新快照为 `720`（应 `600`）。独立手算为 `400 × (1 + .25) + 100 = 600`，合法 C2 多 `400 × .3 = 120`；伊安珊本人只有 A1 的 `.2`，总攻击 `680`。

缓存官方 Go1.27.1、离线 `-mod=readonly`：修前共同负例 exit1；修后五组全部通过，覆盖前台队友/本人/后台队友、C2/C6、缺 A1/未解锁/C0/C1、换人恢复、原 A1 到期门和真实 `exitNightsoul` 失效、已冻结720快照保持且后台新快照600。命令与实际输出见同名前缀 `-commands.json`、`-go-before.log`、`-go-after.log`。

测试对独立复制的完整实际 Stellar patched 源码执行，139 两树均已应用，140 是修前后唯一源码差异；没有改旧构建目录。该缓存已经完成天赋插桩，未把前插桩138机械重套；本夹具不执行 Swift。夹具使用实际原生角色构造、StatMod、Stats/TotalAtk、Snapshot，未启动 SourceHost bridge；官方 bridge/队伍轴验证由根线程负责。没有运行原生模拟或 WASM 构建，不宣称游戏实测认证，也未改变旧 modifier manager 的到期等号约定。
