import { captureSpecialSimulation, parseSpecialSimulation, runSpecialSimulation, type SpecialSimulationRequest } from "@genshin-dps-lab/sim-core";
import { applyExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import type { LunarWorkerRequest, LunarWorkerResponse, LunarExecutionBaselineAudit } from "./lunar-simulation-panel";

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<LunarWorkerRequest>) => void) | null;
  postMessage: (message: LunarWorkerResponse) => void;
};

scope.onmessage = (event): void => {
  const request = event.data;
  try {
    if (request.type === "import-special") {
      scope.postMessage({ type: "imported", capture: parseSpecialSimulation(request.json) });
      return;
    }
    if (request.type !== "run") return;
    let executionBaseline: LunarExecutionBaselineAudit | undefined;
    if (request.executionBaseline !== undefined) {
      const baseline = request.executionBaseline;
      const { config: appliedConfig, profile, ...audit } = applyExecutionProfile(baseline.sourceConfig, baseline.profile, baseline.options);
      const originalCommandCount = baseline.sourceConfig.timeline!.commands.length;
      // Only the original commands receive profile delays. Source cleanse was
      // appended after baseline application in the previous UI path, so its
      // explicitly supplied final request frame remains unchanged.
      request.config.timeline!.commands = [...appliedConfig.timeline!.commands, ...request.config.timeline!.commands.slice(originalCommandCount)];
      executionBaseline = { ...baseline, profile, audit };
    }
    const specialRequest: SpecialSimulationRequest = {
      profile: request.profile,
      config: request.config,
      options: request.options,
      party: request.party,
      ...(request.artifactOptions === undefined ? {} : {
        artifacts: request.artifactOptions.artifacts,
        ...(request.artifactOptions.moonsignLevel === undefined ? {} : { moonsignLevel: request.artifactOptions.moonsignLevel }),
      }),
      ...(request.abilities === undefined ? {} : { abilities: request.abilities }),
    };
    const result = runSpecialSimulation(specialRequest);
    const capture = captureSpecialSimulation(specialRequest, result);
    scope.postMessage({ type: "result", capture, ...(executionBaseline === undefined ? {} : { executionBaseline }) });
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
