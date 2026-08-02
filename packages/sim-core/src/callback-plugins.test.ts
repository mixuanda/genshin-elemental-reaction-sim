import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  defineCallbackSubscriberPluginV153,
  isCallbackSubscriberPluginV153,
  isDamageModifierPluginV153,
  type CallbackSubscriberPluginContextV153,
} from "./callback-plugins";
import { defineDamageModifierPlugin } from "./plugins";

const descriptor = {
  id: "test.callback-audit",
  version: "1.0.0",
  kind: "code",
  contentHash: "fnv1a32-v2:12345678",
} as const;

describe("V1.53 callback subscriber plugins", () => {
  it("freezes stable metadata and creates fresh observation-only runtimes", () => {
    const handleCallback = vi.fn((context: CallbackSubscriberPluginContextV153) => ({
      kind: "freeze-broken-audit" as const,
      freezeBrokenAttackLogId: context.freezeBrokenAttackLogId,
      sourceFrozenStateLogId: context.sourceFrozenStateLogId,
    }));
    const createRuntime = vi.fn(() => ({ handleCallback }));
    const plugin = defineCallbackSubscriberPluginV153(
      descriptor,
      [
        {
          eventKind: "on-enemy-damage-freeze-broken-zero",
          subscriberKey: "bubble-audit",
        },
      ],
      createRuntime,
    );

    expect(plugin.capability).toBe("callback-subscriber");
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(Object.isFrozen(plugin.descriptor)).toBe(true);
    expect(Object.isFrozen(plugin.subscriptions)).toBe(true);
    expect(Object.isFrozen(plugin.subscriptions[0])).toBe(true);
    expect(plugin.descriptor).not.toBe(descriptor);
    expect(plugin.createRuntime()).not.toBe(plugin.createRuntime());
    expect(createRuntime).toHaveBeenCalledTimes(2);
    expectTypeOf(plugin.subscriptions[0]?.eventKind).toEqualTypeOf<
      | "on-aura-durability-depleted-frozen"
      | "on-apply-attack-freeze-broken"
      | "on-enemy-hit-freeze-broken"
      | "on-enemy-damage-freeze-broken-zero"
      | "attack-callback-freeze-broken"
      | undefined
    >();
  });

  it("preserves event/payload correlation for runtime narrowing", () => {
    const plugin = defineCallbackSubscriberPluginV153(
      descriptor,
      [
        {
          eventKind: "on-enemy-damage-freeze-broken-zero",
          subscriberKey: "zero-damage-observer",
        },
      ],
      () => ({
        handleCallback(context) {
          if (context.eventKind === "on-enemy-damage-freeze-broken-zero") {
            expectTypeOf(context.payload.actualDamage).toEqualTypeOf<0>();
            expectTypeOf(context.payload.crit).toEqualTypeOf<null>();
          }
          return { kind: "no-side-effect" };
        },
      }),
    );

    expect(plugin.subscriptions).toEqual([
      {
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "zero-damage-observer",
      },
    ]);
  });

  it("rejects duplicate static event/key bindings and empty identities", () => {
    expect(() =>
      defineCallbackSubscriberPluginV153(
        descriptor,
        [
          {
            eventKind: "on-apply-attack-freeze-broken",
            subscriberKey: "same",
          },
          {
            eventKind: "on-apply-attack-freeze-broken",
            subscriberKey: "same",
          },
        ],
        () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
      ),
    ).toThrowError(
      'callback plugin "test.callback-audit" declares duplicate subscription "on-apply-attack-freeze-broken:same"',
    );
    expect(() =>
      defineCallbackSubscriberPluginV153(
        { ...descriptor, id: " " },
        [],
        () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
      ),
    ).toThrowError(new RangeError("callback plugin id must not be empty"));
  });

  it("discriminates callback plugins without changing damage plugin shape", () => {
    const callbackPlugin = defineCallbackSubscriberPluginV153(
      descriptor,
      [],
      () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
    );
    const damagePlugin = defineDamageModifierPlugin(
      { ...descriptor, id: "test.damage" },
      () => ({ modifyDamage() {} }),
    );

    expect(isCallbackSubscriberPluginV153(callbackPlugin)).toBe(true);
    expect(isDamageModifierPluginV153(callbackPlugin)).toBe(false);
    expect(isCallbackSubscriberPluginV153(damagePlugin)).toBe(false);
    expect(isDamageModifierPluginV153(damagePlugin)).toBe(true);
    expect("capability" in damagePlugin).toBe(false);
  });
});
