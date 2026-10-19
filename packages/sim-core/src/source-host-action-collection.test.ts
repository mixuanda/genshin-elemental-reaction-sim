import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { sourceHostResultSchema } from './source-host-wire';
import { summarizeSourceHostActionOrigins, captureSourceHostActionCollection, calculateSourceHostActionCollection } from './source-host-action-collection';

const archived = JSON.parse(readFileSync(new URL('../../../docs/validation/source-host-stellar-20260927.result.json', import.meta.url), 'utf8'));
function fixture() {
  const result = sourceHostResultSchema.parse(structuredClone(archived));
  const receipt = (sequence: number, msg: string) => ({ event: 'action', frame: sequence, msg, logs: { sequence, characterKey: 'test', action: 'skill' } });
  result.logs = [1, 2].flatMap(sequence => [receipt(sequence, 'source-host action queued'), receipt(sequence, 'source-host action accepted')]);
  // Synthetic lineage only. The arithmetic is a prior real capture; these associations are not game evidence.
  for (const application of result.applications.slice(0, 2)) {
    const record = result.calculations.find(row => row.request.id === application.calculationId)!;
    record.request.origin = { via: 'event-callback', creationActionSequence: 1, triggerActionSequence: 2 };
    application.origin = record.request.origin;
  }
  return result;
}
it('keeps creation/trigger associations separate and leaves legacy hits unassigned', () => {
  const legacy = summarizeSourceHostActionOrigins(sourceHostResultSchema.parse(archived));
  expect(legacy.legacy).toBe(true);
  expect(legacy.unassignedApplicationIds).toHaveLength(archived.applications.length);
  const result = fixture(), summary = summarizeSourceHostActionOrigins(result);
  expect(summary.groups[0]!.creationApplicationIds).toHaveLength(2);
  expect(summary.groups[0]!.triggerApplicationIds).toHaveLength(0);
  expect(summary.groups[1]!.triggerApplicationIds).toHaveLength(2);
  expect(summary.groups[1]!.creationApplicationIds).toHaveLength(0);
  expect(() => captureSourceHostActionCollection(result, 2, 'creation')).toThrow(/没有记录到/);
  result.applications[0]!.origin = { via: 'unassigned' };
  expect(summarizeSourceHostActionOrigins(result).groups[0]!.creationApplicationIds).toHaveLength(1);
});
it('sums per-hit shared calculations, retains edits/exclusions on JSON restore, and rejects duplicated or misassociated hits', () => {
  const collection = captureSourceHostActionCollection(fixture(), 1, 'creation');
  const original = calculateSourceHostActionCollection(collection);
  expect(original.total).toBe(original.originalRawTotal);
  collection.hits[0]!.included = false;
  const request = collection.hits[1]!.calculation.request;
  if (request.kind !== 'damage') throw new Error('Expected an ordinary archived hit');
  request.input.damageBonus += 0.2;
  const edited = calculateSourceHostActionCollection(JSON.parse(JSON.stringify(collection)));
  expect(edited.total).toBe(edited.rows[1]!.value);
  expect(edited.total).toBeGreaterThan(edited.rows[1]!.originalRawDamage);
  expect(edited.trace[0]!.inputs).toHaveLength(1);
  expect(edited.trace[0]!.result!.value).toBe(edited.total);
  expect(collection.scope).toBe('observed-action-hits');
  expect(() => calculateSourceHostActionCollection({ ...collection, hits: [...collection.hits, collection.hits[1]] })).toThrow(/重复/);
  expect(() => calculateSourceHostActionCollection({ ...collection, association: 'trigger' })).toThrow(/没有所选动作/);
});

