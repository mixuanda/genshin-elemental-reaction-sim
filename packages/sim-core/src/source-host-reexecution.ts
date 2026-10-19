import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_PROTOCOL,
  assertSourceHostStartupState, sourceHostArtifactSchema, sourceHostResultSchema,
  type SourceHostResult, type SourceHostRunRequest,
} from "./source-host-wire";
import { assertSourceHostTargetPhases, normalizeSourceHostTargetPhases } from "./source-host-target-phase";

export interface SourceHostReexecutionReceipt {
  schemaVersion: "source-host-complete-reexecution-v1";
  sourceCommit: SourceHostResult["sourceCommit"];
  wasmSha256: string;
  checkedFields: readonly ["calculations", "applications", "playerApplications", "energyApplications", "healingApplications", "result", "logs", "capabilities"];
  phaseObservationCompared?: true;
  counts: { calculations: number; applications: number; playerApplications: number; energyApplications: number; healingApplications: number; logEvents: number | null };
}

const checkedFields = ["calculations", "applications", "playerApplications", "energyApplications", "healingApplications", "result", "logs", "capabilities"] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Preserve the saved schema and formula identity before any numeric-import helper rewrites metadata. */
function savedResult(raw: unknown): SourceHostResult {
  const result = sourceHostResultSchema.parse(raw);
  assertSourceHostStartupState(result.initialEnergy, result.startupState);
  if (result.targetPhases) assertSourceHostTargetPhases({ policy: result.targetPhases.policy,
    phases: normalizeSourceHostTargetPhases(result.targetPhases) }, result.targetPhases, result.targetScene);
  if (!result.executionArtifact) throw new Error("旧来源记录未保存 WASM SHA-256 与字节数；仍可数值导入，但不能声称完整复跑核对。");
  return result;
}

/** Derive the complete host request from the saved run, never the current editor draft. */
export function sourceHostReexecutionRequest(raw: unknown): SourceHostRunRequest {
  const saved = savedResult(raw);
  return {
    protocol: SOURCE_HOST_PROTOCOL, config: saved.config, seed: saved.seed,
    hostVariant: saved.sourceCommit === SOURCE_HOST_COMMIT ? "classic" : "stellar",
    executionMode: saved.executionMode ?? "auto-wait",
    ...(saved.observationWindow?.policy === "duration-or-native" ? { stopAtDuration: true } : {}),
    ...(saved.targetScene ? { primaryTargetIndex: saved.targetScene.primaryTargetIndex } : {}),
    ...(saved.targetPhases ? { targetPhases: { policy: saved.targetPhases.policy,
      phases: normalizeSourceHostTargetPhases(saved.targetPhases) } } : {}),
    ...(saved.initialEnergy ? { initialEnergy: saved.initialEnergy } : {}),
    ...(saved.phaseObservation ? { phaseObservation: saved.phaseObservation } : {}),
  };
}

/** Check the bytes about to execute, not merely the current manifest's revision label. */
export function assertSourceHostReexecutionArtifact(expected: unknown, actualArtifact: unknown): void {
  const saved = savedResult(expected);
  const actual = sourceHostArtifactSchema.parse(actualArtifact);
  const artifact = saved.executionArtifact!;
  if (actual.wasmSha256 !== artifact.wasmSha256 || actual.wasmBytes !== artifact.wasmBytes) {
    throw new Error(`来源执行器不匹配：保存的 ${artifact.wasmSha256} (${artifact.wasmBytes} bytes)，当前 ${actual.wasmSha256} (${actual.wasmBytes} bytes)；不能把新产物冒认旧产物。`);
  }
}

/** Semantic JSON comparison ignores object-key order, but never reorders event arrays. */
function firstDifference(expected: unknown, actual: unknown, path: string): string | null {
  if (Object.is(expected, actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return `${path}.length`;
    for (let index = 0; index < expected.length; index++) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (record(expected) && record(actual)) {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    for (const key of [...new Set([...expectedKeys, ...actualKeys])].sort()) {
      if (!(key in expected) || !(key in actual)) return `${path}.${key}`;
      const difference = firstDifference(expected[key], actual[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return null;
  }
  return path;
}

/** Verify that the same pinned executor reproduced the entire source-host response. */
export function verifySourceHostReexecution(expected: unknown, actual: unknown): SourceHostReexecutionReceipt {
  const saved = savedResult(expected);
  const reproduced = sourceHostResultSchema.parse(actual);
  assertSourceHostStartupState(reproduced.initialEnergy, reproduced.startupState);
  assertSourceHostReexecutionArtifact(saved, reproduced.executionArtifact);
  for (const field of ["protocol", "sourceCommit", "config", "seed"] as const) {
    if (saved[field] !== reproduced[field]) throw new Error(`完整来源复跑在 ${field} 首次出现差异。`);
  }
  if ((saved.executionMode ?? "auto-wait") !== (reproduced.executionMode ?? "auto-wait")) {
    throw new Error("完整来源复跑在 executionMode 首次出现差异。");
  }
  for (const field of ["initialEnergy", "startupState", "observationWindow", "targetScene", "targetPhases", "phaseObservation", "phaseObservations", "randomness", "attackObservations", "abilityInvocations", "abilityProducers", "ownedGenerators", "ownedGeneratorTriggers", "ownedEntities", "ownedEntityTriggers", "ownedEntityProducers", "hitCallbackBatches", "hitCallbacks", "eventRegistrations", "eventEmissions", "eventListenerCalls", "eventProducers", "attackDispatchCompletions", "lifecycleObservationFrame", "statusInstances", "pendingAttackStages"] as const) {
    const difference = firstDifference(saved[field], reproduced[field], field);
    if (difference) throw new Error(`完整来源复跑在 ${difference} 首次出现差异。`);
  }
  // Only elapsedMs (the worker's wall-clock measurement) is outside this result.
  // result.duration is a simulated frame count and stays inside the exact check.
  for (const field of checkedFields) {
    const difference = firstDifference(saved[field], reproduced[field], field);
    if (difference) throw new Error(`完整来源复跑在 ${difference} 首次出现差异。`);
  }
  return {
    schemaVersion: "source-host-complete-reexecution-v1",
    sourceCommit: saved.sourceCommit,
    wasmSha256: saved.executionArtifact!.wasmSha256,
    checkedFields,
    ...(saved.phaseObservation ? { phaseObservationCompared: true as const } : {}),
    counts: { calculations: saved.calculations.length, applications: saved.applications.length,
      playerApplications: saved.playerApplications?.length ?? 0,
      energyApplications: saved.energyApplications?.length ?? 0,
      healingApplications: saved.healingApplications?.length ?? 0,
      logEvents: Array.isArray(saved.logs) ? saved.logs.length : null },
  };
}
