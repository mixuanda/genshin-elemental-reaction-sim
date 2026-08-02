import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  resolveElementalApplicationGroup,
  resolveElementalApplicationResetAtFrame,
  type PublicGcsimElementalApplicationGroupId
} from "@genshin-dps-lab/icd-profiles";
import type {
  AnyElementalApplication,
  ElementalApplicationIcdDecision,
  ElementalApplicationIcdSelector,
  IcdProfile,
  IcdSequenceTailPolicy
} from "@genshin-dps-lab/schemas";

export interface ElementalApplicationAttemptInput {
  frame: number;
  sourceActorId: string;
  application: AnyElementalApplication;
}

export interface ElementalApplicationIcdEngineOptions {
  legacyProfiles?: Readonly<Record<string, IcdProfile>>;
}

interface FixedWindowState {
  windowStartGroupId: PublicGcsimElementalApplicationGroupId;
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
  resetSchedulePolicy: "bypass"
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
    false
  ]) as unknown as boolean[],
  tailPolicy: "clamp"
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
    false
  ]) as unknown as boolean[],
  tailPolicy: "clamp"
});

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
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
      "Elemental application frame must be a non-negative safe integer."
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
    throw new RangeError("Elemental application gaugeUnits must not exceed 20.");
  }
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
    throw new RangeError("Legacy application resetAtFrame exceeds the safe integer range.");
  }
  return resetAtFrame;
}

function validateLegacyProfile(profileId: string, profile: IcdProfile): IcdProfile {
  if (
    typeof profile.resetFrames !== "number" ||
    !Number.isSafeInteger(profile.resetFrames) ||
    profile.resetFrames <= 0 ||
    profile.resetFrames > 36_000
  ) {
    throw new RangeError(
      `Legacy elemental application profile "${profileId}" resetFrames must be a positive safe integer no greater than 36000.`
    );
  }
  if (
    !Array.isArray(profile.applicationSequence) ||
    profile.applicationSequence.length === 0 ||
    profile.applicationSequence.length > 128 ||
    profile.applicationSequence.some((value) => typeof value !== "boolean")
  ) {
    throw new TypeError(
      `Legacy elemental application profile "${profileId}" must provide 1 to 128 boolean applicationSequence entries.`
    );
  }
  if (
    profile.tailPolicy !== undefined &&
    profile.tailPolicy !== "repeat" &&
    profile.tailPolicy !== "clamp"
  ) {
    throw new RangeError(
      `Legacy elemental application profile "${profileId}" has an unsupported tailPolicy.`
    );
  }
  return Object.freeze({
    resetFrames: profile.resetFrames,
    applicationSequence: [...profile.applicationSequence],
    ...(profile.tailPolicy === undefined
      ? {}
      : { tailPolicy: profile.tailPolicy })
  });
}

function normalizeApplication(
  application: AnyElementalApplication
): NormalizedApplication {
  if (
    application === null ||
    typeof application !== "object" ||
    Array.isArray(application)
  ) {
    throw new TypeError("Elemental application must be an object.");
  }
  assertGaugeUnits(application.gaugeUnits);
  if ("icd" in application) {
    if ("icdTag" in application || "icdGroup" in application) {
      throw new TypeError(
        "Elemental application cannot mix the 1.47 selector with frozen legacy ICD fields."
      );
    }
    if (
      application.icd === null ||
      typeof application.icd !== "object" ||
      Array.isArray(application.icd)
    ) {
      throw new TypeError("Elemental application icd selector must be an object.");
    }
    const selector = application.icd;
    if (selector.mode === "no-icd-v1") {
      return { gaugeUnits: application.gaugeUnits, selector };
    }
    if (selector.mode === "legacy-boolean-profile-v1") {
      assertNonEmptyString(selector.icdTag, "icdTag");
      assertNonEmptyString(selector.profileId, "profileId");
      return { gaugeUnits: application.gaugeUnits, selector };
    }
    if (selector.mode === "fixed-gcsim-application-v1") {
      assertNonEmptyString(selector.icdTag, "icdTag");
      assertNonEmptyString(selector.groupId, "groupId");
      return { gaugeUnits: application.gaugeUnits, selector };
    }
    throw new RangeError("Unknown elemental application ICD selector mode.");
  }

  assertNonEmptyString(application.icdTag, "icdTag");
  assertNonEmptyString(application.icdGroup, "icdGroup");
  return {
    gaugeUnits: application.gaugeUnits,
    selector:
      application.icdGroup === "no-icd"
        ? { mode: "no-icd-v1" }
        : {
            mode: "legacy-boolean-profile-v1",
            icdTag: application.icdTag,
            profileId: application.icdGroup
          }
  };
}

/**
 * Target-local elemental-application ICD state machine.
 *
 * Fixed gcsim windows are scoped by `(sourceActorId, icdTag)`; the group on
 * the first hit owns the reset timer while each current group selects its own
 * numeric sequence. Explicitly migrated legacy profiles retain their older
 * `(actor, tag, profile)` state and repeat-tail default. Reaction-owned
 * Burning retains the historical target-global shortcut.
 */
