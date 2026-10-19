import {
  ARTIFACT_BUFF_SOURCE, createArtifactBuffState,
  type ArtifactBuffActor, type ArtifactBuffCapturedState, type ArtifactBuffDecision, type ArtifactBuffEvent,
  type ArtifactBuffModel, type ArtifactBuffOrdinaryReaction, type ArtifactBuffState,
} from "@genshin-dps-lab/reaction-formulas";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

export const ARTIFACT_BUFF_PROFILE = {
  ...ARTIFACT_BUFF_SOURCE, evidence: "fixed-source-assumed",
  assumptions: [
    "六套仅接普通宿主实际事件，固定全局帧且明确无角色卡肉；两件套和其他面板属性由输入构筑提供。",
    "宗室采用源码pre-burst时序及显式持有者自身0／1帧分支；已有增益刷新时保留旧值，源码仍有待实测TODO。",
    "教官同名团队效果覆盖刷新；多持有者延长规则源码仍有TODO。饰金初始化时固定队伍基础元素人数。",
    "教官／饰金必须在真实反应事件处、反应live EM取样前应用；不得回填既存攻击快照中的EM或ATK。",
    "谐律仅由实际生命之契非零变化触发；乐园仅接普通三绽放且使用反应加成，不把它当普通增伤。",
    "辰砂限单持有者；固定源码对任意角色的正数DrainInfo触发增层，任意实际换人删除窗口；未把此来源行为提升为游戏实测。",
    "状态存在性在到期帧仍有效，真正Stats／ReactBonus读取才删除已到期modifier；只读审计不会改变状态。",
  ],
} as const;
type ActorState = ArtifactBuffCapturedState["actors"][number];
const bloomReactions = new Set<string>(["bloom", "hyperbloom", "burgeon"]);
export interface ArtifactBuffRuntimeDecision extends ArtifactBuffDecision { trace: CalculationTraceNode[]; }

/** These results, not independently authored arithmetic, write the live state. */
function transitionGraph(effect: ArtifactBuffActor["effectId"], frame: number) {
  const trace = new TraceBuilder([ARTIFACT_BUFF_SOURCE.sourceRefs[effect]]);
  const options = { status: "assumed" as const, warnings: [...ARTIFACT_BUFF_PROFILE.assumptions] };
  const input = (key: string, value: number, unit: string, meaning: string) => traceInput(key, value, unit, "actual-artifact-callback", meaning);
  return {
    trace,
    presence(key: string, expiry: number | null): boolean {
      return trace.add(`artifact.state.${key}Presence`, "到期帧包含在来源存在性判定内",
        expr.condition("equal", expr.input("hasExpiry"), expr.value(1), expr.condition("lte", expr.input("eventFrame"), expr.input("expiryFrame"), expr.value(1), expr.value(0)), expr.value(0)),
        [input("hasExpiry", expiry === null ? 0 : 1, "boolean", "modifier或status是否实际存在"), input("eventFrame", frame, "frame", "实际事件帧"), input("expiryFrame", expiry ?? 0, "frame", "实际到期帧；不存在时不进入此比较")],
        { ...options, unit: "boolean", explanationKey: "状态到期帧等号仍有效；真正完整属性或反应加成读取可提前删除modifier，删除后的存在性为0。" }) === 1;
    },
    expiry(key: string, duration: number): number {
      return trace.add(`artifact.state.${key}`, "来源帧与实际持续帧相加",
        expr.add(expr.input("eventFrame"), expr.input("durationFrames")),
        [input("eventFrame", frame, "frame", "实际事件帧"), input("durationFrames", duration, "frame", "固定来源持续帧或延迟帧")], { ...options, unit: "frame" });
    },
    reset(key: string): number {
      return trace.add(`artifact.state.${key}`, "来源事件清空实际层数", expr.value(0), [], { ...options, unit: "count" });
    },
    stacks(previous: number, cap: number, existing: boolean): number {
      const start = trace.add("artifact.state.stackBase", "按实际窗口存在性保留或清空旧层数",
        expr.condition("equal", expr.input("windowPresent"), expr.value(1), expr.input("stacksBefore"), expr.value(0)),
        [input("windowPresent", existing ? 1 : 0, "boolean", "本次查询的实际窗口存在性"), input("stacksBefore", previous, "count", "事件前私有层数")], { ...options, unit: "count" });
      return trace.add("artifact.state.stacksAfter", "实际增加一层并按来源上限截断",
        expr.min(expr.input("stackCap"), expr.add(expr.input("stackBase"), expr.value(1))),
        [input("stackCap", cap, "count", "固定来源层数上限"), input("stackBase", start, "count", "本次增层前有效层数")], { ...options, unit: "count", childIds: ["artifact.state.stackBase"] });
    },
    count(key: string, actual: number): number {
      return trace.add(`artifact.state.${key}`, "初始化队伍对应元素人数上限",
        expr.min(expr.value(ARTIFACT_BUFF_SOURCE.gilded.countCap), expr.input("actualPartyCount")),
        [input("actualPartyCount", actual, "count", "初始化时除持有者外满足元素比较的队员数")], { ...options, unit: "count" });
    },
    unchangedExpiry(expiry: number): number {
      return trace.add("artifact.state.unchangedExpiry", "辰砂增层保留原窗口到期帧", expr.input("expiryBefore"),
        [input("expiryBefore", expiry, "frame", "爆发建立的原窗口到期帧")], { ...options, unit: "frame", explanationKey: "掉血增层不延长16秒爆发窗口。" });
    },
    expiresOnRead(expiry: number): boolean {
      return trace.add("artifact.state.expiredOnRead", "真正读取属性或反应加成时删除已到期modifier",
        expr.condition("lte", expr.input("expiryFrame"), expr.input("readFrame"), expr.value(1), expr.value(0)),
        [input("expiryFrame", expiry, "frame", "读取前仍保存的modifier到期帧"), input("readFrame", frame, "frame", "实际完整读取帧")],
        { ...options, unit: "boolean", explanationKey: "完整Stats及ReactBonus在到期帧等号即删除；只读审计不会触发此规则。" }) === 1;
    },
  };
}

