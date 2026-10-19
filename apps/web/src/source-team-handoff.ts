import { compileSourceTeamDraft, type SourceTeamDraft, type SourceTeamInventory, type SourceTeamMember } from "./source-team-builder";

export type SourceTeamHandoffMode = "merge" | "replace";

/** Build and validate the entire next draft before the caller changes the current team. */
export function prepareSourceTeamHandoff(
  current: SourceTeamDraft | undefined,
  members: SourceTeamMember[],
  inventory: SourceTeamInventory,
  mode: SourceTeamHandoffMode,
): SourceTeamDraft {
  if (members.length < 1 || members.length > 4) throw new Error("请选择 1–4 套配装加入队伍。");
  if (mode !== "merge" && mode !== "replace") throw new Error("请选择合并当前队伍或创建新队伍。");
  if (new Set(members.map(member => member.characterKey)).size !== members.length) throw new Error("所选配装包含同一角色的多个方案，请每位角色只选一套。");
  const source = { hostVariant: inventory.hostVariant, revision: inventory.revision };
  const draft: SourceTeamDraft = mode === "merge" && current ? structuredClone(current) : {
    schemaVersion: 1, source, name: "我的导入队伍", members: [], actions: [],
    durationSeconds: 30, target: { level: 90, resistance: 0.1 },
  };
  if (draft.source && (draft.source.hostVariant !== source.hostVariant || draft.source.revision !== source.revision)) {
    throw new Error("当前队伍使用不同的固定来源，不能合并。可保留原草稿并明确选择创建新队伍。");
  }
  for (const member of members) {
    const same = draft.members.findIndex(row => row.characterKey === member.characterKey);
    if (same >= 0) {
      const previous = draft.members[same]!;
      draft.members[same] = { ...structuredClone(member), id: previous.id,
        ...(previous.initialEnergy === undefined ? {} : { initialEnergy: previous.initialEnergy }) };
    } else {
      draft.members.push(structuredClone(member));
    }
  }
  if (draft.members.length > 4) throw new Error("合并后超过四人，请减少所选角色，或选择用所选配装创建新队伍。");
  draft.source = source;
  compileSourceTeamDraft(draft, inventory);
  return draft;
}
