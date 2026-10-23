import {gamingDamageContextSchema} from './gaming-damage-context';
import {xiaoDamageContextSchema} from "./xiao-damage-context";
import { rawSourceStateContextSchema } from "./raw-source-state-context";
import { observedCharacterResourceContextSchema } from "./observed-character-resource-context";
import { alyoshaObservedContextSchema } from "./alyosha-observed-context";
import { neferObservedContextSchema } from "./nefer-observed-context";
import { linneaObservedContextSchema } from "./linnea-observed-context";
import { sandroneObservedLifecycleSchema } from "./sandrone-observed-context";
import { observedZibaiResourceContextSchema } from "./observed-zibai-resource-context";
import { observedSpecialComponentBaseSchema, observedSpecialComponentEventSchema } from "./observed-special-component-context";
import { neferPhantasmCastBaseSchema, neferPhantasmEventSchema } from "./nefer-phantasm-context";
import { iansanSwiftResolvedCastBaseSchema, iansanSwiftResolvedEventSchema } from "./iansan-swift-resolved-context";
import { travelerHydroResolvedCastBaseSchema, travelerHydroResolvedEventSchema } from "./traveler-hydro-resolved-context";
import { zibaiFiniteCastBaseSchema, zibaiFiniteEventSchema } from "./zibai-finite-context";
import { travelerCrossEntityCastBaseSchema, travelerCrossEntityEventSchema } from "./traveler-cross-entity-context";
import { travelerCryoStateCastBaseSchema, travelerCryoStateEventSchema } from "./traveler-cryo-state-context";
import { mixedSourceCastBaseSchema, mixedSourceEventSchema } from "./mixed-source-context";
import { noellePlungeCastBaseSchema, noellePlungeEventSchema } from "./noelle-plunge-context";
import { observedPlungeContextSchema } from "./observed-plunge-context";
import { extendedStanceCastBaseSchema, extendedStanceEventSchema } from "./extended-stance-context";
import { entityFollowupCastBaseSchema, entityFollowupEventSchema } from "./entity-followup-context";
import { z } from "zod";
import { idleStanceCastBaseSchema, idleStanceEventSchema } from "./idle-stance-context";
import { durinSkillContextSchema } from "./durin-skill-context";
import { observedEntityCastBaseSchema } from "./observed-entity-context";
import { kachinaCastBaseSchema } from "./kachina-cast-context";
import { periodicOrdinaryCastBaseSchema, periodicOrdinaryEventSchema } from "./periodic-ordinary-context";
import { travelerMaleChargedCastBaseSchema, travelerMaleChargedEventSchema } from "./traveler-male-charged-context";
import { conditionedSpecialCalculationSchema, weaponProcDefinitions, type WeaponProcId, type SpecialOutcome } from "@genshin-dps-lab/reaction-formulas";
import { evaluateFormulaExpression, validateFormulaExpression, type FormulaExpression, type CalculationTraceNode } from "./calculation-trace";

