import {parseEventStepResult,type EventStepResult} from '../../../packages/sim-core/src/event-step-result';
import {simulationResultSchema} from '@genshin-dps-lab/schemas';
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
  /** Derived audit; never used as an execution input on import. */
  rotationSummary?: RotationExecutionSummary;
}

export type RestoredSimulationInputs = Pick<SimulationRecord, "sourceConfig" | "options" | "iterations" | "executionProfile" | "benchmark">;

/** Extract explicit saved inputs; opening a file does not run a simulation. */
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

export interface SimulationRecordV2 extends Omit<SimulationRecord,'format'|'result'> {
 format:'gidps-simulation-record-v2';
 result:SimulationResult|EventStepResult;
 validation:'event-steps-v1'|'historical-reference-only';
}
export function exportSimulationRecord(record:SimulationRecord,eventStepResult:EventStepResult|null):SimulationRecordV2 {
 return {...record,format:'gidps-simulation-record-v2',result:eventStepResult??record.result,validation:eventStepResult?'event-steps-v1':'historical-reference-only'};
}
export function readSimulationRecordV2(raw:unknown):{inputs:RestoredSimulationInputs;result:SimulationResult;eventStepResult:EventStepResult|null} {
 if(!raw||typeof raw!=='object'||!('format' in raw)||raw.format!=='gidps-simulation-record-v2')throw Error('不是新格式模拟记录');
 const record=raw as unknown as SimulationRecordV2;
 const allowed=['format','sourceConfig','options','iterations','executionProfile','executionBaseline','benchmark','result','batchSummary','rotationSummary','validation'];
 if(Object.keys(record).some(k=>!allowed.includes(k)))throw Error('新记录包含未知字段');
 const inputs=restoreSimulationInputs({...record,format:'simulation-record-v1'});
 if(record.validation==='event-steps-v1'){
  const parsed=parseEventStepResult(record.result);return {inputs,result:parsed.result,eventStepResult:parsed.wire};
 }
 if(record.validation!=='historical-reference-only')throw Error('未知验证协议');
 return {inputs,result:simulationResultSchema.parse(record.result) as unknown as SimulationResult,eventStepResult:null};
}
