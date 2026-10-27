import type { AuraStateEntry } from "@genshin-dps-lab/schemas";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDeadline(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function jsonNumber(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Fresh copies of engine-owned, plain Aura snapshots, not an input validator.
 * Burning's prepared ticks and reaction-owned audits produce this closed shape.
 * Keep JSON-copy omission/zero semantics and independent nested owner slots.
 * Unexpected fields or values take the original JSON path rather than being
 * silently discarded if the producer's shape grows. This is not an arbitrary
 * object/getter/proxy cloning API; external input validation remains separate.
 */
export function copyGeneratedAuraStates(
  entries: readonly AuraStateEntry[]
): AuraStateEntry[] {
  const fallback = (): AuraStateEntry[] =>
    JSON.parse(JSON.stringify(entries)) as AuraStateEntry[];
  const copies: AuraStateEntry[] = [];
  for (const entry of entries) {
    if (!isPlainRecord(entry)) return fallback();
    const keys = Object.keys(entry);
    if (
      !keys.includes("element") || !keys.includes("gaugeUnits") ||
      !keys.includes("expiresAtFrame") ||
      keys.some((key) => key !== "element" && key !== "gaugeUnits" &&
        key !== "expiresAtFrame" && key !== "expiresAtTargetFrame" &&
        key !== "sourceSlots")
    ) return fallback();
    const { element, gaugeUnits, expiresAtFrame, expiresAtTargetFrame, sourceSlots } = entry;
    if (
      typeof element !== "string" || !isFiniteNumber(gaugeUnits) ||
      !isDeadline(expiresAtFrame) ||
      (expiresAtTargetFrame !== undefined && !isDeadline(expiresAtTargetFrame)) ||
      (sourceSlots !== undefined && !Array.isArray(sourceSlots))
    ) return fallback();
    let copiedSlots: AuraStateEntry["sourceSlots"];
    if (sourceSlots !== undefined) {
      copiedSlots = [];
      for (const slot of sourceSlots) {
        if (!isPlainRecord(slot)) return fallback();
        const slotKeys = Object.keys(slot);
        if (slotKeys.length !== 2 || !slotKeys.includes("sourceActorId") ||
          !slotKeys.includes("gaugeUnits") || typeof slot.sourceActorId !== "string" ||
          !isFiniteNumber(slot.gaugeUnits)) return fallback();
        copiedSlots.push({
          sourceActorId: slot.sourceActorId,
          gaugeUnits: jsonNumber(slot.gaugeUnits)
        });
      }
    }
    copies.push({
      element,
      gaugeUnits: jsonNumber(gaugeUnits),
      expiresAtFrame: expiresAtFrame === null ? null : jsonNumber(expiresAtFrame),
      ...(expiresAtTargetFrame === undefined ? {} : {
        expiresAtTargetFrame: expiresAtTargetFrame === null ? null : jsonNumber(expiresAtTargetFrame)
      }),
      ...(copiedSlots === undefined ? {} : { sourceSlots: copiedSlots })
    });
  }
  return copies;
}
