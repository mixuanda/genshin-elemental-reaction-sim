import { describe, expect, it } from "vitest";
import { SPECIAL_FORMULA_RULES } from "@genshin-dps-lab/reaction-formulas";
import {
  calculateDocument,
  evaluateCalculatorTrust,
  getCalculatorHitSourceContract,
  getCalculatorHitTrustDependencies,
  type CalculatorDocument,
  type CalculatorTrustContext,
} from "../calculator";

/** Policy fixtures only: these grants do not promote any bundled game data. */
function documentFixture(): CalculatorDocument {
  return {
    schemaVersion: "1.0.0",
    ruleVersion: "ordinary-trace-v1",
    id: "trust-policy-fixture",
    label: "可信链策略夹具",
    scope: "single-hit",
    characterLevel: 90,
    build: {
      mode: "manual-final",
      stats: { atk: 2000, hp: 12000, def: 700, em: 0, critRate: 0.5, critDamage: 1 },
      source: "Explicit synthetic panel for a trust-policy test",
    },
    enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{
      id: "policy-hit",
      label: "策略测试命中",
      kind: "ordinary",
      element: "physical",
      attackTag: "skill",
      terms: [{ stat: "atk", coefficient: 2 }],
      additiveBaseDamage: 0,
      damageBonus: 0,
      critEligible: true,
      reaction: "none",
      reactionBonus: 0,
      groupMultiplier: 1,
      damageBonusFormula: {
        ruleId: "policy-fixture.condition-bonus",
        label: "显式条件输入",
        expression: {
          kind: "multiply",
          terms: [{ kind: "constant", value: 0.1 }, { kind: "variable", key: "conditionStacks" }],
        },
        inputs: [{
          key: "conditionStacks", value: 1, unit: "count", meaningKey: "input.conditionStacks",
          origin: "conditioned-user-input", minimum: 0, maximum: 3, integer: true,
        }],
        sourceRefs: ["fixture-source:condition-rule"],
      },
      sourceRefs: ["fixture-source:coefficient"],
      dependencies: ["policy.coefficient", "policy.condition-rule"],
    }],
    selectedHitIds: ["policy-hit"],
    assumptions: ["A synthetic numerical fixture; no real character or data promotion."],
    dependencies: [
      { id: "policy.coefficient", status: "provisional", reason: "Fixture coefficient", sourceRefs: ["fixture-source:coefficient"] },
      { id: "policy.condition-rule", status: "provisional", reason: "Fixture condition rule", sourceRefs: ["fixture-source:condition-rule"] },
    ],
    dataIdentity: {
      datasetId: "policy-fixture-released",
      gameVersion: "policy-fixture-version",
      releaseStatus: "released",
      evidenceStatus: "provisional",
    },
  };
}

function trustFixture(document: CalculatorDocument) {
  const dependencyIds = [...new Set(document.selectedHitIds.flatMap(id => getCalculatorHitTrustDependencies(document, id)))];
  return {
    trustedReleasedSources: [{
      datasetId: document.dataIdentity.datasetId,
      gameVersion: document.dataIdentity.gameVersion,
      snapshotId: "policy-fixture-snapshot",
      promotionId: "policy-fixture-promotion",
      releaseStatus: "released" as const,
      verifiedDependencies: dependencyIds.map(id => ({ id, evidenceRefs: [`fixture-evidence:${id}`] })),
      hitContracts: document.selectedHitIds.map(hitId => ({
        hitId,
        sourceContract: getCalculatorHitSourceContract(document, hitId),
        dependencyIds: getCalculatorHitTrustDependencies(document, hitId),
      })),
    }],
  } satisfies CalculatorTrustContext;
}

function ordinaryHit(document: CalculatorDocument) {
  const hit = document.hits[0]!;
  if (hit.kind !== "ordinary") throw new Error("Expected ordinary policy fixture");
  return hit;
}

