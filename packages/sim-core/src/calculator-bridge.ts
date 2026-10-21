import { parseEventStepResult, EVENT_STEP_RESULT_FORMAT, type EventStepResult } from './event-step-result';
import { weaponHitStackTraceForDamageEvent } from "./weapon-hit-stack-trace";
import { getComposableSourceAbility } from "../../game-data/src/source-ability-registry";
import { assertComposableSourceAbilities } from "./source-action-library";
import { calculateStatConversion } from "./stat-conversion";
import { artifactDamageTrace } from "./artifact-damage-runtime";
import { executeStellarConductAdjustment } from "./stellar-conduct-runtime";
import { assertTrustedSimulationResult, simulationResultSchema, thrillingTalesForDamageEvent, type CharacterStats, type ScalingStat, type DamageEvent, type SimulationResult, type ActionConditionLogEntry, type WeaponProcLogEntry, type ThrillingTalesLogEntry } from "@genshin-dps-lab/schemas";
import { calculateDamageTrace, calculateTransformativeDamageTrace, executeAdditiveDamage, DAMAGE_FORMULA_SOURCES } from "./calculator-formula";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import type { DamageCalculationInput, TransformativeReactionDamageInput } from "./formulas";
import { getWeaponProcCoefficientFormula } from "./weapon-proc-calculator";

/** The source result retains config, snapshots, reaction decisions and all pinned rule roots. */
export interface CapturedSimulationHit {
  schemaVersion: "calculator-event-v1" | "calculator-event-v2";
  eventStepResult?: EventStepResult;
  eventId: number;
  sourceResult: SimulationResult;
}

export interface SimulationHitReplay {
  event: DamageEvent;
  captured: CapturedSimulationHit;
  formulaInput: DamageCalculationInput | TransformativeReactionDamageInput;
  trace: CalculationTraceNode[];
  originalDamage: number;
  reproducedDamage: number;
  difference: number;
  reactionProvenance: "automatic-engine" | "conditioned-manual-override" | "no-reaction";
  warnings: string[];
  /** Actual accepted-cast decisions, including decisions for the seven unconditional hits. */
  actionConditions?: ActionConditionLogEntry[];
  /** Source-owned independent attack; the host hit supplies only the callback. */
  weaponProc?: WeaponProcLogEntry;
  /** Actual already-included TTDS contributions at this hit's snapshot. */
  thrillingTales?: ThrillingTalesLogEntry[];
}

const tolerance = (value: number): number => 1e-10 * Math.max(1, Math.abs(value));
function sameNumber(actual: number, expected: number, field: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance(expected)) {
    throw new Error(`无法完整还原模拟命中：${field} 不一致（${actual} / ${expected}）。`);
  }
}

function snapshotStatFields(stats: CharacterStats, stat: ScalingStat) {
  return stat === "atk"
    ? { base: stats.baseAtk, percent: stats.atkPct, flat: stats.flatAtk, baseKey: "baseAtk", percentKey: "atkPercent", flatKey: "flatAtk", stage: "finalAtk" }
    : stat === "hp"
      ? { base: stats.baseHp, percent: stats.hpPct, flat: stats.flatHp, baseKey: "baseHp", percentKey: "hpPercent", flatKey: "flatHp", stage: "finalHp" }
      : stat === "def"
        ? { base: stats.baseDef, percent: stats.defPct, flat: stats.flatDef, baseKey: "baseDef", percentKey: "defPercent", flatKey: "flatDef", stage: "finalDef" }
        : null;
}

