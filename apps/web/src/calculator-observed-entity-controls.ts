import { compileObservedEntitySchedule, observedEntityCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { observedEntityTemplates } from "../../../packages/game-data/src/character-mappings/observed-entity-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const contextPath = (key: string): string => `gameContext.observedEntityCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(contextPath(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, min = 0, max?: number, integer = false): string => `<label>${esc(label)}<input type="number" data-field="${esc(contextPath(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知" min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(contextPath(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;

type Field = { key: string; label: string; kind?: "number" | "frame" | "boolean" | "names" | "target"; options?: readonly string[] };
type Collection = { path: string; label: string; shape: "array" | "record" | "number-array" | "number-record"; fields: Field[]; hint: string; members?: boolean };
type Row = { key: string; values: Record<string, string>; members?: Record<string, string>[] };
type Draft = { collections: Record<string, { provided: boolean; rows: Row[] }>; snapshots: string; dirty: boolean };
const selectFields: Field[] = [
  { key: "frame", label: "本次选择检查帧", kind: "frame" }, { key: "inRangeTargetIds", label: "范围内完整目标名单（逗号分隔；[] 明确为空）", kind: "names" },
  { key: "selectedTargetId", label: "实际选中目标（— 表示明确未选中；空白未知）", kind: "target" }, { key: "completeRosterConfirmed", label: "已提供本次完整目标名单", kind: "boolean" },
];
const eventFields: Field[] = [{ key: "id", label: "事件标识" }, { key: "frame", label: "事件帧", kind: "frame" }, { key: "actorId", label: "来源角色标识" }];
const intervalFields: Field[] = [{ key: "startFrame", label: "开始帧", kind: "frame" }, { key: "endFrame", label: "结束帧", kind: "frame" }];
const memberFields: Field[] = [{ key: "actorId", label: "成员标识" }, { key: "currentHP", label: "发射时实际当前生命", kind: "number" }, { key: "maxHP", label: "发射时实际最大生命", kind: "number" }];

function collectionsFor(skill: string): Collection[] {
  if (skill === "observed-hutao-skill-c0") return [{ path: "hutao.chargedAttacks", label: "彼岸蝶舞期间的实际重击与血梅香记录", shape: "array", fields: [
    { key: "id", label: "重击事件标识" }, { key: "startFrame", label: "重击开始帧", kind: "frame" }, { key: "removedFrame", label: "重击动作结束／移除帧", kind: "frame" },
    { key: "nextState", label: "紧接的动作状态", options: ["burst", "other"] }, { key: "actorId", label: "实际重击角色标识" }, { key: "targetId", label: "实际重击目标标识" }, { key: "hitConfirmed", label: "此重击实际命中", kind: "boolean" },
  ], hint: "完整记录本次 E 相关的真实重击；核心按施放窗口、动作结束时点及实际命中判定血梅香的施加或刷新。重击本体不计入 E 伤害。没有重击时明确选择已提供并保留零行，未知不能当作没有。" }];
  if (skill === "observed-klee-burst-c0") return [{ path: "klee.waves", label: "六波实际额外攻击判定", shape: "array", fields: [{ key: "extraAt12", label: "+12 帧额外攻击实际发生", kind: "boolean" }, { key: "extraAt24", label: "+24 帧额外攻击实际发生", kind: "boolean" }], hint: "依次填写六波真实判定；未知不替换为最大攻击次数。" }];
  if (skill === "observed-kamisatoayato-burst-c0") return [{ path: "ayato.selections", label: "水花剑实际选敌记录", shape: "record", fields: selectFields, hint: "记录键使用 droplet-1 至 droplet-36。完整名单与实际选择分开记录；未选中可明确填 —，不能用所选目标自动补全范围名单。" }];
  if (skill === "observed-layla-skill-c0") return [
    { path: "layla.skillEvents", label: "护盾期间的战技事件", shape: "array", fields: eventFields, hint: "完整记录真实战技事件；明确没有时选择已提供并保留零行。" },
    { path: "layla.burstHitEvents", label: "晚星生成所需 Q 命中事件", shape: "array", fields: [...eventFields, { key: "hitConfirmed", label: "此事件实际命中", kind: "boolean" }, { key: "beforeFinalStarLaunch", label: "若与本轮第4颗星同帧：Q回调先于星发射", kind: "boolean" }], hint: "输入实际 Q 命中，不把 Q 释放次数当作命中次数。只有第4颗星发射同帧边界才需要先后声明：是＝Q先，否＝星先；其他时点可未知。" },
    { path: "layla.targetChecks", label: "飞星各次搜索与发射检查", shape: "record", fields: [{ key: "targetId", label: "本次实际目标（— 表示无目标）", kind: "target" }, { key: "closestWithin10Confirmed", label: "确认为 10 米内最近合法目标", kind: "boolean" }], hint: "记录键使用 volley-{轮次}-check-{检查次序}；搜索无目标也须明确记录。" },
  ];
  if (skill === "observed-yaoyao-burst-c0") return [
    { path: "yaoyao.movementStates", label: "冲刺／跳跃实际状态区间", shape: "array", fields: [...intervalFields, { key: "activeActorId", label: "当时在场角色" }, { key: "state", label: "实际动作状态", options: ["dash", "jump", "other"] }], hint: "记录实际状态起止，不由命中数反推。明确没有相关状态时填写已提供的空列表。" },
    { path: "yaoyao.throws", label: "每次萝卜投掷的实际选择", shape: "record", fields: [...selectFields, { key: "activeHpRatio", label: "当时在场角色生命比例（0–1）", kind: "number" }, { key: "activeActorId", label: "当时在场角色" }], hint: "实体投掷键 pet-{1..3}-throw-{次序}；A1 投掷键 a1-{帧}。真实生命、范围名单和目标选择均须保持独立。" },
  ];
  if (skill === "observed-furina-skill-ousia-c0") return [
    ...(["chevalmarin", "usher", "crabaletta"] as const).map((pet, index): Collection => ({ path: `furina.salonTicks.${pet}`, label: `${["海薇玛夫人", "乌瑟勋爵", "谢贝蕾妲小姐"][index]}实际检查帧`, shape: "number-array", fields: [{ key: "value", label: "实际帧", kind: "frame" }], hint: "按时间顺序填写，包含首次越过有效期的检查，供核心证明记录已完整。" })),
    { path: "furina.partyAtLaunch", label: "每次发射时的真实全队生命", shape: "record", fields: [{ key: "activeActorId", label: "在场角色标识" }, { key: "activeInBurstAnimation", label: "在场角色处于 Q 动画", kind: "boolean" }, { key: "completePartyConfirmed", label: "下方包含当时全部队员", kind: "boolean" }], members: true, hint: "记录键使用 chevalmarin-{次序}、usher-{次序}、crabaletta-{次序}。每次发射独立填写实际队伍生命；不假定四人满血。" },
    { path: "furina.a4MaxHPByRefreshFrame", label: "A4 每次刷新采用的最大生命", shape: "number-record", fields: [{ key: "value", label: "实际最大生命", kind: "number" }], hint: "记录键为实际刷新帧；数值来自该时点，不由现在面板回推。" },
    { path: "furina.maxHPByScalingFrame", label: "各缩放取样帧的最大生命", shape: "number-record", fields: [{ key: "value", label: "实际最大生命", kind: "number" }], hint: "记录键为来源规定的缩放取样帧；与 A4 刷新记录独立。" },
  ];
  if (skill === "observed-emilie-skill-c0" || skill === "observed-emilie-burst-c0") return [
    { path: "emilie.burningWithin20", label: "20 米内实际燃烧状态区间", shape: "array", fields: [...intervalFields, { key: "burningPresent", label: "区间内存在合资格燃烧目标", kind: "boolean" }], hint: "真实燃烧区间决定香韵与瓶等级；所选敌人是否燃烧另按逐击填写。" },
    ...(skill === "observed-emilie-burst-c0" ? [{ path: "emilie.burstSelections", label: "三级瓶各次实际选敌", shape: "record" as const, fields: selectFields, hint: "记录键 burst-1 至 burst-9；每次保留完整范围名单及实际选择。" }] : []),
  ];
  return [];
}

const drafts = new Map<string, Draft>();
export const OBSERVED_ENTITY_DRAFT_FIELD = "gameContext.observedEntityCast.scheduleDraft";
const keyFor = (doc: CalculatorDocument): string => `${doc.dataIdentity.datasetId}:${doc.gameContext?.characterId}/${doc.gameContext?.variantId ?? ""}/${doc.gameContext?.skillId}`;
const readPath = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], value);
function writePath(value: Record<string, unknown>, path: string, supplied: unknown): void {
  const keys = path.split("."); let target = value;
  for (const key of keys.slice(0, -1)) { if (!target[key]) { if (supplied === undefined) return; target[key] = {}; } target = target[key] as Record<string, unknown>; }
  if (supplied === undefined) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = supplied;
}
const stringValue = (value: unknown): string => value === undefined ? "" : value === null ? "—" : Array.isArray(value) ? value.length ? value.join(", ") : "[]" : String(value);
function scheduleFor(doc: CalculatorDocument) {
  const ascension = (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
  return compileObservedEntitySchedule(doc.gameContext!.skillId as Parameters<typeof compileObservedEntitySchedule>[0], doc.gameContext!.observedEntityCast ?? {}, ascension === undefined ? {} : { ascension });
}
function getDraft(doc: CalculatorDocument): Draft {
  const key = keyFor(doc), saved = drafts.get(key); if (saved?.dirty) return saved;
  const context = doc.gameContext?.observedEntityCast, draft: Draft = { collections: {}, snapshots: context?.snapshots ? JSON.stringify(context.snapshots, null, 2) : "", dirty: false };
  for (const config of collectionsFor(doc.gameContext?.skillId ?? "")) {
    const current = readPath(context, config.path);
    const entries = current === undefined ? [] : Array.isArray(current) ? current.map((value, index) => [String(index + 1), value] as const) : Object.entries(current as object);
    draft.collections[config.path] = { provided: current !== undefined, rows: entries.map(([key, raw]) => {
      const item: Record<string, unknown> = config.shape.startsWith("number-") ? { value: raw } : raw as Record<string, unknown>;
      const row: Row = { key, values: Object.fromEntries(config.fields.map(field => [field.key, stringValue(item[field.key])])) };
      if (config.members && Array.isArray(item.members)) row.members = item.members.map(member => Object.fromEntries(memberFields.map(field => [field.key, stringValue((member as Record<string, unknown>)[field.key])])));
      return row;
    }) };
  }
  drafts.set(key, draft); return draft;
}

function rowField(field: Field, value: string | undefined, member = false): string {
  const attr = `data-observed-${member ? "member" : "row"}-field="${field.key}"`;
  if (field.kind === "boolean" || field.options) {
    const options = field.kind === "boolean" ? [["false", "否"], ["true", "是"]] : field.options!.map(value => [value, ({ dash: "冲刺", jump: "跳跃", burst: "元素爆发", other: "其他" } as Record<string, string>)[value] ?? value]);
    return `<label>${esc(field.label)}<select ${attr}><option value="">未知；留空</option>${options.map(([key, label]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
  }
  return `<label>${esc(field.label)}<input type="text" ${attr} value="${esc(value)}" placeholder="未知；留空"${field.kind === "number" || field.kind === "frame" ? ' inputmode="decimal"' : ""}></label>`;
}

export function renderObservedEntityDraft(doc: CalculatorDocument): string {
  const draft = getDraft(doc);
  const hasRequiredRows = !["observed-klee-burst-c0", "observed-kaeya-burst-c0", "observed-hutao-skill-c0", "observed-aloy-skill-c0"].includes(doc.gameContext?.skillId ?? "");
  return `<div data-observed-entity-editor><p class="calculator-hint">填写实际事件与记录后点击「应用观测记录」。留空保持未知；空列表需明确选择已提供，不能当作完整历史。记录帧相对本次施放起点。</p>${hasRequiredRows ? '<button type="button" data-action="observed-entity-required-rows">按核心要求添加缺少的目标／队伍记录行</button>' : ""}${collectionsFor(doc.gameContext?.skillId ?? "").map(config => {
    const collection = draft.collections[config.path]!;
    return `<details open data-observed-collection="${config.path}"><summary>${esc(config.label)} · ${collection.rows.length} 条</summary><label>此记录是否已完整提供<select data-observed-provided="${config.path}"><option value="unknown"${!collection.provided ? " selected" : ""}>未知</option><option value="provided"${collection.provided ? " selected" : ""}>已提供（零行明确为空）</option></select></label><p class="calculator-hint">${esc(config.hint)}</p>${collection.rows.map((row, index) => `<fieldset data-observed-row="${config.path}" data-observed-row-index="${index}"><legend>${esc(config.label)} ${index + 1}</legend><div class="calculator-fields">${config.shape.endsWith("record") ? `<label>记录标识<input type="text" data-observed-record-key value="${esc(row.key)}" placeholder="所需记录标识"></label>` : ""}${config.fields.map(field => rowField(field, row.values[field.key])).join("")}</div>${config.members ? `<label>本次队员生命记录<select data-observed-members-known><option value="unknown"${!row.members ? " selected" : ""}>未知</option><option value="provided"${row.members ? " selected" : ""}>已提供</option></select></label>${(row.members ?? []).map((member, memberIndex) => `<div data-observed-member="${memberIndex}"><div class="calculator-fields">${memberFields.map(field => rowField(field, member[field.key], true)).join("")}</div><button type="button" data-action="observed-entity-member-remove" data-observed-collection="${config.path}" data-observed-index="${index}" data-observed-member-index="${memberIndex}">删除成员</button></div>`).join("")}<button type="button" data-action="observed-entity-member-add" data-observed-collection="${config.path}" data-observed-index="${index}">添加实际成员</button>` : ""}<button type="button" data-action="observed-entity-row-remove" data-observed-collection="${config.path}" data-observed-index="${index}">删除此条</button></fieldset>`).join("")}<button type="button" data-action="observed-entity-row-add" data-observed-collection="${config.path}">添加记录</button></details>`;
  }).join("")}<details><summary>历史最终进攻快照（高级）</summary><label>按候选表快照标识填写 JSON 对象<textarea data-observed-snapshots rows="10" spellcheck="false" placeholder="未知；留空">${esc(draft.snapshots)}</textarea></label><p class="calculator-hint">每份快照含 stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs；历史快照与命中时实际属性分开填写。</p></details><p class="calculator-hint" role="status" data-observed-draft-status>${draft.dirty ? "观测草稿尚未应用；请应用后再计算或导出。" : "当前观测记录已应用。"}</p><button type="button" data-action="observed-entity-apply">应用观测记录</button><button type="button" data-action="observed-entity-reset">放弃未应用的编辑</button></div>`;
}

export function captureObservedEntityDraft(doc: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(doc);
  for (const config of collectionsFor(doc.gameContext?.skillId ?? "")) {
    const provided = root.querySelector<HTMLSelectElement>(`[data-observed-provided="${config.path}"]`); if (!provided) continue;
    draft.collections[config.path] = { provided: provided.value === "provided", rows: [...root.querySelectorAll<HTMLElement>(`[data-observed-row="${config.path}"]`)].map((node, index) => {
      const row: Row = { key: node.querySelector<HTMLInputElement>("[data-observed-record-key]")?.value ?? String(index + 1), values: Object.fromEntries([...node.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-observed-row-field]")].map(input => [input.dataset.observedRowField!, input.value])) };
      if (node.querySelector<HTMLSelectElement>("[data-observed-members-known]")?.value === "provided") row.members = [...node.querySelectorAll<HTMLElement>("[data-observed-member]")].map(member => Object.fromEntries([...member.querySelectorAll<HTMLInputElement>("[data-observed-member-field]")].map(input => [input.dataset.observedMemberField!, input.value])));
      return row;
    }) };
  }
  const snapshots = root.querySelector<HTMLTextAreaElement>("[data-observed-snapshots]"); if (snapshots) draft.snapshots = snapshots.value;
  draft.dirty = true;
}

export function editObservedEntityDraft(doc: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureObservedEntityDraft(doc, root);
  if (button.dataset.action === "observed-entity-required-rows") {
    const byKind: Record<string, string> = { "ayato-selection": "ayato.selections", "layla-target": "layla.targetChecks", "yaoyao-throw": "yaoyao.throws", "furina-party": "furina.partyAtLaunch", "emilie-selection": "emilie.burstSelections" };
    for (const observation of scheduleFor(doc).requiredObservations) {
      const path = byKind[observation.kind], collection = path ? getDraft(doc).collections[path] : undefined;
      if (!collection || collection.rows.some(row => row.key === observation.key)) continue;
      const fields = collectionsFor(doc.gameContext!.skillId).find(config => config.path === path)!.fields;
      collection.rows.push({ key: observation.key, values: fields.some(field => field.key === "frame") ? { frame: String(observation.frame) } : {} });
      collection.provided = true;
    }
    return;
  }
  const collection = getDraft(doc).collections[button.dataset.observedCollection!]; if (!collection) return;
  const index = Number(button.dataset.observedIndex), action = button.dataset.action;
  if (action === "observed-entity-row-remove") collection.rows.splice(index, 1);
  else if (action === "observed-entity-row-add") { collection.rows.push({ key: "", values: {} }); collection.provided = true; }
  else if (action === "observed-entity-member-add") (collection.rows[index]!.members ??= []).push({});
  else if (action === "observed-entity-member-remove") collection.rows[index]!.members?.splice(Number(button.dataset.observedMemberIndex), 1);
}

function parseFields(fields: Field[], values: Record<string, string>, label: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key]?.trim(); if (!value) continue;
    if (field.kind === "number" || field.kind === "frame") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || field.kind === "frame" && (!Number.isSafeInteger(numeric) || numeric < 0)) throw new Error(`${label}：${field.label}须为${field.kind === "frame" ? "非负整数帧" : "有限数值"}。`);
      result[field.key] = numeric;
    } else if (field.kind === "boolean") result[field.key] = value === "true";
    else if (field.kind === "names") result[field.key] = value === "[]" ? [] : value.split(/[,，\n]/).map(value => value.trim()).filter(Boolean);
    else result[field.key] = field.kind === "target" && value === "—" ? null : value;
  }
  return result;
}

export function applyObservedEntityDraft(doc: CalculatorDocument, root: HTMLElement): void {
  captureObservedEntityDraft(doc, root);
  if (!doc.gameContext?.observedEntityCast) return;
  const draft = getDraft(doc), next = structuredClone(doc.gameContext.observedEntityCast) as Record<string, unknown>;
  for (const config of collectionsFor(doc.gameContext.skillId)) {
    const collection = draft.collections[config.path]!;
    if (!collection.provided) { writePath(next, config.path, undefined); continue; }
    const keys = new Set<string>();
    const rows = collection.rows.map((row, index) => {
      const label = `${config.label} ${index + 1}`, parsed = parseFields(config.fields, row.values, label);
      if (config.members && row.members) parsed.members = row.members.map((member, i) => parseFields(memberFields, member, `${label} 成员 ${i + 1}`));
      if (config.shape.endsWith("record")) { if (!row.key.trim() || keys.has(row.key.trim())) throw new Error(`${label}的记录标识不能为空或重复。`); keys.add(row.key.trim()); }
      return config.shape.startsWith("number-") ? parsed.value : parsed;
    });
    writePath(next, config.path, config.shape.endsWith("record") ? Object.fromEntries(collection.rows.map((row, index) => [row.key.trim(), rows[index]])) : rows);
  }
  if (!draft.snapshots.trim()) delete next.snapshots;
  else { try { next.snapshots = JSON.parse(draft.snapshots); } catch { throw new Error("历史快照不是有效 JSON，请修正后应用。"); } }
  const parsed = observedEntityCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`观测记录字段不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  doc.gameContext.observedEntityCast = parsed.data; drafts.delete(keyFor(doc));
}

export function resetObservedEntityDraft(doc: CalculatorDocument): void { drafts.delete(keyFor(doc)); }
export function hasObservedEntityDraft(doc: CalculatorDocument): boolean { return drafts.get(keyFor(doc))?.dirty === true; }

export function renderObservedEntityControls(doc: CalculatorDocument): string {
  const context = doc.gameContext?.observedEntityCast, cast = observedEntityTemplates.find(row => row.skillId === doc.gameContext?.skillId);
  if (!context || !cast) return "";
  const schedule = scheduleFor(doc), group = cast.scheduleKind;
  const fixedReferenceWindow = group === "kaeya-burst" || group === "aloy-skill";
  const lifecycleLabel = fixedReferenceWindow ? "完整来源参考窗口与接触记录" : "完整实体生命周期与事件记录";
  const lifetimeLabel = fixedReferenceWindow ? "记录覆盖声明的来源参考窗口及末次候选接触" : "记录覆盖完整有效期及末次攻击命中／落空";
  const description = group === "kaeya-burst"
    ? "本次使用固定来源的 13 次冰棱参考窗口，逐次确认是否接触目标；此近似不代表所有站位、碰撞和卡肉下的真实最大命中数。独立已发生单击只读取本击状态。"
    : group === "aloy-skill"
      ? "本次使用固定来源的主弹与小弹参数；小弹数量、弹道和延迟必须明确，起手没有旧线圈或冰驰状态。完整结果截止于声明的最后一枚来源小弹，不证明真实散落小弹的完整寿命；本 E 获得的后续普攻增益不并入 E 伤害。独立已发生单击只读取本击状态。"
      : group === "hutao-skill"
        ? "本次 E 伤害只包含真实施加或刷新后产生的血梅香，重击本体不并入总伤。起手生命、E 存续、实际重击与逐次命中分别记录；独立已发生血梅香不要求恢复未来重击历史。"
        : "本次按完整观察到的事件计算自身伤害。实际选敌、随机分支和落空分别明确；不从最大命中次数推测未知事件。独立单击只读取本击需要的实际状态。";
  let specific = "";
  if (group === "kaeya-burst") specific = state("kaeya.fixedSourceApproximationConfirmed", "明确采用固定来源的 13 次冰棱接触近似", context.kaeya?.fixedSourceApproximationConfirmed);
  if (group === "aloy-skill") specific = state("aloy.fixedSourceApproximationConfirmed", "明确采用固定来源的主弹／小弹时序近似", context.aloy?.fixedSourceApproximationConfirmed)
    + numberField("aloy.travelFrames", "主弹弹道帧数（来源参数）", context.aloy?.travelFrames, 0, undefined, true)
    + numberField("aloy.bombDelayFrames", "小弹延迟帧数（来源参数）", context.aloy?.bombDelayFrames, 0, undefined, true)
    + numberField("aloy.bombletCount", "明确声明的来源小弹数量", context.aloy?.bombletCount, 0, undefined, true)
    + state("aloy.allSourceBombletsDeclared", "本参考模型的全部来源小弹均已声明", context.aloy?.allSourceBombletsDeclared);
  if (group === "hutao-skill") specific = state("hutao.allChargedAttacksRecorded", "本次 E 相关的全部实际重击均已记录", context.hutao?.allChargedAttacksRecorded)
    + state("hutao.noSwapUntilNaturalEnd", "胡桃全程在场直至彼岸蝶舞自然结束", context.hutao?.noSwapUntilNaturalEnd)
    + numberField("hutao.exitFrame", "若提前退场，实际退场帧", context.hutao?.exitFrame, 0, undefined, true)
    + numberField("hutao.skillStartCurrentHP", "E 起手时实际当前生命", context.hutao?.skillStartCurrentHP)
    + numberField("hutao.skillStartMaxHP", "E 起手时实际最大生命（须大于 0）", context.hutao?.skillStartMaxHP)
    + numberField("hutao.skillStartBaseATK", "E 起手时实际基础攻击力（白字）", context.hutao?.skillStartBaseATK);
  if (group === "klee-burst") specific = state("klee.onFieldUntilEndConfirmed", "可莉全程在场直至状态自然结束", context.klee?.onFieldUntilEndConfirmed) + numberField("klee.exitFrame", "若提前退场，实际退场帧", context.klee?.exitFrame, 0, undefined, true);
  if (group === "layla-skill") specific = numberField("layla.shieldEndFrame", "实际护盾消失帧", context.layla?.shieldEndFrame, 0, undefined, true) + state("layla.shieldLifetimeConfirmed", "已确认护盾的实际存续及消失时点", context.layla?.shieldLifetimeConfirmed) + state("layla.allStarEventsRecorded", "全部晚星生成相关事件均已记录", context.layla?.allStarEventsRecorded);
  if (group === "yaoyao-burst") specific = state("yaoyao.noPreexistingYuegui", "起手时没有前次月桂遗留", context.yaoyao?.noPreexistingYuegui) + state("yaoyao.onFieldUntilEndConfirmed", "瑶瑶本人全程在场至 Q 状态结束", context.yaoyao?.onFieldUntilEndConfirmed) + numberField("yaoyao.exitFrame", "若提前退场，实际退场帧", context.yaoyao?.exitFrame, 0, undefined, true);
  if (group === "furina-ousia-skill") specific = state("furina.ousiaThroughoutConfirmed", "期间始终为荒性，未切换芒性", context.furina?.ousiaThroughoutConfirmed) + numberField("furina.a4FirstRefreshFrame", "A4 首次刷新帧（相对起手，−29 至 0）", context.furina?.a4FirstRefreshFrame, -29, 0, true);
  if (group === "emilie-skill" || group === "emilie-burst") specific = numberField("emilie.caseTravelFrames", "柔灯之匣实际弹道参数帧", context.emilie?.caseTravelFrames, 0, undefined, true) + state("emilie.arkheReady", "本次芒性攻击独立冷却可用", context.emilie?.arkheReady) + state("emilie.burningHistoryComplete", "已完整记录相关范围内燃烧历史", context.emilie?.burningHistoryComplete);
  type HitState = NonNullable<typeof context.sharedState>;
  const actualFields = (key: string, values: HitState = {}, role?: string): string => {
    if (group === "hutao-skill") return numberField(`${key}.actualHPRatioAtSnapshot`, "本次取样时实际生命比例（0–1）", values.actualHPRatioAtSnapshot, 0, 1)
      + state(`${key}.paramitaActiveAtSnapshot`, "独立单击：取样时彼岸蝶舞实际生效", values.paramitaActiveAtSnapshot)
      + numberField(`${key}.includedAttackBonus`, "攻击力输入已含的本次 E 加攻数值", values.includedAttackBonus)
      + numberField(`${key}.includedDamageBonus`, "火伤／增伤输入已含的本次低生命 A4 份额", values.includedDamageBonus);
    if (group === "layla-skill") return role === "initial" ? "" : numberField(`${key}.actualMaxHPAtScaling`, "飞星发射时实际最大生命（独立于进攻快照）", values.actualMaxHPAtScaling) + numberField(`${key}.includedAdditiveBaseDamage`, "基伤输入已含的 A4 飞星加算份额", values.includedAdditiveBaseDamage);
    if (group === "furina-ousia-skill") return numberField(`${key}.actualMaxHPAtScaling`, "本击基伤实际采用的最大生命（初击为起手；成员攻击为发射时）", values.actualMaxHPAtScaling) + (role === "initial" ? "" : numberField(`${key}.furinaPartyMembersAboveHalf`, "独立单击：发射时实际高于半血的队员人数", values.furinaPartyMembersAboveHalf, 0, 4, true) + numberField(`${key}.furinaA4MaxHPAtLastRefresh`, "本击之前最近一次 A4 刷新的实际最大生命", values.furinaA4MaxHPAtLastRefresh) + numberField(`${key}.includedDamageBonus`, "增伤输入已含的本击 A4 份额", values.includedDamageBonus));
    if (group === "emilie-skill" || group === "emilie-burst") return state(`${key}.targetBurningAtHit`, "本次伤害结算时所选目标实际处于燃烧", values.targetBurningAtHit) + numberField(`${key}.actualAtkAtHit`, "本次伤害结算时艾梅莉埃的实际攻击力", values.actualAtkAtHit) + numberField(`${key}.includedDamageBonus`, "增伤输入已含的对应 A4 份额", values.includedDamageBonus);
    return "";
  };
  const shared = actualFields("sharedState", context.sharedState);
  return `<fieldset data-source-cast-controls="observed-entity"><legend>${esc(cast.label)}：${fixedReferenceWindow ? "来源参考与实际接触" : "真实观测记录"}</legend><p class="calculator-hint">${esc(description)}</p><div class="calculator-fields">${state("statsStableAcrossHits", "除明确的逐击差异外，面板、装备、反应属性与目标条件稳定", context.statsStableAcrossHits)}${group === "yaoyao-burst" || group === "emilie-burst" ? numberField("skillTalentLevel", "所生成 E 伤害使用的实际战技有效天赋等级（独立于本次 Q）", context.skillTalentLevel, 1, 15, true) : ""}</div><details${doc.scope === "one-cast" ? " open" : ""}><summary>${lifecycleLabel}</summary><div class="calculator-fields">${textField("casterId", "施放者标识", context.casterId) + textField("targetId", "本次计算目标标识", context.targetId) + state("freshCastConfirmed", "全新施放，无旧实体、状态或冷却遗留", context.freshCastConfirmed) + state("noHitlag", "全程没有卡肉延长", context.noHitlag) + state("noInterruption", "没有未记录的中断或取消", context.noInterruption) + state("noReplacement", "没有重放、实体替换或额外重置", context.noReplacement) + state("fullObservedLifetime", lifetimeLabel, context.fullObservedLifetime) + numberField("observedThroughFrame", "已观察至本次起点后的帧", context.observedThroughFrame, 0, undefined, true) + specific}</div>${renderObservedEntityDraft(doc)}<details open><summary>逐次实际接触 · ${schedule.candidates.length} 个来源候选</summary><p class="calculator-hint">当前至少需要观察至第 ${schedule.requiredObservedThroughFrame} 帧；修改记录后应用以更新候选。每次目标选择和最终是否命中是不同事实。</p>${schedule.candidates.length ? `<div class="table-wrap"><table><thead><tr><th>候选攻击</th><th>命中帧</th><th>取样标识／帧</th><th>实际接触</th></tr></thead><tbody>${schedule.candidates.map(candidate => `<tr><td>${esc(cast.roles[candidate.templateRole]?.label ?? candidate.templateRole)} · ${esc(candidate.id)}</td><td>${candidate.frame}</td><td>${esc(candidate.snapshotId)} · ${candidate.snapshotFrame}</td><td>${candidate.canceled ? "来源已取消此在途攻击，不产生接触判定" : state(`targetContacts.${candidate.id}`, "实际命中本次计算目标", candidate.contact)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="calculator-hint">补充必要的来源记录后，核心将生成候选攻击。</p>'}</details>${schedule.requiredObservations.length ? `<details><summary>核心所需的观测记录</summary><ul>${schedule.requiredObservations.map(row => `<li>${esc(row.key)} · 第 ${row.frame} 帧：${esc(row.label)}</li>`).join("")}</ul></details>` : ""}${schedule.decisions.length ? `<details><summary>已执行的来源判定</summary><ul>${schedule.decisions.map(row => `<li>${esc(row.eventId)} · 第 ${row.frame} 帧：${esc(row.reason)}</li>`).join("")}</ul></details>` : ""}</details>${shared ? `<details open><summary>共同实际属性与已含份额</summary><div class="calculator-fields">${shared}</div><p class="calculator-hint">未知留空，只有明确未含才填 0。${group === "furina-ousia-skill" ? "完整芙宁娜施放的人数来自每次发射的实际全队生命记录；这里的人数只供独立已发生单击使用。" : group === "hutao-skill" ? "完整血梅香记录的彼岸蝶舞状态由实际 E 窗口导出；手填取样状态供独立已发生单击恢复，不能延长 E。" : ""}</p></details><details><summary>逐击实际状态覆盖</summary>${doc.hits.flatMap(hit => {
    if (hit.kind !== "ordinary") return [];
    const role = hit.observedEntityEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
    const fields = actualFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id], role); if (!fields) return [];
    return [`<fieldset data-observed-entity-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${doc.selectedHitIds.includes(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</legend><div class="calculator-fields">${fields}</div></fieldset>`];
  }).join("")}<p class="calculator-hint">逐击值覆盖允许使用的共同值；历史快照所对应的命中时实际属性须独立恢复，不能从当前面板推断。</p></details>` : ""}</fieldset>`;
}
