import type { SimConfig, CharacterStats, WeaponProcWeaponId } from "@genshin-dps-lab/schemas";
import { WEAPON_HIT_STACK_IDS, type WeaponHitStackId } from "./weapon-hit-stack-model";
import { gameDataCatalog } from "@genshin-dps-lab/game-data/catalog";
import { resolveArtifactBuild } from "@genshin-dps-lab/game-data/artifact-build";
import { artifactTwoPieceRules, equipmentHitBonusApplies, resolveWeaponEffects } from "@genshin-dps-lab/game-data/equipment-effects";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "@genshin-dps-lab/game-data/equipment-build";
import { artifactSetCatalog } from "@genshin-dps-lab/game-data/supplemental";
import { ARTIFACT_BUFF_SOURCE } from "@genshin-dps-lab/reaction-formulas";
import { getSourceActionContract } from "./source-action-library";
import { compileSourceRuntimeAbility } from "./source-runtime-abilities";

export interface EquipmentTeamHandoffMetadata {
  constellation: number;
  baseTalentLevels: { auto: number; skill: number; burst: number };
  favoniusParticleDelayFrames?: number;
  noblesseSelfDelayFrames?: 0 | 1;
}

export interface EquipmentTeamHandoff {
  config: SimConfig;
  enabled: string[];
  unmapped: string[];
}

