# Source-host license inventory

The gcsim source at `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` has the MIT license in `gcsim-MIT.txt`. Preserve its copyright and permission notice when distributing substantial source portions or derived binaries.

The official Go 1.25.0 toolchain supplies its own BSD license and patent notice, copied here from the verified archive. The build uses the toolchain's matching `lib/wasm/wasm_exec.js`; the upstream gcsim copy is not substituted for that runtime.

During the WASM build, license and notice texts from the modules recorded in the binary's Go build metadata are copied to `dist/licenses/dependencies/`. The toolchain's standard-library vendor notices are also preserved in `dist/licenses/go-vendor/` as an inclusive inventory; Go build metadata does not list those packages as third-party modules. Their paths, hashes, module identities, and any modules without discovered license text are recorded in the output manifest. This inventory is an attribution aid, not a conclusion that all distribution conditions have been met. The toolchain archive and Go module cache are build inputs, not intended application assets.

Upstream gcsim also contains game images, a game font, external asset-proxy code, and generated data derived from separate sources. The MIT source license does not establish permission for those underlying resources. This build does not copy the upstream UI or asset service into the published output. Formula/data provenance remains the pinned gcsim source; source execution does not establish independent game verification. Any separately distributed images, fonts, or other upstream resources require their own provenance and license review.
