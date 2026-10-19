import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEventCollection,
  captureSourceHostEventCollection,
  type SourceHostEventCollection,
} from '../../../packages/sim-core/src/source-host-event-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import { getSourceHostEventComponentRule } from '../../../packages/sim-core/src/source-host-event-rules';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=12 ignore_burst_energy=true;
albedo char lvl=90/90 cons=0 talent=1,1,1;
albedo add weapon="dullblade" refine=1 lvl=1/20;
dehya char lvl=90/90 cons=0 talent=1,1,1;
dehya add weapon="debateclub" refine=1 lvl=1/20;
raiden char lvl=90/90 cons=0 talent=1,1,1;
raiden add weapon="beginnersprotector" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active albedo;
albedo skill;
dehya skill;
raiden skill;
kaeya attack;
wait(600);`;

const selectedDirectEvents = [
  { siteId: 'albedo.skill.enemy-damage', componentId: 'albedo-skill-proc' },
  { siteId: 'dehya.skill.enemy-damage', componentId: 'dehya-skill-followup' },
  { siteId: 'raiden.eye.enemy-damage', componentId: 'raiden-eye-followup' },
] as const;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('audited classic direct event listeners export closed, replayable hit components', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-direct-events-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-direct-events-team-20260930.result.json';

  try {
    let native: SourceHostResult;
    if (process.env.GIDPS_REUSE_DIRECT_EVENT_CAPTURE === '1') {
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
      // Keep the full native result reviewable even when a later acceptance assertion fails.
      await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n');
      measurements.nativeRunPerformed = true;
    }
    measurements.nativeResultArchived = true;
    measurements.rawPath = capturePath;
    expect(native.config).toBe(config);

    const calls = native.eventListenerCalls ?? [];
    const candidates = (siteId: string) => calls.filter(call => call.siteId === siteId).map(call => {
      const collection = captureSourceHostEventCollection(native, call.id);
      if (!collection) return { id: call.id, entryFacts: call.entryFacts, queuedAttackCount: call.queuedAttacks.length,
        captureAvailable: false };
      const calculation = calculateSourceHostEventCollection(collection);
      return {
        id: call.id,
        entryFacts: call.entryFacts,
        queuedAttackCount: call.queuedAttacks.length,
        captureAvailable: true,
        componentId: collection.componentId,
        deliveryClosed: calculation.analysis.deliveryClosed,
        hitCount: collection.hits.length,
        reasons: calculation.analysis.reasons,
      };
    });
    const positiveClosedCall = (siteId: string) => {
      for (const call of calls) {
        if (call.siteId !== siteId || call.entryFacts?.[`${siteId}.attack-count`] !== 1
          || call.queuedAttacks.length === 0) continue;
        const collection = captureSourceHostEventCollection(native, call.id);
        if (!collection) continue;
        const calculation = calculateSourceHostEventCollection(collection);
        if (calculation.analysis.deliveryClosed && collection.hits.some(hit => hit.included))
          return { call, collection, calculation };
      }
      return undefined;
    };

    const selected = selectedDirectEvents.map(rule => ({
      rule,
      result: positiveClosedCall(rule.siteId),
    }));
    for (const item of selected) {
      expect(item.result,
        `expected one positive, closed ${item.rule.componentId} event with an actual hit; candidates=${JSON.stringify(candidates(item.rule.siteId))}`)
        .toBeDefined();
      expect(item.result!.collection.componentId).toBe(item.rule.componentId);
    }

    // Probe the count-fact contract by editing the archived in-memory receipt; this does not add a native run.
    const countFactProbe = selected[0]!.result!;
    const countFactName = `${countFactProbe.call.siteId}.attack-count`;
    const missingCountNative = structuredClone(native);
    const missingCountCall = missingCountNative.eventListenerCalls?.find(row => row.id === countFactProbe.call.id);
    expect(missingCountCall?.entryFacts?.[countFactName]).toBe(1);
    if (missingCountCall?.entryFacts) delete missingCountCall.entryFacts[countFactName];
    const missingCountCollection = captureSourceHostEventCollection(missingCountNative, countFactProbe.call.id);
    expect(missingCountCollection).toBeDefined();
    const missingCountAnalysis = calculateSourceHostEventCollection(missingCountCollection!).analysis;
    expect(missingCountAnalysis.deliveryClosed,
      `removing ${countFactName} must reject the in-memory receipt; reasons=${JSON.stringify(missingCountAnalysis.reasons)}`)
      .toBe(false);
    expect(missingCountAnalysis.reasons.length).toBeGreaterThan(0);
    measurements.missingAttackCountFact = {
      siteId: countFactProbe.call.siteId,
      listenerCallId: countFactProbe.call.id,
      factRemoved: countFactName,
      deliveryClosed: missingCountAnalysis.deliveryClosed,
      reasons: missingCountAnalysis.reasons,
      additionalNativeRun: false,
    };

    const directMeasurements: Record<string, unknown>[] = [];
    for (let index = 0; index < selected.length; index++) {
      const { rule, result } = selected[index]!;
      const { call, collection, calculation } = result!;
      const included = collection.hits.filter(hit => hit.included);
      const applications = included.map(hit => hit.calculation.originalCapture.application);
      expect(applications.length, `${rule.siteId} closed without an included actual hit`).toBeGreaterThan(0);
      for (const hit of included)
        expect(replaySourceHostHit(hit.calculation.originalCapture).difference,
          `${rule.siteId} application #${hit.calculation.originalCapture.application.id} replay delta`)
          .toBe(0);
      expect(calculation.total, `${rule.siteId} component total must equal the sum of captured applied damage`)
        .toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);

      await page.goto('/source-simulation');
      await page.locator('#source-host-import').setInputFiles({
        name: 'source-direct-events-native.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(native)),
      });
      const openButton = page.locator(`[data-origin-open-event="${call.id}"]`);
      await expect(openButton, `${rule.siteId} should be available from the imported event-origin panel`).toBeVisible();
      const descriptor = getSourceHostEventComponentRule(collection.componentId);
      const originRow = openButton.locator('xpath=../..');
      await expect(originRow).toContainText(descriptor.label);
      await expect(originRow).toContainText(rule.siteId);
      await openButton.click();
      const eventPanel = page.locator('[data-source-event-collection]');
      await expect(eventPanel).toBeVisible();
      await expect(eventPanel).toContainText(descriptor.label);
      await expect(page.locator('[data-source-event-delivery="closed"]')).toContainText('本次事件攻击已结算');

      if (index === 0) {
        const exported = await download(page, '[data-source-event-export]') as SourceHostEventCollection;
        expect(exported).toEqual(collection);
        await page.locator('#calc-import').setInputFiles({
          name: 'source-direct-event-component.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
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

      directMeasurements.push({
        siteId: call.siteId,
        componentId: collection.componentId,
        listenerCallId: call.id,
        entryFacts: call.entryFacts,
        deliveryClosed: calculation.analysis.deliveryClosed,
        attackCount: calculation.analysis.attackCount,
        producerCount: calculation.analysis.producerCount,
        completedProducerCount: calculation.analysis.completedProducerCount,
        pendingProducerCount: calculation.analysis.pendingProducerCount,
        hitCount: applications.length,
        componentSubtotal: calculation.total,
        reasons: calculation.analysis.reasons,
      });
    }

    // Keep the 112 Baizhu/Childe closure and replay behavior as an offline fixture regression.
    const priorNative = JSON.parse(await readFile('docs/validation/source-event-components-team-20260930.capture.json', 'utf8')) as SourceHostResult;
    const priorSelections = [
      { listenerCallId: 12, siteId: 'baizhu.c2.enemy-damage' },
      { listenerCallId: 9, siteId: 'tartaglia.riptide.target-died' },
    ];
    const priorMeasurements: Record<string, unknown>[] = [];
    for (const selection of priorSelections) {
      const call = priorNative.eventListenerCalls?.find(row => row.id === selection.listenerCallId);
      expect(call?.siteId, `legacy capture call #${selection.listenerCallId} identity`).toBe(selection.siteId);
      const collection = captureSourceHostEventCollection(priorNative, selection.listenerCallId);
      expect(collection, `legacy capture call #${selection.listenerCallId} should remain capturable`).toBeDefined();
      const calculation = calculateSourceHostEventCollection(collection!);
      expect(calculation.analysis.deliveryClosed,
        `legacy ${selection.siteId} call #${selection.listenerCallId}: ${JSON.stringify(calculation.analysis.reasons)}`)
        .toBe(true);
      const included = collection!.hits.filter(hit => hit.included);
      const applications = included.map(hit => hit.calculation.originalCapture.application);
      expect(applications.length, `legacy ${selection.siteId} requires actual applied hits`).toBeGreaterThan(0);
      const replayDifferences = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
      expect(replayDifferences, `legacy ${selection.siteId} replay differences`).toEqual(applications.map(() => 0));
      expect(calculation.total).toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
      priorMeasurements.push({
        siteId: selection.siteId,
        listenerCallId: selection.listenerCallId,
        componentId: collection!.componentId,
        deliveryClosed: calculation.analysis.deliveryClosed,
        reasons: calculation.analysis.reasons,
        hitCount: applications.length,
        replayDifferences,
        componentSubtotal: calculation.total,
      });
    }

    measurements.directEvents = directMeasurements;
    measurements.originEntriesOpened = directMeasurements.length;
    measurements.componentImportExportSame = true;
    measurements.sharedCoreEditChangedSubtotal = true;
    measurements.offline112Regression = {
      rawPath: 'docs/validation/source-event-components-team-20260930.capture.json',
      selectedCalls: priorMeasurements,
    };
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(resultPath, JSON.stringify({
      schemaVersion: 'source-direct-events-browser-v1',
      measurements,
      pageErrors,
      scope: 'One classic, two-target run checks positive observed Albedo skill, Dehya skill, and Raiden eye event calls during a four-character rotation. It measures only these three direct listener components; Kaeya is the trigger actor, not an audited event component. The 112 Baizhu and Tartaglia calls are recalculated from their archived native capture.',
    }, null, 2) + '\n');
  }
});
