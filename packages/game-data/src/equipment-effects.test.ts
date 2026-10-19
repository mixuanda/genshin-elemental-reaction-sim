import { describe, expect, it } from "vitest";
import { artifactSetCatalog } from "./supplemental";
import { gameDataCatalog } from "./catalog";
import { artifactTwoPieceRules, equipmentHitBonusApplies, resolveArtifactSetEffects, resolveWeaponEffects } from "./equipment-effects";
import { equipmentDataSource } from "./equipment-source";

describe("explicit, source-backed equipment effects", () => {
  it.each([
    "harbingerofdawn", "aquilafavonia", "wolfsgravestone", "skywardblade", "skywardharp", "skywardatlas", "skywardpride", "whitetassel",
    "thestringless", "rust", "amosbow", "theblacksword", "coolsteel", "lionsroar", "dragonsbane", "ravenbow"
  ])("executes every recorded refinement of %s against its fixed source clause", slug => {
    const weapon = gameDataCatalog.weapons.find(entry => entry.slug === slug)!;
    expect(weapon.refinements.map(entry => entry.rank)).toEqual([1, 2, 3, 4, 5]);
    for (const refinement of weapon.refinements) {
      const result = resolveWeaponEffects({ weaponId: weapon.id, refinement: refinement.rank, enabled: true, context: { hpFraction: 1, enemyAuras: ["hydro", "pyro"] } });
      expect(result.statContributions.length + result.hitBonuses.length).toBeGreaterThan(0);
      expect(result.effectBlockers.join()).not.toMatch(/该被动的属性、触发/);
      expect([...result.statContributions, ...result.hitBonuses].every(term => Number.isFinite(term.value) && term.sourceRef.includes(`#/r${refinement.rank}`))).toBe(true);
    }
  });

  it("uses each exact Harbinger refinement and reports the independently observed threshold conflict", () => {
    for (const [index, value] of [0.14, 0.175, 0.21, 0.245, 0.28].entries()) {
      const result = resolveWeaponEffects({ weaponId: "weapon:11302", refinement: index + 1, enabled: true, context: { hpFraction: 0.91 } });
      expect(result.statContributions).toEqual([expect.objectContaining({ property: "FIGHT_PROP_CRITICAL", value })]);
      expect(result.effectBlockers).toEqual([]);
      expect(result.verification).toBe("provisional");
    }
    const at = (hpFraction?: number) => resolveWeaponEffects({ weaponId: "weapon:11302", refinement: 5, enabled: true, context: hpFraction === undefined ? {} : { hpFraction } });
    expect(at(0.89).statContributions).toEqual([]);
    expect(at(0.89).effectBlockers).toEqual([]);
    expect(at(0.9).statContributions).toEqual([]);
    expect(at(0.9).effectBlockers.join()).toMatch(/边界存在来源冲突/);
    expect(at().effectBlockers.join()).toMatch(/缺少当前生命比例/);
    expect(() => at(NaN)).toThrow(/有限比例/);
    expect(() => at(1.01)).toThrow(/有限比例/);
  });

  it("applies Rust's gain and penalty only to their attack tags, and elemental bonuses only to elements", () => {
    const rust = resolveWeaponEffects({ weaponId: "weapon:15405", refinement: 5, enabled: true });
    const bonus = (attackTag: "normal" | "charged" | "plunge" | "skill") => rust.hitBonuses.filter(entry => equipmentHitBonusApplies(entry, { element: "physical", attackTag })).reduce((sum, entry) => sum + entry.value, 0);
    expect(bonus("normal")).toBe(0.8);
    expect(bonus("charged")).toBe(-0.1);
    expect(bonus("plunge")).toBe(0);
    expect(bonus("skill")).toBe(0);
    expect(rust.hitBonuses.every(entry => !equipmentHitBonusApplies(entry, { element: "physical" }))).toBe(true);
    const atlas = resolveWeaponEffects({ weaponId: "weapon:14501", refinement: 1, enabled: true });
    expect(equipmentHitBonusApplies(atlas.hitBonuses[0]!, { element: "physical" })).toBe(false);
    expect(equipmentHitBonusApplies(atlas.hitBonuses[0]!, { element: "dendro" })).toBe(true);
    expect(atlas.hitBonuses[0]?.value).toBe(0.12);
    expect(atlas.effectBlockers.join()).toMatch(/追击/);
  });

  it("keeps pre-hit aura separate from the hit's element and does not invent missing conditions", () => {
    const resolve = (enemyAuras?: ("hydro" | "pyro" | "cryo")[]) => resolveWeaponEffects({ weaponId: "weapon:13401", refinement: 3, enabled: true, context: enemyAuras === undefined ? {} : { enemyAuras } });
    expect(resolve().effectBlockers.join()).toMatch(/缺少命中前/);
    expect(resolve([]).hitBonuses).toEqual([]);
    expect(resolve(["cryo"]).hitBonuses).toEqual([]);
    expect(resolve(["hydro"]).hitBonuses[0]?.value).toBe(0.28);
    expect(equipmentHitBonusApplies(resolve(["hydro"]).hitBonuses[0]!, { element: "physical", attackTag: "normal" })).toBe(true);
  });

  it("maps named two-piece sources with a source-drift guard and never assumes four-piece completeness", () => {
    for (const slug of Object.keys(artifactTwoPieceRules)) {
      const set = artifactSetCatalog.find(entry => entry.slug === slug)!;
      expect(set).toBeDefined();
      const result = resolveArtifactSetEffects({ setId: set.id, pieces: 2, enabled: true, context: { nightsoulFrontlineActive: true } });
      expect(result.statContributions.length + result.hitBonuses.length + (result.dynamicHitBonuses?.length ?? 0)).toBe(1);
      expect(result.effectBlockers).toEqual([]);
      expect(result.sourceRefs[0]).toContain(equipmentDataSource.sourceCommit);
    }
    const instructor = resolveArtifactSetEffects({ setId: "artifact-set:10007", pieces: 4, enabled: true });
    expect(instructor.statContributions[0]).toMatchObject({ property: "FIGHT_PROP_ELEMENT_MASTERY", value: 80 });
    expect(instructor.effectBlockers.join()).toMatch(/4 件套/);
    const adventurer = resolveArtifactSetEffects({ setId: "artifact-set:10010", pieces: 2, enabled: true });
    expect(adventurer.statContributions[0]).toMatchObject({ property: "FIGHT_PROP_HP", value: 1000 });
    expect(resolveArtifactSetEffects({ setId: "artifact-set:10010", pieces: 1, enabled: true }).statContributions).toEqual([]);
    const description = artifactSetCatalog.find(entry => entry.slug === "instructor")!.pieceEffects[0]!;
    const previous = description.description;
    try {
      description.description = "元素精通提高100点。";
      expect(() => resolveArtifactSetEffects({ setId: "artifact-set:10007", pieces: 2, enabled: true })).toThrow(/重新审阅/);
    } finally { description.description = previous; }
  });

  it("enforces both four-piece weapon eligibility and attack-tag qualification", () => {
    const gladiator = (weaponType?: "sword" | "bow") => resolveArtifactSetEffects({ setId: "artifact-set:15001", pieces: 4, enabled: true, context: weaponType === undefined ? {} : { weaponType } });
    expect(gladiator().effectBlockers.join()).toMatch(/缺少武器类型/);
    expect(gladiator("bow").hitBonuses).toEqual([]);
    const bonus = gladiator("sword").hitBonuses[0]!;
    expect(bonus.value).toBe(0.35);
    expect(equipmentHitBonusApplies(bonus, { element: "pyro", attackTag: "normal", weaponType: "sword" })).toBe(true);
    expect(equipmentHitBonusApplies(bonus, { element: "pyro", attackTag: "charged", weaponType: "sword" })).toBe(false);
    expect(equipmentHitBonusApplies(bonus, { element: "pyro", attackTag: "normal", weaponType: "bow" })).toBe(false);
    expect(equipmentHitBonusApplies(bonus, { element: "pyro", attackTag: "normal" })).toBe(false);
  });

  it("keeps disabled and unsupported effects explicit and rejects illegal refinement/piece counts", () => {
    const disabled = resolveWeaponEffects({ weaponId: "weapon:11501", refinement: 1, enabled: false });
    expect(disabled.statContributions).toEqual([]);
    expect(disabled.assumptions.join()).toMatch(/明确停用/);
    const aquila = resolveWeaponEffects({ weaponId: "weapon:11501", refinement: 4, enabled: true });
    expect(aquila.statContributions[0]).toMatchObject({ property: "FIGHT_PROP_ATTACK_PERCENT", value: 0.35 });
    expect(aquila.effectBlockers.join()).toMatch(/额外伤害/);
    const unsupported = resolveWeaponEffects({ weaponId: "weapon:15401", refinement: 5, enabled: true });
    expect(unsupported.statContributions).toEqual([]);
    expect(unsupported.effectBlockers).toHaveLength(1);
    expect(() => resolveWeaponEffects({ weaponId: "weapon:11501", refinement: 6, enabled: true })).toThrow(/来源记录/);
    expect(() => resolveArtifactSetEffects({ setId: "artifact-set:15001", pieces: 6, enabled: true })).toThrow(/不同装备槽/);
    expect(resolveArtifactSetEffects({ setId: "artifact-set:15009", pieces: 1, enabled: true }).effectBlockers).toHaveLength(1);
  });
});
