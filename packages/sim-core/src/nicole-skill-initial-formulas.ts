import source from "../../game-data/sources/nicole-skill-initial/manifest.json";
import type { ArtifactConditionalContext } from "../../game-data/src/artifact-conditional-effects";
import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { resolveCalculatorStats } from "./calculator";
import { nicoleSkillInitialContextSchema, type NicoleSkillInitialContext } from "./nicole-skill-initial-context";

export const NICOLE_SKILL_INITIAL_SKILL_ID = "nicole-skill";
export const NICOLE_SKILL_INITIAL_HIT_ID = "nicole-skill-hit";
export const NICOLE_SKILL_INITIAL_MAX_CONSTELLATION = 2;
export const NICOLE_SKILL_INITIAL_PREFIX = "nicole-skill-initial:";
export const NICOLE_SKILL_INITIAL_SOURCE_REFS = source.files.map(row => row.sourceRef);
type Ordinary = Extract<CalculatorHit, { kind: "ordinary" }>;
export type NicoleSkillInitialDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & { nicoleSkillInitial?: NicoleSkillInitialContext };
};
export const nicoleSkillInitialContext = (doc: CalculatorDocument) => (doc as NicoleSkillInitialDocument).gameContext?.nicoleSkillInitial;
export const isNicoleSkillInitialAction = (doc: CalculatorDocument): boolean => doc.dataIdentity.releaseStatus !== "preview"
  && doc.gameContext?.characterId === "character:10000131" && doc.gameContext.skillId === NICOLE_SKILL_INITIAL_SKILL_ID
  && doc.gameContext.abilityId === "talent:nicole:combat2";
export const isNicoleSkillInitialHit = (doc: CalculatorDocument, hit: CalculatorHit): boolean => isNicoleSkillInitialAction(doc)
  && doc.scope === "single-hit" && hit.kind === "ordinary" && hit.id === NICOLE_SKILL_INITIAL_HIT_ID
  && hit.element === "pyro" && hit.attackTag === "skill";
const ascensionOf = (doc: CalculatorDocument, hit?: Ordinary) => hit?.finalSnapshot?.ascension
  ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
const requireConstellation = (c: number) => { if (!Number.isInteger(c) || c < 0 || c > 2) throw new Error("此E初击只审阅C0–C2。"); };

/** Native E removes its old E/A1/C2 first. At8f the shield samples before the
 * new C2+300, then its Extra E buff and C2 flat buff exist before the9f snapshot. */
export function evaluateNicoleSkillAttackGrant(input: { effectiveSkillTalentLevel: number; constellation: number; nonExtraAttackAtGrant: number }) {
  const { effectiveSkillTalentLevel: level, constellation, nonExtraAttackAtGrant: attack } = input;
  requireConstellation(constellation);
  if (!Number.isInteger(level) || level < 1 || level > 15) throw new Error("E有效天赋等级须为1–15整数，不重复增加命座等级。");
  if (!Number.isFinite(attack) || attack < 0) throw new Error("需要8帧增攻计算采用的非转换攻击力，0为合法观察，未知不能填0。");
  const ratio = source.skillAttackRatioValues[level - 1]!, cap = source.skillAttackCapValues[level - 1]!;
  const skillAttack = Math.min(attack * ratio, cap), c2Attack = constellation === 2 ? 300 : 0;
  return { coefficient: source.skillCoefficientValues[level - 1]!, ratio, cap, skillAttack, c2Attack,
    totalAttack: skillAttack + c2Attack, newA1AttackInThisSnapshot: 0 };
}
/** OnEnemyHit precedes e.calc: the new A1 cannot change the frozen ATK, while
 * its synchronous C2 ticker can change this same hit's dynamic resistance. */
export function evaluateNicoleSkillInitialC2Resistance(input: { constellation: number; ascension: number;
  ownerOnFieldAtInitial: boolean; targetInC2AreaAtInitial: boolean }): number {
  requireConstellation(input.constellation);
  if (!Number.isInteger(input.ascension) || input.ascension < 0 || input.ascension > 6) throw new Error("需要实际突破阶段0–6。");
  if (input.constellation < 2) return 0;
  if (input.ascension < 4) throw new Error("低突破C2的固定源A4门与描述有分歧，此分支尚未闭合，不能猜测同击减抗。");
  if (typeof input.ownerOnFieldAtInitial !== "boolean" || typeof input.targetInC2AreaAtInitial !== "boolean") throw new Error("C2同击减抗需要实际前台和目标接触条件。");
  return input.ownerOnFieldAtInitial && input.targetInC2AreaAtInitial ? .25 : 0;
}

/** Reuse the shared panel engine only when this equipment panel has no Extra
 * conversion ambiguity. Explicit observations always take precedence. */
