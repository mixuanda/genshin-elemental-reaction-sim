import {
  canonicalStringify,
  type AuraStateEntry,
  type ReactionAudit
} from "@genshin-dps-lab/schemas";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

type PersistentElement =
  | "pyro"
  | "hydro"
  | "cryo"
  | "electro"
  | "dendro";
type IncomingElement =
  | PersistentElement
  | "anemo"
  | "geo"
  | "physical";
type SpecialState =
  | "frozen"
  | "quicken"
  | "burning"
  | "burningFuel"
  | "electroCharged";

interface PrefixHit {
  element: PersistentElement;
  gaugeUnits: number;
}

interface SpecialStateScenario {
  id: string;
  expectedMask: readonly SpecialState[];
  prefix: readonly PrefixHit[];
  orderSeed: readonly {
    element: PersistentElement;
    gaugeUnits: number;
  }[];
  orderSuffix: readonly PrefixHit[];
}

interface IncomingVector {
  element: IncomingElement;
  gaugeUnits: number | null;
  strikeType: "default" | "blunt";
}

const EPSILON = 1e-9;
const REPRESENTATIVE_GAUGES = [0.125, 0.5, 2, 3] as const;
const ELEMENTAL_INCOMING = [
  "pyro",
  "hydro",
  "cryo",
  "electro",
  "dendro",
  "anemo",
  "geo"
] as const satisfies readonly Exclude<
  IncomingElement,
  "physical"
>[];
const INCOMING_VECTORS: readonly IncomingVector[] = [
  ...ELEMENTAL_INCOMING.flatMap((element) =>
    REPRESENTATIVE_GAUGES.map((gaugeUnits) => ({
      element,
      gaugeUnits,
      strikeType: "default" as const
    }))
  ),
  {
    element: "physical",
    gaugeUnits: null,
    strikeType: "blunt"
  }
];
const ALLOWED_SPECIAL_MASKS = new Set([
  "",
  "burning,burningFuel",
  "burning,burningFuel,quicken",
  "electroCharged",
  "electroCharged,quicken",
  "frozen",
  "frozen,quicken",
  "quicken"
]);
const TRANSITION_HASHES = {
  sameFrame:
    "f2bed2d60b88c8b32c2b39d0ea152d51f31e319397545475d992b71d137cdc93",
  settledNextFrame:
    "15304246d45a0d2b4bfa3dc73b9809bee0e6b7342cb88ef8a7e1c6783a331b30"
} as const;

/**
 * Every prefix starts from an empty AuraEngine and uses only public hits.
 * The seven masks are the qualitative special-state closure discovered by a
 * bounded reachability audit. Frozen+EC and Burning+Frozen are deliberately
 * absent: the current ordered pipelines consume or guard those states before
 * they can coexist.
 */
const SPECIAL_STATE_SCENARIOS = [
  {
    id: "frozen",
    expectedMask: ["frozen"],
    prefix: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "pyro", gaugeUnits: 0.125 }
    ],
    orderSuffix: [{ element: "cryo", gaugeUnits: 0.5 }]
  },
  {
    id: "quicken",
    expectedMask: ["quicken"],
    prefix: [
      { element: "electro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "electro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.125 }
    ],
    orderSuffix: [{ element: "dendro", gaugeUnits: 0.5 }]
  },
  {
    id: "burning-fuel",
    expectedMask: ["burning", "burningFuel"],
    prefix: [
      { element: "pyro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "pyro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.125 }
    ],
    orderSuffix: [{ element: "dendro", gaugeUnits: 0.5 }]
  },
  {
    id: "frozen-quicken",
    expectedMask: ["frozen", "quicken"],
    prefix: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "electro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "electro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 }
    ],
    orderSuffix: [
      { element: "electro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.5 }
    ]
  },
  {
    id: "electro-charged",
    expectedMask: ["electroCharged"],
    prefix: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "electro", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "cryo", gaugeUnits: 0.125 }
    ],
    orderSuffix: [{ element: "electro", gaugeUnits: 0.5 }]
  },
  {
    id: "electro-charged-quicken",
    expectedMask: ["electroCharged", "quicken"],
    prefix: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "electro", gaugeUnits: 1 },
      { element: "dendro", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "hydro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 }
    ],
    orderSuffix: [{ element: "electro", gaugeUnits: 0.5 }]
  },
  {
    id: "burning-fuel-quicken",
    expectedMask: [
      "burning",
      "burningFuel",
      "quicken"
    ],
    prefix: [
      { element: "electro", gaugeUnits: 0.5 },
      { element: "dendro", gaugeUnits: 0.5 },
      { element: "pyro", gaugeUnits: 0.5 }
    ],
    orderSeed: [
      { element: "electro", gaugeUnits: 0.5 },
      { element: "pyro", gaugeUnits: 0.5 }
    ],
    orderSuffix: [{ element: "dendro", gaugeUnits: 0.5 }]
  }
] as const satisfies readonly SpecialStateScenario[];

