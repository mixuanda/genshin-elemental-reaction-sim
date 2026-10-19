import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEventCollection,
  captureSourceHostEventCollection,
  type SourceHostEventCollection,
} from '../../../packages/sim-core/src/source-host-event-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=12 ignore_burst_energy=true;
tartaglia char lvl=90/90 cons=0 talent=1,1,1;
tartaglia add weapon="huntersbow" refine=1 lvl=1/20;
baizhu char lvl=90/90 cons=2 talent=1,1,1;
baizhu add weapon="apprenticesnotes" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
kaeya add stats atk=1000000 cr=0 cd=0;
target lvl=90 hp=100000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active tartaglia;
tartaglia burst;
kaeya skill;
wait(600);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('audited global event calls export independent, replayable event components', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-event-components-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-event-components-team-20260930.result.json';
  try {
    let native: SourceHostResult;
    if (process.env.GIDPS_REUSE_EVENT_CAPTURE === '1') {
      native = JSON.parse(await readFile(capturePath, 'utf8')) as SourceHostResult;
      measurements.nativeRunPerformed = false;
    } else {
      await page.goto('/source-simulation');
      await page.locator('#source-host-variant').selectOption('classic');
      await page.locator('#source-host-config').fill(config);
      await page.locator('#source-host-seed').fill('20260930');
      await page.locator('#source-host-run').click();
      await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
      native = await download(page, '#source-host-export') as SourceHostResult;
      await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n'); // Preserve the full native result before assertions.
      measurements.nativeRunPerformed = true;
    }
    measurements.nativeResultArchived = true;
    measurements.rawPath = capturePath;
    expect(native.config).toBe(config);

    const calls = native.eventListenerCalls ?? [];
    const closedCall = (siteId: string) => {
      for (const call of calls) {
        if (call.siteId !== siteId) continue;
        const collection = captureSourceHostEventCollection(native, call.id);
        if (!collection) continue;
        const analysis = calculateSourceHostEventCollection(collection).analysis;
        if (analysis.deliveryClosed && collection.hits.length > 0) return { call, collection, analysis };
      }
      return undefined;
    };
    const baizhu = closedCall('baizhu.c2.enemy-damage');
    const tartaglia = closedCall('tartaglia.riptide.target-died');
    const candidates = (siteId: string) => calls.filter(call => call.siteId === siteId).map(call => {
      const collection = captureSourceHostEventCollection(native, call.id);
      if (!collection) return { id: call.id, capture: false };
      const analysis = calculateSourceHostEventCollection(collection).analysis;
      return { id: call.id, entryFacts: call.entryFacts, deliveryClosed: analysis.deliveryClosed,
        hitCount: collection.hits.length, reasons: analysis.reasons };
    });
    expect(baizhu, `expected a closed Baizhu C2 attack with a hit; candidates=${JSON.stringify(candidates('baizhu.c2.enemy-damage'))}`).toBeDefined();
    expect(tartaglia, `expected a closed delayed Riptide death attack with a hit; candidates=${JSON.stringify(candidates('tartaglia.riptide.target-died'))}`).toBeDefined();
    const selected = [baizhu!, tartaglia!];

    const componentMeasurements: Record<string, unknown>[] = [];
    for (let index = 0; index < selected.length; index++) {
      const { call, collection, analysis } = selected[index]!;
      const calculated = calculateSourceHostEventCollection(collection);
      const included = collection.hits.filter(hit => hit.included);
      const applications = included.map(hit => hit.calculation.originalCapture.application);
      expect(applications.length).toBeGreaterThan(0);
      for (const hit of included) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
      expect(calculated.total).toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);

      await page.goto('/source-simulation');
      await page.locator('#source-host-import').setInputFiles({
        name: 'source-event-native.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(native)),
      });
      const openButton = page.locator(`[data-origin-open-event="${call.id}"]`);
      await expect(openButton).toBeVisible();
      await openButton.click();
      const eventPanel = page.locator('[data-source-event-collection]');
      await expect(eventPanel).toBeVisible();
      await expect(page.locator('[data-source-event-delivery="closed"]')).toContainText('本次事件攻击已结算');

      if (index === 0) {
        const exported = await download(page, '[data-source-event-export]') as SourceHostEventCollection;
        expect(exported).toEqual(collection);
        await page.locator('#calc-import').setInputFiles({
          name: 'source-event-component.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
        });
        await expect(eventPanel).toBeVisible();
        await expect(page.locator('[data-source-event-delivery="closed"]')).toContainText('本次事件攻击已结算');

        const total = page.locator('[data-source-event-total]');
        const totalBeforeEdit = await total.innerText();
        const scaling = page.locator('[data-source-event-editor] [data-source-host-input="scaling"]').first();
        const scalingBefore = Number(await scaling.inputValue());
        await scaling.fill(String(scalingBefore + 0.01));
        await expect(page.locator('[data-source-event-editor] [data-source-host-calculation-result]'))
          .toContainText('编辑后原始公式伤害');
        await expect.poll(() => total.innerText()).not.toBe(totalBeforeEdit);
      }

      componentMeasurements.push({
        siteId: call.siteId, listenerCallId: call.id, componentId: collection.componentId,
        deliveryClosed: analysis.deliveryClosed, attackCount: analysis.attackCount,
        producerCount: analysis.producerCount, completedProducerCount: analysis.completedProducerCount,
        pendingProducerCount: analysis.pendingProducerCount, hitCount: applications.length,
        componentSubtotal: calculated.total,
      });
    }

    const selectedTartagliaCall = tartaglia!.call;
    const missingProducerNative = structuredClone(native);
    const missingProducer = missingProducerNative.eventProducers?.find(row => row.listenerCallId === selectedTartagliaCall.id);
    expect(missingProducer).toBeDefined();
    missingProducerNative.eventProducers = missingProducerNative.eventProducers!.filter(row => row.id !== missingProducer!.id);
    const missingProducerCollection = captureSourceHostEventCollection(missingProducerNative, selectedTartagliaCall.id);
    expect(missingProducerCollection).toBeDefined();
    const missingProducerAnalysis = calculateSourceHostEventCollection(missingProducerCollection!).analysis;
    expect(missingProducerAnalysis.deliveryClosed).toBe(false);

    const siteIds = new Set(['baizhu.c2.enemy-damage', 'tartaglia.riptide.target-died']);
    const registrations = native.eventRegistrations?.filter(row => siteIds.has(row.siteId ?? '')) ?? [];
    const selectedCalls = calls.filter(row => siteIds.has(row.siteId ?? ''));
    const selectedCallIds = new Set(selectedCalls.map(row => row.id));
    const selectedProducers = native.eventProducers?.filter(row => selectedCallIds.has(row.listenerCallId)) ?? [];
    const selectedTaskIds = new Set(selectedProducers.map(row => row.taskId));
    const selectedTasks = native.taskLifecycle?.tasks.filter(row => selectedTaskIds.has(row.id)) ?? [];
    measurements.receipts = {
      registrations: registrations.length,
      emissions: native.eventEmissions?.filter(row => row.listenerIds.some(id => selectedCallIds.has(id))).length ?? 0,
      listenerCalls: selectedCalls.length,
      delayedProducers: selectedProducers.length,
      linkedTasks: selectedTasks.length,
      linkedTaskStates: selectedTasks.map(row => row.state),
      components: componentMeasurements,
    };
    measurements.componentImportExportSame = true;
    measurements.sharedCoreEditChangedSubtotal = true;
    measurements.missingDelayedProducerCloses = false;
    measurements.missingDelayedProducerReasons = missingProducerAnalysis.reasons;
    measurements.eventEmissionCount = native.eventEmissions?.filter(row => row.listenerIds.some(id => selectedCallIds.has(id))).length ?? 0;
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(resultPath, JSON.stringify({
      schemaVersion: 'source-event-components-browser-v1', measurements, pageErrors,
      scope: 'One classic two-target run covers only observed Baizhu C2 and Riptide target-death event components; it does not establish ability ownership, full-cast closure, or game verification.',
    }, null, 2) + '\n');
  }
});
