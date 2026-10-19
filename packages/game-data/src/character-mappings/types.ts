/** A damage instance whose coefficient AND executable meaning were inspected in
 * a pinned source. This is deliberately separate from raw talent parsing. */
export interface SourceHitMapping {
  id: string;
  characterSlug: string;
  variantId?: string;
  variantName?: string;
  talentSetId: string;
  abilityKey: "combat1" | "combat2" | "combat3";
  parameterKey: string;
  skillId: string;
  skillLabel?: string;
  hitLabel: string;
  element: "physical" | "pyro" | "hydro" | "cryo" | "electro" | "anemo" | "geo" | "dendro";
  attackTag?: "normal" | "charged" | "plunge" | "skill" | "burst" | "proc" | "reaction";
  additionalTerms?: Array<{ scalingStat: "atk" | "hp" | "def" | "em"; parameterKey: string; sourceCoefficientValues: number[]; coefficientTolerance?: number }>;
  fixedTerms?: Array<{ scalingStat: "atk" | "hp" | "def" | "em"; coefficient: number; sourceField: string; minimumAscension?: number }>;
  /** Reviewed source-literal damage with no catalog talent term; fixedTerms remain mandatory. */
  fixedOnly?: boolean;
  additiveFormulaId?: "clorinde-a1" | "lohen-will-consumed";
  elementalMasteryAdjustmentFormulaId?: "nefer-full-veil-em";
  damageBonusFormulaId?: "dendro-traveler-a4-skill" | "dendro-traveler-a4-burst" | "nefer-burst-veils" | "alyosha-a4-er";
  resistanceReductionFormulaId?: "linnea-a1-lumi";
  critRateFormulaId?: "amber-a1-burst";
  /** Additional sourced talent parameters used by a typed formula, not scaling terms. */
  formulaParameters?: Array<{ key: string; parameterKey: string; sourceCoefficientValues: number[]; coefficientTolerance?: number }>;
  scalingStat: "atk" | "hp" | "def" | "em";
  coefficientMultiplier?: number;
  instanceCount?: number;
  /** Pinned numerical reference, indexed by effective talent level minus one. */
  sourceCoefficientValues?: number[];
  /** Absolute tolerance only for explicitly documented source rounding. */
  coefficientTolerance?: number;
  sourcePaths: string[];
  /** Explicit repository for independently reviewed non-gcsim implementations. */
  sourceRepository?: "genshinsim/gcsim" | "frzyc/genshin-optimizer" | "Dimbreath/AnimeGameData2";
  /** Source host is explicit: a GitLab dump must never be linked as GitHub. */
  sourceHost?: "github" | "gitlab" | undefined;
  /** A raw-only supplement is not an independently cross-checked coefficient. */
  numericEvidenceStatus?: "cross-checked" | "single-source-extracted";
  /** Omitted only for the original fixed b4ae769 source family. */
  sourceCommit?: string;
  assumptions: string[];
  exclusions: string[];
  /** Complete self-damage instances for this named action under its assumptions. */
  completeAction: boolean;
}

/** An identified action whose actual source dependencies conflict or are absent. */
export interface SourceMappingBlocker {
  id: string; characterSlug: string; variantId?: string; variantName?: string;
  talentSetId: string; abilityKey: "combat1" | "combat2" | "combat3";
  parameterKey: string | null; skillId: string; skillLabel: string; hitLabel: string;
  reason: string; sourcePaths: string[]; sourceCommit?: string;
  sourceRepository?: NonNullable<SourceHitMapping["sourceRepository"]>;
  sourceHost?: SourceHitMapping["sourceHost"];
  evidence: Record<string, unknown>;
}
