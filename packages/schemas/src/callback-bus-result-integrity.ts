import type { RefinementCtx } from "zod";

import {
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE
} from "@genshin-dps-lab/icd-profiles";

import { validateFreezeBrokenAttackIntegrity } from "./freeze-broken-attack-integrity";
import type {
  CallbackBusEventKindV153,
  CallbackRegistrationLogEntryV153,
  CallbackSubscriberAttemptReferenceV153,
  DamagePluginManifestEntry,
  FreezeBrokenAttackLogEntryV152,
  FreezeBrokenAttackLogEntryV153,
  PluginCapabilityV153,
  SimulationResultForV152,
  SimulationResultForV153
} from "./types";

type IssuePath = Array<string | number>;

const EVENT_KINDS = [
  "on-aura-durability-depleted-frozen",
  "on-apply-attack-freeze-broken",
  "on-enemy-hit-freeze-broken",
  "on-enemy-damage-freeze-broken-zero",
  "attack-callback-freeze-broken"
] as const satisfies readonly CallbackBusEventKindV153[];

/**
 * Public task IDs are a deliberately separate namespace from ordinary combat
 * event sequences. The simulator reserves exactly one task per Freeze Broken
 * V3 audit row, in audit-ID order, starting at this fixed boundary.
 */
const FREEZE_BROKEN_CALLBACK_TASK_SEQUENCE_BASE = 1_000_000_000;

const REGISTRATION_KEYS = [
  "id",
  "registryRevision",
  "eventKind",
  "subscriberKey",
  "slotIndex",
  "operation",
  "previousSubscriptionId",
  "currentSubscriptionId",
  "sourceKind",
  "pluginManifestIndex",
  "pluginId",
  "subscriberAttemptRefs"
] as const;
const ATTEMPT_REFERENCE_KEYS = [
  "callbackDeliveryLogId",
  "attemptIndex"
] as const;
const DELIVERY_KEYS = [
  "id",
  "eventIndex",
  "eventKind",
  "registryRevision",
  "frame",
  "timeSeconds",
  "targetId",
  "targetName",
  "generation",
  "sourceFrozenStateLogId",
  "freezeBrokenAttackLogId",
  "triggerEventType",
  "triggerEventPriority",
  "triggerEventSequence",
  "triggerIntraEventSequence",
  "eventPriority",
  "eventSequence",
  "intraEventSequence",
  "parentCallbackDeliveryLogId",
  "phase",
  "payload",
  "subscriberAttempts"
] as const;
const DELIVERY_OPTIONAL_KEYS = ["targetFrame"] as const;
const ATTEMPT_KEYS = [
  "index",
  "slotIndex",
  "registrationLogId",
  "subscriptionId",
  "subscriberKey",
  "pluginManifestIndex",
  "pluginId",
  "status",
  "outcomeVerification",
  "outcome"
] as const;
const IMMEDIATE_PHASE_KEYS = ["kind"] as const;
const ZERO_DELAY_PHASE_KEYS = [
  "kind",
  "scheduledAfterCallbackDeliveryLogId",
  "taskSequence",
  "delayFrames",
  "referenceRelativeToTriggerEnemyDamage",
  "localExecutionRelativeToTriggerEvent"
] as const;
const NO_SIDE_EFFECT_OUTCOME_KEYS = ["kind"] as const;
const FREEZE_BROKEN_AUDIT_OUTCOME_KEYS = [
  "kind",
  "freezeBrokenAttackLogId",
  "sourceFrozenStateLogId"
] as const;
const FROZEN_DURABILITY_PAYLOAD_KEYS = ["kind", "element"] as const;
const FREEZE_BROKEN_ATTACK_PAYLOAD_KEYS = ["kind", "ability"] as const;
const FREEZE_BROKEN_ZERO_DAMAGE_PAYLOAD_KEYS = [
  "kind",
  "ability",
  "actualDamage",
  "crit",
  "rngDisposition"
] as const;
const FREEZE_BROKEN_CALLBACK_PAYLOAD_KEYS = [
  "kind",
  "ability",
  "suppliedCallbackCount"
] as const;

interface ActiveRegistration {
  registration: CallbackRegistrationLogEntryV153;
  subscriptionId: number;
}

