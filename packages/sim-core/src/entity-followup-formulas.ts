import definitions from "../../game-data/sources/entity-followup-casts/definitions.json";
import type { EntityFollowupTemplate } from "../../game-data/src/character-mappings/entity-followup-mappings";
import { entityFollowupCastContextSchema, type EntityFollowupCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula } from "./calculator-model";
import { compileEntityFollowupSchedule, type EntityFollowupCastKind, type EntityFollowupHitInstance } from "./entity-followup-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as EntityFollowupTemplate[];
const prefix = "entity-followup:", sourceId = `${prefix}source`;
const templateOf = (doc: CalculatorDocument) => templates.find(row => row.skillId === doc.gameContext?.skillId);
export const isEntityFollowupCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const ascensionOf = (doc: CalculatorDocument) => (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
const roleOf = (cast: EntityFollowupTemplate, hit: OrdinaryHit) => hit.entityFollowupEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
const stateOf = (context: EntityFollowupCastContext, hit: OrdinaryHit) => ({ ...context.sharedState, ...context.hitStates?.[hit.id] });
function identity(doc: CalculatorDocument, context: EntityFollowupCastContext, hit: OrdinaryHit): string {
  const event = hit.entityFollowupEvent;
  return JSON.stringify({ event: event ?? `independent:${hit.id}`, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    state: stateOf(context, hit), effectiveTalentLevel: doc.gameContext?.effectiveTalentLevel, skillTalentLevel: context.skillTalentLevel,
    ascension: ascensionOf(doc), constellation: doc.gameContext?.constellation, statsStableAcrossHits: context.statsStableAcrossHits });
}
function canonical(doc: CalculatorDocument, cast: EntityFollowupTemplate, roleKey: string, context: EntityFollowupCastContext,
  previous?: OrdinaryHit, event?: EntityFollowupHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!, id = event && doc.scope !== "single-hit" ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const level = role.abilityKey === cast.abilityKey ? doc.gameContext!.effectiveTalentLevel : context.skillTalentLevel;
  const hit: OrdinaryHit = { ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary", label: role.label + (event ? ` · 第${event.frame}帧 · ${event.ownerId}` : " · 独立实际命中"),
    element: event?.element ?? role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: term.values[(level ?? 1) - 1] ?? term.values[0]! })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0, critEligible: true,
    reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: role.sourceRefs,
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula; delete hit.resistanceReductionFormula;
  delete hit.critRateFormula; delete hit.critDamageFormula; delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.observedEntityEvent; delete hit.idleStanceEvent; delete hit.occurrence;
  if (event) {
    const { id: candidateId, ...metadata } = event;
    hit.entityFollowupEvent = { candidateId, ...metadata };
    const snapshot = context.snapshots?.[event.snapshotId];
    const currentConversion = previous?.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitEvents?.[id] === identity(doc, context, hit);
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    else if (!currentConversion) delete hit.finalSnapshot;
    if (JSON.stringify(previous?.entityFollowupEvent) !== JSON.stringify(hit.entityFollowupEvent) || snapshot && JSON.stringify(snapshot) !== JSON.stringify(previous?.finalSnapshot)) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
  return hit;
}
const input = (key: string, value: number, meaningKey: string, unit = "stat"): CalculatorFormula["inputs"][number] => ({ key, value, unit, minimum: 0, meaningKey, origin: "actual-entity-followup-observation" });
const formula = (ruleId: string, label: string, expression: CalculatorFormula["expression"], inputs: CalculatorFormula["inputs"], sourceRefs: string[]): CalculatorFormula => ({ ruleId, label, expression, inputs, sourceRefs, requirements: { maximumConstellation: 0 } });

function passive(doc: CalculatorDocument, cast: EntityFollowupTemplate, role: string, context: EntityFollowupCastContext, hit: OrdinaryHit): string[] {
  const issues: string[] = [], state = stateOf(context, hit), event = hit.entityFollowupEvent, asc = ascensionOf(doc);
  if (cast.characterSlug === "jahoda" && role === "robot") {
    if (!event || event.scalingFrame === undefined || event.damageMultiplier === undefined) issues.push("机器人独立命中需要保留实际吸收帧、吸收元素及A1乘数的来源事件。");
    if (state.actualAtkAtScaling === undefined) issues.push("需要本机器人吸收瞬间的雅珂达实际总攻击；不能以命中面板代替被冻结的伤害基数。");
    if (event?.damageMultiplier !== 1.3 || asc === undefined || asc < 1) issues.push("机器人伤害仅已核准固定来源Pyro A1的1.3分支；非Pyro未初始化乘数的来源冲突仍阻塞。");
    if (state.actualAtkAtScaling !== undefined && event?.damageMultiplier !== undefined) {
      const coefficient = hit.terms[0]!.coefficient;
      hit.baseDamageFormula = formula("jahoda-robot-absorption-atk-a7dc4bf", "机器人冻结基数：吸收时ATK×对应Q倍率×A1乘数",
        expr.mul(expr.input("absorptionAtk"), expr.input("robotCoefficient"), expr.input("a1Multiplier")),
        [input("absorptionAtk", state.actualAtkAtScaling, "本机器人吸收帧实际总攻击"), input("robotCoefficient", coefficient, "对应Q等级机器人倍率", "ratio"), input("a1Multiplier", event.damageMultiplier, "明确Pyro A1分支乘数", "ratio")], hit.sourceRefs);
    }
    if (asc === undefined) issues.push("需要实际突破阶段，以确定雅珂达A4。");
    const active = doc.scope === "one-cast" ? event?.ownA4EM : state.jahodaA4Active === undefined ? undefined : state.jahodaA4Active ? 100 : 0;
    const actual = asc !== undefined && asc < 4 ? 0 : active;
    if (actual === undefined) issues.push("需要本机器人命中时雅珂达A4是否实际有效；独立命中不推测此前治疗。");
    if (state.includedJahodaA4EM === undefined) issues.push("需要明确本击面板已含的雅珂达A4精通份额，0才表示未含。");
    if (hit.finalSnapshot && actual !== undefined && state.includedJahodaA4EM !== actual) issues.push("历史完整快照直接使用保存的精通，必须明确已正确包含本击实际A4份额；不能再给旧快照叠加精通调整。");
    if (actual !== undefined && state.includedJahodaA4EM !== undefined) hit.elementalMasteryAdjustment = {
      accounting: "add-to-panel", formula: formula("jahoda-a4-em-accounting-a7dc4bf", "雅珂达A4：本击实际100或0精通−面板已含份额",
        expr.sub(expr.input("actualA4EM"), expr.input("includedA4EM")), [input("actualA4EM", actual, "本击取样时实际自身A4精通"), input("includedA4EM", state.includedJahodaA4EM, "本击面板已含自身A4精通")], hit.sourceRefs),
    };
  }
  if (cast.characterSlug === "nicole") {
    if ((doc.scope === "single-hit" ? state.nicoleSkillBuffAbsentAtSnapshot : context.nicole?.noSkillBuffThroughout) !== true) issues.push("需明确此命中没有尼可E／A1升级面板状态；未实现的升级时序及突破门控不能默认为已含。独立命中只需本击状态，无需未来全程确认。");
    if (role === "projection") {
      if (!event) issues.push("独立造影必须保留实际归属角色、元素及触发事件，不能使用尼可模板元素和面板。");
      if (event && (event.triggerFrame === undefined || event.triggerFrame < 109 || event.triggerFrame > 1309 || event.frame !== event.triggerFrame + 30 || event.snapshotFrame !== event.frame)) issues.push("造影须由109至1309帧有效状态内的实际触发产生，执行和归属者快照必须在触发后30帧，不能使用其他时点面板。");
      if (event && !context.snapshots?.[event.snapshotId]) issues.push(`造影必须提供归属角色${event.ownerId}在第${event.snapshotFrame}帧的实际完整快照，不能借用尼可共同构筑。`);
      if (hit.reaction !== "none" || hit.additiveReaction !== undefined) issues.push("固定来源造影附着量为0，不能指定增幅或激化反应。");
      if (event?.hexereiBonus === undefined) issues.push("造影缺少实际魔导资格判定，不能猜测额外基伤。");
      if (state.includedAdditiveBaseDamage === undefined) issues.push("需要本击附加基伤中已含的尼可魔导份额，避免重复计算。");
      if (event?.hexereiBonus && state.nicoleAtkAtProjection === undefined) issues.push("魔导造影需要投影执行帧尼可的实际总攻击，不能用触发角色ATK代替。");
      if (event?.hexereiBonus !== undefined && state.includedAdditiveBaseDamage !== undefined && (!event.hexereiBonus || state.nicoleAtkAtProjection !== undefined)) {
        const inputs = [input("includedHexereiBase", state.includedAdditiveBaseDamage, "附加基伤已含尼可魔导数值", "damage")];
        let actual = expr.value(0);
        if (event.hexereiBonus) { inputs.push(input("nicoleProjectionAtk", state.nicoleAtkAtProjection!, "投影执行帧尼可实际总攻击")); actual = expr.mul(expr.input("nicoleProjectionAtk"), expr.value(3)); }
        hit.additiveBaseFormula = formula("nicole-projection-hexerei-b4ae769", "尼可魔导造影：合资格时3×执行帧尼可ATK−已含份额", expr.sub(actual, expr.input("includedHexereiBase")), inputs, hit.sourceRefs);
      }
    }
  }
  return issues;
}

export function prepareEntityFollowupCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = entityFollowupCastContextSchema.parse(game.entityFollowupCast ?? {});
  game.entityFollowupCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previous = (role: string) => [...old.values()].find(hit => !hit.entityFollowupEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonical(result, cast, role, context, previous(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(role => role.sourceRefs))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源显式完整实体观察协议；来源一致不等于游戏实测认证。", sourceRefs: refs });
  const missing = oldHits.filter((hit): hit is Extract<CalculatorHit, { kind: "blocked" }> => hit.kind === "blocked" && selected.has(hit.id)).flatMap(hit => hit.reasons);
  if (game.constellation !== 0) missing.push("本实体完整协议仅支持明确C0。");
  if (game.effectiveTalentLevel > 15) missing.push("有效天赋超出固定来源1至15级。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit); if (!role || !cast.roles[role]) return hit;
      const saved = context.independentEvent?.templateRole === role ? context.independentEvent : hit.entityFollowupEvent;
      if (!saved) return canonical(result, cast, role, context, hit);
      const { candidateId: id, ...metadata } = saved;
      return canonical(result, cast, role, context, hit, { id, ...metadata });
    }) : representatives();
  } else {
    const schedule = compileEntityFollowupSchedule(cast.skillId as EntityFollowupCastKind, context, { ascension: ascensionOf(result) });
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonical(result, cast, event.templateRole, context, old.get(`${cast.skillId}:${event.id}`) ?? previous(event.templateRole), event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "完整观察期间未命中所选敌人", kind: "non-damaging", reason: "全部来源机会已明确接触或落空，没有所选目标伤害，不自动补造。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击来源、归属、取样与已含份额明确。", sourceRefs: refs });
    hits.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const issues: string[] = [], role = roleOf(cast, hit), event = hit.entityFollowupEvent;
    if (!role || !cast.roles[role]) { dependency(`${prefix}${hit.id}`, ["本击缺少有效来源伤害角色。"], [hit]); continue; }
    if (event) {
      if (context.targetId && event.targetId !== context.targetId) issues.push("独立命中目标与当前明确所选敌人不一致。");
      if (!(cast.characterSlug === "nicole" && role === "projection") && context.casterId && event.ownerId !== context.casterId) issues.push("此自身伤害事件的归属必须是实际施放者。");
      if (cast.characterSlug === "jahoda" && role === "robot") {
        const scaling = event.scalingFrame;
        if (scaling === undefined || event.snapshotFrame !== event.frame || event.frame > 790 || event.frame < scaling + 41 || (event.frame - scaling - 41) % 140 !== 0 ||
          !((scaling >= 6 && (scaling - 6) % 46 === 0) || (scaling >= 47 && (scaling - 47) % 46 === 0))) issues.push("机器人事件不符合已支持Pyro A1的两台吸收检查相位、41帧启动及140帧攻击间隔，或已超过790帧寿命。");
        if (!["pyro", "hydro", "electro", "cryo"].includes(event.element)) issues.push("机器人只能使用实际吸收的火水雷冰元素。");
      } else if (!(cast.characterSlug === "nicole" && role === "projection")) {
        if (event.element !== cast.roles[role]!.element) issues.push("本伤害角色的固定来源元素不符。");
        let expected = false;
        if (cast.characterSlug === "jahoda") expected = role === "initial" && event.frame === 43 && event.snapshotFrame === 0;
        if (cast.characterSlug === "nicole") expected = role === "initial" && event.frame === 108 && event.snapshotFrame === 108;
        if (cast.characterSlug === "odette") {
          const burst = cast.abilityKey === "combat3", end = burst ? 1263 : 1285, first = burst ? 253 : 157;
          expected = event.snapshotFrame === event.frame && (role === "initial" && event.frame === 23 || role === "slash" && [112, 128, 140].includes(event.frame) || role === "final" && event.frame === 144 ||
            role === "plume" && event.frame >= first && event.frame <= end && (event.frame - first) % 234 === 0 ||
            role === "wing" && event.frame >= first + 109 && event.frame <= end && (event.frame - first - 109) % 234 === 0);
        }
        if (!expected) issues.push("独立来源事件的伤害帧或取样帧不符合此固定角色分支。");
      }
    }
    if (cast.roles[role]!.abilityKey !== cast.abilityKey && context.skillTalentLevel === undefined) issues.push("Q的实体伤害使用E天赋，必须明确独立E等级。");
    if (event && result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`缺少本击实际进攻快照${event.snapshotId}，不能借用其他帧面板。`);
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) issues.push("来源事件、观察、面板或实际被动条件变化，旧物化面板不能沿用，请重新应用构筑或导入快照。");
    issues.push(...passive(result, cast, role, context, hit));
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const selectedHits = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : selectedHits.length === result.hits.length && !selectedHits.some(hit => hit.dependencies.some(id => result.dependencies.find(row => row.id === id)?.status === "missing")) ? "complete-cast" : "selected-components";
  game.attributionPolicy = cast.characterSlug === "nicole" ? "本次尼可Q初击归尼可；实际触发的造影归触发角色，伤害等级、面板及元素来自实际归属者，魔导额外基伤另读尼可。其他触发攻击本体不并入Q。" : "只合计本次新生C0实体在明确观察条件下的初击与完整生命周期伤害；其他动作、升级、刷新、治疗和反应行为不被自动补造。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("实体续段协议：")), ...cast.assumptions.map(row => `实体续段协议：${row}`)];
  return result;
}

