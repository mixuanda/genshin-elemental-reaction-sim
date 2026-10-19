import { migrateConfig, currentResolvedSimulationRuntimeOptionsSchema, type ResolvedSimulationRuntimeOptions, type SimConfig, type SimulationResult } from "@genshin-dps-lab/schemas";
import { parseExecutionProfile, type ExecutionProfile, type ExecutionDelayEntry } from "../../../packages/sim-core/src/execution-profiles";
import type { SimulationBatchSummary } from "./worker-client";
import type { RotationExecutionSummary } from "../../../packages/sim-core/src/simulation-analysis";

/** Source inputs stay separate from the executed, delayed timeline in result. */
export interface SimulationRecord {
  format: "simulation-record-v1";
  sourceConfig: SimConfig;
  options: ResolvedSimulationRuntimeOptions;
  iterations: number;
  executionProfile: ExecutionProfile | null;
  /** A single reference seed generates the fixed request table for the whole batch. */
  executionBaseline?: {
    policy: "fixed-reference-v1";
    options: ResolvedSimulationRuntimeOptions;
    changes: ExecutionDelayEntry[];
    baselineExecutableTicks: number;
  };
  benchmark: { id: string; version: string; assumptions: string[] } | null;
  result: SimulationResult;
  batchSummary: SimulationBatchSummary;
  /** Derived audit; imports recompute this from the saved inputs. */
  rotationSummary?: RotationExecutionSummary;
}

export type RestoredSimulationInputs = Pick<SimulationRecord, "sourceConfig" | "options" | "iterations" | "executionProfile" | "benchmark">;

/** Imports rerun the saved inputs; they never treat file-supplied totals as verified. */
export function restoreSimulationInputs(raw: unknown): RestoredSimulationInputs {
  if (!raw || typeof raw !== "object" || !("format" in raw) || raw.format !== "simulation-record-v1") throw new Error("不是支持的模拟记录格式。");
  const record = raw as Record<string, unknown>;
  const sourceConfig = migrateConfig(record.sourceConfig);
  const options = currentResolvedSimulationRuntimeOptionsSchema.parse(record.options) as ResolvedSimulationRuntimeOptions;
  if (!Number.isInteger(record.iterations) || (record.iterations as number) < 1 || (record.iterations as number) > 10000) throw new Error("记录中的迭代次数必须为1–10000。");
  let executionProfile: ExecutionProfile | null = null;
  if (record.executionProfile !== null) {
    executionProfile = parseExecutionProfile(record.executionProfile);
    // The worker rebuilds the baseline from saved inputs and options before running.
    // The file's baseline table is an audit only, never an execution input.
  }
  let benchmark: RestoredSimulationInputs["benchmark"] = null;
  if (record.benchmark !== null && record.benchmark !== undefined) {
    const source = record.benchmark as Record<string, unknown>;
    if (typeof source.id !== "string" || typeof source.version !== "string" || !Array.isArray(source.assumptions) || !source.assumptions.every((item) => typeof item === "string")) throw new Error("记录中的基准说明格式无效。");
    benchmark = { id: source.id, version: source.version, assumptions: source.assumptions };
  }
  return { sourceConfig, options, iterations: record.iterations as number, executionProfile, benchmark };
}
