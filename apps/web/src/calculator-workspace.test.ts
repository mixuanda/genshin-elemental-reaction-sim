import { describe, expect, it } from "vitest";
import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import { calculateDocument } from "@genshin-dps-lab/sim-core";
import { getCharacterDocuments } from "./character-calculations";
import { createWorkspaceCalculatorTrust } from "./calculator-workspace-trust";
import { resolveEquipmentBuild } from "@genshin-dps-lab/game-data/equipment-build";

describe("isolated calculator data workspace", () => {
  it("derives equipment from the selected workspace and refuses missing preview curves", () => {
    const preview: RuntimeWorkspace = { ...structuredClone(releasedRuntimeWorkspace), channel: "preview" };
    const character = preview.catalog.characters.find(row => row.slug === "kaeya")!;
    const weapon = preview.catalog.weapons.find(row => row.id === "weapon:11101")!;
    const input = { characterId: character.id, weaponId: weapon.id, level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true };
    const original = resolveEquipmentBuild(input).build;
    character.stats.base.attack! += 100;
    const local = resolveEquipmentBuild(input, preview).build;
    expect(local.characterBaseAtk).toBeGreaterThan(original.characterBaseAtk);
    expect(local.equipment.sourceRefs).toEqual(expect.arrayContaining([expect.stringContaining(preview.catalog.sources.find(row => row.id === "genshin-db")!.commit)]));
    preview.supplemental.statCurves.weapons = {};
    expect(() => resolveEquipmentBuild(input, preview)).toThrow(/当前工作区缺少/);
    expect(resolveEquipmentBuild(input).build.characterBaseAtk).toBe(original.characterBaseAtk);
  });
  it("uses preview talent values, blocks only a changed source vector, and never certifies preview JSON", () => {
    // Deliberately synthetic workspace identity: this fixture is not a real preview release or promotion.
    const preview: RuntimeWorkspace = structuredClone(releasedRuntimeWorkspace);
    Object.assign(preview, { channel: "preview" });
    const snapshotId = `snapshot-${"a".repeat(64)}`;
    Object.assign(preview.metadata, { snapshotId });
    Object.assign(preview.evidence, { snapshotId });
    Object.assign(preview.evidence.metadata, { snapshotId });
    preview.selection.previewWorkspaceSnapshotId = snapshotId;
    const character = preview.catalog.characters.find(entry => entry.slug === "kaeya");
    expect(character).toBeDefined();
    if (!character) throw new Error("fixture requires the existing Kaeya source catalog");
    const skill = preview.catalog.talentSets.find(entry => entry.id === "talent-set:kaeya")?.abilities.find(entry => entry.key === "combat2");
    expect(skill?.parameters.param1).toBeDefined();
    if (!skill?.parameters.param1) throw new Error("fixture requires the existing skill parameter vector");
    skill.parameters.param1[0] = 123; // Intentional source drift; must not fall back to released values.
    const previewDocs = getCharacterDocuments(character.id, 1, preview);
    const changed = previewDocs.find(doc => doc.gameContext?.skillId === "kaeya-skill");
    expect(changed).toBeDefined();
    if (!changed) throw new Error("the changed action must remain visible with its blockers");
    expect(changed.dataIdentity).toMatchObject({ datasetId: snapshotId, releaseStatus: "preview", evidenceStatus: "provisional" });
    expect(calculateDocument(changed).status).toBe("blocked");
    expect(previewDocs.some(doc => doc.gameContext?.skillId !== "kaeya-skill" && doc.hits.some(hit => hit.kind === "ordinary"))).toBe(true);
    const released = getCharacterDocuments(character.id, 1).find(doc => doc.gameContext?.skillId === "kaeya-skill");
    expect(released?.hits.some(hit => hit.kind === "ordinary")).toBe(true);
    const restored = JSON.parse(JSON.stringify(changed));
    restored.dataIdentity.evidenceStatus = "verified";
    expect(createWorkspaceCalculatorTrust(restored, changed, preview)).toEqual({});
    expect(releasedRuntimeWorkspace.catalog.talentSets.find(entry => entry.id === "talent-set:kaeya")?.abilities.find(entry => entry.key === "combat2")?.parameters.param1?.[0]).not.toBe(123);
  });
});
