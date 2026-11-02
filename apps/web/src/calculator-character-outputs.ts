import type { GameDataCatalog } from "@genshin-dps-lab/schemas";
import type { CalculatorAggregation, CalculatorDocument, CalculatorResult } from "../../../packages/sim-core/src/calculator-model";
import { calculatorActionDisplayName } from "./calculator-action-display";
import "./calculator-character-outputs.css";

export interface CharacterOutputObservation {
  actionKey: string;
  inputVersion: string;
  result: CalculatorResult;
}
export interface CharacterOutputItem {
  candidateIndex: number;
  actionKey: string;
  title: string;
  variantLabel?: string;
  conditions: string[];
  selected: boolean;
  scope: CalculatorAggregation["scope"];
  scopeLabel: string;
  status: "pending" | "calculated" | "blocked" | "unavailable" | "non-damaging";
  damage?: NonNullable<CalculatorResult["totals"]>;
  knownSubtotal?: NonNullable<CalculatorAggregation["knownSubtotal"]>;
  nonCriticalComparisonOnly?: true;
  components: { id: string; label: string; expected?: number; status: string }[];
  reasons: string[];
}
export interface CharacterOutputGroup {
  id: "normal" | "charged" | "plunge" | "normal-other" | "skill" | "burst" | "other";
  label: string;
  items: CharacterOutputItem[];
  unavailableReason?: string;
}
export interface CharacterOutputOptions {
  selectedCandidateIndex?: number;
  /** The caller's actual result for exactly this current document. */
  currentDocument?: CalculatorDocument;
  currentResult?: CalculatorResult;
  /** Exact current inputs after the caller's existing action/context preparation.
   * An absent entry uses the original candidate, never another action's state. */
  effectiveDocuments?: ReadonlyMap<number, CalculatorDocument>;
  observations?: readonly CharacterOutputObservation[];
}

export function characterOutputActionKey(document: CalculatorDocument): string {
  const game = document.gameContext;
  return JSON.stringify([document.dataIdentity.datasetId, game?.characterId, game?.abilityId, game?.skillId, game?.variantId, game ? undefined : document.id]);
}
function stableInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableInput);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableInput(entry)]));
  return value;
}
/** Full input identity includes hits, selection, snapshots, state, build, enemy,
 * source identity and rules. There is no lossy hash or cross-state cache key. */
export function characterOutputInputVersion(document: CalculatorDocument): string {
  return JSON.stringify(stableInput(document));
}
export function captureCharacterOutputResult(document: CalculatorDocument, result: CalculatorResult): CharacterOutputObservation {
  return { actionKey: characterOutputActionKey(document), inputVersion: characterOutputInputVersion(document), result: structuredClone(result) };
}

const scopes: Record<CalculatorAggregation["scope"], string> = {
  "single-hit": "单段命中", "complete-cast": "一次施放（所述条件）",
  "selected-components": "部分已定义范围", "declared-hit-set": "已声明命中集合",
};
const groupLabels: Record<CharacterOutputGroup["id"], string> = {
  normal: "普攻各段", charged: "重击", plunge: "下落攻击", "normal-other": "其他普通攻击动作",
  skill: "E · 元素战技", burst: "Q · 元素爆发", other: "其他已定义动作",
};
function groupFor(document: CalculatorDocument, abilities: Map<string, GameDataCatalog["talentSets"][number]["abilities"][number]>): CharacterOutputGroup["id"] {
  const kind = abilities.get(document.gameContext?.abilityId ?? "")?.kind;
  if (kind === "skill" || kind === "burst") return kind;
  if (kind !== "normal") return "other";
  const tags = new Set(document.hits.flatMap(hit => hit.kind === "ordinary" && hit.attackTag ? [hit.attackTag] : []));
  if (tags.size === 1 && tags.has("normal")) return "normal";
  if (tags.size === 1 && tags.has("charged")) return "charged";
  if (tags.size === 1 && tags.has("plunge")) return "plunge";
  return "normal-other";
}
function explicitConditions(document: CalculatorDocument): string[] {
  const context = document.gameContext;
  if (!context) return [];
  const result: string[] = [];
  if (context.noelleBurst) result.push(`Q 状态：${context.noelleBurst.active ? "已激活" : "未激活"}`);
  if (context.ittoCharged) result.push(`乱神之怪力：${context.ittoCharged.superstrengthStacks} 层`, `Q 状态：${context.ittoCharged.burst.active ? "已激活" : "未激活"}`);
  if (context.kukiDamage?.burstHpRatioAtCast !== undefined) result.push(`施放时生命：${Math.round(context.kukiDamage.burstHpRatioAtCast * 10000) / 100}%`);
  if (context.idleStanceCast?.wanderer?.noAbsorption !== undefined) result.push(context.idleStanceCast.wanderer.noAbsorption ? "本次无元素吸收" : "本次有元素吸收");
  return result;
}

