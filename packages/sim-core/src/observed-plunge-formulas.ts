import type { CalculatorDocument, CalculatorHit } from "./calculator-model";
import { observedPlungeContextSchema } from "./observed-plunge-context";
import { optimizerAdditionalPlungeCastMappings } from "../../game-data/src/character-mappings/optimizer-additional-mappings";
import { optimizerKachinaMappings } from "../../game-data/src/character-mappings/optimizer-kachina-mappings";
import type { SourceHitMapping } from "../../game-data/src/character-mappings/types";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const sourcePrefix = "observed-plunge:";

function plungeKind(document: CalculatorDocument): { height: "low" | "high"; character: string } | undefined {
  const id = document.gameContext?.skillId ?? "";
  const match = /^(lohen|linnea|sandrone|alyosha|kachina)-plunge-(low|high)-(?:observed-base|with-collision)$/.exec(id);
  return match ? { character: match[1]!, height: match[2] as "low" | "high" } : undefined;
}

export const isObservedPlungeAction = (document: CalculatorDocument): boolean => plungeKind(document) !== undefined;

function identity(document: CalculatorDocument, hitId: string): string {
  const context = document.gameContext!.observedPlunge ?? {};
  return JSON.stringify({ skillId: document.gameContext!.skillId, hitId,
    talentLevel: document.gameContext!.effectiveTalentLevel, constellation: document.gameContext!.constellation,
    collisionCount: context.collisionCount, collisionContacts: context.collisionContacts,
    landingContact: context.landingContact, statsStableAcrossHits: context.statsStableAcrossHits,
    targetConditionsStableAcrossHits: context.targetConditionsStableAcrossHits,
    noExternalInfusion: context.noExternalInfusion, targetId: context.targetId });
}

function representative(document: CalculatorDocument, role: "collision" | "landing"): OrdinaryHit | undefined {
  const skillId = document.gameContext!.skillId;
  const position = role === "collision" ? 1 : 2;
  const previous = document.hits.find((hit): hit is OrdinaryHit => hit.kind === "ordinary" &&
    (hit.id === `${skillId}-hit-${position}` || role === "collision" && hit.id.includes(":collision-") || role === "landing" && hit.id.endsWith(":landing")));
  if (previous) return previous;
  const mapping: SourceHitMapping | undefined = [...optimizerAdditionalPlungeCastMappings, ...optimizerKachinaMappings]
    .find((entry) => entry.skillId === skillId && entry.id.endsWith(`hit-${position}`));
  if (!mapping) return undefined;
  const level = document.gameContext!.effectiveTalentLevel;
  const coefficient = mapping.sourceCoefficientValues?.[level - 1];
  if (coefficient === undefined) return undefined;
  const field = `${mapping.talentSetId}.${mapping.abilityKey}.parameters.${mapping.parameterKey}[${level - 1}]`;
  return {
    id: mapping.id, label: mapping.hitLabel, kind: "ordinary", element: mapping.element, attackTag: "plunge",
    terms: [{ stat: "atk", coefficient }], additiveBaseDamage: 0, damageBonus: 0,
    critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1,
    sourceRefs: mapping.sourcePaths.map((path) => `https://github.com/${mapping.sourceRepository}/blob/${mapping.sourceCommit}/${path}`),
    dependencies: [field, "conditioned-action"],
  };
}

