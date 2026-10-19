# Native phase analyzer focused validation — 2026-09-28

The focused command was run twice from `/Users/evan/Documents/gidps`:

```sh
./node_modules/.bin/vitest run packages/sim-core/src/source-host-phase-analysis.test.ts
```

| Run | Result | Vitest duration | Purpose |
| --- | --- | --- | --- |
| 1 | 1 file passed; 4/4 tests passed | 107 ms | Analyzer and initial bounded-startup coverage behavior. |
| 2 | 1 file passed; 4/4 tests passed | 112 ms | Narrow correction for the first unverified native marker and alternating period-2 input signatures. |

The first Vitest receipt reported `Test Files 1 passed (1)`, `Tests 4 passed (4)`, `Start at 21:22:05`, and `Duration 107ms`. The second reported the same pass counts, `Start at 21:28:37`, and `Duration 112ms`. Both commands exited with code 0.

The test fixture in `packages/sim-core/src/source-host-phase-analysis.test.ts` constructs **synthetic observations** with ten declared provider keys. Its positive case uses alternating normalized character energy and input signatures over five boundaries, with two equal 20-frame, 100-damage periods. Other cases check that equal damage does not hide a changing state path; coverage gaps, an unverified candidate input phase, stochastic observations, and unequal elapsed frames do not establish a phase. The startup-prefix case has an unverified, incomplete first observation and only establishes a result after later declared coverage is complete.

These tests verify the pure analyzer's conditional logic. The positive fixture is **synthetic declared-provider evidence**, not a native steady-state proof. Actual native proof still depends on the Go observer's truthful future-state coverage and input-phase provenance in one continuous run. No build or full test suite was run by this analyzer task.
