/**
 * A deterministic, synchronous callback registry.
 *
 * The bus intentionally owns no simulation or DOM state. Event payload and
 * subscriber outcome types are supplied by the caller, so a mechanics layer
 * can keep the runtime strongly typed while a schema adapter projects the
 * returned records onto a versioned wire format.
 */

export type CallbackBusEventKind<Payloads extends object> = Extract<
  keyof Payloads,
  string
>;

export type CallbackBusOutcomeMap<Payloads extends object> = {
  [Kind in keyof Payloads]: unknown;
};

type CallbackBusStructuredPrimitive = null | boolean | number | string;

/**
 * Compile-time view of the immutable structured snapshot passed to a handler.
 *
 * Runtime validation is intentionally stricter than TypeScript's structural
 * type system: payloads and outcomes may contain only null, booleans, finite
 * numbers, strings, dense arrays, and plain objects with enumerable data
 * properties. Functions, symbols, bigint values, accessors, cycles, sparse
 * arrays, and non-plain instances are rejected fail-closed.
 */
export type CallbackBusDeepReadonly<Value> =
  Value extends CallbackBusStructuredPrimitive
    ? Value
    : Value extends readonly (infer Item)[]
      ? readonly CallbackBusDeepReadonly<Item>[]
      : Value extends object
        ? { readonly [Key in keyof Value]: CallbackBusDeepReadonly<Value[Key]> }
        : never;

export type CallbackBusRegistrationOperation =
  | "subscribe"
  | "replace"
  | "unsubscribe";

export interface CallbackBusSubscriberAttemptReference {
  emissionId: number;
  attemptId: number;
  attemptIndex: number;
}

/**
 * One successful registry mutation.
 *
 * A replacement after unsubscribe has `operation: "replace"` and a null
 * `previousSubscriptionId`: the original slot is a tombstone, but its
 * position remains stable. Missing/repeated unsubscribe calls are no-ops and
 * therefore do not create a row or advance `registryRevision`.
 */
export interface CallbackBusRegistrationLogEntry<
  EventKind extends string = string,
> {
  id: number;
  registryRevision: number;
  eventKind: EventKind;
  subscriberKey: string;
  slotIndex: number;
  operation: CallbackBusRegistrationOperation;
  previousSubscriptionId: number | null;
  currentSubscriptionId: number | null;
  subscriberAttemptRefs: readonly CallbackBusSubscriberAttemptReference[];
}

interface CallbackBusDeliveryAttemptBase<EventKind extends string> {
  id: number;
  emissionId: number;
  eventKind: EventKind;
  registryRevision: number;
  registrationLogId: number;
  subscriptionId: number;
  subscriberKey: string;
  slotIndex: number;
  attemptIndex: number;
}

export interface CallbackBusCompletedDeliveryAttempt<
  EventKind extends string = string,
  Outcome = unknown,
> extends CallbackBusDeliveryAttemptBase<EventKind> {
  status: "completed";
  outcome: Outcome;
}

export interface CallbackBusThrownDeliveryAttempt<
  EventKind extends string = string,
> extends CallbackBusDeliveryAttemptBase<EventKind> {
  status: "threw";
  errorName: string | null;
  errorMessage: string;
}

/**
 * A subscriber is attempted at most once in one emission. Successful
 * simulation results should persist only completed attempts; a thrown attempt
 * is retained here for diagnostics and is rethrown synchronously by the bus.
 */
export type CallbackBusDeliveryAttempt<
  EventKind extends string = string,
  Outcome = unknown,
> =
  | CallbackBusCompletedDeliveryAttempt<EventKind, Outcome>
  | CallbackBusThrownDeliveryAttempt<EventKind>;

export type CallbackBusDeliveryAttemptFor<
  Payloads extends object,
  Outcomes extends CallbackBusOutcomeMap<Payloads>,
> = {
  [Kind in CallbackBusEventKind<Payloads>]: CallbackBusDeliveryAttempt<
    Kind,
    Outcomes[Kind]
  >;
}[CallbackBusEventKind<Payloads>];

export interface CallbackBusDispatchResult<
  EventKind extends string = string,
  Outcome = unknown,
