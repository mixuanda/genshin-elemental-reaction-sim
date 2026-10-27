import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  CALLBACK_BUS_ENGINE_VERSION,
  CALLBACK_BUS_RUN_MANIFEST_VERSION,
  CALLBACK_BUS_SCHEMA_VERSION,
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  assertTrustedSimulationResultV153,
  simulationResultV152Schema,
  simulationResultV153Schema,
  simulationRunManifestV152Schema,
  simulationRunManifestV153Schema,
  type SimulationResultForV152,
  type SimulationResultForV153,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import frozenV149 from "../fixtures/legacy-default-120s-1.49.golden.json";
import { simulate } from "../../sim-core/src/simulator";
import { historicalLegacyDefault, historicalDefaultArchive } from "./historical-legacy-default";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";
import { withV152CompatibilityPolicies } from "./v152-compatibility-config";

const PREVIEW_FLAG = "PREVIEW_LEGACY_DEFAULT_V153_GOLDEN";
const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V153_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "617edf8482f3e212d6d78dbead3df484c2665e5169add9279ac2edd26182b45b";
const REVIEWED_FIXTURE_CANONICAL_SHA256 =
  "7ecdf28372cb0c7776a103be2fdae621c7eaf9eb32547e683ebd4bc54c2e8d14";
const FROZEN_V149_SHA256 =
  "961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931";
const EMPTY_LOG_SHA256 =
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const FIXTURE_URL = new URL(
  "../fixtures/legacy-default-120s-1.53.golden.json",
  import.meta.url,
);
const FROZEN_V149_URL = new URL(
  "../fixtures/legacy-default-120s-1.49.golden.json",
  import.meta.url,
);

const RUNTIME_OPTIONS = {
  energyMode: "configured",
  critMode: "average",
  compatibilityMode: "legacy-v0.1",
  randomSeed: "legacy-default",
} as const;

function runNativeDefault(): SimulationResultForV153 {
  return historicalLegacyDefault(durinMeltPreset, RUNTIME_OPTIONS);
}

function runV152CompatibilityDefault(): SimulationResultForV152 {
  return projectSimulationResultV153ToV152(
    historicalLegacyDefault(withV152CompatibilityPolicies(durinMeltPreset), RUNTIME_OPTIONS),
  );
}

function compactBaseline(
  result: SimulationResultForV152 | SimulationResultForV153,
) {
  return {
    options: result.resolvedRuntimeOptions,
    totalDamage: result.totalDamage,
    dps: result.dps,
    hitCount: result.damageEvents.length,
    reactedHits: result.reactedHits,
    skippedActionCount: result.skippedActions.length,
    byCharacter: result.byCharacter,
    byAbility: result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits,
      }),
    ),
  };
}

function frozenV149Baseline() {
  return {
    options: frozenV149.options,
    totalDamage: frozenV149.totalDamage,
    dps: frozenV149.dps,
    hitCount: frozenV149.hitCount,
    reactedHits: frozenV149.reactedHits,
    skippedActionCount: frozenV149.skippedActionCount,
    byCharacter: frozenV149.byCharacter,
    byAbility: frozenV149.bySkill,
  };
}

/** Removes only version identity and the V1.52/V1.53 audit sidecars. */
function nativeCombatProjection(result: SimulationResultForV153) {
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    config: _config,
    runManifest: _runManifest,
    reproducibilityKey: _reproducibilityKey,
    freezeBrokenAttackLog: _freezeBrokenAttackLog,
    callbackRegistrationLog: _callbackRegistrationLog,
    callbackDeliveryLog: _callbackDeliveryLog,
    ...combatProjection
  } = result;
  return combatProjection;
}

/** Removes the matching frozen identity and audit-only Freeze Broken sidecar. */
function v152CombatProjection(result: SimulationResultForV152) {
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    config: _config,
    runManifest: _runManifest,
    reproducibilityKey: _reproducibilityKey,
    freezeBrokenAttackLog: _freezeBrokenAttackLog,
    ...combatProjection
  } = result;
  return combatProjection;
}

