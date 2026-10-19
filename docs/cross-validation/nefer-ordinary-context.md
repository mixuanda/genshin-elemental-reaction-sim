# 奈芙尔普通 E／Q 的 C0–C6 条件计算

本批完成普通 E 突进与 Q 两段的高命座来源条件，修正此前 E 误用帷幕倍率的问题。新映射版本为 `gcsim-b4ae769+a7dc4bf+optimizer-180a0a1-reviewed-hits.7+durin.8`。没有新增虚构月绽放实体、没有增加角色或命中数；E 突进改为部分动作，避免用未知的施放状态先后宣称完整技能执行。Q 两段仍是条件明确的所选普通伤害组成，不代表种子、帷幕、影舞与反应的自动时间线。

所有数值仍为 `provisional`。证据取自固定 Optimizer `180a0a1015cb725c7570cd828eb086749960df98`，四份文件已保存 SHA-256、字节数、Git blob 与重新获取时间，七组天赋向量的105个数值与活动目录精确相等。生产代码与本地化属于同一个仓库，不能算两个独立来源。完整 C0–C6 审阅见[来源审阅报告](../research/nefer-ordinary-source-review.md)，机器证据为 `packages/game-data/src/character-mappings/nefer-ordinary-source.ts`。

## E 适用范围的实际纠正

固定 [sheet 的 E 节点](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L225-L230) 将幻戏帷幕乘区传入初始突进；但 [tooltip 11220003](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/tooltips_gen.json#L243-L247) 明确限定每层8%增幅只作用于幻戏。相邻 tooltip 11220002 将幻戏定义为影舞中的替代重击，不是 E 初击。

据此删除普通 E 的 `nefer-a1-veil` 附加表达式，保留明确的 `ATK×E.param1 + EM×E.param2`。来源内部冲突进入当前命中说明与取证记录；没有将有问题的生产 sheet 当作无争议游戏事实，也没有为了旧测试继续保留错误乘区。

同一输入为 E 有效等级10、ATK2000、实际EM100、额外固定基伤500、旧输入帷幕3、双方等级90、敌人抗性10%：

- 原错误结果：`[(1.374912×2000 + 2.749824×100)×1.24 + 500]×0.5×0.9 = 1912.8419712`。
- 纠正结果：`[1.374912×2000 + 2.749824×100 + 500]×0.5×0.9 = 1586.16288`。

先前声称 E 使用独立帷幕倍率的历史报告和测试预期不再代表当前实现；相关既有测试已改为明确排除该倍率。

## 实际执行的高命座条件

|条件|当前执行与边界|
|---|---|
|C0/C1满层精通|突破≥1、月兆人数≥2、实际8秒增益仍有效时为100 EM。|
|C2–C6满层精通|同样条件下为200 EM，替代100，不是100+200。`neferFullVeilEmBuffActive` 独立于当前或本次消耗帷幕；Q消耗后仍可有效。|
|Q消耗帷幕|C0/C1允许0–3整数，C2–C6允许0–5整数；每段增伤为实际消耗数×当前有效Q等级的param5。没有从C2“施E获得2层”自动创建本次快照。|
|C4减草抗|`neferC4TargetDebuffActive=1` 时减抗0.20；表示本段目标确实仍受影响，包含退出影舞或离远后4.5秒残留，不从选择E或当前在场推断。|
|C3/C5|E/Q使用明确的有效天赋等级；等级加成不再加一次，Q基础倍率和每层增伤都随该等级读取。|
|C1/C6|已审阅的额外伤害只属于幻戏/月绽放节点，未被并入普通 E 或 Q 第二段。|

共享核心新增 `elementalMasteryAdjustment:{formula,accounting}`。选择 `add-to-panel` 表示输入面板未含这项精通，本段执行来源公式并将结果送入基础缩放、被动公式和精通相关反应；选择 `already-in-final-panel` 则展示来源公式和“不重复计入”的审计，保留实际最终面板值。默认后者，不根据角色命座猜测面板是否已含增益。不同命中可有不同明确状态，最终面板转换保留逐段调整而不错误压成全技能统一精通。

每个来源分支带命座范围：100 EM/三层分支最高C1，200 EM/五层分支最低C2，C4减抗最低C4。直接把高命座 JSON 的角色上下文改成低命座会阻塞，不能沿用更高命座的公式。界面或导入的正常命座切换通过 adapter 重建正确分支，并保留已明确输入的状态，不偷偷裁剪资源层数。

重新导入展示柜最终面板时，`applyImportedCalculatorPanel` 将旧草稿的额外精通策略重置为 `already-in-final-panel`，避免把已导入的最终精通再次加200；公式与明确状态仍可审计，用户之后可主动选择其他计入方式。

## 执行验证

本批没有运行全量测试、构建、E2E 或全局覆盖生成。只执行新行为必需的测试：

|命令|实际结果|
|---|---|
|`npx vitest run packages/game-data/src/character-mappings/nefer-ordinary-context.test.ts`（首次四项）|4/4通过，1.14 s；日志 `docs/validation/nefer-ordinary-context.log`。|
|`npx vitest run packages/game-data/src/character-mappings/nefer-ordinary-context.test.ts -t 'imported final panel'`（之后新增的导入行为）|1/1通过，之前4项跳过，1.11 s；日志 `docs/validation/nefer-import-accounting.log`。|

有效Q等级10、ATK2000、原面板EM100、月兆2、双方等级90、基础抗性10%的非暴击实测：

|情境|伤害|
|---|---:|
|C2，消耗5层，独立200 EM增益有效并加入|35481.888|
|C2，消耗仍为5层，精通增益已失效|30023.136|
|C2，消耗0层，200 EM增益仍有效|11827.296|
|C4，5层、200 EM有效，目标减抗有效|41395.536|
|C6，改用明确有效Q等级13，其他同C4|56200.1895|

另确认：E来源冲突的旧/新数值；已锁A1不加精通、未知突破阻塞；低命座不接受五层；高命座来源公式与错误低命座上下文阻塞；两个Q命中可分别使用EM100和EM300；最终面板转换及JSON回放总量精确相等；导入EM300的最终面板与原面板EM100另加200的结果相等；C6没有增加任何普通动作之外的实体。

既有 `optimizer-source-formulas`、`optimizer-skill-mappings`、`optimizer-constellation-scope` 测试因E来源纠正或C2/C4能力增加而同步调整预期。本批没有重复执行这些旧文件，不将它们报告为本批新通过。

## 保留的真实缺口

没有证明同次 E 中的 C2 加层、进入影舞、C4减抗与初击的先后；没有自动跟踪8秒精通与4.5秒减抗残留的到期；没有自动演算种子吸收、帷幕刷新和两段Q的事件快照。当前计算明确要求命中时的实际上下文，E保持部分动作。幻戏普通重击、虚影月绽放、C1/C6专属实体、完整轮转与能量仍不因本次普通命中接入而获得完成标记。
