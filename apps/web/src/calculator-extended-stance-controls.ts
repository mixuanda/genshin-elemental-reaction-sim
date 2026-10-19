import { compileExtendedStanceSchedule, extendedStanceCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { extendedStanceTemplates } from "../../../packages/game-data/src/character-mappings/extended-stance-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.extendedStanceCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, options: { min?: number; max?: number; integer?: boolean } = {}): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const enumField = (key: string, label: string, value: string | undefined, choices: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-source-cast-enum-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option>${choices.map(([id, name]) => `<option value="${esc(id)}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["extendedStanceCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
type ScheduleKind = Parameters<typeof compileExtendedStanceSchedule>[0];
const castOf = (document: CalculatorDocument) => extendedStanceTemplates.find(cast => cast.skillId === document.gameContext?.skillId);
const reactionElements = [["pyro", "火"], ["hydro", "水"], ["electro", "雷"], ["cryo", "冰"]] as const;
const teamElements = [["anemo", "风"], ["geo", "岩"], ["dendro", "草"], ...reactionElements] as const;
const actionKinds = [["normal", "普通攻击"], ["charged", "重击"], ["skill", "元素战技／姿态内再次输入 E"], ["swap", "换人"]] as const;
const booleanChoices = [["true", "是"], ["false", "否"]] as const;

function scheduleOf(document: CalculatorDocument, context: Context) {
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
  return compileExtendedStanceSchedule(castOf(document)!.skillId as ScheduleKind, context, ascension === undefined ? {} : { ascension });
}

function specificControls(context: Context, slug: string, complete: boolean): string {
  if (slug === "ifa") return complete ? state("ifa.noExternalNightsoulChanges", "完整过程没有未记录的外部夜魂增减", context.ifa?.noExternalNightsoulChanges) + state("ifa.noUnlistedActions", "已列出姿态过程中的全部实际输入", context.ifa?.noUnlistedActions) : "";
  if (slug === "dahlia") return complete ? state("dahlia.shieldUnbroken", "本次护盾未破裂，未被覆盖或提前移除", context.dahlia?.shieldUnbroken) + state("dahlia.noNormalHitsOrFrozen", "完整窗口没有普通攻击命中或冻结事件", context.dahlia?.noNormalHitsOrFrozen) + state("dahlia.noSwaps", "完整窗口没有换人", context.dahlia?.noSwaps) : "";
  if (slug === "varka") return complete ? state("varka.completeTeamConfirmed", "已完整提供本次队伍所有成员的元素（包括本人）", context.varka?.completeTeamConfirmed) + state("varka.hexerei", "法尔伽本次是否具有魔导资格", context.varka?.hexerei) + numberField("varka.hexereiCount", "队伍实际魔导角色人数", context.varka?.hexereiCount, { min: 0, max: 4, integer: true }) + state("varka.noUnlistedActions", "已列出姿态过程中的全部实际输入", context.varka?.noUnlistedActions) + state("varka.noExternalCooldownChanges", "没有其他未列入来源协议的冷却变更", context.varka?.noExternalCooldownChanges) + state("varka.allSwirlsRecorded", "已完整记录影响本次姿态的全部扩散事件", context.varka?.allSwirlsRecorded) : "";
  if (slug === "prune") return state("prune.hexerei", "本次是否开启魔导强化（此分支要求否）", context.prune?.hexerei) + (complete ? state("prune.allInitialSwirlsRecorded", "已完整记录本次初击引发的扩散", context.prune?.allInitialSwirlsRecorded) + state("prune.recastDeclined", "本次明确不执行追加施放", context.prune?.recastDeclined) : "");
  return "";
}

function accountingFields(key: string, values: HitState, slug: string, single: boolean): string {
  if (slug === "ifa") return state(`${key}.ifaA4Active`, "本击取样时伊法 A4 是否实际生效（突破 4 及以上需明确）", values.ifaA4Active) + numberField(`${key}.includedElementalMastery`, "本击精通面板已含的伊法 A4 份额（生效值为 80，低突破不要求）", values.includedElementalMastery, { min: 0 });
  if (slug === "varka") return numberField(`${key}.varkaA1NonExtraAtkAtLastRefresh`, "A1 最近一次刷新时实际使用的非额外攻击力", values.varkaA1NonExtraAtkAtLastRefresh, { min: 0 }) + numberField(`${key}.includedDamageBonus`, "本击增伤输入已含的本人 A1／A4 份额（小数）", values.includedDamageBonus, { min: 0 }) + (single ? `<label>后续攻击起手时实际 A1 系数倍率（初击不要求）<select data-source-cast-value-field="${esc(path(`${key}.varkaA1Multiplier`))}"><option value="unknown"${values.varkaA1Multiplier === undefined ? " selected" : ""}>未知；需明确</option>${[1, 1.4, 2.2].map(value => `<option value="${value}"${values.varkaA1Multiplier === value ? " selected" : ""}>${value}</option>`).join("")}</select></label>` + numberField(`${key}.varkaA4Stacks`, "本击取样时实际 A4 层数（初击不要求）", values.varkaA4Stacks, { min: 0, max: 4, integer: true }) + enumField(`${key}.convertedElement`, "转化部分本击的实际元素（风伤部分不要求）", values.convertedElement, [["physical", "物理"], ...reactionElements]) : "");
  if (slug === "prune" && single) return enumField(`${key}.convertedElement`, "转化部分本击的实际元素（风伤部分不要求）", values.convertedElement, reactionElements);
  return "";
}

/** Scalar conditions and actual hit states use the normal calculator input protocol. */
export function renderExtendedStanceControls(document: CalculatorDocument): string {
  const cast = castOf(document);
  if (!cast) return "";
  const context = document.gameContext!.extendedStanceCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = scheduleOf(document, context), selected = new Set(document.selectedHitIds), slug = cast.sourceSlug;
  const common = complete ? textField("casterId", "施放角色标识", context.casterId) + textField("targetId", "所选敌人标识", context.targetId) + state("freshCastConfirmed", "全新施放，没有此前姿态、层数或触发冷却残留", context.freshCastConfirmed) + state("noHitlag", "观察过程没有卡肉延长", context.noHitlag) + state("noInterruption", "施放与声明状态过程没有中断", context.noInterruption) + state("noReplacement", "没有额外重施放、替换、重置或角色死亡", context.noReplacement) + state("fullObservedLifetime", "已观察完整状态及所有已发出攻击的尾段", context.fullObservedLifetime) + numberField("observedThroughFrame", "实际观察到的末帧（相对起手）", context.observedThroughFrame, { min: 0, integer: true }) + state("statsStableAcrossHits", "除逐击明确差异外，完整过程的基础面板与装备稳定", context.statsStableAcrossHits) : "";
  const contacts = complete ? `<details open><summary>实际接触 · ${schedule.candidates.length} 次候选攻击</summary><p class="calculator-hint">候选由共享核心按输入与来源时序生成。命中、落空和未知分开；落空不生成对所选敌人的伤害。${slug === "varka" ? "普攻的任意敌人命中记录与所选目标接触分开填写，前者用于实际命中回调，不能只凭对所选目标落空推定没有回调。" : "完整分支须明确全部未取消候选的接触结果。"}</p>${schedule.candidates.map(hit => `<fieldset data-extended-stance-contact="${esc(hit.id)}"><legend>${esc(cast.roles[hit.templateRole]?.label ?? hit.templateRole)} · ${esc(hit.id)} · 命中 ${hit.frame}f／取样 ${hit.snapshotFrame}f</legend>${hit.canceled ? `<p class="calculator-hint">核心判定姿态结束使本次发射取消，不生成实际命中。</p>${context.targetContacts?.[hit.id] === undefined ? "" : `<button type="button" data-action="extended-stance-clear-contact" data-extended-stance-contact-id="${esc(hit.id)}">清除原接触记录</button>`}` : `<div class="calculator-fields">${state(`targetContacts.${hit.id}`, "是否实际命中所选敌人", context.targetContacts?.[hit.id])}${slug === "varka" && hit.templateRole.startsWith("normal") ? state(`enemyHits.${hit.id}`, "是否实际命中过任意敌人（包括所选敌人）", context.enemyHits?.[hit.id]) : ""}</div>`}</fieldset>`).join("")}<p class="calculator-hint">当前来源协议至少要求观察至第 ${schedule.requiredObservedThroughFrame} 帧；实际观察值仍须由你明确填写。</p></details>` : '<p class="calculator-hint">已发生单击只要求本击实际条件和取样，不要求补齐未来输入、完整寿命或其他命中。</p>';
  const timeline = complete ? `<details data-extended-stance-schedule><summary>共享核心生成的状态与日程</summary><p class="calculator-hint">以下内容由当前已应用的输入生成；未知条件仍会使完整计算保持待补状态。资源、层数、冷却回调与排队尾段不由页面另算。</p><table><thead><tr><th>帧</th><th>状态变化</th><th>核心派生值</th></tr></thead><tbody>${schedule.stateEvents.map(event => `<tr><td>${event.frame}</td><td>${esc(event.label)}</td><td>${event.value === undefined ? "—" : event.value}</td></tr>`).join("")}</tbody></table>${schedule.decisions.length ? `<table><thead><tr><th>帧／事件</th><th>处理结果</th></tr></thead><tbody>${schedule.decisions.map(event => `<tr><td>${event.frame}f · ${esc(event.eventId)}</td><td>${esc(event.reason)}</td></tr>`).join("")}</tbody></table>` : ""}</details>` : "";
  const hasAccounting = slug === "varka" || slug === "ifa" || slug === "prune" && !complete;
  const accounting = hasAccounting ? `<details open><summary>共同实际状态与已含份额</summary><div class="calculator-fields">${accountingFields("sharedState", context.sharedState ?? {}, slug, !complete)}</div><p class="calculator-hint">共同字段供没有逐击覆盖的命中使用。明确未含才填 0，未知请留空。历史取样基数与当前最终面板不互相替代。${slug === "varka" && complete ? "完整日程的系数倍率、A4 层数与转化元素由核心依照输入和实际回调生成。" : ""}</p></details><details><summary>逐击实际状态与已含份额</summary>${document.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset data-extended-stance-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${selected.has(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 已有最终快照" : ""}</legend><div class="calculator-fields">${accountingFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, slug, !complete)}</div></fieldset>`).join("")}</details>` : "";
  return `<fieldset data-source-cast-controls="extended-stance"><legend>${esc(cast.label)}：实际姿态输入与完整观察</legend><div class="calculator-fields">${common}${specificControls(context, slug, complete)}</div>${contacts}${timeline}${accounting}${renderExtendedStanceDraft(document)}<p class="calculator-hint">范围限当前来源协议明确支持的 C0 条件；输入是否合法、资源／冷却及尾段如何变化均由共享核心判断。未知不默认为零、否、满资源或没有事件；来源一致不等于游戏实测认证。</p></fieldset>`;
}

type DraftRow = Record<string, string>;
type Draft = { actionsKnown: boolean; actions: DraftRow[]; teamKnown: boolean; team: DraftRow[]; swirlsKnown: boolean; swirls: DraftRow[]; snapshots: DraftRow[]; clearedContacts: string[]; dirty: boolean };
const drafts = new Map<string, Draft>();
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "独立加算基伤"], ["reactionBonus", "反应增伤（小数）"],
];
const draftInput = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-extended-stance-draft-input data-extended-stance-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
const draftSelect = (key: string, label: string, value: string | undefined, choices: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-extended-stance-draft-input data-extended-stance-draft-key="${esc(key)}"><option value="">未知；需明确</option>${choices.map(([id, name]) => `<option value="${esc(id)}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
export const EXTENDED_STANCE_DRAFT_FIELD = "gameContext.extendedStanceCast.scheduleDraft";

function numeric(value: string | undefined, label: string, integer = false): number {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
  return parsed;
}

function parseSnapshots(rows: DraftRow[]): Record<string, unknown> | undefined {
  if (!rows.length) return undefined;
  const snapshots: Record<string, unknown> = {};
  for (const [index, row] of rows.entries()) {
    const id = row.id?.trim();
    if (!id || Object.prototype.hasOwnProperty.call(snapshots, id)) throw new Error(`历史快照 ${index + 1} 须提供不重复的取样标识。`);
    const stats: Record<string, number> = {};
    const snapshot: Record<string, unknown> = { stats, source: row.source?.trim(), sourceRefs: (row.sourceRefs ?? "").split("\n").map(value => value.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
    for (const [key, label] of snapshotFields) {
      if (key === "stats.energyRecharge" && !row[key]?.trim()) continue;
      const value = numeric(row[key], `历史快照 ${index + 1} 的${label}`, key === "characterLevel" || key === "ascension");
      if (key.startsWith("stats.")) stats[key.slice(6)] = value; else snapshot[key] = value;
    }
    Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
  }
  return snapshots;
}

function renderSnapshots(rows: DraftRow[], ids: string[]): string {
  return `<details><summary>历史最终快照（可选）· ${rows.length} 份</summary><p class="calculator-hint">只添加实际记录过的历史取样；这里不会复制当前装备或猜测过去数值。当前候选的取样标识：${ids.length ? ids.map(esc).join("、") : "先提供动作与状态记录"}。逐项填写最终数值及来源，目标抗性仍在逐击输入中填写。</p>${rows.map((row, index) => `<fieldset data-extended-stance-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-extended-stance-draft-input data-extended-stance-draft-key="id" value="${esc(row.id)}" list="extended-stance-snapshot-identifiers" placeholder="采用上方实际取样标识"></label>${snapshotFields.map(([key, label, min, max]) => draftInput(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${draftInput("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-extended-stance-draft-input data-extended-stance-draft-key="sourceRefs" rows="2" placeholder="明确的记录或来源链接">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="extended-stance-remove-snapshot" data-extended-stance-row-index="${index}">删除此快照</button></fieldset>`).join("")}<datalist id="extended-stance-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="extended-stance-add-snapshot">添加明确的历史快照</button></details>`;
}

function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document));
  if (saved?.dirty) return saved;
  const context = document.gameContext?.extendedStanceCast;
  const swirls = castOf(document)?.sourceSlug === "varka" ? context?.varka?.swirlEvents : context?.prune?.initialSwirls;
  const stringifyRow = (row: object): DraftRow => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)]));
  const draft: Draft = {
    actionsKnown: context?.followupActions !== undefined, actions: (context?.followupActions ?? []).map(stringifyRow),
    teamKnown: context?.varka?.teamElements !== undefined, team: (context?.varka?.teamElements ?? []).map(element => ({ element })),
    swirlsKnown: swirls !== undefined, swirls: (swirls ?? []).map(stringifyRow),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), clearedContacts: [], dirty: false,
  };
  drafts.set(keyFor(document), draft);
  return draft;
}

/** Actual inputs, party elements and reaction observations are editable rows, not JSON text. */
export function renderExtendedStanceDraft(document: CalculatorDocument): string {
  const cast = castOf(document);
  if (!cast) return "";
  const context = document.gameContext!.extendedStanceCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const schedule = scheduleOf(document, context), slug = cast.sourceSlug;
  const ids = [...new Set(schedule.candidates.map(hit => hit.snapshotId))];
  const actions = complete ? `<details open><summary>实际后续输入 · ${draft.actions.length} 条</summary><label>后续输入记录<select data-extended-stance-draft-input data-extended-stance-actions-known><option value="unknown"${draft.actionsKnown ? "" : " selected"}>未知；未提供完整记录</option><option value="provided"${draft.actionsKnown ? " selected" : ""}>已完整提供（零条＝明确没有后续输入）</option></select></label><p class="calculator-hint">帧数相对本次起手，按实际输入顺序记录。旅行、攻速与体力只在适用动作中填写；明确为零也须填写 0。${slug === "dahlia" ? "当前分支要求没有普攻命中、冻结与换人；不支持的实际输入仍须如实保留，核心会列出范围限制。" : slug === "prune" ? "若实际使用初击扩散开放的二段战技，请记录一次 E 输入；否则明确选择放弃二段，并观察转换窗口结束。" : "姿态内输入是否合法、资源是否足够、冷却是否就绪由核心检查，不根据希望得到的命中数反推输入。"}</p>${draft.actions.map((row, index) => `<fieldset data-extended-stance-action-row="${index}"><legend>实际输入 ${index + 1}</legend><div class="calculator-fields">${draftInput("id", "动作标识", row.id)}${draftInput("frame", "实际输入帧", row.frame, true, 'min="0"')}${draftInput("actorId", "动作角色标识", row.actorId)}${draftSelect("kind", "动作类型", row.kind, actionKinds)}${draftInput("travelFrames", "投射物实际旅行帧（不适用可留空）", row.travelFrames, true, 'min="0"')}${draftInput("swapDelayFrames", "实际换人延迟帧（仅换人输入）", row.swapDelayFrames, true, 'min="0"')}${draftInput("attackSpeedBonus", "本次动作攻速加成（小数，不适用可留空）", row.attackSpeedBonus, true, 'min="-1" max="1"')}${draftInput("staminaBeforeAction", "本次动作前实际体力（不适用可留空）", row.staminaBeforeAction, true, 'min="0"')}</div><button type="button" data-action="extended-stance-remove-action" data-extended-stance-row-index="${index}">删除此输入</button></fieldset>`).join("")}<button type="button" data-action="extended-stance-add-action">添加实际后续输入</button></details>` : "";
  const team = complete && slug === "varka" ? `<details open><summary>实际完整队伍元素 · ${draft.team.length} 人</summary><label>队伍元素记录<select data-extended-stance-draft-input data-extended-stance-team-known><option value="unknown"${draft.teamKnown ? "" : " selected"}>未知；未提供</option><option value="provided"${draft.teamKnown ? " selected" : ""}>已明确提供</option></select></label><p class="calculator-hint">逐人列出本次实际队伍，包括法尔伽本人，共 1–4 人。相同元素的不同角色各占一行；核心按此选择转化元素与实际 A1 条件，不预填标准队伍。</p>${draft.team.map((row, index) => `<div data-extended-stance-team-row="${index}" class="calculator-fields">${draftSelect("element", `队伍成员 ${index + 1} 的元素`, row.element, teamElements)}<button type="button" data-action="extended-stance-remove-team" data-extended-stance-row-index="${index}">删除此成员记录</button></div>`).join("")}<button type="button" data-action="extended-stance-add-team"${draft.team.length >= 4 ? " disabled" : ""}>添加成员元素</button></details>` : "";
  const swirls = complete && (slug === "varka" || slug === "prune") ? `<details open><summary>${slug === "prune" ? "初击引发的实际扩散" : "影响姿态的实际扩散"} · ${draft.swirls.length} 条</summary><label>扩散观察记录<select data-extended-stance-draft-input data-extended-stance-swirls-known><option value="unknown"${draft.swirlsKnown ? "" : " selected"}>未知；未提供完整记录</option><option value="provided"${draft.swirlsKnown ? " selected" : ""}>已完整提供（零条＝明确没有扩散）</option></select></label><p class="calculator-hint">填写真实发生的反应帧、拥有者、对象与元素。若扩散来自上方本次候选命中，填写其候选标识，使核心保留先伤害后反应的顺序。同帧事件按记录次序保留；法尔伽同一范围攻击命中其它敌人时，还须明确该扩散与所选目标受击的先后。这里不猜测反应或额外增加扩散伤害。</p>${draft.swirls.map((row, index) => `<fieldset data-extended-stance-swirl-row="${index}"><legend>扩散观察 ${index + 1}</legend><div class="calculator-fields">${draftInput("id", "观察标识", row.id)}${draftInput("frame", "实际扩散帧", row.frame, true, 'min="0"')}${draftInput("actorId", "反应拥有者标识", row.actorId)}${draftInput("targetId", "实际目标标识", row.targetId)}${draftSelect("targetIsEnemy", "实际目标是否为敌人", row.targetIsEnemy, booleanChoices)}${draftSelect("element", "扩散的实际元素", row.element, reactionElements)}${slug === "varka" ? draftSelect("beforeSelectedTarget", "其它敌人的本次扩散是否先于所选目标受击", row.beforeSelectedTarget, booleanChoices) : ""}<label>触发此次扩散的本次候选标识<input data-extended-stance-draft-input data-extended-stance-draft-key="triggerCandidateId" value="${esc(row.triggerCandidateId)}" list="extended-stance-candidate-identifiers" placeholder="非本次候选触发可留空"></label></div><button type="button" data-action="extended-stance-remove-swirl" data-extended-stance-row-index="${index}">删除此扩散记录</button></fieldset>`).join("")}<datalist id="extended-stance-candidate-identifiers">${schedule.candidates.map(hit => `<option value="${esc(hit.id)}"></option>`).join("")}</datalist><button type="button" data-action="extended-stance-add-swirl">添加实际扩散记录</button></details>` : "";
  return `<div data-extended-stance-editor>${actions}${team}${swirls}${renderSnapshots(draft.snapshots, ids)}${draft.clearedContacts.length ? `<p class="calculator-hint">应用后将清除已取消候选的原接触记录：${draft.clearedContacts.map(esc).join("、")}。</p>` : ""}<p data-extended-stance-draft-status role="status" class="calculator-hint">${draft.dirty ? "实际输入、观察或快照草稿尚未应用；请应用后再计算或导出。" : "实际输入、观察与历史快照没有未应用编辑。"}</p><button type="button" data-action="extended-stance-apply">应用实际输入、观察与快照</button><button type="button" data-action="extended-stance-reset">放弃未应用编辑</button></div>`;
}

export function captureExtendedStanceDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRow = (row: HTMLElement): DraftRow => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-extended-stance-draft-key]")].map(input => [input.dataset.extendedStanceDraftKey!, input.value]));
  const readGroup = (name: "actions" | "team" | "swirls", rowName: string): void => {
    const known = root.querySelector<HTMLSelectElement>(`[data-extended-stance-${name}-known]`);
    if (!known) return;
    const knownKey: "actionsKnown" | "teamKnown" | "swirlsKnown" = `${name}Known`;
    draft[knownKey] = known.value === "provided";
    draft[name] = [...root.querySelectorAll<HTMLElement>(`[data-extended-stance-${rowName}-row]`)].map(readRow);
  };
  readGroup("actions", "action"); readGroup("team", "team"); readGroup("swirls", "swirl");
  draft.snapshots = [...root.querySelectorAll<HTMLElement>("[data-extended-stance-snapshot-row]")].map((row, index) => {
    const values = readRow(row), previous = draft.snapshots[index];
    // Edited snapshots are explicit historical records, not fresh equipment conversions.
    if (previous?.origin && Object.entries(values).every(([key, value]) => previous[key] === value)) values.origin = previous.origin;
    return values;
  });
  draft.dirty = true;
}

export function editExtendedStanceDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureExtendedStanceDraft(document, root);
  const draft = getDraft(document), action = button.dataset.action, index = Number(button.dataset.extendedStanceRowIndex);
  if (action === "extended-stance-clear-contact") {
    const id = button.dataset.extendedStanceContactId;
    if (id && !draft.clearedContacts.includes(id)) draft.clearedContacts.push(id);
  }
  else if (action === "extended-stance-remove-action") draft.actions.splice(index, 1);
  else if (action === "extended-stance-remove-team") draft.team.splice(index, 1);
  else if (action === "extended-stance-remove-swirl") draft.swirls.splice(index, 1);
  else if (action === "extended-stance-remove-snapshot") draft.snapshots.splice(index, 1);
  else if (action === "extended-stance-add-snapshot") draft.snapshots.push({});
  else if (action === "extended-stance-add-team") { draft.team.push({}); draft.teamKnown = true; }
  else if (action === "extended-stance-add-action" || action === "extended-stance-add-swirl") {
    const rows = action === "extended-stance-add-action" ? draft.actions : draft.swirls, prefix = action === "extended-stance-add-action" ? "input" : "swirl";
    let next = rows.length + 1;
    while (rows.some(row => row.id === `${prefix}-${next}`)) next++;
    rows.push({ id: `${prefix}-${next}`, actorId: document.gameContext?.extendedStanceCast?.casterId ?? "" });
    if (prefix === "input") draft.actionsKnown = true; else draft.swirlsKnown = true;
  }
}

export function applyExtendedStanceDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureExtendedStanceDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), slug = castOf(document)?.sourceSlug;
  const next: Record<string, unknown> = structuredClone(document.gameContext.extendedStanceCast ?? {});
  if (draft.actionsKnown) next.followupActions = draft.actions.map((row, index) => {
    const action: Record<string, unknown> = { id: row.id?.trim(), actorId: row.actorId?.trim(), kind: row.kind, frame: numeric(row.frame, `实际输入 ${index + 1} 的帧数`, true) };
    for (const key of ["travelFrames", "swapDelayFrames", "attackSpeedBonus", "staminaBeforeAction"] as const) if (row[key]?.trim()) action[key] = numeric(row[key], `实际输入 ${index + 1} 的${key === "travelFrames" ? "旅行帧数" : key === "swapDelayFrames" ? "换人延迟帧数" : key === "attackSpeedBonus" ? "攻速加成" : "起手体力"}`, key === "travelFrames" || key === "swapDelayFrames");
    return action;
  }); else delete next.followupActions;
  if (slug === "varka") {
    const varka: Record<string, unknown> = structuredClone(document.gameContext.extendedStanceCast?.varka ?? {});
    if (draft.teamKnown) varka.teamElements = draft.team.map(row => row.element); else delete varka.teamElements;
    next.varka = varka;
  }
  if (slug === "varka" || slug === "prune") {
    const context = (next[slug] ?? {}) as Record<string, unknown>, key = slug === "varka" ? "swirlEvents" : "initialSwirls";
    if (draft.swirlsKnown) context[key] = draft.swirls.map((row, index) => ({
      id: row.id?.trim(), actorId: row.actorId?.trim(), frame: numeric(row.frame, `扩散观察 ${index + 1} 的帧数`, true),
      ...(row.targetId?.trim() ? { targetId: row.targetId.trim() } : {}), ...(row.element ? { element: row.element } : {}),
      ...(row.targetIsEnemy ? { targetIsEnemy: row.targetIsEnemy === "true" } : {}), ...(row.beforeSelectedTarget ? { beforeSelectedTarget: row.beforeSelectedTarget === "true" } : {}), ...(row.triggerCandidateId?.trim() ? { triggerCandidateId: row.triggerCandidateId.trim() } : {}),
    })); else delete context[key];
    next[slug] = context;
  }
  const contacts = next.targetContacts as Context["targetContacts"];
  if (contacts) for (const id of draft.clearedContacts) delete contacts[id];
  const snapshots = parseSnapshots(draft.snapshots);
  if (snapshots) next.snapshots = snapshots; else delete next.snapshots;
  const parsed = extendedStanceCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`姿态输入、观察或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.extendedStanceCast = parsed.data;
  drafts.delete(keyFor(document));
}

export function resetExtendedStanceDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasExtendedStanceDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
