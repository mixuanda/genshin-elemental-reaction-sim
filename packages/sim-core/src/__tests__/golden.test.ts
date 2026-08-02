import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
  EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
  EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResult,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  legacyDefault120sGoldenFixtureV142Schema,
  legacyDefault120sGoldenFixtureV144Schema,
  migrateConfig,
  playerDamageResultReferencesSchema,
  reactionFormulaModelSchema,
  reactionFormulaRootSchema,
  simConfigV146Schema,
  simulationResultSchema,
  simulationRunManifestV145Schema,
  simulationRunManifestV146Schema,
  type SimConfig,
  type SimConfigV146,
  type SimulationRunManifestV146
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_DAMAGE_GROUP_ROOT
} from "@genshin-dps-lab/icd-profiles";
import burningGolden from "../../../test-vectors/fixtures/burning-aura-v4-1.30.golden.json";
import goldenV133 from "../../../test-vectors/fixtures/legacy-default-120s-1.33.golden.json";
import goldenV134 from "../../../test-vectors/fixtures/legacy-default-120s-1.34.golden.json";
import goldenV135 from "../../../test-vectors/fixtures/legacy-default-120s-1.35.golden.json";
import goldenV136 from "../../../test-vectors/fixtures/legacy-default-120s-1.36.golden.json";
import goldenV137 from "../../../test-vectors/fixtures/legacy-default-120s-1.37.golden.json";
import goldenV138 from "../../../test-vectors/fixtures/legacy-default-120s-1.38.golden.json";
import goldenV139 from "../../../test-vectors/fixtures/legacy-default-120s-1.39.golden.json";
import goldenV141Json from "../../../test-vectors/fixtures/legacy-default-120s-1.41.golden.json";
import goldenV142Json from "../../../test-vectors/fixtures/legacy-default-120s-1.42.golden.json";
import golden from "../../../test-vectors/fixtures/legacy-default-120s.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const LEGACY_V130_REPRODUCIBILITY_KEY = "gdl-d1a42700";
const LEGACY_V130_COMPATIBILITY_SHA256 =
  "be150b9be5f33d18ef8942fbb13693aaef47b82a02712107ab04676dfcc24110";
const BURNING_V130_COMPATIBILITY_SHA256 =
  "7235c3faf3a61305aef85b5a6144d1c98196f2a8d222b3d453851cb53a83b772";
const BURNING_DAMAGE_EVENTS_SHA256 =
  "8e5c192e04f4599da093fc61f353aff3529a2d234aba19ef6dadd00bf89e1cf1";
const BURNING_STATE_LOG_SHA256 =
  "aedd0ba94477979a5c688e7496f925d073f36a0513ad3e274d38fbf0bff8b0b4";
const BURNING_V142_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-c728aa15";
const BURNING_V142_CONFIG_HASH = "fnv1a32:ac41771e";
const BURNING_V146_CONFIG_HASH = "fnv1a32:ad3d3708";
const BURNING_V146_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-c3075366";
const FROZEN_FOUNDATION_FIXTURE_SHA256 = {
  "burning-aura-v4-1.30.golden.json":
    "adbb9a815163baa6667295298a6bad547be2a05a26f5139777ba73a21269867d",
  "legacy-default-120s.golden.json":
    "556d3824831565eb7f23e6eb0826cdac5e0cea6e05835074952e02eb63508177",
  "legacy-default-120s-1.33.golden.json":
    "cfa53081a7cfe94a986b3d4d9b83b6166cb3e2bfb22968941553630d0424f811",
  "legacy-default-120s-1.34.golden.json":
    "fe47823acaced023470121bff5e67a6943412540f2c79a9b9bee474b01b8506f",
  "legacy-default-120s-1.35.golden.json":
    "10c09c7d8fb4bafc11fcba1477ecf5c762302afb1f017b962cb0d89ab0ceab72",
  "legacy-default-120s-1.36.golden.json":
    "738355617c6b893b625f85d9220b733f679d753c39fe771f9da2d69ac4d0f15f",
  "quicken-bloom-task-order-1.36.golden.json":
    "6a1b2840ff3f6e2d8abbba0b80e98823336ab33cca3a6658fef4223974cdae84",
  "reaction-matrix-1.31.golden.json":
    "edb5e16d698683e6a64f3ecbf01baa30ab5df012fb0137d907cef9a91d1720cc",
  "reaction-matrix-1.32.golden.json":
    "4089587e77765a655ccf6f776a32e1bc7e259a10ba3b532fb273274d814962e4",
  "reaction-matrix-1.33.golden.json":
    "67a6546d8562e3d9720262a26ce5b6a9224fa9e871fabbe0c9b1d0e9e5490231",
  "reaction-matrix-1.34.golden.json":
    "2a6a08d69f6c819959def335fc7b676f7d8f48bfce7c4700307d5e80be08497e",
  "reaction-matrix-1.35.golden.json":
    "d21e107dd1ed53f897d5f5d1f45af4735cd99297c281f5123d71e1fbc394d8c5"
} as const;
const FROZEN_VERSIONED_FIXTURE_SHA256 = {
  "legacy-default-120s-1.37.golden.json":
    "168595c9e3df60717fe2b5619278cc227789df7cbf56b9985a78ceb78e10bacc",
  "quicken-bloom-task-order-1.37.golden.json":
    "d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6",
  "target-task-phase-1.37.golden.json":
    "5bb1ebe27d7bd5dd613abed4cb1326345925dec00311ee500b24648ffd97c60a",
  "legacy-default-120s-1.38.golden.json":
    "a3813cda16b831d6606df5976dc90e2d8410c272fadefd25551e29e94ff334ed",
  "quicken-bloom-task-order-1.38.golden.json":
    "07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc",
  "target-reactable-phase-1.38.golden.json":
    "f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0",
  "legacy-default-120s-1.39.golden.json":
    "9765979c127cee707a99db1344a9569d25560d8a2f19ad2577fac2c7c9225151",
  "quicken-bloom-task-order-1.39.golden.json":
    "a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534",
  "target-reactable-phase-1.39.golden.json":
    "40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8",
  "shatter-recursive-delivery-1.39.golden.json":
    "a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579"
} as const;
const FROZEN_V140_FIXTURE_SHA256 = {
  "legacy-default-120s-1.40.golden.json":
    "843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f",
  "quicken-bloom-task-order-1.40.golden.json":
    "b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4",
  "electro-charged-quicken-cleanup-1.40.golden.json":
    "bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0"
} as const;
const FROZEN_V141_FIXTURE_SHA256 = {
  "legacy-default-120s-1.41.golden.json":
    "9768d8b0461bd641ed5a4097e1cfe4204e1d6db9e9a6453e75754eb1a90bf9c8",
  "electro-charged-propagation-1.41.golden.json":
    "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18"
} as const;
const FROZEN_V142_FIXTURE_SHA256 = {
  "legacy-default-120s-1.42.golden.json":
    "ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df",
  "electro-charged-global-cadence-1.42.golden.json":
    "ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611"
} as const;
const FROZEN_V144_FIXTURE_SHA256 = {
  "legacy-default-120s-1.44.golden.json":
    "e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05",
  "burning-callback-delivery-1.44.golden.json":
    "4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65"
} as const;
const UPDATE_LEGACY_DEFAULT_V145_GOLDEN =
  "UPDATE_LEGACY_DEFAULT_V145_GOLDEN";
const FROZEN_V145_FIXTURE_SHA256 =
  "ce59efca02ea2a895195139a3775ec0eeefe6b73414603ee8650e46b2e3c2167";
const LEGACY_DEFAULT_V144_DESCRIPTION =
  "Compact 1.44 identity and result envelope for the frozen Vanilla v0.1 default 120-second compatibility baseline.";
const LEGACY_DEFAULT_V144_SOURCE =
  "simulate(durinMeltPreset) cross-checked against legacy/v0.1-vanilla/app.js, legacy-default-120s.golden.json, and the frozen 1.42 identity fixture";
const LEGACY_DEFAULT_V144_NOTE =
  "Regression baseline only. Character and equipment values are illustrative magic numbers, not verified game data. The 1.44 engine adds opt-in fixed-gcsim-provisional Burning callback delivery, while this default preset preserves its historical deferred reaction mode, explicitly keeps single-target-v1, and freezes the complete 269-event damage digest to 1.42. This is neither official server truth nor complete gcsim parity.";
const LEGACY_DEFAULT_V144_CONFIG_HASH = "fnv1a32:dad42c01";
const LEGACY_DEFAULT_V144_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-03487d7e";
const LEGACY_DEFAULT_V145_CONFIG_HASH = "fnv1a32:e53f9200";
const LEGACY_DEFAULT_V145_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-b696a75d";
const LEGACY_DEFAULT_V145_DESCRIPTION =
  "Compact 1.45 reaction-formula-root identity and result envelope for the frozen Vanilla v0.1 default 120-second compatibility baseline.";
const LEGACY_DEFAULT_V145_SOURCE =
  "simulate(durinMeltPreset) cross-checked against legacy/v0.1-vanilla/app.js, legacy-default-120s.golden.json, and the frozen 1.44 identity fixture";
const LEGACY_DEFAULT_V145_NOTE =
  "Regression baseline only. Character and equipment values are illustrative magic numbers, not verified game data. The 1.45 engine binds the fixed-gcsim-provisional classic reaction formula profile and full formula root, while this default preset preserves its historical deferred reaction mode, explicitly keeps single-target-v1, and freezes the complete 269-event damage digest to 1.44. This is neither official server truth nor complete gcsim parity.";
const LEGACY_DEFAULT_V141_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.41.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V142_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.42.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V144_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.44.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V145_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.45.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V140_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.40.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V139_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.39.golden.json",
  import.meta.url
);

const EMPTY_COMPATIBILITY_ARRAY_FIELDS = new Set([
  "bloomReactions",
  "damageGroupDecisions",
  "playerHitResolutionLogIds",
  "playerDamageEventIds",
  "reactionTaskLog"
]);
const NULL_COMPATIBILITY_REFERENCE_FIELDS = new Set([
  "triggerHitGroupId",
  "sourceCoreId",
  "sourceCoreLogId",
  "selectionRadius",
  "selectedTargetId",
  "resolutionReason",
  "playerHitResolutionLogId",
  "playerDamageEventId"
]);

/**
 * Hash the frozen pre-1.31 semantic surface. Empty Bloom arrays, 1.32 player
 * back-reference arrays, nullable Dendro/player references, and the disabled
 * 1.33 target-clock envelope and the absent aura-v6 multi-transform array are
 * additive wire fields. Legacy/v4 regressions normalize only those empty
 * values away while still failing if any new behavior becomes active.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => {
          const field = record[key];
          if (
            EMPTY_COMPATIBILITY_ARRAY_FIELDS.has(key) &&
            Array.isArray(field) &&
            field.length === 0
          ) {
            return false;
          }
          return !(
            NULL_COMPATIBILITY_REFERENCE_FIELDS.has(key) &&
            field === null
          );
        })
        .map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function serializeJsonFixture(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function byteSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Project only the 1.47 elemental-application selector wire. A no-ICD
 * selector no longer carries the old, semantically inert tag, so an exact
 * frozen source may supply it when byte-identical 1.46 identity matters.
 */
