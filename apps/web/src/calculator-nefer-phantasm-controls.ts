import { compileNeferPhantasmSchedule, neferPhantasmCastContextSchema, NEFER_PHANTASM_CAST_KINDS, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { neferPhantasmTemplates, type NeferPhantasmRoleKey } from "../../../packages/game-data/src/character-mappings/nefer-phantasm-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.neferPhantasmCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["neferPhantasmCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
type Kind = typeof NEFER_PHANTASM_CAST_KINDS[number];
const roles = ["nefer1", "nefer2", "shade1", "shade2", "shade3"] as const;
const template = neferPhantasmTemplates[0]!;
const castOf = (document: CalculatorDocument): Kind | undefined => NEFER_PHANTASM_CAST_KINDS.find(kind => kind === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, options: { integer?: boolean; min?: number; max?: number } = {}): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;

function hitFields(key: string, values: HitState, ordinary = false): string {
  const number = (field: keyof HitState, label: string, bounds: { integer?: boolean; min?: number; max?: number } = { min: 0 }): string =>
    numberField(`${key}.${field}`, label, typeof values[field] === "number" ? values[field] as number : undefined, bounds);
  const passive = number("moonsignLevel", "本击实际月兆等级（0–4）", { min: 0, max: 4, integer: true }) +
    number("veilStacks", "本击实际帷幕层数（0–3）", { min: 0, max: 3, integer: true }) +
    state(`${key}.fullVeilEmBuffActive`, "本击独立的 8 秒满层帷幕精通窗口仍有效", values.fullVeilEmBuffActive) +
    number("includedFullVeilEm", "输入面板已含的满层帷幕精通份额");
  const special = ordinary ? "" : state(`${key}.intrinsicEmMatchesSnapshot`, "固有基础提升取样的实际精通与本击进攻快照精通相同", values.intrinsicEmMatchesSnapshot) +
    number("actualIntrinsicEm", "固有基础提升采用的实际精通（不同时须明确填写）") +
    number("specialBaseBonus", "月绽放基础提升输入总额（小数；含下项已计入份额）") +
    number("includedIntrinsicBaseBonus", "基础提升输入已含的本人固有提升（0–0.14）", { min: 0, max: 0.14 }) +
    number("reactionBonus", "本击适用的月绽放反应增伤（小数）") +
    number("specialAdditive", "本击适用的月绽放独立加算伤害") +
    number("elevationMultiplier", "专属擢升总倍率（大于 0；明确没有才填 1）");
  return `<h5>本击帷幕与精通窗口</h5><div class="calculator-fields">${passive}</div>${special ? `<h5>影子直接月绽放的实际加成</h5><div class="calculator-fields">${special}</div>` : ""}`;
}

/** The normal calculator restores an actual finite Phantasm or one actual hit. */
export function renderNeferPhantasmControls(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context: Context = document.gameContext!.neferPhantasmCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = complete ? compileNeferPhantasmSchedule(kind, context) : undefined;
  const eligibility = state("phantasmOccurred", "本次幻戏已经实际发生", context.phantasmOccurred) +
    state("shadowDanceActiveAtAction", "本次幻戏起手处于实际影舞状态", context.shadowDanceActiveAtAction);
  const lifetime = complete ? textField("casterId", "施放者标识", context.casterId) + textField("targetId", "本次所选敌人标识", context.targetId) +
    numberField("verdantDewBefore", "本次起手前实际草露数量（至少 1 枚）", context.verdantDewBefore, { min: 0, max: 3, integer: true }) +
    numberField("phantasmsUsedBefore", "本轮影舞此前已使用幻戏次数（须为 0–2）", context.phantasmsUsedBefore, { min: 0, max: 3, integer: true }) +
    numberField("firstShadeSummonFrame", "本次首次召影的实际时刻（相对起手帧）", context.firstShadeSummonFrame, { min: 0, integer: true }) +
    state("fullObservedLifetime", "已完整观察本次五个候选及其交付结束", context.fullObservedLifetime) +
    numberField("observedThroughFrame", "实际观察终点（相对本次起手帧）", context.observedThroughFrame, { min: 0, integer: true }) +
    state("statsStableAcrossHits", "五段的共同面板与装备保持稳定", context.statsStableAcrossHits) : "";
  const summary = schedule ? `<p class="calculator-hint">已应用 ${schedule.candidates.length} 个实际候选，接触本目标 ${schedule.instances.length} 段。${schedule.issues.length ? `尚需补齐：${schedule.issues.map(esc).join("；")}` : "本次有限五段的资源、观察与接触记录完整。"}</p>` : '<p class="calculator-hint">独立单击只恢复本击实际事件、面板、目标与被动。无需未选的其他四段、起手草露账本、首次召影时刻或未来观察终点。</p>';
  return `<fieldset data-source-cast-controls="nefer-phantasm"><legend>${esc(template.label)}</legend><div class="calculator-fields">${eligibility}${lifetime}</div>${complete ? '<p class="calculator-hint">本轮影舞最多使用三次幻戏。本次首次召影消费 1 枚草露，不按三次影子命中重复消费；资源前后值与公式由共享核心记录。草露消费不能反推出本击帷幕层数或精通窗口。</p>' : ""}${summary}<details open><summary>共同实际状态与已含份额</summary>${hitFields("sharedState", context.sharedState ?? {})}<p class="calculator-hint">共同值只供未逐击覆盖的字段使用。突破 ≥1 且月兆 ≥2 时，天赋项按 1 + 0.08 × 本击实际帷幕层数计算；普通独立加算和特殊加算不重复乘此倍率。满层帷幕的 100 精通窗口独立持续 8 秒，当前 3 层不能代替其实际生效状态。</p><p class="calculator-hint">固有月绽放基础提升为 min(实际精通 × 0.000175, 0.14)，由核心单独计算并扣除输入已含份额。若声明与本击快照相同，会采用本击已结算精通；否则使用明确填写的实际精通。明确没有贡献才填 0，无擢升才填 1，未知保持空白。</p></details><details><summary>逐击实际状态覆盖</summary>${document.hits.filter(hit => hit.kind === "ordinary" || hit.kind === "special").map(hit => `<fieldset data-nefer-phantasm-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}</legend>${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, hit.kind === "ordinary")}</fieldset>`).join("")}</details>${renderNeferPhantasmDraft(document)}<p class="calculator-hint">本次只闭合一轮已实际发生的 C0 幻戏：本人两段普通草伤与影子三段直接月绽放。系数使用战技有效天赋等级，不使用普攻等级。固定来源为 provisional；完整 9 秒影舞、自动草露生成、帷幕逐层到期和高命座组成仍不由这次五段伤害替代。</p></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { observationsKnown: boolean; observations: Row[]; independentKnown: boolean; independent: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const NEFER_PHANTASM_DRAFT_FIELD = "gameContext.neferPhantasmCast.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终普通增伤（小数）"], ["additiveBaseDamage", "普通独立加算基伤"], ["reactionBonus", "普通反应增伤（小数）"],
];
const toRow = (value: Record<string, unknown>): Row => Object.fromEntries(Object.entries(value).map(([key, field]) => [key, String(field)]));
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.neferPhantasmCast;
  const draft: Draft = {
    observationsKnown: context?.observations !== undefined,
    observations: roles.map(role => {
      const event = context?.observations?.find(row => row.templateRole === role), contact = event ? context?.targetContacts?.[event.candidateId] : undefined;
      return { ...(event ? toRow(event) : { templateRole: role }), ...(contact === undefined ? {} : { contact: String(contact) }) };
    }),
    independentKnown: context?.independentEvent !== undefined, independent: toRow(context?.independentEvent ?? {}),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false,
  };
  drafts.set(keyFor(document), draft); return draft;
}
const input = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-nefer-phantasm-draft-input data-nefer-phantasm-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
const booleanInput = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<select data-nefer-phantasm-draft-input data-nefer-phantasm-draft-key="${esc(key)}"><option value="">未知；需明确</option><option value="false"${value === "false" ? " selected" : ""}>否</option><option value="true"${value === "true" ? " selected" : ""}>是</option></select></label>`;
function eventFields(row: Row, fixedRole?: NeferPhantasmRoleKey): string {
  const role = fixedRole ? `<input type="hidden" data-nefer-phantasm-draft-key="templateRole" value="${fixedRole}"><p>${esc(template.roles[fixedRole].label)}</p>` : `<label>本击伤害段<select data-nefer-phantasm-draft-input data-nefer-phantasm-draft-key="templateRole"><option value="">未知；选择实际伤害段</option>${roles.map(key => `<option value="${key}"${row.templateRole === key ? " selected" : ""}>${esc(template.roles[key].label)}</option>`).join("")}</select></label>`;
  return `${role}<div class="calculator-fields">${input("candidateId", "实际事件标识", row.candidateId)}${input("frame", "实际交付帧（相对本次起手）", row.frame, true, 'min="0"')}${input("snapshotFrame", "实际进攻面板取样帧", row.snapshotFrame, true, 'min="0"')}${input("snapshotId", "实际取样标识", row.snapshotId)}${input("targetId", "所选敌人标识", row.targetId)}${fixedRole ? booleanInput("contact", "本段是否实际接触所选敌人", row.contact) : ""}</div>`;
}

