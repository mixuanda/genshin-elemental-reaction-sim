import type { SourceHitMapping } from "./types";

const ruleByHit: Record<string, NonNullable<SourceHitMapping["damageBonusFormulaId"]>> = {};
for (const gender of ["aether", "lumine"]) {
  ruleByHit[`${gender}-dendro-skill-skill`] = "dendro-traveler-a4-skill";
  ruleByHit[`${gender}-dendro-burst-pyro-transformed-explosion-burstExplode`] = "dendro-traveler-a4-burst";
}
const supersededAssumptions = new Set([
  "若四破被动已解锁，已将命中时元素精通 × 0.0015 计入最终伤害加成区；未解锁时该项为零，不当作额外基础伤害。",
  "若四破被动已解锁，已将命中时元素精通 × 0.001 计入最终伤害加成区；未解锁时该项为零，不当作额外基础伤害。"
]);

/** Keep archived field evidence intact while explicitly upgrading the active rule. */
export function withDendroTravelerBonusRule(mapping: SourceHitMapping): SourceHitMapping {
  const rule = ruleByHit[mapping.id];
  if (!rule) return mapping;
  return {
    ...mapping, damageBonusFormulaId: rule,
    assumptions: [...mapping.assumptions.filter((assumption) => !supersededAssumptions.has(assumption)),
      "草元素旅行者四破增伤由共同核心按命中时实际元素精通与突破等级自动计算，单独进入伤害加成区；手动增伤只填其他来源，不能重复加入该被动。"]
  };
}