function noIcd(gaugeUnits: number, tag: string) {
  return {
    gaugeUnits,
    icdTag: tag,
    icdGroup: "no-icd" as const
  };
}

function close(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    EPSILON * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function invariant(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) throw new Error(message);
}

function cloneAura(
  aura: readonly AuraStateEntry[]
): AuraStateEntry[] {
  return aura.map((entry) => ({
    ...entry,
    ...(entry.sourceSlots === undefined
      ? {}
      : {
          sourceSlots: entry.sourceSlots.map((slot) => ({
            ...slot
          }))
        })
  }));
}

function updateElectroChargedState(
  active: boolean,
  audit: ReactionAudit
): boolean {
  const operation = audit.periodicReaction?.operation;
  if (operation === "start" || operation === "refresh") {
    return true;
  }
  if (operation === "stop") return false;
  return active;
}

function specialMask(
  aura: readonly AuraStateEntry[],
  electroChargedActive: boolean
): SpecialState[] {
  const elements = new Set(aura.map((entry) => entry.element));
  const electroChargedCoexistence =
    electroChargedActive &&
    elements.has("hydro") &&
    elements.has("electro");
  return [
    ...(elements.has("frozen")
      ? (["frozen"] as const)
      : []),
    ...(elements.has("quicken")
      ? (["quicken"] as const)
      : []),
    ...(elements.has("burning")
      ? (["burning"] as const)
      : []),
    ...(elements.has("burningFuel")
      ? (["burningFuel"] as const)
      : []),
    ...(electroChargedCoexistence
      ? (["electroCharged"] as const)
      : [])
  ].sort();
}

function replayPrefix(
  scenario: SpecialStateScenario
): {
  engine: AuraEngine;
  audits: ReactionAudit[];
  aura: AuraStateEntry[];
  electroChargedActive: boolean;
  pendingFollowup: {
    sourceActorId: string;
    triggerElement: "dendro" | "electro";
  } | null;
} {
  const engine = new AuraEngine({
    mode: "aura-v7",
    reactableTickModel: "cached-boundary-v2"
  });
  const audits: ReactionAudit[] = [];
  let electroChargedActive = false;
  let pendingFollowup: {
    sourceActorId: string;
    triggerElement: "dendro" | "electro";
  } | null = null;
  scenario.prefix.forEach((hit, index) => {
    const sourceActorId = `${scenario.id}:prefix:${index}`;
    const audit = engine.processHit({
      frame: 0,
      sourceActorId,
      element: hit.element,
      application: noIcd(
        hit.gaugeUnits,
        `${scenario.id}:prefix:${index}`
      )
    });
    audits.push(audit);
    electroChargedActive = updateElectroChargedState(
      electroChargedActive,
      audit
    );
    const quicken = audit.catalyzeReaction?.quicken;
    if (quicken?.pendingHydroBloomFollowup === true) {
      pendingFollowup = {
        sourceActorId,
        triggerElement: quicken.triggerElement
      };
    }
  });
  const aura = cloneAura(audits.at(-1)?.auraAfter ?? []);
  return {
    engine,
    audits,
    aura,
    electroChargedActive,
    pendingFollowup
  };
}

