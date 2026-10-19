import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit,
  createSourceHostEditableCalculation, replaySourceHostHit,
  type SourceHostEditableCalculation,
} from '../../../packages/sim-core/src/source-host-capture';
import { sourceHostTalentRegistry } from '../../../packages/sim-core/src/source-host-talent-tables.generated';
import type { SourceHostCalculationRecord, SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

// The exact 097 run; 098 adds its previously unrecorded XQ normal-attack range lookup.
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

function withoutNewTalentReads(current: SourceHostCalculationRecord[], baseline: SourceHostCalculationRecord[]): unknown {
  const oldById = new Map(baseline.map(record => [record.request.id, record]));
  return current.map(record => {
    const copy = structuredClone(record);
    const old = oldById.get(record.request.id);
    if (copy.request.kind === 'damage' && old?.request.kind === 'damage' && !old.request.talentTableRead)
      delete copy.request.talentTableRead;
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

test('both native lanes replay the new three-dimensional range lookup without changing earlier reads or damage', async ({ page }) => {
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
      const rawPath = `/tmp/gidps-talent-range-${lane}.json`;
      await writeFile(rawPath, JSON.stringify(result)); // Preserve the complete Go result before any assertion.
      const baselinePath = `docs/validation/talent-index-${lane}-20260929.capture.json`;
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      expect(result.sourceCommit).toBe(baseline.sourceCommit);
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(withoutNewTalentReads(result.calculations, baseline.calculations),
        `${lane}: old talent reads and all other calculation fields unchanged`).toEqual(baseline.calculations);
      for (const field of ['applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(result[field], `${lane}: ${field} unchanged`).toEqual(baseline[field]);
      expect(sortedGameplay(result.result), `${lane}: native gameplay unchanged`).toEqual(sortedGameplay(baseline.result));

      const oldById = new Map(baseline.calculations.map(record => [record.request.id, record]));
      const fresh = result.calculations.flatMap(record => {
        if (record.request.kind !== 'damage' || !record.request.talentTableRead) return [];
        const old = oldById.get(record.request.id);
        return old?.request.kind === 'damage' && old.request.talentTableRead ? []
          : [{ request: record.request, read: record.request.talentTableRead }];
      });
      expect(fresh.length, `${lane}: newly recorded native range lookups`).toBeGreaterThan(0);
      const registry = sourceHostTalentRegistry[result.sourceCommit];
      expect(registry).toBeDefined();
      for (const row of fresh) {
        const site = registry!.sites[row.read.siteId];
        expect(site?.tableId).toBe(row.read.tableId);
        expect(site?.indexExpressions).toHaveLength(3);
        expect(site?.rangeSource?.indexPosition).toBe(1);
        expect(site?.rangeSource?.expression).toContain('NormalCounter');
        expect(registry!.tables[row.read.tableId]?.values.length).toBeGreaterThan(0);
        expect(row.read.indices).toHaveLength(3);
        expect(row.read.actorIndex).toBe(row.request.actorIndex);
        expect(row.read.rangeFrame).toBeLessThanOrEqual(row.read.frame);
        expect(row.read.frame).toBeLessThanOrEqual(row.request.frame);
        expect(row.read.indexSources).toHaveLength(1);
        expect(row.read.indexSources?.[0]?.position).toBe(2);
        expect(row.read.indexSources?.[0]?.value).toBe(row.read.indices[2]);
      }
      const byId = new Map(result.calculations.map(record => [record.request.id, record]));
      const selected = result.applications.flatMap((application, index) => {
        const record = byId.get(application.calculationId);
        if (!record || record.request.kind !== 'damage' || !record.request.talentTableRead) return [];
        const old = oldById.get(record.request.id);
        if (old?.request.kind === 'damage' && old.request.talentTableRead) return [];
        return [{ application, index, request: record.request, read: record.request.talentTableRead }];
      }).find(row => row.application.rawDamage > 0 && row.read.indices.length === 3
        && row.read.value === row.request.input.scaling && row.request.multiplierCalculationId === undefined);
      expect(selected, `${lane}: applied three-dimensional lookup used directly as scaling`).toBeDefined();
      const chosen = selected!;
      const capture = captureSourceHostHit(result, chosen.application.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedRawDamage).toBe(chosen.application.rawDamage);
      const lookupId = `sourceTalentTable.${chosen.request.id}`;
      const lookupNode = replay.trace.find(node => node.id === lookupId);
      expect(lookupNode?.expression.kind).toBe('lookup');
      expect(lookupNode?.result?.value).toBe(chosen.read.value);
      expect(lookupNode?.sourceRefs.some(ref => ref.includes(result.sourceCommit))).toBe(true);
      const chosenSite = registry!.sites[chosen.read.siteId]!;
      const rangeIndexId = `${lookupId}.rangeIndex`;
      const rangeIndex = replay.trace.find(node => node.id === rangeIndexId);
      expect(rangeIndex?.result?.value).toBe(chosen.read.indices[chosenSite.rangeSource!.indexPosition]);
      expect(rangeIndex?.inputs.find(input => input.key === 'iterationIndex')?.context).toEqual({
        actorIndex: chosen.read.actorIndex, rangeExpression: chosenSite.rangeSource!.expression,
        rangeExpressionFrame: chosen.read.rangeFrame, coefficientReadFrame: chosen.read.frame,
      });
      expect(rangeIndex?.sourceRefs.some(ref => ref.includes(result.sourceCommit)
        && ref.includes(chosenSite.rangeSource!.path))).toBe(true);
      for (let position = 0; position < 3; position++) {
        const input = lookupNode?.inputs.find(value => value.key === `index${position}`);
        expect(input?.value).toBe(chosen.read.indices[position]);
        expect(input?.context?.sourceExpression).toBe(chosenSite.indexExpressions[position]);
        if (position <= chosenSite.rangeSource!.indexPosition) {
          expect(input?.context?.rangeExpressionFrame).toBe(chosen.read.rangeFrame);
          expect(input?.context?.coefficientReadFrame).toBe(chosen.read.frame);
        } else expect(input?.context?.readFrame).toBe(chosen.read.frame);
        const reference = input?.origin && typeof input.origin === 'object' ? input.origin.reference : undefined;
        if (reference) {
          expect(lookupNode?.childIds).toContain(reference);
          expect(replay.trace.find(node => node.id === reference)?.result?.value)
            .toBe(chosen.read.indices[position]);
        }
      }
      expect(lookupNode?.inputs.find(input => input.key === 'index1')?.origin)
        .toEqual({ kind: 'source-host-range-index', reference: rangeIndexId });
      const talentIndexId = `${lookupId}.index2.nativeIndex`;
      expect(lookupNode?.inputs.find(input => input.key === 'index2')?.origin)
        .toEqual({ kind: 'source-host-talent-index', reference: talentIndexId });
      const scalingInput = replay.trace.find(node => node.id === 'sourceTalentBase')?.inputs.find(input => input.key === 'scaling');
      expect(scalingInput?.origin).toEqual({ kind: 'source-host-talent-table', reference: lookupId });
      const traceIds = new Set(replay.trace.map(node => node.id));
      for (const node of replay.trace)
        for (const childId of node.childIds)
          expect(traceIds.has(childId), `${lane}: ${node.id} references missing child ${childId}`).toBe(true);

      const edited = structuredClone(createSourceHostEditableCalculation(capture));
      if (edited.request.kind !== 'damage') throw new Error('Selected hit is not ordinary damage');
      edited.request.input.scaling += 0.1;
      const counterfactual = calculateSourceHostEditableCalculation(edited);
      expect(counterfactual.edited).toBe(true);
      expect(counterfactual.difference).not.toBe(0);
      expect(edited.originalCapture).toEqual(capture);
      const editedScaling = counterfactual.trace.find(node => node.id === 'sourceTalentBase')?.inputs.find(input => input.key === 'scaling');
      expect(editedScaling?.value).toBe(chosen.read.value + 0.1);
      expect(editedScaling?.origin).not.toEqual({ kind: 'source-host-talent-table', reference: lookupId });
      expect(counterfactual.trace.find(node => node.id === lookupId)?.result?.value).toBe(chosen.read.value);

      await page.locator('#source-host-hit-index').fill(String(chosen.index));
      await expect(page.locator('#source-host-hit')).toContainText('差值 0');
      await page.locator('#source-host-open-calculator').click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator('#calc-source-host-capture')).toContainText('差值 0');
      const detail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${lookupId}"]`);
      await detail.locator(':scope > summary').click();
      const lookup = detail.locator(`[data-trace-lookup="${lookupId}"]`);
      await expect(lookup).toBeVisible();
      await expect(lookup).toContainText('1 层');
      await expect(lookup).toContainText('2 层');
      await expect(lookup).toContainText('3 层');
      const rangeDetail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${rangeIndexId}"]`);
      await rangeDetail.locator(':scope > summary').click();
      await expect(rangeDetail).toContainText('本次循环选中的天赋表行');
      await expect(rangeDetail).toContainText(chosenSite.rangeSource!.expression);
      await expect(rangeDetail).toContainText(String(chosen.read.rangeFrame));
      await lookup.locator('.trace-lookup-row > summary').click();
      const selectedRow = lookup.locator(`[data-trace-lookup-selected="${chosen.read.indices[2]}"]`);
      await expect(selectedRow).toBeVisible();
      await expect(selectedRow).toContainText(chosen.read.value.toLocaleString('zh-CN', { maximumFractionDigits: 6 }));
      const scalingControl = page.locator('[data-source-host-input="scaling"]');
      await expect(scalingControl).toHaveValue(String(chosen.read.value));
      await scalingControl.fill(String(chosen.read.value + 0.1));
      const differenceText = `相对原公式差值：${counterfactual.difference}`;
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(differenceText);
      const saved = await download(page, '[data-source-host-export]') as SourceHostEditableCalculation;
      expect(saved.originalCapture).toEqual(capture);
      if (saved.request.kind !== 'damage') throw new Error('Exported hit changed request kind');
      if (saved.originalCapture.calculation.request.kind !== 'damage') throw new Error('Captured hit changed request kind');
      expect(saved.request.input.scaling).toBe(chosen.read.value + 0.1);
      expect(saved.request.talentTableRead).toEqual(chosen.read);
      expect(saved.originalCapture.calculation.request.talentTableRead).toEqual(chosen.read);
      expect(calculateSourceHostEditableCalculation(saved).difference).toBe(counterfactual.difference);
      await page.locator('#calc-import').setInputFiles({ name: `talent-range-${lane}.json`,
        mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('[data-source-host-input="scaling"]')).toHaveValue(String(chosen.read.value + 0.1));
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(differenceText);
      expect(await download(page, '[data-source-host-export]')).toEqual(saved);

      measurements.push({ lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
        newRangeReadCount: fresh.length, newRangeSites: [...new Set(fresh.map(row => row.read.siteId))],
        selectedApplicationId: chosen.application.id, selectedCalculationId: chosen.request.id,
        selectedActorKey: chosen.request.actorKey, selectedFrame: chosen.request.frame,
        tableId: chosen.read.tableId, siteId: chosen.read.siteId, indices: chosen.read.indices,
        rangeFrame: chosen.read.rangeFrame, coefficientReadFrame: chosen.read.frame,
        rangeSource: chosenSite.rangeSource, rangeIndexId, rangeIndexFormula: rangeIndex?.symbolicFormula,
        rangeIndexSubstitution: rangeIndex?.substitution,
        tableValue: chosen.read.value, originalScaling: chosen.request.input.scaling,
        lookupFormula: lookupNode?.symbolicFormula, lookupSubstitution: lookupNode?.substitution,
        lookupNodeId: lookupId, replayDifference: replay.difference,
        editedScaling: saved.request.input.scaling, editedDamageDifference: counterfactual.difference,
        nativeGameplayUnchanged: true, oldTableReadsPreserved: true, calculatorRoundtrip: true });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/talent-range-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-talent-range-browser-v1', seed: '11', script, measurements, pageErrors,
      scope: 'One native XQ/Fischl run per pinned source; actual three-dimensional range lookup and independent scaling edit.',
    }, null, 2) + '\n');
  }
});
