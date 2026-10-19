# 基础普攻动作缺口审计与本批映射

本次审计对照接线前实际 `sourceClassifiedMappings`、活动 7.1 天赋表与固定 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；以下十五名角色当时没有基础 N 映射。诺艾尔由独立任务处理，不纳入本批。审计先区分“明确限定状态就能计算的输入”和“输入本身还会产生未包含的追击”，不把整名角色标成不可用，也不把单次条件计算当成完整机制验证。

## 本批已补的五名角色

实现文件：`packages/game-data/src/character-mappings/base-state-attack-mappings.ts`，导出 `baseStateAttackMappings` 与 `baseStateAttackSourceEvidence`。分类入口由现有 registry 接入，不另建伤害引擎。

| 角色 | 实际新增动作 | 必要条件 | 命中数／动作数 |
| --- | --- | --- | ---: |
| 迪卢克 | N1–4；低／高下落 | C0，黎明附魔未生效，无外部附魔；下落已合法腾空、collision=0 | 6／6 |
| 雷泽 | N1–4；低／高下落 | C0、Qoff，排除狼魂协同；无附魔，下落 collision=0 | 6／6 |
| 托马 | N1–4；CA | C0、Qoff，排除炽火崩破；N3保留两次命中 | 6／5 |
| 重云 | N1–4；低／高下落 | C0、Eoff且残留冰附魔已失效，不触发C1末段三冰刃；下落 collision=0 | 6／6 |
| 雷电将军 | N1–5；CA；低／高下落 | C0、Eoff、Qoff，只取长柄武器物理分支；N4保留独立两段 | 9／8 |
| **合计** | **32 条字段映射** | **均为条件自伤动作，不认证角色完整循环** | **33／31** |

每项的元素来自明确 `AttackInfo.Element=Physical`，倍率来自固定 `attack/charge/charged/lowPlunge/highPlunge` 表，ATK 缩放来自共同伤害路径的默认 `TotalATK()`，没有依据“看起来像百分比”的天赋文案推断。雷电 N4 的两个15级向量虽然相同，仍明确保留源表 `[3,0]→param4`、`[3,1]→param5`，不按数值相同合并；托马 N3 的两次相同源发射用 `instanceCount: 2` 表达。

下落分支在固定实现中只接受 `AirborneXianyun`，因此条件说明为合法腾空已经满足、没有路径碰撞的单次落地伤害；它没有宣称角色可以原地自行下落，也不包含腾空获得方式、闲云附加伤害或队伍事件。黏附、帧、取消、体力与能量未由这些映射建立。

本批归档保存在 `packages/game-data/sources/base-state-attacks/`：32 个源文件包括动作、倍率、相关条件实现、共同伤害路径和原始 LICENSE。`manifest.json` 逐文件 SHA-256 对应 `source.json.gz` 的实际文本；压缩归档 SHA-256 为 `f433a2640ea9e1782f88ea7dd5d71fc45b7248d37f479447c9a366e0c2b19564`。原始固定仓库归档身份另保留为 `334067728781541ccd4351fbe9851f7684f4f6c2d4dab79a1c3dd1e01318fd1a`。

## 后续已实现的十名角色基础分支

这些分支已追加到 `base-state-additional-attack-mappings.ts`，导出 `additionalBaseStateAttackMappings` 和 `additionalBaseStateAttackSourceEvidence`；49条字段映射、46个条件动作、58次命中。共同固定源入口为 [gcsim b4ae769](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters)。数字字段需沿明确源表位置映射，不用同值猜测身份。

