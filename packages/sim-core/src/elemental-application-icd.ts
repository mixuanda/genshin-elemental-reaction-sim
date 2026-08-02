import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  resolveElementalApplicationGroup,
  resolveElementalApplicationResetAtFrame,
  resolveReactionOwnedApplicationBinding,
  type GcsimElementalApplicationGroupId,
  type GcsimReactionOwnedApplicationBinding,
  type PublicGcsimElementalApplicationGroupId,
} from "@genshin-dps-lab/icd-profiles";
import type {
  AnyElementalApplication,
  ElementalApplicationIcdDecision,
  ElementalApplicationIcdDecisionV147,
  ElementalApplicationReactionFixedGcsimDecision,
  ElementalApplicationIcdSelector,
  IcdProfile,
  IcdSequenceTailPolicy,
  TrustedReactionElementalApplicationInput,
} from "@genshin-dps-lab/schemas";

export interface ElementalApplicationAttemptInput {
  frame: number;
  sourceActorId: string;
  application: AnyElementalApplication;
}

export interface ElementalApplicationIcdEngineOptions {
  legacyProfiles?: Readonly<Record<string, IcdProfile>>;
}

export interface PreparedTrustedReactionElementalApplicationAttempt {
  input: Readonly<TrustedReactionElementalApplicationInput>;
  element: GcsimReactionOwnedApplicationBinding["element"];
  nominalGaugeUnits: number;
}

interface FixedWindowState<
  GroupId extends GcsimElementalApplicationGroupId =
    GcsimElementalApplicationGroupId,
> {
  windowStartGroupId: GroupId;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  nextHitIndex: number;
}

interface LegacyWindowState {
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  nextHitIndex: number;
}

interface NormalizedApplication {
  gaugeUnits: number;
  selector: ElementalApplicationIcdSelector;
}

interface ElementalApplicationAttemptIdentity {
  frame: number;
  sourceActorId: string;
}

interface PreparedDirectElementalApplicationAttempt extends ElementalApplicationAttemptIdentity {
  application: NormalizedApplication;
}

const NO_ICD_DECISION: Readonly<
  Extract<ElementalApplicationIcdDecision, { kind: "no-icd" }>
> = Object.freeze({
  kind: "no-icd",
  evaluated: true,
  consumed: false,
  applicationMultiplier: 1,
  allowed: true,
  scope: null,
  profileId: null,
  icdTag: null,
  groupId: null,
  windowStartGroupId: null,
  resetFrames: null,
  windowStartFrame: null,
  resetAtFrame: null,
  hitIndex: null,
  sequenceIndex: null,
  tailPolicy: null,
  resetSchedulePolicy: "bypass",
});

const DEFAULT_LEGACY_PROFILE: Readonly<IcdProfile> = Object.freeze({
  resetFrames: 150,
  applicationSequence: Object.freeze([
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
    false,
  ]) as unknown as boolean[],
  tailPolicy: "clamp",
});

const BURNING_LEGACY_PROFILE: Readonly<IcdProfile> = Object.freeze({
  resetFrames: 120,
  applicationSequence: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]) as unknown as boolean[],
  tailPolicy: "clamp",
});

