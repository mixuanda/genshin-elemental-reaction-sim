import { expect, it } from "vitest";
import { sourceClassifiedMappings } from "../../game-data/src/classified-hits";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorFinalSnapshot } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";

const stats={atk:2000,hp:20000,def:800,em:200,critRate:.5,critDamage:1};
const observed={casterId:"caster",targetId:"enemy",noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:2000,statsStableAcrossHits:true};
function documentFor(skillId:string):CalculatorDocument {
  const m=sourceClassifiedMappings.find(row=>row.skillId===skillId)!;
  if(!m)throw new Error(`Missing source registry entry: ${skillId}`);
  return {schemaVersion:"1.0.0",ruleVersion:"ordinary-trace-v1",id:skillId,label:skillId,scope:"one-cast",characterLevel:90,
    build:{mode:"manual-final",stats,ascension:6,source:"Explicit hypothetical panel for fixed-source protocol acceptance"},enemy:{level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0},
    gameContext:{characterId:`character:${m.characterSlug}`,characterName:m.characterSlug,abilityId:`talent:${m.characterSlug}:${m.abilityKey}`,skillId,skillName:m.skillLabel??skillId,effectiveTalentLevel:1,ascension:6,constellation:0,scopeCoverage:"selected-components",attributionPolicy:"Explicit source protocol"},
    hits:[{id:m.id,label:m.hitLabel,kind:"ordinary",element:m.element!,attackTag:m.attackTag!,terms:[{stat:m.scalingStat!,coefficient:m.sourceCoefficientValues![0]!}],additiveBaseDamage:0,damageBonus:0,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,sourceRefs:["https://github.com/genshinsim/gcsim"],dependencies:[]}],selectedHitIds:[m.id],assumptions:[],dependencies:[],dataIdentity:{datasetId:"fixed-source-batch-hypothetical-input",gameVersion:"7.1",releaseStatus:"preview",evidenceStatus:"provisional"}};
}
const snapshot=(values:typeof stats):CalculatorFinalSnapshot=>({stats:values,characterLevel:90,ascension:6,damageBonus:0,additiveBaseDamage:0,reactionBonus:0,source:"Explicit actual historical panel",sourceRefs:["test:declared-historical-panel"]});
function complete(doc:CalculatorDocument){const prepared=prepareSourceCastDocument(doc),result=calculateDocument(prepared);expect(result.blockers).toEqual([]);expect(prepared.gameContext!.scopeCoverage).toBe("complete-cast");return {prepared,result};}

