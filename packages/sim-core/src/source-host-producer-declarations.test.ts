import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  calculateSourceHostActionCollection,
  captureSourceHostFiniteSkillCollection,
} from './source-host-action-collection';
import { sourceHostResultSchema } from './source-host-wire';

const savedCapture = (path: string) => {
  const saved = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as { result: unknown };
  return sourceHostResultSchema.parse(saved.result);
};

it('recaptures archived eager and delayed finite skills through declarative producer plans', () => {
  const cases = [
    {
      path: '../../../docs/validation/source-delayed-finite-diona-full-20260929.capture.json',
      total: 2334.666065224993,
      closed: true,
      expectedRoots: 7,
      producers: 7,
      completedProducers: 7,
      pendingProducers: 0,
    },
    {
      path: '../../../docs/validation/source-delayed-finite-kaeya-full-20260929.capture.json',
      total: 2966.6700854069763,
      closed: true,
      expectedRoots: 13,
      producers: 16,
      completedProducers: 16,
      pendingProducers: 0,
    },
    {
      path: '../../../docs/validation/source-delayed-finite-kaeya-partial-20260929.capture.json',
      total: 456.410782370304,
      closed: false,
      expectedRoots: undefined,
      producers: 5,
      completedProducers: 2,
      pendingProducers: 3,
    },
    {
      path: '../../../docs/validation/source-finite-cast-amber-q-full-20260929.capture.json',
      total: 3644.908929157875,
      closed: true,
      expectedRoots: 18,
      producers: 0,
      completedProducers: 0,
      pendingProducers: 0,
    },
  ];

  for (const expected of cases) {
    const document = captureSourceHostFiniteSkillCollection(savedCapture(expected.path), 1);
    if (!document) throw new Error(`Could not recapture finite skill fixture: ${expected.path}`);
    const result = calculateSourceHostActionCollection(document);
    expect(result.total).toBe(expected.total);
    expect(result.completeCast).toBe(expected.closed);
    expect(result.finiteCast?.closed).toBe(expected.closed);
    expect(result.finiteCast?.expectedRootAttackCount).toBe(expected.expectedRoots);
    expect(result.finiteCast?.producerCount).toBe(expected.producers);
    expect(result.finiteCast?.completedProducerCount).toBe(expected.completedProducers);
    expect(result.finiteCast?.pendingProducerCount).toBe(expected.pendingProducers);
  }
});
