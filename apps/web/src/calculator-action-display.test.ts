import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "./character-calculations";
import { calculatorActionDisplayName, calculatorResultDisplayName } from "./calculator-action-display";

describe("resolved action labels preserve saved source identity", () => {
  it("describes actual Iansan high-constellation Swift without changing a saved c0 identifier", () => {
    const document = getCharacterDocuments("character:10000110", 10).find(row => row.gameContext?.skillId === "iansan-swift-resolved-c0")!;
    document.gameContext!.constellation = 6;
    document.scope = "single-hit";
    const before = JSON.stringify(document);
    expect(calculatorActionDisplayName(document)).toBe("雷霆飞缒 · 雷元素重击");
    expect(calculatorResultDisplayName(document)).toContain("单次命中 · C6 · 有效普攻 Lv.10");
    expect(calculatorResultDisplayName(document)).not.toContain("C0");
    expect(JSON.stringify(document)).toBe(before);
  });
  it.each(["aether", "lumine"] as const)("labels %s selected Anemo hits without claiming a whole no-absorption C0 burst", gender => {
    const document = getCharacterDocuments(gender === "aether" ? "character:10000005" : "character:10000007", 10)
      .find(row => row.gameContext?.skillId === `traveler-cross-${gender}-anemo-burst-c0`)!;
    document.gameContext!.constellation = 6;
    document.scope = "single-hit";
    document.gameContext!.travelerCrossEntityCast = { anemo: { noAbsorption: true } };
    const before = JSON.stringify(document);
    expect(calculatorActionDisplayName(document)).toBe("风息激荡 · 风伤与元素吸收");
    expect(calculatorResultDisplayName(document)).toContain("单次命中 · 无元素吸收 · C6 · 有效Q Lv.10");
    expect(calculatorResultDisplayName(document)).not.toContain("完整施放");
    expect(JSON.stringify(document)).toBe(before);
    delete document.gameContext!.travelerCrossEntityCast!.anemo;
    expect(calculatorResultDisplayName(document)).toContain("风元素本体");
    expect(calculatorResultDisplayName(document)).not.toContain("待填写");
    document.scope = "one-cast";
    expect(calculatorResultDisplayName(document)).toContain("本次所选命中");
    delete document.gameContext!.travelerCrossEntityCast!.anemo;
    expect(calculatorResultDisplayName(document)).toContain("吸收条件待填写");
  });

  it("leaves unrelated action names and saved labels intact", () => {
    const document = getCharacterDocuments("character:10000015", 10).find(row => row.gameContext?.skillId === "kaeya-skill")!;
    expect(calculatorActionDisplayName(document)).toBe(document.gameContext!.skillName);
    expect(calculatorResultDisplayName(document)).toBe(document.label);
  });

  it("retains the existing Dendro single-tick scope label without broadening its support", () => {
    const document = getCharacterDocuments("character:10000005", 10)
      .find(row => row.gameContext?.skillId === "traveler-cross-aether-dendro-burst-c0")!;
    document.scope = "single-hit";
    document.gameContext!.travelerCrossEntityCast = {};
    expect(calculatorResultDisplayName(document)).toContain("单次命中（C0）");
    expect(calculatorResultDisplayName(document)).not.toContain("完整施放");
    expect(calculatorActionDisplayName(document)).toBe(document.gameContext!.skillName);
  });
});
