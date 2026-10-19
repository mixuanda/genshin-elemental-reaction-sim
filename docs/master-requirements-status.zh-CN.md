# 主提示全量要求完成矩阵
2026-10-03 执行、2026-10-05 归档：[来源动画、雷电将军 E 归属与角色公式审计（129–132）](source-animation-eye-frontier-20261003.zh-CN.md)。129 烟绯 Q 一根伤害根、米卡 Q 零伤害根；130 只运行观察到胡桃重击 actor 的 OnRemoved，normalized predicate 未采样。131 雷电将军 E 每 lane 分开记录施术者与四持有者：4 次激活、5 次触发、6 击（E 初击与 Eye），四持有者计算器行及完整 E JSON 往返通过。每 lane 2,178 帧、17 应用、61 动作日志、总伤害13,164.172125839998；伤害／动作／帧／玩家状态与基线一致，Origin 仅忽略新增 StatusOwner 并单独核对 owner。6次调用闭合、14次选定重放差0；5个phase边界均incomplete。4次native（两次基线＋两次初始浏览器），最终浏览器复用capture；Web与浏览器初始失败均保留。未知缺口47→54，反映真实actor揭示更多具体缺口。注册表110 ID／108角色动作；尚无有限合同的E/Q绑定为Classic126、Stellar140；这些是缺口计数，不是readiness。132静态审计无新实现。activeVerified=null，数据指针未变；无游戏核验、无Oct5重新抓取／官方当前版本证明；全量目标active，未commit/push/deploy。[测量](validation/source-animation-eye-frontier-measurements-20261003.json) · [132审计](validation/source-character-formula-frontier-audit-20261003.json)。
2026-09-30 当前（2026-10-03 补齐报告）：[岩造物出生与共鸣归属（127）及直接伤害契约补录（128）](source-construct-ownership-20260930.zh-CN.md)。阿贝多 E／钟离 E 造物身份、所有者、共享快照和发出位置分开记录；每 lane 2,634帧、77次应用、72条动作日志和23,288.404574639255总伤害；四次施放闭合，两 lane 合计152次逐击重放差0，baseline伤害与动作／Origin日志同 lane 一致。最终注册表107合同ID／105 canonical角色动作；尚无有限合同的原生E/Q绑定为Classic129（234已实现、117唯一来源方法）及Stellar143（248已实现、129唯一来源方法），这些计数不表示coverage readiness。Classic／Stellar构建、registry、Web typecheck/构建及最终浏览器通过；计算器导入／JSON往返与造物UI通过。128魈 Q／夏沃蕾 Q 规则仅具来源审阅与构建证据，未运行对应角色；零启动直接伤害和九个roots不代表完整技能状态闭合。未审查私有状态、全技能覆盖、远端更新及7.2映射仍未完成；无游戏核验或verified晋升，全量目标仍active。[结果](validation/source-construct-ownership-20260930.result.json) · [最终测量](validation/source-construct-ownership-measurements-20260930.json)。
2026-09-30 历史批次：[莱依拉护盾归属与延迟攻击（126）](source-layla-ownership-20260930.zh-CN.md)：两 lane 接入莱依拉 E/Q 与真实护盾实例、回调和星矢任务的父子归属。Classic／Stellar 各观察1,730帧、58次应用，伤害及动作日志与各自变更前基线一致；6次施放闭合、104次选定逐击重放差0。刷新延长同一护盾且护盾量不变。凯亚 E 与 E2 OnSkill 样本均被已发射状态阻挡，不能宣称正向加星；破盾等分支仍未覆盖。最终浏览器通过，但过程中有缺少OnSkill观察器的初始结果、重复标签构建失败及一次旧dist重跑，详见完整测量日志。无游戏验证，activeVerified为空，全量目标仍active；127转向岩造物生命周期与归属，128仍为候选。[测量](validation/source-layla-ownership-measurements-20260930.json) · [源码审计](validation/source-layla-ownership-audit-20260930.json)。
2026-09-30 上批：[固定来源私有数值状态与有限来源读取（125）](source-private-numeric-state-20260930.zh-CN.md)：私有数值按字段语义分类，保持向量身份与原始计数器，只归一化已审阅绝对期限；未知值仍为缺口。4次native复核历史输入，每lane缺口33→3，完整phase边界仍为0；提纳里E、爱可菲Q、欧洛伦E仅源码／构建证据。activeVerified为空，全量目标继续。[测量](validation/source-private-numeric-measurements-20260930.json)。
2026-09-30 上批：[固定来源条件敌方任务与零根攻击闭合（124）](source-conditional-enemy-tasks-20260930.zh-CN.md)：新增8项动作完整性规则，区分合法零根结果与未知／未完成状态，并接入 Nilou Q 敌方本地延迟任务。两 lane 构建、talent registry、typecheck、Web 与最终复用捕获的浏览器检查通过；3次原生运行（123产物 Classic 对照1次、本批两 lane各1次），每 lane 653帧、15应用、6个完整调用，每 lane 选定12次应用、两 lane 合计24次重放差0，Classic应用与基线一致。Chasca E、Xilonen E、Qiqi Q、Nilou Q 指定分支实测；Jean E、Lanyan Q、Varka Q、Aloy E 仅源码／构建证据。Sara E与Mavuika Q仍未闭合，activeVerified为空，完整项目目标仍active。[测量](validation/source-conditional-enemy-measurements-20260930.json)。
2026-09-30 上批：[固定来源有限伤害生产链扩展（123）](source-finite-expansion-20260930.zh-CN.md)：新增10个直接攻击合同及申鹤 E/Q、重云 E 三条延迟生产合同；通用天赋赋值读取 instrumenter 增补申鹤 Q DoT 读取。两 lane 构建、registry、Web build及浏览器案例通过；typecheck首轮测试请求类型错误，修窄后最终通过。一个 aggregate 两来源场景共3次 native运行，1707帧、62应用／lane，其中选定58击逐击重放差0，Classic 62应用投影与基线相同。9个直接合同仍只有源码／构建证据；不是游戏verified。共90合同ID／88角色动作／67计划／99处计划内site声明（92个唯一site ID），数据指针未变，全量动作与外部版本目标仍active。[报告](source-finite-expansion-20260930.zh-CN.md) · [测量](validation/source-finite-expansion-measurements-20260930.json)。
2026-09-30 上批：[共享移动、换人与延迟冷却状态（122）](source-shared-movement-state-20260930.zh-CN.md)为动作队列绑定同生命周期描述，接入两来源默认移动、换人及延迟体力／冷却任务。两来源构建、类型检查、Web 和各一项队列测试通过；一个双来源短轮转在修正两处测试输入／覆盖假设后通过，复用已有捕获，总共四次原生运行（前后各两条来源）。每场实际175帧、6个边界、1击，前后伤害／34条动作日志／体力冷却状态与时点一致；未知缺口35→33，仍无完整边界。默认冲刺、待执行换人、特殊跳跃及延迟冷却只有源码／构建证据。数据指针不变，全量目标继续。[测量](validation/source-shared-movement-measurements-20260930.json)。
2026-09-30 上批：[共享动画与动作阶段状态（121）](source-shared-animation-state-20260930.zh-CN.md)将帧回调与描述绑定，接入四个公共构造器及默认卡肉暂停；Luna 完成两来源 91／97 文件迁移，未知自定义回调保留缺口。补丁格式和旧浏览器测试类型修复后，两来源构建与 typecheck 通过；Web 和一个双来源浏览器案例首次通过。每场 14 个边界、14 次伤害应用与 119 归档一致，捕获 1 条普攻、5 条技能和 6 条暂停描述；仍有 64 条缺口、0 个完整边界，稳态未建立。数据指针不变，无游戏 verified，全量目标继续。[测量](validation/source-shared-animation-measurements-20260930.json)。
2026-09-30 上批：[充能无解原因与可复核证明（120）](er-independent-failure-20260930.zh-CN.md)新增容量上限和全部耗能动作成功路径两类充分证明，中文页面展示公式、代入和真实证据，JSON 保留完整证明。4 个核心用例最终通过（首轮两处合成输入修正后仅重跑失败项），typecheck、Web 构建及 1 个浏览器案例通过；不把有限网格失败或零产球外推为任意 ER 无解。本批未运行 Go/WASM，数据指针未变，无游戏 verified，完整目标继续进行。[测量](validation/er-independent-failure-measurements-20260930.json)。
2026-09-30 上批：[共享状态与相位观察（119）](source-shared-phase-state-20260930.zh-CN.md)接入在途攻击、普通感电／燃烧任务与事件、耐力／护盾描述符和敌人掉球任务。两 lane 构建、typecheck、Web 与一个聚合浏览器案例首次通过；两场实际各406帧、14个相位边界，观察到感电与燃烧任务及在途攻击。每场仍有66条去重缺口，全部边界未完整，稳态未建立；Stellar 相位 JSON 往返一致。其他注册点仅源码／构建证据，不增加角色合同或游戏 verified；正式／预览指针不变。[测量](validation/source-shared-phase-state-measurements-20260930.json)。
2026-09-30 上批：[固定来源持续技能与实体归属（118）](source-recurring-skill-ownership-20260930.zh-CN.md)：新增七七 E、八重神子 E、北斗 Q、香菱 E、瑶瑶 Q 五个角色动作合同，并实现七七／八重神子的 Stellar 专属差异。两 lane 构建、registry、typecheck、Web build 和单个浏览器案例均首次通过；三份动作耗尽的原生配置中选定66击，逐击共享公式重放差均为0，页面 JSON 往返通过。观察窗口为1377／1019／1939帧，不是固定DPS或游戏内测试；合同总数77、角色动作75、生产计划64、站点94。activeVerified仍为空，官方索引观察7.1，7.2 V1映射和远端data-discovery未确认；其他技能／资源所有权、完整动作与更广phase收敛仍待完成。[运行结果](validation/source-recurring-skill-ownership-team-20260930.result.json) · [测量](validation/source-recurring-skill-ownership-measurements-20260930.json) · [跨批下一步审计](validation/source-cross-cutting-next-step-20260930.json)。
2026-09-30 上批：[固定来源有限技能覆盖扩展（117）](source-finite-coverage-batch-20260930.zh-CN.md)：接入甘雨／烟绯／魈／托马 E、神里绫人 E、云堇 Q 与绮良良 E 共7项。两lane构建、registry、typecheck首过；一次browser首轮暴露神里绫人 canonical key/registry真实缺陷，按71行/70合同修11个key和5条source path后复建Web并复用两份capture通过。两份classic配置612／634帧、各5应用；7项动作闭合、10击逐击重放差0，绮良良长按两次翻滚加踢击均分别归队列，甘雨E编辑导入导出通过。不是960帧DPS benchmark或游戏verified；托马明确来源假设、Stellar仅构建。70合同／57计划／74 sites；数据指针不变，remote CI与广泛稳态／全量动作目标仍未闭合。[运行结果](validation/source-finite-coverage-batch-team-20260930.result.json) · [汇总测量](validation/source-finite-coverage-batch-measurements-20260930.json)。
2026-09-30 上批：[护盾事件回调与延迟任务归属（116）](source-shield-task-casts-20260930.zh-CN.md)：新增辛焱 E、诺艾尔 E 两项有限盾归属合同，扩展既有辛焱 Q 合同至 C2–6；绑定实际盾实例、回调父 ID、任务父子链及原生 Get 门控，不添加 gameplay guard。两 lane 构建、registry、typecheck、Web build 首次通过。一次 classic 双目标运行观察1,291帧、38个应用；诺艾尔 C4 E、辛焱 C2 E/Q 三项合同闭合，38击逐击重放差均为0，编辑／JSON往返通过。浏览器共3次尝试、仅1次原生运行；最终复用归档捕获通过，页面错误为空。[结果](validation/source-shield-task-casts-team-20260930.result.json)；破盾分支、其他角色完整生命周期和游戏验证仍未覆盖；63合同／54计划／70 sites，数据指针不变，master全量目标仍开放。[测量](validation/source-shield-task-casts-measurements-20260930.json)。
2026-09-30 上批：[固定来源护盾实例与白术 Q 归属（115）](source-shield-ownership-20260930.zh-CN.md)为每次原生护盾Add安装增加独立实例ID及生命周期hook回执，仅为白术Q新增六次护盾出生有限合同并接入共享公式／UI。双lane构建、registry、typecheck、Web首次通过；浏览器修正身份断言后复用归档捕获通过。唯一新增classic样本实际观察1149帧，六个Q盾全部闭合，六次Spiritvein重放差0；不覆盖受击破盾、其他角色护盾合同或游戏验证。数据指针未晋升；61有限合同／52计划／65 producer sites，master全量目标仍未完成。[测量](validation/source-shield-ownership-measurements-20260930.json)。
2026-09-30 上批：[固定来源共享事件与延迟攻击（114）](source-shared-delayed-events-20260930.zh-CN.md)新增11项类型化事件规则，registry共22项，23个静态候选中22项登记。两lane构建、registry、最终typecheck、Web与单个浏览器案例首次通过；两份classic原生样本实际观察798／258帧，5个新增组件12个命中逐击重放差0，6项只有源码／构建证据。正式／预览指针稳定且无verified晋升；Columbina Gravity、状态施加归属、完整技能及phase convergence、外部更新和下一版本证据仍待推进。60合同／51计划与master全量目标未完成。[测量](validation/source-shared-delayed-events-measurements-20260930.json)。
2026-09-30 上批：[固定来源直接事件攻击组件（113）](source-direct-events-20260930.zh-CN.md)新增9个直接事件站点，registry共11项；8处允许队列计数为0/1，克洛琳德 C1为0/2。两lane来源构建、typecheck、registry、Web build及浏览器案例首次通过。单一classic四角色轮转（770帧、2目标、24个团队应用）实测阿贝多／迪希雅／雷电将军各一次监听调用，6个目标命中共享公式重放差0；Kaeya是触发者而非审计组件，样本不代表其所有攻击或DPS benchmark。112批白术／达达利亚复用归档捕获离线重算，未追加原生运行。60项finite contracts／51项plans不变，不提升全局coverage、E/Q闭合或游戏验证。[测量记录](validation/source-direct-events-measurements-20260930.json)。
2026-09-30 当前批：[固定来源事件攻击组件（112）](source-event-components-20260930.zh-CN.md)增加两个事件族的观察回执及两个已审阅 site component：白术 C2 `OnEnemyDamage`、达达利亚 `OnTargetDied`；二者共用事件集合 schema，以 `componentId` 区分。23项候选 inventory 是静态源码清点。两lane来源构建、typecheck、registry、1项离线回归、最终Web构建及1项浏览器重放通过；浏览器使用归档原生捕获，没有执行新原生运行。该批不增加60个finite contracts／51项plans，不代表完整E/Q、游戏验证或全局coverage提升。[测量记录](validation/source-event-components-measurements-20260930.json)。

