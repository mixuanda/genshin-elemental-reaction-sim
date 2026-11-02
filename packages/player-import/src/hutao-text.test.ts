import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importPlayerText } from "./hutao-text";
import { importPlayerInput } from "./import";
import { applyPreview } from "./adapters";
import { importPlayerJson } from "./normalize";
import good from "../fixtures/synthetic-good.json" with { type: "json" };
import type { ImportResult } from "./model";

// Public documentation grammar, independently authored synthetic values/identities.
// This is not a real player account, login result, inventory or damage validation.
const fixture = readFileSync(new URL("../fixtures/synthetic-hutao-multi.txt", import.meta.url), "utf8");
function snapshot(result: ImportResult) { if (!result.ok) throw new Error(`Expected parsed synthetic text, got ${result.code}`); return result.snapshot; }
const one = fixture.slice(0, fixture.indexOf("// 刻晴")).replace(/\/\/ ={3,}\s*$/u, "");
const build = (text = one) => snapshot(importPlayerText(text)).builds[0]!;

describe("Snap Hutao public-format text adapter (synthetic fixtures only)", () => {
  it("parses multiple independently authored records with English and Chinese name mappings", () => {
    const s = snapshot(importPlayerText(fixture, { now: "2026-10-21T17:00:00Z" }));
    expect(s.source).toMatchObject({ kind: "hutao-text", scope: "file-equipped-subset", fixture: true, uid: null, snapshotAt: null, fetchedAt: null });
    expect(s.builds).toHaveLength(2);
    expect(s.builds.map(b => b.identity.value?.id)).toEqual(["character:10000002", "character:10000042"]);
    expect(s.builds[0]!.weapon.identity.value?.id).toBe("weapon:11509");
    expect(s.builds[1]!.weapon.identity.value?.id).toBe("weapon:11509");
    expect(s.builds[0]!.artifacts[0]!.identity.value?.id).toBe("artifact-set:14001");
    expect(s.builds[1]!.artifacts[0]!.identity.value?.id).toBe("artifact-set:14001");
    expect(s.source.inventory).toBe("not-imported");
    expect(s.source.history).toBe("not-imported");
  });
  it("keeps base/extra/effective talents separate and does not add constellation bonus again", () => {
    const b = build();
    expect(b.constellation.value).toBe(6);
    expect(b.talents.skill).toMatchObject({ base: { value: 10 }, bonus: { value: 3 }, effective: { value: 13 } });
    expect(b.talents.burst.effective.value).toBe(13);
    expect(b.talents.auto).toMatchObject({ base: { state: "missing", value: null }, bonus: { state: "missing", value: null }, effective: { value: 10 } });
    expect(b.talents.skill.base.path).toContain("text.line:");
  });
  it("does not guess absent ascensions, omitted character metadata or an unequipped position", () => {
    const b = build(one.replace(", C6", "").replace("// 🌷 HP: 4000 [☆5 +20 Blizzard Strayer]\n// [Elemental Mastery: 0][CRIT Rate: 10.0%][DEF: 20][HP: 5.0%]\n", ""));
    expect(b.constellation).toMatchObject({ state: "missing", value: null });
    expect(b.ascension).toMatchObject({ state: "missing", value: null });
    expect(b.weapon.ascension).toMatchObject({ state: "missing", value: null });
    expect(b.artifacts[0]!.identity.state).toBe("missing");
    expect(b.completeness.state).toBe("partial");
  });
  it("preserves observed zero and differentiates missing panel properties", () => {
    const b = build(one.replace("// [DEF: 700]\n", ""));
    const em = b.panel.stats.find(s => s.key.value === "eleMas")!;
    expect(em.amount).toMatchObject({ state: "known", value: 0, unit: "flat" });
    expect(b.panel.stats.find(s => s.key.value === "def")!.amount).toMatchObject({ state: "missing", value: null });
    expect(b.artifacts[0]!.substats[0]!.amount.value).toBe(0);
  });
  it("normalizes weapon/artifact/panel units once with line provenance and unverified panel accounting", () => {
    const b = build();
    expect(b.weapon.stats[0]!.amount).toMatchObject({ value: 500, unit: "flat" });
    expect(b.weapon.stats[1]!.amount).toMatchObject({ value: 0.2, unit: "ratio" });
    expect(b.artifacts[2]!.main.amount).toMatchObject({ value: 0.4, unit: "ratio" });
    expect(b.artifacts[0]!.main.amount.value).toBe(4000);
    expect(b.artifacts[0]!.level.value).toBe(20);
    expect(b.weapon.refinement.value).toBe(1);
    expect(b.panel.stats.find(s => s.key.value === "critRate_")!.amount.value).toBe(0.25);
    expect(b.panel.accounting).toBe("unverified-text-observation");
    expect(b.artifacts[0]!.main.amount.path).toContain("text.line:");
    expect(JSON.stringify(b)).not.toContain('"raw"');
  });
  it("retains unknown names and labels as explicit unknown IDs", () => {
    const b = build(one.replace("Kamisato Ayaka", "Unmapped Hero").replace("Mistsplitter Reforged", "Unmapped Sword").replaceAll("Blizzard Strayer", "Unmapped Set").replace("[Elemental Mastery: 0]", "[Unmapped Stat: 0]"));
    expect(b.identity).toMatchObject({ state: "unknown-id", value: { id: "Unmapped Hero" } });
    expect(b.weapon.identity.state).toBe("unknown-id");
    expect(b.artifacts[0]!.identity.state).toBe("unknown-id");
    expect(b.panel.stats.find(s => s.key.value === "hutao-stat:Unmapped Stat")!.amount).toMatchObject({ state: "unknown-id", value: 0, unit: "unknown" });
    expect(b.completeness.state).toBe("partial");
  });
  it("detects wrong percent units, negative values, duplicate panel and duplicate substats", () => {
    expect(build(one.replace("CRIT DMG: 20.0%", "CRIT DMG: 20.0")).weapon.stats[1]!.amount.state).toBe("invalid");
    expect(build(one.replace("HP: 4000", "HP: -1")).artifacts[0]!.main.amount.state).toBe("invalid");
    expect(build(one.replace("[HP: 15000]", "[HP: 15000][HP: 16000]")).completeness.issues.some(i => /重复面板/u.test(i.note))).toBe(true);
    expect(build(one.replaceAll("[DEF: 20]", "[CRIT Rate: 2.0%]")).artifacts[0]!.substats.some(s => s.key.state === "invalid")).toBe(true);
    expect(build(one.replace("☆5, C6", "☆4, C6")).rarity!.state).toBe("invalid");
    expect(build(one.replace("☆5, R1", "☆4, R1")).weapon.rarity!.state).toBe("invalid");
  });
  it("accepts CRLF, commentless text and complete Markdown/single-backtick wrappers", () => {
    expect(snapshot(importPlayerText(one.replaceAll("\n", "\r\n"))).builds).toHaveLength(1);
    expect(snapshot(importPlayerText(one.replaceAll("// ", ""))).builds).toHaveLength(1);
    expect(snapshot(importPlayerText("```text\n" + one + "\n```" )).builds).toHaveLength(1);
    expect(snapshot(importPlayerText("`" + one + "`" )).builds).toHaveLength(1);
  });
  it.each([
    "arbitrary prose before an export\n" + one,
    one + "// Unsupported footer\n",
    one.replace("🌷", "❓"),
    one.replace("☆5, C6", "☆5, C6, A6"),
    one.replace("Lv.13 (10 +3)", "Lv.14 (10 +3)"),
    one.replace("Lv.90, ☆5, R1", "Lv.90, ☆5, R1, R2"),
    one.replace("HP: 15000", "HP: 15,000"),
    "```text\n" + one,
    one + "x".repeat(4001),
  ])("rejects unsupported or inconsistent structure atomically without echoing payload", text => {
    const r = importPlayerText(text);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("Unsupported footer");
    const previous = snapshot(importPlayerJson(JSON.stringify(good)));
    expect(applyPreview(previous, r).current).toBe(previous);
  });
  it.each(["stoken=FAKE_TEST_SECRET", "Cookie: FAKE_TEST_SECRET", "Authorization: Bearer FAKE_TEST_SECRET", "api_key: FAKE_TEST_SECRET", "session_id=FAKE_TEST_SECRET", "eyJfake.eyJfake.fake"])("refuses secret-looking text before parsing and never echoes it", secret => {
    const r = importPlayerText(one + "\n// " + secret);
    expect(r).toMatchObject({ ok: false, code: "secret-input" });
    expect(JSON.stringify(r)).not.toContain("FAKE_TEST_SECRET");
  });
  it("routes existing JSON unchanged and new text into the same independent preview result type", () => {
    expect(snapshot(importPlayerInput(JSON.stringify(good))).source.kind).toBe("good-file");
    expect(snapshot(importPlayerInput(fixture)).source.kind).toBe("hutao-text");
    const previous = snapshot(importPlayerJson(JSON.stringify(good)));
    const text = importPlayerInput(fixture);
    expect(text.ok).toBe(true);
    expect(applyPreview(previous, text)).toMatchObject({ applied: false, current: previous });
  });
});
