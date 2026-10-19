import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import type { FormulaExpression } from "./calculation-trace";
import { LUNAR_ARTIFACT_BONUS_RULES } from "@genshin-dps-lab/reaction-formulas";

/** Supplied by the active, promoted source adapter, never restored from a calculator JSON file. */
export interface CalculatorTrustedReleasedSource {
  datasetId: string;
  gameVersion: string;
  snapshotId: string;
  promotionId: string;
  releaseStatus: "released";
  verifiedDependencies: readonly { id: string; evidenceRefs: readonly string[] }[];
  hitContracts: readonly { hitId: string; sourceContract: string; dependencyIds: readonly string[] }[];
}
export interface CalculatorTrustContext {
  /** Compatibility only. Dataset names cannot certify a formula or its coefficients. */
  trustedVerifiedDatasetIds?: readonly string[];
  trustedReleasedSources?: readonly CalculatorTrustedReleasedSource[];
}

// The input origin and its numeric domain remain in the contract. Relabelling a
// source constant as an editable condition therefore cannot reuse a source grant.
const conditionOrigins = new Set([
  "conditioned-user-input", "derived-character-context", "explicit-accounting",
  "equipment-explicit-context", "artifact-explicit-context", "derived-incoming-context"
]);
function formulaContract(formula: CalculatorFormula | undefined): unknown {
  if (!formula) return undefined;
  return {
    ruleId: formula.ruleId, expression: formula.expression, requirements: formula.requirements,
    sourceRefs: formula.sourceRefs,
    inputs: formula.inputs.map(({ meaningKey: _meaning, value, ...input }) => ({
      ...input, ...(conditionOrigins.has(input.origin) ? {} : { value })
    }))
  };
}
function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
function expressionVariables(expression: FormulaExpression, result = new Set<string>()): Set<string> {
  switch (expression.kind) {
    case "variable": result.add(expression.key); break;
    case "constant": break;
    case "lookup": expression.indices.forEach(index => expressionVariables(index, result)); break;
    case "add": case "multiply": case "min": case "max": expression.terms.forEach(term => expressionVariables(term, result)); break;
    case "subtract": case "divide": expressionVariables(expression.left, result); expressionVariables(expression.right, result); break;
    case "truncate": expressionVariables(expression.value, result); break;
    case "clamp": [expression.value, expression.min, expression.max].forEach(term => expressionVariables(term, result)); break;
    case "condition": [expression.left, expression.right, expression.whenTrue, expression.whenFalse].forEach(term => expressionVariables(term, result)); break;
  }
  return result;
}
function ascensionFor(doc: CalculatorDocument): number | undefined {
  return (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
}
function formulaApplies(doc: CalculatorDocument, hit: CalculatorHit, formula: CalculatorFormula): boolean {
  const req = formula.requirements, ascension = ascensionFor(doc);
  return (req?.minimumAscension === undefined || ascension === undefined || ascension >= req.minimumAscension)
    && (!req?.elements || hit.kind !== "ordinary" || req.elements.includes(hit.element))
    && (!req?.attackTags || hit.kind !== "ordinary" || hit.attackTag === undefined || req.attackTags.includes(hit.attackTag));
}
function activeHitFormulaEntries(doc: CalculatorDocument, hit: CalculatorHit): [string, CalculatorFormula][] {
  if (hit.kind !== "ordinary") return [];
  const entries: [string, CalculatorFormula | undefined][] = [
    ["baseDamage",hit.baseDamageFormula], ["additiveBase",hit.additiveBaseFormula], ["damageBonus",hit.damageBonusFormula],
    ["resistance",hit.effectiveResistance === undefined ? hit.resistanceReductionFormula : undefined],
    ["critRate",hit.critEligible && hit.effectiveCritRate === undefined ? hit.critRateFormula : undefined],
    ["critDamage",hit.critEligible && hit.effectiveCritDamage === undefined ? hit.critDamageFormula : undefined],
    ["elementalMastery",hit.elementalMasteryAdjustment?.accounting === "add-to-panel" ? hit.elementalMasteryAdjustment.formula : undefined],
    ["attack",hit.attackAdjustment?.accounting === "add-to-panel" ? hit.attackAdjustment.formula : undefined],
    ["incomingThrillingTales",hit.incomingThrillingTalesFormula]
  ];
  return entries.filter((entry): entry is [string,CalculatorFormula] => !!entry[1] && formulaApplies(doc,hit,entry[1]));
}
function activeHitFormulas(doc: CalculatorDocument, hit: CalculatorHit): CalculatorFormula[] {
  return activeHitFormulaEntries(doc,hit).map(([,formula])=>formula);
}

function equipmentRules(doc: CalculatorDocument, hit: CalculatorHit) {
  if (doc.build.mode !== "equipment-derived" || (hit.kind !== "ordinary" && hit.kind !== "transformative") || (hit.kind === "ordinary" && hit.finalSnapshot) || !doc.build.equipment) return undefined;
  const equipment = doc.build.equipment;
  const ordinary = hit.kind === "ordinary" ? hit : undefined;
  const reactionElements = {overload:"pyro",superconduct:"cryo",electroCharged:"electro",burning:"pyro",shatter:"physical",swirlPyro:"pyro",swirlHydro:"hydro",swirlCryo:"cryo",swirlElectro:"electro",bloom:"dendro",burgeon:"dendro",hyperbloom:"dendro"} as const;
  const element = hit.kind === "ordinary" ? hit.element : reactionElements[hit.reaction];
  const applicable = (rule: { elements?: readonly string[] | undefined; attackTags?: readonly string[] | undefined; weaponTypes?: readonly string[] | undefined }) =>
    !!ordinary && (!rule.elements || rule.elements.includes(element))
    && (!rule.attackTags || (ordinary.attackTag !== undefined && rule.attackTags.includes(ordinary.attackTag)))
    && (!rule.weaponTypes || (equipment.weaponType !== undefined && rule.weaponTypes.includes(equipment.weaponType)));
  const hitBonuses = (equipment.hitBonuses ?? []).filter(applicable);
  const dynamicHitBonuses = (equipment.dynamicHitBonuses ?? []).filter(applicable);
  const additiveBaseBonuses = (equipment.additiveBaseBonuses ?? []).filter(applicable);
  const criticalBonuses = (equipment.criticalBonuses ?? []).filter(rule => ordinary?.critEligible && applicable(rule) && (rule.target === "critRate" ? ordinary.effectiveCritRate : ordinary.effectiveCritDamage) === undefined);
  const pendingResistanceEffects = hit.effectiveResistance === undefined ? (equipment.pendingResistanceEffects ?? []).filter(rule => rule.elements.includes(element)) : [];
  const resistanceReductions = hit.effectiveResistance === undefined ? (equipment.resistanceReductions ?? []).filter(rule => rule.active !== false && rule.elements.includes(element)) : [];
  const reactions = new Set<string>([hit.reaction, ...(ordinary?.additiveReaction ? [ordinary.additiveReaction] : [])]);
  const reactionBonuses = (equipment.reactionBonuses ?? []).filter(rule => rule.reactions.some(reaction => reactions.has(reaction)));
  const pendingReactionEffects = (equipment.pendingReactionEffects ?? []).filter(rule => rule.reactions.some(reaction => reactions.has(reaction)));
  const needed = new Set<string>();
  if (ordinary && !ordinary.baseDamageFormula) for (const term of ordinary.terms) if (term.coefficient !== 0 && (term.minimumAscension === undefined || ascensionFor(doc) === undefined || ascensionFor(doc)! >= term.minimumAscension)) needed.add(term.stat);
  for (const formula of [...activeHitFormulas(doc, hit), ...dynamicHitBonuses, ...additiveBaseBonuses, ...criticalBonuses]) expressionVariables(formula.expression, needed);
  if (ordinary?.critEligible) { if (ordinary.effectiveCritRate === undefined) needed.add("critRate"); if (ordinary.effectiveCritDamage === undefined) needed.add("critDamage"); }
  if (hit.reaction !== "none" || ordinary?.additiveReaction) needed.add("em");
  const targetStat = {flatAtk:"atk",atkPercent:"atk",hpPercent:"hp",defPercent:"def",em:"em",critRate:"critRate",critDamage:"critDamage",energyRechargeBonus:"erRatio"} as const;
  const statModifiers = new Set<NonNullable<typeof equipment.statModifiers>[number]>();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const rule of equipment.statModifiers ?? []) if (!statModifiers.has(rule) && needed.has(targetStat[rule.target])) {
      statModifiers.add(rule); expressionVariables(rule.expression, needed); expanded = true;
    }
  }
  const baseStat = {characterBaseAtk:"atk",weaponBaseAtk:"atk",baseHp:"hp",baseDef:"def",weaponSecondary:"secondary"} as const;
  const propertyStat: Record<string, string> = { FIGHT_PROP_ATTACK:"atk",FIGHT_PROP_ATTACK_PERCENT:"atk",FIGHT_PROP_HP:"hp",FIGHT_PROP_HP_PERCENT:"hp",FIGHT_PROP_DEFENSE:"def",FIGHT_PROP_DEFENSE_PERCENT:"def",FIGHT_PROP_ELEMENT_MASTERY:"em",FIGHT_PROP_CRITICAL:"critRate",FIGHT_PROP_CRITICAL_HURT:"critDamage",FIGHT_PROP_CHARGE_EFFICIENCY:"erRatio" };
  const propertyElement:Record<string,string> = {FIGHT_PROP_PHYSICAL_ADD_HURT:"physical",FIGHT_PROP_FIRE_ADD_HURT:"pyro",FIGHT_PROP_WATER_ADD_HURT:"hydro",FIGHT_PROP_ICE_ADD_HURT:"cryo",FIGHT_PROP_ELEC_ADD_HURT:"electro",FIGHT_PROP_WIND_ADD_HURT:"anemo",FIGHT_PROP_ROCK_ADD_HURT:"geo",FIGHT_PROP_GRASS_ADD_HURT:"dendro"};
  const secondaryContributions = equipment.secondaryContributions.filter(entry => propertyStat[entry.property]
    ? needed.has(propertyStat[entry.property]!)
    : !!ordinary && equipment.bonusAccounting === "core-sourced-v1" && propertyElement[entry.property] === ordinary.element);
  const buildKeys:Record<string,readonly string[]> = {atk:["characterBaseAtk","weaponBaseAtk","atkPercent","flatAtk"],hp:["baseHp","hpPercent","flatHp"],def:["baseDef","defPercent","flatDef"],em:["em"],critRate:["critRate"],critDamage:["critDamage"],erRatio:["energyRechargeBonus"]};
  const build = doc.build as unknown as Record<string,unknown>;
  const panelInputs = Object.fromEntries([...needed].flatMap(stat=>(buildKeys[stat]??[]).map(key=>[key,build[key]])));
  return {
    characterId: equipment.characterId, weaponId: equipment.weaponId, level: equipment.level, ascension: equipment.ascension,
    weaponLevel: equipment.weaponLevel, weaponAscension: equipment.weaponAscension, refinement: equipment.refinement,
    sourceVersion: equipment.sourceVersion, weaponType: equipment.weaponType, bonusAccounting: equipment.bonusAccounting,
    panelInputs,
    derivedStats: equipment.derivedStats.filter(entry => entry.id === "weaponSecondary" ? secondaryContributions.some(source => source.sourceRef === entry.sourceRef) : needed.has(baseStat[entry.id])),
    secondaryContributions, hitBonuses, reactionBonuses, resistanceReductions,
    ...(pendingReactionEffects.length ? { pendingReactionEffects } : {}),
    ...(pendingResistanceEffects.length ? { pendingResistanceEffects } : {}),
    statModifiers: [...statModifiers], dynamicHitBonuses, additiveBaseBonuses, criticalBonuses
  };
}
function equipmentContract(doc: CalculatorDocument, hit: CalculatorHit): unknown {
  const equipment = equipmentRules(doc, hit);
  if (!equipment) return undefined;
  const mapped = (rule: {id:string;label:string;expression:FormulaExpression;inputs:CalculatorFormula["inputs"];sourceRefs:string[]}) => {
    const {label:_label, inputs:_inputs, expression:_expression, ...rest}=rule;
    return {...rest, formula:formulaContract({...rule,ruleId:rule.id})};
  };
  const reactionBonuses=equipment.reactionBonuses.map(rule=>{
    if(!rule.formula)return rule;
    const {value:_mirror,formula,label,...identity}=rule;
    return {...identity,formula:formulaContract({...formula,ruleId:rule.id,label,sourceRefs:rule.sourceRefs})};
  });
  return {...equipment,reactionBonuses,statModifiers:equipment.statModifiers.map(mapped),dynamicHitBonuses:equipment.dynamicHitBonuses.map(mapped),additiveBaseBonuses:equipment.additiveBaseBonuses.map(mapped),criticalBonuses:equipment.criticalBonuses.map(mapped)};
}
function hitContract(doc: CalculatorDocument, hit: CalculatorHit): unknown {
  const shared = {id:hit.id,kind:hit.kind,sourceRefs:hit.sourceRefs,dependencies:hit.dependencies};
  if (hit.kind === "ordinary" && hit.occurrence && !hit.occurrence.enabled) return {id:hit.id,kind:"inactive-occurrence",occurrence:{kind:hit.occurrence.kind,sourceHitId:hit.occurrence.sourceHitId,sourceRefs:hit.occurrence.sourceRefs}};
  if (hit.kind === "ordinary") return {
    ...shared, element:hit.element,attackTag:hit.attackTag,terms:hit.terms,critEligible:hit.critEligible,hitWeakPoint:hit.hitWeakPoint,
    groupMultiplier:hit.groupMultiplier,reaction:hit.reaction,additiveReaction:hit.additiveReaction,explicitReactionBase:hit.explicitReactionBase,
    formulas:activeHitFormulaEntries(doc,hit).map(([slot,formula])=>({slot,formula:formulaContract(formula)})),
    // Accounting/override modes affect which source formulas are actually executed.
    finalSnapshot:!!hit.finalSnapshot,effectiveResistance:hit.effectiveResistance===undefined?"source":"supplied",
    effectiveCritRate:hit.effectiveCritRate===undefined?"source":"supplied",effectiveCritDamage:hit.effectiveCritDamage===undefined?"source":"supplied",
    masteryAccounting:hit.elementalMasteryAdjustment?.accounting,attackAccounting:hit.attackAdjustment?.accounting,
    occurrence:hit.occurrence?{kind:hit.occurrence.kind,sourceHitId:hit.occurrence.sourceHitId,sourceRefs:hit.occurrence.sourceRefs}:undefined,
    finalizedEquipmentEffects:hit.finalizedEquipmentEffects?.map(effect=>({ruleId:effect.ruleId,kind:effect.kind,formula:formulaContract(effect)})),
    pendingReactionEffects:hit.pendingReactionEffects,pendingResistanceEffects:hit.pendingResistanceEffects,
    equipment:equipmentContract(doc,hit)
  };
  if (hit.kind === "special") return {...shared,branch:hit.context.branch,ruleVersion:hit.context.ruleVersion,
    contextMode:hit.context.context.mode,
    contributors:hit.context.contributors.map(contributor=>({id:contributor.id,
      base:contributor.base.kind==="direct-stat-talent"?{kind:contributor.base.kind,scalingStat:contributor.base.scalingStat,talentCoefficient:contributor.base.talentCoefficient,sourceRefs:contributor.base.sourceRefs}:{kind:contributor.base.kind,characterLevel:contributor.base.characterLevel,value:contributor.base.value,sourceRefs:contributor.base.sourceRefs},
      modifierSourceRefs:contributor.modifierSourceRefs,specialBaseBonusRules:contributor.specialBaseBonusRules?.map(rule=>({kind:rule.kind,providerId:rule.providerId})),
      ...(contributor.artifactBonus ? {artifactBonusRule:{kind:contributor.artifactBonus.kind,source:LUNAR_ARTIFACT_BONUS_RULES[contributor.artifactBonus.kind].source}} : {})
    })),
    stateProfile:hit.context.context.mode==="state-resolved"?{stateProfileId:hit.context.context.stateProfileId,contributorPolicy:hit.context.context.contributorPolicy,stateSourceRefs:hit.context.context.stateSourceRefs,sourceAbility:hit.context.context.sourceAbilityExecution?.abilityKey}:undefined
  };
  if (hit.kind === "transformative") return {...shared,reaction:hit.reaction,pendingReactionEffects:hit.pendingReactionEffects,pendingResistanceEffects:hit.pendingResistanceEffects,equipment:equipmentContract(doc,hit)};
  return shared;
}
/** Stable collision-free canonical binding, not a document-controlled verification flag. */
export function getCalculatorHitSourceContract(doc: CalculatorDocument, hitId: string): string {
  const hit=doc.hits.find(entry=>entry.id===hitId);
  if(!hit)throw new Error(`Unknown calculator hit: ${hitId}`);
  return `calculator-source-contract-v1:${canonical({ruleVersion:doc.ruleVersion,scope:doc.scope,
    identity:{characterId:doc.gameContext?.characterId,variantId:doc.gameContext?.variantId,abilityId:doc.gameContext?.abilityId,skillId:doc.gameContext?.skillId},
    hit:hitContract(doc,hit),weaponProc:doc.weaponProc?{weaponId:doc.weaponProc.weaponId,refinement:doc.weaponProc.refinement}:undefined,
    incomingThrillingTales:doc.incomingThrillingTales?{ownerId:doc.incomingThrillingTales.ownerId,refinement:doc.incomingThrillingTales.refinement}:undefined
  })}`;
}
/** Only the selected hit's numerical/rule dependencies, including applicable equipment. */
export function getCalculatorHitTrustDependencies(doc: CalculatorDocument, hitId: string): string[] {
  const hit=doc.hits.find(entry=>entry.id===hitId);
  if(!hit)throw new Error(`Unknown calculator hit: ${hitId}`);
  const inactiveOccurrence=hit.kind==="ordinary"&&hit.occurrence&&!hit.occurrence.enabled;
  const ids=new Set([`rule:${doc.ruleVersion}`,...(inactiveOccurrence?[]:hit.dependencies)]);
  const sources=(refs:readonly string[])=>refs.forEach(ref=>ids.add(`source:${ref}`));
  if(hit.kind==="ordinary"&&hit.occurrence){ids.add("rule:critical-hit-occurrence");sources(hit.occurrence.sourceRefs);if(inactiveOccurrence)return [...ids].sort();}
  sources(hit.sourceRefs);
  if(doc.weaponProc)ids.add(`weapon-proc:${doc.weaponProc.weaponId}`);
  if(doc.incomingThrillingTales&&hit.kind==="ordinary")ids.add("rule:incoming-thrilling-tales-atk-accounting-b4ae769");
  for(const formula of activeHitFormulas(doc,hit)){ids.add(`rule:${formula.ruleId}`);sources(formula.sourceRefs);}
  const equipment=equipmentRules(doc,hit);
  if(equipment){
    Object.keys(equipment.panelInputs).forEach(key=>ids.add(`equipment:panel:${key}`));
    equipment.derivedStats.forEach(entry=>sources([entry.sourceRef]));equipment.secondaryContributions.forEach(entry=>sources([entry.sourceRef]));
    for(const rule of [...equipment.hitBonuses,...equipment.reactionBonuses,...equipment.pendingReactionEffects??[],...equipment.pendingResistanceEffects??[],...equipment.resistanceReductions,...equipment.statModifiers,...equipment.dynamicHitBonuses,...equipment.additiveBaseBonuses,...equipment.criticalBonuses]){
      ids.add(`equipment:${rule.id}`);sources("sourceRefs" in rule?rule.sourceRefs:[rule.sourceRef]);
    }
  }
  if(hit.kind==="ordinary"||hit.kind==="transformative"){
    const reaction=hit.kind==="ordinary"?(hit.additiveReaction??hit.reaction):hit.reaction;
    for(const effect of hit.pendingResistanceEffects??[])if(hit.effectiveResistance===undefined){ids.add(`equipment:${effect.id}`);sources(effect.sourceRefs);}
    for(const effect of hit.pendingReactionEffects??[])if(reaction!=="none"&&effect.reactions.includes(reaction)){ids.add(`equipment:${effect.id}`);sources(effect.sourceRefs);}
  }
  if(hit.kind==="ordinary")for(const effect of hit.finalizedEquipmentEffects??[]){ids.add(`rule:${effect.ruleId}`);sources(effect.sourceRefs);}
  if(hit.kind==="special"){
    ids.add(`rule:${hit.context.ruleVersion}`);ids.add(`special:${hit.context.branch}`);
    for(const contributor of hit.context.contributors){sources(contributor.base.sourceRefs);sources(contributor.modifierSourceRefs);for(const rule of contributor.specialBaseBonusRules??[])ids.add(`rule:${rule.kind}`);if(contributor.artifactBonus){ids.add(`rule:lunar-artifact-b4ae769:${contributor.artifactBonus.kind}`);sources([LUNAR_ARTIFACT_BONUS_RULES[contributor.artifactBonus.kind].source]);}}
    if(hit.context.context.mode==="state-resolved"){ids.add(`rule:${hit.context.context.stateProfileId}`);sources(hit.context.context.stateSourceRefs);if(hit.context.context.sourceAbilityExecution)ids.add(`rule:${hit.context.context.sourceAbilityExecution.abilityKey}`);}
  }
  return [...ids].sort();
}
export function evaluateCalculatorTrust(doc: CalculatorDocument, trust: CalculatorTrustContext = {}): {verified:boolean;reasons:string[]} {
  if(doc.dataIdentity.releaseStatus!=="released")return {verified:false,reasons:["当前数据不属于已发布渠道。"]};
  const hits=doc.hits.filter(hit=>doc.selectedHitIds.includes(hit.id));
  // A whole-cast critical-triggered child also consumes its parent's critical probability.
  for(const hit of [...hits])if(doc.scope==="one-cast"&&hit.kind==="ordinary"&&hit.occurrence?.enabled){const parent=doc.hits.find(entry=>entry.id===hit.occurrence!.sourceHitId);if(parent&&!hits.includes(parent))hits.push(parent);}
  const reasons:string[]=[];
  for(const hit of hits){
    const inactiveOccurrence=hit.kind==="ordinary"&&hit.occurrence&&!hit.occurrence.enabled;
    const missing=(inactiveOccurrence?[]:hit.dependencies).filter(id=>{const dependency=doc.dependencies.find(entry=>entry.id===id);return !dependency||dependency.status==="missing";});
    if(missing.length){reasons.push(`${hit.label}：本击仍缺少必要依赖 ${missing.join("、")}。`);continue;}
    const dependencyIds=getCalculatorHitTrustDependencies(doc,hit.id),contract=getCalculatorHitSourceContract(doc,hit.id);
    const granted=trust.trustedReleasedSources?.some(source=>source.releaseStatus==="released"&&source.datasetId===doc.dataIdentity.datasetId&&source.gameVersion===doc.dataIdentity.gameVersion&&source.snapshotId.trim().length>0&&source.promotionId.trim().length>0&&source.hitContracts.some(grant=>grant.hitId===hit.id&&grant.sourceContract===contract&&grant.dependencyIds.length===dependencyIds.length&&dependencyIds.every(id=>grant.dependencyIds.includes(id)&&source.verifiedDependencies.some(evidence=>evidence.id===id&&evidence.evidenceRefs.length>0&&evidence.evidenceRefs.every(ref=>ref.trim().length>0)))));
    if(!granted)reasons.push(`${hit.label}：未找到正式晋升快照中与当前来源公式绑定、且覆盖本击全部相关依赖的验证凭据。`);
  }
  return {verified:reasons.length===0,reasons};
}
