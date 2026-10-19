# 六把条件武器的独立计算增量

日期：2026-09-24。本文记录实际新增条款和定点验证，不作为整把武器或当前游戏机制已验证声明。

## 实际缺口与本次范围

本轮开始时活动目录有 252 把可常规配装武器，194 把有条件/数值条款映射。58 把未计入映射的条目并非都缺基础配装能力：10 把没有被动，既有解析器已支持其基础属性及合法 R1；17 把主要涉及能量、治疗或冷却（含另有运行时路径的西风系列），1 把涉及切换后的队友领取，16 把涉及独立追加攻击，另有 14 把条件属性候选。此次只为最后一组中来源足够的 6 把增加部分条款，映射集合增加 6 项，未把 10 把无被动武器伪计成新被动实现。

代码为 `packages/game-data/src/weapon-conditioned-expansion.ts`，接入 `equipment-build.ts` 与 `equipment-formulas.ts` 的既有共享 AST 和输入控件。没有新增伤害引擎、自动触发队列或 UI 专用算术，没有修改 generated coverage；全局覆盖产物由主任务统一生成。普通技能入口不要求组队或轮转。

| 武器 | 本次 R1–R5 可执行条款 | 明确输入 |
| --- | --- | --- |
| 弥坚骨 11430 | 普攻基础伤害加值＝本击最终攻击力 × 16/20/24/28/32% | 冲刺后合法 7 秒窗口、命中前剩余 0–18 次、前后台 |
| 聊聊棒 12424 | 攻击力 +16/20/24/28/32%；全元素增伤 +12/15/18/21/24% | 火附着攻击窗口与水冰雷草附着增伤窗口分别输入 |
| 试作星镰 13402 | 普攻/重击伤害加成＝有效层数 × 8/10/12/14/16% | 本击前 12 秒有效层数 0–2 |
| 群王局戏 14435 | 攻击力 +20/25/30/35/40%；精通 +100/125/150/175/200 | 已成立的棋中法度窗口，含实际已获得的延长 |
| 寸心余响 14436 | 精通 +60/75/90/105/120 | 元素反应后 12 秒精通窗口有效状态 |
| 金律铸影 12435 | 每个普通乐章攻击力 +18/22.5/27/31.5/36%，或精通 +120/150/180/210/240 | 主乐章与复调各自选择无/攻击/精通/星烁；同种普通属性可相加 |

弥坚骨加值使用 final-panel 读取本击最终攻击力，不增加角色攻击力、不再次乘攻击力百分比。試作星镰作用于普攻与重击的增伤区，不是攻击力百分比。金律两个状态各自保留于公式输入，不以一个不明层数替代。群王和金律的面板属性通过现有 pre-panel AST 进入基础属性与后续计算。

命中特有条件未知时，弥坚骨只阻塞普攻，试作星镰只阻塞普攻/重击；聊聊棒未知元素窗口只阻塞相应元素普通命中。未知攻击或精通属性会要求补齐面板条件，不默认 false。明确关闭或已耗尽的窗口按零处理。每击变化应恢复各自上下文，同一配装快照不会自动推演时间和消耗。

## 固定来源及未解决事项

`packages/game-data/sources/weapon-conditioned-expansion/manifest.json` 记录 15 个原始文件的 SHA-256、字节数及固定 URL，其中金律 Optimizer 文件复用已有档案。`reviewed-catalog.json` 保存 6 把完整五档 description/values；实际解析器逐档检查活动条款，来源文本或向量改变即要求重新审核。`source-audit.md/json` 是并行完成的 11 候选子审计，覆盖群王、寸心、金律及保留阻塞的 8 把；它不取代本报告中的前 3 把审计。

