import { coordinatedCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
type Collection = "normalStates" | "damageEvents";
type DraftRow = Record<string, string>;
type Draft = { normalStates: DraftRow[]; damageEvents: DraftRow[]; normalStatesKnown: boolean; damageEventsKnown: boolean; snapshot: string; snapshots: string; dirty: boolean };
type Field = { key: string; label: string; kind?: "number" | "boolean"; options?: ReadonlyArray<readonly [string, string]> };
const drafts = new Map<string, Draft>();
export const COORDINATED_SCHEDULE_DRAFT_FIELD = "gameContext.coordinatedCast.scheduleDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext ? `${document.gameContext.characterId}/${document.gameContext.variantId ?? ""}/${document.gameContext.skillId}` : document.id}`;
const normalFields: readonly Field[] = [
  { key: "id", label: "状态标识" }, { key: "startFrame", label: "开始帧（包含）", kind: "number" },
  { key: "endFrame", label: "结束帧（不包含）", kind: "number" }, { key: "actorId", label: "普攻角色标识" },
  { key: "onField", label: "该角色实际在场", kind: "boolean" }, { key: "animationStartDelayFrames", label: "动作触发延迟帧", kind: "number" },
  { key: "firstNormalInChain", label: "连段的第一段普攻", kind: "boolean" },
];
const damageFields: readonly Field[] = [
  { key: "id", label: "事件标识" }, { key: "frame", label: "命中帧", kind: "number" },
  { key: "actorId", label: "伤害来源角色标识" }, { key: "activeActorId", label: "当时在场角色标识" },
  { key: "tag", label: "实际伤害类型", options: [["normal", "普通攻击"], ["charged", "重击"], ["plunge", "下落攻击"], ["skill", "元素战技"], ["skill-hold", "长按元素战技"], ["burst", "元素爆发"], ["electro-charged", "感电"], ["burning", "燃烧"], ["hydro-swirl", "水扩散"], ["other", "其他"]] },
  { key: "damagePositive", label: "实际伤害大于零", kind: "boolean" }, { key: "targetId", label: "受击目标标识" },
  { key: "inRange", label: "满足此技能的目标／范围条件", kind: "boolean" },
  { key: "strikeType", label: "伤害判定类型", options: [["slash", "斩击"], ["other", "其他"]] },
  { key: "sourceAbility", label: "技能来源名称（需要时填写）" },
  { key: "origin", label: "伤害事件来源", options: [["external", "来自本次施放之外"], ["this-cast", "来自本次施放"]] },
];

function getDraft(document: CalculatorDocument): Draft {
  const key = keyFor(document), saved = drafts.get(key);
  if (saved?.dirty) return saved;
  const context = document.gameContext?.coordinatedCast;
  const row = (value: object): DraftRow => Object.fromEntries(Object.entries(value).map(([key, value]) => [key, String(value)]));
  const draft: Draft = {
    normalStates: context?.normalStates?.map(row) ?? [], damageEvents: context?.damageEvents?.map(row) ?? [],
    normalStatesKnown: context?.normalStates !== undefined, damageEventsKnown: context?.damageEvents !== undefined,
    snapshot: context?.dehyaPriorSnapshot ? JSON.stringify(context.dehyaPriorSnapshot, null, 2) : "",
    snapshots: context?.snapshots ? JSON.stringify(context.snapshots, null, 2) : "", dirty: false,
  };
  drafts.set(key, draft);
  return draft;
}

function rowField(field: Field, value: string | undefined): string {
  const attrs = `data-coordinated-draft-key="${field.key}"`;
  if (field.kind === "boolean" || field.options) {
    const options = field.kind === "boolean" ? [["false", "否"], ["true", "是"]] : field.options!;
    return `<label>${esc(field.label)}<select ${attrs}><option value="">未知；留空</option>${options.map(([key, label]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
  }
  return `<label>${esc(field.label)}<input ${attrs} type="text" value="${esc(value)}" placeholder="未知；留空"${field.kind === "number" ? ' inputmode="numeric"' : ""}></label>`;
}

function collectionControls(name: Collection, draft: Draft): string {
  const label = name === "normalStates" ? "普攻动画状态" : "实际伤害事件", fields = name === "normalStates" ? normalFields : damageFields;
  return `<details${name === "normalStates" ? " open" : ""}><summary>${label} · ${draft[name].length} 条</summary><label>此列表是否已明确提供<select data-coordinated-collection-known="${name}"><option value="unknown"${!draft[`${name}Known`] ? " selected" : ""}>未知</option><option value="provided"${draft[`${name}Known`] ? " selected" : ""}>已提供（零条表示明确没有事件）</option></select></label><p class="calculator-hint">${name === "normalStates" ? "记录真实普攻动画区间，不以普攻命中次数代替。连续停留在同一状态也可能触发后续检查。" : "记录真实命中及当时资格。未通过触发条件或冷却的事件不会被当作新的追击。"}</p>${draft[name].map((row, index) => `<fieldset data-coordinated-draft-row="${name}" data-coordinated-row-index="${index}"><legend>${label} ${index + 1}</legend><div class="calculator-fields">${fields.map(field => rowField(field, row[field.key])).join("")}</div><button type="button" data-action="source-cast-schedule-remove" data-coordinated-collection="${name}" data-coordinated-row-index="${index}">删除此条</button></fieldset>`).join("")}<button type="button" data-action="source-cast-schedule-add" data-coordinated-collection="${name}">添加${label}</button></details>`;
}

export function renderCoordinatedSchedule(document: CalculatorDocument): string {
  const draft = getDraft(document), skill = document.gameContext?.skillId ?? "";
  const normal = /coordinated-(xingqiu|yelan|thoma)-/.test(skill), damage = !/coordinated-(xingqiu|thoma|fischl)-/.test(skill);
  const abilityHint = skill.includes("yelan") ? "夜兰自身 E 命中的技能来源名称填 Lingering Lifeline。" : skill.includes("albedo") ? "阿贝多初击的技能来源名称为 Abiogenesis: Solar Isotoma (Initial)，用于排除初击自触发；其他事件也需明确其技能来源。" : skill.includes("raiden") ? "雷神本人 E 来源事件需另行明确是否为斩击判定；实际伤害为零的事件不能触发追击。" : "";
  return `<div data-coordinated-schedule-editor><p class="calculator-hint">全部帧数相对于本次施放起点（第 0 帧）。编辑后点击「应用日程」更新命中集合；空白保留未知。日程条件完整不代表已自动生成团队轮转。修改有效期或弹道参数后，再应用一次日程以刷新逐击选择。${esc(abilityHint)}</p>${normal ? collectionControls("normalStates", draft) : ""}${damage ? collectionControls("damageEvents", draft) : ""}${skill.includes("dehya") && skill.includes("reposition") ? `<details><summary>前次领域的最终进攻快照</summary><label>历史快照 JSON<textarea data-coordinated-prior-snapshot rows="12" spellcheck="false" placeholder="未知；留空">${esc(draft.snapshot)}</textarea></label><p class="calculator-hint">填写前次领域建立时实际记录的完整最终快照：stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs。不得用当前面板补造历史快照。</p></details>` : ""}<details><summary>按取样时点提供历史最终快照（高级）</summary><label>快照标识到完整最终快照的 JSON 对象<textarea data-coordinated-snapshots rows="12" spellcheck="false" placeholder="未知；留空">${esc(draft.snapshots)}</textarea></label><p class="calculator-hint">使用下方生成命中表中的快照标识作为对象键。每份快照须含 stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs；逐击被动记账另填。只有明确稳定条件成立时才能沿用共同面板。</p></details><p data-coordinated-draft-status role="status" class="calculator-hint">${draft.dirty ? "日程草稿尚未应用；请应用后再计算或导出。" : "当前日程已应用。"}</p><button type="button" data-action="source-cast-schedule-apply">应用日程</button><button type="button" data-action="source-cast-schedule-reset">放弃未应用的编辑</button></div>`;
}

/** Drafts retain empty/invalid input until an explicit atomic apply. */
export function captureCoordinatedScheduleDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  for (const name of ["normalStates", "damageEvents"] as const) {
    const known = root.querySelector<HTMLSelectElement>(`[data-coordinated-collection-known="${name}"]`);
    if (!known) continue;
    draft[`${name}Known`] = known.value === "provided";
    draft[name] = [...root.querySelectorAll<HTMLElement>(`[data-coordinated-draft-row="${name}"]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-coordinated-draft-key]")].map(input => [input.dataset.coordinatedDraftKey!, input.value])));
  }
  const snapshot = root.querySelector<HTMLTextAreaElement>("[data-coordinated-prior-snapshot]");
  if (snapshot) draft.snapshot = snapshot.value;
  const snapshots = root.querySelector<HTMLTextAreaElement>("[data-coordinated-snapshots]");
  if (snapshots) draft.snapshots = snapshots.value;
  draft.dirty = true;
}

