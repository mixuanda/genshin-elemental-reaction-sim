import { compileIdleStanceSchedule, idleStanceCastContextSchema, type CalculatorDocument, type IdleStanceCastKind } from "@genshin-dps-lab/sim-core";
import { idleStanceTemplates } from "../../../packages/game-data/src/character-mappings/idle-stance-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.idleStanceCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["idleStanceCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
const castOf = (document: CalculatorDocument) => idleStanceTemplates.find(cast => cast.skillId === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, options: { min?: number; max?: number; integer?: boolean } = {}): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const actionKinds = { normal: "普通攻击", charged: "重击", plunge: "下落攻击", skill: "元素战技", burst: "元素爆发", dash: "冲刺", jump: "跳跃", swap: "换人", "terminate-skill": "再次输入 E 终止姿态" };
const roleNames: Record<string, string> = { initial: "初击", hold: "长按伤害", pillar: "岩脊建立", resonance: "岩脊共鸣", illusion: "水影爆炸", doll: "袖的自动攻击" };

function specificControls(context: Context, slug: string, complete: boolean): string {
  switch (slug) {
    case "razor": return state("razor.hexerei", "本次是否开启魔导强化（此分支要求否）", context.razor?.hexerei);
    case "zhongli": return complete ? state("zhongli.noOtherGeoConstructs", "此前及全程没有其他岩造物", context.zhongli?.noOtherGeoConstructs) + state("zhongli.steleSurvives", "新岩脊确实建立并保留至第 1908 帧自然销毁", context.zhongli?.steleSurvives) + state("zhongli.shieldUnbroken", "本次玉璋护盾从第 48 帧保留至第 1248 帧，未破裂或覆盖", context.zhongli?.shieldUnbroken) + state("zhongli.insideShieldRadius", "所选目标全程处于护盾 7.5 米减抗范围内", context.zhongli?.insideShieldRadius) : "";
    case "tartaglia": return complete ? state("tartaglia.startsFromIdle", "本次近战切换从静止起手", context.tartaglia?.startsFromIdle) + state("tartaglia.noRiptideOrProjectiles", "没有旧断流、在途箭及后续断流击杀链", context.tartaglia?.noRiptideOrProjectiles) : "";
    case "yanfei": return state("yanfei.priorA1Inactive", "本次起手时此前丹火印产生的 A1 火伤未激活", context.yanfei?.priorA1Inactive);
    case "ayato": return complete ? numberField("ayato.illusionDelay", "水影实际爆炸帧（相对本次起手，35–360）", context.ayato?.illusionDelay, { min: 35, max: 360, integer: true }) : "";
    case "nilou": return complete ? state("nilou.noPriorBounty", "没有前次金杯的丰馈或丰穰之核状态残留", context.nilou?.noPriorBounty) : "";
    case "wanderer": return state("wanderer.noAbsorption", "本次 E 没有水／火／冰／雷元素吸收", context.wanderer?.noAbsorption) + state("wanderer.panelExcludesAbsorptionBonuses", "输入面板没有未触发的吸收攻击／暴击增益", context.wanderer?.panelExcludesAbsorptionBonuses);
    case "alhaitham": return complete ? state("alhaitham.hold", "本次 E 为长按（否表示点按）", context.alhaitham?.hold) + numberField("alhaitham.initialMirrors", "施放前琢光镜数量（此分支要求明确 0）", context.alhaitham?.initialMirrors, { min: 0, max: 3, integer: true }) : "";
    case "mika": return complete ? state("mika.initialTargetIsEnemy", "霜星信标首发对象为本次所选敌人", context.mika?.initialTargetIsEnemy) + numberField("mika.eligibleOtherEnemyCount", "10 米内除首发目标外的可选敌人数（此分支要求 0）", context.mika?.eligibleOtherEnemyCount, { min: 0, integer: true }) : "";
    case "kaveh": return complete ? state("kaveh.noDendroCores", "施放 Q 前范围内没有现存草原核", context.kaveh?.noDendroCores) + state("kaveh.initialCreatesNoDendroCore", "本次 Q 初击也没有生成新草原核", context.kaveh?.initialCreatesNoDendroCore) : "";
    case "gaming": return complete ? state("gaming.noPriorManChai", "此前没有仍在场的文仔，本次可正常派出并返回", context.gaming?.noPriorManChai) + numberField("gaming.manChaiReturnDelay", "文仔实际返回延迟（源码默认 100 帧，不自动采用）", context.gaming?.manChaiReturnDelay, { min: 1, integer: true }) : "";
    case "chiori": return (complete ? state("chiori.hold", "本次 E 为长按（否表示点按）", context.chiori?.hold) : "") + state("chiori.noGeoConstructs", "此前及全程没有岩造物", context.chiori?.noGeoConstructs) + state("chiori.priorA4Inactive", "此前 20% 岩伤 A4 增益未激活", context.chiori?.priorA4Inactive);
    default: return "";
  }
}

