import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { createObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { analyzeSandroneComposition, bindSandroneCompositionComponent } from "./sandrone-observed-composition";
import type { ObservedSkillCompositionDocument } from "./observed-skill-composition";

describe("Sandrone observed Fagio composition", () => {
  it("counts actual opportunities including misses and binds only the replacing beam component", () => {
    const base = getCharacterDocuments("character:10000133", 1).find((row) => row.gameContext?.skillId === "sandrone-charged-beamdmg-component")!;
    const special = createObservedSpecialComponentDocument(base, "sandrone-charged-beam-stellar-conduct-component");
    const context = {
      initialHeat: 20, initialMode: "inactive" as const, initialRadiance: "none" as const,
      events: [
        { id: "start", frame: 0, kind: "window-start" as const },
        { id: "mode", frame: 0, kind: "observe-mode" as const, mode: "decoding" as const },
        { id: "radiance", frame: 1, kind: "observe-radiance" as const, radiance: "stellar-conduct" as const },
        { id: "beam", frame: 2, kind: "hit" as const, hitKind: "beam" as const, targetId: "enemy", snapshotFrame: 2, snapshotId: "beam-panel", contact: true },
        { id: "miss", frame: 3, kind: "hit" as const, hitKind: "beam" as const, targetId: "enemy", contact: false },
        { id: "prism", frame: 4, kind: "hit" as const, hitKind: "prism-1" as const, targetId: "enemy", snapshotFrame: 4, snapshotId: "prism-panel", contact: true },
        { id: "end", frame: 5, kind: "window-end" as const },
      ],
    };
    const composition = {
      schemaVersion: "observed-skill-composition-v1", profile: "sandrone-fagio-window", id: "observed-fagio", label: "Observed Fagio window",
      targetId: "enemy", originEventId: "start", endEventId: "end", allOpportunitiesRecorded: true, damageWindowClosed: true,
      dataIdentity: base.dataIdentity, context, components: [{ id: "beam-component", eventId: "beam", document: special }],
      unmappedOpportunities: [], assumptions: ["User-recorded complete window."],
    } satisfies Extract<ObservedSkillCompositionDocument, { profile: "sandrone-fagio-window" }>;
    const analysis = analyzeSandroneComposition(composition);
    expect(analysis.closed).toBe(true);
    expect(analysis.completeCastEligible).toBe(false);
    expect(analysis.issues).toEqual([]);
    expect(analysis.opportunities.map((row) => [row.eventId, row.contact, row.sourceSkillId])).toEqual([
      ["beam", true, "sandrone-charged-beam-stellar-conduct-component"],
      ["miss", false, "sandrone-charged-beam-stellar-conduct-component"],
    ]);
    expect(analysis.nonDamageNotes.some((note) => note.includes("prism"))).toBe(true);
    const bound = bindSandroneCompositionComponent(special, composition.context, "beam");
    expect(bound.selectedHitIds).toHaveLength(1);
    expect(bound.gameContext?.sandroneObservedLifecycle?.hitBindings?.[bound.selectedHitIds[0]!]).toBe("beam");
    expect(() => bindSandroneCompositionComponent(base, composition.context, "beam")).toThrow();
  });
});
