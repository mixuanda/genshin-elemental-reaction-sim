import { compileMixedSourceSchedule, mixedSourceCastContextSchema, MIXED_SOURCE_CAST_KINDS, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { mixedSourceTemplates } from "../../../packages/game-data/src/character-mappings/mixed-source-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.mixedSourceCast.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["mixedSourceCast"]>;
type HitState = NonNullable<Context["sharedState"]>;
type Kind = typeof MIXED_SOURCE_CAST_KINDS[number];
const castOf = (document: CalculatorDocument): Kind | undefined => MIXED_SOURCE_CAST_KINDS.find(kind => kind === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, options: { integer?: boolean; min?: number; max?: number } = {}): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const names: Record<Kind, string> = { "mixed-lauma-hold-skill-c0": "菈乌玛 C0 · 长按战技", "mixed-flins-burst-c0": "菲林斯 C0 · 元素爆发", "mixed-odette-coda-c0": "Odette C0 · Coda 分支" };

function hitFields(key: string, values: HitState, kind: Kind, single: boolean): string {
  const lauma = kind === "mixed-lauma-hold-skill-c0", flins = kind === "mixed-flins-burst-c0";
  const number = (field: keyof HitState, label: string, bounds: { integer?: boolean; min?: number; max?: number } = { min: 0 }): string =>
    numberField(`${key}.${field}`, label, typeof values[field] === "number" ? values[field] as number : undefined, bounds);
  const ordinary = lauma ? number("includedDamageBonus", "普通段增伤输入已含的本人被动份额（小数）") +
    number("includedResistanceReduction", "目标抗性输入已含的本人减抗份额（普通／特殊段均需）") +
    (single ? state(`${key}.laumaOwnShredActive`, "本击伤害结算前本人减抗已实际生效", values.laumaOwnShredActive) : "") : "";
  const specific = lauma ? number("impactEm", "特殊命中当刻的实际精通（供固有基础提升使用）") + number("includedLaumaA1CritRate", "特殊段暴击率输入已含的本人 A1 份额（0–0.1）", { min: 0, max: 0.1 }) + number("includedLaumaA1CritDamage", "特殊段暴击伤害输入已含的本人 A1 份额（0–0.2）", { min: 0, max: 0.2 }) + (single ? state(`${key}.laumaBurstBuffInactive`, "本击特殊段没有本人 Q 增益", values.laumaBurstBuffInactive) : "")
    : flins ? number("impactAtk", "特殊命中当刻的实际攻击力（供固有基础提升使用）") +
      number("nonExtraAtk", "第 93 帧快照中本人 A4 实际采用的非 Extra 攻击力") + number("includedFlinsA4Em", "该进攻快照精通已含的本人 A4 精通份额（0–160）", { min: 0, max: 160 })
      : number("impactAtk", "特殊命中当刻的实际攻击力（供固有基础提升使用）") + number("polestarApplicationCount", "本击 Stellar Conduct 的实际极星应用次数（0–12）", { min: 0, max: 12, integer: true }) +
        number("odetteA1Stacks", "本击 A1 层数（0–4；留空仅可沿用已保存事件）", { min: 0, max: 4, integer: true }) + (single ? state(`${key}.odetteBurstBuffInactive`, "本击特殊段没有本人 Q 星烁增益", values.odetteBurstBuffInactive) : "");
  return `${ordinary ? `<h5>普通增伤与共用目标抗性</h5><div class="calculator-fields">${ordinary}</div>` : ""}<h5>被动取样与特殊段的实际条件</h5><div class="calculator-fields">${specific}${number("otherSpecialBaseBonus", "其他适用特殊基础提升（不重复本分支计算的本人被动）")}${number("otherReactionBonus", "其他适用特殊反应增伤（小数）")}${number("specialAdditive", "明确适用的特殊反应加算伤害")}${number("elevationMultiplier", "专属擢升总倍率（大于 0；明确无提升才填 1）")}</div>`;
}

/** Ordinary and special hits stay in one source cast while retaining independent per-hit accounting. */
export function renderMixedSourceControls(document: CalculatorDocument): string {
  const kind = castOf(document);
  if (!kind) return "";
  const context: Context = document.gameContext!.mixedSourceCast ?? {}, complete = document.scope !== "single-hit";
  const schedule = complete ? compileMixedSourceSchedule(kind, context) : undefined;
  const template = mixedSourceTemplates.find(cast => cast.skillId === kind), lauma = kind === "mixed-lauma-hold-skill-c0", flins = kind === "mixed-flins-burst-c0";
  const common = complete ? textField("casterId", "施放者标识", context.casterId) + textField("targetId", "所选敌人标识", context.targetId) +
    state("noHitlag", "完整过程没有卡肉延长", context.noHitlag) + state("noInterruption", "完整过程没有中断", context.noInterruption) +
    state("noReplacement", "没有重施、替换或重置本次过程", context.noReplacement) + state("fullObservedLifetime", "已观察完整过程及所有已发出攻击的尾段", context.fullObservedLifetime) +
    numberField("observedThroughFrame", "实际观察到的末帧（相对起手）", context.observedThroughFrame, { min: 0, max: 100000, integer: true }) +
    state("statsStableAcrossHits", "完整过程的共同面板与装备稳定", context.statsStableAcrossHits) : "";
  const lunar = lauma || flins ? numberField("moonsignLevel", "本次实际月兆等级（明确填写）", context.moonsignLevel, { min: 0, integer: true }) : "";
  const specific = lauma ? numberField("lauma.initializationEm", "本人来源初始化时实际记录的元素精通", context.lauma?.initializationEm, { min: 0 }) +
    (complete ? state("lauma.burstInactive", "完整过程没有本人爆发效果", context.lauma?.burstInactive) + numberField("lauma.initialDew", "本次起手的实际露数（1–3）", context.lauma?.initialDew, { min: 1, max: 3, integer: true }) +
      state("lauma.dewHistoryComplete", "起手至消耗前的露数变化已完整记录", context.lauma?.dewHistoryComplete) +
      state("lauma.noPriorShred", "所选目标没有前次本人减抗遗留", context.lauma?.noPriorShred) +
      state("lauma.noOtherMoonSongRefresh", "完整窗口没有其他月歌刷新", context.lauma?.noOtherMoonSongRefresh) : "")
    : flins ? (complete ? state("flins.symphonyInactive", "起手时 Symphony 状态未激活", context.flins?.symphonyInactive) : "")
      : complete ? numberField("odette.danceDoubleRemainingFrames", "起手时舞伴实体的实际剩余帧数", context.odette?.danceDoubleRemainingFrames, { min: 0, max: 1262, integer: true }) +
        numberField("odette.recastWindowRemainingFrames", "起手时再施放窗口的实际剩余帧数", context.odette?.recastWindowRemainingFrames, { min: 0, max: 394, integer: true }) +
        state("odette.specialSkillCooldownReady", "本次特殊战技的实际冷却已就绪", context.odette?.specialSkillCooldownReady) +
        state("odette.burstBuffInactive", "完整过程没有本人 Q 星烁增益", context.odette?.burstBuffInactive) +
        state("odette.remainsOnFieldThroughout", "本次声明窗口全程由本人在场", context.odette?.remainsOnFieldThroughout) +
        numberField("odette.a1StacksAtStart", "起手时实际 A1 层数（0–4）", context.odette?.a1StacksAtStart, { min: 0, max: 4, integer: true }) +
        state("odette.radianceHistoryComplete", "辉光相关事件与极星状态区间已完整观察", context.odette?.radianceHistoryComplete) +
        numberField("odette.priorStellarSwirlRemainingFrames", "起手前 Stellar Swirl 状态的实际剩余帧数", context.odette?.priorStellarSwirlRemainingFrames, { min: 0, max: 480, integer: true }) : "";
  const contacts = complete ? `<details open><summary>来源候选与实际接触 · ${schedule!.candidates.length} 次</summary><p class="calculator-hint">普通段和特殊段由同一来源日程生成。命中、落空与未知分别填写；初击之后才建立的状态不会追溯初击。当前来源至少要求观察到第 ${schedule!.requiredObservedThroughFrame} 帧，不会自动填写观察值。</p><div class="table-wrap"><table><thead><tr><th>候选／分支</th><th>命中帧</th><th>取样帧与标识</th><th>实际接触</th></tr></thead><tbody>${schedule!.candidates.map(hit => `<tr><td>${esc(hit.id)}<small>${esc(template?.roles[hit.templateRole]?.label ?? hit.templateRole)}</small></td><td>${hit.frame}f</td><td>${hit.snapshotFrame}f · ${esc(hit.snapshotId)}</td><td>${state(`targetContacts.${hit.id}`, "是否实际命中所选敌人", context.targetContacts?.[hit.id])}</td></tr>`).join("")}</tbody></table></div></details>` : '<p class="calculator-hint">独立单击只使用本击的实际面板、被动和来源事件，不要求未来观察、后续接触或完整历史。已保存的特殊命中分支与已消耗露数／A1 层数必须随本击保留；缺少必要事件时由核心阻塞，不能用零替代。</p>';
  return `<fieldset data-source-cast-controls="mixed-source"><legend>${esc(template?.label ?? names[kind])}：普通与特殊段的实际条件</legend><div class="calculator-fields">${common}${lunar}${specific}</div>${contacts}<details open><summary>共同实际状态与已含份额</summary>${hitFields("sharedState", context.sharedState ?? {}, kind, !complete)}<p class="calculator-hint">共同值仅供未逐击覆盖的字段使用；每个字段是否适用于所选命中由来源核心判断。明确没有相应提升才填 0；专属擢升无提升才填 1。留空表示未知。普通增伤不能代替特殊反应基础提升，已含份额用于避免重复计算本人被动。</p></details><details><summary>逐击实际状态覆盖</summary>${document.hits.map(hit => `<fieldset data-mixed-source-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"} · ${esc(({ ordinary: "普通段", special: "特殊反应段", blocked: "待补条件", resolved: "已解析段", transformative: "剧变反应段", "non-damaging": "无伤害事件" })[hit.kind])}</legend>${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, kind, !complete)}</fieldset>`).join("")}</details>${renderMixedSourceDraft(document)}<p class="calculator-hint">本批是明确条件下的 C0 来源分支，状态为 provisional。普通段与特殊段分别通过各自的共享公式核心，仍可独立选择一记命中；此分支不认证任意队伍反应、自动触发历史或整名角色机制已完成。</p></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { dewKnown: boolean; dew: Row[]; swirlsKnown: boolean; swirls: Row[]; polestarKnown: boolean; polestar: Row[]; snapshots: Row[]; independentKnown: boolean; independent: Row; dirty: boolean };
const drafts = new Map<string, Draft>();
export const MIXED_SOURCE_DRAFT_FIELD = "gameContext.mixedSourceCast.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "元素精通", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "本击最终增伤（小数）"], ["additiveBaseDamage", "普通独立加算基伤"], ["reactionBonus", "反应增伤（小数）"],
];
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.mixedSourceCast;
  const rows = (values: ReadonlyArray<Record<string, unknown>> | undefined): Row[] => (values ?? []).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)])));
  const draft: Draft = { dewKnown: context?.lauma?.dewEvents !== undefined, dew: rows(context?.lauma?.dewEvents),
    swirlsKnown: context?.odette?.stellarSwirlFrames !== undefined, swirls: (context?.odette?.stellarSwirlFrames ?? []).map(frame => ({ frame: String(frame) })),
    polestarKnown: context?.odette?.polestarIntervals !== undefined, polestar: rows(context?.odette?.polestarIntervals),
    independentKnown: context?.independentEvent !== undefined, independent: Object.fromEntries(Object.entries(context?.independentEvent ?? {}).map(([key, value]) => [key, String(value)])),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false };
  drafts.set(keyFor(document), draft); return draft;
}
const input = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-mixed-source-draft-input data-mixed-source-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
const known = (kind: string, value: boolean): string => `<label>记录是否已完整提供<select data-mixed-source-draft-input data-mixed-source-known="${kind}"><option value="unknown"${value ? "" : " selected"}>未知；尚无完整记录</option><option value="provided"${value ? " selected" : ""}>已完整提供（零条＝明确没有此类事件）</option></select></label>`;
const remove = (kind: string, index: number): string => `<button type="button" data-action="mixed-source-remove-${kind}" data-mixed-source-row-index="${index}">删除此记录</button>`;
function renderIndependentEvent(kind: Kind, draft: Draft): string {
  const row = draft.independent, template = mixedSourceTemplates.find(cast => cast.skillId === kind);
  const boolean = (key: string, label: string): string => `<label>${esc(label)}<select data-mixed-source-draft-input data-mixed-source-draft-key="${key}"><option value="">未知；留空</option><option value="false"${row[key] === "false" ? " selected" : ""}>否</option><option value="true"${row[key] === "true" ? " selected" : ""}>是</option></select></label>`;
  const specific = kind === "mixed-lauma-hold-skill-c0" ? input("dewConsumed", "本次月绽放实际已消耗的草露（0–3；未知留空）", row.dewConsumed, true, 'min="0" max="3"') + boolean("laumaOwnShredActive", "本击结算前本人减抗已实际生效（无共同／逐击覆盖时采用）")
    : kind === "mixed-odette-coda-c0" ? input("odetteA1Stacks", "本击事件实际 A1 层数（0–4；无共同／逐击覆盖时采用）", row.odetteA1Stacks, true, 'min="0" max="4"') : "";
  return `<details open><summary>直接计算一记实际来源命中</summary><label>独立本击事件<select data-mixed-source-draft-input data-mixed-source-independent-known><option value="unknown"${draft.independentKnown ? "" : " selected"}>未提供；沿用已保存的本击</option><option value="provided"${draft.independentKnown ? " selected" : ""}>提供本击实际来源事件</option></select></label><div class="calculator-fields" data-mixed-source-independent-row>${input("candidateId", "实际命中记录标识", row.candidateId)}<label>本角色的实际伤害段<select data-mixed-source-draft-input data-mixed-source-draft-key="templateRole"><option value="">未知；选择实际伤害段</option>${Object.entries(template?.roles ?? {}).map(([key, role]) => `<option value="${esc(key)}"${row.templateRole === key ? " selected" : ""}>${esc(role.label)} · ${role.kind === "ordinary" ? "普通伤害" : "直接特殊反应伤害"}</option>`).join("")}</select></label>${input("frame", "本击实际命中帧（相对来源起手）", row.frame, true, 'min="0" max="100000"')}${input("snapshotFrame", "本击实际进攻面板取样帧", row.snapshotFrame, true, 'min="0" max="100000"')}${input("snapshotId", "本击实际快照标识（与下方历史快照一致）", row.snapshotId)}${input("targetId", "本击实际命中敌人标识", row.targetId)}${specific}</div><p class="calculator-hint">选择对应来源段并还原这次已发生的命中，可直接生成普通或特殊单击；无需先填完整施放或未来历史。命中帧、取样帧与段落资格由核心核对。这里的草露、减抗和 A1 是本击已发生状态，不从未来日程推算。减抗和 A1 若有明确共同／逐击状态，则优先采用其覆盖值；草露直接采用本事件消费数。面板与特殊加成仍须在构筑、历史快照和上方实际状态中明确提供，未知不按零计算。</p></details>`;
}

