import {
  ARTIFACT_DAMAGE_PROFILE_ID, ARTIFACT_DAMAGE_SOURCE_REFS,
  type ArtifactDamageCapturedState, type ArtifactDamageLogEntry,
  type ArtifactDamageModel, type ArtifactDamageState,
} from "@genshin-dps-lab/schemas";
import { SeededRandom } from "./energy";
import { TraceBuilder, expr, traceInput } from "./calculation-trace";

export type { ArtifactDamageCapturedState } from "@genshin-dps-lab/schemas";
export const ARTIFACT_DAMAGE_PROFILE = {
  id: ARTIFACT_DAMAGE_PROFILE_ID,
  evidence: "fixed-source-assumed",
  sourceRefs: ARTIFACT_DAMAGE_SOURCE_REFS,
  assumptions: [
    "固定 b4ae769 的 OnEnemyHit 前伤害回调，只覆盖实际普通命中和显式治疗；两件套属性已包含于输入面板。",
    "余响使用本工具独立命名随机流，不宣称复现 gcsim 或游戏随机序列；成功窗口不延长，实时攻击力逐次重读。",
    "昔时记录治疗加成后、清除生命之契前的请求治疗量，包含溢出和抵债部分。",
    "昔时按固定源码共享记录池；多个持有者在同一命中依次重复消费共享次数并加伤，此来源行为未经实机确认。",
    "昔时转换与同帧治疗按已声明事件队列顺序；不推断角色卡肉、未声明治疗或旧战斗状态。",
  ],
} as const;

export interface ArtifactSongConvertPayload { actorId: string; sourceFrame: number; parentLogId: number; }
type DecisionFields = "sourceProfileId" | "sourceRef" | "effectId" | "actorId" | "kind" | "outcome" |
  "attackTag" | "currentAttack" | "requestedHealing" | "random" | "flatDamage" | "stateBefore" | "stateAfter";
export type ArtifactDamageDecision = Pick<ArtifactDamageLogEntry, DecisionFields>;
const songTags = new Set(["normal", "charged", "plunge", "skill", "burst"]);
type TransitionInput = ArtifactDamageDecision & { frame: number };

/** One executable graph owns both the written runtime state and its explanation.
 * It receives the already selected source callback; it does not invent callbacks
 * or consume randomness while reconstructing a saved record. */
