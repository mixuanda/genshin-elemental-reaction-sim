import { compileEntityFollowupSchedule, entityFollowupCastContextSchema, type CalculatorDocument, type EntityFollowupCastKind } from "@genshin-dps-lab/sim-core";
import { entityFollowupTemplates } from "../../../packages/game-data/src/character-mappings/entity-followup-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string) => `gameContext.entityFollowupCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["entityFollowupCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
const castOf = (doc: CalculatorDocument) => entityFollowupTemplates.find(row => row.skillId === doc.gameContext?.skillId);
const elements = { pyro: "火", hydro: "水", electro: "雷", cryo: "冰", anemo: "风", geo: "岩", dendro: "草" };
const state = (key: string, label: string, value: boolean | undefined) => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, min = 0, max?: number, integer = false) => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}"></label>`;
const textField = (key: string, label: string, value: string | undefined) => `<label>${esc(label)}<input data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
function scheduleFor(doc: CalculatorDocument) {
  const ascension = (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
  return compileEntityFollowupSchedule(doc.gameContext!.skillId as EntityFollowupCastKind, doc.gameContext!.entityFollowupCast ?? {}, ascension === undefined ? {} : { ascension });
}
function accounting(key: string, values: HitState, slug: string, single: boolean): string {
  if (slug === "jahoda") return numberField(`${key}.actualAtkAtScaling`, "本机器人实际吸收帧的总攻击（与命中面板独立）", values.actualAtkAtScaling) + numberField(`${key}.includedJahodaA4EM`, "本击面板已含的雅珂达 A4 精通（明确未含才填 0）", values.includedJahodaA4EM) + (single ? state(`${key}.jahodaA4Active`, "本击取样时雅珂达 A4 精通实际有效", values.jahodaA4Active) : "");
  if (slug === "nicole") return numberField(`${key}.nicoleAtkAtProjection`, "造影执行帧尼可本人的实际总攻击", values.nicoleAtkAtProjection) + numberField(`${key}.includedAdditiveBaseDamage`, "本击附加基伤已含的尼可魔导份额（明确未含才填 0）", values.includedAdditiveBaseDamage) + (single ? state(`${key}.nicoleSkillBuffAbsentAtSnapshot`, "本击快照没有尼可 E／A1 升级增益", values.nicoleSkillBuffAbsentAtSnapshot) : "");
  return "";
}
export function renderEntityFollowupControls(doc: CalculatorDocument): string {
  const cast = castOf(doc); if (!cast) return "";
  const context = doc.gameContext!.entityFollowupCast ?? {}, complete = doc.scope !== "single-hit", schedule = scheduleFor(doc), slug = cast.characterSlug;
  const common = textField("casterId", "施放角色标识", context.casterId) + textField("targetId", "所选敌人标识", context.targetId) + (complete ? state("freshCastConfirmed", "全新实体／状态，没有旧实例或触发冷却", context.freshCastConfirmed) + state("noHitlag", "全程没有卡肉延长", context.noHitlag) + state("noInterruption", "施放过程未被中断", context.noInterruption) + state("noReplacement", "没有重施放、替换或死亡重置", context.noReplacement) + state("fullObservedLifetime", "已观察完整有效期及发出的尾段", context.fullObservedLifetime) + numberField("observedThroughFrame", "实际观察末帧（相对本次起手）", context.observedThroughFrame, 0, undefined, true) + state("statsStableAcrossHits", "除明确逐击差异外，施放者基础面板与装备稳定", context.statsStableAcrossHits) : "");
  let specific = "";
  if (complete && slug === "jahoda") specific = state("jahoda.noShadowPursuit", "Q 起手没有 E 追袭状态", context.jahoda?.noShadowPursuit) + numberField("jahoda.moonsignLevel", "实际队伍月兆等级", context.jahoda?.moonsignLevel, 0, undefined, true) + state("jahoda.completePartyConfirmed", "下方元素名单包含当时全部队员", context.jahoda?.completePartyConfirmed);
  if (complete && slug === "nicole") specific = state("nicole.noSkillBuffThroughout", "全程没有尼可 E／A1 升级增益", context.nicole?.noSkillBuffThroughout) + state("nicole.allEnemyHitEventsRecorded", "已完整记录状态内所有实际敌人命中回调", context.nicole?.allEnemyHitEventsRecorded) + state("nicole.eventsInSourceOrderConfirmed", "同帧事件按实际来源执行顺序填写", context.nicole?.eventsInSourceOrderConfirmed) + state("nicole.casterIsHexerei", "尼可本次实际具备魔导资格", context.nicole?.casterIsHexerei) + numberField("nicole.partyHexereiCount", "实际队伍魔导角色人数", context.nicole?.partyHexereiCount, 0, 4, true);
  if (complete && slug === "odette") specific = state("odette.noPriorDanceDouble", "起手没有旧舞偶", context.odette?.noPriorDanceDouble) + state("odette.noUpgradeThroughout", "全程没有舞偶升级", context.odette?.noUpgradeThroughout) + state("odette.noCodaOrRefreshThroughout", "全程没有终曲或刷新舞偶", context.odette?.noCodaOrRefreshThroughout);
  if (slug === "odette" && cast.abilityKey === "combat3") specific += numberField("skillTalentLevel", "舞偶采用的实际 E 有效天赋等级（独立于 Q）", context.skillTalentLevel, 1, 15, true);
  const contacts = complete ? `<details open><summary>来源候选攻击 · ${schedule.candidates.length} 次机会</summary><div class="calculator-fields">${schedule.candidates.map(row => state(`targetContacts.${row.id}`, `${cast.roles[row.templateRole]?.label ?? row.templateRole} · ${row.id} · ${row.frame}f · 归属 ${row.ownerId} · 快照 ${row.snapshotId}：实际命中所选目标`, context.targetContacts?.[row.id])).join("")}</div><p class="calculator-hint">来源要求至少观察至第 ${schedule.requiredObservedThroughFrame} 帧；实际命中、落空和未知分别记录，不自动补命中。</p></details>` : '<p class="calculator-hint">独立命中不要求未来生命周期。机器人／造影需在下方还原这次实际命中的归属、吸收或触发时点；初击可直接使用本击面板。</p>';
  const hitAccounting = slug === "jahoda" || slug === "nicole" ? `<details open><summary>共同本击状态与已含份额</summary><div class="calculator-fields">${accounting("sharedState", context.sharedState ?? {}, slug, !complete)}</div><p class="calculator-hint">共同字段供未逐击覆盖的命中使用，只有实际相同才可共用。造影始终读取归属角色在执行帧的独立快照；尼可附加基伤另读尼可 ATK。面板已含份额未知时留空。</p></details><details><summary>逐击实际状态</summary>${doc.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset data-entity-followup-hit="${esc(hit.id)}"><legend>${esc(hit.label)} · ${doc.selectedHitIds.includes(hit.id) ? "已选" : "未选"}</legend><div class="calculator-fields">${accounting(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, slug, !complete)}</div></fieldset>`).join("")}</details>` : "";
  return `<fieldset data-source-cast-controls="entity-followup"><legend>${esc(cast.label)}：完整实体观察与归属</legend><div class="calculator-fields">${common}${specific}</div>${contacts}${hitAccounting}${renderEntityFollowupDraft(doc)}<p class="calculator-hint">固定来源的 C0 条件协议，尚非实机认证。雅珂达非火 A1 机器人乘数存在明确源码冲突，核心保留阻塞；尼可 E 升级、舞偶刷新及其他动作伤害不自动补造。</p></fieldset>`;
}