function replayOrderSeed(
  scenario: SpecialStateScenario,
  reverse: boolean
): ReactionAudit[] {
  const initialAura = (
    reverse
      ? [...scenario.orderSeed].reverse()
      : scenario.orderSeed
  ).map((entry) => ({ ...entry }));
  const engine = new AuraEngine({
    mode: "aura-v7",
    reactableTickModel: "cached-boundary-v2",
    initialAura
  });
  return scenario.orderSuffix.map((hit, index) =>
    engine.processHit({
      frame: 0,
      sourceActorId: `${scenario.id}:order:${index}`,
      element: hit.element,
      application: noIcd(
        hit.gaugeUnits,
        `${scenario.id}:order:${index}`
      )
    })
  );
}

function inspectNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    invariant(
      Number.isFinite(value),
      `non-finite number at ${path}: ${String(value)}`
    );
    if (
      /(gauge|units|frame|duration|delay|multiplier|radius|rate|ratio|factor)/i.test(
        path
      )
    ) {
      invariant(
        value >= -EPSILON,
        `negative mechanics number at ${path}: ${value}`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectNumbers(item, `${path}[${index}]`)
    );
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      inspectNumbers(item, `${path}.${key}`)
    );
  }
}

function inspectAura(
  aura: readonly AuraStateEntry[],
  path: string
): void {
  const elements = new Set<string>();
  let previousElement = "";
  for (const entry of aura) {
    invariant(
      !elements.has(entry.element),
      `duplicate Aura element ${entry.element} at ${path}`
    );
    elements.add(entry.element);
    invariant(
      previousElement === "" ||
        previousElement.localeCompare(entry.element) <= 0,
      `unstable Aura ordering ${previousElement}>${entry.element} at ${path}`
    );
    previousElement = entry.element;
    invariant(
      Number.isFinite(entry.gaugeUnits) &&
        entry.gaugeUnits >= -EPSILON,
      `invalid Aura gauge ${entry.element}:${entry.gaugeUnits} at ${path}`
    );
    if (entry.sourceSlots === undefined) continue;

    const sourceIds = new Set<string>();
    let previousSourceId = "";
    let maximumSlotGauge = 0;
    for (const slot of entry.sourceSlots) {
      invariant(
        !sourceIds.has(slot.sourceActorId),
        `duplicate source slot ${entry.element}:${slot.sourceActorId} at ${path}`
      );
      sourceIds.add(slot.sourceActorId);
      invariant(
        previousSourceId === "" ||
          previousSourceId.localeCompare(slot.sourceActorId) <= 0,
        `unstable source-slot ordering ${previousSourceId}>${slot.sourceActorId} at ${path}`
      );
      previousSourceId = slot.sourceActorId;
      invariant(
        Number.isFinite(slot.gaugeUnits) &&
          slot.gaugeUnits >= -EPSILON,
        `invalid source-slot gauge ${entry.element}:${slot.sourceActorId}:${slot.gaugeUnits} at ${path}`
      );
      maximumSlotGauge = Math.max(
        maximumSlotGauge,
        slot.gaugeUnits
      );
    }
    invariant(
      close(entry.gaugeUnits, maximumSlotGauge),
      `source-slot max drift for ${entry.element} at ${path}: state=${entry.gaugeUnits}, maxSlot=${maximumSlotGauge}`
    );
  }
}

function inspectSourceMutations(
  value: unknown,
  path: string
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectSourceMutations(item, `${path}[${index}]`)
    );
    return;
  }
  if (value === null || typeof value !== "object") return;

  const object = value as Record<string, unknown>;
  if (Array.isArray(object.sourceMutations)) {
    object.sourceMutations.forEach(
      (mutationValue, index) => {
        const mutation = mutationValue as Record<
          string,
          unknown
        >;
        const before = mutation.gaugeUnitsBefore;
        const consumed = mutation.consumedGaugeUnits;
        const after = mutation.gaugeUnitsAfter;
        invariant(
          typeof before === "number" &&
            typeof consumed === "number" &&
            typeof after === "number" &&
            consumed >= -EPSILON &&
            consumed <= before + EPSILON &&
            close(before - consumed, after),
          `source mutation drift at ${path}.sourceMutations[${index}]: ${JSON.stringify(
            mutation
          )}`
        );
      }
    );
  }
  Object.entries(object).forEach(([key, item]) =>
    inspectSourceMutations(item, `${path}.${key}`)
  );
}

