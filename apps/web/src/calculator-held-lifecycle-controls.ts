import { compileHeldLifecycleSchedule, heldLifecycleCastContextSchema, HELD_LIFECYCLE_CAST_KINDS, type CalculatorDocument, type HeldLifecycleCastKind } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.heldLifecycleCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, min = 0, max?: number, integer = false): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知" min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const roleLabels: Record<string, string> = { periodic: "周期攻击", explosion: "火转化爆炸", dewdrop: "露滴", torrent: "激流", arkhe: "灵息之刺", bubble: "浮水泡沫", blazing: "焰火之环", initial: "初击", scorching: "炽火之槛", spin: "旋转攻击", finisher: "终结一击" };

type DraftRow = Record<string, string>;
type Draft = { damageEvents: DraftRow[]; damageEventsKnown: boolean; hpRatios: string[]; hpRatiosKnown: boolean; snapshots: string; dirty: boolean };
type Field = { key: string; label: string; kind?: "number" | "boolean"; options?: ReadonlyArray<readonly [string, string]> };
const eventFields: readonly Field[] = [
  { key: "id", label: "事件标识" }, { key: "frame", label: "实际伤害帧", kind: "number" },
  { key: "actorId", label: "伤害来源角色标识" }, { key: "targetId", label: "受击目标标识" },
  { key: "tag", label: "实际伤害类型", options: [["normal", "普通攻击"], ["charged", "重击"], ["plunge", "下落攻击"], ["skill", "元素战技"], ["skill-hold", "长按元素战技"], ["burst", "元素爆发"], ["electro-charged", "感电"], ["burning", "燃烧"], ["hydro-swirl", "水扩散"], ["other", "其他"]] },
  { key: "damagePositive", label: "实际伤害大于零", kind: "boolean" },
  { key: "origin", label: "事件来源", options: [["external", "本次施放之外"], ["this-cast", "本次施放（不作外部触发）"]] },
];
const drafts = new Map<string, Draft>();
export const HELD_LIFECYCLE_DRAFT_FIELD = "gameContext.heldLifecycleCast.scheduleDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext ? `${document.gameContext.characterId}/${document.gameContext.variantId ?? ""}/${document.gameContext.skillId}` : document.id}`;

function getDraft(document: CalculatorDocument): Draft {
  const key = keyFor(document), saved = drafts.get(key);
  if (saved?.dirty) return saved;
  const context = document.gameContext?.heldLifecycleCast;
  const draft: Draft = {
    damageEvents: context?.pyro?.damageEvents?.map(event => Object.fromEntries(Object.entries(event).map(([key, value]) => [key, String(value)]))) ?? [],
    damageEventsKnown: context?.pyro?.damageEvents !== undefined,
    hpRatios: context?.hydroHold?.hpRatiosBeforeDewdrops?.map(String) ?? [],
    hpRatiosKnown: context?.hydroHold?.hpRatiosBeforeDewdrops !== undefined,
    snapshots: context?.snapshots ? JSON.stringify(context.snapshots, null, 2) : "", dirty: false,
  };
  drafts.set(key, draft); return draft;
}