| 角色 | 已补基础动作 | 保留的条件与缺口 |
| --- | --- | --- |
| 魈 | Qoff 的 N1–6、CA；N1/N4各两段 | `xiao/attack.go`、`charge.go`、`xiao.go`：残留爆发增伤关闭。同值字段按源表位置可解，不是新状态机制阻塞；下落默认分支假定爆发开启，须单独恢复腾空来源与Q状态。 |
| 钟离 | N1–6（N5四次）；CA | `zhongli/asc.go`明确每次增加突破4时的 `0.0139×MaxHP`，现有 `fixedTerms/minimumAscension` 可表达；C0不能删除固有天赋。固定源缺下落实现。 |
| 神里绫人 | Eoff/Qoff且无附魔的N1–5、CA；N4两次 | `ayato/attack.go`、`charge.go`；瞬水剑与浪闪HP项属于另一个状态。低高下落向量齐全，但需明确合法腾空。 |
| 艾尔海森 | 零琢光镜N1–5；N3两段 | N不生成镜，零镜投影回调退出。CA/下落会先由A1生成镜，再触发投影，单写C0/零镜起始不能把它们标完整。 |
| 神里绫华 | C0、冲刺附魔失效、E后A1增伤未启用的N1–5和CA | N4三次、单目标CA三次；`charge.go`的最多五目标搜索上限不是五次命中。低高下落可限定合法腾空。 |
| 凝光 | N一次输入两枚；零星璇CA一次 | `ningguang/attack.go`、`charge.go`；穿屏A4增伤需恢复或明确未生效。N会积累星璇，不能把后续CA自动算零星璇。固定源缺下落。 |
| 烟绯 | N1–3，各一次 | 完整CA还需丹火印倍率/A1增伤，以及主击暴击后A4追加 `0.8×ATK` 火伤；期望暴击模式不能只计主击。低高下落可作明确条件分支。 |
| 芙宁娜 | C0、E召唤物未生效、Qoff的物理CA一次 | N在始基力就绪时还有 `param10×ATK` 水伤；只有明确其6秒冷却未结束时，纯物理N才是完整条件输入。CA后的始基力切换不等于团队状态已模拟。 |
| 嘉明 | 无附魔的N1–4，各一次 | 固定源缺CA实现。低高下落需合法腾空，且前一动作不是E，不能混用踏云献瑞。 |
| 荒泷一斗 | Qoff的N1–4；零乱神怪力CA一次 | 零层左一文字不加A4 DEF项；N2/N4会生成层数，后续CA不能自动保持零层。有层CA另需连斩/终结分支与突破4 `0.35×DEF`。 |

这十名46个N/CA条件动作、58次命中均已实现；前两批合计77个条件动作、91次命中。上表记录第二批边界；第三批新增的下落与状态分支见下节。迪卢克、雷泽、重云的蓄力CA以及托马下落在本批固定源没有所需对应动作实现，未从活动参数表单独猜出动作结构。

## 第三批：剩余下落与冷却条件动作

实现文件为 `packages/game-data/src/character-mappings/conditioned-basic-action-mappings.ts`，导出 `conditionedBasicActionMappings` 和 `conditionedBasicActionSourceEvidence`。本批 **30条字段映射／25个条件动作／30次命中**，均为前两批之外的新输入。分类 registry 已接入并升级为 `reviewed-hits.10`；条件支持不改变独立验证状态。三批累计 **102个条件动作／121次命中**，不包含其他任务的一斗有层重击或诺艾尔。

| 角色 | 本批动作／命中 | 完整条件与固定源码分支 |
| --- | ---: | --- |
| 神里绫人 | 低／高下落，2／2 | `plunge.go` 在 E状态中明确拒绝下落；Eoff、无残留水影爆炸、Qoff、无外部附魔，走 `AirborneXianyun` 分支。 |
| 神里绫华 | 低／高下落，2／2 | 冲刺冰附魔已失效、无外部附魔；物理落地不加入A1仅普攻/重击增伤或A4仅冰伤增益。 |
| 烟绯 | 低／高下落，2／2 | 明确火元素ATK落地；A1若已生效须恢复实际最终火伤加成。下落不消耗丹火印，也不触发A4暴击重击追击。 |
| 嘉明 | 普通低／高下落，2／2 | Qoff、上一动作不是E、无外部附魔和未结算猊兽；进入物理普通分支，不套用踏云献瑞的火伤或A4增伤。 |
| 魈 | Qoff低／高下落，2／2 | `JumpState`且`XianyunAirborneBuff`有效；明确选择XY分支，不借用默认假定Q开启的分支。Q附魔、Q增伤及A1残留增伤均关闭。 |
| 荒泷一斗 | Qoff低／高下落，2／2 | Q状态、岩附魔与DEF转ATK均关闭；下落不是逆袈裟，不加A4的35% DEF。 |
| 芙宁娜 | 低／高下落，2／2；N1–4两个始基力分支，8／12 | C0、E召唤物未生效、Qoff；下落不挂`arkheCB`。N冷却分支要求**当前始基力的独立冷却在命中回调时仍有效**；就绪分支保留物理主击和30帧后的一次水伤，两次均命中同一目标且期间不切始基力。 |
| 艾尔海森 | 零镜低／高下落，2／2；零镜双段CA，1／2 | 整动作零镜且A1冷却覆盖每次命中，`Core.Status.Duration(a1IcdKey)>0`先返回，之后投影回调因零镜返回；低空前动作不是hold E。不把起始零镜当充分条件。 |

