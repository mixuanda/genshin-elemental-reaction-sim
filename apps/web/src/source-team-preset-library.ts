import type { SourceHostVariant, SourceTeamDraft } from "./source-team-builder";

const STORAGE_PREFIX = "gidps-source-team-presets-v1";

export interface SourceTeamPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: { hostVariant: SourceHostVariant; revision: string };
  draft: SourceTeamDraft;
}

interface SourceTeamPresetLibrary {
  schemaVersion: 1;
  hostVariant: SourceHostVariant;
  presets: SourceTeamPreset[];
}

const storageKey = (hostVariant: SourceHostVariant): string => `${STORAGE_PREFIX}:${hostVariant}`;
const clone = <T>(value: T): T => structuredClone(value);
const presetId = (): string => crypto.randomUUID();

export function listSourceTeamPresets(hostVariant: SourceHostVariant): SourceTeamPreset[] {
  const stored = localStorage.getItem(storageKey(hostVariant));
  if (!stored) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(stored); }
  catch { throw new Error("本机预设库不是有效 JSON；旧队伍草稿仍可通过单槽读取或 JSON 导入恢复。"); }
  const library = parsed as Partial<SourceTeamPresetLibrary> | null;
  if (!library || library.schemaVersion !== 1 || library.hostVariant !== hostVariant || !Array.isArray(library.presets)) {
    throw new Error("本机预设库结构或来源版本不匹配；未覆盖原有存储。");
  }
  for (const preset of library.presets) {
    if (!preset || typeof preset.id !== "string" || typeof preset.name !== "string" || !preset.draft || preset.source?.hostVariant !== hostVariant || typeof preset.source.revision !== "string") {
      throw new Error("本机预设记录不完整；未覆盖原有存储。");
    }
  }
  return clone(library.presets);
}

function persist(hostVariant: SourceHostVariant, presets: SourceTeamPreset[]): SourceTeamPreset[] {
  const library: SourceTeamPresetLibrary = { schemaVersion: 1, hostVariant, presets: clone(presets) };
  localStorage.setItem(storageKey(hostVariant), JSON.stringify(library));
  return clone(presets);
}

function snapshotDraft(hostVariant: SourceHostVariant, sourceRevision: string, draft: SourceTeamDraft): { source: SourceTeamPreset["source"]; draft: SourceTeamDraft } {
  const draftVariant = draft.source?.hostVariant ?? "classic";
  if (draftVariant !== hostVariant) throw new Error("不能把另一来源版本的队伍存入当前预设库。");
  const revision = draft.source?.revision || sourceRevision;
  if (!revision) throw new Error("当前来源 revision 尚未就绪，暂时不能保存预设。");
  const source = { hostVariant, revision };
  return { source, draft: { ...clone(draft), source } };
}

export function saveNewSourceTeamPreset(hostVariant: SourceHostVariant, sourceRevision: string, draft: SourceTeamDraft, name: string): { presets: SourceTeamPreset[]; preset: SourceTeamPreset } {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("请先填写预设名称。");
  const now = new Date().toISOString();
  const saved = snapshotDraft(hostVariant, sourceRevision, draft);
  const preset: SourceTeamPreset = { id: presetId(), name: cleanName, createdAt: now, updatedAt: now, ...saved };
  return { presets: persist(hostVariant, [...listSourceTeamPresets(hostVariant), preset]), preset: clone(preset) };
}

export function updateSourceTeamPreset(hostVariant: SourceHostVariant, sourceRevision: string, presets: SourceTeamPreset[], id: string, draft: SourceTeamDraft, name: string): SourceTeamPreset[] {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("请先填写预设名称。");
  if (!presets.some(preset => preset.id === id)) throw new Error("请先选择要更新的预设。");
  const saved = snapshotDraft(hostVariant, sourceRevision, draft);
  const now = new Date().toISOString();
  return persist(hostVariant, presets.map(preset => preset.id === id ? { ...preset, name: cleanName, updatedAt: now, ...saved } : preset));
}

export function deleteSourceTeamPreset(hostVariant: SourceHostVariant, presets: SourceTeamPreset[], id: string): SourceTeamPreset[] {
  if (!presets.some(preset => preset.id === id)) throw new Error("请先选择要删除的预设。");
  return persist(hostVariant, presets.filter(preset => preset.id !== id));
}

export function findSourceTeamPreset(presets: SourceTeamPreset[], id: string): SourceTeamPreset | undefined {
  const preset = presets.find(item => item.id === id);
  return preset ? clone(preset) : undefined;
}
