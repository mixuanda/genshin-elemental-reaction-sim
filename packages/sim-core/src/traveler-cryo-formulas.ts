import { travelerCryoContextSchema, type CalculatorDocument, type CalculatorFormula, type TravelerCryoContext } from "./calculator-model";
import { expr } from "./calculation-trace";

const revision = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const source = (path: string) => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`;
export const TRAVELER_CRYO_SOURCE_REFS = [
  ...["skill", "burst", "asc", "stellar", "cons", "stats"].map(file => source(`internal/characters/traveler/common/cryo/${file}.go`)),
  source("internal/characters/traveler/common/storybuffs.go"),
  source("pkg/core/player/character/stats.go"),
  source("pkg/core/player/character/mods.go"),
  source("pkg/core/attributes/stats.go"),
  source("pkg/enemy/damage.go"),
];

/** Fixed source vectors, independently archived with their hashes in traveler-cryo-complete/manifest.json. */
const skillRates = [0.9168, 0.98556, 1.05432, 1.146, 1.21476, 1.28352, 1.3752, 1.46688, 1.55856, 1.65024, 1.74192, 1.8336, 1.9482, 2.0628, 2.1774] as const;
const crystalRates = [0.21392, 0.229964, 0.246008, 0.2674, 0.283444, 0.299488, 0.32088, 0.342272, 0.363664, 0.385056, 0.406448, 0.42784, 0.45458, 0.48132, 0.50806] as const;
const burstRates = [0.55131, 0.592658, 0.634007, 0.689137, 0.730486, 0.771834, 0.826965, 0.882096, 0.937227, 0.992358, 1.047489, 1.10262, 1.171534, 1.240447, 1.309361] as const;
const frostglowRates = [0.027565, 0.029633, 0.0317, 0.034457, 0.036524, 0.038592, 0.041348, 0.044105, 0.046861, 0.049618, 0.052374, 0.055131, 0.058577, 0.062022, 0.065468] as const;
const actionIds = new Set(["aether", "lumine"].flatMap(gender => [
  `${gender}-cryo-skill-periodic-complete-c0`,
  `${gender}-cryo-burst-frostglow-partial-complete-c0`,
  `${gender}-cryo-burst-frostglow-full-complete-c0`,
]));
export const isTravelerCryoAction = (document: CalculatorDocument): boolean => actionIds.has(document.gameContext?.skillId ?? "");
const ascensionOf = (document: CalculatorDocument) => (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;

/** Ordinary Q scales ATK once by the sum of its base and consumed-Frostglow coefficients. */
export function createTravelerCryoBurstFormula(effectiveTalentLevel: number, frostglowStacksAtBurst: number): CalculatorFormula {
  const index = effectiveTalentLevel - 1;
  return {
    ruleId: "traveler-cryo-burst-frostglow-a7dc4bf4", label: "冰旅行者普通Q：ATK ×（本等级基础倍率＋实际消耗寒辉×本等级每层倍率）",
    expression: expr.mul(expr.input("atk"), expr.add(expr.input("travelerCryoBurstCoefficient"), expr.mul(expr.input("travelerCryoFrostglowStacks"), expr.input("travelerCryoFrostglowCoefficient")))),
    inputs: [
      { key: "travelerCryoEffectiveTalentLevel", value: effectiveTalentLevel, minimum: 1, maximum: 15, integer: true, unit: "level", meaningKey: "已明确提供的有效Q天赋等级，固定向量按等级减一取值", origin: "derived-character-context" },
      { key: "travelerCryoBurstCoefficient", value: burstRates[index]!, unit: "ratio", meaningKey: "固定来源该有效等级的普通Q基础倍率", origin: "pinned-source-talent" },
      { key: "travelerCryoFrostglowStacks", value: frostglowStacksAtBurst, minimum: 0, maximum: 8, integer: true, unit: "count", meaningKey: "Q构造攻击的第36帧实际读取并消耗的寒辉层数", origin: "derived-character-context" },
      { key: "travelerCryoFrostglowCoefficient", value: frostglowRates[index]!, unit: "ratio", meaningKey: "固定来源该有效等级的每层寒辉追加倍率", origin: "pinned-source-talent" },
    ],
    requirements: { maximumConstellation: 0, elements: ["cryo"], attackTags: ["burst"] }, sourceRefs: TRAVELER_CRYO_SOURCE_REFS,
  };
}

/** nonExtraATK includes applicable ordinary modifiers, excluding Extra conversions; it is not final ATK. */
export function createTravelerCryoA4Formula(nonExtraAtk: number, a4IncludedEm: number): CalculatorFormula {
  return {
    ruleId: "traveler-cryo-a4-em-accounting-a7dc4bf4", label: "冰旅行者A4精通差额：min(实际非Extra攻击力×8%,160) − 输入精通已含的A4份额",
    expression: expr.sub(expr.min(expr.mul(expr.input("travelerCryoNonExtraAtk"), expr.value(0.08)), expr.value(160)), expr.input("travelerCryoA4IncludedEm")),
    inputs: [
      { key: "travelerCryoNonExtraAtk", value: nonExtraAtk, minimum: 0, unit: "stat", meaningKey: "实际取样时BaseStats加有效普通StatMod、排除Extra后，按白值×(1+攻击百分比)+固定攻击得到的总攻击", origin: "derived-character-context" },
      { key: "travelerCryoA4IncludedEm", value: a4IncludedEm, minimum: 0, maximum: 160, unit: "stat", meaningKey: "所用面板或所选历史快照精通已经包含的A4数值", origin: "derived-character-context" },
    ],
    requirements: { minimumAscension: 4, maximumConstellation: 0, elements: ["cryo"], attackTags: ["skill", "burst"] }, sourceRefs: TRAVELER_CRYO_SOURCE_REFS,
  };
}

/** Rebuild sourced formulas at the execution boundary, including after JSON import. */
export function applyTravelerCryoContext(document: CalculatorDocument, supplied: TravelerCryoContext): CalculatorDocument {
  if (!isTravelerCryoAction(document)) return document;
  const context = travelerCryoContextSchema.parse(supplied), result = structuredClone(document), game = result.gameContext!;
  game.travelerCryo = context;
  const prefix = "traveler-cryo-context:", assumptionPrefix = "冰旅行者完整条件来源：";
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter(row => !row.startsWith(assumptionPrefix));
  const isSkill = game.skillId.includes("-skill-"), fullFrostglow = game.skillId.includes("-frostglow-full-"), level = game.effectiveTalentLevel;
  const validLevel = Number.isInteger(level) && level >= 1 && level <= 15;
  const selected = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  const fullCast = result.scope === "one-cast" && selected.length === result.hits.length;
  const branchReasons: string[] = [], stableReasons: string[] = [], fullReasons: string[] = [];
  if (game.constellation !== 0) branchReasons.push("本分支只审阅C0；高命座条件与新增伤害不能沿用当前完整动作。");
  if (!validLevel) branchReasons.push("有效天赋等级必须明确为1至15；不外推固定来源向量，也不采用JSON中手改倍率。");
  if (context.radiance !== "none") branchReasons.push(context.radiance === undefined ? "必须明确相关取样时点的辉映为none，不能把未知辉映当作无辉映。" : "本分支要求无辉映；星超导协同E和两种星烁Q仍有单独阻塞，不能套用普通分支。");
  if (context.trueMoonStoryBuff !== false) branchReasons.push("必须明确true_moon_story_buff关闭；源默认开启，不能把遗漏输入当作关闭。");
  if (!isSkill) {
    const stacks = context.frostglowStacksAtBurst;
    if (stacks === undefined) branchReasons.push("缺少Q第36帧构造攻击时实际消耗的寒辉层数，不默认0层，也不根据E命中数推算。");
    else if (fullCast && (fullFrostglow ? stacks !== 8 : stacks > 7)) branchReasons.push(`当前完整${fullFrostglow ? "五" : "三"}击分支要求${fullFrostglow ? "恰好8层" : "0至7层"}寒辉，实际输入为${stacks}层。`);
  }
  if (selected.length > 1 && context.statsStableAcrossHits !== true) stableReasons.push(isSkill
    ? "所选多个E命中分别取样；须明确相关时点的进攻面板、A4非Extra攻击、装备和共同目标条件稳定。"
    : "Q投矛共享第36帧进攻快照；多个命中仍须明确所用命中时装备、反应加成和共同目标条件稳定，逐击反应类型另行输入。");
  if (isSkill && fullCast && context.skillUninterrupted !== true) fullReasons.push("初击加八枚定时冰晶要求寒星未替换/提前中断、没有额外延长至新增轮次，且所列九击确实全部命中。");
  const dependency = (suffix: string, reasons: string[], ready: string) => {
    const id = `${prefix}${suffix}`;
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || ready, sourceRefs: TRAVELER_CRYO_SOURCE_REFS });
    return id;
  };
  const branchId = dependency("ordinary-branch", branchReasons, "C0、无辉映、TrueMoon关闭和实际有效天赋已明确；完整Q另按实际消耗寒辉检查三/五击分支。");
  const stableId = dependency("selected-hit-conditions", stableReasons, "所选多击所需共同条件已明确稳定；单选一次已发生命中不要求未选未来命中的状态。");
  const fullId = dependency("complete-skill", fullReasons, "完整E按明确未中断、未额外延长且所列九击实际命中的条件合计。");
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    hit.dependencies.push(branchId);
    if (selected.length > 1) hit.dependencies.push(stableId);
    if (isSkill && fullCast) hit.dependencies.push(fullId);
    if (hit.kind !== "ordinary") continue;
    if (!isSkill && /-javelin-instance-[45]$/.test(hit.id)) hit.dependencies.push(dependency(`extra-javelin:${hit.id}`, context.frostglowStacksAtBurst === 8 ? [] : ["第4或第5枚投矛只有实际消耗8层寒辉才会生成；单选额外投矛也不能省略此条件。"], "实际消耗8层寒辉，所选额外投矛存在。"));
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...TRAVELER_CRYO_SOURCE_REFS])];
    const isCrystal = hit.id.includes("-crystal-instance-");
    if (validLevel) {
      hit.terms = [{ stat: "atk", coefficient: (isSkill ? isCrystal ? crystalRates : skillRates : burstRates)[level - 1]! }];
      if (!isSkill && context.frostglowStacksAtBurst !== undefined) hit.baseDamageFormula = createTravelerCryoBurstFormula(level, context.frostglowStacksAtBurst);
      else delete hit.baseDamageFormula;
    } else delete hit.baseDamageFormula;
    const ascension = hit.finalSnapshot?.ascension ?? ascensionOf(result), a4Reasons: string[] = [];
    if (ascension === undefined) a4Reasons.push("缺少明确突破阶段，不能确定A4是否解锁。");
    if (ascension !== undefined && ascension >= 4) {
      if (context.nonExtraAtk === undefined) a4Reasons.push("缺少本击取样时实际非Extra总攻击；不能用最终ATK或裸攻击代替。");
      if (context.a4IncludedEm === undefined) a4Reasons.push("缺少输入精通已含的A4具体数值；不默认尚未包含或已经全含。");
      if (context.nonExtraAtk !== undefined && context.a4IncludedEm !== undefined) {
        const actual = Math.min(context.nonExtraAtk * 0.08, 160);
        if (hit.finalSnapshot && context.a4IncludedEm !== actual) a4Reasons.push("独立历史finalSnapshot直接使用其最终精通，不执行当前面板补差；该快照必须已含本击完整A4，或先把历史面板恢复为共享输入再补差。");
        hit.elementalMasteryAdjustment = { formula: createTravelerCryoA4Formula(context.nonExtraAtk, context.a4IncludedEm), accounting: "add-to-panel" };
      } else delete hit.elementalMasteryAdjustment;
    } else {
      if (ascension !== undefined && context.a4IncludedEm !== undefined && context.a4IncludedEm !== 0) a4Reasons.push("本击突破尚未解锁A4，输入精通不能声明包含非零A4份额。");
      delete hit.elementalMasteryAdjustment;
    }
    hit.dependencies.push(dependency(`a4:${hit.id}`, a4Reasons, ascension !== undefined && ascension < 4 ? "本击突破低于4，A4未解锁，不依赖非Extra攻击或未知A4输入。" : "实际非Extra攻击与精通已含份额明确；A4只修正本击精通，普通增幅反应读取对应进攻快照精通。"));
  }
  result.assumptions.push(
    `${assumptionPrefix}E初击第19帧取样，四轮定时双晶在178、354、530、706帧及各轮+13帧分别取样；全九击条件不用于阻塞单独一击。单选输入代表该击实际上下文。`,
    `${assumptionPrefix}Q全部投矛在第36帧按实际寒辉和辉映构造并取快照，随后清空寒辉；普通融化使用快照EM。0至7层三击，8层五击；每击ATK×(基础倍率+寒辉×每层倍率)，没有第二次套用天赋倍率。完整施放检查菜单总次数，单选第1至3枚不依赖未选额外投矛；第4或5枚本身仍要求8层。`,
    `${assumptionPrefix}非Extra攻击由BaseStats与有效Extra=false属性修正组成，再按白值×(1+攻击百分比)+固定攻击计算。A4只补精通差额，不直接当作全伤加成；所填记账也明确适用于所选独立历史快照，该快照须已含完整A4。`,
    `${assumptionPrefix}A1只影响满足星超导条件的普攻、重击和下落，不对E/Q加0.8。TrueMoon关闭，其他剧情/队友属性在实际面板中恢复。辉映切换、协同E、星烁Q、C1以上及自动反应/能量/轮转仍不在本分支范围。`,
  );
  return result;
}

/** Replacing a build invalidates the actual nonExtra input; only fresh equipment has a known zero A4 share. */
export function resetTravelerCryoPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isTravelerCryoAction(document)) return;
  const context = { ...document.gameContext!.travelerCryo };
  delete context.nonExtraAtk;
  if (mode === "fresh-equipment") context.a4IncludedEm = 0;
  else delete context.a4IncludedEm;
  document.gameContext!.travelerCryo = context;
}

export function prepareTravelerCryoDocument(document: CalculatorDocument): CalculatorDocument {
  return isTravelerCryoAction(document) ? applyTravelerCryoContext(document, document.gameContext?.travelerCryo ?? {}) : document;
}