/** All observed histories are typed records, including an explicit distinction between unknown and empty. */
export function renderMixedSourceDraft(document: CalculatorDocument): string {
  const kind = castOf(document); if (!kind) return "";
  const context = document.gameContext!.mixedSourceCast ?? {}, draft = getDraft(document), complete = document.scope !== "single-hit";
  const ids = complete ? [...new Set(compileMixedSourceSchedule(kind, context).candidates.map(hit => hit.snapshotId))] : [...new Set([...Object.keys(context.snapshots ?? {}), ...(draft.independentKnown && draft.independent.snapshotId?.trim() ? [draft.independent.snapshotId.trim()] : []), ...document.hits.flatMap(hit => (hit.kind === "ordinary" || hit.kind === "special") && hit.mixedSourceEvent ? [hit.mixedSourceEvent.snapshotId] : [])])];
  const dew = complete && kind === "mixed-lauma-hold-skill-c0" ? `<details open><summary>起手后、消耗前的实际露数变化 · ${draft.dew.length} 条</summary>${known("dew", draft.dewKnown)}<p class="calculator-hint">逐条填写第 0–29 帧的实际获得或消耗，不用期望露数代替历史。初始露数在上方填写；没有事件时须明确选择完整空记录。第 29 帧其他事件与自身消耗的顺序尚未确定时，此分支会阻塞，不自动安排先后。</p>${draft.dew.map((row, index) => `<fieldset data-mixed-source-dew-row="${index}"><legend>露数变化 ${index + 1}</legend><div class="calculator-fields">${input("id", "记录标识", row.id)}${input("frame", "相对起手帧（0–29）", row.frame, true, 'min="0" max="29"')}<label>实际操作<select data-mixed-source-draft-input data-mixed-source-draft-key="kind"><option value="">未知；需明确</option><option value="gain"${row.kind === "gain" ? " selected" : ""}>获得</option><option value="consume"${row.kind === "consume" ? " selected" : ""}>消耗</option></select></label>${input("amount", "实际变化数量（1–3）", row.amount, true, 'min="1" max="3"')}</div>${remove("dew", index)}</fieldset>`).join("")}<button type="button" data-action="mixed-source-add-dew">添加实际露数变化</button></details>` : "";
  const odette = complete && kind === "mixed-odette-coda-c0" ? `<details open><summary>实际 Stellar Swirl 事件 · ${draft.swirls.length} 条</summary>${known("swirl", draft.swirlsKnown)}<p class="calculator-hint">填写真正发生的事件帧，不自动生成周期。没有新事件须明确提供空记录；起手前残余状态在上方单独声明。</p>${draft.swirls.map((row, index) => `<fieldset data-mixed-source-swirl-row="${index}"><legend>事件 ${index + 1}</legend>${input("frame", "实际事件帧（相对起手）", row.frame, true, 'min="0" max="100000"')}${remove("swirl", index)}</fieldset>`).join("")}<button type="button" data-action="mixed-source-add-swirl">添加实际事件帧</button></details><details open><summary>实际极星状态区间 · ${draft.polestar.length} 段</summary>${known("polestar", draft.polestarKnown)}<p class="calculator-hint">逐段填写实际存在区间，边界与到期判定由来源核心执行，不用整段默认激活替代观察。本击应用次数仍在共同／逐击状态中明确填写。</p>${draft.polestar.map((row, index) => `<fieldset data-mixed-source-polestar-row="${index}"><legend>极星区间 ${index + 1}</legend><div class="calculator-fields">${input("id", "区间标识", row.id)}${input("startFrame", "实际起始帧", row.startFrame, true, 'min="0" max="100000"')}${input("endFrame", "实际结束帧", row.endFrame, true, 'min="0" max="100000"')}</div>${remove("polestar", index)}</fieldset>`).join("")}<button type="button" data-action="mixed-source-add-polestar">添加实际极星区间</button></details>` : "";
  const snapshots = `<details><summary>历史最终快照（可选）· ${draft.snapshots.length} 份</summary><p class="calculator-hint">只有确有独立历史数值才添加，不能复制当前装备冒充过去快照。${complete ? "候选取样标识" : "已有本击历史快照标识"}：${ids.length ? ids.map(esc).join("、") : "尚未保存；新增时请填写本击实际来源事件的取样标识"}。特殊段的实时攻击／精通和被动已含份额仍按上方实际状态提供。</p>${draft.snapshots.map((row, index) => `<fieldset data-mixed-source-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields"><label>取样标识<input data-mixed-source-draft-input data-mixed-source-draft-key="id" value="${esc(row.id)}" list="mixed-source-snapshot-identifiers" placeholder="采用实际取样标识"></label>${snapshotFields.map(([key, label, min, max]) => input(key, label, row[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${input("source", "历史数值来源或记录说明", row.source)}</div><label>来源引用（每行一条）<textarea data-mixed-source-draft-input data-mixed-source-draft-key="sourceRefs" rows="2" placeholder="明确记录或来源链接">${esc(row.sourceRefs)}</textarea></label>${remove("snapshot", index)}</fieldset>`).join("")}<datalist id="mixed-source-snapshot-identifiers">${ids.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist><button type="button" data-action="mixed-source-add-snapshot">添加明确历史快照</button></details>`;
  return `<div data-mixed-source-editor>${complete ? "" : renderIndependentEvent(kind, draft)}${dew}${odette}${snapshots}<p data-mixed-source-draft-status role="status" class="calculator-hint">${draft.dirty ? "本击事件、观测记录或快照草稿尚未应用；请应用后再计算或导出。" : "本击事件、观测记录与快照没有未应用编辑。"}</p><button type="button" data-action="mixed-source-apply">应用实际记录与快照</button><button type="button" data-action="mixed-source-reset">放弃未应用编辑</button></div>`;
}

