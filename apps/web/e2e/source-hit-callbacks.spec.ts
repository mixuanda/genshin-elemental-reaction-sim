import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=12;
dori char lvl=90/90 cons=1 talent=8,8,8;
dori add weapon="favoniusgreatsword" refine=1 lvl=70/70;
mika char lvl=90/90 cons=0 talent=8,8,8;
mika add weapon="beginnersprotector" refine=1 lvl=70/70;
baizhu char lvl=90/90 cons=0 talent=8,8,8;
baizhu add weapon="apprenticesnotes" refine=1 lvl=70/70;
navia char lvl=90/90 cons=2 talent=8,8,8;
navia add weapon="favoniusgreatsword" refine=1 lvl=70/70;
target lvl=90 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 resist=0.1 radius=0.5 pos=0.5,2.4;
active dori;
dori skill;
mika skill[hold=1];
baizhu skill;
navia skill[hold=31];
wait(720);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('four audited hit-callback skills close only their reachable intrinsic children', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const capturePath = 'docs/validation/source-hit-callbacks-team-20260929.capture.json';
    let native: SourceHostResult;
    if (process.env.GIDPS_REUSE_HIT_CALLBACK_CAPTURE === '1') {
      native = JSON.parse(await readFile(capturePath, 'utf8')) as SourceHostResult;
      measurements.nativeRunPerformed = false;
    } else {
      await page.goto('/source-simulation');
      await page.locator('#source-host-variant').selectOption('classic');
      await page.locator('#source-host-config').fill(config);
      await page.locator('#source-host-seed').fill('20260929');
      await page.locator('#source-host-run').click();
      await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
      native = await download(page, '#source-host-export') as SourceHostResult;
      await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n'); // Full native output precedes assertions.
      measurements.nativeRunPerformed = true;
    }
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;

    expect(native.config).toBe(config);
    expect(native.hitCallbackBatches).toBeDefined();
    expect(native.hitCallbacks).toBeDefined();
    const choose = (character: string) => {
      const rows = (native.abilityInvocations ?? []).filter(row => row.characterKey === character && row.action === 'skill');
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };
    const invocations = {
      dori: choose('dori'), mika: choose('mika'), baizhu: choose('baizhu'), navia: choose('navia'),
    };
    const capture = (sequence: number) => {
      const collection = captureSourceHostFiniteSkillCollection(native, sequence);
      expect(collection).toBeDefined();
      const analysis = calculateSourceHostActionCollection(collection!);
      expect(analysis.completeCast, JSON.stringify({ character: collection!.action.characterKey,
        reasons: analysis.finiteCast?.reasons })).toBe(true);
      expect(analysis.finiteCast?.closed).toBe(true);
      const applications = collection!.hits.map(hit => hit.calculation.originalCapture.application);
      expect(applications.length).toBeGreaterThan(0);
      expect(analysis.total).toBeCloseTo(applications.reduce((sum, row) => sum + row.appliedDamage, 0), 8);
      for (const hit of collection!.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
      expect(collection!.exclusions.otherAppliedHits).toBeGreaterThan(0);
      return { collection: collection!, analysis, applications };
    };
    const runs = {
      dori: capture(invocations.dori.actionSequence),
      mika: capture(invocations.mika.actionSequence),
      baizhu: capture(invocations.baizhu.actionSequence),
      navia: capture(invocations.navia.actionSequence),
    };
    const allOwnedIds = Object.values(runs).flatMap(run => run.applications.map(row => row.id));
    expect(new Set(allOwnedIds).size).toBe(allOwnedIds.length);
    for (const [character, run] of Object.entries(runs)) {
      const otherIds = new Set(Object.entries(runs).filter(([key]) => key !== character)
        .flatMap(([, other]) => other.applications.map(row => row.id)));
      expect(run.applications.every(row => !otherIds.has(row.id))).toBe(true);
    }
    const combinedSubtotal = Object.values(runs).reduce((sum, run) => sum + run.analysis.total, 0);
    expect(combinedSubtotal).toBeCloseTo(allOwnedIds.reduce((sum, id) =>
      sum + native.applications.find(row => row.id === id)!.appliedDamage, 0), 8);

    const callbacks = native.hitCallbacks!;
    const doriSales = callbacks.filter(row => row.siteId === 'dori.skill.after-sales');
    expect(doriSales.length).toBeGreaterThan(0);
    const doriRounds = doriSales.flatMap(row => row.queuedAttacks.filter(attack => attack.emitSiteId === 'dori.skill.after-sales-round'));
    expect(doriRounds).toHaveLength(3);
    const mikaShards = callbacks.filter(row => row.siteId === 'mika.skill.rimestar-shards');
    expect(mikaShards).toHaveLength(1);
    expect(mikaShards[0]!.queuedAttacks.filter(row => row.emitSiteId === 'mika.skill.rimestar-shard')).toHaveLength(1);
    const baizhuChain = callbacks.filter(row => row.siteId === 'baizhu.skill.chain.first'
      || row.siteId === 'baizhu.skill.chain.second');
    expect(baizhuChain.length).toBeGreaterThanOrEqual(2);
    const chainChildren = baizhuChain.flatMap(row => row.queuedAttacks.filter(attack => attack.emitSiteId === 'baizhu.skill.chain-child'));
    expect(chainChildren.length).toBeGreaterThanOrEqual(2);
    const naviaCannon = callbacks.filter(row => row.siteId === 'navia.skill.c2-cannon');
    expect(naviaCannon.length).toBeGreaterThan(0);
    expect(naviaCannon.flatMap(row => row.queuedAttacks.filter(attack => attack.emitSiteId === 'navia.skill.c2-cannon-attack'))).toHaveLength(1);
    const naviaFiring = native.abilityProducers?.filter(row => row.invocationId === invocations.navia.id && row.siteId === 'navia.skill.fire') ?? [];
    expect(naviaFiring).toHaveLength(1);
    expect(naviaFiring[0]!.entryFacts?.['navia.skill.selected-enemy-count']).toBe(2);

    await page.goto('/calculator');
    await expect(page.locator('#calc-import')).toBeEnabled();
    await page.locator('#calc-import').setInputFiles({
      name: 'mika-e-hit-callbacks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(runs.mika.collection)),
    });
    await expect(page.locator('[data-source-action-collection]')).toBeVisible();
    await expect(page.locator('[data-source-finite-skill-callbacks]')).toContainText(
      `已完成 ${runs.mika.analysis.finiteCast!.completedHitCallbackBatchCount} / 登记 ${runs.mika.analysis.finiteCast!.hitCallbackBatchCount}`);
    const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
    expect(exported).toEqual(runs.mika.collection);
    expect(calculateSourceHostActionCollection(exported).completeCast).toBe(true);

    const parentBatch = native.hitCallbackBatches!.find(row => row.callbackIds.includes(doriSales.find(callback => callback.queuedAttacks.length > 0)!.id));
    expect(parentBatch).toBeDefined();
    const missingBatchNative = structuredClone(native);
    missingBatchNative.hitCallbackBatches = missingBatchNative.hitCallbackBatches!.filter(row => row.id !== parentBatch!.id);
    const missingBatch = captureSourceHostFiniteSkillCollection(missingBatchNative, invocations.dori.actionSequence);
    expect(missingBatch).toBeDefined();
    expect(calculateSourceHostActionCollection(missingBatch!).completeCast).toBe(false);

    const missingCallbackNative = structuredClone(native);
    missingCallbackNative.hitCallbacks = missingCallbackNative.hitCallbacks!.filter(row => row.id !== mikaShards[0]!.id);
    expect(missingCallbackNative.hitCallbackBatches!.some(row => row.callbackIds.includes(mikaShards[0]!.id))).toBe(true);
    const missingCallback = captureSourceHostFiniteSkillCollection(missingCallbackNative, invocations.mika.actionSequence);
    expect(missingCallback).toBeDefined();
    expect(calculateSourceHostActionCollection(missingCallback!).completeCast).toBe(false);

    const missingFactNative = structuredClone(native);
    delete missingFactNative.abilityProducers!.find(row => row.id === naviaFiring[0]!.id)!.entryFacts;
    const missingFact = captureSourceHostFiniteSkillCollection(missingFactNative, invocations.navia.actionSequence);
    expect(missingFact === undefined || !calculateSourceHostActionCollection(missingFact).completeCast).toBe(true);
    expect(pageErrors).toEqual([]);

    measurements.invocations = Object.fromEntries(Object.entries(invocations).map(([character, row]) =>
      [character, { id: row.id, actionSequence: row.actionSequence, params: row.params }]));
    measurements.callbackBatches = native.hitCallbackBatches!.length;
    measurements.callbacks = callbacks.length;
    measurements.auditedCallbackCounts = { dori: doriSales.length, mika: mikaShards.length,
      baizhu: baizhuChain.length, navia: naviaCannon.length };
    measurements.childAttackCounts = { dori: doriRounds.length, mika: mikaShards[0]!.queuedAttacks.length,
      baizhu: chainChildren.length, navia: naviaCannon.flatMap(row => row.queuedAttacks).length };
    measurements.naviaSelectedEnemyCount = naviaFiring[0]!.entryFacts?.['navia.skill.selected-enemy-count'];
    measurements.applications = Object.fromEntries(Object.entries(runs).map(([character, run]) =>
      [character, { count: run.applications.length, subtotal: run.analysis.total,
        expectedRoots: run.analysis.finiteCast?.expectedRootAttackCount,
        completedRoots: run.analysis.finiteCast?.completedRootAttackCount }]));
    measurements.combinedSubtotal = combinedSubtotal;
    measurements.nativeTotalDamage = (native.result as { total_damage: number }).total_damage;
    measurements.collectionImportExportSame = true;
    measurements.missingBatchCloses = false;
    measurements.missingCallbackCloses = false;
    measurements.missingNaviaProducerFactCloses = false;
  } finally {
    await writeFile('docs/validation/source-hit-callbacks-team-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-hit-callbacks-browser-v1', measurements, pageErrors,
      scope: 'One classic four-character run with two nearby targets. Closure uses actual per-target hit callback batches and audited child queues; unrelated applications remain excluded.',
    }, null, 2) + '\n');
  }
});