function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Elemental application ${field} must be a string.`);
  }
  if (value.trim().length === 0) {
    throw new RangeError(`Elemental application ${field} must not be empty.`);
  }
}

function assertFrame(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Elemental application frame must be finite.");
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      "Elemental application frame must be a non-negative safe integer.",
    );
  }
}

function assertGaugeUnits(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Elemental application gaugeUnits must be finite.");
  }
  if (value <= 0) {
    throw new RangeError("Elemental application gaugeUnits must be positive.");
  }
  if (value > 20) {
    throw new RangeError(
      "Elemental application gaugeUnits must not exceed 20.",
    );
  }
}

function assertExactDataPropertyKeys(
  properties: ReadonlyMap<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of properties.keys()) {
    if (!allowed.has(key)) {
      throw new TypeError(
        `${label} contains forbidden field ${key}; ICD policy fields are engine-owned.`,
      );
    }
  }
}

function assertPlainObject(value: object, label: string): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

/**
 * Capture plain data without invoking caller-provided accessors. Trusted
 * reaction inputs are a closed wire boundary, so accessor-backed fields are
 * rejected instead of sampled. Reflective Proxy traps cannot be identified
 * portably; the consuming engine/Aura entry guards make any reentrant trap
 * fail before state mutation.
 */
function snapshotPlainDataProperties(
  value: unknown,
  label: string,
): ReadonlyMap<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  assertPlainObject(value, label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const properties = new Map<string, unknown>();
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") {
      throw new TypeError(
        `${label} contains forbidden field ${String(key)}; ICD policy fields are engine-owned.`,
      );
    }
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value")
    ) {
      throw new TypeError(
        `${label} field ${key} must be a data property; accessor properties are forbidden.`,
      );
    }
    properties.set(key, descriptor.value);
  }
  return properties;
}

function requireDataProperty(
  properties: ReadonlyMap<string, unknown>,
  key: string,
  label: string,
): unknown {
  if (!properties.has(key)) {
    throw new TypeError(`${label} is missing required field ${key}.`);
  }
  return properties.get(key);
}

function normalizeReactionOwnedInput(
  input: TrustedReactionElementalApplicationInput,
): Readonly<{
  frame: number;
  sourceActorId: string;
  nominalGaugeUnits: number;
  binding: GcsimReactionOwnedApplicationBinding;
}> {
  const inputLabel = "Reaction-owned elemental application attempt";
  const inputProperties = snapshotPlainDataProperties(input, inputLabel);
  const frame = requireDataProperty(inputProperties, "frame", inputLabel);
  const sourceActorId = requireDataProperty(
    inputProperties,
    "sourceActorId",
    inputLabel,
  );
  assertFrame(frame);
  assertNonEmptyString(sourceActorId, "sourceActorId");

  const channelLabel = "Reaction-owned elemental application channel";
  const channel = requireDataProperty(inputProperties, "channel", inputLabel);
  const channelProperties = snapshotPlainDataProperties(channel, channelLabel);
  const channelKind = requireDataProperty(
    channelProperties,
    "kind",
    channelLabel,
  );
  if (channelKind === "burning-tick") {
    assertExactDataPropertyKeys(
      inputProperties,
      ["frame", "sourceActorId", "channel"],
      "Reaction-owned Burning application attempt",
    );
    assertExactDataPropertyKeys(
      channelProperties,
      ["kind"],
      "Reaction-owned Burning channel",
    );
    const binding = resolveReactionOwnedApplicationBinding("burning-tick");
    if (binding.gauge.kind !== "fixed") {
      throw new Error(
        "Reaction-owned Burning policy must provide a fixed Gauge value.",
      );
    }
    return Object.freeze({
      frame,
      sourceActorId,
      nominalGaugeUnits: binding.gauge.units,
      binding,
    });
  }
  if (channelKind === "swirl-propagation") {
    assertExactDataPropertyKeys(
      inputProperties,
      ["frame", "sourceActorId", "channel", "nominalGaugeUnits"],
      "Reaction-owned Swirl application attempt",
    );
    assertExactDataPropertyKeys(
      channelProperties,
      ["kind", "element"],
      "Reaction-owned Swirl channel",
    );
    const nominalGaugeUnits = requireDataProperty(
      inputProperties,
      "nominalGaugeUnits",
      "Reaction-owned Swirl application attempt",
    );
    assertGaugeUnits(nominalGaugeUnits);
    const element = requireDataProperty(
      channelProperties,
      "element",
      "Reaction-owned Swirl channel",
    );
    if (
      element !== "pyro" &&
      element !== "hydro" &&
      element !== "cryo" &&
      element !== "electro"
    ) {
      throw new RangeError(
        `unknown swirl-propagation application element: ${String(element)}`,
      );
    }
    const binding = resolveReactionOwnedApplicationBinding(
      "swirl-propagation",
      element,
    );
    return Object.freeze({
      frame,
      sourceActorId,
      nominalGaugeUnits,
      binding,
    });
  }
  throw new RangeError(
    `Unknown reaction-owned elemental application channel: ${String(
      channelKind,
    )}`,
  );
}

/**
 * Validate a trusted reaction-owned attempt without consuming any ICD state
 * and return the policy-owned applied element. Aura uses this before advancing
 * its clock so a forged input cannot decay or otherwise mutate target state.
 */
export function resolveTrustedReactionElementalApplicationElement(
  input: TrustedReactionElementalApplicationInput,
): GcsimReactionOwnedApplicationBinding["element"] {
  return prepareTrustedReactionElementalApplicationAttempt(input).element;
}

/**
 * Capture one validated reaction-owned attempt as immutable plain data.
 * Accessor-backed inputs are rejected without invoking them; subsequently
 * mutated caller objects are never reread after Aura advances its clock.
 */
export function prepareTrustedReactionElementalApplicationAttempt(
  input: TrustedReactionElementalApplicationInput,
): Readonly<PreparedTrustedReactionElementalApplicationAttempt> {
  const normalized = normalizeReactionOwnedInput(input);
  const preparedInput: TrustedReactionElementalApplicationInput =
    normalized.binding.sourceKind === "burning-tick"
      ? {
          frame: normalized.frame,
          sourceActorId: normalized.sourceActorId,
          channel: Object.freeze({ kind: "burning-tick" }),
        }
      : {
          frame: normalized.frame,
          sourceActorId: normalized.sourceActorId,
          channel: Object.freeze({
            kind: "swirl-propagation",
            element: normalized.binding.element,
          }),
          nominalGaugeUnits: normalized.nominalGaugeUnits,
        };
  return Object.freeze({
    input: Object.freeze(preparedInput),
    element: normalized.binding.element,
    nominalGaugeUnits: normalized.nominalGaugeUnits,
  });
}

function checkedIncrement(value: number, field: string): number {
  const next = value + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError(`${field} exceeds the safe integer range.`);
  }
  return next;
}

function checkedResetAtFrame(frame: number, resetFrames: number): number {
  const resetAtFrame = frame + resetFrames;
  if (!Number.isSafeInteger(resetAtFrame)) {
    throw new RangeError(
      "Legacy application resetAtFrame exceeds the safe integer range.",
    );
  }
  return resetAtFrame;
}

function validateLegacyProfile(
  profileId: string,
  profile: IcdProfile,
): IcdProfile {
  if (
    typeof profile.resetFrames !== "number" ||
    !Number.isSafeInteger(profile.resetFrames) ||
    profile.resetFrames <= 0 ||
    profile.resetFrames > 36_000
  ) {
    throw new RangeError(
      `Legacy elemental application profile "${profileId}" resetFrames must be a positive safe integer no greater than 36000.`,
    );
  }
  if (
    !Array.isArray(profile.applicationSequence) ||
    profile.applicationSequence.length === 0 ||
    profile.applicationSequence.length > 128 ||
    profile.applicationSequence.some((value) => typeof value !== "boolean")
  ) {
    throw new TypeError(
      `Legacy elemental application profile "${profileId}" must provide 1 to 128 boolean applicationSequence entries.`,
    );
  }
  if (
    profile.tailPolicy !== undefined &&
    profile.tailPolicy !== "repeat" &&
    profile.tailPolicy !== "clamp"
  ) {
    throw new RangeError(
      `Legacy elemental application profile "${profileId}" has an unsupported tailPolicy.`,
    );
  }
  return Object.freeze({
    resetFrames: profile.resetFrames,
    applicationSequence: [...profile.applicationSequence],
    ...(profile.tailPolicy === undefined
      ? {}
      : { tailPolicy: profile.tailPolicy }),
  });
}

function normalizeApplication(
  application: AnyElementalApplication,
): NormalizedApplication {
  if (
    application === null ||
    typeof application !== "object" ||
    Array.isArray(application)
  ) {
    throw new TypeError("Elemental application must be an object.");
  }
  const gaugeUnits = application.gaugeUnits;
  assertGaugeUnits(gaugeUnits);
  if ("icd" in application) {
    if ("icdTag" in application || "icdGroup" in application) {
      throw new TypeError(
        "Elemental application cannot mix the 1.47 selector with frozen legacy ICD fields.",
      );
    }
    const rawSelector = application.icd;
    if (
      rawSelector === null ||
      typeof rawSelector !== "object" ||
      Array.isArray(rawSelector)
    ) {
      throw new TypeError(
        "Elemental application icd selector must be an object.",
      );
    }
    const mode = rawSelector.mode;
    if (mode === "no-icd-v1") {
      return {
        gaugeUnits,
        selector: Object.freeze({ mode: "no-icd-v1" }),
      };
    }
    if (mode === "legacy-boolean-profile-v1") {
      const icdTag = rawSelector.icdTag;
      const profileId = rawSelector.profileId;
      assertNonEmptyString(icdTag, "icdTag");
      assertNonEmptyString(profileId, "profileId");
      return {
        gaugeUnits,
        selector: Object.freeze({ mode, icdTag, profileId }),
      };
    }
    if (mode === "fixed-gcsim-application-v1") {
      const icdTag = rawSelector.icdTag;
      const groupId = rawSelector.groupId;
      assertNonEmptyString(icdTag, "icdTag");
      assertNonEmptyString(groupId, "groupId");
      return {
        gaugeUnits,
        selector: Object.freeze({ mode, icdTag, groupId }),
      };
    }
    throw new RangeError("Unknown elemental application ICD selector mode.");
  }

  const icdTag = application.icdTag;
  const icdGroup = application.icdGroup;
  assertNonEmptyString(icdTag, "icdTag");
  assertNonEmptyString(icdGroup, "icdGroup");
  return {
    gaugeUnits,
    selector:
      icdGroup === "no-icd"
        ? { mode: "no-icd-v1" }
        : {
            mode: "legacy-boolean-profile-v1",
            icdTag,
            profileId: icdGroup,
          },
  };
}

/**
 * Target-local elemental-application ICD state machine.
 *
 * Fixed gcsim windows are scoped by `(sourceActorId, icdTag)`; the group on
 * the first hit owns the reset timer while each current group selects its own
 * numeric sequence. Explicitly migrated legacy profiles retain their older
 * `(actor, tag, profile)` state and repeat-tail default. Legacy direct
 * Burning retains its V147 target-global compatibility shortcut. Trusted
 * Swirl/Burning delivery uses a separately ordered, separately stored
 * reaction-owned namespace resolved only from the pinned policy root.
 */
export class ElementalApplicationIcdEngine {
  private readonly legacyProfiles: ReadonlyMap<string, IcdProfile>;
  /** Configured/direct state: never read or written by reaction-owned hits. */
  private readonly fixedStatesByActor = new Map<
    string,
    Map<string, FixedWindowState<PublicGcsimElementalApplicationGroupId>>
  >();
  private readonly legacyStatesByActor = new Map<
    string,
    Map<string, Map<string, LegacyWindowState>>
  >();
  private burningLegacyState: LegacyWindowState | undefined;
  private lastDirectAttemptFrame: number | null = null;
  /** Reaction-owned Swirl state, target-local and keyed by source actor/tag. */
  private readonly reactionFixedStatesByActor = new Map<
    string,
    Map<string, FixedWindowState<"reaction-a">>
  >();
  /**
   * Observable projection of gcsim's per-character Burning fan-out counters.
   * This is deliberately separate from the legacy configurable Burning slot.
   */
  private reactionBurningState: FixedWindowState<"burning"> | undefined;
  private lastReactionAttemptFrame: number | null = null;
  private activeConsumptionEntry: "direct" | "reaction-owned" | null = null;
  private reentrantConsumptionAttempted = false;

  constructor(options: ElementalApplicationIcdEngineOptions = {}) {
    const profiles = new Map<string, IcdProfile>();
    profiles.set(
      "default",
      validateLegacyProfile("default", DEFAULT_LEGACY_PROFILE),
    );
    for (const [profileId, profile] of Object.entries(
      options.legacyProfiles ?? {},
    )) {
      assertNonEmptyString(profileId, "legacy profile id");
      profiles.set(profileId, validateLegacyProfile(profileId, profile));
    }
    // Burning is engine-owned and cannot be replaced by authoring data.
    profiles.set(
      "burning",
      validateLegacyProfile("burning", BURNING_LEGACY_PROFILE),
    );
    this.legacyProfiles = profiles;
  }

  private runConsumptionEntry<T>(
    entry: "direct" | "reaction-owned",
    consume: () => T,
  ): T {
    if (this.activeConsumptionEntry !== null) {
      this.reentrantConsumptionAttempted = true;
      throw new Error(
        `Elemental application consumption is already active in the ${this.activeConsumptionEntry} namespace; reentrant ${entry} consumption is forbidden.`,
      );
    }
    this.activeConsumptionEntry = entry;
    this.reentrantConsumptionAttempted = false;
    try {
      return consume();
    } finally {
      this.activeConsumptionEntry = null;
      this.reentrantConsumptionAttempted = false;
    }
  }

  private assertNoReentrantConsumption(): void {
    if (this.reentrantConsumptionAttempted) {
      throw new Error(
        "Elemental application input attempted reentrant consumption during normalization; no ICD state was committed.",
      );
    }
  }

  consumeDirectAttempt(
    input: ElementalApplicationAttemptInput,
  ): Readonly<
    Exclude<ElementalApplicationIcdDecisionV147, { kind: "skipped" }>
  > {
    return this.runConsumptionEntry("direct", () => {
      const prepared = this.prepareDirectAttempt(input);
      this.assertNoReentrantConsumption();
      const application = prepared.application;

      if (application.selector.mode === "no-icd-v1") {
        this.lastDirectAttemptFrame = prepared.frame;
        return NO_ICD_DECISION;
      }

      if (application.selector.mode === "legacy-boolean-profile-v1") {
        return this.consumeLegacy(prepared, application.selector);
      }
      return this.consumeFixed(prepared, application.selector);
    });
  }

  /** Validate a direct attempt and every referenced policy without mutation. */
  validateDirectAttempt(input: ElementalApplicationAttemptInput): void {
    this.prepareDirectAttempt(input);
  }

  private prepareDirectAttempt(
    input: ElementalApplicationAttemptInput,
  ): Readonly<PreparedDirectElementalApplicationAttempt> {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("Elemental application attempt must be an object.");
    }
    const frame = input.frame;
    const sourceActorId = input.sourceActorId;
    const rawApplication = input.application;
    assertFrame(frame);
    assertNonEmptyString(sourceActorId, "sourceActorId");
    const application = normalizeApplication(rawApplication);

    if (
      this.lastDirectAttemptFrame !== null &&
      frame < this.lastDirectAttemptFrame
    ) {
      throw new RangeError(
        "Elemental application frame must be non-decreasing within one target engine.",
      );
    }

    if (application.selector.mode === "legacy-boolean-profile-v1") {
      if (!this.legacyProfiles.has(application.selector.profileId)) {
        throw new RangeError(
          `Unknown ICD profile "${application.selector.profileId}" for legacy elemental application; declare it in reactionEngine.icdProfiles.`,
        );
      }
    } else if (application.selector.mode === "fixed-gcsim-application-v1") {
      const group = resolveElementalApplicationGroup(
        application.selector.groupId,
      );
      if (
        group.id === "reaction-a" ||
        group.id === "reaction-b" ||
        group.id === "burning"
      ) {
        throw new RangeError(
          `Elemental application group "${group.id}" is reaction-owned and cannot be configured on a direct hit.`,
        );
      }
    }

    return Object.freeze({ frame, sourceActorId, application });
  }

  /**
   * @deprecated Use consumeDirectAttempt. This compatibility alias is always
   * routed through the direct namespace and cannot access reaction-owned
   * tags/groups.
   */
  consumeAttempt(
    input: ElementalApplicationAttemptInput,
  ): Readonly<
    Exclude<ElementalApplicationIcdDecisionV147, { kind: "skipped" }>
  > {
    return this.consumeDirectAttempt(input);
  }

  consumeReactionAttempt(
    input: TrustedReactionElementalApplicationInput,
  ): Readonly<ElementalApplicationReactionFixedGcsimDecision> {
    return this.runConsumptionEntry("reaction-owned", () => {
      // Resolve and validate the complete trusted binding before touching any
      // ordering cursor or counter. Forged fields, accessors, reentrant Proxy
      // traps, and policy mismatches fail closed without polluting a later
      // valid attempt.
      const normalized = normalizeReactionOwnedInput(input);
      this.assertNoReentrantConsumption();
      if (
        this.lastReactionAttemptFrame !== null &&
        normalized.frame < this.lastReactionAttemptFrame
      ) {
        throw new RangeError(
          "Reaction-owned elemental application frame must be non-decreasing within one target engine.",
        );
      }

      const group = resolveElementalApplicationGroup(normalized.binding.groupId);
      if (group.id !== "reaction-a" && group.id !== "burning") {
        throw new RangeError(
          `Reaction-owned elemental application policy resolved unsupported group "${group.id}".`,
        );
      }
      const groupId = group.id;
      const isBurning = normalized.binding.sourceKind === "burning-tick";
      if (
        (isBurning && groupId !== "burning") ||
        (!isBurning && groupId !== "reaction-a")
      ) {
        throw new RangeError(
          "Reaction-owned elemental application policy channel/group mismatch.",
        );
      }

      let actorStates: Map<string, FixedWindowState<"reaction-a">> | undefined;
      let existing:
        | FixedWindowState<"reaction-a">
        | FixedWindowState<"burning">
        | undefined;
      if (isBurning) {
        existing = this.reactionBurningState;
      } else {
        actorStates = this.reactionFixedStatesByActor.get(
          normalized.sourceActorId,
        );
        existing = actorStates?.get(normalized.binding.sourceIcdTag);
      }
      const opensNewWindow =
        existing === undefined || normalized.frame >= existing.resetAtFrame;
      let state: FixedWindowState<"reaction-a" | "burning">;
      let hitIndex: number;
      if (opensNewWindow) {
        state = {
          windowStartGroupId: groupId,
          resetFrames: group.resetFrames,
          windowStartFrame: normalized.frame,
          resetAtFrame: resolveElementalApplicationResetAtFrame(
            groupId,
            normalized.frame,
          ),
          nextHitIndex: 1,
        };
        hitIndex = 0;
      } else {
        const activeState = existing!;
        hitIndex = activeState.nextHitIndex;
        state = {
          ...activeState,
          nextHitIndex: checkedIncrement(
            hitIndex,
            "Reaction-owned elemental application hitIndex",
          ),
        };
      }
      const sequenceIndex = Math.min(
        hitIndex,
        group.applicationSequence.length - 1,
      );
      const applicationMultiplier = group.applicationSequence[sequenceIndex]!;

      if (isBurning) {
        this.reactionBurningState = state as FixedWindowState<"burning">;
      } else {
        let nextActorStates = actorStates;
        if (nextActorStates === undefined) {
          nextActorStates = new Map();
          this.reactionFixedStatesByActor.set(
            normalized.sourceActorId,
            nextActorStates,
          );
        }
        nextActorStates.set(
          normalized.binding.sourceIcdTag,
          state as FixedWindowState<"reaction-a">,
        );
      }
      this.lastReactionAttemptFrame = normalized.frame;

      const commonDecision = Object.freeze({
        kind: "reaction-fixed-gcsim",
        evaluated: true,
        consumed: true,
        applicationMultiplier,
        allowed: applicationMultiplier > 0,
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
        resetFrames: state.resetFrames,
        windowStartFrame: state.windowStartFrame,
        resetAtFrame: state.resetAtFrame,
        hitIndex,
        sequenceIndex,
        tailPolicy: "clamp",
        resetSchedulePolicy:
          "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
      } as const);

      if (normalized.binding.sourceKind === "burning-tick") {
        return Object.freeze({
          ...commonDecision,
          scope: "trusted-target-global-burning-projection",
          icdTag: normalized.binding.sourceIcdTag,
          groupId: "burning",
          windowStartGroupId: "burning",
        });
      }

      return Object.freeze({
        ...commonDecision,
        scope: "actor-tag",
        icdTag: normalized.binding.sourceIcdTag,
        groupId: "reaction-a",
        windowStartGroupId: "reaction-a",
      });
    });
  }

  private consumeLegacy(
    input: ElementalApplicationAttemptIdentity,
    selector: Extract<
      ElementalApplicationIcdSelector,
      { mode: "legacy-boolean-profile-v1" }
    >,
  ): Readonly<
    Extract<ElementalApplicationIcdDecision, { kind: "legacy-profile" }>
  > {
    const profile = this.legacyProfiles.get(selector.profileId);
    if (profile === undefined) {
      throw new RangeError(
        `Unknown ICD profile "${selector.profileId}" for legacy elemental application; declare it in reactionEngine.icdProfiles.`,
      );
    }

    let existing: LegacyWindowState | undefined;
    let profileStates: Map<string, LegacyWindowState> | undefined;
    if (selector.profileId === "burning") {
      existing = this.burningLegacyState;
    } else {
      profileStates = this.legacyStatesByActor
        .get(input.sourceActorId)
        ?.get(selector.icdTag);
      existing = profileStates?.get(selector.profileId);
    }
    const opensNewWindow =
      existing === undefined || input.frame >= existing.resetAtFrame;
    let state: LegacyWindowState;
    let hitIndex: number;
    if (opensNewWindow) {
      state = {
        resetFrames: profile.resetFrames,
        windowStartFrame: input.frame,
        resetAtFrame: checkedResetAtFrame(input.frame, profile.resetFrames),
        nextHitIndex: 1,
      };
      hitIndex = 0;
    } else {
      const activeState = existing!;
      hitIndex = activeState.nextHitIndex;
      state = {
        ...activeState,
        nextHitIndex: checkedIncrement(
          hitIndex,
          "Legacy elemental application hitIndex",
        ),
      };
    }
    const tailPolicy: IcdSequenceTailPolicy = profile.tailPolicy ?? "repeat";
    const sequenceIndex =
      tailPolicy === "clamp"
        ? Math.min(hitIndex, profile.applicationSequence.length - 1)
        : hitIndex % profile.applicationSequence.length;
    const applicationMultiplier: 0 | 1 = profile.applicationSequence[
      sequenceIndex
    ]
      ? 1
      : 0;

    if (selector.profileId === "burning") {
      this.burningLegacyState = state;
    } else {
      let actorStates = this.legacyStatesByActor.get(input.sourceActorId);
      if (actorStates === undefined) {
        actorStates = new Map();
        this.legacyStatesByActor.set(input.sourceActorId, actorStates);
      }
      let tagStates = actorStates.get(selector.icdTag);
      if (tagStates === undefined) {
        tagStates = new Map();
        actorStates.set(selector.icdTag, tagStates);
      }
      tagStates.set(selector.profileId, state);
    }
    this.lastDirectAttemptFrame = input.frame;
    return Object.freeze({
      kind: "legacy-profile",
      evaluated: true,
      consumed: true,
      applicationMultiplier,
      allowed: applicationMultiplier > 0,
      scope:
        selector.profileId === "burning"
          ? "target-global-burning"
          : "actor-tag-profile",
      profileId: selector.profileId,
      icdTag: selector.icdTag,
      groupId: null,
      windowStartGroupId: null,
      resetFrames: state.resetFrames,
      windowStartFrame: state.windowStartFrame,
      resetAtFrame: state.resetAtFrame,
      hitIndex,
      sequenceIndex,
      tailPolicy,
      resetSchedulePolicy: "window-start-plus-reset-frames",
    });
  }

  private consumeFixed(
    input: ElementalApplicationAttemptIdentity,
    selector: Extract<
      ElementalApplicationIcdSelector,
      { mode: "fixed-gcsim-application-v1" }
    >,
  ): Readonly<
    Extract<ElementalApplicationIcdDecision, { kind: "fixed-gcsim" }>
  > {
    // Resolve before state mutation so a forged/reserved group fails closed.
    const group = resolveElementalApplicationGroup(selector.groupId);
    if (
      group.id === "reaction-a" ||
      group.id === "reaction-b" ||
      group.id === "burning"
    ) {
      throw new RangeError(
        `Elemental application group "${group.id}" is reaction-owned and cannot be configured on a direct hit.`,
      );
    }
    const groupId = group.id as PublicGcsimElementalApplicationGroupId;
    const actorStates = this.fixedStatesByActor.get(input.sourceActorId);
    const existing = actorStates?.get(selector.icdTag);
    const opensNewWindow =
      existing === undefined || input.frame >= existing.resetAtFrame;
    let state: FixedWindowState<PublicGcsimElementalApplicationGroupId>;
    let hitIndex: number;
    if (opensNewWindow) {
      state = {
        windowStartGroupId: groupId,
        resetFrames: group.resetFrames,
        windowStartFrame: input.frame,
        resetAtFrame: resolveElementalApplicationResetAtFrame(
          groupId,
          input.frame,
        ),
        nextHitIndex: 1,
      };
      hitIndex = 0;
    } else {
      hitIndex = existing.nextHitIndex;
      state = {
        ...existing,
        nextHitIndex: checkedIncrement(
          hitIndex,
          "Fixed elemental application hitIndex",
        ),
      };
    }
    const sequenceIndex = Math.min(
      hitIndex,
      group.applicationSequence.length - 1,
    );
    const applicationMultiplier = group.applicationSequence[sequenceIndex]!;

    let nextActorStates = actorStates;
    if (nextActorStates === undefined) {
      nextActorStates = new Map();
      this.fixedStatesByActor.set(input.sourceActorId, nextActorStates);
    }
    nextActorStates.set(selector.icdTag, state);
    this.lastDirectAttemptFrame = input.frame;
    return Object.freeze({
      kind: "fixed-gcsim",
      evaluated: true,
      consumed: true,
      applicationMultiplier,
      allowed: applicationMultiplier > 0,
      scope: "actor-tag",
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
      icdTag: selector.icdTag,
      groupId,
      windowStartGroupId: state.windowStartGroupId,
      resetFrames: state.resetFrames,
      windowStartFrame: state.windowStartFrame,
      resetAtFrame: state.resetAtFrame,
      hitIndex,
      sequenceIndex,
      tailPolicy: "clamp",
      resetSchedulePolicy: "window-start-plus-reset-frames-minus-one",
    });
  }
}
