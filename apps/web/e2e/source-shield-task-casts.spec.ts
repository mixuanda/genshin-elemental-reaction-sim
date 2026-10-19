import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=30 ignore_burst_energy=true;
noelle char lvl=90/90 cons=4 talent=1,1,1;
noelle add weapon="debateclub" refine=1 lvl=1/20;
xinyan char lvl=90/90 cons=2 talent=1,1,1;
xinyan add weapon="debateclub" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0.5,2;
active noelle;
noelle skill;
xinyan skill;
wait(150);
xinyan burst;
wait(900);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runNative(page: Page): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption('classic');
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill('20260930116');
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

test('Noelle and Xinyan skill casts close their native shield callback and recursive task lifecycles', async ({ page }) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-shield-task-casts-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-shield-task-casts-team-20260930.result.json';

  try {
    let native: SourceHostResult;
    if (process.env.GIDPS_REUSE_SHIELD_TASK_CAST_CAPTURE === '1') {
      native = JSON.parse(await readFile(capturePath, 'utf8')) as SourceHostResult;
      measurements.nativeRunPerformed = false;
    } else {
      native = await runNative(page);
      // Keep the complete native receipt before any detailed assertion.
      await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n');
      measurements.nativeRunPerformed = true;
    }
    measurements.rawPath = capturePath;
    measurements.nativeResultArchived = true;
    expect(native.config).toBe(config);
    expect(native.shieldInstances).toBeDefined();
    expect(native.shieldHooks).toBeDefined();
    expect(native.shieldProducers).toBeDefined();

    const invocation = (characterKey: string, action: string) => native.abilityInvocations?.find(row =>
      row.characterKey === characterKey && row.action === action);
    const noelle = invocation('noelle', 'skill');
    const xinyanE = invocation('xinyan', 'skill');
    const xinyanQ = invocation('xinyan', 'burst');
    expect(noelle, 'Noelle C4 E').toBeDefined();
    expect(xinyanE, 'Xinyan C2 E').toBeDefined();
    expect(xinyanQ, 'Xinyan C2 Q').toBeDefined();
    expect(noelle!.success && xinyanE!.success && xinyanQ!.success).toBe(true);

    const collections = [
      { key: 'noelleE', invocation: noelle!, contract: 'noelle-skill' },
      { key: 'xinyanE', invocation: xinyanE!, contract: 'xinyan-skill' },
      { key: 'xinyanQ', invocation: xinyanQ!, contract: 'xinyan-burst' },
    ].map(item => {
      const collection = captureSourceHostFiniteSkillCollection(native, item.invocation.actionSequence);
      expect(collection, `${item.key} finite-skill collection`).toBeDefined();
      expect(collection!.scope).toBe('finite-skill-cast');
      const analysis = calculateSourceHostActionCollection(collection!);
      expect(analysis.finiteCast?.contract?.id, `${item.key} finite-cast contract`).toBe(item.contract);
      expect(analysis.completeCast, `${item.key}: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
      const included = collection!.hits.filter(hit => hit.included);
      const applications = included.map(hit => hit.calculation.originalCapture.application);
      expect(applications.length, `${item.key} must contain real captured hits`).toBeGreaterThan(0);
      for (const hit of included)
        expect(replaySourceHostHit(hit.calculation.originalCapture).difference,
          `${item.key} application #${hit.calculation.originalCapture.application.id} replay delta`).toBe(0);
      expect(analysis.total, `${item.key} component subtotal vs captured applied damage`)
        .toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
      return { ...item, collection: collection!, analysis, included, applications };
    });

    const noelleCase = collections[0]!;
    const noelleShield = native.shieldInstances!.find(row => row.invocationId === noelle!.id
      && row.creationSiteId === 'noelle.skill.shield');
    expect(noelleShield, 'Noelle E shield instance owned by the selected invocation').toBeDefined();
    expect(noelleShield!.terminalReason).toBe('expired');
    const noelleExpiry = native.shieldHooks!.find(row => row.instanceId === noelleShield!.id && row.cause === 'expiry');
    expect(noelleExpiry, 'the exact expired Noelle shield must dispatch its C4 terminal hook').toBeDefined();
    expect(noelleExpiry!.queuedAttacks).toHaveLength(1);
    expect(noelleExpiry!.queuedAttacks[0]!.emitSiteId).toBe('noelle.shield.explosion');
    const noelleFallback = native.abilityProducers?.find(row => row.invocationId === noelle!.id
      && row.siteId === 'noelle.skill.c4-timer');
    expect(noelleFallback, 'Noelle E C4 expiry fallback task receipt').toBeDefined();
    expect(noelleFallback!.state).toBe('completed');
    expect(noelleFallback!.entryFacts?.['noelle.skill.c4-timer.attack-count']).toBe(0);
    expect(noelleFallback!.queuedAttacks).toHaveLength(0);

    const xinyanECase = collections[1]!;
    const xinyanQCase = collections[2]!;
    const xinyanEShields = native.shieldInstances!.filter(row => row.invocationId === xinyanE!.id
      && row.creationSiteId !== undefined && row.creationSiteId.startsWith('xinyan.skill.'));
    const xinyanQShields = native.shieldInstances!.filter(row => row.invocationId === xinyanQ!.id
      && row.creationSiteId === 'xinyan.burst.c2-shield-birth');
    expect(xinyanEShields.length, 'E-created Xinyan shield instances').toBeGreaterThan(0);
    expect(xinyanQShields.length, 'Q C2-created Xinyan shield instances').toBeGreaterThan(0);
    expect(xinyanEShields.some(row => row.terminalReason === 'overwritten')).toBe(true);
    expect(xinyanQShields.some(row => row.terminalReason === 'expired')).toBe(true);
    const eOwnedIds = new Set(xinyanECase.analysis.finiteCast?.shieldInstanceIds);
    const qOwnedIds = new Set(xinyanQCase.analysis.finiteCast?.shieldInstanceIds);
    expect(xinyanEShields.every(row => eOwnedIds.has(row.id))).toBe(true);
    expect(xinyanQShields.every(row => qOwnedIds.has(row.id))).toBe(true);
    const initialEAttack = xinyanE!.queuedAttacks[0];
    const initialEBatchIds = new Set(native.hitCallbackBatches!.filter(batch =>
      batch.parentQueueId === initialEAttack?.queueId && batch.parentAttackId === initialEAttack?.attackId)
      .map(batch => batch.id));
    const xinyanEShieldCallbacks = native.hitCallbacks!.filter(callback => initialEBatchIds.has(callback.batchId)
      && callback.callbackIndex === 0 && callback.siteId === 'xinyan.skill.shield-hit-callback');
    expect(xinyanECase.analysis.finiteCast?.hitCallbackCount,
      'the full selected invocation callback count includes the E and Q dispatches').toBe(8);
    expect(xinyanEShieldCallbacks,
      'the two actual in-range E target callbacks should each create one shield upgrade').toHaveLength(2);
    const eShieldProducers = native.shieldProducers!.filter(row => row.ownerInstanceId !== undefined
      && eOwnedIds.has(row.ownerInstanceId));
    const eDotProducers = eShieldProducers.filter(row => row.siteId === 'xinyan.shield.dot-next-task');
    const eLastStop = eDotProducers.find(row => row.state === 'completed'
      && row.entryFacts?.['xinyan.shield.dot.attack-count'] === 0 && row.queuedAttacks.length === 0
      && !native.shieldProducers!.some(child => child.parentProducerId === row.id));
    expect(eLastStop, 'Xinyan E recursive chain needs an observed terminal no-op task').toBeDefined();
    const eCallbacks = xinyanECase.analysis.finiteCast?.hitCallbackCount;
    const eUpgradeProducers = native.abilityProducers!.filter(row => row.invocationId === xinyanE!.id
      && row.siteId === 'xinyan.skill.hit-shield-upgrade-task');
    expect(eUpgradeProducers, 'the two actual shield-hit callbacks must each create an upgrade task').toHaveLength(2);
    expect(eUpgradeProducers.every(row => xinyanEShieldCallbacks.some(callback =>
      callback.id === row.parentHitCallbackId))).toBe(true);
    const missingLastStop = structuredClone(native);
    missingLastStop.shieldProducers = missingLastStop.shieldProducers!.filter(row => row.id !== eLastStop!.id);
    const incompleteE = captureSourceHostFiniteSkillCollection(missingLastStop, xinyanE!.actionSequence);
    expect(incompleteE).toBeDefined();
    const incompleteAnalysis = calculateSourceHostActionCollection(incompleteE!);
    expect(incompleteAnalysis.completeCast, JSON.stringify(incompleteAnalysis.finiteCast?.reasons)).toBe(false);

    // One finite calculator round-trip exercises the callback-owned E shield chain.
    await page.goto('/calculator');
    await page.locator('#calc-import').setInputFiles({ name: 'xinyan-e-shield-tasks.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(xinyanECase.collection)) });
    const certificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(certificate).toBeVisible();
    await expect(certificate).toHaveAttribute('data-source-finite-skill-status', 'complete');
    await expect(page.locator('[data-source-finite-skill-shields]')).toBeVisible();
    await page.locator('[data-source-finite-skill-shields] > details > summary').click();
    await expect(page.locator('[data-source-finite-skill-shield-producers]')).toBeVisible();
    await page.locator('[data-source-finite-skill-shield-producer-details] > summary').click();
    await expect(page.locator('[data-source-finite-skill-shield-producer]')).toHaveCount(eShieldProducers.length);
    if (eShieldProducers.length > 0)
      await expect(page.locator('[data-source-finite-skill-shield-producer]').first()).toBeVisible();
    const editor = page.locator('[data-source-action-collection]');
    const total = editor.locator('[data-source-finite-skill-total]');
    const totalBeforeEdit = await total.innerText();
    const scaling = editor.locator('[data-source-action-editor] [data-source-host-input="scaling"]').first();
    const scalingBefore = Number(await scaling.inputValue());
    await scaling.fill(String(scalingBefore + 0.01));
    await expect(total).not.toHaveText(totalBeforeEdit);
    const edited = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
    expect(calculateSourceHostActionCollection(edited).total).not.toBe(xinyanECase.analysis.total);
    await page.locator('#calc-import').setInputFiles({ name: 'xinyan-e-shield-tasks-edited.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(edited);

    measurements.casts = collections.map(item => ({
      key: item.key, contractId: item.analysis.finiteCast?.contract?.id,
      completeCast: item.analysis.completeCast, finiteCast: item.analysis.finiteCast,
      hitCount: item.applications.length, componentSubtotal: item.analysis.total,
      appliedDamageSubtotal: item.applications.reduce((sum, application) => sum + application.appliedDamage, 0),
      replayDifferences: item.included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference),
    }));
    measurements.noelleC4 = {
      shieldId: noelleShield!.id, terminalFrame: noelleShield!.terminalFrame,
      terminalReason: noelleShield!.terminalReason, expiryHookId: noelleExpiry!.id,
      hookEmitSite: noelleExpiry!.queuedAttacks[0]!.emitSiteId,
      fallbackProducerId: noelleFallback!.id, fallbackEntryFacts: noelleFallback!.entryFacts,
      fallbackQueuedAttacks: noelleFallback!.queuedAttacks.length,
    };
    measurements.xinyan = {
      eShieldIds: xinyanEShields.map(row => row.id), qShieldIds: xinyanQShields.map(row => row.id),
      eShieldTerminals: xinyanEShields.map(row => ({ id: row.id, reason: row.terminalReason,
        frame: row.terminalFrame, replacedBy: row.replacedByInstanceId })),
      qShieldTerminals: xinyanQShields.map(row => ({ id: row.id, reason: row.terminalReason,
        frame: row.terminalFrame, replacedBy: row.replacedByInstanceId })),
      eShieldProducers, invocationHitCallbackCount: eCallbacks,
      eShieldHitCallbackIds: xinyanEShieldCallbacks.map(callback => callback.id),
      eUpgradeProducerIds: eUpgradeProducers.map(row => row.id),
      terminalStopProducer: eLastStop!.id,
      missingTerminalProducerClosed: incompleteAnalysis.completeCast,
      missingTerminalProducerReasons: incompleteAnalysis.finiteCast?.reasons,
    };
    measurements.xinyanEOriginUiEditExportImport = true;
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-shield-task-casts-browser-v1',
      measurements, pageErrors,
      scope: 'One classic two-target run selects Noelle C4 E, Xinyan C2 E, and Xinyan C2 Q finite captures. It observes Noelle expiry/fallback behavior and the selected Xinyan shield task chains; it does not establish other character shields or damage-break outcomes.' }, null, 2) + '\n');
  }
});
