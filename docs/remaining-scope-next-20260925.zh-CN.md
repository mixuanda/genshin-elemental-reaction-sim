# `.24` 剩余范围与下一批实现地图

本文件是2026-09-25的只读实施规划，不是新增交付或验收结论。以已生成的 [分类覆盖](../packages/game-data/src/generated/classified-hit-coverage.json) 为准：120身份、1183命中模板、652条件完整动作、18部分动作、11阻塞。固定游戏观察仍为2026-09-24 14:48 UTC。主报告正在统一收尾，不能把其中尚未替换的`.23`数字当作当前分类。

建议下一批并行推进 **冰旅行者4个接线缺口、风／草旅行者4个跨源裁决与完整实体协议、兹白2个有限双段动作**。这覆盖2个现有partial与8个blocker所涉及的动作；是否能删除各原阻塞，须按最终实现域核定，不能预先承诺新总数。其余16个partial与3个来源冲突仍有明确后续工作，不能以“未知”宣布完结。

## 1. 已有固定来源，优先进入生产

| 并行组 | 精确对象 | 已有证据与可实现边界 | 共享实现与文件边界 |
| --- | --- | --- | --- |
| A：冰主事件状态与直接特殊伤害，4项 | `aether-cryo-skill-coordinated-mixed-blocked`、`lumine-cryo-skill-coordinated-mixed-blocked`；`aether-cryo-burst-stellar-blocked`、`lumine-cryo-burst-stellar-blocked` | 固定gcsim `a7dc4bf…` 的 `internal/characters/traveler/common/cryo/{skill,burst,stellar,asc}.go`。E具有定时与协同切换行为，Q已有普通／特殊向量，不是缺倍率。仓内 [cryo来源归档](../packages/game-data/sources/traveler-cryo-complete/manifest.json) 与 [旅行者来源归档](../packages/game-data/sources/traveler-male-charged-resolution/manifest.json) 可复用。 | 新建 `traveler-cryo-state-{context,schedule,formulas}.ts`；数据放独立 `traveler-cryo-state-mappings.ts` 和来源目录。复用 `mixed-source` 的普通／特殊逐击、共享AST、历史面板与最终面板记账。男女复用行为，保留独立身份与天赋绑定。 |
| B：风Q／草灯，4项 | `aether-anemo-burst-blocked`、`lumine-anemo-burst-blocked`；`aether-dendro-burst-lamp-tick-blocked`、`lumine-dendro-burst-lamp-tick-blocked` | gcsim风Q向量及草灯第14级确实与目录不同；但仓内固定Optimizer `180a0a1…` 的 `TravelerAnemoM/skillParam.json#/burst/0`、`TravelerDendroM/skillParam.json#/burst/0` 已与目录15级精确相等，`TravelerAnemoF/anemo.tsx`、`TravelerDendroF/dendro.tsx`明确同一伤害语义。可明确采用独立系数来源＋gcsim行为来源。 | 新建 `traveler-cross-source-resolution.ts` 保存逐字段裁决与旧冲突；再扩 `observed-entity`／`periodic-ordinary` 的完整生命周期。首个明确域可为无吸收风Q、无转化草灯，但不能只改系数后把单次tick标成完整。不得修改全局容差。 |
| C：兹白有限普通＋月结晶，2项 | `zibai-spirit-steed-ordinary-component`、`zibai-burst-ordinary-component` | 固定Optimizer `Zibai/index.tsx` 的 `skill.stride1Dmg/stride2Dmg` 与 `burst.skill1Dmg/skill2Dmg`；后两段均明确 `lunarDmgNode(...,'def','lunarcrystallize')`。本地 `char_Zibai_gen.json` 明确Q为两击、第二击月结晶。既有partial只有第一段，特殊分支核心已经存在。 | 新建 `zibai-finite-{context,schedule,formulas}.ts` 或为 `mixed-source` 增加独立adapter；共享 `lunar-crystallize-direct`，每击真实DEF/EM/双暴/目标、普通与特殊分区及已含被动记账。完整的是“一次合法灵驹重施的两击”或“一次Q两击”，**不是整个隙中月E姿态**。 |

A组的必要执行细节：E定时检查178/354/530/706帧；星超导协同由本人N/CA/P真实命中触发，12帧ICD等号仍阻塞，触发后延迟3帧取样；已排队尾段不因后来辉映切换而消失。Q在36帧锁定辉映、寒辉与伤害快照，命中时另读ATK基础提升；星超导读取真实极星领域应用次数。补归档 `cryo/attack.go`、`cryo/plunge.go`、`pkg/enemy/attack.go`、`pkg/reactable/stellarconduct_gadget.go`。若独立计算器接收已发生的合法触发记录，应明确其证据来源；不得把未实现的空中动作重建悄悄当作已认证P输入。