function rowField(field: Field, value: string | undefined): string {
  const attrs = `data-held-draft-key="${field.key}"`;
  if (field.kind === "boolean" || field.options) {
    const options = field.kind === "boolean" ? [["false", "否"], ["true", "是"]] : field.options!;
    return `<label>${esc(field.label)}<select ${attrs}><option value="">未知；留空</option>${options.map(([key, label]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
  }
  return `<label>${esc(field.label)}<input ${attrs} type="text" value="${esc(value)}" placeholder="未知；留空"${field.kind === "number" ? ' inputmode="numeric"' : ""}></label>`;
}

export function renderHeldLifecycleDraft(document: CalculatorDocument): string {
  const draft = getDraft(document), skill = document.gameContext?.skillId ?? "";
  const hydro = skill.includes("-hydro-skill-"), pyro = skill.includes("-pyro-skill-hold-");
  return `<div data-held-lifecycle-editor><p class="calculator-hint">全部日程帧数相对本次起点。下列列表及快照编辑后需点击「应用持续动作记录」；空白保持未知。修改发射次数、飞行时间或持续条件后也可点击此按钮刷新接触表。</p>${hydro ? `<details open><summary>每枚露滴取样前的实际生命比例</summary><label>生命记录是否完整提供<select data-held-hp-known><option value="unknown"${!draft.hpRatiosKnown ? " selected" : ""}>未知</option><option value="provided"${draft.hpRatiosKnown ? " selected" : ""}>已提供</option></select></label><p class="calculator-hint">每枚露滴各填一个 0–0.5 的实际比例，无充盈分支不把起始生命复制成全部历史。按已填发射次数创建输入行，已有对应值保留。</p><button type="button" data-action="held-lifecycle-hp-sync">按发射次数更新生命输入行</button><div class="calculator-fields">${draft.hpRatios.map((value, index) => `<label>第 ${index + 1} 枚露滴取样前生命比例<input type="text" inputmode="decimal" data-held-hp-index="${index}" value="${esc(value)}" placeholder="未知"></label>`).join("")}</div></details>` : ""}${pyro ? `<details open><summary>完整外部敌人受伤事件 · ${draft.damageEvents.length} 条</summary><label>事件列表是否已提供<select data-held-events-known><option value="unknown"${!draft.damageEventsKnown ? " selected" : ""}>未知</option><option value="provided"${draft.damageEventsKnown ? " selected" : ""}>已提供（零条表示明确没有外部事件）</option></select></label><p class="calculator-hint">记录真实伤害事件；本次长按初击单独填写，下方不重复添加。燃烧、水扩散、零伤害和冷却内事件由核心判定，不手动删成最大追击次数。相同帧的外部事件按所填顺序保留。</p>${draft.damageEvents.map((row, index) => `<fieldset data-held-draft-row="${index}"><legend>外部伤害 ${index + 1}</legend><div class="calculator-fields">${eventFields.map(field => rowField(field, row[field.key])).join("")}</div><button type="button" data-action="held-lifecycle-event-remove" data-held-row-index="${index}">删除此条</button></fieldset>`).join("")}<button type="button" data-action="held-lifecycle-event-add">添加外部伤害事件</button></details>` : ""}<details><summary>按取样标识提供历史最终快照（高级）</summary><label>快照标识到最终快照的 JSON 对象<textarea data-held-snapshots rows="10" spellcheck="false" placeholder="未知；留空">${esc(draft.snapshots)}</textarea></label><p class="calculator-hint">对象键采用下方接触表的快照标识。每份快照须含 stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs；逐击实际被动与已含份额另填，不能用当前面板补造历史。</p></details><p data-held-draft-status role="status" class="calculator-hint">${draft.dirty ? "持续动作草稿尚未应用；请应用后再计算或导出。" : "当前记录已应用。"}</p><button type="button" data-action="held-lifecycle-apply">应用持续动作记录</button><button type="button" data-action="held-lifecycle-reset">放弃未应用的编辑</button></div>`;
}

export function renderHeldLifecycleCastControls(document: CalculatorDocument): string {
  const context = document.gameContext?.heldLifecycleCast, skill = document.gameContext?.skillId ?? "";
  if (!context || !(HELD_LIFECYCLE_CAST_KINDS as readonly string[]).includes(skill)) return "";
  const schedule = compileHeldLifecycleSchedule(skill as HeldLifecycleCastKind, context);
  const dendro = skill.includes("-dendro-"), hydroHold = skill.includes("-hydro-skill-"), pyro = skill.includes("-pyro-skill-"), noelle = skill.includes("-noelle-");
  let branch = "";
  if (dendro) branch = numberField("dendro.pyroTransformFrame", "首次火转化实际帧（本分支 55–90）", context.dendro?.pyroTransformFrame, 55, 90, true) + state("dendro.pyroApplicationConfirmed", "火附着实际作用于草灯莲并完成转化", context.dendro?.pyroApplicationConfirmed) + state("dendro.firstTransformationConfirmed", "此前没有水／雷转化，此次是首次转化", context.dendro?.firstTransformationConfirmed);
  if (hydroHold) branch = numberField("hydroHold.dewdropCount", "本次实际发出的露滴数量", context.hydroHold?.dewdropCount, 1, 22, true) + numberField("hydroHold.travelFrames", "露滴实际飞行参数帧数", context.hydroHold?.travelFrames, 0, 100000, true) + state("hydroHold.arkheReady", "本次灵息之刺独立冷却可用", context.hydroHold?.arkheReady) + state("hydroHold.noHealingOrDropletPickup", "期间无治疗、源水之滴拾取或生命上限变化", context.hydroHold?.noHealingOrDropletPickup) + numberField("hydroHold.priorA4Bonus", "前次施放遗留的 A4 激流附加值（本分支须为 0）", context.hydroHold?.priorA4Bonus);
  if (pyro) branch = numberField("pyro.initialNightsoulPoints", "起手前遗留夜魂值（全新分支须为 0）", context.pyro?.initialNightsoulPoints) + state("pyro.noExternalPointChanges", "全程无额外夜魂补充、消耗或延长", context.pyro?.noExternalPointChanges) + (skill.includes("-hold-") ? state("pyro.initialDamagePositive", "长按初击实际对任意敌人造成非零伤害", context.pyro?.initialDamagePositive) : "");
  if (noelle) branch = numberField("noelle.spinCount", "实际连续旋转次数（另含终结一击）", context.noelle?.spinCount, 1, 11, true) + state("noelle.startsFromIdle", "从静止状态起手", context.noelle?.startsFromIdle) + numberField("noelle.attackSpeedBonus", "攻击速度加成（本分支须为 0）", context.noelle?.attackSpeedBonus, -1) + numberField("noelle.initialStamina", "起手实际体力", context.noelle?.initialStamina) + numberField("noelle.staminaCostMultiplier", "实际重击体力消耗倍率（本分支须为 1）", context.noelle?.staminaCostMultiplier) + state("noelle.noExternalStaminaChanges", "期间无外部体力变化", context.noelle?.noExternalStaminaChanges) + numberField("noelle.sourceCastFrame", "来源运行中的绝对起手帧（连续旋转须大于 0）", context.noelle?.sourceCastFrame, 0, 100000, true);
  const hitFields = (key: string, values: NonNullable<typeof context.sharedState> = {}): string => dendro
    ? numberField(`${key}.actualElementalMasteryAtHit`, "伤害命中时旅行者的实际元素精通（非草灯莲建立时精通）", values.actualElementalMasteryAtHit) + numberField(`${key}.includedDamageBonus`, "输入增伤已含本击 A4 的份额（小数）", values.includedDamageBonus)
    : numberField(`${key}.hydroHpFractionBeforeHit`, "独立露滴取样前实际生命比例（无充盈：0–0.5）", values.hydroHpFractionBeforeHit, 0, 1) + numberField(`${key}.hydroTorrentSuffusionBonus`, "独立激流已知充盈附加值（本分支须为 0）", values.hydroTorrentSuffusionBonus);
  return `<fieldset data-source-cast-controls="held-lifecycle"><legend>持续动作：实际接触与取样记录</legend><p class="calculator-hint">完整施放按照明确记录生成实际命中集合。每个候选攻击分别选择命中或落空，未知不会当作零或最大命中。独立单击只要求该击相关条件。</p><div class="calculator-fields">${state("statsStableAcrossHits", "除逐击覆盖外，面板、装备、反应属性与目标条件稳定", context.statsStableAcrossHits)}${noelle ? state("noelle.burstInactive", "相关命中期间大扫除未激活", context.noelle?.burstInactive) + state("noelle.shieldInactive", "相关命中期间护心铠未激活", context.noelle?.shieldInactive) : ""}</div><details${document.scope === "one-cast" ? " open" : ""}><summary>完整施放日程条件（单击不依赖未选后续）</summary><div class="calculator-fields">${textField("casterId", "施放者标识（与事件来源一致）", context.casterId) + textField("targetId", "计算目标标识", context.targetId) + state("freshCastConfirmed", "全新施放，无旧实体、状态或冷却遗留", context.freshCastConfirmed) + state("noHitlag", "全程无卡肉延长", context.noHitlag) + state("noInterruption", "没有中断或提前取消所需攻击", context.noInterruption) + state("noReplacement", "没有重放、替换、死亡或额外重置", context.noReplacement) + state("fullObservedLifetime", "记录覆盖完整持续过程及末次攻击命中／落空", context.fullObservedLifetime) + numberField("observedThroughFrame", "已观察至本次施放后的第几帧", context.observedThroughFrame, 0, 100000, true) + branch}</div>${renderHeldLifecycleDraft(document)}<details open><summary>逐次实际接触 · ${schedule.candidates.length} 个来源候选</summary><p class="calculator-hint">当前核心要求至少观察至第 ${schedule.requiredObservedThroughFrame} 帧。修改日程参数后应用记录以刷新本表。草灯莲火转化只开放第 55–90 帧的已审分支；其他动作使用各自固定来源条件。</p>${schedule.candidates.length ? `<div class="table-wrap"><table><thead><tr><th>候选／角色</th><th>命中帧</th><th>取样标识／帧</th><th>实际接触</th></tr></thead><tbody>${schedule.candidates.map(candidate => `<tr><td>${esc(candidate.id)} · ${esc(roleLabels[candidate.templateRole] ?? candidate.templateRole)}</td><td>${candidate.frame}</td><td>${esc(candidate.snapshotId)} · ${candidate.snapshotFrame}</td><td>${state(`targetContacts.${candidate.id}`, "是否实际命中所选目标", candidate.contact)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="calculator-hint">补充此动作的发射、转化或旋转条件后，核心将列出候选攻击。</p>'}</details>${schedule.decisions.length ? `<details><summary>来源状态判定</summary><ul>${schedule.decisions.map(decision => `<li>${esc(decision.eventId)} · 第 ${decision.frame} 帧：${esc(decision.reason)}</li>`).join("")}</ul></details>` : ""}</details>${dendro || hydroHold ? `<details open><summary>共同实际状态与被动记账</summary><div class="calculator-fields">${hitFields("sharedState", context.sharedState)}</div><p class="calculator-hint">只在明确稳定且没有独立历史快照时采用共同值；逐击填写的字段覆盖共同值。生命比例／充盈值只作用于对应露滴／激流，不要求无关灵息之刺的这些条件。</p></details><details><summary>逐击实际状态覆盖</summary>${document.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</legend><div class="calculator-fields">${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id])}</div></fieldset>`).join("")}</details>` : ""}</fieldset>`;
}

export function captureHeldLifecycleDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document), eventsKnown = root.querySelector<HTMLSelectElement>("[data-held-events-known]"), hpKnown = root.querySelector<HTMLSelectElement>("[data-held-hp-known]");
  if (eventsKnown) {
    draft.damageEventsKnown = eventsKnown.value === "provided";
    draft.damageEvents = [...root.querySelectorAll<HTMLElement>("[data-held-draft-row]")].map(row => ({ ...draft.damageEvents[Number(row.dataset.heldDraftRow)], ...Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-held-draft-key]")].map(input => [input.dataset.heldDraftKey!, input.value])) }));
  }
  if (hpKnown) { draft.hpRatiosKnown = hpKnown.value === "provided"; draft.hpRatios = [...root.querySelectorAll<HTMLInputElement>("[data-held-hp-index]")].map(input => input.value); }
  const snapshots = root.querySelector<HTMLTextAreaElement>("[data-held-snapshots]");
  if (snapshots) draft.snapshots = snapshots.value;
  draft.dirty = true;
}

export function editHeldLifecycleDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureHeldLifecycleDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "held-lifecycle-event-remove") draft.damageEvents.splice(Number(button.dataset.heldRowIndex), 1);
  else if (button.dataset.action === "held-lifecycle-event-add") {
    let index = draft.damageEvents.length + 1;
    while (draft.damageEvents.some(row => row.id === `event-${index}`)) index++;
    draft.damageEvents.push({ id: `event-${index}` }); draft.damageEventsKnown = true;
  } else if (button.dataset.action === "held-lifecycle-hp-sync") {
    const count = document.gameContext?.heldLifecycleCast?.hydroHold?.dewdropCount;
    if (!Number.isInteger(count) || count! < 1 || count! > 22) throw new Error("请先填写本次实际发出的 1–22 枚露滴数量。");
    draft.hpRatios = Array.from({ length: count! }, (_, index) => draft.hpRatios[index] ?? ""); draft.hpRatiosKnown = true;
  }
}

export function applyHeldLifecycleDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureHeldLifecycleDraft(document, root);
  const context = document.gameContext?.heldLifecycleCast;
  if (!context) return;
  const draft = getDraft(document), next = structuredClone(context);
  if (root.querySelector("[data-held-events-known]")) {
    next.pyro ??= {};
    if (!draft.damageEventsKnown) delete next.pyro.damageEvents;
    else next.pyro.damageEvents = draft.damageEvents.map((row, index) => {
      const parsed: Record<string, unknown> = { ...row };
      for (const [key, value] of Object.entries(parsed)) if (value === "") delete parsed[key];
      for (const field of eventFields) {
        const value = row[field.key]?.trim();
        if (!value) { delete parsed[field.key]; continue; }
        if (field.kind === "number") {
          const numeric = Number(value);
          if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error(`外部伤害 ${index + 1}：${field.label}须为非负整数。`);
          parsed[field.key] = numeric;
        } else parsed[field.key] = field.kind === "boolean" ? value === "true" : value;
      }
      // Optional untouched fields from imported records keep their original types.
      for (const key of ["inRange"] as const) if (typeof parsed[key] === "string") parsed[key] = parsed[key] === "true";
      return parsed;
    }) as NonNullable<typeof next.pyro.damageEvents>;
  }
  if (root.querySelector("[data-held-hp-known]")) {
    next.hydroHold ??= {};
    if (!draft.hpRatiosKnown) delete next.hydroHold.hpRatiosBeforeDewdrops;
    else next.hydroHold.hpRatiosBeforeDewdrops = draft.hpRatios.map((value, index) => {
      const numeric = Number(value);
      if (!value.trim() || !Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new Error(`第 ${index + 1} 枚露滴需要明确的 0–1 生命比例；无充盈资格由核心检查。`);
      return numeric;
    });
  }
  if (!draft.snapshots.trim()) delete next.snapshots;
  else { try { next.snapshots = JSON.parse(draft.snapshots); } catch { throw new Error("历史快照集合不是有效的 JSON；请修正后应用。"); } }
  const parsed = heldLifecycleCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`持续动作字段不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext!.heldLifecycleCast = parsed.data;
  drafts.delete(keyFor(document));
}

export function resetHeldLifecycleDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasHeldLifecycleDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
