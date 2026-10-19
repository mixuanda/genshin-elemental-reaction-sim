import type { StellarArtifactModel } from "@genshin-dps-lab/schemas";
import { STELLAR_ARTIFACT_BONUS_SOURCES, stellarArtifactBonusStages, type SpecialBranch, type StellarArtifactBonusSnapshot } from "@genshin-dps-lab/reaction-formulas";
import { expr, traceInput, TraceBuilder, type CalculationTraceNode } from "./calculation-trace";

export const STELLAR_ARTIFACT_SOURCE = STELLAR_ARTIFACT_BONUS_SOURCES;

export type StellarArtifactReaction = "stellar-conduct" | "stellar-swirl";
export type StellarArtifactDamageTag = "reaction-stellar-conduct" | "direct-stellar-conduct" | "reaction-stellar-swirl" | "direct-stellar-swirl";
export interface StellarArtifactLogEntry {
  id: number;
  frame: number;
  event: "OnStellarConduct" | "OnStellarSwirl" | "OnEnemyDamage";
  triggerActorId: string;
  damageOwnerId: string | null;
  wearerActorId: string;
  setId: StellarArtifactModel["actors"][number]["setId"];
  sourceRef: string;
  applications: Array<{ receiverActorId: string; key: string; value: number; stat: "critRate" | "atkPct" | "reactionBonus"; expiresAtFrame: number; replacedSourceActorId: string | null }>;
  trace: CalculationTraceNode[];
}
export interface StellarArtifactReactionRead {
  id: number; frame: number; actorId: string; tag: StellarArtifactDamageTag;
  scarletBonus: number; heartBonus: number; totalBonus: number;
  sourceRefs: string[]; trace: CalculationTraceNode[];
}
export interface StellarArtifactCapturedState {
  frame: number;
  wearers: Array<{ actorId: string; setId: StellarArtifactModel["actors"][number]["setId"]; critExpiresAtFrame: number | null; atkExpiresAtFrame: number | null }>;
  teamReactionBonus: { sourceActorId: string; expiresAtFrame: number } | null;
}

/** Fixed a7 artifact callbacks. Windows are half-open and keyed like gcsim's modifier.Add. */
export class StellarArtifactRuntime {
  readonly log: StellarArtifactLogEntry[] = [];
  readonly reactionReads: StellarArtifactReactionRead[] = [];
  private readonly critUntil = new Map<string, number>();
  private readonly atkUntil = new Map<string, number>();
  private teamReaction: { sourceActorId: string; expiresAtFrame: number } | null = null;
  constructor(private readonly model: StellarArtifactModel, private readonly partyActorIds: readonly string[]) {}

  private activate(frame: number, event: StellarArtifactLogEntry["event"], triggerActorId: string, damageOwnerId: string | null): void {
    const wearer = this.model.actors.find(actor => actor.actorId === triggerActorId);
    if (wearer === undefined || (wearer.setId === "artifact-set:15047" && event !== "OnStellarSwirl")) return;
    const sourceRef = wearer.setId === "artifact-set:15047" ? STELLAR_ARTIFACT_SOURCE.scarlet : STELLAR_ARTIFACT_SOURCE.heart;
    const trace = new TraceBuilder([sourceRef]);
    const durationSeconds = wearer.setId === "artifact-set:15047" ? 10 : 12;
    const durationFrames = trace.add("stellarArtifact.durationFrames", "星辉圣遗物持续秒数换算为60帧每秒", expr.mul(expr.input("durationSeconds"), expr.value(60)),
      [traceInput("durationSeconds", durationSeconds, "seconds", sourceRef, "固定来源持续秒数")], { status: "assumed", unit: "frame" });
    const expiresAtFrame = trace.add("stellarArtifact.expiresAtFrame", "实际触发帧加持续帧", expr.add(expr.input("triggerFrame"), expr.input("durationFrames")),
      [traceInput("triggerFrame", frame, "frame", "actual-stellar-callback", "真实事件触发帧"), traceInput("durationFrames", durationFrames, "frame", sourceRef, "固定来源持续帧")], { status: "assumed", unit: "frame", childIds: ["stellarArtifact.durationFrames"] });
    const applications: StellarArtifactLogEntry["applications"] = [];
    if (wearer.setId === "artifact-set:15047") {
      const critRate = trace.add("stellarArtifact.scarletCritRate", "血红之证暴击率窗口", expr.value(0.16), [], { status: "assumed", unit: "ratio" });
      const reactionBonus = trace.add("stellarArtifact.scarletReactionBonus", "血红之证星扩散专属反应加成", expr.value(0.4), [], { status: "assumed", unit: "ratio" });
      this.critUntil.set(wearer.actorId, expiresAtFrame);
      applications.push({ receiverActorId: wearer.actorId, key: "scarletproof-4pc-cr", value: critRate, stat: "critRate", expiresAtFrame, replacedSourceActorId: null });
      applications.push({ receiverActorId: wearer.actorId, key: "scarletproof-4pc-dmg", value: reactionBonus, stat: "reactionBonus", expiresAtFrame, replacedSourceActorId: null });
    } else {
      const atkPct = trace.add("stellarArtifact.heartAtkPct", "炉火融炼之心基于基础攻击力的攻击百分比", expr.value(0.12), [], { status: "assumed", unit: "ratio" });
      const reactionBonus = trace.add("stellarArtifact.heartReactionBonus", "炉火融炼之心全队星辉专属反应加成", expr.value(0.5), [], { status: "assumed", unit: "ratio" });
      this.atkUntil.set(wearer.actorId, expiresAtFrame);
      applications.push({ receiverActorId: wearer.actorId, key: "furnace-4pc-atk", value: atkPct, stat: "atkPct", expiresAtFrame, replacedSourceActorId: null });
      const replacedSourceActorId = (this.teamReaction?.expiresAtFrame ?? 0) > frame ? this.teamReaction!.sourceActorId : null;
      this.teamReaction = { sourceActorId: wearer.actorId, expiresAtFrame };
      for (const receiverActorId of this.partyActorIds) applications.push({ receiverActorId, key: "furnace-4pc-react", value: reactionBonus, stat: "reactionBonus", expiresAtFrame, replacedSourceActorId });
    }
    this.log.push({ id: this.log.length, frame, event, triggerActorId, damageOwnerId, wearerActorId: wearer.actorId,
      setId: wearer.setId, sourceRef, applications, trace: trace.nodes });
  }

