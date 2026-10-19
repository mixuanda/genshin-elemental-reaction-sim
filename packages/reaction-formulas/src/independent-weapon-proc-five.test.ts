import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import evidence from "../../game-data/sources/weapon-proc-five/manifest.json";
import optimizerEvidence from "../../game-data/sources/weapon-proc-five-optimizer/manifest.json";
import { getWeaponProcCoefficient, getWeaponProcCooldownFrames, getWeaponProcDefinition, getWeaponProcTriggerProbability, type WeaponProcId } from "./independent-weapon-proc";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const vector = (text: string, name: string) => text.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`))![1]!.split(",").map(Number).slice(1);

it("pins five proc contracts to actual gcsim, catalogue and Optimizer bytes without rounding RNG or guessing the triggering aura", () => {
  const packed = readFileSync(evidence.archivePath); expect(hash(packed)).toBe(evidence.archiveSha256);
  const files = JSON.parse(gunzipSync(packed).toString()).files as Record<string, string>;
  for (const row of evidence.files) expect(hash(files[row.archiveEntry]!), row.path).toBe(row.sha256);
  const optimizer = new Map<string, string>();
  for (const row of optimizerEvidence.files) {
    const bytes = readFileSync(row.archivedPath); expect(hash(bytes), row.path).toBe(row.sha256);
    expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), row.path).toBe(row.gitBlobSha);
    optimizer.set(row.path, bytes.toString());
  }
  const ids: WeaponProcId[] = ["filletblade", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer"];
  let checkedCoefficients = 0, maxCoefficientDelta = 0;
  for (const weaponId of ids) {
    const def = getWeaponProcDefinition(weaponId)!;
    const sourcePath = def.sourceRef.split(`${evidence.commits.gcsim}/`)[1]!;
    const source = files[`gcsim/${sourcePath}`]!;
    const catalog = JSON.parse(files[`genshin-db/src/data/ChineseSimplified/weapons/${weaponId}.json`]!);
    const go = optimizerEvidence.sourceReview.weaponFindings.find(row => `weapon:${row.weaponId}` === def.catalogWeaponId)!;
    const sheet = optimizer.get(go.sheetPath)!;
    const normal = vector(sheet, def.cryoOrFrozenCoefficients ? "dmgAoePerc" : "dmg_Src");
    const cryo = def.cryoOrFrozenCoefficients ? vector(sheet, "dmgCryoPerc") : undefined;
    expect(`weapon:${catalog.id}`).toBe(def.catalogWeaponId); expect(catalog.name).toBe(def.weaponName);
    expect(def.scalingStat).toBe("atk"); expect(def.requiresOnField).toBe(true);
    expect(source).toContain("Element:    attributes.Physical"); expect(source).toContain("0, 1)");
    for (let refinement = 1; refinement <= 5; refinement++) {
      const values = catalog[`r${refinement}`].values as string[];
      const coefficient = getWeaponProcCoefficient(def, refinement, false);
      const expected = weaponId === "filletblade" ? 2 + .4 * refinement : weaponId === "prototypearchaic" ? 1.8 + refinement * .6 : .65 + refinement * .15;
      expect(coefficient).toBe(expected);
      const catalogCoefficient = parseFloat(values[def.cryoOrFrozenCoefficients ? 1 : 0]!) / 100;
      maxCoefficientDelta = Math.max(maxCoefficientDelta, Math.abs(coefficient - normal[refinement - 1]!), Math.abs(coefficient - catalogCoefficient));
      expect(coefficient).toBeCloseTo(normal[refinement - 1]!, 14); expect(coefficient).toBeCloseTo(catalogCoefficient, 14); checkedCoefficients++;
      expect(getWeaponProcCooldownFrames(def, refinement)).toBe(go.cooldownSecondsByRefinementFromDescription[refinement - 1]! * 60);
      expect(getWeaponProcTriggerProbability(def, refinement)).toBe(def.cryoOrFrozenCoefficients ? .5 + refinement * .1 : .5);
      expect(getWeaponProcTriggerProbability(def, refinement)).toBeCloseTo(go.probabilityByRefinementFromDescription[refinement - 1]!, 15);
      if (cryo) {
        const higher = getWeaponProcCoefficient(def, refinement, true);
        expect(higher).toBe(1.6 + refinement * .4);
        expect(higher).toBeCloseTo(cryo[refinement - 1]!, 14); expect(higher).toBeCloseTo(parseFloat(values[2]!) / 100, 14);
        maxCoefficientDelta = Math.max(maxCoefficientDelta, Math.abs(higher - cryo[refinement - 1]!)); checkedCoefficients++;
      }
    }
    if (def.cryoOrFrozenCoefficients) {
      expect(() => getWeaponProcCoefficient(def, 1)).toThrow("需要明确原触发目标");
      expect(def.triggerAttackTags).toEqual(["normal", "charged"]); expect(def.randomTrigger!.successComparison).toBe("<");
      expect(def.randomTrigger!.zeroDamageGate).toBe("none"); expect(source).toContain("c.Rand.Float64() < prob");
      expect(source.indexOf("AuraContains")).toBeLessThan(source.indexOf("c.QueueAttack"));
      expect(source).toContain("combat.NewCircleHitOnTarget(t, nil, 3)");
      expect(source).not.toContain("dmg == 0"); expect(getWeaponProcTriggerProbability(def, 5)).toBe(1);
    } else if (weaponId === "filletblade") {
      expect(def.triggerAttackTags).toBeNull(); expect(def.randomTrigger!.successComparison).toBe("<=");
      expect(def.randomTrigger!.zeroDamageGate).toBe("after-roll");
      expect(source).toContain("c.Rand.Float64() > 0.5"); expect(source.indexOf("c.Rand.Float64()")).toBeLessThan(source.indexOf("dmg == 0"));
      expect(source).toContain("combat.NewSingleTargetHit(trg.Key())");
    } else {
      expect(def.triggerAttackTags).toEqual(["normal", "charged"]); expect(def.randomTrigger!.successComparison).toBe("<");
      expect(def.randomTrigger!.zeroDamageGate).toBe("none"); expect(source).toContain("c.Rand.Float64() < 0.5"); expect(source).not.toContain("dmg == 0");
    }
  }
  expect(checkedCoefficients).toBe(40); expect(maxCoefficientDelta).toBeLessThan(1e-14);
  console.info(`Five-proc source contract: ${checkedCoefficients} coefficient positions; max machine delta ${maxCoefficientDelta}; ${evidence.files.length}+${optimizerEvidence.files.length} raw files.`);
});
