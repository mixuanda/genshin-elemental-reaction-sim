import {describe,expect,it} from "vitest";
import {gameDataCatalog} from "../../../game-data/src/catalog";
import {resolveEquipmentBuild} from "../../../game-data/src/equipment-build";
import {createNeferFullVeilEmFormula} from "../../../../apps/web/src/character-source-formulas";
import {calculateDocument,convertCalculatorToFinalPanel,parseCalculatorDocument,serializeCalculatorDocument,resolveCalculatorStats,resolveCalculatorHitDamageBonus,resolveCalculatorHitEquipmentContext} from "../calculator";
import {expr} from "../calculation-trace";
import {loadWorkedExample} from "../worked-examples";

describe("per-hit EM and explicit equipment sampling",()=>{
  it("preserves old samples, rebuilds live EM through equipment phases, and round-trips one complete converted hit",()=>{
    const nefer=gameDataCatalog.characters.find(row=>row.slug==="nefer")!,weapon=gameDataCatalog.weapons.find(row=>row.slug==="wanderingevenstar")!;
    const doc=loadWorkedExample("fixture-a"),hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();
    doc.build=resolveEquipmentBuild({characterId:nefer.id,weaponId:weapon.id,level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,effectsDisabled:true,weaponEffectsEnabled:true,effectContext:{timedEffectActive:true,timedSnapshotEm:500}}).build;
    doc.gameContext={characterId:nefer.id,characterName:nefer.name,abilityId:"protocol",skillId:"protocol",skillName:"来源状态与装备采样协议",effectiveTalentLevel:1,ascension:6,constellation:2,scopeCoverage:"single-hit",attributionPolicy:"验证真实状态和装备交互；合成缩放项不宣称是妮芙尔实际技能倍率。"};
    hit.element="dendro";hit.attackTag="skill";hit.terms=[{stat:"atk",coefficient:1},{stat:"em",coefficient:1}];hit.damageBonus=0;hit.additiveBaseDamage=0;hit.critEligible=false;
    hit.elementalMasteryAdjustment={accounting:"add-to-panel",formula:createNeferFullVeilEmFormula(2)};
    const inputs=hit.elementalMasteryAdjustment.formula.inputs;
    inputs.find(input=>input.key==="moonsignCount")!.value=2;inputs.find(input=>input.key==="neferFullVeilEmBuffActive")!.value=1;
    const active=calculateDocument(doc),base=resolveCalculatorStats(doc.build);
    expect(active.status).toBe("calculated");
    expect(active.hits[0]!.trace.find(node=>node.id==="scaling.0")?.result?.value).toBe(base.atk);
    expect(active.hits[0]!.trace.find(node=>node.id==="hitElementalMastery")?.result?.value).toBe(base.em+200);
    expect(doc.build.equipment!.statModifiers!.find(modifier=>modifier.inputs.some(input=>input.key==="snapshotEm"))!.inputs.find(input=>input.key==="snapshotEm")!.value).toBe(500);
    const final=convertCalculatorToFinalPanel(doc);expect(calculateDocument(final).totals).toEqual(active.totals);

    // Synthetic protocol control: this deliberately changes the expression and label;
    // it is not a claim that Evenstar's source rule is a live conversion.
    const live=doc.build.equipment!.statModifiers!.find(modifier=>modifier.inputs.some(input=>input.key==="snapshotEm"))!;
    live.label="合成实时EM转换边界（非晚星机制）";live.expression=expr.mul(expr.input("em"),expr.input("ratio"));
    const equipment=doc.build.equipment!,sourceRefs=["synthetic:per-hit-em-equipment-phases"];
    equipment.statModifiers!.push(
      {id:"synthetic-pre-em",label:"合成前阶段精通",target:"em",phase:"pre-panel",expression:expr.mul(expr.input("em"),expr.value(.5)),inputs:[],sourceRefs},
      {id:"synthetic-live-er",label:"合成实时精通转充能",target:"energyRechargeBonus",phase:"conversion",expression:expr.mul(expr.input("em"),expr.value(.001)),inputs:[],sourceRefs},
      {id:"synthetic-same-phase",label:"合成同阶段固定读取",target:"flatAtk",phase:"conversion",expression:expr.mul(expr.input("erRatio"),expr.value(100)),inputs:[],sourceRefs}
    );
    equipment.dynamicHitBonuses=[
      {id:"synthetic-pre-bonus",label:"转换前精通增伤",inputPolicy:"pre-conversion",expression:expr.mul(expr.input("em"),expr.value(.001)),inputs:[],sourceRefs},
      {id:"synthetic-final-bonus",label:"转换后充能增伤",inputPolicy:"final-panel",expression:expr.mul(expr.input("erRatio"),expr.value(.1)),inputs:[],sourceRefs}
    ];
    equipment.additiveBaseBonuses=[{id:"synthetic-base",label:"转换前精通基数",inputPolicy:"pre-conversion",expression:expr.mul(expr.input("em"),expr.value(.2)),inputs:[],sourceRefs}];
    equipment.criticalBonuses=[{id:"synthetic-critical",label:"转换后精通暴击",target:"critRate",inputPolicy:"final-panel",expression:expr.mul(expr.input("em"),expr.value(.0001)),inputs:[],sourceRefs}];
    hit.critEligible=true;
    const liveBase=resolveCalculatorStats(doc.build),liveResult=calculateDocument(doc),ratio=live.inputs.find(input=>input.key==="ratio")!.value;
    const trace=liveResult.hits[0]!.trace,value=(id:string)=>trace.find(node=>node.id===id)!.result!.value;
    expect(liveResult.status).toBe("calculated");
    expect(value("hitEquipmentStat.em")).toBeCloseTo(liveBase.em+300,10);
    expect(value("hitEquipmentStat.atk")).toBeCloseTo(liveBase.atk+300*ratio,10);
    expect(value("hitEquipmentStat.energyRecharge")).toBeCloseTo(liveBase.energyRecharge!+.3,10);
    expect(value("hitEquipment.modifier.synthetic-same-phase")).toBe(value("sharedEquipment.modifier.synthetic-same-phase"));
    expect(value("dynamicBonus.0")).toBeCloseTo((liveBase.em+300)*.001,10);
    expect(value("dynamicBonus.1")).toBeCloseTo((liveBase.energyRecharge!+.3)*.1,10);
    expect(resolveCalculatorHitDamageBonus(doc.build,hit,doc)).toBe(value("applicableDamageBonus"));
    expect(resolveCalculatorHitEquipmentContext(doc.build,hit,doc).additiveBaseDamage).toBe(value("equipmentAndManualBaseAddition"));
    const converted=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc))),convertedHit=converted.hits[0]!;
    if(convertedHit.kind!=="ordinary")throw Error();
    expect(convertedHit.finalSnapshot?.origin).toBe("equipment-conversion");
    expect(convertedHit.finalSnapshot?.source).toContain("由当前构筑转换的逐击快照");
    expect(calculateDocument(converted).totals).toEqual(liveResult.totals);
    convertedHit.elementalMasteryAdjustment!.formula.inputs.find(input=>input.key==="neferFullVeilEmBuffActive")!.value=0;
    expect(calculateDocument(converted).totals).toEqual(liveResult.totals);
    const snapshot=structuredClone(convertedHit.finalSnapshot!);delete snapshot.origin;snapshot.source="明确输入的旧时点快照";
    hit.finalSnapshot=snapshot;
    const historical=calculateDocument(doc);doc.build.em+=1000;
    expect(calculateDocument(doc).totals).toEqual(historical.totals);
    expect(convertCalculatorToFinalPanel(doc).hits[0]).toMatchObject({finalSnapshot:snapshot});

    const finalHit=final.hits[0]!;if(final.build.mode==="equipment-derived"||finalHit.kind!=="ordinary")throw Error();
    final.build.stats.em=base.em+200;delete final.build.ascension;delete final.gameContext!.ascension;
    finalHit.elementalMasteryAdjustment!.accounting="already-in-final-panel";
    const replay=calculateDocument(final);expect(replay.totals).toEqual(active.totals);
    expect(replay.hits[0]!.trace.find(node=>node.id==="sourceElementalMasteryAdjustment")).toMatchObject({status:"not-applicable",result:{value:0}});
  });
});