interface RegistrySlot {
  subscriberKey: string;
  provenance: Pick<
    CallbackRegistrationLogEntryV153,
    "sourceKind" | "pluginManifestIndex" | "pluginId"
  >;
  active: ActiveRegistration | null;
}

function addIssue(
  context: RefinementCtx,
  path: IssuePath,
  message: string
): void {
  context.addIssue({ code: "custom", path, message });
}

function validateExactOwnKeys(
  value: object,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  context: RefinementCtx,
  path: IssuePath,
  label: string
): void {
  const actualKeys = Object.keys(value);
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  const hasUnknownKey = actualKeys.some((key) => !allowedKeys.has(key));
  const hasMissingKey = requiredKeys.some(
    (key) => !Object.prototype.hasOwnProperty.call(value, key)
  );
  if (hasUnknownKey || hasMissingKey) {
    addIssue(
      context,
      path,
      `${label} must contain exactly its versioned own keys`
    );
  }
}

function wireEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => wireEqual(value, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        wireEqual(leftRecord[key], rightRecord[key])
    )
  );
}

function validatePluginReference(
  pluginManifest: readonly DamagePluginManifestEntry[],
  pluginCapabilities: readonly PluginCapabilityV153[],
  pluginManifestIndex: number | null,
  pluginId: string | null,
  context: RefinementCtx,
  path: IssuePath
): void {
  if (pluginManifestIndex === null || pluginId === null) return;
  const plugin = pluginManifest[pluginManifestIndex];
  if (
    plugin === undefined ||
    plugin.index !== pluginManifestIndex ||
    plugin.id !== pluginId
  ) {
    addIssue(
      context,
      path,
      "must resolve to the same plugin index and ID in pluginManifest"
    );
    return;
  }
  if (pluginCapabilities[pluginManifestIndex] !== "callback-subscriber") {
    addIssue(
      context,
      path,
      "must resolve to a callback-subscriber capability in runManifest.pluginCapabilities"
    );
  }
}

function toV152Audit(
  entry: FreezeBrokenAttackLogEntryV153
): FreezeBrokenAttackLogEntryV152 {
  return {
    ...entry,
    syncPhase: {
      disposition: "reference-audit-only-not-dispatched",
      referencePhase: "same-call-stack-immediate",
      order: [
        "on-aura-durability-depleted-frozen",
        "on-apply-attack-freeze-broken",
        "on-enemy-hit-freeze-broken",
        "damage-log-freeze-broken"
      ]
    },
    endOfFramePhase: {
      disposition: "reference-audit-only-not-dispatched",
      referencePhase: "zero-delay-core-task",
      order: [
        "apply-zero-damage",
        "on-enemy-damage-freeze-broken-zero",
        "attack-callbacks-none-supplied"
      ],
      damage: 0,
      relativeToTriggerEnemyDamage:
        entry.endOfFramePhase.relativeToTriggerEnemyDamage
    },
    executionStatus: "reference-audit-only-not-dispatched"
  };
}

function isV153FreezeBrokenAudit(
  entry: FreezeBrokenAttackLogEntryV152 | FreezeBrokenAttackLogEntryV153
): entry is FreezeBrokenAttackLogEntryV153 {
  return entry.executionStatus === "callback-bus-dispatched-normalized";
}

function validateInheritedFreezeAudit(
  result: SimulationResultForV153,
  context: RefinementCtx
): boolean {
  const model = result.config.freezeBrokenAttackModel;
  if (model.mode !== GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE) {
    validateFreezeBrokenAttackIntegrity(
      result as unknown as SimulationResultForV152,
      context
    );
    return false;
  }

  let allRowsUseV153Wire = true;
  for (const [index, entry] of result.freezeBrokenAttackLog.entries()) {
    if (!isV153FreezeBrokenAudit(entry)) {
      allRowsUseV153Wire = false;
      addIssue(
        context,
        ["freezeBrokenAttackLog", index, "executionStatus"],
        "Freeze Broken V3 requires callback-bus-dispatched-normalized rows"
      );
    }
  }
  const projected = {
    ...result,
    config: {
      ...result.config,
      freezeBrokenAttackModel: {
        mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
        policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
      }
    },
    freezeBrokenAttackLog: result.freezeBrokenAttackLog.map((entry) =>
      isV153FreezeBrokenAudit(entry) ? toV152Audit(entry) : entry
    )
  } as unknown as SimulationResultForV152;
  validateFreezeBrokenAttackIntegrity(projected, context);
  return allRowsUseV153Wire;
}

