import {
  calculateConditionedSpecial,
  conditionedSpecialCalculationSchema,
  SPECIAL_FORMULA_RULES,
  SPECIAL_BRANCHES,
  type ConditionedSpecialCalculation,
  type ConditionedSpecialResult,
  type SpecialOutcome,
} from "@genshin-dps-lab/reaction-formulas";
import { TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

export const SPECIAL_TRACE_TEXT_ZH: Record<string, string> = {
  "专属反应加成合计.explain": "将不含本套装条款的手动追加反应加成，与刚计算的圣遗物月曜加成相加；两者随后与精通增幅相加，不再作为独立乘区。",
  "special.input.manualReactionBonus": "除下列圣遗物条款外的其他明确月曜反应加成",
  "special.input.derivedBonus": "由星辉圣遗物窗口公式重新计算并核验的反应加成",
  "special.input.scarletEligible": "本贡献者是否为血红之证佩戴者且本段属于星扩散：1是，0否",
  "special.input.scarletWindow": "血红之证在本段快照帧是否尚未到期：1是，0否",
  "special.input.heartWindow": "最后刷新的一份炉火融炼之心团队加成是否尚未到期：1是，0否",
  "special.input.scarletBonus": "资格和窗口判定后，本贡献者实际获得的血红之证反应加成",
  "special.input.heartBonus": "窗口判定后，本贡献者实际获得的一份炉火融炼之心团队反应加成",
  "星辉圣遗物反应加成核验.explain": "将保存的反应加成与本次窗口公式的合计核对，再用该合计参与伤害公式；不会把保存值重复相加。",
  "stellarArtifact.input.eligible": "本贡献者是否为血红之证佩戴者且本段属于星扩散：1是，0否",
  "stellarArtifact.input.snapshotFrame": "本段贡献者实际取样帧",
  "stellarArtifact.input.expiryFrame": "来源增益的到期帧；到期帧读取时已失效，0表示没有有效窗口",
  "stellarArtifact.input.scarletEligible": "血红之证的佩戴者和反应类别资格：1成立，0不成立",
  "stellarArtifact.input.scarletWindow": "血红之证窗口判定结果：1有效，0失效",
  "stellarArtifact.input.heartWindow": "炉火融炼之心最后一份团队窗口判定结果：1有效，0失效",
  "stellarArtifact.input.scarletBonus": "资格与窗口判定后实际应用的血红之证反应加成",
  "stellarArtifact.input.heartBonus": "窗口判定后实际应用的一份炉火融炼之心团队反应加成",
  "special.input.artifactReactionBonus": "上一步得到的本参与者圣遗物月曜反应加成",
  "special.input.moonlightReactionBonus": "穹境和纺月团队窗口在本次贡献者取样帧计算出的月曜反应加成",
  "special.input.nightWindow": "穹境同名暴击状态在该接收者上是否仍可由 StatModIsActive 读到：1是，0否",
  "special.input.silkenWindow": "纺月同名元素精通状态在该接收者上是否仍可由 StatModIsActive 读到：1是，0否",
  "special.input.nightAny": "穹境全队至少一个同名状态存在，多个佩戴者不叠加",
  "special.input.silkenAny": "纺月全队至少一个同名状态存在，多个佩戴者不叠加",
  "special.input.nightBonus": "穹境全队月曜反应10%加成，本次实际读取值",
  "special.input.silkenBonus": "纺月全队月曜反应10%加成，本次实际读取值",
  "special.input.snapshotFrame": "本段贡献者实际属性和反应加成取样帧",
  "special.input.expiryFrame": "固定来源记录的到期帧；比较方式及读取前清理由本条款的窗口公式说明",
  "special.input.sourceBonus": "固定来源的本分支反应加成比例",
  "special.input.sourcePerStack": "固定来源每层相对基础奖励的提升比例",
  "special.input.sourceBaseBonus": "固定来源的常驻基础奖励比例",
  "special.input.sourceFullGleamBonus": "固定来源的满辉追加奖励比例",
  "special.input.stacks": "本次读取时实际有效的乐园层数（0至4）",
  "special.input.stackMultiplier": "上一步按有效层数计算的奖励倍率",
  "special.input.offField": "本次读取时是否在后台：1是，0否",
  "special.input.returnGraceActive": "本次读取时实际换入后的残留是否有效：1是，0否",
  "special.input.eligible": "本分支或窗口是否满足来源条件：1是，0否",
  "special.input.moonsignLevel": "来源初始化时明确的月兆等级（0至2）",
  "special.input.fullGleam": "初始化月兆是否达到满辉：1是，0否",
  "special.input.tierBonus": "上一步根据初始化月兆计算的奖励比例",
  "special.columbinaMoonsign": "哥伦比娅固有月兆基础提升",
  "special.columbinaMoonsign.explain": "按本次命中时哥伦比娅的最大生命值，每 1000 点提供 0.2% 月反应基础伤害提升，上限 7%；不固定三段共用同一生命值。",
  "special.baseBonusTotal": "基础提升来源合计",
  "special.baseBonusTotal.explain": "将明确输入的其他基础提升与来源规则计算出的提升相加；自动 Moondew Cleanse 配置中其他提升为 0。",
  "special.input.HP": "此命中时提供月兆被动的哥伦比娅最大生命值",
  "special.input.manualBonus": "未由列出的被动规则计算的其他基础提升",
  "special.input.derived0": "上一步按月兆规则得到的基础提升",
  "special.resistance": "特殊反应抗性分支",
  "special.resistance.explain": "使用对应伤害元素的有效抗性：负抗性只折半计入增幅，0% 至 75% 为线性段，75% 起使用倒数段；此类公式不读取敌人防御。",
  "special.directBase": "直接能力：面板与天赋系数",
  "special.directBase.explain": "直接特殊反应伤害使用明确输入的面板属性 × 天赋系数，不能替换为角色等级反应基数。该面板是最终属性，不再次加算装备。",
  "special.levelBase": "反应贡献：明确等级基数",
  "special.levelBase.explain": "此项为该参与者等级的明确输入。保留原始来源与证据状态，不作插值，也不默认为当前版本已经验证。",
  "special.em": "特殊反应精通增幅",
  "special.em.explain": "本来源版本使用 6 × 元素精通 ÷ (元素精通 + 2000)；普通剧变或增幅反应的精通公式不能代替它。",
  "special.scaled": "分支系数与专属基础提升",
  "special.scaled.explain": "将此分支来源规定的系数乘以基础伤害及 (1 + 专属基础提升)。星导的系数由明确给出的极星领域计数决定；此处不模拟计数产生过程。",
  "special.augmented": "反应专属增幅与加算",
  "special.augmented.explain": "精通增幅与专属反应加成先相加，再乘基础部分；仅明确适用的特殊反应加算伤害在该乘积之后加入。普通增伤、普通加算伤害及敌人防御不适用。",
  "special.critical": "参与者独立暴击",
  "special.critical.explain": "对这个参与者、本次穷举或采样结果单独应用暴击倍率；critical 为 0 或 1。必须在贡献排序之前执行，不能在最终加权总和后套一个共享暴击。",
  "special.sampledCritical": "实际随机数与贡献者暴击率比较",
  "special.sampledCritical.explain": "读取本次事件中此贡献者的实际随机数，按固定来源比较 roll ≤ 原始 CR：成立为 1，否则为 0。每个合格贡献者均记录抽样，包含 CR 为 0 或 1；不改写面板。此命名流仅保证本地复现，不等同外部共享随机序列；解析期望仍使用限制至 0–1 的概率。",
  "special.contribution": "本次结果的参与者完整贡献",
  "special.contribution.explain": "用该参与者增幅后伤害乘自己的暴击倍率、有效抗性倍率和明确适用的擢升倍率。此结果才进入排名；数值计算归属、触发归属与 UI 暴击标记并非同一概念。",
  "special.weighted": "按实际贡献排序后加权",
  "special.weighted.explain": "反应贡献由大到小使用 0.6、0.3、0.05、0.05；缺席者视为没有贡献，不重新归一化。直接能力只有一个所有者，权重为 1。相同贡献以 ID 稳定排列，仅用于确定性输出。",
  "special.outcome": "本次独立暴击结果总伤害",
  "special.outcome.explain": "加总此暴击组合中各排名的加权贡献。结果在这个组合内精确，并不是先平均面板或平均伤害再排名。",
  "special.probability": "独立暴击组合概率",
  "special.critChance": "原始暴击率对应的实际概率",
  "special.critChance.explain": "原始暴击率保留在输入快照；概率限制在 0 至 1。这与固定来源逐次随机数判定等价，不因选择全暴击或非暴击显示模式而篡改面板。",
  "special.probability.explain": "每位参与者的本次暴击概率或未暴击概率相乘。这里明确假设独立暴击，不包含暴击触发状态变化。",
  "special.expectedTerm": "本次结果对期望的贡献",
  "special.expectedTerm.explain": "将该暴击组合的完整伤害乘其发生概率；不在排名之前平均。",
  "special.expected": "穷举后的精确期望伤害",
  "special.expected.explain": "至多四名参与者有至多 16 种独立暴击组合。先逐个组合计算与排序，再将各概率加权伤害求和；这避免非线性排序导致的期望偏差。",
  "special.input.RES": "对应伤害元素的有效抗性（比例）",
  "special.input.stat": "明确输入的最终缩放属性；不重建装备",
  "special.input.talent": "明确输入的天赋系数（比例）",
  "special.input.levelBase": "该等级的明确反应基础值",
  "special.input.EM": "该参与者元素精通",
  "special.input.coefficient": "此来源版本与分支的伤害系数",
  "special.input.base": "上一步直接属性基础或等级反应基础",
  "special.input.specialBaseBonus": "仅适用于本特殊反应的基础提升（比例）",
  "special.input.scaled": "分支系数与专属基础提升后的伤害",
  "special.input.EMBonus": "由精通公式得到的反应增幅",
  "special.input.reactionBonus": "明确适用于本特殊反应的反应加成（比例）",
  "special.input.specialAdditive": "明确适用于本特殊反应的加算伤害",
  "special.input.critical": "本暴击组合中该参与者是否暴击：0 否，1 是",
  "special.input.critDamage": "该参与者适用的暴击伤害（比例）",
  "special.input.augmented": "加算完成、尚未暴击的中间伤害",
  "special.input.critMultiplier": "本参与者在该结果中的暴击倍率",
  "special.input.resistance": "适用抗性分支的倍率",
  "special.input.elevationMultiplier": "专属擢升总倍率，1 表示无提升；不是百分比",
  "special.input.contribution": "在当前组合完成暴击及抗性后的实际贡献",
  "special.input.weight": "排序权重；直接能力固定为 1",
  "special.input.probability": "此独立暴击组合的概率",
  "special.input.damage": "此暴击组合完成排序后的伤害",
  "special.input.CR": "该参与者未改写的原始适用暴击率",
  "special.input.critChance": "原始暴击率限制至 0 至 1 后的概率",
  "special.input.roll": "此事件、此贡献者在命名随机流中实际取得的随机数，范围为 [0,1)",
};

export interface SpecialCalculatorHitResult {
  id: string; label: string; status: "calculated" | "blocked" | "non-damaging";
  nonCritical?: number; critical?: number; expected?: number;
  sampled?: SpecialOutcome;
  trace: CalculationTraceNode[]; blockers: string[]; warnings: string[];
  specialResult: ConditionedSpecialResult;
}

function unitFor(key: string): string {
  if (key === "EM" || key === "stat" || key === "HP") return "stat";
  if (["critical", "offField", "returnGraceActive", "eligible", "fullGleam", "scarletEligible", "scarletWindow", "heartWindow", "nightAny", "silkenAny"].includes(key) || /^nightWindow\d|^silkenWindow\d/.test(key)) return "indicator";
  if (key === "snapshotFrame" || key === "expiryFrame") return "frame";
  if (key === "stacks" || key === "moonsignLevel") return "count";
  if (["base", "scaled", "specialAdditive", "augmented", "contribution", "damage", "levelBase"].includes(key) || /^rank\d|^outcome\d/.test(key)) return "damage";
  if (/^p\d/.test(key) || key === "probability" || key === "roll") return "probability";
  return "ratio";
}

function originFor(key: string, ruleId: string, stateResolved = false): string {
  if (key === "coefficient" || key === "weight") return `pinned-formula:${ruleId}`;
  if (key.startsWith("source")) return "pinned-artifact-formula:b4ae769";
  if (["base", "scaled", "augmented", "contribution", "damage", "EMBonus", "critMultiplier", "resistance", "probability", "critChance", "artifactReactionBonus", "moonlightReactionBonus", "nightAny", "silkenAny", "nightBonus", "silkenBonus", "stackMultiplier", "tierBonus", "fullGleam", "scarletEligible", "scarletWindow", "heartWindow", "scarletBonus", "heartBonus", "derivedBonus"].includes(key) || /^rank\d|^outcome\d|^p\d|^nightWindow\d|^silkenWindow\d/.test(key)) return "calculation-intermediate";
  if (key === "critical") return "enumerated-critical-outcome";
  return stateResolved ? "state-resolved-snapshot" : "explicit-conditioned-input";
}

/** The trace builder executes every expression used by the special kernel. */
export function calculateSpecialCalculatorHit(context: ConditionedSpecialCalculation, id = "special-hit", label = "条件特殊反应"): SpecialCalculatorHitResult {
  context = conditionedSpecialCalculationSchema.parse(context);
  const trace = new TraceBuilder();
  const rule = SPECIAL_FORMULA_RULES[SPECIAL_BRANCHES[context.branch].family];
  const result = calculateConditionedSpecial(context, stage => trace.add(
    `${id}.${stage.id}`, stage.titleKey, stage.expression,
    Object.entries(stage.values).map(([key, value]) => {
      const sampled = context.criticalExecution;
      const input = traceInput(
        key, value, unitFor(key), key === "roll" ? "seeded-special-contributor-critical-draw"
          : key === "critical" && stage.id.startsWith("sampled.") ? "sampled-critical-outcome"
          : originFor(key, rule.id, context.context.mode === "state-resolved"),
        /^rank\d/.test(key) ? "special.weighted" : /^outcome\d/.test(key) ? "special.expectedTerm" : /^p\d/.test(key) ? "special.probability" : /^nightWindow\d/.test(key) ? "special.input.nightWindow" : /^silkenWindow\d/.test(key) ? "special.input.silkenWindow" : `special.input.${key}`,
      );
      if (key === "roll" && sampled !== undefined) {
        const draw = sampled.draws[Number(stage.id.split(".")[1])]!;
        input.context = { seed: sampled.seed, rngStream: sampled.rngStream, rngAlgorithm: sampled.rngAlgorithm,
          eventId: sampled.eventId, frame: sampled.frame, comparison: sampled.comparison, contributorId: draw.contributorId, drawIndex: draw.drawIndex };
      }
      return input;
    }),
    { ruleId: rule.id, explanationKey: stage.explanationKey, unit: stage.unit, status: context.context.mode === "state-resolved" ? "applied" : "assumed", sourceRefs: stage.sourceRefs, childIds: stage.dependencies.map(child => `${id}.${child}`) },
  ));
  return {
    id, label, status: result.status,
    ...(result.nonCritical === undefined ? {} : { nonCritical: result.nonCritical }),
    ...(result.critical === undefined ? {} : { critical: result.critical }),
    ...(result.expected === undefined ? {} : { expected: result.expected }),
    ...(result.sampled === undefined ? {} : { sampled: result.sampled }),
    trace: trace.nodes, blockers: result.blockers,
    warnings: [...result.warnings, ...(result.nonDamageReason ? [result.nonDamageReason] : [])], specialResult: result,
  };
}

/** Values deliberately teach arithmetic; they do not describe a game character. */
export function createSpecialTeachingContext(branch: ConditionedSpecialCalculation["branch"]): ConditionedSpecialCalculation {
  const definition = SPECIAL_BRANCHES[branch];
  const refs = ["synthetic:explicit-teaching-inputs-not-character-data"];
  const direct = definition.mode === "direct";
  return {
    branch,
    ruleVersion: SPECIAL_FORMULA_RULES[definition.family].id,
    context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: ["合成教学数据，仅公式系数来自所示来源；角色、等级基数与装备不对应真实角色。", "启用、参与资格和星导计数均由输入假设，未模拟队伍、附着或领域。", "参与者独立暴击，无暴击触发状态反馈。"] },
    contributors: definition.mode === "non-damaging" ? [] : [
      { id: "synthetic-A", base: direct
        ? { kind: "direct-stat-talent", scalingStat: "atk", statValue: 1000, talentCoefficient: 0.2, sourceRefs: refs }
        : { kind: "level-base", characterLevel: 90, value: 100, evidence: "synthetic", sourceRefs: refs },
        elementalMastery: 200, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, critRate: 0.5, critDamage: 1, modifierSourceRefs: refs },
      ...(direct ? [] : [{ id: "synthetic-B", base: { kind: "level-base" as const, characterLevel: 90, value: 150, evidence: "synthetic" as const, sourceRefs: refs }, elementalMastery: 0, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, critRate: 0, critDamage: 0, modifierSourceRefs: refs }]),
    ],
    effectiveResistance: 0.1,
    ...(branch === "stellar-conduct-direct" ? { polestarApplicationCount: 0 } : {}),
  };
}

export const SPECIAL_TEACHING_CONTEXTS: Record<ConditionedSpecialCalculation["branch"], ConditionedSpecialCalculation> = Object.fromEntries(
  (Object.keys(SPECIAL_BRANCHES) as ConditionedSpecialCalculation["branch"][]).map(branch => [branch, createSpecialTeachingContext(branch)]),
) as Record<ConditionedSpecialCalculation["branch"], ConditionedSpecialCalculation>;
