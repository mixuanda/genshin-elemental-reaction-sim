# 三把武器的独立追击计算器：来源与交付范围

本次新增钺矛、苍纹角杯和冷寂迸音的独立条件追击文档。用户提供实际最终面板、目标条件、物理与通用增伤，并选择武器和 R1–R5，即可通过普通伤害核心计算一击；不需要队伍或轮转。输入前提是这次追击已经真实触发并命中该目标，计算器自身不证明触发过程。

| 武器 | R1–R5 基础伤害 | 固定来源分类 | 本文档计算范围 |
| --- | --- | --- | --- |
| 钺矛 `weapon:13302` | ATK × 1.6 / 2 / 2.4 / 2.8 / 3.2 | 普攻回调产生独立物理追击；名义 600 帧冷却，回调 +1 帧伤害 | 原目标一击 |
| 苍纹角杯 `weapon:14427` | 触发时最大 HP × .4 / .5 / .6 / .7 / .8 | 本人前台敌人伤害回调，物理范围追击；名义 900 帧冷却，回调 +1 帧伤害 | 一个明确实际被范围命中的目标 |
| 冷寂迸音 `weapon:15432` | 触发时最大 HP × .4 / .5 / .6 / .7 / .8 | 与角杯同构，保留独立武器身份和来源 | 一个明确实际被范围命中的目标 |

钺矛固定代码未另要求前台或非零宿主伤害，另两把的回调没有攻击类型／非零伤害过滤；本次没有人为把三者的触发条件统一成另一套规则。源冷却帧与 +1 帧只是来源元数据，不能把独立计算器说成已执行冷却、卡肉或自动触发。模拟运行时接入另据对应实施与实际测试记录。

## 实际原文与独立核对

- gcsim 固定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`：逐行读取三份武器实现，以及公共排程、敌人命中／伤害、角色 Snapshot 和 LICENSE。
- genshin-db 固定提交 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`：实际三份中文武器 JSON 与 LICENSE。三个身份与当前 released catalog 对应。
- 以上共 12 份原始字节归档为 `packages/game-data/sources/weapon-procs/source.json.gz`，归档 SHA-256 `b3a6b709f619e1b96ea2b22c1ecaad4aa1ef7100eb6f9f99bf9943627f5711aa`；逐文件 SHA-256 和来源路径记入同目录 `manifest.json`。
- Optimizer 固定提交 `180a0a1015cb725c7570cd828eb086749960df98`：另保留 17 份实际原文，HTTP 200、逐文件 SHA-256 与 Git blob 指纹匹配固定树，见 `manifest-go.json` 和 `raw/optimizer/`。
- 三者全部 R1–R5 共 **15 个系数位置** 在 gcsim 源式、归档目录、活动 catalog 和 Optimizer 生产 sheets 一致；按源码十进制表达式核对，最大数值差为 **0**。没有从空参数字段猜数值。

生产源码：[钺矛](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/spear/halberd/halberd.go)、[苍纹角杯](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/ashgraven/ashgraven.go)、[冷寂迸音](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go)。独立数值来源：[Optimizer 钺矛](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Polearm/Halberd/index.tsx)、[角杯](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/AshGravenDrinkingHorn/index.tsx)、[冷寂](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Bow/SequenceOfSolitude/index.tsx)。

Optimizer 的 `customDmgNode(..., 'elemental')` 在这里是通用伤害节点，并不意味着火水等元素伤害，也不是普通攻击／战技／爆发专属标签。钺矛和角杯显式为 physical；冷寂经 `Characters/dataUtil.tsx` 的 bow + elemental fallback 成为 physical。三者最终通过 `wr/src/formula.ts` 的普通伤害、暴击和期望公式。

同提交 `libs/gi/formula/src/data/weapon/` 的三个文件仍是 TODO 桩，`Data/Weapons/*/data.json` 的 `refinementBonus` 为空；本次明确没有把这些桩或空表当成实现／实测证据。真正倍率来自生产 sheets 和中文描述的独立对应。

## 共享定义与计算入口

`packages/reaction-formulas/src/independent-weapon-proc.ts` 保存唯一生产 R 向量及运行元数据，供独立计算器与事件运行时共用；两个 HP 武器共用同一个 R 数组。`packages/game-data/src/weapon-proc-definitions.ts` 只重新导出这些定义并附加原文证据。这样不新增 sim-core → game-data 包依赖，也不在两个计算路径复制倍率。

身份仅保留 `weaponId`（typed wire：`halberd`、`ashgravendrinkinghorn`、`sequenceofsolitude`）与 `catalogWeaponId`；没有额外同义 ID 或兼容别名 getter。

`createWeaponProcCalculatorDocument({weaponId, refinement, characterLevel, build, enemy, damageBonus})` 生成普通 `CalculatorDocument`。`getWeaponProcDocumentSelection(document)` 可从稳定文档 ID 恢复武器与精炼；无需新 gameContext、团队或宿主动作。

本次追击是独立 `ordinary / physical / proc` 命中：自己的 ATK/HP 项、暴击、防御和物理抗性，不作为宿主 `additiveBaseDamage`。`baseDamageFormula` 以固定来源倍率输入执行同一 AST；其输入 origin 为 `source-table` 且仅允许所选 R 的唯一数值，现有 UI 将其只读。最终面板和目标条件可编辑，修改精炼由 builder 重新生成倍率。每项实际变量、数值代入、中间值与解释均由现有结构化轨迹生成；JSON 保留文档和公式。

数据身份明确为此次固定 released catalog 的来源条件数值、`evidenceStatus: provisional`；不是当前游戏机制 verified。三把独立追击的覆盖单独记账，不据此把整个武器配装被动分类数量提高为完整实现。

## 实际验证

唯一新增文件 `packages/sim-core/src/__tests__/weapon-proc-calculator.test.ts`，两项测试：

1. 归档及逐文件指纹，17 个 Optimizer blob，全部 15 个 R 倍率与实际源式／双目录／生产 sheets 的对应。
2. 三把武器的全部精炼通过实际共享核心；独立手算非暴击、暴击和期望；完整执行轨迹的表达式／代入／结果一致；单击及独立标签；面板编辑；JSON；固定倍率只读域。

首次于 **06:34:49** 执行得到 **2 passed / 2**，总 **1.04 s**，测试 **106 ms**，exit 0。日志 `docs/validation/weapon-proc-calculator.log` 和 `.exit`。随后按整合要求移除重复身份字段及 catalog 字符串兼容 getter，同步 builder 和测试引用；此次简化后本子任务尚未另行执行检查，不能把先前运行当作最终类型构建证明。整合验证结果另据实际记录补入。

本子任务没有执行旧测试全集、构建、性能或浏览器测试。来源子任务仅静态读取和原文指纹核对，没有执行 upstream 软件。

独立教学参考：ATK 1000、HP 10000、CR .5、CD 1，角色与目标均 90 级、物抗 10%、无额外增伤：

| 单次追击 | 非暴击 | 暴击 | 期望 |
| --- | ---: | ---: | ---: |
| 钺矛 R1：`1000 × 1.6 × .5 × .9` | 720 | 1440 | 1080 |
| 钺矛 R5 | 1440 | 2880 | 2160 |
| 角杯／冷寂 R1：`10000 × .4 × .5 × .9` | 1800 | 3600 | 2700 |
| 角杯／冷寂 R5 | 3600 | 7200 | 5400 |

这些是可编辑教学面板下的独立算式，不是实际游戏配装或当前版本实测结果。