function calculateArtifactDamageTransition(input: TransitionInput) {
  const stateAfter = structuredClone(input.stateBefore), trace = new TraceBuilder([input.sourceRef]);
  const options = { status: "assumed" as const, warnings: [...ARTIFACT_DAMAGE_PROFILE.assumptions] };
  const value = (key: string, amount: number, unit: string) => traceInput(key, amount, unit, "actual-artifact-callback", `input.${key}`);
  const frameInput = () => value("artifactEventFrame", input.frame, "frame");
  let outcome = input.outcome, startsWindow = false;
  if (input.effectId === "echoes-4pc" && input.random !== null) {
    const owner = stateAfter.echoes.find(owner => owner.actorId === input.actorId)!;
    const success = trace.add("artifact.state.echoesSuccess", "stage.artifactEchoesSuccess",
      expr.condition("lte", expr.input("artifactRoll"), expr.input("artifactProbabilityBefore"), expr.value(1), expr.value(0)),
      [value("artifactRoll", input.random.roll, "ratio"), value("artifactProbabilityBefore", owner.probability, "ratio")],
      { ...options, unit: "boolean", explanationKey: "explain.artifactEchoesSuccess" });
    owner.cooldownExpiresFrame = trace.add("artifact.state.echoesCooldown", "stage.artifactEchoesCooldown",
      expr.add(expr.input("artifactEventFrame"), expr.value(12)), [frameInput()],
      { ...options, unit: "frame", explanationKey: "explain.artifactEchoesCooldown" });
    owner.probability = trace.add("artifact.state.echoesProbability", "stage.artifactEchoesProbability",
      expr.condition("equal", expr.input("artifactSuccess"), expr.value(1), expr.value(.36), expr.add(expr.input("artifactProbabilityBefore"), expr.value(.2))),
      [value("artifactSuccess", success, "boolean"), value("artifactProbabilityBefore", owner.probability, "ratio")],
      { ...options, unit: "ratio", explanationKey: "explain.artifactEchoesProbability", childIds: ["artifact.state.echoesSuccess"] });
    outcome = success === 1 ? "rite-triggered" : "roll-failed";
    if (success === 1) owner.riteExpiresFrame = trace.add("artifact.state.echoesExpiry", "stage.artifactEchoesExpiry",
      expr.add(expr.input("artifactEventFrame"), expr.value(3)), [frameInput()],
      { ...options, unit: "frame", explanationKey: "explain.artifactEchoesExpiry", childIds: ["artifact.state.echoesSuccess"] });
  } else if (input.outcome === "recorded-healing") {
    const song = stateAfter.song;
    song.healingPool = trace.add("artifact.state.songPool", "stage.artifactSongPool",
      expr.min(expr.value(15000), expr.add(expr.input("artifactHealingPoolBefore"), expr.input("artifactRequestedHealing"))),
      [value("artifactHealingPoolBefore", song.healingPool, "HP"), value("artifactRequestedHealing", input.requestedHealing!, "HP")],
      { ...options, unit: "HP", explanationKey: "explain.artifactSongPool" });
    const start = trace.add("artifact.state.songWindowStart", "stage.artifactSongWindowStart",
      expr.condition("lte", expr.input("artifactYearningExpiryBefore"), expr.input("artifactEventFrame"), expr.value(1), expr.value(0)),
      [value("artifactYearningExpiryBefore", song.yearningExpiresFrame, "frame"), frameInput()],
      { ...options, unit: "boolean", explanationKey: "explain.artifactSongWindowStart" });
    startsWindow = start === 1;
    song.yearningExpiresFrame = trace.add("artifact.state.songYearningExpiry", "stage.artifactSongYearningExpiry",
      expr.condition("equal", expr.input("artifactStartsWindow"), expr.value(1), expr.add(expr.input("artifactEventFrame"), expr.value(360)), expr.input("artifactYearningExpiryBefore")),
      [value("artifactStartsWindow", start, "boolean"), frameInput(), value("artifactYearningExpiryBefore", song.yearningExpiresFrame, "frame")],
      { ...options, unit: "frame", explanationKey: "explain.artifactSongYearningExpiry", childIds: ["artifact.state.songWindowStart"] });
  } else if (input.outcome === "waves-created") {
    const song = stateAfter.song;
    song.waveHealing = trace.add("artifact.state.songSnapshot", "stage.artifactSongSnapshot", expr.input("artifactHealingPoolBefore"),
      [value("artifactHealingPoolBefore", song.healingPool, "HP")],
      { ...options, unit: "HP", explanationKey: "explain.artifactSongSnapshot" });
    song.healingPool = trace.add("artifact.state.songPoolReset", "stage.artifactSongPoolReset", expr.value(0), [],
      { ...options, unit: "HP", explanationKey: "explain.artifactSongPoolReset", childIds: ["artifact.state.songSnapshot"] });
    song.wavesExpiresFrame = trace.add("artifact.state.songWavesExpiry", "stage.artifactSongWavesExpiry",
      expr.add(expr.input("artifactEventFrame"), expr.value(600)), [frameInput()],
      { ...options, unit: "frame", explanationKey: "explain.artifactSongWavesExpiry" });
    song.charges = trace.add("artifact.state.songChargesReset", "stage.artifactSongChargesReset", expr.value(5), [],
      { ...options, unit: "count", explanationKey: "explain.artifactSongChargesReset" });
  } else if (input.outcome === "waves-consumed") {
    const song = stateAfter.song;
    song.charges = trace.add("artifact.state.songCharges", "stage.artifactSongCharges",
      expr.sub(expr.input("artifactChargesBefore"), expr.value(1)), [value("artifactChargesBefore", song.charges, "count")],
      { ...options, unit: "count", explanationKey: "explain.artifactSongCharges" });
    song.wavesExpiresFrame = trace.add("artifact.state.songWavesRemaining", "stage.artifactSongWavesRemaining",
      expr.condition("equal", expr.input("artifactChargesAfter"), expr.value(0), expr.value(0), expr.input("artifactWavesExpiryBefore")),
      [value("artifactChargesAfter", song.charges, "count"), value("artifactWavesExpiryBefore", song.wavesExpiresFrame, "frame")],
      { ...options, unit: "frame", explanationKey: "explain.artifactSongWavesRemaining", childIds: ["artifact.state.songCharges"] });
  }
  return { stateAfter, outcome, startsWindow, trace: trace.nodes };
}

/** State and random-decision explanation only; flat damage has its own shared graph. */
export function artifactDamageTransitionTrace(input: TransitionInput) {
  return calculateArtifactDamageTransition(input).trace;
}

/** These are pre-damage callbacks: a miss or a zero direct-damage-group hit must
 * never call this runtime. The main queue owns every delayed conversion. */
