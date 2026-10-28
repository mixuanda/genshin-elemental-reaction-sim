// Reviewed current additions to the frozen V152 root. Keep this explicit:
// deriving it from the schema under test would hide accidental wire expansion.
// Each entry is declared optional in result-schema.ts; only the two callback
// logs below add required fields. The frozen-version assertions remain separate.
export const CURRENT_OPTIONAL_RESULT_EXTENSIONS = [
  "executionAudit",
  "energyCostLog",
  "summonLog",
  "statConversionLog",
  "sourceSnapshotLog",
  "sourceNormalChainLog",
  "sourceNormalChainState",
  "normalHitEnergyLog",
  "favoniusLog",
  "weaponProcLog",
  "weaponProcLifecycleLog",
  "thrillingTalesLog",
  "sacrificialLog",
  "skillCooldownLog",
  "artifactDamageLog",
  "artifactDamageState",
  "weaponHitStackLog",
  "weaponHitStackState",
  "artifactBuffLog",
  "artifactBuffState",
  "moonlightArtifactLog",
  "artifactEventLog",
  "nightsoulBurstLog",
  "targetHealthLog",
  "targetHealthSummaries",
  "enemyShieldLog",
  "enemyShieldState",
  "totalPotentialDamage",
  "stamina",
  "playerShieldLog",
  "playerShieldState",
  "playerHealthEvents",
  "playerMaxHpEvents",
  "periodicEntityLog",
  "actionConditionLog",
] as const;

export const CURRENT_RESULT_EXTENSIONS = [
  ...CURRENT_OPTIONAL_RESULT_EXTENSIONS,
  "callbackRegistrationLog",
  "callbackDeliveryLog",
] as const;
