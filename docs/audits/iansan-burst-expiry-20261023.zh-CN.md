# /goal 伊安珊动能标示到期清理

基线 `314218d`。固定中文描述要求动能标示退场时结束夜魂；原生 `restorePointsTask` 仅清 C4 层数、`updateATKBuff` 仅归零攻击，没有在 Q 自然到期时调用 `exitNightsoul`。E 的16秒独立定时器允许正夜魂跨越 Q 的12秒或 C6 的15秒边界。固定来源与同帧契约见 [事件审计](iansan-c4-event-order-20261023.zh-CN.md)。

真实 Go 反例在标示到期后仍持有54点夜魂和一层 C4；C4 用例还残留 A1。这里用显式移动输入保持正夜魂，隔离到期逻辑，不将该运动参数认定为游戏实测路径或玩家循环配装。

补丁141在实际 Q producer 中登记全局到期任务，按真实 `StatusDuration+1` 检查现有包含到期帧的状态规则。卡肉延长后重新读取期限；以 `burstSrc` 隔离旧实例；结束时走原有夜魂清理并清空随标示失效的 C4 层数。不会删除仍在持续的已授予 C6 增伤，也不决定跨标示 overflow 的未明语义。

原失败断言保留：修前4组中3组失败、1组通过；修后4组全部通过，覆盖 C4/C6 时长、7帧卡肉、E入夜魂在结束前/同帧/后、提前退出和旧 Q 失效。旧实例的直接 producer 测试显式重置 CD，仅验证实例隔离，不冒充可执行短 CD 轮转；后续120秒验收不得重置 CD 或赠送能量。初版 fixture 的短 CD producer 调用曾触发原生 charge panic，修正测试准备后才记录本目录的有效 before/after；初版日志保留在云端证据目录。

文件：

- [原失败日志](iansan-burst-expiry-20261023-go-before.log)
- [修后日志](iansan-burst-expiry-20261023-go-after.log)
- [命令、工具链与哈希](iansan-burst-expiry-20261023.commands.json)
- [真实 Go fixture](../../packages/source-host/tests/fixtures/iansan-burst-expiry_test.go)
- [最小补丁](../../packages/source-host/stellar-overlay/patches/141-iansan-burst-expiry.patch)

本记录只证明源码修复与窄 Go 验收。WASM 重建、120秒输入/结果及本批浏览器验收另记；未修改 Golden、历史结果、根许可证或生产部署。