2026-09-30 当前批：[固定来源目标命中回调与子攻击闭合（111）](source-hit-callbacks-20260930.zh-CN.md)推进master §3／§5／§11的逐目标回调批次与回调子攻击精确归属子集；新增3合同、扩展米卡长按，现有合计60项不同合同／51项计划。两lane构建、registry、typecheck、最终Web及1项离线回归通过；浏览器首轮因米卡元数据缺口失败，修正后复用捕获重试通过，只有一次原生执行，30个选定应用重放差0。此范围要求实际 callback batch、dispatch、子队列及目标终态逐层闭合，不提升游戏验证或全角色coverage；白术C2/C6及达达利亚Q仍明确受阻。

2026-09-29 当前批：[固定来源有限技能与召唤物归属（110）](source-owned-entities-20260929.zh-CN.md)推进master §3／§5／§11的有限攻击生产链和实体派生任务闭合子集：新增20个有限技能族、2个实体族，合并57项不同合同／48项计划。两lane构建、registry、类型检查、Web构建、2项离线回归及一个Classic浏览器案例通过；单次团队运行中17/32个应用回放差0，导入导出一致。唯一样本覆盖八重神子Q和安柏／瑶瑶E实体自然到期；其余19个有限族只有来源审计／构建证据，未运行手动击杀、实体替换或截断窗口。不是游戏验证；coverage、verified、数据指针及master整体完成状态未晋升。[测量](validation/source-owned-entities-measurements-20260929.json)。

