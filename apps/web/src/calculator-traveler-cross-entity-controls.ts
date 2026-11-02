import {
  compileTravelerCrossEntitySchedule, travelerCrossEntityCastContextSchema, TRAVELER_CROSS_ENTITY_CAST_KINDS,
  type CalculatorDocument,
} from "@genshin-dps-lab/sim-core";
import { travelerCrossSourceTemplates } from "../../../packages/game-data/src/character-mappings/traveler-cross-source-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.travelerCrossEntityCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["travelerCrossEntityCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
type Kind = typeof TRAVELER_CROSS_ENTITY_CAST_KINDS[number];
const castOf = (document: CalculatorDocument): Kind | undefined => TRAVELER_CROSS_ENTITY_CAST_KINDS.find(kind => kind === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, integer = false): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空"${key.includes("elementDamageBonuses.") ? "" : ' min="0"'}${key.endsWith("includedC6ResistanceReduction") ? ' max="0.2"' : ""} step="${integer ? "1" : "any"}"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const choice = (key: string, label: string, value: string | undefined, options: ReadonlyArray<readonly [string, string]>): string =>
  `<label>${esc(label)}<select data-source-cast-enum-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option>${options.map(([key, label]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
const elements = [["pyro", "火"], ["hydro", "水"], ["cryo", "冰"], ["electro", "雷"]] as const;
function anemoFields(document: CalculatorDocument, context: Context, complete: boolean): string {
  const anemo = context.anemo, c6 = document.gameContext!.constellation >= 6, element = anemo?.absorptionElement ?? context.independentEvent?.absorbedElement;
  const importedBonus = element && document.build.mode === "imported-final" ? document.gameContext!.importedPanelDamageBonuses?.[element] : undefined;
  return `<div class="calculator-fields">${!complete && !context.independentEvent ? choice("anemo.singleHitRole", "这次已经发生的伤害", anemo?.singleHitRole ?? "tick", [["tick", "风元素本体"], ["absorbed-tick", "吸收后的元素附加"]]) : ""}${state("anemo.noAbsorption", "本次 Q 全程没有吸收元素（计算附加伤害请选择否）", anemo?.noAbsorption)}${choice("anemo.absorptionElement", "本次 Q 实际吸收的元素", anemo?.absorptionElement, elements)}${complete && c6 ? state("anemo.c6InitiallyInactive", "Q 起手时，这名敌人还没有本命座的风／吸收元素减抗", anemo?.c6InitiallyInactive) : ""}</div>
    ${element && anemo?.noAbsorption !== true ? document.build.mode === "equipment-derived"
      ? '<p class="calculator-hint">吸收附加按实际元素读取装备增伤；不借用风伤加成。构筑必须代表 Q 起手时的面板。</p>'
      : `<div class="calculator-fields">${numberField(`anemo.elementDamageBonuses.${element}`, `Q 起手时${elements.find(([key]) => key === element)?.[1]}元素最终伤害加成（0.5 表示 50%）`, anemo?.elementDamageBonuses?.[element] ?? importedBonus ?? undefined)}</div>` : ""}
    <p class="calculator-hint">所填敌人抗性用于本次各元素；若目标的风与吸收元素抗性不同，请按对应元素单击分别填写。这里不从敌人库推断各元素抗性。</p>
    <details${complete ? " open" : ""}><summary>吸收时点${c6 ? "与六命减抗记账" : "（单击可不填）"}</summary>${numberField("anemo.absorptionStartFrame", complete ? "首次实际成功吸收帧（相对 Q 起手）" : "已知的首次成功吸收帧（单击可留空）", anemo?.absorptionStartFrame, true)}<p class="calculator-hint">固定来源只在 39、57、75、93……345 帧检查；第一次成功后锁定，不从当前附着猜测。晚吸收只生成之后的附加；345 帧吸收已经赶不上334帧末击。</p>${c6 ? `<div class="calculator-fields">${!complete ? state("sharedState.c6ActiveBeforeHit", "这次伤害结算前，敌人已有对应元素的本命座减抗", context.sharedState?.c6ActiveBeforeHit) : ""}${numberField("sharedState.includedC6ResistanceReduction", "所填敌人抗性已扣除的本命座减抗（未含填 0；已含 20% 填 0.2）", context.sharedState?.includedC6ResistanceReduction)}</div><p class="calculator-hint">首击不能吃自己随后挂上的减抗。同帧先风伤、再吸收附加，最后各自挂减抗；实际落空不会挂减抗，后续命中只刷新不叠加。完整过程自动按更早实际命中逐元素推导；已有旧减抗请选实际单击。</p>` : ""}</details>`;
}

function hitFields(key: string, values: HitState, single: boolean): string {
  return `<div class="calculator-fields">${numberField(`${key}.actualEm`, "本击结算时的实际元素精通（含当时有效增益）", values.actualEm)}${state(`${key}.actualEmIncludesLotuslight`, "实时精通已正确包含当时有效的草灯 A1", values.actualEmIncludesLotuslight)}${numberField(`${key}.includedA4DamageBonus`, "本击增伤输入已含的草主 A4 份额（小数）", values.includedA4DamageBonus)}${single ? state(`${key}.untransformedAtHit`, "这一次草灯命中仍处于未转化状态", values.untransformedAtHit) : ""}</div>`;
}

/** Fixed-source candidates and actual contacts remain separate editable inputs. */
export function renderTravelerCrossEntityControls(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context: Context = document.gameContext!.travelerCrossEntityCast ?? {}, complete = document.scope !== "single-hit";
  const dendro = kind.includes("-dendro-"), template = travelerCrossSourceTemplates.find(cast => cast.skillId === kind);
  const schedule = complete ? compileTravelerCrossEntitySchedule(kind, context, document.gameContext!.constellation) : undefined;
  const common = state("trueMoonStoryBuffInactive", "本击没有「真月」剧情限定增益", context.trueMoonStoryBuffInactive) +
    textField("targetId", complete ? "本次所选敌人标识" : "已明确的目标标识（可留空；填写时须与本击一致）", context.targetId) +
    (complete ? textField("casterId", "本次施放者标识", context.casterId) +
      state("freshCastConfirmed", "本次为新施放，未混入前次实体或伤害", context.freshCastConfirmed) +
      state("noHitlag", "完整过程没有卡肉延长", context.noHitlag) + state("noInterruption", "本次施放及已排队伤害没有中断", context.noInterruption) +
      state("noReplacement", "没有重施、实体替换或状态重置", context.noReplacement) +
      state("fullObservedLifetime", "全部来源机会、落空与尾段均已实际观察", context.fullObservedLifetime) +
      numberField("observedThroughFrame", "实际观察到的末帧（相对起手）", context.observedThroughFrame, true) +
      state("statsStableAcrossHits", "共同面板确实代表本次来源冻结的进攻快照", context.statsStableAcrossHits) +
      (dendro ? state("dendro.noTransformation", "草灯全程没有水、雷、火转化", context.dendro?.noTransformation) +
        state("dendro.noGadgetRemoval", "草灯没有被提前移除", context.dendro?.noGadgetRemoval)
        : "") : "");
  const contacts = schedule ? `<details open><summary>来源候选与实际接触 · ${schedule.candidates.length} 次</summary><p class="calculator-hint">候选不是保证命中。逐一填写命中、落空或未知；完整观察至少覆盖第 ${schedule.requiredObservedThroughFrame} 帧，包含实际分支的来源尾段。来源冻结进攻面板为第 ${schedule.snapshotFrame} 帧。</p><div class="table-wrap"><table><thead><tr><th>来源候选</th><th>命中帧</th><th>取样帧与标识</th><th>实际接触</th></tr></thead><tbody>${schedule.candidates.map(hit => `<tr><td>${esc(hit.id)} · ${esc(hit.templateRole === "absorbed-tick" ? `吸收附加 · ${elements.find(([key]) => key === hit.absorbedElement)?.[1]}` : template?.roles.tick.label)}</td><td>${hit.frame}f</td><td>${hit.snapshotFrame}f · ${esc(hit.snapshotId)}</td><td>${state(`targetContacts.${hit.id}`, "是否实际命中所选敌人", context.targetContacts?.[hit.id])}</td></tr>`).join("")}</tbody></table></div><details><summary>来源生命周期说明</summary><ul>${schedule.decisions.map(decision => `<li>第 ${decision.frame} 帧：${esc(decision.reason)}</li>`).join("")}</ul></details></details>`
    : '<p class="calculator-hint">独立单击只还原这一次已经发生的命中、取样和实际状态，不要求完整队伍、未来接触或观察终点。当前构筑与目标仍在正常面板中编辑。</p>';
  const states = new Map(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, hit.label]));
  for (const hit of schedule?.candidates ?? []) if (!states.has(`${kind}:${hit.id}`)) states.set(`${kind}:${hit.id}`, `${template?.roles.tick.label ?? "草灯命中"} · ${hit.id} · 第 ${hit.frame} 帧`);
  const actualStates = dendro ? `<details open><summary>共同实际状态与已含份额</summary>${hitFields("sharedState", context.sharedState ?? {}, !complete)}<p class="calculator-hint">草主 A4 读取命中时实际精通；它与第 54 帧冻结面板中的精通不同。已含 A4 份额用于扣除重复增伤，明确未含才填 0。共同值仅用于没有逐击覆盖的字段。</p></details><details><summary>逐击实际状态覆盖</summary>${[...states].map(([id, label]) => `<fieldset data-traveler-cross-entity-hit-context="${esc(id)}"><legend>${esc(label)}</legend>${hitFields(`hitStates.${id}`, context.hitStates?.[id] ?? {}, !complete)}</fieldset>`).join("")}</details>` : "";
  const legend = dendro ? template?.label ?? kind : `风旅行者 Q · C${document.gameContext!.constellation} · ${complete ? "完整实际直接伤害" : "已发生单击"}`;
  const perHitC6 = !dendro && document.gameContext!.constellation >= 6 ? `<details><summary>逐击减抗已含份额覆盖（可选）</summary>${[...states].map(([id, label]) => `<fieldset><legend>${esc(label)}</legend>${numberField(`hitStates.${id}.includedC6ResistanceReduction`, "本击敌人抗性已含的本命座减抗（小数；空白沿用共同值）", context.hitStates?.[id]?.includedC6ResistanceReduction)}</fieldset>`).join("")}</details>` : "";
  return `<fieldset data-source-cast-controls="traveler-cross-entity"><legend>${esc(legend)}：实际实体与来源取样</legend><div class="calculator-fields">${common}</div>${dendro ? "" : anemoFields(document, context, complete)}${contacts}${actualStates}${perHitC6}${renderTravelerCrossEntityDraft(document)}<p class="calculator-hint">当前覆盖风 Q C0–C6 的明确无吸收或实际吸收分支／C0 无转化草灯；完整风 C6 要求目标起手无本命座旧减抗。有效 Q 等级已含命座，不重复加级。倍率采用两性各自的固定 Optimizer 15 级向量，行为采用固定 gcsim 来源；原冲突向量保留，状态为 provisional。这里不自动生成扩散、附着、能量或团队轮转。</p></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { independentKnown: boolean; independent: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const TRAVELER_CROSS_ENTITY_DRAFT_FIELD = "gameContext.travelerCrossEntityCast.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "取样时元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "普通独立加算基伤"], ["reactionBonus", "反应增伤（小数）"],
];
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.travelerCrossEntityCast;
  const draft: Draft = {
    independentKnown: context?.independentEvent !== undefined,
    independent: Object.fromEntries(Object.entries(context?.independentEvent ?? {}).map(([key, value]) => [key, String(value)])),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false,
  };
  drafts.set(keyFor(document), draft); return draft;
}
const input = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-traveler-cross-entity-draft-input data-traveler-cross-entity-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;

