import type { ActionDefinition, PeriodicEntityDefinition } from "@genshin-dps-lab/schemas";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

export interface LivePeriodicEntity {
  instanceId: string;
  generation: number;
  action: ActionDefinition;
  actionLogIndex: number;
  cycle: number;
  definition: PeriodicEntityDefinition;
  spawnFrame: number;
  expiresAtFrame: number;
}

export interface PeriodicEntityCheckpointState {
  active: readonly LivePeriodicEntity[];
  /** Runtime's actual latest generation per owner + declaration, including expired owners. */
  latestGenerations: ReadonlyMap<string, number>;
}

/** One replaceable entity per owner + declaration ID; the main queue owns time. */
export class PeriodicEntityRuntime {
  private readonly active = new Map<string, LivePeriodicEntity>();
  private readonly generations = new Map<string, number>();
  private key(actorId: string, id: string): string { return `${actorId}\u0000${id}`; }
  spawn(action: ActionDefinition, actionLogIndex: number, cycle: number, definition: PeriodicEntityDefinition, frame: number): { entity: LivePeriodicEntity; replaced?: LivePeriodicEntity } {
    const key = this.key(action.actorId, definition.id);
    const generation = (this.generations.get(key) ?? -1) + 1;
    const replaced = this.active.get(key);
    const entity = { instanceId: `${action.actorId}:${definition.id}:${generation}`, generation, action, actionLogIndex, cycle, definition,
      spawnFrame: frame, expiresAtFrame: frame + definition.durationFrames };
    this.generations.set(key, generation);
    this.active.set(key, entity);
    return { entity, ...(replaced === undefined ? {} : { replaced }) };
  }
  captureState(): PeriodicEntityCheckpointState {
    return { active: [...this.active.values()], latestGenerations: new Map(this.generations) };
  }
  isLive(entity: LivePeriodicEntity): boolean { return this.active.get(this.key(entity.action.actorId, entity.definition.id)) === entity; }
  /** Source policy: execute this tick, then stop when duration has reached zero. */
  finishTick(entity: LivePeriodicEntity, frame: number): boolean {
    if (frame < entity.expiresAtFrame) return false;
    this.active.delete(this.key(entity.action.actorId, entity.definition.id));
    return true;
  }
}

export function calculatePeriodicHealing(definition: PeriodicEntityDefinition, owner: { maxHp: number; currentHp: number; em: number }): {
  ownerMaxHp: number; ownerCurrentHp: number; ownerEm: number; baseHealing: number; healingBonus: number;
  incomingHealingBonus: number; trace: CalculationTraceNode[];
} {
  const trace = new TraceBuilder(definition.sourceRefs);
  const input = (key: string, value: number, meaning: string, unit = "HP") => traceInput(key, value, unit, "actual-periodic-tick-context", meaning);
  const { healing } = definition;
  const options = { status: "assumed" as const, unit: "HP" };
  const hpHealing = trace.add("periodic.hp", "施放者最大生命治疗项", expr.mul(expr.input("ownerMaxHp"), expr.input("hpCoefficient")),
    [input("ownerMaxHp", owner.maxHp, "真实生命池中的施放者最大生命值"), input("hpCoefficient", healing.ownerHpCoefficient, "已声明的最大生命治疗系数", "ratio")],
    { ...options, explanationKey: "治疗使用施放者最大生命值，并非当前受治疗角色的最大生命值。" });
  const emHealing = trace.add("periodic.em", "施放者元素精通治疗项", expr.mul(expr.input("ownerEm"), expr.input("emCoefficient")),
    [input("ownerEm", owner.em, "本次真实周期事件的施放者元素精通", "EM"), input("emCoefficient", healing.ownerEmCoefficient, "明确解锁或关闭后的精通治疗系数", "ratio")],
    { ...options, explanationKey: "元素精通在真实周期事件执行时读取，不从角色名猜测被动是否解锁。" });
  const baseHealing = trace.add("periodic.base", "本次治疗基础量", expr.add(expr.input("hpHealing"), expr.input("flatHealing"), expr.input("emHealing")),
    [input("hpHealing", hpHealing, "最大生命治疗项"), input("flatHealing", healing.flat, "明确的固定治疗值"), input("emHealing", emHealing, "元素精通治疗项")],
    { ...options, childIds: ["periodic.hp", "periodic.em"], explanationKey: "最大生命、固定数值和精通项相加后交给同一生命治疗核心。" });
  const threshold = trace.add("periodic.threshold", "低生命加成阈值", expr.mul(expr.input("ownerMaxHp"), expr.input("thresholdRatio")),
    [input("ownerMaxHp", owner.maxHp, "施放者最大生命值"), input("thresholdRatio", healing.lowHpBonus?.thresholdRatio ?? 0, "声明的低生命阈值比例", "ratio")],
    { ...options, explanationKey: "条件取施放者自身生命状态；缺少此声明表示不启用低生命加成。" });
  const conditionalBonus = trace.add("periodic.low-hp", "实际低生命治疗加成", expr.condition("lte", expr.input("ownerCurrentHp"), expr.input("threshold"), expr.input("declaredBonus"), expr.value(0)),
    [input("ownerCurrentHp", owner.currentHp, "周期治疗前施放者实际当前生命值"), input("threshold", threshold, "最大生命乘阈值比例"), input("declaredBonus", healing.lowHpBonus?.bonus ?? 0, "明确的条件治疗加成", "ratio")],
    { ...options, unit: "ratio", childIds: ["periodic.threshold"], explanationKey: "施放者当前生命小于等于阈值时使用条件加成；治疗后的生命不会倒算本次加成。" });
  const healingBonus = trace.add("periodic.healing-bonus", "本次来源治疗加成", expr.add(expr.input("baseHealingBonus"), expr.input("conditionalBonus")),
    [input("baseHealingBonus", healing.healingBonus, "明确给出的基础来源治疗加成", "ratio"), input("conditionalBonus", conditionalBonus, "由本次真实生命状态得到的条件加成", "ratio")],
    { ...options, unit: "ratio", childIds: ["periodic.low-hp"], explanationKey: "将基础来源加成与条件加成相加；受治疗加成仍由共用治疗核心另行加算。" });
  return { ownerMaxHp: owner.maxHp, ownerCurrentHp: owner.currentHp, ownerEm: owner.em,
    baseHealing, healingBonus, incomingHealingBonus: healing.incomingHealingBonus, trace: trace.nodes };
}