2026-09-29 当前批：[来源有限技能与持续协同归属（109）](source-owned-generators-20260929.zh-CN.md)推进master §3／§5／§11的来源任务生产图及状态实例归属子集；35项合同数量已按26个producer行＋10项原合同－1项Bennett E重复核对。两lane原生构建、registry、Web构建、2项离线回归和单一Classic夜兰C2 Q浏览器案例通过。该运行只证明一个固定来源团队输入的9个状态触发与32个固有伤害应用可重放；行秋与托马只有来源审阅及构建、其他合同不等于逐项runtime覆盖，任何结果均不是游戏验证。coverage、verified、正式／预览数据指针及master整体完成状态均未晋升。

2026-09-29 历史批次：[固定来源延迟有限技能范围（108）](source-delayed-finite-skill-casts-20260929.zh-CN.md)继续推进master §3／§5／§11的来源执行与可解释子集：12个delayed producer families／19 sites，含107共21个独立技能契约。classic Diona Q与Kaeya Q样本验证部分生产者到命中重放路径；22条逐击差值为0，Kaeya截断样本保留pending。此源代码／有限回执样本不是游戏verified；stellar仅构建，released／preview和全量master目标不变且仍未完成。

2026-09-29 历史批次：[固定来源有限动作根攻击契约](source-finite-skill-casts-20260929.zh-CN.md)推进master §3／§5／§11所需的来源执行与可解释能力：新增十个静态根攻击计数契约、原生调用／派发回执及单技能／动作集合内有限技能范围与逐击编辑、回放和导入导出。classic Amber Q 360帧捕获在固定契约范围18/18闭合；120帧捕获5/18闭合并正确保持partial。该可闭合结论由运行回执与源码契约派生，不推广到其它动作、额外回调／实体、全角色覆盖或游戏verified；stellar本批仅构建。master全量目标继续未完成。

2026-09-29 最新：[固定来源目标阶段情景](source-target-phases-20260929.zh-CN.md)推进master §22的用户声明阶段子集：按每个目标的真实native key与半开帧窗独立控制伤害应用、附着路径、命中回调，并保留raw／applied分离。单次classic六目标运行重放差0；stellar仅构建。不能据此声称真实敌人阶段／无敌、所有反应、完整动作或游戏verified完成，整体要求仍未完成。

2026-09-29 最新：[固定来源目标 DEF 情景](source-target-defense-20260929.zh-CN.md)推进master §22的静态用户声明目标防御调整子集：可选有限比例写入原生EnemyProfile，作为原生计算起点并叠加已有动态修正。一个classic三目标案例公式重放差0；stellar仅构建。它不完成怪物数据、动态效果、phase／无敌、敌盾或多目标阶段语义，整体目标、coverage、verified与completeCast仍未完成。

2026-09-29 最新：[固定来源静态多目标场景与伤害汇总](source-target-scene-20260929.zh-CN.md)交付master §22中初始静态多目标profiles与逐目标/全目标/主目标报告子集，目标选择只用于统计，不改原生targeting。固定三目标两次classic运行应用集合一致、回放差0；不代表移动、enemy phase／无敌、敌盾、适用DEF modifiers或verified敌人数据完成，master整体仍未完成。

2026-09-29 最新：[固定来源目标档案与 HP 截止策略](source-target-profile-20260929.zh-CN.md)推进master §22目标配置中的等级/逐元素抗性/初始位置与hitbox/显式HP和用户声明掉球子集；HP与duration停止有有限classic实测。该批未实现适用DEF修正、敌盾、phase、无敌、多目标damage或verified敌人目录；不是§22整体完成，也未提升coverage、verified、completeCast或数据指针。

2026-09-29 最新：[固定来源初始目标几何输入](source-target-geometry-20260929.zh-CN.md)接通队伍及单角色草稿的半径／坐标输入和共享GCSL格式化。classic近／远案例与JSON往返通过；只交付初始几何输入，不代表空间命中、移动、多目标或完整施放语义完成，整体目标仍active。

2026-09-29 最新：[固定来源单角色单动作入口](source-single-skill-20260929.zh-CN.md)提供无需组队/脚本的单动作执行与共享命中编辑恢复；它不增加native mechanics，选中关联仅用于collection分析且完整原始结果保留。该UI是产品入口交付，不证明全动作／完整施放；数据、coverage、verified、completeCast和整体goal均未提升。

2026-09-29 最新：[固定来源原生 Task.Handler 生命周期](source-task-lifecycle-20260929.zh-CN.md)增加三类队列的实际task、parent和本地时钟证据；单个双lane样本的关联行秋E任务及命中可复算。不是所有回调／实体闭合：敌方queue此样本无task，character/enemy同步delay=0绕过Handler，且completeCast仍为false。保留原pendingAttackStages窄范围描述，不声称覆盖全部任务。

2026-09-29 最新：[固定来源天赋倍率算术表达式](source-talent-expression-provenance-20260929.zh-CN.md)为固定表叶、数字／可解析同包常量建立保留原二元树的共享表达式重放；指定Wanderer命中两lane重放差0。静态登记不证明所有分支或完整技能；Chasca仅默认最终赋值，动态字段、helper与实体生命周期仍为缺口。整体目标与coverage/verified状态未完成。

2026-09-29 最新：[固定来源天赋表 range 行读取](source-talent-range-provenance-20260929.zh-CN.md)将三维range tuple接入097索引AST，保留全部旧读点与既有运行结果。仅一个双lane案例实采行秋普通攻击range读；完整技能/实体、动态状态和复杂绑定仍未完成。skipped统计不代表完成率，数据、coverage、verified、completeCast及全量goal保持不变。

2026-09-29 最新：[固定来源天赋索引生成过程](source-talent-index-provenance-20260929.zh-CN.md)将捕获的索引叶与096表查值接入共享AST，并在一个双lane运行中验证行秋Q所选节点。静态getter与本次运行site数保持分开；动态状态、passive生命周期、后续倍率修改和完整技能语义仍有缺口。无游戏验证、覆盖分类或整体目标完成晋升。

2026-09-29 最新：[固定来源天赋倍率表读取回执](source-talent-table-provenance-20260929.zh-CN.md)为普通伤害倍率提供真实表与索引复算来源；单个双lane案例确认所选行秋Q倍率读取及编辑回放。静态site总量、角色目录数与本次运行site数分开报告，不作为整体机制覆盖或游戏验证结论；coverage、verified、completeCast和数据指针未变。

2026-09-29 最新：[固定来源反应 EM 来源回执](source-reaction-em-provenance-20260929.zh-CN.md)：两lane每lane11个反应EM原生getter读取进入共享公式来源图，并由actor/frame/selector/value验证；聚焦核心、双lane构建、Web和一次EC浏览器样本通过。只有EC做了本次浏览器运行；不提升游戏验证、coverage分类、verified状态或完整技能施放结论。

2026-09-29 最新：[公式依赖链接](source-formula-dependency-links-20260929.zh-CN.md)让普通伤害的EM、钳制CR、CD、元素／通用增伤按实际输入值与getter回执连接；仅经消费者身份验证的贡献有来源边。复用102条两lane运行结果重放完全一致，但仍有未保存的天赋倍率表来源、EM getter和原生触发／生命周期缺口。该批无新原生运行、未改变coverage、active verified或数据指针，不等于游戏验证或全目标完成。

2026-09-29 最新：[固定来源动作机会与派发关联](source-action-opportunities-20260929.zh-CN.md)补充真实dispatch身份和按目标终态划分的已观察机会；仅有精确关联的实际伤害计入一次，明确落空记本次0，未决／pending不伪造成0。聚焦两lane回放与基线一致、六份JSON往返成功，但 completeCast 仍为 false，完整机会清点、其它目标类别、窗后实体与游戏验证均未因此闭合。覆盖分母与数据指针不变，全量goal仍active。

