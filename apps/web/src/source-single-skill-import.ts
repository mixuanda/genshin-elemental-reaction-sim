import { importSessionPolicy } from './import-session-policy';
import { parseEnkaBuilds, parseGoodBuilds, type BuildImportBatch, type ImportedEditableBuild } from "../../../packages/game-data/src/build-import";
import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { equipmentBuildToSourceTeamMember, compileSourceTeamDraft, type SourceTeamDraft, type SourceTeamInventory, type SourceTeamMember } from "./source-team-builder";

export interface SourceSingleSkillBuildCandidate {
  id: string;
  label: string;
  member?: SourceTeamMember;
  error?: string;
}

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function validateMember(member: SourceTeamMember, inventory: SourceTeamInventory): void {
  const draft: SourceTeamDraft = {
    schemaVersion: 1,
    source: { hostVariant: inventory.hostVariant, revision: inventory.revision },
    name: "单动作配装校验",
    members: [structuredClone(member)],
    actions: [],
    durationSeconds: 1,
    target: { level: 90, resistance: 0.1 },
  };
  compileSourceTeamDraft(draft, inventory);
}

function fromDraft(raw: Record<string, unknown>, inventory: SourceTeamInventory): SourceSingleSkillBuildCandidate[] {
  const draft = raw as unknown as Partial<SourceTeamDraft>;
  if (!Array.isArray(draft.members)) return [{ id: "draft:invalid", label: "来源队伍草稿", error: "草稿缺少成员列表。" }];
  const sourceError = !draft.source
    ? "草稿没有固定来源版本与 revision，无法确认来源执行器。"
    : draft.source.hostVariant !== inventory.hostVariant
      ? `草稿来源为 ${draft.source.hostVariant}，当前名册为 ${inventory.hostVariant}。`
      : draft.source.revision !== inventory.revision
        ? `草稿 revision ${draft.source.revision} 与当前名册 ${inventory.revision} 不一致。`
        : undefined;

  return draft.members.map((rawMember, index) => {
    const member = object(rawMember);
    const key = typeof member?.characterKey === "string" ? member.characterKey : `member-${index + 1}`;
    const label = `${typeof member?.characterKey === "string" ? member.characterKey : `第 ${index + 1} 位角色`} · 来源队伍草稿`;
    const id = `draft:${index}:${key}`;
    if (sourceError) return { id, label, error: sourceError };
    if (!member || typeof member.id !== "string" || typeof member.characterKey !== "string") {
      return { id, label, error: "草稿成员结构不完整。" };
    }
    try {
      const copied = structuredClone(rawMember) as SourceTeamMember;
      validateMember(copied, inventory);
      return { id, label, member: copied };
    } catch (error) {
      return { id, label, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function importedBuilds(raw: unknown): BuildImportBatch {
  importSessionPolicy.markImportedWorkspace();
  const record = object(raw);
  if (record?.format === "GOOD") return parseGoodBuilds(raw);
  if (record && object(record.playerInfo) && Array.isArray(record.avatarInfoList)) {
    const player = object(record.playerInfo);
    const uid = typeof player?.uid === "string" || typeof player?.uid === "number" ? String(player.uid) : "local-import";
    return parseEnkaBuilds(raw, { uid });
  }
  throw new Error("文件既不是受支持的 GOOD 导出、Enka 展示柜响应，也不是来源队伍草稿 JSON。");
}

function importedBuildCandidates(build: ImportedEditableBuild, index: number, inventory: SourceTeamInventory): SourceSingleSkillBuildCandidate[] {
  const prefix = `build:${index}:${build.sourceKey}`;
  const fail = (reason: string): SourceSingleSkillBuildCandidate[] => [{ id: prefix, label: build.name, error: reason }];
  if (!build.equipmentInput) {
    const reasons = build.diagnostics.map(item => item.message);
    return fail(reasons.length ? reasons.join("；") : "导入记录没有可转换的完整装备输入。 ");
  }
  const missing: string[] = [];
  if (build.constellation === null) missing.push("缺少命之座");
  if (build.baseTalentLevels.auto === null) missing.push("缺少普攻基础天赋等级");
  if (build.baseTalentLevels.skill === null) missing.push("缺少战技基础天赋等级");
  if (build.baseTalentLevels.burst === null) missing.push("缺少爆发基础天赋等级");
  if (missing.length) return fail(`${missing.join("、")}；不会补成 0 或默认值。`);

  const character = gameDataCatalog.characters.find(item => item.id === build.equipmentInput!.characterId);
  if (!character) return fail("导入角色无法匹配当前装备目录。 ");
  const forms = inventory.characters.filter(item => item.sourceGameId === character.avatarId);
  if (!forms.length) return fail(`${build.name} 在 ${inventory.hostVariant} 来源名册中没有对应角色形态。`);
  return forms.map(form => {
    const id = `${prefix}:${form.key}`;
    const label = forms.length > 1 ? `${build.name} · ${form.name} · ${form.key}` : build.name;
    try {
      const member = equipmentBuildToSourceTeamMember(build.equipmentInput!, {
        constellation: build.constellation!,
        talents: {
          auto: build.baseTalentLevels.auto!,
          skill: build.baseTalentLevels.skill!,
          burst: build.baseTalentLevels.burst!,
        },
        characterKey: form.key,
      }, inventory);
      validateMember(member, inventory);
      return { id, label, member };
    } catch (error) {
      return { id, label, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

/** Parses either existing source-team JSON or raw GOOD/Enka data into exact, validated single-member candidates. */
export function parseSourceSingleSkillBuilds(raw: unknown, inventory: SourceTeamInventory): SourceSingleSkillBuildCandidate[] {
  const record = object(raw);
  if (record?.schemaVersion === 1 && Array.isArray(record.members)) return fromDraft(record, inventory);
  const batch = importedBuilds(raw);
  if (!batch.builds.length && batch.diagnostics.length) {
    return [{ id: `import:${batch.format.toLowerCase()}:invalid`, label: `${batch.format} 导入数据`, error: batch.diagnostics.map(item => item.message).join("；") }];
  }
  return batch.builds.flatMap((build, index) => importedBuildCandidates(build, index, inventory));
}