export function resolveNicoleSkillInitialGrantAttack(doc: CalculatorDocument): { value: number; source: "equipment-current" | "observed" } | undefined {
  const context = nicoleSkillInitialContext(doc); if (!isNicoleSkillInitialAction(doc) || !context) return undefined;
  const hit = doc.hits.find((row): row is Ordinary => row.kind === "ordinary" && row.id === NICOLE_SKILL_INITIAL_HIT_ID);
  if (context.skillGrantNonExtraAttack !== undefined && context.grantAttackSource !== "equipment-current")
    return { value: context.skillGrantNonExtraAttack, source: "observed" };
  if (hit?.finalSnapshot) return context.skillGrantNonExtraAttack === undefined ? undefined
    : { value: context.skillGrantNonExtraAttack, source: context.grantAttackSource ?? "observed" };
  if (doc.build.mode !== "equipment-derived" || !doc.build.equipment || context.noOtherEventsBeforeInitial !== true
    || context.noDisplacementBeforeInitial !== true || context.includedSkillAttack !== 0
    || context.c2AttackIncludedInPanel !== false || context.a1AttackIncludedInPanel !== false
    || doc.build.equipment.statModifiers?.some(row => row.phase === "conversion") || hit?.incomingThrillingTalesFormula
    || hit?.attackAdjustment && hit.attackAdjustment.formula.ruleId !== NICOLE_SKILL_INITIAL_PREFIX + "attack-accounting") return undefined;
  return { value: resolveCalculatorStats(doc.build).atk, source: "equipment-current" };
}

/** First shield refresh only. The existing weapon module owns its numeric
 * bonus; this helper adds no damage formula and preserves unrelated context. */
export function deriveNicoleSkillInitialWeaponContext(doc: CalculatorDocument, currentEffectContext: ArtifactConditionalContext): {
  effectContext: ArtifactConditionalContext; derived: boolean; reason?: string;
} {
  const context = nicoleSkillInitialContext(doc), metadata = doc.build.mode === "equipment-derived" ? doc.build.equipment : undefined;
  const unchanged = (reason: string) => ({ effectContext: { ...currentEffectContext }, derived: false, reason });
  if (!isNicoleSkillInitialAction(doc) || !context || metadata?.weaponId !== "weapon:14523" || metadata.refinement !== 1
    || metadata.weaponEffectsEnabled !== true) return unchanged("自动绑定仅适用于已启用的精1尘光七谕及本次E初击。");
  if (context.noOtherEventsBeforeInitial !== true || context.noDisplacementBeforeInitial !== true
    || doc.scope !== "single-hit") return unchanged("尚未确认本次E至初击的合法稳定路径，不能猜测先导之光首次取样。");
  const grant = resolveNicoleSkillInitialGrantAttack(doc);
  if (!grant) return unchanged("缺少8帧的实际非转换攻击样本；不能借用已含E/C2/A1的最终攻击力。");
  return { derived: true, effectContext: { ...currentEffectContext, weaponEffectActive: true, offField: false,
    catalystSnapshotAtk: grant.value } };
}

const input = (key: string, value: number, unit = "stat") => ({ key, value, unit, origin: "explicit-nicole-initial-context", meaningKey: key });
function attackFormula(context: NicoleSkillInitialContext, values: ReturnType<typeof evaluateNicoleSkillAttackGrant>): CalculatorFormula {
  return { ruleId: NICOLE_SKILL_INITIAL_PREFIX + "attack-accounting", label: "E初击：8帧E增攻与C2平攻 − 已含E/C2/A1份额",
    expression: expr.sub(expr.add(expr.min(expr.mul(expr.input("grantAttack"), expr.input("skillRatio")), expr.input("skillCap")), expr.input("actualC2Attack")),
      expr.add(expr.input("includedSkillAttack"), expr.input("includedC2Attack"), expr.input("includedA1Attack"))),
    inputs: [input("grantAttack", context.skillGrantNonExtraAttack!), input("skillRatio", values.ratio, "ratio"), input("skillCap", values.cap),
      input("actualC2Attack", values.c2Attack), input("includedSkillAttack", context.includedSkillAttack!),
      input("includedC2Attack", context.c2AttackIncludedInPanel ? 300 : 0), input("includedA1Attack", context.a1AttackIncludedInPanel ? 300 : 0)],
    requirements: { maximumConstellation: 2, elements: ["pyro"], attackTags: ["skill"] }, sourceRefs: NICOLE_SKILL_INITIAL_SOURCE_REFS };
}
function identity(doc: CalculatorDocument, hit: Ordinary, context: NicoleSkillInitialContext): string {
  const { finalizedHitState: _, ...state } = context;
  return JSON.stringify({ state, skillId: doc.gameContext?.skillId, abilityId: doc.gameContext?.abilityId,
    level: doc.gameContext?.effectiveTalentLevel, constellation: doc.gameContext?.constellation,
    ascension: ascensionOf(doc, hit), characterLevel: doc.characterLevel, hitId: hit.id, snapshot: hit.finalSnapshot ?? null });
}

export function prepareNicoleSkillInitialDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isNicoleSkillInitialAction(document) || nicoleSkillInitialContext(document) === undefined) return document;
  const doc = structuredClone(document) as NicoleSkillInitialDocument, game = doc.gameContext;
  const context = nicoleSkillInitialContextSchema.parse(game.nicoleSkillInitial); game.nicoleSkillInitial = context;
  doc.dependencies = doc.dependencies.filter(row => !row.id.startsWith(NICOLE_SKILL_INITIAL_PREFIX));
  const issues: string[] = [], hit = doc.hits.length === 1 && doc.hits[0]?.kind === "ordinary" ? doc.hits[0] : undefined;
  if (!hit || !isNicoleSkillInitialHit(doc, hit) || doc.selectedHitIds.length !== 1 || doc.selectedHitIds[0] !== NICOLE_SKILL_INITIAL_HIT_ID)
    issues.push("此入口只计算E的9帧初击，不包含C1协同造影、Q投影或完整轮转。");
  if (context.noOtherEventsBeforeInitial !== true) issues.push("请确认本次E起手至初击前没有其他伤害、换人或额外状态变化。");
  if (context.noDisplacementBeforeInitial !== true) issues.push("请确认本次E起手至初击未被中断或额外位移，才能核对本击前台及减抗范围。");
  if (context.targetInC2AreaAtInitial === false && game.constellation === 2)
    issues.push("记录矛盾：未位移的本次E在5米范围命中，目标必在同心10米C2范围内；不能把超范围记录强行按25%减抗。");
  const grant = resolveNicoleSkillInitialGrantAttack(doc);
  if (grant && !hit?.finalSnapshot) { context.skillGrantNonExtraAttack = grant.value; context.grantAttackSource = grant.source; }
  else if (context.grantAttackSource === "equipment-current" && !hit?.finalSnapshot)
    issues.push("原自动攻击样本已不适用于当前转换或输入；请重新应用装备，或填写真实8帧非转换攻击记录。");
  if (context.skillGrantNonExtraAttack === undefined) issues.push("请填写E增攻采用的8帧非转换攻击力；装备条件可证明时自动推导，不从最终攻击倒算。");
  if (context.includedSkillAttack === undefined) issues.push("请填写攻击输入已经包含的本次E增攻数值；未计入填0。");
  if (context.c2AttackIncludedInPanel === undefined) issues.push("请确认攻击输入是否已经包含C2的300点平攻。");
  if (context.a1AttackIncludedInPanel === undefined) issues.push("请确认攻击输入是否已经包含A1升级的300点平攻；此E初击取样不含新触发的A1。");
  if (hit?.effectiveResistance === undefined && context.includedC2ResistanceReduction === undefined)
    issues.push("请填写抗性输入已经包含的妮可C2减抗份额；未计入填0。");
  const ascension = ascensionOf(doc, hit);
  let values: ReturnType<typeof evaluateNicoleSkillAttackGrant> | undefined, resistance: number | undefined;
  try {
    values = evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: game.effectiveTalentLevel,
      constellation: game.constellation, nonExtraAttackAtGrant: context.skillGrantNonExtraAttack as number });
    resistance = evaluateNicoleSkillInitialC2Resistance({ constellation: game.constellation, ascension: ascension as number,
      ownerOnFieldAtInitial: context.noOtherEventsBeforeInitial === true && context.noDisplacementBeforeInitial === true,
      targetInC2AreaAtInitial: context.noDisplacementBeforeInitial === true && context.targetInC2AreaAtInitial !== false });
  } catch (error) { issues.push((error as Error).message); }
  if (hit) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(NICOLE_SKILL_INITIAL_PREFIX));
    if (hit.attackAdjustment?.formula.ruleId === NICOLE_SKILL_INITIAL_PREFIX + "attack-accounting") delete hit.attackAdjustment;
    if (hit.resistanceReductionFormula?.ruleId === NICOLE_SKILL_INITIAL_PREFIX + "c2-resistance-accounting") delete hit.resistanceReductionFormula;
    if (hit.baseDamageFormula) issues.push("基础伤害槽已有外来公式，不能覆盖固定E初击倍率。");
    if (values) hit.terms = [{ stat: "atk", coefficient: values.coefficient }];
    if (hit.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitState !== identity(doc, hit, context))
      issues.push("E状态、攻击样本、等级或历史快照已改变，不能沿用旧转换；请重新应用配装。");
    if (hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion" && values
      && (context.includedSkillAttack !== values.skillAttack || (context.c2AttackIncludedInPanel ?? false) !== (game.constellation === 2)
        || context.a1AttackIncludedInPanel !== false)) issues.push("历史最终快照必须已包含当时实际E/C2份额，且未倒灌本击之后才取得的A1。");
    if (values && context.includedSkillAttack !== undefined && context.c2AttackIncludedInPanel !== undefined && context.a1AttackIncludedInPanel !== undefined) {
      const own = attackFormula(context, values);
      if (hit.attackAdjustment || hit.incomingThrillingTalesFormula) issues.push("攻击调整槽已有外来公式，保留原证据，不能覆盖或重复结算。");
      else hit.attackAdjustment = { accounting: "add-to-panel", formula: own };
    }
    if (resistance !== undefined && hit.effectiveResistance === undefined && context.includedC2ResistanceReduction !== undefined) {
      if (hit.resistanceReductionFormula && resistance !== context.includedC2ResistanceReduction) issues.push("减抗槽已有外来公式，保留原证据并拒绝覆盖。");
      else if (!hit.resistanceReductionFormula) hit.resistanceReductionFormula = {
        ruleId: NICOLE_SKILL_INITIAL_PREFIX + "c2-resistance-accounting", label: "本击C2同步减抗 − 抗性输入已含份额",
        expression: expr.sub(expr.input("actualC2Shred"), expr.input("includedC2Shred")),
        inputs: [input("actualC2Shred", resistance, "ratio"), input("includedC2Shred", context.includedC2ResistanceReduction, "ratio")],
        requirements: { maximumConstellation: 2, elements: ["pyro"], attackTags: ["skill"] }, sourceRefs: NICOLE_SKILL_INITIAL_SOURCE_REFS };
    }
    hit.label = "启示·无始之光·初击（9帧）";
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...NICOLE_SKILL_INITIAL_SOURCE_REFS])];
  }
  const dependencyId = NICOLE_SKILL_INITIAL_PREFIX + "conditions";
  doc.dependencies.push({ id: dependencyId, status: issues.length ? "missing" : "provisional", reason: issues.join("；")
    || "本次E8帧先取样并授予E/C2增攻，9帧初击；新A1不回填攻击，C2在本击动态抗性读取前生效。", sourceRefs: NICOLE_SKILL_INITIAL_SOURCE_REFS });
  for (const row of doc.hits) if (doc.selectedHitIds.includes(row.id)) row.dependencies.push(dependencyId);
  game.scopeCoverage = "single-hit";
  game.skillName = "启示·无始之光·初击";
  game.attributionPolicy = "只计算本次E9帧初击；C1额外协同造影及Q触发投影归各自实际触发者，不并入。护盾、回能和完整队伍增益日程另算。";
  doc.label = `妮可 · 启示·无始之光初击 · C${game.constellation} · 有效E等级${game.effectiveTalentLevel}`;
  return doc;
}
export function initializeNicoleSkillInitialDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isNicoleSkillInitialAction(document)) return document;
  const doc = structuredClone(document) as NicoleSkillInitialDocument; doc.gameContext.nicoleSkillInitial ??= {};
  return prepareNicoleSkillInitialDocument(doc);
}
export function resetNicoleSkillInitialPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const context = nicoleSkillInitialContext(document); if (!isNicoleSkillInitialAction(document) || !context) return;
  delete context.finalizedHitState; delete context.skillGrantNonExtraAttack; delete context.grantAttackSource;
  if (mode === "fresh-equipment") Object.assign(context, { includedSkillAttack: 0, c2AttackIncludedInPanel: false,
    a1AttackIncludedInPanel: false, includedC2ResistanceReduction: 0 });
  else for (const key of ["noOtherEventsBeforeInitial", "noDisplacementBeforeInitial", "includedSkillAttack", "c2AttackIncludedInPanel",
    "a1AttackIncludedInPanel", "includedC2ResistanceReduction", "targetInC2AreaAtInitial"] as const) delete context[key];
}
export function finalizeNicoleSkillInitialPanelAccounting(document: CalculatorDocument): void {
  const context = nicoleSkillInitialContext(document); if (!isNicoleSkillInitialAction(document) || !context) return;
  for (const hit of document.hits) if (hit.kind === "ordinary" && isNicoleSkillInitialHit(document, hit) && hit.finalSnapshot) {
    const next = identity(document, hit, context);
    if (context.finalizedHitState !== undefined && context.finalizedHitState !== next) throw new Error("不能重写已改变的妮可历史取样身份。");
    context.finalizedHitState = next;
  }
}
