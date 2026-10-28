// Character correctness patches whose Go implementation is shared by both pins.
// Stellar consumes this list; Classic's configurable patch directory must contain
// each entry exactly once. Add a cross-pin source check before extending it.
export const sharedCharacterFixes = Object.freeze([
  '137-wanderer-c2-burst-snapshot-scope.patch',
]);

export function assertSharedCharacterFixes(patches) {
  for (const name of sharedCharacterFixes) {
    if (patches.filter(patch => patch === name).length !== 1) {
      throw new Error(`Shared character fix must be selected exactly once: ${name}`);
    }
  }
}
