import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceHostWorkerRequest } from "./source-host-batch";
import { createSourceHostDiagnostic, startSourceHostWorker, type SourceHostWorkerMessage } from "./source-host-worker-client";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<SourceHostWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  emitMessage(data: SourceHostWorkerMessage): void { this.onmessage?.({ data } as MessageEvent<SourceHostWorkerMessage>); }
  emitError(message: string): void {
    const error = new Error(message);
    this.onerror?.({ message, error, filename: "https://localhost/source-host-worker.js", lineno: 12, colno: 3, preventDefault: vi.fn() } as unknown as ErrorEvent);
  }
  emitMessageError(): void { this.onmessageerror?.({} as MessageEvent); }
}

const request = (): SourceHostWorkerRequest => ({
  hostVariant: "classic", seed: "12345", config: "wanderer char level=90;\noptions duration=30;",
} as SourceHostWorkerRequest);
const handlers = () => ({ onProgress: vi.fn(), onMessage: vi.fn(), onFailure: vi.fn() });

describe("source-host worker diagnostics and lifecycle", () => {
  beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("exports a redacted, hash-addressed input summary without raw config or logs", async () => {
    const diagnostic = await createSourceHostDiagnostic({ request: request(), failure: {
      kind: "runtime-error", stage: "execute", message: "bad token=do-not-export", stack: "Error: failed\n at /Users/evan/private.js:1:2",
    } });
    const encoded = JSON.stringify(diagnostic);
    expect(diagnostic.input).toMatchObject({ seed: "12345", configBytes: 44, durationSeconds: 30, requestKind: "single" });
    expect(diagnostic.input.configSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(diagnostic.failure.message).toContain("token=[redacted]");
    expect(diagnostic.failure.stack).toContain("/Users/[redacted]");
    expect(encoded).not.toContain("wanderer char");
    expect(encoded).not.toContain("do-not-export");
    expect(diagnostic.privacy).toEqual({ rawConfigIncluded: false, failureLogsIncluded: false, credentialsIncluded: false });
  });

  it("captures Worker script errors with stage and stack, and ignores late messages", async () => {
    const callbacks = handlers();
    const run = startSourceHostWorker(request(), callbacks);
    const worker = FakeWorker.instances[0]!;
    worker.emitMessage({ type: "progress", stage: "execute", message: "正在运行模拟" });
    worker.emitError("module failed");
    await vi.waitFor(() => expect(callbacks.onFailure).toHaveBeenCalledOnce());
    const diagnostic = callbacks.onFailure.mock.calls[0]![0];
    expect(diagnostic.failure).toMatchObject({ kind: "worker-error", stage: "execute", code: "WORKER_SCRIPT_ERROR", message: "module failed" });
    expect(diagnostic.failure.stack).toContain("Error: module failed");
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.emitMessage({ type: "result", result: {} as never, elapsedMs: 1 });
    expect(callbacks.onMessage).not.toHaveBeenCalled();
    run.cancel();
  });

  it("reports message deserialization and timeout failures, then terminates each Worker", async () => {
    const messageCallbacks = handlers();
    const messageRun = startSourceHostWorker(request(), messageCallbacks);
    const messageWorker = FakeWorker.instances[0]!;
    messageWorker.emitMessage({ type: "progress", stage: "load-wasm", message: "正在加载" });
    messageWorker.emitMessageError();
    await vi.waitFor(() => expect(messageCallbacks.onFailure).toHaveBeenCalledOnce());
    expect(messageCallbacks.onFailure.mock.calls[0]![0].failure).toMatchObject({ kind: "message-error", stage: "load-wasm", code: "WORKER_MESSAGE_ERROR" });
    expect(messageWorker.terminate).toHaveBeenCalledOnce();
    messageRun.cancel();

    vi.useFakeTimers();
    const timeoutCallbacks = handlers();
    const timeoutRun = startSourceHostWorker(request(), timeoutCallbacks, 500);
    const timeoutWorker = FakeWorker.instances[1]!;
    timeoutWorker.emitMessage({ type: "progress", stage: "execute", message: "running" });
    await vi.advanceTimersByTimeAsync(501);
    vi.useRealTimers();
    await vi.waitFor(() => expect(timeoutCallbacks.onFailure).toHaveBeenCalledOnce());
    expect(timeoutCallbacks.onFailure.mock.calls[0]![0].failure).toMatchObject({ kind: "timeout", stage: "execute", code: "WORKER_TIMEOUT" });
    expect(timeoutCallbacks.onFailure.mock.calls[0]![0].worker.timeoutMs).toBe(500);
    expect(timeoutWorker.terminate).toHaveBeenCalledOnce();
    timeoutRun.cancel();
  });
});

it("suppresses a pending failure diagnostic after cancellation", async () => {
  vi.stubGlobal("Worker", FakeWorker); FakeWorker.instances = [];
  let complete!: (value: ArrayBuffer) => void;
  const digest = vi.spyOn(crypto.subtle, "digest").mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  try {
    const callbacks = handlers(); const run = startSourceHostWorker(request(), callbacks);
    FakeWorker.instances[0]!.emitError("old failure");
    expect(digest).toHaveBeenCalled(); run.cancel(); complete(new ArrayBuffer(32));
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(callbacks.onFailure).not.toHaveBeenCalled();
  } finally { digest.mockRestore(); vi.unstubAllGlobals(); }
});

describe("source Worker operation boundaries", () => {
  beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each(["load-manifest", "load-wasm", "instantiate-wasm", "execute", "batch", "reexecution", "response"] as const)("retains %s when reporting failure", async stage => {
    const callbacks = handlers(); const run = startSourceHostWorker(request(), callbacks);
    const worker = FakeWorker.instances[0]!;
    worker.emitMessage({ type: "progress", stage, message: "synthetic phase" });
    worker.emitMessage({ type: "error", message: "synthetic failure" });
    await vi.waitFor(() => expect(callbacks.onFailure).toHaveBeenCalledOnce());
    expect(callbacks.onFailure.mock.calls[0]![0].failure.stage).toBe(stage);
    worker.emitMessage({ type: "result", result: {} as never, elapsedMs: 1 });
    expect(callbacks.onMessage).not.toHaveBeenCalled(); run.cancel();
  });
  it.each(["result", "batch-result", "startup-result", "reexecution-result"] as const)("terminates on %s and ignores duplicate terminal messages", type => {
    const callbacks = handlers(); startSourceHostWorker(request(), callbacks);
    const worker = FakeWorker.instances[0]!;
    const message = { type, elapsedMs: 0 } as SourceHostWorkerMessage;
    worker.emitMessage(message); worker.emitMessage(message); worker.emitError("late error");
    expect(callbacks.onMessage).toHaveBeenCalledOnce();
    expect(callbacks.onFailure).not.toHaveBeenCalled(); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("reports construction failure through the same diagnostic handler", async () => {
    vi.stubGlobal("Worker", class { constructor() { throw new Error("unsupported worker"); } });
    const callbacks = handlers(); const run = startSourceHostWorker(request(), callbacks);
    await vi.waitFor(() => expect(callbacks.onFailure).toHaveBeenCalledOnce());
    expect(callbacks.onFailure.mock.calls[0]![0].failure.code).toBe("WORKER_CONSTRUCTION_FAILED");
    expect(run.worker).toBeNull(); run.cancel();
  });
  it("reports postMessage failure and snapshots the original request", async () => {
    class BrokenPostWorker extends FakeWorker { override postMessage = vi.fn(() => { throw new Error("clone failed"); }); }
    vi.stubGlobal("Worker", BrokenPostWorker);
    const input = request(), callbacks = handlers(); const run = startSourceHostWorker(input, callbacks);
    input.seed = "changed";
    await vi.waitFor(() => expect(callbacks.onFailure).toHaveBeenCalledOnce());
    expect(callbacks.onFailure.mock.calls[0]![0]).toMatchObject({ failure: { kind: "post-message-error" }, input: { seed: "12345" } });
    run.cancel();
  });
  it("counts declared target phases in the input receipt", async () => {
    const diagnostic = await createSourceHostDiagnostic({ request: { ...request(), targetPhases: { policy: "declared-target-phases-v1", phases: [] } }, failure: { kind: "runtime-error", stage: "request", message: "fixture" } });
    expect(diagnostic.input.targetPhaseCount).toBe(0);
  });
});
