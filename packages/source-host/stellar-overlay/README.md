# Versioned Stellar source host

This is a separate Go/WASM mechanics host for the archived gcsim commit
`a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`. It does not alter the
`b4ae769` host or its MIT attribution. The a7 source is AGPL-3.0-or-later;
its original `LICENSE` and `LICENSE-MIT`, the Go license, bundled Go notices,
and linked module licenses are copied beside this artifact. Keep the a7 source
identity and license visible when distributing or serving the binary.

`node packages/source-host/stellar-overlay/build.mjs` verifies the pinned a7
archive, all 4,283 tracked Git blobs, the isolated patch, and the official
Go 1.27.1 archive before building. It writes a separate manifest, WASM, and
licenses to `packages/source-host/stellar-overlay/dist/` and mirrors the
runtime files to `apps/web/public/source-host-stellar/`. A cached source and
toolchain work offline. Optional `--source-dir` and `--toolchain-dir` inputs
still verify the full source tree and compiler version; the default path also
checks both downloaded archive hashes. The regular b4 patch directory is
never used by this build.

The a7 mechanics engine chooses reaction conversion, live aura owners,
character actions, gadgets, field state, and native critical draws. Its
Stellar Swirl contributor, ranking, final delivery, direct Stellar damage,
and non-damaging Stellar-Conduct event call the synchronous shared TypeScript
formula resolver. A resolver rejection stops the run; there is no Go numerical
fallback. Every a7 request carries `sourceCommit` and the result records the
exact WASM hash. Ordinary and Lunar source calls on this host use the same
boundary, with a7 source references in their traces.

Run the focused archived-source examples with:

```sh
node packages/source-host/stellar-overlay/smoke.mjs packages/source-host/stellar-overlay/example.gcsl
node packages/source-host/stellar-overlay/smoke.mjs packages/source-host/stellar-overlay/conduct-example.gcsl
```

The saved [execution receipt](validation/smoke-20260927.json) covers actual
Swirl contributor/rank/delivery, direct Stellar, and Conduct field events.
Both example builds use hypothetical stats. This is source-assumed execution,
not independent game verification. The archived Swirl source retains its
`1 → 3 → 7` counter update, gadget type mismatch, 181-frame lifetime, and
range conflicts with the guide; the overlay executes that source behavior
without silently replacing it with guide rules. Frozen contributor, spatial,
and all-character ability completeness remain outside this focused receipt.
