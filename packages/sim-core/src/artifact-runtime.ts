import {
  ARTIFACT_EVENT_SOURCE_PROFILE,
  NIGHTSOUL_BURST_SOURCE_PROFILE,
  type ArtifactEventModel,
  type ArtifactEventLogEntry,
  type NightsoulBurstModel,
} from "@genshin-dps-lab/schemas";

/** Only the explicitly declared event effects are applied here. The holder's
 * supplied panel already owns its equipment stats, including two-piece ER. */
export const ARTIFACT_EVENT_PROFILE = {
  ...ARTIFACT_EVENT_SOURCE_PROFILE,
  evidence: "fixed-source-assumed",
  assumptions: [
    "角色状态按固定源码到期帧仍有效；本模型明确假设无角色卡肉。",
    "流放者跨持有者不叠加的规则沿用固定源码；源码仍标注多持有者延长行为待验证。",
    "学士沿用固定源码实际拾取回调及弓／法器接收者筛选，源码仍标注待实测。",
    "固定回能不乘充能效率，满能及零数量实际拾取仍可触发学士。",
    "赌徒只读取已交付伤害造成的真实目标生命归零；场景移除不等于击杀。",
    "不重复添加两件套面板属性；烬城这里只接两件套夜魂迸发回能。",
  ],
} as const;

export const NIGHTSOUL_BURST_PROFILE = {
  ...NIGHTSOUL_BURST_SOURCE_PROFILE,
  evidence: "fixed-source-assumed",
  assumptions: [
    "纳塔角色身份由配置显式声明，不从角色名称推断，也不把声明标为游戏数据认证。",
    "实际元素伤害交付后回调触发全队共享夜魂迸发；全局冷却到期帧即可触发。",
    "本模型接普通伤害及普通反应交付，不认证月曜／星辉特殊宿主的回调语义。",
  ],
} as const;

export interface ArtifactEventCapturedState {
  cooldowns: ReadonlyMap<string, number>;
  exileRecipientExpires: ReadonlyMap<string, number>;
}

export interface ArtifactEventDecision {
  actorId: string;
  effectId: ArtifactEventModel["actors"][number]["effectId"];
  sourceProfileId: typeof ARTIFACT_EVENT_SOURCE_PROFILE.id;
  sourceRef: string;
  outcome: ArtifactEventLogEntry["outcome"];
  cooldownExpiresFrameBefore: number | null;
  cooldownExpiresFrameAfter: number | null;
  exileRecipients: Array<{ actorId: string; expiresFrame: number }>;
  gains: Array<{ receiverId: string; amount: number }>;
}

export interface ArtifactEnergyTickPayload {
  actorId: string;
  effectId: "exile-4pc";
  receiverId: string;
  amount: number;
  sourceActionId: string;
  sourceFrame: number;
  parentArtifactEventLogId: number;
  tickIndex: number;
  cycle: number;
}

export class ArtifactEventRuntime {
  private readonly cooldowns = new Map<string, number>();
  private readonly exileRecipientExpires = new Map<string, number>();
  constructor(private readonly model: ArtifactEventModel, private readonly partyIds: readonly string[]) {}

  private decision(actor: ArtifactEventModel["actors"][number]): ArtifactEventDecision {
    const before = this.cooldowns.get(`${actor.effectId}:${actor.actorId}`) ?? null;
    return { ...actor, sourceProfileId: ARTIFACT_EVENT_SOURCE_PROFILE.id,
      sourceRef: ARTIFACT_EVENT_SOURCE_PROFILE.sourceRefs[actor.effectId], outcome: "activated",
      cooldownExpiresFrameBefore: before, cooldownExpiresFrameAfter: before,
      exileRecipients: [], gains: [] };
  }

  onBurst(frame: number, activeCharacterId: string | null): ArtifactEventDecision[] {
    return this.model.actors.filter(actor => actor.effectId === "exile-4pc").map(actor => {
      const decision = this.decision(actor);
      if (actor.actorId !== activeCharacterId) decision.outcome = "off-field";
      else if ([...this.exileRecipientExpires.values()].some(expiry => expiry >= frame)) decision.outcome = "party-effect-active";
      else for (const receiverId of this.partyIds) {
        if (receiverId === actor.actorId) continue;
        const expiresFrame = frame + ARTIFACT_EVENT_SOURCE_PROFILE.exile.durationFrames;
        this.exileRecipientExpires.set(receiverId, expiresFrame);
        decision.exileRecipients.push({ actorId: receiverId, expiresFrame });
      }
      return decision;
    });
  }