const statProperty: Partial<Record<string, keyof CharacterStats>> = {
  FIGHT_PROP_ATTACK: "flatAtk", FIGHT_PROP_ATTACK_PERCENT: "atkPct",
  FIGHT_PROP_HP: "flatHp", FIGHT_PROP_HP_PERCENT: "hpPct",
  FIGHT_PROP_DEFENSE: "flatDef", FIGHT_PROP_DEFENSE_PERCENT: "defPct",
  FIGHT_PROP_ELEMENT_MASTERY: "em", FIGHT_PROP_CRITICAL: "critRate",
  FIGHT_PROP_CRITICAL_HURT: "critDmg",
};
const elementProperty: Record<string, string> = {
  FIGHT_PROP_PHYSICAL_ADD_HURT: "physical", FIGHT_PROP_FIRE_ADD_HURT: "pyro",
  FIGHT_PROP_WATER_ADD_HURT: "hydro", FIGHT_PROP_ICE_ADD_HURT: "cryo",
  FIGHT_PROP_ELEC_ADD_HURT: "electro", FIGHT_PROP_WIND_ADD_HURT: "anemo",
  FIGHT_PROP_ROCK_ADD_HURT: "geo", FIGHT_PROP_GRASS_ADD_HURT: "dendro",
};
const staticWeaponSlugs = new Set(["aquilafavonia", "wolfsgravestone", "skywardblade", "skywardharp", "skywardatlas", "skywardpride", "whitetassel", "thestringless", "rust", "amosbow", "theblacksword"]);
const favoniusSlugs = new Set(["favoniussword", "favoniusgreatsword", "favoniuslance", "favoniuswarbow", "favoniuscodex"]);
const sacrificialSlugs = new Set(["sacrificialsword", "sacrificialgreatsword", "sacrificialbow", "sacrificialfragments"]);
const simpleProcSlugs = new Set<WeaponProcWeaponId>(["halberd", "filletblade", "crescentpike"]);
const positionedProcSlugs = new Set<WeaponProcWeaponId>(["ashgravendrinkinghorn", "sequenceofsolitude", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer", "flute", "debateclub", "endoftheline", "theviridescenthunt"]);
const frostProcSlugs = new Set<WeaponProcWeaponId>(["snowtombedstarsilver", "dragonspinespear", "frostbearer"]);

function replaceHolder<T extends { actorId: string }>(actors: T[] | undefined, actorId: string): T[] {
  return (actors ?? []).filter(row => row.actorId !== actorId);
}

/** Apply only equipment to an explicitly selected existing actor. The local model owns
 * its own static panel and timed passives; conditioned calculator snapshots do not
 * become a fictitious permanent team buff. */
export function applyEquipmentBuildToTeam(config: SimConfig, actorId: string, input: EquipmentBuildInput, metadata?: EquipmentTeamHandoffMetadata): EquipmentTeamHandoff {
  const actor = config.characters.find(row => row.id === actorId);
  const character = gameDataCatalog.characters.find(row => row.id === input.characterId);
  const weapon = gameDataCatalog.weapons.find(row => row.id === input.weaponId);
  if (!actor || !character || !weapon) throw new Error("请选择队伍中已有的角色和来源目录中可用的角色、武器。");
  if (actor.element !== character.element) throw new Error("所选队伍角色元素与配装角色不一致；不会改写原有技能身份。");
  const bindings = (config.sourceAbilityBindings ?? []).filter(row => row.actorId === actorId);
  if (bindings.length) {
    if (!metadata) throw new Error("该角色已有来源能力绑定，须提供命座和基础天赋核对后才能应用装备。");
    for (const binding of bindings) {
      const compiled = compileSourceRuntimeAbility(binding);
      if (compiled.requirements.characterSlug !== character.slug || binding.ascension !== input.ascension || binding.constellation !== metadata.constellation)
        throw new Error("配装角色身份、突破或命座与队伍现有来源能力不一致；不会替换现有技能日程。");
      const talent = binding.sourceActionId.endsWith("-q") ? metadata.baseTalentLevels.burst : binding.sourceActionId.endsWith("-e") ? metadata.baseTalentLevels.skill : metadata.baseTalentLevels.auto;
      if (binding.talentLevel !== talent) throw new Error("配装基础天赋与队伍已绑定的来源能力天赋等级不一致；不会静默改写技能倍率。");
    }
  } else if (actor.id !== character.slug && actor.id !== character.id) {
    throw new Error("本地角色槽缺少与配装角色一致的身份标识或来源能力绑定；不会仅凭显示名称猜测身份。");
  }
  if (getSourceActionContract(config)) throw new Error("当前是整场固定来源动作场景，其面板属于来源契约；请在普通本地队伍使用装备自动应用。");
  const base = resolveEquipmentBuild({ ...input, weaponEffectsEnabled: false, setEffectsEnabled: false });
  const artifacts = resolveArtifactBuild(input.artifacts ?? []);
  const next = structuredClone(config);
  next.meta.verificationStatus = "user-supplied";
  const target = next.characters.find(row => row.id === actorId)!;
  const enabled: string[] = [], unmapped: string[] = [];
  const stats: CharacterStats = {
    baseAtk: base.build.characterBaseAtk + base.build.weaponBaseAtk,
    atkPct: base.build.atkPercent, flatAtk: base.build.flatAtk,
    baseHp: base.build.baseHp, hpPct: base.build.hpPercent, flatHp: base.build.flatHp,
    baseDef: base.build.baseDef, defPct: base.build.defPercent, flatDef: base.build.flatDef,
    em: base.build.em, critRate: base.build.critRate, critDmg: base.build.critDamage,
    dmgBonus: 0, energyRecharge: 1 + base.otherStats.energyRechargeBonus,
    defIgnore: 0, reactionBonus: 0,
  };
  const actorHits = [...next.rotation.filter(row => row.actorId === actorId).flatMap(row => row.hits ?? []),
    ...(next.timeline?.abilities.filter(row => row.actorId === actorId).flatMap(row => row.hits ?? []) ?? [])];
  const applyProperty = (property: string, value: number, label: string): void => {
    const key = statProperty[property];
    if (key) { stats[key] += value; enabled.push(label); return; }
    if (property === "FIGHT_PROP_CHARGE_EFFICIENCY") { stats.energyRecharge += value; enabled.push(label); return; }
    const element = elementProperty[property];
    if (element && actorHits.length && actorHits.every(hit => hit.element === element)) {
      stats.dmgBonus += value; enabled.push(label); return;
    }
    unmapped.push(`${label}：当前本地面板不能准确表达限定元素、治疗或非伤害属性，未计入。`);
  };
  for (const [element, value] of Object.entries(base.damageBonuses)) applyProperty(`FIGHT_PROP_${({ physical:"PHYSICAL", pyro:"FIRE", hydro:"WATER", cryo:"ICE", electro:"ELEC", anemo:"WIND", geo:"ROCK", dendro:"GRASS" } as Record<string,string>)[element]}_ADD_HURT`, value!, `装备${element}伤害加成`);
  enabled.push("角色与武器基础值、武器副属性、圣遗物主副词条已自动生成基础面板");
  if (staticWeaponSlugs.has(weapon.slug)) {
    const passive = resolveWeaponEffects({ weaponId: weapon.id, refinement: input.refinement, enabled: true });
    for (const term of passive.statContributions) applyProperty(term.property, term.value, `${weapon.name}常驻被动`);
    if (passive.hitBonuses.length) {
      const values = actorHits.map(hit => passive.hitBonuses.reduce((sum, bonus) => sum + (equipmentHitBonusApplies(bonus, {
        element: hit.element as Parameters<typeof equipmentHitBonusApplies>[1]["element"],
        ...(hit.attackTag === undefined ? {} : { attackTag: hit.attackTag as NonNullable<Parameters<typeof equipmentHitBonusApplies>[1]["attackTag"]> }),
        weaponType: weapon.weaponType,
      }) ? bonus.value : 0), 0));
      if (values.length && values[0] !== 0 && values.every(value => value === values[0])) {
        stats.dmgBonus += values[0]!;
        enabled.push(`${weapon.name}常驻伤害加成：当前已定义命中均适用同一数值`);
      } else unmapped.push(`${weapon.name}常驻命中加成：当前角色含不同适用标签或尚无命中定义，不能压成一个全局伤害加成。`);
    }
    unmapped.push(...passive.effectBlockers);
  }
  for (const [setId, count] of Object.entries(artifacts.setCounts)) {
    const set = artifactSetCatalog.find(row => row.id === setId);
    if (!set) continue;
    if (count >= 2) {
      const rule = artifactTwoPieceRules[set.slug];
      const source = set.pieceEffects.find(row => row.pieces === 2);
      if (rule && source?.description === rule.description && !rule.conditionKey && rule.property)
        applyProperty(rule.property, rule.value, `${set.name} 2 件套`);
      else if (source) unmapped.push(`${set.name} 2 件套：条件或命中类别尚不能由本地基础面板准确表示，未计入。`);
    }
  }
  target.level = input.level;
  target.stats = stats;
  const hasTimeline = next.timeline?.mode === "legal-frame-v1" && next.timeline.fps === 60;
  const oldFav = next.favoniusModel?.actors.find(row => row.actorId === actorId);
  const favOthers = replaceHolder(next.favoniusModel?.actors, actorId);
  const favDelay = metadata?.favoniusParticleDelayFrames ?? (oldFav?.weaponId === weapon.slug ? oldFav.particleDelayFrames : undefined);
  if (favoniusSlugs.has(weapon.slug) && hasTimeline && favDelay !== undefined) {
    if (!Number.isInteger(favDelay) || favDelay < 0) throw new Error("西风微粒到达延迟须明确填写非负整数帧。");
    next.favoniusModel = { mode: "fixed-source-independent-stream-v1", actors: [...favOthers, { actorId, weaponId: weapon.slug as NonNullable<SimConfig["favoniusModel"]>["actors"][number]["weaponId"], refinement: input.refinement, particleDelayFrames: favDelay }] };
    enabled.push(`${weapon.name}：实际暴击触发西风微粒（微粒到达延迟 ${favDelay} 帧）`);
  } else {
    if (favOthers.length) next.favoniusModel = { mode: "fixed-source-independent-stream-v1", actors: favOthers }; else delete next.favoniusModel;
    if (favoniusSlugs.has(weapon.slug)) unmapped.push(`${weapon.name}：需 60 FPS 合法时间线及明确的微粒到达延迟帧数才可执行西风触发。`);
  }
  const sacOthers = replaceHolder(next.sacrificialModel?.actors, actorId);
  if (sacrificialSlugs.has(weapon.slug) && hasTimeline) {
    next.sacrificialModel = { mode: "fixed-source-no-character-hitlag-v1", actors: [...sacOthers, { actorId, weaponId: weapon.slug as NonNullable<SimConfig["sacrificialModel"]>["actors"][number]["weaponId"], refinement: input.refinement }] };
    enabled.push(`${weapon.name}：实际战技命中触发祭礼冷却重置`);
  } else {
    if (sacOthers.length) next.sacrificialModel = { mode: "fixed-source-no-character-hitlag-v1", actors: sacOthers }; else delete next.sacrificialModel;
    if (sacrificialSlugs.has(weapon.slug)) unmapped.push(`${weapon.name}：需合法时间线才可执行祭礼触发。`);
  }
  const talesOthers = replaceHolder(next.thrillingTalesModel?.actors, actorId);
  if (weapon.slug === "thrillingtalesofdragonslayers" && hasTimeline) {
    next.thrillingTalesModel = { mode: "fixed-source-no-character-hitlag-v1", actors: [...talesOthers, { actorId, refinement: input.refinement }] };
    enabled.push(`${weapon.name}：实际切人触发下一角色增益`);
  } else {
    if (talesOthers.length) next.thrillingTalesModel = { mode: "fixed-source-no-character-hitlag-v1", actors: talesOthers }; else delete next.thrillingTalesModel;
    if (weapon.slug === "thrillingtalesofdragonslayers") unmapped.push(`${weapon.name}：需合法时间线才可执行切人增益。`);
  }
  const stackOthers = replaceHolder(next.weaponHitStackModel?.actors, actorId);
  const needsCompleteHitTags = weapon.id === "weapon:11406" || weapon.id === "weapon:12407";
  const hasCompleteHitTags = actorHits.every(hit => hit.attackTag !== undefined);
  if ((WEAPON_HIT_STACK_IDS as readonly string[]).includes(weapon.id) && hasTimeline && (!needsCompleteHitTags || hasCompleteHitTags)) {
    next.weaponHitStackModel = { mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true, actors: [...stackOthers, { actorId, weaponId: weapon.id as WeaponHitStackId, refinement: input.refinement }] };
    enabled.push(`${weapon.name}：真实命中与读取时的武器叠层`);
  } else {
    if (stackOthers.length) next.weaponHitStackModel = { mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true, actors: stackOthers }; else delete next.weaponHitStackModel;
    if ((WEAPON_HIT_STACK_IDS as readonly string[]).includes(weapon.id)) unmapped.push(`${weapon.name}：需 60 FPS 合法时间线、provisional 场景${needsCompleteHitTags ? "及持有者每次命中的明确攻击标签" : ""}才可执行武器叠层。`);
  }
  if (next.normalHitEnergyModel) {
    next.normalHitEnergyModel.actors = next.normalHitEnergyModel.actors.map(row => row.actorId === actorId ? { ...row, weaponType: weapon.weaponType } : row);
  }
  const previousEventPartyWeaponTypes = next.artifactEventModel?.partyWeaponTypes;
  const previousNoblesseDelay = next.artifactBuffModel?.actors.find(row => row.actorId === actorId && row.effectId === "noblesse-4pc")?.noblesseSelfDelayFrames;
  // Replacing one actor's equipment also retires its old modeled effects.
  for (const key of ["weaponProcModel", "artifactEventModel", "artifactBuffModel", "artifactDamageModel", "stellarArtifactModel", "moonlightArtifactModel"] as const) {
    const model = next[key];
    if (!model) continue;
    const actors = model.actors.filter(row => row.actorId !== actorId);
    if (actors.length) (next as unknown as Record<string, unknown>)[key] = { ...model, actors };
    else delete (next as unknown as Record<string, unknown>)[key];
  }
  const procSlug = weapon.slug as WeaponProcWeaponId;
  const hasTargetPositions = !!next.enemy.targets?.length && next.enemy.targets.every(row => row.position !== undefined);
  const canProc = hasTimeline && (simpleProcSlugs.has(procSlug) || (positionedProcSlugs.has(procSlug) && hasTargetPositions && (!frostProcSlugs.has(procSlug) || next.reactionEngine !== undefined)));
  if (canProc) {
    const entry = { actorId, weaponId: weapon.slug as WeaponProcWeaponId, refinement: input.refinement,
      physicalDamageBonus: (base.damageBonuses.physical ?? 0) + Object.entries(artifacts.setCounts).reduce((sum, [setId, count]) => {
        const set = artifactSetCatalog.find(row => row.id === setId);
        const rule = set && count >= 2 ? artifactTwoPieceRules[set.slug] : undefined;
        return sum + (rule?.property === "FIGHT_PROP_PHYSICAL_ADD_HURT" && rule.description === set?.pieceEffects.find(row => row.pieces === 2)?.description ? rule.value : 0);
      }, 0) };
    next.weaponProcModel = { mode: "fixed-source-no-character-hitlag-v1", actors: [...replaceHolder(next.weaponProcModel?.actors, actorId), entry] };
    enabled.push(`${weapon.name}：实际命中／拾取事件触发武器追击`);
  } else if (simpleProcSlugs.has(procSlug) || positionedProcSlugs.has(procSlug)) {
    unmapped.push(`${weapon.name}武器追击：需要合法时间线${positionedProcSlugs.has(procSlug) ? "、所有目标的显式坐标" : ""}${frostProcSlugs.has(procSlug) ? "及实际 Aura 引擎" : ""}，当前未自动启用。`);
  }
  for (const [setId, count] of Object.entries(artifacts.setCounts)) {
    if (count < 4) continue;
    const set = artifactSetCatalog.find(row => row.id === setId)!;
    const ordinaryAura = next.reactionEngine?.mode.startsWith("aura-v") && next.reactionEngine.debugAllowReactionOverride !== true;
    const scholarTypes = next.normalHitEnergyModel?.actors.length === next.characters.length ? next.normalHitEnergyModel.actors
      : previousEventPartyWeaponTypes?.length === next.characters.length ? previousEventPartyWeaponTypes.map(row => row.actorId === actorId ? { ...row, weaponType: weapon.weaponType } : row) : undefined;
    const eventEffect = ({ theexile: "exile-4pc", scholar: "scholar-4pc", gambler: "gambler-4pc" } as const)[set.slug as "theexile" | "scholar" | "gambler"];
    const eventReady = !!eventEffect && hasTimeline && (eventEffect === "scholar-4pc" ? !!scholarTypes
      : eventEffect === "gambler-4pc" ? !!next.targetHealthModel?.targets.length && !!next.timeline?.abilities.some(row => row.actorId === actorId && row.kind === "skill") : true);
    const buffEffect = ({ instructor: "instructor-4pc", gildeddreams: "gilded-4pc", flowerofparadiselost: "paradise-4pc",
      fragmentofharmonicwhimsy: "fragment-4pc", vermillionhereafter: "vermillion-4pc", noblesseoblige: "noblesse-4pc" } as const)[set.slug as "instructor" | "gildeddreams" | "flowerofparadiselost" | "fragmentofharmonicwhimsy" | "vermillionhereafter" | "noblesseoblige"];
    const noblesseDelay = metadata?.noblesseSelfDelayFrames ?? previousNoblesseDelay;
    const buffReady = !!buffEffect && hasTimeline && (
      (buffEffect === "instructor-4pc" || buffEffect === "gilded-4pc" || buffEffect === "paradise-4pc") ? ordinaryAura
        : buffEffect === "fragment-4pc" ? next.bondOfLifeModel !== undefined
          : buffEffect === "noblesse-4pc" ? noblesseDelay !== undefined : next.playerDamageModel.mode === "reaction-self-v1");
    if (eventReady && eventEffect) {
      const actors = [...replaceHolder(next.artifactEventModel?.actors, actorId), { actorId, effectId: eventEffect }];
      next.artifactEventModel = { ...next.artifactEventModel, mode: "fixed-source-no-character-hitlag-v1", actors,
        ...(eventEffect === "scholar-4pc" ? { partyWeaponTypes: scholarTypes! } : {}) };
      enabled.push(`${set.name} 4 件套：实际${eventEffect === "gambler-4pc" ? "击杀后的战技重置" : "事件触发的团队回能"}`);
    } else if (set.slug === "echoesofanoffering" && hasTimeline) {
      next.artifactDamageModel = { mode: "gcsim-b4ae769-artifact-damage-v1", actors: [...replaceHolder(next.artifactDamageModel?.actors, actorId), { actorId, effectId: "echoes-4pc" }] };
      enabled.push(`${set.name} 4 件套：实际普通命中触发额外伤害`);
    } else if (set.slug === "songofdayspast" && hasTimeline && next.playerDamageModel.mode === "reaction-self-v1") {
      next.artifactDamageModel = { mode: "gcsim-b4ae769-artifact-damage-v1", actors: [...replaceHolder(next.artifactDamageModel?.actors, actorId), { actorId, effectId: "song-of-days-past-4pc" }] };
      enabled.push(`${set.name} 4 件套：实际治疗账本触发额外伤害`);
    } else if (buffReady && buffEffect) {
      next.artifactBuffModel = { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [...replaceHolder(next.artifactBuffModel?.actors, actorId), { actorId, effectId: buffEffect,
        ...(buffEffect === "noblesse-4pc" && noblesseDelay !== undefined ? { noblesseSelfDelayFrames: noblesseDelay } : {}) }] };
      enabled.push(`${set.name} 4 件套：来源回调管理的实际增益窗口`);
    } else unmapped.push(`${set.name} 4 件套：${eventEffect === "scholar-4pc" ? "需全队已明确的武器类型" : eventEffect === "gambler-4pc" ? "需真实目标生命与持有者战技" : buffEffect === "noblesse-4pc" ? "需明确宗室自身增益取样分支 0／1 帧" : buffEffect === "fragment-4pc" ? "需角色生命之契账本" : buffEffect === "vermillion-4pc" ? "需玩家生命变化账本" : "当前队伍前提或运行时条款未自动证明"}，未应用。`);
  }
  const scrollSet = Object.entries(artifacts.setCounts).find(([setId, count]) => count >= 2 && artifactSetCatalog.find(row => row.id === setId)?.slug === "scrolloftheheroofcindercity");
  if (scrollSet) {
    if (hasTimeline && next.nightsoulBurstModel) {
      next.artifactEventModel = { ...next.artifactEventModel, mode: "fixed-source-no-character-hitlag-v1",
        actors: [...replaceHolder(next.artifactEventModel?.actors, actorId), { actorId, effectId: "scroll-2pc" }] };
      enabled.push("烬城勇者绘卷 2 件套：实际夜魂迸发事件回能");
    } else unmapped.push("烬城勇者绘卷 2 件套：需 60 FPS 合法时间线和已明确全员纳塔资格的夜魂迸发模型，未应用。");
  }
  if (weapon.effectName && !staticWeaponSlugs.has(weapon.slug) && !favoniusSlugs.has(weapon.slug) && !sacrificialSlugs.has(weapon.slug) && !simpleProcSlugs.has(procSlug) && !positionedProcSlugs.has(procSlug) && weapon.slug !== "thrillingtalesofdragonslayers" && !(WEAPON_HIT_STACK_IDS as readonly string[]).includes(weapon.id))
    unmapped.push(`${weapon.name}武器被动：当前本地队伍未自动建立完整条件与时序，未应用。`);
  unmapped.push("角色天赋、命座、角色被动与未列出的装备条件保持队伍原有来源能力；本次仅应用装备及面板。");
  return { config: next, enabled, unmapped };
}
