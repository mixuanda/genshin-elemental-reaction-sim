# Wanderer legal recharge candidates — 2026-10-23

This is a bounded artifact allocation search, not a native simulation, an inventory reconstruction, a cycle guarantee or a global optimum. The only edited inputs are explicit artifact roll allocations. The fixed team remains Wanderer C6 / signature R5 / level 100, Faruzan C6 / Favonius R5, Nicole C2 / signature R1 and Durin C2 / signature R1. All action policy, main stats, sets, substat identities, other three builds, levels and refinements stay unchanged.

`buildWandererRechargeCandidate(input, hits, targetTotalER, nonArtifactTotalER)` calls the existing `balanceFiveStarArtifactRolls` and validates both original and candidate with `resolveArtifactBuild`. The retained five-piece budget has 45 rolls, nine per piece. Every transfer stays on the same piece and keeps its tier index; every existing substat retains at least one roll. Eight-roll pieces are supported without upgrading their budget. Observed panel values cannot be substituted for known roll histories. The required floor is total ER: 1.4 means 140%, whereas the budget API receives artifact-only bonus 0.4 for this non-artifact total of 1.

`generateWandererRechargeEvidence` in `wanderer-recharge-candidates-cli.ts` defaults to the tracked public equipment/GCSL files and the tracked compact snapshot inputs. It validates all four complete equipment inputs and writes pure `EquipmentBuildInput`, exact request and report JSON files. The request changes exactly one `wanderer add stats` line. Optional original native input re-extracts the scoring evidence; neither mode launches or modifies a native source artifact.

## Locked retained inputs

Construction uses these repository files, so neither the 151 KB audit build receipt nor the 51 MB native trace is required:

| Tracked file | SHA-256 |
| --- | --- |
| `apps/web/public/examples/wanderer-team-120-classic.equipment.json` | `e69e73a892aa7d48534c2e84493a95f83f96dd6f898caf654da27c0529f2bd68` |
| `apps/web/public/examples/wanderer-team-120-classic.gcsl` | `a6bf4f3c03c2fc6e477651e23b3d6cea87bef1536020ffc48c94c6f55f72206f` |

All four input objects, `userFixed` and `assumptions` in that public bundle equal the original full audit receipt. The GCSL equals the original request's `config`. The explicit recipe is protocol `gidps-source-host-v1`, seed `20261022`, `executionMode: auto-wait`, `stopAtDuration: true`, `initialEnergy: { mode: full }`, and phase observation `{ warmupFrames: 0, maxPeriod: 4, requiredConsecutivePeriods: 3, maxObservations: 32 }`.

The optional original provenance receipts remain at `/workspace/GIDPS-cloud/mechanism-closure-20261022/team/`:

| File | SHA-256 |
| --- | --- |
| `team-120-observed.builds.json` | `0bf3ee31a9be6c242d98e3f0a4ab66394351691e58703b273db589fb87b512e4` |
| `team-120-observed.request.json` | `8525b56ad48e33c7e3ad0a232cb63169074aa1ffbbfd6bbd563a8fe4cfaad1e0` |
| `team-120-observed.native.json` | `150675036ecf128d5b8c8c781af622f81f68083fc9ced4d8914c3711e651efc4` |

The native capture records Classic source `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`, seed `20261022`, a half-open `[0,7200)` observation and once-only full startup energy. Its inputs are an explicit developed legal budget, not the user's physical inventory. The source-backed stat tables use Genshin Optimizer commit `180a0a1015cb725c7570cd828eb086749960df98` with local manifest and exact source refs:

- `artifact_main.json`: `b4ac7d336caa5298e6f78921e2790042592f8ae70ff2e2428f2a23d594783ab4`
- `artifact_sub.json`: `5507dff48dc632ee6401adc518a6290d4607264738624ec51308ac7a2cb7e3e8`

These identities describe fixed repository/source evidence, not certification of current live game data. No upstream Go source is copied by this module.

## Candidates

Artifacts, reports and exact requests are under `/tmp/GIDPS-legal-recharge-evidence-20261023/`, named `wanderer-er140`, `wanderer-er150` and `wanderer-er160`, with `.equipment.json`, `.report.json` and `.request.json` suffixes. Each report includes both baseline identities, exact old/new GCSL stat lines, byte hashes, per-piece before/after rolls and tier multisets, net transfer replay, aggregate stat deltas, unchanged other-actor input hashes, source table manifest and provisional equipment validation.

| Candidate | Total ER | ΔCR, pp | ΔCD, pp | ΔATK%, pp | Net transfers | Frozen offense change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 114.24% | 0 | 0 | 0 | 0 | 0 |
| `wanderer-er140` | 140.16% | -11.67 | +28.74 | -27.41 | 9 | -3.7248% |
| `wanderer-er150` | 151.82% | -15.17 | +20.97 | -26.82 | 11 | -7.2635% |
| `wanderer-er160` | 160.25% | -17.89 | +16.31 | -26.82 | 15 | -9.7102% |

