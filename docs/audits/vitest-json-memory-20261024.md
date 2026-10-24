# Vitest startup memory: JSON SSR transform diagnosis (2026-10-24)

## Result and scope

The only functional change in this investigation is in `vitest.config.ts`:

```ts
json: { stringify: true, namedExports: false },
```

This is a test-infrastructure optimization. It does not change production Vite configuration, game data, schemas, Golden fixtures, business results, assertions, timeouts, test selection, or isolation.

After the change, `held-finite-source-batch.test.ts`, previously killed during imports, completed successfully. A four-file group including it passed **41/41 tests**; `conditioned-basic-action-mappings.test.ts` separately passed **1/1**. **These are not claims that the entire unit suite or release validation passed.** Two earlier full-suite attempts terminated with exit 137 around file 246 without final JSON reports; neither counts as a completed run.

## Identified amplification path

Installed versions: Vite **8.1.5**, Vitest **4.1.10**, Rolldown **1.1.5**. Vite's default JSON settings are `namedExports: true, stringify: "auto"`. The installed `vite/dist/node/chunks/node.js` implementation shows:

- The SSR `transformRequest` path enables its JSON shortcut only when `json.stringify === true && json.namedExports !== true`.
- `ssrTransformJSON` replaces the default-export assignment while retaining `JSON.parse(...)`.
- Otherwise, `ssrTransformScript` calls `parseAstAsync`, walks a JavaScript AST, and generates a sourcemap.

Relying on `stringify: "auto"` alone does not select this SSR shortcut. The gain is therefore not merely removing a few named exports: it avoids another complete JavaScript AST and mapping pass over large JSON data. Both settings are [officially supported Vite JSON options](https://vite.dev/config/shared-options#json-namedexports).

## Reproducible A/B

The experiment transforms only the active snapshot's `catalog.json`, `evidence-v1.json`, and `supplemental.json`, sequentially, through the actual Vite SSR pipeline. Each variant runs in a fresh Node process with the same heap limit, without business initialization or other tests:

```sh
node --max-old-space-size=768 scripts/diagnose-vitest-json-memory.mjs default
node --max-old-space-size=768 scripts/diagnose-vitest-json-memory.mjs optimized
```

The script does not edit source data or application configuration. After each transform, it deeply compares the default export with the original `JSON.parse` result and compares `JSON.stringify` output to verify property enumeration order. Linux `maxRSSKiB` reports actual peak process RSS, not the V8 heap size.

Original measurements for snapshot `953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`:

| Metric | Default settings | Explicit stringify / no named exports |
| --- | ---: | ---: |
| Peak process RSS | 679,576 KiB | 210,092 KiB |
| catalog transform | 542.7 ms | 49.7 ms |
| evidence transform | 709.2 ms | 63.2 ms |
| supplemental transform | 63.2 ms | 18.2 ms |
| Generated sourcemaps, three files combined | 17,323,308 bytes | 0 bytes |
| Default export equals original data | 3/3 | 3/3 |

Peak RSS in this controlled JSON-transform experiment decreased **69.1%**. This is not the reduction in the complete business-test process, which still loads a large TypeScript module graph.

## Import contract and data-equivalence checks

The installed Rolldown TypeScript/JavaScript AST parser scanned **568** source files containing `.json` references, rather than relying on single-line grep:

- There are 246 static JSON imports. Executable project code consumes their default exports.
- The only two namespace imports are in archived upstream TypeScript under `sources/traveler-male-charged-resolution/raw/optimizer`. That archive contains no test files, and those TypeScript modules are not imported by the project's executable graph. They remain unchanged as source evidence.
- All 16 JSON re-exports re-export `default`, not named top-level JSON fields.
- All eight dynamic JSON imports are in generated `manifests/runtime/current.ts` and explicitly consume `.default` afterward.
- Each of **205** distinct existing project-referenced JSON files was transformed by the optimized Vite SSR pipeline. Every default value was `deepStrictEqual` to the original `JSON.parse` result, and every `JSON.stringify` comparison matched. Numbers, fields, arrays, and property enumeration order were preserved. This check took 1.18 seconds with peak RSS of 268,796 KiB.

Original workspace evidence: `/tmp/gidps-json-import-audit.json` and `/tmp/gidps-json-value-equivalence.json`. These temporary files are not durable cross-environment artifacts; the checked-in script provides the minimal independent reproduction.

## Completed tests and measured memory

Every run below retains all assertions and default isolation. RSS was sampled by a parent process observing only its own subprocess tree in the same PID namespace. No unknown process was inspected for termination or killed.

| Run | Result | Vitest duration | Sampled process-tree peak RSS |
| --- | --- | ---: | ---: |
| held, threads / Node heap 768 MiB | 2/2 | 8.41 s | 1,215,648 KiB |
| held, threads / Node heap 384 MiB | 2/2 | 8.01 s | 1,113,640 KiB |
| held + kinich + traveler-zibai + calculator-character-outputs, forks / parent heap 256 MiB / child heap 384 MiB | 4 files, 41/41 | 13.83 s | 1,180,656 KiB |
| conditioned-basic-action-mappings, threads / Node heap 384 MiB | 1/1 | 6.58 s | 1,108,728 KiB |

Four-file command:

```sh
node --max-old-space-size=256 node_modules/vitest/vitest.mjs run \
  packages/sim-core/src/held-finite-source-batch.test.ts \
  packages/sim-core/src/kinich-damage-formulas.test.ts \
  packages/sim-core/src/traveler-zibai-source-batch.test.ts \
  apps/web/src/calculator-character-outputs.test.ts \
  --pool forks --maxWorkers 1 --execArgv=--max-old-space-size=384 \
  --reporter default --reporter json --outputFile /tmp/gidps-four-file.json
```

Four-file report: `/tmp/gidps-json-fast-fork-group.json`. Conditioned report: `/tmp/gidps-conditioned-json.json`. These runs used the existing worktree's business-test repairs; earlier genuine assertion failures must not be mislabeled as memory failures.

## Why total RSS remains approximately 1.1–1.2 GiB

A completion-state diagnostic for conditioned found **696 SSR modules**, caching **44,576,704 bytes** of transformed code and **16,580,454 bytes** of separate maps. Code may also contain inline mappings, so these are not unique-data totals or exact heap-occupancy measurements.

The largest modules include `schema.ts`, `source-host-talent-tables.generated.ts`, `simulator.ts`, `result-integrity.ts`, and the active evidence/catalog JSON. The main isolate's `heapUsed` was approximately 180 MB while total process RSS in threads mode was approximately 1.14 GB. The worker has its own heap; native transforms, code, maps, allocator state, and runtime overhead also consume memory. **`--max-old-space-size` is not an RSS limit. Forks did not reduce total peak RSS in this sample.**

The current cloud host has no swap, and other workloads change available memory. Remaining full-suite validation should run serially in fresh-process groups with an explicit file inventory, preserving every file, isolation, and final reports. This releases accumulated cross-file transform graphs. Preserve original failure evidence, fix the cause, and rerun failed groups. A killed process without a final report does not establish completed coverage. Do not disable isolation, delete tests, weaken assertions, or change Golden data to obtain green results.

This investigation did not change default pools, heap settings, grouping policy, production runtime, or permissions; it did not kill unknown processes, access restricted paths, merge GitHub changes, or deploy.
