import { compileTravelerCryoStateSchedule, travelerCryoStateCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["travelerCryoStateCast"]>;
type State = NonNullable<Context["sharedState"]>;
const path = (key: string): string => `gameContext.travelerCryoStateCast.${key}`;
const castOf = (document: CalculatorDocument): { kind: "skill" | "burst"; gender: "aether" | "lumine" } | undefined => {
  const match = /^(aether|lumine)-cryo-(skill|burst)-state-c0$/.exec(document.gameContext?.skillId ?? "");
  return match ? { kind: match[2] as "skill" | "burst", gender: match[1] as "aether" | "lumine" } : undefined;
};
const bool = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const num = (key: string, label: string, value: number | undefined, bounds = 'min="0"'): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="any" ${bounds}></label>`;
const text = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const radiances = [["none", "无辉映"], ["stellar-conduct", "星超导辉映"], ["stellar-swirl", "星扩散辉映"]] as const;
const radiance = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<select data-source-cast-enum-field="${esc(path(key))}"><option value="unknown">未知；需明确</option>${radiances.map(([id, name]) => `<option value="${id}"${value === id ? " selected" : ""}>${name}</option>`).join("")}</select></label>`;
const roles = { initial: "E 初击", crystal: "E 寒星冰晶", "burst-ordinary": "Q 普通冰伤投矛", "burst-conduct": "Q 直接星超导", "burst-swirl": "Q 直接星扩散" };
function stateFields(key: string, state: State): string {
  return `<div class="calculator-fields">${num(`${key}.nonExtraAtk`, "取样时实际非 Extra 攻击力", state.nonExtraAtk)}${num(`${key}.includedA4Em`, "该面板已含 A4 精通份额（0–160）", state.includedA4Em, 'min="0" max="160"')}${num(`${key}.impactAtk`, "特殊命中时实际攻击力（固有基础提升取样）", state.impactAtk)}${num(`${key}.polestarApplicationCount`, "本击实际极星领域应用次数（0–12）", state.polestarApplicationCount, 'min="0" max="12" step="1"')}${num(`${key}.otherSpecialBaseBonus`, "其他适用特殊基础提升（小数）", state.otherSpecialBaseBonus)}${num(`${key}.otherReactionBonus`, "其他适用特殊反应增伤（小数）", state.otherReactionBonus)}${num(`${key}.specialAdditive`, "明确适用特殊加算伤害", state.specialAdditive)}${num(`${key}.elevationMultiplier`, "专属擢升总倍率（无提升明确填 1）", state.elevationMultiplier, 'min="0"')}</div>`;
}
export function renderTravelerCryoStateControls(document: CalculatorDocument): string {
  const cast = castOf(document); if (!cast) return "";
  const context = document.gameContext!.travelerCryoStateCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = complete ? compileTravelerCryoStateSchedule(cast.kind, context, cast.gender) : undefined;
  const common = text("casterId", "实际施放者标识", context.casterId) + text("targetId", "所选敌人标识", context.targetId) + bool("noHitlag", "相关过程没有卡肉延长", context.noHitlag) + bool("trueMoonStoryBuffEnabled", "TrueMoon 剧情增益实际开启（本协议须明确关闭）", context.trueMoonStoryBuffEnabled) + num("travelFrames", `实际飞行帧（留空采用固定来源 ${cast.kind === "skill" ? 9 : 6} 帧）`, context.travelFrames, 'min="0" step="1"') + bool("statsStableAcrossHits", "所选命中可采用共同面板与装备取样", context.statsStableAcrossHits);
  const lifetime = complete ? bool("freshCastConfirmed", "本次为全新施放，没有旧输出或旧协同冷却遗留", context.freshCastConfirmed) + bool("noInterruption", "施放及实体没有提前中断", context.noInterruption) + bool("noReplacement", "未重施、替换、额外延长或重置", context.noReplacement) + bool("fullObservedLifetime", "已观察完整寿命及所有排出攻击的尾段", context.fullObservedLifetime) + num("observedThroughFrame", "实际观察到的末帧（相对起手）", context.observedThroughFrame, 'min="0" step="1"') : "";
  const specific = complete ? cast.kind === "skill" ? radiance("initialRadiance", "起手辉映状态", context.initialRadiance) + bool("radianceHistoryComplete", "辉映变化历史已完整观察", context.radianceHistoryComplete) + bool("callbacksComplete", "本人实际 N／CA／P 命中回调已完整观察", context.callbacksComplete) : radiance("radianceAtBurst", "第 36 帧构造攻击时实际锁定的辉映", context.radianceAtBurst) + num("frostglowStacksAtBurst", "第 36 帧实际消耗寒辉层数", context.frostglowStacksAtBurst, 'min="0" max="8" step="1"') : "";
  const candidates = schedule ? `<details open><summary>来源检查与实际接触 · ${schedule.candidates.length} 个候选</summary><p class="calculator-hint">完整观察至少覆盖 ${schedule.requiredObservedThroughFrame} 帧；候选并非保证命中。辉映切换不取消此前已排出的冰晶。</p><div class="table-wrap"><table><thead><tr><th>候选／分支</th><th>命中帧</th><th>取样</th><th>实际接触</th></tr></thead><tbody>${schedule.candidates.map(hit => `<tr><td>${esc(hit.id)} · ${esc(roles[hit.templateRole])}</td><td>${hit.frame}f</td><td>${hit.snapshotFrame}f · ${esc(hit.snapshotId)}</td><td>${bool(`targetContacts.${hit.id}`, "是否实际命中所选敌人", context.targetContacts?.[hit.id])}</td></tr>`).join("")}</tbody></table></div><ul>${schedule.decisions.map(decision => `<li>${decision.frame}f · ${esc(decision.eventId)}：${esc(decision.reason)}</li>`).join("")}</ul></details>` : '<p class="calculator-hint">独立单击只核对本击实际事件、触发资格和快照，不要求未来辉映、完整回调历史或未选命中的接触。</p>';
  return `<fieldset data-source-cast-controls="traveler-cryo-state"><legend>${cast.gender === "aether" ? "空" : "荧"} · 冰元素${cast.kind === "skill" ? "战技状态与实际协同" : "爆发普通／特殊伤害"}</legend><div class="calculator-fields">${common}${lifetime}${specific}</div>${candidates}<details open><summary>共同实际取样与已含份额</summary>${stateFields("sharedState", context.sharedState ?? {})}<p class="calculator-hint">普通与特殊分支都从真实共用构筑或历史面板进入各自共享公式。仅适用字段参与本击；没有提升时才明确填 0，不从最终攻击力猜非 Extra 攻击。星超导计数取本击真实应用次数。</p></details><details><summary>逐击实际状态覆盖</summary>${document.hits.map(hit => `<fieldset><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}</legend>${stateFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {})}</fieldset>`).join("")}</details>${renderTravelerCryoStateDraft(document)}<p class="calculator-hint">这是固定来源的已观察 C0 协议，保持暂定。N／CA／P 回调须有实际合法来源证据；这里不补造连段、起跳或空中状态，不表示自动团队动作已认证。</p></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { changesKnown: boolean; changes: Row[]; callbacksKnown: boolean; callbacks: Row[]; independentKnown: boolean; independent: Row; triggerKnown: boolean; trigger: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const TRAVELER_CRYO_STATE_DRAFT_FIELD = "gameContext.travelerCryoStateCast.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.skillId}`;
