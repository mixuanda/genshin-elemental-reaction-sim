import type { CalculatorDocument } from "./calculator-model";
import type { ArtifactConditionalContext } from "../../game-data/src/artifact-conditional-effects";
import { resolveEquipmentBuild, type EquipmentBuildInput, type EquipmentDataset } from "../../game-data/src/equipment-build";
import { resolveWeaponCatalystEffects } from "../../game-data/src/weapon-catalyst-effects";
import { deriveNicoleSkillInitialWeaponContext, isNicoleSkillInitialAction, isNicoleSkillInitialHit,
  nicoleSkillInitialContext, resetNicoleSkillInitialPanelAccounting } from "./nicole-skill-initial-formulas";

export const NICOLE_SKILL_INITIAL_WEAPON_REFRESH_DEPENDENCY = "nicole-skill-initial:weapon-refresh";
export type NicoleSkillInitialWeaponRefreshResult = {
  document: CalculatorDocument;
  status: "not-applicable" | "unchanged" | "refreshed" | "blocked";
  /** The caller must turn this into a missing dependency, never use the old zero/old sample. */
  blocked: boolean;
  refreshed: boolean;
  reason?: string;
};

// Evidence equality ignores object key ordering, but does not discard fields,
// source references, filters, expressions, inputs, or array order.
function sameEvidence(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => sameEvidence(value, b[index]));
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left)
    .every(key => Object.prototype.hasOwnProperty.call(right, key) && sameEvidence(left[key], right[key]));
}
const signatureRule = (row: { id: string }) => row.id.startsWith("weapon:14523:");

/** Refresh only the existing R1 Angelos Heptades generated hit clause for this
 * E's first shield sample. No equipment build or editable panel is rebuilt.
 * Old clauses must match the existing resolver under the OLD context first.
 * A blocked result intentionally preserves the original evidence verbatim. */
export function refreshNicoleSkillInitialWeaponEffects(document: CalculatorDocument,
  dataset?: EquipmentDataset): NicoleSkillInitialWeaponRefreshResult {
  const result = (status: NicoleSkillInitialWeaponRefreshResult["status"], reason?: string,
    output = document): NicoleSkillInitialWeaponRefreshResult => ({ document: output, status,
    blocked: status === "blocked", refreshed: status === "refreshed", ...(reason === undefined ? {} : { reason }) });
  const build = document.build;
  const metadata = build.mode === "equipment-derived" ? build.equipment : undefined;
  if (!isNicoleSkillInitialAction(document) || !metadata || metadata.weaponId !== "weapon:14523"
    || metadata.refinement !== 1 || metadata.weaponEffectsEnabled !== true) return result("not-applicable");

  const context = nicoleSkillInitialContext(document);
  const hits = document.hits.filter(hit => isNicoleSkillInitialHit(document, hit));
  if (document.scope !== "single-hit" || hits.length !== 1 || hits[0]!.kind !== "ordinary")
    return result("blocked", "尘光首次刷新只支持本次妮可E初击，不能借给其他命中或完整日程。");
  // The historical final snapshot already owns its damage bonus. Its existing
  // character identity validation remains mandatory; never stamp a fresh sample.
  if (hits[0]!.finalSnapshot) return result("not-applicable", "已保存的历史命中快照不自动刷新尘光取样或重新验证。");
  if (context?.finalizedHitState !== undefined)
    return result("blocked", "仍有历史取样身份，不能在缺少原命中快照时重建尘光取样。");
  if (metadata.bonusAccounting !== "core-sourced-v1" || metadata.characterId !== "character:10000131"
    || metadata.weaponType !== "catalyst") return result("blocked", "尘光自动刷新需要当前妮可法器配装的明确来源记账。");

  try {
    // The document schema spells optional values as T | undefined; the resolver
    // interface uses exact optional properties. Undefined still means unknown in
    // that resolver. Keep every saved key/value intact at this type boundary.
    const oldContext = (metadata.effectContext ?? {}) as ArtifactConditionalContext;
    const bound = deriveNicoleSkillInitialWeaponContext(document, oldContext);
    if (!bound.derived) return result("blocked", bound.reason ?? "尚未证明本次尘光首次取样。");
    const resolve = (effectContext: typeof bound.effectContext) => resolveWeaponCatalystEffects({
      weaponId: metadata.weaponId, refinement: metadata.refinement, characterId: metadata.characterId,
      enabled: true, context: effectContext, ...(dataset ? { dataset } : {}) });
    const before = resolve(oldContext), after = resolve(bound.effectContext);
    if (before.missingConditions.length || after.missingConditions.length)
      return result("blocked", [...before.missingConditions, ...after.missingConditions].join("；"));
    const statRules = (metadata.statModifiers ?? []).filter(signatureRule);
    const hitRules = (metadata.dynamicHitBonuses ?? []).filter(signatureRule);
    if (!sameEvidence(statRules, before.statModifiers) || !sameEvidence(hitRules, before.dynamicHitBonuses))
      return result("blocked", "尘光已有生成条款与其保存状态或固定来源不一致；不能覆盖原证据或继续使用旧增伤。");

    const otherGroups = [metadata.hitBonuses, metadata.additiveBaseBonuses, metadata.criticalBonuses,
      metadata.pendingHitEffects, metadata.reactionBonuses, metadata.pendingReactionEffects,
      metadata.resistanceReductions, metadata.pendingResistanceEffects];
    if (otherGroups.some(rows => rows?.some(signatureRule)))
      return result("blocked", "尘光条款出现在未审阅的公式槽中，不能自动删除或重复叠加。");
    // The current weapon resolver changes only its single damage clause. Keep
    // the constant 12% ATK and every global provenance/limitation record intact.
    if (!sameEvidence(before.statModifiers, after.statModifiers) || !sameEvidence(before.reactionBonuses, after.reactionBonuses)
      || !sameEvidence(before.sourceRefs, after.sourceRefs) || !sameEvidence(before.assumptions, after.assumptions)
      || !sameEvidence(before.effectBlockers, after.effectBlockers) || after.dynamicHitBonuses.length !== 1)
      return result("blocked", "固定武器解析的影响范围已改变，尚不能证明仅刷新一条尘光增伤。");

    // offField is shared with some artifact snapshots. When an explicit old
    // background state coexists with other generated effects, leave it intact
    // for normal equipment materialization instead of silently making them stale.
    const foreignEffects = [(metadata.statModifiers ?? []).filter(row => !signatureRule(row)),
      (metadata.dynamicHitBonuses ?? []).filter(row => !signatureRule(row)), ...otherGroups];
    if (metadata.effectContext?.offField === true && foreignEffects.some(rows => rows && rows.length > 0))
      return result("blocked", "装备仍记录后台状态及其他来源条款；请先按当前前台条件解析装备，不能只刷新尘光而保留可能过时的其他快照。");

    if (sameEvidence(metadata.effectContext, bound.effectContext) && sameEvidence(hitRules, after.dynamicHitBonuses))
      return result("unchanged");
    let replaced = false;
    const dynamicHitBonuses = (metadata.dynamicHitBonuses ?? []).map(row => {
      if (!signatureRule(row)) return row;
      replaced = true; return after.dynamicHitBonuses[0]!;
    });
    // The complete old R1 state necessarily has one hit clause, including an
    // explicitly inactive zero; the equality guard above rejects missing ones.
    if (!replaced) return result("blocked", "缺少可核对并替换的尘光生成条款。");
    if (build.mode !== "equipment-derived") return result("blocked", "尘光刷新需要装备推导面板。");
    return result("refreshed", undefined, { ...document, build: { ...build, equipment: { ...metadata,
      effectContext: bound.effectContext, dynamicHitBonuses } } });
  } catch (error) {
    return result("blocked", error instanceof Error ? error.message : "尘光来源或取样校验失败。");
  }
}