export function captureMixedSourceDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const readRows = (kind: string): Row[] => [...root.querySelectorAll<HTMLElement>(`[data-mixed-source-${kind}-row]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-mixed-source-draft-key]")].map(control => [control.dataset.mixedSourceDraftKey!, control.value])));
  const dew = root.querySelector<HTMLSelectElement>('[data-mixed-source-known="dew"]');
  if (dew) { draft.dewKnown = dew.value === "provided"; draft.dew = readRows("dew"); }
  const swirls = root.querySelector<HTMLSelectElement>('[data-mixed-source-known="swirl"]');
  if (swirls) { draft.swirlsKnown = swirls.value === "provided"; draft.swirls = readRows("swirl"); }
  const polestar = root.querySelector<HTMLSelectElement>('[data-mixed-source-known="polestar"]');
  if (polestar) { draft.polestarKnown = polestar.value === "provided"; draft.polestar = readRows("polestar"); }
  const independent = root.querySelector<HTMLSelectElement>("[data-mixed-source-independent-known]");
  if (independent) { draft.independentKnown = independent.value === "provided"; draft.independent = readRows("independent")[0] ?? {}; }
  draft.snapshots = readRows("snapshot").map((row, index) => {
    const previous = draft.snapshots[index];
    if (previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin;
    return row;
  });
  draft.dirty = true;
}
export function editMixedSourceDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureMixedSourceDraft(document, root);
  const draft = getDraft(document), action = button.dataset.action ?? "", index = Number(button.dataset.mixedSourceRowIndex);
  const removeMatch = /^mixed-source-remove-(dew|swirl|polestar|snapshot)$/.exec(action);
  if (removeMatch) { const rows = removeMatch[1] === "dew" ? draft.dew : removeMatch[1] === "swirl" ? draft.swirls : removeMatch[1] === "polestar" ? draft.polestar : draft.snapshots; rows.splice(index, 1); return; }
  if (action === "mixed-source-add-dew") { draft.dew.push({}); draft.dewKnown = true; }
  else if (action === "mixed-source-add-swirl") { draft.swirls.push({}); draft.swirlsKnown = true; }
  else if (action === "mixed-source-add-polestar") { draft.polestar.push({}); draft.polestarKnown = true; }
  else if (action === "mixed-source-add-snapshot") draft.snapshots.push({});
}
export function applyMixedSourceDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureMixedSourceDraft(document, root);
  if (!document.gameContext) return;
  const kind = castOf(document), draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.mixedSourceCast ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => {
    const parsed = Number(value);
    if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`);
    return parsed;
  };
  if (document.scope === "single-hit") {
    if (draft.independentKnown) {
      const row = draft.independent, event: Record<string, unknown> = {};
      for (const key of ["candidateId", "templateRole", "snapshotId", "targetId"] as const) { const value = row[key]?.trim(); if (value) event[key] = value; }
      for (const key of ["frame", "snapshotFrame"] as const) event[key] = numeric(row[key], `本击事件 ${key}`, true);
      if (kind === "mixed-lauma-hold-skill-c0") {
        if (row.dewConsumed?.trim()) event.dewConsumed = numeric(row.dewConsumed, "本击已消耗草露", true);
        if (row.laumaOwnShredActive === "true" || row.laumaOwnShredActive === "false") event.laumaOwnShredActive = row.laumaOwnShredActive === "true";
      }
      if (kind === "mixed-odette-coda-c0" && row.odetteA1Stacks?.trim()) event.odetteA1Stacks = numeric(row.odetteA1Stacks, "本击事件 A1 层数", true);
      next.independentEvent = event;
    } else delete next.independentEvent;
  }
  if (kind === "mixed-lauma-hold-skill-c0") {
    const lauma = { ...(next.lauma as Record<string, unknown> | undefined) };
    if (draft.dewKnown) lauma.dewEvents = draft.dew.map((row, index) => ({ id: row.id?.trim(), frame: numeric(row.frame, `露数记录 ${index + 1} 的帧`, true), kind: row.kind, amount: numeric(row.amount, `露数记录 ${index + 1} 的变化量`, true) }));
    else delete lauma.dewEvents;
    next.lauma = lauma;
  }
  if (kind === "mixed-odette-coda-c0") {
    const odette = { ...(next.odette as Record<string, unknown> | undefined) };
    if (draft.swirlsKnown) odette.stellarSwirlFrames = draft.swirls.map((row, index) => numeric(row.frame, `Stellar Swirl 事件 ${index + 1} 的帧`, true));
    else delete odette.stellarSwirlFrames;
    if (draft.polestarKnown) odette.polestarIntervals = draft.polestar.map((row, index) => ({ id: row.id?.trim(), startFrame: numeric(row.startFrame, `极星区间 ${index + 1} 的起始帧`, true), endFrame: numeric(row.endFrame, `极星区间 ${index + 1} 的结束帧`, true) }));
    else delete odette.polestarIntervals;
    next.odette = odette;
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
  const parsed = mixedSourceCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`混合来源记录或快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.mixedSourceCast = parsed.data;
  drafts.delete(keyFor(document));
}
export function resetMixedSourceDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasMixedSourceDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
