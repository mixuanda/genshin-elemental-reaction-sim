import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SimulationRecord } from '../src/simulation-record';

test('real workers preserve indexed sampling across thread counts and measure bounded large batches', async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    const active = new Set<number>();
    const samples: Array<{ start: number; values: number[] }> = [];
    Object.assign(window, { batchWitness: { active, samples } });
    const NativeWorker = window.Worker;
    let nextId = 0;
    window.Worker = class extends NativeWorker {
      readonly witnessId = nextId++;
      start = 0;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', event => {
          const data = event.data;
          if (data.type === 'result' && Array.isArray(data.samples)) samples.push({ start: this.start, values: data.samples });
        });
      }
      override postMessage(message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
        const request = message as { type?: string; sampleStart?: number };
        if (request.type === 'run') { this.start = request.sampleStart ?? 0; active.add(this.witnessId); }
        if (Array.isArray(transfer)) super.postMessage(message, transfer);
        else super.postMessage(message, transfer);
      }
      override terminate() { active.delete(this.witnessId); super.terminate(); }
    };
  });
  await page.goto('/results');
  await expect(page.locator('#cancelRunButton')).toBeHidden({ timeout: 60_000 });
  const config = await page.evaluate(() => {
    const input = window.GenshinDpsLab.getConfig();
    const actor = input.characters[0]!;
    actor.id = 'a'; actor.name = '合成120秒采样'; actor.level = 90; actor.element = 'pyro';
    actor.energyMax = 0; actor.initialEnergy = 0;
    actor.stats = { baseAtk: 1000, atkPct: 0, flatAtk: 0, baseHp: 10000, hpPct: 0, flatHp: 0,
      baseDef: 700, defPct: 0, flatDef: 0, em: 0, critRate: .5, critDmg: .5, dmgBonus: 0,
      defIgnore: 0, reactionBonus: 0, energyRecharge: 1 };
    input.characters = [actor]; input.duration = 120; input.cycleLength = 20;
    input.rotation = [{ id: 'hit', actorId: 'a', name: '合成物理命中', at: 0,
      hits: [{ offset: 0, scaling: 1, element: 'physical' }] }];
    delete input.timeline; delete input.reactionEngine;
    input.enemy = { level: 90, resistance: 0, defReduction: 0 };
    input.playerDamageModel = { mode: 'disabled' }; input.targetClockModel = { mode: 'disabled' };
    input.targetTaskModel = { mode: 'legacy-event-heap-v1' };
    return input;
  });
  await page.locator('[data-tab="config"]').click();
  await page.locator('#jsonEditor').fill(JSON.stringify(config));
  await page.locator('#applyJsonButton').click();
  await expect(page.locator('#cancelRunButton')).toBeHidden({ timeout: 60_000 });
  await page.locator('#critModeInput').selectOption('seeded-random-v1');
  await page.locator('#randomSeedInput').fill('batch-parallel-120-v1');
  const run = async (iterations: number, threads: number) => {
    await page.locator('#iterationInput').fill(String(iterations));
    await page.locator('#threadInput').selectOption(String(threads));
    await page.evaluate(() => { (window as unknown as { batchWitness: { samples: unknown[] } }).batchWitness.samples.length = 0; });
    await page.locator('#runButton').click();
    await expect(page.locator('#cancelRunButton')).toBeHidden({ timeout: 300_000 });
    await expect(page.locator('#simulationProgress')).toHaveText('');
    const download = page.waitForEvent('download');
    await page.locator('#exportRunButton').click();
    const path = await (await download).path();
    const record = JSON.parse(await readFile(path!, 'utf8')) as SimulationRecord;
    expect(record.iterations).toBe(iterations);
    expect(record.result.config.duration).toBe(120);
    expect(record.result.damageEvents).toHaveLength(6);
    expect(record.result.damageEvents.every(hit => [1, 1.5].includes(hit.damageFactors.critMultiplier))).toBe(true);
    console.log('BATCH_EVIDENCE', JSON.stringify({ threads, ...record.batchSummary }));
    const witness = await page.evaluate(() => {
      const state = (window as unknown as { batchWitness: { active: Set<number>; samples: Array<{ start:number; values:number[] }> } }).batchWitness;
      return { active: state.active.size, trials: [...state.samples].sort((a,b) => a.start-b.start).flatMap(part => part.values) };
    });
    expect(witness.active).toBe(0);
    expect(witness.trials).toHaveLength(iterations);
    return { ...record, trials: witness.trials };
  };
  const sequential = await run(32, 1);
  for (const threads of [2, 4]) {
    const parallel = await run(32, threads);
    expect(parallel.result).toEqual(sequential.result);
    expect(parallel.trials).toEqual(sequential.trials);
    const { elapsedMilliseconds: a, ...left } = parallel.batchSummary;
    const { elapsedMilliseconds: b, ...right } = sequential.batchSummary;
    expect(left).toEqual(right);
  }
  if (process.env.GIDPS_BATCH_SMALL_ONLY !== '1') {
  const thousand = await run(1000, 2);
  expect(thousand.batchSummary.sampleStandardDeviation).toBeGreaterThan(0);
  // Analytic mean: six hits * 500 noncrit * (1 + .5*.5) = 3750.
  const error = Math.abs(thousand.batchSummary.meanDamage - 3750);
  expect(error).toBeLessThan(5 * thousand.batchSummary.sampleStandardDeviation / Math.sqrt(1000));
  if (thousand.batchSummary.elapsedMilliseconds < 20000) {
    const tenThousand = await run(10000, 2);
    expect(Math.abs(tenThousand.batchSummary.meanDamage - 3750))
      .toBeLessThan(5 * tenThousand.batchSummary.sampleStandardDeviation / 100);
  } else console.log('BATCH_LIMIT', '10000 not run: 1000 runs exceeded the 20-second resource gate.');
  }
  await page.locator('#iterationInput').fill('10000');
  await page.locator('#runButton').click();
  await page.locator('#cancelRunButton').click();
  await expect(page.locator('#cancelRunButton')).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { batchWitness: { active: Set<number> } }).batchWitness.active.size)).toBe(0);
  console.log('WORKER_LIFECYCLE', 'all 32 trial damages identical at 1/2/4 threads; active tracked simulation Workers=0 after completion and cancellation');
});
