import { calculatorFinalSnapshotSchema, isObservedPlungeAction, type CalculatorDocument, type CalculatorFinalSnapshot, type CalculatorHit } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const path = (key: string): string => `gameContext.observedPlunge.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;

/** User-observed count and contacts feed the shared calculator-AST plunge expansion. */
export function renderObservedPlungeControls(document: CalculatorDocument): string {
  if (!isObservedPlungeAction(document)) return "";
  const context = document.gameContext?.observedPlunge ?? {};
  const high = document.gameContext!.skillId.includes("-high-");
  const complete = document.scope !== "single-hit";
  const characterHasLowHighTemplate = /^(lohen|linnea|sandrone|alyosha)-plunge-(?:low|high)-/.test(document.gameContext!.skillId);
  const contactingHits = contactingPlungeHits(document);
  const needsSnapshots = complete && characterHasLowHighTemplate && context.statsStableAcrossHits === false &&
    contactingHits.length > 1;
  const showSnapshotDraft = needsSnapshots || hasObservedPlungeSnapshotDraft(document);
  return `<fieldset data-source-cast-controls="observed-plunge"><legend>${high ? "高空" : "低空"}下落 · 实际接触记录</legend><div class="calculator-fields">${
    state("noExternalInfusion", "本次实际没有外部附魔，保持来源物理伤害", context.noExternalInfusion) +
    (complete ? `<label>途中实际碰撞机会次数<input type="number" min="0" max="64" step="1" data-field="${path("collisionCount")}" data-source-cast-number-field data-optional-number value="${context.collisionCount ?? ""}" placeholder="未知；留空"></label>` +
      state("landingContact", `${high ? "高空" : "低空"}落地冲击实际接触所选目标`, context.landingContact) +
      state("statsStableAcrossHits", "全部接触时的最终进攻面板、装备和目标条件稳定", context.statsStableAcrossHits) +
      (characterHasLowHighTemplate && context.statsStableAcrossHits !== true ? state("targetConditionsStableAcrossHits", "各次命中所选目标的防御与抗性条件稳定", context.targetConditionsStableAcrossHits) : "") : "")
  }</div>${complete && context.collisionCount !== undefined ? `<details open><summary>逐次碰撞接触（${context.collisionCount} 次机会）</summary><div class="calculator-fields">${Array.from({ length: context.collisionCount }, (_, index) => state(`collisionContacts.${index + 1}`, `第 ${index + 1} 次碰撞实际接触所选目标`, context.collisionContacts?.[String(index + 1)])).join("")}</div></details>` : ""}${showSnapshotDraft ? renderObservedPlungeSnapshotDraft(document) : ""}<p class="calculator-hint">碰撞次数和每次目标接触来自实际观察；高度不决定次数。碰撞与落地分别采用来源天赋倍率，不猜测帧数或空中路径。完整合计需要所有机会及落地接触明确。独立单击只计算所选已发生的伤害，不要求后续落地记录。物理碰撞的来源反应已关闭。</p></fieldset>`;
}

type SnapshotDraftRow = Record<string, string>;
type SnapshotDraft = { rows: Record<string, SnapshotDraftRow>; dirty: boolean };
const snapshotDrafts = new Map<string, SnapshotDraft>();
export const OBSERVED_PLUNGE_SNAPSHOT_DRAFT_FIELD = "gameContext.observedPlunge.snapshotDraft";
const snapshotKey = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [string, string, number?, number?]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "最终生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "最终元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "最终充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "命中时角色等级", 1, 100], ["ascension", "命中时突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"],
  ["additiveBaseDamage", "本击独立加算基伤"], ["reactionBonus", "本击反应增伤（小数）"],
];
function contactingPlungeHits(document: CalculatorDocument): Extract<CalculatorHit, { kind: "ordinary" }>[] {
  const context = document.gameContext?.observedPlunge;
  if (!context) return [];
  return document.hits.filter((hit): hit is Extract<CalculatorHit, { kind: "ordinary" }> => {
    if (hit.kind !== "ordinary") return false;
    if (hit.id.endsWith(":landing")) return context.landingContact === true;
    const collision = /:collision-(\d+)$/.exec(hit.id);
    return collision !== null && context.collisionContacts?.[collision[1]!] === true;
  });
}
const snapshotRowFromHit = (hitId: string, snapshot: CalculatorFinalSnapshot | undefined): SnapshotDraftRow => ({
  hitId,
  ...Object.fromEntries(snapshotFields.map(([key]) => {
    const value = key.startsWith("stats.") ? snapshot?.stats[key.slice(6) as keyof CalculatorFinalSnapshot["stats"]] : snapshot?.[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
    return [key, value === undefined ? "" : String(value)];
  })),
  source: snapshot?.source ?? "",
  sourceRefs: snapshot?.sourceRefs.join("\n") ?? "",
  ...(snapshot?.origin ? { origin: snapshot.origin } : {}),
});
function getSnapshotDraft(document: CalculatorDocument): SnapshotDraft {
  const liveRows = Object.fromEntries(contactingPlungeHits(document).map((hit) => [hit.id, snapshotRowFromHit(hit.id, hit.finalSnapshot)]));
  const saved = snapshotDrafts.get(snapshotKey(document));
  const draft: SnapshotDraft = saved?.dirty ? { ...saved, rows: { ...liveRows, ...saved.rows } } : { rows: liveRows, dirty: false };
  snapshotDrafts.set(snapshotKey(document), draft);
  return draft;
}
const snapshotInput = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string =>
  `<label>${esc(label)}<input data-observed-plunge-snapshot-input data-observed-plunge-snapshot-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空不代填"${numeric ? ` step="any" ${bounds}` : ""}></label>`;

