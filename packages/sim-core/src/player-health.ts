import type { HealthChangeDefinition, PlayerHealthEvent } from "@genshin-dps-lab/schemas";
import { BOND_OF_LIFE_PROFILE, calculateBondOfLife, type BondOfLifeContext } from "./bond-of-life";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const reference = (path: string) => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`;
export const PLAYER_HEALTH_PROFILE = {
  id: "gcsim-b4ae769-explicit-health-v1",
  evidenceStatus: "fixed-source-assumed",
  sourceRefs: [reference("internal/template/character/heal.go"), reference("internal/template/character/hp.go"), reference("internal/characters/kuki/skill.go")],
  assumptions: ["生命之契为零；治疗加成和受治疗加成由动作明确给出。", "生命消耗下限由动作声明，不能从角色名称推断；零生命后仍采用已有 clamp-and-continue 模型。"],
} as const;

type HealthNumbers = Pick<PlayerHealthEvent, "maxHp" | "hpBefore" | "hpAfter" | "baseAmount" | "bonusMultiplier" | "requestedAmount" | "actualChange" | "overheal" | "minimumHp">;
export interface HealthChangeCalculation extends HealthNumbers { trace: CalculationTraceNode[]; bondOfLife?: NonNullable<PlayerHealthEvent["bondOfLife"]> }

/** Shared executable AST; every reported number comes from this graph. No shield or damage branch. */
export function calculateHealthChange(change: HealthChangeDefinition, hpBefore: number, maxHp: number,
  context?: BondOfLifeContext): HealthChangeCalculation {
  const isDebtOperation = change.operation === "bond-add" || change.operation === "bond-remove";
  if (isDebtOperation && context === undefined) throw new Error("生命之契变更必须启用明确的来源模式与初始债务状态。");
  if (context !== undefined && context.mode !== BOND_OF_LIFE_PROFILE.id) throw new Error("不支持的生命之契来源模式。");
  const sourceRefs = [...PLAYER_HEALTH_PROFILE.sourceRefs, ...(context === undefined ? [] : BOND_OF_LIFE_PROFILE.sourceRefs), ...(change.source.kind === "source" ? change.source.refs : [])];
  const trace = new TraceBuilder(sourceRefs);
  const input = (key: string, value: number, meaning: string, unit = "HP") => traceInput(key, value, unit, ["declaredAmount", "declaredRatio", "healingBonus", "incomingHealingBonus", "minimumHpRatio"].includes(key) ? "declared-health-action" : "actual-player-health-state", meaning);
  const options = { unit: "HP", status: "assumed" as const, warnings: context === undefined ? [...PLAYER_HEALTH_PROFILE.assumptions] : [...BOND_OF_LIFE_PROFILE.assumptions, PLAYER_HEALTH_PROFILE.assumptions[1]] };
  const baseAmount = trace.add("health.base", isDebtOperation ? "生命之契变更基础量" : "基础治疗或生命消耗", change.amount.basis === "fixed" ? expr.input("declaredAmount") : expr.mul(expr.input("basisHp"), expr.input("declaredRatio")),
    change.amount.basis === "fixed" ? [input("declaredAmount", change.amount.value, "动作明确声明的固定生命量")]
      : [input("basisHp", change.amount.basis === "target-max-hp" ? maxHp : hpBefore, change.amount.basis === "target-max-hp" ? "受作用角色最大生命值" : "事件执行前该角色当前生命值"), input("declaredRatio", change.amount.value, "动作声明比例", "ratio")],
    { ...options, explanationKey: "固定量直接使用声明值；比例量在本次事件执行时读取同一角色生命状态，乘以声明比例。" });
  const bonusMultiplier = trace.add("health.bonus", "治疗乘区", change.operation === "heal" ? expr.add(expr.value(1), expr.input("healingBonus"), expr.input("incomingHealingBonus")) : expr.value(1),
    change.operation === "heal" ? [input("healingBonus", change.healingBonus, "本次治疗来源加成 hi.Bonus", "ratio"), input("incomingHealingBonus", change.incomingHealingBonus, "目标受治疗加成 c.HealBonus()", "ratio")] : [],
    { ...options, unit: "ratio", explanationKey: change.operation === "heal" ? "来源治疗加成与目标受治疗加成加算；此入口使用动作明确值，不自动推断装备或被动。" : "生命消耗与生命之契主动变更不受治疗加成影响。" });
  const requestedAmount = trace.add("health.requested", "请求生命变化量", expr.mul(expr.input("baseAmount"), expr.input("bonusMultiplier")),
    [input("baseAmount", baseAmount, "上一步基础量"), input("bonusMultiplier", bonusMultiplier, "上一步治疗乘区", "ratio")],
    { ...options, childIds: ["health.base", "health.bonus"], explanationKey: "基础量乘治疗乘区得到请求量；非治疗操作乘区固定为一。" });
  const debtCalculation = context === undefined ? undefined : calculateBondOfLife(change.operation, requestedAmount, context.debtBefore, maxHp, trace);
  const availableAmount = change.operation === "heal" && debtCalculation !== undefined ? debtCalculation.healingAfterDebt : requestedAmount;
  const availableKey = debtCalculation !== undefined && change.operation === "heal" ? "availableHealing" : "requestedAmount";
  const minimumHp = trace.add("health.minimum", "生命消耗下限", change.operation === "consume" ? expr.mul(expr.input("maxHp"), expr.input("minimumHpRatio")) : expr.value(0),
    change.operation === "consume" ? [input("maxHp", maxHp, "受作用角色最大生命值"), input("minimumHpRatio", change.minimumHpRatio, "动作明确声明的最低生命比例", "ratio")] : [],
    { ...options, explanationKey: "下限只约束本次消耗。已低于下限的角色不会因此回复生命；治疗不使用此下限。" });
  const actualChange = trace.add("health.actual", isDebtOperation ? "实际生命变化（仅债务变更）" : change.operation === "heal" ? "有效治疗" : "实际生命消耗",
    isDebtOperation ? expr.value(0) : expr.max(expr.value(0), expr.min(expr.input(availableKey), change.operation === "heal" ? expr.sub(expr.input("maxHp"), expr.input("hpBefore")) : expr.sub(expr.input("hpBefore"), expr.input("minimumHp")))),
    isDebtOperation ? [] : [input(availableKey, availableAmount, debtCalculation !== undefined && change.operation === "heal" ? "抵消生命之契后可用于回血的治疗" : "本次请求生命量"), input("hpBefore", hpBefore, "事件执行前生命值"), ...(change.operation === "heal" ? [input("maxHp", maxHp, "最大生命值")] : [input("minimumHp", minimumHp, "本次消耗下限")])],
    { ...options, childIds: ["health.requested", "health.minimum", ...(debtCalculation === undefined || change.operation !== "heal" ? [] : ["bond.healingAfterDebt"])], explanationKey: isDebtOperation ? "变更生命之契不会直接恢复或消耗生命。" : change.operation === "heal" ? context === undefined ? "有效治疗最多填满缺失生命；生命之契为零是此模型的明确前提。" : "抵债后的可用治疗最多填满缺失生命。" : "实际消耗不超过当前生命减下限，低于下限时为零；不触发敌人伤害或护盾吸收。" });
  const hpAfter = trace.add("health.after", "事件后生命值", change.operation === "heal" ? expr.add(expr.input("hpBefore"), expr.input("actualChange")) : expr.sub(expr.input("hpBefore"), expr.input("actualChange")),
    [input("hpBefore", hpBefore, "同一生命状态中的事件前生命值"), input("actualChange", actualChange, "实际回复或消耗量")],
    { ...options, childIds: ["health.actual"], explanationKey: "把实际变化写回与反应自伤共用的角色生命状态。" });
  const overheal = trace.add("health.overheal", "溢出治疗", change.operation === "heal" ? expr.sub(expr.input(availableKey), expr.input("actualChange")) : expr.value(0),
    change.operation === "heal" ? [input(availableKey, availableAmount, debtCalculation === undefined ? "请求治疗量" : "抵债后可用治疗量"), input("actualChange", actualChange, "实际回复生命")] : [],
    { ...options, childIds: ["health.requested", "health.actual", ...(debtCalculation === undefined || change.operation !== "heal" ? [] : ["bond.healingAfterDebt"])], explanationKey: debtCalculation === undefined ? "溢出为请求治疗减实际回复；生命消耗没有溢出治疗。" : "溢出为抵债后可用治疗减实际回复，不把已抵债部分重复计作溢出；非治疗操作无溢出。" });
  const bondOfLife = debtCalculation === undefined ? undefined : (({ trace: _trace, ...values }) => values)(debtCalculation);
  return { maxHp, hpBefore, hpAfter, baseAmount, bonusMultiplier, requestedAmount, actualChange, overheal, minimumHp, trace: trace.nodes,
    ...(bondOfLife === undefined ? {} : { bondOfLife }) };
}
