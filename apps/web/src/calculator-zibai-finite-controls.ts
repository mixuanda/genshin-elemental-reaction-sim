import { compileZibaiFiniteSchedule, zibaiFiniteCastContextSchema, ZIBAI_FINITE_CAST_KINDS, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { zibaiFiniteTemplates } from "../../../packages/game-data/src/character-mappings/zibai-finite-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.zibaiFiniteCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["zibaiFiniteCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
type Kind = typeof ZIBAI_FINITE_CAST_KINDS[number];
type Role = "ordinary" | "lunar";
const castOf = (document: CalculatorDocument): Kind | undefined => ZIBAI_FINITE_CAST_KINDS.find(kind => kind === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, options: { integer?: boolean; min?: number; max?: number } = {}): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;

function hitFields(key: string, values: HitState, kind: Kind, role?: Role): string {
  const number = (field: keyof HitState, label: string, bounds: { integer?: boolean; min?: number; max?: number } = { min: 0 }): string =>
    numberField(`${key}.${field}`, label, typeof values[field] === "number" ? values[field] as number : undefined, bounds);
  const a4 = number("otherGeoTeammates", "除本人外实际岩队友人数（0–3）", { min: 0, max: 3, integer: true }) +
    number("hydroTeammates", "实际水队友人数（0–3）", { min: 0, max: 3, integer: true }) +
    number("baseDefense", "本击真实基础防御（需要补算防御百分比时填写）") +
    number("includedA4DefensePercent", "输入面板已含 A4 防御百分比（小数）") +
    number("includedA4ElementalMastery", "输入面板已含 A4 元素精通");
  const lunar = role === "ordinary" ? "" : number("specialBaseBonus", "月结晶基础提升输入总额（小数；含下项已计入份额）") +
    number("includedIntrinsicBaseBonus", "基础提升输入已含的本人固有提升（0–0.14）", { min: 0, max: 0.14 }) +
    number("reactionBonus", "本击适用的月结晶反应增伤（小数）") +
    number("specialAdditive", kind === "zibai-finite-spirit-steed-c0" ? "月结晶独立加算输入总额（含已计入的灵驹 A1）" : "本击适用的月结晶独立加算伤害（Q 不适用灵驹 A1）") +
    number("elevationMultiplier", "专属擢升总倍率（大于 0；明确没有才填 1）") +
    (kind === "zibai-finite-spirit-steed-c0" ? state(`${key}.a1WindowActive`, "第二段结算时本人 A1 的实际 4 秒窗口有效", values.a1WindowActive) + number("includedA1Additive", "特殊加算输入已含的灵驹 A1 伤害") : "");
  return `<h5>本击 A4 与面板已含份额</h5><div class="calculator-fields">${a4}</div>${lunar ? `<h5>第二段直接月结晶的实际加成</h5><div class="calculator-fields">${lunar}</div>` : ""}`;
}

/** Observed finite casts and independent actual hits use the same source context. */
export function renderZibaiFiniteControls(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context: Context = document.gameContext!.zibaiFiniteCast ?? {}, complete = document.scope !== "single-hit";
  const template = zibaiFiniteTemplates.find(cast => cast.skillId === kind);
  const schedule = complete ? compileZibaiFiniteSchedule(kind, context) : undefined;
  const common = (complete ? textField("casterId", "施放者标识", context.casterId) + textField("targetId", "本次所选敌人标识", context.targetId) +
    state("legalCastConfirmed", "本次重施或 Q 已经合法发生", context.legalCastConfirmed) +
    state("fullObservedLifetime", "已完整观察本次两段及其交付结束", context.fullObservedLifetime) +
    numberField("observedThroughFrame", "实际观察终点（相对本次起手帧）", context.observedThroughFrame, { min: 0, integer: true }) +
    state("statsStableAcrossHits", "两段的共同面板与装备保持稳定", context.statsStableAcrossHits) : "") +
    (kind === "zibai-finite-spirit-steed-c0" ? state("spiritSteedRecastConfirmed", "本次是已合法发生的灵驹重施", context.spiritSteedRecastConfirmed) : "");
  const summary = schedule ? `<p class="calculator-hint">已应用 ${schedule.candidates.length} 段观察记录，实际接触 ${schedule.instances.length} 段。${schedule.issues.length ? `尚需补齐：${schedule.issues.map(esc).join("；")}` : "本次两段观察与接触记录完整。"}</p>` : '<p class="calculator-hint">独立单击只使用本击事件、实际面板、目标和适用被动，不要求另一段或未来观察终点。可直接选择普通岩伤或月结晶段。</p>';
  return `<fieldset data-source-cast-controls="zibai-finite"><legend>兹白 C0 · ${esc(template?.label ?? kind)}</legend><div class="calculator-fields">${common}</div>${summary}<details open><summary>共同实际状态与已含份额</summary>${hitFields("sharedState", context.sharedState ?? {}, kind)}<p class="calculator-hint">共同值只供没有逐击覆盖的字段使用。A4 每位其他岩队友提供 15% 防御、水队友提供 60 精通；核心根据本击突破阶段判定是否解锁。固有月结晶基础提升按实际防御每 100 点增加 0.7%、至多 14%，单独记账。明确没有贡献才填 0；留空仍是未知。</p>${kind === "zibai-finite-spirit-steed-c0" ? '<p class="calculator-hint">A1 只用于灵驹第二段：实际 4 秒窗口内增加 0.6 × 本击防御的特殊加算伤害。重施合法不代表 A1 窗口自动有效；普通段不读取此项。</p>' : '<p class="calculator-hint">Q 两段均不应用灵驹 A1，不能把该项移入 Q 的特殊加算输入。</p>'}</details><details><summary>逐击实际状态覆盖</summary>${document.hits.filter(hit => hit.kind === "ordinary" || hit.kind === "special").map(hit => `<fieldset data-zibai-finite-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}</legend>${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, kind, hit.kind === "ordinary" ? "ordinary" : "lunar")}</fieldset>`).join("")}</details>${renderZibaiFiniteDraft(document)}<p class="calculator-hint">本协议只闭合一次已合法发生的灵驹重施或 Q 的有限两段。实际时刻由观察提供；不推测动作帧、ICD、粒子、取消窗或姿态资源。Q 对隙中月的 1.7 秒延长属于外部姿态状态。固定来源公式为 provisional，不代表整个 E 姿态或自动团队能力已完成。</p></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { observationsKnown: boolean; observations: Row[]; independentKnown: boolean; independent: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const ZIBAI_FINITE_DRAFT_FIELD = "gameContext.zibaiFiniteCast.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终普通增伤（小数）"], ["additiveBaseDamage", "普通独立加算基伤"], ["reactionBonus", "普通反应增伤（小数）"],
];
const toRow = (value: Record<string, unknown>): Row => Object.fromEntries(Object.entries(value).map(([key, field]) => [key, String(field)]));
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.zibaiFiniteCast;
  const draft: Draft = {
    observationsKnown: context?.observations !== undefined,
    observations: (["ordinary", "lunar"] as const).map((role, index) => {
      const event = context?.observations?.[index], contact = event ? context?.targetContacts?.[event.candidateId] : undefined;
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
const input = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-zibai-finite-draft-input data-zibai-finite-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
const booleanInput = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<select data-zibai-finite-draft-input data-zibai-finite-draft-key="${esc(key)}"><option value="">未知；需明确</option><option value="false"${value === "false" ? " selected" : ""}>否</option><option value="true"${value === "true" ? " selected" : ""}>是</option></select></label>`;
function eventFields(row: Row, kind: Kind, fixedRole?: Role): string {
  const template = zibaiFiniteTemplates.find(cast => cast.skillId === kind);
  const role = fixedRole ? `<input type="hidden" data-zibai-finite-draft-key="templateRole" value="${fixedRole}"><p>${esc(template?.roles[fixedRole].label ?? fixedRole)}</p>` : `<label>本击伤害段<select data-zibai-finite-draft-input data-zibai-finite-draft-key="templateRole"><option value="">未知；选择实际伤害段</option>${(["ordinary", "lunar"] as const).map(key => `<option value="${key}"${row.templateRole === key ? " selected" : ""}>${esc(template?.roles[key].label ?? key)}</option>`).join("")}</select></label>`;
  return `${role}<div class="calculator-fields">${input("candidateId", "实际事件标识", row.candidateId)}${input("frame", "实际交付帧（相对本次起手）", row.frame, true, 'min="0"')}${input("snapshotFrame", "实际进攻面板取样帧", row.snapshotFrame, true, 'min="0"')}${input("snapshotId", "实际取样标识", row.snapshotId)}${input("targetId", "所选敌人标识", row.targetId)}${fixedRole ? booleanInput("contact", "本段是否实际接触所选敌人", row.contact) : ""}</div>`;
}

