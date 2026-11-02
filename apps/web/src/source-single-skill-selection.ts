import type { SourceCharacterActionKind } from "./source-action-capabilities";
import type { SourceSingleSkillDraft } from "./source-single-skill";
import type { SourceTeamInventory } from "./source-team-builder";

export interface SourceSingleSkillSelectionPreference {
  /** Exact native configuration key, checked against the loaded source inventory. */
  characterKey: string;
  preferredAction?: SourceCharacterActionKind;
}

export function resolveSourceSingleSkillSelection(
  inventory: SourceTeamInventory, selection: SourceSingleSkillSelectionPreference, currentAction?: SourceCharacterActionKind,
): { characterKey: string; actionKind: SourceCharacterActionKind } {
  const character = inventory.characters.find(row => row.key === selection.characterKey);
  if (!character) throw new Error(`当前固定来源没有角色配置键 ${selection.characterKey}；未改选其他角色。`);
  const implemented = character.actionCapabilities?.schemaVersion === 1
    ? character.actionCapabilities.actions.filter(row => row.status === "implemented").map(row => row.kind) : [];
  if (selection.preferredAction !== undefined && !implemented.includes(selection.preferredAction))
    throw new Error(`${character.name} 的动作 ${selection.preferredAction} 在当前固定来源没有明确的已实现依据；未改选其他动作。`);
  const actionKind = selection.preferredAction ?? (currentAction !== undefined && implemented.includes(currentAction) ? currentAction : implemented[0]);
  if (!actionKind) throw new Error(`${character.name} 没有明确标记为已实现的动作方法。`);
  return { characterKey: character.key, actionKind };
}

/** Reopening an existing actor changes only the requested action. Equipment,
 * initial energy, targets and observation inputs remain the user's own values. */
export function applySourceSingleSkillSelection(
  draft: SourceSingleSkillDraft, selection: SourceSingleSkillSelectionPreference, inventory: SourceTeamInventory,
): SourceSingleSkillDraft {
  if (draft.source.hostVariant !== inventory.hostVariant || draft.source.revision !== inventory.revision)
    throw new Error("当前单动作输入与固定来源名册不同，不能沿用该配装输入。");
  const resolved = resolveSourceSingleSkillSelection(inventory, selection, draft.action.kind);
  if (draft.member.characterKey !== resolved.characterKey) throw new Error("请先载入所选角色的实际配装或参考构筑，不能跨角色沿用当前配装。");
  const next = structuredClone(draft);
  if (next.action.kind !== resolved.actionKind) next.action = { kind: resolved.actionKind };
  return next;
}
