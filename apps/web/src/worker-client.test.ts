import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runSimulationBatchInWorker, type WorkerRequest, type WorkerResponse } from "./worker-client";
import { batchStatistics } from "./batch-statistics";
import type { SimConfig } from "@genshin-dps-lab/schemas";
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request!: Extract<WorkerRequest, { type: "run" }>;
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  postMessage(request: typeof this.request) { this.request = request; }
  deliver() {
    const samples = Array.from({ length: this.request.iterations }, (_, i) => (this.request.sampleStart ?? 0) + i);
    this.onmessage?.({ data: { type: "progress", completed: samples.length, total: samples.length } });
    this.onmessage?.({ data: { type: "result", result: { firstIndex: samples[0] } as never,
      summary: { iterations: samples.length, ...batchStatistics(samples) } as never, samples } });
  }
}
beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => vi.unstubAllGlobals());
it("combines out-of-order worker delivery in iteration order and keeps first trajectory", async () => {
  const progress: number[] = [];
  const pending = runSimulationBatchInWorker({} as SimConfig, {}, 10, { concurrency: 4, onProgress: p => progress.push(p.completed) });
  expect(FakeWorker.instances).toHaveLength(4);
  for (const worker of [...FakeWorker.instances].reverse()) worker.deliver();
  const result = await pending;
  expect(result.result).toEqual({ firstIndex: 0 });
  expect(result.summary).toMatchObject({ iterations: 10, ...batchStatistics(Array.from({ length: 10 }, (_, i) => i)) });
  expect(progress.at(-1)).toBe(10);
  expect(progress).toEqual([...progress].sort((a, b) => a - b));
  for (const worker of FakeWorker.instances) expect(worker.terminate).toHaveBeenCalledOnce();
});
it.each(["abort", "error", "messageerror"])("terminates every worker after %s and ignores late deliveries", async reason => {
  const controller = new AbortController();
  const pending = runSimulationBatchInWorker({} as SimConfig, {}, 1000, { concurrency: 2, signal: controller.signal });
  const assertion = expect(pending).rejects.toThrow();
  if (reason === "abort") controller.abort();
  else if (reason === "error") FakeWorker.instances[0]!.onerror?.({ message: "failure" });
  else FakeWorker.instances[0]!.onmessageerror?.();
  await assertion;
  for (const worker of FakeWorker.instances) { expect(worker.terminate).toHaveBeenCalledOnce(); worker.deliver(); }
});