export class ArtifactDamageRuntime {
  private readonly actors: ArtifactDamageModel["actors"];
  private readonly random: SeededRandom | undefined;
  private state: ArtifactDamageState;
  constructor(model: ArtifactDamageModel, partyIds: readonly string[], seed: string) {
    this.actors = [...model.actors].sort((a, b) => partyIds.indexOf(a.actorId) - partyIds.indexOf(b.actorId));
    this.random = this.actors.some(actor => actor.effectId === "echoes-4pc") ? new SeededRandom(`${seed}:artifact-damage:echoes`) : undefined;
    this.state = {
      echoes: this.actors.filter(actor => actor.effectId === "echoes-4pc").map(actor => ({ actorId: actor.actorId, probability: 0.36, cooldownExpiresFrame: 0, riteExpiresFrame: 0 })),
      song: { healingPool: 0, yearningExpiresFrame: 0, waveHealing: 0, wavesExpiresFrame: 0, charges: 0 },
    };
  }
  private begin(actor: ArtifactDamageModel["actors"][number], kind: ArtifactDamageDecision["kind"]): ArtifactDamageDecision {
    return { ...actor, sourceProfileId: ARTIFACT_DAMAGE_PROFILE_ID, sourceRef: ARTIFACT_DAMAGE_SOURCE_REFS[actor.effectId], kind,
      outcome: "ineligible-tag", attackTag: null, currentAttack: null, requestedHealing: null, random: null, flatDamage: 0,
      stateBefore: structuredClone(this.state), stateAfter: structuredClone(this.state) };
  }
  private end(decision: ArtifactDamageDecision, frame: number) {
    const transition = calculateArtifactDamageTransition({ ...decision, frame });
    this.state = transition.stateAfter;
    decision.outcome = transition.outcome;
    decision.stateAfter = structuredClone(this.state);
    decision.flatDamage = artifactDamageTrace([decision])[0]?.result?.value ?? 0;
    return { decision, startsWindow: transition.startsWindow };
  }
  onEnemyHit(input: { frame: number; sourceActorId: string; activeCharacterId: string | null; attackTag: string | null; currentAttack: () => number }): ArtifactDamageDecision[] {
    return this.actors.map(actor => {
      const decision = this.begin(actor, "enemy-hit");
      decision.attackTag = input.attackTag;
      if (actor.effectId === "echoes-4pc") {
        if (input.activeCharacterId !== actor.actorId) decision.outcome = "off-field";
        else if (input.sourceActorId !== actor.actorId) decision.outcome = "wrong-owner";
        else if (input.attackTag !== "normal") decision.outcome = "ineligible-tag";
        else {
          const state = this.state.echoes.find(state => state.actorId === actor.actorId)!;
          decision.currentAttack = input.currentAttack();
          if (input.frame < state.riteExpiresFrame) {
            decision.outcome = "rite-active";
          } else if (input.frame < state.cooldownExpiresFrame) decision.outcome = "cooldown-blocked";
          else {
            const drawIndex = this.random!.captureState().drawCount, roll = this.random!.next();
            decision.random = { drawIndex, roll, probability: state.probability };
          }
        }
      } else {
        const song = this.state.song;
        if (!songTags.has(input.attackTag ?? "")) decision.outcome = "ineligible-tag";
        else if (song.wavesExpiresFrame <= input.frame) decision.outcome = "waves-inactive";
        else if (input.sourceActorId !== input.activeCharacterId) decision.outcome = "off-field";
        else if (song.charges > 0) {
          decision.outcome = "waves-consumed";
        } else decision.outcome = "waves-inactive";
      }
      return this.end(decision, input.frame).decision;
    });
  }
  onHeal(frame: number, sourceActorId: string, requestedHealing: number): { decision: ArtifactDamageDecision; startsWindow: boolean } | undefined {
    const actor = this.actors.find(actor => actor.actorId === sourceActorId && actor.effectId === "song-of-days-past-4pc");
    if (actor === undefined) return;
    const decision = this.begin(actor, "heal");
    decision.outcome = "recorded-healing"; decision.requestedHealing = requestedHealing;
    return this.end(decision, frame);
  }
  convert(frame: number, actorId: string): ArtifactDamageDecision {
    const actor = this.actors.find(actor => actor.actorId === actorId && actor.effectId === "song-of-days-past-4pc")!;
    const decision = this.begin(actor, "song-convert");
    decision.outcome = "waves-created";
    return this.end(decision, frame).decision;
  }
  captureState(): ArtifactDamageCapturedState {
    return { state: structuredClone(this.state), ...(this.random === undefined ? {} : { random: this.random.captureState() }) };
  }
}

export function artifactDamageTrace(decisions: readonly ArtifactDamageDecision[]) {
  const trace = new TraceBuilder([...new Set(decisions.map(decision => decision.sourceRef))]);
  decisions.forEach((decision, index) => {
    if (!["rite-active", "rite-triggered", "waves-consumed"].includes(decision.outcome)) return;
    const echoes = decision.effectId === "echoes-4pc", amount = echoes ? decision.currentAttack! : decision.stateBefore.song.waveHealing;
    trace.add(`artifact.flat.${index}`, echoes ? "stage.artifactEchoesFlat" : "stage.artifactSongFlat", expr.mul(expr.input("sourceAmount"), expr.value(echoes ? 0.7 : 0.08)),
      [traceInput("sourceAmount", amount, echoes ? "ATK" : "HP", "actual-artifact-callback", echoes ? "input.artifactLiveAttack" : "input.artifactRecordedHealing")],
      { unit: "damage", status: "assumed", explanationKey: "explain.artifactRuntimeFlat", warnings: [...ARTIFACT_DAMAGE_PROFILE.assumptions] });
  });
  return trace.nodes;
}
