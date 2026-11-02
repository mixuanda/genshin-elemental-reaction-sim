# Stellar 流浪者 C2：共享 137 补丁的源码兼容与定向 Go 验证

/goal 基线 `6cbc4f9e380420913833581f72fe95cc4967e479`。本项确认固定 Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 可原样使用现有共享 137；不修改共享补丁、Stellar 构建注册、原构建目录、旧六份捕获或候选。

已亲读固定 a7 的 `wanderer.go`、`cons.go`、`burst.go`、`skill.go`、`attack.go`，以及模板 Snapshot、core 快照分派与 CharWrapper 接口。八份原件均与仓库固定完整 Git tree 的对应 blob SHA1 一致；tree gzip/JSON 本身的 SHA256 也与 Stellar pins 一致。逐文件 SHA256、blob SHA1、路径和测试回执见[来源清单](stellar-wanderer-c2-20261023.sources.json)。未把已打补丁树误称为未改上游，也未重新审计全部上游文件。

Stellar 原件存在同一数值缺口：C2 在 Q 起手时保存空居力差值对应的 DmgP 向量，Amount 没有攻击标签条件，因此待处理的普通/C6/妮可投影快照会误读它。a7 的 Q 同样先调用 c2、排入五击，再将当前空居力归零；原件为 +55 帧采样、+92/98/104/110/116 帧命中，C2 生命周期 145 帧。C6 保持普通攻击标签、父倍率的 .4、排入后 +8 帧快照和命中。

兼容性核对没有只比较 C2 文本：Stellar 模板增加了跳跃相关字段，以及 NewWithWrapper 的 Stellar Vortex 事件订阅；这些差异未改变 Snapshot 的同步调用路径。core.generateSnapshot 仍通过 CharWrapper 嵌入的 Character 接口调用角色 Snapshot，流浪者 NewChar 仍将该接口设为自身；模板 Snapshot 仍同步读取 SnapshotStats。因此 137 的角色局部 bool/defer 能覆盖实际分派，保留原来的采样时点、向量、创建 ID 与期限，无需改为命中时 AttackMod。

使用已有完整已打补丁 Stellar 树 `/workspace/GIDPS-cloud/source-build-cache/stellar-build-BLHabY/source`，它包含 136。复制到新的独立目录：

```text
/tmp/GIDPS-stellar-wanderer-c2-evidence-20261023/source-before
/tmp/GIDPS-stellar-wanderer-c2-evidence-20261023/source-after
```

在 source-after 执行现有 137 的 `git apply --check` 和 `git apply`，均 exit 0。补丁 SHA256 始终为 `19c751e7def20d6e1aaa4e8553001be449cb324fbaed8da045e80b6f25a843fa`，没有改字节。将补丁内兼容旧实现的 `wanderer_burst_cycle_negative_test.go` 原样复制到 source-before；该文件不引用新增 bool，前后 SHA256 完全相同，因此修前证据是数值失败，不是新增接口导致的编译失败。

缓存的官方 Go 1.27.1 实际输出为 `go version go1.27.1 linux/amd64`。设置 `GOTOOLCHAIN=local`、`GOPROXY=off`、`GOSUMDB=off`、`GOENV=off`、`GOWORK=off`、`GO111MODULE=on`、`CGO_ENABLED=0`，复用现有模块/构建缓存并指定 `-mod=readonly`，没有安装或下载依赖。完整命令、工作目录和环境见[命令回执](stellar-wanderer-c2-go-test-commands.json)。

```text
修前：go test -mod=readonly ./internal/characters/wanderer -run '^TestWandererC2RejectsNonQ$' -count=1 -v
修后：go test -mod=readonly ./internal/characters/wanderer -run '^TestWandererC2(RejectsNonQ|Snapshot)' -count=1 -v
```

[修前日志](stellar-wanderer-c2-go-test-before.log)实际 exit 1：C6 与 Unity 投影两项都报告 DmgP 得到 2、预期 0；没有编译失败。[修后日志](stellar-wanderer-c2-go-test-after.log)实际 exit 0，四项顶层测试通过，覆盖同一数值断言、普通/C6/两种投影排除、五次 Q 快照读取、归零后的已保存 C2、资源系数/封顶边界、精确到期、C0/C1、未创建 C2、嵌套 Snapshot 与 panic 后恢复先前 bool。

Go 测试把真实核心时钟设置为 55，再通过真实 Character 接口连续读取五个 Snapshot，并在 145 验证未来读取已到期、先前五个快照仍保留原数值。五击排程本身还通过亲读与哈希确认未改的 burst.go 核对；这里没有把这项定向测试说成已经执行了 WASM 五击短轴。源码中 55 帧与 C6 的 8 帧仍有原 TODO，本项不作游戏帧实测认证。

旧构建目录十二份关键文件在操作前后哈希相同；source-after 中除了角色两个生产文件与新增测试外，burst/skill/attack、模板/core 分派、Stats、来源桥和 go.mod/go.sum 十份文件哈希均保持不变。

结论是共享 137 在这个固定、完整 Stellar 已打补丁树上原样适用，且源码/定向 Go 验证通过。本线程没有运行原生 120 秒、重建 WASM、注册补丁或部署；Stellar 的正式构建和实际短轴前后对照由根线程继续完成后，才能报告产物层修复通过。旧六份 Classic 捕获和所有候选不在本项中改写。
