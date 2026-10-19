import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const teamAConfig = `options iteration=1 duration=16 ignore_burst_energy=true;
ganyu char lvl=90/90 cons=0 talent=1,1,1;
ganyu add weapon="ravenbow" refine=1 lvl=1/20;
yanfei char lvl=90/90 cons=0 talent=1,1,1;
yanfei add weapon="apprenticesnotes" refine=1 lvl=1/20;
xiao char lvl=90/90 cons=0 talent=1,1,1;
xiao add weapon="whitetassel" refine=1 lvl=1/20;
thoma char lvl=90/90 cons=0 talent=1,1,1;
thoma add weapon="whitetassel" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active ganyu;
ganyu skill;
yanfei skill;
xiao skill;
thoma skill;
wait(420);`;

const teamBConfig = `options iteration=1 duration=16 ignore_burst_energy=true;
ayato char lvl=90/90 cons=0 talent=1,1,1;
ayato add weapon="dullblade" refine=1 lvl=1/20;
yunjin char lvl=90/90 cons=0 talent=1,1,1;
yunjin add weapon="whitetassel" refine=1 lvl=1/20;
kirara char lvl=90/90 cons=0 talent=1,1,1;
kirara add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active ayato;
ayato skill;
yunjin burst;
kirara skill[hold=60];
wait(420);`;

type NativeArchive = {
  schemaVersion: 'source-finite-coverage-batch-native-v1';
  runs: { teamA?: SourceHostResult; teamB?: SourceHostResult };
};

