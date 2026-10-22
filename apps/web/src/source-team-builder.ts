import "./source-team-builder.css";
import { TimelinePlayback, PLAYBACK_SPEEDS } from "./timeline-playback";
import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { artifactSetCatalog } from "../../../packages/game-data/src/supplemental";
import { resolveArtifactBuild } from "../../../packages/game-data/src/artifact-build";
import { equipmentLevelRange, type EquipmentBuildInput } from "../../../packages/game-data/src/equipment-build";
import { getCharacterBuildPreset, type CharacterBuildPresetTier } from "../../../packages/game-data/src/character-build-presets";
import { teamTemplates } from "../../../packages/game-data/src/team-templates";
import { sourceActionCapability, sourceActionLabels, type SourceActionCapabilities, type SourceCharacterActionKind } from "./source-action-capabilities";
import { renderSourceActionReceipts, sourceActionReceipts, type SourceActionReceipt } from "./source-action-receipts";
import { defaultSourceExecutionProfile, normalizeSourceExecutionProfile, SOURCE_DELAY_KEYS, SOURCE_EXECUTION_PROFILE_DEFAULTS, SOURCE_EXECUTION_PROFILE_VERSION, sourceExecutionProfileComment, type SourceDelayKey, type SourceExecutionProfile, type SourceExecutionProfileMode } from "./source-execution-profiles";
import { deleteSourceTeamPreset, findSourceTeamPreset, listSourceTeamPresets, saveNewSourceTeamPreset, updateSourceTeamPreset, type SourceTeamPreset } from "./source-team-preset-library";
import { defaultSourceTargetGeometry } from "./source-target-geometry";
import { type SourceTargetProfile } from "./source-target-profile";
import { resolveSourceTargetScene, sourceTargetSceneClauses } from "./source-target-scene";
import { renderSourceTargetSceneControls, readSourceTargetSceneControls, sourceTargetSceneControlAction, updateSourceTargetSceneDiagram, type SourceTargetSceneControlAction } from "./source-target-scene-controls";
import { renderSourceTargetProfileControls, readSourceTargetProfileControls } from "./source-target-profile-controls";
import { renderSourceTargetGeometryControls, readSourceTargetGeometryControls, updateSourceTargetGeometryDiagram } from "./source-target-geometry-controls";
import { sourceTargetPhasesRequest } from "./source-target-scene";
import { sourceTargetPhaseControlAction } from "./source-target-phase-controls";
import type { SourceHostTargetPhaseRequest } from "../../../packages/sim-core/src/source-host-target-phase";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../../../packages/sim-core/src/source-host-wire";

export type SourceHostVariant = "classic" | "stellar";
export type SourceItemKind = "character" | "weapon" | "artifact";
export interface SourceInventoryItem {
  kind: SourceItemKind;
  key: string;
  sourceGameId?: number | undefined;
  name: string;
  maximumLevel?: number | undefined;
  weaponClass?: string | undefined;
  packagePath: string;
  actionCapabilities?: SourceActionCapabilities | undefined;
}
export interface SourceTeamInventory {
  repository: string;
  hostVariant: SourceHostVariant;
  revision: string;
  characters: SourceInventoryItem[];
  weapons: SourceInventoryItem[];
  artifacts: SourceInventoryItem[];
}
/** Promotion tables stop at 90; the two pinned runtimes have actual 1–100 growth curves.
 * This is an executor limit, not a claim that a player has unlocked Lv.95/100.
 * Unknown revisions retain their declared catalog limit until independently checked.
 */
export function sourceCharacterLevelLimit(inventory: SourceTeamInventory, character: SourceInventoryItem): number {
  const knownRepository = inventory.repository === "https://github.com/genshinsim/gcsim" || inventory.repository === "genshinsim/gcsim";
  const pinned = inventory.hostVariant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT;
  return knownRepository && inventory.revision === pinned ? 100 : character.maximumLevel ?? 90;
}
export interface SourceTeamMember {
  id: string;
  characterKey: string;
  level: number;
  levelCap: number;
  constellation: number;
  talents: { auto: number; skill: number; burst: number };
  weapon: { key: string; level: number; levelCap: number; refinement: number };
  artifactSets: { key: string; count: number }[];
  /** Only contributions from five artifact pieces. The source executes character, weapon and set effects. */
  artifactStats: Record<string, number>;
  /** Used only in explicit custom startup; absent old drafts keep the source full-energy default. */
  initialEnergy?: number;
}
export type SourceActionKind = SourceCharacterActionKind | "wait";
export interface SourceTeamAction {
  actorId: string;
  kind: SourceActionKind;
  repeat?: number;
  params?: Record<string, number>;
  frames?: number;
}
export interface SourceTeamDraft {
  schemaVersion: 1;
  source?: { hostVariant: SourceHostVariant; revision: string };
  /** Origin label only; edits never imply that the current draft still matches the template. */
  templateId?: string;
  name: string;
  members: SourceTeamMember[];
  actions: SourceTeamAction[];
  durationSeconds: number;
  startup?: "full" | "zero" | "custom";
  /** Older drafts without this field explicitly resolve to the zero-delay ideal profile. */
  executionProfile?: SourceExecutionProfile;
  rotationLoop?: { mode: "once" | "count" | "continuous"; count?: number };
  target: SourceTargetProfile;
  additionalTargets?: SourceTargetProfile[];
  /** Statistics selection only; does not change native targeting. */
  primaryTargetIndex?: number;
}

type Manifest = { source: { repository: string; revision: string }; sourceInventory: { registeredSourcePackages: Array<{ kind: SourceItemKind; importPath: string; sourcePath: string; sourceLine: number }> } };
type Metadata = { schemaVersion: number; source: { repository: string; revision: string }; packages: Array<{ kind: SourceItemKind; importPath: string; sourcePath: string; sourceLine: number; packagePath: string; keyStatus: string; actionCapabilities?: SourceActionCapabilities; resolved?: { configurationKey: string; sourceGameId?: number; nameZh?: string | null; maximumLevel?: number; weaponClass?: string } }> };
const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const ID = /^[a-z][a-z0-9_]*$/;
const integer = (value: unknown, label: string, min: number, max: number): number => {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${label}须为 ${min}–${max} 的整数。`);
  return value as number;
};
const finite = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}须为有限数值。`);
  return value;
};
const findExact = (items: SourceInventoryItem[], id: number, label: string): SourceInventoryItem => {
  const matches = items.filter(item => item.sourceGameId === id);
  if (matches.length !== 1) throw new Error(`${label} ${id} 在固定来源中${matches.length ? "有多个形态，需明确选择" : "没有对应配置键"}。`);
  return matches[0]!;
};

