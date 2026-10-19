import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=50 ignore_burst_energy=true;
raiden char lvl=90/90 cons=0 talent=1,1,1;
raiden add weapon="beginnersprotector" refine=1 lvl=1/20;
hutao char lvl=90/90 cons=0 talent=1,1,1;
hutao add weapon="whitetassel" refine=1 lvl=1/20;
yanfei char lvl=90/90 cons=0 talent=1,1,1;
yanfei add weapon="apprenticesnotes" refine=1 lvl=1/20;
mika char lvl=90/90 cons=0 talent=1,1,1;
mika add weapon="beginnersprotector" refine=1 lvl=1/20;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0,2.4;
active raiden;
phase("rotation");
raiden skill;
hutao skill;
hutao attack;
hutao charge;
phase("hutao charge");
yanfei burst;
phase("yanfei burst");
mika burst;
phase("mika burst");
mika attack;
wait(1900);
phase("end");`;

const seed = '20261003130';
const baselinePath = 'docs/validation/source-animation-eye-frontier-20261003.baseline.json';
const capturePath = 'docs/validation/source-animation-eye-frontier-20261003.capture.json';
const resultPath = 'docs/validation/source-animation-eye-frontier-20261003.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-animation-eye-frontier-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runNative(page: Page, lane: Lane): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption(lane);
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill(seed);
  await page.locator('#source-host-phase-enabled').check();
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 120_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

function objects(value: unknown): Row[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  const row = value as Row;
  return [row, ...Object.values(row).flatMap(objects)];
}

function applicationProjection(result: SourceHostResult): Row[] {
  return result.applications.map(application => {
    const { frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin } = application;
    if (origin === undefined) return { frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit };
    const { statusOwner: _statusOwner, ...lineage } = origin;
    return { frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin: lineage };
  });
}

function statusOwnerGeneratorLinks(result: SourceHostResult): Row[] {
  const generators = result.ownedGenerators ?? [];
  return result.applications.flatMap(application => {
    const owner = application.origin?.statusOwner;
    if (owner === undefined) return [];
    const generator = generators.find(row => row.statusInstanceId === owner.instanceId);
    return [{ applicationId: application.id, owner, generatorStatusInstanceId: generator?.statusInstanceId,
      generatorActorIndex: generator?.actorIndex, generatorHolderActorIndex: generator?.holderActorIndex }];
  });
}

function actionLogs(result: SourceHostResult): Row[] {
  const logs = (Array.isArray(result.logs) ? result.logs : []) as Row[];
  return logs.filter(row => row.event === 'action')
    .map(row => ({ frame: row.frame, ended: row.ended, characterIndex: row.char_index, message: row.msg, values: row.logs }));
}

function phaseRows(result: SourceHostResult): Row[] {
  return (result.phaseObservations ?? []).flatMap(observation => objects(observation.normalizedState));
}

function phaseFrames(result: SourceHostResult): number[] {
  return (result.phaseObservations ?? []).map(observation => observation.frame);
}

function phasePlayerState(result: SourceHostResult): Row[] {
  return (result.phaseObservations ?? []).map(observation => {
    const player = observation.normalizedState.player as Row | undefined;
    return { frame: observation.frame, activeCharacter: player?.activeCharacter, airborneSource: player?.airborneSource,
      characterPositions: player?.characterPositions, dashCooldownRemaining: player?.dashCooldownRemaining,
      dashLockout: player?.dashLockout, hitlagEnabled: player?.hitlagEnabled, lastAction: player?.lastAction,
      lastStaminaUseAgo: player?.lastStaminaUseAgo, moonridgeDew: player?.moonridgeDew,
      partialDewCount: player?.partialDewCount, stamina: player?.stamina, staminaModifiers: player?.staminaModifiers,
      swapCooldown: player?.swapCooldown, swapInterval: player?.swapInterval, verdantDew: player?.verdantDew,
      verdantDewExpiryRemaining: player?.verdantDewExpiryRemaining };
  });
}

function finiteBurst(result: SourceHostResult, characterKey: 'yanfei' | 'mika', rootCount: 1 | 0) {
  const invocation = (result.abilityInvocations ?? []).find(row => row.characterKey === characterKey && row.action === 'burst');
  expect(invocation, `${characterKey} Q invocation`).toBeDefined();
  expect(invocation!.success, `${characterKey} Q succeeds`).toBe(true);
  const collection = captureSourceHostFiniteSkillCollection(result, invocation!.actionSequence);
  expect(collection, `${characterKey} Q finite root collection`).toBeDefined();
  expect(collection!.scope).toBe('finite-skill-cast');
  const analysis = calculateSourceHostActionCollection(collection!);
  const replays = collection!.hits.filter(hit => hit.included)
    .map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
  expect(analysis.finiteCast?.expectedRootAttackCount, `${characterKey} Q audited root count`).toBe(rootCount);
  expect(analysis.finiteCast?.observedRootAttackCount, `${characterKey} Q captured root count`).toBe(rootCount);
  expect(analysis.completeCast, `${characterKey} Q finite closure reasons=${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
  expect(analysis.finiteCast?.closed, `${characterKey} Q finite cast closure`).toBe(true);
  expect(replays, `${characterKey} Q real captured-hit replay deltas`).toEqual(replays.map(() => 0));
  expect(collection!.hits.filter(hit => hit.included)).toHaveLength(rootCount);
  return { invocation: invocation!, collection: collection!, analysis, replays };
}