function validateCapture(raw: unknown): CapturedSimulationHit {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("无效的模拟命中捕获文件。");
  const capture = raw as Record<string, unknown>;
  if ((capture.schemaVersion !== "calculator-event-v1" && capture.schemaVersion !== "calculator-event-v2") || !Number.isSafeInteger(capture.eventId) || (capture.eventId as number) < 0) {
    throw new Error("不支持的模拟命中格式或事件 ID。");
  }
  // Zod models optional properties as T | undefined; the persisted wire uses
  // omitted optionals. Parsing precedes the existing semantic integrity gate.
  const witnessed = capture.schemaVersion === 'calculator-event-v2' ? parseEventStepResult(capture.eventStepResult) : null;
  if(witnessed && capture.sourceResult !== undefined && JSON.stringify(capture.sourceResult)!==JSON.stringify(witnessed.result))throw Error('捕获结果与严格见证不一致。');
  const parsed = witnessed?.result ?? simulationResultSchema.parse(capture.sourceResult) as unknown as SimulationResult;
  const sourceResult = assertTrustedSimulationResult(parsed);
  assertComposableSourceAbilities(sourceResult.config, { ...sourceResult.resolvedRuntimeOptions, plugins: sourceResult.pluginManifest });
  if (!sourceResult.damageEvents.some((event) => event.id === capture.eventId)) throw new Error("捕获文件中的命中不存在。");
  return { schemaVersion: witnessed ? "calculator-event-v2" : "calculator-event-v1", eventId: capture.eventId as number, sourceResult, ...(witnessed ? {eventStepResult:witnessed.wire} : {}) };
}

/** Only captures that can actually be reproduced are accepted for the calculator. */
export function captureSimulationHit(rawResult: unknown, eventId: number): CapturedSimulationHit {
  const witnessed=rawResult&&typeof rawResult==='object'&&'format' in rawResult&&rawResult.format===EVENT_STEP_RESULT_FORMAT;
  return replaySimulationHit(witnessed ? {schemaVersion:'calculator-event-v2',eventId,eventStepResult:rawResult} : { schemaVersion: "calculator-event-v1", eventId, sourceResult: rawResult }).captured;
}

export function serializeSimulationHit(capture: CapturedSimulationHit): string {
  const verified = replaySimulationHit(capture).captured;
  return JSON.stringify(verified.schemaVersion==='calculator-event-v2' ? {schemaVersion:verified.schemaVersion,eventId:verified.eventId,eventStepResult:verified.eventStepResult} : verified, null, 2);
}

export function parseSimulationHit(json: string): CapturedSimulationHit {
  return replaySimulationHit(JSON.parse(json) as unknown).captured;
}