/** Rejects mismatched auxiliary metadata instead of guessing configuration keys. */
export async function loadSourceTeamInventory(hostVariant: SourceHostVariant = "classic"): Promise<SourceTeamInventory> {
  const basePath = hostVariant === "stellar" ? "/source-host-stellar" : "/source-host";
  const paths = [`${basePath}/manifest.json`, `${basePath}/inventory-metadata.json`];
  const [manifest, metadata] = await Promise.all(paths.map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}：HTTP ${response.status}`);
    return response.json();
  })) as [Manifest, Metadata];
  if (!manifest?.source?.revision || !Array.isArray(manifest.sourceInventory?.registeredSourcePackages) || metadata?.schemaVersion !== 1 || !Array.isArray(metadata.packages) || manifest.source.revision !== metadata.source?.revision || manifest.source.repository !== metadata.source.repository) {
    throw new Error("来源名册与键元数据缺失或版本不一致，无法安全建立队伍。");
  }
  const metadataMap = new Map(metadata.packages.map(item => [`${item.kind}:${item.importPath}`, item]));
  const items = manifest.sourceInventory.registeredSourcePackages.flatMap(registration => {
    const detail = metadataMap.get(`${registration.kind}:${registration.importPath}`);
    if (!detail || detail.sourcePath !== registration.sourcePath || detail.sourceLine !== registration.sourceLine || detail.keyStatus !== "source-registration-and-parser-confirmed" || !detail.resolved?.configurationKey) return [];
    const resolved = detail.resolved;
    return [{ kind: registration.kind, key: resolved.configurationKey, sourceGameId: resolved.sourceGameId, name: resolved.nameZh ?? detail.packagePath.split("/").at(-1) ?? resolved.configurationKey, maximumLevel: resolved.maximumLevel, weaponClass: resolved.weaponClass, packagePath: detail.packagePath, actionCapabilities: detail.actionCapabilities } satisfies SourceInventoryItem];
  });
  return { repository: manifest.source.repository, hostVariant, revision: manifest.source.revision, characters: items.filter(item => item.kind === "character"), weapons: items.filter(item => item.kind === "weapon"), artifacts: items.filter(item => item.kind === "artifact") };
}

const statNames: Record<string, string> = {
  FIGHT_PROP_HP: "hp", FIGHT_PROP_HP_PERCENT: "hp%", FIGHT_PROP_ATTACK: "atk", FIGHT_PROP_ATTACK_PERCENT: "atk%",
  FIGHT_PROP_DEFENSE: "def", FIGHT_PROP_DEFENSE_PERCENT: "def%", FIGHT_PROP_ELEMENT_MASTERY: "em", FIGHT_PROP_CHARGE_EFFICIENCY: "er",
  FIGHT_PROP_CRITICAL: "cr", FIGHT_PROP_CRITICAL_HURT: "cd", FIGHT_PROP_HEAL_ADD: "heal", FIGHT_PROP_PHYSICAL_ADD_HURT: "phys%",
  FIGHT_PROP_FIRE_ADD_HURT: "pyro%", FIGHT_PROP_WATER_ADD_HURT: "hydro%", FIGHT_PROP_ICE_ADD_HURT: "cryo%",
  FIGHT_PROP_ELEC_ADD_HURT: "electro%", FIGHT_PROP_WIND_ADD_HURT: "anemo%", FIGHT_PROP_ROCK_ADD_HURT: "geo%", FIGHT_PROP_GRASS_ADD_HURT: "dendro%"
};

export function equipmentBuildToSourceTeamMember(
  input: EquipmentBuildInput,
  meta: { constellation: number; talents: { auto: number; skill: number; burst: number }; characterKey?: string },
  inventory: SourceTeamInventory
): SourceTeamMember {
  const character = gameDataCatalog.characters.find(entry => entry.id === input.characterId);
  const weapon = gameDataCatalog.weapons.find(entry => entry.id === input.weaponId);
  if (!character || !weapon) throw new Error("装备方案中的角色或武器不在本地目录。 ");
  const charId = character.avatarId;
  const charMatches = inventory.characters.filter(item => item.sourceGameId === charId);
  const sourceChar = meta.characterKey ? charMatches.find(item => item.key === meta.characterKey) : findExact(inventory.characters, charId, "角色");
  if (!sourceChar) throw new Error(`${character.name} 的来源形态 ${meta.characterKey ?? ""} 不可用；旅行者等多元素角色须指定 characterKey。`);
  const sourceWeapon = findExact(inventory.weapons, weapon.itemId, "武器");
  const resolved = resolveArtifactBuild(input.artifacts ?? []);
  const artifactSets = Object.entries(resolved.setCounts).map(([setId, count]) => {
    const set = artifactSetCatalog.find(entry => entry.id === setId);
    if (!set) throw new Error(`本地目录缺少套装 ${setId}。`);
    return { key: findExact(inventory.artifacts, Number(setId.split(":")[1]), "套装").key, count };
  });
  const artifactStats: Record<string, number> = {};
  for (const term of resolved.statContributions) {
    const key = statNames[term.property];
    if (!key) throw new Error(`来源脚本不支持圣遗物属性 ${term.property}。`);
    artifactStats[key] = (artifactStats[key] ?? 0) + term.value;
  }
  return {
    id: sourceChar.key, characterKey: sourceChar.key,
    level: input.level, levelCap: equipmentLevelRange(character, input.ascension, input.characterLevelCap).max,
    constellation: meta.constellation, talents: { ...meta.talents },
    weapon: { key: sourceWeapon.key, level: input.weaponLevel, levelCap: equipmentLevelRange(weapon, input.weaponAscension).max, refinement: input.refinement },
    artifactSets, artifactStats
  };
}

/** Produces only source GCSL; timing, cooldowns, energy and animation remain owned by the Go/WASM executor. */
export function compileSourceTeamDraft(draft: SourceTeamDraft, inventory: SourceTeamInventory): string {
  if (draft.schemaVersion !== 1) throw new Error("队伍草稿版本不受支持。");
  if (draft.source && (draft.source.hostVariant !== inventory.hostVariant || draft.source.revision !== inventory.revision)) throw new Error("草稿固定来源与当前执行器不同；请选择原来源后导入，不自动替换机制版本。");
  if (draft.members.length < 1 || draft.members.length > 4) throw new Error("队伍须有 1–4 位角色。");
  const duration = finite(draft.durationSeconds, "观察时间");
  const startup = draft.startup ?? "full";
  if (!["full", "zero", "custom"].includes(startup)) throw new Error("来源队伍起步模式须为满能、零能或逐角色自定义；未建立的稳态不能作为起步状态。");
  if (Math.floor(duration * 60) < 1 || duration > 3600) throw new Error("观察时间须至少 1 帧（1/60 秒），且不超过 3600 秒。");
  const targetClauses = sourceTargetSceneClauses(draft);
  const memberById = new Map<string, SourceTeamMember>();
  const keys = new Set<string>();
  const gameIdentities = new Set<number | string>();
  const profile = normalizeSourceExecutionProfile(draft.executionProfile);
  const delayOptions = SOURCE_DELAY_KEYS.map(key => `${key === "aim_delay" ? key : `${key}_delay`}=${profile.delays[key]}`).join(" ");
  const lines = [`# ${draft.name.replace(/[\r\n]/g, " ")}`, `# Source: ${inventory.hostVariant} ${inventory.revision}`, "# Five artifact-piece stat contributions only; source resolves character, weapon and set effects.", `# Startup: ${startup}; no energy bypass or per-cycle refill.`, sourceExecutionProfileComment(profile), `options iteration=1 duration=${duration} ${delayOptions};`, ""];
  for (const member of draft.members) {
    if (!ID.test(member.id) || memberById.has(member.id)) throw new Error("队伍成员 ID 必须唯一且只含英文字母、数字或下划线。");
    if (keys.has(member.characterKey)) throw new Error("来源 GCSL 不能把相同角色形态声明两次。");
    const character = inventory.characters.find(item => item.key === member.characterKey);
    const weapon = inventory.weapons.find(item => item.key === member.weapon.key);
    if (!character || !weapon) throw new Error(`${member.characterKey} 的来源角色或武器配置键不可用。`);
    const identity = character.sourceGameId === 10000005 || character.sourceGameId === 10000007 ? "traveler" : character.sourceGameId;
    if (identity !== undefined && gameIdentities.has(identity)) throw new Error(`${character.name} 已在队伍中；不同元素的旅行者也不能同时入队。`);
    if (identity !== undefined) gameIdentities.add(identity);
    if (character.weaponClass && weapon.weaponClass && character.weaponClass !== weapon.weaponClass) throw new Error(`${character.name} 与 ${weapon.name} 武器类型不匹配。`);
    integer(member.levelCap, "角色上限", 1, sourceCharacterLevelLimit(inventory, character)); integer(member.level, "角色等级", 1, member.levelCap);
    if (member.levelCap > 90 && ![95, 100].includes(member.levelCap)) throw new Error("90 级以上的角色解锁上限须为 95 或 100；实际等级可在已解锁范围内填写。");
    integer(member.constellation, "命之座", 0, 6);
    for (const [name, value] of Object.entries(member.talents)) integer(value, `${name} 天赋`, 1, 15);
    integer(member.weapon.levelCap, "武器上限", 1, weapon.maximumLevel ?? 90); integer(member.weapon.level, "武器等级", 1, member.weapon.levelCap);
    integer(member.weapon.refinement, "精炼", 1, 5);
    const key = member.characterKey;
    const initial = startup === "full" ? undefined : startup === "zero" ? 0 : integer(member.initialEnergy, `${character.name} 初始能量`, 0, 1000);
    lines.push(`${key} char lvl=${member.level}/${member.levelCap} cons=${member.constellation} talent=${member.talents.auto},${member.talents.skill},${member.talents.burst}${initial === undefined ? "" : ` +params=[start_energy=${initial}]`};`);
    lines.push(`${key} add weapon="${weapon.key}" refine=${member.weapon.refinement} lvl=${member.weapon.level}/${member.weapon.levelCap};`);
    let setCount = 0;
    const seenSets = new Set<string>();
    for (const set of member.artifactSets) {
      if (!inventory.artifacts.some(item => item.key === set.key)) throw new Error(`套装 ${set.key} 在固定来源不可用。`);
      if (seenSets.has(set.key)) throw new Error(`套装 ${set.key} 重复，请合并件数。`);
      seenSets.add(set.key);
      integer(set.count, "套装件数", 1, 5); setCount += set.count;
      lines.push(`${key} add set="${set.key}" count=${set.count};`);
    }
    if (setCount > 5) throw new Error("套装件数不能超过五件。");
    const stats = Object.entries(member.artifactStats).filter(([, value]) => value !== 0).map(([stat, value]) => {
      if (!Object.values(statNames).includes(stat)) throw new Error(`未知来源属性 ${stat}。`);
      return `${stat}=${finite(value, stat)}`;
    });
    if (stats.length) lines.push(`${key} add stats ${stats.join(" ")};`);
    lines.push(""); memberById.set(member.id, member); keys.add(key);
  }
  lines.push(...targetClauses, `active ${draft.members[0]!.characterKey};`, "");
  const loop = draft.rotationLoop ?? { mode: "once" };
  if (!["once", "count", "continuous"].includes(loop.mode)) throw new Error("轮转循环模式不受支持。");
  if (loop.mode !== "once" && !draft.actions.some(action => action.kind !== "wait" || (action.frames ?? 0) > 0)) throw new Error("循环至少需要一个实际行动或正帧等待，不能循环空序列或零帧等待。");
  if (loop.mode === "count") lines.push(`for let rotation = 0; rotation < ${integer(loop.count, "轮转次数", 1, 1000)}; rotation = rotation + 1 {`);
  else if (loop.mode === "continuous") lines.push("while 1 {");
  const validKinds = new Set<SourceActionKind>(["skill", "burst", "attack", "charge", "aim", "dash", "jump", "low_plunge", "high_plunge", "wait"]);
  let activeCharacterKey = draft.members[0]!.characterKey;
  for (const action of draft.actions) {
    if (!validKinds.has(action.kind)) throw new Error(`不支持动作 ${action.kind}。`);
    const repeat = integer(action.repeat ?? 1, "重复次数", 1, 100);
    if (action.kind === "wait") {
      const frames = integer(action.frames, "等待帧数", 0, 216000);
      for (let i = 0; i < repeat; i++) lines.push(`wait(${frames});`);
      continue;
    }
    const actor = memberById.get(action.actorId);
    if (!actor) throw new Error(`动作引用了队伍外角色 ${action.actorId}。`);
    if (actor.characterKey !== activeCharacterKey) {
      lines.push(`${actor.characterKey} swap;`);
      activeCharacterKey = actor.characterKey;
    }
    const sourceCharacter = inventory.characters.find(character => character.key === actor.characterKey)!;
    const capability = sourceActionCapability(sourceCharacter.actionCapabilities, action.kind);
    if (capability?.status !== "implemented") throw new Error(`${sourceCharacter.name} 的${sourceActionLabels[action.kind]}在所选来源中${capability?.status === "unsupported" ? "尚未实现" : "尚无明确的动作方法依据"}；请更换动作或来源版本。`);
    const params = Object.entries(action.params ?? {}).map(([key, value]) => {
      if (!ID.test(key)) throw new Error(`动作参数键 ${key} 不合法。`);
      return `${key}=${integer(value, `动作参数 ${key}`, -1000000, 1000000)}`;
    });
    lines.push(`${actor.characterKey} ${action.kind}${params.length ? `[${params.join(",")}]` : ""}${repeat > 1 ? `:${repeat}` : ""};`);
  }
  if (loop.mode !== "once") lines.push("}");
  return lines.join("\n") + "\n";
}

const STORAGE_KEY = "gidps-source-team-draft-v1";
const statOptions = ["hp", "hp%", "atk", "atk%", "def", "def%", "em", "er", "cr", "cd", "heal", "phys%", "pyro%", "hydro%", "cryo%", "electro%", "anemo%", "geo%", "dendro%"];
const actionButtons = Object.entries(sourceActionLabels) as Array<[SourceActionKind, string]>;
const option = (value: string, label: string, selected: string): string => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
const numberInput = (scope: string, field: string, value: number, label: string, min: number, max: number, step = "1", disabled = false): string => `<label>${label}<input type="number" data-${scope}-field="${field}" value="${escapeHtml(value)}" min="${min}" max="${max}" step="${step}" ${disabled ? "disabled" : ""}></label>`;
const defaultDraft = (): SourceTeamDraft => ({ schemaVersion: 1, name: "我的来源队伍", members: [], actions: [], durationSeconds: 30, executionProfile: defaultSourceExecutionProfile(), target: { level: 90, resistance: 0.1, geometry: { ...defaultSourceTargetGeometry } } });
const characterFor = (source: SourceInventoryItem) => gameDataCatalog.characters.find(character => character.avatarId === source.sourceGameId);

export interface SourceTeamBuilderOptions {
  hostVariant?: SourceHostVariant;
  onApplyScript: (script: string, primaryTargetIndex: number, targetPhases: SourceHostTargetPhaseRequest | undefined) => void;
  onRunScript?: (script: string, primaryTargetIndex: number, targetPhases: SourceHostTargetPhaseRequest | undefined) => void;
  onDraftChange?: (draft: SourceTeamDraft) => void;
  initialDraft?: SourceTeamDraft;
  initialTemplateId?: string;
}
export interface SourceTeamBuilderHandle {
  setDraft(draft: SourceTeamDraft): void;
  getDraft(): SourceTeamDraft;
  getCharacterName(characterKey: string): string | undefined;
  renderExecutionLogs(logs: unknown, statusInstances?: unknown, endFrame?: number): void;
  dispose(): void;
}

