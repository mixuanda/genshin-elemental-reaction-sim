import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import type { CalculatorDocument } from "./calculator-model";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { wandererPrimaryMappings } from "../../game-data/src/character-mappings/wanderer-primary-mappings";
import { durinBurstMappings } from "../../game-data/src/character-mappings/durin-burst-mappings";
import { finalizeWandererPrimaryPanelAccounting, type WandererPrimaryDocument } from "./wanderer-primary-formulas";
import { finalizeDurinBurstPanelAccounting, type DurinBurstDocument } from "./durin-burst-formulas";

export function wandererEntryFixture(skillId = "wanderer-windfavored-normal-1", talent = 10): WandererPrimaryDocument {
  const doc = structuredClone(getCharacterDocuments("character:10000075", talent)[0]!) as WandererPrimaryDocument;
  doc.characterLevel = 100; doc.dependencies = [];
  const q = skillId === "wanderer-kyougen-five-hits";
  doc.gameContext = {characterId: "character:10000075", characterName: "流浪者", abilityId: `talent:wanderer:${q ? "combat3" : "combat1"}`, skillId,
    skillName: "固定来源角色模块测试", effectiveTalentLevel: talent, constellation: 6, ascension: 6, scopeCoverage: q ? "complete-cast" : "single-hit", attributionPolicy: "测试夹具，不是玩家UID数据",
    wandererPrimary: {skillTalentLevel: 13, absorptionBonuses: "neither", pyroAttackIncludedPercent: 0, cryoCritRateIncludedPercent: 0, c6ParentQualified: true,
      burstWindfavoredAtCast: true, burstC2ConsumedPointsUpTo50: 50, burstC2IncludedPercent: 0, burstAllHitsConnected: true, burstConditionsStable: true}};
  doc.hits = wandererPrimaryMappings.filter(row => row.skillId === skillId).map(row => ({id: row.id, label: row.hitLabel, kind: "ordinary", element: "anemo", attackTag: q ? "burst" : "normal",
    terms: [{stat: "atk", coefficient: row.sourceCoefficientValues![talent - 1]!}], additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: []}));
  doc.scope = q ? "one-cast" : "single-hit"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.build = {mode: "imported-final", ascension: 6, source: "Explicit arithmetic fixture, not showcase", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}};
  doc.enemy = {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0};
  return doc;
}
export function durinEntryFixture(): DurinBurstDocument {
  const doc = structuredClone(getCharacterDocuments("character:10000123", 10)[0]!) as DurinBurstDocument;
  doc.characterLevel = 90; doc.dependencies = [];
  doc.gameContext = {characterId: "character:10000123", characterName: "杜林", abilityId: "talent:durin:combat3", skillId: "durin-white-q-tick",
    skillName: "白焰之龙单次追击", effectiveTalentLevel: 10, constellation: 2, ascension: 6, scopeCoverage: "single-hit", attributionPolicy: "测试夹具，不是玩家UID数据",
    durinBurst: {tickIndex: 1, c2PyroBonusActive: true, c2PyroBonusIncluded: false}};
  doc.hits = [{id: durinBurstMappings[0]!.id, label: "白Q单次追击", kind: "ordinary", element: "pyro", attackTag: "burst", terms: [{stat: "atk", coefficient: 1.70352}],
    additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: []}];
  doc.scope = "single-hit"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.build = {mode: "imported-final", ascension: 6, source: "Explicit arithmetic fixture, not showcase", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}};
  doc.enemy = {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0};
  return doc;
}

/** Isolated shared-formula protocol: evaluates the exact prepared hits while
 * public new-action registration/schema are owned by root. It deliberately
 * does not claim getCharacterDocuments or aggregate JSON is already wired.
 * Keeping this explicit protocol ID avoids an adapter silently deleting a
 * registered context and then triggering preparation again after integration. */
function formulaProtocol(document: CalculatorDocument): CalculatorDocument {
  const doc = structuredClone(document) as WandererPrimaryDocument & DurinBurstDocument;
  delete doc.gameContext.wandererPrimary; delete doc.gameContext.durinBurst;
  doc.gameContext.skillId = "isolated-role-source-formula-protocol";
  doc.gameContext.skillName = "隔离的固定来源公式验证；正式入口由集成测试验证";
  return doc;
}
export const evaluatePreparedRoleFormulas = (document: CalculatorDocument) => calculateDocument(formulaProtocol(document));
export function convertPreparedRoleFormulas(document: CalculatorDocument): CalculatorDocument {
  const game = structuredClone(document.gameContext!), doc = convertCalculatorToFinalPanel(formulaProtocol(document), "imported-final");
  doc.gameContext = {...game};
  finalizeWandererPrimaryPanelAccounting(doc); finalizeDurinBurstPanelAccounting(doc);
  return doc;
}