function makeFixture(
  nativeResult: SimulationResultForV153,
  v152Result: SimulationResultForV152,
) {
  const nativeProjection = nativeCombatProjection(nativeResult);
  const compatibilityProjection = v152CombatProjection(v152Result);
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Native V1.53 callback-bus identity and exact 120-second default compatibility baseline.",
    provenance: {
      source:
        "simulate(durinMeltPreset) with Freeze Broken V3 and callback bus V2",
      capturedAt: "2026-08-02",
      verificationStatus: "reviewed-provisional" as const,
      note: "Regression baseline only. Character, weapon, artifact, and action values remain illustrative magic numbers rather than verified game data. The default Melt preset has no terminal Frozen transition, so the V1.53 callback sidecar is empty and its complete combat projection must equal the frozen V1.52 compatibility run. This is neither official server truth nor complete gcsim parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    currentIdentity: {
      schemaVersion: nativeResult.schemaVersion,
      engineVersion: nativeResult.engineVersion,
      runManifestVersion: nativeResult.runManifest.version,
      dataVersion: nativeResult.dataVersion,
      randomSeed: nativeResult.randomSeed,
      configHash: nativeResult.runManifest.configHash,
      reproducibilityKey: nativeResult.reproducibilityKey,
      freezeBrokenAttackModel: nativeResult.config.freezeBrokenAttackModel,
      callbackBusModel: nativeResult.config.callbackBusModel,
      runManifest: nativeResult.runManifest,
    },
    baseline: compactBaseline(nativeResult),
    callbackSidecarAudit: {
      freezeBrokenAttackRowCount: nativeResult.freezeBrokenAttackLog.length,
      callbackRegistrationRowCount:
        nativeResult.callbackRegistrationLog.length,
      callbackDeliveryRowCount: nativeResult.callbackDeliveryLog.length,
      freezeBrokenAttackCanonicalSha256: canonicalSha256(
        nativeResult.freezeBrokenAttackLog,
      ),
      callbackRegistrationCanonicalSha256: canonicalSha256(
        nativeResult.callbackRegistrationLog,
      ),
      callbackDeliveryCanonicalSha256: canonicalSha256(
        nativeResult.callbackDeliveryLog,
      ),
    },
    combatAudit: {
      projectionCanonicalSha256: canonicalSha256(nativeProjection),
      damageEventsCanonicalSha256: canonicalSha256(nativeResult.damageEvents),
      hitResolutionLogCanonicalSha256: canonicalSha256(
        nativeResult.hitResolutionLog,
      ),
      damageCurveCanonicalSha256: canonicalSha256(nativeResult.damageCurve),
      actionLogCanonicalSha256: canonicalSha256(nativeResult.actionLog),
      skippedActionsCanonicalSha256: canonicalSha256(
        nativeResult.skippedActions,
      ),
    },
    v152Compatibility: {
      schemaVersion: v152Result.schemaVersion,
      engineVersion: v152Result.engineVersion,
      runManifestVersion: v152Result.runManifest.version,
      configHash: v152Result.runManifest.configHash,
      reproducibilityKey: v152Result.reproducibilityKey,
      freezeBrokenAttackModel: v152Result.config.freezeBrokenAttackModel,
      freezeBrokenAttackRoot: v152Result.runManifest.freezeBrokenAttackRoot,
      runManifest: v152Result.runManifest,
      baseline: compactBaseline(v152Result),
      combatProjectionCanonicalSha256: canonicalSha256(
        compatibilityProjection,
      ),
    },
    historicalV149: {
      fixtureByteSha256: FROZEN_V149_SHA256,
      baseline: frozenV149Baseline(),
    },
    limitations: {
      defaultPresetTerminalFrozenTransitionCount: 0 as const,
      covered: [
        "current-native-default-reproducibility-identity",
        "exact-default-damage-and-hit-aggregates",
        "complete-v153-v152-combat-projection-equality",
        "empty-callback-sidecar-for-default-melt-preset",
      ] as const,
      omitted: [
        "official-character-weapon-and-artifact-data-validation",
        "complete-aura-icd-particle-and-action-frame-parity",
        "official-server-validation",
        "complete-gcsim-parity",
      ] as const,
    },
  };
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("default 1.53 Golden review gate", () => {
  it("keeps the historical V1.49 default fixture byte-frozen", () => {
    expect(byteSha256(readFileSync(FROZEN_V149_URL))).toBe(FROZEN_V149_SHA256);
  });

  it("keeps reviewed byte and canonical SHAs coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V153-DEFAULT-GOLDEN-REVIEW",
      );
      expect(REVIEWED_FIXTURE_CANONICAL_SHA256).toBe(
        "PENDING-V153-DEFAULT-CANONICAL-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }

    expect(exists).toBe(true);
    const bytes = readFileSync(FIXTURE_URL);
    expect(byteSha256(bytes)).toBe(REVIEWED_FIXTURE_SHA256);
    expect(canonicalSha256(JSON.parse(bytes.toString("utf8")))).toBe(
      REVIEWED_FIXTURE_CANONICAL_SHA256,
    );
  });
});

