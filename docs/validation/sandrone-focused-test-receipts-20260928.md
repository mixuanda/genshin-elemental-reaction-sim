# Focused test receipts — 2026-09-28

These are transcriptions of command outputs returned in this task. The commands did not write persistent logs. No broad test, generator, or build was run by this agent.

## Observed plunge family

Command: `npx vitest run packages/game-data/src/character-mappings/optimizer-observed-plunge.test.ts`

```text
RUN  v4.1.10 /Users/evan/Documents/gidps
Test Files  1 passed (1)
Tests       1 passed (1)
Duration    2.72s (transform 2.05s, setup 0ms, import 2.65s, tests 12ms, environment 0ms)
```

## Sandrone ordered reducer, initial run

Command: `npx vitest run packages/sim-core/src/sandrone-observed-lifecycle.test.ts`

```text
RUN  v4.1.10 /Users/evan/Documents/gidps
Test Files  1 passed (1)
Tests       1 passed (1)
Duration    272ms (transform 129ms, setup 0ms, import 208ms, tests 2ms, environment 0ms)
```

## Transient concurrent import gap after adding the binding case

Command: `npx vitest run packages/sim-core/src/sandrone-observed-lifecycle.test.ts`

```text
RUN  v4.1.10 /Users/evan/Documents/gidps
FAIL  packages/sim-core/src/sandrone-observed-lifecycle.test.ts [ packages/sim-core/src/sandrone-observed-lifecycle.test.ts ]
Error: Cannot find module './nefer-observed-lifecycle' imported from /Users/evan/Documents/gidps/packages/sim-core/src/source-cast-context.ts
 ❯ packages/sim-core/src/source-cast-context.ts:6:1
      6| import { prepareNeferObservedDocument } from "./nefer-observed-lifecyc…
Test Files  1 failed (1)
Tests       no tests
Duration    334ms (transform 185ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

The referenced Nefer module was being added concurrently; this run collected no Sandrone tests. It is an import/setup receipt, not an assertion failure.

## Sandrone ordered reducer and binding, after module arrival

Command: `npx vitest run packages/sim-core/src/sandrone-observed-lifecycle.test.ts`

```text
RUN  v4.1.10 /Users/evan/Documents/gidps
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    3.24s (transform 2.46s, setup 0ms, import 3.18s, tests 5ms, environment 0ms)
```

The final source review removed the ordinary no-Radiance prism Heat gate after this run. Root owns the subsequent integrated build and page validation.