export class ElementalApplicationIcdEngine {
  private readonly legacyProfiles: ReadonlyMap<string, IcdProfile>;
  private readonly fixedStatesByActor = new Map<
    string,
    Map<string, FixedWindowState>
  >();
  private readonly legacyStatesByActor = new Map<
    string,
    Map<string, Map<string, LegacyWindowState>>
  >();
  private burningLegacyState: LegacyWindowState | undefined;
  private lastAttemptFrame: number | null = null;

  constructor(options: ElementalApplicationIcdEngineOptions = {}) {
    const profiles = new Map<string, IcdProfile>();
    profiles.set("default", validateLegacyProfile("default", DEFAULT_LEGACY_PROFILE));
    for (const [profileId, profile] of Object.entries(
      options.legacyProfiles ?? {}
    )) {
      assertNonEmptyString(profileId, "legacy profile id");
      profiles.set(profileId, validateLegacyProfile(profileId, profile));
    }
    // Burning is engine-owned and cannot be replaced by authoring data.
    profiles.set(
      "burning",
      validateLegacyProfile("burning", BURNING_LEGACY_PROFILE)
    );
    this.legacyProfiles = profiles;
  }

  consumeAttempt(
    input: ElementalApplicationAttemptInput
  ): Readonly<
    Exclude<ElementalApplicationIcdDecision, { kind: "skipped" }>
  > {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("Elemental application attempt must be an object.");
    }
    assertFrame(input.frame);
    assertNonEmptyString(input.sourceActorId, "sourceActorId");
    const application = normalizeApplication(input.application);

    if (
      this.lastAttemptFrame !== null &&
      input.frame < this.lastAttemptFrame
    ) {
      throw new RangeError(
        "Elemental application frame must be non-decreasing within one target engine."
      );
    }

    if (application.selector.mode === "no-icd-v1") {
      this.lastAttemptFrame = input.frame;
      return NO_ICD_DECISION;
    }

    if (application.selector.mode === "legacy-boolean-profile-v1") {
      return this.consumeLegacy(input, application.selector);
    }
    return this.consumeFixed(input, application.selector);
  }

  private consumeLegacy(
    input: ElementalApplicationAttemptInput,
    selector: Extract<
      ElementalApplicationIcdSelector,
      { mode: "legacy-boolean-profile-v1" }
    >
  ): Readonly<
    Extract<ElementalApplicationIcdDecision, { kind: "legacy-profile" }>
  > {
    const profile = this.legacyProfiles.get(selector.profileId);
    if (profile === undefined) {
      throw new RangeError(
        `Unknown ICD profile "${selector.profileId}" for legacy elemental application; declare it in reactionEngine.icdProfiles.`
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
        nextHitIndex: 1
      };
      hitIndex = 0;
    } else {
      const activeState = existing!;
      hitIndex = activeState.nextHitIndex;
      state = {
        ...activeState,
        nextHitIndex: checkedIncrement(
          hitIndex,
          "Legacy elemental application hitIndex"
        )
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
    this.lastAttemptFrame = input.frame;
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
      resetSchedulePolicy: "window-start-plus-reset-frames"
    });
  }

  private consumeFixed(
    input: ElementalApplicationAttemptInput,
    selector: Extract<
      ElementalApplicationIcdSelector,
      { mode: "fixed-gcsim-application-v1" }
    >
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
        `Elemental application group "${group.id}" is reaction-owned and cannot be configured on a direct hit.`
      );
    }
    const groupId = group.id as PublicGcsimElementalApplicationGroupId;
    const actorStates = this.fixedStatesByActor.get(input.sourceActorId);
    const existing = actorStates?.get(selector.icdTag);
    const opensNewWindow =
      existing === undefined || input.frame >= existing.resetAtFrame;
    let state: FixedWindowState;
    let hitIndex: number;
    if (opensNewWindow) {
      state = {
        windowStartGroupId: groupId,
        resetFrames: group.resetFrames,
        windowStartFrame: input.frame,
        resetAtFrame: resolveElementalApplicationResetAtFrame(
          groupId,
          input.frame
        ),
        nextHitIndex: 1
      };
      hitIndex = 0;
    } else {
      hitIndex = existing.nextHitIndex;
      state = {
        ...existing,
        nextHitIndex: checkedIncrement(
          hitIndex,
          "Fixed elemental application hitIndex"
        )
      };
    }
    const sequenceIndex = Math.min(
      hitIndex,
      group.applicationSequence.length - 1
    );
    const applicationMultiplier = group.applicationSequence[sequenceIndex]!;

    let nextActorStates = actorStates;
    if (nextActorStates === undefined) {
      nextActorStates = new Map();
      this.fixedStatesByActor.set(input.sourceActorId, nextActorStates);
    }
    nextActorStates.set(selector.icdTag, state);
    this.lastAttemptFrame = input.frame;
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
      resetSchedulePolicy: "window-start-plus-reset-frames-minus-one"
    });
  }
}
