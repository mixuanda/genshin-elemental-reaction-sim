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

const teamOneConfig = `options iteration=1 duration=18 ignore_burst_energy=true;
mona char lvl=90/90 cons=0 talent=1,1,1;
mona add weapon="apprenticesnotes" refine=1 lvl=1/20;
charlotte char lvl=90/90 cons=6 talent=1,1,1;
charlotte add weapon="apprenticesnotes" refine=1 lvl=1/20;
faruzan char lvl=90/90 cons=6 talent=1,1,1;
faruzan add weapon="huntersbow" refine=1 lvl=1/20;
beidou char lvl=90/90 cons=2 talent=1,1,1;
beidou add weapon="debateclub" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active charlotte;
charlotte skill[hold=1];
beidou burst;
mona burst;
faruzan burst;
wait(165);
charlotte attack;
wait(240);`;

const teamTwoConfig = `options iteration=1 duration=12 ignore_burst_energy=true;
chiori char lvl=90/90 cons=4 talent=1,1,1;
chiori add weapon="dullblade" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active chiori;
chiori skill;
chiori skill;
kaeya attack;
wait(210);`;

type NativeArchive = {
  schemaVersion: 'source-shared-delayed-events-native-v1';
  runs: { shared?: SourceHostResult; taskTree?: SourceHostResult };
};

const eventSpecs = [
  { run: 'shared', siteId: 'mona.bubble.on-enemy-damage', componentId: 'mona-burst-bubble', fact: 'mona.bubble.on-enemy-damage.attack-count', positive: 1 },
  { run: 'shared', siteId: 'charlotte.c6.enemy-damage', componentId: 'charlotte-c6', fact: 'charlotte.c6.enemy-damage.producer-count', positive: 1 },
  { run: 'shared', siteId: 'faruzan.c6.enemy-damage', componentId: 'faruzan-c6-collapse', fact: 'faruzan.c6.enemy-damage.producer-count', positive: 1 },
  { run: 'shared', siteId: 'beidou.burst.enemy-damage', componentId: 'beidou-burst-proc', fact: 'beidou.burst.attack-count', positive: 1 },
  { run: 'taskTree', siteId: 'chiori.c4.enemy-damage', componentId: 'chiori-c4-kinu', fact: 'chiori.c4.enemy-damage.producer-count', positive: 2 },
] as const;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function captureNative(page: Page, config: string, seed: string): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption('classic');
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill(seed);
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