> {
  emissionId: number;
  eventKind: EventKind;
  registryRevision: number;
  attempts: readonly CallbackBusCompletedDeliveryAttempt<
    EventKind,
    Outcome
  >[];
}

export type CallbackBusHandler<Payload, Outcome> = (
  payload: CallbackBusDeepReadonly<Payload>,
) => Outcome;

/** Nested dispatch is rejected so an emission cannot recursively observe itself. */
export class CallbackBusReentrancyError extends Error {
  constructor(activeEventKind: string, requestedEventKind: string) {
    super(
      `callback bus cannot dispatch "${requestedEventKind}" while "${activeEventKind}" is active`,
    );
    this.name = "CallbackBusReentrancyError";
  }
}

/** Registry mutation during dispatch is rejected to keep one immutable slot view. */
export class CallbackBusMutationDuringDispatchError extends Error {
  constructor(operation: "subscribe" | "unsubscribe", activeEventKind: string) {
    super(
      `callback bus cannot ${operation} while "${activeEventKind}" is being dispatched`,
    );
    this.name = "CallbackBusMutationDuringDispatchError";
  }
}

interface CallbackBusSlot<Payload, Outcome> {
  readonly subscriberKey: string;
  subscriptionId: number | null;
  registrationLogId: number | null;
  handler: CallbackBusHandler<Payload, Outcome> | null;
}

interface MutableRegistrationLogEntry<EventKind extends string>
  extends Omit<
    CallbackBusRegistrationLogEntry<EventKind>,
    "subscriberAttemptRefs"
  > {
  subscriberAttemptRefs: CallbackBusSubscriberAttemptReference[];
}

