import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import evidence from "../../game-data/sources/iansan-swift-native-index-correction/correction-evidence.json";
import historical from "../../game-data/sources/iansan-swift-native-index-correction/historical-native-reads.json";
import { TraceBuilder } from "./calculation-trace";
import { sourceHostIansanSwiftTalentSemantics } from "./source-host-iansan-swift-talent-correction";
import { appendSourceHostTalentIndexTrace } from "./source-host-talent-index";
import { appendSourceHostTalentTableRead, sourceHostTalentTableReadSchema, type SourceHostTalentSite, type SourceHostTalentTableRead } from "./source-host-talent-table";

const correctedSite = evidence.correctedSite.definition as SourceHostTalentSite;
function expectedRead(baseTalent = 1, constellation = 0, passiveTagValue = 0): SourceHostTalentTableRead {
  const index = baseTalent - 1 + Number(passiveTagValue > 0);
  return {schemaVersion: 1, tableId: evidence.table.tableId, siteId: evidence.correctedSite.id, indices: [index],
    indexSources: [{position: 0, kind: "attack", baseTalent, constellation, constellationUnlock: -1, passiveTagValue, value: index}],
    value: evidence.table.values[index]!, actorIndex: 0, frame: 138};
}
const semantics = (read: SourceHostTalentTableRead) => sourceHostIansanSwiftTalentSemantics(read, evidence.sourceCommit, correctedSite);

