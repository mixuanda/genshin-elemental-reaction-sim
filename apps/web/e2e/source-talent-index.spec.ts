import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit,
  createSourceHostEditableCalculation, replaySourceHostHit,
  type SourceHostEditableCalculation,
} from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostCalculationRecord, SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

// The exact 096 table-read scenario; 097 only adds the native index-source leaves.
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

function withoutIndexSources(records: SourceHostCalculationRecord[]): unknown {
  return records.map(record => {
    const copy = structuredClone(record);
    if (copy.request.kind === 'damage' && copy.request.talentTableRead)
      delete copy.request.talentTableRead.indexSources;
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

test('both native lanes expose actual talent-index sources without changing table reads or damage', async ({ page }) => {
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
      const rawPath = `/tmp/gidps-talent-index-${lane}.json`;
      await writeFile(rawPath, JSON.stringify(result)); // Preserve the complete Go result before any assertion.
      const baselinePath = `docs/validation/talent-table-${lane}-20260929.capture.json`;
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      expect(result.sourceCommit).toBe(baseline.sourceCommit);
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(withoutIndexSources(result.calculations), `${lane}: only talent index-source leaves changed`).toEqual(withoutIndexSources(baseline.calculations));
      for (const field of ['applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(result[field], `${lane}: ${field} unchanged`).toEqual(baseline[field]);
      expect(sortedGameplay(result.result), `${lane}: native gameplay unchanged`).toEqual(sortedGameplay(baseline.result));

      const byId = new Map(result.calculations.map(row => [row.request.id, row]));
      const lookupRecords = result.calculations.flatMap(row => {
        if (row.request.kind !== 'damage' || !row.request.talentTableRead) return [];
        return [{ request: row.request, read: row.request.talentTableRead }];
      });
      const receiptHits = result.applications.flatMap((application, index) => {
        const record = byId.get(application.calculationId);
        if (!record || record.request.kind !== 'damage' || !record.request.talentTableRead) return [];
        return [{ application, index, request: record.request, read: record.request.talentTableRead }];
      });
      expect(receiptHits.length, `${lane}: applied native damage with indexed talent reads`).toBeGreaterThan(0);
      const sourceKinds = new Set<string>();
      for (const row of lookupRecords) {
        expect(row.read.actorIndex).toBe(row.request.actorIndex);
        expect(row.read.frame).toBeLessThanOrEqual(row.request.frame);
        expect(row.read.indices.length).toBeGreaterThan(0);
        expect(row.read.indexSources, `${lane}: each lookup has its actual index-source leaves`).toHaveLength(row.read.indices.length);
        const positions = new Set<number>();
        for (const source of row.read.indexSources!) {
          expect(positions.has(source.position), `${lane}: duplicate index source position`).toBe(false);
          positions.add(source.position);
          expect(source.value).toBe(row.read.indices[source.position]);
          expect(Number.isInteger(source.baseTalent)).toBe(true);
          expect(Number.isInteger(source.constellation)).toBe(true);
          expect(Number.isInteger(source.constellationUnlock)).toBe(true);
          expect(source.constellationUnlock).toBeGreaterThanOrEqual(-1);
          if (source.kind === 'burst') expect(source.passiveTagValue).toBeUndefined();
          else expect(Number.isInteger(source.passiveTagValue)).toBe(true);
          sourceKinds.add(source.kind);
        }
      }
      expect([...sourceKinds]).toEqual(expect.arrayContaining(['burst', 'skill']));
      const selected = receiptHits.find(row => row.application.rawDamage > 0
        && row.read.indexSources?.length === row.read.indices.length
        && row.read.value === row.request.input.scaling && row.request.multiplierCalculationId === undefined);
      expect(selected, `${lane}: applied hit with direct native table scaling`).toBeDefined();
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
      const selectedSource = chosen.read.indexSources![0]!;
      const indexId = `${lookupId}.index${selectedSource.position}.nativeIndex`;
      const indexNode = replay.trace.find(node => node.id === indexId);
      expect(indexNode?.result?.value).toBe(selectedSource.value);
      expect(indexNode?.childIds).toEqual([
        `${lookupId}.index${selectedSource.position}.baseTalent`,
        `${lookupId}.index${selectedSource.position}.cappedOffset`,
      ]);
      const baseTalentNode = replay.trace.find(node => node.id === `${lookupId}.index${selectedSource.position}.baseTalent`);
      const constellationNode = replay.trace.find(node => node.id === `${lookupId}.index${selectedSource.position}.constellationBonus`);
      expect(baseTalentNode?.inputs.find(input => input.key === 'baseTalent')?.value).toBe(selectedSource.baseTalent);
      expect(constellationNode?.inputs.find(input => input.key === 'constellation')?.value).toBe(selectedSource.constellation);
      expect(constellationNode?.inputs.find(input => input.key === 'constellationUnlock')?.value).toBe(selectedSource.constellationUnlock);
      if (selectedSource.kind !== 'burst') {
        const passiveNode = replay.trace.find(node => node.id === `${lookupId}.index${selectedSource.position}.passiveBonus`);
        expect(passiveNode?.inputs.find(input => input.key === 'passiveTagValue')?.value).toBe(selectedSource.passiveTagValue);
      }
      const lookupIndex = lookupNode?.inputs.find(input => input.key === `index${selectedSource.position}`);
      expect(lookupIndex?.value).toBe(selectedSource.value);
      expect(lookupIndex?.origin).toEqual({ kind: 'source-host-talent-index', reference: indexId });
      expect(lookupNode?.childIds).toContain(indexId);
      const talentBase = replay.trace.find(node => node.id === 'sourceTalentBase');
      const scalingInput = talentBase?.inputs.find(input => input.key === 'scaling');
      expect(scalingInput?.value).toBe(chosen.read.value);
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
      await expect(lookup).toContainText('选中表值');
      await lookup.locator('.trace-lookup-row > summary').click();
      const selectedRow = lookup.locator(`[data-trace-lookup-selected="${chosen.read.indices.at(-1)}"]`);
      await expect(selectedRow).toBeVisible();
      await expect(selectedRow).toContainText(chosen.read.value.toLocaleString('zh-CN', { maximumFractionDigits: 6 }));
      const indexDetail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${indexId}"]`);
      await indexDetail.locator(':scope > summary').click();
      await expect(indexDetail.locator('.trace-substitution')).toBeVisible();
      await expect(indexDetail).toContainText('符号公式');
      await expect(indexDetail).toContainText('原 getter 返回');
      await expect(indexDetail).toContainText(String(selectedSource.value));
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
      await page.locator('#calc-import').setInputFiles({ name: `talent-index-${lane}.json`,
        mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('[data-source-host-input="scaling"]')).toHaveValue(String(chosen.read.value + 0.1));
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(differenceText);
      expect(await download(page, '[data-source-host-export]')).toEqual(saved);

      measurements.push({ lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
        receiptHitCount: receiptHits.length, distinctTableCount: new Set(lookupRecords.map(row => row.read.tableId)).size,
        distinctSiteCount: new Set(lookupRecords.map(row => row.read.siteId)).size,
        indexSourceKinds: [...sourceKinds], indexSources: lookupRecords.map(row => ({ calculationId: row.request.id,
          siteId: row.read.siteId, values: row.read.indexSources })),
        selectedApplicationId: chosen.application.id, selectedCalculationId: chosen.request.id,
        selectedActorKey: chosen.request.actorKey, selectedFrame: chosen.request.frame,
        tableId: chosen.read.tableId, siteId: chosen.read.siteId, indices: chosen.read.indices,
        tableValue: chosen.read.value, originalScaling: chosen.request.input.scaling,
        lookupFormula: lookupNode?.symbolicFormula, lookupSubstitution: lookupNode?.substitution,
        lookupNodeId: lookupId, indexNodeId: indexId, indexFormula: indexNode?.symbolicFormula,
        indexSubstitution: indexNode?.substitution, replayDifference: replay.difference,
        editedScaling: saved.request.input.scaling, editedDamageDifference: counterfactual.difference,
        nativeGameplayUnchanged: true, originalReceiptPreserved: true, calculatorRoundtrip: true });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/talent-index-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-talent-index-browser-v1', seed: '11', script, measurements, pageErrors,
      scope: 'One native XQ/Fischl run per pinned source; real talent-index source leaves, preserved lookup and independent scaling edit.',
    }, null, 2) + '\n');
  }
});
