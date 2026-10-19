# 诺艾尔基础动作与 Q 起手来源映射

固定行为来源：`genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。本轮将此前未进入允许清单的基础普通、重击及下落组件加入常规角色目录，另外保留 Q 起手两段的准确分类；不以 E 已存在推断其他技能已完成。

源清单、完整倍率与逐文件 SHA-256 在 `packages/game-data/src/character-mappings/noelle-source-manifest.json`，12 份原始文件保存在本目录 `source/`。12 组完整 15 级数值共 **180 个位置**与活动 `snapshot-953ea16…` 精确一致，最大绝对差 **0**；数值来源没有使用本地化百分比字符串推断缩放或攻击类型。

## 实際映射

| 常规目录动作 | 参数 | 缩放／类型 | 归属范围 |
|---|---|---|---|
| `noelle-normal-1`…`noelle-normal-4` | combat1.param1…4 | ATK／normal／物理 | 各一次输入的一击 |
| `noelle-charged-cycle` | combat1.param5 | ATK／charged／物理 | 单次旋转组成 |
| `noelle-charged-finisher` | combat1.param6 | ATK／charged／物理 | 终结组成 |
| `noelle-plunge-collision` | combat1.param9 | ATK／plunge／物理 | 路径碰撞组成 |
| `noelle-plunge-low`、`noelle-plunge-high` | combat1.param10、11 | ATK／plunge／物理 | 明确无碰撞的一次低／高空落地 |
| `noelle-burst-cast` 第一击、第二击 | combat3.param1、2 | ATK／burst／岩 | 本次 Q 起手两击，不含随后普通输入 |
| Q 转换参数 | combat3.param3 | DEF→额外固定 ATK 系数 | 作为显式公式参数；不是第三个伤害项 |

基础 9 组件使用 `noelle-burst-inactive` 形态，明确 C0、Q 关闭、无外部附魔。循环重击、终结重击及碰撞只标记部分组成；不能把两条重击系数当作完整持续重击。低／高空动作显式 `collision=0`；来源下落入口要求 `AirborneXianyun`，独立计算以合法下落已经发生为条件，不构造不存在的空中状态。

新增共 **11 个命中、10 个动作**。原护心铠 E 保留，因此诺艾尔在原始分类目录共有 12 个命中；Q 激活派生形态由独立计算器状态适配接入，不与原始数值记录重复计数。

## Q 的操作顺序与边界

`burst.go:34–47` 中第一份 `Snapshot` 返回值仅用于调试日志，真正保存的是 `TotalDef(true)`。`pkg/core/player/character/stats.go:122–166` 的 `true` 排除 `Extra=true` 属性增益，因此转换输入是**起手时非 Extra DEF**，不能直接拿任意当前最终 DEF 替代。

固定源 C0 先加入 `Q有效等级转换系数 × 起手非Extra DEF` 的 Extra 固定攻击力，再排入两个角色任务。+24 的首击使用 `burst` 倍率；+65 才把共用 `AttackInfo` 的名字和倍率改成 `burstskill`。`QueueAttack` 接收值并立即生成该次攻击快照，后改的倍率不会污染首击。两击标签始终都是 `ElementalBurst`，第二击的名字含 “Skill” 不代表技能伤害。

只有转换使用的 DEF 锁在起手；两击各自在任务执行时读取完整伤害快照。+24／+65 属于可随卡肉推迟的角色时钟。源文件对 `burstStart`、立即 DEF 快照与增益精确起始时间仍有 TODO，故这里保持固定来源的条件模型，不标记当前版本实战时序已独立验证。

源 Q 激活还将普通、重击、下落强制改为岩伤；C2 重击增伤、C4 护盾爆炸和 C6 转换／延长不属于本轮 C0 基础映射。A1 是护盾、A4 是 E 冷却缩减，不应因它们尚未形成完整轮转模块而阻塞已明确的基础伤害组件。

## 实际执行检查

仅运行一个新增来源专项：

```sh
npx vitest run packages/game-data/src/character-mappings/noelle-action-mappings.test.ts
```

**首次 1／1 passed，1.02 秒**；测试主体 12 毫秒。检查全部 180 数值、有效等级 1–15 的实际分类解析、全部 11 命中类型、Q 的转换参数、部分动作边界与 12 份存档哈希。[原始日志](../../validation/noelle-source-mappings.log)

此专项没有运行团队模拟，也不代表外部实际游戏逐帧对照；状态公式和来源动作执行各自保留其独立验证记录。本任务没有运行旧分类全集、全量测试或构建。
