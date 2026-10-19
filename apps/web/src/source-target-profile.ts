import { resolveSourceTargetGeometry, sourceDecimal, sourceTargetGeometryClause, type SourceTargetGeometry } from "./source-target-geometry";
import { sourceHostTargetPhasePolicy, sourceHostTargetPhaseRequestSchema } from "../../../packages/sim-core/src/source-host-target-phase";
import type { SourceTargetPhaseDraft } from "./source-target-phase-controls";

export const sourceTargetResistanceElements = ["electro", "pyro", "cryo", "hydro", "anemo", "dendro", "geo", "physical"] as const;
export type SourceTargetElement = typeof sourceTargetResistanceElements[number];
export const sourceParticleElements = ["electro", "pyro", "cryo", "hydro", "anemo", "dendro", "geo", "none"] as const;
export type SourceParticleElement = typeof sourceParticleElements[number];

export interface SourceTargetProfile {
  level: number;
  resistance: number;
  geometry?: SourceTargetGeometry;
  /** Final absolute resistance, not a delta added to the base resistance. */
  resistanceByElement?: Partial<Record<SourceTargetElement, number>>;
  /** Optional enemy DEF scenario adjustment; omitted preserves the source default (zero). */
  defenseAdjustment?: number;
  /** User-declared half-open target phases; request metadata is flattened by the caller. */
  phases?: SourceTargetPhaseDraft[];
  freezeResistance?: number;
  hp?: number;
  /** Source checks damage thresholds, then dispatches custom particles after 100 frames. */
  particleDrops?: { threshold: number; count: number; element: SourceParticleElement };
}

/** Native target grammar adds resist and element tokens; validate before emitting either form. */
export function validateSourceTargetProfile(target: SourceTargetProfile): void {
  if (!Number.isInteger(target.level) || target.level < 1 || target.level > 200)
    throw new Error("目标等级须为 1–200 的整数。");
  if (!Number.isFinite(target.resistance))
    throw new Error("基础目标抗性须为有限数值。");
  resolveSourceTargetGeometry(target.geometry);
  if (target.resistanceByElement !== undefined) {
    if (target.resistanceByElement === null || typeof target.resistanceByElement !== "object")
      throw new Error("逐元素抗性须为元素到绝对数值的映射。");
    for (const [element, value] of Object.entries(target.resistanceByElement)) {
      if (!sourceTargetResistanceElements.includes(element as SourceTargetElement) || !Number.isFinite(value))
        throw new Error(`目标元素抗性 ${element} 须为受支持元素的有限绝对值。`);
    }
  }
  if (target.freezeResistance !== undefined && (!Number.isFinite(target.freezeResistance)
    || target.freezeResistance < 0 || target.freezeResistance > 1))
    throw new Error("冻结抗性须为 0–1 的有限比例。");
  if (target.defenseAdjustment !== undefined && (!Number.isFinite(target.defenseAdjustment)
    || target.defenseAdjustment < -1 || target.defenseAdjustment > 0.9))
    throw new Error("目标防御调整须为 -1 至 0.9 的有限比例。");
  if (target.phases !== undefined) sourceHostTargetPhaseRequestSchema.parse({
    policy: sourceHostTargetPhasePolicy,
    phases: target.phases.map(phase => ({ ...phase, targetIndex: 0 })),
  });
  if (target.hp !== undefined && (!Number.isFinite(target.hp) || target.hp <= 0))
    throw new Error("显式目标生命须为正有限数值。");
  if (target.particleDrops !== undefined) {
    const drops = target.particleDrops;
    if (target.hp === undefined) throw new Error("显式目标掉球须同时提供生命，以明确来源击杀模式。");
    if (!drops || !Number.isFinite(drops.threshold) || drops.threshold <= 0
      || !Number.isFinite(drops.count) || drops.count < 0
      || !sourceParticleElements.includes(drops.element))
      throw new Error("目标掉球须提供正阈值、非负数量及受支持的元素。");
  }
}

export function sourceTargetResistanceValues(target: SourceTargetProfile): Record<SourceTargetElement, number> {
  validateSourceTargetProfile(target);
  return Object.fromEntries(sourceTargetResistanceElements.map(element =>
    [element, target.resistanceByElement?.[element] ?? target.resistance])) as Record<SourceTargetElement, number>;
}

/** Full one-target GCSL clause, preserving the legacy base-resistance path. */
export function sourceTargetProfileClause(target: SourceTargetProfile): string {
  validateSourceTargetProfile(target);
  const resistance = target.resistanceByElement === undefined
    ? [`resist=${sourceDecimal(target.resistance)}`]
    : sourceTargetResistanceElements.map(element =>
      `${element}=${sourceDecimal(target.resistanceByElement?.[element] ?? target.resistance)}`);
  const parts = [`target lvl=${target.level}`, ...resistance, sourceTargetGeometryClause(target.geometry)];
  if (target.defenseAdjustment !== undefined) parts.push(`def_adjustment=${sourceDecimal(target.defenseAdjustment)}`);
  if (target.freezeResistance !== undefined) parts.push(`freeze_resist=${sourceDecimal(target.freezeResistance)}`);
  if (target.hp !== undefined) parts.push(`hp=${sourceDecimal(target.hp)}`);
  if (target.particleDrops !== undefined) parts.push(
    `particle_threshold=${sourceDecimal(target.particleDrops.threshold)}`,
    `particle_drop_count=${sourceDecimal(target.particleDrops.count)}`,
    `particle_element=${target.particleDrops.element}`,
  );
  return `${parts.join(" ")};`;
}
