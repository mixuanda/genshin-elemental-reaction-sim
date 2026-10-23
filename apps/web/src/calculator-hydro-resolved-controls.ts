import {
  compileTravelerHydroResolvedSchedule, travelerHydroResolvedCastContextSchema,
  compileIansanSwiftResolvedSchedule, iansanSwiftResolvedCastContextSchema,
  type CalculatorDocument,
} from "@genshin-dps-lab/sim-core";
import { travelerHydroResolvedTemplates } from "../../../packages/game-data/src/character-mappings/traveler-hydro-resolved-mappings";
import { iansanSwiftResolvedTemplates } from "../../../packages/game-data/src/character-mappings/iansan-swift-resolved-mappings";

type Family = "traveler-hydro-resolved" | "iansan-swift-resolved";
type GameContext = NonNullable<CalculatorDocument["gameContext"]>;
type HydroContext = NonNullable<GameContext["travelerHydroResolvedCast"]>;
type SwiftContext = NonNullable<GameContext["iansanSwiftResolvedCast"]>;
type Row = Record<string, string>;
const HYDRO: Family = "traveler-hydro-resolved", SWIFT: Family = "iansan-swift-resolved";
const contextKey = (family: Family) => family === HYDRO ? "travelerHydroResolvedCast" : "iansanSwiftResolvedCast";
const path = (family: Family, key: string) => `gameContext.${contextKey(family)}.${key}`;
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hydroCast = (document: CalculatorDocument) => travelerHydroResolvedTemplates.find(cast => cast.skillId === document.gameContext?.skillId);
const swiftCast = (document: CalculatorDocument) => iansanSwiftResolvedTemplates.find(cast => cast.skillId === document.gameContext?.skillId);
const state = (family: Family, key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(family, key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (family: Family, key: string, label: string, value: number | undefined, bounds = 'min="0" step="any"'): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(family, key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" ${bounds}></label>`;
const textField = (family: Family, key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(family, key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const enumField = (family: Family, key: string, label: string, value: string | undefined, choices: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-source-cast-enum-field="${esc(path(family, key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option>${choices.map(([id, name]) => `<option value="${esc(id)}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
const hydroRoles = [["dew", "露滴"], ["torrent", "结束激流"], ["thorn", "灵息之刺"]] as const;
const booleans = [["true", "是"], ["false", "否"]] as const;
const frameBounds = 'min="0" step="1"';

function lifetimeFields(family: Family, context: HydroContext | SwiftContext): string {
  return textField(family, "casterId", "本次施放者标识", context.casterId) + textField(family, "targetId", "本次所选敌人标识", context.targetId) +
    state(family, "freshCastConfirmed", "这是一次独立的新施放", context.freshCastConfirmed) +
    state(family, "noHitlag", "本次没有卡肉", context.noHitlag) + state(family, "noInterruption", "本次动作及已发出伤害没有中断", context.noInterruption) +
    state(family, "noReplacement", "没有重施、实体或状态替换", context.noReplacement) +
    state(family, "fullObservedLifetime", "已完整观察本次全部伤害机会及尾段，包括落空", context.fullObservedLifetime) +
    numberField(family, "observedThroughFrame", "实际观察到的末帧（相对本次起手）", context.observedThroughFrame, frameBounds) +
    state(family, "statsStableAcrossHits", "共同面板确实代表本次各击的实际进攻取样", context.statsStableAcrossHits);
}

export function renderTravelerHydroResolvedControls(document: CalculatorDocument): string {
  const cast = hydroCast(document); if (!cast) return "";
  const context: HydroContext = document.gameContext!.travelerHydroResolvedCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = complete ? compileTravelerHydroResolvedSchedule(cast.skillId as Parameters<typeof compileTravelerHydroResolvedSchedule>[0], context) : undefined;
  const fields = state(HYDRO, "trueMoonStoryBuffInactive", "真月剧情增益已关闭", context.trueMoonStoryBuffInactive) + (complete ?
    lifetimeFields(HYDRO, context) + state(HYDRO, "allHpChangesRecorded", "全部充盈扣血及外部生命变化均已记录", context.allHpChangesRecorded) +
    state(HYDRO, "allDamageEventsRecorded", "全部露滴、结束激流及灵息之刺机会均已记录", context.allDamageEventsRecorded) +
    numberField(HYDRO, "initialCurrentHp", "本次起点实际当前生命", context.initialCurrentHp) + numberField(HYDRO, "initialMaxHp", "本次起点实际生命上限", context.initialMaxHp) +
    numberField(HYDRO, "releaseFrame", "实际结束长按帧", context.releaseFrame, frameBounds) + numberField(HYDRO, "releaseOrder", "结束长按在同帧内的实际顺序", context.releaseOrder, frameBounds) +
    numberField(HYDRO, "dewCount", "本次实际发出的露滴数", context.dewCount, 'min="1" max="22" step="1"') +
    state(HYDRO, "spiritbreathTriggered", "本次实际触发了灵息之刺", context.spiritbreathTriggered)
    : textField(HYDRO, "targetId", "已明确的目标标识（可留空；填写时须与本击一致）", context.targetId));
  const timeline = schedule ? `<details open data-traveler-hydro-resolved-schedule><summary>已应用的实际日程与生命账本</summary><p class="calculator-hint">${schedule.candidates.length} 个实际伤害机会，${schedule.instances.length} 个明确接触；观察至少覆盖 ${schedule.requiredObservedThroughFrame} 帧。接触在下方逐行记录，未知仍会阻塞完整计算。</p>${schedule.issues.length ? `<ul>${schedule.issues.map(issue => `<li>${esc(issue)}</li>`).join("")}</ul>` : ""}<div class="table-wrap"><table><thead><tr><th>事件</th><th>发射／交付／取样</th><th>接触</th><th>核心解析的生命资格／本次消耗</th></tr></thead><tbody>${schedule.candidates.map(event => `<tr><td>${esc(event.candidateId)} · ${esc(hydroRoles.find(([key]) => key === event.templateRole)?.[1])}</td><td>${event.launchFrame}f / ${event.frame}f / ${event.snapshotFrame}f · ${esc(event.snapshotId)}</td><td>${event.contact === undefined ? "未知" : event.contact ? "命中" : "落空"}</td><td>${event.actualCurrentHp === undefined ? "—" : `${event.actualCurrentHp} / ${event.actualMaxHp}`}；${event.consumedHpThisCast ?? "—"}</td></tr>`).join("")}</tbody></table><table><thead><tr><th>生命事件／帧／顺序</th><th>变化前 → 后</th><th>上限</th><th>本次充盈消耗／累计</th></tr></thead><tbody>${schedule.hpLedger.map(row => `<tr><td>${esc(row.id)} · ${row.frame}f · ${row.order}</td><td>${row.hpBefore} → ${row.hpAfter}</td><td>${row.maxHp}</td><td>${row.consumedHp} / ${row.cumulativeConsumed}</td></tr>`).join("")}</tbody></table></div><ul>${schedule.decisions.map(row => `<li>${row.frame}f：${esc(row.reason)}</li>`).join("")}</ul></details>` : '<p class="calculator-hint">独立单击只读取已经发生的这一击、实际进攻面板与适用生命条件。露滴填写本击资格点生命，结束激流填写本次充盈消耗；不要求之后的事件或整支队伍。</p>';
  const hitStates = new Map(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, hit.label]));
  for (const event of schedule?.candidates ?? []) hitStates.set(`${cast.skillId}:${event.candidateId}`, `${event.candidateId} · 第 ${event.frame} 帧`);
  const accounting = (key: string, value: number | undefined) => numberField(HYDRO, `${key}.includedSourceFlatDamage`, "输入加算基伤中已包含的本击充盈／A4 份额", value);
  return `<fieldset data-source-cast-controls="traveler-hydro-resolved"><legend>${esc(cast.label)}：实际生命顺序与伤害观察</legend><div class="calculator-fields">${fields}</div>${timeline}<details open><summary>共同已含份额</summary><div class="calculator-fields">${accounting("sharedState", context.sharedState?.includedSourceFlatDamage)}</div><p class="calculator-hint">明确未含才填 0。历史面板中的加算基伤与本击来源份额分别记录，共享核心执行扣除已含份额后的公式。</p></details><details><summary>逐击已含份额覆盖</summary>${[...hitStates].map(([id, label]) => `<fieldset data-traveler-hydro-resolved-hit-context="${esc(id)}"><legend>${esc(label)}</legend><div class="calculator-fields">${accounting(`hitStates.${id}`, context.hitStates?.[id]?.includedSourceFlatDamage)}</div></fieldset>`).join("")}</details>${renderTravelerHydroResolvedDraft(document)}<p class="calculator-hint">限定 C0。自动扣血时点与同帧生命读取顺序仍待独立证据，本页使用实际记录。来源公式裁决保持暂定，不表示自动生命周期或当前游戏实测完成。</p></fieldset>`;
}

function swiftStateFields(key: string, value: NonNullable<SwiftContext["sharedState"]>, single: boolean): string {
  return state(SWIFT, `${key}.swiftQualifiedAtCast`, single ? "这次命中已满足雷霆飞缒触发条件" : "本击起手条件已确认（留空时采用完整动作判定）", value.swiftQualifiedAtCast) +
    state(SWIFT, `${key}.burstInactiveAtSnapshot`, "本击取样时，Q的攻击力加成未生效", value.burstInactiveAtSnapshot) +
    state(SWIFT, `${key}.a1ActiveAtSnapshot`, "本击取样前，已有的天赋攻击力加成仍有效", value.a1ActiveAtSnapshot) +
    numberField(SWIFT, `${key}.includedA1Attack`, "面板已计入的这项天赋增攻（未计入填0）", value.includedA1Attack) +
    numberField(SWIFT, `${key}.baseAttack`, "角色与武器的基础攻击力之和（白字）", value.baseAttack) +
    state(SWIFT, `${key}.snapshotIncludesActualA1`, "历史面板已包含当时实际的天赋增攻", value.snapshotIncludesActualA1);
}

export function renderIansanSwiftResolvedControls(document: CalculatorDocument): string {
  const cast = swiftCast(document); if (!cast) return "";
  const context: SwiftContext = document.gameContext!.iansanSwiftResolvedCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = complete ? compileIansanSwiftResolvedSchedule("iansan-swift-resolved-c0", context) : undefined;
  const slowCharged = context.inputKind === "charged" && context.fastSkillActiveAtCast === false;
  const full = complete ? lifetimeFields(SWIFT, context) + state(SWIFT, "actionReadyConfirmed", "前一动作已允许本次输入", context.actionReadyConfirmed) +
    state(SWIFT, "groundedAtCast", "本次从地面起手", context.groundedAtCast) +
    enumField(SWIFT, "inputKind", "本次实际输入", context.inputKind, [["normal", "普通攻击键"], ["charged", "重击"]]) +
    state(SWIFT, "fastSkillActiveAtCast", "起手时 E 后快速雷霆飞缒窗口仍有效", context.fastSkillActiveAtCast) : textField(SWIFT, "targetId", "已明确的目标标识（可留空；填写时须与本击一致）", context.targetId);
  const charged = complete && slowCharged ? `<fieldset><legend>快速窗口外的本次重击</legend><div class="calculator-fields">${state(SWIFT, "nightsoulBlessingAtCast", "起手时仍处于夜魂祝福", context.nightsoulBlessingAtCast)}${state(SWIFT, "precedingNormalAttackConfirmed", "已完成合法的前置普通攻击", context.precedingNormalAttackConfirmed)}${numberField(SWIFT, "normalCounterBeforeCast", "起手前实际普通攻击计数", context.normalCounterBeforeCast, 'min="0" max="2" step="1"')}${numberField(SWIFT, "initialStamina", "起手时实际可用体力", context.initialStamina)}${numberField(SWIFT, "staminaCostMultiplier", "实际体力消耗倍率（此分支只覆盖 1）", context.staminaCostMultiplier)}</div><p class="calculator-hint">来源要求普通攻击计数 1 或 2，实际体力至少 25，且消耗倍率明确为 1。</p></fieldset>` : "";
  const timeline = schedule ? `<details open data-iansan-swift-resolved-schedule><summary>共享核心的本次动作与实际接触</summary><p class="calculator-hint">唯一伤害机会与进攻取样均在第 25 帧；完整伤害观察到 25 帧即可。${context.inputKind === "normal" ? "普通攻击键只有在快速窗口有效时进入此分支。" : context.fastSkillActiveAtCast === true ? "快速窗口有效的重击无需额外填写夜魂、前置普攻或体力。" : "资格与体力条件按所选输入由核心判断。"}</p><div class="calculator-fields">${state(SWIFT, "targetContacts.swift", "第 25 帧是否实际命中所选敌人", context.targetContacts?.swift)}</div>${schedule.issues.length ? `<ul>${schedule.issues.map(issue => `<li>${esc(issue)}</li>`).join("")}</ul>` : ""}<ul>${schedule.decisions.map(row => `<li>${row.frame}f：${esc(row.reason)}</li>`).join("")}</ul></details>` : '<p class="calculator-hint">可直接用共同面板计算这记已发生的雷霆飞缒；确认起手资格与本击 A1 状态即可，不要求未来夜魂寿命、前置动作记录或完整观察。需要保存具体目标时，可填写下方独立本击记录。</p>';
  const states = new Map([[cast.roles.swift.mappingId, `${cast.roles.swift.label} · 来源模板份额`], ...document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, hit.label] as [string, string])]);
  if (complete) states.set(`${cast.skillId}:swift`, "本次第 25 帧实际命中份额");
  return `<fieldset data-source-cast-controls="iansan-swift-resolved"><legend>${esc(cast.label)}：起手资格与第 25 帧面板</legend><div class="calculator-fields">${full}</div>${charged}${timeline}<details open><summary>共同实际 A1 状态与面板记账</summary><div class="calculator-fields">${swiftStateFields("sharedState", context.sharedState ?? {}, !complete)}</div><p class="calculator-hint">本击结算之后才授予的新 A1 不增幅自身；这里只记录取样时已存在的 A1。无历史快照时明确输入已含攻击力，先前 A1 有效的手动面板还需真实基础攻击力。历史最终快照须确认已经包含当时 A1，未生效时也需明确该事实。</p></details><details><summary>来源模板与逐击状态覆盖</summary><p class="calculator-hint">模板份额覆盖共同值，实际命中份额再覆盖模板。未覆盖的字段留空。</p>${[...states].map(([id, label]) => `<fieldset data-iansan-swift-resolved-hit-context="${esc(id)}"><legend>${esc(label)}</legend><div class="calculator-fields">${swiftStateFields(`hitStates.${id}`, context.hitStates?.[id] ?? {}, !complete)}</div></fieldset>`).join("")}</details>${renderIansanSwiftResolvedDraft(document)}<p class="calculator-hint">限定 C0、普通攻击天赋及 Q 反馈关闭的来源分支；一次完整雷霆飞缒不包含此前 E、之后 A1 受益动作或完整夜魂轮转。倍率等级裁决保持暂定，原来源冲突保留。</p></fieldset>`;
}

type Draft = { hpKnown: boolean; hp: Row[]; eventsKnown: boolean; events: Row[]; independentKnown: boolean; independent: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const TRAVELER_HYDRO_RESOLVED_DRAFT_FIELD = "gameContext.travelerHydroResolvedCast.observationDraft";
export const IANSAN_SWIFT_RESOLVED_DRAFT_FIELD = "gameContext.iansanSwiftResolvedCast.observationDraft";
const keyFor = (document: CalculatorDocument, family: Family) => `${family}:${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId}`;
const snapshotFields = [["stats.atk", "最终攻击力"], ["stats.hp", "生命上限"], ["stats.def", "最终防御力"], ["stats.em", "元素精通"], ["stats.critRate", "暴击率（小数）"], ["stats.critDamage", "暴击伤害（小数）"], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）"], ["characterLevel", "角色等级"], ["ascension", "突破阶段"], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "本击加算基伤"], ["reactionBonus", "反应增伤（小数）"]] as const;
function flatten(value: Record<string, unknown>): Row {
  return Object.fromEntries(Object.entries(value).flatMap(([key, field]) => field === undefined ? [] : field !== null && typeof field === "object" && !Array.isArray(field)
    ? Object.entries(field).map(([part, item]) => [`${key}.${part}`, String(item)]) : [[key, String(field)]]));
}
function getDraft(document: CalculatorDocument, family: Family): Draft {
  const saved = drafts.get(keyFor(document, family)); if (saved?.dirty) return saved;
  const context = document.gameContext?.[contextKey(family)], hydro = family === HYDRO ? document.gameContext?.travelerHydroResolvedCast : undefined;
  const draft: Draft = { hpKnown: hydro?.hpEvents !== undefined, hp: (hydro?.hpEvents ?? []).map(flatten), eventsKnown: hydro?.events !== undefined,
    events: (hydro?.events ?? []).map(event => ({ ...flatten(event), ...(hydro?.targetContacts?.[event.candidateId] === undefined ? {} : { contact: String(hydro.targetContacts[event.candidateId]) }) })),
    independentKnown: context?.independentEvent !== undefined, independent: flatten(context?.independentEvent ?? {}),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...flatten(snapshot), sourceRefs: snapshot.sourceRefs.join("\n") })), dirty: false };
  drafts.set(keyFor(document, family), draft); return draft;
}
const draftInput = (family: Family, key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-${family}-draft-input data-${family}-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
const draftSelect = (family: Family, key: string, label: string, value: string | undefined, choices: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-${family}-draft-input data-${family}-draft-key="${esc(key)}"><option value="">未知；需明确</option>${choices.map(([id, name]) => `<option value="${esc(id)}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
const known = (family: Family, key: string, label: string, provided: boolean): string => `<label>${esc(label)}<select data-${family}-draft-input data-${family}-known="${key}"><option value="unknown"${provided ? "" : " selected"}>尚未提供</option><option value="provided"${provided ? " selected" : ""}>已明确提供${key === "independent" ? "" : "（零条表示明确没有）"}</option></select></label>`;
const remove = (family: Family, kind: string, index: number) => `<button type="button" data-action="${family}-remove-${kind}" data-${family}-row-index="${index}">删除此记录</button>`;
function hydroEventFields(row: Row, independent: boolean): string {
  return draftInput(HYDRO, "candidateId", "实际事件标识", row.candidateId) + draftSelect(HYDRO, "templateRole", "实际伤害段", row.templateRole, hydroRoles) +
    draftInput(HYDRO, "launchFrame", "实际发射帧", row.launchFrame, true, 'min="0"') + draftInput(HYDRO, "frame", "实际交付帧", row.frame, true, 'min="0"') +
    draftInput(HYDRO, "snapshotFrame", "实际进攻取样帧", row.snapshotFrame, true, 'min="0"') + draftInput(HYDRO, "snapshotId", "实际进攻快照标识", row.snapshotId) + draftInput(HYDRO, "targetId", "所选敌人标识", row.targetId) +
    (independent ? draftSelect(HYDRO, "observedSourceEvent", "确认这是已发生的本次来源事件", row.observedSourceEvent, booleans) +
      draftInput(HYDRO, "hpReadFrame", "本击生命资格读取帧（独立本击可留空）", row.hpReadFrame, true, 'min="0"') + draftInput(HYDRO, "hpReadOrder", "本击生命读取的同帧顺序（独立本击可留空）", row.hpReadOrder, true, 'min="0"') +
      draftInput(HYDRO, "actualCurrentHp", "露滴资格点实际当前生命（其他段可留空）", row.actualCurrentHp, true, 'min="0"') + draftInput(HYDRO, "actualMaxHp", "露滴资格点实际生命上限（其他段可留空）", row.actualMaxHp, true, 'min="0"') + draftInput(HYDRO, "consumedHpThisCast", "结束激流：本次结束前充盈消耗总量（A4 适用时）", row.consumedHpThisCast, true, 'min="0"')
      : draftInput(HYDRO, "hpReadFrame", "露滴资格读取帧（露滴必须填写）", row.hpReadFrame, true, 'min="0"') + draftInput(HYDRO, "hpReadOrder", "露滴资格读取的同帧顺序（不能与生命变更重叠）", row.hpReadOrder, true, 'min="0"') + draftSelect(HYDRO, "contact", "本次是否实际命中所选敌人", row.contact, booleans));
}
function renderSnapshots(document: CalculatorDocument, family: Family, draft: Draft): string {
  const context = document.gameContext?.[contextKey(family)];
  const ids = family === SWIFT ? ["snapshot-25"] : [...new Set([...Object.keys(context?.snapshots ?? {}), ...draft.events.map(row => row.snapshotId), draft.independent.snapshotId,
    ...document.hits.flatMap(hit => hit.kind === "ordinary" && hit.travelerHydroResolvedEvent ? [hit.travelerHydroResolvedEvent.snapshotId] : [])].filter((id): id is string => Boolean(id)))];
  return `<details data-${family}-collection="snapshots"><summary>实际历史最终快照 · ${draft.snapshots.length} 份</summary><p class="calculator-hint">取样标识：${ids.map(esc).join("、") || "先填写实际伤害记录"}。只有掌握真实历史数值时才添加；面板稳定可在上方明确使用共同构筑。当前装备不会被复制成过去的面板。${family === SWIFT ? "历史快照应已经包含当时先前 A1；在上方确认其记账。" : "进攻快照与充盈生命资格读取点可以不同，须分别按实际记录填写。"}</p>${draft.snapshots.map((row, index) => `<fieldset data-${family}-row="snapshots" data-${family}-row-index="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields">${draftInput(family, "id", "实际取样标识", row.id)}${snapshotFields.map(([key, label]) => draftInput(family, key, label, row[key], true)).join("")}${draftInput(family, "source", "历史数值来源说明", row.source)}<label>来源引用（每行一条）<textarea data-${family}-draft-input data-${family}-draft-key="sourceRefs" rows="2">${esc(row.sourceRefs)}</textarea></label></div>${remove(family, "snapshots", index)}</fieldset>`).join("")}<button type="button" data-action="${family}-add-snapshots">添加实际历史快照</button></details>`;
}
function draftShell(family: Family, body: string, dirty: boolean): string {
  return `<div data-${family}-editor>${body}<p data-${family}-draft-status role="status" class="calculator-hint">${dirty ? "实际记录或快照草稿尚未应用；请应用后再计算或导出。" : "实际记录与快照没有未应用编辑。"}</p><button type="button" data-action="${family}-apply">应用实际记录与快照</button><button type="button" data-action="${family}-reset">放弃未应用编辑</button></div>`;
}
export function renderTravelerHydroResolvedDraft(document: CalculatorDocument): string {
  if (!hydroCast(document)) return "";
  const draft = getDraft(document, HYDRO), complete = document.scope !== "single-hit";
  const rows = complete ? `<details open data-${HYDRO}-collection="hp"><summary>完整生命事件账本</summary>${known(HYDRO, "hp", "生命事件记录", draft.hpKnown)}<p class="calculator-hint">每条记录须指定实际帧和同帧顺序。充盈事件的耗血量由核心根据此前生命状态计算；外部治疗、伤害或上限变化填写观察后的生命值和原因。空账本只表示明确没有生命变化。</p>${draft.hp.map((row, index) => `<fieldset data-${HYDRO}-row="hp" data-${HYDRO}-row-index="${index}"><legend>生命事件 ${index + 1}</legend><div class="calculator-fields">${draftInput(HYDRO, "id", "生命事件标识", row.id)}${draftSelect(HYDRO, "kind", "实际事件类型", row.kind, [["suffusion", "本次充盈消耗"], ["observed-hp-state", "外部生命状态观察"]])}${draftInput(HYDRO, "frame", "实际帧", row.frame, true, 'min="0"')}${draftInput(HYDRO, "order", "同帧实际顺序", row.order, true, 'min="0"')}${draftInput(HYDRO, "currentHp", "外部观察后的当前生命（充盈事件可留空）", row.currentHp, true, 'min="0"')}${draftInput(HYDRO, "maxHp", "外部观察后的生命上限（充盈事件可留空）", row.maxHp, true, 'min="0"')}${draftInput(HYDRO, "reason", "外部生命变化原因或记录说明", row.reason)}</div>${remove(HYDRO, "hp", index)}</fieldset>`).join("")}<button type="button" data-action="${HYDRO}-add-hp">添加生命事件</button></details><details open data-${HYDRO}-collection="events"><summary>全部实际伤害机会与接触</summary>${known(HYDRO, "events", "伤害事件记录", draft.eventsKnown)}<p class="calculator-hint">包括每个落空事件。露滴资格读取帧及同帧顺序决定它读取账本哪一状态；结束激流的本次充盈消耗由核心重放账本得出，不能直接填入缓存结果。</p>${draft.events.map((row, index) => `<fieldset data-${HYDRO}-row="events" data-${HYDRO}-row-index="${index}"><legend>伤害记录 ${index + 1}</legend><div class="calculator-fields">${hydroEventFields(row, false)}</div>${remove(HYDRO, "events", index)}</fieldset>`).join("")}<button type="button" data-action="${HYDRO}-add-events">添加实际伤害机会</button></details>`
    : `<details open><summary>独立已发生的本击</summary>${known(HYDRO, "independent", "本击实际记录（未提供新记录时保留已保存命中）", draft.independentKnown)}<div class="calculator-fields" data-${HYDRO}-independent>${hydroEventFields(draft.independent, true)}</div><p class="calculator-hint">只填写本段适用生命值。露滴不要求未来扣血账本；结束激流只记录本次结束前真实充盈消耗；灵息之刺不要求生命输入。</p></details>`;
  return draftShell(HYDRO, rows + renderSnapshots(document, HYDRO, draft), draft.dirty);
}
export function renderIansanSwiftResolvedDraft(document: CalculatorDocument): string {
  if (!swiftCast(document)) return "";
  const draft = getDraft(document, SWIFT), row = draft.independent;
  const independent = document.scope === "single-hit" ? `<details><summary>独立本击的具体来源记录（可选）</summary>${known(SWIFT, "independent", "提供或编辑本击记录", draft.independentKnown)}<div class="calculator-fields" data-${SWIFT}-independent>${draftInput(SWIFT, "candidateId", "来源标识（swift）", row.candidateId)}${draftInput(SWIFT, "templateRole", "来源伤害段（swift）", row.templateRole)}${draftInput(SWIFT, "frame", "来源命中帧（25）", row.frame, true, 'min="0"')}${draftInput(SWIFT, "snapshotFrame", "来源取样帧（25）", row.snapshotFrame, true, 'min="0"')}${draftInput(SWIFT, "snapshotId", "来源快照标识（snapshot-25）", row.snapshotId)}${draftInput(SWIFT, "targetId", "本击实际命中敌人标识", row.targetId)}${draftSelect(SWIFT, "swiftQualifiedAtCast", "本击起手时实际满足雷霆飞缒资格", row.swiftQualifiedAtCast, booleans)}</div><p class="calculator-hint">来源唯一身份为 swift，第 25 帧同时取样与命中，快照标识为 snapshot-25。也可不提供此记录，直接使用上方共同面板与已发生本击的资格。</p></details>` : "";
  return draftShell(SWIFT, independent + renderSnapshots(document, SWIFT, draft), draft.dirty);
}

function captureDraft(document: CalculatorDocument, root: HTMLElement, family: Family): void {
  const draft = getDraft(document, family), editor = root.querySelector<HTMLElement>(`[data-${family}-editor]`)!;
  const read = (row: HTMLElement): Row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-${family}-draft-key]`)].map(input => [input.getAttribute(`data-${family}-draft-key`)!, input.value]));
  for (const kind of ["hp", "events", "independent"] as const) {
    const control = editor.querySelector<HTMLSelectElement>(`[data-${family}-known="${kind}"]`);
    if (control) draft[`${kind}Known`] = control.value === "provided";
  }
  for (const kind of ["hp", "events", "snapshots"] as const) if (editor.querySelector(`[data-${family}-collection="${kind}"]`)) {
    draft[kind] = [...editor.querySelectorAll<HTMLElement>(`[data-${family}-row="${kind}"]`)].map((element, index) => {
      const row = read(element), previous = draft[kind][index];
      if (kind === "snapshots" && previous?.origin && Object.entries(row).every(([key, value]) => (previous[key] ?? "") === value)) row.origin = previous.origin;
      return row;
    });
  }
  const independent = editor.querySelector<HTMLElement>(`[data-${family}-independent]`); if (independent) draft.independent = read(independent);
  draft.dirty = true;
}
function editDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement, family: Family): void {
  captureDraft(document, root, family);
  const draft = getDraft(document, family), action = button.dataset.action?.slice(family.length + 1);
  const kind = (["hp", "events", "snapshots"] as const).find(key => action === `add-${key}` || action === `remove-${key}`); if (!kind) return;
  if (action === `add-${kind}`) { draft[kind].push({}); if (kind !== "snapshots") draft[`${kind}Known`] = true; }
  else draft[kind].splice(Number(button.getAttribute(`data-${family}-row-index`)), 1);
}
const required = (row: Row, key: string): string => { const value = row[key]?.trim(); if (!value) throw new Error(`${key} 必须明确填写，未知不能作为零。`); return value; };
const numeric = (row: Row, key: string): number => { const value = Number(required(row, key)); if (!Number.isFinite(value)) throw new Error(`${key} 必须是有限数值。`); return value; };
function parseEvent(row: Row, family: Family, independent: boolean): Record<string, unknown> {
  const event: Record<string, unknown> = {};
  for (const key of ["candidateId", "templateRole", "snapshotId", "targetId"]) event[key] = required(row, key);
  for (const key of ["frame", "snapshotFrame", ...(family === HYDRO ? ["launchFrame"] : [])]) event[key] = numeric(row, key);
  const optionalNumbers = family === HYDRO ? ["hpReadFrame", "hpReadOrder", ...(independent ? ["actualCurrentHp", "actualMaxHp", "consumedHpThisCast"] : [])] : [];
  for (const key of optionalNumbers) if (row[key]?.trim()) event[key] = numeric(row, key);
  const booleanKey = family === HYDRO ? "observedSourceEvent" : "swiftQualifiedAtCast";
  if (independent && row[booleanKey]) event[booleanKey] = row[booleanKey] === "true";
  return event;
}
function parseSnapshots(rows: Row[]): Record<string, unknown> | undefined {
  if (!rows.length) return undefined;
  const snapshots: Record<string, unknown> = {};
  for (const row of rows) {
    const id = required(row, "id"); if (Object.hasOwn(snapshots, id)) throw new Error(`历史快照标识重复：${id}`);
    const stats: Record<string, number> = {}, snapshot: Record<string, unknown> = { stats, source: required(row, "source"), sourceRefs: (row.sourceRefs ?? "").split("\n").map(ref => ref.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
    for (const [key] of snapshotFields) { if (key === "stats.energyRecharge" && !row[key]?.trim()) continue; const value = numeric(row, key); if (key.startsWith("stats.")) stats[key.slice(6)] = value; else snapshot[key] = value; }
    Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
  }
  return snapshots;
}
function applyDraft(document: CalculatorDocument, root: HTMLElement, family: Family): void {
  if (!document.gameContext) return;
  captureDraft(document, root, family); const draft = getDraft(document, family), next: Record<string, unknown> = structuredClone(document.gameContext[contextKey(family)] ?? {});
  if (document.scope === "single-hit") {
    if (draft.independentKnown) next.independentEvent = parseEvent(draft.independent, family, true); else delete next.independentEvent;
  } else if (family === HYDRO) {
    if (draft.hpKnown) next.hpEvents = draft.hp.map(row => {
      const event: Record<string, unknown> = { id: required(row, "id"), kind: required(row, "kind"), frame: numeric(row, "frame"), order: numeric(row, "order") };
      if (row.kind === "observed-hp-state") { event.currentHp = numeric(row, "currentHp"); event.maxHp = numeric(row, "maxHp"); event.reason = required(row, "reason"); }
      return event;
    }); else delete next.hpEvents;
    if (draft.eventsKnown) {
      next.events = draft.events.map(row => parseEvent(row, family, false));
      next.targetContacts = Object.fromEntries(draft.events.filter(row => row.contact === "true" || row.contact === "false").map(row => [required(row, "candidateId"), row.contact === "true"]));
    } else { delete next.events; delete next.targetContacts; }
  }
  const snapshots = parseSnapshots(draft.snapshots); if (snapshots) next.snapshots = snapshots; else delete next.snapshots;
  if (family === HYDRO) {
    const parsed = travelerHydroResolvedCastContextSchema.safeParse(next);
    if (!parsed.success) throw new Error(`水主实际记录尚不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
    document.gameContext.travelerHydroResolvedCast = parsed.data;
  } else {
    const parsed = iansanSwiftResolvedCastContextSchema.safeParse(next);
    if (!parsed.success) throw new Error(`雷霆飞缒记录尚不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
    document.gameContext.iansanSwiftResolvedCast = parsed.data;
  }
  drafts.delete(keyFor(document, family));
}
export function captureTravelerHydroResolvedDraft(document: CalculatorDocument, root: HTMLElement): void { captureDraft(document, root, HYDRO); }
export function captureIansanSwiftResolvedDraft(document: CalculatorDocument, root: HTMLElement): void { captureDraft(document, root, SWIFT); }
export function editTravelerHydroResolvedDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void { editDraft(document, root, button, HYDRO); }
export function editIansanSwiftResolvedDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void { editDraft(document, root, button, SWIFT); }
export function applyTravelerHydroResolvedDraft(document: CalculatorDocument, root: HTMLElement): void { applyDraft(document, root, HYDRO); }
export function applyIansanSwiftResolvedDraft(document: CalculatorDocument, root: HTMLElement): void { applyDraft(document, root, SWIFT); }
export function resetTravelerHydroResolvedDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document, HYDRO)); }
export function resetIansanSwiftResolvedDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document, SWIFT)); }
export function hasTravelerHydroResolvedDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document, HYDRO))?.dirty === true; }
export function hasIansanSwiftResolvedDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document, SWIFT))?.dirty === true; }
