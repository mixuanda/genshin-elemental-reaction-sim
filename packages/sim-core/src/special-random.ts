import type { SpecialCalculationContext, SpecialOutcome } from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import { SeededRandom } from "./energy";
import type { SpecialCalculatorHitResult } from "./special-calculator";

export const SPECIAL_CRITICAL_RANDOM_PROFILE = {
  id: "special-contributor-critical-v1",
  rngStream: "special-contributor-critical-v1",
  rngAlgorithm: "fnv1a32-mulberry32-v1",
  matchesGcsimRandomSequence: false,
  comparison: "<=",
  samplingOrder: "resolved-contributor-input-order-before-ranking",
  boundaryDraws: "consume-one-for-every-eligible-contributor-including-cr-zero-and-one",
  assumptions: [
    "只对真实特殊伤害事件已经解析的合格贡献者抽样；不从队伍名单增加贡献者，不为非伤害转换事件抽样。",
    "每名贡献者先独立判暴击，再由共享公式排序和加权；最高贡献者标签与反应伤害所有者分别保留。",
    "月结晶在每段人物快照时抽样，投射到达时不重抽；月感电扫描与直接月绽放命中在实际执行时抽样。",
    "固定来源使用 roll ≤ 原始 CR；本地独立命名流不等同 gcsim 共享随机数序列。未接入特殊暴击触发后的被动反馈。",
  ],
} as const;

export type SpecialCriticalExecution = NonNullable<SpecialCalculationContext["criticalExecution"]>;

/** One stream per simulation, shared by all supported Lunar branches in that run. */
export class SpecialCriticalSampler {
  private readonly random: SeededRandom;
  private drawIndex = 0;
  constructor(private readonly seed: string) {
    this.random = new SeededRandom(`${seed}\u0000${SPECIAL_CRITICAL_RANDOM_PROFILE.rngStream}`);
  }
  sample(contributors: readonly { id: string; critRate: number }[], eventId: string, frame: number): SpecialCriticalExecution {
    return {
      mode: "sampled-contributors-v1", seed: this.seed,
      rngStream: SPECIAL_CRITICAL_RANDOM_PROFILE.rngStream, rngAlgorithm: SPECIAL_CRITICAL_RANDOM_PROFILE.rngAlgorithm,
      comparison: "<=", eventId, frame,
      draws: contributors.map(contributor => {
        const roll = this.random.next();
        return { contributorId: contributor.id, drawIndex: this.drawIndex++, roll, critical: roll <= contributor.critRate };
      }),
    };
  }
}

/** Select actual execution separately from the analytical comparison columns. */
export function specialExecutionDamage(hit: SpecialCalculatorHitResult, critMode: CritMode): number | undefined {
  return hit.sampled?.damage ?? (critMode === "average" ? hit.expected : critMode === "allCrit" ? hit.critical : hit.nonCritical);
}

export type SpecialRuntimeCriticalOutcome = { criticalOutcome?: SpecialOutcome };
export interface SpecialRuntimeRandomness { specialCriticalPolicy?: typeof SPECIAL_CRITICAL_RANDOM_PROFILE; }
