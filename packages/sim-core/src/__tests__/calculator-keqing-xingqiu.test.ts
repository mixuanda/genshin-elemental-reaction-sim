import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../../../game-data/src/catalog";
import { resolveArtifactFormulaEffects, resolveWeaponFormulaEffects } from "../../../game-data/src/equipment-formulas";
import { sourceClassifiedMappings } from "../../../game-data/src/classified-hits";
import { keqingXingqiuMappings, keqingXingqiuSourceEvidence } from "../../../game-data/src/character-mappings/keqing-xingqiu-mappings";
import { applyCharacterConstellationScope, applyKeqingBurstContext, applyXingqiuSkillContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { KEQING_A4_ER_MODIFIER_ID } from "../../../../apps/web/src/keqing-xingqiu-calculation-context";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, resolveCalculatorStats, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function numericTable(source: string, table: string, indices: number[]): number[] {
  const code = source.replace(/\/\/[^\n]*/g, ""), match = new RegExp(`\\b${table}\\s*=\\s*(?:\\[\\])+float64\\s*\\{`).exec(code)!;
  const start = match.index + match[0].length - 1;
  let end = start, depth = 0;
  for (; end < code.length; end++) { if (code[end] === "{") depth++; if (code[end] === "}" && --depth === 0) break; }
  let value = JSON.parse(code.slice(start, end + 1).replaceAll("{", "[").replaceAll("}", "]").replace(/,\s*]/g, "]"));
  for (const index of indices) value = value[index];
  return value;
}
function get(character: "keqing" | "xingqiu"): CalculatorDocument {
  const skill = character === "keqing" ? "keqing-burst-complete-cast" : "xingqiu-skill-complete-cast";
  const doc = getCharacterDocuments(character === "keqing" ? "character:10000042" : "character:10000025", 1).find((row) => row.gameContext?.skillId === skill)!;
  if (doc.build.mode === "equipment-derived") throw Error("Expected editable manual example");
  doc.build.stats = { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 };
  return doc;
}
const ordinary = (doc: CalculatorDocument, index: number) => doc.hits[index] as Extract<CalculatorHit, { kind: "ordinary" }>;

