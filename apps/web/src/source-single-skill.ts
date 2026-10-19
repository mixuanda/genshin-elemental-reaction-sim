import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { getCharacterBuildPreset, type CharacterBuildPresetTier } from "../../../packages/game-data/src/character-build-presets";
import { captureSourceHostActionCollection, captureSourceHostFiniteSkillCollection, calculateSourceHostActionCollection, sourceHostActionHasEvidence, type SourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import { sourceActionReceipts } from "../../../packages/sim-core/src/source-host-action-origin";
import { getSourceHostFiniteCastContract } from "../../../packages/sim-core/src/source-host-finite-cast";
import { SOURCE_HOST_PROTOCOL, sourceHostResultSchema, sourceHostRunRequestSchema, type SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import type { SourceCharacterActionKind } from "./source-action-capabilities";
import type { SourceHostWorkerRequest } from "./source-host-batch";
import { compileSourceTeamDraft, equipmentBuildToSourceTeamMember, type SourceHostVariant, type SourceTeamDraft, type SourceTeamInventory, type SourceTeamMember } from "./source-team-builder";
import { sourceTargetPhasesRequest } from "./source-target-scene";

export interface SourceSingleSkillDraft {
  schemaVersion: 1;
  source: { hostVariant: SourceHostVariant; revision: string };
  member: SourceTeamMember;
  action: { kind: SourceCharacterActionKind; params?: Record<string, number> };
  durationSeconds: number;
  target: SourceTeamDraft["target"];
  additionalTargets?: NonNullable<SourceTeamDraft["additionalTargets"]>;
  primaryTargetIndex?: number;
  startup: "full" | "zero" | "custom";
  seed: string;
}

/** Uses an actual local reference build and its exact source configuration key. */
export function createSourceSingleSkillPreset(
  inventory: SourceTeamInventory, characterKey: string, tier: CharacterBuildPresetTier,
): SourceTeamMember {
  const sourceCharacter = inventory.characters.find(item => item.key === characterKey);
  if (!sourceCharacter) throw new Error(`所选来源 ${inventory.hostVariant} 没有角色配置键 ${characterKey}。`);
  const character = gameDataCatalog.characters.find(item => item.avatarId === sourceCharacter.sourceGameId);
  if (!character) throw new Error(`${characterKey} 没有可对应的本地角色目录身份，不能猜测配装。`);
  const preset = getCharacterBuildPreset(character.id, tier);
  if (!preset) throw new Error(`${character.name} 没有${tier === "starter" ? "小毕业" : "大毕业"}参考配装。`);
  return equipmentBuildToSourceTeamMember(preset.build, {
    constellation: preset.constellation,
    talents: { auto: preset.talentLevels.normal, skill: preset.talentLevels.skill, burst: preset.talentLevels.burst },
    characterKey,
  }, inventory);
}

/** One accepted action is requested; the following wait keeps the native observation open. */
export function compileSourceSingleSkill(draft: SourceSingleSkillDraft, inventory: SourceTeamInventory): SourceHostWorkerRequest {
  if (draft.schemaVersion !== 1) throw new Error("单技能草稿版本不受支持。");
  if (!draft.source || draft.source.hostVariant !== inventory.hostVariant || draft.source.revision !== inventory.revision)
    throw new Error("单技能草稿来源与当前名册不同，不能更换规则后沿用原动作。");
  if (!/^[0-9]+$/.test(draft.seed) || BigInt(draft.seed) > 18446744073709551615n)
    throw new Error("来源随机种子须为 uint64 十进制整数。");
  if (!draft.action || typeof draft.action !== "object" || Object.keys(draft.action).some(key => key !== "kind" && key !== "params"))
    throw new Error("单技能入口只接受一次角色动作及其来源参数。");
  const frames = Math.ceil(draft.durationSeconds * 60);
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > 216000)
    throw new Error("观察窗须为 1–216000 帧；请调整秒数。");
  const teamDraft: SourceTeamDraft = {
    schemaVersion: 1, source: draft.source, name: "单角色实际动作观察",
    members: [draft.member],
    actions: [{ actorId: draft.member.id, kind: draft.action.kind, repeat: 1,
      ...(draft.action.params === undefined ? {} : { params: draft.action.params }) },
      { actorId: draft.member.id, kind: "wait", frames }],
    rotationLoop: { mode: "once" }, durationSeconds: draft.durationSeconds,
    target: draft.target, startup: draft.startup,
    ...(draft.additionalTargets === undefined ? {} : { additionalTargets: draft.additionalTargets }),
    ...(draft.primaryTargetIndex === undefined ? {} : { primaryTargetIndex: draft.primaryTargetIndex }),
  };
  const targetPhases = sourceTargetPhasesRequest(teamDraft);
  return sourceHostRunRequestSchema.parse({ protocol: SOURCE_HOST_PROTOCOL,
    config: compileSourceTeamDraft(teamDraft, inventory), seed: draft.seed, hostVariant: inventory.hostVariant, stopAtDuration: true, primaryTargetIndex: draft.primaryTargetIndex ?? 0,
    ...(targetPhases ? { targetPhases } : {}) });
}

export interface SourceSingleSkillSelection {
  action: { sequence: number; characterKey: string; action: string; queuedFrame: number; acceptedFrame: number; inputWindowFrame?: number; noOp?: boolean };
  association: SourceHostActionCollection["association"];
  availableAssociations: SourceHostActionCollection["association"][];
  collection?: SourceHostActionCollection;
  analysis?: ReturnType<typeof calculateSourceHostActionCollection>;
  finiteContract?: ReturnType<typeof getSourceHostFiniteCastContract>;
  finiteCollection?: SourceHostActionCollection;
  unassociatedApplicationCount: number;
  otherAssociatedApplicationCount: number;
}

/** A no-hit action remains unquantified unless the native ledger records a miss. */
export function selectSourceSingleSkillAction(
  raw: unknown, association: SourceHostActionCollection["association"] = "creation", draft?: SourceSingleSkillDraft,
): SourceSingleSkillSelection {
  if (association === "skill-ownership") throw new Error("技能归属由有限技能集合提供，请选择创建、触发或状态拥有者查看普通观察。");
  const result: SourceHostResult = sourceHostResultSchema.parse(raw);
  const accepted = sourceActionReceipts(result.logs).filter(row => row.acceptedFrame !== undefined && row.action !== "wait" && row.action !== "swap");
  if (accepted.length !== 1) throw new Error(`实际来源须恰好接受一次角色动作；记录到 ${accepted.length} 次。`);
  const action = accepted[0]!;
  if (draft && (action.characterKey !== draft.member.characterKey || action.action !== draft.action.kind))
    throw new Error("实际接受动作与单技能草稿角色或动作类型不同。");
  const sequence = action.sequence;
  const finiteContract = getSourceHostFiniteCastContract(result.sourceCommit, action.characterKey, action.action);
  const finiteCollection = captureSourceHostFiniteSkillCollection(result, sequence);
  const linked = (origin: SourceHostResult["applications"][number]["origin"]): boolean =>
    origin?.creationActionSequence === sequence || origin?.triggerActionSequence === sequence
    || origin?.statusOwner?.creationActionSequence === sequence;
  const unassociatedApplicationCount = result.applications.filter(row => !linked(row.origin)).length;
  const associations = ["creation", "trigger", "status-owner"] as const;
  const associationSequence = (origin: SourceHostResult["applications"][number]["origin"], association: typeof associations[number]) =>
    association === "creation" ? origin?.creationActionSequence
      : association === "trigger" ? origin?.triggerActionSequence : origin?.statusOwner?.creationActionSequence;
  if (!associations.includes(association)) throw new Error("动作关联类型须为创建、触发或状态拥有者。");
  const availableAssociations = associations.filter(candidate => sourceHostActionHasEvidence(result, sequence, candidate));
  const otherAssociatedApplicationCount = result.applications.filter(row => linked(row.origin)
    && associationSequence(row.origin, association) !== sequence).length;
  if (!availableAssociations.includes(association)) return { action: { ...action, acceptedFrame: action.acceptedFrame! },
    association, availableAssociations, unassociatedApplicationCount, otherAssociatedApplicationCount,
    ...(finiteContract === undefined ? {} : { finiteContract }), ...(finiteCollection === undefined ? {} : { finiteCollection }) };
  const collection = captureSourceHostActionCollection(result, sequence, association);
  return { action: { ...action, acceptedFrame: action.acceptedFrame! }, association, availableAssociations, collection,
    analysis: calculateSourceHostActionCollection(collection), unassociatedApplicationCount, otherAssociatedApplicationCount,
    ...(finiteContract === undefined ? {} : { finiteContract }), ...(finiteCollection === undefined ? {} : { finiteCollection }) };
}