test('shared delayed listeners and nested event task trees retain closed native hit evidence', async ({ page }) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-shared-delayed-events-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-shared-delayed-events-team-20260930.result.json';

  try {
    let archive: NativeArchive;
    if (process.env.GIDPS_REUSE_SHARED_DELAYED_EVENT_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as NativeArchive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-shared-delayed-events-native-v1', runs: {} };
      archive.runs.shared = await captureNative(page, teamOneConfig, '202609301');
      // Preserve every native result before running component acceptance assertions.
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      archive.runs.taskTree = await captureNative(page, teamTwoConfig, '202609302');
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      measurements.nativeRunsPerformed = true;
    }
    measurements.nativeResultArchived = true;
    measurements.rawPath = capturePath;
    const teamOne = archive.runs.shared!;
    const teamTwo = archive.runs.taskTree!;
    expect(teamOne.config).toBe(teamOneConfig);
    expect(teamTwo.config).toBe(teamTwoConfig);

    const diagnostics = (native: SourceHostResult, spec: (typeof eventSpecs)[number]) =>
      (native.eventListenerCalls ?? []).filter(call => call.siteId === spec.siteId).map(call => {
        const collection = captureSourceHostEventCollection(native, call.id);
        if (!collection) return { id: call.id, entryFacts: call.entryFacts, captureAvailable: false };
        const calculation = calculateSourceHostEventCollection(collection);
        return {
          id: call.id, entryFacts: call.entryFacts,
          directQueueCount: call.queuedAttacks.length,
          producerCount: native.eventProducers?.filter(row => row.listenerCallId === call.id).length ?? 0,
          captureAvailable: true, componentId: collection.componentId,
          deliveryClosed: calculation.analysis.deliveryClosed,
          hitCount: collection.hits.filter(hit => hit.included).length,
          reasons: calculation.analysis.reasons,
        };
      });
    const selectPositiveClosed = (native: SourceHostResult, spec: (typeof eventSpecs)[number]) => {
      for (const call of native.eventListenerCalls ?? []) {
        if (call.siteId !== spec.siteId || call.entryFacts?.[spec.fact] !== spec.positive) continue;
        const collection = captureSourceHostEventCollection(native, call.id);
        if (!collection) continue;
        const calculation = calculateSourceHostEventCollection(collection);
        if (calculation.analysis.deliveryClosed && collection.hits.some(hit => hit.included))
          return { call, collection, calculation };
      }
      return undefined;
    };

    const selected = eventSpecs.map(spec => ({
      spec,
      native: spec.run === 'shared' ? teamOne : teamTwo,
    })).map(row => ({ ...row, selected: selectPositiveClosed(row.native, row.spec) }));
    for (const item of selected) {
      expect(item.selected,
        `expected a positive, closed ${item.spec.componentId} call with an actual hit; candidates=${JSON.stringify(diagnostics(item.native, item.spec))}`)
        .toBeDefined();
      expect(item.selected!.collection.componentId).toBe(item.spec.componentId);
    }

    const directEvents: Record<string, unknown>[] = [];
    for (const item of selected) {
      const { spec, native, selected: chosen } = item;
      const { call, collection, calculation } = chosen!;
      const applications = collection.hits.filter(hit => hit.included)
        .map(hit => hit.calculation.originalCapture.application);
      expect(applications.length, `${spec.siteId} must include an actual captured hit`).toBeGreaterThan(0);
      for (const hit of collection.hits.filter(row => row.included))
        expect(replaySourceHostHit(hit.calculation.originalCapture).difference,
          `${spec.siteId} application #${hit.calculation.originalCapture.application.id} replay delta`).toBe(0);
      expect(calculation.total, `${spec.siteId} subtotal vs captured applied damage`)
        .toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
      directEvents.push({
        siteId: call.siteId, componentId: collection.componentId, listenerCallId: call.id,
        entryFacts: call.entryFacts, deliveryClosed: calculation.analysis.deliveryClosed,
        attackCount: calculation.analysis.attackCount, producerCount: calculation.analysis.producerCount,
        completedProducerCount: calculation.analysis.completedProducerCount,
        pendingProducerCount: calculation.analysis.pendingProducerCount,
        hitCount: applications.length, componentSubtotal: calculation.total,
        reasons: calculation.analysis.reasons,
      });
    }
    measurements.directEvents = directEvents;

    // Exercise one task-tree event in the origin UI, then export/import/edit that same collection.
    const treeCase = selected.find(item => item.spec.componentId === 'chiori-c4-kinu')!;
    const tree = treeCase.selected!;
    const treeDescriptor = getSourceHostEventComponentRule(tree.collection.componentId);
    await page.goto('/source-simulation');
    await page.locator('#source-host-import').setInputFiles({
      name: 'source-shared-delayed-events-native.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(teamTwo)),
    });
    await page.locator('[data-origin-event-page-size]').selectOption('50');
    await page.locator('[data-origin-event-component]').selectOption(tree.collection.componentId);
    const originButton = page.locator(`[data-origin-open-event="${tree.call.id}"]`);
    await expect(originButton).toBeVisible();
    const originRow = originButton.locator('xpath=../..');
    await expect(originRow).toContainText(treeDescriptor.label);
    await expect(originRow).toContainText(treeCase.spec.siteId);
    await originButton.click();
    const eventPanel = page.locator('[data-source-event-collection]');
    await expect(eventPanel).toContainText(treeDescriptor.label);
    await expect(page.locator('[data-source-event-delivery="closed"]')).toContainText('本次事件攻击已结算');
    const exported = await download(page, '[data-source-event-export]') as SourceHostEventCollection;
    expect(exported).toEqual(tree.collection);
    await page.locator('#calc-import').setInputFiles({
      name: 'source-shared-task-tree.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    await expect(page.locator('[data-source-event-delivery="closed"]')).toContainText('本次事件攻击已结算');
    const total = page.locator('[data-source-event-total]');
    const totalBeforeEdit = await total.innerText();
    const scaling = page.locator('[data-source-event-editor] [data-source-host-input="scaling"]').first();
    const scalingBefore = Number(await scaling.inputValue());
    await scaling.fill(String(scalingBefore + 0.01));
    await expect(page.locator('[data-source-event-editor] [data-source-host-calculation-result]'))
      .toContainText('编辑后原始公式伤害');
    await expect.poll(() => total.innerText()).not.toBe(totalBeforeEdit);
    measurements.taskTreeOriginExportImportAndEdit = {
      siteId: tree.call.siteId, componentId: tree.collection.componentId,
      listenerCallId: tree.call.id, label: treeDescriptor.label, closedBeforeAndAfter: true,
    };

    // Offline probes remove one native fact record each; no extra host run is issued.
    const probe = (native: SourceHostResult, callId: number) => {
      const collection = captureSourceHostEventCollection(native, callId);
      expect(collection).toBeDefined();
      return calculateSourceHostEventCollection(collection!).analysis;
    };
    const charlotteCase = selected.find(item => item.spec.componentId === 'charlotte-c6')!.selected!;
    const missingDelayedProducer = structuredClone(teamOne);
    missingDelayedProducer.eventProducers = (missingDelayedProducer.eventProducers ?? [])
      .filter(row => row.listenerCallId !== charlotteCase.call.id);
    const delayedGap = probe(missingDelayedProducer, charlotteCase.call.id);
    expect(delayedGap.deliveryClosed, `missing Charlotte C6 producer; reasons=${JSON.stringify(delayedGap.reasons)}`).toBe(false);

    const beidouCase = selected.find(item => item.spec.componentId === 'beidou-burst-proc')!.selected!;
    const missingCallbackReceipt = structuredClone(teamOne);
    delete missingCallbackReceipt.hitCallbacks;
    delete missingCallbackReceipt.hitCallbackBatches;
    const callbackGap = probe(missingCallbackReceipt, beidouCase.call.id);
    expect(callbackGap.deliveryClosed, `missing Beidou callback receipts; reasons=${JSON.stringify(callbackGap.reasons)}`).toBe(false);

    const missingTreeChild = structuredClone(teamTwo);
    const childProducer = missingTreeChild.eventProducers?.find(row => row.listenerCallId === tree.call.id
      && row.parentProducerId !== undefined);
    expect(childProducer, `Chiori selected call needs a nested producer to remove; candidates=${JSON.stringify(
      teamTwo.eventProducers?.filter(row => row.listenerCallId === tree.call.id))}`).toBeDefined();
    missingTreeChild.eventProducers = (missingTreeChild.eventProducers ?? []).filter(row => row.id !== childProducer!.id);
    const treeGap = probe(missingTreeChild, tree.call.id);
    expect(treeGap.deliveryClosed, `missing Chiori task-tree child; reasons=${JSON.stringify(treeGap.reasons)}`).toBe(false);
    measurements.offlineGapProbes = {
      additionalNativeRuns: 0,
      missingDelayedProducer: { siteId: charlotteCase.call.siteId, listenerCallId: charlotteCase.call.id, reasons: delayedGap.reasons },
      missingBeidouCallbackEvidence: { siteId: beidouCase.call.siteId, listenerCallId: beidouCase.call.id, reasons: callbackGap.reasons },
      missingChioriTaskTreeChild: { siteId: tree.call.siteId, listenerCallId: tree.call.id, producerId: childProducer!.id, reasons: treeGap.reasons },
    };

    // Preserve one previously accepted 113 direct-event component from its full native capture.
    const prior113 = JSON.parse(await readFile('docs/validation/source-direct-events-team-20260930.capture.json', 'utf8')) as SourceHostResult;
    const priorCall = (prior113.eventListenerCalls ?? []).find(call => call.siteId === 'albedo.skill.enemy-damage'
      && call.entryFacts?.['albedo.skill.enemy-damage.attack-count'] === 1);
    expect(priorCall, '113 archived positive Albedo call should remain available').toBeDefined();
    const priorCollection = captureSourceHostEventCollection(prior113, priorCall!.id);
    expect(priorCollection).toBeDefined();
    const priorCalculation = calculateSourceHostEventCollection(priorCollection!);
    expect(priorCalculation.analysis.deliveryClosed,
      `113 Albedo regression call #${priorCall!.id}: ${JSON.stringify(priorCalculation.analysis.reasons)}`).toBe(true);
    const priorIncluded = priorCollection!.hits.filter(hit => hit.included);
    for (const hit of priorIncluded) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
    expect(priorCalculation.total).toBeCloseTo(priorIncluded.reduce((sum, hit) =>
      sum + hit.calculation.originalCapture.application.appliedDamage, 0), 8);
    measurements.offline113Regression = {
      siteId: priorCall!.siteId, componentId: priorCollection!.componentId, listenerCallId: priorCall!.id,
      deliveryClosed: priorCalculation.analysis.deliveryClosed, hitCount: priorIncluded.length,
      replayDifferences: priorIncluded.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference),
      componentSubtotal: priorCalculation.total, reasons: priorCalculation.analysis.reasons,
      rawPath: 'docs/validation/source-direct-events-team-20260930.capture.json',
    };
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(resultPath, JSON.stringify({
      schemaVersion: 'source-shared-delayed-events-browser-v1', measurements, pageErrors,
      scope: 'Two classic native captures cover positive Mona bubble, Charlotte C6, Faruzan C6, Beidou C2 callback-chain, and Chiori C4 Kinu task-tree event components. Only Chiori is opened and edited in the UI. Offline probes remove evidence from archived results; one 113 Albedo capture is recalculated as the prior-kind regression. These samples do not establish full skill, burst, task lifecycle beyond selected closures, or current-game verification.',
    }, null, 2) + '\n');
  }
});