2026-09-29 最新：[固定来源初始基础面板回放](source-base-panel-20260929.zh-CN.md)补充了初始化面板构造及 getter 上游的可选共享来源链；两lane限定页面样本对照基线不变、选定命中复放差0。它只闭合所记录的角色／武器初始化算法，不扩大静态技能覆盖、verified或游戏证据；随机词条抽样和后续modifier仍显式保留缺口，全量 goal 继续 active。


2026-09-29 最新：[原生状态生命周期与动作语义](source-lifecycle-and-action-semantics-20260929.zh-CN.md)新增有限Status终态与两处原生待攻击任务阶段记录，并保留完整可导出集合；12秒样本两lane gameplay不变。30帧截断探针捕获真实future application，说明无伤害应用结果不能单独证明无pending后代。移除／unknown状态终态、snapshot分支及其他任务/实体仍未全覆盖，不将此批提升为native skill或damage collection complete；正式、预览和verified数据指针未改变。另桑多涅普通扫射／超载不受Radiance gate为固定Optimizer来源修正，分类分母不变。

2026-09-29 最新：[状态实例归属与更新失败回执](source-status-owner-and-update-20260929.zh-CN.md)：native action provenance 仍为部分交付，另将四名角色的 Minazuki watcher 状态激活owner作为独立关联；不提升顶层创建来源、完整状态生命周期或native skill完成。状态owner样本两lane各38次应用不变、6击合计2403.863077651348且重放差0。§12本地失败账本与只读回执审核已交付并通过聚焦页面；远端CI／provider重新抓取未执行。正式／预览／verified指针不变，全量goal继续active。

2026-09-29 最新：[观察事件编辑与逐击下落快照](observed-input-editors-20260929.zh-CN.md)补齐四类事件行编辑、八个 low/high 模板逐击历史面板输入及卡齐娜 A1 逐击记账。最终构建 6.801 秒，抽样 E2E 1/1；仅覆盖奈芙尔与 Lohen low。分类仍为124身份／1271命中／713 complete／24 partial／8独立特殊组成；active verified 为空、team-ready为0，不代表游戏验证或全量目标完成。

2026-09-29 最新进展：[原生动作来源链](source-action-origin-20260929.zh-CN.md)将剩余产品条目0从未实现更新为部分交付：两lane现有 accepted action、攻击创建／触发 lineage、阶段观察账本与可编辑已观察多击集合。实际应用按 Application.origin 分组，公式 Request.origin 仅表示公式调用上下文。38-hit/lane对照未改变 gameplay；没有宣称 complete native skill、所有机会／待结算事件闭合或游戏 verified。详见回执及[范围清单](remaining-product-implementation-20260928.json)。

2026-09-29 最新：[来源 RNG 策略交付](source-rng-policy-20260928.zh-CN.md)将两版 uint64 种子按 Go 初始化规则归一化，批量分析拒绝不同文本映射为同一流的种子；原生 RNG 元数据随结果、导入和独立计算器上下文保存。源码未发现模拟时 package-global RNG 调用，故无全局路由补丁。构建与聚焦页面验收通过，但这不证明随机分布或数学独立，也不晋升游戏 verified；数据指针未变、全量 goal active。

2026-09-28 最新更正（覆盖下方相位阶段报告中“未建立原生完整状态正例”的旧结论）：§19–21 已在一个限定域取得首个来源原生 period-1 正例。Venti C0 E／冲刺／等待的 40 秒脚本 标记六边界并产生六次命中；stellar 于 1333／1777／2221 帧连续匹配（444帧，实际伤害 2059.5758212353603，条件 DPS 278.3210569236973），6/6 边界完整且无 gaps。classic 同输入因脚本可读 `skill_charge` 递增而未建立；classic Amber 负对照保留两个 gap。此为来源代码执行结果，不是游戏验证，也不证明随机稳态或广泛输入域。终版 classic／stellar／Web 构建 7.914／8.256／4.772 秒，判定器5/5（109ms），聚合页面通过（用例4.5秒／墙钟5.899秒，pageErrors=[]）；未跑全矩阵，活动数据指针未变更，全量 goal 仍 active。详见[阶段报告](source-phase-captures-20260928.zh-CN.md)与[实际页面回执](validation/phase-captures-browser-20260928.result.json)。

2026-09-28 最新：[原生相位观察与条件收敛判定](source-native-phase-20260928.zh-CN.md)推进 §19–21：固定来源实际输入位置采样、状态导出、有限预热与多周期比较、页面记录已实现。两版运行可取得真实状态缺口；未建立原生完整状态正例，随机分布稳态亦不因确定性单元通过而完成。全量 goal 保持 active。

2026-09-28 最新：[完整召唤与观察区间](observed-composition-20260928.zh-CN.md)推进 §3–7：独立子计算共享核心，普通／特殊跨组成求和、真实落空与缺失状态、完整上下文导出及公开编辑流程已接通。条件闭合露米与实际 Fagio 窗口严格区分，一次聚合页面恢复差 0。原生相位收敛、剩余执行语义和外部游戏／版本证据仍未完成；全量 goal 保持 active。

2026-09-28 最新：[观察式状态绑定与 7.1.51 隔离候选](observed-lifecycles-and-candidate-20260928.zh-CN.md)推进 §3–7 的独立实际命中状态绑定与可恢复输入，三场景页面恢复差 0；不把命中账本升级成完整召唤／重击生命周期。§12 已实际摄取 7.1.51 到独立候选 store，204 原始差异可查；正式、当前预览及 verified 指针未变。原生相位收敛、剩余完整组成与真实版本／游戏证据继续列为未完成，goal 仍 active。

2026-09-28 最新：[固定来源 Drain 公式与扣血捕获](source-drain-sources-20260928.zh-CN.md)：19 个固定 Drain 来源规则、Dehya 事件链及独立扣血编辑器接入；两版构建、Web build 和单页 E2E 通过，55 个应用重放差 0。每 lane 仅观察 9/19 个 Drain 规则；FlatDmg self-hit 观察到 Nilou、未观察普通 Dendro core。不是全角色机制或游戏验证完成。

2026-09-28 最新：[固定来源治疗来源公式](source-healing-sources-20260928.zh-CN.md)：b4/a7 最终 WASM 与 Web build、单聚合 E2E 通过；四场运行共 206 个治疗应用，selected capture 重放差 0。93 条注册规则中页面只观察 18/19 条去重规则，74 条未观察；静态规则接线不等于游戏 verified，Drain 与生命之契历史链仍未闭合。

2026-09-28 最新：[42 条来源护盾算式](source-character-shield-20260928.zh-CN.md)补齐本次清点中的角色／钟剑／结晶 HP 创建与刷新接线，消费沿真实来源 ID 回放。页面观察 14 条，其余不冒充实测，游戏 verified 未变。直接核对原始 master 后，[稳态范围](source-steady-state-scope-audit-20260928.zh-CN.md)明确必做的是原生相位相关完整状态收敛与随机预热证据；任意帧 JSON 中途恢复不是独立必做项。现有有限窗口仍不能证明通用原生稳态。

2026-09-28 本轮进展：[导入队伍与来源队伍预设库](imported-team-library-20260928.zh-CN.md)支持GOOD／Enka解析后的1–4人批量预检、合并保留动作和起步状态、空动作替换草稿，以及按b4/a7隔离的命名预设。核心2用例、Web构建和合成GOOD页面E2E最终重试通过；未测真实Enka／非空圣遗物或WASM，也不改变角色覆盖和verified统计。

2026-09-28 本轮进展：[历史preview选择与比较](preview-history-20260928.zh-CN.md)已支持选择已保存preview、逐实体比较和 `snapshot=ID` URL精确恢复；页面对比529项并提供完整JSON。活动/verified指针不变；JSON导入行为未测，两个preview仍是局部、0可执行定义，不能视为游戏验证或完整版本支持。

2026-09-28 本轮进展：[来源角色倍率算式](source-character-multiplier-20260928.zh-CN.md)登记41条固定源码规则，b4／a7页面各运行7次伤害应用、观察5条规则，三项选定重放差0。两版WASM、最终Web构建和一个聚合页面通过；其余36规则未本轮运行，verified与数据分母不变，全量目标仍active。