export type NicoleSkillInitialEquipmentInputResult = {
  input: EquipmentBuildInput;
  status: "not-applicable" | "prepared" | "blocked";
  blocked: boolean;
  reason?: string;
};

/** Called before NORMAL materialization of a newly selected equipment input.
 * Its probe uses that exact input with the signature window disabled, not the
 * old document's panel delta or observed attack sample. The caller must reject
 * blocked, then resolve returned input normally and reset fresh-equipment
 * character accounting. This does not refresh/revalidate an old document. */
export function prepareNicoleSkillInitialEquipmentInput(document: CalculatorDocument, input: EquipmentBuildInput,
  dataset?: EquipmentDataset): NicoleSkillInitialEquipmentInputResult {
  const result = (status: NicoleSkillInitialEquipmentInputResult["status"], reason?: string,
    output = input): NicoleSkillInitialEquipmentInputResult => ({ input: output, status, blocked: status === "blocked",
    ...(reason === undefined ? {} : { reason }) });
  if (!isNicoleSkillInitialAction(document) || input.characterId !== "character:10000131"
    || input.weaponId !== "weapon:14523" || input.refinement !== 1 || input.weaponEffectsEnabled !== true)
    return result("not-applicable");
  const context = nicoleSkillInitialContext(document);
  if (document.scope !== "single-hit" || document.hits.filter(hit => isNicoleSkillInitialHit(document, hit)).length !== 1)
    return result("blocked", "尘光自动配装只支持本次妮可E初击，不借给其他命中或完整日程。");
  if (context?.noOtherEventsBeforeInitial !== true || context.noDisplacementBeforeInitial !== true)
    return result("blocked", "请先确认本次E至初击之间没有其他事件、没有额外位移，才能从新配装自动取得尘光首次攻击样本。");
  try {
    // This is the ordinary construction of a NEW equipment panel. The proved
    // E8/E9 path is on field; resolving all selected sets under it avoids stale
    // artifact snapshots when the input previously said offField=true.
    const preparation = resolveEquipmentBuild({ ...input, effectContext: { ...input.effectContext,
      weaponEffectActive: false, offField: false } }, dataset);
    const probe = structuredClone(document);
    probe.build = preparation.build;
    probe.characterLevel = preparation.characterLevel;
    if (probe.gameContext) probe.gameContext.ascension = input.ascension;
    resetNicoleSkillInitialPanelAccounting(probe, "fresh-equipment");
    for (const hit of probe.hits) if (hit.kind === "ordinary" && isNicoleSkillInitialHit(probe, hit)) delete hit.finalSnapshot;
    const bound = deriveNicoleSkillInitialWeaponContext(probe, input.effectContext ?? {});
    if (!bound.derived) return result("blocked", bound.reason ?? "新装备尚不能证明8帧非转换攻击样本。");
    return result("prepared", undefined, { ...input, effectContext: bound.effectContext });
  } catch (error) {
    return result("blocked", error instanceof Error ? error.message : "新装备来源或词条校验失败。");
  }
}
