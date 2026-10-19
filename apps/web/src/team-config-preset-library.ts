import type { SimConfig } from "@genshin-dps-lab/schemas";

const STORAGE_KEY = "gidps-team-config-presets-v1";
const SCHEMA_VERSION = 1;
const MAX_NAME_LENGTH = 80;

export interface TeamConfigPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: SimConfig;
}

interface TeamConfigPresetLibrary {
  schemaVersion: typeof SCHEMA_VERSION;
  presets: TeamConfigPreset[];
}

const clone = <T>(value: T): T => structuredClone(value);

function isConfig(value: unknown): value is SimConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SimConfig>;
  return typeof candidate.dataVersion === "string"
    && typeof candidate.randomSeed === "string"
    && typeof candidate.duration === "number"
    && Array.isArray(candidate.characters)
    && Array.isArray(candidate.rotation)
    && !!candidate.enemy
    && typeof candidate.enemy === "object";
}

function isPreset(value: unknown): value is TeamConfigPreset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TeamConfigPreset>;
  return typeof candidate.id === "string"
    && candidate.id.length > 0
    && typeof candidate.name === "string"
    && candidate.name.trim().length > 0
    && candidate.name.length <= MAX_NAME_LENGTH
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string"
    && isConfig(candidate.config);
}

export function listTeamConfigPresets(): TeamConfigPreset[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(stored); }
  catch { throw new Error("本机队伍方案库不是有效 JSON；未覆盖原有存储。"); }
  const library = parsed as Partial<TeamConfigPresetLibrary> | null;
  if (!library || library.schemaVersion !== SCHEMA_VERSION || !Array.isArray(library.presets) || !library.presets.every(isPreset)) {
    throw new Error("本机队伍方案库结构不匹配；未覆盖原有存储。");
  }
  return clone(library.presets);
}

function persist(presets: TeamConfigPreset[]): TeamConfigPreset[] {
  const library: TeamConfigPresetLibrary = { schemaVersion: SCHEMA_VERSION, presets: clone(presets) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return clone(presets);
}

function cleanName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error("请先填写方案名称。");
  if (clean.length > MAX_NAME_LENGTH) throw new Error("方案名称不能超过 " + MAX_NAME_LENGTH + " 个字符。");
  return clean;
}

export function saveNewTeamConfigPreset(name: string, config: SimConfig): { presets: TeamConfigPreset[]; preset: TeamConfigPreset } {
  if (!isConfig(config)) throw new Error("当前模拟配置不完整，无法保存方案。");
  const clean = cleanName(name);
  const now = new Date().toISOString();
  const preset: TeamConfigPreset = {
    id: crypto.randomUUID(),
    name: clean,
    createdAt: now,
    updatedAt: now,
    config: clone(config)
  };
  return { presets: persist([...listTeamConfigPresets(), preset]), preset: clone(preset) };
}

export function updateTeamConfigPreset(id: string, name: string, config: SimConfig): { presets: TeamConfigPreset[]; preset: TeamConfigPreset } {
  const clean = cleanName(name);
  if (!isConfig(config)) throw new Error("当前模拟配置不完整，无法保存方案。");
  const presets = listTeamConfigPresets();
  if (!presets.some(preset => preset.id === id)) throw new Error("请先选择有效的本机方案。");
  const now = new Date().toISOString();
  const updated = presets.map(preset => preset.id === id
    ? { ...preset, name: clean, updatedAt: now, config: clone(config) }
    : preset);
  const saved = persist(updated);
  return { presets: saved, preset: clone(saved.find(preset => preset.id === id)!) };
}

export function deleteTeamConfigPreset(id: string): TeamConfigPreset[] {
  const presets = listTeamConfigPresets();
  if (!presets.some(preset => preset.id === id)) throw new Error("请先选择有效的本机方案。");
  return persist(presets.filter(preset => preset.id !== id));
}

export function findTeamConfigPreset(presets: TeamConfigPreset[], id: string): TeamConfigPreset | undefined {
  const preset = presets.find(item => item.id === id);
  return preset ? clone(preset) : undefined;
}