function projectApplicationsToFrozenV146Wire(
  value: unknown,
  frozenReference?: unknown
): unknown {
  if (Array.isArray(value)) {
    const referenceEntries = Array.isArray(frozenReference)
      ? frozenReference
      : [];
    return value.map((entry, index) =>
      projectApplicationsToFrozenV146Wire(
        entry,
        referenceEntries[index]
      )
    );
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.gaugeUnits === "number" &&
    record.icd !== null &&
    typeof record.icd === "object"
  ) {
    const selector = record.icd as Record<string, unknown>;
    if (selector.mode === "no-icd-v1") {
      const reference =
        frozenReference !== null &&
        typeof frozenReference === "object"
          ? (frozenReference as Record<string, unknown>)
          : undefined;
      const frozenIcdTag =
        reference?.gaugeUnits === record.gaugeUnits &&
        reference.icdGroup === "no-icd" &&
        typeof reference.icdTag === "string" &&
        reference.icdTag.length > 0
          ? reference.icdTag
          : "__no_icd_v1__";
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: frozenIcdTag,
        icdGroup: "no-icd"
      };
    }
    if (
      selector.mode === "legacy-boolean-profile-v1" &&
      typeof selector.icdTag === "string" &&
      selector.icdTag.length > 0 &&
      typeof selector.profileId === "string" &&
      selector.profileId.length > 0
    ) {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: selector.icdTag,
        icdGroup: selector.profileId
      };
    }
    if (
      selector.mode === "fixed-gcsim-application-v1" &&
      typeof selector.icdTag === "string" &&
      selector.icdTag.length > 0 &&
      typeof selector.groupId === "string" &&
      selector.groupId.length > 0
    ) {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: selector.icdTag,
        icdGroup: selector.groupId
      };
    }
    throw new Error(
      "Cannot safely project an unknown elemental-application selector onto the frozen 1.46 wire."
    );
  }
  const frozenRecord =
    frozenReference !== null &&
    typeof frozenReference === "object"
      ? (frozenReference as Record<string, unknown>)
      : undefined;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      projectApplicationsToFrozenV146Wire(
        entry,
        frozenRecord?.[key]
      )
    ])
  );
}

function projectCurrentConfigToFrozenV146(
  config: SimConfig,
  frozenReference?: unknown
): SimConfigV146 {
  const {
    elementalApplicationIcdModel:
      _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    ...currentWithoutApplicationModel
  } = structuredClone(config);
  const projected = projectApplicationsToFrozenV146Wire(
    currentWithoutApplicationModel,
    frozenReference
  ) as Record<string, unknown>;
  return simConfigV146Schema.parse({
    ...projected,
    schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
  });
}

function projectCurrentManifestToFrozenV146(
  result: ReturnType<typeof simulate>,
  frozenConfig: SimConfigV146
): SimulationRunManifestV146 {
  const {
    elementalApplicationIcdRoot:
      _elementalApplicationIcdRoot,
    reactionOwnedElementalApplicationRoot:
      _reactionOwnedElementalApplicationRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...currentIdentity
  } = result.runManifest;
  const frozenIdentity = {
    ...currentIdentity,
    version: DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
    schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
    configHash: createSimulationConfigHash(frozenConfig)
  } satisfies Omit<
    SimulationRunManifestV146,
    "reproducibilityKey"
  >;
  return simulationRunManifestV146Schema.parse({
    ...frozenIdentity,
    reproducibilityKey:
      createSimulationReproducibilityKey(frozenIdentity)
  });
}

/**
 * The 1.47 no-ICD decision intentionally reports null legacy tag/group fields.
 * Restore those semantically inert 1.46 wire values only for frozen digests;
 * the current result itself remains untouched and is validated above.
 */
function projectCurrentDamageEventsToFrozenV146(
  result: ReturnType<typeof simulate>,
  frozenConfig: SimConfigV146
): ReturnType<typeof simulate>["damageEvents"] {
  const configuredHits = [
    ...frozenConfig.rotation.flatMap((action) => action.hits),
    ...(frozenConfig.timeline?.abilities.flatMap(
      (ability) => ability.hits
    ) ?? [])
  ];
  const projected = structuredClone(result.damageEvents);
  const postV146Fields = [
    "applicationIcdDecision",
    "applicationIcdLogId",
    "elementalApplicationIcdLogId",
    "applicationMultiplier",
    "nominalApplicationGaugeUnits",
    "effectiveApplicationGaugeUnits"
  ] as const;
  for (const event of projected) {
    const eventRecord = event as unknown as Record<
      string,
      unknown
    >;
    const auditRecord = event.reactionAudit as unknown as Record<
      string,
      unknown
    >;
    for (const field of postV146Fields) {
      delete eventRecord[field];
      delete auditRecord[field];
    }
  }
  for (const row of result.elementalApplicationIcdLog) {
    if (row.damageEventId === null) continue;
    const event = projected[row.damageEventId];
    if (
      event === undefined ||
      event.id !== row.damageEventId ||
      event.hitId !== row.hitId ||
      event.hitGroupId !== row.hitGroupId
    ) {
      throw new Error(
        `Cannot project dangling elemental-application audit row ${row.id} onto frozen 1.46 damage events.`
      );
    }
    if (row.sourceKind === "burning-tick") {
      if (
        row.element !== "pyro" ||
        row.nominalGaugeUnits !== 1 ||
        event.reactionAudit.icdAllowed !== row.decision.allowed
      ) {
        throw new Error(
          `Reaction-owned Burning audit row ${row.id} cannot be represented by the frozen 1.46 wire.`
        );
      }
      event.reactionAudit.icdAllowed = row.decision.allowed;
      event.reactionAudit.icdTag = "burning-application";
      event.reactionAudit.icdGroup = "burning";
      event.reactionAudit.applicationGaugeUnits =
        row.nominalGaugeUnits;
      event.reactionAudit.note =
        "燃烧范围传播：先以 1U 附着处理目标 Aura 与二次反应，再结算不暴击、无视防御的扩散伤害。";
      continue;
    }
    if (row.sourceKind === "swirl-propagation") {
      throw new Error(
        "Frozen 1.46 damage projection has no audited Swirl-propagation downgrade contract."
      );
    }
    const matches = configuredHits.filter(
      (hit) =>
        hit?.id === row.hitId && hit.application !== undefined
    );
    const application = matches[0]?.application;
    if (matches.length !== 1 || application === undefined) {
      throw new Error(
        `Frozen 1.46 application projection requires exactly one configured hit for "${row.hitId}"; received ${matches.length}.`
      );
    }
    const selector = row.selector;
    const selectorMatchesFrozenWire =
      (selector.mode === "no-icd-v1" &&
        application.icdGroup === "no-icd") ||
      (selector.mode === "legacy-boolean-profile-v1" &&
        application.icdTag === selector.icdTag &&
        application.icdGroup === selector.profileId) ||
      (selector.mode === "fixed-gcsim-application-v1" &&
        application.icdTag === selector.icdTag &&
        application.icdGroup === selector.groupId);
    if (
      !selectorMatchesFrozenWire ||
      application.gaugeUnits !== row.nominalGaugeUnits ||
      event.reactionAudit.applicationGaugeUnits !==
        row.effectiveGaugeUnits ||
      event.reactionAudit.icdAllowed !== row.decision.allowed
    ) {
      throw new Error(
        `Elemental-application audit row ${row.id} cannot be represented by the supplied frozen 1.46 hit.`
      );
    }
    event.reactionAudit.icdTag = application.icdTag;
    event.reactionAudit.icdGroup = application.icdGroup;
  }
  return projected;
}

