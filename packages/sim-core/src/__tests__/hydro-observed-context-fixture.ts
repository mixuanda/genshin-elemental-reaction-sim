import type { CalculatorFinalSnapshot, CalculatorFinalStats, TravelerHydroResolvedCastContext } from "../calculator-model";

// Shared synthetic observation already used by the independent E1 damage oracle.
// Current build stats intentionally differ from both recorded offensive samples.
const neutral: CalculatorFinalStats = { atk: 1000, hp: 20000, def: 1000, em: 0, critRate: 0, critDamage: 0 };
function snapshot(stats: CalculatorFinalStats, ascension: number): CalculatorFinalSnapshot {
  return { stats, characterLevel: 90, ascension, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0,
    source: "Explicit hypothetical historical panel, separate from the current build",
    sourceRefs: ["synthetic:declared-historical-panel"] };
}
export function createObservedHydroHoldContext(): TravelerHydroResolvedCastContext {
  return {
    casterId: "traveler", targetId: "enemy", trueMoonStoryBuffInactive: true,
    freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true,
    fullObservedLifetime: true, allHpChangesRecorded: true, allDamageEventsRecorded: true,
    observedThroughFrame: 60, statsStableAcrossHits: false,
    initialCurrentHp: 12000, initialMaxHp: 20000, releaseFrame: 54, releaseOrder: 2,
    dewCount: 1, spiritbreathTriggered: false,
    hpEvents: [{ id: "cost-1", frame: 54, order: 0, kind: "suffusion" }],
    events: [
      { candidateId: "dew-1", templateRole: "dew", launchFrame: 54, frame: 60, snapshotFrame: 60, snapshotId: "snapshot-60", targetId: "enemy", hpReadFrame: 54, hpReadOrder: 1 },
      { candidateId: "torrent", templateRole: "torrent", launchFrame: 54, frame: 57, snapshotFrame: 57, snapshotId: "snapshot-57", targetId: "enemy" },
    ],
    targetContacts: { "dew-1": true, torrent: true },
    snapshots: {
      "snapshot-60": snapshot({ ...neutral, atk: 1000, critRate: .5, critDamage: 1 }, 6),
      "snapshot-57": snapshot({ ...neutral, atk: 2000, critRate: .5, critDamage: 1 }, 6),
    },
    sharedState: { includedSourceFlatDamage: 0 },
  };
}