export const CALCULATOR_SCHEMA_VERSION = "1.0.0" as const;
export const CALCULATOR_RULE_VERSION = "ordinary-trace-v1" as const;
const num = z.number().finite();
const nonnegative = num.nonnegative();
const text = z.string().min(1);
const refs = z.array(text);
const elements=z.enum(["physical","pyro","hydro","cryo","electro","anemo","geo","dendro"]);
const weaponTypes=z.enum(["sword","claymore","polearm","bow","catalyst"]);
const attackTags=z.enum(["normal","charged","plunge","skill","burst","proc","reaction"]);
export const calculatorEquipmentReactionSchema=z.enum(["melt","reverseMelt","vaporize","reverseVaporize","aggravate","spread","overload","superconduct","electroCharged","burning","shatter","swirlPyro","swirlHydro","swirlCryo","swirlElectro","bloom","burgeon","hyperbloom"]);
export type CalculatorEquipmentReaction=z.infer<typeof calculatorEquipmentReactionSchema>;
const finalStats = z.strictObject({ atk: nonnegative, hp: nonnegative, def: nonnegative, em: nonnegative, critRate: num, critDamage: nonnegative,energyRecharge:nonnegative.optional() });
export const calculatorFormulaSchema=z.strictObject({
  ruleId:text,label:text,
  expression:z.custom<FormulaExpression>((value)=>{try{validateFormulaExpression(value);return true;}catch{return false;}},"Invalid typed formula expression"),
  inputs:z.array(z.strictObject({key:text,value:num,unit:text,meaningKey:text,origin:text,ownerId:text.optional(),minimum:num.optional(),maximum:num.optional(),integer:z.boolean().optional(),allowedValues:z.array(num).min(1).optional()}).superRefine((input,ctx)=>{if((input.minimum!==undefined&&input.value<input.minimum)||(input.maximum!==undefined&&input.value>input.maximum)||(input.integer&&!Number.isInteger(input.value))||(input.allowedValues&&!input.allowedValues.includes(input.value)))ctx.addIssue({code:"custom",message:`Formula input ${input.key} violates its sourced numeric domain`});})),sourceRefs:refs.min(1),
  requirements:z.strictObject({minimumAscension:z.number().int().min(0).max(6).optional(),minimumConstellation:z.number().int().min(0).max(6).optional(),maximumConstellation:z.number().int().min(0).max(6).optional(),elements:z.array(elements).optional(),attackTags:z.array(attackTags).optional()}).optional()
}).superRefine((formula,ctx)=>{
  if(new Set(formula.inputs.map(input=>input.key)).size!==formula.inputs.length)ctx.addIssue({code:"custom",message:"Formula input keys must be unique"});
  if(formula.inputs.some(input=>["atk","hp","def","em","erRatio"].includes(input.key)))ctx.addIssue({code:"custom",message:"Formula cannot override resolved panel variables atk/hp/def/em/erRatio"});
});
export type CalculatorFormula=z.infer<typeof calculatorFormulaSchema>;
const equipmentReactionFormula=z.strictObject({expression:calculatorFormulaSchema.shape.expression,inputs:calculatorFormulaSchema.shape.inputs,explanation:text}).superRefine((formula,ctx)=>{
  if(new Set(formula.inputs.map(input=>input.key)).size!==formula.inputs.length)ctx.addIssue({code:"custom",message:"Reaction formula input keys must be unique"});
});
const equipmentReactionBonus=z.strictObject({id:text,label:text,value:num,reactions:z.array(calculatorEquipmentReactionSchema),sourceRefs:refs,formula:equipmentReactionFormula.optional()}).transform((bonus,ctx)=>{
  if(!bonus.formula)return bonus;
  try{return {...bonus,value:evaluateFormulaExpression(bonus.formula.expression,Object.fromEntries(bonus.formula.inputs.map(input=>[input.key,input.value])))};}
  catch(error){ctx.addIssue({code:"custom",message:`Equipment reaction formula cannot execute: ${error instanceof Error?error.message:String(error)}`});return z.NEVER;}
});
const pendingEquipmentResistanceEffect=z.strictObject({id:text,label:text,elements:z.array(elements),reason:text,sourceRefs:refs});
export type CalculatorPendingResistanceEffect=z.infer<typeof pendingEquipmentResistanceEffect>;
const pendingEquipmentReactionEffect=z.strictObject({id:text,label:text,reactions:z.array(calculatorEquipmentReactionSchema),reason:text,sourceRefs:refs});
export type CalculatorPendingReactionEffect=z.infer<typeof pendingEquipmentReactionEffect>;
const equipmentHitFormula={id:text,label:text,elements:z.array(elements).optional(),attackTags:z.array(attackTags).optional(),weaponTypes:z.array(weaponTypes).optional(),inputPolicy:z.enum(["pre-conversion","final-panel"]),expression:calculatorFormulaSchema.shape.expression,inputs:calculatorFormulaSchema.shape.inputs,sourceRefs:refs};
const pendingEquipmentHitEffect=z.strictObject({id:text,label:text,reason:text,sourceRefs:refs,elements:z.array(elements).optional(),attackTags:z.array(attackTags).optional(),weaponTypes:z.array(weaponTypes).optional(),kind:z.enum(["additive-base","critRate","critDamage","damageBonus"]).optional()});
export type CalculatorPendingHitEffect=z.infer<typeof pendingEquipmentHitEffect>;
const finalizedEquipmentEffect=z.strictObject({ruleId:text,label:text,kind:z.enum(["additive-base","critRate","critDamage"]),amount:num,expression:calculatorFormulaSchema.shape.expression,inputs:calculatorFormulaSchema.shape.inputs,sourceRefs:refs}).superRefine((effect,ctx)=>{
  try{if(evaluateFormulaExpression(effect.expression,Object.fromEntries(effect.inputs.map(input=>[input.key,input.value])))!==effect.amount)ctx.addIssue({code:"custom",message:"Finalized equipment contribution does not match its saved expression and inputs"});}
  catch{ctx.addIssue({code:"custom",message:"Finalized equipment contribution requires its complete numerical inputs"});}
});
const equipmentMetadata = z.strictObject({
  characterId: text, weaponId: text, level: z.number().int().min(1), ascension: z.number().int().min(0), weaponLevel: z.number().int().min(1), weaponAscension: z.number().int().min(0), refinement: z.number().int().min(1), sourceVersion: text, sourceRefs: refs,
  characterLevelCap: z.union([z.literal(90), z.literal(95), z.literal(100)]).optional(),
  derivedStats: z.array(z.strictObject({id:z.enum(["characterBaseAtk","baseHp","baseDef","weaponBaseAtk","weaponSecondary"]),label:text,base:num,curve:num,promotion:num,sourceRef:text})),
  secondaryContributions:z.array(z.strictObject({property:text,value:num,sourceRef:text})), assumptions:refs,effectBlockers:refs,
  artifacts:z.array(z.strictObject({slot:z.enum(["flower","plume","sands","goblet","circlet"]),setId:text,rarity:z.number().int().min(1).max(5),level:z.number().int().min(0),mainStat:text,initialSubstats:z.number().int().min(0),substats:z.array(z.strictObject({stat:text,rolls:z.array(z.number().int().min(0).max(3))})),observed:z.strictObject({source:text,mainStatValue:nonnegative.optional(),substats:z.array(z.strictObject({stat:text,value:nonnegative}))}).optional()})).optional(),
  hitBonuses:z.array(z.strictObject({id:text,value:num,sourceRef:text,label:text,elements:z.array(elements).optional(),attackTags:z.array(attackTags).optional(),weaponTypes:z.array(weaponTypes).optional()})).optional(),
  reactionBonuses:z.array(equipmentReactionBonus).optional(),
  pendingReactionEffects:z.array(pendingEquipmentReactionEffect).optional(),
  pendingResistanceEffects:z.array(pendingEquipmentResistanceEffect).optional(),
  resistanceReductions:z.array(z.strictObject({id:text,label:text,value:num,elements:z.array(elements),sourceRefs:refs,active:z.boolean().optional(),conditionLabel:text.optional()})).optional(),
  statModifiers:z.array(z.strictObject({id:text,label:text,target:z.enum(["flatAtk","atkPercent","hpPercent","defPercent","em","critRate","critDamage","energyRechargeBonus"]),phase:z.enum(["pre-panel","conversion"]),expression:calculatorFormulaSchema.shape.expression,inputs:calculatorFormulaSchema.shape.inputs,sourceRefs:refs})).optional(),
  dynamicHitBonuses:z.array(z.strictObject({id:text,label:text,elements:z.array(elements).optional(),attackTags:z.array(attackTags).optional(),weaponTypes:z.array(weaponTypes).optional(),inputPolicy:z.enum(["pre-conversion","final-panel"]).optional(),expression:calculatorFormulaSchema.shape.expression,inputs:calculatorFormulaSchema.shape.inputs,sourceRefs:refs})).optional(),
  additiveBaseBonuses:z.array(z.strictObject(equipmentHitFormula)).optional(),
  criticalBonuses:z.array(z.strictObject({...equipmentHitFormula,target:z.enum(["critRate","critDamage"])})).optional(),
  pendingHitEffects:z.array(pendingEquipmentHitEffect).optional(),
  bonusAccounting:z.literal("core-sourced-v1").optional(),weaponType:weaponTypes.optional(),effectContext:z.strictObject({hpFraction:num.min(0).max(1).optional(),enemyHpFraction:num.min(0).max(1).optional(),enemyAuras:z.array(elements).optional(),weaponType:weaponTypes.optional(),weaponStacks:z.number().int().nonnegative().optional(),setStacks:z.number().int().nonnegative().optional(),shielded:z.boolean().optional(),offField:z.boolean().optional(),burstEffectActive:z.boolean().optional(),timedEffectActive:z.boolean().optional(),keyTeamBuffActive:z.boolean().optional(),setEffectActive:z.boolean().optional(),nightsoulFrontlineActive:z.boolean().optional(),targetFrozen:z.boolean().optional(),weaponEffectActive:z.boolean().optional(),energyFull:z.boolean().optional(),arrowTravelSeconds:nonnegative.optional(),vvPyroResActive:z.boolean().optional(),vvHydroResActive:z.boolean().optional(),vvCryoResActive:z.boolean().optional(),vvElectroResActive:z.boolean().optional(),timedSnapshotEm:nonnegative.optional(),keySnapshotHp:nonnegative.optional(),keyTeamSnapshotHp:nonnegative.optional(),
    sameElementTeammates:z.number().int().min(0).max(3).optional(),differentElementTeammates:z.number().int().min(0).max(3).optional(),
    setExtraEffectActive:z.boolean().optional(),setNormalEffectActive:z.boolean().optional(),setBurstEffectActive:z.boolean().optional(),witchLessonsCompleted:z.boolean().optional(),moonsignLevel:z.number().int().min(0).max(2).optional(),
    setBuffElements:z.array(elements.exclude(["physical"])).optional(),setExtraBuffElements:z.array(elements.exclude(["physical"])).optional(),
    echoesRiteActive:z.boolean().optional(),echoesCurrentAttack:nonnegative.optional(),songWavesActive:z.boolean().optional(),songRecordedHealing:nonnegative.optional(),songRemainingTriggers:z.number().int().min(0).max(5).optional(),targetSuperconductDebuffActive:z.boolean().optional(),paradiseLostStacks:z.number().int().min(0).max(4).optional(),
    normalHitEffectActive:z.boolean().optional(),skillBurstHitEffectActive:z.boolean().optional(),teamBurstEnergyTotal:nonnegative.optional(),nearbyEnemyCount:z.number().int().nonnegative().optional(),
    targetIsSlime:z.boolean().optional(),teamDistinctElementCount:z.number().int().min(1).max(4).optional(),bondOfLifeRatio:num.min(0).max(2).optional(),
    weakPointHit:z.boolean().optional(),weaponState:z.number().int().min(0).max(2).optional(),platformPassiveActive:z.boolean().optional(),
    weaponNormalStacks:z.number().int().min(0).max(6).optional(),weaponSkillStacks:z.number().int().min(0).max(6).optional(),weaponBurstStacks:z.number().int().min(0).max(6).optional(),
    secondaryWeaponStacks:z.number().int().nonnegative().optional(),weaponExtraEffectActive:z.boolean().optional(),energyZero:z.boolean().optional(),nightsoulBlessingActive:z.boolean().optional(),
    wearerEnergyMax:nonnegative.optional(),weaponSnapshotDef:nonnegative.optional(),clearedBondOfLife:nonnegative.optional(),catalystSong:z.number().int().min(0).max(3).optional(),
    catalystChargedWindowActive:z.boolean().optional(),catalystSkillWindowActive:z.boolean().optional(),catalystBurstWindowActive:z.boolean().optional(),catalystReactionWindowActive:z.boolean().optional(),catalystSecondaryWindowActive:z.boolean().optional(),catalystLunarWindowActive:z.boolean().optional(),catalystHexerei:z.boolean().optional(),
    catalystClearedBondHp:nonnegative.optional(),catalystSnapshotHp:nonnegative.optional(),catalystSnapshotAtk:nonnegative.optional(),catalystHydroCount:z.number().int().min(0).max(4).optional(),
    catalystSameElementCount:z.number().int().min(0).max(3).optional(),catalystDifferentElementCount:z.number().int().min(0).max(3).optional()
  }).optional(),weaponEffectsEnabled:z.boolean().optional(),setEffectsEnabled:z.boolean().optional()
}).superRefine((equipment, ctx) => {
  if (equipment.characterLevelCap === undefined) return;
  if (equipment.level > equipment.characterLevelCap) ctx.addIssue({ code: 'custom', path: ['characterLevelCap'], message: 'Character level exceeds the declared unlocked limit' });
  if (equipment.characterLevelCap > 90 && (equipment.ascension !== 6 || equipment.level < 90)) ctx.addIssue({ code: 'custom', path: ['characterLevelCap'], message: 'Advanced character level limits require ordinary ascension 6 and level 90 or higher' });
});
export const calculatorBuildSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("equipment-derived"), characterBaseAtk: nonnegative, weaponBaseAtk: nonnegative, atkPercent: num, flatAtk: num, baseHp: nonnegative, hpPercent: num, flatHp: num, baseDef: nonnegative, defPercent: num, flatDef: num, em: nonnegative, critRate: num, critDamage: nonnegative, energyRechargeBonus:num.optional(), equipment:equipmentMetadata.optional() }),
  z.strictObject({ mode: z.literal("manual-final"), stats: finalStats, source: text, ascension:z.number().int().min(0).max(6).optional() }),
  z.strictObject({ mode: z.literal("imported-final"), stats: finalStats, source: text, ascension:z.number().int().min(0).max(6).optional() })
]);
/** Complete numerical offensive context captured at a different time; target state remains per hit. */
export const calculatorFinalSnapshotSchema = z.strictObject({
  origin:z.literal("equipment-conversion").optional(),
  stats: finalStats, characterLevel: z.number().int().min(1).max(100), ascension: z.number().int().min(0).max(6),
  damageBonus: num, additiveBaseDamage: num, reactionBonus: num, source: text, sourceRefs: refs.min(1)
});
export type CalculatorFinalSnapshot = z.infer<typeof calculatorFinalSnapshotSchema>;
const sharedHit = { id: text, label: text, sourceRefs: refs, dependencies: refs };
const ordinary = z.strictObject({
  ...sharedHit, kind: z.literal("ordinary"), finalSnapshot: calculatorFinalSnapshotSchema.optional(), element: elements, attackTag:attackTags.optional(),
  coordinatedEvent:z.strictObject({templateRole:z.enum(["initial","proc"]),frame:nonnegative.int(),snapshotFrame:num.int(),snapshotId:text,targetId:text,projectile:nonnegative.int(),trigger:z.strictObject({kind:text,eventId:text,frame:nonnegative.int(),actorId:text.optional()})}).optional(),
  heldLifecycleEvent:z.strictObject({candidateId:text,templateRole:text,frame:nonnegative.int(),snapshotFrame:num.int(),snapshotId:text,targetId:text,triggerId:text.optional(),triggerFrame:nonnegative.int().optional()}).optional(),
  entityFollowupEvent:entityFollowupEventSchema.optional(),
  extendedStanceEvent:extendedStanceEventSchema.optional(),
  noellePlungeEvent:noellePlungeEventSchema.optional(),
  travelerHydroResolvedEvent:travelerHydroResolvedEventSchema.optional(),
  iansanSwiftResolvedEvent:iansanSwiftResolvedEventSchema.optional(),
  neferPhantasmEvent:neferPhantasmEventSchema.optional(),
  travelerCryoStateEvent:travelerCryoStateEventSchema.optional(),
  travelerCrossEntityEvent:travelerCrossEntityEventSchema.optional(),
  zibaiFiniteEvent:zibaiFiniteEventSchema.optional(),
  mixedSourceEvent:mixedSourceEventSchema.optional(),
  idleStanceEvent:idleStanceEventSchema.optional(),
  periodicOrdinaryEvent:periodicOrdinaryEventSchema.optional(),
  travelerMaleChargedEvent:travelerMaleChargedEventSchema.optional(),
  observedEntityEvent:z.strictObject({candidateId:text,templateRole:text,frame:nonnegative.int(),snapshotFrame:nonnegative.int(),snapshotId:text,targetId:text,launchFrame:nonnegative.int().optional(),scalingFrame:nonnegative.int().optional(),scalingId:text.optional(),triggerId:text.optional(),triggerFrame:nonnegative.int().optional(),furinaPartyMembersAboveHalf:z.number().int().min(0).max(4).optional(),a4RefreshFrame:num.int().min(-29).optional(),observationId:text.optional(),paramitaActiveAtSnapshot:z.boolean().optional()}).optional(),
  terms: z.array(z.strictObject({ stat: z.enum(["atk","hp","def","em"]), coefficient: nonnegative, baseMultiplier: nonnegative.optional(),minimumAscension:z.number().int().min(0).max(6).optional() })),
  baseDamageFormula:calculatorFormulaSchema.optional(),additiveBaseFormula:calculatorFormulaSchema.optional(),damageBonusFormula:calculatorFormulaSchema.optional(),resistanceReductionFormula:calculatorFormulaSchema.optional(),critRateFormula:calculatorFormulaSchema.optional(),critDamageFormula:calculatorFormulaSchema.optional(),
  elementalMasteryAdjustment:z.strictObject({formula:calculatorFormulaSchema,accounting:z.enum(["already-in-final-panel","add-to-panel"])}).optional(),
  attackAdjustment:z.strictObject({formula:calculatorFormulaSchema,accounting:z.enum(["already-in-final-panel","add-to-panel"])}).optional(),
  incomingThrillingTalesFormula:calculatorFormulaSchema.optional(),
  occurrence:z.strictObject({kind:z.literal("critical-hit"),sourceHitId:text,enabled:z.boolean(),sourceRefs:refs.min(1)}).optional(),
  additiveBaseDamage: num, damageBonus: num, critEligible: z.boolean(), hitWeakPoint:z.boolean().optional(),
  effectiveResistance:num.optional(),
  effectiveCritRate:num.optional(),effectiveCritDamage:nonnegative.optional(),finalizedEquipmentBaseInput:num.optional(),
  finalizedEquipmentEffects:z.array(finalizedEquipmentEffect).optional(),
  pendingEquipmentEffects:z.array(pendingEquipmentHitEffect).optional(),
  pendingReactionEffects:z.array(pendingEquipmentReactionEffect).optional(),
  pendingResistanceEffects:z.array(pendingEquipmentResistanceEffect).optional(),
  reaction: z.enum(["none","melt","reverseMelt","vaporize","reverseVaporize"]), reactionBonus: num, groupMultiplier: nonnegative,
  explicitReactionBase: num.positive().optional(), additiveReaction: z.enum(["aggravate","spread"]).optional(),
  excludedModifiers: z.array(z.strictObject({ label: text, reason: text })).optional()
}).superRefine((hit,ctx)=>{if(hit.terms.length===0&&!hit.baseDamageFormula)ctx.addIssue({code:"custom",message:"An ordinary hit requires scaling terms or an explicit base-damage formula"});});
const resolved = z.strictObject({ ...sharedHit, kind: z.literal("resolved"), preReactionDamage: nonnegative, amplificationMultiplier: num.positive(), critEligible: z.boolean(), hitWeakPoint:z.boolean().optional(), entryPoint: text });
const transformative = z.strictObject({ ...sharedHit, kind: z.literal("transformative"), reaction: z.enum(["overload","superconduct","electroCharged","burning","shatter","swirlPyro","swirlHydro","swirlCryo","swirlElectro","bloom","burgeon","hyperbloom"]), reactionBonus: num,effectiveResistance:num.optional(),pendingResistanceEffects:z.array(pendingEquipmentResistanceEffect).optional(),pendingReactionEffects:z.array(pendingEquipmentReactionEffect).optional() });
const nonDamaging = z.strictObject({ ...sharedHit, kind: z.literal("non-damaging"), reason: text });
const special = z.strictObject({ ...sharedHit, kind: z.literal("special"), observedSpecialComponentEvent:observedSpecialComponentEventSchema.optional(), neferPhantasmEvent:neferPhantasmEventSchema.optional(), zibaiFiniteEvent:zibaiFiniteEventSchema.optional(), travelerCryoStateEvent:travelerCryoStateEventSchema.optional(), finalSnapshot:calculatorFinalSnapshotSchema.optional(), mixedSourceEvent:mixedSourceEventSchema.optional(), context: conditionedSpecialCalculationSchema });
const blocked = z.strictObject({ ...sharedHit, kind: z.literal("blocked"), reasons: refs.min(1) });
export const noelleBurstContextSchema=z.strictObject({active:z.boolean(),effectiveTalentLevel:z.number().int().min(1).max(15),defenseSnapshotNonExtra:nonnegative.optional(),accounting:z.enum(["already-in-final-panel","add-to-panel"])});
export type NoelleBurstContext=z.infer<typeof noelleBurstContextSchema>;
export const ittoChargedContextSchema=z.strictObject({superstrengthStacks:z.number().int().min(1).max(5),c6PreserveStack:z.boolean(),burst:noelleBurstContextSchema,c4BuffActive:z.boolean(),actionDefenseSnapshotTotal:nonnegative.optional(),actionDefenseStable:z.boolean()});
export type IttoChargedContext=z.infer<typeof ittoChargedContextSchema>;
export const yanfeiChargedContextSchema=z.strictObject({scarletSeals:z.number().int().min(0).max(4),onFieldAtMainHit:z.boolean(),statsStableToA4:z.boolean(),brilliance:z.strictObject({effectiveTalentLevel:z.number().int().min(1).max(15),mainActive:z.boolean(),a4Active:z.boolean()}),mainEnemyHpFraction:num.min(0).max(1),a4EnemyHpFraction:num.min(0).max(1),priorA1BonusIncluded:num.min(0).max(0.2),includedBrillianceBonus:num.min(0).max(1)});
export type YanfeiChargedContext=z.infer<typeof yanfeiChargedContextSchema>;
export const keqingBurstHitStateSchema=z.strictObject({c4Active:z.boolean().optional(),c4IncludedInPanel:z.boolean().optional(),baseAttack:nonnegative.optional(),c6NormalActive:z.boolean().optional(),c6ChargedActive:z.boolean().optional(),c6SkillActive:z.boolean().optional(),c6IncludedStacks:z.number().int().min(0).max(4).optional()});
export type KeqingBurstHitState=z.infer<typeof keqingBurstHitStateSchema>;
export const keqingBurstContextSchema=z.strictObject({a4IncludedInPanel:z.boolean(),statsStableAcrossHits:z.boolean(),hitStates:z.record(z.string(),keqingBurstHitStateSchema).default({})});
export type KeqingBurstContext=z.infer<typeof keqingBurstContextSchema>;
export type KeqingBurstContextInput=z.input<typeof keqingBurstContextSchema>;
export const xingqiuSkillContextSchema=z.strictObject({a4IncludedInPanel:z.boolean(),burstActiveAtCast:z.boolean(),statsStableAcrossHits:z.boolean(),c2ShredActive:z.boolean(),c2ShredIncludedInResistance:z.boolean()});
export type XingqiuSkillContext=z.infer<typeof xingqiuSkillContextSchema>;
export const tighnariDamageContextSchema=z.strictObject({hitStateIdentities:z.record(z.string(),z.string()).optional(),priorA1Active:z.boolean().optional(),c2Active:z.boolean().optional(),c4Em:z.union([z.literal(0),z.literal(60),z.literal(120)]).optional(),a1IncludedEm:z.union([z.literal(0),z.literal(50)]).optional(),c4IncludedEm:z.union([z.literal(0),z.literal(60),z.literal(120)]).optional(),includedA4Bonus:num.min(0).max(.6).optional(),includedC2Bonus:z.union([z.literal(0),z.literal(.2)]).optional(),includedC1Crit:z.union([z.literal(0),z.literal(.15)]).optional(),allHitsConnected:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional()});
export type TighnariDamageContext=z.infer<typeof tighnariDamageContextSchema>;
export const kukiDamageContextSchema=z.strictObject({ringUninterrupted:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),burstHpRatioAtCast:num.min(0).max(1).optional(),c6Active:z.boolean().optional(),c6IncludedInPanel:z.boolean().optional(),c6FinalEmRestored:z.boolean().optional()});
export type KukiDamageContext=z.infer<typeof kukiDamageContextSchema>;
export const ningguangBurstContextSchema = z.strictObject({screenAvailable:z.boolean(),currentA4Active:z.boolean(),currentA4IncludedInBonus:z.boolean(),screenA4Active:z.boolean(),screenA4IncludedInBonus:z.boolean(),screenSnapshot:calculatorFinalSnapshotSchema.optional()});
export type NingguangBurstContext=z.infer<typeof ningguangBurstContextSchema>;
export const baizhuSkillContextSchema=z.strictObject({activeHpRatioAtCast:num.min(0).max(1).optional(),a1IncludedInPanel:z.boolean()});
export type BaizhuSkillContext=z.infer<typeof baizhuSkillContextSchema>;
export const colleiSkillContextSchema=z.strictObject({reactionBeforeReturn:z.boolean().optional(),reactionDuringSprout:z.boolean().optional(),reactionStatsMatchSnapshots:z.boolean().optional(),sproutUninterrupted:z.boolean().optional(),sproutSnapshot:calculatorFinalSnapshotSchema.optional()});
export type ColleiSkillContext=z.infer<typeof colleiSkillContextSchema>;
export const charlotteSkillContextSchema=z.strictObject({nonFontaineTeammates:z.number().int().min(0).max(3).optional(),a4IncludedInPanel:z.boolean(),markUninterrupted:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),c2IncludedStacks:z.number().int().min(0).max(3).optional(),c2BaseAttack:nonnegative.optional(),c2HitStacks:z.record(z.string(),z.number().int().min(0).max(3)).optional()});
export type CharlotteSkillContext=z.infer<typeof charlotteSkillContextSchema>;
export const travelerCryoContextSchema=z.strictObject({radiance:z.enum(["none","stellar-conduct","stellar-swirl"]).optional(),trueMoonStoryBuff:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),skillUninterrupted:z.boolean().optional(),frostglowStacksAtBurst:z.number().int().min(0).max(8).optional(),nonExtraAtk:nonnegative.optional(),a4IncludedEm:num.min(0).max(160).optional()});
export type TravelerCryoContext=z.infer<typeof travelerCryoContextSchema>;
export const batchProjectileHitStateSchema=z.strictObject({actualHpRatio:num.min(0).max(1).optional(),includedHydroBonus:num.min(0).max(.3).optional(),chevreuseA4Active:z.boolean().optional(),a4SourceHp:nonnegative.optional(),includedA4AtkPercent:num.min(0).max(.4).optional(),a1Active:z.boolean().optional(),a1PartyEligible:z.boolean().optional(),includedA1Shred:z.union([z.literal(0),z.literal(.4)]).optional(),baseAttack:nonnegative.optional()});
export type BatchProjectileHitState=z.infer<typeof batchProjectileHitStateSchema>;
export const batchProjectileCastSchema=z.strictObject({statsStableAcrossHits:z.boolean().optional(),baseAttack:nonnegative.optional(),sharedState:batchProjectileHitStateSchema.optional(),hitStates:z.record(z.string(),batchProjectileHitStateSchema).optional()});
export type BatchProjectileCastContext=z.infer<typeof batchProjectileCastSchema>;
export const batchPeriodicCastContextSchema=z.strictObject({completeCastConfirmed:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),kaeyaFrontContactModelConfirmed:z.boolean().optional(),qiqiRevelationInactive:z.boolean().optional(),kokomiNoBurstOrRefresh:z.boolean().optional(),kokomiPassiveIncludedInPanel:z.boolean().optional(),ventiNoAbsorption:z.boolean().optional(),ventiHexereiInactive:z.boolean().optional(),shenheFreshBurstNoSkillEffects:z.boolean().optional(),shenheA1IncludedInPanel:z.boolean().optional(),shenheQReductionIncludedInResistance:z.boolean().optional(),escoffierCryoHydroMembers:z.number().int().min(1).max(4).optional(),escoffierA4InitiallyActive:z.boolean().optional(),escoffierInitialHitConnected:z.boolean().optional(),escoffierA4IncludedInResistance:z.boolean().optional(),escoffierArkheAvailable:z.boolean().optional()});
export type BatchPeriodicCastContext=z.infer<typeof batchPeriodicCastContextSchema>;
export const batchFiniteCastContextSchema=z.strictObject({completeCastConfirmed:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),hitStates:z.record(z.string(),z.strictObject({includedDamageBonus:nonnegative.optional()})).optional()});
export type BatchFiniteCastContext=z.infer<typeof batchFiniteCastContextSchema>;
const coordinatedFrame=nonnegative.int().max(100000);
export const coordinatedCastHitStateSchema=z.strictObject({includedDamageBonus:nonnegative.optional(),targetHpFraction:num.min(0).max(1).optional(),ownerOnField:z.boolean().optional(),raidenNonExtraEnergyRecharge:nonnegative.optional(),yelanBurstElapsedFrames:coordinatedFrame.optional(),yelanInitialCastHp:nonnegative.optional()});
export const coordinatedCastContextSchema=z.strictObject({
  casterId:text.optional(),targetId:text.optional(),
  freshCastConfirmed:z.boolean().optional(),fullObservedLifetime:z.boolean().optional(),observedThroughFrame:coordinatedFrame.optional(),
  noHitlag:z.boolean().optional(),noReplacement:z.boolean().optional(),noInterruption:z.boolean().optional(),allGeneratedHitsConfirmed:z.boolean().optional(),
  normalStates:z.array(z.strictObject({id:text,startFrame:coordinatedFrame,endFrame:coordinatedFrame,actorId:text.optional(),onField:z.boolean().optional(),animationStartDelayFrames:coordinatedFrame.optional(),firstNormalInChain:z.boolean().optional()})).max(1000).optional(),
  damageEvents:z.array(z.strictObject({id:text,frame:coordinatedFrame,actorId:text.optional(),activeActorId:text.optional(),tag:z.enum(["normal","charged","plunge","skill","skill-hold","burst","electro-charged","burning","hydro-swirl","other"]).optional(),damagePositive:z.boolean().optional(),targetId:text.optional(),inRange:z.boolean().optional(),strikeType:z.enum(["slash","other"]).optional(),sourceAbility:text.optional(),origin:z.enum(["external","this-cast"]).optional()})).max(1000).optional(),
  dehyaPrior:z.strictObject({snapshotId:text.optional(),snapshotFrame:num.int().min(-100000).max(-1).optional(),remainingLifetimeFrames:coordinatedFrame.optional(),remainingCooldownFrames:coordinatedFrame.optional()}).optional(),
  fischlOzTravelFrames:coordinatedFrame.optional(),noFischlA4:z.boolean().optional(),noFischlHexerei:z.boolean().optional(),noEarlySwapBeforeOz:z.boolean().optional(),
  statsStableAcrossHits:z.boolean().optional(),yoimiyaA1Inactive:z.boolean().optional(),skillTalentLevel:z.number().int().min(1).max(15).optional(),
  sharedState:coordinatedCastHitStateSchema.optional(),hitStates:z.record(z.string(),coordinatedCastHitStateSchema).optional(),
  snapshots:z.record(z.string(),calculatorFinalSnapshotSchema).optional(),dehyaPriorSnapshot:calculatorFinalSnapshotSchema.optional(),
  finalizedHitEvents:z.record(z.string(),text).optional()
});
export type CoordinatedCastContext=z.infer<typeof coordinatedCastContextSchema>;
export type CoordinatedCastHitState=z.infer<typeof coordinatedCastHitStateSchema>;
export const heldLifecycleCastContextSchema=z.strictObject({
  casterId:text.optional(),targetId:text.optional(),freshCastConfirmed:z.boolean().optional(),noHitlag:z.boolean().optional(),noInterruption:z.boolean().optional(),noReplacement:z.boolean().optional(),fullObservedLifetime:z.boolean().optional(),observedThroughFrame:coordinatedFrame.optional(),statsStableAcrossHits:z.boolean().optional(),
  targetContacts:z.record(z.string(),z.boolean()).optional(),
  dendro:z.strictObject({pyroTransformFrame:coordinatedFrame.optional(),pyroApplicationConfirmed:z.boolean().optional(),firstTransformationConfirmed:z.boolean().optional()}).optional(),
  hydroHold:z.strictObject({dewdropCount:z.number().int().min(1).max(22).optional(),travelFrames:coordinatedFrame.optional(),arkheReady:z.boolean().optional(),hpRatiosBeforeDewdrops:z.array(num.min(0).max(1)).max(22).optional(),noHealingOrDropletPickup:z.boolean().optional(),priorA4Bonus:nonnegative.optional()}).optional(),
  pyro:z.strictObject({initialNightsoulPoints:nonnegative.optional(),noExternalPointChanges:z.boolean().optional(),initialDamagePositive:z.boolean().optional(),damageEvents:coordinatedCastContextSchema.shape.damageEvents}).optional(),
  noelle:z.strictObject({spinCount:z.number().int().min(1).max(11).optional(),startsFromIdle:z.boolean().optional(),attackSpeedBonus:num.optional(),initialStamina:nonnegative.optional(),staminaCostMultiplier:nonnegative.optional(),burstInactive:z.boolean().optional(),shieldInactive:z.boolean().optional(),noExternalStaminaChanges:z.boolean().optional(),sourceCastFrame:coordinatedFrame.optional()}).optional(),
  sharedState:z.strictObject({actualElementalMasteryAtHit:nonnegative.optional(),includedDamageBonus:nonnegative.optional(),hydroHpFractionBeforeHit:num.min(0).max(1).optional(),hydroTorrentSuffusionBonus:nonnegative.optional()}).optional(),hitStates:z.record(z.string(),z.strictObject({actualElementalMasteryAtHit:nonnegative.optional(),includedDamageBonus:nonnegative.optional(),hydroHpFractionBeforeHit:num.min(0).max(1).optional(),hydroTorrentSuffusionBonus:nonnegative.optional()})).optional(),
  snapshots:z.record(z.string(),calculatorFinalSnapshotSchema).optional(),finalizedHitEvents:z.record(z.string(),text).optional()
});
export type HeldLifecycleCastContext=z.infer<typeof heldLifecycleCastContextSchema>;
export const finiteFollowupCastContextSchema=z.strictObject({
  completeCastConfirmed:z.boolean().optional(),statsStableAcrossHits:z.boolean().optional(),noHitlag:z.boolean().optional(),noReplacement:z.boolean().optional(),noInterruption:z.boolean().optional(),
  keqingFreshStiletto:z.boolean().optional(),keqingPriorQInactive:z.boolean().optional(),keqingFollowupFrame:z.number().int().min(0).max(319).optional(),
  faruzanFreshNoPriorEffects:z.boolean().optional(),faruzanInsideBurstArea:z.boolean().optional(),faruzanNoOtherAnemoBeforeInitial:z.boolean().optional(),faruzanHurricaneStartFrame:z.number().int().min(0).max(1092).optional(),normalTalentLevel:z.number().int().min(1).max(15).optional(),faruzanBaseAtk:nonnegative.optional(),
  xinyanInitialOpponentCount:z.number().int().min(1).max(99).optional(),xinyanShieldUnbroken:z.boolean().optional(),cynoBurstActive:z.boolean().optional(),cynoEndseerActive:z.boolean().optional(),cynoBurstEmIncludedInPanel:z.boolean().optional(),cynoCastEm:nonnegative.optional(),
  hitStates:z.record(z.string(),z.strictObject({includedDamageBonus:nonnegative.optional(),includedAdditiveBase:nonnegative.optional(),includedResistanceReduction:nonnegative.optional(),cynoBurstEmIncludedInPanel:z.boolean().optional()})).optional(),finalizedHitContexts:z.record(z.string(),text).optional()
});
export type FiniteFollowupCastContext=z.infer<typeof finiteFollowupCastContextSchema>;
export const entityFollowupCastContextSchema=entityFollowupCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type EntityFollowupCastContext=z.infer<typeof entityFollowupCastContextSchema>;
export const extendedStanceCastContextSchema=extendedStanceCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type ExtendedStanceCastContext=z.infer<typeof extendedStanceCastContextSchema>;
export const noellePlungeCastContextSchema=noellePlungeCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type NoellePlungeCastContext=z.infer<typeof noellePlungeCastContextSchema>;
export type ObservedPlungeContext=z.infer<typeof observedPlungeContextSchema>;
export const travelerHydroResolvedCastContextSchema=travelerHydroResolvedCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type TravelerHydroResolvedCastContext=z.infer<typeof travelerHydroResolvedCastContextSchema>;
export const iansanSwiftResolvedCastContextSchema=iansanSwiftResolvedCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type IansanSwiftResolvedCastContext=z.infer<typeof iansanSwiftResolvedCastContextSchema>;
export const observedSpecialComponentContextSchema=observedSpecialComponentBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type ObservedSpecialComponentContext=z.infer<typeof observedSpecialComponentContextSchema>;
export const neferPhantasmCastContextSchema=neferPhantasmCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type NeferPhantasmCastContext=z.infer<typeof neferPhantasmCastContextSchema>;
export const travelerCryoStateCastContextSchema=travelerCryoStateCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type TravelerCryoStateCastContext=z.infer<typeof travelerCryoStateCastContextSchema>;
export const travelerCrossEntityCastContextSchema=travelerCrossEntityCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type TravelerCrossEntityCastContext=z.infer<typeof travelerCrossEntityCastContextSchema>;
export const zibaiFiniteCastContextSchema=zibaiFiniteCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type ZibaiFiniteCastContext=z.infer<typeof zibaiFiniteCastContextSchema>;
export const mixedSourceCastContextSchema=mixedSourceCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type MixedSourceCastContext=z.infer<typeof mixedSourceCastContextSchema>;
export const idleStanceCastContextSchema=idleStanceCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type IdleStanceCastContext=z.infer<typeof idleStanceCastContextSchema>;
export const observedEntityCastContextSchema=observedEntityCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type ObservedEntityCastContext=z.infer<typeof observedEntityCastContextSchema>;
export const kachinaCastContextSchema=kachinaCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type KachinaCastContext=z.infer<typeof kachinaCastContextSchema>;
export const periodicOrdinaryCastContextSchema=periodicOrdinaryCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type PeriodicOrdinaryCastContext=z.infer<typeof periodicOrdinaryCastContextSchema>;
export const travelerMaleChargedCastContextSchema=travelerMaleChargedCastBaseSchema.extend({snapshots:z.record(text,calculatorFinalSnapshotSchema).optional()});
export type TravelerMaleChargedCastContext=z.infer<typeof travelerMaleChargedCastContextSchema>;
export const incomingThrillingTalesHitStateSchema=z.strictObject({active:z.boolean().optional(),includedRefinement:z.number().int().min(0).max(5).optional(),baseAttack:nonnegative.optional()});
export const incomingThrillingTalesSchema=z.strictObject({ownerId:text,ownerLabel:text,refinement:z.number().int().min(1).max(5),baseAttack:nonnegative.optional(),hitStates:z.record(z.string(),incomingThrillingTalesHitStateSchema).default({})});
export type IncomingThrillingTales=z.infer<typeof incomingThrillingTalesSchema>;
export type IncomingThrillingTalesHitState=z.infer<typeof incomingThrillingTalesHitStateSchema>;
export const weaponProcCalculatorContextSchema=z.strictObject({
  weaponId:z.custom<WeaponProcId>(value=>typeof value==="string"&&weaponProcDefinitions.some(row=>row.weaponId===value),"Unknown independent weapon proc"),
  refinement:z.number().int().min(1).max(5),
  /** Original triggering target at callback time; not the current AoE recipient. */
  triggeringTargetCryoOrFrozen:z.boolean().optional()
});
export type WeaponProcCalculatorContext=z.infer<typeof weaponProcCalculatorContextSchema>;
export const calculatorDocumentSchema = z.strictObject({
  incomingThrillingTales:incomingThrillingTalesSchema.optional(),
  weaponProc:weaponProcCalculatorContextSchema.optional(),
  schemaVersion: z.literal(CALCULATOR_SCHEMA_VERSION), ruleVersion: z.literal(CALCULATOR_RULE_VERSION), id: text, label: text,
  gameContext:z.strictObject({gamingDamage:gamingDamageContextSchema.optional(),xiaoDamage:xiaoDamageContextSchema.optional(),durinSkill:durinSkillContextSchema.optional(),rawSourceState:rawSourceStateContextSchema.optional(),observedPlunge:observedPlungeContextSchema.optional(),observedCharacterResources:observedCharacterResourceContextSchema.optional(),observedAlyoshaLifecycle:alyoshaObservedContextSchema.optional(),observedNeferLifecycle:neferObservedContextSchema.optional(),observedLinneaLifecycle:linneaObservedContextSchema.optional(),sandroneObservedLifecycle:sandroneObservedLifecycleSchema.optional(),kachinaCast:kachinaCastContextSchema.optional(),observedZibaiResources:observedZibaiResourceContextSchema.optional(),observedSpecialComponent:observedSpecialComponentContextSchema.optional(),neferPhantasmCast:neferPhantasmCastContextSchema.optional(),iansanSwiftResolvedCast:iansanSwiftResolvedCastContextSchema.optional(),travelerHydroResolvedCast:travelerHydroResolvedCastContextSchema.optional(),zibaiFiniteCast:zibaiFiniteCastContextSchema.optional(),travelerCrossEntityCast:travelerCrossEntityCastContextSchema.optional(),travelerCryoStateCast:travelerCryoStateCastContextSchema.optional(),mixedSourceCast:mixedSourceCastContextSchema.optional(),noellePlungeCast:noellePlungeCastContextSchema.optional(),extendedStanceCast:extendedStanceCastContextSchema.optional(),entityFollowupCast:entityFollowupCastContextSchema.optional(),idleStanceCast:idleStanceCastContextSchema.optional(),observedEntityCast:observedEntityCastContextSchema.optional(),periodicOrdinaryCast:periodicOrdinaryCastContextSchema.optional(),travelerMaleChargedCast:travelerMaleChargedCastContextSchema.optional(),heldLifecycleCast:heldLifecycleCastContextSchema.optional(),finiteFollowupCast:finiteFollowupCastContextSchema.optional(),coordinatedCast:coordinatedCastContextSchema.optional(),travelerCryo:travelerCryoContextSchema.optional(),batchProjectileCast:batchProjectileCastSchema.optional(),batchPeriodicCast:batchPeriodicCastContextSchema.optional(),batchFiniteCast:batchFiniteCastContextSchema.optional(),colleiSkill:colleiSkillContextSchema.optional(),charlotteSkill:charlotteSkillContextSchema.optional(),baizhuSkill:baizhuSkillContextSchema.optional(),kukiDamage:kukiDamageContextSchema.optional(),tighnariDamage:tighnariDamageContextSchema.optional(),ningguangBurst:ningguangBurstContextSchema.optional(),keqingBurst:keqingBurstContextSchema.optional(),xingqiuSkill:xingqiuSkillContextSchema.optional(),yanfeiCharged:yanfeiChargedContextSchema.optional(),ittoCharged:ittoChargedContextSchema.optional(),noelleBurst:noelleBurstContextSchema.optional(),characterId:text,characterName:text,variantId:text.optional(),variantName:text.optional(),abilityId:text,skillId:text,skillName:text,effectiveTalentLevel:z.number().int().min(1),ascension:z.number().int().min(0).max(6).optional(),constellation:z.number().int().min(0).max(6),scopeCoverage:z.enum(["single-hit","selected-components","complete-cast"]),attributionPolicy:text}).optional(),
  scope: z.enum(["single-hit", "one-cast"]), characterLevel: z.number().int().min(1).max(100),
  build: calculatorBuildSchema,
  enemy: z.strictObject({ level: z.number().int().min(1).max(999), resistance: num, defenseAdjustment: num.min(-1).max(0.9), defenseIgnore: num.min(0).max(1) }),
  hits: z.array(z.discriminatedUnion("kind", [ordinary,resolved,transformative,nonDamaging,blocked,special])).min(1).max(1000),
  selectedHitIds: refs.min(1), assumptions: refs,
  dependencies: z.array(z.strictObject({ id: text, status: z.enum(["verified","provisional","missing"]), reason: text, sourceRefs: refs })),
  dataIdentity: z.strictObject({ datasetId: text, gameVersion: text, releaseStatus: z.enum(["released","official-next","preview","unknown","synthetic"]), evidenceStatus: z.enum(["verified","provisional","synthetic"]) }),
  counterexample: z.literal("shared-amplification-shortcut").optional()
}).superRefine((doc, ctx) => {
  if(doc.weaponProc&&(doc.hits.length!==1||doc.hits[0]?.kind!=="ordinary"))ctx.addIssue({code:"custom",message:"An independent weapon proc context requires exactly one ordinary hit"});
  const ids = new Set(doc.hits.map(hit => hit.id));
  for(const hit of doc.hits)if((hit.kind==="ordinary"||hit.kind==="resolved")&&hit.hitWeakPoint&&!hit.critEligible)ctx.addIssue({code:"custom",message:"Weak-point guaranteed critical damage conflicts with a crit-ineligible hit"});
  for(const hit of doc.hits)if(hit.kind==="ordinary"&&hit.occurrence){
    const parent=doc.hits.find(candidate=>candidate.id===hit.occurrence!.sourceHitId);
    if(!parent||parent.kind!=="ordinary"||parent.id===hit.id||parent.occurrence)ctx.addIssue({code:"custom",message:"A critical-triggered hit requires a different ordinary source hit without a trigger"});
  }
  if (ids.size !== doc.hits.length) ctx.addIssue({ code: "custom", message: "Hit IDs must be unique" });
  if (new Set(doc.dependencies.map(d => d.id)).size !== doc.dependencies.length) ctx.addIssue({ code: "custom", message: "Dependency IDs must be unique" });
  if (new Set(doc.selectedHitIds).size !== doc.selectedHitIds.length) ctx.addIssue({ code: "custom", message: "Selected hit IDs must be unique" });
  if (doc.selectedHitIds.some(id => !ids.has(id))) ctx.addIssue({ code: "custom", message: "Selected hit does not exist" });
  if (doc.scope === "single-hit" && doc.selectedHitIds.length !== 1) ctx.addIssue({ code: "custom", message: "Single Hit requires exactly one selected hit" });
  if ((doc.dataIdentity.releaseStatus === "synthetic") !== (doc.dataIdentity.evidenceStatus === "synthetic")) ctx.addIssue({ code: "custom", message: "Synthetic identity and evidence must remain paired" });
  if (doc.hits.some(h => h.kind === "resolved") && doc.dataIdentity.releaseStatus !== "synthetic") ctx.addIssue({ code: "custom", message: "Resolved teaching entry points are synthetic only" });
});
export type CalculatorDocument = z.infer<typeof calculatorDocumentSchema>;
export type CalculatorBuild = CalculatorDocument["build"];
export type CalculatorHit = CalculatorDocument["hits"][number];
export type CalculatorFinalStats = z.infer<typeof finalStats>;
export interface CalculatorHitResult {
  id: string; label: string; status: "calculated" | "non-damaging" | "blocked";
  nonCritical?: number; critical?: number; expected?: number;
  /** One captured contributor draw outcome; kept separate from analytical expectation. */
  sampled?: SpecialOutcome;
  effectiveCritRate?: number;
  /** Actual critical occurrence probability; forced weak-point hits retain their real panel CR separately. */
  criticalProbability?: number;
  /** The displayed noncritical amount is a teaching counterfactual, impossible under this hit's actual condition. */
  nonCriticalComparisonOnly?: true;
  castContribution?: { nonCritical:number; critical:number; expected:number; triggerProbability:number };
  trace: CalculationTraceNode[]; blockers: string[]; warnings?: string[];
}
export interface CalculatorAggregation {
  version: "calculator-aggregation-v1";
  scope: "single-hit" | "complete-cast" | "selected-components" | "declared-hit-set";
  status: "calculated" | "blocked";
  attributionPolicy: string;
  components: Array<{
    id: string; label: string; selected: boolean; kind: CalculatorHit["kind"];
    status: "calculated" | "non-damaging" | "blocked" | "excluded";
    sourceRefs: string[]; blockers: string[]; triggerProbability?: number;
    damage?: { nonCritical: number; critical: number; expected: number };
  }>;
  knownSubtotal?: { nonCritical: number; critical: number; expected: number };
  omittedHitIds: string[];
  completenessReasons: string[];
}
export interface CalculatorResult {
  status: "calculated" | "blocked";
  verification: "verified" | "provisional" | "synthetic" | "blocked";
  hits: CalculatorHitResult[]; trace: CalculationTraceNode[];
  aggregation: CalculatorAggregation;
  totals?: { nonCritical: number; critical: number; expected: number };
  includedHitIds: string[]; excludedHitIds: string[]; warnings: string[]; blockers: string[];
  counterexample?: { incorrect: number; overstatement: number; trace: CalculationTraceNode[]; explanation: string };
}
export function parseCalculatorDocument(json: string): CalculatorDocument {
  if (json.length > 2_000_000) throw new RangeError("Calculator document exceeds 2 MB");
  return calculatorDocumentSchema.parse(JSON.parse(json));
}
export function serializeCalculatorDocument(document: CalculatorDocument): string {
  return JSON.stringify(calculatorDocumentSchema.parse(document), null, 2);
}