function atomicCreateFixtureBytes(
  outputUrl: URL,
  bytes: string
): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, bytes, { flag: "wx" });
  try {
    linkSync(temporaryPath, outputPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Refusing to overwrite frozen fixture ${outputPath}.`
      );
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

type LegacyDefaultV141Fixture = typeof goldenV141Json;
type LegacyDefaultV142Fixture = typeof goldenV142Json;
type LegacyDefaultV144Fixture = ReturnType<
  typeof legacyDefault120sGoldenFixtureV144Schema.parse
>;

function projectLegacyDefaultV145ToFrozenV144(
  fixture: Record<string, unknown>
): LegacyDefaultV144Fixture {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    runManifest: _runManifest,
    ...historicalFields
  } = fixture;
  return legacyDefault120sGoldenFixtureV144Schema.parse({
    ...historicalFields,
    description: LEGACY_DEFAULT_V144_DESCRIPTION,
    provenance: {
      source: LEGACY_DEFAULT_V144_SOURCE,
      capturedAt: "2026-07-31",
      verificationStatus: "provisional",
      note: LEGACY_DEFAULT_V144_NOTE,
      officialServerTruth: false,
      completeGcsimParity: false
    },
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    configHash: LEGACY_DEFAULT_V144_CONFIG_HASH,
    reproducibilityKey:
      LEGACY_DEFAULT_V144_REPRODUCIBILITY_KEY
  });
}

/**
 * Strict local release schema for the compact 1.45 Golden. The exact 1.44
 * schema remains the single source of truth for every historical result field;
 * this boundary adds only the versioned formula selector and bound manifest.
 */
const legacyDefault120sGoldenFixtureV145Schema = z
  .object({
    fixtureVersion: z.literal("1.0.0"),
    description: z.literal(LEGACY_DEFAULT_V145_DESCRIPTION),
    provenance: z
      .object({
        source: z.literal(LEGACY_DEFAULT_V145_SOURCE),
        capturedAt: z.literal("2026-08-01"),
        verificationStatus: z.literal("provisional"),
        note: z.literal(LEGACY_DEFAULT_V145_NOTE),
        officialServerTruth: z.literal(false),
        completeGcsimParity: z.literal(false)
      })
      .strict(),
    schemaVersion: z.literal(
      REACTION_FORMULA_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      REACTION_FORMULA_ROOT_ENGINE_VERSION
    ),
    configHash: z.literal(LEGACY_DEFAULT_V145_CONFIG_HASH),
    reproducibilityKey: z.literal(
      LEGACY_DEFAULT_V145_REPRODUCIBILITY_KEY
    ),
    options: z.any(),
    totalDamage: z.number().finite(),
    dps: z.number().finite(),
    hitCount: z.number().int().nonnegative(),
    reactedHits: z.number().int().nonnegative(),
    skippedActionCount: z.number().int().nonnegative(),
    byCharacter: z.any(),
    bySkill: z.any(),
    legacyDamageEventsSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/),
    reactionDeliveryModel: z.any(),
    electroChargedPropagationModel: z.any(),
    targetClock: z.any(),
    targetTask: z.any(),
    targetPhaseLog: z.any(),
    reactionFormulaModel: reactionFormulaModelSchema,
    runManifest: simulationRunManifestV145Schema
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      !reactionFormulaRootSchema.safeParse(
        fixture.runManifest.reactionFormulaRoot
      ).success
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest", "reactionFormulaRoot"],
        message: "must bind the exact compiled reaction formula root"
      });
    }
    if (
      fixture.runManifest.schemaVersion !==
        fixture.schemaVersion ||
      fixture.runManifest.engineVersion !==
        fixture.engineVersion ||
      fixture.runManifest.configHash !== fixture.configHash ||
      fixture.runManifest.reproducibilityKey !==
        fixture.reproducibilityKey ||
      fixture.runManifest.version !==
        REACTION_FORMULA_RUN_MANIFEST_VERSION ||
      JSON.stringify(
        fixture.runManifest.resolvedRuntimeOptions
      ) !== JSON.stringify(fixture.options) ||
      fixture.runManifest.plugins.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest"],
        message:
          "must bind the exact 1.45 identity, runtime options, empty plugin order, config hash, and reproducibility key"
      });
    }
  });

type LegacyDefaultV145Fixture = z.output<
  typeof legacyDefault120sGoldenFixtureV145Schema
>;

function loadFrozenLegacyDefaultV141Fixture():
  LegacyDefaultV141Fixture {
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V141_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.41.golden.json is frozen; create only the versioned 1.42 fixture."
    );
  }
  const sourceBytes = readFileSync(
    LEGACY_DEFAULT_V141_FIXTURE_URL
  );
  const sourceSha256 = createHash("sha256")
    .update(sourceBytes)
    .digest("hex");
  if (
    sourceSha256 !==
    FROZEN_V141_FIXTURE_SHA256[
      "legacy-default-120s-1.41.golden.json"
    ]
  ) {
    throw new Error(
      `Frozen 1.41 default fixture changed: received ${sourceSha256}.`
    );
  }
  return JSON.parse(
    sourceBytes.toString("utf8")
  ) as LegacyDefaultV141Fixture;
}

function loadFrozenLegacyDefaultV140Fixture(): typeof goldenV139 {
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V139_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.39.golden.json is frozen; create only a new versioned fixture."
    );
  }
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V140_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.40.golden.json is frozen; create only the versioned 1.41 fixture."
    );
  }
  const sourceBytes = readFileSync(
    LEGACY_DEFAULT_V140_FIXTURE_URL
  );
  const sourceSha256 = createHash("sha256")
    .update(sourceBytes)
    .digest("hex");
  if (
    sourceSha256 !==
    FROZEN_V140_FIXTURE_SHA256[
      "legacy-default-120s-1.40.golden.json"
    ]
  ) {
    throw new Error(
      `Frozen 1.40 default fixture changed: received ${sourceSha256}.`
    );
  }
  return JSON.parse(sourceBytes.toString("utf8")) as typeof goldenV139;
}

function projectLegacyDefaultCompatibilitySemantics(
  fixture:
    | typeof goldenV139
    | LegacyDefaultV141Fixture
    | LegacyDefaultV142Fixture
    | LegacyDefaultV144Fixture
    | LegacyDefaultV145Fixture
) {
  return {
    options: fixture.options,
    totalDamage: fixture.totalDamage,
    dps: fixture.dps,
    hitCount: fixture.hitCount,
    reactedHits: fixture.reactedHits,
    skippedActionCount: fixture.skippedActionCount,
    byCharacter: fixture.byCharacter,
    bySkill: fixture.bySkill,
    legacyDamageEventsSha256:
      fixture.legacyDamageEventsSha256,
    targetClock: fixture.targetClock,
    targetTask: fixture.targetTask,
    targetPhaseLog: fixture.targetPhaseLog,
    reactionDeliveryModel:
      fixture.reactionDeliveryModel
  };
}

function loadOrCreateLegacyDefaultV142Fixture():
  LegacyDefaultV142Fixture {
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V142_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.42.golden.json is frozen; create only the versioned 1.44 fixture."
    );
  }
  const sourceBytes = readFileSync(
    LEGACY_DEFAULT_V142_FIXTURE_URL
  );
  const sourceSha256 = createHash("sha256")
    .update(sourceBytes)
    .digest("hex");
  if (
    sourceSha256 !==
    FROZEN_V142_FIXTURE_SHA256[
      "legacy-default-120s-1.42.golden.json"
    ]
  ) {
    throw new Error(
      `Frozen 1.42 default fixture changed: received ${sourceSha256}.`
    );
  }
  return JSON.parse(
    sourceBytes.toString("utf8")
  ) as LegacyDefaultV142Fixture;
}

function loadOrCreateLegacyDefaultV144Fixture(
  generatedFixture: LegacyDefaultV144Fixture,
  frozenV142: LegacyDefaultV142Fixture,
  options: {
    updateRequested?: boolean;
    outputUrl?: URL;
  } = {}
): LegacyDefaultV144Fixture {
  const updateRequested =
    options.updateRequested ??
    process.env.UPDATE_LEGACY_DEFAULT_V144_GOLDEN === "1";
  const outputUrl =
    options.outputUrl ?? LEGACY_DEFAULT_V144_FIXTURE_URL;
  if (updateRequested) {
    const sourceBytes = readFileSync(
      LEGACY_DEFAULT_V142_FIXTURE_URL
    );
    const sourceSha256 = createHash("sha256")
      .update(sourceBytes)
      .digest("hex");
    if (
      sourceSha256 !==
      FROZEN_V142_FIXTURE_SHA256[
        "legacy-default-120s-1.42.golden.json"
      ]
    ) {
      throw new Error(
        `Refusing to derive the 1.44 default fixture from an unfrozen 1.42 source: received ${sourceSha256}.`
      );
    }
    if (
      JSON.stringify(
        projectLegacyDefaultCompatibilitySemantics(
          generatedFixture
        )
      ) !==
      JSON.stringify(
        projectLegacyDefaultCompatibilitySemantics(frozenV142)
      )
    ) {
      throw new Error(
        "Refusing to write the 1.44 default fixture because its frozen 1.42 compatibility semantics changed."
      );
    }
    if (
      generatedFixture.schemaVersion !==
        BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION ||
      generatedFixture.engineVersion !==
        BURNING_CALLBACK_DELIVERY_ENGINE_VERSION ||
      generatedFixture.provenance.officialServerTruth !== false ||
      generatedFixture.provenance.completeGcsimParity !== false ||
      generatedFixture.electroChargedPropagationModel.mode !==
        "single-target-v1"
    ) {
      throw new Error(
        "Refusing to write the 1.44 default fixture without the exact current identity, explicit provisional provenance, and source-only Electro-Charged propagation model."
      );
    }
    const parsedGeneratedFixture =
      legacyDefault120sGoldenFixtureV144Schema.parse(
        generatedFixture
      );
    const generatedBytes = serializeJsonFixture(
      parsedGeneratedFixture
    );
    const generatedSha256 = byteSha256(generatedBytes);
    if (
      generatedSha256 !==
      FROZEN_V144_FIXTURE_SHA256[
        "legacy-default-120s-1.44.golden.json"
      ]
    ) {
      throw new Error(
        `Refusing to write the 1.44 default fixture because its generated bytes changed: received ${generatedSha256}.`
      );
    }
    atomicCreateFixtureBytes(outputUrl, generatedBytes);
    return parsedGeneratedFixture;
  }
  const frozenBytes = readFileSync(outputUrl);
  const frozenSha256 = byteSha256(frozenBytes);
  if (
    frozenSha256 !==
    FROZEN_V144_FIXTURE_SHA256[
      "legacy-default-120s-1.44.golden.json"
    ]
  ) {
    throw new Error(
      `Frozen 1.44 default fixture changed: received ${frozenSha256}.`
    );
  }
  return legacyDefault120sGoldenFixtureV144Schema.parse(
    JSON.parse(frozenBytes.toString("utf8"))
  );
}

function makeLegacyDefaultV144CreationProbeFixture(
  frozenV142: LegacyDefaultV142Fixture
): LegacyDefaultV144Fixture {
  return legacyDefault120sGoldenFixtureV144Schema.parse({
    ...frozenV142,
    description: LEGACY_DEFAULT_V144_DESCRIPTION,
    provenance: {
      ...frozenV142.provenance,
      source: LEGACY_DEFAULT_V144_SOURCE,
      capturedAt: "2026-07-31",
      officialServerTruth: false,
      completeGcsimParity: false,
      note: LEGACY_DEFAULT_V144_NOTE
    },
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    configHash: "fnv1a32:dad42c01",
    reproducibilityKey: "gdl-v2-fnv1a32-03487d7e"
  });
}

function loadOrCreateLegacyDefaultV145Fixture(
  generatedFixture: LegacyDefaultV145Fixture,
  frozenV144: LegacyDefaultV144Fixture,
  options: {
    updateRequested?: boolean;
    outputUrl?: URL;
  } = {}
): LegacyDefaultV145Fixture {
  const updateRequested =
    options.updateRequested ??
    process.env[UPDATE_LEGACY_DEFAULT_V145_GOLDEN] === "1";
  const outputUrl =
    options.outputUrl ?? LEGACY_DEFAULT_V145_FIXTURE_URL;
  const sourceBytes = readFileSync(
    LEGACY_DEFAULT_V144_FIXTURE_URL
  );
  const sourceSha256 = byteSha256(sourceBytes);
  if (
    sourceSha256 !==
    FROZEN_V144_FIXTURE_SHA256[
      "legacy-default-120s-1.44.golden.json"
    ]
  ) {
    throw new Error(
      `Refusing to derive the 1.45 default fixture from an unfrozen 1.44 source: received ${sourceSha256}.`
    );
  }

  const validateCompatibility = (
    fixture: LegacyDefaultV145Fixture
  ): void => {
    const projected =
      projectLegacyDefaultV145ToFrozenV144(fixture);
    if (
      JSON.stringify(projected) !== JSON.stringify(frozenV144)
    ) {
      throw new Error(
        "The 1.45 default fixture changed the exact frozen 1.44 projection."
      );
    }
    if (
      fixture.reactionFormulaModel.profileId !==
      fixture.runManifest.reactionFormulaRoot.profileId
    ) {
      throw new Error(
        "The 1.45 default fixture formula selector is not bound to its manifest formula root."
      );
    }
  };

  if (updateRequested) {
    const parsedGeneratedFixture =
      legacyDefault120sGoldenFixtureV145Schema.parse(
        generatedFixture
      );
    validateCompatibility(parsedGeneratedFixture);
    const generatedBytes = serializeJsonFixture(
      parsedGeneratedFixture
    );
    const generatedSha256 = byteSha256(generatedBytes);
    if (generatedSha256 !== FROZEN_V145_FIXTURE_SHA256) {
      throw new Error(
        `Refusing to write the 1.45 default fixture because its generated bytes changed: received ${generatedSha256}.`
      );
    }
    atomicCreateFixtureBytes(outputUrl, generatedBytes);
    return parsedGeneratedFixture;
  }

  const frozenBytes = readFileSync(outputUrl);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== FROZEN_V145_FIXTURE_SHA256) {
    throw new Error(
      `Frozen 1.45 default fixture changed: received ${frozenSha256}.`
    );
  }
  const parsedFrozenFixture =
    legacyDefault120sGoldenFixtureV145Schema.parse(
      JSON.parse(frozenBytes.toString("utf8"))
    );
  validateCompatibility(parsedFrozenFixture);
  return parsedFrozenFixture;
}

function makeLegacyDefaultV145CreationProbeFixture(
  result: ReturnType<typeof simulate>,
  frozenV144: LegacyDefaultV144Fixture
): LegacyDefaultV145Fixture {
  const {
    directDamageGroupRoot: _directDamageGroupRoot,
    elementalApplicationIcdRoot:
      _elementalApplicationIcdRoot,
    reactionOwnedElementalApplicationRoot:
      _reactionOwnedElementalApplicationRoot,
    ...historicalRunManifest
  } = result.runManifest;
  return legacyDefault120sGoldenFixtureV145Schema.parse({
    ...frozenV144,
    description: LEGACY_DEFAULT_V145_DESCRIPTION,
    provenance: {
      source: LEGACY_DEFAULT_V145_SOURCE,
      capturedAt: "2026-08-01",
      verificationStatus: "provisional",
      note: LEGACY_DEFAULT_V145_NOTE,
      officialServerTruth: false,
      completeGcsimParity: false
    },
    schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
    engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
    configHash: LEGACY_DEFAULT_V145_CONFIG_HASH,
    reproducibilityKey:
      LEGACY_DEFAULT_V145_REPRODUCIBILITY_KEY,
    options: result.resolvedRuntimeOptions,
    totalDamage: result.totalDamage,
    dps: result.dps,
    hitCount: result.damageEvents.length,
    reactedHits: result.reactedHits,
    skippedActionCount: result.skippedActions.length,
    byCharacter: result.byCharacter,
    bySkill: result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    ),
    legacyDamageEventsSha256: sha256(
      projectCurrentDamageEventsToFrozenV146(
        result,
        projectCurrentConfigToFrozenV146(result.config)
      )
    ),
    reactionDeliveryModel: result.config.reactionDeliveryModel,
    electroChargedPropagationModel:
      result.config.electroChargedPropagationModel,
    targetClock: {
      config: result.config.targetClockModel,
      audit: result.targetClockAudit,
      clockLog: result.targetClockLog,
      hitlagLog: result.targetHitlagLog
    },
    targetTask: {
      config: result.config.targetTaskModel,
      phaseLog: result.targetTaskPhaseLog
    },
    targetPhaseLog: result.targetPhaseLog,
    reactionFormulaModel: result.config.reactionFormulaModel,
    runManifest: {
      ...historicalRunManifest,
      version: REACTION_FORMULA_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      configHash: LEGACY_DEFAULT_V145_CONFIG_HASH,
      reproducibilityKey:
        LEGACY_DEFAULT_V145_REPRODUCIBILITY_KEY
    }
  });
}

function stripV131QuickenLifecycleAudit(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      stripV131QuickenLifecycleAudit(entry)
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "quickenStateMutation")
        .map(([key, entry]) => [
          key,
          stripV131QuickenLifecycleAudit(entry)
        ])
    );
  }
  return value;
}

/**
 * 1.32 made the already-frozen counter-9 audit explicit (`false` instead of
 * `null`) so the strict output Schema can validate it. Normalize that
 * audit-only correction solely inside the 1.30 compatibility digest.
 */
function stripV132BurningSkipAuditCorrection(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      stripV132BurningSkipAuditCorrection(entry)
    );
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [
        key,
        key === "damageAllowed" &&
        entry === false &&
        record.operation === "tick-skipped" &&
        record.tickSkipped === true
          ? null
          : stripV132BurningSkipAuditCorrection(entry)
      ])
    );
  }
  return value;
}

function v130CompatibilityResult(
  result: ReturnType<typeof simulate>,
  reproducibilityKey: string,
  frozenConfig?: SimConfigV146
): unknown {
  const frozenDamageEvents =
    frozenConfig === undefined
      ? result.damageEvents
      : projectCurrentDamageEventsToFrozenV146(
          result,
          frozenConfig
        );
  const frozenHitResolutionLog = result.hitResolutionLog.map(
    (entry) => {
      const {
        reactionDamageLogId: _reactionDamageLogId,
        elementalApplicationIcdLogId:
          _elementalApplicationIcdLogId,
        ...withoutV148Backlinks
      } = entry;
      if (entry.resolutionKind !== "reaction-damage") {
        return withoutV148Backlinks;
      }
      const {
        eventPriority: _eventPriority,
        eventSequence: _eventSequence,
        intraEventSequence: _intraEventSequence,
        ...frozenEntry
      } = withoutV148Backlinks;
      return frozenEntry;
    }
  );
  const frozenReactionDamageLog = result.reactionDamageLog.map(
    ({
      hitResolutionLogIds: _hitResolutionLogIds,
      elementalApplicationIcdLogIds:
        _elementalApplicationIcdLogIds,
      ...frozenEntry
    }) => frozenEntry
  );
  const {
    targetStateTimeline: _targetStateTimeline,
    dendroCoreLog: _dendroCoreLog,
    dendroCoreContactLog: _dendroCoreContactLog,
    dendroCoreTimeline: _dendroCoreTimeline,
    playerHitResolutionLog: _playerHitResolutionLog,
    playerDamageEvents: _playerDamageEvents,
    playerHpTimeline: _playerHpTimeline,
    playerHpSummaries: _playerHpSummaries,
    playerSelfDamageStatus: _playerSelfDamageStatus,
    totalPlayerDamageTaken: _totalPlayerDamageTaken,
    totalReactionSelfDamageTaken:
      _totalReactionSelfDamageTaken,
    targetClockAudit: _targetClockAudit,
    targetClockLog: _targetClockLog,
    targetHitlagLog: _targetHitlagLog,
    targetTaskPhaseLog: _targetTaskPhaseLog,
    targetPhaseLog: _targetPhaseLog,
    directDamageGroupLog: _directDamageGroupLog,
    elementalApplicationIcdLog:
      _elementalApplicationIcdLog,
    runManifest: _runManifest,
    resolvedRuntimeOptions: _resolvedRuntimeOptions,
    pluginManifest: _pluginManifest,
    ...preDendroCoreResult
  } = result;
  // Versions and the reproducibility key intentionally change after migration;
  // restore only that envelope before comparing with the frozen 1.30 digest.
  return stripV131QuickenLifecycleAudit(
    stripV132BurningSkipAuditCorrection({
      ...preDendroCoreResult,
      damageEvents: frozenDamageEvents,
      hitEvents: frozenDamageEvents,
      hitResolutionLog: frozenHitResolutionLog,
      reactionDamageLog: frozenReactionDamageLog,
      schemaVersion: "1.30.0",
      engineVersion: "1.30.0-burning-reaction",
      reproducibilityKey,
      config: {
        ...Object.fromEntries(
          Object.entries(
            frozenConfig ?? preDendroCoreResult.config
          ).filter(
            ([key]) =>
              key !== "playerDamageModel" &&
              key !== "targetClockModel" &&
              key !== "targetTaskModel" &&
              key !== "reactionDeliveryModel" &&
              key !== "electroChargedPropagationModel" &&
              key !== "reactionFormulaModel" &&
              key !== "directDamageGroupModel" &&
              key !== "elementalApplicationIcdModel" &&
              key !==
                "reactionOwnedElementalApplicationModel"
          )
        ),
        schemaVersion: "1.30.0",
        engineVersion: "1.30.0-burning-reaction"
      }
    })
  );
}

function expectContiguousTargetStateTimelineIds(
  result: ReturnType<typeof simulate>
): void {
  expect(result.targetStateTimeline.version).toBe("1.0.0");
  expect(
    result.targetStateTimeline.points.map((point) => point.id)
  ).toEqual(
    Array.from(
      { length: result.targetStateTimeline.points.length },
      (_, index) => index
    )
  );
}

function expectNoDendroCoreOutput(
  result: ReturnType<typeof simulate>
): void {
  expect(result.dendroCoreLog).toEqual([]);
  expect(result.dendroCoreContactLog).toEqual([]);
  expect(result.dendroCoreTimeline).toEqual({
    version: "1.0.0",
    points: []
  });
  expect(
    result.damageEvents.every(
      (event) => event.reactionAudit.bloomReactions.length === 0
    )
  ).toBe(true);
}

function makeBurningGoldenConfig(): unknown {
  const base = makeConfig();
  const {
    reactionDeliveryModel: _reactionDeliveryModel,
    electroChargedPropagationModel:
      _electroChargedPropagationModel,
    reactionFormulaModel: _reactionFormulaModel,
    directDamageGroupModel: _directDamageGroupModel,
    elementalApplicationIcdModel:
      _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    ...v130Base
  } = base;
  return {
    ...v130Base,
    schemaVersion: burningGolden.config.schemaVersion,
    engineVersion: burningGolden.config.engineVersion,
    dataVersion: "burning-fixed-gcsim-cross-check-1",
    randomSeed: "burning-aura-v4-golden-seed",
    meta: {
      name: "Burning aura-v4 Golden",
      version: "1.30.0",
      verificationStatus: "provisional"
    },
    duration: 4.1,
    cycleLength: 4.1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "燃烧基线目标",
          position: { x: 0, y: 0 },
          initialAura: [
            {
              element: "dendro",
              gaugeUnits: 2
            }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro Golden",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v4"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "pyro-skill",
          actorId: "pyro",
          name: "Pyro Golden Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              label: "燃烧 Golden 触发命中",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "burning-golden",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "pyro-skill"
        }
      ]
    }
  };
}

function expectRelativeClose(
  actual: number,
  expected: number,
  tolerance = 1e-8
): void {
  const denominator = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / denominator).toBeLessThanOrEqual(
    tolerance
  );
}

describe("frozen versioned fixture integrity", () => {
  it("keeps every pre-1.37 foundation fixture byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_FOUNDATION_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps every 1.37–1.39 fixture byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_VERSIONED_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the three 1.40 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V140_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the two 1.41 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V141_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the 1.42 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V142_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the 1.44 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V144_FIXTURE_SHA256
    )) {
      const fixtureUrl = new URL(
        `../../../test-vectors/fixtures/${fileName}`,
        import.meta.url
      );
      if (
        fileName ===
          "legacy-default-120s-1.44.golden.json" &&
        process.env.UPDATE_LEGACY_DEFAULT_V144_GOLDEN ===
          "1" &&
        !existsSync(fileURLToPath(fixtureUrl))
      ) {
        continue;
      }
      const bytes = readFileSync(fixtureUrl);
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the 1.45 default release fixture byte-for-byte frozen", () => {
    if (
      process.env[UPDATE_LEGACY_DEFAULT_V145_GOLDEN] === "1" &&
      !existsSync(fileURLToPath(LEGACY_DEFAULT_V145_FIXTURE_URL))
    ) {
      return;
    }
    expect(
      byteSha256(readFileSync(LEGACY_DEFAULT_V145_FIXTURE_URL))
    ).toBe(FROZEN_V145_FIXTURE_SHA256);
  });
});

describe("default 1.44 Golden creation gate", () => {
  it("does not create a missing fixture without explicit UPDATE", () => {
    const frozenV142 = loadOrCreateLegacyDefaultV142Fixture();
    const generated =
      makeLegacyDefaultV144CreationProbeFixture(frozenV142);
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v144-no-update-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json")
    );
    try {
      expect(() =>
        loadOrCreateLegacyDefaultV144Fixture(
          generated,
          frozenV142,
          { updateRequested: false, outputUrl }
        )
      ).toThrow();
      expect(existsSync(fileURLToPath(outputUrl))).toBe(false);
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("validates the frozen SHA before an atomic UPDATE create", () => {
    const frozenV142 = loadOrCreateLegacyDefaultV142Fixture();
    const generated =
      makeLegacyDefaultV144CreationProbeFixture(frozenV142);
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v144-update-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json")
    );
    const driftedOutputUrl = pathToFileURL(
      resolve(probeDirectory, "drifted.golden.json")
    );
    try {
      expect(
        byteSha256(serializeJsonFixture(generated))
      ).toBe(
        FROZEN_V144_FIXTURE_SHA256[
          "legacy-default-120s-1.44.golden.json"
        ]
      );
      expect(
        loadOrCreateLegacyDefaultV144Fixture(
          generated,
          frozenV142,
          { updateRequested: true, outputUrl }
        )
      ).toEqual(generated);
      expect(
        byteSha256(readFileSync(outputUrl))
      ).toBe(
        FROZEN_V144_FIXTURE_SHA256[
          "legacy-default-120s-1.44.golden.json"
        ]
      );

      expect(() =>
        loadOrCreateLegacyDefaultV144Fixture(
          {
            ...generated,
            description: `${generated.description} drift`
          },
          frozenV142,
          {
            updateRequested: true,
            outputUrl: driftedOutputUrl
          }
        )
      ).toThrow(/generated bytes changed/);
      expect(existsSync(fileURLToPath(driftedOutputUrl))).toBe(
        false
      );
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("atomically refuses to overwrite an existing fixture", () => {
    const frozenV142 = loadOrCreateLegacyDefaultV142Fixture();
    const generated =
      makeLegacyDefaultV144CreationProbeFixture(frozenV142);
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v144-no-overwrite-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json")
    );
    try {
      writeFileSync(outputUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        loadOrCreateLegacyDefaultV144Fixture(
          generated,
          frozenV142,
          { updateRequested: true, outputUrl }
        )
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(outputUrl, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });
});

describe("default 1.45 Golden creation gate", () => {
  function makeProbe(): {
    generated: LegacyDefaultV145Fixture;
    frozenV144: LegacyDefaultV144Fixture;
  } {
    const frozenV142 = loadOrCreateLegacyDefaultV142Fixture();
    const generatedV144 =
      makeLegacyDefaultV144CreationProbeFixture(frozenV142);
    const frozenV144 = loadOrCreateLegacyDefaultV144Fixture(
      generatedV144,
      frozenV142
    );
    const result = simulate(durinMeltPreset, {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: "legacy-default"
    });
    return {
      generated: makeLegacyDefaultV145CreationProbeFixture(
        result,
        frozenV144
      ),
      frozenV144
    };
  }

  it("does not create a missing fixture without explicit UPDATE", () => {
    const { generated, frozenV144 } = makeProbe();
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v145-no-update-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json")
    );
    try {
      expect(() =>
        loadOrCreateLegacyDefaultV145Fixture(
          generated,
          frozenV144,
          { updateRequested: false, outputUrl }
        )
      ).toThrow();
      expect(existsSync(fileURLToPath(outputUrl))).toBe(false);
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("validates frozen source and output SHAs before atomic creation", () => {
    const { generated, frozenV144 } = makeProbe();
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v145-update-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json")
    );
    const driftedOutputUrl = pathToFileURL(
      resolve(probeDirectory, "drifted.golden.json")
    );
    try {
      expect(byteSha256(serializeJsonFixture(generated))).toBe(
        FROZEN_V145_FIXTURE_SHA256
      );
      expect(
        loadOrCreateLegacyDefaultV145Fixture(
          generated,
          frozenV144,
          { updateRequested: true, outputUrl }
        )
      ).toEqual(generated);
      expect(byteSha256(readFileSync(outputUrl))).toBe(
        FROZEN_V145_FIXTURE_SHA256
      );

      expect(() =>
        loadOrCreateLegacyDefaultV145Fixture(
          { ...generated, totalDamage: generated.totalDamage + 1 },
          frozenV144,
          {
            updateRequested: true,
            outputUrl: driftedOutputUrl
          }
        )
      ).toThrow();
      expect(existsSync(fileURLToPath(driftedOutputUrl))).toBe(
        false
      );
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("atomically refuses to overwrite an existing fixture", () => {
    const { generated, frozenV144 } = makeProbe();
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v145-no-overwrite-")
    );
    const outputUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json")
    );
    try {
      writeFileSync(outputUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        loadOrCreateLegacyDefaultV145Fixture(
          generated,
          frozenV144,
          { updateRequested: true, outputUrl }
        )
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(outputUrl, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(probeDirectory, {
        recursive: true,
        force: true
      });
    }
  });
});

describe("1.44 identity migration release gate", () => {
  function makeHistoricalV141Config(
    propagation:
      | { mode: "single-target-v1" }
      | {
          mode: "nearby-wet-radius-v1";
          radius: number;
          verificationStatus: "provisional";
        }
  ) {
    const current = makeConfig({
      enemy: {
        level: 110,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "Migration target",
            position: { x: 0, y: 0 },
            hitboxRadius: 0
          }
        ]
      },
      reactionEngine: { mode: "aura-v8" },
      targetTaskModel: { mode: "target-phase-v2" },
      electroChargedPropagationModel: propagation,
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 1,
        abilities: [],
        commands: []
      }
    });
    const frozenV146 =
      projectCurrentConfigToFrozenV146(current);
    const {
      reactionFormulaModel: _reactionFormulaModel,
      directDamageGroupModel: _directDamageGroupModel,
      ...historical
    } = frozenV146;
    return {
      ...historical,
      schemaVersion:
        EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
      engineVersion:
        EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION
    };
  }

  for (const propagation of [
    { mode: "single-target-v1" as const },
    {
      mode: "nearby-wet-radius-v1" as const,
      radius: 5,
      verificationStatus: "provisional" as const
    }
  ]) {
    it(`migrates exact 1.41 ${propagation.mode} by adding the pinned formula profile`, () => {
      const historical =
        makeHistoricalV141Config(propagation);
      const before = structuredClone(historical);
      expect(migrateConfig(historical)).toEqual({
        ...historical,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        reactionFormulaModel:
          makeConfig().reactionFormulaModel,
        directDamageGroupModel:
          makeConfig().directDamageGroupModel,
        elementalApplicationIcdModel:
          makeConfig().elementalApplicationIcdModel,
        reactionOwnedElementalApplicationModel:
          makeConfig().reactionOwnedElementalApplicationModel
      });
      expect(historical).toEqual(before);
    });
  }

  it("rejects aura-v9 under 1.41 while exact current identity may explicitly retain aura-v8", () => {
    const historical = makeHistoricalV141Config({
      mode: "single-target-v1"
    });
    expect(() =>
      migrateConfig({
        ...historical,
        reactionEngine: { mode: "aura-v9" }
      })
    ).toThrow(
      /schemaVersion "1\.41\.0" does not support "aura-v9"/
    );
    const currentAuraV8 = {
      ...historical,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionFormulaModel: makeConfig().reactionFormulaModel,
      directDamageGroupModel:
        makeConfig().directDamageGroupModel,
      elementalApplicationIcdModel:
        makeConfig().elementalApplicationIcdModel,
      reactionOwnedElementalApplicationModel:
        makeConfig().reactionOwnedElementalApplicationModel
    };
    expect(migrateConfig(currentAuraV8)).toEqual(
      currentAuraV8
    );
    expect(
      migrateConfig(currentAuraV8).reactionEngine?.mode
    ).toBe("aura-v8");
  });
});

describe("Vanilla v0.1 golden compatibility", () => {
  it("matches the full default 120-second baseline", () => {
    const options = {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: golden.options.randomSeed
    } as const;
    const result = simulate(durinMeltPreset, options);
    const repeated = simulate(durinMeltPreset, options);
    expect(repeated).toEqual(result);
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    expect(
      playerDamageResultReferencesSchema.parse(repeated)
    ).toEqual(repeated);
    const projectedBySkill = result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    );
    const goldenV140 =
      loadFrozenLegacyDefaultV140Fixture();
    const goldenV141 =
      loadFrozenLegacyDefaultV141Fixture();
    const goldenV142 =
      loadOrCreateLegacyDefaultV142Fixture();
    const parsedGeneratedV144Fixture =
      makeLegacyDefaultV144CreationProbeFixture(goldenV142);
    expect(parsedGeneratedV144Fixture).toMatchObject({
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f",
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      },
      provenance: {
        verificationStatus: "provisional",
        officialServerTruth: false,
        completeGcsimParity: false
      }
    });
    expect(
      projectLegacyDefaultCompatibilitySemantics(
        parsedGeneratedV144Fixture
      )
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV142)
    );
    expect(
      byteSha256(
        serializeJsonFixture(parsedGeneratedV144Fixture)
      ),
      "generated default 1.44 fixture bytes"
    ).toBe(
      FROZEN_V144_FIXTURE_SHA256[
        "legacy-default-120s-1.44.golden.json"
      ]
    );
    const goldenV144 =
      process.env.UPDATE_LEGACY_DEFAULT_V144_GOLDEN === "1"
        ? parsedGeneratedV144Fixture
        : loadOrCreateLegacyDefaultV144Fixture(
            parsedGeneratedV144Fixture,
            goldenV142
          );
    expect(simulationResultSchema.parse(result)).toEqual(
      result
    );
    expect(assertTrustedSimulationResult(result)).toBe(
      result
    );
    const parsedGeneratedV145Fixture =
      makeLegacyDefaultV145CreationProbeFixture(
        result,
        goldenV144
      );
    const goldenV145 =
      process.env[UPDATE_LEGACY_DEFAULT_V145_GOLDEN] === "1"
        ? parsedGeneratedV145Fixture
        : loadOrCreateLegacyDefaultV145Fixture(
            parsedGeneratedV145Fixture,
            goldenV144
          );
    expect(
      legacyDefault120sGoldenFixtureV142Schema.parse(
        goldenV142
      )
    ).toEqual(goldenV142);
    expect(
      legacyDefault120sGoldenFixtureV144Schema.parse(
        goldenV144
      )
    ).toEqual(goldenV144);
    expect(
      legacyDefault120sGoldenFixtureV145Schema.parse(
        goldenV145
      )
    ).toEqual(goldenV145);

    expectRelativeClose(result.totalDamage, golden.totalDamage);
    expectRelativeClose(result.dps, golden.dps);
    expect(goldenV133).toMatchObject({
      schemaVersion: "1.33.0",
      engineVersion: "1.33.0-target-local-hitlag",
      configHash: "fnv1a32:d250e585",
      reproducibilityKey: "gdl-v2-fnv1a32-7cbda09a"
    });
    expect(goldenV134).toMatchObject({
      schemaVersion: "1.34.0",
      engineVersion: "1.34.0-general-reaction-order",
      configHash: "fnv1a32:3a65d70b",
      reproducibilityKey: "gdl-v2-fnv1a32-1e62160a"
    });
    expect(goldenV135).toMatchObject({
      schemaVersion: "1.35.0",
      engineVersion: "1.35.0-elemental-enemy-resistance",
      configHash: "fnv1a32:cdbc3848",
      reproducibilityKey: "gdl-v2-fnv1a32-463ccabe"
    });
    expect(goldenV136).toMatchObject({
      schemaVersion: "1.36.0",
      engineVersion: "1.36.0-quicken-bloom-task",
      configHash: "fnv1a32:27198160",
      reproducibilityKey: "gdl-v2-fnv1a32-6c78b58b"
    });
    expect(goldenV137).toMatchObject({
      schemaVersion: "1.37.0",
      engineVersion: "1.37.0-target-task-phase",
      configHash: "fnv1a32:433ad3f2",
      reproducibilityKey: "gdl-v2-fnv1a32-7e16aaa2"
    });
    expect(goldenV138).toMatchObject({
      schemaVersion: "1.38.0",
      engineVersion: "1.38.0-target-reactable-phase",
      configHash: "fnv1a32:ac06871e",
      reproducibilityKey: "gdl-v2-fnv1a32-b4ba6a29"
    });
    expect(goldenV139).toMatchObject({
      schemaVersion: "1.39.0",
      engineVersion: "1.39.0-shatter-recursive-delivery",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      }
    });
    expect(goldenV140).toMatchObject({
      schemaVersion: "1.40.0",
      engineVersion:
        "1.40.0-ec-next-target-tick-cleanup",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      }
    });
    expect(goldenV141).toMatchObject({
      schemaVersion: "1.41.0",
      engineVersion:
        "1.41.0-ec-secondary-wet-propagation",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      },
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f"
    });
    expect(goldenV142).toMatchObject({
      schemaVersion: "1.42.0",
      engineVersion: "1.42.0-ec-global-cadence-safety",
      configHash: "fnv1a32:c8eef2e4",
      reproducibilityKey: "gdl-v2-fnv1a32-e3fa9efe",
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      },
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f"
    });
    expect(goldenV144).toMatchObject({
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
      configHash: "fnv1a32:dad42c01",
      reproducibilityKey: "gdl-v2-fnv1a32-03487d7e",
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      },
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f",
      provenance: {
        verificationStatus: "provisional",
        officialServerTruth: false,
        completeGcsimParity: false
      }
    });
    expect(goldenV145).toMatchObject({
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      configHash: LEGACY_DEFAULT_V145_CONFIG_HASH,
      reproducibilityKey:
        LEGACY_DEFAULT_V145_REPRODUCIBILITY_KEY,
      reactionFormulaModel: result.config.reactionFormulaModel,
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f",
      provenance: {
        verificationStatus: "provisional",
        officialServerTruth: false,
        completeGcsimParity: false
      }
    });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(result.config.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(result.config.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(goldenV145.options).toEqual(goldenV144.options);
    expect(goldenV144.options).toEqual(goldenV142.options);
    expect(goldenV142.options).toEqual(goldenV141.options);
    expect(goldenV141.options).toEqual(goldenV140.options);
    expect(goldenV140.options).toEqual(goldenV139.options);
    expect(goldenV139.options).toEqual(goldenV138.options);
    expect(goldenV138.options).toEqual(goldenV137.options);
    expect(goldenV137.options).toEqual(goldenV136.options);
    expect(goldenV136.options).toEqual(goldenV135.options);
    expect(goldenV135.options).toEqual(golden.options);
    expect(goldenV135.options).toEqual(goldenV134.options);
    expect(goldenV134.options).toEqual(goldenV133.options);
    expect(goldenV135.legacyDamageEventsSha256).toBe(
      goldenV134.legacyDamageEventsSha256
    );
    expect(goldenV135.legacyDamageEventsSha256).toBe(
      goldenV133.legacyDamageEventsSha256
    );
    expect(goldenV138.legacyDamageEventsSha256).toBe(
      goldenV137.legacyDamageEventsSha256
    );
    expect(goldenV139.legacyDamageEventsSha256).toBe(
      goldenV138.legacyDamageEventsSha256
    );
    expect(goldenV140.legacyDamageEventsSha256).toBe(
      goldenV139.legacyDamageEventsSha256
    );
    expect(goldenV141.legacyDamageEventsSha256).toBe(
      goldenV140.legacyDamageEventsSha256
    );
    expect(goldenV142.legacyDamageEventsSha256).toBe(
      goldenV141.legacyDamageEventsSha256
    );
    expect(goldenV144.legacyDamageEventsSha256).toBe(
      goldenV142.legacyDamageEventsSha256
    );
    expect(goldenV145.legacyDamageEventsSha256).toBe(
      goldenV144.legacyDamageEventsSha256
    );
    expect(result.runManifest).toMatchObject({
      version: SIMULATION_RUN_MANIFEST_VERSION,
      identityAlgorithm: "fnv1a32-v2",
      configHash: expect.stringMatching(
        /^fnv1a32:[0-9a-f]{8}$/
      ),
      resolvedRuntimeOptions: {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: golden.options.randomSeed
      },
      plugins: [],
      reactionFormulaRoot:
        goldenV145.runManifest.reactionFormulaRoot,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      reproducibilityKey:
        result.reproducibilityKey
    });
    expect(
      reactionFormulaRootSchema.parse(
        result.runManifest.reactionFormulaRoot
      )
    ).toEqual(result.runManifest.reactionFormulaRoot);
    expect(result.config.reactionFormulaModel).toEqual(
      goldenV145.reactionFormulaModel
    );
    expect(result.resolvedRuntimeOptions).toBe(
      result.runManifest.resolvedRuntimeOptions
    );
    expect(result.pluginManifest).toBe(
      result.runManifest.plugins
    );
    expect(
      sha256(
        projectCurrentDamageEventsToFrozenV146(
          result,
          projectCurrentConfigToFrozenV146(result.config)
        )
      )
    ).toBe(goldenV145.legacyDamageEventsSha256);
    expect(result.config.targetClockModel).toEqual(
      { mode: "disabled" }
    );
    expect(result.targetClockAudit).toEqual({
      version: "1.0.0",
      mode: "disabled",
      hitlagStatus: "unsupported-enemy-hitlag",
      targets: []
    });
    expect(result.targetClockLog).toEqual(
      goldenV145.targetClock.clockLog
    );
    expect(result.targetHitlagLog).toEqual(
      goldenV145.targetClock.hitlagLog
    );
    expect(result.config.targetTaskModel).toEqual(
      goldenV145.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual(
      goldenV145.targetTask.phaseLog
    );
    expect(result.targetPhaseLog).toEqual(
      goldenV145.targetPhaseLog
    );
    expect(result.config.reactionDeliveryModel).toEqual(
      goldenV145.reactionDeliveryModel
    );
    expect(result.config.electroChargedPropagationModel).toEqual(
      goldenV145.electroChargedPropagationModel
    );
    expect(result.config.reactionEngine?.mode).not.toBe(
      "aura-v9"
    );
    expect(
      projectLegacyDefaultCompatibilitySemantics(goldenV145)
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV144)
    );
    expect(
      projectLegacyDefaultCompatibilitySemantics(goldenV144)
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV142)
    );
    expect(goldenV144.electroChargedPropagationModel).toEqual(
      goldenV142.electroChargedPropagationModel
    );
    expect(
      projectLegacyDefaultCompatibilitySemantics(goldenV142)
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV141)
    );
    expect(
      projectLegacyDefaultCompatibilitySemantics(goldenV141)
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV140)
    );
    expect(goldenV141.targetTask).toEqual(goldenV140.targetTask);
    expect(goldenV141.targetPhaseLog).toEqual(
      goldenV140.targetPhaseLog
    );
    expect(goldenV141.reactionDeliveryModel).toEqual(
      goldenV140.reactionDeliveryModel
    );
    expect(goldenV140.targetTask).toEqual(goldenV139.targetTask);
    expect(goldenV140.targetPhaseLog).toEqual(
      goldenV139.targetPhaseLog
    );
    expect(goldenV140.reactionDeliveryModel).toEqual(
      goldenV139.reactionDeliveryModel
    );
    expect(goldenV139.targetTask).toEqual(goldenV138.targetTask);
    expect(goldenV139.targetPhaseLog).toEqual(
      goldenV138.targetPhaseLog
    );
    expect(goldenV138.targetTask).toEqual(goldenV137.targetTask);
    expect(goldenV138.targetPhaseLog).toEqual([]);
    expect(
      sha256(
        v130CompatibilityResult(
          result,
          LEGACY_V130_REPRODUCIBILITY_KEY,
          projectCurrentConfigToFrozenV146(result.config)
        )
      )
    ).toBe(
      LEGACY_V130_COMPATIBILITY_SHA256
    );
    expectNoDendroCoreOutput(result);
    expectContiguousTargetStateTimelineIds(result);
    expect(result.actorPoses).toEqual([]);
    expect(result.enemyTargets).toEqual([
      {
        id: "enemy-0",
        name: "敌人 0",
        level: durinMeltPreset.enemy.level,
        resistance: durinMeltPreset.enemy.resistance,
        defReduction: durinMeltPreset.enemy.defReduction,
        freezeResistance: 0,
        initialAura: [],
        position: null,
        hitboxRadius: 0
      }
    ]);
    expect(result.damageEvents).toHaveLength(golden.hitCount);
    expect(result.hitResolutionLog).toHaveLength(golden.hitCount);
    expect(
      result.hitResolutionLog.every(
        (entry, index) =>
          entry.landed &&
          entry.outcome === "landed" &&
          entry.targetId === "enemy-0" &&
          entry.targetName === "敌人 0" &&
          entry.targetingSource === "default" &&
          entry.targetPosition === null &&
          entry.sourceActorPosition === null &&
          entry.sourceActorFacingDegrees === null &&
          entry.geometryKind === null &&
          entry.geometryCoordinateSpace === null &&
          entry.geometryOrigin === null &&
          entry.geometryStart === null &&
          entry.geometryEnd === null &&
          entry.geometryRadius === null &&
          entry.geometryHalfWidth === null &&
          entry.geometryHalfHeight === null &&
          entry.geometryRotationDegrees === null &&
          entry.geometryDirectionDegrees === null &&
          entry.geometryAngleDegrees === null &&
          entry.geometryDistance === null &&
          entry.geometryThreshold === null &&
          entry.targetIndex === 0 &&
          entry.targetCount === 1 &&
          entry.damageEventId === index &&
          entry.hitGroupId === result.damageEvents[index]?.hitGroupId &&
          entry.displayDamage === result.damageEvents[index]?.displayDamage
      )
    ).toBe(true);
    expect(result.targetMotionTimeline).toEqual([]);
    expect(result.auraInitialStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        frame: 0,
        timeSeconds: 0,
        aura: []
      }
    ]);
    expect(result.auraEndStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        frame: 7200,
        timeSeconds: 120,
        aura: []
      }
    ]);
    expect(result.damageCurve).toHaveLength(golden.hitCount);
    expect(
      result.damageCurve.every(
        (point) =>
          point.targetId === "enemy-0" &&
          point.targetName === "敌人 0"
      )
    ).toBe(true);
    expect(result.damageCurve.at(-1)?.cumulativeDamage).toBeCloseTo(
      result.totalDamage,
      8
    );
    expect(result.targetSummaries).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        damage: result.totalDamage,
        potentialDamage: result.totalDamage,
        damageEvents: golden.hitCount,
        landedChecks: golden.hitCount,
        missedChecks: 0,
        immuneDamageEvents: 0,
        dps: result.dps,
        share: 1
      }
    ]);
    expect(result.reactedHits).toBe(golden.reactedHits);
    expect(result.skippedActions).toHaveLength(golden.skippedActionCount);
    expect(result.totalDamage).toBe(goldenV145.totalDamage);
    expect(result.dps).toBe(goldenV145.dps);
    expect(result.damageEvents).toHaveLength(
      goldenV145.hitCount
    );
    expect(result.reactedHits).toBe(goldenV145.reactedHits);
    expect(result.skippedActions).toHaveLength(
      goldenV145.skippedActionCount
    );
    expect(result.byCharacter).toEqual(
      goldenV145.byCharacter
    );
    expect(projectedBySkill).toEqual(goldenV145.bySkill);
    expect(goldenV145.totalDamage).toBe(goldenV144.totalDamage);
    expect(goldenV145.dps).toBe(goldenV144.dps);
    expect(goldenV145.hitCount).toBe(goldenV144.hitCount);
    expect(goldenV145.reactedHits).toBe(goldenV144.reactedHits);
    expect(goldenV145.skippedActionCount).toBe(
      goldenV144.skippedActionCount
    );
    expect(goldenV145.byCharacter).toEqual(
      goldenV144.byCharacter
    );
    expect(goldenV145.bySkill).toEqual(goldenV144.bySkill);
    expect(goldenV144.totalDamage).toBe(goldenV142.totalDamage);
    expect(goldenV144.dps).toBe(goldenV142.dps);
    expect(goldenV144.hitCount).toBe(goldenV142.hitCount);
    expect(goldenV144.reactedHits).toBe(
      goldenV142.reactedHits
    );
    expect(goldenV144.skippedActionCount).toBe(
      goldenV142.skippedActionCount
    );
    expect(goldenV144.byCharacter).toEqual(
      goldenV142.byCharacter
    );
    expect(goldenV144.bySkill).toEqual(goldenV142.bySkill);
    expect(goldenV142.totalDamage).toBe(goldenV141.totalDamage);
    expect(goldenV142.dps).toBe(goldenV141.dps);
    expect(goldenV142.hitCount).toBe(goldenV141.hitCount);
    expect(goldenV142.reactedHits).toBe(
      goldenV141.reactedHits
    );
    expect(goldenV142.skippedActionCount).toBe(
      goldenV141.skippedActionCount
    );
    expect(goldenV142.byCharacter).toEqual(
      goldenV141.byCharacter
    );
    expect(goldenV142.bySkill).toEqual(goldenV141.bySkill);
    expect(goldenV141.totalDamage).toBe(goldenV140.totalDamage);
    expect(goldenV141.dps).toBe(goldenV140.dps);
    expect(goldenV141.hitCount).toBe(goldenV140.hitCount);
    expect(goldenV141.reactedHits).toBe(
      goldenV140.reactedHits
    );
    expect(goldenV141.skippedActionCount).toBe(
      goldenV140.skippedActionCount
    );
    expect(goldenV141.byCharacter).toEqual(
      goldenV140.byCharacter
    );
    expect(goldenV141.bySkill).toEqual(goldenV140.bySkill);
    expect(goldenV140.totalDamage).toBe(goldenV139.totalDamage);
    expect(goldenV140.dps).toBe(goldenV139.dps);
    expect(goldenV140.hitCount).toBe(goldenV139.hitCount);
    expect(goldenV140.reactedHits).toBe(goldenV139.reactedHits);
    expect(goldenV140.skippedActionCount).toBe(
      goldenV139.skippedActionCount
    );
    expect(goldenV140.byCharacter).toEqual(
      goldenV139.byCharacter
    );
    expect(goldenV140.bySkill).toEqual(goldenV139.bySkill);
    expect(goldenV139.totalDamage).toBe(goldenV138.totalDamage);
    expect(goldenV139.dps).toBe(goldenV138.dps);
    expect(goldenV139.hitCount).toBe(goldenV138.hitCount);
    expect(goldenV139.reactedHits).toBe(goldenV138.reactedHits);
    expect(goldenV139.skippedActionCount).toBe(
      goldenV138.skippedActionCount
    );
    expect(goldenV139.byCharacter).toEqual(
      goldenV138.byCharacter
    );
    expect(goldenV139.bySkill).toEqual(goldenV138.bySkill);
    expect(goldenV138.totalDamage).toBe(goldenV137.totalDamage);
    expect(goldenV138.dps).toBe(goldenV137.dps);
    expect(goldenV138.hitCount).toBe(goldenV137.hitCount);
    expect(goldenV138.reactedHits).toBe(goldenV137.reactedHits);
    expect(goldenV138.skippedActionCount).toBe(
      goldenV137.skippedActionCount
    );
    expect(goldenV138.byCharacter).toEqual(
      goldenV137.byCharacter
    );
    expect(goldenV138.bySkill).toEqual(goldenV137.bySkill);
    expect(goldenV137.totalDamage).toBe(goldenV136.totalDamage);
    expect(goldenV137.dps).toBe(goldenV136.dps);
    expect(goldenV137.hitCount).toBe(goldenV136.hitCount);
    expect(goldenV137.reactedHits).toBe(goldenV136.reactedHits);
    expect(goldenV137.skippedActionCount).toBe(
      goldenV136.skippedActionCount
    );
    expect(goldenV137.byCharacter).toEqual(
      goldenV136.byCharacter
    );
    expect(goldenV137.bySkill).toEqual(goldenV136.bySkill);
    expect(goldenV136.totalDamage).toBe(goldenV135.totalDamage);
    expect(goldenV136.dps).toBe(goldenV135.dps);
    expect(goldenV136.hitCount).toBe(goldenV135.hitCount);
    expect(goldenV136.reactedHits).toBe(goldenV135.reactedHits);
    expect(goldenV136.skippedActionCount).toBe(
      goldenV135.skippedActionCount
    );
    expect(goldenV136.byCharacter).toEqual(
      goldenV135.byCharacter
    );
    expect(goldenV136.bySkill).toEqual(goldenV135.bySkill);
    expect(goldenV135.totalDamage).toBe(goldenV134.totalDamage);
    expect(goldenV135.dps).toBe(goldenV134.dps);
    expect(goldenV135.hitCount).toBe(goldenV134.hitCount);
    expect(goldenV135.reactedHits).toBe(goldenV134.reactedHits);
    expect(goldenV135.skippedActionCount).toBe(
      goldenV134.skippedActionCount
    );
    expect(goldenV135.byCharacter).toEqual(
      goldenV134.byCharacter
    );
    expect(goldenV135.bySkill).toEqual(goldenV134.bySkill);
    expect(goldenV134.totalDamage).toBe(goldenV133.totalDamage);
    expect(goldenV134.dps).toBe(goldenV133.dps);
    expect(goldenV134.hitCount).toBe(goldenV133.hitCount);
    expect(goldenV134.reactedHits).toBe(goldenV133.reactedHits);
    expect(goldenV134.skippedActionCount).toBe(
      goldenV133.skippedActionCount
    );
    expect(goldenV134.byCharacter).toEqual(
      goldenV133.byCharacter
    );
    expect(goldenV134.bySkill).toEqual(goldenV133.bySkill);
    expect(result.burningStateLog).toEqual([]);
    expect(
      result.damageEvents.filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "burning"
      )
    ).toEqual([]);
    expect(
      result.damageCurve.every(
        (point) =>
          (point.cumulativeByReaction.burning ?? 0) === 0
      )
    ).toBe(true);

    for (const [characterId, expectedDamage] of Object.entries(
      golden.byCharacter
    )) {
      expectRelativeClose(
        result.byCharacter[characterId] ?? 0,
        expectedDamage
      );
    }

    expect(result.bySkill).toHaveLength(golden.bySkill.length);
    golden.bySkill.forEach((expectedSkill, index) => {
      const actualSkill = result.bySkill[index];
      expect(actualSkill?.creditId).toBe(expectedSkill.creditId);
      expect(actualSkill?.actionName).toBe(expectedSkill.actionName);
      expect(actualSkill?.hits).toBe(expectedSkill.hits);
      expectRelativeClose(
        actualSkill?.damage ?? 0,
        expectedSkill.damage
      );
    });

    expect(
      result.skippedActions.map(
        ({ time, actorId, action, reason, cycle }) => ({
          time,
          actorId,
          action,
          reason,
          cycle
        })
      )
    ).toEqual(golden.skippedActions);

    expect(repeated.reproducibilityKey).toBe(
      result.reproducibilityKey
    );
    expect(repeated.damageEvents).toEqual(result.damageEvents);
    expect(repeated.targetStateTimeline).toEqual(
      result.targetStateTimeline
    );
    expectContiguousTargetStateTimelineIds(repeated);
    if (
      process.env.UPDATE_LEGACY_DEFAULT_V144_GOLDEN ===
      "1"
    ) {
      expect(
        loadOrCreateLegacyDefaultV144Fixture(
          parsedGeneratedV144Fixture,
          goldenV142
        )
      ).toEqual(parsedGeneratedV144Fixture);
    }
    if (
      process.env[UPDATE_LEGACY_DEFAULT_V145_GOLDEN] === "1"
    ) {
      expect(
        loadOrCreateLegacyDefaultV145Fixture(
          parsedGeneratedV145Fixture,
          goldenV144
        )
      ).toEqual(parsedGeneratedV145Fixture);
    }
  });
});

describe("Burning aura-v4 provisional golden", () => {
  it("matches the fixed-gcsim-code-cross-check lifecycle and damage vector", () => {
    const options = {
      energyMode: "configured" as const,
      critMode: "noCrit" as const,
      compatibilityMode: "legal-frame-v1" as const,
      randomSeed: burningGolden.options.randomSeed
    };
    expect(burningGolden.options).toEqual(options);
    const input = makeBurningGoldenConfig();
    expect(input).toMatchObject({
      schemaVersion: "1.30.0",
      engineVersion: "1.30.0-burning-reaction",
      reactionEngine: { mode: "aura-v4" }
    });
    const result = simulate(input, options);
    const frozenV146Config =
      projectCurrentConfigToFrozenV146(result.config, input);
    const frozenV146Manifest =
      projectCurrentManifestToFrozenV146(
        result,
        frozenV146Config
      );
    const frozenV146DamageEvents =
      projectCurrentDamageEventsToFrozenV146(
        result,
        frozenV146Config
      );
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    expect(simulationResultSchema.parse(result)).toEqual(
      result
    );
    expect(assertTrustedSimulationResult(result)).toBe(
      result
    );
    expect(frozenV146Manifest.configHash).toBe(
      BURNING_V146_CONFIG_HASH
    );

    expect(burningGolden.config.schemaVersion).toBe("1.30.0");
    expect(burningGolden.config.engineVersion).toBe(
      "1.30.0-burning-reaction"
    );
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(result.config.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(result.config.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(result.config.reactionEngine?.mode).toBe("aura-v4");
    expect(result.config.targetClockModel).toEqual(
      goldenV139.targetClock.config
    );
    expect(result.targetClockAudit).toEqual(
      goldenV139.targetClock.audit
    );
    expect(result.targetClockLog).toEqual([]);
    expect(result.targetHitlagLog).toEqual([]);
    expect(result.config.targetTaskModel).toEqual(
      goldenV139.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual([]);
    expect(result.targetPhaseLog).toEqual([]);
    expect(result.config.reactionDeliveryModel).toEqual(
      goldenV139.reactionDeliveryModel
    );
    expect(result.dataVersion).toBe(
      burningGolden.config.dataVersion
    );
    expect(burningGolden.reproducibilityKey).toBe(
      "gdl-37da25f5"
    );
    expect(frozenV146Manifest.reproducibilityKey).toBe(
      BURNING_V146_REPRODUCIBILITY_KEY
    );
    expect(result.runManifest).toMatchObject({
      version: SIMULATION_RUN_MANIFEST_VERSION,
      identityAlgorithm: "fnv1a32-v2",
      configHash: expect.stringMatching(
        /^fnv1a32:[0-9a-f]{8}$/
      ),
      resolvedRuntimeOptions: options,
      plugins: [],
      reactionFormulaRoot:
        result.runManifest.reactionFormulaRoot,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      reproducibilityKey:
        result.reproducibilityKey
    });
    expect(frozenV146Manifest).toMatchObject({
      version: DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
      identityAlgorithm: "fnv1a32-v2",
      schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      configHash: BURNING_V146_CONFIG_HASH,
      resolvedRuntimeOptions: options,
      plugins: [],
      reactionFormulaRoot:
        result.runManifest.reactionFormulaRoot,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      reproducibilityKey:
        BURNING_V146_REPRODUCIBILITY_KEY
    });
    expect(sha256(frozenV146DamageEvents)).toBe(
      BURNING_DAMAGE_EVENTS_SHA256
    );
    expect(sha256(result.burningStateLog)).toBe(
      BURNING_STATE_LOG_SHA256
    );
    const v130Probe = v130CompatibilityResult(
          {
            ...result,
            damageEvents: frozenV146DamageEvents,
            hitEvents: frozenV146DamageEvents
          },
          burningGolden.reproducibilityKey,
          frozenV146Config
        );
    expect(sha256(v130Probe)).toBe(
      BURNING_V130_COMPATIBILITY_SHA256
    );
    expectNoDendroCoreOutput(result);
    expectContiguousTargetStateTimelineIds(result);
    expectRelativeClose(
      result.totalDamage,
      burningGolden.totalDamage
    );
    expectRelativeClose(result.dps, burningGolden.dps);
    expect(result.damageEvents).toHaveLength(
      burningGolden.hitCount
    );
    expect(result.reactedHits).toBe(burningGolden.reactedHits);

    const burningDamageEvents = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    expect(burningDamageEvents).toHaveLength(
      burningGolden.burningDamageEventCount
    );
    expect(
      burningDamageEvents.map((event) => event.frame)
    ).toEqual(burningGolden.cadence.tickFrames);
    expect(
      burningDamageEvents.every(
        (event) =>
          Math.abs(
            event.finalDamage -
              burningGolden.burningDamagePerTick
          ) < 1e-10 &&
          event.sourceActorId ===
            burningGolden.owners.damageSourceActorId &&
          event.creditOwnerId ===
            burningGolden.owners.creditOwnerId
      )
    ).toBe(true);

    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick-skipped")
        .map((entry) => entry.frame)
    ).toEqual(burningGolden.cadence.skippedFrames);
    expect(
      result.burningStateLog.map(({ frame, operation }) => ({
        frame,
        operation
      }))
    ).toEqual(burningGolden.cadence.operationFrames);
    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => entry.fuelGaugeUnitsAfter)
    ).toEqual(burningGolden.fuel.tickGaugeUnitsAfter);

    const start = result.burningStateLog[0]!;
    const skipped = result.burningStateLog.find(
      (entry) => entry.operation === "tick-skipped"
    )!;
    const finalTick = result.burningStateLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.frame === burningGolden.curve.lastFrame
    )!;
    const expiry = result.burningStateLog.at(-1)!;
    expect(start).toMatchObject({
      operation: "start",
      damageSourceActorId:
        burningGolden.owners.damageSourceActorId,
      fuelSourceActorId:
        burningGolden.owners.fuelSourceActorId,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.startGaugeUnits,
      fuelExpiresAtFrame:
        burningGolden.fuel.expiresAtFrame
    });
    expect(skipped).toMatchObject({
      tickIndex: burningGolden.cadence.skippedTickIndex,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.skippedTickGaugeUnitsAfter
    });
    expect(finalTick.fuelGaugeUnitsAfter).toBe(
      burningGolden.fuel.finalTickGaugeUnitsAfter
    );
    expect(expiry).toMatchObject({
      operation: "fuel-expire",
      frame: burningGolden.fuel.expiresAtFrame,
      fuelGaugeUnitsBefore:
        burningGolden.fuel.expiryGaugeUnitsBefore,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.expiryGaugeUnitsAfter,
      reason: "FUEL_EXPIRED"
    });
    expect(result.auraInitialStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "燃烧基线目标",
        frame: 0,
        timeSeconds: 0,
        aura: [
          {
            element: "dendro",
            gaugeUnits: 1.6,
            expiresAtFrame: 720,
            sourceSlots: [
              {
                sourceActorId: "__initial__",
                gaugeUnits: 1.6
              }
            ]
          }
        ]
      }
    ]);
    expect(result.auraEndStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "燃烧基线目标",
        frame: 246,
        timeSeconds: 4.1,
        aura: [
          {
            element: "pyro",
            gaugeUnits: 0.665263157895,
            expiresAtFrame: 720,
            sourceSlots: [
              {
                sourceActorId: "pyro",
                gaugeUnits: 0.665263157895
              }
            ]
          }
        ]
      }
    ]);
    expect(
      result.burningStateLog.every(
        (entry) =>
          entry.damageSourceActorId ===
            burningGolden.owners.damageSourceActorId &&
          entry.fuelSourceActorId ===
            burningGolden.owners.fuelSourceActorId
      )
    ).toBe(true);

    for (const [characterId, expectedDamage] of Object.entries(
      burningGolden.byCharacter
    )) {
      expectRelativeClose(
        result.byCharacter[characterId] ?? 0,
        expectedDamage
      );
    }

    expect(result.bySkill).toHaveLength(
      burningGolden.bySkill.length
    );
    burningGolden.bySkill.forEach((expectedSkill, index) => {
      const actualSkill = result.bySkill[index];
      expect(actualSkill).toMatchObject({
        creditId: expectedSkill.creditId,
        actionName: expectedSkill.actionName,
        hits: expectedSkill.hits
      });
      expectRelativeClose(
        actualSkill?.damage ?? 0,
        expectedSkill.damage
      );
    });

    expect(result.targetSummaries).toHaveLength(
      burningGolden.byTarget.length
    );
    burningGolden.byTarget.forEach((expectedTarget, index) => {
      const actualTarget = result.targetSummaries[index];
      expect(actualTarget).toMatchObject({
        targetId: expectedTarget.targetId,
        targetName: expectedTarget.targetName,
        damageEvents: expectedTarget.damageEvents,
        landedChecks: expectedTarget.landedChecks,
        missedChecks: expectedTarget.missedChecks,
        immuneDamageEvents: expectedTarget.immuneDamageEvents
      });
      expectRelativeClose(
        actualTarget?.damage ?? 0,
        expectedTarget.damage
      );
      expectRelativeClose(
        actualTarget?.potentialDamage ?? 0,
        expectedTarget.potentialDamage
      );
    });

    const finalCurve = result.damageCurve.at(-1)!;
    expect(finalCurve).toMatchObject({
      frame: burningGolden.curve.lastFrame,
      timeSeconds: burningGolden.curve.lastTimeSeconds,
      sourceActorId:
        burningGolden.owners.damageSourceActorId,
      creditOwnerId: burningGolden.owners.creditOwnerId
    });
    expectRelativeClose(
      finalCurve.finalDamage,
      burningGolden.curve.lastDamage
    );
    expectRelativeClose(
      finalCurve.cumulativeDamage,
      burningGolden.curve.cumulativeDamage
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent.direct,
      burningGolden.curve.cumulativeDirect
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent.additiveReaction,
      burningGolden.curve.cumulativeAdditiveReaction
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent
        .transformativeReaction,
      burningGolden.curve.cumulativeTransformativeReaction
    );
    expectRelativeClose(
      finalCurve.cumulativeByReaction.burning ?? 0,
      burningGolden.curve.cumulativeBurning
    );

    const repeated = simulate(
      makeBurningGoldenConfig(),
      options
    );
    expect(repeated.reproducibilityKey).toBe(
      result.reproducibilityKey
    );
    expect(repeated.damageEvents).toEqual(result.damageEvents);
    expect(repeated.burningStateLog).toEqual(
      result.burningStateLog
    );
    expect(repeated.targetStateTimeline).toEqual(
      result.targetStateTimeline
    );
    expectContiguousTargetStateTimelineIds(repeated);
  });
});
