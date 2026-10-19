import type {
  DamageEvent, ParticleEventLog, TargetHealthModel, TargetHealthLogEntry,
  TargetHealthSummary, TargetParticleDropDefinition,
} from "@genshin-dps-lab/schemas";
import { TraceBuilder, expr, traceInput } from "./calculation-trace";

/** Explicit scenario policy, not a claim that a particular enemy's drops are known. */
export const TARGET_HEALTH_PROFILE = {
  id: "declared-target-health-v1",
  evidenceStatus: "user-declared",
  assumptions: [
    "每条实际伤害事件立即结算敌人生命；击杀一击保留原始公式伤害，另记有效扣血和过量伤害。",
    "已死亡目标不再接受后续命中；不模拟复活、敌盾或自动切换目标。",
    "阈值采用本次扣血由上向下跨越规则，击杀采用存活到零生命规则；每条声明掉落仅执行一次。",
    "敌人生命、掉落数量、元素、种类及旅行时间均由场景明确声明；不等价于固定 gcsim 的旧生命值产球检查。",
  ],
} as const;

export interface TargetHealthDrop {
  definition: TargetParticleDropDefinition;
  origin: NonNullable<ParticleEventLog["origin"]>;
  frame: number;
  timeSeconds: number;
  cycle: number;
}

interface TargetHealthState {
  definition: TargetHealthModel["targets"][number];
  hp: number;
  consumedDropIds: Set<string>;
  summary: TargetHealthSummary;
}

/** The one live HP map used by every ordinary direct and transformative damage event. */
export class TargetHealthRuntime {
  readonly log: TargetHealthLogEntry[] = [];
  private readonly states = new Map<string, TargetHealthState>();

  constructor(model: TargetHealthModel) {
    for (const definition of model.targets) {
      this.states.set(definition.targetId, {
        definition, hp: definition.initialHp, consumedDropIds: new Set(),
        summary: { targetId: definition.targetId, maxHp: definition.maxHp, initialHp: definition.initialHp,
          finalHp: definition.initialHp, totalRawDamage: 0, totalEffectiveHpDamage: 0, totalOverkill: 0,
          defeatedFrame: definition.initialHp === 0 ? 0 : null },
      });
    }
  }

  isDefeated(targetId: string): boolean { return this.states.get(targetId)?.hp === 0; }