2026-09-28 本轮进展：[角色治疗／冷却覆写与公式逐步执行](source-character-overrides-20260928.zh-CN.md)扩展来源原始计算的可追溯覆盖，保留35条scalar并加入3条Durin／Ifa派生公式；治疗接收与冷却路由可单独编辑／重放，原生状态与队列仍留Go。两来源页面选择的治疗与冷却结果重放差0，JSON与step trace检查通过。没有完成Ifa、Durin、Varka、Odette整套机制或历史全量；完整目标仍active，verified指针不变。

2026-09-28 本轮进展：[排队来源角色 FlatDmg AST](source-character-flat-20260928.zh-CN.md)新增142条规则、40角色，接入公式操作前值、递归组件依赖与 set/add/multiply 完整结果；classic／stellar分别适用140／142条。四场E2E已通过，但每lane只观察13个规则ID，不代表全142条规则实测。当时 Dehya 自伤与 Nilou 核心玩家受击链仍未迁移；后续 Drain／FlatDmg 接入见[Drain 报告](source-drain-sources-20260928.zh-CN.md)，本历史记录不代表本批验收。full goal保持active，游戏verified不变。

2026-09-28 本轮进展：[23条角色同击附加公式](source-character-additive-20260928.zh-CN.md)继续推进§5/6/7/11/17。两个原nil-only Amount回调的FlatDmg加项已桥接；新增character-additive区分21条命中与2条创建，保持真实getter顺序与valueSources关联。独立计算器把本击引用的加项及创建公式纳入可编辑实例。两个来源选定命中重放差0，构建与单个聚合页面完成；其余queued／覆写／乘算生产项仍待迁移，完整目标active，不宣称全机制或游戏验证。

2026-09-28 本轮进展：[193条角色向量规则与单公式实验](source-character-vectors-20260928.zh-CN.md)推进§5/6/7/11/17。最终实际构建源码共302/326个Amount回调；其中300/324个返回非nil向量的回调有共享接线，另各2个nil-only回调会修改FlatDmg，仍为原生数值副作用。静态AST没有未解析或残留向量回调，不等于全角色机制/游戏验证。用户可在独立计算器编辑本击实际消费的角色公式并保存JSON；其余后续伤害和历史状态不随单公式实验重跑。必要构建与一个聚合页面完成，精确实测范围见报告；完整目标保持active。

2026-09-28 本轮进展：[角色辅助标量](source-character-scalar-20260928.zh-CN.md)继续推进共享公式与可追溯捕获：35条版本化规则（b4适用22/a7适用33），治疗/反应/CD消费者可带入创建公式和实际属性读取；a7延迟感电来源链已接通。两场景每lane观察8个规则ID，跨lane去重9个，不代表35规则或全角色验收。剩余向量清点为243原回调/139去重源码体，完整目标保持active；已有248配装参考预设、18队伍模板及独立技能入口保留。

2026-09-28 本轮进展：[102条角色动态公式](source-character-dynamic-20260928.zh-CN.md)推进§5/11/17；b4/a7分别192/193个向量回调已共享，剩110/133（包括各2个仅nil回调），不能将规则数等同完整角色数。创建快照、跨角色消费和实际非额外属性读取接入捕获/恢复；必要构建及聚合页通过。§12新增7.1.50.2隔离局部预览，旧版保留，正式与verified指针不变。全量goal保持active，未实现部分继续实施。

下列日期批次保留历史证据；当前状态以本页状态表为准。

2026-09-28 最新：[固定角色修正量](source-character-modifiers-20260928.zh-CN.md)推进§5/11/17：两版分别94/95个静态向量回调接入共享数值核心，跨角色支持链可完整捕获；其余208/231个向量回调仍未展开。§20/21的有限双窗差分在页面直接可见。两版必要页面场景与构建最终通过，六武器当前上游审计未解除来源缺口。全量目标仍active，正式/preview/verified指针不变。

2026-09-28 最新：[来源辅助公式](source-auxiliary-formulas-20260928.zh-CN.md)：补治疗、冷却、护盾强效及深林/翠绿减抗的共享数值链与创建/消费记录；新增独立治疗和冷却编辑。4场两lane验收通过；原生队列/角色覆写/TODO仍保留。全量目标未完成，数据发布/preview/verified指针不变。

2026-09-28 最新：[固定来源角色能量公式](source-energy-formulas-20260928.zh-CN.md)：四种能量操作接共享AST，保留ER单读、energyApplications真实回执及四条固定装备事件；b4/a7两lane页面最终均重放差0。枚举不一致曾使首次绿色E2E失去正确性效力，修正后最终E2E通过。护盾／治疗／抗性／冷却等仍有缺口；不改数据或verified分母。

2026-09-28 最新：[固定来源圣遗物事件算式与快照记录](source-artifact-events-20260928.zh-CN.md)：a7 D6六标量、018 Blizzard快照CR与019三类事件附加公式完成指定三场景验收；b4/a7 WASM、Web及聚合页面通过。Disenchantment／b4快照及能量、盾／治疗、抗性、冷却等仍未覆盖；数据指针及verified分母不变。

2026-09-28 最新：[固定来源动态圣遗物公式](source-artifact-dynamic-20260928.zh-CN.md)：核心、b4/a7 WASM、Web与聚合E2E均通过；E2E四场景观察20个版本化规则／8套，非85条全测，Flower 4pc未实际触发。共享公式边界审计仍有未接入套装与非Amount算术，不视为全套覆盖或游戏验证，不改变历史分母。

2026-09-28 最新：[计算器命中组成聚合](calculator-aggregation-20260928.zh-CN.md)：核心2用例、686模块build和页面retry1通过；行秋编辑后两段1632.9599999999998／1858.4640000000002、合计3491.424，导出/报告/导入恢复一致。未阻塞的部分选择可有selected-components totals，但不标成完整施放。最终仅tracked whitespace检查通过。页面仅补数据展示，不新增角色/动作/游戏来源覆盖、不改变完成分母；无新WASM验证。

2026-09-28 最新：[来源圣遗物常量扩展](source-artifact-constants-20260928.zh-CN.md)：新增39个Amount常量、旧18规则保留；聚合E2E两lane通过，各54调用/7 IDs/4套命中。只证明特定12秒四人单目标运行与selected capture编辑/恢复；不是24套全机制验证，不改变数据或全量支持分母。

2026-09-28 最新：[固定来源有限触发武器公式](source-finite-weapon-formulas-20260928.zh-CN.md)：三把既有武器动态FlatDmg算式共享化并可编辑捕获；原生状态机不变。b4/a7聚合E2E首轮通过，两lane各观察三把回调、命中编辑和捕获恢复；未测完整耗尽/冷却/精炼矩阵。无新武器支持或数据分母变化，静态/特殊伤害限制保留。

2026-09-28 最新：[固定来源初能敏感度](source-startup-sensitivity-20260928.zh-CN.md)：b4/a7 两类来源对照零、原生满及可选自定义初能，并采集真实初始化后能量；Noelle有限双窗页面流程与一份从头完整重执行通过。最终文案bundle通过；只覆盖本次脚本、角色、来源和种子，不证明稳态、checkpoint或游戏 verified，数据分母不变。

2026-09-28 最新：[固定来源普通圣遗物公式与捕获](source-host-artifact-formulas-20260928.zh-CN.md)：七套共享18条数值规则；b4/a7页面各51应用、1,133次标量调用，实际命中四套规则。Go仍维护触发和状态，支持计算与伤害组成分开记录。新构建产物不继承旧完整运行凭证；此项不改变统计分母、不代表全套验证或游戏 verified。

2026-09-28 最新：[来源队伍模板模块](source-team-template-guide-20260928.zh-CN.md)完成18模板预览与显式载入检查、当前动作状态和templateId往返；1页面用例及本轮675模块生产构建通过。只证明一条受控页面路径，不扩充覆盖分母、不声称WASM或全模板验证。

2026-09-28 最新：[月曜圣遗物与配装应用](moonlight-equipment-handoff-20260928.zh-CN.md)完成指定15041／15042窗口接线及本地已有 actor 的装备应用接口；两核心用例、两页面与构建均有最终通过记录。source-team旧桥接保留；未映射机制明确列出。本轮不改变历史统计分母，不代表全部装备、角色能力或游戏机制完成。

