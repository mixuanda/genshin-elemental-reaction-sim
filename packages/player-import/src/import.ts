import { importPlayerJson } from "./normalize";
import { importPlayerText, type TextImportOptions } from "./hutao-text";
import type { ImportResult } from "./model";

/** Explicit JSON entry stays unchanged; this routes the independent UI's paste/file input. */
export function importPlayerInput(text: string, options: TextImportOptions = {}): ImportResult {
  return /^[\s\uFEFF]*[\[{]/u.test(text) ? importPlayerJson(text, options) : importPlayerText(text, options);
}