function assertIdentifier(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must not be empty`);
  }
}

function thrownErrorFields(error: unknown): Pick<
  CallbackBusThrownDeliveryAttempt,
  "errorName" | "errorMessage"
> {
  try {
    if (error instanceof Error) {
      let errorName = "Error";
      let errorMessage = "";
      try {
        if (typeof error.name === "string") errorName = error.name;
      } catch {
        // Keep the stable fallback when an accessor resists inspection.
      }
      try {
        if (typeof error.message === "string") errorMessage = error.message;
      } catch {
        // Keep the stable fallback when an accessor resists inspection.
      }
      return { errorName, errorMessage };
    }
  } catch {
    // A Proxy can make instanceof itself throw; use the scalar fallback below.
  }
  try {
    return {
      errorName: null,
      errorMessage: String(error),
    };
  } catch {
    return {
      errorName: null,
      errorMessage: "<uninspectable thrown value>",
    };
  }
}

function structuredValueError(label: string, path: string, reason: string): TypeError {
  return new TypeError(`${label} at ${path} ${reason}`);
}

/**
 * Creates a detached, deeply frozen, JSON-compatible plain structured value.
 *
 * This deliberately does not use `structuredClone`: that API accepts mutable
 * non-plain values such as Map and Date and preserves cycles, neither of which
 * belongs in a stable callback audit record.
 */
function cloneAndFreezeStructuredValue<Value>(
  value: Value,
  label: "callback payload" | "callback outcome",
  path = "$",
  ancestors: ReadonlySet<object> = new Set<object>(),
): CallbackBusDeepReadonly<Value> {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value as CallbackBusDeepReadonly<Value>;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw structuredValueError(label, path, "must contain only finite numbers");
    }
    return value as CallbackBusDeepReadonly<Value>;
  }
  if (typeof value !== "object") {
    throw structuredValueError(
      label,
      path,
      "must contain only null, booleans, finite numbers, strings, dense arrays, and plain objects",
    );
  }

  if (ancestors.has(value)) {
    throw structuredValueError(label, path, "must not contain cycles");
  }
  const nestedAncestors = new Set(ancestors);
  nestedAncestors.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw structuredValueError(label, path, "must use a plain Array prototype");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      throw structuredValueError(label, path, "must not contain symbol keys");
    }
    const expectedOwnKeyCount = value.length + 1;
    if (ownKeys.length !== expectedOwnKeyCount || !ownKeys.includes("length")) {
      throw structuredValueError(
        label,
        path,
        "must be dense and must not contain extra properties",
      );
    }

    const clone: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw structuredValueError(
          label,
          `${path}[${index}]`,
          "must be an enumerable array data element",
        );
      }
      clone.push(
        cloneAndFreezeStructuredValue(
          descriptor.value,
          label,
          `${path}[${index}]`,
          nestedAncestors,
        ),
      );
    }
    return Object.freeze(clone) as CallbackBusDeepReadonly<Value>;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw structuredValueError(label, path, "must contain only plain objects or arrays");
  }

  const clone = Object.create(prototype) as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw structuredValueError(label, path, "must not contain symbol keys");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw structuredValueError(
        label,
        `${path}.${key}`,
        "must contain only enumerable data properties",
      );
    }
    Object.defineProperty(clone, key, {
      value: cloneAndFreezeStructuredValue(
        descriptor.value,
        label,
        `${path}.${key}`,
        nestedAncestors,
      ),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(clone) as CallbackBusDeepReadonly<Value>;
}

/**
 * Typed deterministic callback bus.
 *
 * Slot order is scoped to an event kind. Re-registering a key replaces the
 * handler in place, including when its prior slot is an unsubscribe tombstone.
 * Dispatch is synchronous and fail-fast: a subscriber exception is logged as
 * a thrown attempt and then rethrown without invoking later subscribers.
 */
export class TypedCallbackBus<
  Payloads extends object,
  Outcomes extends CallbackBusOutcomeMap<Payloads> = CallbackBusOutcomeMap<Payloads>,
> {
  readonly #slotsByEvent = new Map<
    CallbackBusEventKind<Payloads>,
    CallbackBusSlot<unknown, unknown>[]
  >();

  readonly #slotIndexByEventAndKey = new Map<
    CallbackBusEventKind<Payloads>,
    Map<string, number>
  >();

  readonly #registrationLog: MutableRegistrationLogEntry<
    CallbackBusEventKind<Payloads>
  >[] = [];

  readonly #deliveryAttemptLog: CallbackBusDeliveryAttempt<
    CallbackBusEventKind<Payloads>,
    unknown
  >[] = [];

  #registryRevision = 0;
  #nextSubscriptionId = 0;
  #nextEmissionId = 0;
  #nextAttemptId = 0;
  #activeEventKind: CallbackBusEventKind<Payloads> | null = null;

  get registryRevision(): number {
    return this.#registryRevision;
  }

  get activeEventKind(): CallbackBusEventKind<Payloads> | null {
    return this.#activeEventKind;
  }

  subscribe<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
    subscriberKey: string,
    handler: CallbackBusHandler<Payloads[Kind], Outcomes[Kind]>,
  ): CallbackBusRegistrationLogEntry<Kind> {
    this.#assertCanMutate("subscribe");
    assertIdentifier(eventKind, "event kind");
    assertIdentifier(subscriberKey, "subscriber key");
    if (typeof handler !== "function") {
      throw new TypeError("callback handler must be a function");
    }

    const slots = this.#slotsFor(eventKind);
    const keyIndex = this.#keyIndexFor(eventKind);
    const existingIndex = keyIndex.get(subscriberKey);
    const subscriptionId = this.#nextSubscriptionId++;

    let slotIndex: number;
    let operation: CallbackBusRegistrationOperation;
    let previousSubscriptionId: number | null;
    if (existingIndex === undefined) {
      slotIndex = slots.length;
      operation = "subscribe";
      previousSubscriptionId = null;
      slots.push({
        subscriberKey,
        subscriptionId,
        registrationLogId: null,
        handler: handler as CallbackBusHandler<unknown, unknown>,
      });
      keyIndex.set(subscriberKey, slotIndex);
    } else {
      slotIndex = existingIndex;
      operation = "replace";
      const slot = slots[slotIndex];
      if (slot === undefined) {
        throw new Error("callback bus slot index is internally inconsistent");
      }
      previousSubscriptionId = slot.subscriptionId;
      slot.subscriptionId = subscriptionId;
      slot.handler = handler as CallbackBusHandler<unknown, unknown>;
    }

    const logEntry = this.#appendRegistration({
      eventKind,
      subscriberKey,
      slotIndex,
      operation,
      previousSubscriptionId,
      currentSubscriptionId: subscriptionId,
    });
    const slot = slots[slotIndex];
    if (slot === undefined) {
      throw new Error("callback bus slot index is internally inconsistent");
    }
    slot.registrationLogId = logEntry.id;
    return this.#snapshotRegistration(logEntry) as CallbackBusRegistrationLogEntry<Kind>;
  }

  unsubscribe<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
    subscriberKey: string,
  ): CallbackBusRegistrationLogEntry<Kind> | null {
    this.#assertCanMutate("unsubscribe");
    assertIdentifier(eventKind, "event kind");
    assertIdentifier(subscriberKey, "subscriber key");

    const slots = this.#slotsByEvent.get(eventKind);
    const slotIndex = this.#slotIndexByEventAndKey
      .get(eventKind)
      ?.get(subscriberKey);
    if (slots === undefined || slotIndex === undefined) return null;

    const slot = slots[slotIndex];
    if (slot === undefined) {
      throw new Error("callback bus slot index is internally inconsistent");
    }
    if (slot.handler === null || slot.subscriptionId === null) return null;

    const previousSubscriptionId = slot.subscriptionId;
    slot.subscriptionId = null;
    slot.registrationLogId = null;
    slot.handler = null;
    const logEntry = this.#appendRegistration({
      eventKind,
      subscriberKey,
      slotIndex,
      operation: "unsubscribe",
      previousSubscriptionId,
      currentSubscriptionId: null,
    });
    return this.#snapshotRegistration(logEntry) as CallbackBusRegistrationLogEntry<Kind>;
  }

  /** Synchronously emits one event and returns attempts in stable slot order. */
  dispatch<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
    payload: Readonly<Payloads[Kind]>,
  ): CallbackBusDispatchResult<Kind, Outcomes[Kind]> {
    if (this.#activeEventKind !== null) {
      throw new CallbackBusReentrancyError(this.#activeEventKind, eventKind);
    }
    assertIdentifier(eventKind, "event kind");
    const canonicalPayload = cloneAndFreezeStructuredValue(
      payload,
      "callback payload",
    );

    const emissionId = this.#nextEmissionId++;
    const registryRevision = this.#registryRevision;
    const completedAttempts: CallbackBusCompletedDeliveryAttempt<
      Kind,
      Outcomes[Kind]
    >[] = [];
    this.#activeEventKind = eventKind;

    try {
      const slots = this.#slotsByEvent.get(eventKind) ?? [];
      let attemptIndex = 0;
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        if (
          slot === undefined ||
          slot.handler === null ||
          slot.subscriptionId === null ||
          slot.registrationLogId === null
        ) {
          continue;
        }

        const attemptBase = {
          id: this.#nextAttemptId++,
          emissionId,
          eventKind,
          registryRevision,
          registrationLogId: slot.registrationLogId,
          subscriptionId: slot.subscriptionId,
          subscriberKey: slot.subscriberKey,
          slotIndex,
          attemptIndex,
        } as const;
        attemptIndex += 1;

        try {
          const outcome = (
            slot.handler as CallbackBusHandler<
              Payloads[Kind],
              Outcomes[Kind]
            >
          )(
            cloneAndFreezeStructuredValue(
              canonicalPayload,
              "callback payload",
            ) as unknown as CallbackBusDeepReadonly<Payloads[Kind]>,
          );
          const normalizedOutcome = cloneAndFreezeStructuredValue(
            outcome,
            "callback outcome",
          ) as Outcomes[Kind];
          const attempt: CallbackBusCompletedDeliveryAttempt<
            Kind,
            Outcomes[Kind]
          > = Object.freeze({
            ...attemptBase,
            status: "completed",
            outcome: normalizedOutcome,
          });
          this.#deliveryAttemptLog.push(attempt);
          this.#appendAttemptReference(attempt);
          completedAttempts.push(attempt);
        } catch (error) {
          const attempt: CallbackBusThrownDeliveryAttempt<Kind> = Object.freeze({
            ...attemptBase,
            status: "threw",
            ...thrownErrorFields(error),
          });
          this.#deliveryAttemptLog.push(attempt);
          this.#appendAttemptReference(attempt);
          throw error;
        }
      }
    } finally {
      this.#activeEventKind = null;
    }

    return Object.freeze({
      emissionId,
      eventKind,
      registryRevision,
      attempts: Object.freeze([...completedAttempts]),
    });
  }

  /** Alias matching event-emitter terminology; it remains fully synchronous. */
  emit<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
    payload: Readonly<Payloads[Kind]>,
  ): CallbackBusDispatchResult<Kind, Outcomes[Kind]> {
    return this.dispatch(eventKind, payload);
  }

  getRegistrationLog(): readonly CallbackBusRegistrationLogEntry<
    CallbackBusEventKind<Payloads>
  >[] {
    return Object.freeze(
      this.#registrationLog.map((entry) => this.#snapshotRegistration(entry)),
    );
  }

  getDeliveryAttemptLog(): readonly CallbackBusDeliveryAttemptFor<
    Payloads,
    Outcomes
  >[] {
    return Object.freeze([...this.#deliveryAttemptLog]) as readonly CallbackBusDeliveryAttemptFor<
      Payloads,
      Outcomes
    >[];
  }

  activeSubscriberCount<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
  ): number {
    return (this.#slotsByEvent.get(eventKind) ?? []).reduce(
      (count, slot) => count + (slot.handler === null ? 0 : 1),
      0,
    );
  }

  #assertCanMutate(operation: "subscribe" | "unsubscribe"): void {
    if (this.#activeEventKind !== null) {
      throw new CallbackBusMutationDuringDispatchError(
        operation,
        this.#activeEventKind,
      );
    }
  }

  #slotsFor<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
  ): CallbackBusSlot<unknown, unknown>[] {
    let slots = this.#slotsByEvent.get(eventKind);
    if (slots === undefined) {
      slots = [];
      this.#slotsByEvent.set(eventKind, slots);
    }
    return slots;
  }

  #keyIndexFor<Kind extends CallbackBusEventKind<Payloads>>(
    eventKind: Kind,
  ): Map<string, number> {
    let index = this.#slotIndexByEventAndKey.get(eventKind);
    if (index === undefined) {
      index = new Map<string, number>();
      this.#slotIndexByEventAndKey.set(eventKind, index);
    }
    return index;
  }

  #appendRegistration<Kind extends CallbackBusEventKind<Payloads>>(
    input: Omit<
      CallbackBusRegistrationLogEntry<Kind>,
      "id" | "registryRevision" | "subscriberAttemptRefs"
    >,
  ): MutableRegistrationLogEntry<Kind> {
    this.#registryRevision += 1;
    const entry: MutableRegistrationLogEntry<Kind> = {
      id: this.#registrationLog.length,
      registryRevision: this.#registryRevision,
      ...input,
      subscriberAttemptRefs: [],
    };
    this.#registrationLog.push(
      entry as MutableRegistrationLogEntry<CallbackBusEventKind<Payloads>>,
    );
    return entry;
  }

  #appendAttemptReference(
    attempt: CallbackBusDeliveryAttempt<
      CallbackBusEventKind<Payloads>,
      unknown
    >,
  ): void {
    const registration = this.#registrationLog[attempt.registrationLogId];
    if (
      registration === undefined ||
      registration.currentSubscriptionId !== attempt.subscriptionId
    ) {
      throw new Error("callback bus registration reference is internally inconsistent");
    }
    registration.subscriberAttemptRefs.push({
      emissionId: attempt.emissionId,
      attemptId: attempt.id,
      attemptIndex: attempt.attemptIndex,
    });
  }

  #snapshotRegistration<Kind extends CallbackBusEventKind<Payloads>>(
    entry: MutableRegistrationLogEntry<Kind>,
  ): CallbackBusRegistrationLogEntry<Kind> {
    return Object.freeze({
      ...entry,
      subscriberAttemptRefs: Object.freeze(
        entry.subscriberAttemptRefs.map((reference) =>
          Object.freeze({ ...reference }),
        ),
      ),
    });
  }
}
