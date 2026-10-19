# 洛恩资源与莉奈娅减抗的来源上下文增量

后续：本报告末尾列出的奈芙尔普通 E/Q 高命座条件已由[下一批增量](nefer-ordinary-context.md)落实；该批同时纠正初始 E 的帷幕乘区适用范围。下文保留当时执行结果。

本批新增三个条件动作、九个实际伤害实例：洛恩一次镂骨彻心、洛恩爆发六斩、露米普通双击一组。沿用固定 Optimizer 提交 `180a0a1015cb725c7570cd828eb086749960df98`；不改旧 gcsim 来源身份，不将静态伤害公式升级为完整角色时序认证。新映射版本为 `gcsim-b4ae769+a7dc4bf+optimizer-180a0a1-reviewed-hits.6+durin.8`，结果仍为 `provisional`。

本批相对于上一批实测120身份／667命中，新增0身份／9命中／1完整条件动作／2部分动作。主任务随后统一执行 `data:status` 和 `data:check`，当前生成数据为120身份、676命中、407完整条件动作、145部分动作、18条具体阻塞；已有来源字段阻塞没有删除。来源专题测试自身没有另跑全局生成器。

## 真正执行的公式

洛恩的 [固定生产表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Lohen/index.tsx) 与 [天赋参数](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Lohen/skillParam.json) 支持天赋基础伤害 `B = ATK × 天赋倍率`，资源分支增加 `B × 每点倍率 × 本次实际消耗争胜`。每点倍率从 E.param18 / Q.param2 的完整十五级向量核对后读取，当前均为 0.004；它不放大外部固定附加伤害。E.param17 的单次伤害为部分动作，Q.param1 按来源明确的六次斩击建立完整条件动作。

`willConsumed` 是显式输入。开放值 `[20,40,60,80,100]` 来自固定生产界面的 `range(20,100,20)`；已检查同提交的数组工具包含终点。该域仅表示此次审阅过的来源界面情境，**不证明游戏资源只能按 20 递增或不能取其他值**。来源 lookup 的空值回退不证明真实消耗动作可以用零资源完成。默认 20 明确为可编辑教学输入，实际 E 有效等级须包含生效时的乘兴等级加成，最终 ATK 须恢复实际 A4 状态；本批没有自动推断这两个状态。

