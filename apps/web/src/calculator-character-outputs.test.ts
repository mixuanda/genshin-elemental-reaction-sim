import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { applyKukiDamageContext, applyNoelleBurstContext, getCharacterDocuments } from "./character-calculations";
import { buildCharacterOutputs, captureCharacterOutputResult, characterOutputInputVersion, renderCharacterOutputs } from "./calculator-character-outputs";

describe("existing character outputs", () => {
  it("lists real Kaeya normals, E and Q, preserving the original E candidate index and its actual result", () => {
    const candidates = getCharacterDocuments("character:10000015", 10);
    const before = JSON.stringify(candidates);
    const index = candidates.findIndex(document => document.gameContext?.skillId === "kaeya-skill");
    const document = candidates[index]!;
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    const groups = buildCharacterOutputs(candidates, gameDataCatalog, {
      selectedCandidateIndex: index, observations: [captureCharacterOutputResult(document, result)],
    });
    expect(groups.find(group => group.id === "normal")?.items).toHaveLength(5);
    expect(groups.find(group => group.id === "burst")?.items.length).toBeGreaterThan(0);
    const skill = groups.find(group => group.id === "skill")!.items[0]!;
    expect(skill).toMatchObject({ candidateIndex: index, selected: true, status: "calculated", damage: result.totals });
    expect(groups.find(group => group.id === "normal")!.items.every(item => item.status === "pending" && item.damage === undefined)).toBe(true);
    const html = renderCharacterOutputs(groups);
    expect(html).toContain(`data-character-output-index="${index}" aria-current="true"`);
    expect(html).toContain("E · 元素战技");
    expect(html).toContain("霜袭");
    expect(html).toContain("待计算");
    expect(JSON.stringify(candidates)).toBe(before);
  });

  it("shows Noelle's separate charged/plunge actions and her actual Q-active state without inferring E enhancement", () => {
    const candidates = getCharacterDocuments("character:10000034", 10);
    const index = candidates.findIndex(document => document.gameContext?.skillId === "noelle-normal-1");
    const inactive = candidates[index]!;
    const active = applyNoelleBurstContext(inactive, { active: true, effectiveTalentLevel: 10, accounting: "already-in-final-panel" });
    const inactiveObservation = captureCharacterOutputResult(inactive, calculateDocument(inactive));
    const options = { selectedCandidateIndex: index, currentDocument: active, observations: [inactiveObservation] };
    const groups = buildCharacterOutputs(candidates, gameDataCatalog, options);
    const normal = groups.find(group => group.id === "normal")!.items.find(item => item.candidateIndex === index)!;
    expect(normal).toMatchObject({ status: "pending", variantLabel: "Q 激活·岩附魔", conditions: ["Q 状态：已激活"] });
    expect(normal.damage).toBeUndefined();
    expect(groups.find(group => group.id === "charged")!.items.some(item => item.scopeLabel.includes("部分已定义范围"))).toBe(true);
    expect(groups.find(group => group.id === "plunge")!.items.length).toBeGreaterThan(0);
    const result = calculateDocument(active);
    expect(result.status).toBe("calculated");
    const current = buildCharacterOutputs(candidates, gameDataCatalog, { ...options, currentResult: result });
    expect(current.find(group => group.id === "normal")!.items.find(item => item.candidateIndex === index)?.damage).toEqual(result.totals);
  });

  it("uses the catalog kind even when a burst label says Skill and its identifier has no combat suffix", () => {
    const candidates = getCharacterDocuments("character:10000034", 10);
    const burst = candidates.find(document => document.gameContext?.skillId === "noelle-burst-cast")!;
    const catalog = structuredClone(gameDataCatalog);
    const ability = catalog.talentSets.flatMap(set => set.abilities).find(item => item.id === burst.gameContext!.abilityId)!;
    ability.id = "source-ability-without-combat-suffix";
    burst.gameContext!.abilityId = ability.id;
    burst.gameContext!.skillName = "名称包含 Skill 和 E，但实际为爆发";
    const groups = buildCharacterOutputs(candidates, catalog);
    expect(groups.find(group => group.id === "burst")!.items.some(item => item.title === burst.gameContext!.skillName)).toBe(true);
    expect(groups.find(group => group.id === "skill")!.items.some(item => item.title === burst.gameContext!.skillName)).toBe(false);
  });

  it("keeps Kuki's HP branches separate and copies the complete seven-hit result without summing a second formula", () => {
    const candidates = getCharacterDocuments("character:10000065", 10);
    const index = candidates.findIndex(document => document.gameContext?.skillId === "kuki-burst-high-hp-complete-cast");
    const current = applyKukiDamageContext(candidates[index]!, { burstHpRatioAtCast: 0.75, statsStableAcrossHits: true });
    const result = calculateDocument(current);
    expect(result.status).toBe("calculated");
    const groups = buildCharacterOutputs(candidates, gameDataCatalog, { selectedCandidateIndex: index, currentDocument: current, currentResult: result });
    const bursts = groups.find(group => group.id === "burst")!.items;
    expect(bursts).toHaveLength(2);
    const selected = bursts.find(item => item.candidateIndex === index)!;
    expect(selected).toMatchObject({ scope: "complete-cast", damage: result.totals, conditions: ["施放时生命：75%"] });
    expect(selected.components).toHaveLength(7);
    expect(bursts.find(item => item.candidateIndex !== index)).toMatchObject({ status: "pending" });
    expect(bursts.find(item => item.candidateIndex !== index)?.damage).toBeUndefined();
  });

  it("shows Wanderer's actual single E candidate and short missing-definition states for normals and Q", () => {
    const candidates = getCharacterDocuments("character:10000075", 10);
    expect(candidates).toHaveLength(1);
    const current = candidates[0]!;
    const result = calculateDocument(current);
    expect(result.status).toBe("blocked");
    const groups = buildCharacterOutputs(candidates, gameDataCatalog, { selectedCandidateIndex: 0, currentDocument: current, currentResult: result });
    expect(groups.find(group => group.id === "normal")).toMatchObject({ items: [], unavailableReason: "当前来源尚无可选动作定义" });
    expect(groups.find(group => group.id === "burst")).toMatchObject({ items: [], unavailableReason: "当前来源尚无可选动作定义" });
    const skill = groups.find(group => group.id === "skill")!.items[0]!;
    expect(skill).toMatchObject({ candidateIndex: 0, scope: "single-hit", status: "blocked" });
    expect(skill.damage).toBeUndefined();
    expect(renderCharacterOutputs(groups).match(/data-character-output-index=/g)).toHaveLength(1);
  });

  it("invalidates observed results after build, enemy, talent, selection, scope or historical state changes", () => {
    const candidates = getCharacterDocuments("character:10000034", 10);
    const index = candidates.findIndex(document => document.gameContext?.skillId === "noelle-burst-cast");
    const document = candidates[index]!;
    const observation = captureCharacterOutputResult(document, calculateDocument(document));
    const mutations = [
      (doc: typeof document) => { if (doc.build.mode === "manual-final") doc.build.stats.atk += 1; },
      (doc: typeof document) => { doc.enemy.resistance += 0.01; },
      (doc: typeof document) => { doc.gameContext!.effectiveTalentLevel += 1; },
      (doc: typeof document) => { doc.selectedHitIds = [doc.hits[0]!.id]; },
      (doc: typeof document) => { doc.scope = "single-hit"; },
      (doc: typeof document) => { doc.gameContext!.noelleBurst!.defenseSnapshotNonExtra = 1234; },
    ];
    for (const mutate of mutations) {
      const current = structuredClone(document);
      mutate(current);
      expect(characterOutputInputVersion(current)).not.toBe(observation.inputVersion);
      const item = buildCharacterOutputs(candidates, gameDataCatalog, { effectiveDocuments: new Map([[index, current]]), observations: [observation] })
        .flatMap(group => group.items).find(row => row.candidateIndex === index)!;
      expect(item.status).toBe("pending");
      expect(item.damage).toBeUndefined();
    }
  });

  it("escapes source labels and never accepts another action as the selected action's current result", () => {
    const candidates = getCharacterDocuments("character:10000015", 10);
    candidates[0]!.gameContext!.skillName = '<img src=x onerror="bad()">';
    const other = candidates[1]!;
    const groups = buildCharacterOutputs(candidates, gameDataCatalog, { selectedCandidateIndex: 0, currentDocument: other, currentResult: calculateDocument(other) });
    expect(groups.flatMap(group => group.items).find(item => item.candidateIndex === 0)?.damage).toBeUndefined();
    const html = renderCharacterOutputs(groups);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;img src=x onerror=&quot;bad()&quot;&gt;");
  });

  it("opens only the selected action group and keeps pending actions as compact accessible rows", () => {
    const candidates = getCharacterDocuments("character:10000015", 10);
    const index = candidates.findIndex(document => document.gameContext?.skillId === "kaeya-skill");
    const current = candidates[index]!;
    const html = renderCharacterOutputs(buildCharacterOutputs(candidates, gameDataCatalog, {
      selectedCandidateIndex: index, currentDocument: current, currentResult: calculateDocument(current),
    }));
    const groups = html.match(/<details class="character-output-group"[^>]*>/g)!;
    expect(groups).toHaveLength(3);
    expect(groups.filter(group => / open>/.test(group))).toEqual([expect.stringContaining('data-character-output-group="skill"')]);
    expect(groups.every(group => group.includes('name="calculator-character-output-groups"'))).toBe(true);
    expect(html.match(/data-character-output-index=/g)).toHaveLength(candidates.length);
    expect(html.match(/data-character-output-pending aria-label="待计算；伤害未确定"/g)).toHaveLength(candidates.length - 1);
    expect(html).not.toContain("伤害：—");
    expect(html.match(/class="character-output-metrics"/g)).toHaveLength(1);
    expect(html).toContain("期望伤害");
  });
});
