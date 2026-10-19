import { describe, expect, it } from "vitest";
import { applyCharacterConstellationScope, applyNoelleBurstContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

const get = (skillId: string, level = 1): CalculatorDocument => {
  const document = getCharacterDocuments("character:10000034", level).find(doc => doc.gameContext?.skillId === skillId);
  if (!document) throw Error(`Missing Noelle source action: ${skillId}`);
  return document;
};
const hit = (document: CalculatorDocument, index = 0): Extract<CalculatorHit, { kind: "ordinary" }> => {
  const selected = document.hits[index];
  if (selected?.kind !== "ordinary") throw Error("Source ordinary hit required");
  return selected;
};
const node = (document: CalculatorDocument, id: string) => calculateDocument(document).hits[0]!.trace.find(entry => entry.id === id);

describe("Noelle conditioned Q historical DEF conversion and infusion", () => {
  it("keeps Q talent independent, applies C6 flat ATK from non-Extra history and never resamples current DEF", () => {
    let document = get("noelle-normal-1");
    const normalCoefficient = hit(document).terms[0]!.coefficient;
    document.gameContext!.constellation = 6;
    document = applyCharacterConstellationScope(applyNoelleBurstContext(document, {
      active: true, effectiveTalentLevel: 10, defenseSnapshotNonExtra: 1000, accounting: "add-to-panel"
    }));
    expect(calculateDocument(document).status).toBe("calculated");
    expect(hit(document).element).toBe("geo");
    expect(document.gameContext!.variantName).toBe("Q 激活·岩附魔");
    expect(document.gameContext!.effectiveTalentLevel).toBe(1);
    expect(hit(document).terms[0]!.coefficient).toBe(normalCoefficient);
    expect(node(document, "sourceAttackAdjustment")?.result?.value).toBe(1220);
    expect(node(document, "hitAttack")?.result?.value).toBe(3220);
    const before = calculateDocument(document).totals;
    if (document.build.mode === "equipment-derived") throw Error();
    document.build.stats.def = 9999;
    expect(calculateDocument(document).totals).toEqual(before);
    const q1 = applyNoelleBurstContext(document, { ...document.gameContext!.noelleBurst!, effectiveTalentLevel: 1 });
    expect(node(q1, "sourceAttackAdjustment")?.result?.value).toBe(900);
    expect(hit(q1).terms[0]!.coefficient).toBe(normalCoefficient);
    const c5 = structuredClone(q1); c5.gameContext!.constellation = 5;
    expect(node(applyCharacterConstellationScope(c5), "sourceAttackAdjustment")?.result?.value).toBe(400);
  });

  it("classifies C2 charged damage and both Q burst hits correctly, with relevant missing-context gates", () => {
    const charged = get("noelle-charged-finisher");
    const before = calculateDocument(charged).totals!.nonCritical;
    charged.gameContext!.constellation = 2;
    const c2 = applyCharacterConstellationScope(charged);
    expect(hit(c2).element).toBe("physical");
    expect(node(c2, "customDamageBonus")?.result?.value).toBe(0.15);
    expect(calculateDocument(c2).totals!.nonCritical).toBeCloseTo(before * 1.15, 10);
    const infused = applyNoelleBurstContext(c2, { active: true, effectiveTalentLevel: 1, accounting: "already-in-final-panel" });
    expect(hit(infused).element).toBe("geo");
    expect(node(infused, "sourceAttackAdjustment")?.status).toBe("not-applicable");
    expect(calculateDocument(infused).totals).toEqual(calculateDocument(c2).totals);
    const missing = applyNoelleBurstContext(c2, { active: true, effectiveTalentLevel: 1, accounting: "add-to-panel" });
    expect(calculateDocument(missing).blockers.join()).toContain("历史非 Extra 防御快照");
    expect(() => convertCalculatorToFinalPanel(missing)).toThrow();

    const cast = get("noelle-burst-cast", 1);
    cast.gameContext!.constellation = 6;
    const active = applyCharacterConstellationScope(applyNoelleBurstContext(cast, { active: true, effectiveTalentLevel: 10, defenseSnapshotNonExtra: 1000, accounting: "add-to-panel" }));
    expect(active.hits.map(entry => entry.kind === "ordinary" && entry.attackTag)).toEqual(["burst", "burst"]);
    expect(active.hits.map(entry => entry.kind === "ordinary" && entry.terms[0]!.coefficient)).toEqual([1.2096, 1.6704]);
    expect(calculateDocument(active).hits.every(entry => entry.status === "calculated")).toBe(true);
    expect(hit(active).damageBonusFormula).toBeUndefined();
    expect(calculateDocument(applyNoelleBurstContext(active, { ...active.gameContext!.noelleBurst!, active: false })).status).toBe("blocked");
  });

  it("preserves per-hit adjustment through equipment-final JSON and accepts explicitly included final ATK without old DEF", () => {
    let document = get("noelle-plunge-high");
    document.gameContext!.constellation = 6;
    document.build = { mode: "equipment-derived", characterBaseAtk: 500, weaponBaseAtk: 500, atkPercent: 1, flatAtk: 100, baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 2000, defPercent: 0, flatDef: 0, em: 0, critRate: 0.7, critDamage: 1.2 };
    document = applyCharacterConstellationScope(applyNoelleBurstContext(document, { active: true, effectiveTalentLevel: 10, defenseSnapshotNonExtra: 1000, accounting: "add-to-panel" }));
    expect(node(document, "hitAttack")?.result?.value).toBe(3320); // 1000*(1+100%)+100 + 1000*(72%+50%).
    const expected = calculateDocument(document).totals;
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document)));
    expect(final.gameContext!.noelleBurst!.accounting).toBe("add-to-panel");
    expect(hit(final).attackAdjustment!.accounting).toBe("add-to-panel");
    expect(final.build.mode !== "equipment-derived" && final.build.stats.atk).toBe(2100);
    expect(calculateDocument(final).totals).toEqual(expected);
    if (final.build.mode === "equipment-derived") throw Error();
    final.build.stats.atk = 3320;
    const suppliedFinal = applyNoelleBurstContext(final, { active: true, effectiveTalentLevel: 10, accounting: "already-in-final-panel" });
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(suppliedFinal))).totals).toEqual(expected);
    expect(node(suppliedFinal, "sourceAttackAdjustment")?.status).toBe("not-applicable");
    expect(hit(suppliedFinal).attackAdjustment!.formula.inputs.some(input => input.key === "noelleBurstSnapshotDefNonExtra")).toBe(false);
  });
});
