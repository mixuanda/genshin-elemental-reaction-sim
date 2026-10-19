# Optimizer 遗漏特殊组成：来源与实现边界

本批新增的是 **8 个实际单击组成**，不是 8 个完整动作。它们复用独立计算器的构筑、目标、实际快照及直接特殊反应核心；定义保持 `partial`，来源可信度保持 `source-provisional`。本文件记录源码审阅与实现约束，不代表已执行交叉数值测试或实机验证。

来源固定为 Optimizer `180a0a1015cb725c7570cd828eb086749960df98`。生产 sheet、15 级参数向量、天赋文本、关联 tooltip 和反应公式均已归档，逐文件哈希见 [莉奈娅 manifest](../../packages/game-data/sources/optimizer-missing-components/linnea/manifest.json)、[桑多涅 manifest](../../packages/game-data/sources/optimizer-missing-components/sandrone/manifest.json) 与 [阿罗夏 manifest](../../packages/game-data/sources/optimizer-missing-components/alyosha/manifest.json)。这些角色的 `formula/src/data/char` 文件仍含 TODO 和人工占位增益，归档用于审计，未作为可执行公式来源。

| 实际组成 | 分支／抗性 | 原始参数 | 本击额外条件 |
| --- | --- | --- | --- |
| 露米重锤 | 直接月结晶／岩 | `Linnea skill[1]`，`combat2.param2`，DEF | 超强形态、附近月笼 |
| 露米百万吨重压 | 直接月结晶／岩 | `Linnea skill[2]`，`combat2.param3`，DEF | 究极形态 |
| 桑多涅凝聚光束 | 直接星导／冰 | `Sandrone auto[5]`，`combat1.param6`，ATK | 解析模式、实际星导辉映与极星计数 |
| 桑多涅凝聚光束 | 直接星旋／冰 | `Sandrone auto[10]`，`combat1.param11`，ATK | 解析模式、实际星旋辉映 |
| 桑多涅第二棱镜弹 | 直接星导／冰 | `Sandrone skill[1]`，`combat2.param2`，ATK | 战技起手热量、实际星导辉映与极星计数 |
| 桑多涅第二棱镜弹 | 直接星旋／冰 | `Sandrone skill[3]`，`combat2.param4`，ATK | 战技起手热量、实际星旋辉映 |
| 桑多涅爆发射线 | 直接星导／冰 | `Sandrone burst[2]`，`combat3.param3`，ATK | 实际消费战术层数、星导辉映与极星计数 |
| 桑多涅爆发射线 | 直接星旋／冰 | `Sandrone burst[5]`，`combat3.param6`，ATK | 实际消费战术层数、星旋辉映 |

每击须明确发生记录、目标、命中与取样帧。所选文档保留原数据集身份和实际命座；C1 以上由当前 C0 来源范围阻塞，不能在创建组件时悄悄重置命座。历史最终面板必须与本击状态一致；未知特殊基础提升、已含本人份额、反应增伤、特殊加算与擢升值均保持待补。

莉奈娅与桑多涅的固有特殊基础提升分别读取本击实际 DEF 与 ATK，计算 `min(属性 × 0.00007, 0.14)`。A4 分别为实际接受者的 `转换前 DEF × 0.05`，以及 `min(转换前 ATK × 0.08, 160)` 元素精通；输入已含份额须扣除。莉奈娅本人为前台月兆角色时也会接受 A4，不能仅凭「前台是月兆角色」把本人排除。露米 A1 的岩抗降低取实际范围、在场及月兆状态，15%／30% 后者是总量。

桑多涅第二棱镜弹的 A1 在突破1后、实际起手热量 **严格大于50** 时取4倍；爆发射线按实际消费的战术层数 `n∈[0,10]` 取 `1 + 0.1n`。这些倍率只放大天赋项，不放大特殊加算，也不代替擢升倍率。轨迹由共享 AST 产生公式、数值代入和结果；属性、资源计数、帧与比例使用各自单位，中文释义见 `observed-special-component-text.ts`。

## 保留原文的来源裁决

桑多涅重击星旋节点错误引用了星导的 `beamStellarDmg`。同一 sheet 单独声明 `beamSsDmg = auto[last]`，天赋文本又将星旋编码明确绑定到参数10。本组件采用独立 `auto[10]` 向量，保留原节点冲突和两条绑定证据；没有扩大系数容差。[固定 sheet](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Sandrone/index.tsx)、[固定天赋文本](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Sandrone_gen.json)

sheet 对 E 与 Q 的 A1 共用同一条件开关，但天赋文本分别定义 E 的热量阈值和 Q 的实际战术消费。本击适配器分别恢复两项条件，不额外要求 Q 当前热量大于50。该裁决仍为固定来源解释，未晋升实机验证。

## 仍为 partial 的生命周期

莉奈娅仍缺露米首击与间隔、两段普通伤害间隔、喂食输入和形态转换时间、月笼检测、E 替换及 Q 刷新回调顺序。文本已说明 Q 对现有露米只刷新寿命、不改变形态；这不能推出完整25秒伤害次数。

桑多涅仍缺热量连续增减速率、扫射与光束周期、100点过载及低于50退出的实际边界、E 维修、战术获得／到期／清空时序和辉映转换尾段。特殊段替代对应普通段，不能将两者同时计入同一次组成。

阿罗夏的猎场与图加林撕咬仍是已有普通雷伤；精准状态的20%星导增伤不是新直接特殊攻击。虽然文本提供每2秒节奏及14秒持续时间，首击、到期、移动选敌、印记回调和治疗关联仍缺完整执行依据，不能据此推算七击。详见 [阿罗夏剩余范围](../../packages/game-data/sources/optimizer-missing-components/alyosha/backlog.zh-CN.md)。

本轮仅作源码对照与上述文件实现，未运行测试、构建或数据生成；数值和浏览器验收由主任务统一执行。
