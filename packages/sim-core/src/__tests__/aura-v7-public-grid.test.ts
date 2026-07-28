import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

type PersistentElement =
  | "pyro"
  | "cryo"
  | "hydro"
  | "electro"
  | "dendro";
type IncomingElement =
  | PersistentElement
  | "anemo"
  | "geo"
  | "physical";
type AuraAudit = ReturnType<AuraEngine["processHit"]>;
type AuraState = NonNullable<AuraAudit["auraBefore"]>;

const PERSISTENT_ELEMENTS: readonly PersistentElement[] = [
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "dendro"
];
const INCOMING_ELEMENTS: readonly IncomingElement[] = [
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro",
  "physical"
];
const GAUGES = [0.125, 0.5, 1, 2, 3] as const;
const INITIAL_CHOICE_COUNT = GAUGES.length + 1;
const INITIAL_ASSIGNMENT_COUNT =
  INITIAL_CHOICE_COUNT ** PERSISTENT_ELEMENTS.length;
const COVERING_VECTOR_COUNT =
  INITIAL_ASSIGNMENT_COUNT * INCOMING_ELEMENTS.length;
const EPSILON = 1e-9;

interface PublicVector {
  assignment: number;
  initialAura: Array<{
    element: PersistentElement;
    gaugeUnits: number;
  }>;
  incomingElement: IncomingElement;
  incomingGauge: number;
}

