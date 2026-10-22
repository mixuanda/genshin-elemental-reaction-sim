import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import type { SimConfig } from '@genshin-dps-lab/schemas';
import type { EventStepResult } from '../../../packages/sim-core/src/event-step-result';
import type { ProjectDocument } from '../src/project-document';
import type { SimulationRecordV2 } from '../src/simulation-record';

async function downloadText(page: Page, selector: string): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

async function savedCopies(page: Page) {
  return page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('gidps:document:'))
    .sort().map(key => ({ key, text: localStorage.getItem(key)! })));
}

async function workerStarts(page: Page): Promise<number> {
  return page.evaluate(() => Reflect.get(window, '__salvageWorkerStarts') as number);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let starts = 0;
    Object.defineProperty(window, '__salvageWorkerStarts', { get: () => starts });
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); starts += 1; }
    };
  });
});

test('rejected V2 result preserves valid source inputs for a separate editable copy', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const config = JSON.parse(await readFile(new URL('../../../docs/fixtures/ec-event-steps.synthetic.json', import.meta.url), 'utf8')) as SimConfig;
  config.duration = 2;
  config.cycleLength = 2;
  config.randomSeed = 'v2-salvage-explicit-source';
  await page.goto('/results');
  await page.locator('#importInput').setInputFiles({ name: 'source.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(config)) });
  await page.locator('#energyModeInput').selectOption('zero');
  await page.locator('#critModeInput').selectOption('noCrit');
  await page.locator('#runButton').click();
  await expect.poll(() => page.evaluate(() => window.GenshinDpsLab.getLastResult()?.totalDamage), { timeout: 30000 }).toBeGreaterThan(0);
  const record = JSON.parse(await downloadText(page, '#exportRunButton')) as SimulationRecordV2;
  expect(record.validation).toBe('event-steps-v1');
  const rejected = structuredClone(record);
  const wire = rejected.result as EventStepResult;
  expect(wire.evidence.propagationEvents[0]!.operations.length).toBeGreaterThan(1);
  wire.evidence.propagationEvents[0]!.operations.reverse();
  const original = `${JSON.stringify(rejected, null, 3)}\n`;
  const startsBefore = await workerStarts(page);
  const copiesBefore = await savedCopies(page);

  await page.locator('#importInput').setInputFiles({ name: 'rejected-v2.json', mimeType: 'application/json', buffer: Buffer.from(original) });
  await expect(page.locator('#simulationProgress')).toContainText('未重新模拟');
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  await expect(page.locator('#exportRunButton')).toBeDisabled();
  expect(await workerStarts(page)).toBe(startsBefore);
  expect(await savedCopies(page)).toEqual(copiesBefore);
  expect(await downloadText(page, '#downloadOriginalDocument')).toBe(original);
  const editor = JSON.parse(await page.locator('#jsonEditor').inputValue()) as Record<string, unknown>;
  await testInfo.attach('rejected-result-open-state.json', {
    body: JSON.stringify({ editorKeys: Object.keys(editor), notice: await page.locator('#documentNotice').textContent(), workerStarts: await workerStarts(page), result: await page.evaluate(() => window.GenshinDpsLab.getLastResult()) }),
    contentType: 'application/json'
  });
  // This is the original failure: the rejected result must not discard the
  // independently validated configuration or expose the whole record as input.
  expect(editor.duration).toBe(2);
  expect(editor).toEqual(record.sourceConfig);
  await expect(page.locator('#documentNotice')).toContainText('原结果未通过校验');
  await expect(page.locator('#randomSeedInput')).toHaveValue(record.options.randomSeed);
  await expect(page.locator('#energyModeInput')).toHaveValue('zero');
  await expect(page.locator('#critModeInput')).toHaveValue('noCrit');

  const edited = structuredClone(record.sourceConfig);
  edited.duration = 3;
  await page.locator('#jsonEditor').fill(JSON.stringify(edited, null, 2));
  await expect(page.locator('#documentNotice')).toContainText('自动保存');
  const copyText = await downloadText(page, '#exportButton');
  const copy = JSON.parse(copyText) as ProjectDocument;
  expect(copy.format).toBe('gidps-document-v1');
  expect(copy.verification).toBe('not-recomputed');
  expect(copy.config).toEqual(edited);
  expect(copy.runInputs!.sourceConfig).toEqual(edited);
  expect(copy.runInputs!.options).toEqual(record.options);
  expect(copy.original).toEqual({ name: 'rejected-v2.json', text: original });
  expect(Object.hasOwn(copy, 'result')).toBe(false);
  expect(Object.hasOwn(copy, 'validation')).toBe(false);
  expect(await downloadText(page, '#downloadOriginalDocument')).toBe(original);
  expect(await workerStarts(page)).toBe(startsBefore);

  await page.locator('#importInput').setInputFiles({ name: 'edited-input.gidps.json', mimeType: 'application/json', buffer: Buffer.from(copyText) });
  await expect(page.locator('#simulationProgress')).toContainText('未重新模拟');
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  expect(await page.evaluate(() => window.GenshinDpsLab.getConfig())).toEqual(edited);
  expect(await workerStarts(page)).toBe(startsBefore);
  expect(JSON.parse(await downloadText(page, '#exportButton'))).toEqual(copy);

  await page.locator('#runButton').click();
  await expect.poll(() => page.evaluate(() => window.GenshinDpsLab.getLastResult()?.config.duration), { timeout: 30000 }).toBe(3);
  expect(await workerStarts(page)).toBeGreaterThan(startsBefore);
  const rerun = JSON.parse(await downloadText(page, '#exportRunButton')) as SimulationRecordV2;
  expect(rerun.validation).toBe('event-steps-v1');
  expect(rerun.sourceConfig).toEqual(edited);
  expect((rerun.result as EventStepResult).evidence.propagationEvents[0]!.operations).not.toEqual(wire.evidence.propagationEvents[0]!.operations);
  expect(pageErrors).toEqual([]);
  await testInfo.attach('salvaged-input-copy.json', { body: copyText, contentType: 'application/json' });
});

for (const fault of ['missing-config-seed', 'missing-options-seed', 'invalid-options', 'invalid-iterations'] as const) {
  test(`does not salvage invalid or missing source inputs: ${fault}`, async ({ page }) => {
    const sourceConfig = JSON.parse(await readFile(new URL('../../../docs/fixtures/ec-event-steps.synthetic.json', import.meta.url), 'utf8')) as Record<string, unknown>;
    const options: Record<string, unknown> = { energyMode: 'zero', critMode: 'noCrit', compatibilityMode: 'legal-frame-v1', randomSeed: 'explicit-seed' };
    const record = { format: 'gidps-simulation-record-v2', validation: 'event-steps-v1', sourceConfig, options, iterations: 1, executionProfile: null, benchmark: null, result: {} };
    if (fault === 'missing-config-seed') delete sourceConfig.randomSeed;
    if (fault === 'missing-options-seed') delete options.randomSeed;
    if (fault === 'invalid-options') options.energyMode = 'invented';
    if (fault === 'invalid-iterations') record.iterations = 0;
    const original = `${JSON.stringify(record, null, 2)}\n`;
    await page.goto('/results');
    const startsBefore = await workerStarts(page);
    const copiesBefore = await savedCopies(page);
    await page.locator('#importInput').setInputFiles({ name: 'missing-input-v2.json', mimeType: 'application/json', buffer: Buffer.from(original) });
    await expect(page.locator('#simulationProgress')).toContainText('未重新模拟');
    expect(await page.locator('#jsonEditor').inputValue()).toBe(original);
    expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
    await expect(page.locator('#exportRunButton')).toBeDisabled();
    const downloads: string[] = [];
    page.on('download', download => downloads.push(download.suggestedFilename()));
    await page.locator('#runButton').click();
    await page.locator('#exportButton').click();
    await expect(page.locator('#documentNotice')).toContainText('当前旧文件仅可读');
    expect(downloads).toEqual([]);
    expect(await savedCopies(page)).toEqual(copiesBefore);
    expect(await workerStarts(page)).toBe(startsBefore);
    expect(await downloadText(page, '#downloadOriginalDocument')).toBe(original);
  });
}
