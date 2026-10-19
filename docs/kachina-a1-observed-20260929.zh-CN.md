# 卡齐娜 A1 逐击观察与增伤记账

本次只扩展卡齐娜「冲天转转」已观察的 E 震荡。改动位于 `packages/sim-core/src/kachina-cast-context.ts`、`packages/sim-core/src/kachina-cast-formulas.ts`、`apps/web/src/calculator-kachina-controls.ts`，以及聚焦测试 `packages/game-data/src/character-mappings/optimizer-kachina-mappings.test.ts`。

固定 Optimizer 生产角色表在突破 1 后、A1 夜魂迸发条件为 `on` 时，把 `passive1.geo_dmg_` 加入岩元素伤害加成；固定参数表给出 `0.2`，持续文本对应 `12` 秒。来源为 [角色表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Kachina/index.tsx) 与 [参数表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Kachina/skillParam.json)。这里不依据持续文本推断实际激活帧、失效帧或逐击状态。

接触目标的每次震荡可记录 `a1Active`。若为 `true`，还须记录 `a1IncludedInDamageBonus`，明确本击提供的手动增伤或历史快照是否已经含有 A1 的 20%。共享 AST 执行 `0.2 × a1Active − 已含份额`，并将结果接到现有伤害加成乘区。已确认 `a1InactiveThroughout: true` 的旧输入仍可省略逐击 A1 字段；与逐击激活记录冲突、激活时缺少已含份额、或突破不足 1 时，不能称完整施放。

聚焦测试使用可编辑的合成面板：DEF 800、独立震荡天赋系数 0.6376、A4 附加 0.2 DEF、现有防御与抗性乘区分别 0.5 和 0.9。A1 未激活为 `301.536`；激活且未含于输入为 `361.8432`；输入或历史快照已含 0.2 时仍为 `361.8432`，不重复加入。数值不是游戏实测。

一次聚焦运行通过：1 个文件、6 个测试，Vitest 报告 4.88 秒，命令墙钟 5.453136833 秒；原工具输出的转录收据见 [kachina-a1-20260929.receipt.json](validation/kachina-a1-20260929.receipt.json)。未运行构建、广域测试或页面测试。固定 b4/a7 来源没有卡齐娜角色专属执行包，因此实际夜魂迸发触发、同帧先后、目标接触、震荡次数与实体寿命仍须用户观察输入；本改动没有自动日程或团队轮转结论。
