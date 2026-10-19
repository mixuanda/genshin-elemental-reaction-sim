# Healing source focused replay — 2026-09-28

This records the focused core check already executed after fixing the healing capture support-ID comparison and direct producer-to-Caller check. It did not run a web build or browser flow.

Command, run from `/Users/evan/Documents/gidps`:

```sh
./node_modules/.bin/vitest run packages/sim-core/src/__tests__/tmp-healing-source-capture.test.ts
```

Exact command output:

```text
 RUN  v4.1.10 /Users/evan/Documents/gidps


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  18:07:35
   Duration  5.85s (transform 248ms, setup 0ms, import 331ms, tests 5.45s, environment 0ms)
```

Exit code: `0`. The saved raw result contained 54 healing applications. The single test iterated over every application, captured it, replayed that capture, and checked exact original/reproduced amount and overheal equality. The input was `docs/validation/source-healing-sources-classic-scene1-20260928.result.json`.

Temporary test source used for that execution:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { captureSourceHostHealing, replaySourceHostHealing } from "../source-host-healing-capture";

test("saved classic scene replays each native healing source capture", () => {
  const result = JSON.parse(readFileSync("docs/validation/source-healing-sources-classic-scene1-20260928.result.json", "utf8"));
  const apps = result.healingApplications as Array<{ id: number }>;
  expect(apps.length).toBeGreaterThan(0);
  for (const app of apps) {
    const capture = captureSourceHostHealing(result, app.id);
    const replay = replaySourceHostHealing(capture);
    expect(replay.reproducedAmount).toBe(replay.originalAmount);
    expect(replay.reproducedOverheal).toBe(replay.originalOverheal);
  }
});
```

The temporary test file `packages/sim-core/src/__tests__/tmp-healing-source-capture.test.ts` was removed after the run. No tests were rerun while writing this record.