function inspectKnownBudgets(
  value: unknown,
  path: string
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectKnownBudgets(item, `${path}[${index}]`)
    );
    return;
  }
  if (value === null || typeof value !== "object") return;

  const object = value as Record<string, unknown>;
  const triples = [
    [
      "sourceGaugeUnitsBefore",
      "sourceGaugeUnitsSpent",
      "sourceGaugeUnitsAfter"
    ],
    [
      "hydroGaugeUnitsBefore",
      "hydroConsumedGaugeUnits",
      "hydroGaugeUnitsAfter"
    ],
    [
      "dendroGaugeUnitsBefore",
      "dendroConsumedGaugeUnits",
      "dendroGaugeUnitsAfter"
    ],
    [
      "quickenGaugeUnitsBefore",
      "quickenConsumedGaugeUnits",
      "quickenGaugeUnitsAfter"
    ],
    [
      "burningFuelGaugeUnitsBefore",
      "burningFuelConsumedGaugeUnits",
      "burningFuelGaugeUnitsAfter"
    ]
  ] as const;
  for (const [beforeKey, consumedKey, afterKey] of triples) {
    const before = object[beforeKey];
    const consumed = object[consumedKey];
    const after = object[afterKey];
    if (
      typeof before !== "number" ||
      typeof consumed !== "number" ||
      typeof after !== "number"
    ) {
      continue;
    }
    invariant(
      close(before - consumed, after),
      `budget drift at ${path}: ${beforeKey}=${before}, ${consumedKey}=${consumed}, ${afterKey}=${after}`
    );
  }
  Object.entries(object).forEach(([key, item]) =>
    inspectKnownBudgets(item, `${path}.${key}`)
  );
}

function inspectConsumptionBounds(audit: ReactionAudit): void {
  type ConsumedElement = NonNullable<
    ReactionAudit["auraConsumed"]
  >[number]["element"];
  const before = new Map<ConsumedElement, number>(
    (audit.auraBefore ?? []).map((entry) => [
      entry.element,
      entry.gaugeUnits
    ])
  );
  const totals = new Map<ConsumedElement, number>();
  for (const consumed of audit.auraConsumed ?? []) {
    totals.set(
      consumed.element,
      (totals.get(consumed.element) ?? 0) +
        consumed.gaugeUnits
    );
  }
  for (const [element, consumed] of totals) {
    invariant(
      consumed <= (before.get(element) ?? 0) + EPSILON,
      `over-consumed ${element}: consumed=${consumed}, before=${before.get(
        element
      ) ?? 0}`
    );
  }
}

function inspectAudit(audit: ReactionAudit, path: string): void {
  invariant(
    audit.mechanicsTruncation === null,
    `${path} unexpectedly truncated target mechanics`
  );
  invariant(
    audit.unsupportedReactions.length === 0,
    `${path} reported unsupported reactions: ${audit.unsupportedReactions.join(
      ","
    )}`
  );
  invariant(
    audit.triggered === (audit.reaction !== "none"),
    `${path} triggered/reaction drift`
  );
  inspectNumbers(audit, path);
  inspectAura(audit.auraBefore ?? [], `${path}.auraBefore`);
  inspectAura(audit.auraAfter ?? [], `${path}.auraAfter`);
  inspectSourceMutations(audit, path);
  inspectKnownBudgets(audit, path);
  inspectConsumptionBounds(audit);
}