export function renderZibaiFiniteDraft(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context = document.gameContext!.zibaiFiniteCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const events = complete ? `<details open><summary>本次完整两段的实际观察</summary><label>两段记录<select data-zibai-finite-draft-input data-zibai-finite-observations-known><option value="unknown"${draft.observationsKnown ? "" : " selected"}>尚未完整提供</option><option value="provided"${draft.observationsKnown ? " selected" : ""}>已提供下面两段实际记录</option></select></label><p class="calculator-hint">按已固定的伤害身份依次填写普通岩伤与月结晶。帧数、取样和接触来自本次观察；没有默认动画帧。落空仍保留本段交付记录并明确选择未接触，两段可分别使用历史最终快照。</p>${(["ordinary", "lunar"] as const).map((role, index) => `<fieldset data-zibai-finite-observation-row="${index}"><legend>第 ${index + 1} 段</legend>${eventFields(draft.observations[index] ?? {}, kind, role)}</fieldset>`).join("")}</details>` : `<details open><summary>直接计算一记实际来源命中</summary><label>独立本击事件<select data-zibai-finite-draft-input data-zibai-finite-independent-known><option value="unknown"${draft.independentKnown ? "" : " selected"}>未提供新事件；沿用已保存本击</option><option value="provided"${draft.independentKnown ? " selected" : ""}>提供或编辑这记实际命中</option></select></label><div data-zibai-finite-independent-row>${eventFields(draft.independent, kind)}</div><p class="calculator-hint">这里记录已经实际命中的一段，普通与月结晶均可单独选择。只需本击进攻取样和目标，不要求另一段的时刻、接触、完整观察或整支队伍。灵驹第二段仍须明确本击 A1 窗口及已含份额。</p></details>`;
  const ids = [...new Set([...Object.keys(context.snapshots ?? {}), ...(complete ? draft.observations : [draft.independent]).map(row => row.snapshotId?.trim()).filter((id): id is string => Boolean(id)), ...document.hits.flatMap(hit => (hit.kind === "ordinary" || hit.kind === "special") && hit.zibaiFiniteEvent ? [hit.zibaiFiniteEvent.snapshotId] : [])])];
  const snapshots = `<details><summary>实际历史最终快照 · ${draft.snapshots.length} 份</summary><p class="calculator-hint">为真实历史数值添加快照并填写来源。完整两段面板不稳定时，应分别提供取样标识对应的快照；独立单击可直接使用已还原的当前面板。历史最终快照须已包含当时 A4 与装备派生属性，不能复制当前装备冒充历史。月结晶的基础提升、独立加算及其已含份额使用上方状态输入；普通增伤不会进入月结晶乘区。</p>${draft.snapshots.map((row, index) => `<fieldset data-zibai-finite-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-zibai-finite-draft-input data-zibai-finite-draft-key="id" value="${esc(row.id)}" list="zibai-finite-snapshot-identifiers" placeholder="与本击取样标识一致"></label>${snapshotFields.map(([key, label, min, max]) => input(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${input("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-zibai-finite-draft-input data-zibai-finite-draft-key="sourceRefs" rows="2" placeholder="明确记录或来源链接">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="zibai-finite-remove-snapshot" data-zibai-finite-row-index="${index}">删除此快照</button></fieldset>`).join("")}<datalist id="zibai-finite-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="zibai-finite-add-snapshot">添加实际历史快照</button></details>`;
  return `<div data-zibai-finite-editor>${events}${snapshots}<p data-zibai-finite-draft-status role="status" class="calculator-hint">${draft.dirty ? "本击事件、两段记录或快照草稿尚未应用；请应用后再计算或导出。" : "实际事件与快照没有未应用编辑。"}</p><button type="button" data-action="zibai-finite-apply">应用实际事件与快照</button><button type="button" data-action="zibai-finite-reset">放弃未应用编辑</button></div>`;
}

export function captureZibaiFiniteDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRows = (kind: string): Row[] => [...root.querySelectorAll<HTMLElement>(`[data-zibai-finite-${kind}-row]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-zibai-finite-draft-key]")].map(control => [control.dataset.zibaiFiniteDraftKey!, control.value])));
  const observations = root.querySelector<HTMLSelectElement>("[data-zibai-finite-observations-known]");
  if (observations) { draft.observationsKnown = observations.value === "provided"; draft.observations = readRows("observation"); }
  const independent = root.querySelector<HTMLSelectElement>("[data-zibai-finite-independent-known]");
  if (independent) { draft.independentKnown = independent.value === "provided"; draft.independent = readRows("independent")[0] ?? {}; }
  draft.snapshots = readRows("snapshot").map((row, index) => {
    const previous = draft.snapshots[index];
    if (previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin;
    return row;
  });
  draft.dirty = true;
}
export function editZibaiFiniteDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureZibaiFiniteDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "zibai-finite-add-snapshot") draft.snapshots.push({});
  else if (button.dataset.action === "zibai-finite-remove-snapshot") draft.snapshots.splice(Number(button.dataset.zibaiFiniteRowIndex), 1);
}
export function applyZibaiFiniteDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureZibaiFiniteDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.zibaiFiniteCast ?? {});
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
    next.observations = draft.observations.map((row, index) => event(row, `第 ${index + 1} 段的`));
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
  const parsed = zibaiFiniteCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`兹白实际事件或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.zibaiFiniteCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetZibaiFiniteDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasZibaiFiniteDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
