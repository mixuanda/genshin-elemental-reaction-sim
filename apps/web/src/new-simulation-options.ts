import type {SimulationOptions} from '@genshin-dps-lab/schemas';
/** Explicit new browser execution uses frames. Never mutate stored historical options/results. */
export function newSimulationOptions(options:SimulationOptions):SimulationOptions{
 return {...options,compatibilityMode:'legal-frame-v1'};
}