/** Read-only presentation of existing candidates/results. This does not load,
 * prepare or calculate an action, infer missing states, or create new support. */
export function buildCharacterOutputs(candidates: readonly CalculatorDocument[], catalog: GameDataCatalog, options: CharacterOutputOptions = {}): CharacterOutputGroup[] {
  const abilities = new Map(catalog.talentSets.flatMap(set => set.abilities.map(ability => [ability.id, ability] as const)));
  const groups = new Map<CharacterOutputGroup["id"], CharacterOutputGroup>();
  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (!candidate.gameContext) continue;
    const active = options.selectedCandidateIndex === candidateIndex ? options.currentDocument : undefined;
    const effective = active ?? options.effectiveDocuments?.get(candidateIndex);
    const document = effective && characterOutputActionKey(effective) === characterOutputActionKey(candidate) ? effective : candidate;
    const actionKey = characterOutputActionKey(document);
    const inputVersion = characterOutputInputVersion(document);
    const currentMatches = active !== undefined && characterOutputActionKey(active) === characterOutputActionKey(candidate);
    const observed = currentMatches && options.currentResult ? options.currentResult
      : [...(options.observations ?? [])].reverse().find(row => row.actionKey === actionKey && row.inputVersion === inputVersion)?.result;
    const selected = new Set(document.selectedHitIds);
    const hits = document.hits.filter(hit => selected.has(hit.id));
    const unavailable = hits.length > 0 && hits.every(hit => hit.kind === "blocked");
    const scope = observed?.aggregation.scope ?? (document.scope === "single-hit" ? "single-hit"
      : document.gameContext?.scopeCoverage === "complete-cast" ? "complete-cast" : "selected-components");
    const damage = observed?.status === "calculated" && observed.aggregation.status === "calculated" ? observed.totals : undefined;
    const nonDamaging = observed && observed.hits.length > 0 && observed.hits.every(hit => hit.status === "non-damaging");
    const status = observed?.status === "blocked" ? "blocked" : nonDamaging ? "non-damaging" : damage ? "calculated" : observed ? "unavailable" : unavailable ? "unavailable" : "pending";
    const knownSubtotal = observed?.aggregation.components.some(component => component.damage && component.status === "calculated") ? observed.aggregation.knownSubtotal : undefined;
    const item: CharacterOutputItem = {
      candidateIndex, actionKey, title: calculatorActionDisplayName(document),
      ...(document.gameContext?.variantName ? { variantLabel: document.gameContext.variantName } : {}),
      conditions: explicitConditions(document), selected: options.selectedCandidateIndex === candidateIndex,
      scope, scopeLabel: scopes[scope] + (scope === "single-hit" && document.gameContext?.scopeCoverage === "selected-components" ? "（部分已定义范围）" : ""), status,
      ...(!nonDamaging && damage ? { damage } : {}), ...(!nonDamaging && knownSubtotal && !damage ? { knownSubtotal } : {}),
      ...(observed?.hits.some(hit => hit.nonCriticalComparisonOnly) ? { nonCriticalComparisonOnly: true as const } : {}),
      components: observed ? observed.aggregation.components.filter(component => component.selected).map(component => ({
        id: component.id, label: component.label, status: component.status,
        ...(component.damage ? { expected: component.damage.expected } : {}),
      })) : hits.map(hit => ({ id: hit.id, label: hit.label, status: hit.kind === "blocked" ? "unavailable" : "pending" })),
      reasons: [...new Set(observed?.blockers ?? hits.flatMap(hit => hit.kind === "blocked" ? hit.reasons : []))],
    };
    const groupId = groupFor(document, abilities);
    const group = groups.get(groupId) ?? { id: groupId, label: groupLabels[groupId], items: [] };
    group.items.push(item);
    groups.set(groupId, group);
  }
  const character = catalog.characters.find(row => row.id === candidates.find(document => document.gameContext)?.gameContext?.characterId);
  const kinds = new Set(catalog.talentSets.filter(set => character?.talentSetIds.includes(set.id)).flatMap(set => set.abilities.map(ability => ability.kind)));
  for (const id of ["normal", "skill", "burst"] as const) if (kinds.has(id) && !groups.has(id)) {
    groups.set(id, { id, label: groupLabels[id], items: [], unavailableReason: "当前来源尚无可选动作定义" });
  }
  return (Object.keys(groupLabels) as CharacterOutputGroup["id"][]).flatMap(id => groups.get(id) ?? []);
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const number = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
const statusLabels: Record<CharacterOutputItem["status"], string> = {
  pending: "待计算", calculated: "已计算", blocked: "条件未齐", unavailable: "缺少计算定义或结果", "non-damaging": "不直接造成伤害",
};
export function renderCharacterOutputs(groups: readonly CharacterOutputGroup[]): string {
  if (!groups.length) return '<p class="calculator-hint">当前角色暂无可列出的动作定义，不能据此视为伤害为 0。</p>';
  const selectedGroup = groups.find(group => group.items.some(item => item.selected)) ?? groups.find(group => group.items.length) ?? groups[0]!;
  return `<div class="calculator-character-outputs calculator-character-outputs--compact" aria-label="角色动作伤害概览">${groups.map(group => `<details class="character-output-group" data-character-output-group="${group.id}" name="calculator-character-output-groups"${group === selectedGroup ? " open" : ""}>
    <summary class="character-output-group-heading"><strong>${escape(group.label)}</strong><span>${group.unavailableReason ? "暂无定义" : `${group.items.length} 项`}</span></summary>
    ${group.unavailableReason ? `<p class="calculator-hint">${escape(group.unavailableReason)}</p>` : ""}<ul class="character-output-list">${group.items.map(item => `<li class="character-output-row${item.selected ? " character-output-row--selected" : ""}">
    <button type="button" class="character-output-action" data-character-output-index="${item.candidateIndex}"${item.selected ? ' aria-current="true"' : ""} title="${escape(item.title)}${item.variantLabel ? ` · ${escape(item.variantLabel)}` : ""}">
      <strong class="character-output-title">${escape(item.title)}</strong>
      <span class="character-output-value"${!item.damage && !item.knownSubtotal && item.status !== "non-damaging" ? ` data-character-output-pending aria-label="${statusLabels[item.status]}；伤害未确定"` : ""}>${item.damage ? `期望 ${number(item.damage.expected)}` : item.knownSubtotal ? `已知部分 ${number(item.knownSubtotal.expected)}` : statusLabels[item.status]}</span>
      <small class="character-output-meta">${escape(item.scopeLabel)}${item.variantLabel ? ` · ${escape(item.variantLabel)}` : ""}</small>
    </button>
    ${item.selected && item.conditions.length ? `<p class="character-output-conditions">${item.conditions.map(escape).join("；")}</p>` : ""}
    ${item.selected && item.damage ? `<dl class="character-output-metrics"><div><dt>期望伤害</dt><dd>${number(item.damage.expected)}</dd></div><div><dt>${item.nonCriticalComparisonOnly ? "不暴击对照（非实际分支）" : "不暴击"}</dt><dd>${number(item.damage.nonCritical)}</dd></div><div><dt>暴击</dt><dd>${number(item.damage.critical)}</dd></div></dl>` : item.selected && item.knownSubtotal ? '<p class="character-output-conditions">仅列已计算部分，总伤害尚未确定。</p>' : ""}
    ${item.selected && item.components.length > 1 ? `<details class="character-output-more"><summary>查看各段（${item.components.length}）</summary><ul>${item.components.map(component => `<li>${escape(component.label)}：${component.expected === undefined ? "—" : number(component.expected)}</li>`).join("")}</ul></details>` : ""}
    ${item.selected && item.reasons.length ? `<details class="character-output-more"><summary>查看待补条件（${item.reasons.length}）</summary><p>${item.reasons.map(escape).join("；")}</p></details>` : ""}</li>`).join("")}</ul></details>`).join("")}<p class="calculator-hint character-output-footnote">单段与一次施放分别标注；待计算或缺少定义的伤害不记为 0。</p></div>`;
}
