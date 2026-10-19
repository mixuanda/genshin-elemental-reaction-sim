import { CURRENT_ENGINE_VERSION, canonicalStringify, type LunarArtifactExecutionOptions,
  type LunarExecutionPartyMember } from "@genshin-dps-lab/schemas";
import { simulateLunarChargedProfile, simulateLunarCrystallizeProfile, simulateLunarBloomProfile,
  simulateLunarMixedProfile, simulateLunarMixedV2Profile, simulateStellarConductProfile,
  simulateStellarSwirlProfile, type SimulationRuntimeOptions } from "./simulator";
import type { LunarChargedSimulationResult } from "./lunar-charged-runtime";
import type { LunarCrystallizeSimulationResult } from "./lunar-crystallize-runtime";
import type { LunarBloomAbilityDeclaration, LunarBloomSimulationResult } from "./lunar-bloom-runtime";
import type { LunarMixedSimulationResult } from "./lunar-mixed-runtime";
import type { LunarMixedV2SimulationResult } from "./lunar-mixed-v2-runtime";
import type { StellarConductSimulationResult } from "./stellar-conduct-runtime";
import type { StellarSwirlSimulationResult } from "./stellar-swirl-runtime";

export type SpecialSimulationProfile = "lunar-charged" | "lunar-crystallize" | "lunar-bloom" |
  "lunar-mixed" | "lunar-mixed-v2" | "stellar-conduct" | "stellar-swirl";
export type SpecialSimulationResult = LunarChargedSimulationResult | LunarCrystallizeSimulationResult |
  LunarBloomSimulationResult | LunarMixedSimulationResult | LunarMixedV2SimulationResult |
  StellarConductSimulationResult | StellarSwirlSimulationResult;

/** The effective input passed to a public profile runner, after any UI-only
 * execution-baseline transformation. It contains no executable plugin code. */
export interface SpecialSimulationRequest {
  profile: SpecialSimulationProfile;
  config: unknown;
  options: SimulationRuntimeOptions;
  party: LunarExecutionPartyMember[];
  artifacts?: LunarArtifactExecutionOptions["artifacts"];
  moonsignLevel?: LunarArtifactExecutionOptions["moonsignLevel"];
  abilities?: LunarBloomAbilityDeclaration[];
}

export interface CapturedSpecialSimulation {
  schemaVersion: "special-complete-reexecution-v1";
  engineVersion: string;
  request: SpecialSimulationRequest;
  result: SpecialSimulationResult;
}

export interface SpecialSimulationReplay {
  captured: CapturedSpecialSimulation;
  reproduced: SpecialSimulationResult;
}

const resultVersion: Record<SpecialSimulationProfile, SpecialSimulationResult["schemaVersion"]> = {
  "lunar-charged": "lunar-charged-simulation-v1",
  "lunar-crystallize": "lunar-crystallize-simulation-v1",
  "lunar-bloom": "lunar-bloom-simulation-v1",
  "lunar-mixed": "lunar-mixed-simulation-v1",
  "lunar-mixed-v2": "lunar-mixed-simulation-v2",
  "stellar-conduct": "stellar-conduct-simulation-v1",
  "stellar-swirl": "stellar-swirl-simulation-v1",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A canonical JSON clone preserves semantic array order and ignores object-key order. */
function jsonCopy<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

/** Runs the exact public host entry, including its special weapon-delivery guard. */
export function runSpecialSimulation(request: SpecialSimulationRequest): SpecialSimulationResult {
  const lunarOptions = { ...request.options, party: request.party,
    ...(request.artifacts === undefined ? {} : { artifacts: request.artifacts }),
    ...(request.moonsignLevel === undefined ? {} : { moonsignLevel: request.moonsignLevel }) };
  switch (request.profile) {
    case "lunar-charged": return simulateLunarChargedProfile(request.config, lunarOptions);
    case "lunar-crystallize": return simulateLunarCrystallizeProfile(request.config, lunarOptions);
    case "lunar-bloom": return simulateLunarBloomProfile(request.config, { ...lunarOptions, abilities: request.abilities ?? [] });
    case "lunar-mixed": return simulateLunarMixedProfile(request.config, lunarOptions);
    case "lunar-mixed-v2": return simulateLunarMixedV2Profile(request.config, { ...lunarOptions, abilities: request.abilities ?? [] });
    case "stellar-conduct": return simulateStellarConductProfile(request.config, { ...request.options, party: request.party });
    case "stellar-swirl": return simulateStellarSwirlProfile(request.config, { ...request.options, party: request.party });
    default: throw new Error("Unsupported special simulation host profile.");
  }
}

/** Captures a completed run without executing it a second time. Import is the
 * operation that validates the entire composite through re-execution. */
export function captureSpecialSimulation(request: SpecialSimulationRequest, result: SpecialSimulationResult): CapturedSpecialSimulation {
  return { schemaVersion: "special-complete-reexecution-v1", engineVersion: CURRENT_ENGINE_VERSION,
    request: jsonCopy(request), result: jsonCopy(result) };
}

export function replaySpecialSimulation(raw: unknown): SpecialSimulationReplay {
  if (!isRecord(raw) || raw.schemaVersion !== "special-complete-reexecution-v1" ||
      !isRecord(raw.request) || !isRecord(raw.result)) {
    throw new Error("Unsupported complete special simulation capture format.");
  }
  if (raw.engineVersion !== CURRENT_ENGINE_VERSION || raw.result.baseResult === undefined ||
      !isRecord(raw.result.baseResult) || raw.result.baseResult.engineVersion !== CURRENT_ENGINE_VERSION) {
    throw new Error(`Complete special simulation capture requires engine ${CURRENT_ENGINE_VERSION}; rerun the saved input with this engine.`);
  }
  const profile = raw.request.profile;
  if (typeof profile !== "string" || !(profile in resultVersion) ||
      raw.result.schemaVersion !== resultVersion[profile as SpecialSimulationProfile]) {
    throw new Error("Complete special simulation host identity does not match its result.");
  }
  const captured = jsonCopy(raw) as unknown as CapturedSpecialSimulation;
  const reproduced = runSpecialSimulation(captured.request);
  if (canonicalStringify(captured.result) !== canonicalStringify(reproduced)) {
    throw new Error("Complete special simulation result differs from same-engine re-execution of the saved input.");
  }
  return { captured, reproduced };
}

export function serializeSpecialSimulation(capture: CapturedSpecialSimulation): string {
  if (capture.schemaVersion !== "special-complete-reexecution-v1") throw new Error("Unsupported complete special simulation capture format.");
  return JSON.stringify(jsonCopy(capture), null, 2);
}

export function parseSpecialSimulation(json: string): CapturedSpecialSimulation {
  return replaySpecialSimulation(JSON.parse(json) as unknown).captured;
}