function validateRegistrationReplay(
  result: SimulationResultForV153,
  context: RefinementCtx
): Map<CallbackBusEventKindV153, RegistrySlot[]> {
  const slotsByEvent = new Map<CallbackBusEventKindV153, RegistrySlot[]>(
    EVENT_KINDS.map((eventKind) => [eventKind, []])
  );
  const allocatedSubscriptionIds = new Set<number>();
  let nextSubscriptionId = 0;

  const declaredRegistrations = result.runManifest.pluginCallbackSubscriptions
    .flatMap((subscriptions, pluginManifestIndex) => {
      if (
        result.runManifest.pluginCapabilities[pluginManifestIndex] !==
        "callback-subscriber"
      ) {
        return [];
      }
      const plugin = result.pluginManifest[pluginManifestIndex];
      return subscriptions.map((subscription) => ({
        pluginManifestIndex,
        pluginId: plugin?.id ?? null,
        eventKind: subscription.eventKind,
        subscriberKey: subscription.subscriberKey
      }));
    });
  if (result.callbackRegistrationLog.length !== declaredRegistrations.length) {
    addIssue(
      context,
      ["callbackRegistrationLog"],
      "must contain exactly one startup registration for every ordered runManifest.pluginCallbackSubscriptions declaration"
    );
  }

  for (const [index, registration] of result.callbackRegistrationLog.entries()) {
    const path: IssuePath = ["callbackRegistrationLog", index];
    const declaration = declaredRegistrations[index];
    if (
      declaration === undefined ||
      registration.sourceKind !== "plugin" ||
      registration.pluginManifestIndex !== declaration.pluginManifestIndex ||
      registration.pluginId !== declaration.pluginId ||
      registration.eventKind !== declaration.eventKind ||
      registration.subscriberKey !== declaration.subscriberKey
    ) {
      addIssue(
        context,
        path,
        "must exactly match the same-position ordered callback subscription declaration in the run manifest"
      );
    }
    validateExactOwnKeys(
      registration,
      REGISTRATION_KEYS,
      [],
      context,
      path,
      "callback registration"
    );
    for (const [referenceIndex, reference] of
      registration.subscriberAttemptRefs.entries()) {
      validateExactOwnKeys(
        reference,
        ATTEMPT_REFERENCE_KEYS,
        [],
        context,
        [...path, "subscriberAttemptRefs", referenceIndex],
        "subscriber-attempt reference"
      );
    }
    if (registration.id !== index) {
      addIssue(context, [...path, "id"], "must be contiguous and equal the array index");
    }
    if (registration.registryRevision !== index + 1) {
      addIssue(
        context,
        [...path, "registryRevision"],
        "must be contiguous and equal id + 1"
      );
    }
    validatePluginReference(
      result.pluginManifest,
      result.runManifest.pluginCapabilities,
      registration.pluginManifestIndex,
      registration.pluginId,
      context,
      [...path, "pluginManifestIndex"]
    );
    if (registration.sourceKind === "core") {
      addIssue(
        context,
        [...path, "sourceKind"],
        "V1.53 has no built-in subscribers; persisted registrations must come from a manifest plugin"
      );
    }
    if (
      registration.pluginManifestIndex === null ||
      registration.pluginId === null
    ) {
      addIssue(
        context,
        [...path, "pluginManifestIndex"],
        "persisted V1.53 plugin registrations require both manifest references"
      );
    }

    const slots = slotsByEvent.get(registration.eventKind);
    if (slots === undefined) {
      addIssue(context, [...path, "eventKind"], "must select a supported callback event");
      continue;
    }
    const existingSlotIndex = slots.findIndex(
      (slot) => slot.subscriberKey === registration.subscriberKey
    );
    const existingSlot =
      existingSlotIndex === -1 ? undefined : slots[existingSlotIndex];

    if (registration.operation === "subscribe") {
      if (
        registration.previousSubscriptionId !== null ||
        registration.currentSubscriptionId === null
      ) {
        addIssue(
          context,
          [...path, "operation"],
          "subscribe requires null previous and non-null current subscription IDs"
        );
      }
      if (existingSlot !== undefined) {
        addIssue(
          context,
          [...path, "operation"],
          "subscribe may only append a previously unseen subscriber key"
        );
      }
      if (registration.slotIndex !== slots.length) {
        addIssue(
          context,
          [...path, "slotIndex"],
          "a first subscription must append the next event-local slot"
        );
      }
      if (registration.currentSubscriptionId !== null) {
        slots.push({
          subscriberKey: registration.subscriberKey,
          provenance: registration,
          active: {
            registration,
            subscriptionId: registration.currentSubscriptionId
          }
        });
      }
    } else if (registration.operation === "replace") {
      if (registration.currentSubscriptionId === null) {
        addIssue(
          context,
          [...path, "currentSubscriptionId"],
          "replace requires a non-null current subscription ID"
        );
      }
      if (registration.previousSubscriptionId === null) {
        addIssue(
          context,
          [...path, "previousSubscriptionId"],
          "persisted V1.53 startup replacement requires a non-null previous subscription ID"
        );
      }
      if (existingSlot === undefined || existingSlot.active === null) {
        addIssue(
          context,
          [...path, "operation"],
          "persisted V1.53 startup replacement requires an active subscriber key"
        );
      } else {
        if (registration.slotIndex !== existingSlotIndex) {
          addIssue(
            context,
            [...path, "slotIndex"],
            "replace must preserve the original event-local slot"
          );
        }
        const expectedPrevious = existingSlot.active.subscriptionId;
        if (registration.previousSubscriptionId !== expectedPrevious) {
          addIssue(
            context,
            [...path, "previousSubscriptionId"],
            "must equal the subscription active in the preserved slot"
          );
        }
        if (registration.currentSubscriptionId !== null) {
          existingSlot.provenance = registration;
          existingSlot.active = {
            registration,
            subscriptionId: registration.currentSubscriptionId
          };
        }
      }
    } else {
      addIssue(
        context,
        [...path, "operation"],
        "persisted V1.53 simulation registrations only support startup subscribe and active-key replace operations"
      );
      if (registration.currentSubscriptionId !== null) {
        addIssue(
          context,
          [...path, "currentSubscriptionId"],
          "unsubscribe requires a null current subscription ID"
        );
      }
      if (existingSlot === undefined || existingSlot.active === null) {
        addIssue(
          context,
          [...path, "operation"],
          "unsubscribe requires an active subscriber; unknown removals are no-op and unlogged"
        );
      } else {
        if (registration.slotIndex !== existingSlotIndex) {
          addIssue(
            context,
            [...path, "slotIndex"],
            "unsubscribe must preserve the original event-local slot"
          );
        }
        if (
          registration.previousSubscriptionId !==
          existingSlot.active.subscriptionId
        ) {
          addIssue(
            context,
            [...path, "previousSubscriptionId"],
            "must equal the active subscription being tombstoned"
          );
        }
        if (
          registration.sourceKind !== existingSlot.provenance.sourceKind ||
          registration.pluginManifestIndex !==
            existingSlot.provenance.pluginManifestIndex ||
          registration.pluginId !== existingSlot.provenance.pluginId
        ) {
          addIssue(
            context,
            [...path, "sourceKind"],
            "unsubscribe provenance must equal the active slot provenance"
          );
        }
        existingSlot.active = null;
      }
    }

    if (registration.currentSubscriptionId !== null) {
      if (registration.currentSubscriptionId !== nextSubscriptionId) {
        addIssue(
          context,
          [...path, "currentSubscriptionId"],
          "subscribe/replace operations must allocate globally contiguous subscription IDs from 0"
        );
      }
      nextSubscriptionId += 1;
      if (allocatedSubscriptionIds.has(registration.currentSubscriptionId)) {
        addIssue(
          context,
          [...path, "currentSubscriptionId"],
          "subscription IDs must be globally unique and never reused"
        );
      }
      allocatedSubscriptionIds.add(registration.currentSubscriptionId);
    }
  }
  return slotsByEvent;
}