B组必须保留两条证据链：倍率来自哪个Optimizer字段，帧／实体／接触来自哪个gcsim函数。`anemo/burst.go`给出九次候选及吸收检查；`dendro/lealotus.go`给出实体寿命与周期。检查候选全部接触／落空、完整观察尾段、真实转换事件和快照，不能把候选数写成保证命中数。无吸收／无转化域之外仍有显式待办。

C组可先完成无需推断动画帧的**已观察有限双段计算协议**：两击发生时刻与快照作为正常可编辑输入，按已固定顺序和两段身份校验；来源未提供的动作帧、ICD、粒子和取消窗继续阻止其注册为自动团队能力。灵驹须确认本次重施实际合法；A1只加第二段，真实4秒窗口内为0.6×DEF；A4同岩队友DEF／水队友EM与固有月结晶基础提升分别结算，后者为每100DEF增加0.7%、上限14%。Q不能借用灵驹A1。Q延长隙中月1.7秒是外部姿态状态变化，不能由两段伤害结果冒充整个姿态已闭合。原始文件已在 `/tmp/gidps-optimizer-180a0a1`，正式接线前须按现有来源manifest归档原文与hash，不能仅依赖临时目录。

## 2. 18个partial的完整归属与剩余缺口

这些动作集中于7个角色；当前固定gcsim `b4ae769…`、`a7dc4bf…` 的目录中均无这7位的行为实现，固定Optimizer有伤害sheet。这里只表示**这两份固定实现的覆盖范围**，不代表其他可取得来源不存在。

| 项数 | 当前partial ID | 可立即实施的内容 | 完整生命周期仍需要的证据／机制 |
| --- | --- | --- | --- |
| 3 | `kachina-skill-riding-single-pulse`、`kachina-skill-independent-single-pulse`、`kachina-burst-initial` | `optimizer-kachina-mappings.ts`已有DEF倍率、A4基础加值；同一骑乘／独立实体可共用夜魂账本、形态切换、Q领域和A1窗口。 | 自动震荡首帧／周期、骑乘输入、每次夜魂消耗、Q与实体重置／刷新顺序。不能由领域持续时间除一个假定间隔求次数。 |
| 1 | `nefer-skill-rush` | `optimizer-skill-mappings.ts`、`nefer-ordinary-source.ts`已有突进ATK＋EM、帷幕与精通状态。可继续补实际资源和幻戏普通／月绽放分区。 | 种子吸收、帷幕生成／消费、幻戏本人及影子段日程、退出／重施。sheet把帷幕倍率用于E突进而tooltip限定幻戏的冲突已被显式记录，不能当作整个E行为已裁决。 |
| 2 | `zibai-spirit-steed-ordinary-component`、`zibai-burst-ordinary-component` | 上述C组可补有限双段，减少真实遗漏的月结晶伤害。 | 完整隙中月仍需相位资源获得／消费、姿态N/CA循环、Q延长及结束。两击完成不等于完整E或团队可执行。 |
| 1 | `lohen-skill-etch-resource` | `optimizer-resource-mappings.ts`已有实际willConsumed与天赋倍率的共享公式；`Lohen/index.tsx`还有姿态N/CA、加攻及等级条件，可形成真实资源账本接口。 | 争胜获得／消费顺序、奇谋完整输入与资源归属、欢悦触发时点；sheet UI的20步长不是游戏资源离散规则，不能用其生成合法动作循环。 |
| 1 | `linnea-lumi-pummeler-pair` | `optimizer-linnea-mappings.ts`和`Linnea/index.tsx`给普通双击、两种独立月结晶节点、A1范围减抗和A4转换。可接共享普通／特殊实体伤害。 | E/Q召唤、喂食／形态切换、攻击首帧／间隔／两击间隔、替换及目标接触。25秒不证明总轮数；目前不能把一组普通双击代表完整露米。 |
| 3 | `sandrone-charged-sweepdmg-component`、`sandrone-charged-beamdmg-component`、`sandrone-charged-overdrivedmg-component` | `optimizer-additional-mappings.ts`和`Sandrone/index.tsx`有三类组成及辉映普通／特殊分支。可复用held生命周期与混合伤害协议。 | 三种组成的输入／持续／释放关系、扫射与光束次数、实际转换边界及结束尾段。不能将三行倍率相加冒充一次重击。 |
| 2 | `alyosha-burst-field-tick`、`alyosha-burst-tugarin-bite` | `optimizer-additional-mappings.ts`和`Alyosha/index.tsx`有猎场／撕咬、A4 ER增伤及Precision状态。可共用实体事件、标记、治疗和加攻账本。 | 14秒窗口中的首末击、每2秒节奏边界、图加林索敌／触发、Precision应用顺序；仅14/2不认证七次命中。 |
| 5 | `kachina-plunge-collision`、`lohen-plunge-collision-base`、`linnea-plunge-collision-base`、`sandrone-plunge-collision-base`、`alyosha-plunge-collision-base` | 碰撞／低空／高空倍率和既有零碰撞完整分支继续可用。未来统一接真实空中状态、路径碰撞、落地及结束。 | 各角色合法起跳／空中资格、碰撞交付帧、落地／取消窗与姿态附魔。缺这些行为时不能复制诺艾尔帧数，不能再新增零碰撞分支来“消除”碰撞partial。 |