2026-09-28 最新：[固定来源星辉圣遗物组合](stellar-artifact-composition-20260928.zh-CN.md)完成指定15047／15048真实回调快照、共享独立／模拟公式、两普通页面完整capture复跑；retry1核心、构建、页面均通过，页面测量与首轮失败均有记录。范围仍限现有特殊profile与用户声明基线，不代表通用机制或游戏验证；总体需求分母不变。

2026-09-28 最新：[固定来源完整复跑报告](source-complete-reexecution-20260928.zh-CN.md)：b4/a7各完成一条保存输入的同产物六域结果核对，JS共享公式按 formulaVersion 与完整输出约束；Classic用已保存6秒结果，Stellar为新4秒运行后复跑。输入 receipt 与导入历史通过凭证不提升验证等级。没有任意 checkpoint/游戏 verified/全目标完成结论，原数据分母不变。

2026-09-28 最新：[来源执行方案与观察窗口](source-profiles-observation-windows-20260928.zh-CN.md)：八项执行延迟、来源连续预热双窗和 seed 内配对差已接线；Classic 页面有限 profile 验收通过。Ideal 全零、Practical human 8/5、Conservative 12/8 均为工具政策（Practical 复用来源 preset 数值），不代表 KQMS/游戏标准；a7 无新增页面实测。有限窗口不证明稳态，verified 与数据分母不变。

2026-09-28 最新：[来源动作政策与完整特殊结果重现](action-timing-special-replay-20260928.zh-CN.md)推进§18/22/23：b4/a7实际排队／接受／输入窗口由sequence关联，严格首次未就绪停止并保留失败账本；七种本地特殊宿主完整保存有效输入、Worker重执行导入并核对复合结果。667模块构建、1核心聚合和2新页面实际通过。数据、ready及verified分母不变。

2026-09-28 最新动作增量：b4/a7的117/124角色包分别解析793/840个有实现的方法入口，其余260/276个为明确未实现、方法未解析0；这些是静态入口，不晋升readiness。编辑器按角色提供动作、普攻输入次数及参数依据。讨龙与普通武器叠层扩展至适用特殊宿主，特殊伤害自身回调仍阻断。665模块构建、1核心和1页面有实际通过记录，见[范围与测量](source-actions-weapon-composition-20260928.zh-CN.md)。

2026-09-28 最新产品增量：来源构筑可选择b4/a7，旅行者按实际键选择形态，两套队伍草稿隔离；动作可单次／定次／持续循环并沿用真实CD和能量。月感电／月结晶接入普通圣遗物回调与结果回放，候选生成结构化diff。1新增页面首轮通过（6击，独立恢复差0），664模块构建及1聚合核心窄修后通过。数据／verified分母不变，[实际交付与保留边界](source-variants-artifact-composition-20260928.zh-CN.md)。

更新：2026-09-28；原588行主提示已全文阅读。本矩阵以真实代码、生成数据和实际检查为依据。**全部目标仍未完成**；永久独立计算器、共享公式和可恢复上下文继续保留。最初只读审计及原缺口存档于[历史矩阵](history/master-requirements-status.zh-CN-2026-09-24-before-module-completion.md)，本页替换被后续实现超越的状态。

本日追加的[来源宿主增量](source-host-lunar-provenance-20260925.zh-CN.md)不改变`.27`分类分母：固定源码自动取得／4021blob匹配首轮PASS（exit0／8.634s），正常产品新增401注册包可搜索名册、401真实配置键和明确TODO来源。月曜桥接及通用属性贡献已接共享AST，WASM与类型构建分别窄修后PASS；唯一新页面首轮PASS（墙钟3.651s），60秒／172击／261计算、六分支真实出现、独立编辑及完整JSON恢复一致。累计38核心文件／91用例、26页面；包注册及本地验收不晋升游戏verified。下方历史批次的数值和验收边界保留。

2026-09-27 产品输入层新增：124身份/248双档参考配装、18可编辑配队模板、自由来源队伍和E/Q动作卡、实际CD/动画/能量时间线、GOOD与Enka真实聚合装备导入、共享AST面板预览和永久单技能交接。3条新增页面首轮通过，18模板生成、30秒40击实际模拟及单击恢复差0；新导入2用例和受影响Enka单项通过，最终构建641模块/3.349秒通过。详见[实际交付与验收](builds-rotation-import-20260927.zh-CN.md)。本增量不改变下列游戏数据/verified分母，不把模板数当作完整角色机制数；没有重跑历史全集。

2026-09-27–28 后续[共享来源／星辉增量](source-shared-stellar-20260927.zh-CN.md)：b4标量分项和护盾前玩家入伤进入共享AST、恢复及独立编辑；a7独立来源实际执行星辉，420包／420键可查，源码与许可分开；昭心新增显式gcsim自动链。最终648模块／3.372s构建通过；受击页首轮通过，星辉页跨图轨迹连接窄修后定点通过。该段为当时阶段记录，不覆盖本页新增的b4/a7共享盾与Drain状态；`.27`分类、preview及verified指针不变。


2026-09-28 前批状态增量：映射版本28覆盖124身份、1255命中模板、713条件完整、16部分、0分类阻塞；8项已发生特殊组成仍单列。b4 与 a7 来源宿主现在共用护盾、并行吸收／最小穿透和 Drain 的玩家受击状态公式及实际回执链。实际来源能量事件、动作尝试和多种子／额外 ER 对照 UI 已接入集成页面；该批 UI 与来源宿主仍按整合验收范围记录。每周只读来源发现工作流已加入，但本轮尚未远端执行；该前批版本只抓取人工登记的 URL 响应；后续真实候选摄取已补齐，见下段。当前生成装备覆盖计数见表内；不得沿用旧的 200 武器数。本轮集成记录：b4 WASM SHA-256 `457ee7fa1db6f1895ad3d80d16dc8b8a9d12efa01ffbdeb6e69d75d242e1ec74`（41,903,094 bytes），a7 WASM SHA-256 `b38c27d8fb828f4a09a0cee6a1af3c4a2993c98d8722cab3e429796e81820bad`（61,515,572 bytes）；Web 构建 retry2 通过，659 modules／12.3595s（initial与retry1的两项类型错误均已记录）。4个新增页面均已通过：两计算器页首轮通过，两来源页修正测试初能参数后定点通过（9.019s）；原失败留档。详细行为边界见[生命周期与能量记录](source-energy-lifecycle-20260928.zh-CN.md)。

2026-09-28 最新横向增量：`.29` 为124身份／1271命中模板／713静态条件完整／24部分／0分类阻塞。增加的8项是逐次观察下落动作，静态模板不默认完整；接触记录齐全后，同核心输出本次完整施放。另接入无队伍依赖的圣遗物生存／探索事件计算、来源队伍三种起步模式与六档观察窗；真实自动候选采集已本地实跑707来源文件。三个新页面首轮通过，664模块构建经一处重复类型导出修正后通过。详见[本轮范围与实测](candidate-utilities-startup-20260928.zh-CN.md)。

## 当前分母

