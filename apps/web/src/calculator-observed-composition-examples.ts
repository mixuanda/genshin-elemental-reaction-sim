import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { createObservedSpecialComponentDocument } from "../../../packages/sim-core/src/observed-special-component-formulas";
import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { OBSERVED_SKILL_COMPOSITION_VERSION, type ObservedSkillCompositionDocument } from "../../../packages/sim-core/src/observed-skill-composition";
import { getCharacterDocuments } from "./character-calculations";

const characterId = (slug: string): string => {
  const character = gameDataCatalog.characters.find((entry) => entry.slug === slug);
  if (!character) throw new Error(`缺少目录角色 ${slug}，无法创建来源观察示例。`);
  return character.id;
};

function sourcedDocument(slug: string, skillId: string): CalculatorDocument {
  const document = getCharacterDocuments(characterId(slug), 1)
    .find((entry) => entry.gameContext?.skillId === skillId);
  if (!document) throw new Error(`目录没有 ${slug}/${skillId} 的可编辑来源文档。`);
  return structuredClone(document);
}

function singleHit(document: CalculatorDocument, hitId?: string): CalculatorDocument {
  const result = structuredClone(document);
  const hit = hitId ? result.hits.find((entry) => entry.id === hitId)
    : result.hits.find((entry) => entry.kind !== "blocked");
  if (!hit) throw new Error(`来源文档 ${document.id} 没有可选择的实际命中。`);
  result.scope = "single-hit";
  result.selectedHitIds = [hit.id];
  if (result.gameContext) result.gameContext.scopeCoverage = "single-hit";
  result.assumptions.push("这是可编辑的教学观察输入，不是游戏实测；请按实际面板和事件改写。 ");
  return result;
}

function specialDocument(base: CalculatorDocument, componentId: string): CalculatorDocument {
  return createObservedSpecialComponentDocument(base, componentId);
}