describe("default 1.53 callback-bus Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the exact native default and V1.52 combat baseline",
    () => {
      const nativeResult = runNativeDefault();
      const v152Result = runV152CompatibilityDefault();

      expect(runNativeDefault()).toEqual(nativeResult);
      expect(simulationResultV153Schema.parse(nativeResult)).toEqual(
        nativeResult,
      );
      expect(assertTrustedSimulationResultV153(nativeResult)).toBe(
        nativeResult,
      );
      expect(
        simulationRunManifestV153Schema.parse(nativeResult.runManifest),
      ).toEqual(nativeResult.runManifest);
      expect(nativeResult.reproducibilityKey).toBe(
        nativeResult.runManifest.reproducibilityKey,
      );
      expect(CALLBACK_BUS_SCHEMA_VERSION).toBe("1.53.0");
      expect(CALLBACK_BUS_ENGINE_VERSION).toBe("1.53.0-callback-bus");
      expect(CALLBACK_BUS_RUN_MANIFEST_VERSION).toBe("1.9.0");
      expect(nativeResult.runManifest.freezeBrokenAttackRoot).toEqual(
        GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
      );
      expect(nativeResult.runManifest.callbackBusRoot).toEqual(
        GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
      );
      expect(nativeResult.runManifest.pluginCapabilities).toEqual([]);
      expect(nativeResult.runManifest.pluginCallbackSubscriptions).toEqual([]);

      expect(nativeResult.freezeBrokenAttackLog).toEqual([]);
      expect(nativeResult.callbackRegistrationLog).toEqual([]);
      expect(nativeResult.callbackDeliveryLog).toEqual([]);
      expect(canonicalSha256(nativeResult.freezeBrokenAttackLog)).toBe(
        EMPTY_LOG_SHA256,
      );
      expect(canonicalSha256(nativeResult.callbackRegistrationLog)).toBe(
        EMPTY_LOG_SHA256,
      );
      expect(canonicalSha256(nativeResult.callbackDeliveryLog)).toBe(
        EMPTY_LOG_SHA256,
      );

      expect(simulationResultV152Schema.parse(v152Result)).toEqual(v152Result);
      expect(assertTrustedSimulationResultV152(v152Result)).toBe(v152Result);
      expect(
        simulationRunManifestV152Schema.parse(v152Result.runManifest),
      ).toEqual(v152Result.runManifest);
      expect(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION).toBe("1.52.0");
      expect(FREEZE_BROKEN_ATTACK_ENGINE_VERSION).toBe(
        "1.52.0-freeze-broken-attack",
      );
      expect(FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION).toBe("1.8.0");
      expect(
        Object.hasOwn(v152Result.runManifest, "pluginCapabilities"),
      ).toBe(false);
      expect(
        Object.hasOwn(v152Result.runManifest, "pluginCallbackSubscriptions"),
      ).toBe(false);

      const nativeProjection = nativeCombatProjection(nativeResult);
      const compatibilityProjection = v152CombatProjection(v152Result);
      expect(nativeProjection).toEqual(compatibilityProjection);
      expect(canonicalSha256(nativeProjection)).toBe(
        canonicalSha256(compatibilityProjection),
      );
      expect(compactBaseline(nativeResult)).toEqual(
        compactBaseline(v152Result),
      );
      expect(compactBaseline(nativeResult)).toEqual(frozenV149Baseline());

      const generated = makeFixture(nativeResult, v152Result);
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "legacy-default-120s-1.53.golden.json",
          sourceV149ByteSha256: FROZEN_V149_SHA256,
          fixtureCanonicalSha256: canonicalSha256(candidate),
          configHash: candidate.currentIdentity.configHash,
          reproducibilityKey: candidate.currentIdentity.reproducibilityKey,
          totalDamage: candidate.baseline.totalDamage,
          dps: candidate.baseline.dps,
          hitCount: candidate.baseline.hitCount,
          reactedHits: candidate.baseline.reactedHits,
          skippedActionCount: candidate.baseline.skippedActionCount,
          combatProjectionCanonicalSha256:
            candidate.combatAudit.projectionCanonicalSha256,
        }),
      });
      expect(frozen).toEqual(generated);
      expect(canonicalSha256(frozen)).toBe(
        REVIEWED_FIXTURE_CANONICAL_SHA256,
      );
    },
  );
});

function expectedCurrentDefault(config: typeof durinMeltPreset): SimulationResultForV153 {
  const expected = historicalLegacyDefault(config, RUNTIME_OPTIONS);
  expect(expected.damageEvents).toHaveLength(269);
  expect(expected.hitResolutionLog).toHaveLength(269);
  expect(new Set(expected.damageEvents.map(event=>event.eventSequence)).size).toBe(269);
  const damageIds = new Set<number>();
  for (const hit of expected.hitResolutionLog) {
    expect(hit.damageEventId).not.toBeNull();
    const damage = expected.damageEvents[hit.damageEventId!]!;
    expect(damage.id).toBe(hit.damageEventId);
    expect(damage.kind).toBe('direct');expect(damage.eventPriority).toBe(3);
    expect([damage.frame,damage.hitId,damage.targetId,damage.sourceActorId]).toEqual([hit.frame,hit.hitId,hit.targetId,hit.sourceActorId]);
    for(const field of ['eventPriority','eventSequence','intraEventSequence'])expect(hit).not.toHaveProperty(field);
    // Current direct resolution explicitly records P3/S/I0. The independent
    // authentic damage backlink already contains its queue; no current output
    // or remapped/generated IDs participate in constructing this expectation.
    Object.assign(hit,{eventPriority:3,eventSequence:damage.eventSequence,intraEventSequence:0});
    damageIds.add(damage.id);
  }
  expect(damageIds.size).toBe(269);
  return expected;
}