function validateDeliveryAndReciprocalReferences(
  result: SimulationResultForV153,
  slotsByEvent: ReadonlyMap<CallbackBusEventKindV153, readonly RegistrySlot[]>,
  context: RefinementCtx
): void {
  const actualAttemptRefs = new Map<
    number,
    CallbackSubscriberAttemptReferenceV153[]
  >();
  const finalRegistryRevision = result.callbackRegistrationLog.length;

  for (const [index, delivery] of result.callbackDeliveryLog.entries()) {
    const path: IssuePath = ["callbackDeliveryLog", index];
    validateExactOwnKeys(
      delivery,
      DELIVERY_KEYS,
      DELIVERY_OPTIONAL_KEYS,
      context,
      path,
      "callback delivery"
    );
    validateExactOwnKeys(
      delivery.phase,
      delivery.eventIndex < 3 ? IMMEDIATE_PHASE_KEYS : ZERO_DELAY_PHASE_KEYS,
      [],
      context,
      [...path, "phase"],
      "callback delivery phase"
    );
    const payloadKeys =
      delivery.eventIndex === 0
        ? FROZEN_DURABILITY_PAYLOAD_KEYS
        : delivery.eventIndex === 1 || delivery.eventIndex === 2
          ? FREEZE_BROKEN_ATTACK_PAYLOAD_KEYS
          : delivery.eventIndex === 3
            ? FREEZE_BROKEN_ZERO_DAMAGE_PAYLOAD_KEYS
            : FREEZE_BROKEN_CALLBACK_PAYLOAD_KEYS;
    validateExactOwnKeys(
      delivery.payload,
      payloadKeys,
      [],
      context,
      [...path, "payload"],
      "callback delivery payload"
    );
    if (delivery.id !== index) {
      addIssue(context, [...path, "id"], "must be contiguous and equal the array index");
    }
    if (delivery.registryRevision !== finalRegistryRevision) {
      addIssue(
        context,
        [...path, "registryRevision"],
        "deliveries must use the settled pre-run registry revision"
      );
    }
    const activeSlots = (slotsByEvent.get(delivery.eventKind) ?? []).filter(
      (slot): slot is RegistrySlot & { active: ActiveRegistration } =>
        slot.active !== null
    );
    if (delivery.subscriberAttempts.length !== activeSlots.length) {
      addIssue(
        context,
        [...path, "subscriberAttempts"],
        "must contain exactly one completed attempt for every active event slot"
      );
    }
    for (const [attemptIndex, attempt] of delivery.subscriberAttempts.entries()) {
      const attemptPath = [...path, "subscriberAttempts", attemptIndex];
      validateExactOwnKeys(
        attempt,
        ATTEMPT_KEYS,
        [],
        context,
        attemptPath,
        "callback subscriber attempt"
      );
      validateExactOwnKeys(
        attempt.outcome,
        attempt.outcome.kind === "freeze-broken-audit"
          ? FREEZE_BROKEN_AUDIT_OUTCOME_KEYS
          : NO_SIDE_EFFECT_OUTCOME_KEYS,
        [],
        context,
        [...attemptPath, "outcome"],
        "callback subscriber outcome"
      );
      const expected = activeSlots[attemptIndex];
      if (
        expected === undefined ||
        attempt.index !== attemptIndex ||
        attempt.slotIndex !==
          (slotsByEvent.get(delivery.eventKind) ?? []).indexOf(expected) ||
        attempt.registrationLogId !== expected.active.registration.id ||
        attempt.subscriptionId !== expected.active.subscriptionId ||
        attempt.subscriberKey !== expected.subscriberKey ||
        attempt.pluginManifestIndex !==
          expected.active.registration.pluginManifestIndex ||
        attempt.pluginId !== expected.active.registration.pluginId
      ) {
        addIssue(
          context,
          attemptPath,
          "must exactly match the active registration in deterministic slot order"
        );
      }
      validatePluginReference(
        result.pluginManifest,
        result.runManifest.pluginCapabilities,
        attempt.pluginManifestIndex,
        attempt.pluginId,
        context,
        [...attemptPath, "pluginManifestIndex"]
      );
      if (
        attempt.status !== "completed" ||
        attempt.outcomeVerification !==
          "structural-only-unverified-runtime-output-v1"
      ) {
        addIssue(
          context,
          attemptPath,
          "successful results require a completed, structural-only subscriber outcome"
        );
      }
      if (
        attempt.outcome.kind === "freeze-broken-audit" &&
        (attempt.outcome.freezeBrokenAttackLogId !==
          delivery.freezeBrokenAttackLogId ||
          attempt.outcome.sourceFrozenStateLogId !==
            delivery.sourceFrozenStateLogId)
      ) {
        addIssue(
          context,
          [...attemptPath, "outcome"],
          "freeze-broken-audit outcome IDs must equal the owning delivery IDs"
        );
      }
      const references = actualAttemptRefs.get(attempt.registrationLogId) ?? [];
      references.push({
        callbackDeliveryLogId: delivery.id,
        attemptIndex
      });
      actualAttemptRefs.set(attempt.registrationLogId, references);
    }
  }

  for (const [index, registration] of result.callbackRegistrationLog.entries()) {
    const expected = actualAttemptRefs.get(registration.id) ?? [];
    if (!wireEqual(registration.subscriberAttemptRefs, expected)) {
      addIssue(
        context,
        ["callbackRegistrationLog", index, "subscriberAttemptRefs"],
        "must exactly and reciprocally reference every owned subscriber attempt"
      );
    }
  }
}