/** Per-hit historic offense is attached to the generated hit IDs only after complete, sourced rows validate. */
export function renderObservedPlungeSnapshotDraft(document: CalculatorDocument): string {
  const draft = getSnapshotDraft(document);
  const hits = contactingPlungeHits(document);
  const context = document.gameContext?.observedPlunge;
  const stable = context?.statsStableAcrossHits === true;
  const message = hits.length < 2
    ? "已确认接触不足两项；当前快照草稿不适用于这些接触，可恢复实际接触记录或放弃草稿。"
    : stable
      ? "当前已声明各命中面板及目标条件稳定；此草稿不是该稳定路径的计算前提。仍可应用为逐击历史快照，或放弃草稿。"
      : "逐击历史面板草稿尚未应用；请应用后再计算或导出。";
  if (hits.length < 2) return `<div data-observed-plunge-snapshot-editor><p data-observed-plunge-snapshot-status role="status" class="calculator-hint">${message}</p><button type="button" data-action="observed-plunge-snapshot-reset">放弃未应用编辑</button></div>`;
  return `<div data-observed-plunge-snapshot-editor><details open><summary>各次命中的历史最终面板 · ${hits.length} 项</summary><p class="calculator-hint">每行按命中标识分别记录当时的完整最终攻击上下文；这些命中标识来自上方实际碰撞／落地接触。不得复制当前面板冒充历史值。来源说明请写明实际记录及其取样时间点；来源引用填实际记录 URI 或可核验链接。目标防御和抗性由上方稳定性确认及当前目标面板承担，进攻快照不会冻结敌人状态。</p>${hits.map((hit) => {
    const row = draft.rows[hit.id] ?? snapshotRowFromHit(hit.id, hit.finalSnapshot);
    return `<fieldset data-observed-plunge-snapshot-row="${esc(hit.id)}"><legend>${esc(hit.label)} · ${esc(hit.id)}${hit.finalSnapshot ? " · 已有历史快照" : " · 需要历史快照"}</legend><div class="calculator-fields"><label>实际命中标识<input readonly value="${esc(hit.id)}"></label>${snapshotFields.map(([key, label, min, max]) => snapshotInput(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${snapshotInput("source", "实际面板记录来源及取样时间点", row.source)}</div><label>实际来源引用（每行一条 URI 或链接）<textarea data-observed-plunge-snapshot-input data-observed-plunge-snapshot-key="sourceRefs" rows="2" placeholder="实际记录 URI 或可核验链接">${esc(row.sourceRefs)}</textarea></label></fieldset>`;
  }).join("")}</details><p data-observed-plunge-snapshot-status role="status" class="calculator-hint">${draft.dirty ? message : "逐击历史面板没有未应用编辑。"}</p><button type="button" data-action="observed-plunge-snapshot-apply">应用逐击历史面板</button><button type="button" data-action="observed-plunge-snapshot-reset">放弃未应用编辑</button></div>`;
}

export function captureObservedPlungeSnapshotDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getSnapshotDraft(document);
  for (const row of root.querySelectorAll<HTMLElement>("[data-observed-plunge-snapshot-row]")) {
    const hitId = row.dataset.observedPlungeSnapshotRow!;
    const values: SnapshotDraftRow = { hitId };
    for (const input of row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-observed-plunge-snapshot-key]")) values[input.dataset.observedPlungeSnapshotKey!] = input.value;
    const previous = draft.rows[hitId];
    if (previous?.origin && Object.entries(values).every(([key, value]) => previous[key] === value)) values.origin = previous.origin;
    draft.rows[hitId] = values;
  }
  draft.dirty = true;
}

export function applyObservedPlungeSnapshotDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureObservedPlungeSnapshotDraft(document, root);
  const draft = getSnapshotDraft(document), hitById = new Map(contactingPlungeHits(document).map((hit) => [hit.id, hit]));
  const snapshots: Array<[string, CalculatorFinalSnapshot]> = [];
  const number = (row: SnapshotDraftRow, key: string, label: string, integer = false): number => {
    const raw = row[key], value = Number(raw);
    if (!raw?.trim() || !Number.isFinite(value) || integer && !Number.isInteger(value)) throw new Error(`${row.hitId} 的${label}须填写实际有限数值；未知不可当作零。`);
    return value;
  };
  for (const [hitId, row] of Object.entries(draft.rows)) {
    if (!hitById.has(hitId)) continue;
    const stats: Record<string, number> = {}, snapshot: Record<string, unknown> = {
      stats, characterLevel: number(row, "characterLevel", "角色等级", true), ascension: number(row, "ascension", "突破阶段", true),
      damageBonus: number(row, "damageBonus", "最终增伤"), additiveBaseDamage: number(row, "additiveBaseDamage", "独立加算基伤"),
      reactionBonus: number(row, "reactionBonus", "反应增伤"), source: row.source?.trim(),
      sourceRefs: (row.sourceRefs ?? "").split("\n").map((value) => value.trim()).filter(Boolean),
      ...(row.origin ? { origin: row.origin } : {}),
    };
    for (const [key, label] of snapshotFields) {
      if (!key.startsWith("stats.")) continue;
      if (key === "stats.energyRecharge" && !row[key]?.trim()) continue;
      stats[key.slice(6)] = number(row, key, label);
    }
    const parsed = calculatorFinalSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) throw new Error(`${hitId} 的历史面板不完整：${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
    snapshots.push([hitId, parsed.data]);
  }
  for (const [hitId, snapshot] of snapshots) hitById.get(hitId)!.finalSnapshot = snapshot;
  snapshotDrafts.delete(snapshotKey(document));
}

export function resetObservedPlungeSnapshotDraft(document: CalculatorDocument): void { snapshotDrafts.delete(snapshotKey(document)); }
export function hasObservedPlungeSnapshotDraft(document: CalculatorDocument): boolean { return snapshotDrafts.get(snapshotKey(document))?.dirty === true; }
