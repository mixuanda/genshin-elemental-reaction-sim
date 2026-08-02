import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  CallbackBusMutationDuringDispatchError,
  CallbackBusReentrancyError,
  TypedCallbackBus,
} from "./callback-bus";

interface TestPayloads {
  damage: { amount: number };
  aura: { element: string };
}

interface TestOutcomes {
  damage: { disposition: "handled" | "ignored"; observed: number };
  aura: string;
}

function createBus(): TypedCallbackBus<TestPayloads, TestOutcomes> {
  return new TypedCallbackBus<TestPayloads, TestOutcomes>();
}

describe("TypedCallbackBus", () => {
  it("dispatches synchronously in deterministic per-event insertion order", () => {
    const bus = createBus();
    const observed: string[] = [];
    bus.subscribe("damage", "first", ({ amount }) => {
      observed.push(`first:${amount}`);
      return { disposition: "handled", observed: amount };
    });
    bus.subscribe("aura", "other-event", ({ element }) => element);
    bus.subscribe("damage", "second", ({ amount }) => {
      observed.push(`second:${amount}`);
      return { disposition: "ignored", observed: amount };
    });

    const result = bus.dispatch("damage", { amount: 7 });

    expect(observed).toEqual(["first:7", "second:7"]);
    expect(result).toEqual({
      emissionId: 0,
      eventKind: "damage",
      registryRevision: 3,
      attempts: [
        expect.objectContaining({
          id: 0,
          subscriberKey: "first",
          slotIndex: 0,
          attemptIndex: 0,
          status: "completed",
          outcome: { disposition: "handled", observed: 7 },
        }),
        expect.objectContaining({
          id: 1,
          subscriberKey: "second",
          slotIndex: 1,
          attemptIndex: 1,
          status: "completed",
          outcome: { disposition: "ignored", observed: 7 },
        }),
      ],
    });
    expectTypeOf(result.attempts[0]?.outcome).toEqualTypeOf<
      { disposition: "handled" | "ignored"; observed: number } | undefined
    >();
  });

  it("replaces a duplicate key without moving its insertion slot", () => {
    const bus = createBus();
    const oldHandler = vi.fn(() => ({
      disposition: "ignored" as const,
      observed: -1,
    }));
    bus.subscribe("damage", "stable", oldHandler);
    bus.subscribe("damage", "later", ({ amount }) => ({
      disposition: "handled",
      observed: amount + 1,
    }));
    const replacement = bus.subscribe("damage", "stable", ({ amount }) => ({
      disposition: "handled",
      observed: amount,
    }));

    expect(replacement).toMatchObject({
      id: 2,
      registryRevision: 3,
      operation: "replace",
      slotIndex: 0,
      previousSubscriptionId: 0,
      currentSubscriptionId: 2,
    });
    expect(
      bus.dispatch("damage", { amount: 4 }).attempts.map((attempt) => ({
        key: attempt.subscriberKey,
        slot: attempt.slotIndex,
        subscription: attempt.subscriptionId,
        observed: attempt.outcome.observed,
      })),
    ).toEqual([
      { key: "stable", slot: 0, subscription: 2, observed: 4 },
      { key: "later", slot: 1, subscription: 1, observed: 5 },
    ]);
    expect(oldHandler).not.toHaveBeenCalled();
  });

  it("keeps unsubscribe tombstones and reactivates the original slot", () => {
    const bus = createBus();
    bus.subscribe("damage", "first", ({ amount }) => ({
      disposition: "handled",
      observed: amount,
    }));
    bus.subscribe("damage", "second", ({ amount }) => ({
      disposition: "handled",
      observed: amount,
    }));

    expect(bus.unsubscribe("damage", "first")).toMatchObject({
      operation: "unsubscribe",
      slotIndex: 0,
      previousSubscriptionId: 0,
      currentSubscriptionId: null,
    });
    expect(bus.activeSubscriberCount("damage")).toBe(1);
    expect(
      bus.dispatch("damage", { amount: 1 }).attempts.map(
        (attempt) => attempt.subscriberKey,
      ),
    ).toEqual(["second"]);

    expect(
      bus.subscribe("damage", "first", ({ amount }) => ({
        disposition: "handled",
        observed: amount * 2,
      })),
    ).toMatchObject({
      operation: "replace",
      slotIndex: 0,
      previousSubscriptionId: null,
      currentSubscriptionId: 2,
    });
    expect(
      bus.dispatch("damage", { amount: 2 }).attempts.map((attempt) => ({
        key: attempt.subscriberKey,
        slot: attempt.slotIndex,
        observed: attempt.outcome.observed,
      })),
    ).toEqual([
      { key: "first", slot: 0, observed: 4 },
      { key: "second", slot: 1, observed: 2 },
    ]);
  });

  it("treats missing and repeated unsubscribe as revision-stable no-ops", () => {
    const bus = createBus();
    expect(bus.unsubscribe("damage", "missing")).toBeNull();
    expect(bus.registryRevision).toBe(0);
    bus.subscribe("damage", "present", ({ amount }) => ({
      disposition: "handled",
      observed: amount,
    }));
    expect(bus.unsubscribe("damage", "present")).not.toBeNull();
    expect(bus.unsubscribe("damage", "present")).toBeNull();
    expect(bus.registryRevision).toBe(2);
    expect(bus.getRegistrationLog()).toHaveLength(2);
  });

  it("attempts each active subscription exactly once per emission", () => {
    const bus = createBus();
    const first = vi.fn(({ amount }: { amount: number }) => ({
      disposition: "handled" as const,
      observed: amount,
    }));
    const second = vi.fn(({ amount }: { amount: number }) => ({
      disposition: "ignored" as const,
      observed: amount,
    }));
    bus.subscribe("damage", "first", first);
    bus.subscribe("damage", "second", second);

    const firstEmission = bus.emit("damage", { amount: 1 });
    const secondEmission = bus.emit("damage", { amount: 2 });

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    expect(firstEmission.attempts.map((attempt) => attempt.attemptIndex)).toEqual([
      0, 1,
    ]);
    expect(secondEmission.attempts.map((attempt) => attempt.attemptIndex)).toEqual([
      0, 1,
    ]);
    expect(bus.getDeliveryAttemptLog().map((attempt) => attempt.id)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("rejects nested dispatch before allocating a nested emission", () => {
    const bus = createBus();
    bus.subscribe("damage", "reentrant", ({ amount }) => {
      expect(() => bus.dispatch("aura", { element: "frozen" })).toThrowError(
        new CallbackBusReentrancyError("damage", "aura"),
      );
      return { disposition: "handled", observed: amount };
    });

    expect(bus.dispatch("damage", { amount: 1 }).emissionId).toBe(0);
    expect(bus.dispatch("aura", { element: "hydro" }).emissionId).toBe(1);
    expect(bus.activeEventKind).toBeNull();
  });

  it("rejects subscribe and unsubscribe during an active dispatch", () => {
    const bus = createBus();
    bus.subscribe("damage", "mutator", ({ amount }) => {
      expect(() =>
        bus.subscribe("damage", "late", ({ amount: lateAmount }) => ({
          disposition: "handled",
          observed: lateAmount,
        })),
      ).toThrowError(
        new CallbackBusMutationDuringDispatchError("subscribe", "damage"),
      );
      expect(() => bus.unsubscribe("damage", "mutator")).toThrowError(
        new CallbackBusMutationDuringDispatchError("unsubscribe", "damage"),
      );
      return { disposition: "handled", observed: amount };
    });

    expect(bus.dispatch("damage", { amount: 3 }).attempts).toHaveLength(1);
    expect(bus.registryRevision).toBe(1);
  });

  it("logs a thrown attempt, restores state, and fails fast", () => {
    const bus = createBus();
    const later = vi.fn(() => ({
      disposition: "handled" as const,
      observed: 99,
    }));
    bus.subscribe("damage", "throws", () => {
      throw new TypeError("subscriber failed");
    });
    bus.subscribe("damage", "later", later);

    expect(() => bus.dispatch("damage", { amount: 1 })).toThrowError(
      new TypeError("subscriber failed"),
    );
    expect(later).not.toHaveBeenCalled();
    expect(bus.activeEventKind).toBeNull();
    expect(bus.getDeliveryAttemptLog()).toEqual([
      expect.objectContaining({
        id: 0,
        emissionId: 0,
        registrationLogId: 0,
        status: "threw",
        errorName: "TypeError",
        errorMessage: "subscriber failed",
      }),
    ]);
    expect(bus.getRegistrationLog()[0]?.subscriberAttemptRefs).toEqual([
      { emissionId: 0, attemptId: 0, attemptIndex: 0 },
    ]);

    bus.unsubscribe("damage", "throws");
    expect(bus.dispatch("damage", { amount: 2 }).emissionId).toBe(1);
    expect(later).toHaveBeenCalledOnce();
  });

  it("preserves the thrown attempt when an opaque value resists inspection", () => {
    const bus = createBus();
    const opaqueThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf() {
        throw new Error("opaque prototype");
      },
      get() {
        throw new Error("opaque property");
      },
    });
    bus.subscribe("damage", "opaque-throw", () => {
      throw opaqueThrownValue;
    });

    let received: unknown;
    try {
      bus.dispatch("damage", { amount: 1 });
    } catch (error) {
      received = error;
    }

    expect(received).toBe(opaqueThrownValue);
    expect(bus.activeEventKind).toBeNull();
    expect(bus.getDeliveryAttemptLog()).toEqual([
      expect.objectContaining({
        id: 0,
        emissionId: 0,
        registrationLogId: 0,
        status: "threw",
        errorName: null,
        errorMessage: "<uninspectable thrown value>",
      }),
    ]);
    expect(bus.getRegistrationLog()[0]?.subscriberAttemptRefs).toEqual([
      { emissionId: 0, attemptId: 0, attemptIndex: 0 },
    ]);
  });

  it("returns immutable log snapshots and validates runtime identifiers", () => {
    const bus = createBus();
    bus.subscribe("damage", "valid", ({ amount }) => ({
      disposition: "handled",
      observed: amount,
    }));
    const beforeDispatch = bus.getRegistrationLog();
    expect(Object.isFrozen(beforeDispatch)).toBe(true);
    expect(Object.isFrozen(beforeDispatch[0])).toBe(true);
    expect(Object.isFrozen(beforeDispatch[0]?.subscriberAttemptRefs)).toBe(true);
    bus.dispatch("damage", { amount: 1 });
    expect(beforeDispatch[0]?.subscriberAttemptRefs).toEqual([]);
    expect(bus.getRegistrationLog()[0]?.subscriberAttemptRefs).toHaveLength(1);

    expect(() =>
      bus.subscribe("damage", "  ", ({ amount }) => ({
        disposition: "handled",
        observed: amount,
      })),
    ).toThrowError(new RangeError("subscriber key must not be empty"));
    expect(() =>
      bus.dispatch("" as "damage", { amount: 1 }),
    ).toThrowError(new RangeError("event kind must not be empty"));
  });

  it("deep-copies and deep-freezes completed outcomes before retaining them", () => {
    interface Payloads {
      audit: { value: number };
    }
    interface Outcomes {
      audit: { summary: { values: number[] } };
    }
    const bus = new TypedCallbackBus<Payloads, Outcomes>();
    const retainedOutcome = { summary: { values: [3, 5] } };
    bus.subscribe("audit", "retains-source", () => retainedOutcome);

    const dispatch = bus.dispatch("audit", { value: 1 });
    const recordedOutcome = dispatch.attempts[0]?.outcome;
    expect(recordedOutcome).toEqual({ summary: { values: [3, 5] } });
    expect(recordedOutcome).not.toBe(retainedOutcome);
    expect(recordedOutcome?.summary).not.toBe(retainedOutcome.summary);
    expect(recordedOutcome?.summary.values).not.toBe(
      retainedOutcome.summary.values,
    );
    expect(Object.isFrozen(recordedOutcome)).toBe(true);
    expect(Object.isFrozen(recordedOutcome?.summary)).toBe(true);
    expect(Object.isFrozen(recordedOutcome?.summary.values)).toBe(true);

    retainedOutcome.summary.values[0] = 99;
    retainedOutcome.summary.values.push(8);
    expect(dispatch.attempts[0]?.outcome).toEqual({
      summary: { values: [3, 5] },
    });
    expect(bus.getDeliveryAttemptLog()[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        outcome: { summary: { values: [3, 5] } },
      }),
    );
  });

  it("gives every subscriber a detached deeply immutable payload snapshot", () => {
    interface Payloads {
      nested: { amount: number; labels: string[] };
    }
    interface Outcomes {
      nested: { observed: number };
    }
    const bus = new TypedCallbackBus<Payloads, Outcomes>();
    const source = { amount: 7, labels: ["original"] };
    let firstSnapshot: object | null = null;
    let secondSnapshot: object | null = null;

    bus.subscribe("nested", "first", (payload) => {
      firstSnapshot = payload;
      expect(Object.isFrozen(payload)).toBe(true);
      expect(Object.isFrozen(payload.labels)).toBe(true);
      expect(() =>
        Reflect.set(payload as object, "amount", 99),
      ).not.toThrow();
      expect(Reflect.set(payload as object, "amount", 99)).toBe(false);
      expect(() =>
        Reflect.set(payload.labels as object, "0", "mutated"),
      ).not.toThrow();
      expect(Reflect.set(payload.labels as object, "0", "mutated")).toBe(
        false,
      );
      return { observed: payload.amount };
    });
    bus.subscribe("nested", "second", (payload) => {
      secondSnapshot = payload;
      return { observed: payload.amount };
    });

    expect(bus.dispatch("nested", source).attempts.map(({ outcome }) => outcome)).toEqual([
      { observed: 7 },
      { observed: 7 },
    ]);
    expect(firstSnapshot).not.toBe(secondSnapshot);
    expect(source).toEqual({ amount: 7, labels: ["original"] });
  });

  it("rejects cyclic, executable, and non-plain callback payloads", () => {
    interface Payloads {
      audit: Record<string, unknown>;
    }
    interface Outcomes {
      audit: { accepted: true };
    }
    const bus = new TypedCallbackBus<Payloads, Outcomes>();
    const handler = vi.fn(() => ({ accepted: true as const }));
    bus.subscribe("audit", "validator", handler);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => bus.dispatch("audit", cyclic)).toThrowError(
      /callback payload at \$\.self must not contain cycles/,
    );
    expect(() =>
      bus.dispatch("audit", { executable: () => undefined }),
    ).toThrowError(/callback payload at \$\.executable must contain only/);
    expect(() =>
      bus.dispatch("audit", { createdAt: new Date(0) }),
    ).toThrowError(
      /callback payload at \$\.createdAt must contain only plain objects or arrays/,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(bus.getDeliveryAttemptLog()).toEqual([]);
    expect(bus.dispatch("audit", { valid: true }).emissionId).toBe(0);
  });

  it("fails a delivery closed when its outcome is not plain structured data", () => {
    interface Payloads {
      audit: { value: number };
    }
    interface Outcomes {
      audit: unknown;
    }

    const invalidOutcomes: readonly unknown[] = [
      () => undefined,
      new Map([["value", 1]]),
      (() => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        return cyclic;
      })(),
    ];

    for (const invalidOutcome of invalidOutcomes) {
      const bus = new TypedCallbackBus<Payloads, Outcomes>();
      bus.subscribe("audit", "invalid", () => invalidOutcome);
      expect(() => bus.dispatch("audit", { value: 1 })).toThrowError(
        /^callback outcome at \$/,
      );
      expect(bus.getDeliveryAttemptLog()).toEqual([
        expect.objectContaining({
          status: "threw",
          errorName: "TypeError",
          errorMessage: expect.stringMatching(/^callback outcome at \$/),
        }),
      ]);
    }
  });
});
