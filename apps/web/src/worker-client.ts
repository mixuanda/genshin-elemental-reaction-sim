import type { SimConfig, SimulationOptions, SimulationResult, TimelineExecution } from "@genshin-dps-lab/schemas";
import type { AppliedExecutionProfile, ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import type { WEAPON_PROC_RANDOM_PROFILE } from "../../../packages/sim-core/src/weapon-proc";

export interface SimulationProgress {
  completed: number;
  total: number;
}

export interface WorkerRunControls {
  signal?: AbortSignal;
  onProgress?: (progress: SimulationProgress) => void;
  /** Applied once inside the worker using the unmodified reference seed. */
  executionProfile?: ExecutionProfile;
}

export interface SimulationBatchSummary {
  iterations: number;
  seed: string;
  rngPolicy: "seeded-particles-mulberry32-v1" | "seeded-particles-and-crit-mulberry32-v1"
    | "seeded-particles-and-normal-energy-mulberry32-v1" | "seeded-particles-crit-and-normal-energy-mulberry32-v1"
    | "seeded-particles-and-declared-independent-streams-v1";
  normalHitEnergyPolicy?: {
    sourceProfileId: string;
    rngStream: string;
    rngAlgorithm: string;
    matchesGcsimRandomSequence: false;
  };
  favoniusPolicy?: {
    sourceProfileId: string;
    rngStream: string;
    rngAlgorithm: string;
    matchesGcsimRandomSequence: false;
    cooldownClock: "global-frame-assumes-no-character-hitlag";
  };
  sacrificialPolicy?: {
    sourceProfileId: string;
    rngStream: string;
    rngAlgorithm: string;
    matchesGcsimRandomSequence: false;
    cooldownClock: "global-frame-assumes-no-character-hitlag";
  };
  weaponProcPolicy?: typeof WEAPON_PROC_RANDOM_PROFILE;
  criticalPolicy: SimulationOptions["critMode"] | "seeded-random-v1";
  meanDamage: number;
  sampleStandardDeviation: number;
  spreadPercentiles: { p05: number; p50: number; p95: number };
  meanConfidenceInterval: { method: "normal-approximation-95"; low: number; high: number } | null;
  elapsedMilliseconds: number;
  warnings: string[];
}

export type WorkerRequest = {
  type: "run";
  config: SimConfig;
  options: SimulationOptions;
  iterations: number;
  executionProfile?: ExecutionProfile;
} | {
  type: "prepare";
  config: SimConfig;
  options: SimulationOptions;
  executionProfile: ExecutionProfile | null;
  resolveTimeline: boolean;
};

export interface PreparedSimulation {
  config: SimConfig;
  appliedProfile: AppliedExecutionProfile | null;
  timelineExecution?: TimelineExecution;
}

export type WorkerResponse =
  | { type: "progress"; completed: number; total: number }
  | { type: "result"; result: SimulationResult; summary: SimulationBatchSummary; appliedProfile?: AppliedExecutionProfile }
  | ({ type: "prepared" } & PreparedSimulation)
  | { type: "error"; message: string };

/** Terminating the dedicated worker interrupts even a currently synchronous run. */
function requestSimulationWorker(
  request: WorkerRequest,
  controls: WorkerRunControls
): Promise<Extract<WorkerResponse, {type: "result" | "prepared"}>> {
  if (controls.signal?.aborted) {
    return Promise.reject(new DOMException("模拟已取消。", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./simulation-worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const cleanup = (): void => {
      settled = true;
      worker.terminate();
      controls.signal?.removeEventListener("abort", abort);
    };
    const abort = (): void => {
      if (settled) return;
      cleanup();
      reject(new DOMException("模拟已取消。", "AbortError"));
    };
    controls.signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerResponse>): void => {
      if (settled) return;
      const response = event.data;
      if (response.type === "progress") {
        controls.onProgress?.({ completed: response.completed, total: response.total });
      } else if (response.type === "error") {
        cleanup();
        reject(new Error(response.message));
      } else {
        cleanup();
        resolve(response);
      }
    };
    worker.onerror = (event): void => {
      if (settled) return;
      cleanup();
      reject(new Error(event.message || "模拟 Worker 执行失败。"));
    };
    try {
      worker.postMessage(request);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function runSimulationBatchInWorker(
  config: SimConfig,
  options: SimulationOptions = {},
  iterations = 1,
  controls: WorkerRunControls = {}
): Promise<{result: SimulationResult; summary: SimulationBatchSummary; appliedProfile?: AppliedExecutionProfile}> {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000) throw new RangeError("迭代次数必须是 1 至 10000 的整数。");
  const response = await requestSimulationWorker({type: "run", config, options, iterations,
    ...(controls.executionProfile === undefined ? {} : {executionProfile: controls.executionProfile})}, controls);
  if (response.type !== "result") throw new Error("模拟 Worker 返回了非运行结果。");
  return {result: response.result, summary: response.summary, ...(response.appliedProfile === undefined ? {} : {appliedProfile: response.appliedProfile})};
}

/** Previews use the same cancellable worker; no runtime baseline runs on the UI thread. */
export async function prepareSimulationInWorker(
  config: SimConfig,
  options: SimulationOptions,
  profile: ExecutionProfile | null,
  resolveTimeline: boolean,
  controls: Omit<WorkerRunControls, "executionProfile"> = {}
): Promise<PreparedSimulation> {
  const response = await requestSimulationWorker({type: "prepare", config, options, executionProfile: profile, resolveTimeline}, controls);
  if (response.type !== "prepared") throw new Error("模拟 Worker 返回了非预览结果。");
  return {config: response.config, appliedProfile: response.appliedProfile,
    ...(response.timelineExecution === undefined ? {} : {timelineExecution: response.timelineExecution})};
}

export async function runSimulationInWorker(
  config: SimConfig,
  options: SimulationOptions = {},
  controls: WorkerRunControls = {}
): Promise<SimulationResult> {
  return (await runSimulationBatchInWorker(config, options, 1, controls)).result;
}
