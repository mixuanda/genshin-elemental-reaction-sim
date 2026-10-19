import { kachinaCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.kachinaCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>未知</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const text = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${path(key)}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const num = (key: string, label: string, value: number | undefined): string => `<label>${esc(label)}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0" step="1" value="${value ?? ""}" placeholder="未知；留空"></label>`;
type Draft = { events: string; snapshots: string; dirty: boolean };
const drafts = new Map<string, Draft>();
const keyFor = (doc: CalculatorDocument) => `${doc.dataIdentity.datasetId}:${doc.gameContext?.characterId}:${doc.gameContext?.skillId}:${doc.gameContext?.effectiveTalentLevel}`;
function draftOf(doc: CalculatorDocument): Draft {
  const key = keyFor(doc), saved = drafts.get(key);
  if (saved?.dirty) return saved;
  const context = doc.gameContext?.kachinaCast;
  const draft = { events: context?.events === undefined ? "" : JSON.stringify(context.events, null, 2),
    snapshots: context?.snapshots === undefined ? "" : JSON.stringify(context.snapshots, null, 2), dirty: false };
  drafts.set(key, draft); return draft;
}

export const KACHINA_DRAFT_FIELD = "gameContext.kachinaCast.scheduleDraft";
export function renderKachinaDraft(doc: CalculatorDocument): string {
  const draft = draftOf(doc);
  return `<div data-kachina-editor><p class="calculator-hint">帧从本次 E 开始算。每条事件写明动作后实际夜魂余额（0–60）；同帧按列表顺序。每次震荡明确 targetContact，命中可填 snapshotId 对应历史最终面板。接触目标的震荡逐击填写 a1Active；为 true 时还须填写 a1IncludedInDamageBonus，表示本击手动增伤或历史快照已含A1的20%岩伤。仅在“全程没有A1”已确认时可省略逐击字段。没有可靠来源规定首击帧、周期、逐动作扣点或A1激活边界，故只接受真实记录。</p><label>实际动作与夜魂事件 JSON<textarea data-kachina-draft-input data-kachina-events rows="12" spellcheck="false" placeholder='[{"id":"pulse-1","frame":30,"kind":"independent-slam","nightsoulPointsAfter":50,"targetContact":true,"a1Active":true,"a1IncludedInDamageBonus":false},{"id":"end","frame":300,"kind":"end","nightsoulPointsAfter":0}]'>${esc(draft.events)}</textarea></label><p class="calculator-hint">格式示例中的 30、50、300 仅示范字段，不是游戏时序；须替换成自己观察的数值。可用动作：mount、dismount、riding-slam、independent-slam、points-observed、end。余额从 E 的 60 点开始，最后以 0 点 end 结束。</p><button type="button" data-action="kachina-example">填入可编辑的格式示例</button><details><summary>逐击历史最终面板（可选）</summary><label>snapshotId 到最终快照的 JSON 对象<textarea data-kachina-draft-input data-kachina-snapshots rows="8" spellcheck="false" placeholder="共同面板稳定时可留空">${esc(draft.snapshots)}</textarea></label></details><p class="calculator-hint" role="status" data-kachina-draft-status>${draft.dirty ? "实际事件草稿尚未应用。" : "当前实际事件记录已应用。"}</p><button type="button" data-action="kachina-apply">应用实际记录</button><button type="button" data-action="kachina-reset">放弃未应用编辑</button></div>`;
}
export function renderKachinaCastControls(doc: CalculatorDocument): string {
  if (doc.gameContext?.skillId !== "kachina-skill-observed-lifecycle") return "";
  const context = doc.gameContext.kachinaCast ?? {};
  return `<fieldset data-source-cast-controls="kachina"><legend>卡齐娜：冲天转转实际完整寿命</legend><div class="calculator-fields">${text("casterId", "卡齐娜角色标识", context.casterId)}${text("targetId", "计算目标标识", context.targetId)}<label>初始 E 分支<select data-source-cast-enum-field="${path("startingMode")}"><option value="unknown"${!context.startingMode ? " selected" : ""}>未知</option><option value="independent"${context.startingMode === "independent" ? " selected" : ""}>点按：独立放置</option><option value="riding"${context.startingMode === "riding" ? " selected" : ""}>长按：立即搭乘</option></select></label>${state("allActionsRecorded", "已记录全部骑乘／独立震荡及切换", context.allActionsRecorded)}${state("fullObservedLifetime", "已观察至本次实体消失", context.fullObservedLifetime)}${state("noPhlogiston", "没有燃素续航", context.noPhlogiston)}${state("noReplacement", "没有替换本次实体", context.noReplacement)}${state("noInterruption", "没有中断或提前破坏", context.noInterruption)}${state("a1InactiveThroughout", "确认全程没有A1夜魂迸发岩伤加成（有激活请选否并逐击记录）", context.a1InactiveThroughout)}${state("statsStableAcrossHits", "各击最终面板与目标条件稳定", context.statsStableAcrossHits)}${num("observedThroughFrame", "实际观察截止帧", context.observedThroughFrame)}</div>${renderKachinaDraft(doc)}<p class="calculator-hint">完整 E 仅在实际事件及夜魂耗尽终点均明确时计总伤。独立已发生的一击不依赖以后事件，也无需团队。C0 Q 自身仅有单次直接伤害，另在「认真点！」动作计算；其领域不添加后续 Q 伤害。</p></fieldset>`;
}
export function captureKachinaDraft(doc: CalculatorDocument, root: HTMLElement): void {
  const draft = draftOf(doc);
  draft.events = root.querySelector<HTMLTextAreaElement>("[data-kachina-events]")?.value ?? draft.events;
  draft.snapshots = root.querySelector<HTMLTextAreaElement>("[data-kachina-snapshots]")?.value ?? draft.snapshots;
  draft.dirty = true;
}
export function editKachinaDraft(doc: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureKachinaDraft(doc, root);
  if (button.dataset.action !== "kachina-example") return;
  draftOf(doc).events = JSON.stringify([
    { id: "example-independent-1", frame: 30, kind: "independent-slam", nightsoulPointsAfter: 50, targetContact: true },
    { id: "example-mount", frame: 90, kind: "mount", nightsoulPointsAfter: 40 },
    { id: "example-riding-1", frame: 120, kind: "riding-slam", nightsoulPointsAfter: 30, targetContact: true },
    { id: "example-drain", frame: 299, kind: "points-observed", nightsoulPointsAfter: 0 },
    { id: "example-end", frame: 300, kind: "end", nightsoulPointsAfter: 0 },
  ], null, 2);
}
export function applyKachinaDraft(doc: CalculatorDocument, root: HTMLElement): void {
  captureKachinaDraft(doc, root);
  const draft = draftOf(doc), context = doc.gameContext!.kachinaCast ?? {};
  const events = draft.events.trim() ? JSON.parse(draft.events) as unknown : undefined;
  const snapshots = draft.snapshots.trim() ? JSON.parse(draft.snapshots) as unknown : undefined;
  const parsed = kachinaCastContextSchema.parse({ ...context, events, snapshots });
  doc.gameContext!.kachinaCast = parsed;
  drafts.delete(keyFor(doc));
}
export function resetKachinaDraft(doc: CalculatorDocument): void { drafts.delete(keyFor(doc)); }
export function hasKachinaDraft(doc: CalculatorDocument): boolean { return drafts.get(keyFor(doc))?.dirty === true; }