| 对象 | 当前实际值 | 含义 |
| --- | --- | --- |
| 最近正式版本观察 | 2026-09-28 02:35:53 UTC（香港10:35:53），7.1；当前released/provisional | 官网页面搜索索引观察，未归档官方完整正文；活动verified仍为空 |
| 元数据 | 124身份/127天赋/789 ability/255武器/63套装/127命座 | 描述和schema有效不等于可执行机制 |
| 独立名册 | 124身份/252普通武器/63套装；3任务武器另列 | 武器类别仍partial，不构造100%总覆盖 |
| 当前映射 v29 | 124身份/1271命中模板/713条件完整/24部分/0分类阻塞；8个已发生特殊组成另列 | 实际日程展开击数另计；条件映射team-ready仍0。`.27`数值作为历史快照保留于各批记录 |
| 可组合来源能力v1 | 15角色/57可执行动作/89命中模板；包括5个C0 Q、安柏及十角色完整普通弓链 | 注册`gcsim-b4ae769-composable-abilities-v1`；独立分母，不增加条件动作或team-ready，正式verified0 |
| 固定来源WASM包 | b4注册117角色/231武器/53套装；a7独立注册124/241/55；各自名册键及版本明确。普通／月曜／星辉共享公式，实际属性和ReactBonus／抗防分项可恢复；b4与a7均接入共享玩家入伤、盾／盾最小值与Drain状态计算和实际回执 | 不是readiness或verified；闭包内部／跨角色关联仍partial，无任意checkpoint；仅记录来源确认的盾／Drain步骤，不推断未记录事件 |
| 生成装备覆盖 | 201武器定义（16 static、185 formula）/993精炼变体；173条件武器定义；53二件/48四件（46 formula artifacts、6 reaction artifacts） | 来自 `packages/game-data/src/generated/equipment-coverage.json`；计数含部分映射，不代表完整生命周期或 verified |
| 独立追击 | 16把/80精炼位置/95条件分支；15把既有自动执行，加昭心显式固定gcsim自动链 | 昭心目录倍率／50%触发与来源冲突未解除，目录自动模式仍阻断；不等于全部游戏验证 |
| 证据字段 | 9025记录，5366missing，各verified scope为0 | 本地测试不会自动授予正式游戏verified |
| preview | 2真实局部快照（7.1.50 / 7.1.50.2），各2角色；当前选中7.1.50.2，archive5；历史preview可选择、比较并由`snapshot=ID`精确恢复 | 未证明对应7.2V1；可执行定义0，数值/机制证据缺失，provider许可未知；正式/verified指针未变 |

## 主提示§1–26

| 要求 | 当前落点与真实状态 | 剩余范围 |
| --- | --- | --- |
| §1 两个产品 | 永久`/calculator`、`/examples`与团队页，共用核心 | 团队全量能力未齐 |
| §2 基线审计 | 实际文件/压缩包/HEAD/可用命令已审计并冻结 | 本批未重跑基线 |
| §3 独立技能流程 | 三种面板、角色/天赋/突破/命座、完整条件技能、显式日程与接触记录；新增水主HP事件／观察、Swift合法资格、奈芙尔有限5段及8项独立特殊组成，保留历史面板与独立已发生单击；最终面板和JSON共享核心 | 24个静态部分动作（含8个新观察模板）及被动命座、其余可组合团队来源动作与新宿主的完整属性来源解释 |
| §4 范围归属 | 单击/整次/序列/团队；明确纳排和时间分母；新增指令/周期/尾段归属 | 未实现的持久实体不能算完整 |
| §5–6 每步执行轨迹 | 类型化AST生成公式、变量、数字代入、中间值、说明；来源指定时点取样和独立HP附加基数保留实际优先级及共享解释；页面与报告同源 | 未实现规则须随执行核心补齐 |
| §7–9 可编辑例题与A/B | 正常产品入口，同一计算文档/核心；保留历史26页面批次；本日另有3配装页及2受击／星辉页通过；来源WASM普通、月曜与实际星辉分支可独立编辑及完整JSON恢复；两资源例题同核心 | 独立游戏验证的完整月/星例题证据仍不齐 |
| §10 独立readiness | 身份、数值、机制及hit/skill/sequence/team分开；新增真实证据可信链 | 真实可晋升定义仍0，不造证据 |
| §11 全量角色装备 | v29：124身份、1271命中模板、713条件完整／24部分／0分类阻塞；8特殊组成单列，13武器叠层自动执行；装备分母取当前生成覆盖计数 | M03/M04其余自动机制仍需实施，条件动作不是全角色认证；`.27`旧计数仍只作历史记录 |
| §12 持续更新 | manifest、发现/同步/解析/分类/验证/diff/原子激活与回滚；每周来源发现与固定HEAD真实候选摄取 workflow 已加入；707文件本地实采通过；真实7.1.50与7.1.50.2两次部分preview已摄入，当前加载后者 | workflow 未远端执行；自动候选不自动确定发布身份或晋升；7.2V1映射和预览数值语义/机制仍缺，7.1不能称全机制完成 |
| §13–14 文档和来源 | 当前报告/状态重生、固定来源及不可变字节哈希 | 来源争议单列，不将文档当实现 |
| §15–16 普通/月/星 | 独立特殊规则与状态；实际贡献者种子抽样先暴击后排序，三套月曜条款进入五宿主 | 未确认直接能力/装备/空间/反馈不解禁 |
| §17 团队事件实体 | 真实目标HP/掉落、装备生命周期、生命之契及动态上限；本批通用玩家盾与六套普通增益的真实队列、AST、正常账本及完整JSON独立校验；15角色可组合来源与可选固定Go/WASM机制宿主；有限火／Frozen敌盾、13武器叠层 | 全量人物解释、其余敌盾与回调、角色专属玩家盾、动态上限及死亡复活等 |
| §18 动作编辑与配置 | 两来源新增严格/自动等待政策、实例回执与真实输入窗口、中止账本；原DSL、repeat/绝对请求帧、严格/等待、取消、体力；通用共享E、walk/plunge；普通队伍能力控件保留面板／初能，显式建立合法时间线；实际接受普攻推进，等待／拒绝Q保持，真实换人重置 | 十弓族新增47输入／51箭，超出可组合来源动作库仍有限；不猜动作帧/空中资格 |
| §19 时长/DPS | 请求周期、输入占用、观察窗、完整尾段分开；完整JSON保存 | 私有反馈尾段未知时完整指标阻塞 |
| §20 能量/起步/ER | 真实能量流、ER动态来源、来源原生动作尝试与随机流捕获；连续来源能量窗和多种子／额外ER UI，以及满能／零能／逐角色自定义起步、六档观察窗已接入集成页面；冻结／激化／超载／超导／火扩散／碎冰六种闭合输入的真实非周期状态实测period1 | 两来源页面已验证真实能量不足拒绝、ER0／20%与共享盾恢复；随机稳态未证明；感电／燃烧／草原核／结晶捕获已有before2／before32实际队列和随机状态断言；任意队伍完整闭环仍未齐 |
| §21 标准和随机 | 自定义/KQMS-inspired偏差显式；种子与实际执行身份可重现 | 不声称KQMS完整合规；未重跑大型随机分布 |
| §22 UID/敌人/UI | 七种本地特殊宿主完整结果Worker重执行导入/导出；公开展示柜三种模式、敌人条件、结果账本；新增HP和事件配置 | 真实在线UID未因mock而视为已测；有限敌盾已接，其余敌人机制未齐 |
| §23 计算器回归 | 历史38文件/91用例、26页面有通过记录；后续新增配装3页、受击／星辉2页，各按实际批次留证；集中CLI单列 | 未重跑历史全集，不声称覆盖未实现机制 |
| §24 更广正确性 | 共用模块单元、批量来源、JSON回放与必要构建/数据校验 | 不用少数角色外测替代全产品交付 |
| §25–26 交付/阻断 | 真实工作树改动+中文报告；不隐藏计算器、不造数值/preview/verified | 目标保持进行中，尚未发布全量完成 |

## 后续模块清单

