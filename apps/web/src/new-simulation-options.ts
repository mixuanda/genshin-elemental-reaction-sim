import type {SimulationOptions} from '@genshin-dps-lab/schemas';
import {ANGULAR_GEOMETRY_SEMANTICS} from '@genshin-dps-lab/reaction-formulas';
/** Explicit new browser execution uses frames. Never mutate stored historical options/results. */
export function newSimulationOptions(options:SimulationOptions):SimulationOptions{
 return {...options,compatibilityMode:'legal-frame-v1',
  ...(options.angularGeometrySemantics === undefined ? {angularGeometrySemantics:ANGULAR_GEOMETRY_SEMANTICS} : {})};
}
