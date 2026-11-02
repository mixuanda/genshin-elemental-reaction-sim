/** Test-only authentic history and closed current Burning oracles. No runtime codec. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { expect } from "vitest";
import { z } from "zod";

export type BurningFoundationCase = "golden" | "performance";
const PIN = "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5";
const ARCHIVE_SHA = "fddbb4ca819e62a6becfa7d91c4f2dc97dd32a4b1196a36b8e1945296d1fca7a";
const TIMING_SHA = "a4b711ca2cd1335908711ff89ac77926c16851c368155860278d1d8f1ffb64c5";
const RAW_IDENTITY = {
  golden: [350415, "207a4e5164bd8d39bcab07eb9df0b13dac20a43506c4bf026d1e3bec3f8f2cbd"],
  performance: [12704812, "5b4f1d1f6f75c143419a398414233547405cd2a0c0820cf8b0787f7de6c903c0"],
} as const;
const MAX_RAW_BYTES = 16 * 1024 * 1024;
const bytesSha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const archiveUrl = new URL("../../../test-vectors/src/fixtures/historical-burning-foundation-v153-84ff5cd.json", import.meta.url);
const timingUrl = new URL("../../../test-vectors/src/fixtures/historical-burning-foundation-timing-84ff5cd.json", import.meta.url);
const payloadSchema = z.object({
  kind: z.enum(["golden", "performance"]), encoding: z.literal("gzip-base64"),
  rawBytes: z.number().int().positive().max(MAX_RAW_BYTES), rawSha256: z.string().regex(/^[0-9a-f]{64}$/),
  gzipBase64: z.string().max(1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();
const observationSchema = z.object({
  kind: z.enum(["golden", "performance"]), input: z.unknown(), options: z.unknown(), result: z.unknown(),
}).strict();

export function readHistoricalBurning(kind: BurningFoundationCase): {
  kind: BurningFoundationCase; input: unknown; options: unknown; result: SimulationResult;
} {
  const bytes = readFileSync(archiveUrl);
  expect(bytesSha(bytes)).toBe(ARCHIVE_SHA);
  const archive = JSON.parse(bytes.toString("utf8")) as {
    fixtureVersion: string; source: { commit: string; tree: string };
    timingEvidence: { file: string; sha256: string; originalExitCode: number; performanceStatus: string };
    payloads: unknown[];
  };
  expect(archive).toMatchObject({ fixtureVersion: "historical-burning-foundation-v153-84ff5cd-v1",
    source: { commit: PIN, tree: "72bd69a8c54a3e115685c7ee52f5862064c70f55" },
    timingEvidence: { file: "historical-burning-foundation-timing-84ff5cd.json", sha256: TIMING_SHA,
      originalExitCode: 1, performanceStatus: "failed" } });
  const payloads = z.array(payloadSchema).length(2).parse(archive.payloads);
  expect(payloads.map((payload) => payload.kind)).toEqual(["golden", "performance"]);
  const payload = payloads.find((candidate) => candidate.kind === kind)!;
  expect([payload.rawBytes, payload.rawSha256]).toEqual(RAW_IDENTITY[kind]);
  // A pinned local synthetic fixture, not an alternative public import format.
  // Limit decompression before JSON parsing, then verify exact original bytes.
  const raw = gunzipSync(Buffer.from(payload.gzipBase64, "base64"), { maxOutputLength: MAX_RAW_BYTES });
  expect(raw.byteLength).toBe(payload.rawBytes);
  expect(bytesSha(raw)).toBe(payload.rawSha256);
  const observation = observationSchema.parse(JSON.parse(raw.toString("utf8")));
  expect(observation.kind).toBe(kind);
  const result = observation.result as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return { ...observation, result };
}

export function expectHistoricalBurningProvenance(): void {
  const bytes = readFileSync(timingUrl);
  expect(bytesSha(bytes)).toBe(TIMING_SHA);
  const timing = JSON.parse(bytes.toString("utf8")) as {
    durations: number[]; summary: { average: number; median: number; p95: number; maximum: number };
  };
  expect(timing).toMatchObject({ fixtureVersion: "historical-burning-foundation-timing-v1", sourceCommit: PIN,
    originalExitCode: 1, goldenStatus: "passed", performanceStatus: "failed",
    allOriginalSemanticPrerequisitesPassed: true, unchangedTimedWorkload: true,
    runs: 21, medianLimitMs: 100, maximumLimitMs: 250 });
  expect(timing.durations).toHaveLength(21);
  const sorted = [...timing.durations].sort((left, right) => left - right);
  expect(timing.summary.median).toBe(sorted[10]);
  expect(timing.summary.maximum).toBe(sorted[20]);
  expect(timing.summary.p95).toBe(sorted[19]);
  expect(timing.summary.average).toBe(timing.durations.reduce((sum, duration) => sum + duration, 0) / 21);
  // This is historical failure evidence, NOT a threshold change or green claim.
  expect(timing.summary.median).toBeGreaterThanOrEqual(100);
  expect(bytesSha(readFileSync(new URL("../../../test-vectors/fixtures/burning-aura-v4-1.30.golden.json", import.meta.url))))
    .toBe("adbb9a815163baa6667295298a6bad547be2a05a26f5139777ba73a21269867d");
}

// Read-only queue allocation proof: all 1197 old allocations have identical
// complete payloads/order in current. Current additionally retains fuelExpiry
// F7201/S1180 and F7261/S1189; future tick F7215/S1199 is after all output.
// Only this finite old-position map is allowed. Nothing rewrites current wires.
const LATE_QUEUE_PAIRS = [
  [1180, 1181], [1181, 1182], [1182, 1183], [1183, 1184], [1184, 1185],
  [1185, 1186], [1186, 1187], [1187, 1188], [1188, 1190], [1189, 1191],
  [1190, 1192], [1191, 1193], [1192, 1194], [1193, 1195], [1194, 1196],
  [1195, 1197], [1196, 1198],
] as const;
function expectedCurrentQueue(old: number): number {
  if (Number.isSafeInteger(old) && old >= 0 && old <= 1179) return old;
  const pair = LATE_QUEUE_PAIRS.find(([from]) => from === old);
  if (!pair) throw new Error(`Unknown historical sustained-Burning queue position ${old}`);
  return pair[1];
}
function mapExpectedRows(rows: unknown[], expectedChanges: number): void {
  let changes = 0;
  for (const value of rows) {
    if (value === null || typeof value !== "object") throw new Error("Expected a historical log row");
    const row = value as { eventSequence?: number | null };
    if (row.eventSequence === undefined || row.eventSequence === null) continue;
    const mapped = expectedCurrentQueue(row.eventSequence);
    if (mapped !== row.eventSequence) changes += 1;
    row.eventSequence = mapped;
  }
  expect(changes).toBe(expectedChanges);
}
function mechanics(result: SimulationResult): Omit<SimulationResult, "runManifest" | "resolvedRuntimeOptions" | "reproducibilityKey"> {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...fields } = result;
  return fields;
}

/** Returns authentic history only for the old hash sentinels, never for timing. */
export function expectCurrentBurningContract(
  result: SimulationResult, kind: BurningFoundationCase, input: unknown, options: unknown,
): SimulationResult {
  const before = JSON.stringify(result);
  const captured = readHistoricalBurning(kind);
  expect(captured.input).toEqual(input);
  expect(captured.options).toEqual(options);
  const historical = captured.result;
  expect(result.resolvedRuntimeOptions).toEqual({ ...historical.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });
  expect(result.runManifest.resolvedRuntimeOptions).toEqual(result.resolvedRuntimeOptions);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  expect(result.reproducibilityKey).not.toBe(historical.reproducibilityKey);
  const { resolvedRuntimeOptions: _oldOptions, reproducibilityKey: _oldKey, ...oldManifest } = historical.runManifest;
  const { resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...manifest } = result.runManifest;
  expect(manifest).toEqual(oldManifest);
  expect(simulationResultSchema.parse(JSON.parse(before))).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);

  const expected = structuredClone(mechanics(historical));
  if (kind === "performance") {
    expect(new Set(LATE_QUEUE_PAIRS.map((pair) => pair[1])).size).toBe(17);
    expect(LATE_QUEUE_PAIRS.every((pair, id) => id === 0 || pair[1] > LATE_QUEUE_PAIRS[id - 1]![1])).toBe(true);
    for (const rows of [expected.auraTimeline, expected.burningStateLog, expected.damageEvents,
      expected.elementalApplicationIcdLog, expected.hitEvents, expected.hitResolutionLog]) mapExpectedRows(rows, 9);
    mapExpectedRows(expected.targetStateTimeline.points, 17);
  }
  const directCount = kind === "golden" ? 1 : 120;
  const expectedPointCount = kind === "golden" ? 36 : 1198;
  expect(expected.targetStateTimeline.points.map((point) => point.id)).toEqual(Array.from({ length: expectedPointCount }, (_, id) => id));
  for (let n = 0; n < directCount; n += 1) {
    // Before F135 there is one extra damage point; the fixed tick-9 skip removes
    // it. From F180 onward each one-second-boundary refresh precedes four ticks and
    // one obsolete fuel-expiry observation, hence the closed point-ID formula.
    const damageId = n === 0 ? 0 : 5 * n - (n < 3 ? 1 : 2);
    const pointId = n === 0 ? 1 : n === 1 ? 8 : n === 2 ? 17 : 10 * n - 5;
    const frame = n * 60;
    const hitId = kind === "golden" ? "pyro-hit" : n === 0 ? "pyro-start" : `dendro-refresh-${n}`;
    const resolution = expected.hitResolutionLog[damageId]!;
    expect(resolution).toMatchObject({ id: damageId, frame, hitId, resolutionKind: "direct", damageEventId: damageId });
    expect(resolution).not.toHaveProperty("eventPriority");
    expect(resolution).not.toHaveProperty("eventSequence");
    expect(resolution).not.toHaveProperty("intraEventSequence");
    resolution.eventPriority = 3; resolution.eventSequence = n + 1; resolution.intraEventSequence = 0;
    const point = expected.targetStateTimeline.points[pointId]!;
    expect(point).toMatchObject({ id: pointId, frame, cause: "direct-hit-application", eventPriority: 3,
      eventSequence: n + 1, intraEventSequence: 0, primaryDamageEventId: damageId,
      links: [{ kind: "damage-event", id: damageId }] });
    point.intraEventSequence = 1;
  }
  expect(mechanics(result)).toStrictEqual(expected);
  expectIndependentBurningMechanics(result, kind);
  expect(JSON.stringify(result)).toBe(before);
  return historical;
}