function validateFivePhaseDeliveries(
  result: SimulationResultForV153,
  context: RefinementCtx
): void {
  const claimedDeliveryIds = new Set<number>();
  if (
    result.callbackDeliveryLog.length !==
    result.freezeBrokenAttackLog.length * EVENT_KINDS.length
  ) {
    addIssue(
      context,
      ["callbackDeliveryLog"],
      "Freeze Broken V3 requires exactly five callback deliveries per audit row"
    );
  }

  for (const [auditIndex, rawAudit] of result.freezeBrokenAttackLog.entries()) {
    const audit = rawAudit as FreezeBrokenAttackLogEntryV153;
    const auditPath: IssuePath = ["freezeBrokenAttackLog", auditIndex];
    const ids = [
      ...audit.syncPhase.callbackDeliveryLogIds,
      ...audit.endOfFramePhase.callbackDeliveryLogIds
    ];
    for (const [eventIndex, deliveryId] of ids.entries()) {
      if (eventIndex > 0 && deliveryId <= ids[eventIndex - 1]!) {
        addIssue(
          context,
          [
            ...auditPath,
            eventIndex < 3 ? "syncPhase" : "endOfFramePhase",
            "callbackDeliveryLogIds",
            eventIndex < 3 ? eventIndex : eventIndex - 3
          ],
          "the five linked delivery IDs must be strictly increasing"
        );
      }
      if (claimedDeliveryIds.has(deliveryId)) {
        addIssue(
          context,
          [...auditPath, "syncPhase", "callbackDeliveryLogIds"],
          "a callback delivery cannot be owned by more than one Freeze Broken audit"
        );
      }
      claimedDeliveryIds.add(deliveryId);
      const delivery = result.callbackDeliveryLog[deliveryId];
      if (delivery === undefined) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId],
          "referenced delivery does not exist"
        );
        continue;
      }
      if (
        delivery.eventIndex !== eventIndex ||
        delivery.eventKind !== EVENT_KINDS[eventIndex]
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId, "eventKind"],
          "must follow the fixed five-event Freeze Broken dispatch sequence"
        );
      }
      const expectedPayload =
        eventIndex === 0
          ? { kind: "frozen-durability-depleted", element: "frozen" }
          : eventIndex === 1 || eventIndex === 2
            ? { kind: "freeze-broken-attack", ability: "Freeze Broken" }
            : eventIndex === 3
              ? {
                  kind: "freeze-broken-zero-damage",
                  ability: "Freeze Broken",
                  actualDamage: 0,
                  crit: null,
                  rngDisposition: "not-consumed"
                }
              : {
                  kind: "freeze-broken-attack-callback",
                  ability: "Freeze Broken",
                  suppliedCallbackCount: 0
                };
      if (!wireEqual(delivery.payload, expectedPayload)) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId, "payload"],
          "must equal the fixed non-damage, no-RNG payload for this callback phase"
        );
      }
      if (
        delivery.freezeBrokenAttackLogId !== audit.id ||
        delivery.sourceFrozenStateLogId !== audit.sourceFrozenStateLogId
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId, "freezeBrokenAttackLogId"],
          "must reciprocally identify the owning audit and Frozen-state row"
        );
      }
      if (
        delivery.frame !== audit.frame ||
        delivery.targetFrame !== audit.targetFrame ||
        delivery.timeSeconds !== audit.timeSeconds ||
        delivery.targetId !== audit.targetId ||
        delivery.targetName !== audit.targetName ||
        delivery.generation !== audit.generation
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId],
          "frame, target, and generation must equal the owning Freeze Broken audit"
        );
      }
      if (
        delivery.triggerEventType !== audit.triggerEventType ||
        delivery.triggerEventPriority !== audit.triggerEventPriority ||
        delivery.triggerEventSequence !== audit.triggerEventSequence ||
        delivery.triggerIntraEventSequence !== audit.intraEventSequence
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId, "triggerEventType"],
          "trigger metadata must equal the owning Freeze Broken audit"
        );
      }
      const expectedParent = eventIndex === 0 ? null : ids[eventIndex - 1];
      if (delivery.parentCallbackDeliveryLogId !== expectedParent) {
        addIssue(
          context,
          ["callbackDeliveryLog", deliveryId, "parentCallbackDeliveryLogId"],
          "must form the linear five-phase delivery chain"
        );
      }
      if (eventIndex < 3) {
        if (
          delivery.phase.kind !== "same-call-stack-immediate" ||
          delivery.eventPriority !== audit.triggerEventPriority ||
          delivery.eventSequence !== audit.triggerEventSequence ||
          delivery.intraEventSequence !== eventIndex
        ) {
          addIssue(
            context,
            ["callbackDeliveryLog", deliveryId, "phase"],
            "the first three deliveries must use local immediate order 0, 1, 2"
          );
        }
      } else if (delivery.phase.kind === "zero-delay-core-task") {
        if (
          delivery.phase.scheduledAfterCallbackDeliveryLogId !== ids[2] ||
          delivery.phase.delayFrames !== 0 ||
          delivery.phase.localExecutionRelativeToTriggerEvent !==
            "after-current-event" ||
          delivery.phase.referenceRelativeToTriggerEnemyDamage !==
            audit.endOfFramePhase.relativeToTriggerEnemyDamage ||
          delivery.eventPriority !== audit.triggerEventPriority ||
          delivery.eventSequence !== delivery.phase.taskSequence ||
          delivery.intraEventSequence !== eventIndex - 3
        ) {
          addIssue(
            context,
            ["callbackDeliveryLog", deliveryId, "phase"],
            "zero-delay deliveries must share the scheduled task and local order 0, 1"
          );
        }
      }
    }
    const enemyDamageId = ids[3]!;
    const attackCallbackId = ids[4]!;
    const enemyDamage = result.callbackDeliveryLog[enemyDamageId];
    const attackCallback = result.callbackDeliveryLog[attackCallbackId];
    const expectedTaskSequence =
      FREEZE_BROKEN_CALLBACK_TASK_SEQUENCE_BASE + audit.id;
    if (
      enemyDamage?.phase.kind === "zero-delay-core-task" &&
      attackCallback?.phase.kind === "zero-delay-core-task" &&
      (enemyDamage.phase.taskSequence !== attackCallback.phase.taskSequence ||
        enemyDamage.eventPriority !== attackCallback.eventPriority ||
        enemyDamage.eventSequence !== attackCallback.eventSequence)
    ) {
      addIssue(
        context,
        ["callbackDeliveryLog", attackCallbackId, "phase", "taskSequence"],
        "both end-of-frame deliveries must settle in the same zero-delay task"
      );
    }
    if (enemyDamage?.phase.kind === "zero-delay-core-task") {
      if (
        enemyDamage.phase.taskSequence !== expectedTaskSequence ||
        enemyDamage.eventSequence !== expectedTaskSequence
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", enemyDamageId, "phase", "taskSequence"],
          "must equal 1_000_000_000 plus the owning Freeze Broken audit ID"
        );
      }
    }
    if (attackCallback?.phase.kind === "zero-delay-core-task") {
      if (
        attackCallback.phase.taskSequence !== expectedTaskSequence ||
        attackCallback.eventSequence !== expectedTaskSequence
      ) {
        addIssue(
          context,
          ["callbackDeliveryLog", attackCallbackId, "phase", "taskSequence"],
          "must equal 1_000_000_000 plus the owning Freeze Broken audit ID"
        );
      }
    }
  }

  for (const [index] of result.callbackDeliveryLog.entries()) {
    if (!claimedDeliveryIds.has(index)) {
      addIssue(
        context,
        ["callbackDeliveryLog", index],
        "orphan callback delivery is not owned by a Freeze Broken V3 audit"
      );
    }
  }
}

