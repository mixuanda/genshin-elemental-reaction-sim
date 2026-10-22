import { importPlayerJson } from "./normalize";
import { importPlayerText, type TextImportOptions } from "./hutao-text";
import type { ImportResult } from "./model";
import { readInput } from "./input";
import { importOfficialEquipmentObservation } from "./official-equipment-import";

/** Explicit JSON entry stays unchanged; this routes the independent UI's paste/file input. */
export function importPlayerInput(text: string, options: TextImportOptions = {}): ImportResult {
  if (!/^[\s\uFEFF]*[\[{]/u.test(text)) return importPlayerText(text, options);
  const parsed = readInput(text);
  const observation = parsed.ok && parsed.value && typeof parsed.value === "object" ? (parsed.value as { observations?: { format?: unknown } }).observations : undefined;
  if (typeof observation?.format === "string" && observation.format.startsWith("gidps-official-ui-observation/")) return importOfficialEquipmentObservation(text, options);
  return importPlayerJson(text, options);
}
