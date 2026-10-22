import type { SourceHostNativeResult } from "./source-host-wire";

/** A completed timed run uses [0, endFrame). Native endpoint receipts remain in the saved result. */
export function sourceHostFixedDamageWindow(
  result: Pick<SourceHostNativeResult, "applications" | "observationWindow">,
) {
  const window = result.observationWindow;
  if (!window || window.endReason !== "duration" || window.actualEndFrame !== window.configuredEndFrame
    || window.configuredEndFrame <= 0 || !result.applications.every(application => Number.isInteger(application.frame))) return null;
  const endFrame = window.configuredEndFrame;
  return {
    endFrame,
    applications: result.applications.filter(application => application.frame >= 0 && application.frame < endFrame),
    excludedApplications: result.applications.filter(application => application.frame < 0 || application.frame >= endFrame),
  };
}
