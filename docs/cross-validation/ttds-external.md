# 讨龙切人领取：固定源码与一次外部边界观察

2026-09-24（香港）。外部取证阶段仅运行 **1 次外部 CLI**，首次 exit 0，耗时 **0.023821291979402304 秒**，没有安装依赖或修改生产代码。随后等待 runtime 与 schema 冻结，完成文末记录的 **1 次本地受控对照**；没有重跑外部程序。

实测确认：**接收者 TTDS 的属性贡献已经到期，不代表其 StatMod 记录已经删除。** 本样本在到期帧切给该角色时仍拒绝新讨龙，同时消耗新持有者 ICD；下一帧的完整技能快照才读到无讨龙的面板。持有者 ICD 的原定等号探针被实际切人冷却推迟了一帧，因此本次实测覆盖的是 **ICD 到期后一帧成功**，等号失败仅有直接源码依据，不能标为已实测。

## 原始资料与命令

- [唯一配置](ttds/swap-reference.gcsl)、[原始 result](ttds/swap-reference.result.json)、[原始 sample](ttds/swap-reference.sample.json)
- [实际命令、时间、exit、stdout/stderr 和 SHA256](ttds/swap-reference.execution.json)
- [派生参考 JSON：实际切换、完整状态、快照与伤害](ttds/swap-reference.reference.json)
- [26 个固定源码文件的哈希清单](ttds/fixed-source.manifest.json)、[含 LICENSE 的离线源码档](ttds/fixed-source.json.gz)
- [提取脚本](ttds/extract-reference.py)，只解析上述原始文件，不启动模拟器。

工作目录为 `/Users/evan/Documents/gidps`：

```sh
/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-gcsim-b4ae769-03yjl36g/gcsim_darwin_arm64 \
  -c docs/cross-validation/ttds/swap-reference.gcsl \
  -out docs/cross-validation/ttds/swap-reference.result.json \
  -sample docs/cross-validation/ttds/swap-reference.sample.json
```