function accountingFields(key: string, values: HitState, slug: string, single: boolean, finalResistance: boolean): string {
  if (slug === "zhongli") return (single ? state(`${key}.zhongliShieldReductionActive`, "本击实际享受玉璋护盾减抗", values.zhongliShieldReductionActive) : "") +
    (finalResistance ? "<p class=\"calculator-hint\">本击已给出最终抗性，核心直接使用该实际值。</p>" : numberField(`${key}.includedResistanceReduction`, "目标抗性输入已含的护盾减抗份额（0.2 = 20%）", values.includedResistanceReduction));
  if (slug === "yanfei" || slug === "chiori") return numberField(`${key}.includedDamageBonus`, "本击增伤输入已含的本人 A1／A4 份额（小数）", values.includedDamageBonus) +
    (!single ? "" : slug === "yanfei" ? numberField(`${key}.yanfeiA1Seals`, "本击起手时实际 A1 丹火印份数（0–3）", values.yanfeiA1Seals, { min: 0, max: 3, integer: true }) : state(`${key}.chioriA4Active`, "本击实际享受本人 A4 岩伤增益", values.chioriA4Active));
  if (slug === "nilou" || slug === "alhaitham") return numberField(`${key}.${slug === "nilou" ? "scalingHp" : "scalingEm"}`, `施放第 0 帧实际${slug === "nilou" ? "生命上限" : "元素精通"}基数`, slug === "nilou" ? values.scalingHp : values.scalingEm, { min: 0 }) +
    state(`${key}.scalingStatMatchesPanel`, "该起手基数与本击采用面板的对应数值相同", values.scalingStatMatchesPanel);
  return "";
}