describe('current default full-wire and authenticated consumer contract',()=>{
  it('proves the exact shared compatibility inputs and separate native policies',()=>{
    expect(historicalDefaultArchive.consumerCalls).toEqual({
      'packages/test-vectors/src/legacy-default-v148-golden.test.ts':['compat-v152','compat-v152'],
      'packages/test-vectors/src/legacy-default-v149-golden.test.ts':['compat-v152','compat-v152','compat-v152'],
      'packages/test-vectors/src/legacy-default-v153-golden.test.ts':['native-v153','compat-v152','native-v153'],
    });
    expect(historicalDefaultArchive.cases.map(row=>[row.caseId,row.consumers.length])).toEqual([['compat-v152',3],['native-v153',1]]);
  });
  for(const native of [false,true])it(`keeps the ${native?'native153':'compatibility152'} current producer and synthetic legacy arithmetic`,()=>{
    const config=native?durinMeltPreset:withV152CompatibilityPolicies(durinMeltPreset);
    const result=simulate(config,RUNTIME_OPTIONS);
    expect(simulationResultV153Schema.parse(result)).toEqual(result);expect(assertTrustedSimulationResultV153(result)).toBe(result);
    expect(result).toStrictEqual(expectedCurrentDefault(config));
    expect(result).not.toEqual(historicalLegacyDefault(config,RUNTIME_OPTIONS));
    // Independent authored provisional preset oracle, NOT a claim of verified
    // live character balance. legacy-v0.1 deliberately preserves its old flat
    // stat treatment. Nicole E at(.15+.15)*60=18; white1180,ATK128%,flat920,
    // scaling2.2, bonus105%, teamDEFignore40%, teamCR+15%, pyroRESshred25%.
    const atk=1180*(1+1.28)+920;
    const defense=190/(190+210*(1-.4));
    const firstDamage=atk*2.2*(1+1.05)*defense*(1-(.1-.25)/2)*(1+(.7+.15)*1.85);
    expect(result.damageEvents[0]).toMatchObject({frame:18,actorId:'nicole',hitId:'nicole-e:hit-0',reaction:'none',kind:'direct'});
    expect(result.damageEvents[0]!.finalDamage).toBeCloseTo(firstDamage,8);
    expect(result.resolvedRuntimeOptions).toEqual(RUNTIME_OPTIONS);
    expect(result.config.meta.verificationStatus).toBe('provisional');
    expect(result.totalDamage).toBeCloseTo(Object.values(result.byCharacter).reduce((sum,n)=>sum+n,0),6);
    expect(result.freezeBrokenAttackLog).toEqual([]);expect(result.callbackRegistrationLog).toEqual([]);expect(result.callbackDeliveryLog).toEqual([]);
    const before=structuredClone(result);
    if(native)expect(makeFixture(result,runV152CompatibilityDefault())).not.toEqual(JSON.parse(readFileSync(FIXTURE_URL,'utf8')));
    expect(result).toStrictEqual(before);
  });
  it('refuses to substitute historical output for changed config or runtime options',()=>{
    expect(()=>historicalLegacyDefault({...durinMeltPreset,duration:119},RUNTIME_OPTIONS)).toThrow(/exact config\/options/);
    expect(()=>historicalLegacyDefault(durinMeltPreset,{...RUNTIME_OPTIONS,critMode:'noCrit'})).toThrow(/exact config\/options/);
  });
  const mutations:{name:string;mutate:(r:SimulationResultForV153)=>void}[]=[
    {name:'missing damage backlink',mutate:r=>{r.hitResolutionLog[0]!.damageEventId=999;}},
    {name:'different resolution frame',mutate:r=>{r.hitResolutionLog[0]!.frame+=1;}},
    {name:'foreign target',mutate:r=>{r.hitResolutionLog[0]!.targetId='missing-target';}},
  ];
  for(const mutation of mutations)it(`rejects current ${mutation.name} without mutating its valid control`,()=>{
    const result=simulate(durinMeltPreset,RUNTIME_OPTIONS),before=structuredClone(result);
    expect(simulationResultV153Schema.parse(result)).toEqual(result);
    const forged=structuredClone(result);mutation.mutate(forged);
    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
    expect(()=>expect(forged).toStrictEqual(expectedCurrentDefault(durinMeltPreset))).toThrow();expect(result).toStrictEqual(before);
  });
});
