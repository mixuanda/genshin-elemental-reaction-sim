import { describe, expect, it } from "vitest";
import { bindSandroneObservedHit, reduceSandroneObservedLifecycle } from "./sandrone-observed-lifecycle";
import { prepareSandroneObservedLifecycleDocument } from "./sandrone-observed-lifecycle";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { createObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { bindSandroneCompositionComponent } from "./sandrone-observed-composition";
import { calculateDocument } from "./calculator";
import type { SandroneObservedLifecycle } from "./sandrone-observed-context";

describe("Sandrone ordered observations", () => {
  it("binds actual replacement hits and crosses only sourced 100 / below-50 thresholds", () => {
    const context: SandroneObservedLifecycle = {
      initialHeat: 20, initialMode: "inactive", initialRadiance: "none", completeObservation: true,
      events: [
        { id: "start", frame: 0, kind: "observe-mode", mode: "decoding" },
        { id: "conduct", frame: 4, kind: "observe-radiance", radiance: "stellar-conduct" },
        { id: "beam", frame: 5, kind: "hit", hitKind: "beam", targetId: "enemy", snapshotFrame: 5, snapshotId: "beam-snapshot", contact: true, heat: 50 },
        { id: "max", frame: 10, kind: "observe-heat", heat: 100 },
        { id: "overdrive", frame: 11, kind: "hit", hitKind: "overdrive", targetId: "enemy", snapshotFrame: 11, snapshotId: "overdrive-snapshot", contact: true },
        { id: "still-overdrive", frame: 12, kind: "observe-heat", heat: 50 },
        { id: "exit", frame: 13, kind: "observe-heat", heat: 49 },
        { id: "swirl", frame: 14, kind: "observe-radiance", radiance: "stellar-swirl" },
      ],
    };
    const reduced = reduceSandroneObservedLifecycle(context);
    expect(reduced.states.map((row) => row.state.mode)).toEqual([
      "decoding", "decoding", "decoding", "overdrive", "overdrive", "overdrive", "inactive", "inactive",
    ]);
    expect(reduced.hits.map((hit) => hit.specialComponentId ?? hit.sourceSkillId)).toEqual([
      "sandrone-charged-beam-stellar-conduct-component", "sandrone-charged-overdrivedmg-component",
    ]);
    expect(bindSandroneObservedHit(context, "beam").state.radiance).toBe("stellar-conduct");
    expect(reduced.completeChargedCycleCertified).toBe(false);
    expect(reduced.issues).toEqual([]);
  });

  it("keeps a special hit binding after its event ID materializes and blocks stale events", () => {
    const base = getCharacterDocuments("character:10000133", 1).find((document) => document.gameContext?.skillId === "sandrone-charged-beamdmg-component")!;
    const document = createObservedSpecialComponentDocument(base, "sandrone-charged-beam-stellar-conduct-component");
    const originalId = document.hits[0]!.id;
    document.gameContext!.sandroneObservedLifecycle = {
      initialHeat: 50, initialMode: "decoding", initialRadiance: "stellar-conduct",
      events: [{ id: "beam-1", frame: 12, kind: "hit", hitKind: "beam", targetId: "enemy", snapshotFrame: 12, snapshotId: "beam", contact: true }],
      hitBindings: { [originalId]: "beam-1" },
    };
    const prepared = prepareSandroneObservedLifecycleDocument(document);
    expect(prepared.hits[0]!.id).toBe("sandrone-charged-beam-stellar-conduct-component:beam-1");
    expect(prepared.gameContext!.sandroneObservedLifecycle!.hitBindings?.[prepared.hits[0]!.id]).toBe("beam-1");
    const again = prepareSandroneObservedLifecycleDocument(prepared);
    expect(again.gameContext!.sandroneObservedLifecycle!.hitBindings?.[again.hits[0]!.id]).toBe("beam-1");
    again.gameContext!.sandroneObservedLifecycle!.hitBindings![again.hits[0]!.id] = "missing";
    const stale = prepareSandroneObservedLifecycleDocument(again);
    expect(stale.dependencies.some((dependency) => dependency.id.startsWith("sandrone-observed:") && dependency.status === "missing")).toBe(true);
    expect(reduceSandroneObservedLifecycle({ initialHeat: 49, initialMode: "overdrive", events: [] }).issues).not.toEqual([]);
  });

  it("calculates observed ordinary sweep and overdrive under radiance while reserving radiant beams for replacement", () => {
    const documents = getCharacterDocuments("character:10000133", 1);
    const source = (skillId: string) => documents.find((document) => document.gameContext?.skillId === skillId)!;
    const sweep = source("sandrone-charged-sweepdmg-component");
    const beam = source("sandrone-charged-beamdmg-component");
    const overdrive = source("sandrone-charged-overdrivedmg-component");
    expect(sweep.hits[0]?.kind).toBe("ordinary");
    expect(overdrive.hits[0]?.kind).toBe("ordinary");
    const context: SandroneObservedLifecycle = {
      initialHeat: 20, initialMode: "decoding", initialRadiance: "stellar-conduct",
      events: [
        { id: "sweep", frame: 1, kind: "hit", hitKind: "sweep", targetId: "enemy", snapshotFrame: 1, snapshotId: "sweep-panel", contact: true },
        { id: "beam", frame: 2, kind: "hit", hitKind: "beam", targetId: "enemy", snapshotFrame: 2, snapshotId: "beam-panel", contact: true },
        { id: "max", frame: 3, kind: "observe-heat", heat: 100 },
        { id: "swirl", frame: 4, kind: "observe-radiance", radiance: "stellar-swirl" },
        { id: "overdrive", frame: 5, kind: "hit", hitKind: "overdrive", targetId: "enemy", snapshotFrame: 5, snapshotId: "overdrive-panel", contact: true },
      ],
    };
    const reduction = reduceSandroneObservedLifecycle(context);
    expect(reduction.issues).toEqual([]);
    expect(reduction.hits.map(({ sourceSkillId, specialComponentId, issues }) => [sourceSkillId, specialComponentId, issues])).toEqual([
      ["sandrone-charged-sweepdmg-component", undefined, []],
      [undefined, "sandrone-charged-beam-stellar-conduct-component", []],
      ["sandrone-charged-overdrivedmg-component", undefined, []],
    ]);
    for (const [document, eventId] of [[sweep, "sweep"], [overdrive, "overdrive"]] as const) {
      const bound = bindSandroneCompositionComponent(document, context, eventId);
      const result = calculateDocument(bound);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]!.status).toBe("calculated");
      expect(result.hits[0]!.expected).toBeGreaterThan(0);
      expect(result.trace.some((node) => node.id.includes(`sandrone-observed.${eventId}.frame`))).toBe(true);
    }
    expect(() => bindSandroneCompositionComponent(beam, context, "beam")).toThrow();
  });
});
