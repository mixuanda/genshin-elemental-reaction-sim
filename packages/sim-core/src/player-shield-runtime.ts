import type {
  CharacterStats, Element, PlayerShieldBonus, PlayerShieldDecision, PlayerShieldInputEvent,
  PlayerHpDamageResolution, PlayerShieldInstance, PlayerShieldLogEntry, PlayerShieldState, PlayerShieldTarget, ScalingStat,
} from "@genshin-dps-lab/schemas";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode, type TraceContext } from "./calculation-trace";

const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const reference = (path: string) => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`;

export const PLAYER_SHIELD_PROFILE = {
  id: "gcsim-b4ae769-template-v1",
  evidenceStatus: "fixed-source-assumed",
  sourceRefs: [
    reference("pkg/core/player/shield/template.go"),
    reference("pkg/core/player/shield/handler.go"),
    reference("pkg/core/player/shield/bonus.go"),
    reference("pkg/avatar/avatar.go"),
  ],
  assumptions: [
    "采用固定 Tmpl.OnDamage：来袭元素为岩时吸收倍率为 1.5；它与 ShieldStrength 按盾元素判断的源码分歧保留，未经游戏实测。",
    "同类型、同保护目标覆盖；每面适用盾各承受完整伤害，角色穿透量取最小值。",
    "仅记录通用模板空回调与管理器事件顺序，不执行角色专属护盾副作用；护盾卡肉延长尚无固定实现。",
  ],
} as const;

export const PLAYER_SHIELD_TRACE_TEXT_ZH: Record<string, string> = {
  "shield.elementFactor": "护盾元素吸收倍率",
  "shield.bonusMultiplier": "护盾强效乘区",
  "shield.effectiveMultiplier": "本次有效吸收倍率",
  "shield.strengthBonus": "本次读取的护盾强效合计",
  "shield.grantStat": "生成护盾时的来源属性",
  "shield.grantHp": "生成的原始护盾生命",
  "shield.expiryFrame": "护盾或强效到期帧",
  "shield.expiryMatch": "是否恰好到达护盾到期帧",
  "shield.capacity": "本次护盾可吸收伤害",
  "shield.hpAfter": "受击后原始护盾生命",
  "shield.absorbedDamage": "本面护盾吸收的伤害",
  "shield.damageAfter": "本面护盾后的穿透伤害",
  "shield.finalDamage": "多盾共同作用后的穿透伤害",
  "shield.finalAbsorbed": "共同作用吸收的伤害",
  "shield.bonusValue": "应用的护盾强效",
  "shield.explain.elementFactor": "采用固定 Tmpl.OnDamage：来袭元素为岩时吸收倍率为 1.5；它与 ShieldStrength 按盾元素判断的源码分歧保留，未经游戏实测。",
  "shield.explain.bonusMultiplier": "护盾强效加算后构成同次受击共用的乘区。",
  "shield.explain.capacity": "原始盾生命乘元素吸收倍率与强效乘区，得到本次入射伤害的吸收容量。",
  "shield.explain.hpAfter": "保留源码 HP − HP × (伤害 / 容量) 的运算顺序，再向下夹到零；不按其他盾的剩余伤害扣除。",
  "shield.explain.damageAfter": "入射伤害减该面盾容量并夹至零；盾生命恰好归零仍属于破盾。",
  "shield.explain.expiryFrame": "到期帧等于应用帧加持续帧数；护盾只在管理器 Tick 的相等帧到期。",
  "shield.explain.grantStat": "以生成事件时的角色属性求值并存入盾生命；后续属性变化不重算已生成的盾。",
  "shield.explain.grantHp": "这是显式声明的通用模板生成公式；不推断任何角色天赋、命座或被动。",
  "shield.explain.strengthBonus": "先排除 expiry ≤ 当前帧的强效。一次性强效本次计入合计，然后移除；在任何盾的适用性判断之前仅读取一次。",
  "shield.explain.finalDamage": "所有适用盾各承受完整入射伤害；普通盾和结晶盾共同保护角色时，穿透伤害取各分支最小值。",
  "shield.explain.finalAbsorbed": "共同吸收量只计一次，不能把各面盾吸收量相加。",
  "shield.explain.expiryMatch": "固定源码只在 expiry == 当前帧时触发；跳过到期帧不会在较晚的 Tick 补触发。",
  "shield.input.incomingIsGeo": "实际受击函数以入射岩元素覆盖倍率",
  "shield.input.sameElement": "入射元素与盾元素是否相同",
  "shield.input.strengthBonus": "本次受击前仅读取一次的全局护盾强效合计",
  "shield.input.hpBefore": "受击前该面盾的原始生命",
  "shield.input.elementFactor": "固定实际受击函数的元素倍率",
  "shield.input.bonusMultiplier": "本次护盾强效乘区",
  "shield.input.incomingDamage": "每面适用盾均接收的完整入射伤害",
  "shield.input.capacity": "本面盾此次吸收容量",
  "shield.input.damageAfter": "本面盾后的穿透伤害",
  "shield.input.frame": "当前事件帧",
  "shield.input.durationFrames": "声明持续帧数",
  "shield.input.em": "生成时来源角色的元素精通",
  "shield.input.statBase": "来源角色属性的基础值",
  "shield.input.statPct": "来源角色属性的百分比加成",
  "shield.input.statFlat": "来源角色属性的固定加成",
  "shield.input.bonusValue": "声明的护盾强效",
  "shield.input.grantFlat": "声明的固定盾生命",
  "shield.input.grantStat": "生成时采用的来源属性",
  "shield.input.grantCoefficient": "声明的属性转化系数",
  "shield.input.activeBonus": "本次读取的有效强效",
  "shield.input.crystallizeDamageAfter": "独立结晶盾分支后的伤害；没有结晶盾时等于入射伤害",
  "shield.input.finalDamage": "所有盾共同作用后的穿透伤害",
  "shield.input.expiryFrame": "盾的固定到期帧",
  "shield.hp.currentHpBefore": "受击前生命值范围修正",
  "shield.hp.attemptedLoss": "护盾后的待扣生命",
  "shield.hp.actualLoss": "实际生命损失",
  "shield.hp.currentHpAfter": "受击后的当前生命",
  "shield.hp.overkill": "超出当前生命的伤害",
  "shield.hp.ratioBefore": "受击前生命比例",
  "shield.hp.ratioAfter": "受击后生命比例",
  "shield.hp.explain.currentHpBefore": "沿用现有玩家受伤模型：先把输入生命值钳制在零至当前生命上限之间。",
  "shield.hp.explain.attemptedLoss": "所有护盾共同作用后的穿透伤害，作为本次尝试扣除的生命。",
  "shield.hp.explain.actualLoss": "实际损失取当前生命与尝试扣除量的较小值。",
  "shield.hp.explain.currentHpAfter": "扣除实际损失后，最低为零；继续沿用归零后仍继续模拟的策略。",
  "shield.hp.explain.overkill": "尝试扣除量减去实际损失，记录超出当前生命的伤害。",
  "shield.hp.explain.ratio": "生命比例使用本次当前生命上限；上限为零时比例记为零。",
  "shield.hp.input.currentHp": "此次受击前输入的当前生命",
  "shield.hp.input.maxHp": "此次受击时的生命上限",
  "shield.hp.input.incomingDamage": "所有护盾共同作用后的穿透伤害",
  "shield.hp.input.currentHpBefore": "范围修正后的受击前生命",
  "shield.hp.input.attemptedLoss": "本次尝试扣除的生命",
  "shield.hp.input.actualLoss": "本次实际扣除的生命",
  "shield.hp.input.currentHpAfter": "本次受击后的当前生命",
};

const numericInput = (key: string, value: number, meaningKey: string, unit = "HP", context?: TraceContext) => ({
  ...traceInput(key, value, unit, "actual-player-shield-state", meaningKey),
  ...(context === undefined ? {} : { context }),
});
const traceOptions = {
  status: "assumed" as const,
  warnings: [...PLAYER_SHIELD_PROFILE.assumptions],
  unit: "HP",
};

interface ShieldDamageCalculationInput {
  hpBefore: number;
  incomingDamage: number;
  incomingElement: Element;
  shieldElement: Element;
  shieldBonus: number;
}

/** The literal source arithmetic is shared by mutation and exported trace replay. */
function calculateShieldDamage(input: ShieldDamageCalculationInput, trace: TraceBuilder, prefix: string) {
  const { hpBefore, incomingDamage, incomingElement, shieldElement, shieldBonus } = input;
  const elementFactor = trace.add(`${prefix}.elementFactor`, "shield.elementFactor",
    expr.condition("equal", expr.input("incomingIsGeo"), expr.value(1), expr.value(1.5),
      expr.condition("equal", expr.input("sameElement"), expr.value(1), expr.value(2.5), expr.value(1))),
    [numericInput("incomingIsGeo", Number(incomingElement === "geo"), "shield.input.incomingIsGeo", "boolean"),
      numericInput("sameElement", Number(incomingElement === shieldElement), "shield.input.sameElement", "boolean")],
    { ...traceOptions, unit: "ratio", explanationKey: "shield.explain.elementFactor" });
  const bonusMultiplier = trace.add(`${prefix}.bonusMultiplier`, "shield.bonusMultiplier",
    expr.add(expr.value(1), expr.input("shieldBonus")),
    [numericInput("shieldBonus", shieldBonus, "shield.input.strengthBonus", "ratio")],
    { ...traceOptions, unit: "ratio", explanationKey: "shield.explain.bonusMultiplier" });
  const capacity = trace.add(`${prefix}.capacity`, "shield.capacity",
    expr.mul(expr.input("hpBefore"), expr.input("elementFactor"), expr.input("bonusMultiplier")),
    [numericInput("hpBefore", hpBefore, "shield.input.hpBefore"),
      numericInput("elementFactor", elementFactor, "shield.input.elementFactor", "ratio"),
      numericInput("bonusMultiplier", bonusMultiplier, "shield.input.bonusMultiplier", "ratio")],
    { ...traceOptions, childIds: [`${prefix}.elementFactor`, `${prefix}.bonusMultiplier`],
      explanationKey: "shield.explain.capacity" });
  // The template divides by capacity; the finite trace contract cannot represent
  // zero/negative capacity as an ordinary supported shield.
  if (capacity <= 0) throw new Error("Player shield absorption capacity must be positive");
  const effectiveMultiplier = trace.add(`${prefix}.effectiveMultiplier`, "shield.effectiveMultiplier",
    expr.mul(expr.input("elementFactor"), expr.input("bonusMultiplier")),
    [numericInput("elementFactor", elementFactor, "shield.input.elementFactor", "ratio"),
      numericInput("bonusMultiplier", bonusMultiplier, "shield.bonusMultiplier", "ratio")],
    { ...traceOptions, unit: "ratio", childIds: [`${prefix}.elementFactor`, `${prefix}.bonusMultiplier`] });
  const hpAfter = trace.add(`${prefix}.hpAfter`, "shield.hpAfter",
    expr.max(expr.value(0), expr.sub(expr.input("hpBefore"),
      expr.mul(expr.input("hpBefore"), expr.div(expr.input("incomingDamage"), expr.input("capacity"))))),
    [numericInput("hpBefore", hpBefore, "shield.input.hpBefore"), numericInput("incomingDamage", incomingDamage, "shield.input.incomingDamage"),
      numericInput("capacity", capacity, "shield.input.capacity")],
    { ...traceOptions, childIds: [`${prefix}.capacity`],
      explanationKey: "shield.explain.hpAfter" });
  const damageAfter = trace.add(`${prefix}.damageAfter`, "shield.damageAfter",
    expr.max(expr.value(0), expr.sub(expr.input("incomingDamage"), expr.input("capacity"))),
    [numericInput("incomingDamage", incomingDamage, "shield.input.incomingDamage"), numericInput("capacity", capacity, "shield.input.capacity")],
    { ...traceOptions, childIds: [`${prefix}.capacity`], explanationKey: "shield.explain.damageAfter" });
  const absorbedDamage = trace.add(`${prefix}.absorbedDamage`, "shield.absorbedDamage",
    expr.sub(expr.input("incomingDamage"), expr.input("damageAfter")),
    [numericInput("incomingDamage", incomingDamage, "shield.input.incomingDamage"), numericInput("damageAfter", damageAfter, "shield.input.damageAfter")],
    { ...traceOptions, childIds: [`${prefix}.damageAfter`] });
  return { elementFactor, effectiveMultiplier, capacity, hpAfter, damageAfter, absorbedDamage };
}

type ShieldDeclaration = Extract<PlayerShieldInputEvent, { kind: "grant" | "bonus" }>;
type IncomingDeclaration = Extract<PlayerShieldInputEvent, { kind: "incoming-hit" }>;

export interface PlayerShieldAbsorbInput {
  frame: number;
  targetActorId: string;
  activeCharacterId: string;
  incomingDamage: number;
  incomingElement: Element;
  crystallizeDamageAfter: number;
  operation: "incoming-hit" | "reaction-hit";
  inputEventId?: string;
  inputEvent?: IncomingDeclaration;
}

function cloneState(state: PlayerShieldState): PlayerShieldState {
  return {
    nextInstanceId: state.nextInstanceId,
    shields: state.shields.map((shield) => ({ ...shield, target: { ...shield.target } })),
    bonuses: state.bonuses.map((bonus) => ({ ...bonus })),
  };
}

function cloneEvent(event: PlayerShieldInputEvent): PlayerShieldInputEvent {
  if (event.kind === "grant") return { ...event, source: { ...event.source }, target: { ...event.target }, hp: { ...event.hp } };
  if (event.kind === "incoming-hit") return { ...event, source: { ...event.source }, target: { ...event.target } };
  return { ...event, source: { ...event.source } };
}

function decisionFrom(state: PlayerShieldState, operation: PlayerShieldDecision["operation"]): PlayerShieldDecision {
  return {
    operation, inputEventId: null, inputEvent: null, ownerStats: null,
    targetActorId: null, activeCharacterId: null, incomingDamage: null, incomingElement: null,
    crystallizeDamageAfter: null, capacity: null, strengthBonus: null, absorbedDamage: null,
    damageAfterShield: null, shieldDetails: [], callbacks: [],
    stateBefore: cloneState(state), stateAfter: cloneState(state),
  };
}

function sameTarget(a: PlayerShieldTarget, b: PlayerShieldTarget): boolean {
  return a.kind === "active" ? b.kind === "active" : b.kind === "actor" && a.actorId === b.actorId;
}

function calculateExpiry(frame: number, durationFrames: number, trace: TraceBuilder): number {
  return trace.add("shield.expiryFrame", "shield.expiryFrame",
    expr.add(expr.input("frame"), expr.input("durationFrames")),
    [numericInput("frame", frame, "shield.input.frame", "frames"), numericInput("durationFrames", durationFrames, "shield.input.durationFrames", "frames")],
    { ...traceOptions, unit: "frames", explanationKey: "shield.explain.expiryFrame" });
}

function calculateGrantStat(stat: ScalingStat, stats: CharacterStats, trace: TraceBuilder): number {
  if (stat === "em") return trace.add("shield.grantStat", "shield.grantStat",
    expr.input("em"), [numericInput("em", stats.em, "shield.input.em", "EM")], { ...traceOptions, unit: "EM" });
  const values: [number, number, number] = stat === "hp" ? [stats.baseHp, stats.hpPct, stats.flatHp]
    : stat === "atk" ? [stats.baseAtk, stats.atkPct, stats.flatAtk]
      : [stats.baseDef, stats.defPct, stats.flatDef];
  const [base, pct, flat] = values;
  return trace.add("shield.grantStat", "shield.grantStat",
    expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("pct"))), expr.input("flat")),
    [numericInput("base", base, "shield.input.statBase", stat, { scalingStat: stat }), numericInput("pct", pct, "shield.input.statPct", "ratio", { scalingStat: stat }),
      numericInput("flat", flat, "shield.input.statFlat", stat, { scalingStat: stat })],
    { ...traceOptions, unit: stat, explanationKey: "shield.explain.grantStat" });
}

function applyDeclaration(state: PlayerShieldState, event: ShieldDeclaration, frame: number,
  ownerStats: CharacterStats | undefined, trace: TraceBuilder): PlayerShieldDecision {
  const decision = decisionFrom(state, event.kind);
  decision.inputEventId = event.id;
  decision.inputEvent = cloneEvent(event);
  const after = decision.stateAfter;
  if (event.kind === "bonus") {
    const bonus: PlayerShieldBonus = {
      key: event.key,
      value: trace.add("shield.bonusValue", "shield.bonusValue", expr.input("value"),
        [numericInput("value", event.value, "shield.input.bonusValue", "ratio")], { ...traceOptions, unit: "ratio" }),
      expiresAtFrame: event.durationFrames === null ? null : calculateExpiry(frame, event.durationFrames, trace),
      consumeOnRead: event.consumeOnRead,
    };
    const index = after.bonuses.findIndex((existing) => existing.key === event.key);
    if (index < 0) after.bonuses.push(bonus);
    else after.bonuses[index] = bonus;
    return decision;
  }
  decision.ownerStats = ownerStats ? { ...ownerStats } : null;
  if (event.hp.stat !== undefined && !ownerStats) throw new Error("Player shield stat scaling requires ownerStats");
  const stat = event.hp.stat === undefined ? 0 : calculateGrantStat(event.hp.stat, ownerStats!, trace);
  const hp = trace.add("shield.grantHp", "shield.grantHp",
    expr.add(expr.input("flat"), expr.mul(expr.input("stat"), expr.input("coefficient"))),
    [numericInput("flat", event.hp.flat, "shield.input.grantFlat"), numericInput("stat", stat, "shield.input.grantStat"),
      numericInput("coefficient", event.hp.coefficient ?? 0, "shield.input.grantCoefficient", "ratio")],
    { ...traceOptions, childIds: event.hp.stat === undefined ? [] : ["shield.grantStat"],
      explanationKey: "shield.explain.grantHp" });
  if (hp <= 0) throw new Error("Player shield generated HP must be positive");
  decision.capacity = hp;
  const shield: PlayerShieldInstance = {
    instanceId: after.nextInstanceId++, definitionId: event.id, ownerId: event.ownerId,
    typeKey: event.typeKey, label: event.label, element: event.element, target: { ...event.target },
    hp, expiresAtFrame: calculateExpiry(frame, event.durationFrames, trace),
  };
  const index = after.shields.findIndex((existing) => existing.typeKey === shield.typeKey && sameTarget(existing.target, shield.target));
  if (index < 0) after.shields.push(shield);
  else {
    decision.callbacks.push({ kind: "OnOverwrite", instanceId: after.shields[index]!.instanceId, reason: "overwrite" });
    after.shields[index] = shield;
  }
  decision.callbacks.push({ kind: "OnShielded", instanceId: shield.instanceId, reason: "grant" });
  return decision;
}

function calculateStrengthBonus(state: PlayerShieldState, frame: number, trace: TraceBuilder): {
  activeBonuses: PlayerShieldBonus[];
  strengthBonus: number;
} {
  const activeBonuses = state.bonuses.filter((bonus) => bonus.expiresAtFrame === null || bonus.expiresAtFrame > frame);
  const strengthBonus = trace.add("shield.strengthBonus", "shield.strengthBonus",
    expr.add(...activeBonuses.map((_, index) => expr.input(`bonus${index}`))),
    activeBonuses.map((bonus, index) => numericInput(`bonus${index}`, bonus.value, "shield.input.activeBonus", "ratio", { bonusKey: bonus.key })),
    { ...traceOptions, unit: "ratio", explanationKey: "shield.explain.strengthBonus" });
  return { activeBonuses, strengthBonus };
}

/** Read-only preview for parallel crystallize absorption; actual absorb consumes once. */
export function playerShieldStrengthBonus(state: PlayerShieldState, frame: number): number {
  return calculateStrengthBonus(state, frame, new TraceBuilder([...PLAYER_SHIELD_PROFILE.sourceRefs])).strengthBonus;
}

function absorbState(state: PlayerShieldState, input: PlayerShieldAbsorbInput, trace: TraceBuilder): PlayerShieldDecision {
  const decision = decisionFrom(state, input.operation);
  decision.inputEventId = input.inputEventId ?? input.inputEvent?.id ?? null;
  decision.inputEvent = input.inputEvent ? cloneEvent(input.inputEvent) : null;
  decision.targetActorId = input.targetActorId;
  decision.activeCharacterId = input.activeCharacterId;
  decision.incomingDamage = input.incomingDamage;
  decision.incomingElement = input.incomingElement;
  decision.crystallizeDamageAfter = input.crystallizeDamageAfter;
  const after = decision.stateAfter;
  // ShieldBonus runs even when no shield is eligible for this target.
  const { activeBonuses, strengthBonus } = calculateStrengthBonus(after, input.frame, trace);
  decision.strengthBonus = strengthBonus;
  after.bonuses = activeBonuses.filter((bonus) => !bonus.consumeOnRead);
  const survivors: PlayerShieldInstance[] = [];
  const broken: number[] = [];
  for (const shield of after.shields) {
    const applies = shield.target.kind === "active" ? input.targetActorId === input.activeCharacterId : shield.target.actorId === input.targetActorId;
    if (!applies) {
      survivors.push(shield);
      continue;
    }
    const hpBefore = shield.hp;
    const result = calculateShieldDamage({ hpBefore, incomingDamage: input.incomingDamage,
      incomingElement: input.incomingElement, shieldElement: shield.element, shieldBonus: strengthBonus }, trace, `shield.${shield.instanceId}`);
    shield.hp = result.hpAfter;
    const isBroken = result.hpAfter === 0;
    decision.shieldDetails.push({
      instanceId: shield.instanceId, hpBefore, absorptionMultiplier: result.elementFactor,
      effectiveAbsorptionMultiplier: result.effectiveMultiplier, capacity: result.capacity,
      hpAfter: result.hpAfter, absorbedDamage: result.absorbedDamage, damageAfterShield: result.damageAfter, broken: isBroken,
    });
    if (isBroken) broken.push(shield.instanceId);
    else survivors.push(shield);
  }
  after.shields = survivors;
  // Handler removes all broken shields before emitting any OnShieldBreak.
  decision.callbacks = broken.map((instanceId) => ({ kind: "OnShieldBreak", instanceId, reason: "damage" }));
  decision.damageAfterShield = trace.add("shield.finalDamage", "shield.finalDamage",
    expr.min(expr.input("incomingDamage"), expr.input("crystallizeDamageAfter"),
      ...decision.shieldDetails.map((_, index) => expr.input(`taken${index}`))),
    [numericInput("incomingDamage", input.incomingDamage, "shield.input.incomingDamage"),
      numericInput("crystallizeDamageAfter", input.crystallizeDamageAfter, "shield.input.crystallizeDamageAfter"),
      ...decision.shieldDetails.map((detail, index) => numericInput(`taken${index}`, detail.damageAfterShield, "shield.input.damageAfter", "HP", { instanceId: detail.instanceId }))],
    { ...traceOptions, childIds: decision.shieldDetails.map((detail) => `shield.${detail.instanceId}.damageAfter`),
      explanationKey: "shield.explain.finalDamage" });
  decision.absorbedDamage = trace.add("shield.finalAbsorbed", "shield.finalAbsorbed",
    expr.sub(expr.input("incomingDamage"), expr.input("damageAfterShield")),
    [numericInput("incomingDamage", input.incomingDamage, "shield.input.incomingDamage"),
      numericInput("damageAfterShield", decision.damageAfterShield, "shield.input.finalDamage")],
    { ...traceOptions, childIds: ["shield.finalDamage"], explanationKey: "shield.explain.finalAbsorbed" });
  return decision;
}

function expireState(state: PlayerShieldState, frame: number, trace: TraceBuilder): PlayerShieldDecision {
  const decision = decisionFrom(state, "expire");
  const expired: number[] = [];
  decision.stateAfter.shields = decision.stateAfter.shields.filter((shield) => {
    const match = trace.add(`shield.${shield.instanceId}.expiryMatch`, "shield.expiryMatch",
      expr.condition("equal", expr.input("expiryFrame"), expr.input("frame"), expr.value(1), expr.value(0)),
      [numericInput("expiryFrame", shield.expiresAtFrame, "shield.input.expiryFrame", "frames"), numericInput("frame", frame, "shield.input.frame", "frames")],
      { ...traceOptions, unit: "boolean", explanationKey: "shield.explain.expiryMatch" });
    if (match === 0) return true;
    expired.push(shield.instanceId);
    decision.callbacks.push({ kind: "OnExpire", instanceId: shield.instanceId, reason: "expire" });
    return false;
  });
  // All template OnExpire callbacks precede handler OnShieldBreak events.
  for (const instanceId of expired) decision.callbacks.push({ kind: "OnShieldBreak", instanceId, reason: "expire" });
  // Shield bonus expiry is intentionally lazy and is only pruned by ShieldBonus.
  return decision;
}

/** Opt-in generic shield template; callers schedule Tick and player damage. */
export class PlayerShieldRuntime {
  private state: PlayerShieldState = { nextInstanceId: 0, shields: [], bonuses: [] };

  captureState(): PlayerShieldState { return cloneState(this.state); }

  apply(event: ShieldDeclaration, frame: number, ownerStats?: CharacterStats): PlayerShieldDecision {
    const decision = applyDeclaration(this.state, event, frame, ownerStats, new TraceBuilder([...PLAYER_SHIELD_PROFILE.sourceRefs]));
    this.state = cloneState(decision.stateAfter);
    return decision;
  }

  absorb(input: PlayerShieldAbsorbInput): PlayerShieldDecision {
    const decision = absorbState(this.state, input, new TraceBuilder([...PLAYER_SHIELD_PROFILE.sourceRefs]));
    this.state = cloneState(decision.stateAfter);
    return decision;
  }

  expire(frame: number): PlayerShieldDecision {
    const decision = expireState(this.state, frame, new TraceBuilder([...PLAYER_SHIELD_PROFILE.sourceRefs]));
    this.state = cloneState(decision.stateAfter);
    return decision;
  }
}

/** The existing applyPlayerHpDamage arithmetic, executed by the exported AST. */
export function calculatePlayerShieldHpDamage(input: {
  currentHp: number;
  maxHp: number;
  incomingDamage: number;
}): { resolution: PlayerHpDamageResolution; trace: CalculationTraceNode[] } {
  const finite = (value: number, field: string): void => {
    if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite.`);
  };
  const nonNegative = (value: number, field: string): void => {
    finite(value, field);
    if (value < 0) throw new RangeError(`${field} must be non-negative.`);
  };
  finite(input.currentHp, "currentHp");
  nonNegative(input.maxHp, "maxHp");
  nonNegative(input.incomingDamage, "incomingDamage");
  const trace = new TraceBuilder(["packages/sim-core/src/player-damage.ts#applyPlayerHpDamage"]);
  const hpInput = (key: string, value: number, meaningKey: string) =>
    traceInput(key, value, "HP", "actual-player-hp-state", meaningKey);
  const options = { status: "applied" as const, unit: "HP" };
  const currentHpBefore = trace.add("shield.hp.currentHpBefore", "shield.hp.currentHpBefore",
    expr.clamp(expr.input("currentHp"), expr.value(0), expr.input("maxHp")),
    [hpInput("currentHp", input.currentHp, "shield.hp.input.currentHp"), hpInput("maxHp", input.maxHp, "shield.hp.input.maxHp")],
    { ...options, explanationKey: "shield.hp.explain.currentHpBefore" });
  const attemptedLoss = trace.add("shield.hp.attemptedLoss", "shield.hp.attemptedLoss",
    expr.input("incomingDamage"), [hpInput("incomingDamage", input.incomingDamage, "shield.hp.input.incomingDamage")],
    { ...options, explanationKey: "shield.hp.explain.attemptedLoss" });
  const actualLoss = trace.add("shield.hp.actualLoss", "shield.hp.actualLoss",
    expr.min(expr.input("currentHpBefore"), expr.input("attemptedLoss")),
    [hpInput("currentHpBefore", currentHpBefore, "shield.hp.input.currentHpBefore"), hpInput("attemptedLoss", attemptedLoss, "shield.hp.input.attemptedLoss")],
    { ...options, childIds: ["shield.hp.currentHpBefore", "shield.hp.attemptedLoss"], explanationKey: "shield.hp.explain.actualLoss" });
  const currentHpAfter = trace.add("shield.hp.currentHpAfter", "shield.hp.currentHpAfter",
    expr.sub(expr.input("currentHpBefore"), expr.input("actualLoss")),
    [hpInput("currentHpBefore", currentHpBefore, "shield.hp.input.currentHpBefore"), hpInput("actualLoss", actualLoss, "shield.hp.input.actualLoss")],
    { ...options, childIds: ["shield.hp.currentHpBefore", "shield.hp.actualLoss"], explanationKey: "shield.hp.explain.currentHpAfter" });
  const overkill = trace.add("shield.hp.overkill", "shield.hp.overkill",
    expr.sub(expr.input("attemptedLoss"), expr.input("actualLoss")),
    [hpInput("attemptedLoss", attemptedLoss, "shield.hp.input.attemptedLoss"), hpInput("actualLoss", actualLoss, "shield.hp.input.actualLoss")],
    { ...options, childIds: ["shield.hp.attemptedLoss", "shield.hp.actualLoss"], explanationKey: "shield.hp.explain.overkill" });
  const hpRatioBefore = trace.add("shield.hp.ratioBefore", "shield.hp.ratioBefore",
    expr.condition("equal", expr.input("maxHp"), expr.value(0), expr.value(0), expr.div(expr.input("currentHpBefore"), expr.input("maxHp"))),
    [hpInput("currentHpBefore", currentHpBefore, "shield.hp.input.currentHpBefore"), hpInput("maxHp", input.maxHp, "shield.hp.input.maxHp")],
    { ...options, unit: "ratio", childIds: ["shield.hp.currentHpBefore"], explanationKey: "shield.hp.explain.ratio" });
  const hpRatioAfter = trace.add("shield.hp.ratioAfter", "shield.hp.ratioAfter",
    expr.condition("equal", expr.input("maxHp"), expr.value(0), expr.value(0), expr.div(expr.input("currentHpAfter"), expr.input("maxHp"))),
    [hpInput("currentHpAfter", currentHpAfter, "shield.hp.input.currentHpAfter"), hpInput("maxHp", input.maxHp, "shield.hp.input.maxHp")],
    { ...options, unit: "ratio", childIds: ["shield.hp.currentHpAfter"], explanationKey: "shield.hp.explain.ratio" });
  return {
    resolution: Object.freeze({
      zeroHpPolicy: "clamp-and-continue" as const, inputCurrentHp: input.currentHp, currentHpBefore, currentHpAfter,
      maxHp: input.maxHp, attemptedLoss, actualLoss, overkill, hpRatioBefore, hpRatioAfter,
    }),
    trace: trace.nodes,
  };
}

