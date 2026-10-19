# Fixed source-host build

Run from the repository root with Node.js 22 or newer. No globally installed Go is used.

```sh
node packages/source-host/scripts/prepare-source.mjs
node packages/source-host/scripts/prepare-toolchain.mjs
# Run only after patches and Go bridge sources are frozen:
node packages/source-host/scripts/build-source-host.mjs
```

`prepare-toolchain.mjs` downloads the pinned official Go 1.25.0 archive, verifies its byte count and SHA-256 against `pins.json`, and extracts it into `/tmp/gidps-source-host-cache` by default. It runs only `go version`. The checksums were obtained from the official Go release JSON identified in `pins.json`. macOS and Linux on arm64/amd64 have pinned archives.

The build prepares its source automatically; it no longer depends on task-local `/tmp/gidps-gcsim-b4ae769` or `/tmp/gidps-gcsim-tree.json`. The complete pinned Git tree is retained at `packages/source-host/sources/gcsim-b4ae769-tree.json`. `prepare-source.mjs` downloads the exact commit archive from GitHub into the build cache, checks all 4,021 tracked blobs against that tree, and records the actual archive SHA-256 and byte count. A cached checkout is rechecked against the pinned tree before use. It never follows the upstream default branch. A fresh online checkout needs no manually supplied source files; subsequent source preparation can use the verified cache offline (uncached Go modules or toolchains still need the network).

After the source lanes are frozen, build both artifacts before generating the shared talent-table registry and running the Web build:

```sh
npm run source:build
npm run source:build:stellar
npm run source:talent-registry
npm run build
```

The registry generator verifies both lane manifests and generates the checked-in TypeScript lookup data from the matching read-site/table registries. The site coordinates refer to the patched source before instrumentation; they are not upstream-original coordinates. Preserve an older registry when changing/instrumenting read sites so captures made with that registry retain resolvable site identities.

Direct `TalentLvlAttack`, `TalentLvlSkill`, and `TalentLvlBurst` indices also record the original getter inputs in optional `indexSources`. The wrapper invokes the original getter once; the shared calculator then replays its base talent, applicable passive tag, constellation bonus, and index arithmetic. `talentLevelIndices` in the fixed site registry identifies which index positions have these getters. Older receipts without this metadata remain readable and retain their unexplained-index gap. This does not establish the lifecycle that activated a passive tag or the source of other dynamic indices.

Generated-table rows selected by a provable local `range` binding carry the actual outer indices and iteration index into the scalar receipt. Supported uses include an `AttackInfo` literal and a simple `Mult` assignment to a known local `AttackInfo` value or copy. The build records `rangeSource` in the site registry and `rangeFrame` in the runtime receipt; the latter is distinct from the final scalar-read frame for delayed callbacks. The original range operand and local row are each read at their original position. Ambiguous bindings, row/key writes, unsupported nested ranges, and later `Mult` writes remain in the skipped inventory.

The build checks the complete tree snapshot hash and every tracked file's Git blob identity, exports only those files into a fresh cache directory, applies `packages/source-host/patches/*.patch` in lexical order, and copies `packages/source-host/go/` into that exported source. The fixed upstream directory remains unchanged. `--source-dir` still accepts an explicitly supplied working tree and checks the same pinned identities. Neither a successful download nor a matching source hash promotes mechanics to game-verified status.

It invokes `GOOS=js GOARCH=wasm go build -mod=readonly -trimpath -buildvcs=false ./cmd/sourcehost` once, with an absolute path to the pinned Go executable, private Go caches, and automatic toolchain switching disabled. Go may download dependencies through the official module proxy and verify them against the Go checksum database. The script does not execute WASM, simulations, or tests. It then reads the binary's Go module metadata and the linked modules' license/notice texts. Go 1.25's `go version -m` reader does not recognize WASM, so the script extracts the embedded `runtime.modinfo` string using the exact sentinels from that toolchain's `src/cmd/go/internal/modload/build.go`; it does not invoke the binary to obtain metadata.

Artifacts go to `packages/source-host/dist/`: `source-host.wasm`, the matching Go `wasm_exec.js`, `manifest.json`, `go-build-info.txt`, `source-files.json`, and `licenses/`. The manifest records source identities, patch and bridge hashes, build scripts, toolchain archive and executable hashes, artifact hashes/sizes, linked module identities, and collected license texts. Missing dependency license texts are recorded explicitly rather than treated as cleared. No game verification is implied by a successful build.

After the build and provenance collection succeed, the same invocation generates `inventory-metadata.json` from the same original pinned source and records its hash in the artifact manifest. It then copies `source-host.wasm`, `wasm_exec.js`, `manifest.json`, `inventory-metadata.json`, and the complete `licenses/` directory into `apps/web/public/source-host/`. The public and dist files come from the same staged output. The larger per-source-file inventory and raw Go build metadata remain in dist; their hashes are retained in the shared manifest.

`sourceInventory.registeredSourcePackages` records the actual blank imports from the pinned `imports.character.dm.go`, `imports.weapon.dm.go`, and `imports.artifact.dm.go`, including original source lines and counts. These are Go package registrations, not canonical game IDs, a latest-release roster, or evidence that every source implementation is supported or verified. Each has scope `source-implemented-not-game-verified`. The manifest separately lists supported formula families and unresolved limitations; it does not infer blanket character rejection from TODO text. The normal source-simulation page searches all registered packages, exposes exact parser configuration keys with file/line evidence, and lists explicit source TODO markers. The source metadata generator follows actual registration, catalog and parser mappings rather than guessing keys from directory names.

Optional path overrides: `--cache-dir`, `--source-dir`, `--tree-file`, `--patch-dir`, `--bridge-dir`, `--output-dir`, `--public-dir`; each takes one path. Dist and public output paths can be overridden independently. Toolchain preparation accepts only `--cache-dir`; source preparation accepts `--cache-dir` and `--tree-file`. The source revision/tree hash and compiler version remain fixed by `pins.json`.

The retained fresh build directory permits inspection after a failed build. Fix the actual failure before rebuilding; this script has no automatic build retry.
