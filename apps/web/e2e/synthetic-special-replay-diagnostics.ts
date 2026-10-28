import { parseSpecialSimulation, runSpecialSimulation, type CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";

type Difference = {
  path: string; browserType: string; replayType: string;
  browserNumber?: number; replayNumber?: number;
};
const fixtureVersions = {
  "lunar-bloom": "synthetic-lunar-bloom-integration-v1",
  "lunar-mixed-v2": "synthetic-lunar-mixed-v2-integration-v1",
} as const;

/** Diagnose only these authored synthetic fixtures; never log capture payloads.
 * The unchanged public parser remains the acceptance gate and its original error
 * is rethrown, even if the extra diagnostic replay itself fails.
 */
export function parseSyntheticSpecialReplay(wire: CapturedSpecialSimulation, profile: keyof typeof fixtureVersions): CapturedSpecialSimulation {
  try { return parseSpecialSimulation(JSON.stringify(wire)); }
  catch (error) {
    const config = wire.request.config;
    if (wire.request.profile === profile && typeof config === "object" && config !== null && !Array.isArray(config)
      && "dataVersion" in config && config.dataVersion === fixtureVersions[profile]) {
      try {
        const replay: unknown = JSON.parse(JSON.stringify(runSpecialSimulation(wire.request)));
        const differences: Difference[] = [];
        let differenceCount = 0;
        const kind = (value: unknown): string => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
        function visit(browser: unknown, node: unknown, path: string): void {
          if (Object.is(browser, node)) return;
          if (Array.isArray(browser) && Array.isArray(node)) {
            if (browser.length !== node.length) visit(browser.length, node.length, `${path}.length`);
            for (let i = 0; i < Math.max(browser.length, node.length); i++) visit(browser[i], node[i], `${path}[${i}]`);
          } else if (kind(browser) === "object" && kind(node) === "object") {
            const left = browser as Record<string, unknown>, right = node as Record<string, unknown>;
            for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) visit(left[key], right[key], `${path}.${key}`);
          } else {
            differenceCount++;
            if (differences.length < 24) differences.push({ path, browserType: kind(browser), replayType: kind(node),
              ...(typeof browser === "number" ? { browserNumber: browser } : {}),
              ...(typeof node === "number" ? { replayNumber: node } : {}) });
          }
        }
        visit(wire.result, replay, "$.result");
        console.info("synthetic-special-replay-diagnostic", { profile, differenceCount, differences });
      } catch {
        console.info("synthetic-special-replay-diagnostic", { profile, diagnosticReplayFailed: true });
      }
    }
    throw error;
  }
}