it('groups explicit status activation independently from callback ancestry and restores the observed collection', () => {
  const result = fixture();
  for (const [index, application] of result.applications.slice(0, 2).entries()) {
    application.origin = { via: 'event-callback', triggerActionSequence: 2,
      statusOwner: { actorIndex: 0, statusKey: 'synthetic-active-status', instanceId: index + 1, createdFrame: 1, creationActionSequence: 1 } };
  }
  result.attackObservations = result.applications.slice(0, 2).map(application => ({ stage: 'resolved', frame: application.frame, origin: application.origin! }));
  result.lifecycleObservationFrame = 100;
  result.statusInstances = [
    { ...result.applications[0]!.origin!.statusOwner!, initialExpiryFrame: 90, finalExpiryFrame: 95, endState: 'replaced', endFrame: 50, replacedByInstanceId: 2, nativeOverwrite: false },
    { ...result.applications[1]!.origin!.statusOwner!, initialExpiryFrame: 130, finalExpiryFrame: 150, endState: 'active-at-end', endFrame: 100, nativeOverwrite: true },
    { actorIndex: 1, statusKey: 'other-status', instanceId: 3, createdFrame: 2, creationActionSequence: 2, initialExpiryFrame: 10, finalExpiryFrame: 10, endState: 'expired-at-end', endFrame: 100 },
  ];
  result.pendingAttackStages = [
    { id: 1, stage: 'snapshot', queuedFrame: 90, dueFrame: 120, origin: result.applications[1]!.origin! },
    { id: 2, stage: 'application', queuedFrame: 90, dueFrame: 120, attackId: 99, origin: { via: 'action', creationActionSequence: 2, triggerActionSequence: 2 } },
  ];
  const summary = summarizeSourceHostActionOrigins(result);
  expect(summary.groups[0]!.creationApplicationIds).toHaveLength(0);
  expect(summary.groups[0]!.statusOwnerApplicationIds).toHaveLength(2);
  expect(summary.groups[1]!.triggerApplicationIds).toHaveLength(2);
  const collection = captureSourceHostActionCollection(result, 1, 'status-owner');
  expect(collection.attackObservations).toHaveLength(2);
  expect(collection.lifecycleObservationFrame).toBe(100);
  expect(collection.statusInstances?.map(row => row.instanceId)).toEqual([1, 2]);
  expect(collection.pendingAttackStages?.map(row => row.id)).toEqual([1]);
  expect(collection.hits.map(hit => hit.calculation.originalCapture.application.origin?.statusOwner?.instanceId)).toEqual([1, 2]);
  const restored = calculateSourceHostActionCollection(JSON.parse(JSON.stringify(collection)));
  expect(restored.total).toBe(restored.originalRawTotal);
  expect(restored.document.statusInstances).toEqual(collection.statusInstances);
  expect(restored.document.pendingAttackStages).toEqual(collection.pendingAttackStages);
  expect(() => calculateSourceHostActionCollection({ ...collection, association: 'creation' })).toThrow(/没有所选动作/);
  delete result.applications[0]!.origin!.statusOwner!.creationActionSequence;
  expect(summarizeSourceHostActionOrigins(result).groups[0]!.statusOwnerApplicationIds).toHaveLength(1);
});

it('uses dispatch identity for a reused attack and never turns an unmatched target receipt into damage', () => {
  const result = fixture(), [first, second] = result.applications;
  // Synthetic dispatch associations on real captured arithmetic, not game evidence.
  second!.attackId = first!.attackId;
  result.calculations.find(row => row.request.id === second!.calculationId)!.request.attackId = first!.attackId;
  first!.dispatchId = 11; second!.dispatchId = 12;
  result.attackObservations = [first!, second!].map(application => ({ stage: 'resolved', frame: application.frame,
    attackId: application.attackId, dispatchId: application.dispatchId!, targetKey: application.targetKey, origin: application.origin! }));
  result.attackObservations.push({ ...result.attackObservations[0]!, dispatchId: 13 });
  result.attackObservations.push({ ...result.attackObservations[0]!, stage: 'missed', dispatchId: 14, reason: 'synthetic out-of-range' });
  const document = captureSourceHostActionCollection(result, 1, 'creation');
  const calculated = calculateSourceHostActionCollection(document);
  expect(calculated.opportunities.filter(row => row.status === 'calculated').flatMap(row => row.applicationIds)).toEqual([first!.id, second!.id]);
  expect(calculated.unresolvedCount).toBe(1);
  expect(calculated.opportunities.find(row => row.dispatchId === 13)?.value).toBeUndefined();
  expect(calculated.opportunities.find(row => row.dispatchId === 14)?.value).toBe(0);
  expect(calculated.total).toBe(calculated.originalRawTotal);
  expect(calculated.completeCast).toBe(false);
});

it('keeps a pending-only observation unknown, while an explicitly missed contact has a zero known subtotal', () => {
  const result = fixture();
  result.applications = [];
  const origin = { via: 'action' as const, creationActionSequence: 1, triggerActionSequence: 1 };
  result.attackObservations = [{ stage: 'queued', frame: 1, origin }];
  result.pendingAttackStages = [{ id: 7, stage: 'application', queuedFrame: 1, dueFrame: 52, attackId: 1, origin }];
  result.lifecycleObservationFrame = 30;
  const document = captureSourceHostActionCollection(result, 1, 'creation');
  const restored = calculateSourceHostActionCollection(JSON.parse(JSON.stringify(document)));
  expect(restored.document.hits).toHaveLength(0);
  expect(restored.document.sourceContext?.sourceConfig).toBe(result.config);
  expect(restored.knownSubtotal).toBeUndefined();
  expect(restored.pendingCount).toBe(1);
  expect(restored.trace[0]!.result).toBeUndefined();
  result.pendingAttackStages = [];
  result.attackObservations = [{ stage: 'missed', frame: 52, attackId: 1, dispatchId: 3, targetKey: 0, reason: 'synthetic miss', origin }];
  const missed = calculateSourceHostActionCollection(captureSourceHostActionCollection(result, 1, 'creation'));
  expect(missed.knownSubtotal).toBe(0);
  expect(missed.opportunities[0]?.trace[0]?.result?.value).toBe(0);
  expect(missed.completeCast).toBe(false);
});