describe("complete conditioned Keqing Q and Xingqiu E", () => {
  it("checks archived source hashes, all 75 talent values and each actual damage instance", () => {
    const evidence = keqingXingqiuSourceEvidence, bytes = readFileSync(evidence.localArchivePath);
    expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive = JSON.parse(gunzipSync(bytes).toString()) as { revision: string; files: Record<string, string> };
    expect(archive.revision).toBe(evidence.revision);
    for (const [path, sha] of Object.entries(evidence.sourceSha256)) expect(hash(archive.files[path]!)).toBe(sha);
    expect(keqingXingqiuMappings).toHaveLength(5);
    expect(keqingXingqiuMappings.reduce((count, row) => count + row.instanceCount!, 0)).toBe(12);
    for (const [index, row] of evidence.coefficients.entries()) {
      const code = archive.files[`internal/characters/${row.characterSlug}/zz_${row.characterSlug}.dm.go`]!;
      const values = numericTable(code, row.sourceTable, row.sourceIndex);
      const active = findTalentSetById(`talent-set:${row.characterSlug}`)!.abilities.find((ability) => ability.key === row.abilityKey)!.parameters[row.parameterKey];
      expect(values).toHaveLength(15); expect(row.values).toEqual(values); expect(active).toEqual(values);
      expect(sourceClassifiedMappings.filter((mapping) => mapping.id === keqingXingqiuMappings[index]!.id)).toHaveLength(1);
    }
    const q = archive.files["internal/characters/keqing/burst.go"]!;
    expect(q.indexOf("c.a4()")).toBeLessThan(q.indexOf("// initial"));
    expect(q).toContain("for i := 82; i < 162; i += 11");
    expect(archive.files["internal/characters/keqing/keqing.go"]).toContain("c.c4buff[attributes.ATKP] = 0.25");
    expect(archive.files["internal/characters/xingqiu/skill.go"]).toMatch(/if c.Base.Cons >= 4 {[\s\S]*if c.StatusIsActive\(burstKey\) {[\s\S]*ax.Mult \*= 1.5/);
    expect(get("keqing").hits).toHaveLength(10); expect(get("xingqiu").hits).toHaveLength(2);
    expect(get("keqing").gameContext!.scopeCoverage).toBe("complete-cast");
    expect(get("xingqiu").gameContext!.scopeCoverage).toBe("complete-cast");
  });

  it("executes Keqing A4 once, preserves final critical precedence, and feeds non-conversion ER into sourced Emblem", () => {
    let doc = get("keqing"), output = calculateDocument(doc);
    expect(output.status).toBe("calculated"); expect(output.totals!.nonCritical).toBeCloseTo(2109.6, 10); expect(output.totals!.expected).toBeCloseTo(3480.84, 10);
    expect(output.hits.every((hit) => hit.effectiveCritRate === .65)).toBe(true);
    expect(output.hits[0]!.trace.find((node) => node.id === "characterCritRate")!.result!.value).toBe(.15);
    if (doc.build.mode === "equipment-derived") throw Error();
    doc.build.stats.critRate = .65;
    doc = applyKeqingBurstContext(doc, { ...doc.gameContext!.keqingBurst!, a4IncludedInPanel: true });
    expect(calculateDocument(doc).totals).toEqual(output.totals);
    ordinary(doc, 0).effectiveCritRate = .2;
    doc = applyKeqingBurstContext(doc, { ...doc.gameContext!.keqingBurst!, a4IncludedInPanel: false });
    expect(calculateDocument(doc).hits[0]!.effectiveCritRate).toBe(.2);
    const unknown = structuredClone(doc); delete unknown.gameContext!.ascension;
    expect(calculateDocument(applyKeqingBurstContext(unknown, unknown.gameContext!.keqingBurst!)).status).toBe("blocked");
    const c4 = structuredClone(doc); c4.gameContext!.constellation = 4;
    expect(calculateDocument(applyCharacterConstellationScope(c4)).blockers.join()).toContain("25% ATK");

    doc = get("keqing");
    const emblem = resolveArtifactFormulaEffects({ setId: "artifact-set:15020", pieces: 4, enabled: true });
    const xiphos = resolveWeaponFormulaEffects({ weaponId: "weapon:11418", refinement: 1, enabled: true, context: { timedEffectActive: true, timedSnapshotEm: 100 } });
    // Conditioned ATK/ER values isolate real sourced Emblem + Xiphos formulas, not a claimed full gear build.
    doc.build = { mode: "equipment-derived", characterBaseAtk: 500, weaponBaseAtk: 500, atkPercent: 0, flatAtk: 0, baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 100, critRate: .5, critDamage: 1, energyRechargeBonus: .2,
      equipment: { characterId: "character:10000042", weaponId: "weapon:11418", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "conditioned-source-formula-fixture", sourceRefs: [...emblem.sourceRefs, ...xiphos.sourceRefs], derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [], weaponType: "sword", bonusAccounting: "core-sourced-v1", dynamicHitBonuses: emblem.dynamicHitBonuses, statModifiers: xiphos.statModifiers } };
    doc = applyKeqingBurstContext(doc, doc.gameContext!.keqingBurst!);
    doc = applyKeqingBurstContext(doc, doc.gameContext!.keqingBurst!);
    if (doc.build.mode !== "equipment-derived") throw Error();
    expect(doc.build.equipment!.statModifiers!.filter((modifier) => modifier.id === KEQING_A4_ER_MODIFIER_ID)).toHaveLength(1);
    expect(resolveCalculatorStats(doc.build).energyRecharge).toBeCloseTo(1.386, 12);
    output = calculateDocument(doc);
    expect(output.hits[0]!.trace.find((node) => node.id === "dynamicBonus.0")!.result!.value).toBeCloseTo(.3375, 12); // (1 + .2 + .15) * .25, excluding .036 conversion ER.
    expect(output.totals!.nonCritical).toBeCloseTo(2109.6 * 1.3375, 9);
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(final).totals).toEqual(output.totals);
    const finalAgain = applyKeqingBurstContext(final, final.gameContext!.keqingBurst!);
    expect(calculateDocument(finalAgain).totals).toEqual(output.totals);
    doc.gameContext!.skillId = "keqing-skill";
    const otherAction = applyCharacterConstellationScope(doc);
    if (otherAction.build.mode !== "equipment-derived") throw Error();
    expect(otherAction.build.equipment!.statModifiers!.some((modifier) => modifier.id === KEQING_A4_ER_MODIFIER_ID)).toBe(false);
  });

  it("places Xingqiu C4 only in the talent term, separates reactions, and preserves A4/C2 accounting through JSON", () => {
    let doc = get("xingqiu"); doc.gameContext!.constellation = 4;
    doc = applyCharacterConstellationScope(applyXingqiuSkillContext(doc, { ...doc.gameContext!.xingqiuSkill!, burstActiveAtCast: true, c2ShredActive: true }));
    let output = calculateDocument(doc);
    expect(output.status).toBe("calculated"); expect(output.totals!.nonCritical).toBeCloseTo(3313.62, 9); expect(output.totals!.expected).toBeCloseTo(4970.43, 9);
    ordinary(doc, 0).additiveBaseDamage = 100;
    ordinary(doc, 0).reaction = "vaporize";
    output = calculateDocument(doc);
    expect(output.hits[0]!.nonCritical).toBeCloseTo((1000 * 1.68 * 1.5 + 100) * 1.2 * .5 * 1.025 * 2, 9);
    expect(output.hits[1]!.nonCritical).toBeCloseTo(1000 * 1.912 * 1.5 * 1.2 * .5 * 1.025, 9);
    for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = .2;
    doc.enemy.resistance = -.05;
    doc = applyXingqiuSkillContext(doc, { ...doc.gameContext!.xingqiuSkill!, a4IncludedInPanel: true, c2ShredIncludedInResistance: true });
    expect(calculateDocument(doc).totals).toEqual(output.totals);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
    expect(restored.gameContext!.xingqiuSkill).toEqual(doc.gameContext!.xingqiuSkill);
    expect(calculateDocument(restored).totals).toEqual(output.totals);
    ordinary(doc, 0).effectiveResistance = .2;
    expect(calculateDocument(doc).hits[0]!.nonCritical).toBeCloseTo((1000 * 1.68 * 1.5 + 100) * 1.2 * .5 * .8 * 2, 9);
    doc.gameContext!.ascension = 3;
    expect(calculateDocument(applyXingqiuSkillContext(doc, doc.gameContext!.xingqiuSkill!)).status).toBe("blocked");
    doc = applyXingqiuSkillContext(doc, { ...doc.gameContext!.xingqiuSkill!, a4IncludedInPanel: false });
    expect(calculateDocument(doc).status).toBe("calculated");
    delete doc.gameContext!.ascension;
    expect(calculateDocument(applyXingqiuSkillContext(doc, doc.gameContext!.xingqiuSkill!)).status).toBe("blocked");
  });
});
