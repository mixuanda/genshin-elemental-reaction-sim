import {
  enkaShowcaseResponseSchema,
  type EnkaShowcaseResponse,
  type GraduationBuildPlaceholder,
  type ImportedArtifact,
  type ImportedArtifactStat,
  type ImportedShowcase,
  type ImportedShowcaseCharacter,
  type ImportedWeapon
} from "@genshin-dps-lab/schemas";

const DAMAGE_BONUS_FIGHT_PROPS: Record<string, string> = {
  "30": "physical",
  "40": "pyro",
  "41": "electro",
  "42": "hydro",
  "43": "dendro",
  "44": "anemo",
  "45": "geo",
  "46": "cryo"
};

type EnkaAvatar = NonNullable<
  EnkaShowcaseResponse["avatarInfoList"]
>[number];

function numericValue(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fightProp(
  avatar: EnkaAvatar,
  key: string
): number {
  return avatar.fightPropMap[key] ?? 0;
}

function characterLevel(
  response: EnkaShowcaseResponse,
  avatar: EnkaAvatar
): number {
  const fromProp = numericValue(avatar.propMap?.["4001"]?.ival);
  if (fromProp && fromProp >= 1) return Math.trunc(fromProp);
  return (
    response.playerInfo.showAvatarInfoList?.find(
      (entry) => entry.avatarId === avatar.avatarId
    )?.level ?? 1
  );
}

function normalizeStats(
  stats:
    | Array<{
        appendPropId: string;
        statValue: number;
      }>
    | undefined
): ImportedArtifactStat[] {
  return (stats ?? []).map((stat) => ({
    id: stat.appendPropId,
    value: stat.statValue
  }));
}

function normalizeWeapon(
  avatar: EnkaAvatar
): ImportedWeapon | null {
  const item = avatar.equipList?.find(
    (candidate) => candidate.flat.itemType === "ITEM_WEAPON"
  );
  if (!item?.weapon) return null;
  const affixValues = Object.values(item.weapon.affixMap ?? {}) as number[];
  return {
    itemId: item.itemId,
    level: item.weapon.level,
    ascension: item.weapon.promoteLevel ?? null,
    refinement: (affixValues[0] ?? 0) + 1,
    rarity: item.flat.rankLevel ?? null,
    stats: normalizeStats(item.flat.weaponStats)
  };
}

function normalizeArtifacts(
  avatar: EnkaAvatar
): ImportedArtifact[] {
  return (avatar.equipList ?? [])
    .filter(
      (item) =>
        item.flat.itemType === "ITEM_RELIQUARY" && item.reliquary !== undefined
    )
    .map((item) => ({
      itemId: item.itemId,
      slot: item.flat.equipType ?? "UNKNOWN",
      setId: item.flat.setId ?? null,
      rarity: item.flat.rankLevel ?? null,
      // Enka exposes artifact level as 1..21, while the game displays +0..+20.
      level: Math.max(0, (item.reliquary?.level ?? 1) - 1),
      mainStat: item.flat.reliquaryMainstat
        ? {
            id: item.flat.reliquaryMainstat.mainPropId,
            value: item.flat.reliquaryMainstat.statValue
          }
        : null,
      substats: normalizeStats(item.flat.reliquarySubstats)
    }));
}

function normalizeCharacter(
  response: EnkaShowcaseResponse,
  avatar: EnkaAvatar
): ImportedShowcaseCharacter {
  const damageBonuses = Object.fromEntries(
    Object.entries(DAMAGE_BONUS_FIGHT_PROPS).map(([key, element]) => [
      element,
      fightProp(avatar, key)
    ])
  );
  return {
    avatarId: avatar.avatarId,
    level: characterLevel(response, avatar),
    constellation: avatar.talentIdList?.length ?? 0,
    skillLevels: { ...(avatar.skillLevelMap ?? {}) },
    skillLevelBonuses: { ...(avatar.proudSkillExtraLevelMap ?? {}) },
    stats: {
      maxHp: fightProp(avatar, "2000"),
      attack: fightProp(avatar, "2001"),
      defense: fightProp(avatar, "2002"),
      elementalMastery: fightProp(avatar, "28"),
      critRate: fightProp(avatar, "20"),
      critDamage: fightProp(avatar, "22"),
      energyRecharge: fightProp(avatar, "23"),
      damageBonuses
    },
    weapon: normalizeWeapon(avatar),
    artifacts: normalizeArtifacts(avatar)
  };
}

export function parseEnkaShowcase(
  input: unknown,
  options: {
    uid: string;
    fetchedAt?: string;
  }
): ImportedShowcase {
  const response = enkaShowcaseResponseSchema.parse(input);
  const characters = (response.avatarInfoList ?? []).map((avatar) =>
    normalizeCharacter(response, avatar)
  );
  return {
    source: "enka",
    uid: options.uid,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    cacheTtlSeconds: response.ttl ?? 60,
    playerLevel: response.playerInfo.level ?? null,
    worldLevel: response.playerInfo.worldLevel ?? null,
    visibility: characters.length ? "public" : "closed-or-empty",
    characters
  };
}

export function createGraduationBuildPlaceholder(
  character: ImportedShowcaseCharacter
): GraduationBuildPlaceholder {
  return {
    status: "graduation-target-placeholder",
    avatarId: character.avatarId,
    sourceLevel: character.level,
    retainedWeapon: character.weapon,
    retainedSkillLevels: { ...character.skillLevels },
    artifactTarget: null,
    note:
      "“毕业”没有统一数值定义；在角色、武器、套装与词条目标经数据版本核验前，本对象不进入伤害模拟。"
  };
}