/** Shared calculator-AST expansion of actual collision opportunities and landing contact. */
export function prepareObservedPlungeDocument(document: CalculatorDocument): CalculatorDocument {
  const kind = plungeKind(document);
  if (!kind || !document.gameContext) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const previousHits = new Map(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map((hit) => [hit.id, hit]));
  const context = observedPlungeContextSchema.parse(game.observedPlunge ?? {});
  game.observedPlunge = context;
  const skillId = game.skillId;
  const collision = representative(result, "collision");
  const landing = representative(result, "landing");
  if (!collision || !landing) return result;
  const originals = [collision, landing];
  result.dependencies = result.dependencies.filter((row) => !row.id.startsWith(sourcePrefix));
  const refs = [...new Set([...collision.sourceRefs, ...landing.sourceRefs])];
  const physicalIssues = [] as string[];
  if (context.noExternalInfusion !== true) physicalIssues.push("须明确本次无外部附魔；固定来源仅支持此物理下落分支。");
  if (game.constellation !== 0) physicalIssues.push("此基础下落分支仅审阅 C0；其他命座须独立核对。");
  const both = (hit: OrdinaryHit): boolean => hit.reaction === "none" && hit.additiveReaction === undefined;
  if (originals.some((hit) => !both(hit))) physicalIssues.push("来源下落碰撞反应关闭；物理碰撞与落地不能指定元素增幅或激化。");
  const addDependency = (id: string, reasons: string[], hits: CalculatorHit[]): void => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "已明确本动作实际接触与物理基础条件。", sourceRefs: refs });
    for (const hit of hits) hit.dependencies = [...new Set([...hit.dependencies, id])];
  };
  const preserveSnapshot = (hit: OrdinaryHit): void => {
    const prior = previousHits.get(hit.id);
    if (!prior?.finalSnapshot) { delete hit.finalSnapshot; return; }
    if (prior.finalSnapshot.origin !== "equipment-conversion" || context.finalizedHitEvents?.[hit.id] === identity(result, hit.id)) {
      hit.finalSnapshot = structuredClone(prior.finalSnapshot);
    } else delete hit.finalSnapshot;
  };
  if (result.scope === "single-hit") {
    result.hits = result.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary");
    if (!result.hits.length) result.hits = originals;
    addDependency(`${sourcePrefix}physical`, physicalIssues, result.hits);
    result.selectedHitIds = result.selectedHitIds.filter((id) => result.hits.some((hit) => hit.id === id)).slice(0, 1);
    if (!result.selectedHitIds.length) result.selectedHitIds = [result.hits[0]!.id];
    game.scopeCoverage = "single-hit";
    return result;
  }
  const scheduleIssues = [...physicalIssues];
  if (context.collisionCount === undefined) scheduleIssues.push("须输入实际途中碰撞机会次数；低／高空分支不决定碰撞数。");
  if (context.landingContact === undefined) scheduleIssues.push("须确认落地冲击是否实际接触所选目标。");
  const count = context.collisionCount;
  const possibleContacts = (count === undefined ? 0 : Array.from({ length: count }, (_, index) => context.collisionContacts?.[String(index + 1)]).filter((contact) => contact !== false).length)
    + Number(context.landingContact !== false);
  if (count !== undefined) for (let index = 1; index <= count; index++) {
    if (context.collisionContacts?.[String(index)] === undefined) scheduleIssues.push(`须确认第 ${index} 次途中碰撞是否接触所选目标。`);
  }
  const expanded: CalculatorHit[] = [];
  if (count !== undefined) for (let index = 1; index <= count; index++) {
    if (context.collisionContacts?.[String(index)] === false) continue;
    const hit = structuredClone(collision);
    hit.id = `${skillId}:collision-${index}`;
    hit.label = `第 ${index} 次途中碰撞${context.collisionContacts?.[String(index)] === undefined ? "（接触待确认）" : ""}`;
    hit.dependencies = hit.dependencies.filter((id) => !id.startsWith(sourcePrefix));
    preserveSnapshot(hit);
    expanded.push(hit);
  }
  if (context.landingContact !== false) {
    const hit = structuredClone(landing);
    hit.id = `${skillId}:landing`;
    hit.label = `${kind.height === "low" ? "低空" : "高空"}落地冲击${context.landingContact === undefined ? "（接触待确认）" : ""}`;
    hit.dependencies = hit.dependencies.filter((id) => !id.startsWith(sourcePrefix));
    preserveSnapshot(hit);
    expanded.push(hit);
  }
  if (!expanded.length && count !== undefined && context.landingContact === false) expanded.push({
    id: `${skillId}:no-contact`, label: "所选目标没有受到本次下落伤害", kind: "non-damaging",
    reason: "已观察所有途中碰撞及落地均未接触此目标。", sourceRefs: refs, dependencies: [],
  });
  result.hits = expanded.length ? expanded : originals;
  if (possibleContacts > 1 && context.statsStableAcrossHits !== true) {
    const missing = result.hits.filter((hit) => hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion"));
    if (missing.length) scheduleIssues.push(`进攻面板未确认稳定；须提供逐击实际历史快照：${missing.map(hit => hit.label).join("、")}。当前构筑转换值不能代替历史观察。`);
    if (context.targetConditionsStableAcrossHits !== true) scheduleIssues.push("历史快照只保存进攻数值；须另外确认目标等级、防御与抗性条件在这些命中间稳定。");
  }
  addDependency(`${sourcePrefix}schedule`, scheduleIssues, result.hits);
  result.selectedHitIds = result.hits.map((hit) => hit.id);
  game.scopeCoverage = scheduleIssues.length ? "selected-components" : "complete-cast";
  game.attributionPolicy = `所选${kind.height === "low" ? "低空" : "高空"}下落只合计明确接触目标的物理途中碰撞与落地；逐次接触和次数由观察输入，不推断高度阈值、帧数或反应。`;
  return result;
}

export function resetObservedPlungePanelAccounting(document: CalculatorDocument, _mode: "fresh-equipment" | "imported-final"): void {
  if (!isObservedPlungeAction(document)) return;
  const context = document.gameContext!.observedPlunge ??= {};
  delete context.finalizedHitEvents;
  for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
}

export function finalizeObservedPlungePanelAccounting(document: CalculatorDocument): void {
  if (!isObservedPlungeAction(document)) return;
  const context = document.gameContext!.observedPlunge ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary")
    .map((hit) => [hit.id, identity(document, hit.id)]));
}