test('source animation callback and normalized-time phase frontier preserves the combined scene', async ({ page }) => {
  test.setTimeout(540_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Row = { config, seed, baselinePath, capturePath, runs: [],
    scope: 'One combined C0 Raiden E / Hu Tao E and attack/charge / Yanfei Q / Mika Q and normal / wait scene in each source lane. Native receipts are archived before assertions; unknown actor gaps remain measured and do not imply complete phase state.' };
  const summaries: Row[] = [];
  measurements.runs = summaries;
  const save = () => writeFile(resultPath, JSON.stringify({ measurements, pageErrors }, null, 2) + '\n');

  try {
    if (process.env.GIDPS_CAPTURE_FRONTIER_BASELINE === '1') {
      const baseline: Archive = { schemaVersion: 'source-animation-eye-frontier-native-v1', runs: {} };
      for (const lane of lanes) {
        baseline.runs[lane] = await runNative(page, lane);
        await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
      }
      measurements.mode = 'both-lane-pre-130-baseline';
      measurements.nativeRunsPerformed = true;
      measurements.baseline = Object.fromEntries(lanes.map(lane => {
        const native = baseline.runs[lane]!;
        return [lane, { sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
          config: native.config, seed: native.seed, applicationCount: native.applications.length,
          actionLogCount: actionLogs(native).length, phaseFrames: phaseFrames(native), playerState: phasePlayerState(native) }];
      }));
      await save();
      for (const lane of lanes) {
        const native = baseline.runs[lane]!;
        expect(native.config, `${lane} baseline config`).toBe(config);
        expect(native.seed, `${lane} baseline seed`).toBe(seed);
        expect(actionLogs(native), `${lane} baseline source action logs`).not.toHaveLength(0);
      }
      expect(pageErrors).toEqual([]);
      return;
    }

    let archive: Archive;
    if (process.env.GIDPS_REUSE_FRONTIER_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-animation-eye-frontier-native-v1', runs: {} };
      measurements.nativeRunsPerformed = true;
      for (const lane of lanes) {
        archive.runs[lane] = await runNative(page, lane);
        // Save each full lane receipt immediately so it can be reused after an assertion failure.
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
    }
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Archive;

    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      const before = baseline.runs[lane]!;
      const observations = native.phaseObservations ?? [];
      const rows = phaseRows(native);
      const gaps = [...new Set(observations.flatMap(row => row.coverage.gaps))];
      const removed = rows.filter(row => row.source === 'internal/characters/hutao/charge.go:ppChargeAttack:OnRemoved');
      const removedCaptured = removed.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const normalized = rows.filter(row => row.source === 'pkg/core/action/sourcehost_animation_funcs.go:NormalizedForNextAction');
      const invocations = native.abilityInvocations ?? [];
      const raidenSkill = invocations.find(row => row.characterKey === 'raidenshogun' && row.action === 'skill');
      const hutaoSkill = invocations.find(row => row.characterKey === 'hutao' && row.action === 'skill');
      const yanfeiQ = finiteBurst(native, 'yanfei', 1);
      const mikaQ = finiteBurst(native, 'mika', 0);
      const statusOwnerLinks = statusOwnerGeneratorLinks(native);
      const raidenSkillCollection = raidenSkill === undefined ? undefined
        : captureSourceHostFiniteSkillCollection(native, raidenSkill.actionSequence);
      const raidenSkillAnalysis = raidenSkillCollection === undefined
        ? undefined : calculateSourceHostActionCollection(raidenSkillCollection);
      const raidenSkillReplays = raidenSkillCollection?.hits.filter(hit => hit.included)
        .map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference) ?? [];
      const summary: Row = { lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        applicationCount: native.applications.length, applications: applicationProjection(native),
        statusOwnerGeneratorLinks: statusOwnerLinks,
        actionLogCount: actionLogs(native).length, phaseFrames: phaseFrames(native), playerState: phasePlayerState(native),
        phaseObservations: observations.length, phaseDescriptors: { hutaoRemovedCallback: removed,
          normalizedForNextAction: normalized }, unknownGaps: gaps,
        normalizedForNextActionSampled: normalized.length > 0,
        fullPhaseCoverage: observations.length > 0 && observations.every(row => row.coverage.complete && row.coverage.gaps.length === 0),
        finiteCasts: { yanfeiQ: { contractId: yanfeiQ.analysis.finiteCast?.contract?.id,
          expectedRootAttackCount: yanfeiQ.analysis.finiteCast?.expectedRootAttackCount,
          observedRootAttackCount: yanfeiQ.analysis.finiteCast?.observedRootAttackCount,
          hits: yanfeiQ.collection.hits.length, replayDeltas: yanfeiQ.replays,
          completeCast: yanfeiQ.analysis.completeCast },
        mikaQ: { contractId: mikaQ.analysis.finiteCast?.contract?.id,
          expectedRootAttackCount: mikaQ.analysis.finiteCast?.expectedRootAttackCount,
          observedRootAttackCount: mikaQ.analysis.finiteCast?.observedRootAttackCount,
          hits: mikaQ.collection.hits.length, replayDeltas: mikaQ.replays,
          completeCast: mikaQ.analysis.completeCast } },
        raidenSkillFiniteContract: raidenSkillAnalysis?.finiteCast?.contract?.id ?? null,
        raidenSkillFinite: raidenSkillAnalysis === undefined ? null : { completeCast: raidenSkillAnalysis.completeCast,
          closed: raidenSkillAnalysis.finiteCast?.closed, includedHits: raidenSkillCollection!.hits.filter(hit => hit.included).length,
          replayDeltas: raidenSkillReplays },
        baselineComparison: { applicationsEqual: JSON.stringify(applicationProjection(native)) === JSON.stringify(applicationProjection(before)),
          actionLogsNonempty: actionLogs(native).length > 0,
          phaseFramesEqual: JSON.stringify(phaseFrames(native)) === JSON.stringify(phaseFrames(before)),
          playerStateEqual: JSON.stringify(phasePlayerState(native)) === JSON.stringify(phasePlayerState(before)) } };
      summaries.push(summary);
      await save();

      expect(native.config, `${lane} final config`).toBe(config);
      expect(native.seed, `${lane} final seed`).toBe(seed);
      expect(actionLogs(native), `${lane} final action log projection is nonempty`).not.toHaveLength(0);
      expect(actionLogs(before), `${lane} baseline action log projection is nonempty`).not.toHaveLength(0);
      expect(actionLogs(native), `${lane} source action logs match baseline`).toEqual(actionLogs(before));
      expect(applicationProjection(native), `${lane} complete damage/origin applications match baseline`)
        .toEqual(applicationProjection(before));
      expect(statusOwnerLinks.length, `${lane} captured status-owner origins`).toBeGreaterThan(0);
      for (const link of statusOwnerLinks) {
        expect(link.generatorStatusInstanceId, `${lane} status owner maps to an actual owned generator`).toBe((link.owner as Row).instanceId);
        expect(link.generatorHolderActorIndex, `${lane} owned generator retains the actual status holder actor`).toBe((link.owner as Row).actorIndex);
        expect(link.generatorActorIndex, `${lane} owned generator retains the Raiden caster`).toBe(raidenSkill?.actorIndex);
      }
      expect(phaseFrames(native), `${lane} phase frames match baseline`).toEqual(phaseFrames(before));
      expect(phasePlayerState(native), `${lane} player phase state matches baseline`).toEqual(phasePlayerState(before));
      expect(native.phaseObservation, `${lane} phase observation policy`).toEqual(before.phaseObservation);
      expect(observations.length, `${lane} sampled phase observations`).toBeGreaterThan(0);
      expect(removedCaptured.some(captured => {
        const actor = captured.actor as Row | undefined;
        const implementation = captured.implementation;
        return actor?.sharedStateOwner === 'characterWrapper' && actor.characterIndex === 1
          && implementation !== undefined && typeof implementation === 'object';
      }), `${lane} Hu Tao OnRemoved receipt contains captured actor and implementation`).toBe(true);
      expect(observations.some(row => !row.coverage.complete), `${lane} full phase state remains incomplete`).toBe(true);
      expect(gaps.length, `${lane} unknown source gaps remain explicitly measured`).toBeGreaterThan(0);
      expect(yanfeiQ.analysis.finiteCast?.contract?.id, `${lane} Yanfei Q finite contract`).toBe('yanfei-burst');
      expect(mikaQ.analysis.finiteCast?.contract?.id, `${lane} Mika Q finite contract`).toBe('mika-burst');
      expect(raidenSkillCollection, `${lane} Raiden E finite collection`).toBeDefined();
      expect(raidenSkillAnalysis?.finiteCast?.contract?.id, `${lane} Raiden E finite contract`).toBe('raiden-skill');
      expect(raidenSkillAnalysis?.completeCast, `${lane} Raiden E finite closure reasons=${JSON.stringify(raidenSkillAnalysis?.finiteCast?.reasons)}`).toBe(true);
      expect(raidenSkillAnalysis?.finiteCast?.closed, `${lane} Raiden E ownership closure`).toBe(true);
      expect(raidenSkillReplays, `${lane} Raiden E all included-hit replay deltas`).toEqual(raidenSkillReplays.map(() => 0));
      expect(raidenSkill, `${lane} Raiden E action receipt exists`).toBeDefined();
      expect(hutaoSkill, `${lane} Hu Tao E action receipt exists`).toBeDefined();

      if (lane === 'classic') {
        await page.goto('/calculator');
        await page.locator('#calc-import').setInputFiles({ name: 'raiden-e-owned-skill.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(raidenSkillCollection)) });
        await expect(page.locator('[data-source-finite-skill-certificate]'))
          .toHaveAttribute('data-source-finite-skill-status', 'complete');
        await expect(page.locator('[data-source-finite-skill-generator]')).toHaveCount(4);
        await expect(page.locator('[data-source-finite-skill-generator-details]')).toContainText('持有者人数不代表协同攻击次数');
        const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
        expect(exported).toEqual(raidenSkillCollection);
        await page.locator('#calc-import').setInputFiles({ name: 'raiden-e-owned-skill-roundtrip.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(exported)) });
        expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(exported);
      }
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await save();
  }
});
