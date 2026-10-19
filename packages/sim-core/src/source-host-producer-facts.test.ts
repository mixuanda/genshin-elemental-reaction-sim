import { expect, it } from 'vitest';
import type { SourceHostAbilityInvocation } from './source-host-finite-cast-types';
import { sourceHostProducerPlan } from './source-host-producer-plan';

const invocation = (
  characterKey: string,
  action: string,
  entryFacts?: Record<string, number>,
  hasOnRemoved = false,
): SourceHostAbilityInvocation => ({
  id: 1,
  actionSequence: 1,
  actorIndex: 0,
  characterKey,
  action,
  params: {},
  ...(entryFacts === undefined ? {} : { entryFacts }),
  constellation: 0,
  ascension: 0,
  startedFrame: 10,
  returnedFrame: 10,
  success: true,
  animationQueuedCallbacks: 0,
  hasOnRemoved,
  queuedAttacks: [],
});

it('evaluates exact invocation entry facts and keeps OnRemoved allowance on its selected plan', () => {
  const cynoOrdinary = sourceHostProducerPlan('cyno-skill', invocation('cyno', 'skill', {
    'cyno.skill.burst-active': 0,
  }));
  expect(cynoOrdinary?.expectedRootAttackCount).toBe(1);

  expect(sourceHostProducerPlan('cyno-skill', invocation('cyno', 'skill', {
    'cyno.skill.burst-active': 1,
  }))).toBeUndefined();
  expect(sourceHostProducerPlan('cyno-skill', invocation('cyno', 'skill', {
    'cyno.skill.burst-active': 1,
    'cyno.skill.a1-active': 1,
  }))?.expectedRootAttackCount).toBe(4);

  expect(sourceHostProducerPlan('freminet-skill', invocation('freminet', 'skill', {
    'freminet.skill.pers-active': 0,
    'freminet.skill.aligned-icd-active': 1,
  }))?.expectedRootAttackCount).toBe(1);
  for (const [stacks, count] of [[0, 1], [2, 2], [4, 1]] as const) {
    expect(sourceHostProducerPlan('freminet-skill', invocation('freminet', 'skill', {
      'freminet.skill.pers-active': 1,
      'freminet.skill.stacks': stacks,
    }))?.expectedRootAttackCount).toBe(count);
  }

  for (const [lowHP, count] of [[0, 7], [1, 12]] as const) {
    expect(sourceHostProducerPlan('kuki-burst', invocation('kuki', 'burst', {
      'kuki.burst.low-hp': lowHP,
    }))?.expectedRootAttackCount).toBe(count);
  }
  expect(sourceHostProducerPlan('yaemiko-burst', invocation('yaemiko', 'burst', {
    'yae.burst.kitsune-count': 3,
  }))?.expectedRootAttackCount).toBe(4);
  expect(sourceHostProducerPlan('yaemiko-burst', invocation('yaemiko', 'burst'))).toBeUndefined();
  expect(sourceHostProducerPlan('yaemiko-burst', invocation('yaemiko', 'burst', {
    'yae.burst.kitsune-count': 4,
  }))).toBeUndefined();

  expect(sourceHostProducerPlan('wanderer-burst', invocation('wanderer', 'burst', undefined, true))?.allowsOnRemoved).toBe(true);
  expect(sourceHostProducerPlan('yaemiko-burst', invocation('yaemiko', 'burst', {
    'yae.burst.kitsune-count': 3,
  }, true))?.allowsOnRemoved).toBeUndefined();
});
