import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const teamAConfig = `options iteration=1 duration=24 ignore_burst_energy=true;
qiqi char lvl=90/90 cons=0 talent=1,1,1;
qiqi add weapon="dullblade" refine=1 lvl=1/20;
yaemiko char lvl=90/90 cons=0 talent=1,1,1;
yaemiko add weapon="apprenticesnotes" refine=1 lvl=1/20;
xiangling char lvl=90/90 cons=0 talent=1,1,1;
xiangling add weapon="whitetassel" refine=1 lvl=1/20;
yaoyao char lvl=90/90 cons=0 talent=1,1,1;
yaoyao add weapon="whitetassel" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active qiqi;
qiqi skill;
yaemiko skill;
xiangling skill;
yaoyao burst;
yaoyao jump;
wait(1100);`;

const teamBConfig = `options iteration=1 duration=20 ignore_burst_energy=true;
beidou char lvl=90/90 cons=2 talent=1,1,1;
beidou add weapon="debateclub" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active beidou;
beidou burst;
kaeya attack;
wait(950);`;

const stellarConfig = `options iteration=1 duration=40 ignore_burst_energy=true;
odette char lvl=90/90 cons=0 talent=1,1,1;
odette add weapon="magicguide" refine=1 lvl=1/20;
qiqi char lvl=90/90 cons=0 talent=1,1,1;
qiqi add weapon="dullblade" refine=1 lvl=1/20;
yaemiko char lvl=90/90 cons=0 talent=1,1,1;
yaemiko add weapon="magicguide" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active qiqi;
qiqi skill;
wait(180);
qiqi attack;
yaemiko attack;
yaemiko skill;
wait(1700);`;

type NativeArchive = {
  schemaVersion: 'source-recurring-skill-ownership-native-v1';
  runs: { teamA?: SourceHostResult; teamB?: SourceHostResult; stellar?: SourceHostResult };
};

const cases = [
  { run: 'teamA', characterKey: 'qiqi', action: 'skill', contractId: 'qiqi-skill' },
  { run: 'teamA', characterKey: 'yaemiko', action: 'skill', contractId: 'yaemiko-skill' },
  { run: 'teamA', characterKey: 'xiangling', action: 'skill', contractId: 'xiangling-skill' },
  { run: 'teamA', characterKey: 'yaoyao', action: 'burst', contractId: 'yaoyao-burst' },
  { run: 'teamB', characterKey: 'beidou', action: 'burst', contractId: 'beidou-burst' },
  { run: 'stellar', characterKey: 'qiqi', action: 'skill', contractId: 'qiqi-skill-stellar' },
  { run: 'stellar', characterKey: 'yaemiko', action: 'skill', contractId: 'yaemiko-skill-stellar' },
] as const;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function captureNative(page: Page, config: string, seed: string, variant: 'classic' | 'stellar'): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption(variant);
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill(seed);
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