function applyIncoming(
  scenario: SpecialStateScenario,
  vector: IncomingVector,
  mode: "same-frame" | "settled-next-frame"
) {
  const setup = replayPrefix(scenario);
  const followup =
    mode === "settled-next-frame" &&
    setup.pendingFollowup !== null
      ? setup.engine.processQuickenBloomFollowup({
          frame: 0,
          ...setup.pendingFollowup
        })
      : null;
  const frame = mode === "same-frame" ? 0 : 1;
  const preIncomingAura = setup.engine.getAuraStateAt(frame);
  const shatter =
    vector.element === "geo" ||
    vector.element === "physical"
      ? setup.engine.processShatterHit({
          frame,
          element: vector.element,
          strikeType: vector.strikeType,
          poiseDamage: 0
        })
      : null;
  const audit = setup.engine.processHit({
    frame,
    sourceActorId: `${scenario.id}:incoming:${vector.element}:${vector.gaugeUnits ?? "none"}`,
    element: vector.element,
    ...(vector.gaugeUnits === null
      ? {}
      : {
          application: noIcd(
            vector.gaugeUnits,
            `${scenario.id}:incoming:${vector.element}:${vector.gaugeUnits}`
          )
        })
  });
  return {
    prefixAudits: setup.audits,
    prefixAura: setup.aura,
    preIncomingAura,
    electroChargedActive: setup.electroChargedActive,
    pendingFollowup: setup.pendingFollowup,
    followup,
    shatter,
    audit,
    postMask: specialMask(
      audit.auraAfter ?? [],
      updateElectroChargedState(
        setup.electroChargedActive,
        audit
      )
    )
  };
}

function inspectIncomingResult(
  result: ReturnType<typeof applyIncoming>,
  path: string
): void {
  result.prefixAudits.forEach((audit, index) =>
    inspectAudit(audit, `${path}.prefix[${index}]`)
  );
  inspectAura(result.prefixAura, `${path}.prefixAura`);
  if (result.shatter !== null) {
    inspectNumbers(result.shatter, `${path}.shatter`);
    let cursor = result.shatter.audit.auraBefore;
    for (const [index, mutation] of result.shatter.mutations.entries()) {
      expect(
        mutation.auraBefore,
        `${path}.shatter.mutations[${index}] continuity drift`
      ).toStrictEqual(cursor);
      invariant(
        mutation.consumedGaugeUnits >= -EPSILON,
        `${path}.shatter.mutations[${index}] negative consumption`
      );
      cursor = mutation.auraAfter;
    }
    expect(
      result.shatter.audit.auraAfter,
      `${path}.shatter audit continuity drift`
    ).toStrictEqual(cursor);
    expect(
      result.audit.auraBefore,
      `${path} application does not continue from Shatter`
    ).toStrictEqual(result.shatter.audit.auraAfter);
  } else {
    expect(
      result.audit.auraBefore,
      `${path} application does not continue from prefix`
    ).toStrictEqual(result.preIncomingAura);
  }
  inspectAudit(result.audit, `${path}.audit`);
  invariant(
    ALLOWED_SPECIAL_MASKS.has(result.postMask.join(",")),
    `${path} escaped the reachable special-state closure: ${result.postMask.join(
      ","
    )}`
  );
}

function transitionProjection(
  mode: "same-frame" | "settled-next-frame"
) {
  return SPECIAL_STATE_SCENARIOS.flatMap((scenario) =>
    INCOMING_VECTORS.map((vector) => {
      const result = applyIncoming(scenario, vector, mode);
      return {
        scenario: scenario.id,
        incoming: [
          vector.element,
          vector.gaugeUnits,
          vector.strikeType
        ],
        reaction: result.audit.reaction,
        reactions: result.audit.reactions,
        postMask: result.postMask,
        shatter: result.shatter?.audit.triggered ?? false,
        shatterScheduled:
          result.shatter?.audit.scheduled ?? false,
        periodicOperation:
          result.audit.periodicReaction?.operation ?? null,
        burningOperation:
          result.audit.burningReaction?.operation ?? null,
        followupStatus: result.followup?.status ?? null,
        auraAfter: result.audit.auraAfter
      };
    })
  );
}

function transitionHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

