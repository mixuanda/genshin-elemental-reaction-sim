# 星扩散高跳：固定来源与接入边界

2026-09-25（香港）。本记录核对星漩涡爆炸后的跳跃资格、实际消费及腾空动作限制，供运行时接入使用。证据来自固定 gcsim 提交 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，属于上游实现证据；本次没有运行测试、生产构建、上游模拟器或游戏实测，不据此声明接入已通过验证。

## 原文身份与观察时间

固定原文现已保存在仓库 [`source.json.gz`](../../packages/game-data/sources/stellar-swirl-high-jump/source.json.gz)，[manifest](../../packages/game-data/sources/stellar-swirl-high-jump/manifest.json)记录11个原文件（含LICENSE）、字节哈希及逐项固定Git blob核验；压缩包SHA-256为 `f9b5a8089c07a49b4ce0085d655e54359a8c4febaf72802c41c4af35da37699a`。下述临时目录是采集来源，交付不再依赖其存续。

新增原文最初位于 `/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-stellar-jump-source-0xf3nkg2/`，原路径中的 `/` 在本地文件名中编码为 `__`。本轮提供的采集观察窗口为 **2026-09-24T16:34:38Z 至约 16:36 UTC**；表中时间为本地文件 `mtime` 的 UTC 记录，用于辅助定位这次已观察的保存，不是上游发表时间或独立的 HTTP 响应时间证明。

`tree.json` 的根 `sha` 为上述固定提交，`truncated=false`。重新按 Git blob 规则计算后，下列 8 个 Go 文件和 `LICENSE` 均与树中各自路径的 SHA-1 一致；同一批本地字节的 SHA-256 如下。树文件自身为 1,267,390 字节，SHA-256 `898affa52cb190212170ae84018180e18868cd7b54363270937078bc2a8b141d`，其本地 `mtime` 为 2026-09-24T16:32:06.878865Z。

| 固定仓库路径 | 字节数 | 本地保存时间（2026-09-24 UTC） | SHA-256 |
| --- | ---: | --- | --- |
| `internal/template/character/stam.go` | 6165 | 16:35:27.544412 | `19bcf98e2e135385be8189b44245958e59d4c9da9be3cc1d24465afa47ebb2f9` |
| `internal/template/character/character.go` | 5080 | 16:35:28.479050 | `9ce84f961f0981c72d34137877d284e41033457dbc4c3acd1b6b5c7aa0e436b8` |
| `pkg/core/player/exec.go` | 7607 | 16:34:38.615746 | `7256ca1d27b03e1855f3cdb014644115003e7585f3f6bf6023871a78c76a180c` |
| `pkg/core/player/player.go` | 8881 | 16:34:39.526294 | `d2ec7fcbf7c27b4609a86fdeea3f06eca3bbf3ebfeb37ae8373f97fc678b8b46` |
| `pkg/core/status/status.go` | 1646 | 16:35:29.418226 | `e8ab96350e9e0bf7be4dc60b5b973f383c1c04018f2483f73e4e9a3379a2d1f0` |
| `internal/template/character/ready.go` | 1602 | 16:34:39.044628 | `d8226df747ea6181d5edb40ea3131ff948cf165d1f5c948704402808ed049ef1` |
| `internal/template/character/default.go` | 226 | 16:34:39.052490 | `798e50e474f27fbee50182c0771ba1b3795882aaceee8080d06e8724a3d2cda0` |
| `internal/template/character/animation.go` | 155 | 16:34:39.054717 | `97c61df00fa31e7d65363c6366a949b2290375d608adfd1dedf08561cdd9b2f0` |
| `LICENSE` | 35211 | 16:34:40.953376 | `bdef457104e8696158ed0f1bf4c165602b8f5db72d6c2f9bf564f21ee90a1906` |

爆炸端另使用此前已保存的 `pkg/reactable/stellarswirl_gadget.go` 与 `pkg/reactable/stellarswirl.go`；本次重新读取、计算 SHA-256，并核对其 Git blob 与同一固定树一致。两文件分别为 2237／6801 字节，SHA-256 分别为 `d29cda200530382aabd325c404caa2937cde31d6c1feb16e30646a6152a55b53`／`1a90e83efa5034b32747ee4ca3d9a4268d846cf3011159ebf65d619e32499363`。原始下载时间为 2026-09-23T06:25:18.995068Z／06:25:18.394331Z，路径和原记录见 [special-state-source-retrievals.json](special-state-source-retrievals.json)；此次复核不将它们改记为新下载。

