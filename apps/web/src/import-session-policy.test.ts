import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImportSessionPolicy, assertBuildPersistenceAllowed } from './import-session-policy';
import { makeConfig } from '../../../packages/sim-core/src/__tests__/fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('session-only persistence capability', () => {
  it('is memory-only, monotonic across clones/schema conversion and isolated from a fresh session', () => {
    const policy = createImportSessionPolicy();
    expect(() => policy.assertWorkspacePersistenceAllowed()).not.toThrow();
    policy.markImportedWorkspace();
    const copy = JSON.parse(JSON.stringify({ characters: [], duration: 30 }));
    expect(copy).not.toHaveProperty('sessionOnly');
    expect(() => policy.assertWorkspacePersistenceAllowed()).toThrow('仅供本次计算');
    expect(createImportSessionPolicy().isSessionOnly()).toBe(false);
    expect(() => assertBuildPersistenceAllowed(true)).toThrow('不能保存');
    expect(() => assertBuildPersistenceAllowed(false)).not.toThrow();
  });
  it('blocks actual team/document storage sinks without changing existing bytes; ordinary saves work first', async () => {
    vi.resetModules();
    const writes = new Map([['existing-synthetic-record', 'UNCHANGED_SYNTHETIC']]);
    const storage = { getItem: (key: string) => writes.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { writes.set(key, value); }) };
    vi.stubGlobal('localStorage', storage);
    const { importSessionPolicy: policy } = await import('./import-session-policy');
    const { saveNewTeamConfigPreset } = await import('./team-config-preset-library');
    const { saveNewSourceTeamPreset } = await import('./source-team-preset-library');
    const { saveEditedDocument } = await import('./project-document');
    const config = makeConfig();
    saveNewTeamConfigPreset('public synthetic preset', config);
    saveEditedDocument(null, config, storage, 'ordinary');
    const before = [...writes];
    const count = storage.setItem.mock.calls.length;
    policy.markImportedWorkspace();
    expect(() => saveNewTeamConfigPreset('imported', structuredClone(config))).toThrow('仅供本次计算');
    expect(() => saveEditedDocument(null, JSON.parse(JSON.stringify(config)), storage, 'derived')).toThrow('仅供本次计算');
    const draft = { schemaVersion: 1, source: { hostVariant: 'classic', revision: 'synthetic' }, name: 'imported', members: [], actions: [], durationSeconds: 30, target: { level: 90, resistance: 0.1 } } as const;
    expect(() => saveNewSourceTeamPreset('classic', 'synthetic', structuredClone(draft) as never, 'imported')).toThrow('仅供本次计算');
    expect(storage.setItem).toHaveBeenCalledTimes(count);
    expect([...writes]).toEqual(before);
  });
});
