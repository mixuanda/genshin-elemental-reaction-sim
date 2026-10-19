# 六把武器被动公式缺口 — 2026-09-28

对照正式 7.1 catalog `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，以下六件身份和基础属性均已收录，但每件都标记 `simulationStatus: metadata-only`。Catalog 的 R1–R5 数值只是 provisional 元数据，不代表运行公式已获得独立依据。

## 精确差异

| ID／名称／slug | 可用资料及可实施边界 | 当前真正缺失 |
|---|---|---|
| `weapon:11437` 新枝 (`newbough`) | Catalog 有 R1–R5 普通档攻击力、精通，以及星烁档攻击力、星烁伤害值。可确认静态身份、属性和这些候选数值。 | 固定 GO 无对应 sheet；固定 gcsim 无对应武器路径；a7 名册无该 ID。现有来源不能支撑实际触发归属、逐层刷新/冷却和普通档被星烁档替换的可执行状态机。不要把 catalog 被动文字当作公式来源。 |
| `weapon:11438` 银釭 (`silverlight`) | Catalog 有 R1–R5 每层精通数值，描述最多两层。 | 固定 GO、gcsim 和 a7 均无对应公式/注册项。独立层的实际持续时间、触发间隔与刷新规则没有独立核对；项目既有审计也将 12 秒独立层计时列为待交叉核对。仅凭 catalog 不能建立层计时运行时。 |
| `weapon:11522` 蝶变 (`beyondthechrysalis`) | Catalog 有三分支 R1–R5 数值：暴伤、星扩散伤害和能量恢复。 | 固定 GO、gcsim 和 a7 均无对应公式/注册项。当前可用固定执行来源没有三次施放分支次序、退场重置与能量恢复限频的可执行实现；不能简化成单一暴伤开关。 |
| `weapon:14437` 凝雪沉心 (`wintersheavyheart`) | Catalog 有普通档按冰／雷队员计数的精通／攻击力值及星烁替换档数值，计数上限也有记录。已归档简体 Genshin-DB JSON。 | 固定 GO、gcsim 和 a7 均无对应公式/注册项。团队元素计数公式与星烁替换虽有数据描述，尚无独立 typed formula source 可供核实和接入；现阶段不能宣称被动可执行。 |
| `weapon:14524` 漩流颂歌 (`hymnofthemaelstrom`) | Catalog 有治疗、生命、攻击力转换的 R1–R5 数值与描述；已归档简体 Genshin-DB JSON。 | 固定 GO、gcsim 和 a7 均无对应公式/注册项。治疗触发、三层与期限、超生命阈值的计算、附近前台领取者及反应增强窗口没有独立 typed formula source；动态生命和团队目标不可由文字摘要补成自动机制。 |
| `weapon:15437` 柔风游弦 (`breezebornerefrain`) | Catalog 有 R1–R5 常驻充能和星烁伤害数值；已归档简体 Genshin-DB JSON。 | 固定 GO、gcsim 和 a7 均无对应公式/注册项。三次命中叠层、清层转团队增益、持续与期间锁定没有独立 typed formula source；常驻充能资料不能证明触发链完成。 |

## 来源核对

- **正式 catalog**：上述路径下的运行快照、catalog index 与装备审计；六件均为已发布条目，但 `metadata-only`。当前 catalog 来源为 Genshin-DB `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，元数据自身注明 provisional，且被动触发行为未独立验证。
- **固定 Genshin Optimizer**：`180a0a1015cb725c7570cd828eb086749960df98`。该 revision 的递归 tree 没有六个 slug 的 weapon sheet；没有可归档的 typed effect formula。
- **固定 gcsim**：原项目注册快照 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 的装备名册没有这六个 sourceGameId；较新的已查 tree revision `286685309697cc8904122ec582ea0c3b78f53c7e` 也没有六个 slug 的武器实现路径。现有结论与 [上轮精确来源刷新](weapon-source-refresh-20260928.json) 一致。
- **本地原始归档**：`weapon-catalyst-effects` 保留凝雪沉心、漩流颂歌的简体 Genshin-DB JSON；`weapon-bow-effects` 保留柔风游弦的简体 JSON。它们补的是同一 catalog 的描述性数据，不是独立公式。新枝、银釭、蝶变没有对应本地武器原文归档；其 catalog 条目仍可查看，但不能据此升级 source status。

因此，当前证据允许继续使用六件的武器身份、基础属性与 R1–R5 元数据；**没有一件能仅凭这些资料晋升为完整可执行被动**。若后续有新的 typed Optimizer/gcsim 实现或可追溯的非本地化机制资料，再按精确 ID 核对后实现。这里的“缺失”限定于已检查的固定源码和项目归档，不声称游戏机制在外部任何地方都不存在。
