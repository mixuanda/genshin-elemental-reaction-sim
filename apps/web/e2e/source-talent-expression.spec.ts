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

const captureBaseline = process.env.GIDPS_CAPTURE_BASELINE === '1';

// One Wanderer C0 E window: the charged hit uses two talent tables and the
// Windfavored normal hit uses a range-selected table as its second leaf.
const script = `options iteration=1 duration=12;
wanderer char lvl=90/90 cons=0 talent=1,1,1;
wanderer add weapon="magicguide" refine=1 lvl=90/90;
wanderer add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active wanderer;
wanderer skill;
wanderer charge;
wanderer attack:2;
wait(120);
`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function withoutExpressionReads(records: SourceHostCalculationRecord[]): unknown {
  return records.map(record => {
    const copy = structuredClone(record);
    if (copy.request.kind === 'damage') delete copy.request.talentExpressionRead;
    return copy;
  });
}

function damageAbilities(result: SourceHostResult): string[] {
  const applied = new Set(result.applications.map(application => application.calculationId));
  return result.calculations.flatMap(record => record.request.kind === 'damage' && applied.has(record.request.id)
    ? [record.request.ability] : []);
}

function sortedGameplay(value: SourceHostResult['result']): SourceHostResult['result'] {
  const result = structuredClone(value) as SourceHostResult['result'] & {
    enemies: { reaction_status: { start: number; end: number; type: string }[] | null }[];
  };
  for (const enemy of result.enemies)
    enemy.reaction_status?.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return result;
}

