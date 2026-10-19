import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AMBER_NORMAL_CHAIN_CONTRACT, AMBER_SKILL_BURST_LEGACY_CONTRACT as AMBER_SKILL_BURST_CONTRACT, createAmberNormalChainScenario,
  createAmberSkillBurstScenario, deriveSourceBackedRotationMappings, getSourceActionContract, validateSourceBackedActionSequence
} from "../source-action-library";
import { simulate } from "../simulator";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import type { DamageCalculationInput } from "../formulas";
import { getCharacterDocuments, applyCharacterConstellationScope } from "../../../../apps/web/src/character-calculations";
import { getClassifiedHitCoverage, resolveClassifiedCharacterHits } from "../../../game-data/src/classified-hits";

const reference = JSON.parse(readFileSync(new URL("../../../../docs/cross-validation/action-library/amber-skill-burst-contract.json", import.meta.url), "utf8")) as {
  externalValidation: { damageEvents: Array<{ frame: number; sourceFrame: number; damage: number }>; totalDamage: number };
};

describe("fixed-source Amber natural-expiry E and eighteen-hit Q", () => {
  it("matches external input, snapshot, expiry, delayed debit, damage and particles without shifting frames", () => {
    const config = createAmberSkillBurstScenario("legacy-v1");
    const result = simulate(JSON.parse(JSON.stringify(config)), { execution: { captureHits: true } });
    expect(result.timelineExecution!.commandResults.map((entry) => entry.startFrame)).toEqual([1, 33]);
    expect(result.damageEvents.map((event) => event.frame)).toEqual(reference.externalValidation.damageEvents.map((entry) => entry.frame));
    expect(result.damageEvents.map((event) => event.finalDamage)).toEqual(reference.externalValidation.damageEvents.map((entry) => entry.damage));
    expect(result.totalDamage).toBe(reference.externalValidation.totalDamage);
    expect(result.summonLog?.map((entry) => [entry.operation, entry.frame, entry.snapshotFrame, entry.attackFrame])).toEqual([
      ["spawn", 46, 46, 531], ["expire", 530, 46, 531]
    ]);
    expect(result.energyCostLog?.map((entry) => [entry.operation, entry.frame, entry.energyBefore, entry.energyAfter])).toEqual([
      ["reserve", 33, 40, 40], ["debit", 92, 40, 0]
    ]);
    const particles = result.energyLog.filter((entry) => entry.particleCount !== null);
    expect(particles).toHaveLength(1);
    expect(particles[0]).toMatchObject({ spawnFrame: 531, receiveFrame: 631, particleCount: 4, particleElement: "pyro", gainedEnergy: 12, energyAfter: 12 });
    expect(result.executionAudit?.hits).toHaveLength(19);
    const finalHit = result.damageEvents.at(-1)!;
    expect(finalHit.statsBeforeDamage).toEqual(result.summonLog?.[0]?.snapshot);

    for (const event of result.damageEvents) {
      const replay = replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, event.id))));
      expect(replay.reproducedDamage).toBe(event.finalDamage);
      const input = replay.formulaInput as DamageCalculationInput;
      const calculated = calculateDocument({
        schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: `amber-eq-hit-${event.id}`, label: "安柏来源命中完整还原", scope: "single-hit", characterLevel: input.characterLevel,
        build: { mode: "manual-final", stats: { atk: input.scalingValue, hp: 793.2582, def: 50.358, em: input.elementalMastery, critRate: input.critRate, critDamage: input.critDamage }, source: "实际捕获的来源动作上下文" },
        enemy: { level: input.enemyLevel, resistance: input.effectiveResistance, defenseAdjustment: input.defenseReduction, defenseIgnore: input.defenseIgnore },
        hits: [{ id: "hit", label: event.hitLabel, kind: "ordinary", element: "pyro", attackTag: event.id === finalHit.id ? "skill" : "burst", terms: [{ stat: "atk", coefficient: input.scaling }], additiveBaseDamage: input.flatDamage, damageBonus: input.damageBonus, critEligible: true, reaction: input.reaction, reactionBonus: input.reactionBonus, groupMultiplier: input.groupMultiplier, sourceRefs: [...AMBER_SKILL_BURST_CONTRACT.sourceUrls], dependencies: [] }],
        selectedHitIds: ["hit"], dependencies: [], assumptions: [AMBER_SKILL_BURST_CONTRACT.scope],
        dataIdentity: { datasetId: config.dataVersion, gameVersion: "fixed-community-reference", releaseStatus: "unknown", evidenceStatus: "provisional" }
      });
      expect(calculated.totals?.nonCritical).toBe(event.finalDamage);
    }
  });

  it("preserves old N1–N5 and validates source E/Q resets, waits and the unmodeled normal-energy boundary", () => {
    const old = createAmberNormalChainScenario();
    const config = createAmberSkillBurstScenario("legacy-v1");
    expect(getSourceActionContract(old)?.id).toBe(AMBER_NORMAL_CHAIN_CONTRACT.id);
    expect(config.timeline!.abilities.filter((entry) => entry.kind === "normal")).toEqual(old.timeline!.abilities);
    expect(deriveSourceBackedRotationMappings(config)?.aliases?.amber).toMatchObject({ E: "amber-skill-tap-expiry", "E.tap": "amber-skill-tap-expiry", Q: "amber-burst-fiery-rain" });
    config.timeline!.commands = [
      { type: "normal", actorId: "amber", abilityId: "amber-normal-1", atFrame: 1 },
      { type: "skill", actorId: "amber", abilityId: "amber-skill-tap-expiry" },
      { type: "normal", actorId: "amber", abilityId: "amber-normal-1" },
      { type: "wait", frames: 100 },
      { type: "normal", actorId: "amber", abilityId: "amber-normal-2" },
      { type: "burst", actorId: "amber", abilityId: "amber-burst-fiery-rain" }
    ];
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    config.timeline!.commands[4] = { type: "normal", actorId: "amber", abilityId: "amber-normal-1" };
    expect(validateSourceBackedActionSequence(config).status).toBe("invalid");
    config.timeline!.commands = [...createAmberSkillBurstScenario("legacy-v1").timeline!.commands, { type: "normal", actorId: "amber", abilityId: "amber-normal-1" }];
    expect(() => simulate(config)).toThrow("普攻随机回能尚未映射");
  });

  it("rejects edited energy, summon lifetimes and unsupported dynamic contexts under the source identity", () => {
    for (const field of ["energy", "summon", "initial-energy"] as const) {
      const config = createAmberSkillBurstScenario("legacy-v1");
      if (field === "energy") config.timeline!.abilities.find((entry) => entry.kind === "burst")!.energyCostFrame = 0;
      else if (field === "summon") {
        const ability = config.timeline!.abilities.find((entry) => entry.kind === "skill")!;
        ability.summons![0]!.lifetimeFrames = 1;
        ability.hits![0]!.frame = 47; // Internally valid timing must still fail the pinned-source signature.
      }
      else config.characters[0]!.initialEnergy = 0;
      expect(() => simulate(config)).toThrow("来源动作契约校验失败");
    }
    const movement = createAmberSkillBurstScenario("legacy-v1");
    movement.timeline!.commands.push({ type: "dash", actorId: "amber", frames: 8 });
    expect(validateSourceBackedActionSequence(movement).status).toBe("invalid");
  });

  it("offers standalone E and eighteen-hit Q with sourced A1, explicit ascension and exact JSON/final replay", () => {
    const resolved = resolveClassifiedCharacterHits("character:10000021", 1);
    expect(resolved.blockers).toEqual([]);
    expect(resolved.hits).toHaveLength(24); // Original five normal hits plus E and eighteen Q hits.
    const docs = getCharacterDocuments("character:10000021", 1);
    const skill = docs.find((doc) => doc.gameContext?.skillId === AMBER_SKILL_BURST_CONTRACT.skill.abilityId);
    const burst = docs.find((doc) => doc.gameContext?.skillId === AMBER_SKILL_BURST_CONTRACT.burst.abilityId);
    if (!skill || !burst || !skill.gameContext || !burst.gameContext) throw Error("Both standalone source actions must exist");
    expect(skill.gameContext.abilityId).toBe("talent:amber:combat2");
    expect(burst.gameContext.abilityId).toBe("talent:amber:combat3");
    expect(skill.gameContext.scopeCoverage).toBe("complete-cast");
    expect(burst.hits).toHaveLength(18);
    for (const doc of [skill, burst]) {
      doc.characterLevel = 1;
      doc.gameContext!.ascension = 0;
      doc.build = { mode: "manual-final", ascension: 0, source: "已记录的固定来源实际快照", stats: { atk: 41.9434, hp: 793.2582, def: 50.358, em: 0, critRate: 0, critDamage: 0.5 } };
      const checked = calculateDocument(applyCharacterConstellationScope(doc));
      expect(checked.hits.every((hit) => hit.status === "calculated")).toBe(true);
      const expected = doc === skill ? reference.externalValidation.damageEvents.at(-1)!.damage : reference.externalValidation.damageEvents[0]!.damage;
      expect(checked.hits.map((hit) => hit.nonCritical)).toEqual(doc.hits.map(() => expected));
      expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals).toEqual(checked.totals);
    }
    // The same Q remains useful at a real high ascension: A1 is a per-hit source rule.
    burst.characterLevel = 90; burst.gameContext.ascension = 6;
    burst.build = { mode: "manual-final", ascension: 6, source: "显式命中面板；A4已含或关闭", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: 0.7, critDamage: 1 } };
    const active = calculateDocument(burst);
    const firstActive = active.hits[0]!;
    expect(firstActive.trace.find((node) => node.id === "characterCritRate")?.result?.value).toBe(0.1);
    expect(firstActive.expected).toBe(firstActive.nonCritical! * (1 + (0.7 + 0.1)));
    expect(burst.build.stats.critRate).toBe(0.7);
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(burst)));
    expect(calculateDocument(final).totals).toEqual(active.totals);
    expect(calculateDocument(final).hits[0]!.trace.find((node) => node.id === "characterCritRate")?.status).toBe("not-applicable");
    delete burst.build.ascension; delete burst.gameContext.ascension;
    expect(calculateDocument(burst).blockers.join()).toContain("缺少明确突破阶段");
    for (const hit of burst.hits) { if (hit.kind !== "ordinary") throw Error(); hit.effectiveCritRate = 0.25; }
    const overridden = calculateDocument(burst);
    expect(overridden.hits[0]!.expected).toBe(overridden.hits[0]!.nonCritical! * 1.25);
    expect(overridden.hits[0]!.trace.find((node) => node.id === "characterCritRate")?.status).toBe("not-applicable");
    burst.gameContext.constellation = 1;
    expect(calculateDocument(applyCharacterConstellationScope(burst)).status).toBe("blocked");
    const coverage = getClassifiedHitCoverage();
    console.info(`Amber coverage: ${JSON.stringify(coverage.perCharacter.find((entry) => entry.characterId === "character:10000021"))}; global identities=${coverage.charactersWithHits}, hits=${coverage.classifiedHits}`);
  });
});
