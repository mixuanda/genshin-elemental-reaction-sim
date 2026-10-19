# 风／草旅行者 Q：跨来源倍率与完整限定施放

本目录仅服务以下四个 C0 分支：`traveler-cross-aether-anemo-burst-c0`、`traveler-cross-lumine-anemo-burst-c0`、`traveler-cross-aether-dendro-burst-c0`、`traveler-cross-lumine-dendro-burst-c0`。风 Q 全程无元素吸收；草 Q 全程无转化。每个候选伤害须明确命中或落空。完整性只适用于这些明确条件下的一次施放，不等于完整团队轮转、自动附着/ICD、自动命中或当前游戏实测认证。

## 来源与数值权威

倍率权威为 `frzyc/genshin-optimizer@180a0a1015cb725c7570cd828eb086749960df98` 的原始 `libs/gi/stats/src/allStat_gen.json`：分别读取 `char.skillParam.TravelerAnemoM/F.burst[0]` 和 `TravelerDendroM/F.burst[0]`。四个实际性别键、共60个天赋位置，与活动目录 `combat3.param1` 在全部15级精确相等，容差为0。独立的男性 `skillParam.json` 两份向量另作佐证；荧的权威来自实际F键，不从男性身份推断。

行为来源是 `genshinsim/gcsim@a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，用于排程、取样、实体寿命、形状、目标选择、A1/A4和回调顺序。它的 `anemo/stats.go:burstDot` 与 `dendro/stats.go:burstTick` **不是本批数值权威**。原始 Go 文件完整保留；manifest 的 `preservedCoefficientConflicts` 还保存原始文本片段、全部旧向量、差异和逐级位置。风倍率全15级实质不符；草第14级 `1.80036` 对权威 `1.8036` 的真实差异也保持原文。未改旧源码、未扩大容差、未宣称旧冲突已精确匹配。

目录交叉核对来源为 `theBowja/genshin-db@49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，归档对应原始天赋资料、统计表和LICENSE。目录版本与路径见manifest。

## 排程、空间与完整窗口

风 Q 在0帧取进攻快照；源码循环对空和荧都明确排出 `94,124,154,184,214,244,274,304,334` 九次风伤。空的 `burstHitmarks` 是96，只参与状态duration=336，不能据此把首击改成96。荧duration为334。吸收检查是 `39+18n (n=0…17)`，最后345帧；363帧递归终止任务不再检查或造成伤害。本限定窗口观察至363帧，明确整个检查窗口无吸收。实际伤害使用构造时的3×3矩形；吸收检查使用不同的2.5×2.5矩形。不能从敌人元素状态或伤害命中结果猜测吸收已关闭。

草 Q 在54帧创建草灯莲并取一次进攻快照；第一击91，之后 `181,271,361,451,541,631,721`，共8次候选。`Core.Tick` 先执行 `Combat.Tick`，再 `Player.Tick`，最后 `Tasks.Run`；因此54帧创建发生在该帧实体tick之后，55才开始减少720帧寿命，774删除。91帧首次伤害后才安装90帧ThinkInterval，不能按实体诞生帧推成144或按另一种计数生成180。每次候选会在灯8米范围内随机选敌人，再以被选敌人为中心造成2米范围伤害；没有合格敌人时不攻击。候选、实际发出和所选目标受击必须分别明确，不默认全命中。草灯位置是施放者前方1米，不能当成永远跟随玩家。

新鲜施放、无额外延长、无替换及完整无转化条件必须明确。无转化要求对应真实元素交互事实；无法从普通伤害输入自动证明。两性身份构造与共享实现均已归档。

## 被动与快照

风A1作用于普攻末段，A4来自技能击杀并治疗；二者不增加本C0 Q的直接伤害。C0也没有C6减抗。

草A1突破至少1时生效：54帧起按60帧排入叠层任务（最多10层），按18帧排入范围增益刷新任务；仅在草灯有效时向范围内当前前台角色提供每层6精通，换人删除上一个角色的增益。无转化且存活到自然结束时，最后可能刷新为756帧，stat modifier到816帧失效（815最后有效）；因此完整观察至816，覆盖实体结束后的被动尾段。是否在范围内与实际前台角色必须明确，不能默认旅行者拿满60精通。

草A4突破至少4时由伤害应用时的AttackMod读取**当时实际精通**，给Q增加 `EM×0.001` 伤害加成；必须扣除所用输入增伤已经包含的同一份额。它不能使用54帧快照精通代替。反应所用进攻快照仍是54帧；之后增长的A1不能倒灌修改旧快照。实际A4精通可以包含命中时真实生效的A1或其他增益，而其取样证据必须独立保留。

## 原文归档及验证边界

`source.json.gz` 的 `files` 包含63份原始UTF-8文件字符串，按来源别名和原路径索引；解码再UTF-8编码可还原原字节。`selectedTreeEvidence` 单独保存选中的树记录，避免将推导元数据冒充原始文件。每份源文件均记录字节数、SHA-256及计算出的Git blob SHA-1。归档大小395026字节，SHA-256为 `621e22f6ba4e40a00b314424cb67bf5617c61e30ecfdcc65756d7552deb6651c`。

