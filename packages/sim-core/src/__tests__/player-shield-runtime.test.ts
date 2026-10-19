import { expect, it } from "vitest";
import { simulationResultSchema, type PlayerShieldInputEvent, type PlayerShieldLogEntry } from "@genshin-dps-lab/schemas";
import { evaluateFormulaExpression } from "../calculation-trace";
import { PLAYER_SHIELD_PROFILE, playerShieldTrace } from "../player-shield-runtime";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

it("replays generic shield generation, parallel absorption, replacement, expiry, HP and pending tasks from complete JSON", () => {
  const source = { kind: "custom" as const, note: "Explicit synthetic template events; no character shield lifecycle is claimed." };
  type Grant = Extract<PlayerShieldInputEvent, { kind: "grant" }>;
  const grant = (id: string, frame: number, hp: Grant["hp"], overrides: Partial<Grant> = {}): Grant => ({
    id, frame, source, kind: "grant", ownerId: "a", typeKey: id, label: id, element: "pyro",
    target: { kind: "active" }, hp, durationFrames: 30, ...overrides,
  });
  const incoming = (id: string, frame: number, element: Extract<PlayerShieldInputEvent, { kind: "incoming-hit" }>["element"],
    incomingDamage: number, target: Grant["target"] = { kind: "active" }): PlayerShieldInputEvent => ({
    id, frame, source, kind: "incoming-hit", target, element, incomingDamage,
  });
  const config = makeConfig({
    duration: 1, cycleLength: .25,
    meta: { name: "通用玩家护盾合成资源场景", version: "player-shield-template-v1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    playerDamageModel: {
      mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: .5,
      shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
      characters: ["a", "b"].map(actorId => ({ actorId, initialHpRatio: 1,
        resistances: { physical: 0, pyro: 0, hydro: 0, cryo: 0, electro: 0, dendro: 0, anemo: 0, geo: 0 } })),
    },
    playerShieldModel: { mode: PLAYER_SHIELD_PROFILE.id, events: [
      grant("flame", 0, { flat: 100, stat: "hp", coefficient: .09 }),
      grant("reserve", 0, { flat: 400 }, { ownerId: "b", element: "hydro", target: { kind: "actor", actorId: "b" } }),
      grant("frost", 1, { flat: 600 }, { element: "cryo", durationFrames: 20 }),
      { id: "once", frame: 2, source, kind: "bonus", key: "once", value: .2, durationFrames: null, consumeOnRead: true },
      incoming("parallel", 3, "pyro", 3300),
      grant("old-guard", 4, { flat: 1000 }, { typeKey: "guard", durationFrames: 10 }),
      grant("new-guard", 5, { flat: 400 }, { ownerId: "b", typeKey: "guard", durationFrames: 20 }),
      { id: "short-bonus", frame: 6, source, kind: "bonus", key: "short", value: .5, durationFrames: 1, consumeOnRead: false },
      incoming("geo", 7, "geo", 900),
      grant("expires-first", 8, { flat: 200 }, { durationFrames: 2 }),
      grant("expires-second", 8, { flat: 300 }, { durationFrames: 2 }),
      incoming("after-expiry", 10, "physical", 1000),
      incoming("reserve-hit", 11, "hydro", 1000, { kind: "actor", actorId: "b" }),
      incoming("overkill", 12, "physical", 9000),
      grant("remaining", 15, { flat: 500 }, { durationFrames: 100 }),
      incoming("future-input", 100, "physical", 1),
    ] },
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "idle", actorId: "a", name: "合成无伤起手", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0 }],
      commands: [{ type: "skill", actorId: "a", abilityId: "idle", atFrame: 0 }],
    },
  });
  config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "后台合成角色" });
  const options = { execution: { checkpointFrames: [20] } };
  const result = simulate(config, options);
  const rows = result.playerShieldLog!;
  const row = (id: string): PlayerShieldLogEntry => rows.find(entry => entry.inputEventId === id)!;

  // 100 + 10000 × 0.09 = 1000 raw HP, sampled when this grant executes.
  expect(row("flame")).toMatchObject({ operation: "grant", capacity: 1000,
    ownerStats: { baseHp: 10000, hpPct: 0, flatHp: 0 },
    stateAfter: { shields: [{ instanceId: 0, hp: 1000, expiresAtFrame: 30 }] },
    callbacks: [{ kind: "OnShielded", instanceId: 0, reason: "grant" }] });

  // Each eligible shield receives all 3300: capacities 1000×2.5×1.2=3000
  // and 600×1×1.2=720. Their spills are 300 and 2580; HP receives min=300.
  expect(row("parallel")).toMatchObject({ strengthBonus: .2, absorbedDamage: 3000, damageAfterShield: 300,
    hpResolution: { currentHpBefore: 10000, actualLoss: 300, currentHpAfter: 9700 },
    shieldDetails: [
      { instanceId: 0, capacity: 3000, hpAfter: 0, damageAfterShield: 300, broken: true },
      { instanceId: 2, capacity: 720, hpAfter: 0, damageAfterShield: 2580, broken: true },
    ],
    callbacks: [
      { kind: "OnShieldBreak", instanceId: 0, reason: "damage" },
      { kind: "OnShieldBreak", instanceId: 2, reason: "damage" },
    ],
    stateAfter: { shields: [{ instanceId: 1, hp: 400 }], bonuses: [] },
  });
  // Same type+target replaces across owners without a break callback.
  expect(row("new-guard").callbacks).toEqual([
    { kind: "OnOverwrite", instanceId: 3, reason: "overwrite" },
    { kind: "OnShielded", instanceId: 4, reason: "grant" },
  ]);
  expect(row("new-guard").stateAfter.shields.map(shield => shield.instanceId)).toEqual([1, 4]);
  // Fixed OnDamage uses incoming Geo's 1.5 factor. The bonus expired at f7.
  expect(row("geo")).toMatchObject({ strengthBonus: 0, absorbedDamage: 600, damageAfterShield: 300,
    shieldDetails: [{ instanceId: 4, absorptionMultiplier: 1.5, capacity: 600, broken: true }],
    hpResolution: { currentHpBefore: 9700, actualLoss: 300, currentHpAfter: 9400 },
    stateAfter: { bonuses: [] } });

  // One expiry task removes both shields before this frame's incoming hit;
  // overwritten/broken shields' later stale expiry wakes emit no fake rows.
  const expiries = rows.filter(entry => entry.operation === "expire");
  expect(expiries).toHaveLength(1);
  expect(expiries[0]).toMatchObject({ frame: 10, eventPriority: -.5, callbacks: [
    { kind: "OnExpire", instanceId: 5, reason: "expire" },
    { kind: "OnExpire", instanceId: 6, reason: "expire" },
    { kind: "OnShieldBreak", instanceId: 5, reason: "expire" },
    { kind: "OnShieldBreak", instanceId: 6, reason: "expire" },
  ] });
  expect(row("after-expiry")).toMatchObject({ shieldDetails: [], damageAfterShield: 1000,
    hpResolution: { currentHpBefore: 9400, currentHpAfter: 8400 } });
  expect(row("reserve-hit")).toMatchObject({ targetActorId: "b", activeCharacterId: "a", absorbedDamage: 1000,
    shieldDetails: [{ instanceId: 1, absorptionMultiplier: 2.5, capacity: 1000, hpAfter: 0, broken: true }],
    hpResolution: { currentHpBefore: 10000, actualLoss: 0, currentHpAfter: 10000 } });
  expect(row("overkill").hpResolution).toMatchObject({ attemptedLoss: 9000, actualLoss: 8400, currentHpAfter: 0, overkill: 600 });
  expect(result.playerHpTimeline.points.filter(point => point.operation === "shield-hit")
    .map(point => [point.frame, point.actorId, point.hpBefore, point.hpAfter, point.playerShieldLogId])).toEqual([
      [3, "a", 10000, 9700, row("parallel").id], [7, "a", 9700, 9400, row("geo").id],
      [10, "a", 9400, 8400, row("after-expiry").id], [11, "b", 10000, 10000, row("reserve-hit").id],
      [12, "a", 8400, 0, row("overkill").id],
    ]);
  expect(result.playerHpSummaries).toMatchObject([
    { actorId: "a", initialHp: 10000, finalHp: 0, totalIncomingDamage: 14200, totalAbsorbedDamage: 3600, totalHpDamage: 10000, hitCount: 4, zeroHpReached: true },
    { actorId: "b", initialHp: 10000, finalHp: 10000, totalIncomingDamage: 1000, totalAbsorbedDamage: 1000, totalHpDamage: 0, hitCount: 1, zeroHpReached: false },
  ]);
  expect(result.totalPlayerDamageTaken).toBe(10000);
  expect(result.totalReactionSelfDamageTaken).toBe(0);
  expect(result.playerShieldState).toMatchObject({ nextInstanceId: 8, bonuses: [],
    shields: [{ instanceId: 7, definitionId: "remaining", hp: 500, expiresAtFrame: 115 }] });
  expect(rows.some(entry => entry.inputEventId === "future-input")).toBe(false);

  const audit = result.executionAudit!;
  expect(audit.checkpointCoverage.complete, audit.checkpointCoverage.reasons.join("; ")).toBe(true);
  const checkpoint = audit.phaseCheckpoints[0]!;
  expect(checkpoint.tick).toBe(20);
  expect(checkpoint.state.resourcesAndHp).toMatchObject({ playerShields: { mode: PLAYER_SHIELD_PROFILE.id,
    shields: [{ definitionId: "remaining", hp: 500, remainingTicks: 95 }], bonuses: [] } });
  const pending = checkpoint.state.pendingEvents as { inFlight: Array<{ type: string; remainingTicks: number; payload: unknown }> };
  expect(pending.inFlight.filter(event => event.type === "playerShieldExpiry").map(event => event.remainingTicks)).toEqual([1, 5, 10, 95]);
  expect(pending.inFlight.filter(event => event.type === "playerShieldInput")).toMatchObject([
    { remainingTicks: 80, payload: { input: { id: "future-input", kind: "incoming-hit", incomingDamage: 1 } } },
  ]);

  for (const entry of [row("flame"), row("parallel"), expiries[0]!, row("overkill")]) {
    const trace = playerShieldTrace(entry);
    expect(trace.length).toBeGreaterThan(0);
    for (const node of trace) expect(evaluateFormulaExpression(node.expression,
      Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
  }
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  expect(restored.playerShieldLog).toEqual(rows);
  expect(restored.playerShieldState).toEqual(result.playerShieldState);
  const replay = simulate(restored.config, options);
  expect(replay.playerShieldLog).toEqual(rows);
  expect(replay.playerShieldState).toEqual(result.playerShieldState);
  expect(replay.playerHpTimeline).toEqual(result.playerHpTimeline);
  expect(replay.executionAudit!.phaseCheckpoints).toEqual(audit.phaseCheckpoints);
  const forgedState = structuredClone(restored);
  forgedState.playerShieldState!.shields[0]!.hp += 1;
  expect(simulationResultSchema.safeParse(forgedState).success).toBe(false);
  const forgedDamage = structuredClone(restored);
  forgedDamage.playerShieldLog![row("parallel").id]!.damageAfterShield = 0;
  expect(simulationResultSchema.safeParse(forgedDamage).success).toBe(false);
});
