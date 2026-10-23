# /goal 伊安珊实际队伍来源链与 Swift 索引修复

基线 `a9c7be1`；分支 `cloud/iansan-team-chain-audit-20261023`。本次没有启动模拟、Go测试、WASM或前端构建。原生修前数据由根线程运行并保存在 `/tmp/GIDPS-iansan-team-20261023/before`；本分支只读取它们并摘录带文件SHA的三份实际天赋回执。没有修改旧来源归档、独立Iansan公式、group-b向量或Golden。

## 可证明缺陷

固定 Stellar a7 的 `internal/characters/iansan/charge.go:95` 写 `swift[c.TalentLvlSkill()]`，现有完整patched缓存仍被instrumenter改写成 `SourceHostTalentLvlSkill`。TS `source-host-talent-table.ts` 按已登记的真实Skill索引查固定表，不会纠正成NA。这与固定 Optimizer 的 `Iansan/index.tsx` auto[4]、charged dmgNode→autoIndex 的实际求值链，以及上一轮独立计算器的NA绑定不一致。

根线程三个真实前测均已复现（不是本代理新运行）：

| 输入 | 修前实际Swift倍率 | 正确NA绑定倍率 | 原因 |
| --- | ---: | ---: | --- |
| NA1/E10/C0 | 1.6643 | 0.84194 | 错取E10 |
| NA10/E1/C0 | 0.84194 | 1.6643 | 错取E1 |
| 基础NA10/E10/C3 | 2.01674 | 1.6643 | SkillCon=3把E+3错误带入Swift |

旧WASM SHA为 `1aea2d170dd5a7a6977a28497f4f5937162bfc0e5b9a56b8e8bbc44e496e967c`。实际原生前测快照ATK不是2000；另一个明确ATK2000、90对90、抗性0.1、无加成/反应的独立算例，NA1/E10旧非暴1497.87，应为757.746，不能混称实际原生输出。

## Q/A1/C2/C6 来源并列

| 生产者与原生资格 | bridge／TS数值 | 当前判定 |
| --- | --- | --- |
| `burst.go:138–157` Q立即刷新，再每18角色任务帧；42点阈值；SelectStat(true,BaseATK,ATKP,ATK)排所有Extra；仅当前场上角色的Amount返回 | Stellar035补丁调用`CharacterModifierDynamicCreate`，group-b34–41算 `min(nonExtraATK×(NS<42?0.005×NS:0.27),Q等级cap)`；到期单独0回执 | 与原a7及独立active-burst-evidence一致；原两次Points getter顺序保留，未见应修数值差异 |
| `asc.go` 初始化自身20%ATKP向量；成功Swift伤害后的回调才授予/刷新900帧A1状态 | Stellar035的A1创建回执、真实Amount消费时`CharacterModifierSnapshot`；group-b32常数0.2 | 向量在初始化创建不等于状态已生效。本击新A1不能进入25f快照；之前有效A1可进入Q最近刷新及自身快照 |
| `cons.go:34–67` C2且A1已解锁：给所有其他队友注册ATKP，Iansan自身除外；Amount由Iansan A1有效状态门控；Q起手先调用自身A1授予 | Stellar035 C2常数创建与消费回执，group-b42常数0.3 | 原生资格仍负责实际生效；不是给Iansan自身再加30%，也不是只给当前站场队友 |
| `burst.go:123–126` 实际溢出时触发C6；`cons.go:110–138` 初始化25%DmgP向量，溢出当时给场上角色挂180帧AttackMod；Q时长另+180f | Stellar035 C6创建回执+实际AttackMod的Snapshot消费，group-b43常数0.25；原生`ApplyAttackMods`在伤害时执行 | 与固定来源一致；增益附在溢出当时受益角色，之后换人不把该同一mod自动搬给新角色。这里不声称已通过当前游戏实测 |

全部五条vector rule ID的原生生产/消费在 Stellar035与角色文件内。通用链为 `CharacterModifierDynamicCreate → Bridge.Resolve → resolveSourceHostRequest(character-modifier) → source-host-character-modifier-dynamic-formula/group-b`，原生存回数值；真正Amount返回才关联 `CharacterModifierSnapshot` 的creation ID。`source-host-artifact-support.ts` 校验原mod key/槽、创建阶段、来源角色、实际受益读取与帧；`source-host-formula.ts` 对Q非Extra getter进一步核对selector `[24,6,5]`、nonExtra、持有者、读取帧及计算值。数值resolver不会自动重演触发/期限。C1浮点与真实消费由另一条独立139修复负责，本次不背书该链完整正确。

Swift的倍率表读取在动作起手；进攻Snapshot和命中为相对25f。修前真实回执例是取表138f、命中163f。命中后的A1回调、动作合法性、范围及快照时点不由138改变。

## 新旧语义与整合

138只把Swift getter改为Attack，并增加三行真实纠正注释，使新读取位置成为 `charge.go:98:21`；旧95:21并未伪造或重新解释。补丁SHA256为 `cd87c0e4a78f758ec24eaf7e4f3008035cde1abc538177ded20d24d9e8270538`。数值/原源码摘要/完整15级向量在 `packages/game-data/sources/iansan-swift-native-index-correction/correction-evidence.json`，实际前测摘录在同目录 `historical-native-reads.json`。

Stellar build.mjs登记138与夜魂线139；Classic不登记。官方构建会在补丁后生成新的Attack site。根线程随后运行既有 `generate-talent-registry.mjs` 更新generated.ts；本分支没有手写生成文件。新增generator窄validator只在a7、138 patch SHA、Swift表及新98 Attack site全部精确匹配时补原95 Skill别名；拒绝数值碰巧相等、错误kind或混合工件。旧捕获继续按E getter验证历史金额，但trace明确“已知未修正”，不标游戏正确。新NA回执必须携带Attack基础天赋/被动来源和NormalCon=0；通用getter回放验证基础等级、Childe被动及下标，不得带入E/C3加级。

本地必要验证：`node --test packages/source-host/scripts/iansan-swift-talent-correction.test.mjs` **8/8**；`node node_modules/vitest/vitest.mjs run packages/sim-core/src/source-host-iansan-swift-talent-correction.test.ts --reporter=verbose` **13/13**。包含三份实际旧回执、新NA/C3/Childe来源夹具、错误/缺失kind、别名篡改、原归档/补丁哈希与临时源文件git apply精确边界。新NA回执测试明确是源契约夹具，未冒充修后原生。证据目录 `/tmp/GIDPS-iansan-team-chain-evidence-20261023`。

待根线程：一次已缓存官方Go1.27.1 Stellar构建（同时138/139）、生成registry、复用三条短轴做修后实际回执/金额验证。无须Classic构建或120秒轴。构建成本预计分钟级，尚未新测；已有三条短原生前测 native+shared formula 分别321.68/175.32/234.92ms，只是该云执行样本，不是浏览器性能或保证。
