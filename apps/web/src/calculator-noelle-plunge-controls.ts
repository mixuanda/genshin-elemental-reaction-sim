import { compileNoellePlungeSchedule, noellePlungeCastContextSchema, NOELLE_PLUNGE_CAST_KINDS, type CalculatorDocument } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.noellePlungeCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["noellePlungeCast"]>;
type Kind = typeof NOELLE_PLUNGE_CAST_KINDS[number];
const castOf = (document: CalculatorDocument): Kind | undefined => NOELLE_PLUNGE_CAST_KINDS.find(kind => kind === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number min="0" step="1" value="${value ?? ""}" placeholder="未知；留空"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const roles: Record<string, string> = { collision: "下落碰撞", landing: "落地伤害", low: "低空落地", high: "高空落地" };

/** The complete branch declares observed airborne/landing facts; a standalone hit asks only for its own physical context. */
export function renderNoellePlungeControls(document: CalculatorDocument): string {
  const kind = castOf(document);
  if (!kind) return "";
  const context: Context = document.gameContext!.noellePlungeCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = compileNoellePlungeSchedule(kind, context);
  const high = kind === "noelle-plunge-high-observed-c0";
  const common = complete ? textField("casterId", "施放角色标识", context.casterId) + textField("targetId", "所选敌人标识", context.targetId) +
    state("airborneXianyunConfirmed", "本次确由闲云条件取得来源要求的腾空资格", context.airborneXianyunConfirmed) +
    state("returnedToGroundConfirmed", "本次已实际返回地面并观察落地过程", context.returnedToGroundConfirmed) +
    state("noHitlag", "完整观察过程没有卡肉延长", context.noHitlag) + state("noInterruption", "本次下落与落地过程没有中断", context.noInterruption) +
    state("fullObservedLifetime", "已观察完整下落、落地及动作结束尾段", context.fullObservedLifetime) +
    numberField("observedThroughFrame", "实际观察到的末帧（相对本次起手）", context.observedThroughFrame) +
    state("statsStableAcrossHits", "完整过程的共同基础面板与装备稳定", context.statsStableAcrossHits) +
    state("collisionOccurred", "本次第 33 帧确实发生下落碰撞机会", context.collisionOccurred) : "";
  const physical = state("burstInactive", complete ? "完整过程大扫除未启用（本分支只覆盖物理下落）" : "本击发生时大扫除未启用", context.burstInactive) +
    state("noExternalInfusion", complete ? "完整过程没有外部元素附魔" : "本击没有外部元素附魔，确为物理伤害", context.noExternalInfusion);
  const contacts = complete ? `<details open><summary>实际碰撞与落地接触 · ${schedule.candidates.length} 次候选</summary><p class="calculator-hint">第 33 帧碰撞只在明确发生时才生成候选；未知不当作没有碰撞。碰撞机会是否发生与是否命中所选敌人分别记录。落地在第 ${high ? 42 : 39} 帧；每项接触都须明确命中或落空。</p><div class="calculator-fields">${schedule.candidates.map(hit => state(`targetContacts.${hit.id}`, `${roles[hit.templateRole] ?? hit.templateRole} · ${hit.id} · ${hit.frame}f / 取样 ${hit.snapshotFrame}f：是否命中所选敌人`, context.targetContacts?.[hit.id])).join("")}</div><p class="calculator-hint">完整来源窗口至少观察至第 ${schedule.requiredObservedThroughFrame} 帧；此要求不代填实际观察值。</p></details>` : `<p class="calculator-hint">这里计算一记已经发生的独立物理命中；不要求完整腾空、未来落地或第 ${high ? 82 : 80} 帧的观察记录。完整下落分支的资格条件不会阻挡本击；本击的大扫除状态与附魔仍须明确。</p>`;
  return `<fieldset data-source-cast-controls="noelle-plunge"><legend>诺艾尔 C0 · ${high ? "高空" : "低空"}物理下落：实际条件</legend><div class="calculator-fields">${common}${physical}</div>${contacts}${renderNoellePlungeDraft(document)}<p class="calculator-hint">固定来源分支为 provisional，未经实机确认。这里只覆盖明确的闲云腾空观察分支及本次碰撞／落地，不把普通跳跃或其他腾空条件视为自动成立，也不代表通用下落调度或整队轮转已完成。未知保持为空，不默认否、零或未命中。</p></fieldset>`;
}

type DraftRow = Record<string, string>;
type Draft = { snapshots: DraftRow[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const NOELLE_PLUNGE_DRAFT_FIELD = "gameContext.noellePlungeCast.scheduleDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "独立加算基伤"], ["reactionBonus", "反应增伤（小数）"],
];
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document));
  if (saved?.dirty) return saved;
  const context = document.gameContext?.noellePlungeCast;
  const draft: Draft = { snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id,
    ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false };
  drafts.set(keyFor(document), draft); return draft;
}
const draftInput = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-noelle-plunge-draft-input data-noelle-plunge-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;