export function resetEntityFollowupPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isEntityFollowupCastAction(document)) return;
  const context = document.gameContext!.entityFollowupCast ??= {}; delete context.finalizedHitEvents;
  // An independently supplied historical actor panel is unaffected by changing
  // the caster's current equipment. Preserve its explicit accounting first.
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") {
    context.hitStates[hit.id] = stateOf(context, hit);
  }
  const reset = (state: NonNullable<EntityFollowupCastContext["sharedState"]>) => {
    if (mode === "fresh-equipment") { state.includedAdditiveBaseDamage = 0; state.includedJahodaA4EM = 0; }
    else { delete state.includedAdditiveBaseDamage; delete state.includedJahodaA4EM; }
  };
  reset(context.sharedState ??= {});
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    reset(context.hitStates[hit.id] ??= {}); if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
  }
}
export function finalizeEntityFollowupPanelAccounting(document: CalculatorDocument): void {
  if (!isEntityFollowupCastAction(document)) return;
  const context = document.gameContext!.entityFollowupCast ??= {};
  context.hitStates ??= {};
  if (document.gameContext!.skillId === "entity-followup-jahoda-burst-c0") {
    for (const hit of document.hits) if (hit.kind === "ordinary" && hit.entityFollowupEvent?.templateRole === "robot" && hit.finalSnapshot?.origin === "equipment-conversion") {
      const state = context.hitStates[hit.id] ??= {};
      const actual = (ascensionOf(document) ?? 0) < 4 ? 0 : document.scope === "one-cast" ? hit.entityFollowupEvent.ownA4EM : stateOf(context, hit).jahodaA4Active === true ? 100 : 0;
      if (actual !== undefined) state.includedJahodaA4EM = actual;
    }
  }
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, context, hit)]));
}
export function entityFollowupEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.entityFollowupEvent) return [];
  const event = hit.entityFollowupEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label] of [["frame", event.frame, "实体伤害实际帧"], ["snapshotFrame", event.snapshotFrame, "实际归属者进攻快照帧"], ["scalingFrame", event.scalingFrame, "机器人独立基数冻结帧"], ["triggerFrame", event.triggerFrame, "造影实际触发帧"]] as const) {
    if (value !== undefined) trace.add(`entity-followup.${key}`, label, expr.input(key), [traceInput(key, value, "frames", "fixed-source-observed-entity", `${event.candidateId}，归属${event.ownerId}，目标${event.targetId}`)], { unit: "frames" });
  }
  return trace.nodes;
}