describe("aura-v7 reachable special-state finite grid", () => {
  it.each(SPECIAL_STATE_SCENARIOS)(
    "constructs the $id mask deterministically through public hits",
    (scenario) => {
      const first = replayPrefix(scenario);
      const repeat = replayPrefix(scenario);

      expect(first.audits).toStrictEqual(repeat.audits);
      expect(first.aura).toStrictEqual(repeat.aura);
      expect(
        specialMask(
          first.aura,
          first.electroChargedActive
        )
      ).toEqual([...scenario.expectedMask].sort());
      first.audits.forEach((audit, index) =>
        inspectAudit(audit, `${scenario.id}.prefix[${index}]`)
      );
    }
  );

  it.each(SPECIAL_STATE_SCENARIOS)(
    "keeps $id independent of public initial-Aura array order",
    (scenario) => {
      const forward = replayOrderSeed(scenario, false);
      const reversed = replayOrderSeed(scenario, true);

      expect(forward).toStrictEqual(reversed);
      forward.forEach((audit, index) =>
        inspectAudit(audit, `${scenario.id}.order[${index}]`)
      );
    }
  );

  it.each(SPECIAL_STATE_SCENARIOS)(
    "closes same-frame transient $id over seven elements plus physical-blunt",
    (scenario) => {
      let executed = 0;
      for (const vector of INCOMING_VECTORS) {
        const label = `${scenario.id}:${vector.element}:${vector.gaugeUnits ?? "none"}`;
        const first = applyIncoming(
          scenario,
          vector,
          "same-frame"
        );
        const repeat = applyIncoming(
          scenario,
          vector,
          "same-frame"
        );

        expect(first).toStrictEqual(repeat);
        inspectIncomingResult(first, label);
        executed += 1;
      }
      expect(executed).toBe(
        ELEMENTAL_INCOMING.length *
          REPRESENTATIVE_GAUGES.length +
          1
      );
    }
  );

  it.each(SPECIAL_STATE_SCENARIOS)(
    "closes settled next-frame $id after queued Quicken follow-ups",
    (scenario) => {
      for (const vector of INCOMING_VECTORS) {
        const label =
          `${scenario.id}:settled:${vector.element}:` +
          `${vector.gaugeUnits ?? "none"}`;
        const first = applyIncoming(
          scenario,
          vector,
          "settled-next-frame"
        );
        const repeat = applyIncoming(
          scenario,
          vector,
          "settled-next-frame"
        );

        expect(first).toStrictEqual(repeat);
        inspectIncomingResult(first, label);
      }
    }
  );

  it("freezes exact same-frame and settled transition projections", () => {
    expect(
      transitionHash(transitionProjection("same-frame"))
    ).toBe(TRANSITION_HASHES.sameFrame);
    expect(
      transitionHash(
        transitionProjection("settled-next-frame")
      )
    ).toBe(TRANSITION_HASHES.settledNextFrame);
  });

  it("keeps semantic sentinels for Shatter, Aggravate, and EC stop", () => {
    const frozen = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "frozen"
    )!;
    for (const vector of [
      {
        element: "geo",
        gaugeUnits: 0.5,
        strikeType: "default"
      },
      {
        element: "physical",
        gaugeUnits: null,
        strikeType: "blunt"
      }
    ] as const) {
      const result = applyIncoming(
        frozen,
        vector,
        "same-frame"
      );
      expect(result.shatter?.audit).toMatchObject({
        reaction: "shatter",
        triggered: true,
        scheduled: true
      });
      expect(result.postMask).not.toContain("frozen");
    }

    const quicken = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "quicken"
    )!;
    expect(
      applyIncoming(
        quicken,
        {
          element: "electro",
          gaugeUnits: 0.5,
          strikeType: "default"
        },
        "same-frame"
      ).audit
    ).toMatchObject({
      reaction: "aggravate",
      reactions: ["aggravate"]
    });

    const electroCharged = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "electro-charged"
    )!;
    const overload = applyIncoming(
      electroCharged,
      {
        element: "pyro",
        gaugeUnits: 0.5,
        strikeType: "default"
      },
      "same-frame"
    );
    expect(overload.audit.reactions).toContain("overload");
    expect(overload.audit.periodicReaction).toMatchObject({
      operation: "stop"
    });
    expect(overload.postMask).not.toContain(
      "electroCharged"
    );
  });
});