function close(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    EPSILON *
      Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function describeVector(vector: PublicVector): string {
  const initial =
    vector.initialAura.length === 0
      ? "none"
      : vector.initialAura
          .map(
            ({ element, gaugeUnits }) =>
              `${element}:${gaugeUnits}`
          )
          .join(",");
  return (
    `assignment=${vector.assignment}; initial=[${initial}]; ` +
    `incoming=${vector.incomingElement}:${vector.incomingGauge}`
  );
}

function invariant(
  condition: boolean,
  message: string,
  vector: PublicVector
): asserts condition {
  if (!condition) {
    throw new Error(
      `${message}; ${describeVector(vector)}`
    );
  }
}

function makeAudit(
  vector: PublicVector,
  initialAura = vector.initialAura
): AuraAudit {
  return new AuraEngine({
    mode: "aura-v7",
    initialAura
  }).processHit({
    frame: 0,
    sourceActorId: "aura-v7-public-grid",
    element: vector.incomingElement,
    application: {
      gaugeUnits: vector.incomingGauge,
      icdTag: "aura-v7-public-grid",
      icdGroup: "no-icd"
    }
  });
}

function gaugeMap(
  entries: readonly {
    element: string;
    gaugeUnits: number;
  }[] | null
): Map<string, number> {
  return new Map(
    (entries ?? []).map((entry) => [
      entry.element,
      entry.gaugeUnits
    ])
  );
}

function inspectNumbers(
  value: unknown,
  path: string,
  vector: PublicVector
): void {
  if (typeof value === "number") {
    invariant(
      Number.isFinite(value),
      `non-finite number at ${path}: ${String(value)}`,
      vector
    );
    if (
      /(gauge|units|frame|duration|delay|multiplier|radius|rate|ratio|factor)/i.test(
        path
      )
    ) {
      invariant(
        value >= -EPSILON,
        `negative mechanics number at ${path}: ${value}`,
        vector
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectNumbers(item, `${path}[${index}]`, vector)
    );
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      inspectNumbers(item, `${path}.${key}`, vector)
    );
  }
}

function inspectAuraState(
  entries: AuraState,
  path: string,
  vector: PublicVector
): void {
  const elements = new Set<string>();
  let previousElement = "";
  for (const entry of entries) {
    invariant(
      !elements.has(entry.element),
      `duplicate Aura element ${entry.element} at ${path}`,
      vector
    );
    elements.add(entry.element);
    invariant(
      previousElement === "" ||
        previousElement.localeCompare(entry.element) <= 0,
      `unstable Aura ordering ${previousElement}>${entry.element} at ${path}`,
      vector
    );
    previousElement = entry.element;
    invariant(
      Number.isFinite(entry.gaugeUnits) &&
        entry.gaugeUnits >= -EPSILON,
      `invalid Aura gauge ${entry.element}:${entry.gaugeUnits} at ${path}`,
      vector
    );

    if (entry.sourceSlots === undefined) continue;
    const sourceIds = new Set<string>();
    let maximumSlotGauge = 0;
    for (const slot of entry.sourceSlots) {
      invariant(
        !sourceIds.has(slot.sourceActorId),
        `duplicate source slot ${entry.element}:${slot.sourceActorId} at ${path}`,
        vector
      );
      sourceIds.add(slot.sourceActorId);
      invariant(
        Number.isFinite(slot.gaugeUnits) &&
          slot.gaugeUnits >= -EPSILON,
        `invalid source-slot gauge ${entry.element}:${slot.sourceActorId}:${slot.gaugeUnits} at ${path}`,
        vector
      );
      maximumSlotGauge = Math.max(
        maximumSlotGauge,
        slot.gaugeUnits
      );
    }
    invariant(
      close(entry.gaugeUnits, maximumSlotGauge),
      `source-slot max drift for ${entry.element} at ${path}: state=${entry.gaugeUnits}, maxSlot=${maximumSlotGauge}`,
      vector
    );
  }
}

function inspectSourceMutations(
  value: unknown,
  path: string,
  vector: PublicVector
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectSourceMutations(
        item,
        `${path}[${index}]`,
        vector
      )
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
          )}`,
          vector
        );
      }
    );
  }
  Object.entries(object).forEach(([key, item]) =>
    inspectSourceMutations(
      item,
      `${path}.${key}`,
      vector
    )
  );
}

function inspectKnownBudgets(
  value: unknown,
  path: string,
  vector: PublicVector
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectKnownBudgets(
        item,
        `${path}[${index}]`,
        vector
      )
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
      `budget drift at ${path}: ${beforeKey}=${before}, ${consumedKey}=${consumed}, ${afterKey}=${after}`,
      vector
    );
  }
  Object.entries(object).forEach(([key, item]) =>
    inspectKnownBudgets(
      item,
      `${path}.${key}`,
      vector
    )
  );
}

function inspectAuraConservation(
  audit: AuraAudit,
  vector: PublicVector
): void {
  invariant(
    audit.mechanicsTruncation === null,
    "public aura-v7 vector unexpectedly truncated target mechanics",
    vector
  );
  const before = gaugeMap(audit.auraBefore);
  const after = gaugeMap(audit.auraAfter);
  const consumed = new Map<string, number>();
  for (const entry of audit.auraConsumed ?? []) {
    const available = before.get(entry.element) ?? 0;
    invariant(
      entry.gaugeUnits <= available + EPSILON,
      `over-consumed ${entry.element}: consumed=${entry.gaugeUnits}, before=${available}`,
      vector
    );
    consumed.set(
      entry.element,
      (consumed.get(entry.element) ?? 0) +
        entry.gaugeUnits
    );
  }

  for (const element of PERSISTENT_ELEMENTS) {
    const beforeGauge = before.get(element) ?? 0;
    const afterGauge = after.get(element) ?? 0;
    const consumedGauge = consumed.get(element) ?? 0;
    const withoutAttachment =
      beforeGauge - consumedGauge;
    if (element !== vector.incomingElement) {
      invariant(
        close(afterGauge, withoutAttachment),
        `persistent Aura conservation drift for ${element}: before=${beforeGauge}, consumed=${consumedGauge}, after=${afterGauge}`,
        vector
      );
      continue;
    }

    const attachmentUpperBound = Math.max(
      withoutAttachment,
      0.8 * vector.incomingGauge
    );
    invariant(
      afterGauge >= withoutAttachment - EPSILON &&
        afterGauge <= attachmentUpperBound + EPSILON,
      `incoming Aura attachment bound drift for ${element}: before=${beforeGauge}, consumed=${consumedGauge}, after=${afterGauge}, upper=${attachmentUpperBound}`,
      vector
    );
  }
}

function inspectAudit(
  audit: AuraAudit,
  vector: PublicVector
): void {
  inspectNumbers(audit, "audit", vector);
  inspectAuraState(
    audit.auraBefore ?? [],
    "auraBefore",
    vector
  );
  inspectAuraState(
    audit.auraAfter ?? [],
    "auraAfter",
    vector
  );
  inspectSourceMutations(audit, "audit", vector);
  inspectKnownBudgets(audit, "audit", vector);
  inspectAuraConservation(audit, vector);
}

function initialAuraForAssignment(
  assignment: number
): PublicVector["initialAura"] {
  let choices = assignment;
  const initialAura: PublicVector["initialAura"] = [];
  for (const element of PERSISTENT_ELEMENTS) {
    const choice = choices % INITIAL_CHOICE_COUNT;
    choices = Math.floor(
      choices / INITIAL_CHOICE_COUNT
    );
    if (choice > 0) {
      initialAura.push({
        element,
        gaugeUnits: GAUGES[choice - 1]!
      });
    }
  }
  return initialAura;
}

describe("aura-v7 public mixed-gauge covering grid", () => {
  it("is finite, non-negative, conservative, deterministic, and initial-order independent", () => {
    /**
     * Full cross product:
     *   6^5 public initial-Aura assignments
     *   × 8 incoming elements
     *   × 5 incoming gauges
     *   = 311,040 vectors.
     *
     * The default regression keeps every one of the 7,776 mixed-gauge
     * initial assignments and every incoming element, while selecting the
     * incoming gauge cyclically. Thus all five incoming gauges occur for
     * every incoming element without multiplying wall time by five:
     * 62,208 covering vectors. Each vector is evaluated three times on fresh
     * engines: original, exact repeat, and reversed initial-Aura order.
     */
    let executed = 0;
    for (
      let assignment = 0;
      assignment < INITIAL_ASSIGNMENT_COUNT;
      assignment += 1
    ) {
      const initialAura =
        initialAuraForAssignment(assignment);
      for (
        let incomingIndex = 0;
        incomingIndex < INCOMING_ELEMENTS.length;
        incomingIndex += 1
      ) {
        const vector: PublicVector = {
          assignment,
          initialAura,
          incomingElement:
            INCOMING_ELEMENTS[incomingIndex]!,
          incomingGauge:
            GAUGES[
              (assignment + incomingIndex) %
                GAUGES.length
            ]!
        };
        const original = makeAudit(vector);
        const repeat = makeAudit(vector);
        const reversed = makeAudit(vector, [
          ...initialAura
        ].reverse());

        invariant(
          JSON.stringify(original) ===
            JSON.stringify(repeat),
          "fresh-engine deterministic replay drift",
          vector
        );
        invariant(
          JSON.stringify(original) ===
            JSON.stringify(reversed),
          "initialAura array-order drift",
          vector
        );
        inspectAudit(original, vector);
        executed += 1;
      }
    }

    expect(executed).toBe(COVERING_VECTOR_COUNT);
  });
});
