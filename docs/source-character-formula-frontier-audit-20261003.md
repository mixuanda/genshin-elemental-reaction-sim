# GIDPS-132 current patched-source audit

## Result

No new character numeric `Amount` formula batch is supported by the supplied latest patched trees. Do not merge a 132 formula patch into the current build. This is a current-source audit, not an implementation patch; no source or registry file was changed.

The five literal slot rules from the earlier candidate are already present in the current registry and patch set:

| Rule ID | Source formula | Registry and stat index | Existing upstream bridge patch |
| --- | --- | --- | --- |
| `char-vector-kaeya-c1-cr` | Kaeya C1 CR = 0.15 | `source-host-character-vector-group-b.ts`, CR index 9 | `035-character-vector-b.patch` |
| `char-vector-kinich-c1-cd` | Kinich C1 CD = 1 | group B, CD index 10 | patch 035 |
| `char-vector-kinich-c4-dmgp` | Kinich C4 DmgP = 0.7 | group B, DmgP index 21 | patch 035 |
| `char-vector-navia-a1-dmgp` | Navia A1 DmgP = 0.4 | group B, DmgP index 21 | patch 035 |
| `char-vec-yanfei-c2` | Yanfei C2 CR = 0.20 | `source-host-character-vector-group-d.ts`, CR index 9 | `037-character-vector-d.patch` |

These indices were cross-checked against the source registry descriptors and `attributes` assignments in the pinned patched sources. The original callbacks still perform their predicates and write the resulting scalar at the original slot. Existing Stellar build code explicitly records the 034–037 vector patch files in `packages/source-host/stellar-overlay/build.mjs`; there is no Stellar registration change to hand off for this already-integrated batch.

## Current tree identities and callback inventory

The audited roots are the retained outputs named in the request:

- Classic: `/Users/evan/Library/Caches/gidps-source-host/build-voBklW/source`, source revision `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`, source tree snapshot SHA-256 `15965fb70c98aba229279056e9dc98a4ce2c042919135b807e5cbcb1651f0ad7`, 4,021 verified blobs. Manifest SHA-256: `49555918b7489dbb45f0dc222a88f79a5f2629cdffaebe61a3f54568f8148a0a`.
- Stellar: `/Users/evan/Library/Caches/gidps-source-host/stellar-build-F7xhXt/source`, source revision `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`, source tree snapshot SHA-256 `df033c73db725aa999692b167c8c0c7d762f97c1cd217a5f489140cf4a9140b6`, 4,283 verified blobs. Manifest SHA-256: `629175fdbc74ecdec84735bfef6e2264b07d7d31e361e80736d0d5abd723f0b1`.

A read-only balanced-brace scan of `Amount: func` closures in `internal/characters/**/*.go`, cross-checked against the patched source text and current TypeScript registry, found:

- Classic: 302 vector `Amount` callbacks. 300 contain a shared dynamic/vector/snapshot calculation call. The other two are Clorinde A1 and Xilonen C6; both return `nil` but call the existing shared `CharacterAdditiveHit` before changing `AttackInfo.FlatDmg`.
- Stellar: 326 vector `Amount` callbacks. 324 contain a shared dynamic/vector/snapshot calculation call. The same two callbacks return `nil` and use shared `CharacterAdditiveHit`.
- Scalar `Amount` callbacks returning `float64`: 18 Classic and 27 Stellar. All 18/27 have a shared scalar, heal/drain calculation or snapshot call.

There is no non-nil vector-returning `Amount` callback in either latest tree without a shared formula/read/snapshot path. A source callback containing such a call is only a wiring signal: it does **not** prove every branch or numeric statement in the callback is shared, does not explain the producer of every observed state leaf, and does not transfer the callback's gate, target choice, expiry, event order or lifecycle to the formula AST. It also does not validate the third-party mechanics against the game.

The two nil-return callbacks with numeric side effects are accounted for by the additive registry:

- `internal/characters/clorinde/asc.go`, A1 callback: after source-native attack-tag/element gates, the source reads snapshot total ATK and `a1stacks.Count()`, computes `min(totalAtk * a1BuffPercent * stacks, a1Cap)`, then `CharacterAdditiveHit` replaces that amount before the native `FlatDmg` addition. Registry rule: `char-add-clorinde-a1`.
- `internal/characters/xilonen/cons.go`, C6 callback: after Normal/Plunge and Nightsoul-tag gates, the source reads actual non-extra total DEF, computes `totalDef * 3`, then `CharacterAdditiveHit` supplies the shared value before native `FlatDmg` addition. Registry rule: `char-add-xilonen-c6`.

Other unpaired indexed writes found by the scan are consumers, reset behavior, or already-computed source values, not missing numeric formula ASTs:

- Nilou C6 writes local `cr`/`cd` into the CR/CD vector slots after each value was replaced by `CharacterModifierDynamicRead` using the actual MaxHP provenance receipt.
- Sayu C2's attack callback copies `c.c2Bonus` into DmgP and associates its creation receipt; the producer derives that value from `c2BonusTicks` through `char-vector-sayu-c2` at press/hold/update points. The roll event cadence and native `< 0.66` update gate remain lifecycle evidence.
- Kazuha A4's Amount callback clears and fills its vector from `dmg`, which was created at the original swirl event from one non-extra EM getter using the element-specific `char-vector-kazuha-a4-*` rule. The Amount callback associates that creation receipt.
- Varka A1 consumers copy one stored `a1Buff` into the current converted-element slot and clear the other slot. The periodic non-extra ATK producer and team/element gates are already described by `char-dyn-varka-a1` and related vector/multiplier descriptors.
- Durin C2 clears the shared vector before its source-host branch rewrites the current element slot with the registered 50% formula. The clearing is vector hygiene, not an omitted positive formula contribution.

These examples still have native state production, event timing, and eligibility boundaries. They are not candidates for duplicating a `DynamicRead` formula; extending them would require a separate producer/lifecycle objective.

## Why the September 28 remainder inventory is not the current denominator

`docs/source-character-vector-remaining-20260928.json` is a dated pre-final scan of a different build snapshot. Its 139 distinct bodies / 243 lane entries predate or omit later fixed and dynamic vector integration, including patches 034–037, as well as later source-host patches present in the retained 127 trees. It is useful as a candidate history, not as a current patched-source gap count. The five literal examples from that list are concretely resolved by the registry and patches listed above. Current counts must come from the actual patched roots and current registries, not that historical candidate JSON.

The exact requested source reports remain dated boundaries: `docs/source-character-modifiers-20260928.zh-CN.md` reports its then-current 101 fixed rule IDs / 208 and 231 opaque callbacks; `docs/known-limitations.md` also records subsequent formula-family caveats. Neither dated narrative replaces the supplied latest patched-source roots for determining whether an `Amount` formula still lacks a shared calculation.

## Existing implementation hash and handoff

Hashes of the existing files most directly proving the five rules are recorded in `source-audit.json`. Relevant source files are already part of existing patch 035 (Kaeya, Kinich, Navia) and 037 (Yanfei); the typed descriptors already live in vector group B and D. Stellar patch registration already includes these files. No additional `.patch`, registry fragment, source patch-application record, or Stellar build registration is proposed; producing one would duplicate implementation.

No build, typecheck, unit test, browser test, native run, or role-by-role replay was performed. The audit only reads existing manifests, patched source, patch files, registry descriptors, and dated scope docs.
