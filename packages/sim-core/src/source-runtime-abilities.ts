import type { AbilityDefinition, FrameHitDefinition } from "@genshin-dps-lab/schemas";
import type { SourceNormalStateScope } from "../../schemas/src/source-normal-family";
import {
  COMPOSABLE_SOURCE_ABILITY_VERSION,
  getComposableSourceAbility,
  getComposableSourceCoefficient,
  type ComposableSourceActionId,
} from "../../game-data/src/source-ability-registry";

export interface SourceRuntimeAbilityInput {
  actorId: string;
  sourceActionId: ComposableSourceActionId;
  /** Effective talent level: constellation talent increases are not added again. */
  talentLevel: number;
  ascension: number;
  constellation: number;
  abilityId?: string;
  stateScope?: SourceNormalStateScope;
}

export interface SourceRuntimeAbilityBinding {
  abilityId: string;
  actorId: string;
  sourceActionId: ComposableSourceActionId;
  talentLevel: number;
  ascension: number;
  constellation: 0;
  registryVersion: typeof COMPOSABLE_SOURCE_ABILITY_VERSION;
  stateScope?: SourceNormalStateScope;
}

export interface SourceRuntimeAbilityRequirements {
  characterSlug: string;
  element: "pyro" | "cryo" | "electro" | "geo" | "hydro" | "anemo" | "dendro";
  weaponType: "bow" | "claymore" | "sword" | "polearm";
  energyMax: 40 | 60 | 70 | 80;
  constellation: 0;
  targetScope: "single-stationary-in-range";
  hitlag: "disabled";
  capabilities: string[];
  limitations: string[];
}

export interface CompiledSourceRuntimeAbility {
  ability: AbilityDefinition;
  binding: SourceRuntimeAbilityBinding;
  requirements: SourceRuntimeAbilityRequirements;
  sourceRefs: string[];
  /** Last possible own damage relative to an accepted action, not animation end. */
  tailFrame: number;
}

/** Compile just the source-owned ability. Character stats, energy, equipment,
 * other party members and ordered commands remain owned by the caller. */