  onReaction(frame: number, sourceActorId: string, reaction: StellarArtifactReaction): void {
    this.activate(frame, reaction === "stellar-conduct" ? "OnStellarConduct" : "OnStellarSwirl", sourceActorId, null);
  }

  /** OnEnemyDamage sees AttackInfo.ActorIndex, not the contributor list. */
  onStellarDamage(frame: number, ownerId: string, _tag: StellarArtifactDamageTag): void {
    if (this.model.actors.some(actor => actor.actorId === ownerId && actor.setId === "artifact-set:15048"))
      this.activate(frame, "OnEnemyDamage", ownerId, ownerId);
  }

  statBonuses(actorId: string, frame: number): { critRate: number; atkPct: number } {
    return { critRate: (this.critUntil.get(actorId) ?? 0) > frame ? 0.16 : 0,
      atkPct: (this.atkUntil.get(actorId) ?? 0) > frame ? 0.12 : 0 };
  }

  reactionBonus(actorId: string, frame: number, tag: StellarArtifactDamageTag, branch: SpecialBranch): { value: number; sourceRefs: string[]; snapshot: StellarArtifactBonusSnapshot } {
    const scarlet = this.model.actors.find(actor => actor.actorId === actorId && actor.setId === "artifact-set:15047");
    const snapshot: StellarArtifactBonusSnapshot = { sourceProfileId: this.model.mode, snapshotFrame: frame,
      scarlet: scarlet === undefined ? null : { wearerActorId: actorId, expiresAtFrame: this.critUntil.get(actorId) ?? null },
      heart: this.teamReaction === null ? null : { lastSourceActorId: this.teamReaction.sourceActorId, expiresAtFrame: this.teamReaction.expiresAtFrame } };
    const stages = stellarArtifactBonusStages(snapshot, branch, actorId);
    const trace = new TraceBuilder([STELLAR_ARTIFACT_SOURCE.scarlet, STELLAR_ARTIFACT_SOURCE.heart]);
    const values: Record<string, number> = {};
    for (const term of stages) {
      const inputs = { ...term.values, ...Object.fromEntries(term.dependencies.map(key => [key, values[key]!])) };
      values[term.suffix] = trace.add(`stellarArtifact.${term.suffix}`, term.titleKey, term.expression,
        Object.entries(inputs).map(([key, value]) => traceInput(key, value, key === "snapshotFrame" || key === "expiryFrame" ? "frame" : term.unit,
          "actual-stellar-contributor-snapshot", `stellarArtifact.input.${key}`)),
        { status: "assumed", unit: term.unit, explanationKey: term.explanationKey, sourceRefs: term.sourceRefs,
          childIds: term.dependencies.map(key => `stellarArtifact.${key}`) });
    }
    const scarletBonus = values.scarletBonus!, heartBonus = values.heartBonus!, value = values.bonus!;
    const sourceRefs: string[] = [];
    if (scarletBonus > 0) sourceRefs.push(STELLAR_ARTIFACT_SOURCE.scarlet);
    if (heartBonus > 0) sourceRefs.push(STELLAR_ARTIFACT_SOURCE.heart);
    this.reactionReads.push({ id: this.reactionReads.length, frame, actorId, tag, scarletBonus, heartBonus, totalBonus: value, sourceRefs, trace: trace.nodes });
    return { value, sourceRefs, snapshot };
  }

  stateAt(frame: number): StellarArtifactCapturedState {
    return { frame, wearers: this.model.actors.map(actor => ({ actorId: actor.actorId, setId: actor.setId,
      critExpiresAtFrame: (this.critUntil.get(actor.actorId) ?? 0) > frame ? this.critUntil.get(actor.actorId)! : null,
      atkExpiresAtFrame: (this.atkUntil.get(actor.actorId) ?? 0) > frame ? this.atkUntil.get(actor.actorId)! : null })),
      teamReactionBonus: (this.teamReaction?.expiresAtFrame ?? 0) > frame ? { ...this.teamReaction! } : null };
  }
}