  settle(event: DamageEvent): TargetHealthDrop[] {
    const state = this.states.get(event.targetId);
    if (state === undefined) return [];
    const { definition } = state;
    const trace = new TraceBuilder([definition.sourceRef, ...definition.drops.map(drop => drop.sourceRef)]);
    const hpBefore = state.hp;
    const input = (key: string, value: number, meaning: string) => traceInput(key, value, "HP", "actual-target-health-state", meaning);
    const explanation = { unit: "HP", status: "assumed" as const, warnings: [...TARGET_HEALTH_PROFILE.assumptions] };
    const effectiveHpDamage = trace.add("targetHealth.effective", "实际敌人扣血", expr.min(expr.input("rawDamage"), expr.input("hpBefore")),
      [input("rawDamage", event.finalDamage, "同一伤害核心在命中与免疫策略后给出的原始伤害"), input("hpBefore", hpBefore, "本次事件执行前目标生命")],
      { ...explanation, explanationKey: "实际扣血不超过当前生命；不改变伤害公式及原始 DPS 的过量伤害记账。" });
    const hpAfter = trace.add("targetHealth.after", "敌人剩余生命", expr.sub(expr.input("hpBefore"), expr.input("effectiveHpDamage")),
      [input("hpBefore", hpBefore, "事件前生命"), input("effectiveHpDamage", effectiveHpDamage, "本次实际扣血")],
      { ...explanation, childIds: ["targetHealth.effective"], explanationKey: "立即写回共享目标生命状态，后续排队命中读取此值。" });
    const overkill = trace.add("targetHealth.overkill", "过量伤害", expr.sub(expr.input("rawDamage"), expr.input("effectiveHpDamage")),
      [input("rawDamage", event.finalDamage, "原始伤害"), input("effectiveHpDamage", effectiveHpDamage, "实际扣血")],
      { ...explanation, childIds: ["targetHealth.effective"], explanationKey: "原始伤害减有效扣血；此差额只作为独立指标，不从原始伤害总计中扣除。" });
    const defeated = trace.add("targetHealth.defeated", "本次是否首次击败目标", expr.condition("lt", expr.value(0), expr.input("hpBefore"),
      expr.condition("equal", expr.input("hpAfter"), expr.value(0), expr.value(1), expr.value(0)), expr.value(0)),
      [input("hpBefore", hpBefore, "事件前生命"), input("hpAfter", hpAfter, "事件后生命")],
      { ...explanation, unit: "boolean", childIds: ["targetHealth.after"], explanationKey: "仅从正生命变为零生命记为击败；初始零生命和已经死亡不重复触发。" }) === 1;
    const triggered = definition.drops.filter(drop => {
      const prefix = `targetHealth.drop.${drop.id}`;
      const threshold = drop.trigger.kind === "defeat" ? 0 : trace.add(`${prefix}.threshold`, "声明掉落的生命阈值",
        expr.mul(expr.input("maxHp"), expr.input("hpRatio")), [input("maxHp", definition.maxHp, "场景声明的生命上限"),
          traceInput("hpRatio", drop.trigger.hpRatio, "ratio", "declared-target-drop", "此条掉落的声明生命比例")],
        { ...explanation, explanationKey: "仅使用这条规则明确声明的比例，不推测敌人真实掉球阈值。" });
      const condition = drop.trigger.kind === "defeat" ? expr.input("defeated")
        : expr.condition("lt", expr.input("threshold"), expr.input("hpBefore"),
          expr.condition("lte", expr.input("hpAfter"), expr.input("threshold"), expr.value(1), expr.value(0)), expr.value(0));
      return trace.add(`${prefix}.triggered`, "本条声明掉落是否执行", expr.condition("equal", expr.input("alreadyConsumed"), expr.value(0), condition, expr.value(0)),
        [traceInput("alreadyConsumed", state.consumedDropIds.has(drop.id) ? 1 : 0, "boolean", "actual-target-drop-state", "此条规则是否已执行过"),
          ...(drop.trigger.kind === "defeat" ? [traceInput("defeated", defeated ? 1 : 0, "boolean", "actual-target-health-state", "本次是否从存活变为死亡")]
            : [input("threshold", threshold, "本条生命阈值"), input("hpBefore", hpBefore, "事件前生命"), input("hpAfter", hpAfter, "事件后生命")])],
        { ...explanation, unit: "boolean", childIds: [drop.trigger.kind === "defeat" ? "targetHealth.defeated" : `${prefix}.threshold`],
          explanationKey: "规则尚未执行且本次实际跨越阈值或首次击败时结果为1；每条规则在整个场景中最多生成一次。" }) === 1;
    });
    const entry: TargetHealthLogEntry = {
      id: this.log.length, targetId: event.targetId, damageEventId: event.id,
      frame: event.frame, timeSeconds: event.timeSeconds, eventPriority: event.eventPriority, eventSequence: event.eventSequence,
      maxHp: definition.maxHp, hpBefore, hpAfter, rawDamage: event.finalDamage, effectiveHpDamage, overkill, defeated,
      triggeredDropIds: triggered.map(drop => drop.id), sourceRef: definition.sourceRef, trace: trace.nodes,
    };
    state.hp = hpAfter;
    state.summary.finalHp = hpAfter;
    state.summary.totalRawDamage += event.finalDamage;
    state.summary.totalEffectiveHpDamage += effectiveHpDamage;
    state.summary.totalOverkill += overkill;
    if (defeated) state.summary.defeatedFrame = event.frame;
    this.log.push(entry);
    return triggered.map(definition => {
      state.consumedDropIds.add(definition.id);
      return { definition, frame: event.frame, timeSeconds: event.timeSeconds, cycle: event.cycle,
        origin: { kind: definition.trigger.kind === "defeat" ? "enemy-defeat" : "enemy-hp-threshold",
          dropId: definition.id, targetId: event.targetId, targetHealthLogId: entry.id, damageEventId: event.id, sourceRef: definition.sourceRef } };
    });
  }

  summaries(): TargetHealthSummary[] { return [...this.states.values()].map(state => ({ ...state.summary })); }
}