莉奈娅的 [固定生产表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Linnea/index.tsx#L127-L140) 明确 A1 在突破≥1、露米在场且目标位于附近时降低岩抗：月兆人数<2为 0.15，≥2为总量 0.30。共享 AST 计算 `露米在场 × 目标附近 × (月兆人数<2 ? 0.15 : 0.30)`，再与其他明确减抗合计。露米在场、目标附近、月兆人数分别为可编辑条件，不从选中技能这一动作自动推断。

Pummeler 的两段证据是生产表同一伤害参数的 `// x2` 与来源机器天赋编码中同一 DEF 倍率的 `×2`，不是把 Pummeler 和 Hammer 凑成双击。十五级完整向量与活动目录 E.param1 精确相等。普通双击不包含月结晶 Hammer / Crush，也不以持续 25 秒猜测攻击轮数。

`resistanceReductionFormula` 进入共享 schema、依赖检查和结构化 trace，逐步记录变量、实际代入与结果。显式 `effectiveResistance` 为已结算最终抗性时，原来源表达式保留为 `not-applicable` 审计，避免再次扣抗。最终面板转换与 JSON 回放保存这一语义。离散 `allowedValues` 也进入 schema；修改 JSON 不能绕过来源值域。

来源字节、SHA-256、固定 URL、检索时间、字段坐标与常数出处分别保存在 `optimizerResourceSourceEvidence` 和 `optimizerLinneaSourceEvidence`。下载源码只作为静态证据读取，没有执行外部 TypeScript。

## 执行验证

只执行新增行为必要的定向检查，没有运行全量单测、全量类型检查、构建或全局覆盖生成。

|检查|实际结果|
|---|---|
|`optimizer-resource-mappings.test.ts`|5/5 通过，853 ms；来源数值、六斩组成、离散域来源及固定证据。|
|`optimizer-linnea-mappings.test.ts`|4/4 通过，851 ms；十五级数值、双击证据、A1常数和普通/月反应边界。|
|`npx vitest run packages/game-data/src/character-mappings/optimizer-resource-and-resistance.test.ts`|2/2 通过，1.07 s；日志 `docs/validation/optimizer-resource-and-resistance.log`。|

集成测试使用有效天赋 10、ATK=2000、DEF=800、双方等级90、敌人基础抗性10%、无普通增伤，检查非暴击伤害：

|情境|实测伤害|
|---|---:|
|洛恩 E，消耗20，另有固定附加基伤500|1274.76|
|洛恩 E，消耗100，另有固定附加基伤500|1585.8|
|洛恩 Q，消耗100，六斩总和|16166.304|
|露米双击，月兆人数1，A1生效|1416.96|
|露米双击，月兆人数2，A1生效|1520.64|
|露米双击，目标在范围外或A1未解锁|1244.16|

同时确认：洛恩资源0/21的导入被拒绝；C1超出本分支已审范围时阻塞；莉奈娅缺少突破阶段时阻塞；最终面板导出后总伤害精确相等，A1来源仍在且不重复减抗。既有 adapter 测试的文档总数断言已由156同步为162，但没有将这次未重复执行的整批测试报告为新通过。

## 奈芙尔 C1 普通命中的作用域修复

随后发现资源公式已允许 C0/C1，但 UI/导入共用的 `applyCharacterConstellationScope` 仍把普通 E/Q 的 C1 标记为缺少命座依赖。现按固定生产源码[第195–199行的C1节点](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L195-L199)及[第221–300行的伤害节点](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L221-L300)，只为已分类的普通 E 突进和 Q 两段放行 C1。C1 额外倍率被送入幻戏的月绽放节点，不进入这两个动作的普通 ATK+EM 表达式，因此不新增特殊实体，也不改变其帷幕、增伤、暴击或抗性计算。

`npx vitest run packages/game-data/src/character-mappings/optimizer-constellation-scope.test.ts` 唯一针对用例 **1/1通过，1.16 s**，记录在 `docs/validation/optimizer-constellation-scope.log`。它使用满三层、月兆2、EM100，确认两个动作的 C1 与 C0 总量精确相等、实例仍分别为1和2、来源审计保留，C2/C4仍由具体资源/命座依赖阻塞。没有增加未知命座的通用放行规则。

莉奈娅静态测试另将四处数组首项读取改为明确存在检查及类型收窄，修复 `noUncheckedIndexedAccess` 报错，未改变生产类型、数值断言或重复执行既有已绿测试。

## 尚未完成的明确依赖

- 洛恩：争胜实际获得/消耗事件、乘兴自动技能等级变化、A4属性状态、奇谋整段循环，以及更高命座。当前支持已完整恢复上述命中上下文后的所选 E/Q，不代表自动轮转。
- 莉奈娅：露米持续时间内的攻击间隔、总轮数、喂食/形态转换；Hammer / Crush 的月结晶实体及高命座。露米普通双击保持部分动作。
- 叶洛亚 Q：固定静态表给出 Song 开启时 `EM×[Q.param3+A4人数项]`，但未证明本次 Q 初击与新施加 Song 的先后关系。没有据此产生默认确定总伤；既有 Song 关闭 E 条件命中继续可用。
- 奈芙尔：C2 开放第四、第五层帷幕并改变满层 EM 条件，固定源码仍使用相同每层倍率；C4 引入显式影舞减草抗，C6另有月绽放节点。当前 C0/C1 公式不据此放行更高命座；特殊实体归属及相应条件仍需独立实现。
- 未映射的奇偶男女、沃雅妮莎、薇斯纳没有用别的角色数据填充；本批没有发现新的固定生产实现，前次固定源码树检查的缺口仍保留。这不是对所有潜在外部来源永久不存在的断言。
