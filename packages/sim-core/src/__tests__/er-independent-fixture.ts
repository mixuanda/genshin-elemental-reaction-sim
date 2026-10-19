import { makeConfig } from "./fixtures";

/** Intentionally impossible synthetic cost; not a game character or recommended rotation. */
export function erIndependentFixture() {
  const config = makeConfig({ duration: 2, cycleLength: 2,
    meta: { name: "合成充能容量证明", version: "1", verificationStatus: "user-supplied" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "e", actorId: "a", name: "合成产球", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          hits: [{ id: "e-hit", frame: 0, scaling: 1, element: "pyro" }],
          particles: [{ id: "one-particle", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }] },
        { id: "q", actorId: "a", name: "超出容量的合成耗能", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 61 },
      ], commands: [{ type: "skill", actorId: "a", abilityId: "e", atFrame: 0 }, { type: "burst", actorId: "a", abilityId: "q", atFrame: 2 }],
    },
  });
  config.characters[0]!.initialEnergy = 60;
  return config;
}
