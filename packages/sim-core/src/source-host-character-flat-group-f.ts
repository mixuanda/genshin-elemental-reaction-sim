/** Nilou's Bountiful Core self-hit scales the already computed Bloom base. */
import { expr } from "./calculation-trace";
import type { SourceHostCharacterFlatDescriptor } from "./source-host-character-flat-formula";

export const characterFlatGroupF = {
  "char-flat-dendrocore-self-hit": {
    character: "*",
    title: "草原核反应玩家自伤基数",
    sourceFile: "internal/template/dendrocore/dendrocore.go",
    sourceCommits: ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"],
    operation: "multiply",
    inputs: {},
    expression: expr.value(0.02),
    explanation: "普通绽放、超绽放与烈绽放沿各自原生门槛先排队敌方命中，再把同一局部 AttackInfo 的已计算反应 FlatDmg 乘以 0.02，作为随后排队的玩家自伤基数。来源持有者就是该次反应的实际攻击角色。",
  },
  "char-flat-nilou-bountiful-self-hit": {
    character: "nilou",
    title: "妮露丰穰之核自伤基数",
    sourceFile: "internal/characters/nilou/bountifulcore.go",
    sourceCommits: ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"],
    operation: "multiply",
    inputs: {},
    expression: expr.value(0.02),
    explanation: "原生丰穰之核先排队完整绽放敌方命中，再在本地 AttackInfo 将已计算的绽放 FlatDmg 乘以 0.02，作为随后排队的玩家自伤基数；绽放计算来源保留在先前组件中。",
  },
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
