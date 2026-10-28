# Verified GIDPS Vercel release

This adapter packages the verified application commit, its existing WASM bytes,
public notices and corresponding-source materials. It never runs a deployment,
changes DNS, creates credentials or chooses a new root licence.

Target confirmed by the parent: project `gidps`,
`prj_sJ9g9ekx86oTiizlxalayHtklnxo`, team
`team_C7eBCyezgeOKwho1xfVLcnln`; requested domain `gidps.mixuanda.top`.
The separate old `gi-dps` project and `gi.mixuanda.top` are not targets.

The current published calculation/UI assets are from
`cd7b32ece7bc80fbf359fbea1fc22f5f75d72c94`. The public source manifest is the
deployed version authority. Preparation code is additional,
without changing calculation formulae or the native executables.

Latest release: `dpl_CShp3xkLXJifvkjPHTw6VXXwdZuw`, prepared by
`c8e67408c7c04a628591baaaee789a041df3ff22`, reached READY on 2026-10-22 and is
served at <https://gidps.mixuanda.top>. It includes the verified player entry,
explicit 95/100 level pipeline, frame replay and Durin C2/black-E corrections.
Five targeted public browser paths passed; public HTML/manifests and all five
downloaded corresponding-source archives match the prepared bytes. Both
extracted native source archives rebuilt byte-identically offline; compiler
cache details are recorded in each native receipt. Root licence and the exact
109-path approved integration scope are preserved. The historical reproduction
examples below retain their explicit earlier commit IDs and do not override
the current public source manifest.

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
  --commit fad91ed9471718ceb86b79fa38f50ba39dd40771 \
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
  --commit fad91ed9471718ceb86b79fa38f50ba39dd40771 \
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

## Functional fixes and readable results release

Deployment `dpl_E8oqfP65S69rE5MpUgKtk7hrh3R1` is READY at
<https://gidps.mixuanda.top>. Application commit is
`ed0763bb7445188bcc49d5456251b6f7f22afe85`; its preparation commit is
`3aef57982ffb4ddf271a7a116231fca7047fbc71`. The preceding functional deployment
`dpl_8nSYUi3aikrAJf9cyo2iZqxvQ1gP` published application `416535e` and passed
four public browser workflows: independent single-skill calculations and required
conditions, candidate-to-native-team calculation, legacy-read/Worker plus proxy
checks, and C6 Wanderer initial E with full stance still rejected.

A subsequent actual screenshot exposed light text over white result surfaces.
The current release changes only theme aliases and its browser assertion;
all 45 JS chunks differ only in dependency filenames after normalizing the
actual emitted asset names. The source-host Worker and native binaries are
unchanged. The current public candidate/native-team workflow passes with an
actual text/background contrast check and the same numeric result. This is
separate from a fresh four-workflow run on the current deployment.

The actual user-supplied public UID was read once on the preceding functional
release; its C6 Wanderer E13 panel calculated 8467.628045379934 under explicitly
selected no-absorption conditions. Independent arithmetic gives
8467.628045379935. This is a conditional calculation using real public equipment,
not observed combat or an all-account login. Personal payloads/screenshots remain
outside the repository and distribution.

The current frontend source archive has 1457 files, 6265372 bytes, SHA-256
`7d614c04c5838d29d5ddb08f50f2c44df1b2fc1f7748bf952398c76105b33321`. It covers
789 emitted project inputs, 15 separately required compile-time JSON inputs and
50 related notices. The preceding frontend archive was built in isolation with
reused external dependencies; no new native or no-cache build is claimed.
The limited AGPL scope remains the same 109 constituent source paths; no root
licence was selected and independent components were not uniformly relicensed.

The one complete unit run in this batch was 3134 pass / 79 fail / 1 skipped at
`82908e2`, before the later bounded UI, preset and initial-hit changes. Subsequent
targeted passes do not change that recorded full-run count. Original Golden
files and numerical assertions were retained. Windows was not actually run.

## Actual imported-team and native crit correction release

Deployment `dpl_Ct9orMkfEHPZCX3mD7sehty1f27e` is READY at
<https://gidps.mixuanda.top>. Application commit is
`fad91ed9471718ceb86b79fa38f50ba39dd40771`; preparation commit is
`734327fd8ff69584686c22d5ff4c706f05a04676`. The preceding deployments above are
historical, not this version's identity. No old project, DNS, account session
or repository root licence was changed in this release.

The application preserves actual imported equipment through the current-team
candidate, keeps open editor settings, adds first-screen import shortcuts,
folds detailed curve provenance and corrects Venti E's erroneous forced crit
in both native variants. Known affected old results remain readable, with an
actionable rerun notice; importing them does not recalculate their damage.
The single-skill page's competing teaching/real-character entries still need
further organization. This release does not claim a complete UI or roster.

Five public Chromium checks passed, including desktop/mobile import shortcuts,
a real-character single-skill formula with required-condition controls, and
zero-crit Venti E in both native variants. One fresh authorized public UID read
through the deployed UI completed equipment → current candidate → 120-second
zero-start-energy Classic rotation → 192-hit actor curves. Its total damage is
482051.2794640198 and DPS is 4017.0939955334984, matching the local corrected run;
independent hit arithmetic and all recorded energy transitions have zero error.
The saved draft reopens exactly, and the retained result imports with zero WASM
requests. This three-Anemo/one-Dendro acceptance team does not test damaging
reactions or all characters. Private player payloads and screenshots are not
in the published build or source archives.

Both newly distributed pruned native source archives were extracted and rebuilt
offline, byte-identically, with the pinned official toolchains and existing
compile cache. The frontend source archive also passed `npm run build` after
fresh extraction, with local workspace aliases and reused external dependencies.
No no-cache/hermetic reproduction is claimed. Nine public HTTPS checks matched
the prepared page, both native manifests, all five source-archive hashes and
the unchanged approved scope of 109 original integration paths.

The final full unit run was 3196 pass / 79 fail / 1 skipped, 3276 total, on an
immutable `924edf6` checkout. Its production code is identical to application
`fad91ed`; their sole difference is a negative test fixture's type construction,
separately verified 9/9 plus typecheck. Of the 79 failures, 78 remain previously
recorded failures; the additional 71-required-fields schema test exceeded its
own 15-second budget at 16.47 seconds. The unchanged assertion passed in isolation
at 12.83 seconds. Its separate pass does not change the recorded full-run count.
No Golden or numerical assertion was weakened. The earlier 2907/86 and 3134/79/1
records remain separate. Windows was not actually run.