function validateImmediateDeliveryChronology(
  result: SimulationResultForV153,
  context: RefinementCtx
): void {
  let previous:
    | Pick<
        SimulationResultForV153["callbackDeliveryLog"][number],
        | "frame"
        | "triggerEventPriority"
        | "triggerEventSequence"
        | "triggerIntraEventSequence"
      >
    | undefined;

  for (const [index, delivery] of result.callbackDeliveryLog.entries()) {
    if (
      delivery.eventIndex >= 3 ||
      delivery.phase.kind !== "same-call-stack-immediate"
    ) {
      continue;
    }
    const outOfOrder =
      previous !== undefined &&
      (delivery.frame < previous.frame ||
        (delivery.frame === previous.frame &&
          (delivery.triggerEventPriority < previous.triggerEventPriority ||
            (delivery.triggerEventPriority === previous.triggerEventPriority &&
              (delivery.triggerEventSequence < previous.triggerEventSequence ||
                (delivery.triggerEventSequence ===
                  previous.triggerEventSequence &&
                  delivery.triggerIntraEventSequence <
                    previous.triggerIntraEventSequence))))));
    if (outOfOrder) {
      addIssue(
        context,
        ["callbackDeliveryLog", index, "triggerEventSequence"],
        "same-call-stack immediate deliveries must follow nondecreasing trigger (frame, priority, sequence, intra-event sequence) append order"
      );
    }
    previous = delivery;
  }
}

