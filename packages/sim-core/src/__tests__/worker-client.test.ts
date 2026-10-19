import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { runSimulationBatchInWorker, runSimulationInWorker, type WorkerResponse } from "../../../../apps/web/src/worker-client";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  emit(data: WorkerResponse): void { this.onmessage?.({ data } as MessageEvent<WorkerResponse>); }
}

describe("simulation worker lifecycle", () => {
  beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); });
  afterEach(() => vi.unstubAllGlobals());

  it("runs off-thread, forwards completed progress and releases the worker", async () => {
    const progress = vi.fn();
    const config = { randomSeed: "seed" } as SimConfig;
    const pending = runSimulationInWorker(config, { critMode: "noCrit" }, { onProgress: progress });
    const worker = FakeWorker.instances[0]!;
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "run", config, options: { critMode: "noCrit" }, iterations: 1 });
    worker.emit({ type: "progress", completed: 0, total: 1 });
    expect(progress).toHaveBeenCalledWith({ completed: 0, total: 1 });
    const result = { totalDamage: 123 } as SimulationResult;
    worker.emit({ type: "result", result, summary: {} as never });
    await expect(pending).resolves.toBe(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates a synchronous calculation immediately when cancelled", async () => {
    const controller = new AbortController();
    const pending = runSimulationInWorker({} as SimConfig, {}, { signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    const worker = FakeWorker.instances[0]!;
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.emit({ type: "result", result: {} as SimulationResult, summary: {} as never });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects invalid iterations and already aborted calls without creating a worker", async () => {
    await expect(runSimulationBatchInWorker({} as SimConfig, {}, 0)).rejects.toThrow("迭代次数");
    const controller = new AbortController(); controller.abort();
    await expect(runSimulationInWorker({} as SimConfig, {}, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("surfaces worker errors and always releases its execution", async () => {
    const pending = runSimulationInWorker({} as SimConfig);
    const rejection = expect(pending).rejects.toThrow("缺少数据");
    FakeWorker.instances[0]!.emit({ type: "error", message: "缺少数据" });
    await rejection;
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });
});
