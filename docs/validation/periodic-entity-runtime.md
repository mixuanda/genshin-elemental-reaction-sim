# 可替换周期治疗实体：真实运行时增量

日期：2026-09-24（香港）。此文只记录本增量，不能据此把久岐忍整角色、全部配装、全部反应或完整稳态标成完成。来源角色入口与唯一外部运行证据另见 `../cross-validation/action-library/kuki-source-contract.md`、`kuki-source-parameters.md`、`kuki-external-comparison.json`。固定来源为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；其快照 TODO 和低突破 A4 条件冲突继续保留。

## 实际实现

`periodic-entity.ts` 是有限的 `periodic-active-heal-v1` 实体生命周期及治疗公式模块。每个拥有者和声明 ID 只保留一个当前实例，主模拟事件队列负责真实时间；模块没有第二个模拟定时器或预先展开的全段治疗表。合法动作被接受后才排入生成事件，生成事件建立代次并安排第一次 tick；只有仍存活的 tick 才安排下一次。替换记录旧实例身份，旧实例已武装的下一次 tick 到时记为 `cancelled-tick`，没有治疗、伤害或后续 tick。旧 tick 已安排的延迟伤害仍会落地。

当前声明是 `ActionDefinition.periodicEntities` / `AbilityDefinition.periodicEntities`，具有生成帧、持续帧、首次间隔、后续间隔、命中延迟、命中模板 ID、治疗系数和明确来源。模板必须是 frame/offset 0、`snapshot: "hit"`；普通动作不会提前执行这些绑定模板。实体在末次 tick 先治疗并排入伤害，再检查是否到期；非整除时长也遵守首个到达或越过到期帧的 tick 后停止的来源策略。

治疗从反应自伤和 `healthChanges` 已使用的同一 `playerHpStateByActorId` 读取施放者最大／当前 HP，从当帧属性读取 EM；受治疗者是 tick 当下前台。共享 `TraceBuilder` 实际执行最大 HP 系数项、EM 项、固定项相加、低血阈值、条件加成及来源治疗加成，再交给既有生命治疗核心执行原始量、缺血截断、有效治疗和溢出。`playerHealthEvents.trace` 拼接完整 `periodic.*` 与 `health.*` 节点，包含变量意义、实际代入与中间结果。首次生命消耗继续是正常 `healthChanges`，没有变成敌方伤害。

周期命中的原 action/hit ID、原 hit index、来源技能和命中组身份保留。源 `FlatDmg` 的 EM 项取真实 tick 快照；普通缩放面板在 +2 帧命中时取值。实际命中仍通过原伤害核心和捕获输入进入独立计算器，未新建一套伤害算法。固定久岐忍来源入口仍限制其源契约面板，因此此通用时序实现并未消除源快照 TODO。

## 日志、随机性与重放

可选 `result.periodicEntityLog` 记录 `spawn / replace / tick / expire / cancelled-tick`，具有实例、代次、拥有者、来源 actionLog 索引、帧、事件优先级与序号、生成／到期帧；替换有旧实例 ID，tick 有真实治疗输入和 reciprocal `healthEventId`。生命事件通过 `periodicEntityLogId` 反向关联，不依赖面板推测来源。

命中产球复用原 hit-confirm、目标确认、拥有者 ICD、粒子生成和接收队列。新增当前版本 `trigger.probability`：合格回调先建立 ICD，再抽样，严格 `roll < probability`；失败仍占用 ICD。未命中、目标确认失败、ICD 内不抽样。原 `count` 只有固定数或均匀整数范围，无法表达 45% 产生一枚，因此使用既有 `SeededRandom` 的独立 `particle-trigger-v1` 子流，seed 为运行 seed 加 NUL 分隔符和流名；不改变既有粒子数量随机流。每个配置概率的日志记录 probability、roll、零基 drawIndex 与流名。输入配置 hash、原运行 seed 和日志可重放；不声称与 gcsim 全局随机调用序列同 seed 同轨迹。

schema 的独立完整性检查从配置和被接受动作重放生命周期、替换、终止、tick／命中时刻，再核验生命事件、真实 owner HP/EM、伤害追加项、粒子概率抽样与能量。其用途是结果审计，不参与模拟运行排期。声明、日志和概率字段只属于当前 1.53 wire；没有新声明时不添加实体日志或概率字段。旧版本拒绝这些新字段。

## 已执行的限定验证

只新增并运行 `packages/sim-core/src/__tests__/periodic-entity-runtime.test.ts` 的三个集成用例，没有运行全量测试、构建或大型 Monte Carlo。

1. 当 tick 与 +2 帧命中之间 EM 改变时，伤害追加项仍保留 tick 值；治疗按当时施放者 HP/EM 和当前前台计算。合成固定输入 HP10000、EM200、半血开始，首耗血 5000→3500；第114帧治疗基础550、A1加成15%，向前台 b 请求632.5；外部明确治疗使拥有者第203帧达到5100，第二个 tick 第204帧用 EM400、基础700、A1关闭。伤害帧12/116/206分别403.56/151.2/176.2，追加项50/50/100。每个实际捕获命中以原输入在计算器精确复现，全部治疗 AST 重新执行等于记录结果，JSON schema 通过并可重新运行。
2. 第115帧替换旧实体后，旧第116帧已排入伤害仍落地，第204帧旧 tick 被取消；新代次 tick 为205/295帧，295帧末 tick 后到期。114帧模拟末端保留当帧 tick 和治疗，尚未到116帧的伤害不执行。旧1.52配置不能接受新字段。
3. 同帧两个绑定命中只有第一个通过 ICD 并抽样。seed `periodic-a` 的首 roll 为0.8623988595791161，未产球但 ICD 到128帧；八次合格抽样中，生成帧296/566/656/746，共实际获得12能量。seed `periodic-b` 生成帧116/566，共6能量。失败回调和无抽样门条件透明保留；JSON结果／配置重放与篡改 roll 拒绝均通过。这是两个固定 seed 的确定性差异验证，不是概率分布估计。

首轮命令：`npx vitest run packages/sim-core/src/__tests__/periodic-entity-runtime.test.ts`。结果2通过、1失败，235ms tests / 1.05s总计。失败是测试初击手算写成428.56，正确值为 `(0.75712*1000+50)*0.5=403.56`；实际核心没有因此修改。日志 `periodic-entity-runtime-test.log/.exit` 保留。

只重跑失败用例：`npx vitest run packages/sim-core/src/__tests__/periodic-entity-runtime.test.ts -t 'reads owner HP/A1'`。结果1通过、2跳过，124ms tests / 926ms总计。日志 `periodic-entity-runtime-test-retry.log/.exit`。两次合起来覆盖最终三个用例。来源构造器的两个独立用例、浏览器流程和统一构建由对应任务单独记录，不能拿本日志替代。

## 仍然明确阻塞的范围

周期实体代次、后续任务和产球概率随机子流尚未完整导出到 phase checkpoint，因此该配置明确不能证明稳态。普通确定性 `healthChanges` 已完成的真实队列／HP checkpoint 支持保持不变。未增加周期实体的稳态证明或尾段完整性宣称。

最大 HP 固定；生命之契／HPDebt、真实死亡、未声明的 HP 依赖被动、敌人攻击、动态治疗加成体系和整角色机制尚未接入。声明支持的显式系数与当前 HP 条件不代表任意角色公式表达式引擎。上游低突破 A4 门冲突和伤害快照 TODO 仍是来源未验证机制，不能因局部命中可重放而标记 complete/verified。
