import { afterEach, describe, expect, it, vi } from 'vitest';
import { importSessionPolicy } from './import-session-policy';
import { exportSourceTeamDraft, type SourceTeamDraft } from './source-team-builder';
import { exportSimulationAnalysisReport } from './analysis-panel';
import { exportLunarSimulationCapture } from './lunar-simulation-panel';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('actual derived export actions wired to production click handlers', () => {
 it('downloads ordinary synthetic data, then blocks all three actual actions before serialization/Blob/download', () => {
  vi.useFakeTimers();
  const blob = vi.fn(), click = vi.fn(), create = vi.fn(() => ({ click, href: '', download: '' }));
  vi.stubGlobal('Blob', blob); vi.stubGlobal('document', { createElement: create });
  const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const draft = { schemaVersion: 1, members: [], actions: [], name: 'synthetic' } as unknown as SourceTeamDraft;
  exportSourceTeamDraft(draft);
  exportSimulationAnalysisReport(() => ({ config: { marker: 'synthetic' } }));
  exportLunarSimulationCapture(() => '{"marker":"synthetic"}', 'synthetic');
  expect(click).toHaveBeenCalledTimes(3);
  blob.mockClear(); url.mockClear(); create.mockClear(); click.mockClear();
  importSessionPolicy.markImportedWorkspace();
  const serialize = vi.fn(() => '{"marker":"PRIVATE_SYNTHETIC"}');
  const privateDraft = { toJSON: serialize } as unknown as SourceTeamDraft;
  expect(() => exportSourceTeamDraft(privateDraft)).toThrow('仅供本次计算');
  expect(() => exportSimulationAnalysisReport(serialize)).toThrow('仅供本次计算');
  expect(() => exportLunarSimulationCapture(serialize, 'synthetic')).toThrow('仅供本次计算');
  expect(serialize).not.toHaveBeenCalled(); expect(blob).not.toHaveBeenCalled();
  expect(url).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
 });
});
