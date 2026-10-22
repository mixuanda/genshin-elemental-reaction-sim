# Local Vercel release preparation

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
  --classic-source CLASSIC_MODIFIED_TREE \
  --stellar-source STELLAR_MODIFIED_TREE \
  --rebuild-receipt NATIVE_COMPARISON_JSON
node deployment/vercel/prepare.mjs STAGE_DIRECTORY SOURCE_DIRECTORY
node --test deployment/vercel/showcase-proxy.test.mjs
```

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

## Pending release gate

`readiness.json` and `source-distribution.json` deliberately say
`publishReady: false`. The modified Stellar AGPL program passes synchronous
callbacks into the shared TS resolver. Providing the source archives and
upstream notices does not, by itself, settle the original-code combined-work
licensing boundary. No root licence was selected. The parent must resolve this
existing maintainer decision and coordinate the final release. Do not silently
remove Stellar, relabel original code, or publish these draft materials as
already legally cleared. Preview data/provider and game text rights remain
separate from software-code licences.

Once those conditions are resolved, the exact intended command is:

```sh
vercel deploy --prebuilt --archive=tgz --prod --skip-domain \
  --cwd STAGE_DIRECTORY --scope mixuandahotmailcoms-projects \
  --meta gidpsApplicationCommit=7d3289b06735a24b81b71e64104345d4b8881264
```

Then inspect and smoke-test that production deployment before the parent
promotes it. Do not use `--public`, change protection, create tokens, push a
branch merely to deploy, or target the old project. The existing authenticated
Vercel connector successfully read the new project; upload/create-deployment
operations have not been attempted. No local `vercel` CLI was present at this
preparation check; installing one does not transfer connector authentication.

The uncompressed prepared output is about 198 MB; an internal equivalent `.tgz`
upload was measured around 42 MB. Do not send that archive to the user. Keep it
as internal staging only, and verify applicable upload limits before release.

References: [Build Output API](https://vercel.com/docs/build-output-api),
[Node primitives](https://vercel.com/docs/build-output-api/primitives),
[prebuilt archive upload](https://vercel.com/docs/cli/deploy#prebuilt),
[AGPL terms](https://spdx.org/licenses/AGPL-3.0-or-later.html).
