# 条件武器普通属性来源审计

审计日期：2026-09-24。固定 Genshin Optimizer `180a0a1015cb725c7570cd828eb086749960df98` 与 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。

实际运行 catalog：`gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`；指针 `packages/game-data/manifests/runtime/current.ts`。本次 11 把候选中，3 把仅有明确条件下的普通属性条款可以进入实现，另外 8 把保留阻塞。整把武器机制已验证数为 0；此档案不修改运行时注册表，也不改变 released/preview 或 provisional 状态。

## 三项可实施的数值条款

所有向量均依次为 R1–R5。百分比在 JSON 中使用小数比例。条件均表示当前已经合法生效，不代表自动模拟触发或时间轴。

| 武器 | 可用普通条款 | 最小显式上下文 | 仍排除 |
| --- | --- | --- | --- |
| 群王局戏（14435） | 攻击力 20/25/30/35/40%；精通 100/125/150/175/200 | 同一个有效窗口布尔值 | E 触发、6 秒持续、12 秒冷却及一次重击延长 6 秒的自动判定 |
| 寸心余响（14436） | 精通 60/75/90/105/120 | 元素反应后 12 秒内的有效精通窗口 | 自动触发/后台时序；星烁增伤 16/20/24/28/32% |
| 金律铸影（12435） | 每个有效普通乐章攻击力 18/22.5/27/31.5/36%，或精通 120/150/180/210/240 | 主乐章与复调分别选择未激活/攻击力/精通/星烁；不得合并为一个不明层数 | 星烁增伤 28/35/42/49/56%、自动乐章循环和复调触发/计时 |

群王局戏的固定 GO sheet 同时门控攻击力与精通；寸心余响将普通精通与星烁增伤分为独立条件。二者与 catalog 五档数值一致，新增生产来源消除了原本只有 catalog 的普通条款阻塞。

金律铸影复用已有精确原文。GO 以两个独立条件合并普通属性；同种主乐章与复调可以相加。catalog 复调持续 **12 秒**，GO 文档 UI 显示 **10 秒**，此冲突未解决。因此只开放用户明确给出的当前普通数值状态，不能宣称复调时间轴验证完成。

## 三份固定生产源码

- 群王局戏：[固定原文](https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/ClashOfKings/index.tsx)；`packages/game-data/sources/weapon-conditioned-expansion/optimizer/ClashOfKings.tsx`；1526 bytes；SHA-256 `4238530d59c41bc1f3d0bd3c59aa1fc601a8e5525eb7e7039c745a4181bc99b0`；Git blob SHA-1 `3988bf79dc62957c7299d56ac2d8d8a98fe5e4fe`。
- 寸心余响：[固定原文](https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/EchoesOfTheHeart/index.tsx)；`packages/game-data/sources/weapon-conditioned-expansion/optimizer/EchoesOfTheHeart.tsx`；2063 bytes；SHA-256 `1493e77f79dbffb8debc9e79ada427109d97bb9bae0c55a37f6457c5d2f7bff5`；Git blob SHA-1 `074033251c64b9813ed6629fac26607ff66a7ba8`。
- 金律铸影：[固定原文](https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Claymore/ForgedByTheGoldenMelody/index.tsx)；`packages/game-data/sources/weapon-extended-effects/optimizer/libs__gi__sheets__src__Weapons__Claymore__ForgedByTheGoldenMelody__index.tsx.txt`；4091 bytes；SHA-256 `72b3627c605de05cbe9f8604bac834a19a9ff49d0eef20bacd68e6a3e6db5d58`；Git blob SHA-1 `1f07c66ee5a5d3ae18294a38be365fe708c78d1c`。

两份新下载原文与固定 GitHub tree 的 blob SHA-1 一致；金律铸影已有档案也核对一致。JSON 另含各 catalog 原文字节数/hash/固定 URL、R1–R5 原 values 和活动 catalog hash。

## 其余八项继续阻塞

| 武器 | R1–R5 数值摘要 | 保留原因 |
| --- | --- | --- |
| 熔猎异端之刃（11435） | 最低攻击力 18/22.5/27/31.5/36%，最高 36/45/54/63/72%；GO 每手动档 1/1.25/1.5/1.75/2% | GO 0–18 手动档没有实际移动距离映射；档位 0 与未激活不同。 |
| 新枝（11437） | 普通每层攻击力 4/5/6/7/8%，精通 20/25/30/35/40；星烁模式每层攻击力 6/7.5/9/10.5/12%，星烁增伤 8/10/12/14/16% | 固定 GO 无对应 sheet；星烁是替换，不能保留普通精通后再叠加。 |
| 银釭（11438） | 每层精通 52/65/78/91/104，最多 2 层 | 单一 catalog；12 秒独立层计时尚未交叉核对。 |
| 星锋剑（11521） | catalog 攻击力 16/20/24/32/40%，GO 16/20/24/28/32%；每已共鸣元素暴伤 0/6/6/6/6%；能量 3/3/5/5/5 | R4/R5 数值冲突；GO 将 R2+ 常驻共鸣暴伤错误地绑定到命中加成窗口。旅行者限制及能量也不能省略。 |
| 蝶变（11522） | 暴伤 56/72/88/104/120%；星扩散增伤 36/45/54/63/72%；能量 5/5.5/6/6.5/7 | 固定 GO 无对应 sheet；循环分支、退场重置与能量间隔不能由一个暴伤开关代替。 |
| 凝雪沉心（14437） | 普通每冰角色精通 24/30/36/42/48；每雷角色攻击力 4.8/6/7.2/8.4/9.6%；星烁模式每冰/雷角色精通 20/25/30/35/40，星烁增伤 6/7.5/9/10.5/12% | 固定 GO 无对应 sheet；须保留模式替换语义。可直接输入角色计数，不需要强迫建立完整队伍。 |
| 漩流颂歌（14524） | 治疗及每层 HP 4/5/6/7/8%；超过 40000 HP 每 1000 点给予攻击力 0.4/0.5/0.6/0.7/0.8%，上限 8/10/12/14/16% | 固定 GO 无对应 sheet；攻击力领取者是当前场上角色，HP 取值和每层上限待核对；共享属性目标尚不含治疗加成。 |
| 柔风游弦（15437） | 常驻 ER 20/25/30/35/40%；队伍星烁增伤 24/30/36/42/48% | 固定 GO 无对应 sheet；常驻 ER 虽可表达，仍保留本批单一 catalog 来源阻塞，不能据此宣称三层触发/队友领取已完成。 |

“固定 GO 无对应 sheet”仅指该 commit 的精确生产路径不存在，不主张其他版本或其他项目也不存在。新枝、银釭和蝶变 catalog 原文此次未重复归档；JSON 明确记为未归档，并保存原文 SHA-256、字节数及固定 URL。

## 执行边界

本任务仅新增两份 GO 原始文件与本审计 JSON/Markdown。来源摘要覆盖 11 项，不覆盖其他候选；未修改完整 manifest、reviewed-catalog、生产 TypeScript 或界面，未执行应用测试、构建或外部模拟。来源哈希核对用于确认证据原文，不作为计算运行结果。
