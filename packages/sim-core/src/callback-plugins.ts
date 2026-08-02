import type {
  CallbackBusEventKindV153,
  CallbackSubscriberOutcomeV153,
  DamagePluginDescriptor,
  FreezeBrokenAttackCallbackInvocationPayloadV153,
  FreezeBrokenAttackCallbackPayloadV153,
  FreezeBrokenZeroDamageCallbackPayloadV153,
  FrozenDurabilityDepletedCallbackPayloadV153,
  TargetId,
} from "@genshin-dps-lab/schemas";
import type { DamageModifierPlugin } from "./plugins";

/** Exact V1.53 callback payload leaf associated with each public event kind. */
export interface FreezeBrokenCallbackPayloadMapV153 {
  "on-aura-durability-depleted-frozen": FrozenDurabilityDepletedCallbackPayloadV153;
  "on-apply-attack-freeze-broken": FreezeBrokenAttackCallbackPayloadV153;
  "on-enemy-hit-freeze-broken": FreezeBrokenAttackCallbackPayloadV153;
  "on-enemy-damage-freeze-broken-zero": FreezeBrokenZeroDamageCallbackPayloadV153;
  "attack-callback-freeze-broken": FreezeBrokenAttackCallbackInvocationPayloadV153;
}

export interface CallbackSubscriberPluginSubscriptionV153 {
  eventKind: CallbackBusEventKindV153;
  subscriberKey: string;
}

interface CallbackSubscriberPluginContextCommonV153 {
  frame: number;
  targetFrame: number | null;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  generation: number;
  sourceFrozenStateLogId: number;
  freezeBrokenAttackLogId: number;
}

export interface FreezeBrokenCallbackEventIndexMapV153 {
  "on-aura-durability-depleted-frozen": 0;
  "on-apply-attack-freeze-broken": 1;
  "on-enemy-hit-freeze-broken": 2;
  "on-enemy-damage-freeze-broken-zero": 3;
  "attack-callback-freeze-broken": 4;
}

/**
 * Read-only callback input exposed to executable subscribers.
 *
 * Event kind and payload stay correlated, so a runtime can narrow the union
 * without casts. V1.53 authorizes structured observations only; it exposes no
 * simulator mutation, RNG, damage-event, or scheduling capability here.
 */
export type CallbackSubscriberPluginContextV153 = {
  [Kind in CallbackBusEventKindV153]: Readonly<
    CallbackSubscriberPluginContextCommonV153 & {
      eventIndex: FreezeBrokenCallbackEventIndexMapV153[Kind];
      eventKind: Kind;
      subscriberKey: string;
      payload: Readonly<FreezeBrokenCallbackPayloadMapV153[Kind]>;
    }
  >;
}[CallbackBusEventKindV153];

export interface CallbackSubscriberPluginRuntimeV153 {
  handleCallback(
    context: CallbackSubscriberPluginContextV153,
  ): CallbackSubscriberOutcomeV153;
}

/** Static plugin definition. Runtime state must live in `createRuntime()`. */
export interface CallbackSubscriberPluginV153 {
  readonly capability: "callback-subscriber";
  readonly descriptor: DamagePluginDescriptor;
  readonly subscriptions: readonly CallbackSubscriberPluginSubscriptionV153[];
  readonly createRuntime: () => CallbackSubscriberPluginRuntimeV153;
}

export type SimulationRuntimePluginV153 =
  | DamageModifierPlugin
  | CallbackSubscriberPluginV153;

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must not be empty`);
  }
}

/**
 * Defines one callback-subscriber plugin with deterministic static bindings.
 * Duplicate `(eventKind, subscriberKey)` declarations are rejected rather
 * than relying on self-replacement during simulator startup.
 */
export function defineCallbackSubscriberPluginV153(
  descriptor: DamagePluginDescriptor,
  subscriptions: readonly CallbackSubscriberPluginSubscriptionV153[],
  createRuntime: () => CallbackSubscriberPluginRuntimeV153,
): CallbackSubscriberPluginV153 {
  if (typeof createRuntime !== "function") {
    throw new TypeError("callback plugin runtime factory must be a function");
  }
  assertNonEmpty(descriptor.id, "callback plugin id");
  assertNonEmpty(descriptor.version, "callback plugin version");
  assertNonEmpty(descriptor.contentHash, "callback plugin content hash");

  const bindingKeys = new Set<string>();
  const frozenSubscriptions = subscriptions.map((subscription) => {
    assertNonEmpty(subscription.eventKind, "callback event kind");
    assertNonEmpty(subscription.subscriberKey, "callback subscriber key");
    const bindingKey = `${subscription.eventKind}\u0000${subscription.subscriberKey}`;
    if (bindingKeys.has(bindingKey)) {
      throw new Error(
        `callback plugin "${descriptor.id}" declares duplicate subscription "${subscription.eventKind}:${subscription.subscriberKey}"`,
      );
    }
    bindingKeys.add(bindingKey);
    return Object.freeze({ ...subscription });
  });

  return Object.freeze({
    capability: "callback-subscriber",
    descriptor: Object.freeze({ ...descriptor }),
    subscriptions: Object.freeze(frozenSubscriptions),
    createRuntime,
  });
}

export function isCallbackSubscriberPluginV153(
  plugin: SimulationRuntimePluginV153,
): plugin is CallbackSubscriberPluginV153 {
  return (
    "capability" in plugin && plugin.capability === "callback-subscriber"
  );
}

export function isDamageModifierPluginV153(
  plugin: SimulationRuntimePluginV153,
): plugin is DamageModifierPlugin {
  return !isCallbackSubscriberPluginV153(plugin);
}