/** This graph produces both the applied numbers and their explanation. */
function values(effect: ArtifactBuffActor["effectId"], state: ArtifactBuffState, sameElementCount: number, differentElementCount: number) {
  const trace = new TraceBuilder([ARTIFACT_BUFF_SOURCE.sourceRefs[effect]]);
  const options = { status: "assumed" as const, warnings: [...ARTIFACT_BUFF_PROFILE.assumptions] };
  const input = (key: string, value: number, meaning: string) => traceInput(key, value, "count", "actual-artifact-state", meaning);
  let atkPct = 0, em = 0, dmgBonus = 0, reactionBonus = 0;
  if (effect === "noblesse-4pc") atkPct = trace.add("artifact.buff.noblesse", "宗室4件套攻击加成", expr.value(ARTIFACT_BUFF_SOURCE.noblesse.atkPct), [], { ...options, unit: "ratio", explanationKey: "真实爆发事件给予同名团队攻击窗口；不会重复叠加两份。" });
  if (effect === "instructor-4pc") em = trace.add("artifact.buff.instructor", "教官4件套元素精通", expr.value(ARTIFACT_BUFF_SOURCE.instructor.em), [], { ...options, unit: "EM", explanationKey: "装备者前台亲自触发真实反应后应用团队精通。" });
  if (effect === "gilded-4pc") {
    atkPct = trace.add("artifact.buff.gildedAtk", "饰金同元素队友攻击加成", expr.mul(expr.input("sameElementCount"), expr.value(ARTIFACT_BUFF_SOURCE.gilded.atkPctPerSameElement)), [input("sameElementCount", sameElementCount, "初始化隊伍中除本人外同元素人数，最多3")], { ...options, unit: "ratio" });
    em = trace.add("artifact.buff.gildedEm", "饰金异元素队友精通", expr.mul(expr.input("differentElementCount"), expr.value(ARTIFACT_BUFF_SOURCE.gilded.emPerDifferentElement)), [input("differentElementCount", differentElementCount, "初始化队伍中除本人外异元素人数，最多3")], { ...options, unit: "EM" });
  }
  if (effect === "fragment-4pc") dmgBonus = trace.add("artifact.buff.fragment", "谐律实际生命之契变化层数增伤", expr.mul(expr.input("stacks"), expr.value(ARTIFACT_BUFF_SOURCE.fragment.dmgBonusPerStack)), [input("stacks", state.stacks, "此次事件后实际层数，上限3")], { ...options, unit: "ratio" });
  if (effect === "paradise-4pc") reactionBonus = trace.add("artifact.buff.paradise", "乐园普通绽放反应加成", expr.add(expr.value(ARTIFACT_BUFF_SOURCE.paradise.baseReactionBonus), expr.mul(expr.input("stacks"), expr.value(ARTIFACT_BUFF_SOURCE.paradise.reactionBonusPerStack))), [input("stacks", state.stacks, "ReactBonus读取时仍有效的层数，上限4")], { ...options, unit: "ratio", explanationKey: "仅普通绽放、超绽放与烈绽放；固定40%加成另加每层10%，不是普通伤害加成。" });
  if (effect === "vermillion-4pc") atkPct = trace.add("artifact.buff.vermillion", "辰砂爆发窗口与真实掉血层数", expr.add(expr.value(ARTIFACT_BUFF_SOURCE.vermillion.baseAtkPct), expr.mul(expr.input("stacks"), expr.value(ARTIFACT_BUFF_SOURCE.vermillion.atkPctPerStack))), [input("stacks", state.stacks, "窗口内通过48帧冷却的真实掉血事件层数，上限4")], { ...options, unit: "ratio", explanationKey: "掉血增层只更新属性，不延长原16秒窗口。" });
  return { atkPct, em, dmgBonus, reactionBonus, trace: trace.nodes };
}
export function artifactBuffDecisionTrace(decision: ArtifactBuffRuntimeDecision) { return decision.trace; }

