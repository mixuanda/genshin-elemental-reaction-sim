# 图莱 R5：叠层生成链与动作攻速边界

本轮关闭了指定四人队新捕获中图莱的实际叠层链；同时发现并修复了原生实现的动作攻速边界问题。修复补丁为 `136-normal-attack-speed-context.patch`（独立提交 `df33e5a`），微探针为 `tulaytullah-action-speed-native.test.ts`（`38a89af`）。本分支没有改共享构建目录、重建 native 或部署。

独立重放器从已接受的 E 动作、普攻／C6 的真实命中、离场和角色时钟生成期望层数，**不把图莱返回向量或层数日志当作生成器输入**。随后比较每击加成、所有层数日志、18 帧门限实例和 60 帧任务父链。动作时刻全部来自每份捕获，不硬编码旧阶段或首击帧。

| 项目 | 旧捕获 | 新捕获 |
| --- | ---: | ---: |
| 普攻／C6 原始命中 | 256 | 258 |
| `[0,7200)` 内普攻／C6 | 255 | 258 |
| E 重置／离场清除 | 8／5 | 8／5 |
| 命中门限接受／拒绝 | 96／160 | 97／161 |
| 自然加层任务 | 26 | 26 |
| 任务结果：增层／封顶停／旧来源停 | 18／6／2 | 18／6／2 |
| 层数变更日志 | 42 | 42 |
| 全属性快照攻速读取 | 305 | 307 |
| 动画状态为普攻，返回 `+0.2` | 271 | 273 |
| 其他动画，返回 nil | 34 | 34 |

两份重放均零失败。新原件是 `/workspace/GIDPS-cloud/mechanism-closure-20261022/team/team-120-observed.result.json`；其 manifest 中 WASM `84553bc3a7391bac0c3de8d1c6b8cd0c0b411a91a26a6a65f97fa03358791194` 与捕获执行标记一致。旧版为 `ad7f559e40af4115fad996e52de258710c5849eb06be1e15e59c8be84d20a2b4`。原件、配置和 manifest 的完整 SHA256 见 [旧报告](tulaytullah-legacy-20261022.json)／[新报告](tulaytullah-fixed-20261022.json)。各报告附逐击 `.hits.csv`、按动画事件顺序配对的 `.speed.csv` 及其 hash。

