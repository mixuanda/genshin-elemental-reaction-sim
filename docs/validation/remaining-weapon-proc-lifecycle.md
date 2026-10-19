# Remaining weapon lifecycle validation

Command: `npx vitest run packages/sim-core/src/__tests__/remaining-weapon-proc-lifecycle.test.ts`

Final run: 2026-09-24 22:58:12 Asia/Hong_Kong. Exit 0, 1 file / 3 tests passed; duration 1.62s, tests 615ms. Raw output: `remaining-weapon-proc-lifecycle.log`; exit: `remaining-weapon-proc-lifecycle.exit`.

Focused coverage:

- Viridescent nine source offsets; trigger-time snapshot and circle survive buff expiry and switching out; moving secondary target leaves the fixed circle; first/last delivered captures round-trip through JSON and shared damage replay. Random steady-state blocker remains present.
- Sword actual delayed snapshot and moving origin; off-field delivery after a successful on-field trigger; explicit innate Arkhe exclusion; inclusive cooldown; unsampled task in a genuine periodic input checkpoint; pending task beyond the observation horizon retains null snapshot/centre. Eye source-conflict blocker remains explicit.
- Sameframe Sword/Viridescent callback collision: replay retains actual FIFO when the delayed Sword task creates a new hit after a prequeued Viridescent callback. A forged task sequence is rejected.

Earlier runs of the same file are preserved rather than hidden. They failed on test-fixture assumptions, not a discovered production mismatch: initial run requested a checkpoint with unsupported target motion; second expected a buff's expiry to count as a queued-task horizon; third used a duration below the schema's one-second minimum; fourth had too little future input; fifth used a single legal timeline without repeating its driver. The final fixture uses the existing `repeatLegalTimelineForDuration` helper with a finite four-second input and retains a separate one-second pending-task observation. Raw files are `remaining-weapon-proc-lifecycle.initial`, `.second`, `.third`, `.fourth`, `.fifth` with `.log` / `.exit` suffixes (each exit 1).

No external simulator, performance suite, per-character suite or build was run in this subtask. The parent task subsequently completed the combined typecheck and production build: exit 0, command duration 2.833s, 425 modules, Vite 418ms. See the [final build log](continuation-modules-build.final.log) and [exit record](continuation-modules-build.final.exit). This later result does not change the five fixture failures retained above.