test('recurring skill casts close only their native owned status, entity, and callback lifecycles', async ({ page }) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-recurring-skill-ownership-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-recurring-skill-ownership-team-20260930.result.json';
  const writeResult = async () => writeFile(resultPath, JSON.stringify({
    schemaVersion: 'source-recurring-skill-ownership-browser-v1', measurements, pageErrors,
    scope: 'Two classic source runs cover one Qiqi E, Yae Miko E, Xiangling E, Yaoyao Q, and Beidou Q invocation. One Stellar run adds Qiqi E Normal coordination and Yae E Revelation callback coverage. Captured finite components include only registered cast roots and their native owned lifecycles; separate reaction and equipment damage are not claimed.',
  }, null, 2) + '\n');

  try {
    let archive: NativeArchive;
    if (process.env.GIDPS_REUSE_SOURCE_RECURRING_SKILL_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as NativeArchive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-recurring-skill-ownership-native-v1', runs: {} };
      archive.runs.teamA = await captureNative(page, teamAConfig, '202609301181', 'classic');
      measurements.teamA = { rawPath: capturePath, archived: true, config: teamAConfig };
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      await writeResult();
      archive.runs.teamB = await captureNative(page, teamBConfig, '202609301182', 'classic');
      measurements.teamB = { rawPath: capturePath, archived: true, config: teamBConfig };
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      await writeResult();
      archive.runs.stellar = await captureNative(page, stellarConfig, '202609301183', 'stellar');
      measurements.stellar = { rawPath: capturePath, archived: true, config: stellarConfig };
      await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      measurements.nativeRunsPerformed = true;
    }
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;
    await writeResult();
    expect(archive.schemaVersion).toBe('source-recurring-skill-ownership-native-v1');
    expect(archive.runs.teamA?.config).toBe(teamAConfig);
    expect(archive.runs.teamB?.config).toBe(teamBConfig);
    expect(archive.runs.stellar?.config).toBe(stellarConfig);

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
        producerCount: analysis.finiteCast?.producerCount,
        completedProducerCount: analysis.finiteCast?.completedProducerCount,
        triggerCount: analysis.finiteCast?.triggerCount,
        generatorCount: analysis.finiteCast?.generatorCount,
        endedGeneratorCount: analysis.finiteCast?.endedGeneratorCount,
        entityCount: analysis.finiteCast?.entityCount,
        endedEntityCount: analysis.finiteCast?.endedEntityCount,
        entityProducerCount: analysis.finiteCast?.entityProducerCount,
        completedEntityProducerCount: analysis.finiteCast?.completedEntityProducerCount,
        hitCallbackBatchCount: analysis.finiteCast?.hitCallbackBatchCount,
        completedHitCallbackBatchCount: analysis.finiteCast?.completedHitCallbackBatchCount,
        hitCallbackCount: analysis.finiteCast?.hitCallbackCount,
        hitCount: applications.length,
        componentSubtotal: analysis.total,
        appliedDamageSubtotal: applications.reduce((sum, application) => sum + application.appliedDamage, 0),
        replayDifferences,
      });
      if (spec.characterKey === 'beidou') {
        const normal = native!.abilityInvocations?.find(row => row.characterKey === 'kaeya' && row.action === 'attack');
        Object.assign(preliminary, {
          normalTriggerInvocationFound: normal !== undefined,
          normalTriggerInvocationSuccess: normal?.success,
          ownedGeneratorTriggers: collection!.finiteCastEvidence?.ownedGeneratorTriggers?.map(row => ({
            id: row.id, siteId: row.siteId, kind: row.kind, queuedAttacks: row.queuedAttacks,
          })),
        });
      }
      if (spec.contractId === 'yaemiko-skill-stellar') {
        const ownedIds = new Set(applications.map(row => row.attackId));
        preliminary.revelationStrikeCount = collection!.finiteCastEvidence?.hitCallbacks?.flatMap(row =>
          row.queuedAttacks.filter(attack => attack.emitSiteId === 'yaemiko.skill.revelation-strike'
            && attack.attackId !== undefined && ownedIds.has(attack.attackId))).length ?? 0;
      }
      if (spec.contractId === 'yaoyao-burst') preliminary.a1FlightCount = collection!.finiteCastEvidence?.producers?.filter(row =>
        row.invocationId === invocation!.id && row.siteId === 'yaoyao.burst.a1-radish-flight' && row.queuedAttacks.length === 1).length ?? 0;
      await writeResult();

      expect(analysis.finiteCast?.contract?.id, `${spec.characterKey} contract`).toBe(spec.contractId);
      expect(analysis.completeCast, `${spec.characterKey}: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
      expect(applications.length, `${spec.characterKey} needs an actual included hit`).toBeGreaterThan(0);
      for (const [index, hit] of included.entries())
        expect(replayDifferences[index], `${spec.characterKey} application #${hit.calculation.originalCapture.application.id} replay`).toBe(0);
      expect(analysis.total, `${spec.characterKey} component subtotal vs included captured applications`)
        .toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
      if (spec.characterKey === 'beidou') {
        const normal = native!.abilityInvocations?.find(row => row.characterKey === 'kaeya' && row.action === 'attack');
        expect(normal?.success, 'Kaeya Normal must occur while Beidou Q is active to trigger the bounce').toBe(true);
        expect(analysis.finiteCast?.triggerCount, 'Beidou Q owns an actual normal-triggered bounce').toBeGreaterThan(0);
      }
      if (spec.contractId === 'qiqi-skill-stellar')
        expect(analysis.finiteCast?.triggerCount, 'Stellar Qiqi E must produce its coordinated Normal-triggered attack').toBeGreaterThan(0);
      if (spec.contractId === 'yaemiko-skill-stellar')
        expect(preliminary.revelationStrikeCount, 'Stellar Yae E must produce its actual Revelation strike, not only particle callbacks').toBeGreaterThan(0);
      if (spec.contractId === 'yaoyao-burst')
        expect(preliminary.a1FlightCount, 'Yaoyao jump must create an actual A1 radish flight').toBeGreaterThan(0);
      selected.push({ spec, native: native!, invocation: invocation!, collection: collection!, analysis });
    }

    const qiqi = selected.find(item => item.spec.characterKey === 'qiqi')!;
    await page.goto('/calculator');
    await page.locator('#calc-import').setInputFiles({ name: 'qiqi-e-recurring-finite-cast.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(qiqi.collection)) });
    const certificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(certificate).toBeVisible();
    await expect(certificate).toHaveAttribute('data-source-finite-skill-status', 'complete');
    const editor = page.locator('[data-source-action-collection]');
    const total = editor.locator('[data-source-finite-skill-total]');
    await expect(total).toBeVisible();
    const totalBeforeEdit = await total.innerText();
    const scaling = editor.locator('[data-source-action-editor] [data-source-host-input="scaling"]').first();
    await expect(scaling).toBeVisible();
    const scalingBefore = Number(await scaling.inputValue());
    await scaling.fill(String(scalingBefore + 0.01));
    await expect(total).not.toHaveText(totalBeforeEdit);
    const edited = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
    expect(calculateSourceHostActionCollection(edited).total).not.toBe(qiqi.analysis.total);
    await page.locator('#calc-import').setInputFiles({ name: 'qiqi-e-recurring-finite-cast-edited.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(edited);
    measurements.qiqiUiEditExportImport = { hitCount: qiqi.collection.hits.length, completed: true };
    await writeResult();
    expect(pageErrors).toEqual([]);
  } finally {
    await writeResult();
  }
});
