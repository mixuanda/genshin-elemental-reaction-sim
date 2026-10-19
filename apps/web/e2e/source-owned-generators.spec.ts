import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=23;
yelan char lvl=90/90 cons=2 talent=8,8,8 +params=[start_energy=100];
yelan add weapon="ravenbow" refine=1 lvl=90/90;
kaeya char lvl=90/90 cons=0 talent=8,8,8;
kaeya add weapon="dullblade" refine=1 lvl=70/70;
target lvl=90 resist=0.1 radius=10 pos=0,2.4;
active yelan;
yelan burst;
kaeya attack:5;
wait(90);
kaeya attack:5;
yelan skill;
wait(1500);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('Yelan C2 Q owns its live status generator across normal, ticker and skill-hit triggers', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto('/source-simulation');
    await page.locator('#source-host-variant').selectOption('classic');
    await page.locator('#source-host-config').fill(config);
    await page.locator('#source-host-seed').fill('20260929');
    await page.locator('#source-host-run').click();
    await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
    const native = await download(page, '#source-host-export') as SourceHostResult;
    const capturePath = 'docs/validation/source-owned-generators-team-20260929.capture.json';
    await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n'); // Preserve the full native receipt before assertions.
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;

    expect(native.config).toBe(config);
    expect(native.ownedGenerators).toBeDefined();
    expect(native.ownedGeneratorTriggers).toBeDefined();
    expect(native.statusInstances).toBeDefined();
    const invocation = native.abilityInvocations?.find(row => row.characterKey === 'yelan' && row.action === 'burst');
    expect(invocation).toBeDefined();
    const collection = captureSourceHostFiniteSkillCollection(native, invocation!.actionSequence);
    expect(collection).toBeDefined();
    expect(collection!.scope).toBe('finite-skill-cast');
    expect(collection!.association).toBe('skill-ownership');
    const analysis = calculateSourceHostActionCollection(collection!);
    expect(analysis.completeCast).toBe(true);
    expect(analysis.finiteCast).toMatchObject({ closed: true, generatorCount: 1, endedGeneratorCount: 1, openGeneratorCount: 0 });

    const generator = native.ownedGenerators!.find(row => row.invocationId === invocation!.id);
    expect(generator).toBeDefined();
    const triggers = native.ownedGeneratorTriggers!.filter(row => row.generatorId === generator!.id);
    expect(triggers.map(row => row.kind)).toEqual(expect.arrayContaining(['state-change', 'ticker', 'skill-hit']));
    expect(generator!.triggerIds).toEqual(triggers.map(row => row.id));
    const status = native.statusInstances!.find(row => row.instanceId === generator!.statusInstanceId);
    expect(status).toBeDefined();
    expect(status!.endState).toBe('expired-at-end');
    expect(status!.finalExpiryFrame).toBeLessThan(native.lifecycleObservationFrame!);

    const ownedIds = new Set(collection!.hits.map(hit => hit.calculation.originalCapture.application.id));
    expect(ownedIds.size).toBeGreaterThan(0);
    const actions = sourceActionReceipts(native.logs);
    const normalSequences = new Set(actions.filter(row => row.characterKey === 'kaeya' && row.action === 'attack').map(row => row.sequence));
    const skillSequences = new Set(actions.filter(row => row.characterKey === 'yelan' && row.action === 'skill').map(row => row.sequence));
    expect(normalSequences.size).toBeGreaterThan(0);
    expect(skillSequences.size).toBeGreaterThan(0);
    const ownNormal = native.applications.filter(row => row.origin?.creationActionSequence !== undefined
      && normalSequences.has(row.origin.creationActionSequence) && row.origin.statusOwner === undefined);
    const ownSkill = native.applications.filter(row => row.origin?.creationActionSequence !== undefined
      && skillSequences.has(row.origin.creationActionSequence) && row.origin.statusOwner === undefined);
    expect(ownNormal.length).toBeGreaterThan(0);
    expect(ownSkill.length).toBeGreaterThan(0);
    for (const ownHit of [...ownNormal, ...ownSkill]) expect(ownedIds.has(ownHit.id)).toBe(false);

    const ownedApplications = collection!.hits.map(hit => hit.calculation.originalCapture.application);
    const ownedSubtotal = ownedApplications.reduce((sum, row) => sum + row.appliedDamage, 0);
    expect(analysis.total).toBeCloseTo(ownedSubtotal, 8);
    for (const hit of collection!.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
    expect((native.result as { total_damage: number }).total_damage).toBeGreaterThan(ownedSubtotal);

    await page.goto('/calculator');
    await page.locator('#calc-import').setInputFiles({
      name: 'yelan-q-owned-generator.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(collection)),
    });
    await expect(page.locator('[data-source-action-collection]')).toBeVisible();
    const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
    expect(exported).toEqual(collection);
    expect(calculateSourceHostActionCollection(exported).completeCast).toBe(true);

    const missingTriggerNative = structuredClone(native);
    missingTriggerNative.ownedGeneratorTriggers = missingTriggerNative.ownedGeneratorTriggers!
      .filter(row => row.id !== generator!.triggerIds[0]);
    expect(missingTriggerNative.ownedGenerators!.find(row => row.id === generator!.id)!.triggerIds)
      .toContain(generator!.triggerIds[0]);
    const missingTrigger = captureSourceHostFiniteSkillCollection(missingTriggerNative, invocation!.actionSequence);
    expect(missingTrigger).toBeDefined();
    expect(calculateSourceHostActionCollection(missingTrigger!).completeCast).toBe(false);

    const openStatus = structuredClone(collection!);
    const ownedStatus = openStatus.finiteCastEvidence!.statusInstances!.find(row => row.instanceId === generator!.statusInstanceId)!;
    ownedStatus.endState = 'active-at-end';
    ownedStatus.endFrame = openStatus.lifecycleObservationFrame!;
    expect(calculateSourceHostActionCollection(openStatus).completeCast).toBe(false);
    expect(pageErrors).toEqual([]);

    measurements.invocationId = invocation!.id;
    measurements.generatorId = generator!.id;
    measurements.statusInstanceId = generator!.statusInstanceId;
    measurements.triggerKinds = [...new Set(triggers.map(row => row.kind))];
    measurements.triggerCount = triggers.length;
    measurements.ownedApplications = ownedApplications.length;
    measurements.ownedSubtotal = ownedSubtotal;
    measurements.nativeTotalDamage = (native.result as { total_damage: number }).total_damage;
    measurements.normalOwnApplications = ownNormal.length;
    measurements.skillOwnApplications = ownSkill.length;
    measurements.replayDifferences = collection!.hits.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
    measurements.missingTriggerCloses = false;
    measurements.openStatusCloses = false;
    measurements.collectionImportExportSame = true;
  } finally {
    await writeFile('docs/validation/source-owned-generators-team-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-owned-generators-browser-v1', measurements, pageErrors,
      scope: 'One actual classic Yelan C2 Q team run through status expiry; fixed-source generator ownership excludes the later actors\' own hits.',
    }, null, 2) + '\n');
  }
});