/** Optional historical snapshots use ordinary typed rows; no gameplay conditions are edited through JSON. */
export function renderNoellePlungeDraft(document: CalculatorDocument): string {
  const kind = castOf(document);
  if (!kind) return "";
  const context = document.gameContext!.noellePlungeCast ?? {}, draft = getDraft(document);
  const schedule = compileNoellePlungeSchedule(kind, context);
  const ids = [...new Set(schedule.candidates.map(hit => hit.snapshotId))];
  return `<div data-noelle-plunge-editor><details><summary>历史最终快照（可选）· ${draft.snapshots.length} 份</summary><p class="calculator-hint">面板稳定时通常无需历史快照。只有确有独立历史记录才添加：${ids.length ? ids.map(esc).join("、") : "先明确碰撞与落地分支以显示取样标识"}。填写全部最终数值及其来源；不会把当前配装复制为过去快照。目标抗性仍由逐击输入提供。</p>${draft.snapshots.map((row, index) => `<fieldset data-noelle-plunge-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-noelle-plunge-draft-input data-noelle-plunge-draft-key="id" value="${esc(row.id)}" list="noelle-plunge-snapshot-identifiers" placeholder="采用上方实际取样标识"></label>${snapshotFields.map(([key, label, min, max]) => draftInput(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${draftInput("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-noelle-plunge-draft-input data-noelle-plunge-draft-key="sourceRefs" rows="2" placeholder="明确的记录或来源链接">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="noelle-plunge-remove-snapshot" data-noelle-plunge-row-index="${index}">删除此快照</button></fieldset>`).join("")}<datalist id="noelle-plunge-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="noelle-plunge-add-snapshot">添加明确的历史快照</button></details><p data-noelle-plunge-draft-status role="status" class="calculator-hint">${draft.dirty ? "历史快照草稿尚未应用；请应用后再计算或导出。" : "历史快照没有未应用编辑。"}</p><button type="button" data-action="noelle-plunge-apply">应用历史快照</button><button type="button" data-action="noelle-plunge-reset">放弃未应用编辑</button></div>`;
}

export function captureNoellePlungeDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  draft.snapshots = [...root.querySelectorAll<HTMLElement>("[data-noelle-plunge-snapshot-row]")].map((row, index) => {
    const values: DraftRow = Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-noelle-plunge-draft-key]")].map(input => [input.dataset.noellePlungeDraftKey!, input.value]));
    const previous = draft.snapshots[index];
    // Editing a historical value invalidates equipment-conversion provenance for that snapshot.
    if (previous?.origin && Object.entries(values).every(([key, value]) => previous[key] === value)) values.origin = previous.origin;
    return values;
  });
  draft.dirty = true;
}
export function editNoellePlungeDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureNoellePlungeDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "noelle-plunge-remove-snapshot") draft.snapshots.splice(Number(button.dataset.noellePlungeRowIndex), 1);
  else if (button.dataset.action === "noelle-plunge-add-snapshot") draft.snapshots.push({});
}
export function applyNoellePlungeDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureNoellePlungeDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.noellePlungeCast ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => {
    const parsed = Number(value);
    if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
    return parsed;
  };
  if (!draft.snapshots.length) delete next.snapshots;
  else {
    const snapshots: Record<string, unknown> = {};
    for (const [index, row] of draft.snapshots.entries()) {
      const id = row.id?.trim();
      if (!id || Object.prototype.hasOwnProperty.call(snapshots, id)) throw new Error(`历史快照 ${index + 1} 须提供不重复的取样标识。`);
      const stats: Record<string, number> = {}, snapshot: Record<string, unknown> = { stats, source: row.source?.trim(), sourceRefs: (row.sourceRefs ?? "").split("\n").map(value => value.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
      for (const [key, label] of snapshotFields) {
        if (key === "stats.energyRecharge" && !row[key]?.trim()) continue;
        const value = numeric(row[key], `历史快照 ${index + 1} 的${label}`, key === "characterLevel" || key === "ascension");
        if (key.startsWith("stats.")) stats[key.slice(6)] = value; else snapshot[key] = value;
      }
      Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
    }
    next.snapshots = snapshots;
  }
  const parsed = noellePlungeCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`下落历史快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.noellePlungeCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetNoellePlungeDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasNoellePlungeDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