export class ArtifactBuffRuntime {
  private readonly actors: ActorState[];
  private readonly partyIds: string[];
  constructor(model: ArtifactBuffModel, party: readonly { id: string; element: string }[]) {
    this.partyIds = party.map(actor => actor.id);
    this.actors = [...model.actors].sort((a, b) => this.partyIds.indexOf(a.actorId) - this.partyIds.indexOf(b.actorId)).map(actor => {
      const owner = party.find(member => member.id === actor.actorId)!;
      const graph = transitionGraph(actor.effectId, 0);
      return { ...actor, state: createArtifactBuffState(),
        sameElementCount: actor.effectId === "gilded-4pc" ? graph.count("sameElementCount", party.filter(member => member.id !== actor.actorId && member.element === owner.element).length) : 0,
        differentElementCount: actor.effectId === "gilded-4pc" ? graph.count("differentElementCount", party.filter(member => member.id !== actor.actorId && member.element !== owner.element).length) : 0 };
    });
  }
  private begin(actor: ActorState, event: ArtifactBuffEvent): ArtifactBuffRuntimeDecision {
    return { actorId: actor.actorId, effectId: actor.effectId, sourceProfileId: ARTIFACT_BUFF_SOURCE.id,
      sourceRef: ARTIFACT_BUFF_SOURCE.sourceRefs[actor.effectId], event: structuredClone(event), outcome: "applied",
      stateBefore: { ...actor.state }, stateAfter: { ...actor.state }, sameElementCount: actor.sameElementCount,
      differentElementCount: actor.differentElementCount, applications: [], removals: [], delayedApplications: [], trace: [] };
  }
  private apply(decision: ArtifactBuffRuntimeDecision, receiverId: string, frame: number, expiry: number, key: string, operation: "replace" | "update" = "replace") {
    const amount = values(decision.effectId, decision.stateAfter, decision.sameElementCount, decision.differentElementCount);
    if (!decision.trace.some(node => node.id.startsWith("artifact.buff."))) decision.trace.push(...amount.trace);
    const stats = decision.effectId === "gilded-4pc" ? ["atkPct", "em"] as const
      : decision.effectId === "instructor-4pc" ? ["em"] as const
      : decision.effectId === "fragment-4pc" ? ["dmgBonus"] as const : ["atkPct"] as const;
    for (const stat of stats) decision.applications.push({ receiverId, sourceActorId: decision.actorId, key, stat,
      operation, value: amount[stat], startFrame: frame, expiresFrame: expiry });
  }
  handle(event: ArtifactBuffEvent): ArtifactBuffRuntimeDecision[] {
    const relevant = this.actors.filter(actor => {
      if (event.kind === "burst") return actor.effectId === "noblesse-4pc" || actor.effectId === "vermillion-4pc";
      if (event.kind === "reaction") return actor.effectId === "instructor-4pc" || actor.effectId === "gilded-4pc" || actor.effectId === "paradise-4pc" && bloomReactions.has(event.reaction);
      if (event.kind === "bond-of-life-change") return actor.effectId === "fragment-4pc";
      if (event.kind === "hp-drain" || event.kind === "swap") return actor.effectId === "vermillion-4pc";
      if (event.kind === "stats-sample" || event.kind === "react-bonus-read") return actor.actorId === event.actorId && actor.state.effectExpiresFrame !== null && actor.state.effectExpiresFrame <= event.frame && (event.kind === "react-bonus-read" ? actor.effectId === "paradise-4pc" : actor.effectId !== "paradise-4pc");
      return actor.effectId === event.task.effectId && actor.actorId === event.task.actorId;
    });
    return relevant.map(actor => {
      const decision = this.begin(actor, event), state = actor.state, frame = event.frame;
      const graph = transitionGraph(actor.effectId, frame);
      if (actor.effectId === "gilded-4pc") {
        decision.sameElementCount = graph.count("sameElementCount", actor.sameElementCount);
        decision.differentElementCount = graph.count("differentElementCount", actor.differentElementCount);
      }
      if (event.kind === "burst") {
        if (event.activeCharacterId !== actor.actorId) decision.outcome = "off-field";
        else if (actor.effectId === "noblesse-4pc") {
          const expiry = graph.expiry("recipientExpiry", ARTIFACT_BUFF_SOURCE.noblesse.durationFrames);
          const selfFrame = actor.noblesseSelfDelayFrames === 1 ? graph.expiry("selfApplyFrame", 1) : frame;
          for (const receiverId of this.partyIds) {
            if (receiverId === actor.actorId && actor.noblesseSelfDelayFrames === 1) decision.delayedApplications.push({ actorId: actor.actorId, effectId: "noblesse-4pc", receiverId, applyFrame: selfFrame, sourceFrame: frame });
            else this.apply(decision, receiverId, frame, expiry, ARTIFACT_BUFF_SOURCE.noblesse.key);
          }
          if (decision.delayedApplications.length) decision.outcome = "scheduled";
        } else {
          state.stacks = graph.reset("burstStacks"); state.effectExpiresFrame = graph.expiry("windowExpiry", ARTIFACT_BUFF_SOURCE.vermillion.durationFrames);
          decision.stateAfter = { ...state }; this.apply(decision, actor.actorId, frame, state.effectExpiresFrame, ARTIFACT_BUFF_SOURCE.vermillion.key);
        }
      } else if (event.kind === "reaction") {
        if (actor.effectId === "instructor-4pc" && event.activeCharacterId !== actor.actorId) decision.outcome = "off-field";
        else if (event.sourceActorId !== actor.actorId) decision.outcome = "wrong-owner";
        else if (actor.effectId === "instructor-4pc") {
          const expiry = graph.expiry("recipientExpiry", ARTIFACT_BUFF_SOURCE.instructor.durationFrames);
          for (const receiverId of this.partyIds) this.apply(decision, receiverId, frame, expiry, ARTIFACT_BUFF_SOURCE.instructor.key);
        } else if (actor.effectId === "paradise-4pc" && event.reaction === "bloom" && !event.targetIsEnemy) decision.outcome = "target-not-enemy";
        else if (graph.presence("cooldown", state.cooldownExpiresFrame)) decision.outcome = "cooldown-blocked";
        else if (actor.effectId === "gilded-4pc") {
          state.cooldownExpiresFrame = graph.expiry("cooldownExpiry", ARTIFACT_BUFF_SOURCE.gilded.cooldownFrames);
          state.effectExpiresFrame = graph.expiry("windowExpiry", ARTIFACT_BUFF_SOURCE.gilded.durationFrames);
          decision.stateAfter = { ...state }; this.apply(decision, actor.actorId, frame, state.effectExpiresFrame, ARTIFACT_BUFF_SOURCE.gilded.key);
        } else {
          state.stacks = graph.stacks(state.stacks, ARTIFACT_BUFF_SOURCE.paradise.stackCap, graph.presence("window", state.effectExpiresFrame));
          state.cooldownExpiresFrame = graph.expiry("cooldownExpiry", ARTIFACT_BUFF_SOURCE.paradise.cooldownFrames);
          state.effectExpiresFrame = graph.expiry("windowExpiry", ARTIFACT_BUFF_SOURCE.paradise.durationFrames); decision.outcome = "stack-gained";
          decision.trace.push(...values(actor.effectId, state, actor.sameElementCount, actor.differentElementCount).trace);
        }
      } else if (event.kind === "bond-of-life-change") {
        if (event.actorId !== actor.actorId) decision.outcome = "wrong-owner";
        else if (event.amount === 0) decision.outcome = "zero-change";
        else {
          state.stacks = graph.stacks(state.stacks, ARTIFACT_BUFF_SOURCE.fragment.stackCap, graph.presence("window", state.effectExpiresFrame));
          state.effectExpiresFrame = graph.expiry("windowExpiry", ARTIFACT_BUFF_SOURCE.fragment.durationFrames);
          decision.stateAfter = { ...state }; decision.outcome = "stack-gained";
          this.apply(decision, actor.actorId, frame, state.effectExpiresFrame, ARTIFACT_BUFF_SOURCE.fragment.key);
        }
      } else if (event.kind === "hp-drain") {
        if (event.amount <= 0) decision.outcome = "zero-change";
        else if (!graph.presence("window", state.effectExpiresFrame)) decision.outcome = "window-inactive";
        else if (graph.presence("cooldown", state.cooldownExpiresFrame)) decision.outcome = "cooldown-blocked";
        else if (state.stacks === ARTIFACT_BUFF_SOURCE.vermillion.stackCap) decision.outcome = "max-stacks";
        else {
          state.stacks = graph.stacks(state.stacks, ARTIFACT_BUFF_SOURCE.vermillion.stackCap, true);
          state.cooldownExpiresFrame = graph.expiry("cooldownExpiry", ARTIFACT_BUFF_SOURCE.vermillion.cooldownFrames);
          state.effectExpiresFrame = graph.unchangedExpiry(state.effectExpiresFrame!);
          decision.stateAfter = { ...state }; decision.outcome = "stack-gained";
          this.apply(decision, actor.actorId, frame, state.effectExpiresFrame!, ARTIFACT_BUFF_SOURCE.vermillion.key, "update");
        }
      } else if (event.kind === "swap") {
        state.stacks = graph.reset("swapStacks"); state.effectExpiresFrame = null; decision.outcome = "window-removed";
        decision.removals.push({ receiverId: actor.actorId, key: ARTIFACT_BUFF_SOURCE.vermillion.key });
      } else if (event.kind === "stats-sample" || event.kind === "react-bonus-read") {
        if (graph.expiresOnRead(state.effectExpiresFrame!)) state.effectExpiresFrame = null;
        decision.outcome = "expired-on-read";
      } else this.apply(decision, event.task.receiverId, frame, graph.expiry("recipientExpiry", ARTIFACT_BUFF_SOURCE.noblesse.durationFrames), ARTIFACT_BUFF_SOURCE.noblesse.key);
      decision.stateAfter = { ...state };
      decision.trace.unshift(...graph.trace.nodes);
      return decision;
    });
  }
  /** Real full Stats() only; readonly computeStats/Stat queries do not mutate. */
  markStatsSample(actorId: string, frame: number): ArtifactBuffRuntimeDecision[] {
    return this.handle({ kind: "stats-sample", actorId, frame });
  }
  /** ReactBonus() deletes expired react modifiers even for another reaction. */
  reactionBonus(actorId: string, reaction: string, frame: number): { value: number; trace: ReturnType<typeof values>["trace"]; decisions: ArtifactBuffRuntimeDecision[] } {
    const actor = this.actors.find(actor => actor.actorId === actorId && actor.effectId === "paradise-4pc");
    if (!actor) return { value: 0, trace: [], decisions: [] };
    const decisions = this.handle({ kind: "react-bonus-read", actorId, reaction, frame });
    if (!bloomReactions.has(reaction as ArtifactBuffOrdinaryReaction)) return { value: 0, trace: [], decisions };
    const state = { ...actor.state, stacks: actor.state.effectExpiresFrame === null ? 0 : actor.state.stacks };
    const result = values(actor.effectId, state, actor.sameElementCount, actor.differentElementCount);
    return { value: result.reactionBonus, trace: result.trace, decisions };
  }
  captureState(): ArtifactBuffCapturedState { return { actors: structuredClone(this.actors) }; }
}
