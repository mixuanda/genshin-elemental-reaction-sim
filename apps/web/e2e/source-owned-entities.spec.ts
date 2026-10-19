import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=24;
amber char lvl=90/90 cons=2 talent=8,8,8;
amber add weapon="ravenbow" refine=1 lvl=90/90;
yaoyao char lvl=90/90 cons=6 talent=8,8,8;
yaoyao add weapon="beginnersprotector" refine=1 lvl=70/70;
yaemiko char lvl=90/90 cons=0 talent=8,8,8 +params=[start_energy=100];
yaemiko add weapon="apprenticesnotes" refine=1 lvl=70/70;
target lvl=90 resist=0.1 radius=10 pos=0,2.4;
active amber;
amber skill;
yaoyao skill;
yaemiko skill;
yaemiko skill;
yaemiko skill;
yaemiko burst;
wait(1500);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('audited Amber and Yaoyao gadgets close with their own hits while Yae Q uses its entry fact', async ({ page }) => {
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
    const capturePath = 'docs/validation/source-owned-entities-team-20260929.capture.json';
    await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n'); // Preserve full native output before assertions.
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;

    expect(native.config).toBe(config);
    expect(native.ownedEntities).toBeDefined();
    expect(native.ownedEntityTriggers).toBeDefined();
    expect(native.ownedEntityProducers).toBeDefined();
    const invocations = native.abilityInvocations ?? [];
    const choose = (character: string, action: string) => {
      const rows = invocations.filter(row => row.characterKey === character && row.action === action);
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };
    const amber = choose('amber', 'skill');
    const yaoyao = choose('yaoyao', 'skill');
    const yae = choose('yaemiko', 'burst');
    expect(yae.entryFacts?.['yae.burst.kitsune-count']).toBe(3);

    const capture = (sequence: number) => {
      const collection = captureSourceHostFiniteSkillCollection(native, sequence);
      expect(collection).toBeDefined();
      const analysis = calculateSourceHostActionCollection(collection!);
      expect(analysis.completeCast).toBe(true);
      expect(analysis.finiteCast?.closed).toBe(true);
      const applications = collection!.hits.map(hit => hit.calculation.originalCapture.application);
      expect(analysis.total).toBeCloseTo(applications.reduce((sum, row) => sum + row.appliedDamage, 0), 8);
      for (const hit of collection!.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
      expect(collection!.exclusions.otherAppliedHits).toBeGreaterThan(0);
      return { collection: collection!, analysis, applications };
    };
    const amberRun = capture(amber.actionSequence);
    const yaoyaoRun = capture(yaoyao.actionSequence);
    const yaeRun = capture(yae.actionSequence);
    expect(amberRun.collection.association).toBe('skill-ownership');
    expect(yaoyaoRun.collection.association).toBe('skill-ownership');
    expect(yaeRun.analysis.finiteCast).toMatchObject({ expectedRootAttackCount: 4, completedRootAttackCount: 4 });

    const ownedIds = [amberRun, yaoyaoRun, yaeRun].flatMap(run => run.applications.map(row => row.id));
    expect(new Set(ownedIds).size).toBe(ownedIds.length);
    expect(ownedIds.length).toBeLessThan(native.applications.length);
    const combinedSubtotal = amberRun.analysis.total + yaoyaoRun.analysis.total + yaeRun.analysis.total;
    expect(combinedSubtotal).toBeCloseTo(ownedIds.reduce((sum, id) =>
      sum + native.applications.find(row => row.id === id)!.appliedDamage, 0), 8);

    const amberEntity = native.ownedEntities!.find(row => row.invocationId === amber.id);
    const yaoyaoEntity = native.ownedEntities!.find(row => row.invocationId === yaoyao.id);
    expect(amberEntity).toBeDefined();
    expect(yaoyaoEntity).toBeDefined();
    for (const entity of [amberEntity!, yaoyaoEntity!]) {
      expect(entity.endedFrame).toBeDefined();
      expect(entity.endedFrame!).toBeLessThanOrEqual(native.lifecycleObservationFrame!);
      expect(entity.endReason).toBeDefined();
    }
    expect(amberRun.analysis.finiteCast).toMatchObject({ entityCount: 1, endedEntityCount: 1, openEntityCount: 0 });
    expect(yaoyaoRun.analysis.finiteCast).toMatchObject({ entityCount: 1, endedEntityCount: 1, openEntityCount: 0 });
    const thinks = native.ownedEntityTriggers!.filter(row => row.entityId === yaoyaoEntity!.id && row.kind === 'think')
      .sort((left, right) => left.id - right.id);
    expect(thinks.length).toBeGreaterThanOrEqual(6);
    const megaThinkIndexes = thinks.flatMap((row, index) => row.queuedAttacks.some(attack => attack.emitSiteId === 'yaoyao.skill.mega-radish')
      ? [index] : []);
    expect(megaThinkIndexes).toEqual([2, 5]);
    expect(thinks.every(row => row.childProducerIds.length === 1)).toBe(true);
    const yaoyaoProducers = native.ownedEntityProducers!.filter(row => row.entityId === yaoyaoEntity!.id);
    expect(yaoyaoProducers).toHaveLength(thinks.length);
    expect(yaoyaoProducers.every(row => row.state === 'completed' && row.queuedAttacks.length === 1)).toBe(true);

    await page.goto('/calculator');
    await expect(page.locator('#calc-import')).toBeEnabled();
    await page.locator('#calc-import').setInputFiles({
      name: 'yaoyao-e-owned-entity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(yaoyaoRun.collection)),
    });
    await expect(page.locator('[data-source-action-collection]')).toBeVisible();
    await expect(page.locator('[data-source-finite-skill-entities]')).toContainText('已移除 1 / 登记 1');
    const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
    expect(exported).toEqual(yaoyaoRun.collection);
    expect(calculateSourceHostActionCollection(exported).finiteCast).toMatchObject({ entityCount: 1, endedEntityCount: 1 });

    const missingProducerNative = structuredClone(native);
    const omittedProducerId = yaoyaoEntity!.producerIds[0];
    expect(omittedProducerId).toBeDefined();
    missingProducerNative.ownedEntityProducers = missingProducerNative.ownedEntityProducers!
      .filter(row => row.id !== omittedProducerId);
    expect(missingProducerNative.ownedEntities!.find(row => row.id === yaoyaoEntity!.id)!.producerIds).toContain(omittedProducerId);
    const missingProducer = captureSourceHostFiniteSkillCollection(missingProducerNative, yaoyao.actionSequence);
    expect(missingProducer).toBeDefined();
    expect(calculateSourceHostActionCollection(missingProducer!).completeCast).toBe(false);

    const explosionAttackId = native.ownedEntityTriggers!.find(row => row.entityId === amberEntity!.id)!.queuedAttacks[0]!.attackId;
    expect(explosionAttackId).toBeDefined();
    const missingDispatchNative = structuredClone(native);
    missingDispatchNative.attackDispatchCompletions = missingDispatchNative.attackDispatchCompletions!
      .filter(row => row.attackId !== explosionAttackId);
    const missingDispatch = captureSourceHostFiniteSkillCollection(missingDispatchNative, amber.actionSequence);
    expect(missingDispatch).toBeDefined();
    expect(calculateSourceHostActionCollection(missingDispatch!).completeCast).toBe(false);

    const missingFactNative = structuredClone(native);
    delete missingFactNative.abilityInvocations!.find(row => row.id === yae.id)!.entryFacts;
    expect(captureSourceHostFiniteSkillCollection(missingFactNative, yae.actionSequence)).toBeUndefined();
    expect(pageErrors).toEqual([]);

    measurements.entities = [amberEntity!, yaoyaoEntity!].map(row => ({ id: row.id, siteId: row.siteId,
      triggerCount: row.triggerIds.length, producerCount: row.producerIds.length, endedFrame: row.endedFrame, endReason: row.endReason }));
    measurements.yaoyao = { thinkCount: thinks.length, megaThinkIndexes, flightCount: yaoyaoProducers.length,
      applications: yaoyaoRun.applications.length, sharedTotal: yaoyaoRun.analysis.total };
    measurements.amber = { applications: amberRun.applications.length, sharedTotal: amberRun.analysis.total,
      explosionAttackId };
    measurements.yae = { entryKitsuneCount: yae.entryFacts?.['yae.burst.kitsune-count'],
      applications: yaeRun.applications.length, sharedTotal: yaeRun.analysis.total,
      roots: yaeRun.analysis.finiteCast?.completedRootAttackCount };
    measurements.combinedOwnedSubtotal = combinedSubtotal;
    measurements.nativeTotalDamage = (native.result as { total_damage: number }).total_damage;
    measurements.collectionImportExportSame = true;
    measurements.missingProducerCloses = false;
    measurements.missingExplosionDispatchCloses = false;
    measurements.missingYaeEntryFactCapturable = false;
  } finally {
    await writeFile('docs/validation/source-owned-entities-team-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-owned-entities-browser-v1', measurements, pageErrors,
      scope: 'One classic three-character native run. Finite sums follow exact Amber and Yaoyao gadget roots plus Yae Q roots, excluding unrelated applications.',
    }, null, 2) + '\n');
  }
});