describe("aura-v7 special-state public lifecycle boundaries", () => {
  it("executes the queued Quicken follow-up against live EC+Quicken Aura", () => {
    const scenario = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "electro-charged-quicken"
    )!;
    const run = () => {
      const setup = replayPrefix(scenario);
      return setup.engine.processQuickenBloomFollowup({
        frame: 0,
        sourceActorId: "electro-followup",
        triggerElement: "electro"
      });
    };
    const first = run();
    const repeat = run();

    expect(first).toStrictEqual(repeat);
    expect(first).toMatchObject({
      status: "triggered",
      blockedReason: null,
      bloomReaction: {
        reaction: "bloom",
        operation: "quicken-followup",
        triggerElement: "electro",
        scheduled: true
      }
    });
    inspectNumbers(first, "quickenFollowup");
    inspectAura(first.auraBefore, "quickenFollowup.auraBefore");
    inspectAura(first.auraAfter, "quickenFollowup.auraAfter");
    inspectSourceMutations(first, "quickenFollowup");
    inspectKnownBudgets(first, "quickenFollowup");
  });

  it("materializes Frozen and Quicken observers at their exact expiry frames", () => {
    const frozenScenario = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "frozen"
    )!;
    const frozenSetup = replayPrefix(frozenScenario);
    const frozenStart =
      frozenSetup.audits.at(-1)!.frozenReaction!;
    const frozenExpiryFrame = frozenStart.expiresAtFrame!;
    frozenSetup.engine.getAuraStateAt(frozenExpiryFrame);
    const frozenExpiry = frozenSetup.engine.expireFrozen(
      frozenExpiryFrame,
      frozenStart.generation,
      frozenExpiryFrame
    );

    expect(frozenExpiry).toMatchObject({
      operation: "expire",
      frame: frozenExpiryFrame,
      reason: "FROZEN_DECAY_EXPIRED"
    });
    inspectNumbers(frozenExpiry, "frozenExpiry");
    inspectAura(frozenExpiry.auraBefore, "frozenExpiry.auraBefore");
    inspectAura(frozenExpiry.auraAfter, "frozenExpiry.auraAfter");

    const quickenScenario = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "quicken"
    )!;
    const quickenSetup = replayPrefix(quickenScenario);
    const quickenStart =
      quickenSetup.audits.at(-1)!.catalyzeReaction!
        .quicken!;
    const quickenExpiryFrame = quickenStart.expiresAtFrame!;
    quickenSetup.engine.getAuraStateAt(quickenExpiryFrame);
    const quickenExpiry = quickenSetup.engine.expireQuicken(
      quickenExpiryFrame,
      quickenStart.generation,
      quickenExpiryFrame
    );

    expect(quickenExpiry).toMatchObject({
      operation: "expire",
      frame: quickenExpiryFrame,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    inspectNumbers(quickenExpiry, "quickenExpiry");
    inspectAura(
      quickenExpiry.auraBefore,
      "quickenExpiry.auraBefore"
    );
    inspectAura(
      quickenExpiry.auraAfter,
      "quickenExpiry.auraAfter"
    );
  });

  it("runs Burning callback-before-decay and separates the Quicken/Fuel expiry boundaries", () => {
    const burningScenario = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "burning-fuel"
    )!;
    const tickSetup = replayPrefix(burningScenario);
    const burningStart =
      tickSetup.audits.at(-1)!.burningReaction!;
    const tickFrame = burningStart.nextTickFrame!;
    const tick = tickSetup.engine.prepareBurningTickBeforeDecay(
      tickFrame,
      burningStart.generation,
      1
    );

    expect(tick).toMatchObject({
      operation: "tick",
      frame: tickFrame,
      tickIndex: 1
    });
    inspectNumbers(tick, "burningTick");
    inspectAura(tick.auraBefore, "burningTick.auraBefore");
    inspectAura(tick.auraAfter, "burningTick.auraAfter");

    const mixedScenario = SPECIAL_STATE_SCENARIOS.find(
      (entry) => entry.id === "burning-fuel-quicken"
    )!;
    const expirySetup = replayPrefix(mixedScenario);
    const mixedStart =
      expirySetup.audits.at(-1)!.burningReaction!;
    const quickenExpiryFrame =
      mixedStart.quickenStateMutation.expiresAtFrameAfter!;
    const expiryFrame = mixedStart.fuelExpiresAtFrame!;
    expect(quickenExpiryFrame).toBeLessThan(expiryFrame);
    expirySetup.engine.getAuraStateAt(quickenExpiryFrame);
    const quickenExpiry = expirySetup.engine.expireQuicken(
      quickenExpiryFrame,
      mixedStart.quickenStateMutation.generationAfter,
      quickenExpiryFrame
    );
    expect(quickenExpiry).toMatchObject({
      operation: "expire",
      frame: quickenExpiryFrame,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    inspectNumbers(
      quickenExpiry,
      "burningQuickenExpiry"
    );
    inspectAura(
      quickenExpiry.auraBefore,
      "burningQuickenExpiry.auraBefore"
    );
    inspectAura(
      quickenExpiry.auraAfter,
      "burningQuickenExpiry.auraAfter"
    );

    expirySetup.engine.getAuraStateAt(expiryFrame);
    const expiry = expirySetup.engine.expireBurningFuel(
      expiryFrame,
      mixedStart.generation,
      expiryFrame
    );

    expect(expiry).toMatchObject({
      operation: "expire",
      frame: expiryFrame,
      reason: "FUEL_EXPIRED",
      quickenStateMutation: {
        operation: "none"
      }
    });
    inspectNumbers(expiry, "burningFuelExpiry");
    inspectAura(
      expiry.auraBefore,
      "burningFuelExpiry.auraBefore"
    );
    inspectAura(
      expiry.auraAfter,
      "burningFuelExpiry.auraAfter"
    );
    inspectSourceMutations(expiry, "burningFuelExpiry");
  });

  it("runs EC wane/tick and materializes the exact coexistence expiry", () => {
    const makeStrongEc = () => {
      const engine = new AuraEngine({
        mode: "aura-v7",
        reactableTickModel: "cached-boundary-v2",
        initialAura: [{ element: "hydro", gaugeUnits: 2 }]
      });
      const start = engine.processHit({
        frame: 0,
        sourceActorId: "electro",
        element: "electro",
        application: noIcd(2, "strong-ec")
      }).periodicReaction!;
      return { engine, start };
    };

    const stream = makeStrongEc();
    const wane = stream.engine.waneElectroCharged(16, true);
    expect(wane).toMatchObject({
      operation: "wane",
      frame: 16
    });
    const tick = stream.engine.prepareElectroChargedTick(
      stream.start.nextTickFrame!,
      stream.start.generation
    );
    expect(tick).toMatchObject({
      operation: "tick",
      frame: stream.start.nextTickFrame
    });
    expect(stream.start).toMatchObject({
      firstDamageFrame: 10,
      nextTickFrame: 70
    });
    inspectNumbers(wane, "electroChargedWane");
    inspectNumbers(tick, "electroChargedTick");
    inspectAura(wane.auraBefore, "electroChargedWane.auraBefore");
    inspectAura(wane.auraAfter, "electroChargedWane.auraAfter");
    inspectAura(tick.auraBefore, "electroChargedTick.auraBefore");
    inspectAura(tick.auraAfter, "electroChargedTick.auraAfter");

    const expiryStream = makeStrongEc();
    const expiryFrame =
      expiryStream.start.coexistenceExpiresAtFrame!;
    expiryStream.engine.getAuraStateAt(expiryFrame);
    const expiry =
      expiryStream.engine.expireElectroCharged(
        expiryFrame,
        expiryStream.start.generation,
        expiryFrame
      );
    expect(expiry).toMatchObject({
      operation: "stop",
      frame: expiryFrame,
      reason: "AURA_DECAY_EXPIRED"
    });
    inspectNumbers(expiry, "electroChargedExpiry");
    inspectAura(
      expiry.auraBefore,
      "electroChargedExpiry.auraBefore"
    );
    inspectAura(
      expiry.auraAfter,
      "electroChargedExpiry.auraAfter"
    );
  });
});