| ID | 本批已完成并有必要检查的部分 | 仍需实施 |
| --- | --- | --- |
| M00 能量结论 | 候选实际球/固定能量/扣能请求与种子；范围内无解、安全值评估 | 更广资源模型随机制增加 |
| M01 证据链 | sidecar、权威pointers、独立来源AST绑定、所选scope评估 | 真实数值/机制审阅证据及晋升 |
| M02 preview | 独立catalog/supplemental/成长表/装备、normal UI、身份和缓存隔离；真实7.1.50与7.1.50.2两角色资料已摄入2快照，当前后者 | 7.2V1身份映射、完整名册、数值语义及机制核验 |
| M03 角色数据 | v29映射注册124身份／1271命中模板／713条件完整／24部分／0分类阻塞；观察资源前缀与例题接同核心，非全角色完成 | 24个静态部分动作中8项可按实际接触完成本次下落；完整被动/命座/形态和自动生命周期仍缺 |
| M04 装备 | 月曜如雷/乐园/晓歌共享AST；余响／昔时真实生命周期；本批宗室／教官／饰金／谐律／普通乐园／辰砂真实普通域增益与JSON独立回放；四套能量／冷却事件，16独立追击入口、15把自动执行；新增13把命中叠层及独立回放 | 其余装备生命周期、完整月曜／星辉增益及昭心目录规则裁决；昭心已有显式来源自动链，保留固定源码TODO |
| M05 动作 | 非祭礼专属共享E槽/延迟SetCD；walk/plunge和正常控件；独立计算器显式协同日程、持按生命周期与有限后续；来源注册v1的15角色／57动作／89模板，真实接受／重置状态、取样与正常绑定及DSL | 其余来源N/CA/P/E/Q、实体/取消/位移/卡肉 |
| M06 生命/敌人 | 目标HP／掉能、生命之契与动态上限；b4与a7共用玩家受击盾、盾最小值、Drain状态公式和实际回执；通用盾含并行吸收、覆盖、到期与强效 | 有限火／Frozen敌盾已接真实ICD／GU／HP；来源assumed，其他盾／副作用、角色专属盾、动态回调与死亡复活未齐 |
| M07 指标 | 实际输入结束、尾段和来源归属；区间分母、正常页面/记录 | 更多机制必须完整声明尾段，未知不伪报 |
| M08 反应 | 已支持月域种子贡献者抽样与实际捕获复现；所选月曜装备条款实际取样/重放；星涡真实jump消费及plunge落地 | 独立a7已执行星辉字段与交付，源码计数／实体／范围争议、二阶Vortex实际验收、未映射特殊直接能力／装备及一般混合／空间反馈仍未齐 |
| M09 检查点 | 既有资源／装备／随机状态；本批真实玩家盾任务及非周期反应来源、代次、ICD、排队伤害和目标减益，六种闭合反应输入实测period1 | 感电／燃烧／草原核／结晶真实私有状态、before2／before32待队列、随机流及完整JSON断言通过；随机稳态、有限目标重置等仍缺；不能把六种反应样例证据转为新来源取样任务的任意周期闭合 |
| M10 依赖教学 | 逐击EM装备转换、心海最终记账；翠绿/深林按元素pending、另25类纯增伤按真实命中依赖、最终JSON保持 | 其他未映射条款及自动生命周期、达到证据门的真实完整特殊例题 |
| M11 产品收尾 | 当前报告/矩阵/状态数字更新，HP／装备与三处正常日志分页，移动端长ID修复；新分页仅构建通过，无专项页面测试 | 剩余大日志和无障碍细项随具体界面收尾 |

## 真实外部证据与代码缺口分开

S01：真实7.1.50及7.1.50.2两角色结构化预览已分别固定并摄入；未证实它对应7.2V1，完整名册、数值语义及机制仍待核验。S02：`.26`已通过来源裁决及限定观察协议解除水长E×2、伊安珊天赋绑定×1，当前分类阻塞0，仍非全量角色机制覆盖。风Q×2／草Q×2已有Optimizer男女实际键的独立数值裁决，旧gcsim冲突仍留档；冰主4个状态分支按真实回调／辉映输入接入，极星实体计数和男性下落来源等范围限制未消失。男性重击7项此前通过独立男性来源解除，均未放宽旧容差。S03：此前四身份缺口通过固定发行版原始表补44基础动作；奇偶补充为single-source-extracted，沃雅妮莎／薇斯纳多份数据仍同一提取链，不能冒称独立游戏验证。其余状态与E/Q分支仍未齐。

S04：月/星规则版本、181/180帧、贡献者冻结、实体计数和空间等冲突逐项补证。S05：装备来源分歧保留，例如昭心倍率/概率、笛剑R1–R4、部分属性区和粗帧；已经确认的固定源代码可以继续实现，不把所有待做工作归为“缺资料”。

月曜装备增量新增6单元用例、1页面流程及当时414模块构建通过，详见[模块记录](lunar-artifact-bonus.md)；该增量本身未改变`.19`角色分类。后续协同日程实际将分类推进至`.20`，并完成两把自动追击和真实预览入库，见[后续模块记录](continuation-modules-20260924.zh-CN.md)。前批18动作将分类推进至`.21`，生命之契及随机检查点同时接入，见[增量记录](held-resource-expansion-20260925.zh-CN.md)。本批30动作将分类推进至`.22`，动态生命上限与实际星涡跳跃同时接入，见[本批记录](lifecycle-maxhp-expansion-20260925.zh-CN.md)。其后`.23`增加3接触／标记协议、余响／昔时实际生命周期和25类命中范围依赖，见[装备与接触交付](artifact-contact-expansion-20260925.zh-CN.md)。该批后累计31单元文件/82用例、19页面流程；统一构建修复1处optional数组类型后exit0，墙钟2.761s、479模块、Vite436ms；数据生成／一致性／状态更新4.256s／4.211s／3.290s，均exit0。

可组合来源批次新增1核心文件／1用例及1页面，均首轮PASS，该批后累计32文件／83用例、20页面。实际页面总伤10028.029、DPS1253.503625，命中回放差0、完整记录恢复一致，见[该批交付](composable-source-actions-20260925.zh-CN.md)；来源归档64文件／180值／12向量，provisional与verified分开。

前批`.24`新增4核心文件／5用例及2页面分次通过，累计36文件／88用例、22页面。构建类型窄修后3.176s／525模块／Vite471ms通过；mixed JSON重复依赖标签修复后只重打包并复验失败页面，Playwright1.5s／墙钟2.016s。团队宗室1000→1200、盾吸收2500／穿透500、HP9500，回放差0与完整JSON一致；六种非周期反应真实检查点period1通过。所有原失败、数据三步记录和有限来源域见[最新交付](remaining-source-runtime-20260925.zh-CN.md)。

前批`.25`新增1聚合核心文件／1用例及1页面定点复验通过，累计37文件／89用例、23页面。真实trace子节点和JSON依赖重复两次生产问题及修复保留，不重跑已通过项；核心2.09s／墙钟2.590s、页面1.7s。草Lv14期望1521.7875，兹白月段3042.97728→3327.36768，装备最终面板／完整JSON期望3315.9334107998875一致。数据三步与类型／生产构建通过；来源、日志及实际范围见[`.25`交付](traveler-zibai-source-20260925.zh-CN.md)。

当前检查和失败窄修详见[QA](qa-report.md)。历史性能、历史外部对照均按其原日期与输入引用，未因本次构建通过升级为当前官服或全覆盖证据。发布阻断条件继续有效：独立入口与教学不能退化、缺值不填零、缺少相关依赖不返回verified、preview不混入正式比较、完整上下文才能宣称模拟命中复现。

前批`.26`新增1核心文件／2项及1页面：第一核心项retry3通过后不重跑，第二项retry7通过（1PASS／1SKIP，2.96s／墙钟3.455s），累计38文件／91用例、24页面；页面首轮通过，3.9s／墙钟4.483s。数据三步4.674／4.999／3.669s和分类读取1.606s通过，2026-09-25的build.retry1以3.232s／582模块／Vite510ms通过；当时后续奈芙尔物化、感电旧到期、草核priority及随机流修复未纳入该构建，现已由[`.27`最终构建](broad-coverage-runtime-20260925.zh-CN.md)覆盖，原批次边界不改写。来源链、独立协议、实测数值与全部失败见[`.26`记录](horizontal-source-runtime-20260925.zh-CN.md)。resources／weaponstack／enemyshield／bowfamily当时归下一批，现按下方`.27`单列交付，不回填为`.26`验收；不升级provisional来源，也不将JSON可恢复等同任意周期闭合。

当前`.27`整类交付及全部失败见[新报告](broad-coverage-runtime-20260925.zh-CN.md)：两资源、十弓族、13武器、四身份、有限敌盾与固定Go/WASM宿主各自按真实范围验收。数据三步通过；包含冻结AST修复的build.retry2为3.540s／625模块／Vite569ms。来源页24秒、27击／34计算，总33451.32354597975，导出导入一致，retry1以2.005s通过；累计25页面，38核心文件／91用例不变，本批CLI单列。最后补入实际WASM字节SHA256／大小并保留到result、capture及编辑JSON；仅最终类型／构建3.673s／625模块／Vite590ms检查通过，未重新浏览；包注册不等readiness，完整上游属性解释、任意帧checkpoint、月星与共享玩家入伤未完成。
