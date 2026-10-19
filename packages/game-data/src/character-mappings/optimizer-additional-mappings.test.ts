import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import {
  optimizerAdditionalMappings,
  optimizerAdditionalMappingExclusions,
  optimizerAdditionalMappingWitnesses,
  optimizerAdditionalSourceEvidence
} from "./optimizer-additional-mappings";

const sourceCommit = "180a0a1015cb725c7570cd828eb086749960df98";

describe("additional Optimizer production-sheet attacks", () => {
  it("requires all fifteen numerical entries to match each explicitly identified source slot", () => {
    expect(new Set(optimizerAdditionalMappings.map((entry) => entry.characterSlug)))
      .toEqual(new Set(["lohen", "linnea", "sandrone", "alyosha"]));
    for (const mapping of optimizerAdditionalMappings) {
      const char = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(char?.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(ability?.parameters[mapping.parameterKey], mapping.id).toEqual(mapping.sourceCoefficientValues);
      expect(mapping.coefficientTolerance, mapping.id).toBe(0);
      expect(mapping).toMatchObject({ sourceRepository: "frzyc/genshin-optimizer", sourceCommit, scalingStat: "atk" });
      const witness = optimizerAdditionalMappingWitnesses.find((entry) => entry.mappingId === mapping.id)!;
      expect(witness.coefficientMatches).toBe(15);
      expect(witness.catalogParameter).toBe(`${mapping.talentSetId}.${mapping.abilityKey}.${mapping.parameterKey}`);
      const index = Number(mapping.parameterKey.replace("param", "")) - 1;
      const sourceGroup = { combat1: "auto", combat2: "skill", combat3: "burst" }[mapping.abilityKey];
      expect(witness.sourceArray).toBe(`skillParam_gen.${sourceGroup}[${index}]`);
    }
    expect(optimizerAdditionalMappings).toHaveLength(43);
    expect(new Set(optimizerAdditionalMappings.map((entry) => entry.id)).size).toBe(43);
  });

  it("keeps the explicit multi-hit input grouping rather than treating every coefficient row as a new action", () => {
    const lohenThird = optimizerAdditionalMappings.filter((entry) => entry.skillId === "lohen-normal-3-base");
    expect(lohenThird).toEqual([expect.objectContaining({ parameterKey: "param3", instanceCount: 3, completeAction: true })]);
    const lohenFifth = optimizerAdditionalMappings.filter((entry) => entry.skillId === "lohen-normal-5-base");
    expect(lohenFifth.map((entry) => entry.parameterKey)).toEqual(["param5", "param6"]);
    const alyoshaThird = optimizerAdditionalMappings.filter((entry) => entry.skillId === "alyosha-normal-3-base");
    expect(alyoshaThird.map((entry) => entry.parameterKey)).toEqual(["param3", "param4"]);
    expect(optimizerAdditionalMappings.find((entry) => entry.skillId === "lohen-charged-base"))
      .toMatchObject({ parameterKey: "param7", instanceCount: 2, completeAction: true });
    expect(new Set(optimizerAdditionalMappings.map((entry) => entry.skillId)).size).toBe(40);
    expect(optimizerAdditionalMappings.reduce((sum, entry) => sum + (entry.instanceCount ?? 1), 0)).toBe(49);
  });

  it("assembles only Sandrone's no-Radiance ordinary two-hit skill and four-hit burst", () => {
    const skill = optimizerAdditionalMappings.filter((entry) => entry.skillId === "sandrone-skill-no-radiance");
    expect(skill).toEqual([expect.objectContaining({ abilityKey: "combat2", parameterKey: "param1", attackTag: "skill", instanceCount: 2 })]);
    const burst = optimizerAdditionalMappings.filter((entry) => entry.skillId === "sandrone-burst-no-radiance");
    expect(burst.map((entry) => [entry.parameterKey, entry.instanceCount])).toEqual([["param1", 3], ["param2", 1]]);
    expect(burst.every((entry) => entry.abilityKey === "combat3" && entry.attackTag === "burst")).toBe(true);
    for (const entry of [...skill, ...burst]) {
      expect(entry).toMatchObject({ element: "cryo", scalingStat: "atk", coefficientMultiplier: 1, completeAction: true });
      expect(entry.assumptions.join(" ")).toContain("Radiance=None");
      expect(entry.assumptions.join(" ")).toContain("a1Decoding=off");
      expect(entry.assumptions.join(" ")).toContain("min(0.08×转换前攻击力,160)");
      expect(entry.exclusions.join(" ")).toContain("StellarConduct/StellarSwirl");
      const witness = optimizerAdditionalMappingWitnesses.find((item) => item.mappingId === entry.id)!;
      expect(witness.formula).toContain("dmgNode");
      expect(witness.formula).not.toContain("stellarDmgNode");
      expect(["param4", "param6"]).not.toContain(entry.parameterKey);
    }
    expect(skill[0]!.assumptions.join(" ")).toContain("prismDmg1 与 prismDmg2");
    expect(burst[1]!.assumptions.join(" ")).toContain("不叠加到普通光束");
    // Linnea and Lohen candidates still require resistance or resource expressions.
    expect(optimizerAdditionalMappings.filter((entry) => entry.abilityKey !== "combat1").every((entry) => ["sandrone", "alyosha"].includes(entry.characterSlug))).toBe(true);
    expect(optimizerAdditionalMappingExclusions.find((entry) => entry.characterSlug === "alyosha")?.reason).toContain("0.0035×min(100×ER,200)");
    expect(optimizerAdditionalMappingExclusions.find((entry) => entry.characterSlug === "linnea")?.reason).toContain("−0.30");
    expect(optimizerAdditionalMappingExclusions.find((entry) => entry.characterSlug === "lohen")?.reason).toContain("不可虚设 willConsumed=0");
  });

  it("binds Alyosha's mandatory A4 to every E/Q component without turning partial burst ticks into a full action", () => {
    const direct = optimizerAdditionalMappings.filter((entry) => entry.characterSlug === "alyosha" && entry.abilityKey !== "combat1");
    expect(direct).toHaveLength(4);
    expect(direct.map((entry) => [entry.skillId, entry.abilityKey, entry.parameterKey, entry.completeAction])).toEqual([
      ["alyosha-skill-press", "combat2", "param1", true],
      ["alyosha-skill-hold", "combat2", "param2", true],
      ["alyosha-burst-field-tick", "combat3", "param1", false],
      ["alyosha-burst-tugarin-bite", "combat3", "param2", false]
    ]);
    for (const entry of direct) {
      expect(entry).toMatchObject({ damageBonusFormulaId: "alyosha-a4-er", element: "electro", scalingStat: "atk", instanceCount: 1 });
      expect(entry.assumptions.join(" ")).toContain("共享核心自动加算");
      expect(entry.assumptions.join(" ")).toContain("缺失时阻塞，不能默认");
      expect(entry.assumptions.join(" ")).toContain("不得再次手动叠加该 A4");
      expect(entry.assumptions.join(" ")).toContain("未触发时不虚构加攻");
      const witness = optimizerAdditionalMappingWitnesses.find((item) => item.mappingId === entry.id)!;
      expect("damageBonusEvidence" in witness && witness.damageBonusEvidence).toContain("input.total.enerRech_");
    }
    expect(optimizerAdditionalMappings.filter((entry) => entry.characterSlug === "alyosha" && entry.abilityKey === "combat1").every((entry) => entry.damageBonusFormulaId === undefined)).toBe(true);
  });

  it("distinguishes physical arrows, Geo full charge and Sandrone's explicit Cryo components", () => {
    expect(optimizerAdditionalMappings.find((entry) => entry.skillId === "linnea-aimed-base"))
      .toMatchObject({ parameterKey: "param4", element: "physical", attackTag: "charged", completeAction: true });
    const fullAim = optimizerAdditionalMappings.find((entry) => entry.skillId === "linnea-fully-aimed-base")!;
    expect(fullAim).toMatchObject({ parameterKey: "param5", element: "geo", attackTag: "charged", completeAction: true });
    expect(fullAim.assumptions.join(" ")).toContain("战斗中的普通箭");
    expect(fullAim.exclusions.join(" ")).toContain("0.2");
    const sandroneCharged = optimizerAdditionalMappings.filter((entry) => entry.characterSlug === "sandrone" && entry.attackTag === "charged");
    expect(sandroneCharged.map((entry) => entry.parameterKey)).toEqual(["param4", "param5", "param7"]);
    expect(sandroneCharged.every((entry) => entry.element === "cryo" && !entry.completeAction && entry.instanceCount === 1)).toBe(true);
    expect(optimizerAdditionalMappings.filter((entry) => entry.attackTag === "normal").every((entry) => entry.element === "physical")).toBe(true);
  });

  it("makes passive state requirements explicit without assuming that C0 disables ascension passives", () => {
    const assumptions = (slug: string) => optimizerAdditionalMappings.find((entry) => entry.characterSlug === slug)!.assumptions.join(" ");
    expect(assumptions("lohen")).toContain("a4MasterCryo=off");
    expect(assumptions("lohen")).toContain("lockBuff=off");
    expect(assumptions("linnea")).toContain("a1Lumi=off");
    expect(assumptions("linnea")).toContain("A4 基于防御力的元素精通增益必须包含");
    expect(assumptions("sandrone")).toContain("min(0.08×转换前攻击力,160)");
    expect(assumptions("sandrone")).toContain("a0StellarRadianceSc 未启用");
    expect(assumptions("alyosha")).toContain("skillPrecision 未启用");
    expect(assumptions("alyosha")).toContain("即使 C0 也会对 skill/burst 生效");
    expect(optimizerAdditionalMappingExclusions.find((entry) => entry.characterSlug === "alyosha")?.reason).toContain("A4");
  });

  it("separates a collision component from one impact under the zero-collision plunge condition", () => {
    const plunges = optimizerAdditionalMappings.filter((entry) => entry.attackTag === "plunge");
    expect(plunges).toHaveLength(12);
    for (const mapping of plunges) {
      expect(mapping.element).toBe("physical");
      const collision = mapping.skillId.includes("-collision-");
      expect(mapping.completeAction, mapping.id).toBe(!collision);
      if (collision) expect(mapping.assumptions.join(" ")).toContain("仅一次途中碰撞");
      else expect(mapping.assumptions.join(" ")).toContain("此次下落没有途中碰撞");
    }
  });

  it("pins every inspected production file and records rejected TODO formulas separately", () => {
    const evidence = optimizerAdditionalSourceEvidence;
    expect(evidence.commit).toBe(sourceCommit);
    expect(evidence.verifiedCoefficientPositions).toBe(645);
    expect(evidence.sourceFiles).toHaveLength(18);
    expect(evidence.rejectedFormulaPlaceholders).toHaveLength(4);
    expect(evidence.rejectionReason).toContain("TODO");
    const hashes = evidence.sourceSha256;
    for (const mapping of optimizerAdditionalMappings) {
      for (const path of mapping.sourcePaths) {
        expect(hashes[path as keyof typeof hashes], path).toMatch(/^[a-f0-9]{64}$/);
        expect(path).not.toContain("/formula/src/data/char/");
        expect(evidence.sourceFiles.find((entry) => entry.path === path)?.url)
          .toBe(`https://raw.githubusercontent.com/frzyc/genshin-optimizer/${sourceCommit}/${path}`);
      }
    }
  });
});