后续来源工作应按机制获取上述缺失字段，并直接进入生产：先资源／形态（卡齐娜、奈芙尔、洛恩），实体（莉奈娅、阿罗夏），持按混合（桑多涅），空中碰撞（5角色）。不继续抽查已完成角色，也不因为当前Go实现缺失而停止查找可信行为记录。若只取得有限公式，应交付新增可计算组成并继续明确保留生命周期partial。

## 3. 另外3个阻塞须先裁决

| 阻塞 | 当前证据 | 可执行下一步与解除条件 |
| --- | --- | --- |
| 水主长E×2：`aether-hydro-skill-hold-full-blocked`、`lumine-hydro-skill-hold-full-blocked` | gcsim `hydro/skill.go:321`按当前HP扣4%；仓内Optimizer `TravelerHydroF/hydro.tsx:118`支持最大HP4%，139–145支持`min(0.45×实际累计扣血,5000)`。同时Go在199先调用Torrent Surge，285–287立即读取清空A4，而182–196的扣血发生在未来任务。 | 独立裁决“扣血基数＋扣血与结束伤害的顺序”，再接现有HP／动态上限账本与held compiler。仅改CurrentHP为MaxHP不足以解锁；无Suffusion旧分支也不能代替。 |
| 伊安珊：`iansan-swift-talent-binding-blocked` | `charge.go:95`使用Skill等级，`zz_iansan.dm.go:109–125`却把相同倍率向量归Attack，目录对应`combat1.param5`。目前本地取回的Optimizer子集没有独立等级绑定证据。 | 定向取得独立天赋归属／执行证据，再修该动作绑定并保留争议原文。不得强制NA与E同级以隐藏冲突，也不得扩大容差。 |

## 4. 横向闭环与最小统一验收

下一批由A/B/C三个数据与核心owner并行，UI单owner复用正常source-cast表单、逐击取样和事件编辑；注册表、`calculator-model.ts`、`source-cast-context.ts`与`index.ts`集中一次接线。公共约定继续用`targetContacts`、`snapshots`、`sharedState/hitStates`、`independentEvent`；独立单击只依赖已选本击，不索取未来日程或无关队伍状态。完整动作需说明实际观察终点，重新编辑来源事件须使旧最终面板失效或正确重建。

降低partial／blocked只是独立计算器的一条分母。当前 [可组合来源覆盖](../packages/game-data/src/generated/composable-source-coverage.json) 另有5个可执行Q／33个命中定义、5个source-only N、0正式verified；652个条件动作的teamReady仍为0。横向生产应继续扩 `source-ability-registry.ts`＋`source-runtime-abilities.ts`，按每个能力实际依赖注册，不增加整场固定面板或“所有人物被动完成才允许组合”的总门。

最紧邻的团队基础原语是来源N连段的实际推进／重置：将已有安柏N1–N5来源定义接入接受动作、取消／切人／其他输入的真实重置语义，再让后续角色共用；不能只把五个单击静态按钮标为连段已实现。持续实体、命中触发被动／命座随后应共享实体代次、监听资格、ICD、命中前后取样与来源归属。按使用能力声明所需被动和C0域，面板、等级和配装保持可编辑。敌盾、角色专属资源／动态属性回调、复活等独立模块继续有各自完成条件；本规划不把根代理正在验收的玩家护盾／装备增益再列为未实现，也不把其交付等同敌盾完成。

实施后只安排一个新核心聚合文件：A组覆盖一次辉映切换与ICD边界及独立特殊段；B组覆盖跨源15级绑定与一份完整实体候选／落空；C组覆盖普通＋月结晶双段且A1不误入Q。最终面板转换与JSON恢复选一个代表贯穿，正常UI用一个聚合流程；由根代理统一执行必要数据检查和构建。已有通过角色、旧5Q、旧性能矩阵均不重复运行。取得的源向量通过归档比对核实，不为每个角色另建生命周期测试套件。

本次仅新增本规划文档；未运行测试、构建或数据生成。规划过程中另按根代理指令窄修了本批3处已报告的TypeScript可选字段问题，它们不构成本文件所列下一批功能的实施。