test('both native lanes replay compound talent-table expressions without changing native damage', async ({ page }) => {
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
      const rawPath = `/tmp/gidps-talent-expression-${lane}.json`;
      await writeFile(rawPath, JSON.stringify(result)); // Preserve the complete Go result before any assertion.
      const baselinePath = `docs/validation/talent-expression-baseline-${lane}-20260929.capture.json`;
      if (captureBaseline) {
        await writeFile(baselinePath, JSON.stringify(result));
        const abilities = damageAbilities(result);
        measurements.push({ lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
          calculationCount: result.calculations.length, applicationCount: result.applications.length,
          windfavoredCharge: abilities.some(ability => ability.includes('Charge Attack (Windfavored)')),
          windfavoredNormal: abilities.some(ability => ability.includes('Normal') && ability.includes('(Windfavored)')) });
        expect(abilities).toContain('Charge Attack (Windfavored)');
        expect(abilities.some(ability => ability.includes('Normal') && ability.includes('(Windfavored)'))).toBe(true);
        continue;
      }
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      expect(result.sourceCommit).toBe(baseline.sourceCommit);
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(withoutExpressionReads(result.calculations),
        `${lane}: only compound expression receipts changed`).toEqual(baseline.calculations);
      for (const field of ['applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(result[field], `${lane}: ${field} unchanged`).toEqual(baseline[field]);
      expect(sortedGameplay(result.result), `${lane}: native gameplay unchanged`).toEqual(sortedGameplay(baseline.result));

      const registry = sourceHostTalentRegistry[result.sourceCommit];
      expect(registry?.expressionSites).toBeDefined();
      const expressionRecords = result.calculations.flatMap(record =>
        record.request.kind === 'damage' && record.request.talentExpressionRead
          ? [{ request: record.request, read: record.request.talentExpressionRead }] : []);
      expect(expressionRecords.length, `${lane}: native compound expression receipts`).toBeGreaterThan(0);
      const expressionShapes = new Set<string>();
      for (const row of expressionRecords) {
        const site = registry!.expressionSites![row.read.siteId]!;
        expect(site, `${lane}: fixed expression site ${row.read.siteId}`).toBeDefined();
        expect(site.expression.kind).toBe('multiply');
        expect(row.read.reads.length).toBeGreaterThanOrEqual(2);
        expect(site.termSiteIds).toEqual(row.read.reads.map(leaf => leaf.siteId));
        expect(row.read.actorIndex).toBe(row.request.actorIndex);
        expect(row.read.frame).toBeLessThanOrEqual(row.request.frame);
        for (const leaf of row.read.reads) {
          expect(leaf.actorIndex).toBe(row.read.actorIndex);
          expect(leaf.frame).toBeLessThanOrEqual(row.read.frame);
          expect(registry!.sites[leaf.siteId]?.tableId).toBe(leaf.tableId);
        }
        expressionShapes.add(row.read.reads.some(leaf => leaf.indices.length === 3) ? 'range-leaf' : 'direct-leaves');
      }
      expect([...expressionShapes]).toEqual(expect.arrayContaining(['direct-leaves', 'range-leaf']));
      const byId = new Map(result.calculations.map(record => [record.request.id, record]));
      const selected = result.applications.flatMap((application, index) => {
        const record = byId.get(application.calculationId);
        return record?.request.kind === 'damage' && record.request.talentExpressionRead
          ? [{ application, index, request: record.request, read: record.request.talentExpressionRead }] : [];
      }).find(row => row.application.rawDamage > 0
        && row.read.reads.some(leaf => leaf.indices.length === 3)
        && row.read.value === row.request.input.scaling && row.request.multiplierCalculationId === undefined);
      expect(selected, `${lane}: applied range-leaf compound expression used directly as scaling`).toBeDefined();
      const chosen = selected!;
      const capture = captureSourceHostHit(result, chosen.application.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedRawDamage).toBe(chosen.application.rawDamage);
      const expressionId = `sourceTalentExpression.${chosen.request.id}`;
      const expressionNode = replay.trace.find(node => node.id === expressionId);
      expect(expressionNode?.expression.kind).toBe('multiply');
      expect(expressionNode?.result?.value).toBe(chosen.read.value);
      expect(expressionNode?.sourceRefs.some(ref => ref.includes(result.sourceCommit))).toBe(true);
      const leafIds = chosen.read.reads.map((_, index) => `${expressionId}.term${index}`);
      expect(expressionNode?.childIds).toEqual(leafIds);
      for (let index = 0; index < chosen.read.reads.length; index++) {
        const leaf = chosen.read.reads[index]!;
        const leafId = leafIds[index]!;
        const leafNode = replay.trace.find(node => node.id === leafId);
        expect(leafNode?.expression.kind).toBe('lookup');
        expect(leafNode?.result?.value).toBe(leaf.value);
        expect(leafNode?.sourceRefs.some(ref => ref.includes(result.sourceCommit))).toBe(true);
        const termInput = expressionNode?.inputs.find(input => input.key === `term${index}`);
        expect(termInput?.value).toBe(leaf.value);
        expect(termInput?.origin).toEqual({ kind: 'source-host-talent-table', reference: leafId });
        for (let position = 0; position < leaf.indices.length; position++)
          expect(leafNode?.inputs.find(input => input.key === `index${position}`)?.value).toBe(leaf.indices[position]);
      }
      const rangePosition = chosen.read.reads.findIndex(leaf => leaf.indices.length === 3);
      const rangeRead = chosen.read.reads[rangePosition]!;
      const rangeLeafId = leafIds[rangePosition]!;
      const rangeSite = registry!.sites[rangeRead.siteId]!;
      expect(rangeSite.rangeSource).toBeDefined();
      expect(rangeRead.rangeFrame).toBeLessThanOrEqual(rangeRead.frame);
      const rangeIndexId = `${rangeLeafId}.rangeIndex`;
      const rangeIndex = replay.trace.find(node => node.id === rangeIndexId);
      expect(rangeIndex?.result?.value).toBe(rangeRead.indices[rangeSite.rangeSource!.indexPosition]);
      expect(replay.trace.find(node => node.id === rangeLeafId)?.inputs
        .find(input => input.key === `index${rangeSite.rangeSource!.indexPosition}`)?.origin)
        .toEqual({ kind: 'source-host-range-index', reference: rangeIndexId });
      const scalingInput = replay.trace.find(node => node.id === 'sourceTalentBase')?.inputs.find(input => input.key === 'scaling');
      expect(scalingInput?.value).toBe(chosen.read.value);
      expect(scalingInput?.origin).toEqual({ kind: 'source-host-talent-expression', reference: expressionId });
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
      expect(editedScaling?.origin).not.toEqual({ kind: 'source-host-talent-expression', reference: expressionId });
      expect(counterfactual.trace.find(node => node.id === expressionId)?.result?.value).toBe(chosen.read.value);

      await page.locator('#source-host-hit-index').fill(String(chosen.index));
      await expect(page.locator('#source-host-hit')).toContainText('差值 0');
      await page.locator('#source-host-open-calculator').click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator('#calc-source-host-capture')).toContainText('差值 0');
      const detail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${expressionId}"]`);
      await detail.locator(':scope > summary').click();
      await expect(detail).toContainText('来源天赋倍率：完整表达式');
      await expect(detail.locator('.trace-substitution')).toBeVisible();
      const lookup = page.locator(`[data-source-host-calculation-result] [data-detail-id="${rangeLeafId}"]`);
      await lookup.locator(':scope > summary').click();
      const lookupTable = lookup.locator(`[data-trace-lookup="${rangeLeafId}"]`);
      await expect(lookupTable).toBeVisible();
      await expect(lookupTable).toContainText('1 层');
      await expect(lookupTable).toContainText('2 层');
      await expect(lookupTable).toContainText('3 层');
      await lookupTable.locator('.trace-lookup-row > summary').click();
      const selectedRow = lookupTable.locator(`[data-trace-lookup-selected="${rangeRead.indices[2]}"]`);
      await expect(selectedRow).toBeVisible();
      await expect(selectedRow).toContainText(rangeRead.value.toLocaleString('zh-CN', { maximumFractionDigits: 6 }));
      const rangeDetail = page.locator(`[data-source-host-calculation-result] [data-detail-id="${rangeIndexId}"]`);
      await rangeDetail.locator(':scope > summary').click();
      await expect(rangeDetail).toContainText(rangeSite.rangeSource!.expression);
      await expect(rangeDetail).toContainText(String(rangeRead.rangeFrame));
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
      expect(saved.request.talentExpressionRead).toEqual(chosen.read);
      expect(saved.originalCapture.calculation.request.talentExpressionRead).toEqual(chosen.read);
      expect(calculateSourceHostEditableCalculation(saved).difference).toBe(counterfactual.difference);
      await page.locator('#calc-import').setInputFiles({ name: `talent-expression-${lane}.json`,
        mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('[data-source-host-input="scaling"]')).toHaveValue(String(chosen.read.value + 0.1));
      await expect(page.locator('[data-source-host-calculation-result]')).toContainText(differenceText);
      expect(await download(page, '[data-source-host-export]')).toEqual(saved);

      measurements.push({ lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
        expressionReadCount: expressionRecords.length, expressionSiteIds: [...new Set(expressionRecords.map(row => row.read.siteId))],
        expressionShapes: [...expressionShapes],
        selectedApplicationId: chosen.application.id, selectedCalculationId: chosen.request.id,
        selectedActorKey: chosen.request.actorKey, selectedFrame: chosen.request.frame,
        expressionSiteId: chosen.read.siteId, termSiteIds: registry!.expressionSites![chosen.read.siteId]!.termSiteIds,
        leafReads: chosen.read.reads, rangeSource: rangeSite.rangeSource, rangeIndexId,
        rangeIndexFormula: rangeIndex?.symbolicFormula,
        rangeIndexSubstitution: rangeIndex?.substitution,
        expressionValue: chosen.read.value, originalScaling: chosen.request.input.scaling,
        expressionFormula: expressionNode?.symbolicFormula, expressionSubstitution: expressionNode?.substitution,
        expressionNodeId: expressionId, replayDifference: replay.difference,
        editedScaling: saved.request.input.scaling, editedDamageDifference: counterfactual.difference,
        nativeGameplayUnchanged: true, originalExpressionReceiptPreserved: true, calculatorRoundtrip: true });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(`docs/validation/talent-expression${captureBaseline ? '-baseline' : ''}-browser-20260929.result.json`, JSON.stringify({
      schemaVersion: captureBaseline ? 'source-talent-expression-baseline-browser-v1' : 'source-talent-expression-browser-v1',
      seed: '11', script, measurements, pageErrors,
      scope: captureBaseline ? 'One 098 native baseline per pinned source for the Wanderer C0 E window.'
        : 'One 099 native Wanderer C0 E run per pinned source; two-leaf table expression and independent scaling edit.',
    }, null, 2) + '\n');
  }
});
