# 可组合来源能力：第一组系数证据

本包的证据状态固定为 `source-provisional`。它保存固定提交的原文、文件身份和系数对应关系，**不是游戏内验证结论**，也不单独声明任何动作可以执行或完整覆盖角色技能。

## 收录范围

- 安柏 Q 单次箭雨伤害、重云 Q 单柄灵刃、刻晴 Q 初段／连斩／末段、埃洛伊 Q、钟离 Q：共 7 组系数。
- 安柏 N1–N5：共 5 组普攻系数。当前仅保存来源数据，正常连段执行状态为 `source-only-pending-normal-chain-runtime`。
- 相关角色的 burst、asc、初始化、生成系数文件；安柏 attack 与帧数工具；快照、伤害、附着及其必要辅助源码。关联命座／技能文件用于保留调用和前置状态上下文，不扩大本包执行范围。

## 数据接口

`definitions.json` 的 `coefficients` 数组中，每项包含 `id`、`characterSlug`、`talentSetId`、`abilityKey`、`parameterKey`、`sourceField`、`sourcePath`、`values`、`sourceValues`、`coefficientTolerance`。

`values` 来自活动 catalog，`sourceValues` 来自固定 gcsim 系数字段。每组 15 级向量还与固定 genshin-db 的 `src/data/stats/talents.json` 对应参数逐项相等；`coefficientTolerance` 均为 0。`attack[0]` 至 `attack[4]` 明确表示安柏普攻矩阵的各行，不表示把连段当作一个倍率。

活动目录由 `packages/game-data/manifests/runtime/current.ts` 指定。具体快照 ID、数据文件哈希、全部原始文件哈希见 `manifest.json`；未来目录更新后，不能把本次相等结论自动沿用到新快照。

## 固定来源与归档

- gcsim：`genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。
- genshin-db：`theBowja/genshin-db@49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，固定 7.1 数据。
- `source.json.gz` 解压为 JSON；`files` 对象以 `gcsim/` 或 `genshin-db/` 开头的路径为键，值为未经改写的 UTF-8 原文。两仓库的 LICENSE 一并保存。
- gcsim 原文的 Git blob SHA-1 与固定且未截断的完整 tree 一一匹配；genshin-db 文件与固定提交 blob 字节一致。清单另保存每份文件的字节数与 SHA-256。

本包仅完成来源身份和系数对齐。命中几何、动作连段与取消、时间顺序、附着／反应、敌人状态及被动生效条件仍由调用方的独立协议处理。归档这些源码不代表其中所有机制已经由应用支持。未运行测试、构建或项目生成命令。

## 本批可组合能力的实际边界

`src/source-ability-registry.ts` 与 `sim-core/src/source-runtime-abilities.ts` 将五个 C0 Q 编译为独立 `AbilityDefinition`。绑定只保存角色 ID、来源动作、有效天赋、突破、命座和来源版本；不保存整场签名，不固定 Lv1、攻击、暴击、初始能量或队友。所有 Q 的来源能量上限与消耗均为 40，未满足能量条件的输入仍由实际执行器拒绝。五个 Q 均没有独立产球声明。

| 来源动作 | 取样与自己的最后命中 | 起手至冷却就绪 | 延迟扣能 |
| --- | --- | --- | --- |
| 安柏 Q | 起手取样；原三个循环的 18 个任务，最后 192f | 56 + 720 = 776f | 59f |
| 重云 Q | 50 / 59 / 67f 分别取样 | 720f | 6f |
| 刻晴 Q | 56f、82–159f 每 11f、197f 分别取样 | 52 + 720 = 772f | 55f |
| 埃洛伊 Q | 起手取样，100f 命中 | 720f | 2f |
| 钟离 Q | 起手冻结 A4 的 33% MaxHP，101f 取主面板并命中 | 720f | 7f |

安柏 A1 在突破 1 起只对 Q 加 10% 暴击率。刻晴 A4 在突破 4 起随被接受的 Q 刷新 480f 的 15% 暴击率与充能，后续每击读取真实有效增益。钟离 A4 的附加来源使用独立 `flatSources.snapshotFrame=0`，不随 101f 主面板重新采样。

当前执行域限定单个静止且处于完整伤害范围内的目标，不复刻安柏随机箭雨周围落点，不声明钟离石化控制或其他未绑定技能。旧固定场景身份保持原样。N1–N5 的数值、发射帧及默认 10f 飞行已经入库，但能力编译器明确拒绝加载，直至真实连段推进和重置依赖完成；因此本批可执行来源动作计数为 **5**，不是 10。

## 已接受动作的帧内阶段与普通攻击段号

本组五角色 Q 与安柏普通攻击，经固定 simulation 主循环准备检查后实际接受的输入，采用 `actionPhase: 'after-frame-tasks-v1'`。`pkg/simulation/run.go:273–295` 先递增帧数并执行 `Core.Tick`；`pkg/core/core.go:150–153` 依次处理 Combat、Constructs、Player 和 `Tasks.Run`。之后完成能量、受伤、`OnTick`，主循环才回到准备检查与 `Player.Exec`（`pkg/simulation/run.go:182–197,230–242`）。角色能力及其前置动作事件在 `pkg/core/player/exec.go:183–196` 执行。

此结论指实际 accepted 输入，不涵盖其他代码绕开 simulation 而直接强制调用 `Player.Exec`。动作阶段新加入的零延迟任务不会让该帧再运行一次 `Tasks.Run`，将在后续任务循环处理（`pkg/core/task/task.go:38–50`）；直接函数调用以及立即伤害调用仍可在动作阶段发生。

安柏使用当前 `NormalCounter` 选择系数与帧数，在 `Attack` 返回前递增，N5 后回到第一个索引（`internal/characters/amber/attack.go:31–68`；`internal/template/character/character.go:99–107`）。成功执行非普攻动作后，全队段号重置；实际切人回调再次重置（`pkg/core/player/exec.go:159–167`；`pkg/core/player/player.go:104–121,191–195`）。等待、延迟和自然动画结束本身不重置段号，不能据此任意选择 N2–N5 或假定已经回到 N1。

归档已包含上述 `pkg/simulation/run.go`、`pkg/core/player/exec.go`、`pkg/core/player/player.go` 三份固定原文。此补档没有更改任何系数，也没有提高证据状态或授予正常连段执行能力。
