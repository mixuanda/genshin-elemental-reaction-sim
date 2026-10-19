import type { FavoniusModel, FavoniusLogEntry } from "@genshin-dps-lab/schemas";
import { SeededRandom, type SeededRandomState } from "./energy";

export const FAVONIUS_PROFILE = {
  id: "gcsim-favonius-reference-v1",
  sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  sourceRef: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/common/favonius.go",
  evidence: "fixed-source-assumed",
  rngStream: "favonius-v1",
  rngAlgorithm: "fnv1a32-mulberry32-v1",
  matchesGcsimRandomSequence: false,
  cooldownClock: "global-frame-assumes-no-character-hitlag",
  particleCount: 3,
  particleElement: "neutral",
  assumptions: [
    "锁定源码要求非零实际伤害、实际暴击、武器持有者本人命中且在场，随后检查角色独立冷却与概率。",
    "触发概率为 0.5 + 0.1 × 精炼等级，冷却为 810 − 90 × 精炼等级帧；精炼 5 仍消耗一次随机抽样。",
    "源码西风冷却状态受角色卡肉延长；当前宿主没有角色卡肉时钟，本参考配置明确假设角色无卡肉，不能覆盖卡肉延长后的冷却边界。",
    "3 个无元素微粒使用角色明确配置的拾取延迟；源码角色默认 100 帧，不采用武器源码中旧 80 帧 TODO。",
    "使用独立命名种子流，保证本地复现；gcsim 使用共享随机流，双方相同 seed 不代表相同抽样序列。",
    "本接口覆盖普通伤害回调；特殊月曜／星辉宿主模式暂不接入，不声称当前服务器已验证。",
  ],
} as const;

type Decision = Omit<FavoniusLogEntry, "id" | "timeSeconds" | "eventPriority" | "eventSequence" | "particleEventId">;

export interface FavoniusCheckpointState {
  actors: FavoniusModel["actors"];
  readyFrames: ReadonlyMap<string, number>;
  drawCount: number;
  random: SeededRandomState;
}

/** The host supplies actual binary critical outcomes after resolving a landed hit. */
export class FavoniusRuntime {
  private readonly actors: Map<string, FavoniusModel["actors"][number]>;
  private readonly readyFrames = new Map<string, number>();
  private readonly random: SeededRandom;
  private drawCount = 0;

  constructor(seed: string, model: FavoniusModel) {
    this.actors = new Map(model.actors.map(actor => [actor.actorId, actor]));
    this.random = new SeededRandom(`${seed}\u0000${FAVONIUS_PROFILE.rngStream}`);
  }

  actor(actorId: string): FavoniusModel["actors"][number] | undefined { return this.actors.get(actorId); }

  captureState(): FavoniusCheckpointState {
    return { actors: structuredClone([...this.actors.values()]), readyFrames: new Map(this.readyFrames),
      drawCount: this.drawCount, random: this.random.captureState() };
  }

  onDamage(input: { actorId: string; frame: number; damageEventId: number; activeCharacterId: string | null; damage: number; critical: boolean }): Decision {
    const actor = this.actors.get(input.actorId)!;
    const probability = 0.5 + 0.1 * actor.refinement;
    const cooldownFrames = 810 - 90 * actor.refinement;
    const readyFrameBefore = this.readyFrames.get(input.actorId) ?? 0;
    const drawCountBefore = this.drawCount;
    let outcome: Decision["outcome"];
    let roll: number | null = null;
    let drawIndex: number | null = null;
    if (input.damage === 0) outcome = "zero-damage";
    else if (!input.critical) outcome = "noncritical";
    else if (input.activeCharacterId !== input.actorId) outcome = "off-field";
    else if (input.frame < readyFrameBefore) outcome = "cooldown-blocked";
    else {
      drawIndex = this.drawCount++;
      roll = this.random.next();
      outcome = roll <= probability ? "triggered" : "failed-roll";
      if (outcome === "triggered") this.readyFrames.set(input.actorId, input.frame + cooldownFrames);
    }
    return { ...input, sourceProfileId: FAVONIUS_PROFILE.id, sourceRef: FAVONIUS_PROFILE.sourceRef, rngStream: FAVONIUS_PROFILE.rngStream,
      weaponId: actor.weaponId, refinement: actor.refinement, probability, cooldownFrames, readyFrameBefore,
      readyFrameAfter: this.readyFrames.get(input.actorId) ?? 0, outcome, roll, drawIndex, drawCountBefore, drawCountAfter: this.drawCount };
  }
}