HP, flat ATK and Anemo main-stat bonus remain fixed. The existing helper can also improve offense allocations on pieces without ER; all such changes are listed, rather than describing each candidate as only an ER increase. The three rows show the tradeoff across these generated candidates; they are not a proof of the entire Pareto frontier.

| Candidate | Equipment SHA-256 | Request SHA-256 |
| --- | --- | --- |
| er140 | `f63d6fdd62a87f40da28ccf3eb2606b39f9068ef7c97b50a2aff911793ce6510` | `c4e96f8167817d12e0ad5617b13d1c7adf378a6b5ddc9bed7f3d4d0a9e8845d0` |
| er150 | `9b2ebaf2f0276e3a41252ed658c9f5ae534f6c5b696d6a153fbc35c75555cd6a` | `c1158edf280d66b4fc567ef0c946892743b0e7aa41bea2f3adfe6b901711644f` |
| er160 | `7979a7a4d195deb5ea14fb36bf63437f689155059520356eb691ab70f1e7b89d` | `a8b35d09293ef5bd11df06cc706e48d6e1503659aadcf06e29530f91d802e4df` |

## Proxy scope and the old source defect

The ranking uses 282 witnessed ordinary Wanderer ATK hits, their individual ATK snapshots, raw CR before clamping, actual used CD, flat damage and observed noncritical coefficients. Source-sampled critical multipliers are removed and an average critical multiplier is applied. CR overflow is retained until after the candidate delta is applied. A synthetic independent assertion checks that raw CR 1.18 minus .10 still clamps to 1, and that ATK 1895, scaling 2, base bonus .25, flat damage 100 and CD 1.7 give 13061.25.

The tracked `wanderer-recharge-candidates-proxy.json` is about 25 KB. It deduplicates exactly equal scoring operands into 67 dictionary entries, retaining a first witnessed frame/attack ID for each, and uses an explicit 282-index order to restore the original summation. It contains no complete native trace or new inferred hit state. The compact path independently reproduces all three equipment and request byte hashes above; it is an optional ranking input to the pure API, which can instead receive other explicit supported hit snapshots. Its native source identity and excluded leaked hits are preserved in the fixture and report.

Transformative Swirl and Nicole's Arcane Projection are excluded. The separately identified old C2 source defect also affects three otherwise eligible Shugen hits: attack 111 at frame 1177, 370 at 3700 and 505 at 5021. The extractor excludes them by actual `wanderer-c2-burstbonus` modifier provenance returning `DmgP=2` on a non-Q hit, not by assuming a fixed future list of IDs. The two defective projection hits were already outside the proxy. This exclusion does not repair the old native capture or imply that all post-Q C6 hits are illegal.

The score freezes the observed flat terms, aura, buffs, hit count, energy, Q/C2 state and schedule. It does not value extra bursts, reassign reaction ownership, extrapolate a new schedule or claim corrected native DPS. Artifact legality does not depend on this proxy. Final comparisons require the parent thread's corrected-source native baseline and candidate runs.

## Verification and reproduction

The focused test file has 24 passing tests: known baseline totals, independent numerical proxy arithmetic, overflow/CD handling, three reachable ER floors, three exact shipped-snapshot candidate reproductions, exact replay/conservation, impossible-floor refusal, eight-roll preservation, illegal budgets/tiers/identities, observed-history refusal, unsupported stat changes and invalid evidence. No full regression or native simulation was run by this workstream. Candidate er140 additionally passed the sibling verifier's independent raw-table legality/stat-line preflight; that verifier does not derive ER from collected energy.

With the repository's existing Vite dependency, the generator can be loaded without installing anything:

```js
import { createServer } from "vite";
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { generateWandererRechargeEvidence } = await server.ssrLoadModule("/packages/game-data/src/wanderer-recharge-candidates-cli.ts");
  const root = "apps/web/public/examples";
  generateWandererRechargeEvidence({
    baselineBuildsPath: `${root}/wanderer-team-120-classic.equipment.json`,
    baselineRequestPath: `${root}/wanderer-team-120-classic.gcsl`,
    outputDirectory: "/tmp/GIDPS-legal-recharge-evidence-20261023",
  });
} finally { await server.close(); }
```

Run the example from the repository root with `node --input-type=module`. A sparse checkout can pass exact `git show HEAD:<tracked-path>` copies; their bytes must match the same hashes. The CLI can alternatively be bundled with the existing TypeScript bundler; it accepts equipment bundle, GCSL, output directory and optional original native path as four optional arguments and refuses any changed locked baseline. The pure allocation/scoring API itself has no filesystem dependency.