/** Normal scalar controls share the established source-cast input protocol. */
export function renderIdleStanceControls(document: CalculatorDocument): string {
  const cast = castOf(document);
  if (!cast) return "";
  const context = document.gameContext!.idleStanceCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = compileIdleStanceSchedule(cast.skillId as IdleStanceCastKind, context);
  const selected = new Set(document.selectedHitIds), slug = cast.sourceSlug;
  const common = complete ? textField("casterId", "施放角色标识", context.casterId) + textField("targetId", "所选敌人标识", context.targetId) +
    state("freshCastConfirmed", "全新施放，没有旧姿态、召唤物、标记或触发冷却", context.freshCastConfirmed) + state("noHitlag", "观察过程没有卡肉延长", context.noHitlag) +
    state("noInterruption", "施放与声明状态过程没有中断", context.noInterruption) + state("noReplacement", "没有额外重施放、替换、重置或角色死亡", context.noReplacement) +
    state("fullObservedLifetime", "已观察完整状态及所有已发出攻击的尾段", context.fullObservedLifetime) + numberField("observedThroughFrame", "实际观察到的末帧（相对起手）", context.observedThroughFrame, { min: 0, integer: true }) +
    state("statsStableAcrossHits", "除逐击明确差异外，完整过程的基础面板与装备稳定", context.statsStableAcrossHits) : "";
  const accounting = ["zhongli", "yanfei", "chiori", "nilou", "alhaitham"].includes(slug) ? `<details open><summary>共同实际状态</summary><div class="calculator-fields">${accountingFields("sharedState", context.sharedState ?? {}, slug, !complete, false)}</div><p class="calculator-hint">共同状态供未逐击覆盖的字段使用。已含份额未知时留空，明确未含才填 0；填写最终抗性的命中不再重复补减抗。起手 HP／EM 优先使用明确数值或 scaling:0 快照，不能从后续面板猜测。</p></details><details><summary>逐击实际状态与已含份额</summary>${document.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset data-idle-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${selected.has(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 已有最终快照" : ""}</legend><div class="calculator-fields">${accountingFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, slug, !complete, hit.effectiveResistance !== undefined)}</div></fieldset>`).join("")}</details>` : "";
  const contacts = complete ? `<details open><summary>候选攻击的实际接触 · ${schedule.candidates.length} 次机会</summary><p class="calculator-hint">命中、落空与未知分别记录；落空不会生成伤害。完整分支须确认全部候选。下列帧数由固定来源计算；修改点按／长按或实际延迟后会更新。</p><div class="calculator-fields">${schedule.candidates.map(hit => state(`targetContacts.${hit.id}`, `${roleNames[hit.templateRole] ?? hit.templateRole} · ${hit.id} · 命中 ${hit.frame}f / 取样 ${hit.snapshotFrame}f${hit.scalingSnapshotFrame === undefined ? "" : ` / 基数 ${hit.scalingSnapshotFrame}f`}：是否命中所选敌人`, context.targetContacts?.[hit.id])).join("")}</div><p class="calculator-hint">当前来源窗口至少覆盖第 ${schedule.requiredObservedThroughFrame} 帧；这只是所选分支的要求，不会替你填写实际观察值。</p></details>` : "<p class=\"calculator-hint\">独立已发生命中不要求未来生命周期或后续输入；下方只填写本击实际条件。</p>";
  return `<fieldset data-source-cast-controls="idle-stance"><legend>${esc(cast.label)}：实际输入与完整观察</legend><div class="calculator-fields">${common}${specificControls(context, slug, complete)}</div>${contacts}${accounting}${renderIdleStanceDraft(document)}<p class="calculator-hint">当前分支只覆盖明确 C0 的有限输入过程，未经实机确认。完整施放包括自主攻击及尾段；不等于任意普攻连招或团队轮转。未知保留为空，不默认为零、否或没有事件。</p></fieldset>`;
}

type DraftRow = Record<string, string>;
type Draft = { actionsKnown: boolean; actions: DraftRow[]; snapshots: DraftRow[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const IDLE_STANCE_DRAFT_FIELD = "gameContext.idleStanceCast.scheduleDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "独立加算基伤"], ["reactionBonus", "反应增伤（小数）"],
];
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document));
  if (saved?.dirty) return saved;
  const context = document.gameContext?.idleStanceCast;
  const draft: Draft = { actionsKnown: context?.followupActions !== undefined, actions: (context?.followupActions ?? []).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)]))),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false };
  drafts.set(keyFor(document), draft); return draft;
}
const draftInput = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-idle-draft-input data-idle-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;

/** Follow-up records and optional historical snapshots are ordinary row forms, never free JSON. */
export function renderIdleStanceDraft(document: CalculatorDocument): string {
  const cast = castOf(document);
  if (!cast) return "";
  const context = document.gameContext!.idleStanceCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const schedule = compileIdleStanceSchedule(cast.skillId as IdleStanceCastKind, context), wanderer = cast.sourceSlug === "wanderer";
  const ids = [...new Set(schedule.candidates.flatMap(hit => [hit.snapshotId, ...(hit.scalingSnapshotId ? [hit.scalingSnapshotId] : [])]))];
  const actions = complete ? `<details open><summary>实际后续输入 · ${draft.actions.length} 条</summary><label>后续输入记录<select data-idle-draft-input data-idle-actions-known><option value="unknown"${draft.actionsKnown ? "" : " selected"}>未知；未提供完整记录</option><option value="provided"${draft.actionsKnown ? " selected" : ""}>已完整提供（零条＝明确没有后续动作）</option></select></label><p class="calculator-hint">${wanderer ? "此分支要求且只允许一次终止 E 输入，起手在第 28–599 帧；还须观察其后 26 帧落地。" : "此分支要求完整窗口没有后续动作。若实际有动作，请如实记录；核心会说明该分支不能涵盖的触发。"}</p>${draft.actions.map((row, index) => `<fieldset data-idle-action-row="${index}"><legend>后续输入 ${index + 1}</legend><div class="calculator-fields">${draftInput("id", "动作标识", row.id)}${draftInput("frame", "相对起手帧", row.frame, true, 'min="0"')}${draftInput("actorId", "动作角色标识", row.actorId)}<label>动作类型<select data-idle-draft-input data-idle-draft-key="kind"><option value="">未知；需明确</option>${Object.entries(actionKinds).map(([key, label]) => `<option value="${key}"${row.kind === key ? " selected" : ""}>${label}</option>`).join("")}</select></label></div><button type="button" data-action="idle-stance-remove-action" data-idle-row-index="${index}">删除此输入</button></fieldset>`).join("")}<button type="button" data-action="idle-stance-add-action">${wanderer ? "添加终止 E 输入" : "添加实际后续输入"}</button></details>` : "";
  const snapshots = `<details><summary>历史最终快照（可选）· ${draft.snapshots.length} 份</summary><p class="calculator-hint">完整分支已经要求共同基础面板稳定，通常无需另填快照。只有确有独立历史记录时添加：${ids.length ? ids.map(esc).join("、") : "先明确动作分支以显示取样标识"}。明确填写全部最终数值与来源；这里不会复制当前装备或猜测历史值。目标抗性仍在逐击输入中填写。</p>${draft.snapshots.map((row, index) => `<fieldset data-idle-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-idle-draft-input data-idle-draft-key="id" value="${esc(row.id)}" list="idle-snapshot-identifiers" placeholder="例如 sample:48 或 scaling:0"></label>${snapshotFields.map(([key, label, min, max]) => draftInput(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${draftInput("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-idle-draft-input data-idle-draft-key="sourceRefs" rows="2" placeholder="明确的记录或来源链接">${esc(row.sourceRefs)}</textarea></label><button type="button" data-action="idle-stance-remove-snapshot" data-idle-row-index="${index}">删除此快照</button></fieldset>`).join("")}<datalist id="idle-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="idle-stance-add-snapshot">添加明确的历史快照</button></details>`;
  return `<div data-idle-stance-editor>${actions}${snapshots}<p data-idle-draft-status role="status" class="calculator-hint">${draft.dirty ? "后续输入或历史快照草稿尚未应用；请应用后再计算或导出。" : "后续输入与历史快照没有未应用编辑。"}</p><button type="button" data-action="idle-stance-apply">应用输入记录与快照</button><button type="button" data-action="idle-stance-reset">放弃未应用编辑</button></div>`;
}