/** Re-executes the same core; factor comparisons catch omitted or altered numerical context. */
export function replaySimulationHit(rawCapture: unknown): SimulationHitReplay {
  const captured = validateCapture(rawCapture);
  const result = captured.sourceResult;
  const event = result.damageEvents.find((candidate) => candidate.id === captured.eventId)!;
  const resolvedContext = result.executionAudit?.hits.find((hit) => hit.eventId === captured.eventId);
  if (event.mechanicsStatus !== "authoritative" || event.reactionAudit.mechanicsTruncation !== null) {
    throw new Error("命中因未支持的机制已截断，不能把零贡献冒充完整计算。");
  }
  if (result.pluginManifest.length > 0 && resolvedContext === undefined) {
    throw new Error("此结果使用执行插件；旧事件格式未完整记录插件可能改写的等级和暴击模式，暂不能证明独立还原。");
  }
  const warnings = [
    "数值复现验证该固定引擎及数据上下文的一致性，不代表所有游戏机制已由官方验证。",
    "还原入口使用命中当时的已解析属性；不会再次叠加装备、快照增益或导入面板。"
  ];
  const manual = event.reactionAudit.model === "manual-override";
  if (manual) warnings.push("该反应由手工覆盖指定；复现不证明自动附着、ICD 或轮转反应覆盖。 ");
  const reactionProvenance: SimulationHitReplay["reactionProvenance"] = manual
    ? "conditioned-manual-override"
    : event.reactionAudit.model === "aura-engine" || event.reactionAudit.model === "reaction-damage"
      ? "automatic-engine" : "no-reaction";
  let trace: CalculationTraceNode[];
  let formulaInput: SimulationHitReplay["formulaInput"];
  let potentialDamage: number;
  const policy = new TraceBuilder(DAMAGE_FORMULA_SOURCES);
  if (event.kind === "transformative-reaction") {
    const factors = event.transformativeReactionFactors;
    if (!factors) throw new Error("缺少剧变反应计算上下文。");
    formulaInput = resolvedContext?.inputKind === "transformative" ? resolvedContext.input : {
      characterLevel: factors.characterLevel,
      elementalMastery: factors.elementalMastery,
      reactionBonus: factors.reactionBonus,
      baseMultiplier: factors.baseMultiplier,
      effectiveResistance: factors.effectiveResistance
    };
    const calculation = calculateTransformativeDamageTrace(formulaInput);
    for (const field of ["levelBaseDamage", "elementalMasteryBonus", "reactionBonus", "preResistanceDamage", "resistanceMultiplier"] as const) {
      sameNumber(calculation[field], factors[field], field);
    }
    trace = calculation.trace;
    potentialDamage = policy.add("reactionGroupPolicy", "stage.reactionGroupPolicy",
      expr.mul(expr.input("formulaDamage"), expr.input("groupMultiplier")),
      [traceInput("formulaDamage", calculation.finalDamage, "damage", "captured-event"), traceInput("groupMultiplier", event.damageFactors.groupMultiplier, "ratio", "reaction-damage-group-log")],
      { explanationKey: "explain.reactionGroupPolicy", unit: "damage" });
  } else {
    const owner = result.config.characters.find((character) => character.id === event.scalingOwnerId);
    if (!owner) throw new Error("缺少伤害属性所属角色及等级。");
    const factors = event.damageFactors;
    const reaction = event.reaction === "melt" || event.reaction === "reverseMelt" || event.reaction === "vaporize" || event.reaction === "reverseVaporize" ? event.reaction : "none";
    formulaInput = resolvedContext?.inputKind === "ordinary" ? resolvedContext.input : {
      scaling: factors.scaling, scalingStat: factors.scalingStat, scalingValue: factors.scalingValue,
      flatDamage: factors.flatDamage, damageBonus: factors.damageBonus,
      characterLevel: owner.level, enemyLevel: event.enemyStateBeforeHit.level,
      defenseReduction: factors.defenseReduction, defenseIgnore: factors.defenseIgnore,
      effectiveResistance: factors.effectiveResistance, critRate: factors.critRate, critDamage: factors.critDamage,
      critMode: event.hitWeakPoint === true ? "allCrit" : result.resolvedRuntimeOptions.critMode, reaction,
      ...(event.hitWeakPoint === undefined ? {} : { hitWeakPoint: event.hitWeakPoint }),
      elementalMastery: event.em, reactionBonus: factors.reactionBonus, groupMultiplier: factors.groupMultiplier
    };
    const calculation = calculateDamageTrace(formulaInput);
    for (const field of Object.keys(factors) as (keyof typeof factors)[]) {
      if (typeof factors[field] === "number") sameNumber(calculation.factors[field] as number, factors[field] as number, field);
      else if (calculation.factors[field] !== factors[field]) throw new Error(`无法还原 ${field}。`);
    }
    const prefix = new TraceBuilder(DAMAGE_FORMULA_SOURCES);
    const stat = factors.scalingStat;
    const snapshotStats = event.statsBeforeDamage;
    const sourceSampleTrace = (sampleId: number, id: string) => {
      const sample = result.sourceSnapshotLog![sampleId]!;
      const action = result.actionLog[sample.actionLogIndex]!;
      const binding = result.config.sourceAbilityBindings?.find(row => row.abilityId === action.sourceAbilityId && row.actorId === sample.sourceActorId);
      const sourceRefs = binding === undefined ? ["engine:legal-frame-v1:explicit-source-snapshot"]
        : [...getComposableSourceAbility(binding.sourceActionId)!.sourceRefs];
      const context = { ownerId: sample.ownerId, sourceActorId: sample.sourceActorId, actionId: sample.actionId,
        sampleFrame: sample.frame, deliveryFrame: event.frame, eventPriority: sample.eventPriority };
      const applicabilityReason = `属性所有者：${sample.ownerId}；来源施放者：${sample.sourceActorId}；实际取样帧：${sample.frame}；本击命中帧：${event.frame}；取样记录：${sample.id}。`;
      const frame = prefix.add(id, "stage.sourceSnapshotFrame", expr.add(expr.input("sourceActionFrame"), expr.input("sourceRelativeFrame")),
        [{ ...traceInput("sourceActionFrame", action.frame, "frame", { kind: "accepted-action", reference: `actionLog[${sample.actionLogIndex}]` }), context },
          { ...traceInput("sourceRelativeFrame", sample.relativeFrame, "frame", { kind: "declared-source-snapshot", reference: `sourceSnapshotLog[${sampleId}]` }), context }],
        { explanationKey: "explain.sourceSnapshotFrame", unit: "frame", status: "assumed", sourceRefs, applicabilityReason });
      sameNumber(frame, sample.frame, `${id}.frame`);
      return { sample, frameNodeId: id, context, applicabilityReason, sourceRefs };
    };
    const mainSourceSample = event.sourceSnapshotLogId === undefined ? undefined
      : sourceSampleTrace(event.sourceSnapshotLogId, "sourceSnapshot.main.frame");
    const statFields = snapshotStatFields(snapshotStats, stat);
    if (statFields) {
      const restoredStat = prefix.add("snapshotFinalStat", `stage.${statFields.stage}`,
        expr.add(expr.mul(expr.input(statFields.baseKey), expr.add(expr.value(1), expr.input(statFields.percentKey))), expr.input(statFields.flatKey)),
        [traceInput(statFields.baseKey, statFields.base, stat, "captured-snapshot"), traceInput(statFields.percentKey, statFields.percent, "ratio", "captured-snapshot"), traceInput(statFields.flatKey, statFields.flat, stat, "captured-snapshot")],
        { explanationKey: `explain.${statFields.stage}`, unit: stat, applicabilityReason: mainSourceSample?.applicabilityReason ?? `snapshot:${event.snapshot};owner:${event.scalingOwnerId}`,
          ...(mainSourceSample === undefined ? {} : { childIds: [mainSourceSample.frameNodeId], sourceRefs: [...DAMAGE_FORMULA_SOURCES, ...mainSourceSample.sourceRefs] }) });
      if (resolvedContext === undefined || result.pluginManifest.length === 0) {
        sameNumber(restoredStat, factors.scalingValue, "snapshot.scalingValue");
      } else if (Math.abs(restoredStat - factors.scalingValue) > tolerance(factors.scalingValue)) {
        prefix.add("resolvedScalingValue", "stage.resolvedScalingValue", expr.input("scalingValue"),
          [traceInput("scalingValue", factors.scalingValue, stat, "post-plugin-execution-context")],
          { explanationKey: "explain.resolvedScalingValue", unit: stat, warnings: ["plugin-overrides-snapshot-panel"] });
      }
    } else {
      if (resolvedContext === undefined || result.pluginManifest.length === 0) sameNumber(snapshotStats.em, factors.scalingValue, "snapshot.em");
    }
    for (const [index, contribution] of event.flatDetails.entries()) {
      const sourceSample = contribution.sourceSnapshotLogId === undefined ? undefined
        : sourceSampleTrace(contribution.sourceSnapshotLogId, `sourceSnapshot.flat.${index}.frame`);
      let sourceValue = contribution.sourceValue;
      const sourceStatId = `sourceSnapshot.flat.${index}.stat`;
      if (sourceSample !== undefined) {
        const fields = snapshotStatFields(sourceSample.sample.stats!, contribution.stat);
        const origin = { kind: "captured-source-snapshot", reference: `sourceSnapshotLog[${sourceSample.sample.id}].stats` };
        const inputs = fields === null
          ? [traceInput("em", sourceSample.sample.stats!.em, "em", origin)]
          : [traceInput(fields.baseKey, fields.base, contribution.stat, origin), traceInput(fields.percentKey, fields.percent, "ratio", origin), traceInput(fields.flatKey, fields.flat, contribution.stat, origin)];
        sourceValue = prefix.add(sourceStatId, fields === null ? "stage.sourceSnapshotEm" : `stage.${fields.stage}`,
          fields === null ? expr.input("em") : expr.add(expr.mul(expr.input(fields.baseKey), expr.add(expr.value(1), expr.input(fields.percentKey))), expr.input(fields.flatKey)),
          inputs.map(input => ({ ...input, context: sourceSample.context })),
          { explanationKey: fields === null ? "explain.sourceSnapshotEm" : `explain.${fields.stage}`, unit: contribution.stat,
            childIds: [sourceSample.frameNodeId], sourceRefs: [...DAMAGE_FORMULA_SOURCES, ...sourceSample.sourceRefs],
            applicabilityReason: sourceSample.applicabilityReason });
        sameNumber(sourceValue, contribution.sourceValue, `flatDetails[${index}].sourceValue`);
      }
      prefix.add(`contributor-${index}`, "stage.flatContributor", expr.mul(expr.input("sourceValue"), expr.input("coefficient")),
        [traceInput("sourceValue", sourceValue, contribution.stat, sourceSample === undefined
          ? { kind: "captured-contributor", reference: contribution.ownerId } : { kind: "trace-node", reference: sourceStatId }), traceInput("coefficient", contribution.multiplier)],
        { explanationKey: "explain.flatContributor", unit: "damage", ...(sourceSample === undefined ? {} : {
          childIds: [sourceStatId], sourceRefs: [...DAMAGE_FORMULA_SOURCES, ...sourceSample.sourceRefs], applicabilityReason: sourceSample.applicabilityReason
        }) });
      sameNumber(contribution.sourceValue * contribution.multiplier, contribution.amount, `flatDetails[${index}]`);
    }
    trace = [...weaponHitStackTraceForDamageEvent(result, event), ...prefix.nodes];
    trace.push(...artifactDamageTrace((result.artifactDamageLog ?? []).filter(row => row.kind === "enemy-hit" && row.parentDamageEventId === event.id)));
    if (resolvedContext?.stellarConduct) {
      const field = executeStellarConductAdjustment(resolvedContext.stellarConduct);
      sameNumber(field.damageBonus, formulaInput.damageBonus, "stellarConduct.damageBonus");
      sameNumber(field.effectiveResistance, formulaInput.effectiveResistance, "stellarConduct.effectiveResistance");
      trace.push(...field.trace);
    }
    if (event.additiveReactionFactors) {
      const additive = event.additiveReactionFactors;
      const executed = executeAdditiveDamage({ reaction: additive.reaction, characterLevel: additive.characterLevel, elementalMastery: additive.elementalMastery, reactionBonus: additive.reactionBonus }, true);
      sameNumber(executed.flatDamage, additive.flatDamage, "additive.flatDamage");
      if (resolvedContext === undefined || result.pluginManifest.length === 0) sameNumber(additive.appliedFlatDamage, additive.flatDamage, "additive.appliedFlatDamage");
      trace.push(...executed.trace);
      if (additive.appliedFlatDamage !== additive.flatDamage) {
        const applied = new TraceBuilder(DAMAGE_FORMULA_SOURCES);
        applied.add("resolvedAdditiveContribution", "stage.resolvedAdditiveContribution", expr.input("flatDamage"),
          [traceInput("flatDamage", additive.appliedFlatDamage, "damage", "post-plugin-execution-context")],
          { explanationKey: "explain.resolvedAdditiveContribution", unit: "damage" });
        trace.push(...applied.nodes);
      }
    }
    if (resolvedContext?.critical.mode === "seeded-random-v1") {
      const sampling = new TraceBuilder(["engine:seeded-random-v1:mulberry32:critical-hit-v1"]);
      const roll = resolvedContext.critical.roll!;
      sampling.add("criticalSample", "stage.criticalSample", expr.condition("lt", expr.input("roll"), expr.input("critRate"), expr.value(1), expr.value(0)),
        [traceInput("roll", roll, "probability", "captured-rng-draw"), traceInput("critRate", factors.critRate, "probability", "post-plugin-execution-context")],
        { explanationKey: "explain.criticalSample", unit: "critical-indicator", applicabilityReason: `drawIndex:${resolvedContext.critical.drawIndex}` });
      trace.push(...sampling.nodes);
    }
    trace.push(...calculation.trace.map((node) => manual && (node.id === "reactionMultiplier" || node.id === "afterReaction")
      ? { ...node, status: "assumed" as const, warnings: [...node.warnings, "manual-reaction-override"] } : node));
    potentialDamage = calculation.finalDamage;
  }
  const latestConversions = new Map<string, NonNullable<SimulationResult["statConversionLog"]>[number]>();
  const weaponProc = event.weaponProcLogId === undefined ? undefined : result.weaponProcLog?.[event.weaponProcLogId];
  const sourceSummon = result.summonLog?.find(row => row.operation === "spawn" && row.actionId === event.actionId && row.cycle === event.cycle && row.hitIds.includes(event.hitId));
  const sourceActionIndex = result.actionLog.findIndex(row => row.actionId === event.actionId && row.actorId === event.sourceActorId && row.cycle === event.cycle);
  const sourceActionStart = result.actionLog[sourceActionIndex]?.frame;
  const actionConditions = event.kind === "direct" ? (result.actionConditionLog ?? []).filter(row => row.actionLogIndex === sourceActionIndex) : [];
  const snapshotFrame = event.sourceSnapshotLogId === undefined ? (event.snapshot === "action" ? (weaponProc?.snapshotFrame ?? weaponProc?.frame ?? sourceSummon?.snapshotFrame ?? event.actionStartFrame ?? sourceActionStart ?? event.frame) : event.frame) : result.sourceSnapshotLog![event.sourceSnapshotLogId]!.frame;
  for (const row of result.statConversionLog ?? []) {
    const action = result.actionLog[row.actionLogIndex];
    if (action?.actorId === event.scalingOwnerId && row.frame <= snapshotFrame) latestConversions.set(row.key, row);
  }
  for (const row of latestConversions.values()) {
    if (snapshotFrame >= row.expiresAtFrame) continue;
    const action = result.actionLog[row.actionLogIndex]!;
    const sourceAction = action.sourceAbilityId === undefined ? result.config.rotation.find(candidate => candidate.id === action.actionId) : result.config.timeline?.abilities.find(candidate => candidate.id === action.sourceAbilityId);
    const definition = sourceAction?.statConversions?.find(candidate => candidate.key === row.key);
    if (definition === undefined) throw new Error("转换来源声明缺失");
    const conversion = calculateStatConversion(definition, row.snapshot);
    sameNumber(conversion.appliedValue, row.appliedValue, "statConversion.appliedValue");
    trace.unshift(...conversion.trace);
  }
  if (actionConditions.length) trace.unshift(...actionConditions.flatMap(row => row.trace as CalculationTraceNode[]));
  if (weaponProc !== undefined) {
    const source = new TraceBuilder([weaponProc.sourceRef]);
    source.add("weaponProc.deliveryFrame", "独立武器追击：实际落地帧", expr.add(expr.input("triggerFrame"), expr.input("delayFrames")),
      [traceInput("triggerFrame", weaponProc.frame, "frame", "实际宿主伤害回调帧"), traceInput("delayFrames", event.frame - weaponProc.frame, "frame", "本次固定来源独立排程延迟")],
      { explanationKey: "独立攻击按来源取样与排程，不继承宿主命中的倍率、增伤、暴击覆盖或无视防御；水仙在延迟任务执行时取样，苍翠九段共用触发回调时的面板与圆心。", status: "assumed", unit: "frame" });
    const coefficientFormula = weaponProc.random === undefined && weaponProc.stateBefore === undefined && weaponProc.hitWeakPoint === undefined ? undefined : getWeaponProcCoefficientFormula({ weaponProc: {
      weaponId: weaponProc.weaponId, refinement: weaponProc.refinement,
      ...(weaponProc.triggerAura == null ? {} : { triggeringTargetCryoOrFrozen: weaponProc.triggerAura.cryo || weaponProc.triggerAura.frozen })
    } });
    if (coefficientFormula !== undefined) {
      const coefficient = source.add("weaponProc.coefficientChoice", "独立武器追击：实际来源倍率选择", coefficientFormula.expression,
        coefficientFormula.inputs.map(input => traceInput(input.key, input.value, input.unit,
          input.key === "triggeringTargetCryoOrFrozen" ? "validated-deferred-weapon-callback" : input.origin, input.meaningKey)),
        { explanationKey: coefficientFormula.label, status: "assumed", unit: "ratio", ruleId: coefficientFormula.ruleId, sourceRefs: coefficientFormula.sourceRefs });
      sameNumber(coefficient, weaponProc.coefficient, "weaponProc.coefficientChoice");
    }
    source.add("weaponProc.sourceBase", "独立武器追击：来源倍率与快照基础伤害", expr.mul(expr.input("triggerScalingValue"), expr.input("weaponCoefficient")),
      [traceInput("triggerScalingValue", event.damageFactors.scalingValue, weaponProc.scalingStat, "武器来源规定取样时刻的持有者最终属性快照"), traceInput("weaponCoefficient", weaponProc.coefficient, "ratio", `固定来源 R${weaponProc.refinement} 武器追击倍率`)],
      { explanationKey: "此基础伤害属于独立物理攻击，随后通过与单次技能计算器相同的暴击、防御、抗性和增伤公式执行。生命值条款使用触发时最大生命值。", status: "assumed", unit: "damage",
        ...(coefficientFormula === undefined ? {} : { childIds: ["weaponProc.coefficientChoice"] }) });
    trace.unshift(...source.nodes);
  }
  const thrillingTales = thrillingTalesForDamageEvent(result, event);
  for (const row of thrillingTales) {
    const source = new TraceBuilder([row.sourceRef]);
    source.add(`thrillingTales.${row.id}.attackContribution`, "讨龙：受益角色基础攻击力与来源增益", expr.mul(expr.input("recipientBaseAttack"), expr.input("thrillingTalesCoefficient")),
      [traceInput("recipientBaseAttack", event.statsBeforeDamage.baseAtk, "ATK", "实际受益角色命中快照中的基础攻击力"),
        traceInput("thrillingTalesCoefficient", row.coefficient, "ratio", `${row.ownerId} 的 R${row.refinement} 讨龙实际切人领取`) ],
      { explanationKey: "基础攻击力乘讨龙攻击力百分比；这份攻击力已经包含于实际命中快照，后续最终攻击力公式只使用一次。动作快照可在增益到期后继续保留该份额。",
        status: "assumed", unit: "ATK", applicabilityReason: `source-log:${row.id};recipient:${row.recipientId};applied-frame:${row.frame}` });
    trace.unshift(...source.nodes);
  }
  if (event.enemyShieldLogId !== undefined) {
    const shield = result.enemyShieldLog?.[event.enemyShieldLogId];
    if (shield?.damageEventId !== event.id || shield.shield?.hpDisposition?.damage !== event.finalDamage) throw new Error("捕获敌盾命中缺少相同事件的实际生命伤害政策。");
    trace.push(...structuredClone(shield.shield.trace) as CalculationTraceNode[]);
    warnings.push("此命中作用于存续敌盾：共享核心潜在伤害只作为削盾基数，实际目标生命伤害为 0；盾量及真实 ICD 在独立来源轨迹中显示。");
  }
  sameNumber(potentialDamage, event.potentialDamage, "potentialDamage");
  const reproducedDamage = policy.add("targetDamagePolicy", "stage.targetDamagePolicy",
    expr.mul(expr.input("potentialDamage"), expr.input("targetDamageMultiplier")),
    [traceInput("potentialDamage", potentialDamage, "damage", "shared-core"), traceInput("targetDamageMultiplier", event.targetDamageMultiplier, "ratio", "captured-target-policy")],
    { explanationKey: "explain.targetDamagePolicy", applicabilityReason: event.enemyShieldLogId === undefined ? event.targetDamagePolicy : "source-verified-enemy-force-shield", unit: "damage" });
  trace.push(...policy.nodes);
  sameNumber(reproducedDamage, event.finalDamage, "finalDamage");
  return { event, captured, formulaInput, trace, originalDamage: event.finalDamage, reproducedDamage, difference: reproducedDamage - event.finalDamage, reactionProvenance, warnings, ...(actionConditions.length ? { actionConditions } : {}), ...(weaponProc === undefined ? {} : { weaponProc }), ...(thrillingTales.length === 0 ? {} : { thrillingTales }) };
}
