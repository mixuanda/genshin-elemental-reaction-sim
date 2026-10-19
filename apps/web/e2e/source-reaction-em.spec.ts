import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit,
  createSourceHostEditableCalculation, replaySourceHostHit,
  type SourceHostEditableCalculation,
} from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostStatReadReceipt } from '../../../packages/sim-core/src/source-host-stat-provenance';
import type { SourceHostCalculationRecord, SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

// Exact seed, script and two pinned lanes from the immutable 094 action-opportunity captures.
const script = `options iteration=1 duration=12;
xingqiu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xingqiu add weapon="favoniussword" refine=1 lvl=90/90;
xingqiu add stats atk=200 er=0.2 cr=0.2 cd=0.4;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active xingqiu;
xingqiu burst;
xingqiu skill;
fischl skill;
xingqiu attack:3;
wait(300);
`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function withoutReactionGetter(records: SourceHostCalculationRecord[]): unknown {
  return records.map(record => {
    const copy = structuredClone(record) as { request: Record<string, unknown>; value: number };
    // 095 adds this field only to the original live EM read on these producers.
    // Do not erase any existing statRead, provenance or other gameplay metadata.
    if (copy.request.kind === 'transformative-base' || copy.request.kind === 'additive-base')
      delete copy.request.statRead;
    return copy;
  });
}

function sortedGameplay(value: SourceHostResult['result']): SourceHostResult['result'] {
  const result = structuredClone(value) as SourceHostResult['result'] & {
    enemies: { reaction_status: { start: number; end: number; type: string }[] }[];
  };
  for (const enemy of result.enemies)
    enemy.reaction_status.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return result;
}

function reactionRead(record: SourceHostCalculationRecord): SourceHostStatReadReceipt | undefined {
  if (record.request.kind !== 'transformative-base' && record.request.kind !== 'additive-base') return undefined;
  return (record.request as typeof record.request & { statRead?: SourceHostStatReadReceipt }).statRead;
}

test('both pinned native lanes link actual EC producers to their one live EM getter and restore the hit', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    for (const lane of ['classic', 'stellar'] as const) {
      await page.goto('/source-simulation');
      await page.locator('#source-host-variant').selectOption(lane);
      await page.locator('#source-host-config').fill(script);
      await page.locator('#source-host-seed').fill('11');
      await page.locator('#source-host-phase-enabled').uncheck();
      await page.locator('#source-host-run').click();
      await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
      const result = await download(page, '#source-host-export') as SourceHostResult;
      const rawPath = `/tmp/gidps-reaction-em-${lane}.json`;
      await writeFile(rawPath, JSON.stringify(result)); // Keep the complete native result before coverage assertions.
      const baselinePath = `docs/validation/action-opportunities-${lane}-xingqiu-20260929.capture.json`;
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      expect(result.sourceCommit).toBe(baseline.sourceCommit);
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(withoutReactionGetter(result.calculations), `${lane}: only producer EM getter is new`).toEqual(withoutReactionGetter(baseline.calculations));
      for (const field of ['applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(result[field], `${lane}: ${field} unchanged`).toEqual(baseline[field]);
      expect(sortedGameplay(result.result), `${lane}: gameplay unchanged`).toEqual(sortedGameplay(baseline.result));

      const byId = new Map(result.calculations.map(row => [row.request.id, row]));
      const producers = result.calculations.filter(row => row.request.kind === 'transformative-base' || row.request.kind === 'additive-base');
      expect(producers.length, `${lane}: actual EC base producers`).toBeGreaterThanOrEqual(7);
      for (const row of producers) {
        if (row.request.kind !== 'transformative-base' && row.request.kind !== 'additive-base') throw new Error('Not a reaction producer');
        const read = reactionRead(row);
        expect(read, `${lane}: producer #${row.request.id} has one native EM read`).toBeDefined();
        expect(read!.kind).toBe('stat');
        expect(read!.selector).toEqual([8]);
        expect(read!.actorIndex).toBe(row.request.actorIndex);
        expect(read!.frame).toBe(row.request.frame);
        expect(read!.result[8]).toBe(row.request.input.elementalMastery);
        expect(read!.basePanel?.actorIndex).toBe(row.request.actorIndex);
        expect(read!.basePanel?.result).toHaveLength(26);
      }

      const ecTicks = result.applications.flatMap((application, index) => {
        const record = byId.get(application.calculationId);
        return record?.request.kind === 'damage' && record.request.damageCategory === 'transformative'
          ? [{ application, index, request: record.request }] : [];
      });
      expect(ecTicks).toHaveLength(8);
      const usage = new Map<number, number>();
      for (const tick of ecTicks) {
        expect(tick.request.componentIds).toHaveLength(1);
        const producerId = tick.request.componentIds[0]!;
        expect(reactionRead(byId.get(producerId)!), `${lane}: EC tick reuses a real producer`).toBeDefined();
        expect('statRead' in tick.request, `${lane}: EC hit makes no extra reaction EM getter`).toBe(false);
        usage.set(producerId, (usage.get(producerId) ?? 0) + 1);
      }
      expect(usage.size, `${lane}: seven actual EC producer identities`).toBe(7);
      const repeatedProducerId = [...usage].find(([, count]) => count > 1)?.[0];
      expect(repeatedProducerId, `${lane}: a queued EC producer serves two ticks`).toBeDefined();
      const selected = ecTicks.find(row => row.request.componentIds.includes(repeatedProducerId!))!;
      const capture = captureSourceHostHit(result, selected.application.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedRawDamage).toBe(selected.application.rawDamage);
      const producer = byId.get(repeatedProducerId!)!;
      const read = reactionRead(producer)!;
      const emNodeId = `component.${repeatedProducerId}.transformativeEmBonus`;
      const emNode = replay.trace.find(node => node.id === emNodeId);
      expect(emNode, `${lane}: actual EC formula stage`).toBeDefined();
      const emInput = emNode!.inputs.find(input => input.key === 'elementalMastery');
      expect(emInput?.value).toBe(read.result[8]);
      expect(typeof emInput?.origin).toBe('object');
      const reference = typeof emInput?.origin === 'object' ? emInput.origin.reference : undefined;
      expect(reference).toContain(`sourceStats.reaction.${repeatedProducerId}.`);
      const sourceNode = replay.trace.find(node => node.id === reference);
      expect(sourceNode?.result?.value).toBe(read.result[8]);
      expect(sourceNode?.sourceRefs.length).toBeGreaterThan(0);

      // Keep an independent core calculation as the expected UI value; editing
      // the producer must not rewrite its historical getter receipt.
      const editable = createSourceHostEditableCalculation(capture);
      const edited = structuredClone(editable);
      const editedProducer = edited.components.find(row => row.request.id === repeatedProducerId);
      if (!editedProducer || editedProducer.request.kind !== 'transformative-base') throw new Error('Selected EC component is missing');
      editedProducer.request.input.elementalMastery += 10;
      const counterfactual = calculateSourceHostEditableCalculation(edited);
      expect(counterfactual.edited).toBe(true);
      expect(counterfactual.difference).not.toBe(0);
      expect(edited.originalCapture).toEqual(capture);
      const editedEm = counterfactual.trace.find(node => node.id === emNodeId)?.inputs.find(input => input.key === 'elementalMastery');
      expect(editedEm?.value).toBe(read.result[8]! + 10);
      const editedOrigin = editedEm?.origin;
      expect(typeof editedOrigin === 'object' && editedOrigin.reference === reference).toBe(false);

      await page.locator('#source-host-hit-index').fill(String(selected.index));
      await expect(page.locator('#source-host-hit')).toContainText('差值 0');
      await page.locator('#source-host-open-calculator').click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator('#calc-source-host-capture')).toContainText('差值 0');
      const formulaRow = page.locator(`[data-source-host-calculation-result] [data-trace-node="${emNodeId}"]`);
      await expect(formulaRow).toBeVisible();
      const detail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${emNodeId}"]`);
      await detail.locator(':scope > summary').click();
      await expect(detail.locator('.trace-substitution')).toBeVisible();
      await expect(detail).toContainText('实际代入与中间结果');
      const componentCard = page.locator('fieldset[data-source-host-classic-reaction-kind="transformative-base"]')
        .filter({ has: page.locator(`[data-source-host-component="${repeatedProducerId}"]`) });
      await expect(componentCard).toBeVisible();
      const emControl = componentCard.locator(`[data-source-host-component="${repeatedProducerId}"][data-source-host-component-field="elementalMastery"]`);
      await expect(emControl).toHaveValue(String(read.result[8]));
      await emControl.fill(String(read.result[8]! + 10));
      const resultText = `相对原公式差值：${counterfactual.difference}`;
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(resultText);
      const saved = await download(page, '[data-source-host-export]') as SourceHostEditableCalculation;
      expect(saved.originalCapture).toEqual(capture);
      const savedProducer = saved.components.find(row => row.request.id === repeatedProducerId);
      if (!savedProducer || savedProducer.request.kind !== 'transformative-base') throw new Error('Export omitted edited EC producer');
      expect(savedProducer.request.input.elementalMastery).toBe(read.result[8]! + 10);
      expect(reactionRead(savedProducer)).toEqual(read);
      expect(reactionRead(saved.originalCapture.components.find(row => row.request.id === repeatedProducerId)!)).toEqual(read);
      expect(calculateSourceHostEditableCalculation(saved).difference).toBe(counterfactual.difference);
      await page.locator('#calc-import').setInputFiles({ name: `reaction-em-${lane}.json`,
        mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('#calc-source-host-capture')).toContainText('差值 0');
      await expect(page.locator('fieldset[data-source-host-classic-reaction-kind="transformative-base"]')
        .filter({ has: page.locator(`[data-source-host-component="${repeatedProducerId}"]`) })
        .locator('[data-source-host-component-field="elementalMastery"]')).toHaveValue(String(read.result[8]! + 10));
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(resultText);
      expect(await download(page, '[data-source-host-export]')).toEqual(saved);

      measurements.push({ lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
        producerCount: producers.length, producerIds: producers.map(row => row.request.id),
        actualEcTicks: ecTicks.length, consumedProducerIds: [...usage.keys()], repeatedProducerId,
        selectedApplicationId: selected.application.id, selectedProducerId: repeatedProducerId,
        statRead: { id: read.id, kind: read.kind, selector: read.selector, actorIndex: read.actorIndex,
          frame: read.frame, em: read.result[8], hasBasePanel: Boolean(read.basePanel) },
        emFormulaNode: emNodeId, emOriginReference: reference, emSourceValue: sourceNode?.result?.value,
        replayDifference: replay.difference, counterfactualEm: editedEm?.value,
        counterfactualDamageDifference: counterfactual.difference, uiDamageDifference: resultText,
        importedDamageDifference: calculateSourceHostEditableCalculation(saved).difference,
        originalStatReadPreserved: true,
        gameplayUnchanged: true, calculatorRoundtrip: true });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/reaction-em-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-reaction-em-browser-v1', seed: '11', script, measurements, pageErrors,
      scope: 'One actual XQ/Fischl continuous run per pinned source; native EC producer reads and replay only.',
    }, null, 2) + '\n');
  }
});
