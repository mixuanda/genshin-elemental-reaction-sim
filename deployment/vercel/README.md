# Verified GIDPS Vercel release

This adapter packages the verified application commit, its existing WASM bytes,
public notices and corresponding-source materials. It never runs a deployment,
changes DNS, creates credentials or chooses a new root licence.

Target confirmed by the parent: project `gidps`,
`prj_sJ9g9ekx86oTiizlxalayHtklnxo`, team
`team_C7eBCyezgeOKwho1xfVLcnln`; requested domain `gidps.mixuanda.top`.
The separate old `gi-dps` project and `gi.mixuanda.top` are not targets.

The application's calculation/UI assets are from
`7d3289b06735a24b81b71e64104345d4b8881264`. Preparation code is additional,
without changing calculation formulae or the native executables.

## Preparation

Keep dependency receipts from the pinned official Go toolchains:

```sh
go list -buildvcs=false -mod=readonly -deps -json ./cmd/sourcehost
```

Use `GOOS=js GOARCH=wasm CGO_ENABLED=0`, the correct pinned Go compiler for
each variant, an explicit writable `GOCACHE`/`GOMODCACHE`, `GOENV=off`,
`GOWORK=off`, `GOTOOLCHAIN=local`, and `GOPROXY=off` for the retained cache.
Save the two JSON streams as `classic-deps.json` and `stellar-deps.json`.

`package-source.py` reads the verified Git commit for TS/build inputs and
retained, manifest-checked native source trees. It includes every selected Go
package's sources and embeddings, original licences and the pinned dependency
source cache. Unrelated upstream UI/fonts/images, personal fixtures, private
reports, test traces, authentication files and sourcemaps are excluded.

```sh
python3 deployment/vercel/package-source.py \
  --output SOURCE_DIRECTORY --evidence EVIDENCE_DIRECTORY \
  --commit 7d3289b06735a24b81b71e64104345d4b8881264 \
  --classic-source CLASSIC_MODIFIED_TREE \
  --stellar-source STELLAR_MODIFIED_TREE \
  --bundle-inventory MAIN_MODULES_JSON \
  --bundle-inventory SIMULATION_WORKER_MODULES_JSON \
  --bundle-inventory ANALYSIS_WORKER_MODULES_JSON \
  --bundle-inventory LUNAR_WORKER_MODULES_JSON \
  --bundle-inventory SOURCE_HOST_WORKER_MODULES_JSON \
  --rebuild-receipt NATIVE_COMPARISON_JSON
node deployment/vercel/prepare.mjs STAGE_DIRECTORY SOURCE_DIRECTORY
node --test deployment/vercel/showcase-proxy.test.mjs
```

Pass the retained emitted-module inventories for the main build and every
worker. Project paths are read from the specified immutable Git commit;
inventories do not authorize copying files from another checkout. If a retained
inventory records an additional checkout root, add
`--inventory-source-root RECORDED_ADDITIONAL_CHECKOUT_ROOT` explicitly. The
packager refuses unmapped roots, untracked project inputs and excluded emitted
inputs. It also includes the pinned release's separately observed compile-time
JSON imports and their original source-family notices. The coverage receipt is
`project-source-coverage.json`.

To rebuild only the project source archive without inspecting or repackaging
native trees or Go dependencies:

```sh
python3 deployment/vercel/package-source.py \
  --project-only --output PROJECT_SOURCE_DIRECTORY \
  --commit 7d3289b06735a24b81b71e64104345d4b8881264 \
  --bundle-inventory MAIN_MODULES_JSON \
  --bundle-inventory SIMULATION_WORKER_MODULES_JSON \
  --bundle-inventory ANALYSIS_WORKER_MODULES_JSON \
  --bundle-inventory LUNAR_WORKER_MODULES_JSON \
  --bundle-inventory SOURCE_HOST_WORKER_MODULES_JSON
```

This mode writes `gidps-build-inputs.tar.gz` and the coverage receipt, leaving
full distribution manifests and deployed archives untouched. Verify a fresh
extraction with the archive's `npm run build` (typecheck followed by Vite), with
all workspace aliases resolving inside that extraction. An existing external
dependency installation may be reused through an isolated local overlay;
do not link workspace packages back to another checkout. Inventory coverage
alone is not evidence of a successful frontend rebuild. Reusing installed
dependencies is not a hermetic/no-cache rebuild, and deduplicating checkout
paths does not establish byte identity with historical bundles.

The output is `.vercel/output/{config.json,static,functions}`. The only
server function is a bounded public-showcase GET proxy; it has no sessions,
account login, tokens, database, retries or player-payload logging. It respects
upstream TTL, including zero, and uses a bounded transient cache.

To rebuild either provided native tree after unpacking its archive and
`go-dependencies.tar.gz`:

```sh
GOTOOLCHAIN=local GOENV=off GOWORK=off GOOS=js GOARCH=wasm CGO_ENABLED=0 \
GOCACHE=WRITABLE_CACHE GOMODCACHE=UNPACKED_MODULES GOPROXY=off \
PINNED_GO build -mod=readonly -trimpath -buildvcs=false -o source-host.wasm ./cmd/sourcehost
```

Classic uses Go 1.25.0; Stellar uses Go 1.27.1. Official archive/compiler
identities and original build information remain in each shipped manifest.
The recorded preparation rebuilds were offline and byte-identical using the
existing Go compile cache, not a clean-room/no-cache reproducibility claim.

## Limited release authorization

The maintainer approved AGPL publication of the modified Stellar program and
its necessary constituent original integration. The exact original files are
identified by source path and SHA-256 in `stellar-integration-scope.json`,
derived from actual nonzero rendered source-host Worker modules. All emitted
application assets were byte-identical to the verified build. Third-party
Zod modules retain MIT; independent original components are not uniformly
relicensed and no root licence is selected. The release statement and full
AGPL terms accompany the source archives and are visibly linked on the page.
Game data/provider rights are not overridden by a software-code licence.

The prepared output can be deployed by an already authorized CLI identity:

```sh
vercel deploy --prebuilt --archive=tgz --prod --skip-domain \
  --cwd STAGE_DIRECTORY --scope mixuandahotmailcoms-projects \
  --meta gidpsApplicationCommit=7d3289b06735a24b81b71e64104345d4b8881264
```

The cloud CLI identity could not access this team (`scope-not-accessible`), so
that route was stopped. No login, new token, protection change or scope change
was made. The existing authenticated Vercel connector successfully uploaded and
deployed the same verified output instead:

```sh
node deployment/vercel/make-upload.mjs STAGE_DIRECTORY NEW_UPLOAD_DIRECTORY
```

Upload only `upload-parts.json`, `install-prebuilt.mjs`, `package.json`,
`vercel.json` and the manifest's listed `.part` files through the file-upload
API using their exact SHA-1 and byte length. Create a deployment in the exact
new project with those uploaded file references, `target: "production"`,
`framework: null`, `nodeVersion: "24.x"`,
`buildCommand: "node install-prebuilt.mjs"`,
`installCommand: "echo verified-prebuilt-no-dependencies"`, and no output
directory override. The installer verifies every part and the complete archive
before restoring `.vercel/output`; it does not rebuild the app or native code.
Do not upload a recursive directory listing or the duplicate `prebuilt.tgz`.

Deployment `dpl_B6EQizvfhMtyjmwujGXyMS7FVLCw` reached `READY` on 2026-10-22.
Vercel automatically assigned the verified custom domain
<https://gidps.mixuanda.top>. The old project/site was not mutated. Its exact
application commit is confirmed by the public source manifest, matching index
bytes, native artifact hashes, and the retained Vercel build log. Vercel's
returned metadata object is empty; do not use metadata as commit evidence.

Public Chromium checks passed 3/3: direct routes and the six-hit calculation
Worker; Classic and Stellar native runs with 15 applications each, total
8918.12930387573, integral frames and zero-difference representative E/Q replays.
The two native execution hashes match the shipped manifests. Five public
corresponding-source archives were downloaded and hash-verified. A single
request for Enka's documented sample UID returned HTTP 200 and four showcase
characters. This does not implement account login or all-owned-character sync.

```sh
GIDPS_VERCEL_URL=https://gidps.mixuanda.top npm run test:e2e -- \
  --config playwright.vercel-artifact.config.ts
```

In this managed cloud environment, tests use the existing HTTPS proxy and an
explicit `GIDPS_BROWSER_CA_SPKI` pin for that environment's public proxy CA;
there is no blanket `ignoreHTTPSErrors`. Python HTTPS checks also passed with
the existing trusted system CA bundle. The first browser run failed before
calculation because its proxy/CA setup was missing; that failure is retained.
Windows and other real user browser environments have not been tested here.
This bounded release smoke test does not replace the separate older full-suite
baseline of 2907 pass / 86 fail or remove visible provisional model limits.

The uncompressed prepared output is about 198 MB; an internal equivalent `.tgz`
upload was measured around 42 MB. Do not send that archive to the user. Keep it
as internal staging only, and verify applicable upload limits before release.

References: [Build Output API](https://vercel.com/docs/build-output-api),
[Node primitives](https://vercel.com/docs/build-output-api/primitives),
[prebuilt archive upload](https://vercel.com/docs/cli/deploy#prebuilt),
[AGPL terms](https://spdx.org/licenses/AGPL-3.0-or-later.html).