function equipmentDocumentFixture(): CalculatorDocument {
  const document = documentFixture();
  document.build = {
    mode: "equipment-derived",
    characterBaseAtk: 300, weaponBaseAtk: 500, atkPercent: 1, flatAtk: 400,
    baseHp: 12000, hpPercent: 0, flatHp: 0, baseDef: 700, defPercent: 0, flatDef: 0,
    em: 0, critRate: 0.5, critDamage: 1,
    equipment: {
      characterId: "fixture-character", weaponId: "fixture-weapon", level: 90, ascension: 6,
      weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "policy-fixture-version",
      sourceRefs: ["fixture-source:equipment"], derivedStats: [], secondaryContributions: [],
      assumptions: [], effectBlockers: [],
    },
  };
  return document;
}

describe("dependency-scoped calculator trust policy", () => {
  it("never trusts a document self-claim or a legacy dataset allowlist", () => {
    const document = documentFixture();
    document.dataIdentity.evidenceStatus = "verified";
    for (const dependency of document.dependencies) dependency.status = "verified";
    for (const trust of [{}, { trustedVerifiedDatasetIds: [document.dataIdentity.datasetId] }]) {
      expect(evaluateCalculatorTrust(document, trust).verified).toBe(false);
      expect(calculateDocument(document, trust).verification).toBe("provisional");
    }
  });

  it("accepts a matching promoted grant despite conservative document metadata", () => {
    const document = documentFixture();
    const trust = trustFixture(document);
    expect(evaluateCalculatorTrust(document, trust)).toMatchObject({ verified: true });
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
  });

  it("does not require unrelated missing rotation data for the selected hit", () => {
    const document = documentFixture();
    const trust = trustFixture(document);
    document.dependencies.push({ id: "unrelated.rotation", status: "missing", reason: "No timing evidence", sourceRefs: [] });
    expect(getCalculatorHitTrustDependencies(document, "policy-hit")).not.toContain("unrelated.rotation");
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
  });

  it.each(["missing", "empty"] as const)("downgrades relevant %s external evidence without fabricating a blocker", evidence => {
    const document = documentFixture();
    const trust = trustFixture(document);
    const source = trust.trustedReleasedSources[0]!;
    expect(source.verifiedDependencies.length).toBeGreaterThan(0);
    if (evidence === "missing") source.verifiedDependencies.shift();
    else source.verifiedDependencies[0]!.evidenceRefs = [];
    const policy = evaluateCalculatorTrust(document, trust);
    expect(policy.verified).toBe(false);
    expect(policy.reasons.length).toBeGreaterThan(0);
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "provisional" });
  });

  it.each(["coefficient", "expression", "origin"] as const)("cannot reuse a grant after a sourced %s change", field => {
    const document = documentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    const hit = ordinaryHit(document);
    if (field === "coefficient") hit.terms[0]!.coefficient = 3;
    else if (field === "expression") hit.damageBonusFormula!.expression = { kind: "constant", value: 0.8 };
    else hit.damageBonusFormula!.inputs[0]!.origin = "unverified-source:replacement";
    expect(getCalculatorHitSourceContract(document, "policy-hit")).not.toBe(originalContract);
    expect(evaluateCalculatorTrust(document, trust).verified).toBe(false);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it("keeps grants valid when explicit panel, enemy and formula condition values change", () => {
    const document = documentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    const before = calculateDocument(document, trust);
    if (document.build.mode !== "manual-final") throw new Error("Expected manual fixture");
    document.build.stats.atk = 2300;
    document.build.stats.critRate = 0.75;
    document.enemy.level = 100;
    document.enemy.resistance = -0.1;
    ordinaryHit(document).damageBonusFormula!.inputs[0]!.value = 2;
    expect(getCalculatorHitSourceContract(document, "policy-hit")).toBe(originalContract);
    const after = calculateDocument(document, trust);
    expect(after.verification).toBe("verified");
    expect(after.totals?.expected).not.toBe(before.totals?.expected);
  });

  it.each(["preview", "official-next", "unknown"] as const)("does not turn %s data into verified released output", releaseStatus => {
    const document = documentFixture();
    const trust = trustFixture(document);
    document.dataIdentity.releaseStatus = releaseStatus;
    expect(evaluateCalculatorTrust(document, trust).verified).toBe(false);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it.each(["datasetId", "gameVersion", "promotionId", "snapshotId"] as const)("requires matching identity and a nonempty promotion chain (%s)", field => {
    const document = documentFixture();
    const trust = trustFixture(document);
    trust.trustedReleasedSources[0]![field] = field === "datasetId" || field === "gameVersion" ? "different-fixture" : "";
    expect(evaluateCalculatorTrust(document, trust).verified).toBe(false);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it("requires contracts only for selected hits and expands requirements when scope expands", () => {
    const document = documentFixture();
    const trust = trustFixture(document);
    const other = structuredClone(ordinaryHit(document));
    other.id = "unselected-hit";
    other.dependencies = ["other.coefficient"];
    document.hits.push(other);
    document.dependencies.push({ id: "other.coefficient", status: "provisional", reason: "Separate unpromoted action", sourceRefs: ["fixture-source:other"] });
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
    document.scope = "one-cast";
    document.selectedHitIds.push(other.id);
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "provisional" });
  });

  it("permits equipment-derived arithmetic when its relevant source contract is promoted", () => {
    const document = equipmentDocumentFixture();
    const trust = trustFixture(document);
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
  });

  it("binds an identical sourced formula to its calculation slot", () => {
    const document = documentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    const originalDependencies = getCalculatorHitTrustDependencies(document, "policy-hit");
    const hit = ordinaryHit(document);
    hit.additiveBaseFormula = hit.damageBonusFormula;
    delete hit.damageBonusFormula;
    expect(getCalculatorHitTrustDependencies(document, "policy-hit")).toEqual(originalDependencies);
    expect(getCalculatorHitSourceContract(document, "policy-hit")).not.toBe(originalContract);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it("binds relevant equipment aggregate values even when derivation rows are absent", () => {
    const document = equipmentDocumentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    if (document.build.mode !== "equipment-derived") throw new Error("Expected equipment fixture");
    expect(document.build.equipment!.derivedStats).toEqual([]);
    expect(getCalculatorHitTrustDependencies(document, "policy-hit")).toContain("equipment:panel:characterBaseAtk");
    document.build.characterBaseAtk = 900;
    expect(getCalculatorHitSourceContract(document, "policy-hit")).not.toBe(originalContract);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it("does not require or bind irrelevant HP equipment inputs for an ATK-only hit", () => {
    const document = equipmentDocumentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    const before = calculateDocument(document, trust);
    if (document.build.mode !== "equipment-derived") throw new Error("Expected equipment fixture");
    document.build.baseHp = 32000;
    expect(getCalculatorHitTrustDependencies(document, "policy-hit")).not.toContain("equipment:panel:baseHp");
    expect(getCalculatorHitSourceContract(document, "policy-hit")).toBe(originalContract);
    const after = calculateDocument(document, trust);
    expect(after.verification).toBe("verified");
    expect(after.totals).toEqual(before.totals);
  });

  it("excludes unmatched elemental equipment rules and their source references", () => {
    const document = equipmentDocumentFixture();
    const trust = trustFixture(document);
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    if (document.build.mode !== "equipment-derived") throw new Error("Expected equipment fixture");
    document.build.equipment!.hitBonuses = [{
      id: "irrelevant-pyro-rule", label: "Unrelated Pyro bonus", value: 0.5,
      elements: ["pyro"], sourceRef: "fixture-source:unmatched-pyro",
    }];
    document.build.equipment!.sourceRefs.push("fixture-source:unmatched-pyro");
    const dependencies = getCalculatorHitTrustDependencies(document, "policy-hit");
    expect(dependencies).not.toContain("equipment:irrelevant-pyro-rule");
    expect(dependencies).not.toContain("source:fixture-source:unmatched-pyro");
    expect(getCalculatorHitSourceContract(document, "policy-hit")).toBe(originalContract);
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
  });

  it("accepts a fictional direct special formula grant and rejects a changed talent coefficient", () => {
    const document = documentFixture();
    document.hits = [{
      id: "policy-hit", label: "Fictional direct special formula", kind: "special",
      sourceRefs: ["fixture-source:special-action"], dependencies: ["policy.special-coefficient"],
      context: {
        branch: "lunar-charged-direct", ruleVersion: SPECIAL_FORMULA_RULES.lunar.id,
        context: {
          mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed",
          assumptions: ["Synthetic policy fixture with explicit eligibility; no real character claim."],
        },
        effectiveResistance: 0.1,
        contributors: [{
          id: "fictional-owner",
          base: {
            kind: "direct-stat-talent", scalingStat: "atk", statValue: 2000,
            talentCoefficient: 0.2, sourceRefs: ["fixture-source:special-coefficient"],
          },
          elementalMastery: 100, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0,
          elevationMultiplier: 1, critRate: 0.5, critDamage: 1,
          modifierSourceRefs: ["fixture-source:special-modifiers"],
        }],
      },
    }];
    document.dependencies = [{
      id: "policy.special-coefficient", status: "provisional", reason: "Fictional direct coefficient",
      sourceRefs: ["fixture-source:special-coefficient"],
    }];
    const dependencies = getCalculatorHitTrustDependencies(document, "policy-hit");
    expect(dependencies).toContain(`rule:${SPECIAL_FORMULA_RULES.lunar.id}`);
    expect(dependencies).toContain("special:lunar-charged-direct");
    expect(dependencies).toContain("source:fixture-source:special-coefficient");
    expect(dependencies).toContain("source:fixture-source:special-modifiers");
    const trust = trustFixture(document);
    expect(calculateDocument(document, trust)).toMatchObject({ status: "calculated", verification: "verified" });
    const originalContract = getCalculatorHitSourceContract(document, "policy-hit");
    const hit = document.hits[0]!;
    if (hit.kind !== "special" || hit.context.contributors[0]!.base.kind !== "direct-stat-talent") throw new Error("Expected direct special fixture");
    hit.context.contributors[0]!.base.talentCoefficient = 0.3;
    expect(getCalculatorHitSourceContract(document, "policy-hit")).not.toBe(originalContract);
    expect(calculateDocument(document, trust).verification).toBe("provisional");
  });

  it("requires only occurrence evidence for a disabled critical-triggered child", () => {
    const document = documentFixture();
    const child = structuredClone(ordinaryHit(document));
    child.id = "disabled-child";
    child.dependencies = ["missing.child-coefficient"];
    child.occurrence = {
      kind: "critical-hit", sourceHitId: "policy-hit", enabled: false,
      sourceRefs: ["fixture-occurrence"],
    };
    document.hits.push(child);
    document.selectedHitIds = [child.id];
    document.dependencies.push({
      id: "missing.child-coefficient", status: "missing", reason: "No child coefficient evidence", sourceRefs: [],
    });
    expect(getCalculatorHitTrustDependencies(document, child.id)).toEqual([
      "rule:critical-hit-occurrence", "rule:ordinary-trace-v1", "source:fixture-occurrence",
    ]);
    const trust = trustFixture(document);
    const result = calculateDocument(document, trust);
    expect(result).toMatchObject({ status: "calculated", verification: "verified" });
    expect(result.hits.find(hit => hit.id === child.id)?.status).toBe("non-damaging");
    const originalContract = getCalculatorHitSourceContract(document, child.id);
    child.occurrence.enabled = true;
    expect(getCalculatorHitSourceContract(document, child.id)).not.toBe(originalContract);
    expect(evaluateCalculatorTrust(document, trust).verified).toBe(false);
    expect(calculateDocument(document, trust).status).toBe("blocked");
  });
});