/** Re-executes the same formulas from pre-event state, never from saved outputs. */
export function playerShieldTrace(entry: PlayerShieldLogEntry): CalculationTraceNode[] {
  const trace = new TraceBuilder([...PLAYER_SHIELD_PROFILE.sourceRefs]);
  let damageAfterShield: number | null = null;
  if (entry.operation === "expire") {
    expireState(entry.stateBefore, entry.frame, trace);
  } else if (entry.operation === "grant" || entry.operation === "bonus") {
    const event = entry.inputEvent;
    if (!event || event.kind === "incoming-hit" || event.kind !== entry.operation) {
      throw new Error("Player shield trace requires its original grant or bonus declaration");
    }
    applyDeclaration(entry.stateBefore, event, entry.frame, entry.ownerStats ?? undefined, trace);
  } else {
    if (entry.targetActorId === null || entry.activeCharacterId === null || entry.incomingDamage === null
      || entry.incomingElement === null || entry.crystallizeDamageAfter === null) {
      throw new Error("Player shield damage trace is missing its original damage inputs");
    }
    const decision = absorbState(entry.stateBefore, {
      frame: entry.frame, operation: entry.operation, targetActorId: entry.targetActorId,
      activeCharacterId: entry.activeCharacterId, incomingDamage: entry.incomingDamage,
      incomingElement: entry.incomingElement, crystallizeDamageAfter: entry.crystallizeDamageAfter,
      ...(entry.inputEventId === null ? {} : { inputEventId: entry.inputEventId }),
      ...(entry.inputEvent?.kind === "incoming-hit" ? { inputEvent: entry.inputEvent } : {}),
    }, trace);
    damageAfterShield = decision.damageAfterShield;
  }
  if (entry.hpResolution !== undefined) {
    if (damageAfterShield === null) throw new Error("Player shield HP trace requires a damage operation");
    const hp = calculatePlayerShieldHpDamage({
      currentHp: entry.hpResolution.inputCurrentHp,
      maxHp: entry.hpResolution.maxHp,
      incomingDamage: damageAfterShield,
    });
    return [...trace.nodes, ...hp.trace];
  }
  return trace.nodes;
}