export function captureIdleStanceDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRow = (row: HTMLElement): DraftRow => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-idle-draft-key]")].map(input => [input.dataset.idleDraftKey!, input.value]));
  const known = root.querySelector<HTMLSelectElement>("[data-idle-actions-known]");
  if (known) { draft.actionsKnown = known.value === "provided"; draft.actions = [...root.querySelectorAll<HTMLElement>("[data-idle-action-row]")].map(readRow); }
  draft.snapshots = [...root.querySelectorAll<HTMLElement>("[data-idle-snapshot-row]")].map((row, index) => {
    const values = readRow(row), previous = draft.snapshots[index];
    // Manual changes are historical declarations, not a fresh equipment conversion.
    if (previous?.origin && Object.entries(values).every(([key, value]) => previous[key] === value)) values.origin = previous.origin;
    return values;
  });
  draft.dirty = true;
}
export function editIdleStanceDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureIdleStanceDraft(document, root);
  const draft = getDraft(document), action = button.dataset.action;
  if (action === "idle-stance-remove-action") draft.actions.splice(Number(button.dataset.idleRowIndex), 1);
  else if (action === "idle-stance-remove-snapshot") draft.snapshots.splice(Number(button.dataset.idleRowIndex), 1);
  else if (action === "idle-stance-add-snapshot") draft.snapshots.push({});
  else if (action === "idle-stance-add-action") {
    let index = draft.actions.length + 1;
    while (draft.actions.some(row => row.id === `followup-${index}`)) index++;
    draft.actions.push({ id: `followup-${index}`, actorId: document.gameContext?.idleStanceCast?.casterId ?? "", ...(castOf(document)?.sourceSlug === "wanderer" ? { kind: "terminate-skill" } : {}) });
    draft.actionsKnown = true;
  }
}
export function applyIdleStanceDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureIdleStanceDraft(document, root);
  if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.idleStanceCast ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => {
    const parsed = Number(value);
    if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
    return parsed;
  };
  if (draft.actionsKnown) next.followupActions = draft.actions.map((row, index) => ({ id: row.id?.trim(), actorId: row.actorId?.trim(), kind: row.kind, frame: numeric(row.frame, `后续输入 ${index + 1} 的帧数`, true) }));
  else delete next.followupActions;
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
  const parsed = idleStanceCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`姿态输入或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.idleStanceCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetIdleStanceDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasIdleStanceDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