  onParticleReceived(frame: number, activeCharacterId: string | null): ArtifactEventDecision[] {
    return this.model.actors.filter(actor => actor.effectId === "scholar-4pc").map(actor => {
      const decision = this.decision(actor);
      if (actor.actorId !== activeCharacterId) decision.outcome = "off-field";
      else if (decision.cooldownExpiresFrameBefore !== null && decision.cooldownExpiresFrameBefore >= frame) decision.outcome = "cooldown-blocked";
      else {
        decision.outcome = "energy-granted";
        decision.cooldownExpiresFrameAfter = frame + ARTIFACT_EVENT_SOURCE_PROFILE.scholar.cooldownFrames;
        this.cooldowns.set(`${actor.effectId}:${actor.actorId}`, decision.cooldownExpiresFrameAfter);
        for (const receiverId of this.partyIds) {
          const weaponType = this.model.partyWeaponTypes?.find(recipient => recipient.actorId === receiverId)?.weaponType;
          if (weaponType === "bow" || weaponType === "catalyst") {
            decision.gains.push({ receiverId, amount: ARTIFACT_EVENT_SOURCE_PROFILE.scholar.energy });
          }
        }
      }
      return decision;
    });
  }

  onTargetDied(frame: number, activeCharacterId: string | null, killerActorId: string): ArtifactEventDecision[] {
    return this.model.actors.filter(actor => actor.effectId === "gambler-4pc").map(actor => {
      const decision = this.decision(actor);
      if (decision.cooldownExpiresFrameBefore !== null && decision.cooldownExpiresFrameBefore >= frame) decision.outcome = "cooldown-blocked";
      else if (killerActorId !== actor.actorId) decision.outcome = "wrong-killer";
      else if (activeCharacterId !== actor.actorId) decision.outcome = "off-field";
      else {
        decision.outcome = "skill-reset";
        decision.cooldownExpiresFrameAfter = frame + ARTIFACT_EVENT_SOURCE_PROFILE.gambler.cooldownFrames;
        this.cooldowns.set(`${actor.effectId}:${actor.actorId}`, decision.cooldownExpiresFrameAfter);
      }
      return decision;
    });
  }

  onNightsoulBurst(): ArtifactEventDecision[] {
    return this.model.actors.filter(actor => actor.effectId === "scroll-2pc").map(actor => ({
      ...this.decision(actor), outcome: "energy-granted",
      gains: [{ receiverId: actor.actorId, amount: ARTIFACT_EVENT_SOURCE_PROFILE.scroll.energy }],
    }));
  }

  captureState(): ArtifactEventCapturedState {
    return { cooldowns: new Map(this.cooldowns), exileRecipientExpires: new Map(this.exileRecipientExpires) };
  }
}

export interface NightsoulBurstCapturedState { cooldownExpiresFrame: number | null; }

export class NightsoulBurstRuntime {
  private cooldownExpiresFrame: number | null = null;
  readonly cooldownFrames: number;
  constructor(readonly model: NightsoulBurstModel) {
    this.cooldownFrames = NIGHTSOUL_BURST_SOURCE_PROFILE.cooldownFramesByNatlanCount[model.natlanActorIds.length]!;
  }

  onElementalDamage(frame: number) {
    const cooldownExpiresFrameBefore = this.cooldownExpiresFrame;
    const outcome = cooldownExpiresFrameBefore !== null && cooldownExpiresFrameBefore > frame ? "cooldown-blocked" : "triggered";
    if (outcome === "triggered") this.cooldownExpiresFrame = frame + this.cooldownFrames;
    return { sourceProfileId: NIGHTSOUL_BURST_SOURCE_PROFILE.id, sourceRef: NIGHTSOUL_BURST_SOURCE_PROFILE.sourceRef,
      natlanActorIds: [...this.model.natlanActorIds], cooldownFrames: this.cooldownFrames, outcome,
      cooldownExpiresFrameBefore, cooldownExpiresFrameAfter: this.cooldownExpiresFrame } as const;
  }

  captureState(): NightsoulBurstCapturedState { return { cooldownExpiresFrame: this.cooldownExpiresFrame }; }
}