来源使用固定 Classic 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，14 个原文件逐一核对 Git blob 与固定树快照，记录 SHA256。图莱 R5 的公开描述给出 20% 普攻攻速、每秒 9.6% 普攻伤害、命中每 0.3 秒再加 19.2%、总上限 96%、14 秒持续和离场清除／E 重置；与本次数值契约一致。[KQM 原始武器资料](https://library.keqingmains.com/equipment/weapons/catalysts#tulaytullahs-remembrance)。执行细节以 [固定武器源文件](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go) 为准。

首轮可检查的事件链：E537 → 自然597，一层；首 N1 在638先吃一层，命中后变三层；C6 在646吃三层并被命中门限挡住。旧版 N2 在658，已过657自然加层，吃四层再加到六层；新版 N2 在654，吃三层且命中门限尚未结束，之后657自然成四层，662的 C6 吃四层再加到六层。新版701成八层、717自然成九层、730封顶十层。这个变化是实际动作提前造成的合法层数差异。

收尾也逐一覆盖：旧版 E2498／6354 和新版 E2490／6334 将原十层重置为零；随后才落地的 C6 新快照吃零层。离场清除后，旧来源的 60 帧任务仍可能执行，但来源失效后不会加层；两次这种任务均被独立重放识别。其余六个到达上限后的定时任务停止，不再排下一次。

门限边界需精确表述：`StatusIsActive` 依赖 [`FindCheckExpiry`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go)，状态在 `frame==expiry` 仍有效。因此此固定源的命中再触发要求 `frame > previousFrame+18`，不是 `>=`。本轴没有恰好相隔18帧的再击，不能称已实际测过18／19帧边界。当前任务的26个角色定时任务均为60个角色时钟单位，本轴没有角色受击停顿；这不覆盖有 hitlag 的时钟重放。

攻速缺陷及修复：[`useAbility`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/exec.go) 先调用角色动作构造器，后 `SetActionUsed`；[`WindfavoredAttack`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/wanderer/attack.go) 在构造器中已读取 AtkSpd。旧图莱／沙上用当前动画是不是普攻来过滤，读到的是前一个动作，导致 CA→N 漏加普攻攻速，N→CA 反而把它带入重击构造。

136只在构造器 `f(param)` 周围设置本次动作读取上下文并恢复；图莱／沙上用本次动作判定普攻攻速，构造器外保留原来的当前动画判定。它没有提前更改 `CurrentState`、`LastAction`、移除回调或状态切换事件，也没有取消对重击／瞄准／下落／E／Q 的过滤。错误、嵌套调用和 panic 都恢复先前上下文。

原四人 C6 队的六次 CA→N 首击取消阈值，旧版全部25帧，新版全部21帧，分别独立吻合 `−2+AtkSpdAdjust(30,0.1)` 和 `−2+AtkSpdAdjust(30,0.4)`。仅修图莱而保留旧沙上过滤时会是22帧；136同时修正了两者。这个阈值不是每击伤害的快照时刻，也不能把少4帧乘次数直接当成DPS收益。

8秒 C0 微探针隔离了这一行为：

| 探针 | 旧版 | 修复后预期及主线实测 |
| --- | ---: | ---: |
| 仅图莱，CA→N 的下一普攻阈值 | 28 | 24 |
| 图莱＋沙上，CA→N | 28 | 22 |
| 仅图莱，N→CA 的下一普攻阈值 | 38 | 45 |
| 图莱＋沙上，N→CA | 36 | 45 |

本分支在旧 Classic／Stellar 各跑2例确认缺陷；主线在新双 WASM 各跑同样2例通过。补丁对 Classic 和四份已准备 Stellar 源小副本均可直接应用，bridge copy 无同名覆盖。独立小 Go scaffold 以补丁真实 helper／test 执行3个顶层测试、7种动作子例通过；主线另已在完整的两版 player 包通过上下文负测与快照 Amount 调用／过期检查。Stellar 构建需显式把136加入补丁列表，不能依赖 Classic 的目录 glob。

旧新使用相同配置和种子；此轮二进制同时包含135黑蚀首Q修复与136动作攻速修复。半开窗口变化为617→619击、29,529,976.75→29,547,632.44伤害、246,083.14→246,230.27 DPS。窗口内多一个普通 N1、两个 C6 追加，少一次珐露珊火扩散。总变化是这次固定输入执行的结果，**不能归为图莱单项收益、随机期望或稳态DPS**。[逐项比较数据](tulaytullah-comparison-20261022.json) 保留精确值。

一个局部伤害差可完整说明：旧首 N2 在658伤害89,669.183665，新首 N2 在654伤害85,670.152260，实际暴击随机数相同。除了图莱少一层（伤害加成减少0.096），新版654仍正好处在珐露珊A4从606触发、654到期的门限内，因此少208.265777632基础平伤。固定旧击其他输入先只换图莱加成，伤害减少2,429.990581；再按新版加成移除A4，减少1,569.040825，复算等于新版该击。这个顺序条件分解仅解释这一击，不是整队支援边际贡献。

剩余范围：未新增精确18／19帧、14秒自然到期、效果外普攻或受击停顿探针；没有把动作构造时未导出的 StatRead 变成新的公式节点。已验证的258逐击生成链、任务取消和离场行为可以收束本队图莱部分，产品 `explanationGaps` 仍须保留其结构性缺口。没有必要为这些未发生的边界再跑完整120秒。

复跑新捕获：

```sh
python scripts/audit-tulaytullah-capture.py \
  /workspace/GIDPS-cloud/mechanism-closure-20261022/team/team-120-observed.result.json \
  --source-root /workspace/GIDPS-cloud/source-build-cache/upstream/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/source \
  --action-context fixed \
  --manifest /workspace/GIDPS-cloud/player-import-integration/apps/web/public/source-host/manifest.json \
  --output /tmp/tulaytullah-fixed.json
```
