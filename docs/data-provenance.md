# 数据来源与信任边界

真实工作树基线为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，审计见 [current-project-audit.md](./current-project-audit.md)。结构通过只说明字段可以读取；发布状态、倍率语义、角色机制、可执行条件支持与正式验证分别记录。

## 当前运行时与历史输入

当前默认目录为 **7.1 released / provisional**，来自固定 `theBowja/genshin-db@49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。`manifests/runtime/current.ts` 原子选择同一快照的 catalog、轻量索引、supplemental 和 metadata；浏览器角色选择、装备数值与成长曲线均读取这套投影。正式已验证通道仍为空。快照身份与动态支持计数见 [update-status.md](./update-status.md)，避免在多个文档手工维持不同数字。

| 来源 | 使用范围 | 证据边界 |
| --- | --- | --- |
| 原供应 genshin-db npm 5.2.12，`1bab2cdba4d218fd5caa46b5f54e7884ee8359a2` | 保留原 6.7 标签目录及可重复生成历史夹具 | provisional；源标签不是今日官方版本 |
| 固定 7.1 Git 树 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf` | 124 身份、127 天赋集、789 技能/被动、255 武器、63 套装、127 命座集 | 数值原样保留；当前源元数据不是完整机制实现 |
| 原 Enka API-docs 标识映射 | 148 个形态/技能 ID 互通映射 | 未凭空补齐新形态；非倍率或机制证明 |
| 日本 Wiki 独立名册 | 122 个角色名称展开 124 身份、252 个普通武器名称、63 套装 | 角色/套装在已枚举版本内容范围内匹配；武器整体完整性仍为 partial |
| Genshin Optimizer `180a0a1015cb725c7570cd828eb086749960df98` | 稀有度 1–5 圣遗物精确表；新增8身份的生产角色定义、基础系数与部分条件公式 | 圣遗物5个文件及角色定义分别保留固定来源与哈希；忽略 TODO 占位公式，条件支持不等于完整机制验证 |
| 固定 gcsim / 逐字段语义映射 | 已分类角色命中、条件装备公式 | 每项来源与数值漂移检查；conditional / provisional，不自动晋升 verified |

7.1 原始数据通过自有 `ingest-genshin-db-tree.mjs` 读取 707 个固定文件，仅解析 JSON，未执行下载仓库程序。战斗数据投影 SHA-256 为 `6720353b1a8f5f9b26e96a7f117fcfe070c2be3ec469235b7dbae0eb5098d7e0`；这是本项目投影的哈希，不能冒充上游不存在的 bundled 文件。逐文件路径/哈希与 gzip 投影保存在 `manifests/source-evidence/`。

`manifests/raw/` 保存实际摄入 bundle 字节；`snapshots/` 保存不可变完整快照。读取时复核快照身份和 payload 的 SHA-256；运行时投影复核精确内容。原始 official-next、失败候选和旧目录均保留其历史标签，修订另建快照。源包 MIT 与 Enka 原有 `NO-LICENSE-DETECTED` 标记保留；社区许可不改变游戏文本的权利归属。

## 官方版本与预览

