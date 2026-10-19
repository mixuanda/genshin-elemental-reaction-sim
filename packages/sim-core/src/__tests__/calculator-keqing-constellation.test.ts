import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import evidence from "../../../game-data/sources/keqing-constellation/manifest.json";
import { getCharacterDocuments, applyCharacterConstellationScope, applyKeqingBurstContext, resetKeqingPanelAccounting } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";
import type { KeqingBurstHitState } from "../calculator-model";

function fixture(constellation = 6): CalculatorDocument {
  const document = getCharacterDocuments("character:10000042", 1).find((row) => row.gameContext?.skillId === "keqing-burst-complete-cast")!;
  document.gameContext!.constellation = constellation;
  document.build = { mode: "manual-final", source: "Explicit conditioned test panel, not a claimed gear build", stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  return document;
}
const state = (document: CalculatorDocument, index: number): KeqingBurstHitState => document.gameContext!.keqingBurst!.hitStates[document.hits[index]!.id] ??= {};
const hit = (document: CalculatorDocument, index: number) => document.hits[index] as Extract<CalculatorHit, { kind: "ordinary" }>;
const apply = (document: CalculatorDocument) => applyCharacterConstellationScope(applyKeqingBurstContext(document, document.gameContext!.keqingBurst!));

describe("Keqing Q per-hit C4/C6 contexts", () => {
  it("uses fixed source categories and Q timing, while C4 missing state blocks only its actual selected hit", () => {
    const bytes = readFileSync(evidence.localArchivePath), hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive = JSON.parse(gunzipSync(bytes).toString()) as { files: Record<string, string> };
    for (const [path, expected] of Object.entries(evidence.sourceSha256)) expect(hash(archive.files[path]!)).toBe(expected);
    expect(evidence.scope.burstSnapshotFrames).toEqual([56, 82, 93, 104, 115, 126, 137, 148, 159, 197]);
    expect(archive.files["internal/characters/keqing/burst.go"]).toContain('c.c6("burst")');
    expect(archive.files["pkg/core/attack.go"]).toContain("}, snapshotDelay)");
    expect(archive.files["pkg/modifier/modifier.go"]).toContain("(*slice)[ind] = mod");

    let document = fixture(4);
    for (let index = 0; index < document.hits.length; index++) Object.assign(state(document, index), { c4Active: index > 0, c4IncludedInPanel: false, ...(index > 0 ? { baseAttack: 500 } : {}) });
    document = apply(document);
    const expected = 1000 * .88 * .5 * .9 + 1125 * (8 * .24 + 1.888) * .5 * .9;
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.totals!.nonCritical).toBeCloseTo(expected, 10);
    expect(result.totals!.nonCritical).toBeCloseTo(2323.8, 10); expect(result.totals!.expected).toBeCloseTo(3834.27, 9);
    expect(result.hits[1]!.trace.find((node) => node.id === "sourceAttackAdjustment")!.result!.value).toBe(125);

    if (document.build.mode === "equipment-derived") throw Error();
    document.build.stats.atk = 1125;
    for (let index = 0; index < document.hits.length; index++) { state(document, index).c4IncludedInPanel = true; delete state(document, index).baseAttack; }
    state(document, 0).baseAttack = 500; // Remove the old included buff only for the first hit.
    document = apply(document);
    expect(calculateDocument(document).totals).toEqual(result.totals);
    expect(calculateDocument(document).hits[0]!.trace.find((node) => node.id === "sourceAttackAdjustment")!.result!.value).toBe(-125);
    delete state(document, 0).baseAttack;
    document = apply(document);
    expect(calculateDocument(document).status).toBe("blocked");
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[9]!.id]; document.gameContext!.keqingBurst!.statsStableAcrossHits = false;
    document = apply(document);
    expect(calculateDocument(document).status).toBe("calculated");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1125 * 1.888 * .5 * .9, 10);
    document.selectedHitIds = [document.hits[0]!.id];
    document = apply(document);
    expect(calculateDocument(document).blockers.join()).toContain("不能从最终攻击力反推");
  });

  it("restores each C6 category independently, removes included old stacks and never duplicates this Q category", () => {
    let document = fixture();
    const counts = [1, 2, 3, 1, 1, 1, 1, 1, 1, 3];
    for (let index = 0; index < document.hits.length; index++) Object.assign(state(document, index), { c4Active: false, c4IncludedInPanel: false, c6NormalActive: counts[index]! >= 2, c6ChargedActive: index === 2, c6SkillActive: index === 9, c6IncludedStacks: 0 });
    hit(document, 0).effectiveCritRate = .2;
    document = apply(document);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits[0]!.effectiveCritRate).toBe(.2);
    for (let index = 0; index < document.hits.length; index++) {
      const coefficient = index === 0 ? .88 : index === 9 ? 1.888 : .24;
      expect(result.hits[index]!.nonCritical).toBeCloseTo(1000 * coefficient * (1 + .06 * counts[index]!) * .5 * .9, 10);
      const bonus = result.hits[index]!.trace.find((node) => node.id === "customDamageBonus")!;
      expect(bonus.inputs.find((input) => input.key === "keqingC6BurstActive")!.value).toBe(1);
    }
    for (let index = 0; index < document.hits.length; index++) { hit(document, index).damageBonus = .24; state(document, index).c6IncludedStacks = 4; }
    document = apply(document);
    const accounted = calculateDocument(document);
    for (let index = 0; index < document.hits.length; index++) expect(accounted.hits[index]!.nonCritical).toBeCloseTo(result.hits[index]!.nonCritical!, 10);
    expect(accounted.hits[0]!.trace.find((node) => node.id === "customDamageBonus")!.result!.value).toBeCloseTo(-.18, 12);
    hit(document, 0).additiveReaction = "aggravate";
    document = apply(document);
    const reacted = calculateDocument(document);
    expect(reacted.hits[0]!.nonCritical).toBeGreaterThan(accounted.hits[0]!.nonCritical!);
    expect(reacted.hits[1]!.nonCritical).toBe(accounted.hits[1]!.nonCritical);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(restored.gameContext!.keqingBurst!.hitStates).toEqual(document.gameContext!.keqingBurst!.hitStates);
    expect(calculateDocument(restored).totals).toEqual(reacted.totals);
    delete state(document, 9).c6NormalActive;
    document = apply(document);
    expect(calculateDocument(document).status).toBe("blocked");
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id]; document = apply(document);
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("derives real gear base ATK once and preserves per-hit accounting through final conversion, fresh gear and unknown imports", () => {
    let document = fixture(4);
    document.build = { mode: "equipment-derived", characterBaseAtk: 300, weaponBaseAtk: 400, atkPercent: .5, flatAtk: 50, baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1 };
    for (let index = 0; index < document.hits.length; index++) state(document, index).c4Active = index > 0;
    resetKeqingPanelAccounting(document, "fresh-equipment");
    document = apply(document);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.hits[0]!.nonCritical).toBeCloseTo(1100 * .88 * .5 * .9, 10);
    expect(result.hits[1]!.nonCritical).toBeCloseTo((1100 + 700 * .25) * .24 * .5 * .9, 10);
    expect(state(document, 1).baseAttack).toBe(700);
    expect(result.hits[1]!.trace.find((node) => node.id === "sourceAttackAdjustment")!.substitution).toContain("300 + 400");
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document)));
    expect(calculateDocument(final).totals).toEqual(result.totals);
    const reappliedFinal = apply(final);
    expect(calculateDocument(reappliedFinal).totals).toEqual(result.totals);
    for (const row of Object.values(document.gameContext!.keqingBurst!.hitStates)) row.c4IncludedInPanel = true;
    resetKeqingPanelAccounting(document, "fresh-equipment");
    document = apply(document);
    expect(calculateDocument(document).totals).toEqual(result.totals);
    resetKeqingPanelAccounting(reappliedFinal, "imported-final");
    expect(state(reappliedFinal, 1).baseAttack).toBeUndefined(); expect(state(reappliedFinal, 1).c4IncludedInPanel).toBeUndefined();
    expect(calculateDocument(apply(reappliedFinal)).status).toBe("blocked");
  });
});
