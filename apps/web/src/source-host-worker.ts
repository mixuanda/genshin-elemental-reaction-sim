import { summarizeSourceMonteTrial } from "./source-host-monte-carlo";
import { createSourceHostFormulaResolver } from "../../../packages/sim-core/src/source-host-formula";
import { createSourceHostResult } from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostReexecutionRequest, assertSourceHostReexecutionArtifact, verifySourceHostReexecution, type SourceHostReexecutionReceipt } from "../../../packages/sim-core/src/source-host-reexecution";
import { assertSourceHostTargetPhases } from "../../../packages/sim-core/src/source-host-target-phase";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, sourceHostInitialEnergyIdentity, type SourceHostRunRequest, type SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { createSourceHostDiagnostic, type SourceHostWorkerMessage, type SourceHostWorkerStage } from "./source-host-worker-client";
import type { SourceHostWorkerRequest, SourceHostBatchRun } from "./source-host-batch";
import type { SourceHostStartupRun } from "./source-host-startup-analysis";

type RuntimeScope = typeof globalThis & {
  Go: new () => { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> };
  gidpsSourceHostRun(request: string, resolve: (json: string) => string): string;
};
const runtime = globalThis as RuntimeScope;
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SourceHostWorkerRequest>) => void) | null;
  postMessage(value: SourceHostWorkerMessage): void;
};

