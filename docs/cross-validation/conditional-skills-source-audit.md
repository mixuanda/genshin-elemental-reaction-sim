# 条件 E/Q 完整单次动作来源审阅

本批从固定 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的执行函数读取命中语义，与活动 catalog 的完整 T1–15 参数向量逐值交叉对照。17 个映射展开为 25 个伤害实例、14 个完整条件动作；“完整”仅指所声明状态下该次输入的自身伤害，并不认证整套角色、附着、帧时序或队伍 DPS。

实现：[sourced-conditional-skill-mappings.ts](../../packages/game-data/src/character-mappings/sourced-conditional-skill-mappings.ts)。43 个原始文件（含许可证、执行代码及倍率表）及 SHA-256 归档于 [manifest](../../packages/game-data/sources/conditional-skills/manifest.json) 和对应 `source.json.gz`。来源是已固定版本的可审阅实现；本批不将任何机制状态提升为 `verified`。

| 角色／动作 | 条件动作数 | 实际伤害实例 | 已实现的数值与边界 |
| --- | ---: | ---: | --- |
| 迪卢克 E1/E2/E3 | 3 | 3 | `skill[eCounter]` 对应 combat2.param1–3；每次输入分别完整，不能将一次输入当三连。C0，合法段次已成立且四秒重置未发生，Q/A4 火伤状态未生效。 |
| 丽莎长 E，目标 0/1/2/3 层 | 4 | 4 | `OnEnemyHit` 按目标引雷层数选择 `skillHold[stacks]` 后清空；倍率不是基础值加上若干相同层数。使用 E 起手快照，独立单个目标且无多目标圈重叠。引雷寿命在来源仍有 TODO。 |
| 班尼特蓄力 1/2 | 2 | 5 | 第一档两击；第二档两击加 `explosion` 末段爆炸。C0，不含 C4 额外攻击；Q 领域未生效，完整蓄力未中断。 |
| 北斗反击 0/1/2 层 | 3 | 3 | `ATK × skillbase + ATK × skillbonus × counter`。额外层数通过同一命中的多条缩放项相加，2 层保留两份每层项，不放进伤害加成乘区。明确层数为输入条件；来源 A1 精准反击自动判定未实现。 |
| 香菱锅巴完整四口 | 1 | 4 | 锅巴生成于 E 起手后 13 帧，保存一次 `Snapshot`；四次喷火使用该快照。要求全部命中同一目标且目标防御／抗性／外部减益不变。C0，无 C1 火抗变化；结束后的 A4 辣椒不回溯增幅本次四口。 |
| 凝光无屏 Q | 1 | 6 | `jade=6`，六枚本体宝石全部命中，使用同一次 Q 起手快照。C0，没有可销毁璇玑屏，穿屏 A4 岩伤状态未生效。 |

同一动作的每个实例进入独立计算器已有的共享伤害核心和结构化步骤。完整动作可直接选择，仍可单独选中某一击；这些映射没有引入完整队伍或轮转的前置要求。面板稳定或历史快照要求是本批的显式条件，不能当成模拟器已经实现相应生命周期。

## 已审阅但本批没有冒充完成的来源

- 凝光有屏 Q：本批审阅确认额外六枚读取 `c.skillSnapshot`，与 Q 本体的快照不同，因此未把六枚当前面板直接复制为十二枚。后续已接入独立 E 历史最终进攻快照与两组 A4 记账，形成明确条件下的十二枚动作；来源对屏宝石命中时点与穿屏仍有 TODO。当前实现及后续检查见 [凝光历史快照记录](../validation/ningguang-screen-snapshot.md)，本批原测试范围保持不变。
- 刻晴 Q：本批审阅时尚未接入首击前 A4 的突破／面板记账，因此未在上述批次中注册。后续 `.12` 补齐十击、A4 暴击率及来源配装的非转换充能适配；`.14` 又补齐 C4/C6 逐击显式状态与已含份额，所选 Q 本体条件范围为 C0–C6。当前范围见 [逐击命座记录](../validation/keqing-constellation-context.md)，原 C0–C3 批次见 [刻晴／行秋来源记录](keqing-xingqiu-source-audit.md)。这不实现完整角色状态时间线，也不回写本批测试范围。
- 行秋 E：本批审阅时尚未建立两段 `rainscreen` 的 A4 水伤及 C4 基础倍率记账，因此未只凭两段倍率声称完成。后续复用本批固定来源归档，已补齐独立 E 两段、A4/C4 及目标既有 C2 减抗上下文；完整 Q 生命周期仍不在范围内。当前条件与后续检查见 [同一后续记录](keqing-xingqiu-source-audit.md)。
- 丽莎多目标长 E、锅巴转向／落空／外部扩散、迪卢克整条 E 时间线、北斗精准格挡、班尼特击飞及能量都不由本批伤害分类构成模拟支持。

## 实际执行的聚焦检查

执行一次：

```sh
npx vitest run packages/game-data/src/character-mappings/sourced-conditional-skill-mappings.test.ts
```

首次 **1 个文件、1 项通过；总耗时 1.31 秒，测试 58 毫秒，exit 0**。检查归档及 43 个源文件哈希，完整 300 个数值（含北斗附加层数项）与源代码表和活动 catalog 一致；确认 14 个动作均进入独立计算器、各实例计数正确，并经真实共享核心检查非暴击伤害。

数值基准为 ATK 2000、攻击方和目标均 Lv90、10% 对应抗性、无增伤／反应：北斗 2 层 **3974.4**；班尼特二段蓄力三击 **2844**；锅巴四口 **4006.08**；凝光无屏六枚 **4695.84**。这些是测试实际断言覆盖的条件计算值，不是实战 DPS 或外部模拟器运行测量。

原始日志：[conditional-skills-source-test.log](../validation/conditional-skills-source-test.log)，退出码：[conditional-skills-source-test.exit](../validation/conditional-skills-source-test.exit)。本分支任务没有执行旧测试全集、数据状态生成、构建、浏览器或性能测试；最终集成状态由主 QA 记录。
