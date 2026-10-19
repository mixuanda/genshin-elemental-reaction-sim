import { kachinaCastContextSchema, type CalculatorDocument, type CalculatorHit, type KachinaCastContext } from "./calculator-model";
import { optimizerKachinaMappings } from "../../game-data/src/character-mappings/optimizer-kachina-mappings";
import { expr } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
type KachinaEvent = NonNullable<KachinaCastContext["events"]>[number];
const skillId = "kachina-skill-observed-lifecycle";
const prefix = "kachina-cast:";
const kqm = "https://library.keqingmains.com/characters/geo/kachina";
const eventIsSlam = (event: KachinaEvent) => event.kind === "riding-slam" || event.kind === "independent-slam";
export const isKachinaCastAction = (document: CalculatorDocument): boolean => document.gameContext?.skillId === skillId;

export interface KachinaCastSchedule {
  damageEvents: KachinaEvent[];
  issues: string[];
  endFrame?: number;
  complete: boolean;
}

/** The user records actual contacts and point balances; no unverified tick or cost is generated. */
export function compileKachinaCastSchedule(context: KachinaCastContext, requireComplete = true): KachinaCastSchedule {
  const issues: string[] = [], damageEvents: KachinaEvent[] = [], events = context.events ?? [];
  const add = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  if (!context.casterId || !context.targetId) add("须明确卡齐娜与本次计算目标的标识。");
  if (!context.startingMode) add("须明确本次 E 是长按搭乘，还是点按后独立放置。");
  if (!context.events) add("须提供实际事件列表；空列表必须显式提供。 ");
  if (requireComplete) {
    if (context.allActionsRecorded !== true) add("须确认搭乘切换、独立周期震荡、骑乘普攻震荡及夜魂变化均已完整记录。");
    if (context.fullObservedLifetime !== true) add("须确认观察覆盖冲天转转从本次 E 入场至消失的完整寿命。");
    if (context.noPhlogiston !== true) add("须确认没有燃素续航；60点耗尽后实体才按本协议结束。");
    if (context.noReplacement !== true || context.noInterruption !== true) add("须确认本次实体没有替换、破坏或中断。");
  }
  let points = 60, mode = context.startingMode, previousFrame = -1, ended = false, endFrame: number | undefined;
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) add(`重复事件标识：${event.id}。`);
    ids.add(event.id);
    if (event.frame < previousFrame) add("事件须按帧排序；同帧以列表顺序表示真实回调先后。");
    if (ended) add("实体结束后不能再有本次 E 的动作或伤害。");
    if (points === 0 && event.kind !== "end") add("夜魂归零后只能记录本次实体结束。");
    previousFrame = event.frame;
    if (event.nightsoulPointsAfter > points) add(`${event.id} 的夜魂余额比前次高；C0本协议不包含外部补点或C2。`);
    if (event.kind === "mount") {
      if (mode !== "independent") add(`${event.id} 不能重复搭乘。`);
      mode = "riding";
    } else if (event.kind === "dismount") {
      if (mode !== "riding") add(`${event.id} 不能在独立状态下下车。`);
      mode = "independent";
    } else if (eventIsSlam(event)) {
      if (points <= 0) add(`${event.id} 发生时夜魂已耗尽。`);
      if (event.kind === "riding-slam" && mode !== "riding" || event.kind === "independent-slam" && mode !== "independent") add(`${event.id} 的震荡形态与当时搭乘状态不符。`);
      if (event.targetContact === undefined) add(`${event.id} 须明确是否实际命中所选目标。`);
      if (event.targetContact === true) {
        if (context.a1InactiveThroughout === true && event.a1Active === true) add(`${event.id} 的A1已激活记录与全程未激活声明冲突。`);
        const a1Active = event.a1Active ?? (context.a1InactiveThroughout === true ? false : undefined);
        if (a1Active === undefined) add(`${event.id} 须明确本击A1夜魂迸发岩伤加成是否有效；不由12秒文字推断。`);
        if (a1Active === true && event.a1IncludedInDamageBonus === undefined) add(`${event.id} 须明确本击增伤输入是否已含A1的20%份额。`);
        if (a1Active === false && event.a1IncludedInDamageBonus === true) add(`${event.id} 未激活A1，却声明增伤输入已含其份额。`);
      }
      if (event.targetContact === true) damageEvents.push(event);
    } else if (event.kind === "end") {
      if (event.nightsoulPointsAfter !== 0) add("夜魂耗尽结束事件的余额必须为0。");
      ended = true; endFrame = event.frame;
    }
    points = event.nightsoulPointsAfter;
  }
  if (requireComplete) {
    if (!ended) add("缺少最终夜魂耗尽与实体消失事件。");
    if (endFrame !== undefined && (context.observedThroughFrame === undefined || context.observedThroughFrame < endFrame)) add("观察截止帧必须覆盖实体消失。");
  }
  return { damageEvents, issues, ...(endFrame === undefined ? {} : { endFrame }), complete: issues.length === 0 };
}