export function editCoordinatedScheduleDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureCoordinatedScheduleDraft(document, root);
  const draft = getDraft(document), collection = button.dataset.coordinatedCollection as Collection;
  if (collection !== "normalStates" && collection !== "damageEvents") return;
  if (button.dataset.action === "source-cast-schedule-remove") draft[collection].splice(Number(button.dataset.coordinatedRowIndex), 1);
  else {
    const prefix = collection === "normalStates" ? "normal" : "event";
    let index = draft[collection].length + 1;
    while (draft[collection].some(row => row.id === `${prefix}-${index}`)) index++;
    draft[collection].push({ id: `${prefix}-${index}` }); draft[`${collection}Known`] = true;
  }
}

export function applyCoordinatedScheduleDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureCoordinatedScheduleDraft(document, root);
  for (const input of root.querySelectorAll<HTMLInputElement>("[data-coordinated-draft-key]")) {
    if (input instanceof HTMLInputElement && !input.checkValidity()) throw new Error("日程中存在非法帧数；请使用非负整数，未知值请留空。");
  }
  const context = document.gameContext?.coordinatedCast;
  if (!context) return;
  const draft = getDraft(document), next: Record<string, unknown> = { ...context };
  for (const name of ["normalStates", "damageEvents"] as const) {
    if (!draft[`${name}Known`]) { delete next[name]; continue; }
    const fields = name === "normalStates" ? normalFields : damageFields;
    next[name] = draft[name].map((row, index) => {
      const parsedRow: Record<string, unknown> = {};
      for (const field of fields) {
        const value = row[field.key]?.trim();
        if (!value) continue;
        if (field.kind === "number") {
          const numeric = Number(value);
          if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error(`${name === "normalStates" ? "普攻状态" : "伤害事件"} ${index + 1}：${field.label}须为非负整数。`);
          parsedRow[field.key] = numeric;
        } else parsedRow[field.key] = field.kind === "boolean" ? value === "true" : value;
      }
      return parsedRow;
    });
  }
  if (!draft.snapshot.trim()) delete next.dehyaPriorSnapshot;
  else {
    try { next.dehyaPriorSnapshot = JSON.parse(draft.snapshot); }
    catch { throw new Error("前次领域快照不是有效的 JSON；请修正后应用。"); }
  }
  if (!draft.snapshots.trim()) delete next.snapshots;
  else {
    try { next.snapshots = JSON.parse(draft.snapshots); }
    catch { throw new Error("历史快照集合不是有效的 JSON；请修正后应用。"); }
  }
  const parsed = coordinatedCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`日程字段不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext!.coordinatedCast = parsed.data;
  drafts.delete(keyFor(document));
}

export function resetCoordinatedScheduleDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasCoordinatedScheduleDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
