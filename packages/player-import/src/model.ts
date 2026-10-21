/** Import-only contract. Never pass this snapshot directly to a damage formula. */
export type FieldState = "known" | "missing" | "invalid" | "unknown-id" | "not-exported";
export interface Field<T> {
  state: FieldState;
  value: T | null;
  path: string;
  unit: "level" | "count" | "flat" | "ratio" | "identity" | "unknown";
  note: string;
}
export interface Identity { id: string; name: string }
export interface Talent {
  base: Field<number>;
  bonus: Field<number>;
  effective: Field<number>;
  accounting: "base-only" | "base-plus-explicit-bonus" | "effective-only";
}
export interface Stat { key: Field<string>; amount: Field<number> }
export const slots = ["flower", "plume", "sands", "goblet", "circlet"] as const;
export type Slot = typeof slots[number];
export interface Artifact {
  slot: Slot;
  item: Field<Identity>;
  identity: Field<Identity>;
  rarity: Field<number>;
  level: Field<number>;
  main: Stat;
  substats: Stat[];
  substatsState: Field<number>;
}
export interface PlayerBuild {
  key: string;
  identity: Field<Identity>;
  level: Field<number>;
  rarity?: Field<number>;
  ascension: Field<number>;
  constellation: Field<number>;
  talents: Record<"auto" | "skill" | "burst", Talent>;
  weapon: {
    identity: Field<Identity>;
    level: Field<number>;
    rarity?: Field<number>;
    ascension: Field<number>;
    refinement: Field<number>;
    stats: Stat[];
    statsState: "observed" | "not-exported" | "missing";
  };
  artifacts: Artifact[];
  panel: { state: "observed" | "not-exported" | "missing"; stats: Stat[]; accounting?: "unverified-text-observation" };
  completeness: { state: "complete" | "partial"; known: number; required: number; issues: { path: string; state: FieldState; note: string }[] };
}
export interface ImportSnapshot {
  schemaVersion: "player-import/1";
  source: {
    kind: "good-file" | "enka-json" | "enka-uid" | "authorized-fixture" | "hutao-text";
    uid: string | null;
    scope: "public-showcase" | "file-equipped-subset" | "fixture-owned-current-equipment";
    inventory: "not-imported";
    history: "not-imported";
    importedAt: string;
    fetchedAt: string | null;
    snapshotAt: null;
    freshness: "upstream-snapshot-time-unknown";
    fixture: boolean;
    catalogRevision: string;
  };
  builds: PlayerBuild[];
  notices: string[];
}
export type ImportResult = { ok: true; snapshot: ImportSnapshot } | { ok: false; code: "secret-input" | "invalid-input" | "unsupported-format" | "empty-import" | "unavailable"; message: string };