/** Editable source-backed examples; every time, state and miss is explicitly instructional. */
export function createObservedSkillCompositionExamples(): ObservedSkillCompositionDocument[] {
  const enemy = "teaching-target";
  const linneaPair = singleHit(sourcedDocument("linnea", "linnea-lumi-pummeler-pair"));
  const linneaHammer = singleHit(specialDocument(linneaPair, "linnea-lumi-heavy-overdrive-hammer-component"));
  linneaHammer.gameContext!.observedSpecialComponent = {
    casterId: "linnea", targetId: enemy, actualComponentOccurred: true,
    sharedState: {
      intrinsicStatMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
      linneaA4AppliesToSelf: true, a4PreConversionStat: 1000, includedCharacterEm: 0,
      lumiForm: "super-power", nearbyMoondrift: true, lumiPresent: true,
      targetWithinLumiA1Range: true, moonsignLevel: 2, includedResistanceReduction: 0,
    },
  };
  linneaHammer.assumptions.push("教学假设：C0、突破六阶、A4本人适用、月兆2、超强形态、附近有月笼；面板与敌人条件均需按真实观察恢复。");
  const linneaContext: Extract<ObservedSkillCompositionDocument, { profile: "linnea-lumi" }>['context'] = {
    character: "linnea", constellation: 0, initialLumiAbsentKnown: true,
    eventsObservedThroughSelected: true, observedOrderConfirmed: true,
    events: [
      { id: "linnea-e-summon", kind: "skill-tap", frame: 0, order: 0, summonId: "lumi-example-1", observedEffect: "summon", observedExpiresFrame: 1500, actionReadyConfirmed: true },
      { id: "linnea-form-standard", kind: "form-observed", frame: 30, order: 30, summonId: "lumi-example-1", form: "standard-power" },
      { id: "linnea-pair-1", kind: "attack-contact", frame: 120, order: 120, summonId: "lumi-example-1", attackId: "pair-1-first", component: "pummeler-1", pairId: "pair-1", targetId: enemy, contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: false, moonsignLevel: 2, snapshotFrame: 120, snapshotId: "linnea-pair-1-panel" },
      { id: "linnea-pair-2", kind: "attack-contact", frame: 122, order: 122, summonId: "lumi-example-1", attackId: "pair-1-second", component: "pummeler-2", pairId: "pair-1", targetId: enemy, contactConfirmed: false, targetWithinLumiA1Range: true, nearbyMoondrift: false, moonsignLevel: 2 },
      { id: "linnea-form-super", kind: "form-observed", frame: 180, order: 180, summonId: "lumi-example-1", form: "super-power" },
      { id: "linnea-hammer", kind: "attack-contact", frame: 240, order: 240, summonId: "lumi-example-1", attackId: "hammer-1", component: "hammer", targetId: enemy, contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: true, moonsignLevel: 2, snapshotFrame: 240, snapshotId: "linnea-hammer-panel" },
      { id: "linnea-departure", kind: "depart-observed", frame: 1500, order: 1500, summonId: "lumi-example-1", reason: "expired" },
    ],
  };
  const linnea: ObservedSkillCompositionDocument = {
    schemaVersion: OBSERVED_SKILL_COMPOSITION_VERSION, profile: "linnea-lumi",
    id: "teaching-linnea-e-summon-observation", label: "莉奈娅 E 召唤：普通双击与重锤教学观察",
    targetId: enemy, originEventId: "linnea-e-summon", endEventId: "linnea-departure",
    allOpportunitiesRecorded: true, damageWindowClosed: true,
    dataIdentity: structuredClone(linneaPair.dataIdentity),
    context: linneaContext,
    components: [
      { id: "linnea-pummeler-first", eventId: "linnea-pair-1", document: linneaPair },
      { id: "linnea-super-hammer", eventId: "linnea-hammer", document: linneaHammer },
    ],
    unmappedOpportunities: [],
    assumptions: [
      "教学观察，不是游戏实测；事件帧、命中／落空、面板快照、目标范围与月兆等级均为可编辑的示范输入。",
      "默认角色面板是计算器中的教学面板；应逐段恢复命中时实际面板，不把示例数值当作实测或毕业配装。",
      "已观察到一个 E 新召唤实体并记录到实际离场；列出的攻击机会仅用于展示归属，不声称普遍攻击节奏或完整机制验证。",
    ],
  };

  const sandroneBeam = singleHit(sourcedDocument("sandrone", "sandrone-charged-beamdmg-component"), "sandrone-charged-beamdmg-component-hit-1");
  const sandroneSwirl = singleHit(specialDocument(sandroneBeam, "sandrone-charged-beam-stellar-swirl-component"));
  sandroneSwirl.gameContext!.observedSpecialComponent = {
    casterId: "sandrone", targetId: enemy, actualComponentOccurred: true,
    sharedState: {
      intrinsicStatMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
      a4PreConversionStat: 1000, includedCharacterEm: 0,
      actualRadiance: "stellar-swirl", decodingMode: true,
    },
  };
  sandroneSwirl.assumptions.push("教学假设：C0、突破六阶、解析模式且本击有星扩散；专属加成、面板抵扣和敌人条件须按实际状态恢复。");
  const sandroneContext: Extract<ObservedSkillCompositionDocument, { profile: "sandrone-fagio-window" }>['context'] = {
    events: [
      { id: "sandrone-window-start", frame: 0, kind: "window-start" },
      { id: "sandrone-mode-decoding", frame: 1, kind: "observe-mode", mode: "decoding" },
      { id: "sandrone-radiance-none", frame: 2, kind: "observe-radiance", radiance: "none" },
      { id: "sandrone-ordinary-beam", frame: 30, kind: "hit", hitKind: "beam", targetId: enemy, snapshotFrame: 30, snapshotId: "sandrone-ordinary-panel", contact: true },
      { id: "sandrone-sweep-miss", frame: 45, kind: "hit", hitKind: "sweep", targetId: enemy, snapshotFrame: 45, snapshotId: "sandrone-miss-observation", contact: false },
      { id: "sandrone-radiance-swirl", frame: 60, kind: "observe-radiance", radiance: "stellar-swirl" },
      { id: "sandrone-swirl-beam", frame: 72, kind: "hit", hitKind: "beam", targetId: enemy, snapshotFrame: 72, snapshotId: "sandrone-swirl-panel", contact: true },
      { id: "sandrone-window-end", frame: 120, kind: "window-end" },
    ],
  };
  const sandrone: ObservedSkillCompositionDocument = {
    schemaVersion: OBSERVED_SKILL_COMPOSITION_VERSION, profile: "sandrone-fagio-window",
    id: "teaching-sandrone-fagio-observation", label: "桑多涅 Fagio 星扩散光束观察区间教学示例",
    targetId: enemy, originEventId: "sandrone-window-start", endEventId: "sandrone-window-end",
    allOpportunitiesRecorded: true, damageWindowClosed: true,
    dataIdentity: structuredClone(sandroneBeam.dataIdentity), context: sandroneContext,
    components: [
      { id: "sandrone-ordinary-beam", eventId: "sandrone-ordinary-beam", document: sandroneBeam },
      { id: "sandrone-swirl-beam", eventId: "sandrone-swirl-beam", document: sandroneSwirl },
    ],
    unmappedOpportunities: [],
    assumptions: [
      "教学观察，不是游戏实测；窗口边界、模式、辉映、命中／落空、帧与面板身份均为可编辑示范输入。",
      "本示例仅记录无辉映普通凝聚光束与后续星扩散光束；扫射与超载射击的普通冰伤分量可另按实际观察输入计算。一次落空保留在窗口账本中且不计伤害。",
      "固定来源表达式不证明游戏内机制、持续按住时长或动作间隔；请恢复各击实际状态和面板。",
    ],
  };
  return [linnea, sandrone];
}
