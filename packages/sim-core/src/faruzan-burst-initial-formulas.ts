import definitions from "../../game-data/sources/finite-followup-casts/definitions.json";
import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { faruzanBurstInitialContextSchema, type FaruzanBurstInitialContext } from "./faruzan-burst-initial-context";

export const FARUZAN_BURST_INITIAL_SKILL_ID = "finite-followup-faruzan-burst-fresh-c0";
export const FARUZAN_BURST_INITIAL_HIT_ID = `${FARUZAN_BURST_INITIAL_SKILL_ID}-initial`;
export const FARUZAN_BURST_INITIAL_MAX_CONSTELLATION = 6;
export const FARUZAN_BURST_INITIAL_PREFIX = "faruzan-burst-initial:";
const source = definitions.templates.find(row => row.skillId === FARUZAN_BURST_INITIAL_SKILL_ID)!.hits[0]!;
export const FARUZAN_BURST_INITIAL_SOURCE_REFS = source.sourceRefs.map(path =>
  `https://github.com/genshinsim/gcsim/blob/${definitions.revision}/${path}`);
type Ordinary = Extract<CalculatorHit, { kind: "ordinary" }>;
export type FaruzanBurstInitialDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & { faruzanBurstInitial?: FaruzanBurstInitialContext };
};
export const faruzanBurstInitialContext = (doc: CalculatorDocument) =>
  (doc as FaruzanBurstInitialDocument).gameContext?.faruzanBurstInitial;
export const isFaruzanBurstInitialAction = (doc: CalculatorDocument): boolean =>
  doc.dataIdentity.releaseStatus !== "preview" && doc.gameContext?.characterId === "character:10000076"
  && doc.gameContext.skillId === FARUZAN_BURST_INITIAL_SKILL_ID && doc.gameContext.abilityId === "talent:faruzan:combat3";
export const isFaruzanBurstInitialHit = (doc: CalculatorDocument, hit: CalculatorHit): boolean =>
  isFaruzanBurstInitialAction(doc) && doc.scope === "single-hit" && hit.kind === "ordinary"
  && hit.id === FARUZAN_BURST_INITIAL_HIT_ID && hit.element === "anemo" && hit.attackTag === "burst";

/** The source's 43f gift precedes its 54f hit. Caller must prove this fresh,
 * in-area branch and A4 readiness; this does not count C6's later collapse. */
export function evaluateFaruzanBurstInitial(input: {
  effectiveBurstTalentLevel: number; constellation: number; ascension: number; baseAttack?: number;
}) {
  const { effectiveBurstTalentLevel: level, constellation, ascension, baseAttack } = input;
  if (!Number.isInteger(level) || level < 1 || level > 15) throw new Error("Q有效天赋等级须为1–15整数，命座增级只计一次。");
  if (!Number.isInteger(constellation) || constellation < 0 || constellation > 6) throw new Error("此初击只审阅C0–C6。");
  if (!Number.isInteger(ascension) || ascension < 0 || ascension > 6) throw new Error("需要实际突破阶段0–6。");
  if (baseAttack !== undefined && (!Number.isFinite(baseAttack) || baseAttack < 0)
    || ascension >= 4 && baseAttack === undefined) throw new Error("A4需要真实角色加武器基础攻击力，不能从最终攻击力反推。");
  return { coefficient: source.values[level - 1]!, anemoDamageBonus: definitions.faruzanBurstBonusValues[level - 1]!,
    additiveBaseDamage: ascension >= 4 ? .32 * baseAttack! : 0, critDamageBonus: constellation === 6 ? .4 : 0 };
}

const delta = (id: string, label: string, actual: number, included: number, unit = "ratio"): CalculatorFormula => ({
  ruleId: FARUZAN_BURST_INITIAL_PREFIX + id, label,
  expression: expr.sub(expr.input("actualFaruzanContribution"), expr.input("includedFaruzanContribution")),
  inputs: [{ key: "actualFaruzanContribution", value: actual, unit, origin: "pinned-fresh-q-initial", meaningKey: "本次Q初击实际取得的珐露珊份额" },
    { key: "includedFaruzanContribution", value: included, unit, origin: "explicit-panel-accounting", meaningKey: "输入已经包含的同一份额；0才表示未含" }],
  requirements: { maximumConstellation: 6, elements: ["anemo"], attackTags: ["burst"] },
  sourceRefs: FARUZAN_BURST_INITIAL_SOURCE_REFS,
});
const ascensionOf = (doc: CalculatorDocument, hit?: Ordinary) => hit?.finalSnapshot?.ascension
  ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