export function renderSourceTeamBuilder(root: HTMLElement, options: SourceTeamBuilderOptions): SourceTeamBuilderHandle {
  const hostVariant = options.hostVariant ?? "classic";
  const storageKey = `${STORAGE_KEY}:${hostVariant}`;
  let inventory: SourceTeamInventory | null = null;
  let draft: SourceTeamDraft = structuredClone(options.initialDraft ?? defaultDraft());
  let disposed = false;
  let activeMember = 0;
  let chosenTier: CharacterBuildPresetTier = "starter";
  let previewTemplateId = "";
  let error = "";
  let status = "";
  let executionLogs: unknown = null;
  type RuntimeCooldownEvent = { actorIndex: number; action: string; frame: number; kind: "trigger" | "ready" | "reduced"; chargesRemain?: number };
  type RuntimeCooldownJob = { actorIndex: number; action: string; triggerFrame: number; readyFrame?: number };
  type RuntimeStatusInstance = { actorIndex: number; statusKey: string; instanceId: number; createdFrame: number; creationActionSequence?: number; initialExpiryFrame: number; finalExpiryFrame: number; endState: string; endFrame: number };
  let runtimeCooldownEvents: RuntimeCooldownEvent[] = [];
  let runtimeCooldownJobs: RuntimeCooldownJob[] = [];
  let runtimeStatuses: RuntimeStatusInstance[] = [];
  let runtimeReceipts: SourceActionReceipt[] = [];
  let runtimeCharacterKeys = new Map<number, string>();
  let simulationEndFrame = 0;
  let simulationCursor = 0;
  let playback = new TimelinePlayback(0);
  let playbackRequest: number | undefined;
  const stopPlayback = () => {
    playback.pause(performance.now());
    if (playbackRequest !== undefined) cancelAnimationFrame(playbackRequest);
    playbackRequest = undefined;
  };
  const playbackTick = (now: number) => {
    playbackRequest = undefined;
    if (disposed) return;
    simulationCursor = playback.advance(now);
    updateRuntimeViews();
    if (playback.playing) playbackRequest = requestAnimationFrame(playbackTick);
  };
  let rawLogOffset = 0;
  let teamPresets: SourceTeamPreset[] = [];
  let selectedPresetId = "";
  let presetName = "";
  try { teamPresets = listSourceTeamPresets(hostVariant); }
  catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  root.innerHTML = '<section class="card source-team-builder"><h2>来源队伍构筑</h2><p role="status">读取固定来源名册…</p></section>';
  const current = () => draft.members[activeMember];
  const notify = () => options.onDraftChange?.(structuredClone(draft));
  const createFromPreset = (characterId: string, tier: CharacterBuildPresetTier, characterKey?: string): SourceTeamMember => {
    if (!inventory) throw new Error("来源名册尚未载入。");
    const preset = getCharacterBuildPreset(characterId, tier);
    if (!preset) throw new Error(`本地目录没有 ${characterId} 的${tier === "starter" ? "基础投入" : "进阶投入"}参考方案。`);
    return equipmentBuildToSourceTeamMember(preset.build, { constellation: preset.constellation, talents: { auto: preset.talentLevels.normal, skill: preset.talentLevels.skill, burst: preset.talentLevels.burst }, ...(characterKey ? { characterKey } : {}) }, inventory);
  };
  const capabilityStatus = (character: SourceInventoryItem | undefined, kind: SourceActionKind): "wait" | "implemented" | "unsupported" | "unresolved" => {
    if (kind === "wait") return "wait";
    const capability = sourceActionCapability(character?.actionCapabilities, kind);
    return capability?.status ?? "unresolved";
  };
  const statusLabel: Record<ReturnType<typeof capabilityStatus>, string> = {
    wait: "等待（独立输入）", implemented: "可排入此来源队伍", unsupported: "不可排入：来源未实现", unresolved: "不可排入：来源方法未解析"
  };
  const reactionLabel: Record<string, string> = {
    vaporize: "蒸发", melt: "融化", overload: "超载", "electro-charged": "感电", aggravate: "激化",
    hyperbloom: "超绽放", burgeon: "烈绽放", bloom: "绽放", freeze: "冻结", physical: "物理",
    geo: "岩队", "lunar-crystallize": "月结晶", "mono-pyro": "纯火", anemo: "风队",
    "lunar-charged": "月感电", "lunar-bloom": "月绽放"
  };
  const templateMemberInfo = (template: typeof teamTemplates[number]) => template.members.map(member => {
    const character = gameDataCatalog.characters.find(item => item.id === member.characterId);
    const source = inventory?.characters.find(item => item.key === member.configurationKey && item.sourceGameId === character?.avatarId);
    let ready = !!character && !!source && !!getCharacterBuildPreset(member.characterId, chosenTier);
    let issue = !character ? "目录角色缺失" : !source ? "当前来源没有此角色配置键" : !getCharacterBuildPreset(member.characterId, chosenTier) ? "角色预设缺失" : "";
    if (ready) {
      try { createFromPreset(member.characterId, chosenTier, member.configurationKey); }
      catch (cause) { ready = false; issue = cause instanceof Error ? cause.message : String(cause); }
    }
    return { member, character, source, ready, issue };
  });
  const templateReadiness = (template: typeof teamTemplates[number]) => {
    const members = templateMemberInfo(template);
    const actions = template.beginnerSequence.map((action, index) => {
      const member = template.members.find(item => item.characterId === action.actor);
      const info = members.find(item => item.member === member);
      return { action, index, info, status: capabilityStatus(info?.source, action.kind) };
    });
    return { members, actions, ready: members.every(item => item.ready) };
  };
  const actionParamText = (params: Record<string, number> | undefined): string => {
    const count = Object.keys(params ?? {}).length;
    return count ? `高级来源参数已设 ${count} 项` : "";
  };
  const templateCard = (template: typeof teamTemplates[number], mode: "preview" | "origin"): string => {
    const readiness = templateReadiness(template);
    const title = mode === "origin" ? `原始模板：${template.name}` : `模板预览：${template.name}`;
    const members = readiness.members.map(({ member, character, source, ready, issue }) =>
      `<li><strong>${escapeHtml(character?.name ?? member.configurationKey)}</strong> · ${escapeHtml(member.role)} · ${escapeHtml(member.configurationKey)}${ready ? "" : ` · 不可载入：${escapeHtml(issue)}`}${source && !source.actionCapabilities ? " · 动作方法依据缺失" : ""}</li>`).join("");
    const actions = readiness.actions.map(({ action, index, info, status }) => {
      const count = action.repeat ?? 1;
      const params = actionParamText(action.params);
      return `<li><span class="source-team-builder__capability source-team-builder__capability--${status}" data-action-capability="${status}">${escapeHtml(statusLabel[status])}</span> 第 ${index + 1} 步：${escapeHtml(info?.character?.name ?? action.actor)} · ${escapeHtml(sourceActionLabels[action.kind])}${count > 1 ? ` ×${count}` : ""}${params ? ` · ${escapeHtml(params)}` : ""}</li>`;
    }).join("");
    const summary = mode === "origin"
      ? "这里只保留草稿的模板来源说明；当前动作状态以下方“当前队伍动作检查”为准。"
      : "先看模板成员映射和来源动作方法状态，再决定是否载入。未实现或未解析的动作会保留原样并标出，载入后可删除或改成当前角色可用动作。";
    return `<section class="source-team-builder__guide" data-template-${mode}><h3>${escapeHtml(title)}</h3><p>${escapeHtml(template.description)}</p><p>反应意图：${escapeHtml(reactionLabel[template.reaction] ?? template.reaction)}。这只是模板说明，不代表实际反应覆盖或最优循环。</p><h4>成员定位</h4><ul>${members}</ul><h4>起步动作</h4><ul class="source-team-builder__guide-actions">${actions}</ul><p class="source-team-builder__note">${escapeHtml(summary)} 来源方法状态不代表当前姿态、能量、冷却、动画或命中条件；这些仍由实际运行回执决定。</p><button type="button" data-template-load="${escapeHtml(template.id)}" ${readiness.ready ? "" : "disabled"}>${mode === "origin" ? "重新载入此模板" : "载入此模板"}</button>${readiness.ready ? "" : `<p class="source-team-builder__note">当前来源缺少基础角色或装备映射，因此暂不能载入；模板仍可查看。</p>`}</section>`;
  };
  const currentActionCheck = (): string => {
    if (!draft.actions.length) return `<section class="source-team-builder__guide" data-current-action-check><h3>当前队伍动作检查</h3><p>尚无动作步骤。选择模板预览或加入角色后，可查看来源方法缺口。</p></section>`;
    const rows = draft.actions.map((action, index) => {
      const member = draft.members.find(candidate => candidate.id === action.actorId);
      const source = memberSource(member);
      const status = capabilityStatus(source, action.kind);
      const capability = action.kind === "wait" ? undefined : sourceActionCapability(source?.actionCapabilities, action.kind);
      const known = capability?.parameters.map(parameter => parameter.key) ?? [];
      const count = action.repeat ?? 1;
      const actor = action.kind === "wait" ? "队伍" : member ? source?.name ?? member.characterKey : `未知角色 ${action.actorId}`;
      const params = actionParamText(action.params);
      return `<li data-current-action-row data-action-capability="${status}"><span class="source-team-builder__capability source-team-builder__capability--${status}">${escapeHtml(statusLabel[status])}</span> 第 ${index + 1} 步：${escapeHtml(actor)} · ${escapeHtml(sourceActionLabels[action.kind])}${count > 1 ? ` ×${count}` : ""}${action.kind === "wait" ? ` · ${action.frames === undefined ? "等待帧数未填写" : `${action.frames} 帧`}` : params ? ` · ${escapeHtml(params)}` : ""}</li>`;
    }).join("");
    return `<section class="source-team-builder__guide" data-current-action-check><h3>当前队伍动作检查</h3><ul class="source-team-builder__guide-actions">${rows}</ul><p class="source-team-builder__note">“可排入”表示此角色的固定来源有对应方法；它不保证当前能量、冷却、动画、姿态或动作条件已满足。实际接受与命中以运行回执为准。</p></section>`;
  };
  const applyTemplate = (templateId: string) => {
    const template = teamTemplates.find(item => item.id === templateId);
    if (!template) throw new Error("队伍模板不存在。");
    const readiness = templateReadiness(template);
    if (!readiness.ready) throw new Error("模板缺少当前来源可用的基础角色或装备映射；请查看模板卡上的具体成员缺口。未实现的动作不会替换或伪装为可用动作。");
    const members = template.members.map(item => createFromPreset(item.characterId, chosenTier, item.configurationKey));
    draft = {
      schemaVersion: 1, source: { hostVariant, revision: inventory!.revision }, templateId: template.id, name: template.name, members,
      actions: [],
      durationSeconds: 30, executionProfile: defaultSourceExecutionProfile(), target: { level: 90, resistance: 0.1, geometry: { ...defaultSourceTargetGeometry } }
    };
    // Templates use distinct character IDs; use their exact member order for actor lookup.
    draft.actions = template.beginnerSequence.map(action => ({ actorId: members[template.members.findIndex(item => item.characterId === action.actor)]?.id ?? "", kind: action.kind, ...(action.repeat === undefined ? {} : { repeat: action.repeat }), ...(action.frames === undefined ? {} : { frames: action.frames }), ...(action.params === undefined ? {} : { params: { ...action.params } }) }));
    previewTemplateId = template.id;
    activeMember = 0; status = `已载入「${template.name}」${chosenTier === "starter" ? "基础投入" : "进阶投入"}参考构筑，动作可任意编辑；角色专属支持范围见构筑依据。`; notify(); render();
  };
  const availableCharacters = () => inventory?.characters.filter(source => characterFor(source) && !!getCharacterBuildPreset(characterFor(source)!.id, chosenTier)) ?? [];
  const memberEditor = (member: SourceTeamMember): string => {
    if (!inventory) return "";
    const char = inventory.characters.find(item => item.key === member.characterKey);
    const compatibleWeapons = inventory.weapons.filter(item => !char?.weaponClass || item.weaponClass === char.weaponClass);
    const setRows = member.artifactSets.map((set, index) => `<div class="source-team-builder__set"><select data-set-key="${index}">${inventory!.artifacts.map(item => option(item.key, `${item.name} · ${item.key}`, set.key)).join("")}</select>${numberInput("set", String(index), set.count, "件数", 1, 5)}<button type="button" data-remove-set="${index}">删除套装</button></div>`).join("");
    const statRows = Object.entries(member.artifactStats).map(([key, value]) => `<div class="source-team-builder__stat"><select data-stat-key="${escapeHtml(key)}">${statOptions.map(item => option(item, item, key)).join("")}</select>${numberInput("stat", key, value, "纯圣遗物增量", -100000, 100000, "any")}<button type="button" data-remove-stat="${escapeHtml(key)}">删除</button></div>`).join("");
    const memberPreset = getCharacterBuildPreset(char ? characterFor(char)?.id ?? "" : "", chosenTier);
    const presetCoverageLabel = memberPreset?.coverage === "role-specific" ? "已维护角色模板" : memberPreset?.coverage === "partial" ? "部分输入，非角色专属推荐" : "通用占位，非角色专属推荐";
    return `<div class="source-team-builder__member-editor"><p class="source-team-builder__note">${escapeHtml(char?.name ?? member.characterKey)} · ${escapeHtml(presetCoverageLabel)} · 来源键 <code>${escapeHtml(member.characterKey)}</code>。更换预设会重置此角色的装备与属性编辑。</p><div><button type="button" data-apply-member-tier>将当前角色改为${chosenTier === "starter" ? "基础投入" : "进阶投入"}参考档</button></div>
      <div class="source-team-builder__fields">${numberInput("member", "level", member.level, "角色等级", 1, Math.min(member.levelCap, char ? sourceCharacterLevelLimit(inventory, char) : 90))}${numberInput("member", "levelCap", member.levelCap, "角色解锁上限", 1, char ? sourceCharacterLevelLimit(inventory, char) : 90)}${numberInput("member", "constellation", member.constellation, "命之座", 0, 6)}${numberInput("member", "auto", member.talents.auto, "普攻天赋", 1, 15)}${numberInput("member", "skill", member.talents.skill, "技能天赋", 1, 15)}${numberInput("member", "burst", member.talents.burst, "爆发天赋", 1, 15)}</div>
      ${draft.startup === "custom" ? `<label>本角色初始能量<input type="number" data-member-field="initialEnergy" min="0" max="1000" step="1" value="${member.initialEnergy ?? ""}" placeholder="请明确填写"></label>` : ""}
      <div class="source-team-builder__fields"><label>武器<select data-member-weapon>${compatibleWeapons.map(item => option(item.key, `${item.name} · ${item.key}`, member.weapon.key)).join("")}</select></label>${numberInput("weapon", "level", member.weapon.level, "武器等级", 1, 90)}${numberInput("weapon", "levelCap", member.weapon.levelCap, "武器上限", 1, 90)}${numberInput("weapon", "refinement", member.weapon.refinement, "精炼", 1, 5)}</div>
      <h4>圣遗物套装</h4><div class="source-team-builder__sets">${setRows}</div><button type="button" data-add-set ${member.artifactSets.reduce((sum, row) => sum + row.count, 0) >= 5 ? "disabled" : ""}>添加套装</button>
      <h4>五件圣遗物属性增量</h4><p class="source-team-builder__note">只填主副词条增量。角色基础、武器基础和套装效果由固定来源执行，独立计算器的条件结果可能不同。</p><div class="source-team-builder__stats">${statRows}</div><button type="button" data-add-stat>添加属性</button>
      <div><button type="button" data-remove-member>移除角色</button></div></div>`;
  };
  const memberSource = (member: SourceTeamMember | undefined) => inventory?.characters.find(character => character.key === member?.characterKey);
  const actionAvailable = (member: SourceTeamMember | undefined, kind: SourceActionKind): boolean => kind === "wait" || sourceActionCapability(memberSource(member)?.actionCapabilities, kind)?.status === "implemented";
  const actorIndexFor = (member: SourceTeamMember | undefined): number | undefined => member
    ? [...runtimeCharacterKeys].find(([, key]) => key === member.characterKey)?.[0]
    : undefined;
  const cooldownRemainingLabel = (member: SourceTeamMember | undefined, kind: SourceActionKind): string => {
    if (kind !== "skill" && kind !== "burst") return "未提供此动作的冷却回执";
    const actorIndex = actorIndexFor(member);
    if (!member || actorIndex === undefined) return "未知（尚无角色运行回执）";
    const keyEvents = runtimeCooldownEvents.filter(event => event.actorIndex === actorIndex && event.action === kind);
    const latest = keyEvents.filter(event => event.frame <= simulationCursor).at(-1);
    const pending = runtimeCooldownJobs.filter(job => job.actorIndex === actorIndex && job.action === kind
      && job.triggerFrame <= simulationCursor && (job.readyFrame === undefined || job.readyFrame > simulationCursor));
    if (pending.some(job => job.readyFrame === undefined)) return "未知（本次观察未记录就绪帧）";
    if (pending.length) {
      const nextReady = Math.min(...pending.map(job => job.readyFrame!));
      const available = latest?.chargesRemain;
      return `${available !== undefined && available > 0 ? `已有 ${available} 次可用；` : ""}剩余 ${Math.max(0, nextReady - simulationCursor)} 帧（${(Math.max(0, nextReady - simulationCursor) / 60).toFixed(2)} 秒）`;
    }
    if (latest?.kind === "ready" && latest.chargesRemain !== undefined && latest.chargesRemain > 0) return `已就绪（来源第 ${latest.frame} 帧记录）`;
    if (latest?.chargesRemain === 0 || latest?.kind === "trigger" || latest?.kind === "reduced") return "未知（尚未观察到就绪）";
    return "未知（未记录初始冷却状态）";
  };
  const statusRemainingLabel = (instance: RuntimeStatusInstance): string => {
    if (simulationCursor < instance.createdFrame) return `尚未创建（第 ${instance.createdFrame} 帧）`;
    if (instance.endState === "unknown-at-end") return "未知（来源未能观测到此状态的结束）";
    if (instance.finalExpiryFrame !== instance.initialExpiryFrame && simulationCursor < simulationEndFrame) return "未知（有效期发生变化，但变化帧未记录）";
    if (instance.endState === "active-at-end" && simulationCursor >= simulationEndFrame) {
      if (instance.finalExpiryFrame < 0) return "观察结束时仍活动；来源未记录固定到期帧";
      return `剩余 ${Math.max(0, instance.finalExpiryFrame - simulationCursor)} 帧（${(Math.max(0, instance.finalExpiryFrame - simulationCursor) / 60).toFixed(2)} 秒）`;
    }
    const expiry = instance.finalExpiryFrame === instance.initialExpiryFrame ? instance.initialExpiryFrame : instance.finalExpiryFrame;
    const endAt = instance.endState === "removed" || instance.endState === "replaced"
      ? expiry < 0 ? instance.endFrame : Math.min(expiry, instance.endFrame)
      : expiry;
    if (endAt < 0) return "活动中；来源未记录固定到期帧";
    if (simulationCursor < endAt) return `剩余 ${endAt - simulationCursor} 帧（${((endAt - simulationCursor) / 60).toFixed(2)} 秒）`;
    if (simulationCursor === endAt) return "结束边界（同帧先后未知）";
    return `${instance.endState === "replaced" ? "已被替换" : instance.endState === "removed" ? "已移除" : "已到期"}（第 ${endAt} 帧）`;
  };
  const effectRemainingLabel = (member: SourceTeamMember | undefined, kind: SourceActionKind): string => {
    if (!member) return "未知（尚未选择角色）";
    const sequences = new Set(runtimeReceipts.filter(receipt => receipt.characterKey === member.characterKey && receipt.action === kind).map(receipt => receipt.sequence));
    const matching = runtimeStatuses.filter(instance => instance.creationActionSequence !== undefined && sequences.has(instance.creationActionSequence));
    if (!matching.length) return "未知（未记录可关联的状态期限）";
    return matching.slice(0, 3).map(instance => `${instance.statusKey}：${statusRemainingLabel(instance)}`).join("；");
  };
  const runtimeActionSummary = (member: SourceTeamMember | undefined, kind: SourceActionKind): string => {
    const cooldownLabel = kind === "skill" ? "E 冷却" : kind === "burst" ? "Q 冷却" : "冷却";
    return `<small class="source-team-builder__runtime" data-runtime-action-summary><span>${cooldownLabel}剩余：${escapeHtml(cooldownRemainingLabel(member, kind))}</span><span>本动作关联状态剩余：${escapeHtml(effectRemainingLabel(member, kind))}</span></small>`;
  };
  const sourceActionLink = (source: { path: string; line: number }, label: string): string => {
    const repository = inventory!.repository.startsWith("https://") ? inventory!.repository : `https://github.com/${inventory!.repository}`;
    const url = `${repository.replace(/\/$/, "")}/blob/${inventory!.revision}/${source.path.split("/").map(encodeURIComponent).join("/")}#L${source.line}`;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
  };
  const actionGuide = (): string => {
    const character = memberSource(current());
    if (!character) return "";
    const caps = character.actionCapabilities;
    if (!caps) return '<p data-source-action-guide>此来源尚无角色动作依据；不能从角色武器类型猜测支持的动作。</p>';
    const supported = caps.actions.filter(action => action.status === "implemented");
    const unavailable = caps.actions.filter(action => action.status !== "implemented");
    const chain = caps.normalChain.length;
    return `<details data-source-action-guide><summary>${escapeHtml(character.name)} · E/Q/A 动作说明与来源限制</summary>
      <p>亮起的动作按钮表示当前固定来源有对应方法，灰色动作不能排入可运行动作轴。可排入不代表此刻能成功；能量、冷却、动画、姿态和动作条件以运行回执为准。</p>
      <p>A 普攻按钮每次添加一次输入。${chain === null ? "此来源未确认普攻连段长度，连续普攻仅作为多次输入。" : `来源记录普攻链长为 ${chain} 段；连续输入会接续当时段数，输入次数不等于命中数。`}</p>
      <ul>${supported.map(action => `<li>${action.source ? sourceActionLink(action.source, sourceActionLabels[action.kind]) : escapeHtml(sourceActionLabels[action.kind])}${action.parameters.length ? `；高级参数键：${action.parameters.map(parameter => sourceActionLink(parameter.source, parameter.key)).join("、")}。不清楚参数含义时保持默认输入。` : "；无需填写额外参数。"}</li>`).join("")}</ul>
      ${unavailable.length ? `<p>此来源目前不能使用：${unavailable.map(action => `${escapeHtml(sourceActionLabels[action.kind])}（${action.status === "unsupported" ? "来源未实现" : "来源方法未解析"}）`).join("、")}。</p>` : ""}</details>`;
  };
  const comboControls = (): string => {
    const member = current(), chain = memberSource(member)?.actionCapabilities?.normalChain.length;
    if (!chain || !actionAvailable(member, "attack")) return "";
    return `<div class="source-team-builder__quick" data-source-normal-combo aria-label="连续普攻输入">${Array.from({ length: chain }, (_, index) => `<button type="button" data-normal-combo="${index + 1}">连续 ${index + 1} 次普攻</button>`).join("")}</div><p class="source-team-builder__note">这些按钮添加普攻输入次数，接续当前连段；不是选择第几段伤害，也不会自动重置普攻计数器。</p>`;
  };
  const primaryActionControls = (): string => {
    const member = current();
    const source = memberSource(member);
    const primary: SourceCharacterActionKind[] = ["skill", "burst", "attack"];
    return `<div class="source-team-builder__quick" aria-label="常用动作">${primary.map(kind => {
      const available = actionAvailable(member, kind);
      const label = sourceActionLabels[kind];
      const reason = !member ? "先选择角色" : statusLabel[capabilityStatus(source, kind)];
      return `<button type="button" data-quick-action="${kind}" ${available ? "" : `disabled title="${escapeHtml(reason)}"`}>${escapeHtml(label)}${available ? "" : ` · ${escapeHtml(reason)}`}${runtimeActionSummary(member, kind)}</button>`;
    }).join("")}</div>`;
  };
  const additionalActionControls = (): string => {
    const member = current();
    const additional = actionButtons.filter(([kind]) => kind !== "wait" && !["skill", "burst", "attack"].includes(kind) && actionAvailable(member, kind));
    if (!additional.length) return "";
    return `<details><summary>更多已实现动作</summary><div class="source-team-builder__quick">${additional.map(([kind, label]) => `<button type="button" data-quick-action="${kind}">${escapeHtml(label)}</button>`).join("")}</div></details>`;
  };
  const actionRow = (action: SourceTeamAction, index: number): string => {
    const member = draft.members.find(candidate => candidate.id === action.actorId);
    const capability = action.kind === "wait" ? undefined : sourceActionCapability(memberSource(member)?.actionCapabilities, action.kind);
    const choices = actionButtons.filter(([kind]) => kind === action.kind || actionAvailable(member, kind));
    const knownKeys = capability?.parameters.map(parameter => parameter.key) ?? [];
    const configuredParams = Object.keys(action.params ?? {}).length;
    const paramsEditor = `<details class="source-team-builder__parameters" data-action-params-details><summary>高级：本步参数与状态 · ${configuredParams ? `已设置 ${configuredParams} 项` : "默认输入"}</summary>${runtimeActionSummary(member, action.kind)}<p>普通 E/Q/A 输入通常不需要填写。只接受当前角色来源明确识别的参数键；不清楚含义时留空。</p><label>来源参数键=整数<input data-action-params="${index}" value="${escapeHtml(Object.entries(action.params ?? {}).map(([key, value]) => `${key}=${value}`).join(","))}" placeholder="留空使用来源默认输入" aria-describedby="source-action-hint-${index}" ${knownKeys.length ? "" : "disabled"}></label><small id="source-action-hint-${index}" class="source-team-builder__action-hint">${knownKeys.length ? `当前动作可用键：${knownKeys.map(escapeHtml).join("、")}；详见角色动作说明中的来源链接。` : "当前动作没有来源登记的参数键；请保持默认输入。"}</small></details>`;
    return `<li class="source-team-builder__action"><span class="source-team-builder__order">${index + 1}</span><label>角色<select data-action-actor="${index}" ${action.kind === "wait" ? "disabled" : ""}>${draft.members.map(member => option(member.id, inventory?.characters.find(item => item.key === member.characterKey)?.name ?? member.characterKey, action.actorId)).join("")}</select></label><label>动作<select data-action-kind="${index}">${choices.map(([kind, label]) => `<option value="${kind}" ${kind === action.kind ? "selected" : ""} ${actionAvailable(member, kind) ? "" : "disabled"}>${label}${actionAvailable(member, kind) ? "" : " · 不可排入"}</option>`).join("")}</select></label>${numberInput("action-repeat", String(index), action.repeat ?? 1, "输入次数", 1, 100)}${action.kind === "wait" ? numberInput("action-frames", String(index), action.frames ?? 60, "等待帧", 0, 216000) : paramsEditor}<div class="source-team-builder__row-buttons"><button type="button" data-action-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="上移第 ${index + 1} 步">↑</button><button type="button" data-action-down="${index}" ${index === draft.actions.length - 1 ? "disabled" : ""} aria-label="下移第 ${index + 1} 步">↓</button><button type="button" data-action-copy="${index}">复制</button><button type="button" data-action-delete="${index}">删除</button></div></li>`;
  };
  const setRuntimeState = (logs: unknown, statusInstances: unknown, endFrame?: number): void => {
    const rows = Array.isArray(logs) ? logs.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row)) : [];
    runtimeReceipts = sourceActionReceipts(rows);
    runtimeCharacterKeys = new Map<number, string>();
    runtimeCooldownEvents = [];
    runtimeCooldownJobs = [];
    for (const row of rows) {
      const data = row.logs && typeof row.logs === "object" && !Array.isArray(row.logs) ? row.logs as Record<string, unknown> : {};
      if (row.event === "character" && typeof row.char_index === "number") {
        const base = data.char_base;
        if (base && typeof base === "object" && typeof (base as Record<string, unknown>).key === "string") runtimeCharacterKeys.set(row.char_index, String((base as Record<string, unknown>).key));
      }
      if (row.event !== "cooldown" || typeof row.frame !== "number" || !Number.isFinite(row.frame) || typeof data.type !== "string") continue;
      const message = String(row.msg ?? "");
      const kind = message.includes(" cooldown triggered") ? "trigger" : message.includes(" cooldown ready") ? "ready" : message.includes(" cooldown forcefully reduced") ? "reduced" : undefined;
      if (!kind || typeof row.char_index !== "number" || !Number.isInteger(row.char_index) || row.char_index < 0) continue;
      runtimeCooldownEvents.push({ actorIndex: row.char_index, action: data.type, frame: row.frame, kind,
        ...(typeof data.charges_remain === "number" ? { chargesRemain: data.charges_remain } : {}) });
    }
    runtimeCooldownEvents.sort((left, right) => left.frame - right.frame);
    const pendingJobs = new Map<string, RuntimeCooldownJob[]>();
    for (const event of runtimeCooldownEvents) {
      const key = `${event.actorIndex}:${event.action}`;
      const jobs = pendingJobs.get(key) ?? [];
      if (event.kind === "trigger") {
        const job: RuntimeCooldownJob = { actorIndex: event.actorIndex, action: event.action, triggerFrame: event.frame };
        jobs.push(job); runtimeCooldownJobs.push(job);
      } else if (event.kind === "ready") {
        const job = jobs.find(candidate => candidate.readyFrame === undefined && candidate.triggerFrame <= event.frame);
        if (job) job.readyFrame = event.frame;
      }
      pendingJobs.set(key, jobs);
    }
    runtimeStatuses = (Array.isArray(statusInstances) ? statusInstances : []).flatMap((raw): RuntimeStatusInstance[] => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const row = raw as Record<string, unknown>;
      if (typeof row.actorIndex !== "number" || !Number.isInteger(row.actorIndex) || typeof row.statusKey !== "string"
        || typeof row.instanceId !== "number" || typeof row.createdFrame !== "number" || typeof row.initialExpiryFrame !== "number"
        || typeof row.finalExpiryFrame !== "number" || typeof row.endState !== "string" || typeof row.endFrame !== "number") return [];
      return [{ actorIndex: row.actorIndex, statusKey: row.statusKey, instanceId: row.instanceId, createdFrame: row.createdFrame,
        ...(typeof row.creationActionSequence === "number" ? { creationActionSequence: row.creationActionSequence } : {}),
        initialExpiryFrame: row.initialExpiryFrame, finalExpiryFrame: row.finalExpiryFrame, endState: row.endState, endFrame: row.endFrame }];
    });
    simulationEndFrame = typeof endFrame === "number" && Number.isFinite(endFrame) && endFrame >= 0
      ? Math.floor(endFrame)
      : Math.max(0, ...rows.flatMap(row => typeof row.frame === "number" && Number.isFinite(row.frame) ? [Math.floor(row.frame)] : []));
    stopPlayback();
    playback = new TimelinePlayback(simulationEndFrame);
    playback.seek(simulationEndFrame, performance.now());
    simulationCursor = simulationEndFrame;
  };
  const runtimeEffectRows = (): string => {
    if (!runtimeStatuses.length) return "<p>本次来源日志没有可识别的状态期限；状态剩余未知。</p>";
    const rows = runtimeStatuses.slice(0, 80).map(instance => {
      const key = runtimeCharacterKeys.get(instance.actorIndex);
      const owner = key ? inventory?.characters.find(character => character.key === key)?.name ?? key : `队伍第 ${instance.actorIndex + 1} 位`;
      const remaining = statusRemainingLabel(instance);
      const origin = instance.creationActionSequence === undefined ? "创建动作未关联" : `动作序号 ${instance.creationActionSequence}`;
      return `<li><strong>${escapeHtml(owner)} · ${escapeHtml(instance.statusKey)}</strong>：${escapeHtml(remaining)} <small>· ${escapeHtml(origin)}</small></li>`;
    }).join("");
    return `<ul>${rows}</ul>${runtimeStatuses.length > 80 ? `<p>显示前 80 / ${runtimeStatuses.length} 条已记录状态。</p>` : ""}`;
  };
  const updateRuntimeViews = (): void => {
    const slider = root.querySelector<HTMLInputElement>("[data-sim-time-cursor]");
    if (slider) slider.value = String(simulationCursor);
    const playButton = root.querySelector<HTMLButtonElement>("[data-playback-toggle]");
    if (playButton) playButton.textContent = playback.playing ? "暂停" : "播放回放";
    const readout = root.querySelector<HTMLElement>("[data-sim-time-readout]");
    if (readout) readout.textContent = `第 ${simulationCursor} 帧 · ${(simulationCursor / 60).toFixed(2)} 秒 / 共 ${simulationEndFrame} 帧`;
    const timeline = root.querySelector<HTMLElement>('[data-source-timeline]');
    if (timeline) {
      timeline.dataset.playbackFrame = String(simulationCursor);
      timeline.style.setProperty('--playback-position', `${simulationEndFrame ? Math.min(100, 100 * simulationCursor / simulationEndFrame) : 0}%`);
      let active: HTMLElement | undefined, previous: HTMLElement | undefined;
      for (const row of timeline.querySelectorAll<HTMLElement>('[data-timeline-start]')) {
        const start = Number(row.dataset.timelineStart), end = Number(row.dataset.timelineEnd);
        const current = simulationCursor === start || (Number.isInteger(end) && start <= simulationCursor && simulationCursor < end);
        row.dataset.playbackState = current ? 'active' : simulationCursor < start ? 'future' : 'past';
        if (current) active ??= row;
        if (start <= simulationCursor) previous = row;
      }
      const current = active ?? previous;
      if (current && (current.offsetTop < timeline.scrollTop || current.offsetTop + current.offsetHeight > timeline.scrollTop + timeline.clientHeight))
        timeline.scrollTop = Math.max(0, current.offsetTop - timeline.clientHeight / 2);
    }
    const effects = root.querySelector<HTMLElement>("[data-runtime-effects]");
    if (effects) effects.innerHTML = runtimeEffectRows();
    root.querySelectorAll<HTMLButtonElement>("[data-quick-action]").forEach(button => {
      const summary = button.querySelector<HTMLElement>("[data-runtime-action-summary]");
      const kind = button.dataset.quickAction as SourceActionKind | undefined;
      if (summary && kind) summary.outerHTML = runtimeActionSummary(current(), kind);
    });
    root.querySelectorAll<HTMLSelectElement>("[data-action-kind]").forEach(select => {
      const index = Number(select.dataset.actionKind), action = draft.actions[index];
      const member = action && draft.members.find(candidate => candidate.id === action.actorId);
      const row = select.closest<HTMLElement>(".source-team-builder__action");
      const summary = row?.querySelector<HTMLElement>("[data-runtime-action-summary]");
      if (summary && action && action.kind !== "wait") summary.outerHTML = runtimeActionSummary(member, action.kind);
    });
  };
  const renderRuntimePanel = (): string => `<section class="source-team-builder__runtime-panel" aria-label="动作回放"><h4>动作回放</h4><div class="source-team-builder__fields"><button type="button" data-playback-toggle ${simulationEndFrame === 0 ? "disabled" : ""}>${playback.playing ? "暂停" : "播放回放"}</button><label>回放倍率<select data-playback-speed>${PLAYBACK_SPEEDS.map(speed => `<option value="${speed}" ${playback.speed === speed ? "selected" : ""}>${speed}x</option>`).join("")}</select></label><button type="button" data-playback-end>直接查看结果</button></div><p>拖动或播放，查看所选帧的实际动作。</p><label>模拟时间<input type="range" data-sim-time-cursor min="0" max="${simulationEndFrame}" step="1" value="${simulationCursor}"></label><output data-sim-time-readout>第 ${simulationCursor} 帧 · ${(simulationCursor / 60).toFixed(2)} 秒 / 共 ${simulationEndFrame} 帧</output><details data-runtime-details><summary>高级：冷却与状态记录</summary><p>计算完成后即可查看结果；回放只改变查看时刻，不改变伤害、随机种子或模拟时间轴。</p><p class="source-team-builder__note">1 秒按 60 帧换算。E/Q 冷却只在来源日志记录就绪帧后显示倒计时；状态时间只对应本次来源记录并关联到动作的状态实例，不代表所有队伍增益。缺少就绪帧、固定期限或状态变更帧时显示“未知”。</p><div data-runtime-effects>${runtimeEffectRows()}</div></details></section>`;
  const renderLogs = () => {
    const host = root.querySelector<HTMLElement>("[data-source-team-logs]");
    if (!host) return;
    if (executionLogs == null) { host.textContent = "运行后显示来源实际动作、动画、冷却与能量记录。"; return; }
    const entries = Array.isArray(executionLogs) ? executionLogs : [executionLogs];
    type LogRow = { event?: unknown; frame?: unknown; ended?: unknown; char_index?: unknown; msg?: unknown; logs?: unknown };
    const rows = entries.filter((entry): entry is LogRow => !!entry && typeof entry === "object" && !Array.isArray(entry));
    const fields = (row: LogRow): Record<string, unknown> => row.logs && typeof row.logs === "object" && !Array.isArray(row.logs) ? row.logs as Record<string, unknown> : {};
    const characterNames = new Map<number, string>();
    for (const row of rows) {
      if (row.event !== "character" || typeof row.char_index !== "number") continue;
      const base = fields(row).char_base;
      if (base && typeof base === "object" && typeof (base as Record<string, unknown>).key === "string") characterNames.set(row.char_index, (base as Record<string, string>).key!);
    }
    const actor = (row: LogRow): string => {
      if (typeof row.char_index !== "number" || row.char_index < 0) return "队伍";
      const key = characterNames.get(row.char_index);
      return key ? inventory?.characters.find(character => character.key === key)?.name ?? key : `队伍第 ${row.char_index + 1} 位`;
    };
    const labels: Record<string, string> = { skill: "E 技能", burst: "Q 爆发", attack: "A 普攻", charge: "重击", aim: "瞄准", dash: "冲刺", jump: "跳跃", low_plunge: "低空下落", high_plunge: "高空下落", swap: "切人" };
    const displayAction = (value: unknown): string => labels[String(value)] ?? String(value ?? "动作");
    const events = rows.flatMap(row => {
      const data = fields(row), frame = row.frame, message = String(row.msg ?? "");
      if (typeof frame !== "number" || !Number.isInteger(frame)) return [];
      let title = "", detail = "", kind = "", end: number | undefined;
      if (row.event === "action" && message === "source-host action rejected") {
        const reasons: Record<string, string> = { insufficient_energy: "能量不足", cooldown: "冷却尚未就绪", skill_cd: "E 冷却尚未就绪", burst_cd: "Q 冷却尚未就绪", insufficient_stamina: "体力不足" };
        kind = "rejected"; title = `拒绝 ${displayAction(data.action)}`;
        detail = `${reasons[String(data.reason)] ?? String(data.reason ?? "来源未给原因")}；这是实际重试，未执行该动作`;
      } else if (row.event === "action" && message === "source-host execution delay configured") {
        kind = "delay"; title = `${displayAction(data.action)} 执行配置延迟`;
        detail = `本次配置 ${data.profileDelay} 帧；含脚本显式 delay 的累计动作前延迟 ${data.totalPreActionDelay} 帧。就绪检查后倒计时，实际施放时刻见动作回执。`;
      } else if (row.event === "action" && message.startsWith("executed ") && typeof data.action === "string") {
        kind = "action"; title = `执行 ${displayAction(data.action)}`;
        if (typeof data.swap_cd_post === "number") detail = `切人冷却剩余 ${data.swap_cd_post} 帧`;
      } else if (row.event === "action" && message.startsWith("executed wait") && typeof data.f === "number") {
        kind = "wait"; title = `等待 ${data.f} 帧`; end = frame + data.f;
      } else if (row.event === "hitlag" && message.endsWith(" started")) {
        kind = "animation"; title = `动画 ${displayAction(message.slice(0, -8))}`;
        if (typeof row.ended === "number" && Number.isInteger(row.ended) && row.ended > frame) { end = row.ended; detail = `实际结束或中断于第 ${row.ended} 帧（${row.ended - frame} 帧）`; }
        else detail = "本次日志没有结束帧";
        if (typeof data.AnimationLength === "number") detail += `；来源动画长度 ${data.AnimationLength} 帧`;
        if (typeof data.CanQueueAfter === "number") detail += `；动画内部排队门槛 ${data.CanQueueAfter} 帧`;
        const thresholds = Object.entries(labels).flatMap(([key, label]) => typeof data[key] === "number" ? [`${label} ${data[key]}`] : []);
        if (thresholds.length) detail += `；转入下一动作的内部帧门槛：${thresholds.join("、")}`;
      } else if (row.event === "cooldown") {
        kind = "cooldown"; title = message.includes("ready") ? `${displayAction(data.type)} 冷却就绪` : message.includes("triggered") ? `${displayAction(data.type)} 冷却触发` : `冷却：${message}`;
        if (typeof data.expiry === "number") detail = `日志记录的当前剩余 ${data.expiry} 帧`;
        if (typeof data.charges_remain === "number") detail += `${detail ? "；" : ""}剩余可用次数 ${data.charges_remain}`;
      } else if (row.event === "energy" && (message === "draining energy" || message === "adding energy")) {
        kind = "energy"; title = message === "draining energy" ? "消耗能量" : "获得能量";
        const before = data.pre_drain ?? data.pre_recovery, after = data.post_drain ?? data.post_recovery;
        if (typeof before === "number" && typeof after === "number") detail = `${before} → ${after}${typeof data.max_energy === "number" ? ` / ${data.max_energy}` : ""}`;
        if (typeof data.source === "string") detail += `${detail ? "；" : ""}来源 ${data.source}`;
      } else return [];
      return [{ frame, end, actor: actor(row), title, detail, kind }];
    });
    let eventDetails = '';
    if (!events.length) { host.innerHTML = `<p>本次来源日志没有可识别的动作、冷却或能量事件。可在下方查看原始记录。</p>`; }
    else {
      const selected = events.slice(0, 200);
      const timeline = events.filter(event => event.kind === "action" || event.kind === "wait" || event.kind === "animation").sort((a,b) => a.frame-b.frame);
      const maxFrame = Math.max(1, simulationEndFrame);
      const bars = timeline.map(event => {
        const left = Math.min(100, Math.max(0, 100 * event.frame / maxFrame));
        const width = event.end !== undefined ? Math.max(.6, 100 * (event.end - event.frame) / maxFrame) : .6;
        return `<div class="source-team-builder__timeline-row" data-timeline-start="${event.frame}"${event.end === undefined ? '' : ` data-timeline-end="${event.end}"`} data-timeline-kind="${event.kind}"><span title="${escapeHtml(event.actor)} · ${escapeHtml(event.title)} · ${event.frame}${event.end !== undefined ? `–${event.end}` : ''} 帧">${escapeHtml(event.actor)} · ${escapeHtml(event.title)} · ${event.frame}${event.end !== undefined ? `–${event.end}` : ""} 帧</span><div class="source-team-builder__track"><i class="source-team-builder__bar source-team-builder__bar--${event.kind}" style="left:${left}%;width:${Math.min(100 - left, width)}%"></i></div></div>`;
      }).join("");
      const table = selected.map(event => `<tr><td>${event.frame}</td><td>${escapeHtml(event.actor)}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.detail || "—")}</td></tr>`).join("");
      host.innerHTML = `<h4>实际动作与动画</h4><div class="source-team-builder__timeline" data-source-timeline aria-label="实际动作时间线"><div class="source-team-builder__timeline-axis">0 帧 <span>${maxFrame} 帧</span></div>${bars}</div><p class="source-team-builder__note">绿色线为查看时刻，高亮为该帧正在进行的已记录动画。</p>`;
      eventDetails = `<p>${events.length} 条实际来源事件：动作、等待、动画、冷却和能量。下表只展示日志已有的数值；冷却「剩余帧」是当时记录值，实际就绪以就绪事件为准。</p><p>时间线保留 ${timeline.length} 条动作与动画，动画高亮仅使用已记录的起止帧。</p><div class="source-team-builder__table-wrap"><table><thead><tr><th>来源帧</th><th>角色</th><th>实际事件</th><th>来源数值</th></tr></thead><tbody>${table}</tbody></table></div>${events.length > 200 ? `<p>表格显示前 200 / ${events.length} 条相关事件；完整原始日志可分页查看。</p>` : ""}`;
    }
    host.insertAdjacentHTML("afterbegin", renderRuntimePanel());
    host.insertAdjacentHTML("beforeend", `<details data-source-record-details><summary>高级：逐步动作与完整来源记录</summary>${renderSourceActionReceipts(executionLogs, key => inventory?.characters.find(character => character.key === key)?.name ?? key, displayAction)}${eventDetails}<p class="source-team-builder__note">动画长度、排队门槛和转入下一动作的门槛使用来源动画内部计时，可能受卡肉暂停或归一化时钟影响；不能直接加上起始帧来预测实际结束或可施放帧。实际输入窗口以上方回执为准。</p><details class="source-team-builder__raw"><summary>原始来源日志（${entries.length} 条，按 50 条分页）</summary><label>起始行<input type="number" data-source-team-raw-offset min="0" max="${Math.max(0, entries.length - 1)}" step="50" value="${Math.min(rawLogOffset, Math.max(0, entries.length - 1))}"></label><pre data-source-team-raw></pre></details></details>`);
    const raw = host.querySelector<HTMLElement>("[data-source-team-raw]");
    if (raw) raw.textContent = JSON.stringify(entries.slice(rawLogOffset, rawLogOffset + 50), null, 2);
  };
  const render = () => {
    if (disposed) return;
    if (!inventory) { root.innerHTML = `<section class="card source-team-builder"><h2>来源队伍构筑</h2><p role="status">${escapeHtml(error || "读取固定来源名册…")}</p></section>`; return; }
    activeMember = Math.min(activeMember, Math.max(0, draft.members.length - 1));
    const executionProfile = normalizeSourceExecutionProfile(draft.executionProfile);
    draft.executionProfile = executionProfile;
    const selectedPreset = findSourceTeamPreset(teamPresets, selectedPresetId);
    const unavailableActionIndex = draft.actions.findIndex(action => !actionAvailable(draft.members.find(member => member.id === action.actorId), action.kind));
    const unavailableAction = unavailableActionIndex >= 0 ? draft.actions[unavailableActionIndex] : undefined;
    const unavailableMember = unavailableAction ? draft.members.find(member => member.id === unavailableAction.actorId) : undefined;
    const runBlocked = !draft.members.length || !draft.actions.length || unavailableActionIndex >= 0;
    const runHint = unavailableAction
      ? `第 ${unavailableActionIndex + 1} 步在当前来源不能排入：${statusLabel[capabilityStatus(memberSource(unavailableMember), unavailableAction.kind)]}。改选可用动作或删除该步后才能运行。`
      : !draft.members.length ? "先选择角色，再添加 E、Q 或 A 普攻。"
        : !draft.actions.length ? "点 E、Q 或 A 普攻，把动作加入顺序后即可运行。"
          : "将按动作卡顺序运行；完成后先看总伤、实际时间和伤害率。";
    const presetSummary = selectedPreset ? `来源 ${selectedPreset.source.hostVariant} · ${selectedPreset.source.revision.slice(0, 7)}；${selectedPreset.draft.members.length} 位成员：${selectedPreset.draft.members.map(member => inventory!.characters.find(item => item.key === member.characterKey)?.name ?? member.characterKey).join("、") || "无"}；${selectedPreset.draft.actions.length} 条动作：${selectedPreset.draft.actions.slice(0, 3).map(action => `${inventory!.characters.find(item => item.key === selectedPreset.draft.members.find(member => member.id === action.actorId)?.characterKey)?.name ?? action.actorId} ${sourceActionLabels[action.kind] ?? action.kind}`).join("、") || "无"}${selectedPreset.draft.actions.length > 3 ? "…" : ""}；${selectedPreset.draft.durationSeconds} 秒，${{ once: "执行一次", count: "指定次数", continuous: "循环至观察窗结束" }[selectedPreset.draft.rotationLoop?.mode ?? "once"]}，${{ full: "满能", zero: "零能", custom: "自定义" }[selectedPreset.draft.startup ?? "full"]}起步。` : "选择预设只改变所选记录，不会载入或修改当前队伍。";
    const openSections = new Set([...root.querySelectorAll<HTMLDetailsElement>("details[data-team-section][open]")].map(section => section.dataset.teamSection));
    root.innerHTML = `<section class="card source-team-builder" aria-label="来源队伍构筑"><h2>来源队伍构筑</h2><p>从入门队伍或 1–4 位角色开始，按顺序点 E、Q、A 普攻添加动作；灰色动作不属于当前来源的可运行方法。实际冷却、关联状态和伤害以运行回执为准。</p>
      <div class="source-team-builder__fields"><label>队伍名称<input data-draft-name value="${escapeHtml(draft.name)}"></label><label>参考构筑<select data-tier>${option("starter", "基础投入档", chosenTier)}${option("developed", "进阶投入档", chosenTier)}</select></label><button type="button" data-apply-team-tier ${draft.members.length ? "" : "disabled"}>应用到全队</button><label>队伍模板<select data-template><option value="">选择入门队伍…</option>${teamTemplates.map(item => option(item.id, item.name, previewTemplateId)).join("")}</select></label></div>
      <details data-team-section="presets"><summary>高级：本机队伍预设</summary><section class="source-team-builder__presets" aria-label="本机来源队伍预设"><h3>本机多预设库（${hostVariant}）</h3><div class="source-team-builder__fields"><label>已保存预设<select data-team-preset><option value="">选择预设（不会自动载入）</option>${teamPresets.map(preset => option(preset.id, `${preset.name} · ${preset.source.revision.slice(0, 7)}`, selectedPresetId)).join("")}</select></label><label>预设名称<input data-preset-name value="${escapeHtml(presetName || draft.name)}"></label><button type="button" data-preset-load ${selectedPreset ? "" : "disabled"}>载入所选</button><button type="button" data-preset-save-new>另存为新预设</button><button type="button" data-preset-update ${selectedPreset ? "" : "disabled"}>更新所选</button><button type="button" data-preset-delete ${selectedPreset ? "" : "disabled"}>删除所选</button></div><p class="source-team-builder__note">${escapeHtml(presetSummary)} 载入后编辑不会自动改写预设；只有点击“更新所选”才会覆盖该记录，同名另存会新建独立记录。</p></section></details>
      ${draft.templateId && teamTemplates.some(item => item.id === draft.templateId) ? `<details data-team-section="template"><summary>入门队伍说明</summary>${templateCard(teamTemplates.find(item => item.id === draft.templateId)!, "origin")}</details>` : ""}
      ${previewTemplateId && previewTemplateId !== draft.templateId ? templateCard(teamTemplates.find(item => item.id === previewTemplateId)!, "preview") : ""}
      <details data-team-section="action-check"><summary>高级：动作支持与来源限制</summary>${currentActionCheck()}</details>
      <div class="source-team-builder__fields"><label>自由加入角色<select data-add-character><option value="">选择角色…</option>${availableCharacters().map(item => option(item.key, `${item.name} · ${item.key}`, "")).join("")}</select></label></div>
      <details data-team-section="settings"><summary>高级：目标、观察时间与执行设置</summary>
      <div class="source-team-builder__fields">${numberInput("draft", "durationSeconds", draft.durationSeconds, "观察秒数", 1 / 60, 3600, "any")}${numberInput("target", "level", draft.target.level, "目标等级", 1, 200)}<label>通用抗性（小数）<input type="number" step="any" data-target-field="resistance" value="${escapeHtml(draft.target.resistance)}"></label></div>
      <section data-team-first-target><h3>目标 1</h3>${renderSourceTargetGeometryControls(draft.target.geometry)}
      ${renderSourceTargetProfileControls(draft.target)}</section>
      ${renderSourceTargetSceneControls(draft)}
      <div class="source-team-builder__fields"><label>观察窗预设<select data-duration-preset><option value="">自定义</option>${[15, 18, 20, 60, 90, 120].map(seconds => option(String(seconds), `${seconds}秒观察窗`, String(draft.durationSeconds))).join("")}</select></label><label>初始能量<select data-startup>${option("full", "满能起步", draft.startup ?? "full")}${option("zero", "零能起步", draft.startup ?? "full")}${option("custom", "逐角色自定义", draft.startup ?? "full")}</select></label></div>
      <h3>动作执行难度</h3><div class="source-team-builder__fields"><label>动作延迟预设<select data-execution-profile>${option("ideal", "理想 · 零帧延迟", executionProfile.mode)}${option("practical", "实用 · 来源 human 固定值 8/5 帧", executionProfile.mode)}${option("conservative", "保守 · 参考假设 12/8 帧", executionProfile.mode)}${option("custom", "自定义", executionProfile.mode)}</select></label></div><p class="source-team-builder__note">延迟影响实际来源动作队列与输入窗口，不对伤害作折扣。实用档采用固定来源 human 数值：切人 8 帧、其他七类输入 5 帧；切人延迟沿用来源换人动画，不重复加算，其他输入是在就绪后增加延迟。保守档的 12/8 帧是本工具参考假设，不代表 KQMS 标准。实际帧数以运行回执和来源日志为准。</p><div class="source-team-builder__fields source-team-builder__delays">${SOURCE_DELAY_KEYS.map(key => numberInput("delay", key, executionProfile.delays[key], `${key === "aim_delay" ? "瞄准" : ({ swap: "切人", attack: "普攻", charge: "重击", skill: "元素战技", burst: "元素爆发", jump: "跳跃", dash: "冲刺" } as Record<string, string>)[key]}（帧）`, 0, 120, "1", executionProfile.mode !== "custom")).join("")}</div>
      <p class="source-team-builder__note">满能只在开场提供一次，不绕过后续消耗；零能按实际产球启动。自定义超过来源上限时会被来源钳制，特殊爆发资源遵循该角色实现，以实际能量账本为准。观察时长不等于轮转长度，稳态尚未建立时不能自动填充稳态初能。</p>
      </details>
      <div class="source-team-builder__tabs">${draft.members.map((member, index) => `<button type="button" data-member-tab="${index}" ${activeMember === index ? 'aria-current="true"' : ""}>${index + 1}. ${escapeHtml(inventory!.characters.find(item => item.key === member.characterKey)?.name ?? member.characterKey)}</button>`).join("")}</div>
      <h3>有序动作卡</h3><p class="source-team-builder__note">点一次 E/Q/A 会把当前角色的一次动作输入加到队尾；A 是一次普攻输入，不等于命中次数。先选角色，再按想要的顺序点击。</p><div class="editor-actions"><button type="button" data-clear-actions ${draft.actions.length ? "" : "disabled"}>清空动作顺序</button></div>${primaryActionControls()}${additionalActionControls()}${comboControls()}${actionGuide()}<ol class="source-team-builder__actions">${draft.actions.map(actionRow).join("")}</ol>
      <div class="editor-actions"><button type="button" data-run-direct class="primary" aria-describedby="source-team-run-hint" ${runBlocked ? "disabled" : ""}>运行动作轴</button></div><p id="source-team-run-hint" role="status" class="source-team-builder__note">${escapeHtml(runHint)}</p>
      <details data-team-section="equipment"><summary>高级：装备、天赋与角色属性</summary>${current() ? memberEditor(current()!) : "<p>先选择一个模板，或从角色列表自由加入。</p>"}</details>
      <details data-team-section="rotation"><summary>高级：循环与动作输入选项</summary><div class="source-team-builder__fields"><label>整套动作的执行方式<select data-rotation-loop>${option("once", "执行一次", draft.rotationLoop?.mode ?? "once")}${option("count", "重复指定次数", draft.rotationLoop?.mode ?? "once")}${option("continuous", "循环至观察窗结束", draft.rotationLoop?.mode ?? "once")}</select></label>${draft.rotationLoop?.mode === "count" ? numberInput("rotation", "count", draft.rotationLoop.count ?? 1, "整套动作重复次数", 1, 1000) : ""}</div><p class="source-team-builder__note">按钮将动作添加到末尾。动作行的重复只影响该行动；整套循环沿用前轮的实际能量、冷却和场上状态，不在轮间补能。观察窗可能截断末轮；重复运行不等于已证明稳态。</p></details>
      <details data-team-section="files"><summary>高级：脚本与草稿文件</summary><div class="source-team-builder__footer"><button type="button" data-apply-script>生成并填入 GCSL</button><button type="button" data-save-draft>保存草稿到本机</button><button type="button" data-load-draft>读取本机草稿</button><button type="button" data-export-draft>导出 JSON</button><label class="file-button">导入 JSON<input type="file" data-import-draft accept="application/json"></label></div></details>
      <p role="status" aria-live="polite" class="source-team-builder__status">${escapeHtml(error || status)}</p><details open><summary>本次来源实际动作时间线</summary><div data-source-team-logs></div></details></section>`;
    for (const section of root.querySelectorAll<HTMLDetailsElement>("details[data-team-section]")) section.open = openSections.has(section.dataset.teamSection);
    renderLogs();
    updateRuntimeViews();
  };
  const readSceneDraft = (): SourceTeamDraft => {
    const first = root.querySelector<HTMLElement>("[data-team-first-target]")!;
    const level = root.querySelector<HTMLInputElement>('[data-target-field="level"]')!.valueAsNumber;
    const resistance = root.querySelector<HTMLInputElement>('[data-target-field="resistance"]')!.valueAsNumber;
    const target = readSourceTargetProfileControls(first, { ...draft.target, level, resistance,
      geometry: readSourceTargetGeometryControls(first) });
    return { ...draft, ...readSourceTargetSceneControls(root, { ...draft, target }) };
  };
  const fail = (cause: unknown) => { error = cause instanceof Error ? cause.message : String(cause); status = ""; render(); };
  const change = () => { error = ""; status = "草稿已编辑；运行结果需重新执行。"; notify(); render(); };
  let deferredFormRender: number | undefined;
  const changeFromForm = () => {
    error = "";
    status = "草稿已编辑；运行结果需重新执行。";
    notify();
    if (deferredFormRender !== undefined) window.clearTimeout(deferredFormRender);
    deferredFormRender = window.setTimeout(() => {
      deferredFormRender = undefined;
      render();
    }, 0);
  };
  const parseParams = (text: string): Record<string, number> => {
    const result: Record<string, number> = {};
    if (!text.trim()) return result;
    for (const pair of text.split(",")) {
      const match = pair.trim().match(/^([a-z][a-z0-9_]*)\s*=\s*(-?\d+)$/);
      if (!match) throw new Error("动作参数须用整数键值，例如 参数名=整数；请使用角色实际支持的键。 ");
      result[match[1]!] = Number(match[2]);
    }
    return result;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.playbackToggle !== undefined) {
      if (playback.playing) stopPlayback();
      else { playback.play(performance.now()); playbackRequest = requestAnimationFrame(playbackTick); }
      updateRuntimeViews(); return;
    }
    if (button.dataset.playbackEnd !== undefined) {
      stopPlayback(); playback.seek(simulationEndFrame, performance.now());
      simulationCursor = simulationEndFrame; updateRuntimeViews(); return;
    }
    const selectedPreset = findSourceTeamPreset(teamPresets, selectedPresetId);
    try {
      if (button.dataset.targetSceneAction !== undefined) {
        const scene = sourceTargetSceneControlAction(root, readSceneDraft(), button.dataset.targetSceneAction as SourceTargetSceneControlAction,
          button.dataset.targetSceneIndex === undefined ? undefined : Number(button.dataset.targetSceneIndex));
        draft = { ...draft, ...scene.scene }; error = ""; status = scene.message ?? "目标场景已编辑。"; notify(); render(); return;
      }
      if (button.dataset.targetPhaseAction !== undefined) {
        const currentDraft = readSceneDraft();
        const targetSection = button.closest<HTMLElement>("[data-target-scene-target]");
        const targetIndex = targetSection ? Number(targetSection.dataset.targetSceneTarget) : 0;
        const phaseTarget = [currentDraft.target, ...(currentDraft.additionalTargets ?? [])][targetIndex];
        if (!phaseTarget) throw new Error("目标阶段所属的目标不存在。");
        const action = button.dataset.targetPhaseAction;
        if (action !== "add" && action !== "remove") throw new Error("目标阶段操作无效。");
        const next = sourceTargetPhaseControlAction(phaseTarget.phases ?? [], action,
          button.dataset.targetPhaseIndex === undefined ? undefined : Number(button.dataset.targetPhaseIndex));
        if (next.length) phaseTarget.phases = next; else delete phaseTarget.phases;
        draft = currentDraft; error = ""; status = "目标阶段已编辑；运行结果需重新执行。"; notify(); render(); return;
      }
      if (button.dataset.clearActions !== undefined) { if (draft.actions.length) { draft.actions = []; change(); } return; }
      if (button.dataset.memberTab !== undefined) { activeMember = Number(button.dataset.memberTab); render(); return; }
      if (button.dataset.templateLoad !== undefined) { applyTemplate(button.dataset.templateLoad); return; }
      if (button.dataset.applyMemberTier !== undefined && current() && inventory) {
        const source = inventory.characters.find(item => item.key === current()!.characterKey)!;
        const character = characterFor(source);
        if (!character) throw new Error("本地目录缺少该角色的参考预设。");
        const next = createFromPreset(character.id, chosenTier, source.key);
        const previous = current()!;
        draft.members[activeMember] = { ...next, id: previous.id, ...(previous.initialEnergy === undefined ? {} : { initialEnergy: previous.initialEnergy }) }; change(); return;
      }
      if (button.dataset.applyTeamTier !== undefined && inventory) {
        const next = draft.members.map(member => {
          const source = inventory!.characters.find(item => item.key === member.characterKey)!;
          const character = characterFor(source);
          if (!character) throw new Error(`${source.name} 缺少本地参考预设。`);
          return { ...createFromPreset(character.id, chosenTier, source.key), id: member.id, ...(member.initialEnergy === undefined ? {} : { initialEnergy: member.initialEnergy }) };
        });
        draft.members = next; change(); return;
      }
      if (button.dataset.normalCombo !== undefined) {
        const count = Number(button.dataset.normalCombo), member = current();
        const chain = memberSource(member)?.actionCapabilities?.normalChain.length;
        if (!member || !chain || !actionAvailable(member, "attack") || !Number.isInteger(count) || count < 1 || count > chain) throw new Error("该连续普攻输入缺少来源链长依据。");
        draft.actions.push({ actorId: member.id, kind: "attack", repeat: count }); change(); return;
      }
      if (button.dataset.quickAction) {
        const kind = button.dataset.quickAction as SourceActionKind;
        if (!actionAvailable(current(), kind)) throw new Error("当前角色在所选来源中没有此动作依据。");
        draft.actions.push({ actorId: current()?.id ?? "", kind, ...(kind === "wait" ? { frames: 60 } : {}) }); change(); return;
      }
      if (button.dataset.removeMember !== undefined) {
        const removed = draft.members.splice(activeMember, 1)[0];
        draft.actions = draft.actions.filter(action => action.actorId !== removed?.id || action.kind === "wait"); change(); return;
      }
      if (button.dataset.addSet !== undefined && current() && inventory) {
        const member = current()!; const used = member.artifactSets.reduce((sum, row) => sum + row.count, 0);
        const available = inventory.artifacts.find(item => !member.artifactSets.some(row => row.key === item.key));
        if (!available || used >= 5) throw new Error("没有可添加的套装位置。");
        member.artifactSets.push({ key: available.key, count: 1 }); change(); return;
      }
      if (button.dataset.removeSet !== undefined && current()) { current()!.artifactSets.splice(Number(button.dataset.removeSet), 1); change(); return; }
      if (button.dataset.addStat !== undefined && current()) {
        const key = statOptions.find(item => !(item in current()!.artifactStats));
        if (key) current()!.artifactStats[key] = 0;
        change(); return;
      }
      if (button.dataset.removeStat !== undefined && current()) { delete current()!.artifactStats[button.dataset.removeStat]; change(); return; }
      const index = Number(button.dataset.actionUp ?? button.dataset.actionDown ?? button.dataset.actionCopy ?? button.dataset.actionDelete);
      if (Number.isInteger(index) && index >= 0 && index < draft.actions.length) {
        if (button.dataset.actionUp !== undefined && index > 0) [draft.actions[index - 1], draft.actions[index]] = [draft.actions[index]!, draft.actions[index - 1]!];
        if (button.dataset.actionDown !== undefined && index < draft.actions.length - 1) [draft.actions[index + 1], draft.actions[index]] = [draft.actions[index]!, draft.actions[index + 1]!];
        if (button.dataset.actionCopy !== undefined) draft.actions.splice(index + 1, 0, structuredClone(draft.actions[index]!));
        if (button.dataset.actionDelete !== undefined) draft.actions.splice(index, 1);
        change(); return;
      }
      if (button.dataset.applyScript !== undefined || button.dataset.runDirect !== undefined || button.dataset.saveDraft !== undefined || button.dataset.exportDraft !== undefined || button.dataset.presetSaveNew !== undefined || button.dataset.presetUpdate !== undefined) draft = readSceneDraft();
      if (button.dataset.applyScript !== undefined) { if (!inventory) throw new Error("来源名册尚未载入。"); options.onApplyScript(compileSourceTeamDraft(draft, inventory), resolveSourceTargetScene(draft).primaryTargetIndex, sourceTargetPhasesRequest(draft)); error = ""; status = "脚本已填入来源执行器；请运行以查看实际帧、冷却与伤害。"; render(); return; }
      if (button.dataset.runDirect !== undefined) {
        if (!inventory || !options.onRunScript) throw new Error("直接运行尚不可用，请更新此页面后重试。");
        if (!draft.members.length || !draft.actions.length) throw new Error("先选择角色，再加入至少一个 E、Q 或普攻动作。");
        options.onRunScript(compileSourceTeamDraft(draft, inventory), resolveSourceTargetScene(draft).primaryTargetIndex, sourceTargetPhasesRequest(draft));
        error = ""; status = "已从可视化动作卡启动；实际动画、冷却和能量以本次来源回执为准。"; render(); return;
      }
      if (button.dataset.presetSaveNew !== undefined) {
        if (!inventory) throw new Error("来源名册尚未载入。");
        const saved = saveNewSourceTeamPreset(hostVariant, inventory.revision, draft, presetName || draft.name);
        teamPresets = saved.presets; selectedPresetId = saved.preset.id; presetName = saved.preset.name;
        error = ""; status = `已另存新预设“${saved.preset.name}”；当前草稿与新记录分开。`; render(); return;
      }
      if (button.dataset.presetUpdate !== undefined) {
        if (!inventory || !selectedPresetId) throw new Error("请先选择要更新的预设。");
        teamPresets = updateSourceTeamPreset(hostVariant, inventory.revision, teamPresets, selectedPresetId, draft, presetName || draft.name);
        error = ""; status = "已明确更新所选预设。"; render(); return;
      }
      if (button.dataset.presetLoad !== undefined) {
        if (!inventory || !selectedPreset) throw new Error("请先选择要载入的预设。");
        if (selectedPreset.source.revision !== inventory.revision) throw new Error(`此预设来自 ${selectedPreset.source.revision}；当前执行器固定为 ${inventory.revision}，请导出 JSON 后切换到对应来源版本。`);
        presetName = selectedPreset.name; setDraft(selectedPreset.draft, true); status = `已载入预设“${selectedPreset.name}”；后续草稿编辑不会自动覆盖保存项。`; render(); return;
      }
      if (button.dataset.presetDelete !== undefined) {
        if (!selectedPresetId) throw new Error("请先选择要删除的预设。");
        const removedName = selectedPreset?.name ?? "所选预设";
        teamPresets = deleteSourceTeamPreset(hostVariant, teamPresets, selectedPresetId); selectedPresetId = ""; presetName = draft.name;
        error = ""; status = `已删除“${removedName}”；当前草稿未改变。`; render(); return;
      }
      if (button.dataset.saveDraft !== undefined) { localStorage.setItem(storageKey, JSON.stringify(draft)); error = ""; status = "草稿已保存到此浏览器。"; render(); return; }
      if (button.dataset.loadDraft !== undefined) { const saved = localStorage.getItem(storageKey) ?? (hostVariant === "classic" ? localStorage.getItem(STORAGE_KEY) : null); if (!saved) throw new Error("此浏览器尚无保存的草稿。"); setDraft(JSON.parse(saved)); status = "已读取本机草稿。"; render(); return; }
      if (button.dataset.exportDraft !== undefined) { const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "source-team-draft.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
    } catch (cause) { fail(cause); }
  };
  root.oninput = event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.simTimeCursor === undefined) return;
    const frame = Number(target.value);
    if (!Number.isInteger(frame)) return;
    playback.seek(frame, performance.now());
    simulationCursor = playback.frame;
    updateRuntimeViews();
  };
  root.onchange = event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (!root.contains(target)) return;
    if (target.dataset.playbackSpeed !== undefined) {
      playback.setSpeed(Number(target.value), performance.now());
      simulationCursor = playback.frame; updateRuntimeViews(); return;
    }
    try {
      if (target.dataset.tier !== undefined) { chosenTier = target.value as CharacterBuildPresetTier; status = "已切换预设等级；现有成员保持当前编辑。重新选择模板或角色可应用新等级。"; render(); return; }
      if (target.dataset.template !== undefined) { previewTemplateId = target.value; error = ""; render(); return; }
      if (target.dataset.teamPreset !== undefined) { selectedPresetId = target.value; presetName = findSourceTeamPreset(teamPresets, selectedPresetId)?.name ?? draft.name; error = ""; status = "预设选择已更改；当前队伍未载入或改动。"; render(); return; }
      if (target.dataset.addCharacter !== undefined && target.value && inventory) {
        if (draft.members.length >= 4) throw new Error("队伍最多四位角色。");
        const source = inventory.characters.find(item => item.key === target.value)!;
        const character = characterFor(source);
        if (!character) throw new Error("本地目录缺少该角色。");
        const member = createFromPreset(character.id, chosenTier, source.key);
        if (draft.members.some(item => item.characterKey === member.characterKey)) throw new Error("队伍不能重复同一角色形态。");
        draft.members.push(member); activeMember = draft.members.length - 1; change(); return;
      }
      if (target.dataset.importDraft !== undefined) {
        const file = (target as HTMLInputElement).files?.[0]; if (!file) return;
        void file.text().then(text => setDraft(JSON.parse(text))).catch(fail); return;
      }
      if (target.dataset.sourceTeamRawOffset !== undefined) {
        const entries = Array.isArray(executionLogs) ? executionLogs : [executionLogs];
        rawLogOffset = Math.max(0, Math.min(entries.length - 1, Number(target.value) || 0));
        const raw = root.querySelector<HTMLElement>("[data-source-team-raw]");
        if (raw) raw.textContent = JSON.stringify(entries.slice(rawLogOffset, rawLogOffset + 50), null, 2);
        return;
      }
      if (target.dataset.targetProfile !== undefined || target.dataset.targetResistance !== undefined
        || target.dataset.targetGeometry !== undefined || target.dataset.targetField !== undefined
        || target.dataset.targetSceneField !== undefined || target.dataset.targetScenePrimary !== undefined
        || target.dataset.targetPhaseField !== undefined) {
        try {
          draft = readSceneDraft();
          updateSourceTargetSceneDiagram(root, draft);
          updateSourceTargetGeometryDiagram(root.querySelector<HTMLElement>("[data-team-first-target]")!, draft.target.geometry!);
          for (const [index, extra] of (draft.additionalTargets ?? []).entries())
            updateSourceTargetGeometryDiagram(root.querySelector<HTMLElement>(`[data-target-scene-target="${index + 1}"]`)!, extra.geometry!);
          error = ""; status = "目标参数已编辑；运行结果需重新执行。"; notify();
        } catch (cause) {
          error = cause instanceof Error ? cause.message : String(cause); status = "";
        }
        const message = root.querySelector<HTMLElement>(".source-team-builder__status");
        if (message) message.textContent = error || status;
        return;
      }
      if (target.dataset.draftName !== undefined) draft.name = target.value;
      else if (target.dataset.presetName !== undefined) { presetName = target.value; return; }
      else if (target.dataset.rotationLoop !== undefined) draft.rotationLoop = { mode: target.value as "once" | "count" | "continuous", ...(target.value === "count" ? { count: draft.rotationLoop?.count ?? 1 } : {}) };
      else if (target.dataset.rotationField === "count") draft.rotationLoop = { mode: "count", count: Number(target.value) };
      else if (target.dataset.startup !== undefined) draft.startup = target.value as NonNullable<SourceTeamDraft["startup"]>;
      else if (target.dataset.executionProfile !== undefined) {
        const mode = target.value as SourceExecutionProfileMode;
        if (mode === "custom") draft.executionProfile = { version: SOURCE_EXECUTION_PROFILE_VERSION, mode, delays: { ...(draft.executionProfile?.delays ?? SOURCE_EXECUTION_PROFILE_DEFAULTS.practical) } };
        else draft.executionProfile = { version: SOURCE_EXECUTION_PROFILE_VERSION, mode, delays: { ...SOURCE_EXECUTION_PROFILE_DEFAULTS[mode] } };
      }
      else if (target.dataset.delayField !== undefined) {
        if (!draft.executionProfile || draft.executionProfile.mode !== "custom") throw new Error("请先选择自定义延迟预设。");
        draft.executionProfile.delays[target.dataset.delayField as SourceDelayKey] = Number(target.value);
      }
      else if (target.dataset.durationPreset !== undefined) { if (!target.value) return; draft.durationSeconds = Number(target.value); }
      else if (target.dataset.draftField) draft.durationSeconds = Number(target.value);
      else if (target.dataset.targetField === "level") draft.target.level = Number(target.value);
      else if (target.dataset.targetField === "resistance") draft.target.resistance = Number(target.value);
      else if (target.dataset.targetGeometry !== undefined) draft.target.geometry = readSourceTargetGeometryControls(root);
      else if (target.dataset.memberField && current()) {
        const field = target.dataset.memberField, value = Number(target.value);
        if (field === "auto" || field === "skill" || field === "burst") current()!.talents[field] = value;
        else if (field === "initialEnergy") { if (!target.value.trim()) delete current()!.initialEnergy; else current()!.initialEnergy = value; }
        else if (field === "level" || field === "levelCap" || field === "constellation") current()![field] = value;
      } else if (target.dataset.memberWeapon !== undefined && current()) current()!.weapon.key = target.value;
      else if (target.dataset.weaponField && current()) {
        const field = target.dataset.weaponField as keyof SourceTeamMember["weapon"];
        if (field !== "key") current()!.weapon[field] = Number(target.value);
      } else if (target.dataset.setKey !== undefined && current()) current()!.artifactSets[Number(target.dataset.setKey)]!.key = target.value;
      else if (target.dataset.setField !== undefined && current()) current()!.artifactSets[Number(target.dataset.setField)]!.count = Number(target.value);
      else if (target.dataset.statKey !== undefined && current()) {
        const oldKey = target.dataset.statKey, value = current()!.artifactStats[oldKey] ?? 0;
        if (target.value !== oldKey) { delete current()!.artifactStats[oldKey]; current()!.artifactStats[target.value] = value; }
      } else if (target.dataset.statField !== undefined && current()) current()!.artifactStats[target.dataset.statField] = Number(target.value);
      else if (target.dataset.actionActor !== undefined) draft.actions[Number(target.dataset.actionActor)]!.actorId = target.value;
      else if (target.dataset.actionKind !== undefined) { const action = draft.actions[Number(target.dataset.actionKind)]!; action.kind = target.value as SourceActionKind; if (action.kind === "wait") action.frames ??= 60; else delete action.frames; }
      else if (target.dataset.actionRepeatField !== undefined) draft.actions[Number(target.dataset.actionRepeatField)]!.repeat = Number(target.value);
      else if (target.dataset.actionFramesField !== undefined) draft.actions[Number(target.dataset.actionFramesField)]!.frames = Number(target.value);
      else if (target.dataset.actionParams !== undefined) draft.actions[Number(target.dataset.actionParams)]!.params = parseParams(target.value);
      else return;
      changeFromForm();
    } catch (cause) { fail(cause); }
  };
  const setDraft = (value: SourceTeamDraft, preservePresetSelection = false) => {
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.members) || !Array.isArray(value.actions) || !value.target) throw new Error("队伍草稿 JSON 结构不正确。 ");
    if ((value.source?.hostVariant ?? "classic") !== hostVariant) throw new Error("此草稿属于另一来源执行器，请先切换来源版本再导入；旧版无来源标识的草稿属于 b4ae769。");
    if (value.members.length === 0 && value.actions.length !== 0) throw new Error("空队伍不能包含角色动作。");
    resolveSourceTargetScene(value);
    if (inventory && value.members.length) compileSourceTeamDraft(value, inventory);
    draft = structuredClone(value);
    if (typeof value.templateId !== "string" || !teamTemplates.some(item => item.id === value.templateId)) delete draft.templateId;
    draft.executionProfile = normalizeSourceExecutionProfile(value.executionProfile);
    previewTemplateId = draft.templateId ?? "";
    if (inventory) draft.source = { hostVariant, revision: inventory.revision };
    if (!preservePresetSelection) { selectedPresetId = ""; presetName = draft.name; }
    activeMember = 0; error = ""; notify(); render();
  };
  void loadSourceTeamInventory(hostVariant).then(value => {
    if (disposed) return;
    inventory = value;
    if (options.initialTemplateId) { applyTemplate(options.initialTemplateId); return; }
    if (draft.members.length) compileSourceTeamDraft(draft, value);
    draft.source ??= { hostVariant, revision: value.revision };
    notify(); render();
  }).catch(cause => { if (!disposed) fail(cause); });
  return {
    setDraft,
    getDraft: () => structuredClone(draft),
    getCharacterName: characterKey => inventory?.characters.find(character => character.key === characterKey)?.name,
    renderExecutionLogs(logs, statusInstances, endFrame) { executionLogs = logs; setRuntimeState(logs, statusInstances, endFrame); rawLogOffset = 0; renderLogs(); updateRuntimeViews(); },
    dispose() { stopPlayback(); disposed = true; root.onclick = null; root.onchange = null; root.oninput = null; root.replaceChildren(); }
  };
}