const snapshotFields = [["stats.atk", "最终攻击力"], ["stats.hp", "生命上限"], ["stats.def", "最终防御力"], ["stats.em", "元素精通"], ["stats.critRate", "最终暴击率"], ["stats.critDamage", "最终暴击伤害"], ["stats.energyRecharge", "充能效率（可留空）"], ["characterLevel", "角色等级"], ["ascension", "突破阶段"], ["damageBonus", "本击最终增伤"], ["additiveBaseDamage", "普通独立加算基伤"], ["reactionBonus", "反应增伤"]] as const;
function flatten(value: Record<string, unknown>): Row {
  const output: Row = {};
  for (const [key, field] of Object.entries(value)) if (field !== undefined) {
    if (field !== null && typeof field === "object" && !Array.isArray(field)) for (const [part, item] of Object.entries(field)) output[`${key}.${part}`] = String(item);
    else output[key] = String(field);
  }
  return output;
}
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.travelerCryoStateCast;
  const draft: Draft = { changesKnown: context?.radianceChanges !== undefined, changes: (context?.radianceChanges ?? []).map(flatten), callbacksKnown: context?.triggerCallbacks !== undefined, callbacks: (context?.triggerCallbacks ?? []).map(flatten), independentKnown: context?.independentEvent !== undefined, independent: flatten(context?.independentEvent ?? {}), triggerKnown: context?.independentEvent?.triggerEvidence !== undefined, trigger: flatten(context?.independentEvent?.triggerEvidence ?? {}), snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...flatten(snapshot), sourceRefs: snapshot.sourceRefs.join("\n") })), dirty: false };
  drafts.set(keyFor(document), draft); return draft;
}
const draftInput = (key: string, label: string, value: string | undefined, numeric = false): string => `<label>${esc(label)}<input data-traveler-cryo-state-draft-input data-cryo-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ' step="any"' : ""}></label>`;
const select = (key: string, label: string, value: string | undefined, choices: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-traveler-cryo-state-draft-input data-cryo-key="${esc(key)}"><option value="">未知；留空</option>${choices.map(([id, name]) => `<option value="${id}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
const yesNo = (key: string, label: string, row: Row): string => select(key, label, row[key], [["false", "否"], ["true", "是"]]);
const known = (key: string, label: string, provided: boolean): string => `<label>${esc(label)}<select data-traveler-cryo-state-draft-input data-cryo-known="${key}"><option value="unknown"${provided ? "" : " selected"}>未知／不提供</option><option value="provided"${provided ? " selected" : ""}>已完整提供（零条表示明确没有）</option></select></label>`;
const remove = (kind: string, index: number) => `<button type="button" data-action="traveler-cryo-state-remove-${kind}" data-cryo-index="${index}">删除此记录</button>`;
function callbackFields(row: Row): string {
  return draftInput("id", "真实回调标识", row.id) + draftInput("frame", "实际回调帧", row.frame, true) + draftInput("actorId", "实际来源角色标识", row.actorId) + draftInput("targetId", "实际命中敌人标识", row.targetId) + select("attackTag", "实际攻击类别", row.attackTag, [["normal", "普通攻击"], ["charged", "重击"], ["plunge", "下落攻击"]]) + select("airborneState", "下落的实际腾空状态（非下落可留空）", row.airborneState, [["xianyun", "闲云腾空"], ["other", "其他实际腾空"]]) + select("evidence.kind", "执行证据类型", row["evidence.kind"], [["observed-gameplay", "实际游戏观察"], ["pinned-gcsim-execution", "固定 gcsim 执行"], ["external-execution", "其他外部执行记录"]]) + draftInput("evidence.reference", "可追溯记录引用", row["evidence.reference"]) + yesNo("evidence.legalActionConfirmed", "本次来源动作已确认合法", row) + yesNo("evidence.actualEnemyHitConfirmed", "本次已确认实际命中敌人", row);
}
export function renderTravelerCryoStateDraft(document: CalculatorDocument): string {
  const cast = castOf(document); if (!cast) return "";
  const context = document.gameContext!.travelerCryoStateCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const event = draft.independent;
  const histories = complete && cast.kind === "skill" ? `<details open><summary>辉映变化记录</summary>${known("changes", "辉映变化数组", draft.changesKnown)}${draft.changes.map((row, index) => `<fieldset data-cryo-row="changes" data-cryo-index="${index}"><div class="calculator-fields">${draftInput("id", "变化标识", row.id)}${draftInput("frame", "变化帧", row.frame, true)}${select("radiance", "变化后的辉映", row.radiance, radiances)}${yesNo("beforeCallbacks", "与检查同帧时，是否在本帧所有检查之前", row)}</div>${remove("changes", index)}</fieldset>`).join("")}<button type="button" data-action="traveler-cryo-state-add-changes">添加辉映变化</button></details><details open><summary>实际本人命中回调</summary>${known("callbacks", "实际回调数组", draft.callbacksKnown)}<p class="calculator-hint">先填写实际发生的回调，核心再判断本人、辉映、739 帧寿命及 12 帧等号仍阻塞的冷却。固定 gcsim 不能认证空的下落；荧只实现闲云腾空分支。</p>${draft.callbacks.map((row, index) => `<fieldset data-cryo-row="callbacks" data-cryo-index="${index}"><div class="calculator-fields">${callbackFields(row)}</div>${remove("callbacks", index)}</fieldset>`).join("")}<button type="button" data-action="traveler-cryo-state-add-callbacks">添加实际回调</button></details>` : "";
  const independent = complete ? "" : `<details open><summary>直接计算一记实际来源命中</summary>${known("independent", "独立本击事件（未提供时保留既有命中）", draft.independentKnown)}<div class="calculator-fields" data-cryo-independent>${draftInput("candidateId", "实际来源候选标识", event.candidateId)}${select("templateRole", "实际伤害段", event.templateRole, Object.entries(roles))}${draftInput("frame", "实际命中帧", event.frame, true)}${draftInput("snapshotFrame", "实际取样帧", event.snapshotFrame, true)}${draftInput("snapshotId", "实际快照标识", event.snapshotId)}${draftInput("targetId", "实际命中敌人标识", event.targetId)}${select("radiance", "本击来源锁定的辉映", event.radiance, radiances)}${draftInput("frostglowStacks", "Q 实际消耗寒辉层数", event.frostglowStacks, true)}${draftInput("triggerId", "本击触发回调标识（协同）", event.triggerId)}${draftInput("triggerFrame", "本击实际触发／定时检查帧", event.triggerFrame, true)}${yesNo("skillActiveAtTrigger", "协同触发时 E 状态实际有效", event)}${yesNo("triggerIcdReady", "协同触发时冷却实际就绪", event)}</div>${known("trigger", "本次协同触发的独立证据", draft.triggerKnown)}<div class="calculator-fields" data-cryo-trigger>${callbackFields(draft.trigger)}</div><p class="calculator-hint">只填写所选伤害段所需字段：E 初击 initial；定时 periodic-检查序号-晶序号；协同 coordinated:回调标识；Q 为 burst-1 至 burst-5。Q 第 4／5 击需要实际 8 层寒辉。单击不要求未来事件。</p></details>`;
  const snapshotIds = complete ? [...new Set(compileTravelerCryoStateSchedule(cast.kind, context, cast.gender).candidates.map(hit => hit.snapshotId))] : [...new Set([...Object.keys(context.snapshots ?? {}), ...(event.snapshotId ? [event.snapshotId] : [])])];
  const snapshots = `<details><summary>逐次历史最终快照 · ${draft.snapshots.length} 条</summary><p class="calculator-hint">候选取样标识：${snapshotIds.map(esc).join("、") || "先提供本击事件或完整观察"}。面板稳定时可以使用上方共用构筑；变化的取样须提供对应历史最终面板、属性已含份额及来源。空白不会转为零。</p>${draft.snapshots.map((row, index) => `<fieldset data-cryo-row="snapshots" data-cryo-index="${index}"><div class="calculator-fields">${draftInput("id", "取样标识", row.id)}${snapshotFields.map(([key, label]) => draftInput(key, label, row[key], true)).join("")}${draftInput("source", "快照来源说明", row.source)}<label>来源引用（每行一条）<textarea data-traveler-cryo-state-draft-input data-cryo-key="sourceRefs">${esc(row.sourceRefs)}</textarea></label></div>${remove("snapshots", index)}</fieldset>`).join("")}<button type="button" data-action="traveler-cryo-state-add-snapshots">添加历史快照</button></details>`;
  return `<div data-traveler-cryo-state-editor>${histories}${independent}${snapshots}<button type="button" data-action="traveler-cryo-state-apply">应用实际记录与快照</button><button type="button" data-action="traveler-cryo-state-reset">放弃未应用草稿</button><p data-traveler-cryo-state-draft-status role="status">${draft.dirty ? "草稿尚未应用，当前计算已失效。" : "已应用记录由共享核心计算；修改后请应用。"}</p></div>`;
}
export function captureTravelerCryoStateDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  for (const input of root.querySelectorAll<HTMLSelectElement>("[data-cryo-known]")) {
    const key = `${input.dataset.cryoKnown}Known` as "changesKnown" | "callbacksKnown" | "independentKnown" | "triggerKnown";
    draft[key] = input.value === "provided";
  }
  const read = (row: HTMLElement): Row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-cryo-key]")].map(input => [input.dataset.cryoKey!, input.value]));
  for (const kind of ["changes", "callbacks", "snapshots"] as const) if (root.querySelector(`[data-cryo-row="${kind}"]`)) {
    draft[kind] = [...root.querySelectorAll<HTMLElement>(`[data-cryo-row="${kind}"]`)].map((element, index) => {
      const row = read(element), previous = draft[kind][index];
      if (kind === "snapshots" && previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin;
      return row;
    });
  }
  const independent = root.querySelector<HTMLElement>("[data-cryo-independent]"), trigger = root.querySelector<HTMLElement>("[data-cryo-trigger]");
  if (independent) draft.independent = read(independent); if (trigger) draft.trigger = read(trigger);
  draft.dirty = true; drafts.set(keyFor(document), draft);
}
export function editTravelerCryoStateDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureTravelerCryoStateDraft(document, root); const draft = getDraft(document);
  const match = /^traveler-cryo-state-(add|remove)-(changes|callbacks|snapshots)$/.exec(button.dataset.action ?? ""); if (!match) return;
  const kind = match[2] as "changes" | "callbacks" | "snapshots";
  if (match[1] === "add") { draft[kind].push({}); if (kind === "changes") draft.changesKnown = true; if (kind === "callbacks") draft.callbacksKnown = true; }
  else draft[kind].splice(Number(button.dataset.cryoIndex), 1);
}
export function applyTravelerCryoStateDraft(document: CalculatorDocument, root: HTMLElement): void {
  if (!document.gameContext?.travelerCryoStateCast) return;
  captureTravelerCryoStateDraft(document, root); const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.travelerCryoStateCast);
  const required = (row: Row, key: string): string => { const value = row[key]?.trim(); if (!value) throw new Error(`${key} 必须明确填写，未知不能作为零或空记录。`); return value; };
  const numeric = (row: Row, key: string): number => { const value = Number(required(row, key)); if (!Number.isFinite(value)) throw new Error(`${key} 必须是有限数值。`); return value; };
  const callback = (row: Row): Record<string, unknown> => ({ id: required(row, "id"), frame: numeric(row, "frame"), actorId: required(row, "actorId"), targetId: required(row, "targetId"), attackTag: required(row, "attackTag"), ...(row.airborneState ? { airborneState: row.airborneState } : {}), evidence: { kind: required(row, "evidence.kind"), reference: required(row, "evidence.reference"), legalActionConfirmed: required(row, "evidence.legalActionConfirmed") === "true", actualEnemyHitConfirmed: required(row, "evidence.actualEnemyHitConfirmed") === "true" } });
  if (document.scope !== "single-hit") {
    if (draft.changesKnown) next.radianceChanges = draft.changes.map(row => ({ id: required(row, "id"), frame: numeric(row, "frame"), radiance: required(row, "radiance"), ...(row.beforeCallbacks ? { beforeCallbacks: row.beforeCallbacks === "true" } : {}) })); else delete next.radianceChanges;
    if (draft.callbacksKnown) next.triggerCallbacks = draft.callbacks.map(callback); else delete next.triggerCallbacks;
  } else if (draft.independentKnown) {
    const row = draft.independent, event: Record<string, unknown> = {};
    for (const key of ["candidateId", "templateRole", "snapshotId", "targetId"]) event[key] = required(row, key);
    for (const key of ["frame", "snapshotFrame"]) event[key] = numeric(row, key);
    for (const key of ["radiance", "triggerId"]) if (row[key]?.trim()) event[key] = row[key].trim();
    for (const key of ["frostglowStacks", "triggerFrame"]) if (row[key]?.trim()) event[key] = numeric(row, key);
    for (const key of ["skillActiveAtTrigger", "triggerIcdReady"]) if (row[key]) event[key] = row[key] === "true";
    if (draft.triggerKnown) event.triggerEvidence = callback(draft.trigger);
    next.independentEvent = event;
  } else delete next.independentEvent;
  if (!draft.snapshots.length) delete next.snapshots;
  else {
    const snapshots: Record<string, unknown> = {};
    for (const row of draft.snapshots) {
      const id = required(row, "id"); if (Object.hasOwn(snapshots, id)) throw new Error(`历史快照标识重复：${id}`);
      const stats: Record<string, number> = {}, snapshot: Record<string, unknown> = { stats, source: required(row, "source"), sourceRefs: (row.sourceRefs ?? "").split("\n").map(ref => ref.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
      for (const [key] of snapshotFields) { if (key === "stats.energyRecharge" && !row[key]?.trim()) continue; const value = numeric(row, key); if (key.startsWith("stats.")) stats[key.slice(6)] = value; else snapshot[key] = value; }
      Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
    }
    next.snapshots = snapshots;
  }
  const parsed = travelerCryoStateCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`冰主实际记录尚不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.travelerCryoStateCast = parsed.data; drafts.delete(keyFor(document));
}
export function resetTravelerCryoStateDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasTravelerCryoStateDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
