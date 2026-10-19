import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=24 ignore_burst_energy=true;
baizhu char lvl=90/90 cons=6 talent=1,1,1;
baizhu add weapon="apprenticesnotes" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active baizhu;
baizhu burst;
baizhu skill;
kaeya attack;
wait(1000);`;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runNative(page: Page): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption('classic');
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill('20260930115');
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

test('Baizhu Q owns its six shield births and exact refresh/expiry discharges across C6 replacement', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  const capturePath = 'docs/validation/source-shield-ownership-team-20260930.capture.json';
  const resultPath = 'docs/validation/source-shield-ownership-team-20260930.result.json';

  try {
    let native: SourceHostResult;
    if (process.env.GIDPS_REUSE_SHIELD_OWNERSHIP_CAPTURE === '1') {
      native = JSON.parse(await readFile(capturePath, 'utf8')) as SourceHostResult;
      measurements.nativeRunPerformed = false;
    } else {
      native = await runNative(page);
      // Preserve the complete native receipt before any ownership assertion.
      await writeFile(capturePath, JSON.stringify(native, null, 2) + '\n');
      measurements.nativeRunPerformed = true;
    }
    measurements.nativeResultArchived = true;
    measurements.rawPath = capturePath;
    expect(native.config).toBe(config);

    expect(native.shieldInstances, 'native shield lifecycle evidence must be present').toBeDefined();
    expect(native.shieldHooks, 'native shield hook evidence must be present').toBeDefined();
    const q = native.abilityInvocations?.find(row => row.characterKey === 'baizhu' && row.action === 'burst');
    const e = native.abilityInvocations?.find(row => row.characterKey === 'baizhu' && row.action === 'skill');
    expect(q, 'Baizhu Q invocation').toBeDefined();
    expect(e, 'Baizhu E invocation').toBeDefined();
    expect(q!.success).toBe(true);
    expect(e!.success).toBe(true);

    const collection = captureSourceHostFiniteSkillCollection(native, q!.actionSequence);
    expect(collection, 'Q finite-skill collection').toBeDefined();
    expect(collection!.scope).toBe('finite-skill-cast');
    const analysis = calculateSourceHostActionCollection(collection!);
    expect(analysis.completeCast, JSON.stringify(analysis.finiteCast?.reasons)).toBe(true);
    expect(analysis.finiteCast).toMatchObject({ closed: true, contract: { id: 'baizhu-burst' },
      shieldCount: 6, endedShieldCount: 6, openShieldCount: 0 });

    const qShields = native.shieldInstances!.filter(row => row.creationSiteId === 'baizhu.burst.shield'
      && row.invocationId === q!.id).sort((a, b) => a.createdFrame - b.createdFrame);
    const c6Shields = native.shieldInstances!.filter(row => row.creationSiteId === 'baizhu.c6.sprite-shield');
    expect(qShields, 'only the six Q-created shield instances belong to this Q').toHaveLength(6);
    expect(c6Shields.length, 'C6 callback must create a separate shield').toBeGreaterThan(0);
    expect(qShields.every(row => row.terminalReason !== undefined && row.terminalFrame !== undefined)).toBe(true);
    expect(qShields.some(row => row.terminalReason === 'overwritten')).toBe(true);
    expect(qShields.some(row => row.terminalReason === 'expired')).toBe(true);
    expect(qShields[0]!.createdFrame).toBe(q!.startedFrame + 81);
    expect(qShields[0]!.createdFrame).toBeLessThan(e!.startedFrame);
    const eShield = c6Shields.find(row => row.replacesInstanceId === qShields[0]!.id);
    expect(eShield,
      'E C6 shield should overwrite the already born first Q shield').toBeDefined();

    const callbacksById = new Map((native.hitCallbacks ?? []).map(row => [row.id, row]));
    const batchesById = new Map((native.hitCallbackBatches ?? []).map(row => [row.id, row]));
    const c2Shield = c6Shields.find(shield => {
      const callback = callbacksById.get(shield.creationCallbackId ?? -1);
      const batch = callback && batchesById.get(callback.batchId);
      const parentHit = native.applications.find(application => application.attackId === batch?.parentAttackId);
      const parentRequest = native.calculations.find(row => row.request.id === parentHit?.calculationId)?.request;
      return callback?.siteId === 'baizhu.c6.sprite-shield'
        && parentRequest?.actorKey === 'baizhu' && parentRequest.ability === 'Gossamer Sprite: Splice. (C2)';
    });
    expect(c2Shield, 'C2 shield birth must trace through the exact Splice callback batch').toBeDefined();
    const ownedShieldIds = new Set(analysis.finiteCast?.shieldInstanceIds);
    const relatedExcludedIds = new Set(analysis.finiteCast?.shieldRelatedExcludedInstanceIds);
    expect(qShields.every(row => ownedShieldIds.has(row.id))).toBe(true);
    expect(ownedShieldIds.has(c2Shield!.id)).toBe(false);
    expect(relatedExcludedIds.has(eShield!.id) || relatedExcludedIds.has(c2Shield!.id)).toBe(true);
    const qHooks = native.shieldHooks!.filter(row => ownedShieldIds.has(row.instanceId));
    const refreshHooks = qHooks.filter(row => row.cause === 'refresh');
    const expiryHooks = qHooks.filter(row => row.cause === 'expiry');
    expect(refreshHooks).toHaveLength(5);
    expect(expiryHooks).toHaveLength(1);
    expect(qHooks.filter(row => row.cause === 'overwrite')).toHaveLength(5);
    expect(qHooks.reduce((sum, hook) => sum + hook.queuedAttacks.length, 0)).toBe(6);
    expect(qHooks.flatMap(hook => hook.queuedAttacks).every(attack => attack.emitSiteId === 'baizhu.shield.spiritvein')).toBe(true);
    expect(analysis.finiteCast?.shieldHookCount).toBe(11);

    const included = collection!.hits.filter(hit => hit.included);
    const applications = included.map(hit => hit.calculation.originalCapture.application);
    expect(applications.length, 'Q-owned refresh/expiry discharges must include an actual hit').toBeGreaterThan(0);
    for (const hit of included)
      expect(replaySourceHostHit(hit.calculation.originalCapture).difference,
        `Spiritvein application #${hit.calculation.originalCapture.application.id} replay delta`).toBe(0);
    expect(analysis.total).toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);

    await page.goto('/calculator');
    await page.locator('#calc-import').setInputFiles({ name: 'baizhu-q-shield-ownership.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(collection)) });
    const finiteCertificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(finiteCertificate).toBeVisible();
    await expect(finiteCertificate).toHaveAttribute('data-source-finite-skill-status', 'complete');
    await expect(page.locator('[data-source-finite-skill-shields]')).toBeVisible();
    const qShieldRows = page.locator('[data-source-finite-skill-shield-instance][data-shield-owned="q"]');
    await expect(qShieldRows).toHaveCount(6);
    await expect(page.locator(`[data-source-finite-skill-shield-instance="${qShields[0]!.id}"]`))
      .toHaveAttribute('data-shield-terminal-reason', 'overwritten');
    await expect(page.locator(`[data-source-finite-skill-shield-instance="${eShield!.id}"]`))
      .toHaveAttribute('data-shield-owned', 'excluded');
    await expect(page.locator(`[data-source-finite-skill-shield-instance="${c2Shield!.id}"]`))
      .toHaveAttribute('data-shield-owned', 'excluded');
    const editor = page.locator('[data-source-action-collection]');
    const total = editor.locator('[data-source-finite-skill-total]');
    const totalBeforeEdit = await total.innerText();
    const scaling = editor.locator('[data-source-action-editor] [data-source-host-input="scaling"]').first();
    const scalingBefore = Number(await scaling.inputValue());
    await scaling.fill(String(scalingBefore + 0.01));
    await expect(total).not.toHaveText(totalBeforeEdit);
    const edited = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
    expect(calculateSourceHostActionCollection(edited).total).not.toBe(analysis.total);
    await page.locator('#calc-import').setInputFiles({ name: 'baizhu-q-shield-edited.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
    await expect(page.locator('[data-source-action-collection]')).toBeVisible();
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(edited);

    const missingBirthNative = structuredClone(native);
    missingBirthNative.shieldInstances = missingBirthNative.shieldInstances!.filter(row => row.id !== qShields[0]!.id);
    const missingBirthCollection = captureSourceHostFiniteSkillCollection(missingBirthNative, q!.actionSequence);
    expect(missingBirthCollection).toBeDefined();
    const missingBirth = calculateSourceHostActionCollection(missingBirthCollection!);
    expect(missingBirth.completeCast, JSON.stringify(missingBirth.finiteCast?.reasons)).toBe(false);

    const finalQShield = qShields.find(row => row.terminalReason === 'expired')!;
    const expiryHook = native.shieldHooks!.find(row => row.instanceId === finalQShield.id
      && row.cause === 'expiry');
    expect(expiryHook, 'final Q shield must carry its native expiry hook').toBeDefined();
    const missingHookNative = structuredClone(native);
    missingHookNative.shieldHooks = missingHookNative.shieldHooks!.filter(row => row.id !== expiryHook!.id);
    const missingHookCollection = captureSourceHostFiniteSkillCollection(missingHookNative, q!.actionSequence);
    expect(missingHookCollection).toBeDefined();
    const missingHook = calculateSourceHostActionCollection(missingHookCollection!);
    expect(missingHook.completeCast, JSON.stringify(missingHook.finiteCast?.reasons)).toBe(false);

    const c2Parent = native.applications.find(application => application.attackId ===
      batchesById.get(callbacksById.get(c2Shield!.creationCallbackId!)!.batchId)?.parentAttackId);
    const c2ParentRequest = native.calculations.find(row => row.request.id === c2Parent?.calculationId)?.request;
    measurements.baizhuQ = {
      invocationId: q!.id, actionSequence: q!.actionSequence,
      firstQShieldFrame: qShields[0]!.createdFrame, qActionFrame: q!.startedFrame, eActionFrame: e!.startedFrame,
      qShieldIds: qShields.map(row => row.id),
      qShieldTerminals: qShields.map(row => ({ id: row.id, reason: row.terminalReason,
        terminalFrame: row.terminalFrame, replacesInstanceId: row.replacesInstanceId })),
      c6ShieldIds: c6Shields.map(row => row.id), c2ShieldId: c2Shield!.id,
      c2CallbackId: c2Shield!.creationCallbackId, c2TriggerAttackId: c2Parent?.attackId,
      c2ParentAbility: c2ParentRequest?.ability,
      finiteCast: analysis.finiteCast, includedHitCount: applications.length,
      componentSubtotal: analysis.total, appliedDamageSubtotal: applications.reduce((sum, application) => sum + application.appliedDamage, 0),
      replayDifferences: included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference),
      missingBirthClosed: missingBirth.completeCast, missingBirthReasons: missingBirth.finiteCast?.reasons,
      missingExpiryHookClosed: missingHook.completeCast, missingExpiryHookReasons: missingHook.finiteCast?.reasons,
      originUiEditedAndRoundTripped: true,
    };
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-shield-ownership-browser-v1',
      measurements, pageErrors,
      scope: 'One classic Baizhu C6 native run covers Q-owned shield birth/refresh/expiry, E and C2 C6-created shield replacements, and exact Q ownership. No enemy-damage break or all-character shield behavior is established.' }, null, 2) + '\n');
  }
});