2026-09-22 22:35 香港时间的观察是 7.0 已发布、7.1 official-next，原记录保存在 `manifests/observations-history/2026-09-22.json`。**2026-09-23 14:22 香港时间重新核对后观察到 7.1 已发布**：[发行商 Epic 商店页](https://store.epicgames.com/p/genshin-impact)明确表示版本已推出，[官方 genshinimpact 更新公告](https://www.reddit.com/r/Genshin_Impact/comments/1wnsx0u/a_rekviem_for_the_underworld_version_71_update/)同时支持此判断。没有仅因维护日历已到就自动改成 released。

官方正文经网页工具读取，直接 HTTP 为 403，正文原始字节哈希保持 `null`。HoYoLAB/Yatta 仅取得页面外壳时，外壳哈希明确不能证明文章或预览正文。详细 URL、时间、获取方法与限制见 [release-inventory-2026-09-23.json](./research/release-inventory-2026-09-23.json)。

7.2 V1 仍缺少可下载、钉住修订、可重复读取的结构化源。相关 API 的 DNS/403/502 与应用壳记录是可用性阻碍，不是该预览不存在的证据；没有创建空的“成功预览”。npm 5.2.14 描述称 7.0 但实际含 7.1 项目的冲突另存 [npm-release-label-conflict.json](./research/npm-release-label-conflict.json)，没有按描述生成假的纯 7.0 数据集。

## 独立名册、局部字段与未知项

独立名册先从 Wiki 枚举名称，再用固定日文源做名称到 ID 的对应；没有用导入集合定义自己的分母。[independent-inventory-mapping-2026-09-23.json](./research/independent-inventory-mapping-2026-09-23.json)保存每个名称的独立 URL、映射方法与本地化文件哈希。122 行将旅行者、人偶各展开男女两个 ID 得到 124 身份；元素天赋形态另计。该名册证明版本内容匹配，不代表逐身份当前可抽取时间或机制已经核验。

独立 252 武器名称与 255 源记录的三项差异为 `11419/11420/11421`「一心传」名刀任务试用阶段；[独立任务页](https://wikiwiki.jp/genshinwiki/伝説任務/稲妻#mi27)与[武器页](https://wikiwiki.jp/genshinwiki/片手剣/籠釣瓶一心)支持其限定场景。三项保留审计记录，但普通配装筛选排除且 resolver 拒绝使用。252 包括往期活动限定武器，不等于现在全部可获取；武器独立完整性仍为 partial，不报告全项目完成百分比。

新 Git 源省略十把一/二星入门武器的副属性类型。[Wiki 按来源表](https://genshin-impact.fandom.com/wiki/Weapon/List/By_Availability#Unlimited)明确逐件写明 `None`，旧固定源也给出 `FIGHT_PROP_NONE`。`manifests/field-resolutions.json` 仅针对这十个 ID、固定源 commit 和一致的原始数值记录解决 `mainStatType` / `stats.specialized` 类型字段；`stats.base.specialized` 数值仍为源值 0。不是用数值 0 或字段缺失推断“无”，也不泛化至其他武器。未能判断的类型仍为 `FIGHT_PROP_UNKNOWN`；基础攻击力缺失则拒绝生成。

当前快照有 9,025 个字段评估，5,366 个缺失语义/机制字段组；新增 20 个副属性类型字段仅为 cross-checked / partial。原始供应目录误标 ATK / verified 的自动映射审计数量是 **0**，没有虚构修复数量。已验证数值/机制字段、已正式晋升的命中/技能/序列/队伍定义仍为 0；独立计算器可使用来源分类的条件映射，它们不受无关未实现技能的全角色封锁。

圣遗物按源保留真实 1/2/4 件效果，四个祈祭套装只有头冠和一件效果；精炼只保留真实存在的级别。角色/武器 100 个整数等级曲线按精确键读取，不插值。词条源文件校验与装备公式的条件支持统计独立于目录 verified 指针。

新增角色分类与装备规则是独立语义映射，不改写原始快照的正式验证计数。固定生产定义、字段偏移、倍率漂移及具体缺口见 [Optimizer角色扩展](cross-validation/optimizer-character-expansion.md)、[装备反应](artifact-reaction-effects.md) 与 [条件武器](weapon-conditional-effects.md)。

## 夏洛蒂 C2 的条件状态与外部样本

夏洛蒂E的C2–5支持使用逐击实际层数、共同最终面板已含层数，以及差值非零时所需的明确基础ATK；不是从命座、当前面板或本次命中人数自动推导所有标记状态。补充来源归档在 `packages/game-data/sources/charlotte-c2/`，复用固定gcsim与Optimizer版本，并独立保存13份属性取样、回调、到期及基础攻击语义的原文与哈希；此前柯莱/夏洛蒂归档保持原样。C6、自动刷新与状态时钟、动态团队生命周期仍未据此实现，released/provisional和正式verified计数不变。

[一次C2长按E外部样本](cross-validation/charlotte-c2-external.md)实际观察到初击无本次C2、七次标记带一层、第八次标记在833帧恰逢属性到期而不带C2，总伤害为72.97657577190927。这个记录限定Lv1/A0/T1、无其他增益、单静止目标、零暴击且无角色卡肉；按外部未舍入字段复算9击差0属于算术复核。本地共享核心另读取该唯一原始样本，逐九击按每击绝差小于`5e-13`的断言通过，未打印实测误差，不能改写为严格差0，详见 [核心专项](validation/charlotte-c2-core.md)。它不证明多目标叠层、卡肉延长、重复E刷新、其他命座或当前官服完整机制已核验。

## 独立武器追击的来源范围

钺矛、苍纹角杯、冷寂迸音的首批独立伤害使用同一份生产倍率定义，供单次追击计算器和显式团队触发模型共同读取；三把R1–R5共15个精炼位置单独记录。固定gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`、当前catalog与上述Optimizer的15处静态倍率对照差为0。原文、哈希及语义说明见 [追击来源审阅](cross-validation/weapon-proc-calculator-source-audit.md)；Optimizer通用伤害节点的名称不表示这些追击造成元素伤害，未执行的TODO占位文件也不作为证明。

后续五把为吃虎鱼刀、试作古华、雪葬的星银、龙脊长枪、忍冬之果。该批新增25个精炼位置包含40个条件倍率分支；当时连同首批为八把、40个精炼位置、55个条件倍率分支，不能把霜葬的高低档计为额外精炼或新增普通配装覆盖。共享[来源审阅](cross-validation/weapon-proc-five-source-audit.md)保留源表达式的机器精度；24份gcsim/目录原文与15份Optimizer原文分别有字节指纹。40个新增条件倍率在固定来源间核对，源式与十进制向量使用小于`1e-14`界限，不冒称全部逐位零差。Optimizer五份sheet没有RNG、冷却或附着调度；其吃虎鱼刀/古华使用premod ATK，三霜葬使用total ATK，不能由默认相等推断任意属性转换情境均相同，详见[独立Optimizer审计](cross-validation/weapon-proc-five-optimizer-source-audit.md)。

再加入笛剑、以理服人、流月针、竭泽的20个精炼位置后，独立单次追击目录为十二把、60个精炼位置、75个条件倍率分支。这四把的gcsim/目录倍率分别为1/1.25/1.5/1.75/2、0.6/0.75/0.9/1.05/1.2、0.2/0.25/0.3/0.35/0.4和0.8/1/1.2/1.4/1.6倍ATK。固定Optimizer的笛剑sheet写死2而不读精炼，R1–R4与gcsim及目录冲突；四把20个位置中只有16个在该sheet/描述核对中一致。共享定义明确采用gcsim/目录并显示笛剑来源冲突，不将20个位置写成三方全部一致。[共享来源审阅](cross-validation/weapon-proc-lifecycle-source-audit.md)保存29份gcsim/目录原文与实际状态转换检查；14份Optimizer原文指纹、伤害属性层和静态sheet不具备状态调度的边界另见[Optimizer审计](cross-validation/weapon-proc-lifecycle-optimizer-source-audit.md)。

这些定义仍属于7.1 released/provisional，未增加正式verified数，也未重新观察官方发布状态。独立计算器只计算已触发且实际命中的一次物理追击；团队模型另执行普通伤害回调、触发快照、+1f投递、冷却及实际范围判定，限定无角色卡肉。后续确定性检查点已捕获三把真实冷却与在途快照，并在既有普通水火域的原生v9/目标阶段v2连续场景建立周期1；它证明该明确输入及完整状态的周期，不代表其余武器生命周期、未覆盖反应或随机机制已完成。见 [计算器范围](validation/weapon-proc-calculator.md)、[运行时范围](validation/independent-weapon-proc-runtime.md)与[检查点证据](validation/weapon-proc-phase-checkpoint-core.md)。

[首批外部参考样本](cross-validation/weapon-proc-external.md)记录一次固定上游CLI运行中的三把R1追击，使用静止单目标、零暴击和关闭卡肉的输入。仅对该外部记录逐项独立算术复核，不能替代本地运行时对照；该外部样本也不覆盖R2–R5实际触发、多目标、前后台变化、临时属性或全部冷却边界。

新增五把按固定源分别保留成功比较符、前台/攻击标签过滤、吃虎鱼刀先抽样后查零伤害，以及霜葬R5仍抽样。霜葬在成功的延后伤害回调读取原触发目标Cryo/Frozen，一次选择整个AoE倍率，不能固定读取宿主自己的附着结果或逐次级目标重新选档。独立计算器只计算已发生的一击，不把触发概率乘进其伤害；团队采用命名随机流和无角色卡肉模型，不与gcsim共享流的同seed序列等同。新随机流和延后回调私有状态尚未完整导出，仍阻塞完整周期证明；旧三把确定性检查点的支持范围不变。

[本地结果校验专项](validation/random-weapon-proc-integrity.md)另有一个合成反例：父命中之后已有同相位火命中消耗冰，延后回调取无冰条件，两名追击目标共用1.4倍而各造成700伤害；第二目标的真实capture经JSON及共享核心回放差0，伪造倍率、条件、随机值或回调次序均被拒绝。该一次用例经两次夹具修正后通过，不是首跑成功，也不是下述外部忍冬样本的本地对照；相位末恢复只验证Cryo/Frozen谓词，不能扩大为全部Aura对象或全部反应生命周期已验证。

[唯一忍冬R5外部样本](cross-validation/frost-proc-external.md)使用夏洛蒂Lv1/A0/C0/T1、零暴击、关闭角色卡肉和两个互不重叠静止目标。N1在14帧只命中并新附冰于目标1，回调选择3.6ATK，15帧追击对目标1及无冰目标2各造成69.76265017880414；外部统计与sample总伤均为149.18463690136548。这只是该次外部记录间一致，不能写成本地引擎残差，也不证明同帧其他任务竞争、反应回调、死亡或到期边界。此前[16把静态审计](cross-validation/weapon-proc-next-source-audit.md)保留原时点与未执行声明；后续四把状态追击另有下文的来源和事件证据，剩余4把未接入。全部独立追击仍维持released/provisional，不增加既有条件配装、角色命中或verified计数，不刷新2026-09-23的官方发布观察。

随后对同一固定样本进行一次本地完整对照，首轮通过，未再调用外部CLI。真实N1新附冰后由延后回调选择3.6，R5实际消耗一次独立抽样；三击及总伤对外部残差均0，三份capture经JSON和共享核心回放差0，两次追击另经独立计算器builder及JSON恢复差0。实际[测量记录](cross-validation/frost-proc/charlotte-frostbearer-reference.local-metrics.json)保存这次运行与源码指纹；它只补齐该明确样本的本地执行证据，不扩大外部未观察的冷却、其他精炼、同seed序列或全角色机制范围。

[四状态武器事件审阅与唯一竭泽外部样本](cross-validation/stateful-weapon-procs-external.md)另核对真实`OnSkill`和`OnParticleReceived`来源：合法就绪检查在施法前，技能事件在技能函数体前；粒子分发是实际拾取事件，不等同逐角色回能变化，源中满能封顶或零粒子数量不取消该事件。四把各自的窗口、音符、次数、门槛和到期等号须按来源分别处理，不能仅由静态描述推导通用生命周期。

该次唯一外部CLI实际运行迪奥娜Lv1/A0/C0/T1与竭泽R5，在1／400／800帧施E。1与800帧各激活一次，400帧E被武器激活冷却挡住而不刷新；每轮第三次回调删除效果，但已经排到下一帧的追击仍造成伤害。六次追击各30.09208577319588，加上六爪和四次普攻共16击，总伤254.05995716164952，外部summary与debug合计差0。此处不是本地引擎残差；也不是另外三把、等号边界、满能/零数量拾取、角色卡肉或完整迪奥娜生命周期的外部验证。

冻结后本地首次调用因误用仅供祭礼的`cooldownStartFrame`而在配置解析时失败，没有战斗；只修该夹具为当前支持的365帧总E间隔后，唯一完整战斗通过。16击、总伤与外部逐项差0，16份capture JSON回放差0，六次追击另由独立builder及JSON恢复差0；运行时自行产生激活、次数与追击，没有注入外部结果。来源宿主帧作为明确输入，静态面板使本地命中取样与源提前快照数值相等，不认证通用延迟冷却或完整普通攻击时钟。失败记录、成功测量及原始字节分别保留在同一[对照报告](cross-validation/stateful-weapon-procs-external.md)中，未重跑外部CLI。

生命周期结果的[独立校验专项](validation/stateful-weapon-proc-integrity.md)另记录两项合成用例：竭泽能量不足E无激活、三次耗尽后已排追击可恢复，流月针满能实际拾球仍激活、后台回能及固定回能不激活、退场后效果到期等号仍可触发。首轮一项通过、一项夹具字段错误，只有失败项修正复验；未据此修改生产行为，也未把这些合成结果冒充外部角色样本。

[运行时专项](validation/stateful-weapon-proc-runtime.md)另实测笛剑音符和精确范围、以理服人E刷新，以及流月针满能且数量0的实际接收事件。数量0配置入口按固定来源扩展当前格式，冻结旧格式保留原限制；不把零能量固定加算冒充粒子分发。三项用例分次通过，首次失败与必要夹具／入口修正保留各自记录，不称一次首跑全过。

随后[四状态检查点](validation/stateful-weapon-proc-checkpoint.md)的原单例发现真实固定属性增益字段错误，修复后在32秒普通水火闭合输入中实测1880伤害、58.75 DPS及完整周期1。当前合法运行通过`flatStatBuffSemantics: "canonical-v1"`保存固定属性映射；旧缺标记结果不自动升级读法，冻结旧schema不接收新标记。此前竭泽外部／本地对照的源码哈希只证明那次运行时点，不能改写为此后修复的最终代码指纹；本次修复后的+200ATK历史快照与sourceResult JSON恢复由同一检查点用例另行提供实际证据。目录身份、普通装备／角色覆盖、verified和官方发布观察均不因此改变。

## 讨龙切人增益的来源边界

讨龙R1–R5的24%／30%／36%／42%／48%基础ATK增益、600帧名义持续与1200帧持有者冷却来自固定gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；当前catalog的倍率另列于共享定义。来源区分持有者普通Status冷却、接收者共享`ttds` StatMod的存在性，以及完整`Stats()`的到期清理。前两者在到期等号仍有效，后者在`expiry <= frame`时排除并删除记录；非删除的属性选择与只读审计不能代替真实完整取样。

[唯一外部运行](cross-validation/ttds-external.md)在无角色卡肉、真实60帧切人冷却下，观察到接收者602／1803帧到期等号拒绝刷新且消耗新持有者冷却；603帧的完整E快照已没有讨龙属性。持有者等号探针被实际切人冷却推迟，因此只观察到ICD到期后一帧成功；本样本也没有成功领取R5。外部请求帧与实际完成帧、直接日志与按源码推导的拒绝理由分别保存，不改配置重跑来替换这一证据。它不证明角色卡肉、任意同帧顺序或当前官服行为已核验；发布观察与verified通道不因此改变。

随后唯一一次本地受控对照输入这11个已观察的真实完成帧，由运行时自动产生6次讨龙判定；没有预填讨龙增益，也未重跑外部程序。六次伤害与外部逐项严格差0，总伤害65.33266136319587；六次真实命中经捕获、JSON及共享核心回放仍逐项差0。该本地结果是明确完成帧输入下的 `legacy-implicit` 转换，不证明动画编译器独立推导这些帧，也未复制凯亚随机产球。持有者等号失败、R5成功领取等边界另有 [本地运行时用例](validation/thrilling-tales-runtime.md)，不能冒称外部样本已经观察。

独立计算器与自动切人模型共用5个精炼比例。独立入口按实际与面板已含份额补差，团队入口按真实切人和Stats取样决定领取；[计算器专项](validation/thrilling-tales-calculator.md)复用7份已存原文字节并记录指纹，[结果回放专项](validation/thrilling-tales-result-integrity.md)另核对来源日志、实际面板和捕获。真实冷却、接收者存在性与快照已进入受限确定性检查点，40秒三角色合成合法循环建立周期1。这些是新增执行路径，不增加既有自身装备条款或角色命中覆盖计数，仍为source-backed-provisional，不晋升verified或刷新官方版本观察。

## 祭礼冷却重置的来源与随机边界

四把祭礼共用固定gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的普通伤害回调与角色E充能队列：R1–R5概率为40%／50%／60%／70%／80%，内部冷却分别1800／1560／1320／1140／960帧。共享定义保留源概率表达式 `0.3 + R×0.1`，实际判断严格为 `roll < probability`；只凭显示四舍五入的百分数不能替代这一比较。本项目采用无角色卡肉的范围，不把新执行路径计作额外角色命中或自身装备数值条款，也不晋升verified。[共享来源与队列专项](validation/sacrificial-shared-cooldown.md)复用18份已有实际原文，核对四把R1–R5的20个概率及20个ICD目录位置；纯转换的两项首跑通过不代替真实宿主调度验证，也不涵盖覆盖模板重置方法的角色私有语义。

[唯一外部砂糖C1样本](cross-validation/sacrificial-external.md)用R5祭礼残章、三静止目标和明确关闭卡肉的输入，实际观察到第二次E在99帧仅恢复一层，第三次E使用该层；原910帧恢复任务失效，剩余队列从重置帧重新完整计时，于999／1899帧各恢复一层。三次E各只生成一组四风粒子，143／199／255帧拾取后能量为12／24／36。外部九次伤害合计328.4267004371134，与该次外部统计相同；这项一致性本身不是本地引擎残差。

随后一次成功本地完整对照使用真实合法E请求1／57／113和独立子流，实际生成99帧重置、999／1899恢复及36能量；九击外部残差与九份capture JSON共享核心重放差均0。首次调用因夹具目标ID和aura版本不合法，在配置解析阶段退出；保留首失败记录并仅修正输入后复验。详细产物、125源码指纹和耗时见同一[对照报告](cross-validation/sacrificial-external.md)。这项有限对照也不扩大下述来源范围。

外部日志不记录祭礼roll数值，统计与debug样本也不是同seed执行。本地命名子流即便可复现，不能声称与gcsim共享随机流的同seed抽样一致。该唯一外部样本没有观察失败roll、离场、零伤、错误标签、ICD等号边界、其他精炼或其他祭礼类型，几何还明确含目标重叠；不据此宣称完整砂糖动作库、随机稳态或当前官服机制已经核验。原始配置、结果、sample及31份固定源码的哈希由专项记录保存，后续解释不改写这些原始字节。

当前配置的四把祭礼仅接合法时间线，每持有者E共享真实串行队列；来源重放从已接受命令与普通伤害回调重新生成延迟扣层、抽样、单层reset及自然恢复，不相信导入日志自报的结果。[独立结果校验](validation/sacrificial-result-integrity.md)已在明确合成的三次100%ATK物理命中上验证99帧reset、999／1899帧恢复、第三击完整JSON复现差0及四类篡改拒绝；该1500合成总伤不是外部砂糖的328.4267004371134。共享来源、有限运行、外部样本与完整角色/稳态验证继续分别记录，目录身份、覆盖计数及官方发布观察不因接线更新。

## 已执行的定向验证

- 运行时数据接入阶段的 `vitest` 仅运行 catalog 与 update-pipeline 两文件：**15 个测试通过，3.26 秒**，覆盖历史夹具、活动身份、显式无副属性、真实运行时选择、preview 阻断、晋升、回退与快照篡改拒绝。
- 后续统一晋升/回退的归档状态后，仅复查对应原子晋升/回退测试：1 个通过、8 个跳过，1.27 秒；见 `data-rollback-targeted.log`。
- `npm run data:check` exit 0：历史生成目录内容可重复、当前 7.1 四件运行时投影一致、两类覆盖摘要不陈旧、圣遗物 5 个源文件哈希正确。
- `npm run data:validate` exit 0：完整 catalog schema、快照与 payload 哈希、来源/依赖引用有效；角色/套装独立名册匹配，武器差异按 partial 范围保留。

上述数据接入阶段日志保存于 `docs/validation/data-continuation-{tests,check,validate}.log`。上述测试不证明游戏内所有帧、能量、命座、触发与特殊反应已经独立验证。