export function renderTravelerCrossEntityDraft(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context: Context = document.gameContext!.travelerCrossEntityCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const row = draft.independent, template = travelerCrossSourceTemplates.find(cast => cast.skillId === kind);
  const independent = complete ? "" : `<details open><summary>直接计算一记实际来源命中</summary><label>独立本击事件<select data-traveler-cross-entity-draft-input data-traveler-cross-entity-independent-known><option value="unknown"${draft.independentKnown ? "" : " selected"}>未提供；沿用已保存的本击</option><option value="provided"${draft.independentKnown ? " selected" : ""}>提供本击实际来源事件</option></select></label><div class="calculator-fields" data-traveler-cross-entity-independent-row>${input("candidateId", "本击实际记录标识", row.candidateId)}<label>实际伤害段<select data-traveler-cross-entity-draft-input data-traveler-cross-entity-draft-key="templateRole"><option value="">未知；选择来源段</option><option value="tick"${row.templateRole === "tick" ? " selected" : ""}>${esc(template?.roles.tick.label ?? "实体周期命中")}</option>${kind.includes("-anemo-") ? `<option value="absorbed-tick"${row.templateRole === "absorbed-tick" ? " selected" : ""}>吸收后的元素附加</option>` : ""}</select></label>${kind.includes("-anemo-") ? `<label>本击记录的实际吸收元素<select data-traveler-cross-entity-draft-input data-traveler-cross-entity-draft-key="absorbedElement"><option value="">未知；选择实际元素</option>${elements.map(([key, label]) => `<option value="${key}"${row.absorbedElement === key ? " selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}${input("frame", "本击实际命中帧（相对起手）", row.frame, true, 'min="0"')}${input("snapshotFrame", "本击实际进攻面板取样帧", row.snapshotFrame, true, 'min="0"')}${input("snapshotId", "本击实际快照标识", row.snapshotId)}${input("targetId", "本击实际命中敌人标识", row.targetId)}</div><p class="calculator-hint">来源核心核对本击帧与取样帧。只填写已经发生的这一击；${kind.includes("-dendro-") ? "本击仍未转化和实时精通在上方实际状态中填写。" : "本击可选风本体或实际吸收附加；两者均使用起手面板，吸收附加须明确自己的元素加成。"}历史面板可在下方提供；留空不生成过去数值。</p></details>`;
  const ids = complete ? [...new Set(compileTravelerCrossEntitySchedule(kind, context, document.gameContext!.constellation).candidates.map(hit => hit.snapshotId))]
    : [...new Set([...Object.keys(context.snapshots ?? {}), ...(draft.independentKnown && row.snapshotId?.trim() ? [row.snapshotId.trim()] : []), ...document.hits.flatMap(hit => hit.kind === "ordinary" && hit.travelerCrossEntityEvent ? [hit.travelerCrossEntityEvent.snapshotId] : [])])];
  const snapshots = `<details><summary>历史最终进攻快照（可选）· ${draft.snapshots.length} 份</summary><p class="calculator-hint">只有确有对应时点的历史数值才添加。取样标识：${ids.length ? ids.map(esc).join("、") : "填写本击实际来源事件的取样标识"}。草灯 A4 使用的命中时精通在上方单独编辑；这里的精通属于冻结面板。编辑快照或事件会由核心重新核对最终面板，旧转换属性不能自动沿用。</p>${draft.snapshots.map((snapshot, index) => `<fieldset data-traveler-cross-entity-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields">${input("id", "实际取样标识", snapshot.id)}${snapshotFields.map(([key, label, min, max]) => input(key, label, snapshot[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${input("source", "历史数值来源或记录说明", snapshot.source)}</div><label>来源引用（每行一条）<textarea data-traveler-cross-entity-draft-input data-traveler-cross-entity-draft-key="sourceRefs" rows="2" placeholder="明确记录或来源链接">${esc(snapshot.sourceRefs)}</textarea></label><button type="button" data-action="traveler-cross-entity-remove-snapshot" data-traveler-cross-entity-row-index="${index}">删除此快照</button></fieldset>`).join("")}<button type="button" data-action="traveler-cross-entity-add-snapshot">添加实际历史快照</button></details>`;
  return `<div data-traveler-cross-entity-editor>${independent}${snapshots}<p data-traveler-cross-entity-draft-status role="status" class="calculator-hint">${draft.dirty ? "本击事件或快照草稿尚未应用；请应用后再计算或导出。" : "本击事件与快照没有未应用编辑。"}</p><button type="button" data-action="traveler-cross-entity-apply">应用本击记录与快照</button><button type="button" data-action="traveler-cross-entity-reset">放弃未应用编辑</button></div>`;
}

export function captureTravelerCrossEntityDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRows = (kind: string): Row[] => [...root.querySelectorAll<HTMLElement>(`[data-traveler-cross-entity-${kind}-row]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-traveler-cross-entity-draft-key]")].map(control => [control.dataset.travelerCrossEntityDraftKey!, control.value])));
  const independent = root.querySelector<HTMLSelectElement>("[data-traveler-cross-entity-independent-known]");
  if (independent) { draft.independentKnown = independent.value === "provided"; draft.independent = readRows("independent")[0] ?? {}; }
  draft.snapshots = readRows("snapshot").map((row, index) => {
    const previous = draft.snapshots[index];
    if (previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin;
    return row;
  });
  draft.dirty = true;
}
export function editTravelerCrossEntityDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureTravelerCrossEntityDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "traveler-cross-entity-add-snapshot") draft.snapshots.push({});
  else if (button.dataset.action === "traveler-cross-entity-remove-snapshot") draft.snapshots.splice(Number(button.dataset.travelerCrossEntityRowIndex), 1);
}
export function applyTravelerCrossEntityDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureTravelerCrossEntityDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.travelerCrossEntityCast ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => {
    const parsed = Number(value);
    if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
    return parsed;
  };
  if (document.scope === "single-hit") {
    if (draft.independentKnown) {
      const event: Record<string, unknown> = {};
      for (const key of ["candidateId", "templateRole", "snapshotId", "targetId"] as const) { const value = draft.independent[key]?.trim(); if (value) event[key] = value; }
      if (event.templateRole === "absorbed-tick" && draft.independent.absorbedElement?.trim()) event.absorbedElement = draft.independent.absorbedElement.trim();
      for (const key of ["frame", "snapshotFrame"] as const) event[key] = numeric(draft.independent[key], `本击事件 ${key}`, true);
      next.independentEvent = event;
    } else delete next.independentEvent;
  }
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
  const parsed = travelerCrossEntityCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`风／草旅行者本击记录或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.travelerCrossEntityCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetTravelerCrossEntityDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasTravelerCrossEntityDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