function identity(doc: CalculatorDocument, hit: Ordinary, context: FaruzanBurstInitialContext): string {
  const { finalizedHitState: _, ...state } = context;
  return JSON.stringify({ state, skillId: doc.gameContext?.skillId, abilityId: doc.gameContext?.abilityId,
    level: doc.gameContext?.effectiveTalentLevel, constellation: doc.gameContext?.constellation,
    ascension: ascensionOf(doc, hit), characterLevel: doc.characterLevel, hitId: hit.id,
    snapshot: hit.finalSnapshot ?? null });
}
const owned = new Set(["finite-followup:faruzan-q-bonus", "finite-followup:faruzan-a4-base",
  "finite-followup:faruzan-post-hit-shred", ...["q-bonus", "a4-base", "resistance-accounting", "c6-crit-damage"].map(id => FARUZAN_BURST_INITIAL_PREFIX + id)]);

/** New context opts in. Old C0 saves without it retain their original route. */
export function prepareFaruzanBurstInitialDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isFaruzanBurstInitialAction(document) || faruzanBurstInitialContext(document) === undefined) return document;
  const doc = structuredClone(document) as FaruzanBurstInitialDocument, game = doc.gameContext;
  const context = faruzanBurstInitialContextSchema.parse(game.faruzanBurstInitial); game.faruzanBurstInitial = context;
  doc.dependencies = doc.dependencies.filter(row => !row.id.startsWith(FARUZAN_BURST_INITIAL_PREFIX) && !row.id.startsWith("finite-followup:"));
  const issues: string[] = [];
  const hit = doc.hits.length === 1 && doc.hits[0]?.kind === "ordinary" ? doc.hits[0] : undefined;
  if (!hit || !isFaruzanBurstInitialHit(doc, hit) || doc.selectedHitIds.length !== 1 || doc.selectedHitIds[0] !== FARUZAN_BURST_INITIAL_HIT_ID)
    issues.push("此入口只计算原定义的Q初击；不能据此开放C1第二箭、C6风压坍陷或完整Q日程。");
  if (context.freshBurstNoPriorEffects !== true) issues.push("请确认本次Q没有旧E/Q风伤、减抗或A4冷却残留。");
  if (context.insideBurstArea !== true) issues.push("请确认本人从第43帧获得祈风赐福至54帧初击时仍在本次Q范围内。");
  const ascension = ascensionOf(doc, hit);
  if (ascension === undefined) issues.push("请填写实际突破阶段，不能猜测是否解锁A4。");
  if (ascension !== undefined && ascension >= 4 && context.noOtherAnemoBeforeInitial !== true)
    issues.push("请确认Q初击前没有其他风伤消耗A4，初击时A4冷却可用。");
  if (doc.build.mode === "equipment-derived" && !hit?.finalSnapshot)
    context.baseAttack = doc.build.characterBaseAtk + doc.build.weaponBaseAtk;
  if (context.includedBurstDamageBonus === undefined) issues.push("请填写风伤输入已计入的本次Q风伤；未计入填0。");
  if (context.includedA4BaseDamage === undefined) issues.push("请填写附加基伤已计入的A4数值；未计入填0。");
  if (hit?.effectiveResistance === undefined && context.includedResistanceReduction === undefined)
    issues.push("请填写抗性输入已计入的自身减抗；本次Q减抗在初击之后生效。");
  if (game.constellation === 6 && context.c6CritDamageIncludedInPanel === undefined) issues.push("请确认输入暴伤是否已含C6的40个百分点；核心自动判断本次Q实际加成。");
  let values: ReturnType<typeof evaluateFaruzanBurstInitial> | undefined;
  try { values = evaluateFaruzanBurstInitial({ effectiveBurstTalentLevel: game.effectiveTalentLevel,
    constellation: game.constellation, ascension: ascension as number,
    ...(context.baseAttack === undefined ? {} : { baseAttack: context.baseAttack }) }); }
  catch (error) { issues.push((error as Error).message); }
  if (hit) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(FARUZAN_BURST_INITIAL_PREFIX) && !id.startsWith("finite-followup:"));
    // Keep foreign evidence intact. A zero owned adjustment does not occupy
    // another source's slot; a nonzero collision stays explicitly blocked.
    for (const slot of ["damageBonusFormula", "additiveBaseFormula", "resistanceReductionFormula", "critDamageFormula"] as const)
      if (hit[slot] && owned.has(hit[slot]!.ruleId)) delete hit[slot];
    if (hit.baseDamageFormula) issues.push("基础伤害槽已有外来公式，不能覆盖它或替换固定Q倍率。");
    if (values) hit.terms = [{ stat: "atk", coefficient: values.coefficient }];
    if (hit.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitState !== identity(doc, hit, context))
      issues.push("Q状态、等级或历史快照已改变，不能沿用旧转换；请重新应用配装。");
    if (values && hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") {
      if (context.includedBurstDamageBonus !== values.anemoDamageBonus || context.includedA4BaseDamage !== values.additiveBaseDamage
        || (context.c6CritDamageIncludedInPanel ?? false) !== (game.constellation === 6))
        issues.push("历史最终快照须已包含当时实际Q风伤、A4与C6份额，不能在冻结数值上补造增益。");
    }
    if (game.constellation === 6 && hit.effectiveCritDamage !== undefined && !hit.finalSnapshot && context.c6CritDamageIncludedInPanel !== true)
      issues.push("本击已提供最终暴伤，请确认其中已包含本次实际C6的40个百分点。");
    if (values && context.includedBurstDamageBonus !== undefined && context.includedA4BaseDamage !== undefined
      && (game.constellation !== 6 || context.c6CritDamageIncludedInPanel !== undefined)) {
      const put = (slot: "damageBonusFormula" | "additiveBaseFormula" | "resistanceReductionFormula" | "critDamageFormula", formula: CalculatorFormula, amount: number) => {
        if (hit[slot]) { if (amount !== 0) issues.push(`${formula.label}：同槽已有外来公式，保留原证据并拒绝覆盖。`); }
        else hit[slot] = formula;
      };
      put("damageBonusFormula", delta("q-bonus", "祈风赐福：本级Q风伤 − 输入已含份额", values.anemoDamageBonus, context.includedBurstDamageBonus), values.anemoDamageBonus - context.includedBurstDamageBonus);
      put("additiveBaseFormula", delta("a4-base", "A4：32%真实基础攻击 − 已含基伤", values.additiveBaseDamage, context.includedA4BaseDamage, "damage"), values.additiveBaseDamage - context.includedA4BaseDamage);
      put("critDamageFormula", delta("c6-crit-damage", "C6：本次祈风状态的40%风伤暴伤 − 输入已含份额", values.critDamageBonus, context.c6CritDamageIncludedInPanel ? .4 : 0), values.critDamageBonus - (context.c6CritDamageIncludedInPanel ? .4 : 0));
      if (hit.effectiveResistance === undefined && context.includedResistanceReduction !== undefined)
        put("resistanceReductionFormula", delta("resistance-accounting", "本次Q后置减抗：初击实际0 − 输入已含份额", 0, context.includedResistanceReduction), -context.includedResistanceReduction);
    }
    hit.label = "抟风秘道·初击（54帧）";
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...FARUZAN_BURST_INITIAL_SOURCE_REFS])];
  }
  const dependencyId = FARUZAN_BURST_INITIAL_PREFIX + "conditions";
  doc.dependencies.push({ id: dependencyId, status: issues.length ? "missing" : "provisional",
    reason: issues.join("；") || "C0–C6本次Q初击：43帧取得祈风状态，54帧初击；A4、C6及已含份额分别核对，不生成后续坍陷。", sourceRefs: FARUZAN_BURST_INITIAL_SOURCE_REFS });
  for (const selected of doc.hits) if (doc.selectedHitIds.includes(selected.id)) selected.dependencies.push(dependencyId);
  game.scopeCoverage = "single-hit";
  game.attributionPolicy = "只计算本次Q的54帧初击；C6风压坍陷、C1第二箭、回能及队友伤害不并入，不代表完整Q或轮转。";
  doc.label = `珐露珊 · 抟风秘道初击 · C${game.constellation} · 有效Q等级${game.effectiveTalentLevel}`;
  doc.assumptions = doc.assumptions.filter(row => !row.startsWith("有限后续协议：")
    && !row.includes("固定C0 Q生命周期") && !row.startsWith("珐露珊Q初击："));
  doc.assumptions.push("珐露珊Q初击：C0–C6只覆盖54帧直接命中。固定源C6后续坍陷另行触发，未计入本结果；有效Q等级已含C5加级，不再增加。");
  return doc;
}

export function initializeFaruzanBurstInitialDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isFaruzanBurstInitialAction(document)) return document;
  const doc = structuredClone(document) as FaruzanBurstInitialDocument;
  doc.gameContext.faruzanBurstInitial ??= {};
  return prepareFaruzanBurstInitialDocument(doc);
}
export function resetFaruzanBurstInitialPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const context = faruzanBurstInitialContext(document); if (!isFaruzanBurstInitialAction(document) || !context) return;
  delete context.finalizedHitState; delete context.baseAttack;
  if (mode === "fresh-equipment") Object.assign(context, { includedBurstDamageBonus: 0, includedA4BaseDamage: 0,
    includedResistanceReduction: 0, c6CritDamageIncludedInPanel: false });
  else for (const key of ["freshBurstNoPriorEffects", "insideBurstArea", "noOtherAnemoBeforeInitial", "includedBurstDamageBonus",
    "includedA4BaseDamage", "includedResistanceReduction", "c6CritDamageIncludedInPanel"] as const) delete context[key];
}
export function finalizeFaruzanBurstInitialPanelAccounting(document: CalculatorDocument): void {
  const context = faruzanBurstInitialContext(document); if (!isFaruzanBurstInitialAction(document) || !context) return;
  for (const hit of document.hits) if (hit.kind === "ordinary" && isFaruzanBurstInitialHit(document, hit) && hit.finalSnapshot) {
    const next = identity(document, hit, context);
    if (context.finalizedHitState !== undefined && context.finalizedHitState !== next) throw new Error("不能重写已改变的珐露珊历史取样身份。");
    context.finalizedHitState = next;
  }
}