describe("Stellar Iansan Swift source correction and historical provenance", () => {
  it.each(historical.cases)("replays actual old $case as the known wrong E getter, preserving its old amount", row => {
    const read = sourceHostTalentTableReadSchema.parse(row.read), builder = new TraceBuilder();
    const actual = appendSourceHostTalentTableRead(builder, {read, sourceCommit: row.sourceCommit, actorIndex: row.actorIndex, frame: row.hitFrame, nodeId: "old-read", label: row.case});
    expect(actual.value).toBe(row.observedOldCoefficient);
    expect(actual.value).not.toBe(row.expectedCoefficient);
    expect(actual.explanationGaps.join("；")).toContain("历史Swift回执忠实验证原a7的E等级索引");
    expect(builder.nodes.find(node => node.id === "old-read")!.explanationKey).toContain("历史原生读取，已知未修正");
    expect(builder.nodes.find(node => node.id.endsWith(".constellationBonus"))!.result!.value).toBe(row.case.endsWith("c3") ? 3 : 0);
  });
  it.each([[1, 0, 0, .84194], [10, 0, 0, 1.6643], [10, 3, 0, 1.6643], [1, 0, 1, .91047]] as const)(
    "validates corrected NA base=%i constellation=%i Childe=%i without E/C3 leakage", (base, cons, childe, coefficient) => {
      // Expected post-build source receipt fixture, not a claimed native run.
      const read = expectedRead(base, cons, childe), note = semantics(read)!;
      expect(note.explanation).toContain("实际新源码读取位置");
      expect(note.explanationGaps).toEqual([]);
      expect(note.sourceRefs).toContain(`source-host-patch:${evidence.patch.name}:sha256:${evidence.patch.sha256}`);
      for (const ref of evidence.normalConSourceContract.sourceRefs) expect(note.sourceRefs).toContain(ref);
      const trace = new TraceBuilder();
      const index = appendSourceHostTalentIndexTrace(trace, {source: read.indexSources![0], expectedIndex: read.indices[0]!, nodePrefix: "new", sourceCommit: evidence.sourceCommit, actorIndex: 0, frame: read.frame});
      expect(evidence.table.values[index.index]).toBe(coefficient);
      expect(trace.nodes.find(node => node.id === "new.constellationBonus")!.result!.value).toBe(0);
      expect(trace.nodes.find(node => node.id === "new.passiveBonus")!.result!.value).toBe(childe);
    });
  it.each(["missing", "skill-kind", "c3", "zero-sentinel", "other-negative-sentinel", "duplicate"])("rejects %s getter provenance, including equal-level numeric disguises", change => {
    const read = expectedRead(10);
    if (change === "missing") delete read.indexSources;
    if (change === "skill-kind") read.indexSources![0]!.kind = "skill";
    if (change === "c3") read.indexSources![0]!.constellationUnlock = 3;
    if (change === "zero-sentinel") read.indexSources![0]!.constellationUnlock = 0;
    if (change === "other-negative-sentinel") read.indexSources![0]!.constellationUnlock = -2;
    if (change === "duplicate") read.indexSources!.push(structuredClone(read.indexSources![0]!));
    expect(() => semantics(read)).toThrow(/对应NA\/E基础天赋/);
  });
  it("never labels another pin/site/table or old Skill receipt as corrected by matching its number", () => {
    const read = expectedRead();
    expect(sourceHostIansanSwiftTalentSemantics(read, "other-pin", correctedSite)).toBeUndefined();
    expect(semantics({...read, siteId: "other-site"})).toBeUndefined();
    expect(semantics({...read, tableId: "other-table"})).toBeUndefined();
    expect(() => semantics({...read, siteId: evidence.legacySite.id})).toThrow(/新旧来源语义/);
    // Generic getter replay, rather than coefficient equality, catches a forged base/index pair.
    expect(() => appendSourceHostTalentIndexTrace(new TraceBuilder(), {source: {...read.indexSources![0]!, value: 9}, expectedIndex: 9,
      nodePrefix: "forged", sourceCommit: evidence.sourceCommit, actorIndex: 0, frame: 138})).toThrow(/differ/);
  });
  it("pins the exact -1 NormalCon sentinel through the real wrapper constructor, consCheck and Iansan initializer", () => {
    const archive = readFileSync(new URL(`../../game-data/sources/iansan-swift-resolved-casts/source.json.gz`, import.meta.url));
    const files = (JSON.parse(gunzipSync(archive).toString()) as {files: Record<string, string>}).files;
    const contract = evidence.normalConSourceContract, wrapper = files[contract.wrapperArchiveKey]!, iansan = files[contract.iansanArchiveKey]!;
    expect(evidence.correctedSite.constellationUnlock).toBe(-1);
    expect(evidence.legacySite.constellationUnlock).toBe(3);
    expect(wrapper).toContain("c.NormalCon = -1\n\tc.SkillCon = -1\n\tc.BurstCon = -1");
    const consCheck = wrapper.match(/func \(c \*CharWrapper\) consCheck\(\) \{[\s\S]*?\n\}/)![0];
    for (const slot of ["NormalCon", "SkillCon", "BurstCon"]) expect(consCheck).toContain(`if c.${slot} < 0 {`);
    expect(consCheck).toContain("if consUnset != 1 {");
    expect(consCheck).not.toMatch(/c\.(NormalCon|SkillCon|BurstCon)\s*=/);
    const initializer = iansan.match(/func NewChar\([\s\S]*?\n\}/)![0];
    expect(initializer).toContain("c.SkillCon = 3\n\tc.BurstCon = 5");
    expect(initializer).not.toContain("NormalCon");
    expect(wrapper).toContain("if c.NormalCon > 0 && c.Base.Cons >= c.NormalCon {");
  });
  it("applies exactly the native getter correction at its actual new line, preserving pinned raw source and tables", () => {
    const archive = readFileSync(new URL(`../../game-data/sources/iansan-swift-resolved-casts/source.json.gz`, import.meta.url));
    expect(createHash("sha256").update(archive).digest("hex")).toBe(evidence.archive.sha256);
    const files = (JSON.parse(gunzipSync(archive).toString()) as {files: Record<string, string>}).files;
    for (const file of evidence.sourceFiles) {
      const bytes = Buffer.from(files[file.archiveKey]!);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
      expect(createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex")).toBe(file.gitBlob);
    }
    const patch = readFileSync(new URL(`../../source-host/stellar-overlay/patches/138-iansan-swift-normal-talent.patch`, import.meta.url));
    expect(createHash("sha256").update(patch).digest("hex")).toBe(evidence.patch.sha256);
    const original = files["gcsim/internal/characters/iansan/charge.go"]!, directory = mkdtempSync(join(tmpdir(), "iansan-138-source-unit-"));
    try {
      const relative = "internal/characters/iansan/charge.go"; mkdirSync(join(directory, "internal/characters/iansan"), {recursive: true});
      writeFileSync(join(directory, relative), original);
      execFileSync("git", ["apply", "--check", "-"], {cwd: directory, input: patch});
      execFileSync("git", ["apply", "-"], {cwd: directory, input: patch});
      const corrected = readFileSync(join(directory, relative), "utf8");
      expect(original.split("\n")[94]).toContain("swift[c.TalentLvlSkill()]");
      expect(corrected.split("\n")[97]).toContain("swift[c.TalentLvlAttack()]");
      expect(corrected.replace(/\t\t\/\/ (Corrected by source-host[^\n]*|Iansan\/index[^\n]*|Preserve upstream[^\n]*)\n/g, "").replace("swift[c.TalentLvlAttack()]", "swift[c.TalentLvlSkill()]")).toBe(original);
      expect(JSON.parse(files["optimizer/libs/gi/stats/Data/Characters/Iansan/skillParam.json"]!).auto[4]).toEqual(evidence.table.values);
    } finally {rmSync(directory, {recursive: true, force: true});}
  });
});
