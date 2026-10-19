import appPackage from "../package.json";
import type { SourceHostResult, SourceHostRunRequest } from "../../../packages/sim-core/src/source-host-wire";
import type { SourceHostReexecutionReceipt } from "../../../packages/sim-core/src/source-host-reexecution";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../../../packages/sim-core/src/source-host-wire";
import type { SourceHostWorkerRequest, SourceHostBatchRun } from "./source-host-batch";
import type { SourceHostStartupRun } from "./source-host-startup-analysis";

export type SourceHostWorkerStage = "request" | "load-manifest" | "load-wasm" | "instantiate-wasm" | "execute" | "batch" | "reexecution" | "response" | "worker";
export type SourceHostFailureKind = "runtime-error" | "worker-error" | "message-error" | "timeout" | "post-message-error";

export interface SourceHostDiagnosticReceipt {
  schemaVersion: "source-host-worker-diagnostic-v1";
  runId: string;
  createdAt: string;
  application: { name: "GIDPS"; version: string; mode: string };
  source: { hostVariant: "classic" | "stellar"; expectedCommit: string; actualCommit?: string; wasmSha256?: string; wasmBytes?: number };
  failure: { kind: SourceHostFailureKind; stage: SourceHostWorkerStage; code: string; name?: string; message: string; stack?: string };
  worker: { timeoutMs: number; elapsedMs: number; lastProgress?: string };
  input: {
    requestKind: "single" | "batch" | "startup" | "reexecution";
    seed?: string;
    configSha256?: string;
    configBytes?: number;
    configLines?: number;
    durationSeconds?: number;
    executionMode?: string;
    stopAtDuration?: boolean;
    primaryTargetIndex?: number;
    targetPhaseCount?: number;
    jobSeeds?: Array<{ seed: string; addedRecharge?: number; configSha256?: string }>;
  };
  privacy: { rawConfigIncluded: false; failureLogsIncluded: false; credentialsIncluded: false };
}

export type SourceHostWorkerMessage =
  | { type: "progress"; message: string; stage?: SourceHostWorkerStage }
  | { type: "result"; result: SourceHostResult; elapsedMs: number }
  | { type: "reexecution-result"; receipt: SourceHostReexecutionReceipt; elapsedMs: number }
  | { type: "batch-result"; runs: SourceHostBatchRun[]; elapsedMs: number }
  | { type: "startup-result"; startupRuns: SourceHostStartupRun[]; elapsedMs: number }
  | { type: "error"; message: string; failureLogs?: unknown; diagnostic?: SourceHostDiagnosticReceipt };

export interface SourceHostWorkerRunHandle {
  readonly worker: Worker;
  cancel(): void;
}

