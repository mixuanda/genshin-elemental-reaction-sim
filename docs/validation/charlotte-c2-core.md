# 夏洛蒂 E C2–5：逐击状态与核心验证

本轮把既有点按、长按完整条件动作从 C0–1 扩展到 C0–5，没有新造动作 ID 或复制命中来增加覆盖。长按仍为初击加八次标记；第八次标记继续保留，其 C2 状态必须实际填写，不能默认八次都带 C2。C6 仍阻断。

## 实际输入与共享公式

`gameContext.charlotteSkill` 增加三项：

- `c2HitStacks?: Record<hitId, 0|1|2|3>`：各次取样时实际 C2 层数，缺 key 为未知。初击可能带此前 E 的旧 C2，不能由本次初击命中人数倒填。
- `c2IncludedStacks?: 0|1|2|3`：共同输入最终 ATK 已含的 C2 份额，未知不能当零。
- `c2BaseAttack?: number`：明确角色白值加武器白值。源配装从 `characterBaseAtk + weaponBaseAtk` 计算并写回上下文；最终面板在实际层数与已含层数不同时需要用户提供，不能从最终 ATK 反推。

各击 `attackAdjustment` 使用同一个 AST 核心：

`本击 ATK = 共同面板 ATK + 基础 ATK × 0.1 × (实际层数 − 已含层数)`

实际层数与已含层数相等时，增量必为零，生成同来源的零差表达式，说明 `10% × (n−n) = 0%`；不提供或伪造未知基础攻击变量。这样已含记账明确的单击不会被与结果无关的未知白值阻塞。

依赖挂到各自命中。完整输入要求所有选中的段都有实际状态；单选初击或某次标记不依赖未选命中的层数。C2–5 会把父字典归一为空对象供 UI 填写，但不将缺失命中填为 0。

`statsStableAcrossHits` 现明确要求除已逐击恢复的 C2 差值外，其他进攻、装备和目标状态稳定。A4 非枫丹队友人数、已含记账与未中断标记条件仍独立检查。C3 只增 Q 等级，C4 只影响 Q；C5 使用用户明确的有效 E 等级，不再加一次 3 级。

源配装转最终面板保持共同基底 ATK、基础 ATK 和各击差值，不把某个命中修正后的 ATK 写进所有命中的共同面板。JSON 恢复时核心按角色上下文重新生成公式，手改复制出的某段公式不能使同一输入产生另一套状态。

重新生成装备把 `c2IncludedStacks` 设为 0；导入新的展示柜最终面板清除旧已含份额和旧基础 ATK，避免沿用旧武器／等级。各击实际层数属于用户的历史条件，保留并提示重新核对。普通“转为最终面板”保留已明确的同一施放上下文，与新展示柜导入区分。

## 固定来源与第八次标记