全部下落限定 `collision=0`，只包含合法腾空后的单次落地。除了魈的明确Jump/XY分支，其余为 `AirborneXianyun`。这些例子中闲云等外部下落追加基础伤害与协同事件未生效；若实际启用，必须恢复单独加项，不能把它们藏进最终ATK。该映射没有认证腾空来源、碰撞路径或队伍状态机。

芙宁娜始基力水伤保留源码 `Durability=0`、`IgnoreInfusion=true` 的限制：不造成常规水附着，不允许继承普通水伤的反应资格，其独立命中的反应为none。就绪分支没有漏掉必发追击；冷却分支是明确的无追击状态。两者均要求没有先前已排队的始基力事件、目标处于所有命中范围内、起手到最后命中的面板与目标条件固定。

本批来源归档为 `packages/game-data/sources/conditioned-basic-actions/`，包含52个固定源码文件和LICENSE及逐文件SHA-256；gzip SHA-256为 `97c4bc86246b974ab8de373bf743b55dbddebff3aa94090d1cf56e42cd4c99ff`。所有倍率来自固定表的明确索引，再核对活动天赋字段的全部15级向量；没有从缺少动作实现的参数值猜测发射结构。

剩余边界：烟绯CA已由后续独立条件适配补入丹火印/A1与条件A4整次结算（见[专门记录](../validation/yanfei-charged-calculator.md)），完整产印、Q状态时间线与多目标竞争仍缺；海森有镜、A1就绪或hold E后的草下落不能使用这里的零镜冷却分支；嘉明技能火下落与猊兽、芙宁娜C6、魈Q状态也不能套用本批C0/Qoff定义。固定源缺少的钟离/凝光下落、嘉明CA及前述蓄力动作仍未补造。

## 各批仅新增定向验证

只执行一次新增测试文件 `base-state-attack-mappings.test.ts`：**1 个测试通过，895 ms**，测试体6 ms。校验32个源文件哈希、32组／480个固定倍率值与活动天赋向量一致，检查31动作／33次命中、托马N3与雷电N4分解，以及C0/Eoff/Qoff和下落无碰撞条件。日志见 `docs/validation/base-state-attack-mappings.log`。

本批没有运行 build、status 或旧测试全集，没有把通过来源校验标为 verified。


后续批归档：`packages/game-data/sources/additional-base-state-attacks/`，60个源文件及逐文件哈希；gzip SHA-256 为 `072b07ffa70064d914085045dbeabc80ff73d13290d4d9cb0c549c89d4706a56`。钟离的7个动作均逐命中携带 `fixedTerms: hp × 0.0139, minimumAscension: 4`，N5四次分别加入，不把四段合并或只加一次。玉璋护盾减抗条件另行明确，不混进生命缩放项。

一斗零层CA还明确处于默认／左一文字／终结后的基础起始分支，不在左／右逆袈裟连斩；起手到命中期间面板、增伤与目标条件保持不变，因此不依赖上游仍标TODO的快照时点。凝光零星璇、艾尔海森全过程零镜、烟绯仅N（不擅自补暴击CA追击）均保留为真实动作条件。

第二批只执行一次 `npx vitest run packages/game-data/src/character-mappings/base-state-additional-attack-mappings.test.ts`：**1 个测试通过，1.14 s**，测试体32 ms。校验60个源文件哈希、49组／735个固定倍率值与活动天赋向量一致、46动作／58次命中及上述状态条件。测试同时通过真实单技能文档与共同计算核心计算钟离N5：ATK=2000、MaxHP=20000、天赋1、双方90级、物理抗性10%、非暴击时，突破4的四段合计 **887.4**，突破3合计 **387**；突破等级缺失时明确阻塞。日志见 `docs/validation/base-state-additional-attack-mappings.log`。未重复第一批测试，也未执行 build、status 或旧测试全集。

第三批仅首次执行 `npx vitest run packages/game-data/src/character-mappings/conditioned-basic-action-mappings.test.ts`：**1个测试通过，1.15 s**，测试体26 ms。校验52个源文件哈希、30组／450个倍率值、25动作全部经真实分类入口转为完整条件文档，以及海森A1/投影回调的提前返回与芙宁娜始基力双分支。芙宁娜N1、天赋1、ATK=2000、双方90级、抗性10%、无增伤/反应的非暴击总伤：冷却中 **435.4758**；就绪并计入水追击 **520.6158**。日志见 `docs/validation/conditioned-basic-action-mappings.log`。没有运行 build、status、check 或旧测试全集。
