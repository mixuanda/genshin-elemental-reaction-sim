import { expect, it } from 'vitest';
import type {
  SourceHostAbilityInvocation, SourceHostAbilityProducer, SourceHostAttackDispatchCompletion,
} from './source-host-finite-cast-types';
import { analyzeSourceHostProducerGraph } from './source-host-producer-analysis';
import { sourceHostProducerPlan } from './source-host-producer-plan';

it('requires Venti absorption count 21 to terminate without attacks', () => {
  // Synthetic receipts for the pinned source branch: twenty Anemo ticks and
  // absorption checks at depths 0..21. They are not a native run.
  const invocation: SourceHostAbilityInvocation = {
    id: 1, actionSequence: 1, actorIndex: 0, characterKey: 'venti', action: 'burst',
    params: {}, constellation: 0, ascension: 6, startedFrame: 0, returnedFrame: 0,
    success: true, animationQueuedCallbacks: 0, hasOnRemoved: false, queuedAttacks: [],
  };
  const plan = sourceHostProducerPlan('venti-burst', invocation);
  if (!plan) throw new Error('The Venti burst producer plan is absent');
  const anemo: SourceHostAbilityProducer[] = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1, invocationId: invocation.id, siteId: 'venti.burst.anemo-tick',
    actorIndex: 0, queuedFrame: 0, startedFrame: 1, completedFrame: 1, state: 'completed',
    queuedAttacks: [{ queueId: index + 1, attackId: index + 1, ability: 'Burst', attackTagName: 'Burst', frame: 1 }],
  }));
  const absorption: SourceHostAbilityProducer[] = Array.from({ length: 22 }, (_, depth) => ({
    id: depth + 21, invocationId: invocation.id,
    ...(depth === 0 ? {} : { parentProducerId: depth + 20 }),
    siteId: depth === 0 ? 'venti.burst.absorb-check-initial' : 'venti.burst.absorb-check-next',
    actorIndex: 0, queuedFrame: depth, startedFrame: depth + 1, completedFrame: depth + 1,
    state: 'completed', queuedAttacks: [],
  }));
  const dispatchCompletions: SourceHostAttackDispatchCompletion[] = anemo.map((_, index) => ({
    dispatchId: index + 1, attackId: index + 1, frame: 2,
    origin: { via: 'action', creationActionSequence: invocation.actionSequence },
    enemyTargetKeys: [], skippedEnemyKeys: [], skipsEnemies: false,
  }));
  const evidence = { invocation, producers: [...anemo, ...absorption], invocations: [invocation], dispatchCompletions };
  expect(analyzeSourceHostProducerGraph(plan, evidence, 30).closed).toBe(true);

  const missingSuccessor = { ...evidence, producers: evidence.producers.slice(0, -1) };
  expect(analyzeSourceHostProducerGraph(plan, missingSuccessor, 30).closed).toBe(false);

  const invalidTerminal = structuredClone(evidence);
  invalidTerminal.producers.at(-1)!.queuedAttacks = Array.from({ length: 15 }, (_, index) => ({
    queueId: index + 21, attackId: index + 21, ability: 'Burst', attackTagName: 'Burst', frame: 22,
  }));
  expect(analyzeSourceHostProducerGraph(plan, invalidTerminal, 30).closed).toBe(false);
});