固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`：

- [`charlotte/cons.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/cons.go) 的 C2 在初击伤害回调后，按敌人命中数覆盖为 10%、20%、30% ATKP，持续 720 帧。起手只重置本次计数，没有删除旧 C2。
- [`charlotte/skill.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/skill.go) 初击在起手 Snapshot，标记每隔 90 帧重新 Snapshot。初击不受它自己的后续 C2 回调倒填。
- [`character/stats.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go) 在 `Expiry() <= currentFrame` 时不再计入 StatMod；通用 StatusIsActive 用的是另一边界，不能拿它决定 C2 ATK 是否生效。
- [`attributes/stats.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attributes/stats.go) 为 `BaseATK × (1 + ATKP) + FlatATK`，不是最终攻击乘 C2 百分比。
- StatMod 受角色命中停顿和刷新影响，所以这里只接受真实逐击状态，不自动假定所有场景都在第八次失效。

固定 Optimizer `180a0a1015cb725c7570cd828eb086749960df98` 的 [Charlotte 生产表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Charlotte/index.tsx) 将 C2 参数 `[0.1, 0.2, 0.3, 12]` 接入 `atk_`，与上述白值百分比和 12 秒名义时间一致。

新增独立补充归档 `packages/game-data/sources/charlotte-c2/source.json.gz`，共 13 份实际原文，SHA-256：`7c154431a94e02d9bfd83da5347c49935c93e8e8bcaff1a41c9a337db84cac2e`。原 `collei-charlotte-skills/source.json.gz` 未修改，SHA 仍为 `58bef8853affb1cbf2b8bf1f18c5e64a10a97f15683f2d1d39b4c4d92a7d4f8e`。新 manifest 记录逐文件指纹和既有 Optimizer 原文指针，活动映射 evidence 的 `charlotteC2` 指向这次补充。早期 C0–1 报告是当时范围，本报告补充当前 C0–5 条件支持。

## 实际测试顺序与结果

唯一新增 `packages/sim-core/src/__tests__/calculator-charlotte-c2.test.ts`，共三项高信号测试：

1. 来源字节、ATKP 与过期边界；长按第八段未知阻断／明确零生效；单击不依赖其余未知；初击旧 C2；C6 阻断。
2. 面板已含三层减一次、源配装基础攻击、共同面板转最终面板、JSON 公式还原、展示柜导入清除旧记账。
3. 读取另一来源子任务唯一已执行的固定 gcsim 原始样本，逐九击恢复实际取样条件并用共享核心比较；没有再次运行外部引擎。

首次 **07:20:31**：**3 passed / 3**，总 **1.39 s**、测试 **162 ms**、exit 0。原始日志：[calculator-charlotte-c2.log](./calculator-charlotte-c2.log) 与对应 `.exit`。

随后按 UI 路径契约补空字典初始化，并按最小依赖原则允许实际层数等于已含层数时不索要白值；只向第二项补“相等可算／不等仍阻断”的断言。仅复验该项，**07:25:42**：**1 passed / 2 skipped**，总 **1.31 s**、测试 **111 ms**、exit 0。原始日志：[calculator-charlotte-c2-equal-stacks.log](./calculator-charlotte-c2-equal-stacks.log) 与对应 `.exit`。未重新运行其余两项、旧全集、构建或浏览器。

### 独立手算教学值

T1 长按、共同 ATK 1000、基础 ATK 500、CR .5/CD 1、角色与敌人 90 级、抗性 .1；初击与末标记实际 0 层，前七次实际 3 层，面板已含 0 层，2 名非枫丹其他队友（A4 冰伤 .1）：

`(1.392 × 1000 + 7 × .406 × 1150 + .406 × 1000) × 1.1 × .5 × .9`

非暴击总伤 **2507.8185**，期望 **3761.72775**。若把面板改成已含三层的 ATK 1150，正确扣除初击／末段的 150 ATK 后结果相同。

### 唯一外部样本的本地复现

外部记录由来源子任务执行，详情见 [外部报告](../cross-validation/charlotte-c2-external.md)。本子任务仅读取原始 `hold-reference.sample.json`：Lv1 C2 夏洛蒂、Lv1 口袋魔导书、ATK 白值 47.44352、暴击率 0、敌人 Lv90／10% 抗性、关闭命中停顿。

| 来源实际命中 | 实际帧 | Snapshot | 实际 C2 | 外部非暴击伤害 |
| --- | --- | --- | --- | ---: |
| 初击 | 113 | 起手帧 1 | 0 | 20.629420712907212 |
| 标记 1–7 | 203、293、383、473、563、653、743 | 每击同帧 | 1 | 每击 6.618605812057733 |
| 标记 8 | 833 | 833 | 0，C2 已到期 | 6.016914374597937 |

第八段伤害仍存在，只有 ATK 增益到期。新核心测试逐九击比较通过，使用十二位小数精度断言（每击允许绝差小于 `5e-13`）；未输出逐击测得误差，因此不声称本地差值严格为零。外部原始 result 保留的总值为 **72.97657577190927**，不以重新求和改变最后一位。

这个样本支持指定无命中停顿场景的来源边界，不能推广为任意刷新／卡肉／几何都自动核验。当前功能仍是明确历史层数条件下的完整数值计算，C6、自动刷新／过期时钟和动态其他状态没有宣称完成。
