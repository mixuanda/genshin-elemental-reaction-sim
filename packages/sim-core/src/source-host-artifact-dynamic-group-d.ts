import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostArtifactDynamicDescriptor } from "./source-host-artifact-dynamic-formula";

const A7 = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";

/** a7-only static Amount values for the two stellar artifact sets. */
export const artifactDynamicGroupD = {
  "dynamic-heart-of-the-furnace-2pc-atkp": { set: "heartofthefurnace", title: "炉火融炼之心两件：攻击力", statIndex: 6, modifierKeys: ["furnace-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套 Amount 返回18%攻击力。", sourceCommits: [A7] },
  "dynamic-heart-of-the-furnace-4pc-atkp": { set: "heartofthefurnace", title: "炉火融炼之心四件：攻击力", statIndex: 6, modifierKeys: ["furnace-4pc-atk"], inputs: {}, expression: expr.value(0.12), explanation: "保留来源星辉反应触发门与12秒修正窗口；Amount 返回12%攻击力。", sourceCommits: [A7] },
  "dynamic-heart-of-the-furnace-4pc-stellar-react": { set: "heartofthefurnace", title: "炉火融炼之心四件：星辉反应伤害", modifierKeys: ["furnace-4pc-react"], inputs: {}, expression: expr.value(0.5), explanation: "来源把同一 ReactBonusMod 复制到全队角色；沿用来源 IsStellar 门，并按本次攻击的实际受益者记录50%反应伤害加成。", sourceCommits: [A7] },
  "dynamic-scarletproof-2pc-atkp": { set: "scarletproof", title: "血红之证两件：攻击力", statIndex: 6, modifierKeys: ["scarletproof-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套 Amount 返回18%攻击力。", sourceCommits: [A7] },
  "dynamic-scarletproof-4pc-cr": { set: "scarletproof", title: "血红之证四件：暴击率", statIndex: 9, modifierKeys: ["scarletproof-4pc-cr"], inputs: {}, expression: expr.value(0.16), explanation: "保留来源星辉扩散触发门与10秒修正窗口；Amount 返回16%暴击率。", sourceCommits: [A7] },
  "dynamic-scarletproof-4pc-stellar-swirl": { set: "scarletproof", title: "血红之证四件：星辉扩散反应伤害", modifierKeys: ["scarletproof-4pc-dmg"], inputs: {}, expression: expr.value(0.4), explanation: "保留来源 DirectStellarSwirl 与 ReactionStellarSwirl 标签门；通过时返回40%反应伤害加成。", sourceCommits: [A7] },
} as const satisfies Record<string, SourceHostArtifactDynamicDescriptor>;

export type ArtifactDynamicGroupDExpression = FormulaExpression;
