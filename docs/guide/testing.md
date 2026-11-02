# Testing

## Standard checks

Run expensive checks sequentially on constrained machines:

```sh
npm run check:workspace
npm run test:unit
npm run test:performance
npm run typecheck
npm run data:check
npm run build
```

`test:unit` excludes the dedicated performance file; `test:performance` runs that file separately. A complete acceptance report must account for both rather than silently losing performance coverage.

Browser regression scripts are available as `npm run test:e2e` and `npm run test:e2e:calculator`. Use the browser workflow authorized for the execution environment. Automated assistants with a mandated cloud-browser API must use that API for UI work instead of launching an alternate browser driver. Test discovery alone does not validate UI behavior.

## Memory-limited unit runs

Vitest uses JSON default exports without generating large named-export modules. The configuration preserves JSON values and key order; [the memory audit](../audits/vitest-json-memory-20261024.md) records the equivalence checks and measured limits.

A focused bounded command is:

```sh
node --max-old-space-size=256 ./node_modules/vitest/vitest.mjs run \
  packages/sim-core/src/held-finite-source-batch.test.ts \
  --pool forks --maxWorkers 1 --execArgv=--max-old-space-size=384 \
  --reporter default --reporter json --outputFile /tmp/gidps-focused.json
```

For full coverage, enumerate every configured unit-test file, exclude only the separately scheduled performance test, and run small non-overlapping groups in fresh processes. Keep isolation, timeouts, and assertions unchanged. Verify the union of reported files against the input manifest. Record process termination separately from assertion failures.

Heap limits are not resident-memory limits: transformed modules, source maps, workers, and native allocations contribute additional memory. Monitor progress and stop the batch on infrastructure failure instead of treating missing reports as passes.

## Reporting

Record the exact commit, any uncommitted patch, command, test counts, failures, and report paths. Focused passes are not a full-suite pass. Verify unit tests, performance, typecheck, data checks, build, required CI, and browser acceptance on the intended final revision before release approval.