export interface SourceHostWorkerRunHandlers {
  onProgress(message: Extract<SourceHostWorkerMessage, { type: "progress" }>): void;
  onMessage(message: Exclude<SourceHostWorkerMessage, { type: "progress" | "error" }>): void;
  onFailure(diagnostic: SourceHostDiagnosticReceipt, failureLogs?: unknown): void;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const cleanText = (value: unknown, limit = 2400): string => String(value ?? "")
  .replace(/(\b(?:authorization|cookie|password|passwd|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|uid)\b\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
  .replace(/\b(?:Bearer\s+)?(?:gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{16,})\b/g, "[redacted]")
  .replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]")
  .replace(/(?:file:\/\/)[^\s)]+/g, "file://[redacted]")
  .slice(0, limit);

function configText(request: SourceHostRunRequest): string {
  return typeof request.config === "string" ? request.config : "";
}
async function hashText(value: string): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  } catch { return undefined; }
}
function makeRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createSourceHostDiagnostic(input: {
  request: SourceHostWorkerRequest;
  failure: { kind: SourceHostFailureKind; stage: SourceHostWorkerStage; code?: string; name?: string; message: string; stack?: string };
  timeoutMs?: number;
  elapsedMs?: number;
  lastProgress?: string;
  actualCommit?: string;
  wasmSha256?: string;
  wasmBytes?: number;
}): Promise<SourceHostDiagnosticReceipt> {
  const { request } = input;
  const variant = request.hostVariant === "stellar" ? "stellar" : "classic";
  const config = configText(request);
  const configHash = config ? await hashText(config) : undefined;
  const operationKind = request.reexecutionTarget ? "reexecution" : request.startupJobs ? "startup" : request.jobs ? "batch" : "single";
  const durationMatch = config.match(/\bduration\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
  const jobs = request.jobs ? await Promise.all(request.jobs.slice(0, 256).map(async job => {
    const jobHash = await hashText(job.request.config);
    return { seed: cleanText(job.request.seed, 80), addedRecharge: Number.isFinite(job.addedRecharge) ? job.addedRecharge : undefined,
      ...(jobHash ? { configSha256: jobHash } : {}) };
  })) : undefined;
  const inputSummary: SourceHostDiagnosticReceipt["input"] = {
    requestKind: operationKind,
    ...(request.seed === undefined ? {} : { seed: cleanText(request.seed, 80) }),
    ...(configHash ? { configSha256: configHash } : {}),
    ...(config ? { configBytes: new TextEncoder().encode(config).byteLength, configLines: config.split(/\r?\n/).length } : {}),
    ...(durationMatch ? { durationSeconds: Number(durationMatch[1]) } : {}),
    ...(request.executionMode ? { executionMode: request.executionMode } : {}),
    ...(request.stopAtDuration === undefined ? {} : { stopAtDuration: request.stopAtDuration }),
    ...(request.primaryTargetIndex === undefined ? {} : { primaryTargetIndex: request.primaryTargetIndex }),
    ...(request.targetPhases ? { targetPhaseCount: request.targetPhases.length } : {}),
    ...(jobs?.length ? { jobSeeds: jobs } : request.startupJobs?.length ? { jobSeeds: request.startupJobs.slice(0, 256).map(job => ({ seed: cleanText(job.request.seed, 80) })) } : {}),
  };
  const expectedCommit = variant === "stellar" ? SOURCE_HOST_STELLAR_COMMIT : SOURCE_HOST_COMMIT;
  const stack = input.failure.stack ? cleanText(input.failure.stack, 8000).split("\n").slice(0, 32).join("\n") : undefined;
  const message = cleanText(input.failure.message || "未提供错误消息");
  return {
    schemaVersion: "source-host-worker-diagnostic-v1", runId: makeRunId(), createdAt: new Date().toISOString(),
    application: { name: "GIDPS", version: appPackage.version, mode: import.meta.env.MODE ?? "unknown" },
    source: { hostVariant: variant, expectedCommit, ...(input.actualCommit ? { actualCommit: cleanText(input.actualCommit, 120) } : {}),
      ...(input.wasmSha256 ? { wasmSha256: input.wasmSha256 } : {}), ...(input.wasmBytes === undefined ? {} : { wasmBytes: input.wasmBytes }) },
    failure: { kind: input.failure.kind, stage: input.failure.stage, code: input.failure.code ?? `SOURCE_HOST_${input.failure.stage.toUpperCase().replaceAll("-", "_")}_FAILED`,
      ...(input.failure.name ? { name: cleanText(input.failure.name, 120) } : {}), message, ...(stack ? { stack } : {}) },
    worker: { timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS, elapsedMs: Math.max(0, Math.round(input.elapsedMs ?? 0)), ...(input.lastProgress ? { lastProgress: cleanText(input.lastProgress, 300) } : {}) },
    input: inputSummary,
    privacy: { rawConfigIncluded: false, failureLogsIncluded: false, credentialsIncluded: false },
  };
}

export function sourceHostDiagnosticMessage(receipt: SourceHostDiagnosticReceipt): string {
  const stageNames: Record<SourceHostWorkerStage, string> = {
    request: "接收输入", "load-manifest": "读取来源清单", "load-wasm": "加载执行器", "instantiate-wasm": "启动执行器",
    execute: "运行模拟", batch: "运行对照", reexecution: "复跑核对", response: "返回结果", worker: "Worker",
  };
  if (receipt.failure.kind === "timeout") return `运行超时（${stageNames[receipt.failure.stage]}），没有生成结果。可以按原输入重试或导出诊断。`;
  if (receipt.failure.kind === "message-error") return `Worker 返回的数据无法读取（${stageNames[receipt.failure.stage]}），没有生成结果。可以按原输入重试或导出诊断。`;
  if (receipt.failure.kind === "worker-error") return `Worker 在${stageNames[receipt.failure.stage]}时停止，没有生成结果。可以按原输入重试或导出诊断。`;
  return `执行在${stageNames[receipt.failure.stage]}时失败（${receipt.failure.code}），没有生成结果。可以按原输入重试或导出诊断。`;
}

/** One terminal path for both source-host UI entry points; worker instances never survive a result or failure. */
export function startSourceHostWorker(request: SourceHostWorkerRequest, handlers: SourceHostWorkerRunHandlers, timeoutMs = DEFAULT_TIMEOUT_MS): SourceHostWorkerRunHandle {
  const worker = new Worker(new URL("./source-host-worker.ts", import.meta.url), { type: "module" });
  const startedAt = performance.now();
  let stage: SourceHostWorkerStage = "request", lastProgress: string | undefined, settled = false, timer: ReturnType<typeof setTimeout>;
  const clear = () => clearTimeout(timer);
  const terminate = () => { clear(); worker.terminate(); };
  const finish = () => { if (settled) return false; settled = true; terminate(); return true; };
  const armTimeout = () => { clear(); timer = setTimeout(() => { void fail("timeout", "Worker 超过等待上限没有返回进度或结果。", undefined, "WORKER_TIMEOUT"); }, timeoutMs); };
  const fail = async (kind: SourceHostFailureKind, message: string, stack?: string, code?: string, name?: string, failureLogs?: unknown) => {
    if (settled) return;
    settled = true; terminate();
    const diagnostic = await createSourceHostDiagnostic({ request, failure: { kind, stage, message, ...(stack ? { stack } : {}), ...(code ? { code } : {}), ...(name ? { name } : {}) }, timeoutMs,
      elapsedMs: performance.now() - startedAt, lastProgress });
    handlers.onFailure(diagnostic, failureLogs);
  };
  worker.onmessage = event => {
    if (settled) return;
    const message = event.data as SourceHostWorkerMessage;
    if (message.type === "progress") {
      stage = message.stage ?? stage; lastProgress = message.message; armTimeout(); handlers.onProgress(message); return;
    }
    if (message.type === "error") {
      if (message.diagnostic) {
        if (!finish()) return;
        handlers.onFailure(message.diagnostic, message.failureLogs);
        return;
      }
      void fail("runtime-error", message.diagnostic?.failure.message ?? message.message, message.diagnostic?.failure.stack,
        message.diagnostic?.failure.code, message.diagnostic?.failure.name, message.failureLogs);
      return;
    }
    if (!finish()) return;
    handlers.onMessage(message);
  };
  worker.onerror = event => {
    event.preventDefault();
    const error = event.error instanceof Error ? event.error : undefined;
    void fail("worker-error", event.message || "Worker 脚本错误", error?.stack ?? `${event.filename || "Worker"}:${event.lineno || 0}:${event.colno || 0}`, "WORKER_SCRIPT_ERROR", error?.name);
  };
  worker.onmessageerror = () => { void fail("message-error", "Worker 消息无法反序列化。", undefined, "WORKER_MESSAGE_ERROR"); };
  armTimeout();
  try { worker.postMessage(request); }
  catch (error) { void fail("post-message-error", error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined, "WORKER_POSTMESSAGE_ERROR", error instanceof Error ? error.name : undefined); }
  return { worker, cancel: () => { if (finish()) { /* Cancellation is deliberate and does not create a failure receipt. */ } } };
}
