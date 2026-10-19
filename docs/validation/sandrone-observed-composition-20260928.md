# Sandrone observed composition — focused validation receipt

Date: 2026-09-28. These are outputs already observed during implementation; this receipt did not trigger another test or build.

Command on each attempt:

```sh
npx vitest run packages/sim-core/src/sandrone-observed-composition.test.ts
```

The first attempt collected **0 tests** and exited 1 because `observed-skill-composition.ts` imported `./linnea-observed-composition` before that parallel module existed. This was a module-import failure, not a Sandrone assertion failure. The focused test was changed to use a type-only shared-contract import so it could run independently.

The first successful attempt reported **1 test file passed, 1 test passed**, duration **3.12 s**. After making missed opportunities valid without an unused damage snapshot, the same focused command reported **1 test file passed, 1 test passed**, duration **3.13 s**, exit 0. The last output was:

```text
RUN  v4.1.10 /Users/evan/Documents/gidps

Test Files  1 passed (1)
     Tests  1 passed (1)
  Duration  3.13s (transform 2.37s, setup 0ms, import 3.06s, tests 5ms, environment 0ms)
```

The focused assertion checks an observed start/end window, a Stellar-Conduct beam contact, a missed beam opportunity, exclusion of an E prism shot from charged damage, exact single-hit binding, and rejection of binding that replacement beam to its ordinary source document. This is local contract coverage; it does not validate game timing, attack counts, or the user's actual event observations.