/** One acceptance gate across the four new shared protocols, not a per-character regression suite. */
it("compiles the remaining shared source lifecycles, preserves mixed panel accounting and opens one special hit without a future schedule",()=>{
  const ifa=documentFor("extended-ifa-skill-c0");
  ifa.gameContext!.extendedStanceCast={...observed,freshCastConfirmed:true,casterId:"ifa",observedThroughFrame:244,ifa:{noExternalNightsoulChanges:true,noUnlistedActions:true},followupActions:[
    {id:"tap1",frame:31,actorId:"ifa",kind:"normal",travelFrames:8,attackSpeedBonus:0},
    {id:"tap2",frame:85,actorId:"ifa",kind:"normal",travelFrames:10,attackSpeedBonus:0},
    {id:"hold1",frame:127,actorId:"ifa",kind:"charged",travelFrames:6,attackSpeedBonus:0},
    {id:"end",frame:200,actorId:"ifa",kind:"skill"}],targetContacts:{"tap1:shot":true,"tap2:shot":true,"hold1:shot":true},sharedState:{ifaA4Active:false,includedElementalMastery:0},hitStates:{"extended-ifa-skill-c0:tap2:shot":{ifaA4Active:true},"extended-ifa-skill-c0:hold1:shot":{ifaA4Active:true}}};
  const a=complete(ifa);
  expect(a.prepared.hits.map(h=>h.kind==="ordinary"?h.extendedStanceEvent?.frame:undefined)).toEqual([42,98,134]);
  expect(a.result.totals!.expected).toBeCloseTo(3*2000*1.3336*.5*.9*1.5,8);
  expect(a.result.hits[1]!.trace.find(n=>n.id==="hitElementalMastery")?.result?.value).toBe(280);

  const nicole=documentFor("entity-followup-nicole-burst-c0");
  nicole.gameContext!.entityFollowupCast={...observed,freshCastConfirmed:true,casterId:"nicole",observedThroughFrame:1310,nicole:{noSkillBuffThroughout:true,allEnemyHitEventsRecorded:true,eventsInSourceOrderConfirmed:true,casterIsHexerei:true,partyHexereiCount:2,enemyHitEvents:[{id:"trigger",frame:110,actorId:"owner",activeActorId:"owner",targetId:"enemy",actorElement:"hydro",actorIsHexerei:true,enemyHitHookFired:true}]},targetContacts:{initial:true,"projection-1":true},snapshots:{"sample:owner:140":snapshot({...stats,atk:3000,critRate:.2,critDamage:1.5})},sharedState:{includedAdditiveBaseDamage:0,nicoleAtkAtProjection:1800}};
  const b=complete(nicole);
  expect(b.prepared.hits.map(h=>h.kind==="ordinary"?h.entityFollowupEvent?.frame:undefined)).toEqual([108,140]);
  expect(b.result.totals!.expected).toBeCloseTo(2000*3.168*.5*.9*1.5+(3000*.99+1800*3)*.5*.9*1.3,8);

  const noelle=documentFor("noelle-plunge-high-observed-c0");
  noelle.gameContext!.noellePlungeCast={casterId:"noelle",targetId:"enemy",noHitlag:true,noInterruption:true,fullObservedLifetime:true,observedThroughFrame:82,statsStableAcrossHits:true,airborneXianyunConfirmed:true,returnedToGroundConfirmed:true,burstInactive:true,noExternalInfusion:true,collisionOccurred:true,targetContacts:{collision:true,landing:true}};
  const c=complete(noelle);
  expect(c.prepared.hits.map(h=>h.kind==="ordinary"?h.noellePlungeEvent?.frame:undefined)).toEqual([33,42]);
  expect(c.result.totals!.expected).toBeCloseTo(2000*(.745878+1.862889)*.5*.9*1.5,8);

  const flins=documentFor("mixed-flins-burst-c0");
  // Explicit test conversion: 50% EM becomes extra ATK. A4 must rebuild it per source sample.
  flins.build={mode:"equipment-derived",characterBaseAtk:500,weaponBaseAtk:500,atkPercent:0,flatAtk:0,baseHp:20000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:200,critRate:.5,critDamage:1,equipment:{characterId:"character:flins",weaponId:"test:em-extra-atk",level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,sourceVersion:"test-explicit-conversion",sourceRefs:["test:explicit-em-to-extra-atk"],derivedStats:[],secondaryContributions:[],assumptions:["Hypothetical numeric modifier used to exercise existing equipment conversion phases"],effectBlockers:[],bonusAccounting:"core-sourced-v1",statModifiers:[{id:"test-em-extra-atk",label:"Explicit 50% EM as extra ATK",target:"flatAtk",phase:"conversion",expression:{kind:"multiply",terms:[{kind:"variable",key:"em"},{kind:"constant",value:.5}]},inputs:[],sourceRefs:["test:explicit-em-to-extra-atk"]}]}};
  flins.gameContext!.mixedSourceCast={...observed,moonsignLevel:2,flins:{symphonyInactive:true},targetContacts:{initial:true,"middle-1":true,"middle-2":true,"middle-3":true,"middle-4":true,final:true},sharedState:{nonExtraAtk:1000,includedFlinsA4Em:0,otherSpecialBaseBonus:0,otherReactionBonus:0,specialAdditive:0,elevationMultiplier:1}};
  const d=complete(flins);
  expect(d.prepared.hits.map(h=>h.kind==="ordinary"||h.kind==="special"?h.mixedSourceEvent?.frame:undefined)).toEqual([93,110,119,128,137,164]);
  expect(d.prepared.hits.filter(h=>h.kind==="special")).toHaveLength(5);
  const specialOracle=3*1140*(4*.1624+1.16928)*(1+1140*.00007)*(1+6*280/(280+2000)+.2)*.9*1.5;
  expect(d.result.totals!.expected).toBeCloseTo(1140*2.5984*.5*.9*1.5+specialOracle,8);
  const final=convertCalculatorToFinalPanel(d.prepared),finalResult=calculateDocument(final);
  expect(finalResult.blockers).toEqual([]);
  expect(finalResult.totals!.expected).toBeCloseTo(d.result.totals!.expected,8);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(final))).totals).toEqual(finalResult.totals);

  // A new single-hit entry starts from a source representative, never a generated full cast.
  const independent=documentFor("mixed-flins-burst-c0");independent.scope="single-hit";independent.gameContext!.effectiveTalentLevel=9;
  independent.gameContext!.mixedSourceCast={moonsignLevel:2,independentEvent:{candidateId:"actual-final",templateRole:"final",frame:164,snapshotFrame:93,snapshotId:"actual-93",targetId:"enemy"},snapshots:{"actual-93":snapshot({...stats,atk:1800,em:144,critRate:.3,critDamage:2})},sharedState:{impactAtk:1000,nonExtraAtk:800,includedFlinsA4Em:64,otherSpecialBaseBonus:.05,otherReactionBonus:.1,specialAdditive:0,elevationMultiplier:1}};
  independent.hits.push({id:"unselected-future",kind:"blocked",label:"Unselected missing future",reasons:["Future observation deliberately absent"],sourceRefs:[],dependencies:[]});
  const one=calculateDocument(independent);
  expect(one.blockers).toEqual([]);expect(one.hits).toHaveLength(1);
  expect(one.totals!.expected).toBeCloseTo(3*1800*1.987776*(1+.07+.05)*(1+6*144/(144+2000)+.1+.2)*.9*1.6,8);
});