export function compileSourceRuntimeAbility(input: SourceRuntimeAbilityInput): CompiledSourceRuntimeAbility {
  const source = getComposableSourceAbility(input.sourceActionId);
  if (!source) throw new Error(`没有已登记的来源动作：${input.sourceActionId}`);
  if (!input.actorId.trim()) throw new Error("必须明确指定队伍角色。");
  if (!Number.isInteger(input.talentLevel) || input.talentLevel < 1 || input.talentLevel > 15) throw new Error("有效天赋等级须为 1–15 的整数。");
  if (!Number.isInteger(input.ascension) || input.ascension < 0 || input.ascension > 6) throw new Error("突破须为 0–6 的整数。");
  if (input.constellation !== 0) throw new Error("本来源能力目前仅支持 C0；其他命座所需的运行状态尚未接入。");
  if (source.availability !== "executable") throw new Error("该来源能力的实际运行依赖尚未接入。");
  if (input.stateScope !== source.stateScope) throw new Error(source.stateScope === "fischl-no-oz-v1"
    ? "菲谢尔普攻须明确声明整场无奥兹及其遗留A4/魔女会增益；未声明不等于不存在。"
    : source.stateScope === "yelan-no-burst-v1" ? "夜兰普攻须明确声明整场无玄掷玲珑及其遗留A4增伤；未声明不等于不存在。"
      : "此来源能力不接受其他角色的状态缺席声明。");
  const abilityId = input.abilityId ?? `source-${input.actorId}-${source.id}`;
  if (!abilityId.trim()) throw new Error("来源能力 ID 不能为空。");

  const hits: FrameHitDefinition[] = source.hits.map(row => ({
    id: `${abilityId}-${row.role}`,
    label: row.label,
    frame: row.frame,
    scaling: getComposableSourceCoefficient(row.coefficientId, input.talentLevel),
    scalingStat: "atk",
    element: source.kind === "normal" ? "physical" : source.element,
    attackTag: source.kind,
    // Slash and pierce have no distinct Frozen/Shatter behavior in this host.
    strikeType: source.sourceStrikeType === "blunt" ? "blunt" : "default",
    ...(source.poiseDamage === undefined ? {} : { poiseDamage: source.poiseDamage }),
    snapshot: row.snapshot,
    ...(row.snapshotFrame === undefined ? {} : { snapshotFrame: row.snapshotFrame }),
    critEligible: true,
    ...(source.kind === "normal" ? { normalHitEnergyTag: "normal" as const } : {
      application: { gaugeUnits: source.gaugeUnits,
        icd: source.applicationIcdTag === "none"
          ? { mode: "no-icd-v1" as const }
          : { mode: "fixed-gcsim-application-v1" as const, icdTag: source.applicationIcdTag, groupId: source.icdGroup } },
    }),
    directDamageGroup: { icdTag: source.applicationIcdTag, icdGroup: source.icdGroup },
    ...(source.id === "amber-q" && input.ascension >= 1 ? { critRate: 0.1 } : {}),
    ...(source.id === "zhongli-q" && input.ascension >= 4 ? {
      flatSources: [{ ownerId: input.actorId, stat: "hp" as const, multiplier: 0.33, snapshotFrame: 0 }],
    } : {}),
  }));

  const ability: AbilityDefinition = {
    id: abilityId,
    actorId: input.actorId,
    name: source.label,
    kind: source.kind,
    actionPhase: "after-frame-tasks-v1",
    cancelFrame: source.animationEndFrame,
    cancelFrames: { ...source.cancelFrames },
    animationEndFrame: source.animationEndFrame,
    // Q's legal timeline cooldown is an accepted-input-to-ready offset.
    // Its source SetCDWithDelay delay therefore belongs in this total. Do not
    // reuse the E-only cooldownStartFrame worker and debit the delay twice.
    cooldownFrames: source.cooldownFrames + source.cooldownStartFrame,
    ...(source.energyCost === 0 ? {} : { energyCost: source.energyCost, energyCostFrame: source.energyCostFrame }),
    hits,
    ...(source.id === "keqing-q" && input.ascension >= 4 ? {
      buffs: [
        { key: `source:${input.actorId}:keqing-a4:crit`, label: "玉衡之贵·暴击率", target: input.actorId, stat: "critRate" as const, value: 0.15, startFrame: 0, durationFrames: 480 },
        { key: `source:${input.actorId}:keqing-a4:er`, label: "玉衡之贵·元素充能效率", target: input.actorId, stat: "energyRecharge" as const, value: 0.15, startFrame: 0, durationFrames: 480 },
      ],
    } : {}),
  };
  return {
    ability,
    binding: { abilityId, actorId: input.actorId, sourceActionId: source.id, talentLevel: input.talentLevel,
      ascension: input.ascension, constellation: 0, registryVersion: COMPOSABLE_SOURCE_ABILITY_VERSION,
      ...(input.stateScope === undefined ? {} : { stateScope: input.stateScope }) },
    requirements: { characterSlug: source.characterSlug, element: source.element, weaponType: source.weaponType,
      energyMax: source.energyMax, constellation: 0, targetScope: "single-stationary-in-range", hitlag: "disabled",
      capabilities: ["legal-frame-v1", "fixed-source-elemental-application-v1", "fixed-source-direct-damage-group-v1",
        ...(source.hits.some(hit => hit.snapshotFrame !== undefined) ? ["frame-snapshot-v1"] : []),
        ...(source.normalChain ? ["source-normal-chain-v1", "fixed-source-normal-hit-energy-v1"] : []),
        ...(source.id === "zhongli-q" && input.ascension >= 4 ? ["independent-flat-snapshot-v1"] : [])],
      limitations: [...source.limitations] },
    sourceRefs: [...source.sourceRefs],
    tailFrame: Math.max(...source.hits.map(hit => hit.frame)),
  };
}