export function renderNeferPhantasmDraft(document: CalculatorDocument): string {
  if (!castOf(document)) return "";
  const context = document.gameContext!.neferPhantasmCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const events = complete ? `<details open><summary>本人两段与影子三段的实际候选</summary><label>五段记录<select data-nefer-phantasm-draft-input data-nefer-phantasm-observations-known><option value="unknown"${draft.observationsKnown ? "" : " selected"}>尚未完整提供</option><option value="provided"${draft.observationsKnown ? " selected" : ""}>已提供下面五段实际记录</option></select></label><p class="calculator-hint">下方按伤害身份分组，不代表五段全局时间顺序。只要求本人 1→2、影子 1→2→3 各自顺序；两条攻击链的交错由你填写的实际帧数恢复。候选不保证命中；落空仍保留事件并选择未接触。所有时刻、快照与目标来自本次观察，没有默认动画帧。</p>${roles.map((role, index) => `<fieldset data-nefer-phantasm-observation-row="${index}"><legend>${esc(template.roles[role].label)}</legend>${eventFields(draft.observations[index] ?? {}, role)}</fieldset>`).join("")}</details>` : `<details open><summary>直接计算一记实际来源命中</summary><label>独立本击事件<select data-nefer-phantasm-draft-input data-nefer-phantasm-independent-known><option value="unknown"${draft.independentKnown ? "" : " selected"}>未提供新事件；沿用已保存本击</option><option value="provided"${draft.independentKnown ? " selected" : ""}>提供或编辑这记实际命中</option></select></label><div data-nefer-phantasm-independent-row>${eventFields(draft.independent)}</div><p class="calculator-hint">本人任一普通段或影子任一月绽放段均可直接计算。这里只声明已经实际发生且命中的本击，不补造其他四段或未来日程；本击帷幕、精通窗口和已含份额仍需按适用条件明确恢复。</p></details>`;
  const ids = [...new Set([...Object.keys(context.snapshots ?? {}), ...(complete ? draft.observations : [draft.independent]).map(row => row.snapshotId?.trim()).filter((id): id is string => Boolean(id)), ...document.hits.flatMap(hit => (hit.kind === "ordinary" || hit.kind === "special") && hit.neferPhantasmEvent ? [hit.neferPhantasmEvent.snapshotId] : [])])];
  const snapshots = `<details><summary>实际历史最终快照 · ${draft.snapshots.length} 份</summary><p class="calculator-hint">为真实历史数值添加快照并填写来源。完整五段面板不稳定时，分别提供对应取样标识的快照；独立单击可直接使用已还原的当前面板。历史最终快照须已包含当时有效的 100 精通窗口和装备派生属性，不能复制当前装备冒充历史。影子月绽放的基础提升、反应增伤和独立加算取上方实际状态，普通增伤不会进入月绽放乘区。</p>${draft.snapshots.map((row, index) => `<fieldset data-nefer-phantasm-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-nefer-phantasm-draft-input data-nefer-phantasm-draft-key="id" value="${esc(row.id)}" list="nefer-phantasm-snapshot-identifiers" placeholder="与本击取样标识一致"></label>${snapshotFields.map(([key, label, min, max]) => input(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${input("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-nefer-phantasm-draft-input data-nefer-phantasm-draft-key="sourceRefs" rows="2" placeholder="明确记录或来源链接">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="nefer-phantasm-remove-snapshot" data-nefer-phantasm-row-index="${index}">删除此快照</button></fieldset>`).join("")}<datalist id="nefer-phantasm-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="nefer-phantasm-add-snapshot">添加实际历史快照</button></details>`;
  return `<div data-nefer-phantasm-editor>${events}${snapshots}<p data-nefer-phantasm-draft-status role="status" class="calculator-hint">${draft.dirty ? "本击事件、五段记录或快照草稿尚未应用；请应用后再计算或导出。" : "实际事件与快照没有未应用编辑。"}</p><button type="button" data-action="nefer-phantasm-apply">应用实际事件与快照</button><button type="button" data-action="nefer-phantasm-reset">放弃未应用编辑</button></div>`;
}

export function captureNeferPhantasmDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRows = (kind: string): Row[] => [...root.querySelectorAll<HTMLElement>(`[data-nefer-phantasm-${kind}-row]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-nefer-phantasm-draft-key]")].map(control => [control.dataset.neferPhantasmDraftKey!, control.value])));
  const observations = root.querySelector<HTMLSelectElement>("[data-nefer-phantasm-observations-known]");
  if (observations) { draft.observationsKnown = observations.value === "provided"; draft.observations = readRows("observation"); }
  const independent = root.querySelector<HTMLSelectElement>("[data-nefer-phantasm-independent-known]");
  if (independent) { draft.independentKnown = independent.value === "provided"; draft.independent = readRows("independent")[0] ?? {}; }
  draft.snapshots = readRows("snapshot").map((row, index) => {
    const previous = draft.snapshots[index];
    if (previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin;
    return row;
  });
  draft.dirty = true;
}
export function editNeferPhantasmDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureNeferPhantasmDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "nefer-phantasm-add-snapshot") draft.snapshots.push({});
  else if (button.dataset.action === "nefer-phantasm-remove-snapshot") draft.snapshots.splice(Number(button.dataset.neferPhantasmRowIndex), 1);
}
export function applyNeferPhantasmDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureNeferPhantasmDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.neferPhantasmCast ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => {
    const parsed = Number(value);
    if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
    return parsed;
  };
  const event = (row: Row, label: string): Record<string, unknown> => ({ candidateId: row.candidateId?.trim(), templateRole: row.templateRole, frame: numeric(row.frame, `${label}交付帧`, true), snapshotFrame: numeric(row.snapshotFrame, `${label}取样帧`, true), snapshotId: row.snapshotId?.trim(), targetId: row.targetId?.trim() });
  if (document.scope === "single-hit") {
    if (draft.independentKnown) next.independentEvent = event(draft.independent, "本击实际事件的");
    else delete next.independentEvent;
  } else if (draft.observationsKnown) {
    next.observations = draft.observations.map((row, index) => event(row, `候选 ${index + 1} 的`));
    next.targetContacts = Object.fromEntries(draft.observations.flatMap(row => row.contact === "true" || row.contact === "false" ? [[row.candidateId?.trim(), row.contact === "true"]] : []));
  } else { delete next.observations; delete next.targetContacts; }
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
  const parsed = neferPhantasmCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`奈芙尔实际事件或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.neferPhantasmCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetNeferPhantasmDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasNeferPhantasmDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
