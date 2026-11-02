import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gameDataRuntimeIndex, parseEnkaShowcase, resolveShowcaseCatalog } from "@genshin-dps-lab/game-data";
import { getCharacterDocuments } from "./character-calculations";
import { applyImportedCalculatorPanel } from "./calculator-import";
import { bindFaruzanHurricaneTalent } from "./faruzan-calculation-talents";

const action = "finite-followup-faruzan-skill-hurricane-c0";
const document = () => getCharacterDocuments("character:10000076", 10).find(row => row.gameContext?.skillId === action)!;
function imported(normalKnown = true) {
  const raw = JSON.parse(readFileSync(new URL("../e2e/fixtures/player-import/kaeya-enka-panel.json", import.meta.url), "utf8"));
  const avatar = raw.avatarInfoList[0], mapping = gameDataRuntimeIndex.enkaCharacterMappings.find(row => row.avatarId === 10000076)!;
  avatar.avatarId = 10000076; avatar.talentIdList = []; avatar.proudSkillExtraLevelMap = {};
  avatar.skillLevelMap = Object.fromEntries(mapping.skillOrder.flatMap((id, index) => index === 0 && !normalKnown ? [] : [[id, [5, 10, 7][index]]]));
  avatar.fightPropMap["44"] = .466;
  return resolveShowcaseCatalog(parseEnkaShowcase(raw, { uid: "synthetic-local-only" })).characters[0]!;
}
describe("Faruzan independent normal talent binding", () => {
  it("binds known normal5 separately from imported E10, using final stats without equipment addition", () => {
    const character = imported(), before = JSON.stringify(character), doc = applyImportedCalculatorPanel(document(), character, "synthetic panel");
    expect(doc.gameContext!.effectiveTalentLevel).toBe(10);
    expect(doc.gameContext!.finiteFollowupCast!.normalTalentLevel).toBe(5);
    expect(doc.hits[1]).toMatchObject({ terms: [{ stat: "atk", coefficient: 1.643 }] });
    expect(doc.build).toMatchObject({ mode: "imported-final", stats: { atk: 1700 } });
    expect(JSON.stringify(character)).toBe(before);
  });
  it("clears stale normal evidence when missing and never borrows known E10", () => {
    const doc = document(); bindFaruzanHurricaneTalent(doc, 12);
    const next = applyImportedCalculatorPanel(doc, imported(false), "synthetic missing normal");
    expect(next.gameContext!.finiteFollowupCast!.normalTalentLevel).toBeUndefined();
    expect(next.gameContext!.effectiveTalentLevel).toBe(10);
    expect(next.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ status: "missing", reason: expect.stringContaining("独立有效等级") })]));
  });
  it("accepts explicit effective levels once and leaves other actions untouched", () => {
    const doc = document(); bindFaruzanHurricaneTalent(doc, 8);
    expect(doc.gameContext!.finiteFollowupCast!.normalTalentLevel).toBe(8);
    expect(() => bindFaruzanHurricaneTalent(doc, 0)).toThrow("1–15");
    const other = getCharacterDocuments("character:10000015", 10).find(row => row.gameContext?.skillId === "kaeya-skill")!;
    const before = JSON.stringify(other); bindFaruzanHurricaneTalent(other, 8);
    expect(JSON.stringify(other)).toBe(before);
  });
});