function expectIndependentBurningMechanics(result: SimulationResult, kind: BurningFoundationCase): void {
  const horizon = kind === "golden" ? 246 : 7200;
  const lastTick = kind === "golden" ? 16 : 480;
  const tickFrames = Array.from({ length: lastTick }, (_, id) => (id + 1) * 15).filter((frame) => frame !== 135);
  const ticks = result.damageEvents.filter((event) => event.kind === "transformative-reaction" && event.reaction === "burning");
  // Independent classic level90 base pinned in reaction-formulas/src/profile.ts,
  // Burning coefficient .25, EM100,
  // reaction bonus .2 and resistance .1. No crit or defense multiplier applies.
  const perTick = 1446.8535 * 0.25 * (1 + (16 * 100) / (100 + 2000) + 0.2) * 0.9;
  expect(perTick).toBeCloseTo(638.6824735714285, 10);
  expect(ticks.map((event) => event.frame)).toEqual(tickFrames);
  expect(result.damageEvents.filter((event) => event.kind === "direct").every((event) => event.finalDamage === 0)).toBe(true);
  for (const event of ticks) {
    expect(event.finalDamage).toBeCloseTo(perTick, 10);
    expect(event).toMatchObject({ sourceActorId: "pyro", scalingOwnerId: "pyro", creditOwnerId: "pyro", element: "pyro",
      damageComposition: { direct: 0, additiveReaction: 0, transformativeReaction: event.finalDamage } });
    const resolution = result.hitResolutionLog[event.targetResolutionId!];
    expect(resolution).toMatchObject({ id: event.targetResolutionId, damageEventId: event.id, frame: event.frame,
      outcome: "landed", landed: true, finalDamage: event.finalDamage });
  }
  expect(result.totalDamage).toBeCloseTo(tickFrames.length * perTick, 8);
  expect(result.dps).toBeCloseTo(tickFrames.length * perTick / (horizon / 60), 8);
  expect(result.burningStateLog.filter((row) => row.operation === "tick-skipped").map((row) => [row.frame, row.tickIndex])).toEqual([[135, 9]]);
  const applications = result.elementalApplicationIcdLog.filter((row) => row.sourceKind === "burning-tick");
  const allowedFrames = kind === "golden" ? [15, 150] : [15, ...Array.from({ length: 59 }, (_, id) => 150 + id * 120)];
  expect(applications.map((row) => row.frame)).toEqual(tickFrames);
  expect(applications.filter((row) => row.decision.allowed).map((row) => row.frame)).toEqual(allowedFrames);
  expect(applications.filter((row) => !row.decision.allowed)).toHaveLength(tickFrames.length - allowedFrames.length);
  for (const application of applications) {
    expect(application.damageEventId).not.toBeNull();
    expect(result.damageEvents[application.damageEventId!]).toMatchObject({ frame: application.frame,
      reaction: "burning", sourceActorId: "pyro", targetId: application.targetId });
    expect(result.hitResolutionLog[application.hitResolutionLogId]).toMatchObject({ damageEventId: application.damageEventId });
  }
  const clean = (value: number) => Number(value.toFixed(12));
  expect(result.burningStateLog[0]).toMatchObject({ frame: 0, operation: "start", fuelGaugeUnitsAfter: 2 * 0.8,
    fuelExpiresAtFrame: 241, damageSourceActorId: "pyro", fuelSourceActorId: "pyro" });
  const refreshes = result.burningStateLog.filter((row) => row.operation === "refresh-fuel");
  expect(refreshes.map((row) => row.frame)).toEqual(kind === "golden" ? [] : Array.from({ length: 119 }, (_, id) => (id + 1) * 60));
  for (const row of refreshes) expect(row).toMatchObject({ fuelGaugeUnitsAfter: 0.8, fuelExpiresAtFrame: row.frame + 121,
    damageSourceActorId: "pyro", fuelSourceActorId: "pyro" });
  for (const row of result.burningStateLog.filter((entry) => entry.operation === "tick" || entry.operation === "tick-skipped")) {
    const lastRefresh = kind === "golden" ? 0 : Math.min(7140, Math.floor(row.frame / 60) * 60);
    const startGauge = lastRefresh === 0 ? 1.6 : 0.8;
    // Fuel's initial decay grace leaves frame F+1 untouched; direct F+60
    // refresh runs at P3 before the same-frame P4 Burning tick.
    const gauge = startGauge - Math.max(0, row.frame - lastRefresh - 1) / 150;
    expect(row.fuelGaugeUnitsAfter).toBe(clean(gauge));
    expect(row.fuelExpiresAtFrame).toBe(lastRefresh === 0 ? 241 : lastRefresh + 121);
  }
  const expiry = result.burningStateLog.filter((row) => row.operation === "fuel-expire");
  if (kind === "golden") expect(expiry).toMatchObject([{ frame: 241, fuelGaugeUnitsAfter: 0, reason: "FUEL_EXPIRED" }]);
  else expect(expiry).toEqual([]);
  const end = result.auraEndStates[0]!;
  expect(result.auraEndStates).toHaveLength(1);
  expect(end).toMatchObject({ targetId: "enemy-0", frame: horizon });
  const lastAllowed = allowedFrames.at(-1)!;
  expect(end.aura.find((aura) => aura.element === "pyro")).toEqual({ element: "pyro",
    gaugeUnits: clean(0.8 - (horizon - lastAllowed) * 0.8 / 570), expiresAtFrame: lastAllowed + 570,
    sourceSlots: [{ sourceActorId: "pyro", gaugeUnits: clean(0.8 - (horizon - lastAllowed) * 0.8 / 570) }] });
  if (kind === "performance") {
    expect(end.aura.find((aura) => aura.element === "burningFuel")).toMatchObject({ gaugeUnits: clean(0.8 - 59 / 150), expiresAtFrame: 7261 });
    expect(end.aura.find((aura) => aura.element === "dendro")).toMatchObject({ gaugeUnits: 0.4, expiresAtFrame: 7260 });
  }
  expect(result.quickenStateLog).toEqual([]);
  expect(result.targetTaskPhaseLog).toEqual([]);
  expect(result.targetPhaseLog).toEqual([]);
}