固定输出 revision=`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，`modified=false`。二进制 SHA256=`2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`。

| 文件 | SHA256 |
| --- | --- |
| config | `ea13cc3c3bda10f02dac9548117c30b7f4d226cb298eb38c7acc65879c1c06f1` |
| result | `fa614ce19dbb89d24e339b5fb176e6283c0df0e38de303a4d4f6bdfdbf18c840` |
| sample | `2acc6f68a9f5e3b105654e4c01f8ccd11c58a2f6713d3a70c9c88a335b39fe6d` |

统计迭代 seed=`9565797209659548255`；debug sample seed=`4531510499382671790`。它们是同一 CLI 生成的不同执行，未声称同 seed。伤害 CR=0；凯亚 E 的产球仍有来源随机性，不作为本次随机流或能量对照结论。

## 受控配置

芭芭拉持 R1 讨龙，丽莎持 R5 讨龙，凯亚持 R1 无锋剑；三人均 Lv1/20、C0、天赋 1/1/1，突破 0，没有圣遗物或其他 ATK 增益。`cr=-0.05` 抵消基础 5% CR，最终 CR=0、CD=0.5。初始前台明确为芭芭拉。

单目标 Lv90、全抗性 0.1、位置 (0,2)、半径 2。`hitlag=false`、`swap_delay=1`，保留来源正常 **60 帧切人冷却**，没有调用 `set_swap_icd` 或强行执行动作。观察窗口 36 秒。配置、parser→core 的布尔传递及 sample 无 `hitlag applied` 共同支持实际关闭卡肉；日志中 `event=hitlag` 的动作动画记录不等于角色受到卡肉。

## 实际切换与增益状态

下表的完成帧均来自 raw `executed swap`，不是把 DSL 请求帧直接当成切换。来源不记录 TTDS 拒绝原因；“持有者冷却／接收者记录存在”的分类由固定分支顺序与原始 status 写入、未写入共同推导，在 JSON 中标为 `derivedOutcome`。

| 实际完成帧 | 切换 | 实际 TTDS 状态变化 |
| ---: | --- | --- |
| 2 | 芭芭拉 → 凯亚 | 芭芭拉 ICD 写至 1202；凯亚 R1 24% ATK 写至 602；有 `ttds activated` |
| 102 | 凯亚 → 芭芭拉 | 凯亚原有增益没有被切出删除 |
| 202 | 芭芭拉 → 凯亚 | 芭芭拉仍在 ICD；无新状态。凯亚后续快照仍为原 R1，expiry 仍 602 |
| 502 | 凯亚 → 丽莎 | 丽莎切入，仅更新自身在场标记 |
| **602** | 丽莎 → 凯亚 | **丽莎 ICD 写至 1802；凯亚没有新 TTDS，也没有 activated。旧 TTDS 恰好 expiry=602，存在性检查仍为真** |
| 1142 | 凯亚 → 芭芭拉 | 芭芭拉重新切入 |
| **1203** | 芭芭拉 → 凯亚 | 芭芭拉原 ICD=1202，实际在 +1 帧成功；新 ICD=2403，凯亚新 R1 expiry=1803 |
| 1742 | 凯亚 → 丽莎 | 丽莎重新切入 |
| **1803** | 丽莎 → 凯亚 | 丽莎原 ICD=1802，+1 帧通过持有者门并写新 ICD=3003；但凯亚新的 TTDS 也恰好 expiry=1803，再次拒绝替换 |
| 1902 | 凯亚 → 芭芭拉 | 芭芭拉重新切入 |
| 1963 | 芭芭拉 → 凯亚 | 芭芭拉实际 ICD=2403，仍被持有者冷却阻止；无新 TTDS |

原计划在 1202 完成芭芭拉切出。raw 实际记录却是：1142 切入芭芭拉，1201 `could not execute swap; action not ready`，1202 才开始 `swapping barbara to kaeya`，1203 完成。故本次 **没有持有者 ICD 等号帧失败的观察，也没有任何一次 R5 成功覆盖或领取**。这一偏差改变了后半段所有增益状态，报告和派生 JSON 都采用实际执行结果，没有修改配置后重跑来替换证据。

## 属性读取与实际伤害

凯亚基础 ATK（角色加武器）为 **41.9434**，没有其他 ATK% 或固定 ATK。R1 讨龙后的最终 ATK 为 `41.9434×1.24 = 52.009815999999994`。这是基础 ATK 百分比增益，不能一般化成所有配装的最终 ATK 乘 1.24。

| 动作 | 起手帧 | 快照帧 | 伤害帧 | 快照 ATK% | 最终 ATK | 伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N1 | 2 | 16 | 16 | 0.24 | 52.009815999999994 | 8.732421297216494 |
| N1（换下再返回） | 202 | 216 | 216 | 0.24 | 52.009815999999994 | 8.732421297216494 |
| E | **603** | **603** | 631 | **0** | 41.9434 | 25.050846992164946 |
| N1 | 1203 | 1217 | 1217 | 0.24 | 52.009815999999994 | 8.732421297216494 |
| N1 | 1803 | 1817 | 1817 | 0 | 41.9434 | 7.042275239690721 |
| N1 | 1963 | 1977 | 1977 | 0 | 41.9434 | 7.042275239690721 |

16／216 两次 snapshot 都明确带原始 `ttds expiry_frame: 602, atk%: 0.24`，证明换下不删除且返回未刷新。602 的切换后，**603** 的凯亚 E 真正调用完整 Snapshot，日志已没有 `ttds`、`atk_per=0`。此次没有在 602 切换前安排凯亚快照，因此 receiver 存在性判定没有被同帧提前读取改变。

N1 系数 0.5375，E 系数 1.912；CR=0，无通用／元素增伤或反应，防御乘区 `101/291`、抗性乘区 0.9。例如 R1 N1：`52.009815999999994×0.5375×(101/291)×0.9 = 8.732421297216494`。原始统计总伤害 mean 为 **65.33266136319587**。外部取证与后来的本地执行分开记录，不能仅凭此算式当作本地对照证据。

## 精确源码语义

- [thrilling.go:30–47](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/thrilling/thrilling.go#L30-L47)：`isActive` 是持有者当前在场状态的闭包缓存，初始化从已配置前台取值；切入只置 true，切出先置 false。它不是接收者增益是否存在的标记。
- [thrilling.go:48–66](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/thrilling/thrilling.go#L48-L66)：依次检查持有者 `ttds-icd`、写 1200 帧 ICD、检查接收者共享键 `ttds`，最后才写 600 帧 StatMod。接收者已有则不刷新、不替换、不叠加；本次持有者 ICD 已经消耗。R1 与 R5 虽来自不同持有者，接收者键仍相同。
- [player/exec.go:138–152](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/exec.go#L138-L152)、[player.go:104–138](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/player.go#L104-L138)：swap 动作将回调排至 `Delays.Swap` 后，由真实完成回调先改 active、再同步发送 `OnCharacterSwap`；不能在请求时预发讨龙。
- [mods.go:180–187](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L180-L187)、[modifier.go:117–126](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117-L126)：`StatusIsActive` 与 `StatModIsActive` 都只有在 `expiry < frame` 时判过期。等号帧仍为 true；但这个查询无法找到已经被别的读取删除的 StatMod。
- [stats.go:24–69](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L24-L69)：完整 `Stats()` 在 `expiry <= frame` 时跳过 StatMod，并压缩数组删除它。若某个真实快照任务先于同帧切换读取接收者，之后 `StatModIsActive` 可以变为 false；这个分支本次未执行。
- [stats.go:122–151](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L122-L151)：`SelectStat()` 在等号帧过滤贡献，**不删除**记录。`TotalDef`、`CurrentHP→MaxHP` 走这一路径。
- [stats/status.go:63–104](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/stats/status/status.go#L63-L104)：普通每帧状态采样确实读取属性，但读取的是上述非删除路径。它不会让 TTDS 接收者键自动在 expiry 帧消失。
- [run.go:286–295](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/simulation/run.go#L286-L295)：先 Core.Tick（包含实际 swap 动画回调），再 OnTick 统计。debug CharacterDetails 的完整 Snapshot 则仅在初始化生成，不是每帧执行。

持有者 ICD 是普通 **Status**，不会被 `Stats()` 的 StatMod 清理路径删除；无卡肉时 `frame==expiry` 仍阻挡、`frame==expiry+1` 可通过，是明确源码结论。若等号帧失败，`isActive` 已在切出时变 false；下一帧不会自动补发，必须发生新的真实切入／切出。相反，接收者 StatMod 的“存在性”同时取决于 expiry 与之前是否真正读过完整属性，不能用一条按时清理的增益数组代替所有来源状态。

## 实测覆盖与剩余范围

已观察：初始持有者第一次切出领取、领取后换下再返回仍保留、两个不同精炼持有者共用接收者键、接收者 expiry 等号帧两次拒绝并消耗各自持有者 ICD、expiry+1 的实际无加成快照、持有者 ICD+1 可再次触发。

未观察：持有者 ICD 等号帧切出失败、R5 成功领取、接收者非边界时高低精炼替换尝试、同帧完整属性读取先于 swap 后使增益可重新领取、角色卡肉延长、当前游戏实机行为。其源码条件可作为实现依据，但不能称本 fixture 全部验证。唯一外部执行的配置／result／sample 未改写，没有第二次尝试。

## 冻结后一次本地 runtime／capture 对照

收到运行时与 schema 冻结确认后，执行一次：

```sh
node docs/cross-validation/ttds/compare-local.mjs
```

**首次 exit 0，1.554763 秒，errors=[]，没有失败运行或复验。** 没有生产文件变更，没有新增 unit 矩阵、全套测试或构建。脚本从 `fixtures.makeConfig` 构造配置，直接输入外部已观测的 **11 个真实切换完成帧**，由本地普通角色转换驱动 `thrillingTalesModel`；不重新猜测或编译外部的动作动画。

面板恢复使用外部初始化 `CharacterDetails` 保留的基础 ATK 和静态属性。凯亚输入始终是 **baseAtk=41.9434、atkPct=0、flatAtk=0**，没有将带讨龙的 52.009815999999994 当作白值再加一次。芭芭拉 R1／丽莎 R5 只在模型中声明持有者与精炼，未手写任何 `ttds` buff；实际 24% 增益由运行时生成。

每条 N1 使用来源起手时刻和命中帧，在命中时真实取样。凯亚 E 保留 **action snapshot=603、hit=631**。空切人动作不读取完整 Stats；所以 602／1803 两个接收者等号帧仍能保留来源存在性判定，随后真实属性取样才清理。

| 命中帧 | 外部＝本地伤害 | 本地 ATK% | 伤害绝对残差 | capture→JSON→replay 差 |
| ---: | ---: | ---: | ---: | ---: |
| 16 | 8.732421297216494 | 0.24 | 0 | 0 |
| 216 | 8.732421297216494 | 0.24 | 0 | 0 |
| 631 | 25.050846992164946 | 0 | 0 | 0 |
| 1217 | 8.732421297216494 | 0.24 | 0 | 0 |
| 1817 | 7.042275239690721 | 0 | 0 | 0 |
| 1977 | 7.042275239690721 | 0 | 0 | 0 |

11 次显式完成时刻全部相等；6 次讨龙判定依次为：2 `applied`、202 `owner-cooldown`、602 `recipient-already-buffed`、1203 `applied`、1803 `recipient-already-buffed`、1963 `owner-cooldown`。持有者 ICD 前后值逐项匹配外部状态记录。602／1803 两次判定的 `recipientExpiresFrameBefore` 和 `After` 都等于当帧，证明未将数值增益的半开区间错误当成记录存在性的边界。

外部与本地总伤害均为 **65.33266136319587**，绝对残差 **0**。六次真实 damage event 分别执行 `captureSimulationHit → serializeSimulationHit → parseSimulationHit → replaySimulationHit`，每次回放与对应外部伤害严格相等；并非另造六条手工伤害冒充完整上下文恢复。

已保存：

- [对照脚本](ttds/compare-local.mjs)、[本地完整配置](ttds/swap-reference.local-config.json)、[本地完整结果](ttds/swap-reference.local-result.json)
- [逐项残差、实际命令和执行前后源码 SHA256](ttds/swap-reference.local-metrics.json)、[全部本地资料 SHA256 清单](ttds/swap-reference.local-artifacts.json)。执行前后源码指纹一致。
- 命中 0：[capture](ttds/swap-reference.hit-0.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-0.replay.json)
- 命中 1：[capture](ttds/swap-reference.hit-1.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-1.replay.json)
- 命中 2：[capture](ttds/swap-reference.hit-2.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-2.replay.json)
- 命中 3：[capture](ttds/swap-reference.hit-3.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-3.replay.json)
- 命中 4：[capture](ttds/swap-reference.hit-4.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-4.replay.json)
- 命中 5：[capture](ttds/swap-reference.hit-5.capture.json)／[replay 与轨迹](ttds/swap-reference.hit-5.replay.json)

本地结果标记为 `legacy-implicit` 角色转换，因为真实完成帧作为明确输入给定；它验证讨龙运行时与完整回放，**不证明动作动画编译器能独立推导这些帧**。没有复制凯亚 E 的随机粒子，也没有认证能量或相同 seed。外部未覆盖的持有者冷却等号失败、R5 成功领取等分支仍保持未覆盖，不因本地零差扩大结论。