Optimizer全部选中文件与固定提交本地完整树匹配，genshin-db逐文件通过本地固定提交的 `git rev-parse REV:path` 验证；其API树被截断，未把它当成完整树证据。gcsim只拥有此前固定的selected-tree：本包48份gcsim文件中9份可匹配该树，剩余39份仅能确认来自固定codeload归档身份并记录实际字节摘要，**没有声称通过完整a7树验证**。原始gcsim归档SHA-256为 `c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165`；逐文件证据覆盖缺口见manifest。已有独立归档SHA-256可复核的文件另记 `matchesPreviouslyArchivedSha256`。

本次仅制作来源包和来源比较记录，未运行测试、构建或数据发布管道，未下载或联网。目录映射、核心排程与最终验收由整批集成负责；来源文件存在不代表其已自动接入。

## 独立核心与中央接线合同

本批新增 `sim-core/src/traveler-cross-entity-{context,schedule,formulas}.ts`，没有修改中央注册。中央模型须引入 `travelerCrossEntityCastBaseSchema`、`travelerCrossEntityEventSchema`；以既有 `calculatorFinalSnapshotSchema` 给base扩展可选 `snapshots`，导出 `travelerCrossEntityCastContextSchema`，注册 `gameContext.travelerCrossEntityCast` 与普通命中的 `travelerCrossEntityEvent`。完整JSON依靠这两个正式schema字段保存，不能靠忽略未知字段通行。

共享准备／记账入口依次接 `prepareTravelerCrossEntityCastDocument`、`resetTravelerCrossEntityPanelAccounting`、`finalizeTravelerCrossEntityPanelAccounting`，解释树接 `travelerCrossEntityEventTrace`。判别器为 `isTravelerCrossEntityCastAction`。公开日程API为 `compileTravelerCrossEntitySchedule(kind, context)`，kind来自 `TRAVELER_CROSS_ENTITY_CAST_KINDS`；返回 `candidates/instances/decisions/issues/complete/lifecycleEndFrame/requiredObservedThroughFrame/snapshotFrame`。候选是固定机会，`targetContacts['tick-1']`至`tick-9`或`tick-8`必须逐项明确，未知没有默认值。

数据中央入口加入 `travelerCrossSourceMappings`，将 `travelerCrossSourceEvidence`列入独立实现来源；只过滤 `replacedTravelerCrossSourceBlockedMappingIds`中的四个旧阻塞，仍显示本分支无吸收／无转化的范围。不要改旧冲突清单原文，也不要将这四个限定动作写成自动团队能力。

完整模式公共字段：`casterId`、`targetId`、`trueMoonStoryBuffInactive`、`freshCastConfirmed`、`noHitlag`、`noInterruption`、`noReplacement`、`fullObservedLifetime`、`observedThroughFrame`、`statsStableAcrossHits`、`targetContacts`。确认项必须显式为true。风还须 `anemo.noAbsorption=true`；草还须 `dendro.noTransformation=true`、`dendro.noGadgetRemoval=true`。`statsStableAcrossHits`在这里表示共同输入确实代表来源0／54帧锁定面板；否则提供 `snapshots['snapshot-0']`或`['snapshot-54']`。它不声明命中时A4精通恒定。

草A4的 `sharedState`／`hitStates[完整hitId]` 使用 `actualEm`、`actualEmIncludesLotuslight`、`includedA4DamageBonus`，逐击值覆盖共同值。突破至少4时需要真实EM与已恢复A1的明确确认；未得到A1时也应输入真实未加成的EM，不能自动补60。已含A4份额须明确，0表示未含。转换器只物化共同／装备增伤，角色A4公式仍另算，finalizer不擅自改写该份额。

独立入口 `independentEvent` 是 `{candidateId,templateRole:'tick',frame,snapshotFrame,snapshotId,targetId}`；可以直接生成已发生本击，无需先填整轮。单击只要求C0、剧情增益关闭及其真实面板；草另须本击 `untransformedAtHit=true`与适用的A4状态，不读取未来无转化、完整观察或其他击状态。完整编译生成的草灯事件额外保存可选 `untransformedAtHit:true`，因此投影为单击并移除完整日程条件后仍保有已确认的本击资格；显式逐击状态可覆盖该值。显式历史快照每次准备都具有权威性；已转换后改事件、快照或实时被动会阻止沿用旧物化结果，直至重新应用构筑／实际面板。纯完整日程确认不作为本击最终面板身份，删去未来条件不会使已发生快照失效。

## 交给统一验收的手算例

以下均为明确假设输入，不是游戏实测：有效天赋1、C0、突破6、90级对90级、ATK2000、CR0.5、CD1、目标抗性0.1、无其他增伤／附加伤害／反应。全部资格与接触明确。

- 风Q9击、0帧共同快照：`9×2000×0.808×0.5×0.9×1.5 = 9817.2`。
- 草灯8击，54帧快照EM50，但每击实际EM200、已含A4份额0：`8×2000×0.8016×1.2×0.5×0.9×1.5 = 10388.736`。若只有第二击实际EM300，总和变为 `10496.952`，证明没有误用快照EM50。
- 直接声明草灯独立末击：`frame=721,snapshotFrame=54,snapshotId='snapshot-54'`、实际EM200，期望 `1298.592`；删除全部未来／完整日程字段仍可算。缺本击实际EM或A1恢复确认则明确blocked。

由中央集成后统一安排必要新聚合验证；本模块未执行测试、构建、数据生成或浏览器流程。
