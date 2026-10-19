# Bond of Life focused validation

Date: 2026-09-24 (Asia/Hong_Kong).

Scope: the explicit `gcsim-b4ae769-same-heal-remainder-v1` generic resource. This remains fixed-source-assumed, including the source TODO about same-heal remainder. No game verification is claimed.

Only the new focused file was run:

```sh
npx vitest run packages/sim-core/src/__tests__/bond-of-life-runtime.test.ts
```

Final result: 1 file, 3 tests passed; exit 0; start 23:45:05; Vitest duration 1.12 s (tests 161 ms). Raw output: `bond-of-life-runtime.log`; captured command exit: `bond-of-life-runtime.exit`.

The three cases cover shared AST cap and callback rules, healing remainder and overheal; actual self/active/party transitions with JSON reproduction and independently rejected forged debt/end-state values; and current debt plus pending delayed healing in an actual periodic-boundary checkpoint, including an initialized pool with no health events.

The initial run at 23:42:35 had 1 pass and 2 failures (1.02 s; exit 1). Both failed during config validation because the new fixture omitted the explicit positioned enemy target required by the existing player-HP mode. Only that fixture was amended, then this same file was rerun. Its unmodified raw output and exit remain in `bond-of-life-runtime.initial.log` and `bond-of-life-runtime.initial.exit`.

No build, external simulator, character suite, weapon suite, full test suite, or performance check was run for this subtask. Integration build and browser coverage belong to the parent task.