固定提交的 [LICENSE](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/LICENSE#L1-L12) 明确写 GNU AGPL 第 3 版或以后版本，并声明自 2026-09-19 生效；同时保留较早 MIT 贡献的说明。本记录保留这一来源声明，不沿用其他提交的 MIT 标签，也不对具体贡献的许可归属作额外推断。

## 可直接从源码确认的状态转换

| 环节 | 固定源码行为 | 接入含义 |
| --- | --- | --- |
| 爆炸授予资格 | `stellarswirl_gadget.go:69–73` 重置漩涡计数，在全局 `Core.Status` 添加 `StellarSwirlAirborneBuff`，时长 `5*60`，随后发出爆炸事件。 | 一次全局资格，时长 300 帧；不是为每位贡献者各存一份，也不直接等于角色已腾空。 |
| 生命周期 | `status.go:24–32` 仅在 `expiry > currentFrame` 时返回正时长；`35–58` 将新增或刷新到期点设为当前帧加时长。 | 授予帧为 `g` 时，未消费资格的有效区间为 `g ≤ f < g+300`；恰在到期帧不可消费。再次添加会刷新到期点，不累计次数。 |
| 实际跳跃消费 | `stam.go:148–165` 检查全局资格剩余时长大于零，调用 `SetAirborne(AirborneStellarSwirl)`，立即删除该资格，再返回跳跃动作信息。 | 消费发生在真实被接受的跳跃执行点；预览、动作定义或伤害计算不应消费。资格删除和腾空状态是两个状态变化。 |
| 空中动作限制 | `exec.go:101–107` 在角色动作分派前检查非落地状态；只放行 `ActionLowPlunge` 和 `ActionHighPlunge`。 | 不能仅把高跳标成可用却继续无条件执行普攻、战技、爆发、换人或再次跳跃。时间推进不是这里的角色动作分派。 |
| 下落后落地 | `exec.go:129–134` 调用高／低下落动作后，将 `airborne` 设为 `Grounded`。 | 落地发生于下落动作执行分派，而非等待下落伤害命中。下落伤害仍须按自身真实命中时序计算。 |
| 腾空来源 | `player.go:327–361` 独立定义 `AirborneStellarSwirl`，`SetAirborne` 写入玩家状态；资格键为 `ssw-airborne-buff`。 | 保存明确的星扩散腾空来源，不能把普通跳跃或其他角色的腾空能力自动归入此机制。 |

对应固定原文：[爆炸授予](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarswirl_gadget.go#L69-L73)、[全局状态寿命](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/core/status/status.go#L24-L58)、[跳跃消费](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/template/character/stam.go#L148-L165)、[空中动作与下落](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/core/player/exec.go#L101-L134)、[腾空状态定义](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/core/player/player.go#L327-L361)。

源码还给出进入下落的动作间隔：大剑／弓／法器低下落 4 帧、高下落 8 帧，单手剑／长柄分别 5／9 帧，跳跃动画上界为 60 帧（`stam.go:116–126`）。这是该固定执行器的排程数据，不是本次游戏实测结果。闲云资格分支在星扩散分支之前执行（`128–146`），不能据此假定所有跳跃增强效果同时消费或叠加。本次窄接入也不凭这些公共模板补造缺失的角色下落倍率和命中定义。

## 普通跳跃途中被爆炸提升：保留未支持

`character.go:40–64` 另订阅爆炸事件：玩家必须处于爆炸范围、当前为 `JumpState`，且还没有已登记的腾空来源；代码先记录跳跃修改来源及距跳跃起点的帧数，再在差值大于 10 时返回。因此现有实现只会在差值 **≤10 帧** 时设置星扩散腾空，但旁边的 TODO 明言真正仍有足够竖直速度的帧区间尚待确定。这个数字是带未完成标记的上游近似，不能升级为已核实的游戏门槛。[事件监听原文](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/template/character/character.go#L40-L64)。

`stam.go:168–190` 又说明跳跃高度、剩余时长以及爆炸后何时可下落取决于爆炸发生在跳跃的哪个时点，相关函数仍为 TODO；该分支也没有复用起跳时立即删除全局资格的路径。[普通跳跃修改原文](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/template/character/stam.go#L168-L190)。本次接入意图仅覆盖先获得有效资格、随后实际起跳的路径。跳跃已经开始后才引爆漩涡的提升时序、空间高度及资格记账继续明确未支持，不把近似 10 帧规则当作完整实现。

## 拟接入的真实运行时反馈

主执行队列应在被接受的跳跃动作真正开始时，携带帧、角色、来源动作和实际同帧执行次序反馈给星扩散运行时。运行时检查未过期资格并消费，记录腾空角色与起点；同一输入仅在编译或预览时出现不能触发消费。若资格已过期或已经被消费，不应伪造一次增强跳跃。

腾空期间的后续角色动作应经过上述资格检查；真实下落动作被执行时解除腾空，随后沿用普通伤害队列处理该动作的命中。未消费资格到期只表示不能再次取得高跳，不等于强制已经起跳的角色落地。爆炸、到期、跳跃和下落若处于同一帧，应服从主队列的实际顺序并留下事件身份，不能通过独立适配器预先推进时间来改变先后关系。

这些是来源支持的接入约束与实现意图，不是本文件新增的通过记录。实际运行时、最终状态、捕获／回放和必要定向检查的完成情况应由后续执行日志另行证明。本审计只读取原文、核对字节身份并编写文档。

## 仍保留的星漩涡来源冲突

此次高跳研究没有解决已有[星反应来源冲突](special-state-evidence.md#新-stellar-源码提供的信息与明显冲突)：`stellarswirl.go:239` 的递增实际为 `1→3→7` 而非逐次加一；`stellarswirl_gadget.go:31` 注册 `PolestarField`、但 `stellarswirl.go:98` 查找 `StellarVortex`；漩涡寿命和思考间隔常量均为 **181 帧**（`stellarswirl_gadget.go:18–20`），不能未经执行解释为指南的 180 帧。爆炸范围、普通冰／冻结贡献者和初次多目标分组等边界也没有因高跳接入自动解决。

因此，沿用指南逐次计数、三次升级、六次提前引爆及 180 帧寿命的当前参考配置继续保留 `guide-profile-source-conflict`。读取到跳跃消费源码只增加这一窄路径的来源支持，不把整套星扩散、角色空间动作或完整游戏机制升级为已验证。

## 后续实际接入与检查

本来源审查完成后，运行时、正常页面、完整JSON与必要核心检查已接入并执行；实际通过、原失败和范围见[2026-09-25增量记录](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。来源身份不因此升级为官服verified。
