import { createSourceHostResult } from "./source-host-capture";
import { sourceHostResultSchema, type SourceHostResult } from "./source-host-wire";
import { isSourceHostWandererC2ScopeError } from "./source-host-wanderer-c2-scope";

export interface SourceHostResultArchive {
  mode: "replayed" | "readonly-c2-defect";
  /** Export this exact string, including an original reexecution wrapper. */
  originalText: string;
  result: SourceHostResult;
  currentNumericValidation: "passed" | "failed";
  warning: string | null;
}

/** Opening a saved original is separate from claiming it passed current replay.
 * Only a structurally valid saved result with this precise known C2 scope error
 * gets the read-only route. Nothing rewrites its historical formula/schema or
 * verification metadata. Fresh runs and all numerical replay remain strict.
 */
export function openSourceHostResultArchive(originalText: string): SourceHostResultArchive {
  const raw: unknown = JSON.parse(originalText);
  const payload = typeof raw === "object" && raw !== null && "schemaVersion" in raw
    && raw.schemaVersion === "source-host-reexecution-record-v1" && "result" in raw ? raw.result : raw;
  const saved = sourceHostResultSchema.parse(payload);
  try {
    return { mode: "replayed", originalText, result: createSourceHostResult(saved),
      currentNumericValidation: "passed", warning: null };
  } catch (error) {
    if (!isSourceHostWandererC2ScopeError(error)) throw error;
    return { mode: "readonly-c2-defect", originalText, result: saved, currentNumericValidation: "failed",
      warning: `旧结果包含流浪者 C2 作用范围缺陷，未通过当前数值重放。原文可只读查看和原样导出，不能作为本次验证或独立重放通过证明。其他数值未因此获得新验证。${error.message}` };
  }
}