scope.onmessage = event => { void (async () => {
  let failureLogs: unknown;
  let stage: SourceHostWorkerStage = "request", lastProgress: string | undefined;
  let actualCommit: string | undefined, wasmSha256: string | undefined, wasmBytes: number | undefined;
  const startedAt = performance.now();
  const progress = (nextStage: SourceHostWorkerStage, message: string) => {
    stage = nextStage; lastProgress = message; scope.postMessage({ type: "progress", stage, message });
  };
  try {
    const target = event.data.reexecutionTarget;
    const request = target ? sourceHostReexecutionRequest(target) : event.data;
    progress("load-manifest", "正在加载固定来源执行器清单…");
    const stellar = request.hostVariant === "stellar";
    const base = stellar ? "/source-host-stellar" : "/source-host";
    const expectedCommit = stellar ? SOURCE_HOST_STELLAR_COMMIT : SOURCE_HOST_COMMIT;
    const manifestResponse = await fetch(`${base}/manifest.json`);
    if (!manifestResponse.ok) throw new Error(`来源清单加载失败：HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json() as { source?: { revision: string }; sourceCommit?: string; artifacts?: { path: string; sha256: string; size: number }[]; files?: { path: string; sha256: string; bytes: number }[] };
    actualCommit = manifest.source?.revision ?? manifest.sourceCommit;
    if (actualCommit !== expectedCommit) throw new Error("所选来源执行器的清单版本不匹配。");
    const artifact = (manifest.artifacts ?? manifest.files)?.find(row => row.path === "source-host.wasm");
    progress("load-wasm", "正在核对并加载来源执行器…");
    const loaderUrl = new URL(`${base}/wasm_exec.js`, location.origin).href;
    await import(/* @vite-ignore */ loaderUrl);
    const go = new runtime.Go();
    const response = await fetch(`${base}/source-host.wasm`);
    if (!response.ok) throw new Error(`来源执行器加载失败：HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const executionArtifact = { wasmSha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join(""), wasmBytes: bytes.byteLength };
    wasmSha256 = executionArtifact.wasmSha256; wasmBytes = executionArtifact.wasmBytes;
    if (!artifact || artifact.sha256 !== executionArtifact.wasmSha256 || ("size" in artifact ? artifact.size : artifact.bytes) !== bytes.byteLength) throw new Error("实际执行器字节与所选来源清单不匹配。");
    if (target) assertSourceHostReexecutionArtifact(target, executionArtifact);
    progress("instantiate-wasm", "正在启动固定来源执行器…");
    const instance = await WebAssembly.instantiate(bytes, go.importObject);
    void go.run(instance.instance).catch(error => {
      const diagnosticError = error instanceof Error ? error : new Error(String(error));
      void createSourceHostDiagnostic({ request: event.data, failure: { kind: "runtime-error", stage: "execute", message: diagnosticError.message,
        stack: diagnosticError.stack, code: "SOURCE_HOST_GO_RUNTIME_FAILED", name: diagnosticError.name }, timeoutMs: 120_000,
        elapsedMs: performance.now() - startedAt, lastProgress, actualCommit, wasmSha256, wasmBytes })
        .then(diagnostic => scope.postMessage({ type: "error", message: diagnostic.failure.message, diagnostic }));
    });
    progress("execute", "正在运行角色、装备与反应事件；伤害由共享公式结算…");
    const started = performance.now();
    const execute = (request: SourceHostRunRequest): SourceHostResult => {
      stage = event.data.jobs || event.data.startupJobs || event.data.monteCarloJobs ? "batch" : target ? "reexecution" : "execute";
      if ((request.hostVariant === "stellar") !== stellar) throw new Error("一次对照必须使用同一来源执行器。");
      const resolver = createSourceHostFormulaResolver();
      const native = JSON.parse(runtime.gidpsSourceHostRun(JSON.stringify(request), resolver.resolve)) as unknown;
      if (native && typeof native === "object" && "error" in native && typeof native.error === "string") {
        if ("sourceCommit" in native && native.sourceCommit === expectedCommit && "logs" in native) failureLogs = native.logs;
        throw new Error(native.error);
      }
      const result = createSourceHostResult(native, resolver.calculations);
      if (result.sourceCommit !== expectedCommit) throw new Error("执行结果与所选来源版本不匹配。");
      if ((result.executionMode ?? "auto-wait") !== (request.executionMode ?? "auto-wait")) throw new Error("执行器未采用请求的动作执行模式，请重新构建对应来源。");
      if (request.stopAtDuration === true && result.observationWindow?.policy !== "duration-or-native") throw new Error("执行器未采用请求的观察时长截止策略，请重新构建对应来源。");
      if (request.stopAtDuration !== true && result.observationWindow?.policy === "duration-or-native") throw new Error("执行器返回的观察截止策略与原生请求不一致，请重新构建对应来源。");
      if ((request.primaryTargetIndex ?? 0) !== (result.targetScene?.primaryTargetIndex ?? 0))
        throw new Error("执行器未返回与请求一致的统计目标索引，请重新构建对应来源。");
      assertSourceHostTargetPhases(request.targetPhases, result.targetPhases, result.targetScene);
      if (sourceHostInitialEnergyIdentity(result.initialEnergy) !== sourceHostInitialEnergyIdentity(request.initialEnergy)) throw new Error("执行器未采用请求的起步能量，请重新构建对应来源。");
      if (JSON.stringify(result.phaseObservation) !== JSON.stringify(request.phaseObservation) || request.phaseObservation && !result.phaseObservations) throw new Error("执行器未返回所请求的原生相位观察，请重新构建对应来源。");
      if (!result.randomness) throw new Error("来源执行器没有返回 RNG 政策，请重新构建所选来源。");
      result.executionArtifact = executionArtifact;
      return result;
    };
    if (target) {
      progress("reexecution", "正用保存的脚本、种子和同一执行器从头复跑，并核对完整结果…");
      const result = execute(request);
      const receipt = verifySourceHostReexecution(target, result);
      stage = "response";
      scope.postMessage({ type: "reexecution-result", receipt, elapsedMs: performance.now() - started });
    } else if (event.data.monteCarloJobs) {
      const { monteCarloJobs, ...baseRequest } = event.data;
      for (const job of monteCarloJobs) {
        scope.postMessage({ type: "monte-start", ...job });
        await new Promise(resolve => setTimeout(resolve, 0));
        const begin = performance.now();
        const result = execute({ ...baseRequest, seed: job.seed });
        const summary = summarizeSourceMonteTrial(result, job, performance.now() - begin);
        const evidence = JSON.stringify({ applications: result.applications, energy: result.energyApplications, actions: result.abilityInvocations, randomness: result.randomness });
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(evidence));
        const eventSha256 = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
        scope.postMessage({ type: "monte-trial", trial: { ...summary, eventSha256 } });
      }
      scope.postMessage({ type: "monte-done" });
    } else if (event.data.startupJobs) {
      const startupRuns: SourceHostStartupRun[] = [];
      const labels = { zero: "零能", full: "满能", custom: "自定义能量" };
      for (const job of event.data.startupJobs) {
        progress("batch", `起步对照 ${startupRuns.length + 1}/${event.data.startupJobs.length}：${labels[job.scenario]}，种子 ${job.request.seed}…`);
        await new Promise(resolve => setTimeout(resolve, 0));
        const jobStarted = performance.now(), result = execute(job.request);
        startupRuns.push({ ...job, result, elapsedMs: performance.now() - jobStarted });
      }
      stage = "response";
      scope.postMessage({ type: "startup-result", startupRuns, elapsedMs: performance.now() - started });
    } else if (event.data.jobs) {
      const runs: SourceHostBatchRun[] = [];
      for (const job of event.data.jobs) {
        progress("batch", `来源对照 ${runs.length + 1}/${event.data.jobs.length}：种子 ${job.request.seed}，额外充能 ${job.addedRecharge * 100}%…`);
        await new Promise(resolve => setTimeout(resolve, 0));
        const jobStarted = performance.now(), result = execute(job.request);
        runs.push({ ...job, result, elapsedMs: performance.now() - jobStarted });
      }
      stage = "response";
      scope.postMessage({ type: "batch-result", runs, elapsedMs: performance.now() - started });
    } else {
      const result = execute(event.data);
      stage = "response";
      scope.postMessage({ type: "result", result, elapsedMs: performance.now() - started });
    }
  } catch (error) {
    const nativeError = error instanceof Error ? error : new Error(String(error));
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
    const diagnostic = await createSourceHostDiagnostic({ request: event.data, failure: { kind: "runtime-error", stage, message: nativeError.message,
      stack: nativeError.stack, name: nativeError.name, ...(code ? { code } : {}) }, timeoutMs: 120_000,
      elapsedMs: performance.now() - startedAt, lastProgress, actualCommit, wasmSha256, wasmBytes });
    scope.postMessage({ type: "error", message: diagnostic.failure.message, diagnostic, ...(failureLogs === undefined ? {} : { failureLogs }) });
  }
})(); };
