import { describe, expect, it } from "vitest";
import { TraceBuilder } from "../calculation-trace";
import { appendSourceHostTalentIndexTrace, sourceHostTalentIndexSourceSchema } from "../source-host-talent-index";

const args = { nodePrefix: "sourceTalentTable.7.index1", sourceCommit: "synthetic-source", actorIndex: 2, frame: 120 };

describe("source-host native talent index", () => {
  it("explains synthetic C3 and passive branches using the captured getter metadata", () => {
    const builder = new TraceBuilder();
    const result = appendSourceHostTalentIndexTrace(builder, {
      ...args, expectedIndex: 11,
      source: { position: 1, kind: "attack", baseTalent: 8, constellation: 3,
        constellationUnlock: 3, passiveTagValue: 1, value: 11 },
    });
    expect(result).toEqual({ index: 11, nodeId: "sourceTalentTable.7.index1.nativeIndex",
      gaps: ["ChildePassive tag 的激活与失效生命周期尚未由本次天赋下标回执展开。"] });
    expect(builder.nodes.map((node) => [node.id, node.result?.value])).toEqual([
      ["sourceTalentTable.7.index1.baseTalent", 8],
      ["sourceTalentTable.7.index1.passiveBonus", 1],
      ["sourceTalentTable.7.index1.constellationBonus", 3],
      ["sourceTalentTable.7.index1.offset", 3],
      ["sourceTalentTable.7.index1.cappedOffset", 3],
      ["sourceTalentTable.7.index1.nativeIndex", 11],
    ]);

    const burst = appendSourceHostTalentIndexTrace(new TraceBuilder(), {
      ...args, expectedIndex: 10,
      source: { position: 1, kind: "burst", baseTalent: 8, constellation: 3, constellationUnlock: 3, value: 10 },
    });
    expect(burst.index).toBe(10);
    expect(burst.gaps).toEqual([]);
  });

  it("rejects a native result or site index that disagrees with the replayed getter", () => {
    const source = { position: 0, kind: "skill", baseTalent: 8, constellation: 0,
      constellationUnlock: -1, passiveTagValue: 0, value: 7 };
    expect(() => appendSourceHostTalentIndexTrace(new TraceBuilder(), { ...args, source, expectedIndex: 8 })).toThrow(/differ/);
    expect(() => appendSourceHostTalentIndexTrace(new TraceBuilder(), { ...args, source: { ...source, value: 8 }, expectedIndex: 7 })).toThrow(/differ/);
    expect(() => sourceHostTalentIndexSourceSchema.parse({ ...source, kind: "burst" })).toThrow(/passive/);
  });
});