/**
 * Cross-log V1.53 callback-bus proof. Plugin outcomes remain explicitly
 * structural-only; registry, dispatch, and reciprocal reference structure is
 * still deterministic and fail-closed.
 */
export function validateCallbackBusV153Integrity(
  result: SimulationResultForV153,
  context: RefinementCtx
): void {
  const allRowsUseV153Wire = validateInheritedFreezeAudit(result, context);

  const freezeMode = result.config.freezeBrokenAttackModel.mode;
  const callbackBusMode = result.config.callbackBusModel.mode;
  const freezeV3 = freezeMode === GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE;
  const fixedBus = callbackBusMode === GCSIM_CALLBACK_BUS_POLICY_V2_MODE;

  if (
    callbackBusMode === LEGACY_CALLBACK_BUS_POLICY_V1_MODE ||
    freezeMode === LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE ||
    freezeMode === GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE
  ) {
    if (result.callbackRegistrationLog.length !== 0) {
      addIssue(
        context,
        ["callbackRegistrationLog"],
        "legacy callback bus or Freeze Broken V1/V2 requires an empty registration log"
      );
    }
    if (result.callbackDeliveryLog.length !== 0) {
      addIssue(
        context,
        ["callbackDeliveryLog"],
        "legacy callback bus or Freeze Broken V1/V2 requires an empty delivery log"
      );
    }
  }
  if (freezeV3 !== fixedBus) {
    addIssue(
      context,
      ["config", "callbackBusModel"],
      "Freeze Broken V3 and the fixed callback bus V2 must be selected together"
    );
  }
  if (!freezeV3 || !fixedBus || !allRowsUseV153Wire) return;

  const slotsByEvent = validateRegistrationReplay(result, context);
  validateDeliveryAndReciprocalReferences(result, slotsByEvent, context);
  validateFivePhaseDeliveries(result, context);
  validateImmediateDeliveryChronology(result, context);
}