const cases = [
  { run: 'teamA', characterKey: 'ganyu', action: 'skill', contractId: 'ganyu-skill' },
  { run: 'teamA', characterKey: 'yanfei', action: 'skill', contractId: 'yanfei-skill' },
  { run: 'teamA', characterKey: 'xiao', action: 'skill', contractId: 'xiao-skill' },
  { run: 'teamA', characterKey: 'thoma', action: 'skill', contractId: 'thoma-skill' },
  { run: 'teamB', characterKey: 'kamisatoayato', action: 'skill', contractId: 'ayato-skill' },
  { run: 'teamB', characterKey: 'yunjin', action: 'burst', contractId: 'yunjin-burst' },
  { run: 'teamB', characterKey: 'kirara', action: 'skill', contractId: 'kirara-skill' },
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

test('focused classic finite-cast coverage closes seven source-audited skill actions', async ({ page }) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-finite-coverage-batch-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-finite-coverage-batch-team-20260930.result.json';
  const writeResult = async () => writeFile(resultPath, JSON.stringify({
    schemaVersion: 'source-finite-coverage-batch-browser-v1', measurements, pageErrors,
    scope: 'Two classic native configurations cover one Ganyu E, Yanfei E, Xiao E, Thoma E, Ayato E, Yunjin Q, and Kirara E invocation. Each selected finite cast is limited to its registered intrinsic source roots and included captured applications.',
  }, null, 2) + '\n');

  try {
    let archive: NativeArchive;
    if (process.env.GIDPS_REUSE_SOURCE_FINITE_COVERAGE_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as NativeArchive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-finite-coverage-batch-native-v1', runs: {} };
      archive.runs.teamA = await captureNative(page, teamAConfig, '202609301171');
      measurements.teamA = { rawPath: capturePath, archived: true, config: teamAConfig };
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      await writeResult();
      archive.runs.teamB = await captureNative(page, teamBConfig, '202609301172');
      measurements.teamB = { rawPath: capturePath, archived: true, config: teamBConfig };
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      measurements.nativeRunsPerformed = true;
    }
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;
    await writeResult();
    expect(archive.schemaVersion).toBe('source-finite-coverage-batch-native-v1');
    expect(archive.runs.teamA?.config).toBe(teamAConfig);
    expect(archive.runs.teamB?.config).toBe(teamBConfig);

    const summaries: Record<string, unknown>[] = [];
    const selected: { spec: (typeof cases)[number]; native: SourceHostResult;
      invocation: NonNullable<SourceHostResult['abilityInvocations']>[number];
      collection: SourceHostActionCollection; analysis: ReturnType<typeof calculateSourceHostActionCollection> }[] = [];

    for (const spec of cases) {
      const native = archive.runs[spec.run];
      const invocation = native?.abilityInvocations?.find(row =>
        row.characterKey === spec.characterKey && row.action === spec.action);
      const preliminary: Record<string, unknown> = {
        characterKey: spec.characterKey, action: spec.action, contractId: spec.contractId,
        invocationFound: invocation !== undefined, invocationSuccess: invocation?.success,
      };
      summaries.push(preliminary);
      measurements.casts = summaries;
      await writeResult();
      expect(native, `${spec.characterKey} native run`).toBeDefined();
      expect(invocation, `${spec.characterKey} ${spec.action} invocation`).toBeDefined();
      expect(invocation!.success, `${spec.characterKey} ${spec.action} accepted`).toBe(true);

      const collection = captureSourceHostFiniteSkillCollection(native!, invocation!.actionSequence);
      expect(collection, `${spec.characterKey} finite capture`).toBeDefined();
      expect(collection!.scope).toBe('finite-skill-cast');
      const analysis = calculateSourceHostActionCollection(collection!);
      const included = collection!.hits.filter(hit => hit.included);
      const applications = included.map(hit => hit.calculation.originalCapture.application);
      const replayDifferences = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
      Object.assign(preliminary, {
        componentContractId: analysis.finiteCast?.contract?.id,
        completeCast: analysis.completeCast,
        reasons: analysis.finiteCast?.reasons,
        expectedRootAttackCount: analysis.finiteCast?.expectedRootAttackCount,
        observedRootAttackCount: analysis.finiteCast?.observedRootAttackCount,
        completedRootAttackCount: analysis.finiteCast?.completedRootAttackCount,
        hitCount: applications.length,
        componentSubtotal: analysis.total,
        appliedDamageSubtotal: applications.reduce((sum, application) => sum + application.appliedDamage, 0),
        replayDifferences,
      });
      let kiraraRolls: NonNullable<SourceHostResult['abilityProducers']> = [];
      if (spec.characterKey === 'kirara') {
        kiraraRolls = (native!.abilityProducers ?? []).filter(row => row.invocationId === invocation!.id
          && row.siteId === 'kirara.skill.hold.roll');
        const rollQueues = kiraraRolls.flatMap(row => row.queuedAttacks);
        Object.assign(preliminary, {
          rollProducerCount: kiraraRolls.length,
          rollProducerIds: kiraraRolls.map(row => row.id),
          rollQueueIds: rollQueues.map(row => row.queueId),
          rollAttackIds: rollQueues.map(row => row.attackId),
          rollQueuedAttackCounts: kiraraRolls.map(row => row.queuedAttacks.length),
          nativeRollTaskCount: invocation!.entryFacts?.['kirara.skill.roll-task-count'],
        });
      }
      await writeResult();

      expect(analysis.finiteCast?.contract?.id, `${spec.characterKey} contract`).toBe(spec.contractId);
      expect(analysis.completeCast, `${spec.characterKey}: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
      expect(applications.length, `${spec.characterKey} needs an actual included hit`).toBeGreaterThan(0);
      for (const [index, hit] of included.entries())
        expect(replayDifferences[index], `${spec.characterKey} application #${hit.calculation.originalCapture.application.id} replay`).toBe(0);
      expect(analysis.total, `${spec.characterKey} component subtotal vs included captured applications`)
        .toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
      if (spec.characterKey === 'ganyu')
        expect(applications, 'Ganyu E includes its two audited direct roots').toHaveLength(2);
      if (spec.characterKey === 'kirara') {
        const rollQueues = kiraraRolls.flatMap(row => row.queuedAttacks);
        expect(analysis.finiteCast?.expectedRootAttackCount, 'Kirara E hold includes two roll roots and its kick').toBe(3);
        expect(kiraraRolls, 'Kirara E hold registers both actual roll task occurrences').toHaveLength(2);
        expect(kiraraRolls.every(row => row.state === 'completed' && row.queuedAttacks.length === 1)).toBe(true);
        expect(new Set(rollQueues.map(row => row.queueId)).size).toBe(2);
        expect(rollQueues.every(row => row.attackId !== undefined)).toBe(true);
        expect(new Set(rollQueues.map(row => row.attackId)).size).toBe(2);
        expect(invocation!.entryFacts?.['kirara.skill.roll-task-count']).toBe(2);
      }
      selected.push({ spec, native: native!, invocation: invocation!, collection: collection!, analysis });
    }

    const ganyu = selected.find(item => item.spec.characterKey === 'ganyu')!;
    // Inspect the actual collection and editor DOM once, using this two-hit E export.
    await page.goto('/calculator');
    await page.locator('#calc-import').setInputFiles({ name: 'ganyu-e-finite-cast.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ganyu.collection)) });
    const certificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(certificate).toBeVisible();
    await expect(certificate).toHaveAttribute('data-source-finite-skill-status', 'complete');
    const editor = page.locator('[data-source-action-collection]');
    const total = editor.locator('[data-source-finite-skill-total]');
    await expect(total).toBeVisible();
    const totalBeforeEdit = await total.innerText();
    const hitRows = editor.locator('[data-source-action-hit-list] input[data-source-action-included]');
    await expect(hitRows).toHaveCount(2);
    const scaling = editor.locator('[data-source-action-editor] [data-source-host-input="scaling"]').first();
    await expect(scaling).toBeVisible();
    const scalingBefore = Number(await scaling.inputValue());
    await scaling.fill(String(scalingBefore + 0.01));
    await expect(total).not.toHaveText(totalBeforeEdit);
    const edited = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
    expect(calculateSourceHostActionCollection(edited).total).not.toBe(ganyu.analysis.total);
    await page.locator('#calc-import').setInputFiles({ name: 'ganyu-e-finite-cast-edited.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(edited);
    measurements.ganyuUiEditExportImport = { hitCount: ganyu.collection.hits.length, completed: true };
    await writeResult();
    expect(pageErrors).toEqual([]);
  } finally {
    await writeResult();
  }
});