const identity = (event: KachinaEvent, context: KachinaCastContext, hit: OrdinaryHit) => JSON.stringify({ event, snapshot: event.snapshotId ? context.snapshots?.[event.snapshotId] : undefined,
  terms: hit.terms, damageBonus: hit.damageBonus, additiveBaseDamage: hit.additiveBaseDamage });

export function prepareKachinaCastDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isKachinaCastAction(document)) return document;
  const result = structuredClone(document), game = result.gameContext!, context = kachinaCastContextSchema.parse(game.kachinaCast ?? {});
  game.kachinaCast = context;
  const oldHits = result.hits, oldSelected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => oldSelected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const refs = [...new Set([...oldHits.flatMap(hit => hit.sourceRefs), kqm])];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: `${prefix}source`, status: "provisional", reason: "固定 Optimizer 倍率与 KQM 技能文字；命中日程及点数变化来自用户实际观察。", sourceRefs: refs });
  const schedule = compileKachinaCastSchedule(context, result.scope !== "single-hit");
  const missing = [...schedule.issues];
  if (game.constellation !== 0) missing.push("当前完整寿命协议只支持C0；C2补点、C4场内防御与C6额外伤害尚未归入此E。");
  const makeHit = (event: KachinaEvent): OrdinaryHit | undefined => {
    const role = event.kind === "riding-slam" ? "riding" : "independent";
    const mapping = optimizerKachinaMappings.find(row => row.id === `kachina-skill-observed-lifecycle-hit-${role === "riding" ? "1" : "2"}`);
    const coefficient = mapping?.sourceCoefficientValues?.[game.effectiveTalentLevel - 1];
    if (coefficient === undefined) return undefined;
    const id = `${skillId}:${event.id}`, previous = old.get(id), sameRole = previous?.observedEntityEvent?.templateRole === role;
    const hit: OrdinaryHit = {
      id, label: `${role === "riding" ? "搭乘" : "独立"}冲天转转 · 第${event.frame}帧（${event.id}）`, kind: "ordinary",
      element: "geo", attackTag: "skill", terms: [{ stat: "def", coefficient }, { stat: "def", coefficient: 0.2, minimumAscension: 4 }],
      additiveBaseDamage: sameRole && previous ? previous.additiveBaseDamage : 0, damageBonus: sameRole && previous ? previous.damageBonus : 0,
      critEligible: true, reaction: sameRole && previous ? previous.reaction : "none", reactionBonus: sameRole && previous ? previous.reactionBonus : 0,
      groupMultiplier: sameRole && previous ? previous.groupMultiplier : 1, sourceRefs: refs, dependencies: [`${prefix}source`, `${prefix}schedule`],
    };
    const a1Active = event.a1Active ?? (context.a1InactiveThroughout === true ? false : undefined);
    if (a1Active === true && event.a1IncludedInDamageBonus !== undefined) {
      hit.damageBonusFormula = {
        ruleId: "optimizer-kachina-a1-observed-geo-damage-bonus-180a0a1",
        label: "卡齐娜A1：本击实际岩伤加成 − 增伤输入已含份额",
        expression: expr.sub(expr.mul(expr.input("a1Active"), expr.value(0.2)), expr.input("a1IncludedShare")),
        inputs: [
          { key: "a1Active", value: Number(a1Active), unit: "boolean", minimum: 0, maximum: 1, integer: true, meaningKey: "本次震荡实际命中时A1增伤是否有效", origin: "observed-hit-state" },
          { key: "a1IncludedShare", value: event.a1IncludedInDamageBonus ? 0.2 : 0, unit: "ratio", allowedValues: [0, 0.2], meaningKey: "本击手动或历史快照增伤已含的A1份额", origin: "explicit-bonus-accounting" },
        ],
        sourceRefs: refs,
        requirements: { minimumAscension: 1, elements: ["geo"], attackTags: ["skill"] },
      };
    }
    if (sameRole && previous) {
      if (previous.finalSnapshot) hit.finalSnapshot = previous.finalSnapshot;
      if (previous.effectiveCritRate !== undefined) hit.effectiveCritRate = previous.effectiveCritRate;
      if (previous.effectiveCritDamage !== undefined) hit.effectiveCritDamage = previous.effectiveCritDamage;
      if (previous.effectiveResistance !== undefined) hit.effectiveResistance = previous.effectiveResistance;
    }
    hit.observedEntityEvent = { candidateId: event.id, templateRole: role, frame: event.frame, snapshotFrame: event.frame,
      snapshotId: event.snapshotId ?? `actual:${event.id}`, targetId: context.targetId ?? "", observationId: JSON.stringify(event) };
    const snapshot = event.snapshotId ? context.snapshots?.[event.snapshotId] : undefined;
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    else if (hit.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitEvents?.[id] !== identity(event, context, hit)) delete hit.finalSnapshot;
    if (previous?.observedEntityEvent?.observationId !== hit.observedEntityEvent.observationId) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
    return hit;
  };
  if (result.scope === "single-hit") {
    const occurredHits = schedule.damageEvents.map(makeHit).filter((row): row is OrdinaryHit => row !== undefined);
    const requestedRole = oldSelected.has("kachina-skill-observed-lifecycle-hit-1") ? "riding"
      : oldSelected.has("kachina-skill-observed-lifecycle-hit-2") ? "independent" : undefined;
    const hit = occurredHits.find(row => oldSelected.has(row.id))
      ?? occurredHits.find(row => requestedRole === row.observedEntityEvent?.templateRole)
      ?? occurredHits[0];
    if (hit) { result.hits = [hit]; result.selectedHitIds = [hit.id]; }
    else { result.hits = oldHits; result.selectedHitIds = [result.selectedHitIds[0] ?? oldHits[0]!.id]; }
  } else if (schedule.complete && !missing.length) {
    result.hits = schedule.damageEvents.map(makeHit).filter((row): row is OrdinaryHit => row !== undefined);
    if (!result.hits.length) result.hits = [{ id: `${skillId}:no-contact`, label: "本次冲天转转未命中所选目标", kind: "non-damaging", reason: "完整寿命记录中的各次震荡均未接触所选目标。", sourceRefs: refs, dependencies: [`${prefix}source`, `${prefix}schedule`] }];
    const retained = result.hits.filter(hit => oldSelected.has(hit.id)).map(hit => hit.id);
    result.selectedHitIds = selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  }
  if (!result.hits.length) missing.push("缺少该形态的固定来源伤害模板。");
  const selected = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  for (const hit of selected) if (hit.kind === "ordinary" && hit.observedEntityEvent) {
    const event = context.events?.find(row => row.id === hit.observedEntityEvent?.candidateId);
    if (!event) { missing.push(`${hit.id} 缺少对应实际事件。`); continue; }
    const ascension = hit.finalSnapshot?.ascension ?? (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
    if ((event.a1Active ?? (context.a1InactiveThroughout === true ? false : undefined)) === true && (ascension === undefined || ascension < 1)) missing.push(`${hit.id} 声明A1有效，但本击突破阶段未明确达到1。`);
    if (result.scope !== "single-hit" && selected.length > 1 && !context.statsStableAcrossHits && !hit.finalSnapshot) missing.push(`${hit.id} 缺少本击实际进攻快照；未确认共同面板稳定。`);
    if (context.finalizedHitEvents?.[hit.id] && context.finalizedHitEvents[hit.id] !== identity(event, context, hit)) missing.push(`${hit.id} 的记录已变化；请重新应用实际构筑或快照。`);
  }
  if (result.scope === "single-hit" && selected.some(hit => hit.kind === "ordinary" && !hit.observedEntityEvent)) missing.push("独立单击须提供一次已发生的实际震荡事件；也可使用现有单脉冲入口。");
  result.dependencies.push({ id: `${prefix}schedule`, status: missing.length ? "missing" : "provisional", reason: missing.join("；") || "实际震荡、夜魂余额和实体结束已明确。", sourceRefs: refs });
  result.hits.forEach(hit => { if (!hit.dependencies.includes(`${prefix}schedule`)) hit.dependencies.push(`${prefix}schedule`); });
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : !missing.length && selected.length === result.hits.length ? "complete-cast" : "selected-components";
  game.attributionPolicy = "C0本次E实体自入场至实际消失的自身震荡；骑乘由普攻触发，独立形态周期触发。按实际记录的命中及夜魂余额汇总，不从未获来源的间隔或耗点量补造攻击。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("卡齐娜观察协议：")),
    "卡齐娜观察协议：本次E从60夜魂点开始；每次动作后余额及搭乘转换由实际记录决定。单击不要求未来完整寿命；完整施放需确认所有动作与最终消失。",
    "卡齐娜观察协议：每次接触目标的震荡须声明A1是否有效；有效时说明20%岩伤是否已含于本击增伤输入。12秒描述不用于猜测实际激活边界。",
    "卡齐娜观察协议：C0 Q 领域只改变冲天转转范围与骑乘移动，Q 直接伤害另属 Q；此处不混入 Q 初击。"];
  return result;
}

export function resetKachinaCastPanelAccounting(document: CalculatorDocument): void {
  if (!isKachinaCastAction(document)) return;
  const context = document.gameContext!.kachinaCast ??= {};
  delete context.finalizedHitEvents;
  document.hits.forEach(hit => { if (hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot; });
}
export function finalizeKachinaCastPanelAccounting(document: CalculatorDocument): void {
  if (!isKachinaCastAction(document)) return;
  const context = document.gameContext!.kachinaCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.flatMap(hit => {
    if (hit.kind !== "ordinary" || !hit.observedEntityEvent) return [];
    const event = context.events?.find(row => row.id === hit.observedEntityEvent?.candidateId);
    return event ? [[hit.id, identity(event, context, hit)]] : [];
  }));
}