- 数值来源使用 [genshin-db 固定目录](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons) 与 [Optimizer 固定生产源码](https://github.com/frzyc/genshin-optimizer/tree/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons)。released/preview 指针及 provisional 状态未改变。
- [弥坚骨固定 gcsim](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/sturdybone/sturdybone.go) 写成 `0.12 + 0.4 * R`，与目录及 Optimizer 五档系数冲突。此次采用后两者一致的 16/20/24/28/32%；gcsim 原文归档为冲突证据，不能当成匹配验证。前台限定、窗口与次数的恢复范围明示，不自动触发冲刺或执行体力降低。
- [试作星镰固定 gcsim](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/prototype/prototype.go) 使用攻击力百分比ATKP，目录/Optimizer使用普攻/重击伤害加成DMG%；采用后两者。该固定源的 `AttackTagExtra` 就是重击，`Normal | Extra` 与普攻/重击没有标签冲突；此前标签冲突表述经 [后续来源审阅](../cross-validation/weapon-lifecycle-next-source-audit.md) 校正。生产计算原已使用正确增伤区，叠层和计时仍未自动执行。
- [聊聊棒固定 Optimizer](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Claymore/TalkingStick/index.tsx) 将元素窗口时长显示为 12 秒，目录是 15 秒，gcsim 则是 TODO。仅执行明确有效状态，不推断争议时间边界或附着触发。
- 金律复调目录 12 秒、固定 Optimizer 显示 10 秒；复调历史、10 秒主乐章循环和触发间隔不自动推演。金律、寸心的星烁增伤仍未接入，不能折算为普通技能或其他反应增伤。
- 群王的战技触发、6 秒窗口、至多延长 6 秒及 12 秒触发间隔仍为用户声明的真实条件。
- 熔猎异端之刃缺移动距离映射；星锋剑 R4/R5 及共鸣暴伤条件存在冲突；新枝、银釭、蝶变、凝雪沉心、漩流颂歌、柔风游弦缺本批独立固定生产来源。继续保留阻塞，不用目录文字补猜。

## 实际执行的验证

只新增 3 个高信号用例于 `packages/game-data/src/weapon-conditioned-expansion.test.ts`：

1. 6 把 × R1–R5 共 30 个精炼实例，对照独立转录的固定 Optimizer 向量；同时核对 15 个源文件的实际字节数及 SHA-256。
2. 未知条件仅阻塞匹配命中、两种窗口相互独立、金律同类双份与星烁排除、未选中待补条件命中的 JSON/最终面板保存。
3. 弥坚骨、试作星镰、金律真实装备路径进入共享 AST，以独立普通伤害算式比较，核对数值代入、JSON 往返及转换最终面板后无二次加算。

首次命令：

```sh
npx vitest run packages/game-data/src/weapon-conditioned-expansion.test.ts
```

退出码 **1**：3 个用例中 2 通过、1 失败；总耗时 **1.14 秒**，测试 **58 ms**。完整输出在 `docs/validation/logs/weapon-conditioned-expansion-vitest.txt`。失败是测试误把“已转换命中改成另一攻击分类”当成“恢复未选中且条件未知的命中”。已将夹具改为转换前保留一个未选中的重击，再在转换后选择它；生产代码未因此修改。

仅失败用例重跑：

```sh
npx vitest run packages/game-data/src/weapon-conditioned-expansion.test.ts -t "keeps unknown hit-only states local"
```

退出码 **0**：1 通过、其余 2 跳过；总耗时 **1.07 秒**，测试 **24 ms**。完整输出在 `docs/validation/logs/weapon-conditioned-expansion-vitest-retry.txt`。三项均已有通过证据；未重跑已通过项、未执行全套、build、外部模拟或 data:status。向量断言为浮点近似或精确比较，手算伤害使用 `toBeCloseTo(..., 10)`；未把该断言阈值表述为另行测得的最大误差。

整把武器完整验证新增数为 **0**。本次增加的是 6 把来源可追溯、条件明确的部分数值实现。

## 正常页面定点验证

主任务通知统一 data:check、typecheck 和 production build 已通过后，仅执行本增量的一个新浏览器流程，复用 4173 的既有预览服务：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/weapon-conditioned-expansion.spec.ts
```

退出码 **0**，首次 **1 passed**；用例 **3.5 秒**、总耗时 **3.9 秒**。完整输出：`docs/validation/logs/weapon-conditioned-expansion-playwright.txt`。没有重建、重启服务或补跑其他浏览器矩阵。

该流程从正常角色/技能选择与来源装备控件开始：凯亚 T1 N1 的 `0.5375 × ATK` 加上弥坚骨 R1 的 `0.16 × ATK`，分别验证未知窗口只阻塞普攻、剩余次数耗尽及后台状态归零。随后实际转换最终面板、下载 JSON、重新导入并再次应用来源配装，伤害均保持一致且不双加。第二代表为诺艾尔 T1 N1 `0.7912 × ATK` 与金律，独立主乐章/复调控件从攻击+精通改成两份精通，核对 ATK/EM 轨迹和普通伤害。整个过程没有创建或运行队伍模拟。