type Field = { key: string; label: string; kind?: "number" | "frame" | "boolean" | "names" | "elements"; options?: Record<string, string> };
type Collection = { path: string; label: string; record: boolean; fields: Field[]; hint: string };
type Row = { key: string; values: Record<string, string> };
type Draft = { collections: Record<string, { provided: boolean; rows: Row[] }>; partyKnown: boolean; party: string[]; snapshots: Record<string, string>[]; independentKnown: boolean; independent: Record<string, string>; dirty: boolean };
const drafts = new Map<string, Draft>();
export const ENTITY_FOLLOWUP_DRAFT_FIELD = "gameContext.entityFollowupCast.scheduleDraft";
const keyFor = (doc: CalculatorDocument) => `${doc.dataIdentity.datasetId}:${doc.gameContext?.characterId}/${doc.gameContext?.variantId ?? ""}/${doc.gameContext?.skillId}`;
const readPath = (object: unknown, key: string): unknown => key.split(".").reduce<unknown>((value, name) => (value as Record<string, unknown> | undefined)?.[name], object);
function writePath(object: Record<string, unknown>, key: string, value: unknown): void {
  const keys = key.split("."); let target = object;
  for (const segment of keys.slice(0, -1)) { if (!target[segment]) { if (value === undefined) return; target[segment] = {}; } target = target[segment] as Record<string, unknown>; }
  if (value === undefined) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = value;
}
const stringValue = (value: unknown) => value === undefined ? "" : Array.isArray(value) ? value.join(",") || "[]" : String(value);
function collectionsFor(doc: CalculatorDocument): Collection[] {
  if (castOf(doc)?.characterSlug === "jahoda") return [
    { path: "jahoda.absorptionChecks", label: "机器人各次元素吸收检查", record: true, fields: [{ key: "allAurasInAreaConfirmed", label: "已记录区域内所有存活敌人的可吸收附着", kind: "boolean" }, { key: "elementsPresent", label: "实际存在的火水雷冰附着", kind: "elements" }], hint: "记录键由核心列出；没有可吸收附着时明确提供空名单，不能把未知当作无元素。" },
    { path: "jahoda.attackSelections", label: "机器人每次实际选敌", record: true, fields: [{ key: "completeSelectionConfirmed", label: "已提供本次完整的最近存活敌人选择", kind: "boolean" }, { key: "closestAliveEnemyIds", label: "按距离排序的实际目标（最多 3 个）", kind: "names" }], hint: "一次选敌生成一次独立攻击，所选计算目标是否接触仍在上方候选表单独确认。" },
    { path: "jahoda.healChecks", label: "A4 各次治疗前状态", record: true, fields: [{ key: "activeActorId", label: "治疗前实际场上角色" }, { key: "hpRatioBeforeHeal", label: "治疗前实际生命比例（0–1）", kind: "number" }], hint: "A4 判定读取治疗前的角色及生命；没有此记录时不猜测精通生效。" },
  ];
  if (castOf(doc)?.characterSlug === "nicole") return [{ path: "nicole.enemyHitEvents", label: "状态内实际敌人命中回调（保留同帧顺序）", record: false, fields: [
    { key: "id", label: "回调事件标识" }, { key: "frame", label: "相对起手帧", kind: "frame" }, { key: "actorId", label: "伤害来源角色" }, { key: "activeActorId", label: "当时场上角色" }, { key: "targetId", label: "实际被击中敌人" }, { key: "actorElement", label: "来源角色元素", options: elements }, { key: "actorIsHexerei", label: "来源角色实际具备魔导资格", kind: "boolean" }, { key: "enemyHitHookFired", label: "来源 OnEnemyHit 回调实际发生", kind: "boolean" }, { key: "afterStatusActivation", label: "若为 109 帧：回调在状态激活之后", kind: "boolean" },
  ], hint: "按真实执行顺序添加；核心按来源角色、冷却与次数决定是否生成造影。零行仅在完整观察后明确没有回调时使用。" }];
  return [];
}
const snapshotFields: ReadonlyArray<readonly [string, string]> = [["stats.atk", "最终攻击力"], ["stats.hp", "生命上限"], ["stats.def", "最终防御力"], ["stats.em", "元素精通"], ["stats.critRate", "暴击率（小数）"], ["stats.critDamage", "暴击伤害（小数）"], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）"], ["characterLevel", "实际归属者等级"], ["ascension", "实际归属者突破"], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "本击独立加算基伤"], ["reactionBonus", "反应增伤（小数）"]];
function independentFields(doc: CalculatorDocument): Field[] {
  const roles = Object.fromEntries(Object.entries(castOf(doc)?.roles ?? {}).map(([key, role]) => [key, role.label]));
  return [{ key: "candidateId", label: "实际命中记录标识" }, { key: "templateRole", label: "对应来源伤害段", options: roles }, { key: "frame", label: "实际命中帧", kind: "frame" }, { key: "snapshotFrame", label: "归属者面板取样帧", kind: "frame" }, { key: "snapshotId", label: "实际快照标识（与下方一致）" }, { key: "ownerId", label: "实际伤害归属角色" }, { key: "targetId", label: "实际命中敌人" }, { key: "element", label: "实际元素", options: elements }, ...(castOf(doc)?.characterSlug === "jahoda" ? [{ key: "scalingFrame", label: "本机器人实际吸收帧", kind: "frame" as const }, { key: "damageMultiplier", label: "已核准火 A1 乘数（1.3）", kind: "number" as const }] : []), ...(castOf(doc)?.characterSlug === "nicole" ? [{ key: "triggerId", label: "实际触发回调标识" }, { key: "triggerFrame", label: "实际触发帧", kind: "frame" as const }, { key: "hexereiBonus", label: "本造影实际满足魔导额外基伤资格", kind: "boolean" as const }] : [])];
}
function getDraft(doc: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(doc)); if (saved?.dirty) return saved;
  const context = doc.gameContext?.entityFollowupCast;
  const draft: Draft = { collections: {}, partyKnown: context?.jahoda?.partyElements !== undefined, party: [...(context?.jahoda?.partyElements ?? [])], snapshots: [], independentKnown: context?.independentEvent !== undefined, independent: Object.fromEntries(Object.entries(context?.independentEvent ?? {}).map(([key, value]) => [key, stringValue(value)])), dirty: false };
  for (const config of collectionsFor(doc)) {
    const current = readPath(context, config.path), entries = current === undefined ? [] : config.record ? Object.entries(current as object) : (current as unknown[]).map((row, i) => [String(i + 1), row] as const);
    draft.collections[config.path] = { provided: current !== undefined, rows: entries.map(([key, raw]) => ({ key, values: Object.fromEntries(config.fields.map(field => [field.key, stringValue((raw as Record<string, unknown>)[field.key])])) })) };
  }
  draft.snapshots = Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => [key, stringValue(readPath(snapshot, key))])), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) }));
  drafts.set(keyFor(doc), draft); return draft;
}
const knownField = (attribute: string, known: boolean) => `<select data-entity-followup-draft-input ${attribute}><option value="unknown"${known ? "" : " selected"}>未知；未提供</option><option value="provided"${known ? " selected" : ""}>已提供（零项表示明确为空）</option></select>`;
function rowField(field: Field, value: string | undefined): string {
  const attr = `data-entity-followup-draft-input data-entity-followup-row-field="${esc(field.key)}"`;
  if (field.kind === "boolean" || field.options) {
    const options = field.kind === "boolean" ? { false: "否", true: "是" } : field.options!;
    return `<label>${esc(field.label)}<select ${attr}><option value="">未知；留空</option>${Object.entries(options).map(([key, label]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
  }
  if (field.kind === "elements") return `<fieldset data-entity-elements="${esc(field.key)}"><legend>${esc(field.label)}</legend>${knownField('data-entity-elements-known', !!value)}${Object.entries(elements).slice(0, 4).map(([key, label]) => `<label><input type="checkbox" data-entity-followup-draft-input data-entity-element="${key}"${value?.split(",").includes(key) ? " checked" : ""}>${label}</label>`).join("")}</fieldset>`;
  if (field.kind === "names") return `<fieldset data-entity-names="${esc(field.key)}"><legend>${esc(field.label)}</legend>${knownField('data-entity-names-known', !!value)}${Array.from({ length: 3 }, (_, index) => `<label>目标 ${index + 1}<input data-entity-followup-draft-input data-entity-name-index="${index}" value="${esc(value === "[]" ? "" : value?.split(",")[index])}" placeholder="实际目标；无则留空"></label>`).join("")}</fieldset>`;
  return `<label>${esc(field.label)}<input ${attr} type="${field.kind === "number" || field.kind === "frame" ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${field.kind === "frame" ? ' min="0" step="1"' : field.kind === "number" ? ' step="any"' : ""}></label>`;
}
export function renderEntityFollowupDraft(doc: CalculatorDocument): string {
  const cast = castOf(doc); if (!cast) return "";
  const draft = getDraft(doc), complete = doc.scope !== "single-hit", schedule = scheduleFor(doc);
  const party = complete && cast.characterSlug === "jahoda" ? `<details open><summary>实际队伍元素</summary><label>队伍元素记录${knownField('data-entity-party-known', draft.partyKnown)}</label><div class="calculator-fields">${Array.from({ length: 4 }, (_, index) => `<label>成员 ${index + 1} 元素<select data-entity-followup-draft-input data-entity-party-index="${index}"><option value="">未知／无此成员</option>${Object.entries(elements).map(([key, label]) => `<option value="${key}"${draft.party[index] === key ? " selected" : ""}>${label}</option>`).join("")}</select></label>`).join("")}</div><p class="calculator-hint">填写实际存在的全部成员，包含雅珂达。空余位置表示没有该成员；队伍整体未知时保留「未提供」。</p></details>` : "";
  const records = complete ? `${cast.characterSlug === "jahoda" ? '<button type="button" data-action="entity-followup-required-rows">按核心要求添加缺少的观察行</button>' : ""}${collectionsFor(doc).map(config => { const collection = draft.collections[config.path]!; return `<details open data-entity-collection="${config.path}"><summary>${esc(config.label)} · ${collection.rows.length} 条</summary><label>此类记录${knownField(`data-entity-provided="${config.path}"`, collection.provided)}</label><p class="calculator-hint">${esc(config.hint)}</p>${collection.rows.map((row, index) => `<fieldset data-entity-followup-row="${config.path}"><legend>记录 ${index + 1}</legend><div class="calculator-fields">${config.record ? `<label>观察标识<input data-entity-followup-draft-input data-entity-record-key value="${esc(row.key)}"></label>` : ""}${config.fields.map(field => rowField(field, row.values[field.key])).join("")}</div><button type="button" data-action="entity-followup-remove-row" data-entity-collection="${config.path}" data-entity-row-index="${index}">删除此记录</button></fieldset>`).join("")}<button type="button" data-action="entity-followup-add-row" data-entity-collection="${config.path}">添加实际记录</button></details>`; }).join("")}` : `<details open><summary>独立已发生命中的来源事件</summary><label>本击事件${knownField('data-entity-independent-known', draft.independentKnown)}</label><div class="calculator-fields" data-entity-independent-row>${independentFields(doc).map(field => rowField(field, draft.independent[field.key])).join("")}</div><p class="calculator-hint">初击无需额外事件时保留未提供。机器人与造影须还原实际事件，不能凭空假定吸收或触发；只作用于对应伤害角色模板，不要求未来攻击。造影快照标识为 sample:实际归属者:实际命中帧，真实触发与命中时点由核心核对。</p></details>`;
  const ids = [...new Set(schedule.candidates.map(row => row.snapshotId))];
  const snapshots = `<details${cast.characterSlug === "nicole" ? " open" : ""}><summary>实际历史最终快照 · ${draft.snapshots.length} 份</summary><p class="calculator-hint">尼可每次造影必须还原实际伤害归属者在执行帧的完整面板，即使施放者面板稳定也不能替代。其他命中仅在确有历史记录或面板变化时填写。当前候选快照：${ids.length ? ids.map(esc).join("、") : "先填写事件或独立命中记录"}。所有数值已含与未含份额须对应实际记录；不从当前装备回推。</p>${draft.snapshots.map((row, index) => `<fieldset data-entity-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields">${[{ key: "id", label: "快照标识" }, ...snapshotFields.map(([key, label]) => ({ key, label, kind: "number" as const })), { key: "source", label: "实际数值来源或记录说明" }].map(field => rowField(field, row[field.key])).join("")}</div><label>来源引用（每行一条）<textarea data-entity-followup-draft-input data-entity-followup-row-field="sourceRefs" rows="2">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="entity-followup-remove-snapshot" data-entity-row-index="${index}">删除此快照</button></fieldset>`).join("")}<button type="button" data-action="entity-followup-add-snapshot">添加实际历史快照</button></details>`;
  return `<div data-entity-followup-editor>${party}${records}${snapshots}<p data-entity-followup-draft-status role="status" class="calculator-hint">${draft.dirty ? "事件、队伍或快照草稿尚未应用；请应用后再计算或导出。" : "当前事件、队伍及快照记录已应用。"}</p><button type="button" data-action="entity-followup-apply">应用实体观察记录</button><button type="button" data-action="entity-followup-reset">放弃未应用编辑</button></div>`;
}
function readRow(row: HTMLElement): Record<string, string> {
  const values = Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-entity-followup-row-field]")].map(input => [input.dataset.entityFollowupRowField!, input.value]));
  for (const group of row.querySelectorAll<HTMLElement>("[data-entity-elements]")) values[group.dataset.entityElements!] = group.querySelector<HTMLSelectElement>("[data-entity-elements-known]")?.value === "provided" ? [...group.querySelectorAll<HTMLInputElement>("[data-entity-element]:checked")].map(input => input.dataset.entityElement).join(",") || "[]" : "";
  for (const group of row.querySelectorAll<HTMLElement>("[data-entity-names]")) values[group.dataset.entityNames!] = group.querySelector<HTMLSelectElement>("[data-entity-names-known]")?.value === "provided" ? [...group.querySelectorAll<HTMLInputElement>("[data-entity-name-index]")].map(input => input.value.trim()).filter(Boolean).join(",") || "[]" : "";
  return values;
}
export function captureEntityFollowupDraft(doc: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(doc);
  for (const config of collectionsFor(doc)) {
    const provided = root.querySelector<HTMLSelectElement>(`[data-entity-provided="${config.path}"]`); if (!provided) continue;
    draft.collections[config.path] = { provided: provided.value === "provided", rows: [...root.querySelectorAll<HTMLElement>(`[data-entity-followup-row="${config.path}"]`)].map((row, i) => ({ key: row.querySelector<HTMLInputElement>("[data-entity-record-key]")?.value ?? String(i + 1), values: readRow(row) })) };
  }
  const partyKnown = root.querySelector<HTMLSelectElement>("[data-entity-party-known]");
  if (partyKnown) { draft.partyKnown = partyKnown.value === "provided"; draft.party = [...root.querySelectorAll<HTMLSelectElement>("[data-entity-party-index]")].map(input => input.value); }
  const independentKnown = root.querySelector<HTMLSelectElement>("[data-entity-independent-known]");
  if (independentKnown) { draft.independentKnown = independentKnown.value === "provided"; draft.independent = readRow(root.querySelector<HTMLElement>("[data-entity-independent-row]")!); }
  draft.snapshots = [...root.querySelectorAll<HTMLElement>("[data-entity-snapshot-row]")].map((row, index) => { const values = readRow(row), previous = draft.snapshots[index]; if (previous?.origin && Object.entries(values).every(([key, value]) => previous[key] === value)) values.origin = previous.origin; return values; });
  draft.dirty = true;
}
export function editEntityFollowupDraft(doc: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureEntityFollowupDraft(doc, root); const draft = getDraft(doc), action = button.dataset.action;
  if (action === "entity-followup-add-snapshot") { draft.snapshots.push({}); return; }
  if (action === "entity-followup-remove-snapshot") { draft.snapshots.splice(Number(button.dataset.entityRowIndex), 1); return; }
  if (action === "entity-followup-required-rows") {
    const paths = { absorption: "jahoda.absorptionChecks", selection: "jahoda.attackSelections", healing: "jahoda.healChecks" };
    for (const observation of scheduleFor(doc).requiredObservations) { const collection = draft.collections[paths[observation.kind]]; if (!collection || collection.rows.some(row => row.key === observation.key)) continue; collection.rows.push({ key: observation.key, values: {} }); collection.provided = true; }
    return;
  }
  const collection = draft.collections[button.dataset.entityCollection!]; if (!collection) return;
  if (action === "entity-followup-remove-row") collection.rows.splice(Number(button.dataset.entityRowIndex), 1);
  if (action === "entity-followup-add-row") { collection.rows.push({ key: "", values: {} }); collection.provided = true; }
}
function parseFields(fields: Field[], values: Record<string, string>, label: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) { const value = values[field.key]?.trim(); if (!value) continue;
    if (field.kind === "number" || field.kind === "frame") { const numeric = Number(value); if (!Number.isFinite(numeric) || field.kind === "frame" && (!Number.isSafeInteger(numeric) || numeric < 0)) throw new Error(`${label}：${field.label}需为${field.kind === "frame" ? "非负整数帧" : "有限数值"}。`); result[field.key] = numeric; }
    else if (field.kind === "boolean") result[field.key] = value === "true";
    else if (field.kind === "names" || field.kind === "elements") result[field.key] = value === "[]" ? [] : value.split(",").map(item => item.trim()).filter(Boolean);
    else result[field.key] = value;
  }
  return result;
}
export function applyEntityFollowupDraft(doc: CalculatorDocument, root: HTMLElement): void {
  captureEntityFollowupDraft(doc, root); if (!doc.gameContext) return;
  const draft = getDraft(doc), next = structuredClone(doc.gameContext.entityFollowupCast ?? {}) as Record<string, unknown>;
  if (doc.scope !== "single-hit") {
    if (castOf(doc)?.characterSlug === "jahoda") writePath(next, "jahoda.partyElements", draft.partyKnown ? draft.party.filter(Boolean) : undefined);
    for (const config of collectionsFor(doc)) { const collection = draft.collections[config.path]!; if (!collection.provided) { writePath(next, config.path, undefined); continue; }
      const keys = new Set<string>(); const rows = collection.rows.map((row, i) => { if (config.record) { if (!row.key.trim() || keys.has(row.key.trim())) throw new Error(`${config.label}记录标识不能为空或重复。`); keys.add(row.key.trim()); } return parseFields(config.fields, row.values, `${config.label} ${i + 1}`); });
      writePath(next, config.path, config.record ? Object.fromEntries(collection.rows.map((row, i) => [row.key.trim(), rows[i]])) : rows);
    }
  } else if (draft.independentKnown) next.independentEvent = parseFields(independentFields(doc), draft.independent, "独立命中来源事件"); else delete next.independentEvent;
  if (!draft.snapshots.length) delete next.snapshots;
  else { const snapshots: Record<string, unknown> = {}; for (const [index, row] of draft.snapshots.entries()) {
    const id = row.id?.trim(); if (!id || Object.prototype.hasOwnProperty.call(snapshots, id)) throw new Error(`历史快照 ${index + 1} 需要不重复标识。`);
    const snapshot: Record<string, unknown> = { stats: {}, source: row.source?.trim(), sourceRefs: (row.sourceRefs ?? "").split("\n").map(item => item.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
    for (const [key, label] of snapshotFields) { if (key === "stats.energyRecharge" && !row[key]?.trim()) continue; if (!row[key]?.trim() || !Number.isFinite(Number(row[key]))) throw new Error(`历史快照 ${index + 1} 的${label}须明确填写有限数值。`); writePath(snapshot, key, Number(row[key])); }
    Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
  } next.snapshots = snapshots; }
  const parsed = entityFollowupCastContextSchema.safeParse(next); if (!parsed.success) throw new Error(`实体观察记录字段不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  doc.gameContext.entityFollowupCast = parsed.data; drafts.delete(keyFor(doc));
}
export function resetEntityFollowupDraft(doc: CalculatorDocument): void { drafts.delete(keyFor(doc)); }
export function hasEntityFollowupDraft(doc: CalculatorDocument): boolean { return drafts.get(keyFor(doc))?.dirty === true; }
